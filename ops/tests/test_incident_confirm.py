"""Pure unit tests for manual incident confirmation (no Docker, network or alerts)."""
from __future__ import annotations

import copy
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "incident-confirm.py"
SPEC = importlib.util.spec_from_file_location("happyclass_incident_confirm_tests", SCRIPT)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)

T = dt.datetime(2026, 11, 24, 14, 0, tzinfo=dt.timezone.utc)


def snapshot(*items, status=None):
    checks = []
    for idx, (key, level) in enumerate(items, 1):
        checks.append({"key": key, "code": f"test.{idx}", "level": level,
                       "message": "synthetic sample"})
    if status is None:
        status = ("critical" if any(lev == "critical" for _, lev in items)
                  else "warning" if any(lev == "warning" for _, lev in items) else "ok")
    return {"schema_version": 1, "status": status, "checks": checks}


class IncidentConfirmationTests(unittest.TestCase):
    def review(self, prior, when, *items):
        return mod.evaluate(prior, mod.check_monitor(snapshot(*items)), when)

    def test_stable_keys_for_changing_values_and_multiple_postgres_warnings(self):
        k = mod.load_monitor().stable_check_key
        self.assertEqual(k("backup", "Sao lưu offsite: cách đây 20.2 giờ", 1), "backup.offsite")
        self.assertEqual(k("backup", "Sao lưu offsite: cách đây 60.4 giờ", 1), "backup.offsite")
        self.assertEqual(k("postgres", "Phát sinh 1 deadlock giữa hai mẫu.", 1),
                         "postgres.deadlocks")
        self.assertEqual(k("postgres", "Phát sinh 5 deadlock giữa hai mẫu.", 3),
                         "postgres.deadlocks")
        self.assertNotEqual(k("postgres", "Có kết nối đợi lock; cần quan sát lặp lại.", 1),
                            k("postgres", "Có kết nối idle in transaction; cần quan sát lặp lại.", 1))

    def test_good_snapshot_is_not_an_incident(self):
        doc = snapshot(("container.postgres", "ok"), ("postgres.healthy", "ok"))
        state, review = mod.evaluate(mod.empty_state(), mod.check_monitor(doc), T)
        self.assertEqual(state["incidents"], {})
        self.assertEqual(review["transitions"], [])
        self.assertFalse(review["recorded"])
        self.assertFalse(review["scheduled"])
        self.assertFalse(review["notifications_sent"])

    def test_warning_needs_two_separated_samples_and_is_deduplicated(self):
        initial, review = self.review(mod.empty_state(), T, ("backup.offsite", "warning"))
        self.assertEqual(review["pending"], ["backup.offsite"])
        self.assertEqual(review["transitions"], [])
        # A repeated command a few seconds later must not confirm the warning.
        too_fast, review = self.review(initial, T + dt.timedelta(seconds=15),
                                      ("backup.offsite", "warning"))
        self.assertEqual(review["pending"], ["backup.offsite"])
        self.assertEqual(too_fast["incidents"]["backup.offsite"]["consecutive"], 1)
        confirmed, review = self.review(too_fast, T + dt.timedelta(seconds=65),
                                        ("backup.offsite", "warning"))
        self.assertEqual(review["active_confirmed"], ["backup.offsite"])
        self.assertEqual(review["transitions"], [
            {"key": "backup.offsite", "type": "confirmed", "level": "warning"}
        ])
        same, review = self.review(confirmed, T + dt.timedelta(seconds=130),
                                    ("backup.offsite", "warning"))
        self.assertEqual(review["active_confirmed"], ["backup.offsite"])
        self.assertEqual(review["transitions"], [])

    def test_warning_streak_resets_after_long_gap(self):
        initial, _ = self.review(mod.empty_state(), T, ("api.health", "warning"))
        later, review = self.review(initial, T + dt.timedelta(hours=25),
                                    ("api.health", "warning"))
        self.assertEqual(later["incidents"]["api.health"]["consecutive"], 1)
        self.assertEqual(review["pending"], ["api.health"])

    def test_critical_is_immediate_and_duplicate_suppressed(self):
        initial, r = self.review(mod.empty_state(), T, ("container.postgres", "critical"))
        self.assertEqual(r["transitions"][0]["type"], "confirmed")
        again, r = self.review(initial, T + dt.timedelta(seconds=70),
                                ("container.postgres", "critical"))
        self.assertEqual(r["transitions"], [])
        self.assertEqual(r["active_confirmed"], ["container.postgres"])

    def test_escalate_and_deescalate_once(self):
        first, _ = self.review(mod.empty_state(), T, ("api.health", "warning"))
        second, _ = self.review(first, T + dt.timedelta(seconds=70),
                                 ("api.health", "warning"))
        escalated, r = self.review(second, T + dt.timedelta(seconds=140),
                                   ("api.health", "critical"))
        self.assertEqual(r["transitions"][0]["type"], "escalated")
        downgraded, r = self.review(escalated, T + dt.timedelta(seconds=210),
                                    ("api.health", "warning"))
        self.assertEqual(r["transitions"][0]["type"], "deescalated")
        _, r = self.review(downgraded, T + dt.timedelta(seconds=280),
                           ("api.health", "warning"))
        self.assertEqual(r["transitions"], [])

    def test_requires_two_clean_samples_for_recovery(self):
        bad, _ = self.review(mod.empty_state(), T, ("backup.offsite", "critical"))
        first_clean, review = self.review(bad, T + dt.timedelta(seconds=70),
                                         ("backup.offsite", "ok"))
        self.assertEqual(review["recovering"], ["backup.offsite"])
        self.assertEqual(review["transitions"], [])
        quick, review = self.review(first_clean, T + dt.timedelta(seconds=80),
                                   ("backup.offsite", "ok"))
        self.assertEqual(review["recovering"], ["backup.offsite"])
        recovered, review = self.review(quick, T + dt.timedelta(seconds=135),
                                       ("backup.offsite", "ok"))
        self.assertEqual(recovered["incidents"], {})
        self.assertEqual(review["transitions"], [
            {"key": "backup.offsite", "type": "recovered", "level": "critical"}])
        clean, review = self.review(recovered, T + dt.timedelta(seconds=200),
                                    ("backup.offsite", "ok"))
        self.assertEqual(review["transitions"], [])

    def test_critical_returning_during_recovery_cancels_recovery(self):
        active, _ = self.review(mod.empty_state(), T, ("api.health", "critical"))
        cleaning, _ = self.review(active, T + dt.timedelta(seconds=61),
                                  ("api.health", "ok"))
        still_bad, review = self.review(cleaning, T + dt.timedelta(seconds=120),
                                        ("api.health", "critical"))
        self.assertEqual(still_bad["incidents"]["api.health"]["clean_consecutive"], 0)
        self.assertEqual(review["transitions"], [])

    def test_monitor_failure_cannot_cause_false_recovery(self):
        prior, _ = self.review(mod.empty_state(), T, ("backup.offsite", "critical"))
        state, review = self.review(prior, T + dt.timedelta(seconds=70),
                                    ("monitor.unavailable", "critical"))
        self.assertEqual(state["incidents"]["backup.offsite"]["clean_consecutive"], 0)
        self.assertIn("backup.offsite", review["held_unverified"])
        self.assertNotIn({"key": "backup.offsite", "type": "recovered",
                          "level": "critical"}, review["transitions"])

    def test_pg_unavailable_does_not_clear_old_pg_warning(self):
        first, _ = self.review(mod.empty_state(), T, ("postgres.lock_wait", "critical"))
        state, review = self.review(first, T + dt.timedelta(seconds=70),
                                    ("postgres.unavailable", "critical"))
        self.assertIn("postgres.lock_wait", review["held_unverified"])
        self.assertIn("postgres.lock_wait", state["incidents"])

    def test_pg_warning_clears_only_after_real_pg_probe(self):
        prior, _ = self.review(mod.empty_state(), T, ("postgres.lock_wait", "critical"))
        state, review = self.review(prior, T + dt.timedelta(seconds=70),
                                    ("postgres.healthy", "ok"))
        self.assertEqual(review["recovering"], ["postgres.lock_wait"])
        _, review = self.review(state, T + dt.timedelta(seconds=135),
                                ("postgres.healthy", "ok"))
        self.assertEqual(review["transitions"][0]["type"], "recovered")

    def test_missing_unobserved_probe_does_not_count_as_clean(self):
        prior, _ = self.review(mod.empty_state(), T, ("container.postgres", "critical"))
        state, review = self.review(prior, T + dt.timedelta(seconds=70),
                                    ("api.health", "ok"))
        self.assertEqual(state["incidents"]["container.postgres"]["clean_consecutive"], 0)
        self.assertIn("container.postgres", review["held_unverified"])

    def test_invalid_report_or_state_fails_closed(self):
        with self.assertRaises(ValueError):
            mod.check_monitor(snapshot(("api.health", "warning"), status="ok"))
        with self.assertRaises(ValueError):
            mod.check_monitor(snapshot(("api.health", "warning"),
                                       ("api.health", "critical")))
        with self.assertRaises(ValueError):
            mod.check_monitor({"schema_version": 1, "status": "ok", "checks": []})
        corrupted = mod.empty_state()
        corrupted["incidents"]["api.health"] = {"level": "critical", "status": "confirmed",
                                                 "consecutive": 999}
        with self.assertRaises(ValueError):
            mod.validate_state(corrupted)

    def test_no_file_is_created_during_preview(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = mod.state_path(Path(tmp))
            self.assertEqual(mod.load_state(path), mod.empty_state())
            self.assertFalse(path.parent.exists())
            self.assertFalse(path.exists())

    def test_explicit_record_is_private_atomic_and_symlink_safe(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = mod.state_path(Path(tmp))
            initial, _ = self.review(mod.empty_state(), T, ("api.health", "critical"))
            with mod.exclusive_record_lock(path):
                mod.save_state(path, initial)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(mod.load_state(path), initial)
            self.assertEqual(list(path.parent.glob(".incident-confirm-*.tmp")), [])
            outside = Path(tmp) / "elsewhere"
            outside.write_text("untouched")
            path.unlink()
            path.symlink_to(outside)
            with self.assertRaises(ValueError):
                mod.save_state(path, initial)
            self.assertEqual(outside.read_text(), "untouched")

    def test_json_output_error_does_not_leak_exception(self):
        import contextlib
        import io
        out = io.StringIO()
        with patch.object(mod, "create_report", side_effect=ValueError("secret-password")), \
             contextlib.redirect_stdout(out):
            self.assertEqual(mod.main(["--json"]), 2)
        self.assertEqual(json.loads(out.getvalue())["status"], "critical")
        self.assertNotIn("secret-password", out.getvalue())

    def test_report_contains_no_notifications_or_timers(self):
        r = mod.load_monitor().AlertReport()
        r.group = "container"
        r.ok("api: running, healthy (restart count=0)")
        doc = mod.load_monitor().summarize(r, None)
        self.assertEqual(doc["checks"][0]["key"], "container.api")
        self.assertFalse(doc["scheduled"])
        self.assertFalse(doc["notifications_sent"])


if __name__ == "__main__":
    unittest.main()
