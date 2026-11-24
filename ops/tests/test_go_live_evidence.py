"""Offline unit tests for conservative pre-launch gates; no real email, payment or Docker."""
from __future__ import annotations

import contextlib
import datetime as dt
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

SRC = Path(__file__).resolve().parents[1] / "go-live-evidence.py"
SPEC = importlib.util.spec_from_file_location("happyclass_go_live_evidence_tests", SRC)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)
NOW = dt.datetime(2026, 11, 24, 15, 0, tzinfo=dt.timezone.utc)

DEFAULT = {
    "HC_DATA_DIR": "/data/education-games-platform",
    "API_NODE_ENV": "production",
    "COOKIE_SECURE": "true",
    "MAIL_TRANSPORT": "smtp",
    "MAIL_FROM": "HappyClass <help@example.com>",  # overridden to plain valid addr
    "SMTP_HOST": "smtp.example.com",
    "SMTP_PORT": "587",
    "SMTP_SECURE": "false",
    "SMTP_USER": "demo-user",
    "SMTP_PASSWORD": "fake-secret-password",
    "PAYMENT_MODE": "sandbox",
    "PAYMENT_BANK_ACCOUNT": "123456789",
    "PAYMENT_BANK_ACCOUNT_NAME": "example operator",
    "SEPAY_WEBHOOK_KEY": "fake-secret-very-long-key-for-tests",
    "OFFLINE_SIGNING_KEY": "fake-offline-key",
    "CONTACT_ZALO": "fake-zalo",
}
DEFAULT["MAIL_FROM"] = "help@example.com"


