"""Unit tests for read-only HappyClass runtime health classification."""
import datetime as dt
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "runtime-health.py"
SPEC = importlib.util.spec_from_file_location("happyclass_runtime_health", SOURCE)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)


class RuntimeHealthUnitTests(unittest.TestCase):
    def test_disk_thresholds(self):
        self.assertEqual(mod.classify_disk(5), "ok")
        self.assertEqual(mod.classify_disk(85), "warn")
        self.assertEqual(mod.classify_disk(97), "fail")

    def test_available_ram_thresholds(self):
        self.assertEqual(mod.classify_available_ram(88), "ok")
        self.assertEqual(mod.classify_available_ram(9.99), "warn")
        self.assertEqual(mod.classify_available_ram(4.99), "fail")

    def test_container_memory_and_cpu_thresholds(self):
        self.assertEqual(mod.classify_container_memory(5.2), "ok")
        self.assertEqual(mod.classify_container_memory(85), "warn")
        self.assertEqual(mod.classify_cpu(42.08, mod.EXPECTED_CPU_LIMITS["tts"]), "ok")
        self.assertEqual(mod.classify_cpu(91, mod.EXPECTED_CPU_LIMITS["tts"]), "warn")
        self.assertEqual(mod.classify_cpu(20, mod.EXPECTED_CPU_LIMITS["tunnel"]), "ok")

    def test_percent_parser_rejects_bad_values(self):
        self.assertAlmostEqual(mod.parse_percent("42.08%"), 42.08)
        self.assertAlmostEqual(mod.parse_percent(" 0.4% "), 0.4)
        for bad in ["100", "nan%", "-20%", "x%", "1.2% something"]:
            with self.subTest(value=bad), self.assertRaises(ValueError):
                mod.parse_percent(bad)

    def test_backup_ages(self):
        now = dt.datetime(2026, 11, 24, 10, 0, tzinfo=dt.timezone.utc)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "backup.json"
            path.write_text(json.dumps({"lastSuccess": "2026-11-23T22:00:00Z"}), encoding="utf-8")
            self.assertAlmostEqual(mod.status_age_hours(path, now=now), 12.0)
            path.write_text(json.dumps({"lastSuccess": "2026-11-23T22:00:00"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                mod.status_age_hours(path, now=now)
            path.write_text(json.dumps({"lastSuccess": "2026-11-25T00:00:00Z"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                mod.status_age_hours(path, now=now)

    def test_env_reads_only_allowed_keys_and_masks_token(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env"
            path.write_text(
                "HC_DATA_DIR=/data/education-games-platform\n"
                "HC_API_HOST_PORT=3101\n"
                "CLOUDFLARE_TUNNEL_TOKEN=secret-token-must-not-leak\n"
                "SMTP_PASSWORD=another-secret\n"
                "SEPAY_WEBHOOK_KEY=never-print-this\n",
                encoding="utf-8",
            )
            values = mod.read_nonsecret_env(path)
            self.assertEqual(values["HC_DATA_DIR"], "/data/education-games-platform")
            self.assertEqual(values["CLOUDFLARE_TUNNEL_TOKEN"], "set")
            self.assertNotIn("SMTP_PASSWORD", values)
            self.assertNotIn("SEPAY_WEBHOOK_KEY", values)
            self.assertNotIn("secret-token-must-not-leak", str(values))

    def test_docker_stats_only_parses_happyclass_service_names(self):
        report = mod.Report()
        output = ("happyclass-tts-1|42.08%|2.96%\n"
                  "another-project-tts-1|100.00%|99.00%")
        with patch.object(mod, "call", return_value=output) as fake_call:
            mod.check_docker_stats(Path("."), {"tts": "dummy-container-id"}, report)
        self.assertEqual(report.passed, 1)
        self.assertEqual(report.warnings, 0)
        self.assertEqual(report.failed, 0)
        self.assertEqual(fake_call.call_args[0][0][-1], "dummy-container-id")


if __name__ == "__main__":
    unittest.main()
