"""Offline tests for metadata-only game review and admin role audit."""
from __future__ import annotations

import contextlib
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SRC = Path(__file__).resolve().parents[1] / "prelaunch-aggregate.py"
SPEC = importlib.util.spec_from_file_location("happyclass_prelaunch_aggregate_test", SRC)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)


def healthy():
    return {
        "games_total": 40,
        "games_published": 20,
        "games_pending_review": 10,
        "games_changes_requested": 5,
        "games_approved": 25,
        "published_not_approved": 0,
        "published_without_published_version": 0,
        "users_total": 8,
        "users_active": 7,
        "users_inactive": 1,
        "active_super_admins": 1,
        "active_content_reviewers": 1,
        "staff_role_assignments": 4,
    }


class PrelaunchAggregateTests(unittest.TestCase):
    def test_allowlist_filters_untrusted_db_fields(self):
        src = {"schema_version": 1, **healthy(),
               "email": "user-secret@example.com",
               "password_hash": "private-hash",
               "account_number": "hidden"}
        value = mod.parse_psql(json.dumps(src))
        self.assertEqual(value, healthy())
        self.assertNotIn("email", value)
        self.assertNotIn("user-secret@example.com", json.dumps(value))

    def test_bad_schemas_rejected(self):
        data = healthy()
        for bad in (
            {"schema_version": 2, **data},
            {"schema_version": 1, **{k: v for k, v in data.items() if k != "users_total"}},
            {"schema_version": 1, **data, "games_total": False},
            {"schema_version": 1, **data, "games_total": -1},
            {"schema_version": 1, **data, "active_super_admins": 9},
            {"schema_version": 1, **data, "games_pending_review": 500},
            {"schema_version": 1, **data, "users_total": 5},
            {"schema_version": 1, **data, "published_not_approved": 30},
            {"schema_version": 1, **data, "published_without_published_version": 30},
        ):
            with self.subTest(value=bad), self.assertRaises(ValueError):
                mod.validate(bad)

    def test_no_auto_approval_even_with_all_flags_clear(self):
        obj = healthy()
        obj["games_pending_review"] = 0
        obj["games_changes_requested"] = 0
        obj["games_approved"] = obj["games_total"]
        report = mod.evaluate(obj)
        self.assertEqual(report["counts"]["block"], 0)
        self.assertEqual(report["assessment"], "manual_review_required")
        self.assertFalse(report["public_release_allowed"])
        self.assertFalse(report["content_review_approved"])
        self.assertFalse(report["admin_accounts_approved"])
        self.assertFalse(report["sepay_live_enabled"])
        self.assertFalse(report["database_modified"])

    def test_published_without_approval_or_content_version_blocks(self):
        obj = healthy()
        obj["published_not_approved"] = 2
        obj["published_without_published_version"] = 1
        report = mod.evaluate(obj)
        self.assertEqual(report["counts"]["block"], 2)
        self.assertEqual(report["assessment"], "blocked")
        self.assertIn("content.published_without_approval",
                      [row["key"] for row in report["checks"] if row["level"] == "block"])

    def test_no_active_super_admin_blocks(self):
        obj = healthy()
        obj["active_super_admins"] = 0
        report = mod.evaluate(obj)
        self.assertEqual(report["assessment"], "blocked")
        self.assertIn("accounts.super_admin",
                      [row["key"] for row in report["checks"] if row["level"] == "block"])

    def test_pending_or_changes_requested_require_review_but_are_not_auto_errors(self):
        report = mod.evaluate(healthy())
        self.assertEqual(report["counts"]["block"], 0)
        self.assertIn("content.review_queue",
                      [row["key"] for row in report["checks"] if row["level"] == "manual"])

    def test_no_reviewer_is_manual_not_permission_to_create_one(self):
        obj = healthy()
        obj["active_content_reviewers"] = 0
        report = mod.evaluate(obj)
        self.assertIn("accounts.content_reviewer",
                      [row["key"] for row in report["checks"] if row["level"] == "manual"])

    def test_sql_is_read_only_and_disallows_sql_changes(self):
        raw = mod.SQL.read_text(encoding="utf-8")
        self.assertTrue(mod.sql_is_safe(raw))
        for sql in (
            raw.replace("COMMIT;", "INSERT INTO users VALUES ('unsafe'); COMMIT;"),
            raw.replace("READ ONLY", "READ WRITE"),
            raw.replace("COMMIT;", "DROP TABLE users; COMMIT;"),
            raw.replace("COMMIT;", "SELECT * FROM users FOR UPDATE; COMMIT;"),
        ):
            with self.subTest(sql=sql[-90:]):
                self.assertFalse(mod.sql_is_safe(sql))

    def test_collector_uses_only_compose_postgres_and_sanitizes_errors(self):
        fixture = subprocess.CompletedProcess([], 0, stdout=json.dumps({
            "schema_version": 1, **healthy(),
            "email": "private@example.com",
        }), stderr="NEVER-PRINT-THIS")
        with patch.object(mod.subprocess, "run", return_value=fixture) as caller:
            result = mod.collect()
        command, kwargs = caller.call_args
        self.assertEqual(command[:5], ["docker", "compose", "exec", "-T", "postgres"])
        self.assertIn("READ ONLY", kwargs["input"])
        self.assertTrue(kwargs["check"] is False)
        self.assertEqual(result, healthy())
        failed = subprocess.CompletedProcess([], 1, stdout="", stderr="SQL_PASSWORD_SHOULD_NOT_LEAK")
        with patch.object(mod.subprocess, "run", return_value=failed):
            with self.assertRaisesRegex(RuntimeError, "DB aggregate probe failed") as err:
                mod.collect()
            self.assertNotIn("SQL_PASSWORD_SHOULD_NOT_LEAK", str(err.exception))

    def test_fail_closed_single_json_object_without_secrets(self):
        stdout = io.StringIO()
        with patch.object(mod, "collect", side_effect=RuntimeError("SMTP_SECRET_IN_EXCEPTION")), \
             contextlib.redirect_stdout(stdout):
            code = mod.main(["--json"])
        self.assertEqual(code, 2)
        result = json.loads(stdout.getvalue())
        self.assertEqual(result["assessment"], "blocked")
        self.assertFalse(result["public_release_allowed"])
        self.assertNotIn("SMTP_SECRET_IN_EXCEPTION", stdout.getvalue())

    def test_json_report_contains_counts_only(self):
        report = mod.evaluate(healthy(), captured=dt.datetime(
            2026, 11, 25, 5, tzinfo=dt.timezone.utc))
        serialized = json.dumps(report)
        self.assertEqual(report["schema_version"], 1)
        self.assertTrue(report["read_only"])
        self.assertTrue(report["no_personal_data"])
        self.assertNotIn("email", serialized)
        self.assertNotIn("password", serialized)
        self.assertNotIn("account_number", serialized)


if __name__ == "__main__":
    unittest.main()
