"""Offline unit tests for the on-demand alert monitor. No Docker or network needed."""
from __future__ import annotations

import contextlib
import copy
import importlib.util
import io
import json
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "monitor-once.py"
SPEC = importlib.util.spec_from_file_location("happyclass_monitor_once_tests", SOURCE)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)


def sample() -> dict:
    return {
        "schema_version": 1,
        "captured_at": "2026-11-24T10:00:00.000000Z",
        "server_started_at": "2026-11-08T10:00:00.000000Z",
        "stats_reset": None,
        "database_oid": 16401, "database_size_bytes": 9583616,
        "max_connections": 100, "autovacuum": True,
        "total_connections": 8, "active_connections": 1,
        "idle_in_transaction": 0, "waiting_for_lock": 0,
        "xact_commit": 567354, "xact_rollback": 12,
        "blks_hit": 100000, "blks_read": 12,
        "deadlocks": 0, "temp_files": 0, "temp_bytes": 0,
    }


class IncidentMonitorTests(unittest.TestCase):
    def test_alert_report_codes_and_severity(self):
        r = mod.AlertReport()
        r.group = "container"
        r.ok("postgres healthy")
        r.warn("web slow")
        r.group = "backup"
        r.fail("offsite backup stale")
        doc = mod.summarize(r, None)
        self.assertEqual(doc["status"], "critical")
        self.assertEqual(doc["counts"], {"ok": 1, "warning": 1, "critical": 1})
        self.assertEqual([c["code"] for c in doc["checks"]],
                         ["container.1", "container.2", "backup.1"])
        self.assertFalse(doc["scheduled"])
        self.assertFalse(doc["notifications_sent"])

    def test_single_health_probe_can_emit_json_without_extra_output(self):
        r = mod.AlertReport()
        r.ok("Everything fine")
        doc = mod.summarize(r, None)
        out = io.StringIO()
        with patch.object(mod, "run", return_value=doc), contextlib.redirect_stdout(out):
            self.assertEqual(mod.main(["--json"]), 0)
        encoded = out.getvalue().strip()
        self.assertEqual(json.loads(encoded)["status"], "ok")
        self.assertEqual(len(encoded.splitlines()), 1)

    def test_monitor_fails_closed_with_safe_message(self):
        out = io.StringIO()
        with patch.object(mod, "run", side_effect=RuntimeError("SECRET=my-password")), \
             contextlib.redirect_stdout(out):
            code = mod.main(["--json"])
        self.assertEqual(code, 2)
        doc = json.loads(out.getvalue())
        self.assertEqual(doc["status"], "critical")
        self.assertNotIn("SECRET", out.getvalue())
        self.assertFalse(doc["notifications_sent"])

    def test_baseline_read_never_writes_and_strips_unknown_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            status = Path(tmp) / "status"
            status.mkdir()
            content = sample()
            content["database_password"] = "dont-serialize-me"
            path = status / mod.postgres.STATE_FILE
            path.write_text(json.dumps(content))
            before = path.stat().st_mtime_ns
            data = mod.read_previous_baseline(Path(tmp))
            self.assertNotIn("database_password", data)
            self.assertEqual(before, path.stat().st_mtime_ns)

    def test_missing_or_symlink_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            self.assertIsNone(mod.read_previous_baseline(base))
            status = base / "status"
            status.mkdir()
            (status / mod.postgres.STATE_FILE).symlink_to(base / "outside")
            with self.assertRaises(ValueError):
                mod.read_previous_baseline(base)

    def test_postgres_without_prior_sample_is_current_only(self):
        r = mod.AlertReport()
        with patch.object(mod.postgres, "collect", return_value=sample()) as collector, \
             patch.object(mod, "read_previous_baseline", return_value=None):
            pg = mod.check_postgres(Path("/repo"), Path("/hc"), r, True)
        self.assertEqual(pg["connections"], 8)
        self.assertIsNone(pg["new_deadlocks"])
        self.assertIsNone(pg["interval_minutes"])
        self.assertEqual(r.failed, 0)
        self.assertEqual(r.passed, 1)
        self.assertIn("Chưa có mốc", r.notes[0])
        self.assertEqual(collector.call_count, 1)

    def test_postgres_valid_delta_raises_new_deadlock_warning(self):
        earlier = sample()
        earlier["captured_at"] = "2026-11-24T09:00:00.000000Z"
        earlier["deadlocks"] = 0
        current = sample()
        current["deadlocks"] = 2
        r = mod.AlertReport()
        with patch.object(mod.postgres, "collect", return_value=current), \
             patch.object(mod, "read_previous_baseline", return_value=earlier):
            pg = mod.check_postgres(Path("/repo"), Path("/hc"), r, True)
        self.assertEqual(pg["new_deadlocks"], 2)
        self.assertEqual(pg["interval_minutes"], 60)
        self.assertEqual(r.warnings, 1)
        self.assertEqual(r.failed, 0)

    def test_corrupt_baseline_does_not_hide_current_problem(self):
        broken = ValueError("secrets must not be leaked")
        current = sample()
        current["waiting_for_lock"] = 1
        r = mod.AlertReport()
        with patch.object(mod.postgres, "collect", return_value=current), \
             patch.object(mod, "read_previous_baseline", side_effect=broken):
            pg = mod.check_postgres(Path("/repo"), Path("/hc"), r, True)
        self.assertEqual(pg["waiting_for_lock"], 1)
        self.assertEqual(r.warnings, 2)
        self.assertNotIn("secrets", str(r.checks))

    def test_postgres_timeout_reports_critical_without_leaking_command(self):
        r = mod.AlertReport()
        timeout = subprocess.TimeoutExpired(cmd=["docker", "compose", "secret-value"], timeout=25)
        with patch.object(mod.postgres, "collect", side_effect=timeout):
            self.assertIsNone(mod.check_postgres(Path("/repo"), Path("/hc"), r, True))
        self.assertEqual(r.failed, 1)
        self.assertNotIn("secret-value", json.dumps(mod.summarize(r, None)))

    def test_postgres_unhealthy_skips_sql_completely(self):
        r = mod.AlertReport()
        with patch.object(mod.postgres, "collect") as collector:
            self.assertIsNone(mod.check_postgres(Path("/repo"), Path("/hc"), r, False))
        collector.assert_not_called()
        self.assertEqual(r.failed, 1)

    def test_runtime_reuses_existing_health_checks_and_suppresses_prints(self):
        r = mod.AlertReport()
        env = {"CLOUDFLARE_TUNNEL_TOKEN": "set", "HC_DATA_DIR": "/data/hc"}
        stdout = io.StringIO()
        with patch.object(mod.health, "check_container_states",
                          side_effect=lambda repo, report, tunnel: (
                              print("PRIVATE RAW LOG"), report.ok("postgres healthy"),
                              {"postgres": "123"})[-1]) as containers, \
             patch.object(mod.health, "check_api_health") as api, \
             patch.object(mod.health, "check_host_resources") as host, \
             patch.object(mod.health, "check_docker_stats") as stats, \
             patch.object(mod.health, "check_backups") as backups, \
             contextlib.redirect_stdout(stdout):
            ids = mod.check_runtime(Path("/repo"), r, env)
        self.assertEqual(ids, {"postgres": "123"})
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(r.passed, 1)
        self.assertEqual(r.checks[0]["code"], "container.1")
        containers.assert_called_once()
        api.assert_called_once()
        host.assert_called_once()
        stats.assert_called_once()
        backups.assert_called_once()

    def test_sample_has_no_secrets_or_application_rows(self):
        r = mod.AlertReport()
        current = sample()
        current["private_user_record"] = "must-never-appear"
        with patch.object(mod.postgres, "collect", return_value=current), \
             patch.object(mod, "read_previous_baseline", return_value=None):
            pg = mod.check_postgres(Path("/repo"), Path("/hc"), r, True)
        text = json.dumps(mod.summarize(r, pg))
        self.assertNotIn("private_user_record", text)
        self.assertNotIn("must-never-appear", text)
        self.assertIn("8", text)


if __name__ == "__main__":
    unittest.main()