class GoLiveEvidenceTests(unittest.TestCase):
    def fixtures(self, root: Path, *, env_updates: dict | None = None,
                 legal: str = "export const legal = { draft: 'Already approved' };"):
        env = dict(DEFAULT)
        if env_updates:
            env.update(env_updates)
        env_path = root / ".env"
        env_path.write_text("\n".join(f"{k}={v}" for k, v in env.items()) + "\n",
                            encoding="utf-8")
        env_path.chmod(0o600)
        status = root / "data" / "status"
        status.mkdir(parents=True, exist_ok=True)
        for name in ("backup.json", "restore-test.json"):
            (status / name).write_text(json.dumps({
                "lastSuccess": "2026-11-24T12:00:00Z",
                "secrets": "must-not-appear-in-json",
            }), encoding="utf-8")
        legal_path = root / "legal.tsx"
        legal_path.write_text(legal, encoding="utf-8")
        return env_path, root / "data", legal_path

    def statuses(self, report):
        return {g["key"]: g["status"] for g in report["gates"]}

    def test_fully_configured_still_requires_human_and_never_opens_public(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(mod, "timer_ok", return_value=True):
            env, datadir, legal = self.fixtures(Path(tmp))
            result = mod.evaluate(env, datadir, legal, now=NOW)
        self.assertEqual(result["assessment"], "manual_review_required")
        self.assertEqual(result["counts"]["block"], 0)
        self.assertEqual(result["counts"]["manual"], len(mod.MANUAL_GATES))
        self.assertFalse(result["public_release_allowed"])
        self.assertTrue(result["requires_owner_approval"])
        self.assertFalse(result["smtp_test_email_sent"])
        self.assertFalse(result["sepay_transaction_created"])
        self.assertFalse(result["configuration_changed"])
        self.assertFalse(result["notifications_sent"])

    def test_secret_values_do_not_leak_even_when_misconfigured(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(mod, "timer_ok", return_value=False):
            env, datadir, legal = self.fixtures(Path(tmp), env_updates={
                "SEPAY_WEBHOOK_KEY": "SENSITIVE-KEY",
                "SMTP_HOST": "SENSITIVE-HOST",
                "SMTP_PASSWORD": "SENSITIVE-PASSWORD",
                "PAYMENT_BANK_ACCOUNT": "SENSITIVE-ACCOUNT",
                "MAIL_FROM": "SENSITIVE-EMAIL",
            })
            result = mod.evaluate(env, datadir, legal, now=NOW)
            encoded = json.dumps(result)
        for word in ["SENSITIVE-KEY", "SENSITIVE-HOST",
                     "SENSITIVE-PASSWORD", "SENSITIVE-ACCOUNT", "SENSITIVE-EMAIL"]:
            self.assertNotIn(word, encoded)
        self.assertEqual(result["assessment"], "blocked")

    def test_env_permissions_and_absent_env_are_blockers(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(Path(tmp))
            env.chmod(0o644)
            result = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(result)["env.permissions"], "block")
            env.unlink()
            result = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(result)["env.permissions"], "block")
            self.assertEqual(self.statuses(result)["smtp.config"], "block")

    def test_payment_live_is_never_automatically_approved(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(Path(tmp), env_updates={"PAYMENT_MODE": "live"})
            report = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(report)["payment.mode"], "block")
            self.assertFalse(report["public_release_allowed"])

    def test_smtp_mismatched_auth_and_bad_port_are_blocked(self):
        for updates in ({"SMTP_PASSWORD": ""}, {"SMTP_PORT": "not-a-port"},
                        {"MAIL_TRANSPORT": "log"}, {"MAIL_FROM": "not-email"},
                        {"SMTP_SECURE": "invalid"}):
            with self.subTest(updates=updates), tempfile.TemporaryDirectory() as tmp:
                env, datadir, legal = self.fixtures(Path(tmp), env_updates=updates)
                result = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
                self.assertEqual(self.statuses(result)["smtp.config"], "block")

    def test_backup_age_limits_and_future_date_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(Path(tmp))
            report = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(report)["backup.offsite"], "pass")
            self.assertEqual(self.statuses(report)["backup.restore"], "pass")
            (datadir / "status" / "backup.json").write_text(
                json.dumps({"lastSuccess": "2026-11-20T00:00:00Z"}))
            (datadir / "status" / "restore-test.json").write_text(
                json.dumps({"lastSuccess": "2026-11-25T00:00:00Z"}))
            report = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(report)["backup.offsite"], "block")
            self.assertEqual(self.statuses(report)["backup.restore"], "block")

    def test_legal_draft_and_missing_file_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(
                Path(tmp), legal="""export const legal = {
                  draft: 'Bản dự thảo áp dụng trong giai đoạn chạy thử.'
                };""")
            result = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(result)["legal.draft"], "block")
            legal.unlink()
            result = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(result)["legal.draft"], "block")

    def test_timer_checks_are_fixed_names_and_no_systemd_means_manual(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(Path(tmp))
            result = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(result)["timer.backup"], "manual")
            self.assertEqual(self.statuses(result)["timer.restore"], "manual")
        with self.assertRaises(ValueError):
            mod.timer_ok("unrelated-project.timer")

    def test_symlinked_status_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(Path(tmp))
            path = datadir / "status" / "backup.json"
            real = Path(tmp) / "outside"
            real.write_text(json.dumps({"lastSuccess": "2026-11-24T12:00:00Z"}))
            path.unlink()
            path.symlink_to(real)
            report = mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            self.assertEqual(self.statuses(report)["backup.offsite"], "block")

    def test_json_stdout_is_one_object_and_no_success_exit_while_manual_pending(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(mod, "timer_ok", return_value=True):
            env, datadir, legal = self.fixtures(Path(tmp))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = mod.main(["--json", "--env-file", str(env), "--data-dir", str(datadir),
                                 "--legal-file", str(legal)])
        self.assertEqual(code, 1)
        lines = out.getvalue().splitlines()
        self.assertEqual(len(lines), 1)
        self.assertEqual(json.loads(lines[0])["assessment"], "manual_review_required")

    def test_no_changes_to_local_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            env, datadir, legal = self.fixtures(Path(tmp))
            paths = [env, legal, datadir / "status" / "backup.json",
                     datadir / "status" / "restore-test.json"]
            before = {str(p): (p.stat().st_mtime_ns, p.read_bytes()) for p in paths}
            mod.evaluate(env, datadir, legal, check_timers=False, now=NOW)
            after = {str(p): (p.stat().st_mtime_ns, p.read_bytes()) for p in paths}
            self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
