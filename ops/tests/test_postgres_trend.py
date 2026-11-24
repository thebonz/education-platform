"""Tests for PostgreSQL read-only snapshot parsing, comparison and safe local storage."""
import copy
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SRC = Path(__file__).resolve().parents[1] / "postgres-trend.py"
SPEC = importlib.util.spec_from_file_location("happyclass_postgres_trend", SRC)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)


def sample():
    return {
        "schema_version": 1, "captured_at": "2026-11-24T09:00:03.000001Z",
        "server_started_at": "2026-11-08T10:00:00.000000Z",
        "stats_reset": None, "database_oid": 16401,
        "database_size_bytes": 9583616, "max_connections": 100,
        "autovacuum": True, "total_connections": 8,
        "active_connections": 1, "idle_in_transaction": 0,
        "waiting_for_lock": 0, "xact_commit": 567350,
        "xact_rollback": 12, "blks_hit": 100000, "blks_read": 12,
        "deadlocks": 0, "temp_files": 0, "temp_bytes": 0,
    }


class PostgresTrendTests(unittest.TestCase):
    def test_psql_json_allowlist_strips_unexpected_fields(self):
        data = sample()
        data["password"] = "must-not-store"
        result = mod.parse_psql_output(json.dumps(data))
        self.assertNotIn("password", result)
        self.assertEqual(result["xact_commit"], 567350)
        self.assertNotIn("must-not-store", json.dumps(result))

    def test_bad_sample_is_rejected(self):
        bad = [
            {"schema_version": 2, **{k: v for k, v in sample().items() if k != "schema_version"}},
            {**sample(), "xact_commit": -1},
            {**sample(), "deadlocks": "1"},
            {**sample(), "autovacuum": "on"},
            {**sample(), "max_connections": 0},
            {**sample(), "captured_at": "2026-11-24T09:00:00"},
            {**sample(), "total_connections": 101},
        ]
        for data in bad:
            with self.subTest(data=data), self.assertRaises(ValueError):
                mod.validate_sample(data)
        with self.assertRaises(ValueError):
            mod.parse_psql_output("BEGIN\n{}\nCOMMIT")

    def test_delta_matches_user_two_samples(self):
        previous = sample()
        later = copy.deepcopy(previous)
        later["captured_at"] = "2026-11-24T09:00:08.000001Z"
        later["xact_commit"] += 4
        delta, reason = mod.compare(previous, later)
        self.assertEqual(reason, "")
        self.assertEqual(delta["xact_commit"], 4)
        self.assertEqual(delta["xact_rollback"], 0)
        self.assertEqual(delta["deadlocks"], 0)
        self.assertEqual(delta["seconds"], 5)

    def test_reset_and_negative_counters_start_new_baseline(self):
        prior = sample()
        curr = copy.deepcopy(prior)
        curr["captured_at"] = "2026-11-24T09:01:00.000001Z"
        curr["server_started_at"] = "2026-11-24T09:00:00.000000Z"
        delta, msg = mod.compare(prior, curr)
        self.assertIsNone(delta)
        self.assertIn("khởi động lại", msg)
        curr = copy.deepcopy(prior)
        curr["captured_at"] = "2026-11-24T09:01:00.000001Z"
        curr["stats_reset"] = "2026-11-24T09:00:30.000000Z"
        self.assertIsNone(mod.compare(prior, curr)[0])
        curr["stats_reset"] = None
        curr["deadlocks"] = -1  # comparison guard for counter reset
        self.assertIsNone(mod.compare(prior, curr)[0])
        curr = copy.deepcopy(prior)
        self.assertIsNone(mod.compare(prior, curr)[0])

    def test_classification_is_advisory(self):
        healthy = sample()
        self.assertEqual(mod.classify(healthy, None), ([], []))
        healthy["total_connections"] = 80
        self.assertTrue(mod.classify(healthy, None)[0])
        healthy["total_connections"] = 95
        self.assertTrue(mod.classify(healthy, None)[1])
        healthy["total_connections"] = 8
        healthy["waiting_for_lock"] = 1
        self.assertTrue(mod.classify(healthy, None)[0])
        healthy["waiting_for_lock"] = 0
        self.assertTrue(mod.classify(healthy, {"deadlocks": 1, "xact_commit": 50,
                                              "xact_rollback": 0})[0])

    def test_state_write_is_atomic_private_and_schema_filtered(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "status" / mod.STATE_FILE
            mod.write_state(path, mod.validate_sample(sample()))
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(json.loads(path.read_text())["xact_commit"], 567350)
            altered = sample()
            altered["xact_commit"] += 4
            mod.write_state(path, mod.validate_sample(altered))
            self.assertEqual(json.loads(path.read_text())["xact_commit"], 567354)
            self.assertEqual(len(list(path.parent.glob("*.tmp"))), 0)

    def test_state_rejects_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "status" / mod.STATE_FILE
            path.parent.mkdir()
            outside = Path(tmp) / "outside.json"
            outside.write_text("not a baseline")
            path.symlink_to(outside)
            with self.assertRaises(OSError):
                mod.write_state(path, sample())
            self.assertEqual(outside.read_text(), "not a baseline")

    def test_collector_invokes_only_compose_postgres_and_keeps_stderr_private(self):
        response = subprocess.CompletedProcess([], 0, stdout=json.dumps(sample()), stderr="")
        with patch.object(mod.subprocess, "run", return_value=response) as run:
            with tempfile.TemporaryDirectory() as tmp:
                repo = Path(tmp)
                sql = repo / "trend.sql"
                sql.write_text("BEGIN READ ONLY; SELECT 1; COMMIT;")
                result = mod.collect(repo, sql)
        args, kwargs = run.call_args
        self.assertEqual(args[0][:5], ["docker", "compose", "exec", "-T", "postgres"])
        self.assertIn("BEGIN READ ONLY", kwargs["input"])
        self.assertEqual(result["total_connections"], 8)
        error = subprocess.CompletedProcess([], 1, stdout="", stderr="SECRET=do-not-print")
        with patch.object(mod.subprocess, "run", return_value=error):
            with tempfile.TemporaryDirectory() as tmp:
                p = Path(tmp) / "trend.sql"
                p.write_text("BEGIN READ ONLY;")
                with self.assertRaisesRegex(RuntimeError, "Không lấy được"):
                    mod.collect(Path(tmp), p)


if __name__ == "__main__":
    unittest.main()
