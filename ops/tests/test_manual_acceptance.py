"""Safe manual go-live acceptance assertions. Local fixtures only, no services touched."""
from __future__ import annotations

import contextlib
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import stat
import sys
import tempfile
import unittest

SRC = Path(__file__).resolve().parents[1] / "manual-acceptance.py"
SPEC = importlib.util.spec_from_file_location("happyclass_manual_acceptance_tests", SRC)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)
NOW = dt.datetime(2026, 11, 25, 6, 0, 0, tzinfo=dt.timezone.utc)


class ManualAcceptanceTests(unittest.TestCase):
    def setup_dir(self, base: Path) -> Path:
        data = base / "data"
        (data / "status").mkdir(parents=True)
        return data

    def test_missing_state_read_is_read_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            self.assertEqual(mod.active_assertions(data, NOW), ([], []))
            self.assertFalse(path.exists())
            self.assertEqual(list(path.parent.iterdir()), [])

    def test_attest_writes_only_private_metadata_and_is_allowlisted(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            mod.change(path, "smtp.delivery", revoke=False, now=NOW)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(mod.active_assertions(data, NOW), (["smtp.delivery"], []))
            encoded = path.read_text()
            self.assertNotIn("password", encoded.lower())
            self.assertNotIn("payment_bank", encoded.lower())
            self.assertEqual(set(json.loads(encoded)), {"schema_version", "entries"})

    def test_expires_after_seven_days(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            mod.change(mod.state_path(data), "payment.sandbox_acceptance",
                       revoke=False, now=NOW)
            self.assertEqual(mod.active_assertions(data, NOW + dt.timedelta(days=6))[0],
                             ["payment.sandbox_acceptance"])
            self.assertEqual(mod.active_assertions(data, NOW + dt.timedelta(days=7)),
                             ([], ["payment.sandbox_acceptance"]))

    def test_two_assertions_preserved_and_one_revoked(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            mod.change(path, "smtp.delivery", revoke=False, now=NOW)
            mod.change(path, "smtp.auth_flows", revoke=False, now=NOW)
            self.assertEqual(mod.active_assertions(data, NOW)[0],
                             ["smtp.auth_flows", "smtp.delivery"])
            mod.change(path, "smtp.delivery", revoke=True, now=NOW)
            self.assertEqual(mod.active_assertions(data, NOW)[0], ["smtp.auth_flows"])

    def test_legal_and_owner_signoff_cannot_be_self_attested(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            for key in ("legal.owner_approval", "operator.signoff", "payment.live"):
                with self.assertRaises(ValueError):
                    mod.change(path, key, revoke=False, now=NOW)
            self.assertFalse(path.exists())

    def test_explicit_confirmation_required_for_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            for args in (
                ["--attest", "smtp.delivery"],
                ["--attest", "smtp.delivery", "--confirm", "INCORRECT"],
                ["--revoke", "smtp.delivery", "--confirm", "I_VERIFIED"],
            ):
                with self.subTest(args=args), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(mod.main(args + ["--data-dir", str(data)]), 2)
                self.assertFalse(path.exists())
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(mod.main(["--attest", "smtp.delivery", "--confirm",
                                           "I_VERIFIED", "--data-dir", str(data)]), 0)
            self.assertTrue(path.exists())

    def test_json_read_is_single_object_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = mod.main(["--json", "--data-dir", str(data)])
            result = json.loads(out.getvalue())
            self.assertEqual(code, 0)
            self.assertFalse(result["public_release_allowed"])
            self.assertFalse(result["sepay_live_enabled"])
            self.assertFalse(result["assertion_is_independent_proof"])
            self.assertEqual(result["attested_keys"], [])
            self.assertFalse(mod.state_path(data).exists())

    def test_malformed_state_refused_without_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            path.write_text('{"schema_version":1,"entries":{"legal.owner_approval":{}}}')
            path.chmod(0o600)
            original = path.read_bytes()
            with self.assertRaises(ValueError):
                mod.active_assertions(data, NOW)
            with self.assertRaises(ValueError):
                mod.change(path, "smtp.delivery", revoke=False, now=NOW)
            self.assertEqual(path.read_bytes(), original)

    def test_loose_permissions_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            path = mod.state_path(data)
            mod.change(path, "smtp.delivery", revoke=False, now=NOW)
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                mod.active_assertions(data, NOW)
            with self.assertRaises(ValueError):
                mod.change(path, "smtp.delivery", revoke=True, now=NOW)

    def test_symlink_file_and_status_directory_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = self.setup_dir(root)
            path = mod.state_path(data)
            target = root / "outside"
            target.write_text("Do not overwrite.")
            path.symlink_to(target)
            with self.assertRaises(ValueError):
                mod.active_assertions(data, NOW)
            with self.assertRaises(ValueError):
                mod.change(path, "smtp.delivery", revoke=False, now=NOW)
            self.assertEqual(target.read_text(), "Do not overwrite.")
            path.unlink()
            # Remove the lock file created by the rejected writer, if present.
            # Test fixture cleanup only; production code never unlinks user data.
            for p in (data / "status").iterdir():
                p.unlink()
            (data / "status").rmdir()
            (data / "status").symlink_to(root)
            with self.assertRaises(ValueError):
                mod.state_path(data)

    def test_invalid_expiry_and_future_timestamp_fail_closed(self):
        sample = mod.empty_state()
        sample["entries"]["smtp.delivery"] = {
            "attested_at": mod.timestamp(NOW),
            "expires_at": mod.timestamp(NOW + dt.timedelta(days=8))
        }
        with self.assertRaises(ValueError):
            mod.validate(sample)
        with tempfile.TemporaryDirectory() as tmp:
            data = self.setup_dir(Path(tmp))
            mod.change(mod.state_path(data), "smtp.delivery", revoke=False,
                       now=NOW + dt.timedelta(days=2))
            with self.assertRaises(ValueError):
                mod.active_assertions(data, NOW)

    def test_no_record_if_status_dir_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / "data"
            with self.assertRaises(ValueError):
                mod.change(mod.state_path(data), "smtp.delivery",
                           revoke=False, now=NOW)
            self.assertFalse((data / "status").exists())

    def test_non_absolute_and_path_traversal_rejected(self):
        with self.assertRaises(ValueError):
            mod.state_path(Path("relative"))
        with self.assertRaises(ValueError):
            mod.state_path(Path("/tmp/../etc"))


if __name__ == "__main__":
    unittest.main()
