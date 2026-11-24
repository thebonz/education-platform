"""Pure/Python-stdlib tests for bounded localhost performance smoke."""
import importlib.util
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "smoke-load-local.py"
SPEC = importlib.util.spec_from_file_location("happyclass_smoke_load_local", SOURCE)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)


class DummyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "https://example.com/")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok","database":"connected"}')

    def log_message(self, *_args):
        pass


class SmokeLoadLocalTests(unittest.TestCase):
    def test_percentiles(self):
        self.assertEqual(mod.percentile_ms([.1, .2, .3, .4], 50), 200)
        self.assertEqual(mod.percentile_ms([.1, .2, .3, .4], 95), 400)
        self.assertEqual(mod.percentile_ms([], 95), 0)

    def test_safe_port_bounds(self):
        self.assertEqual(mod.valid_port("3101"), 3101)
        for bad in ["0", "65536", "127.0.0.1", "80:90", "-1"]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                mod.valid_port(bad)

    def test_url_path_and_host(self):
        t = mod.site_target("English", "https://english.happyclass.asia/", 3100)
        self.assertEqual(t.local_url, "http://127.0.0.1:3100/")
        self.assertEqual(t.host, "english.happyclass.asia")
        self.assertEqual(mod.site_target("Vietnamese", "http://localhost:3100/vietnamese", 3100).path, "/vietnamese")
        for bad in ["ftp://example.com", "https://alice:password@example.com/", "https://example.com/a/../b"]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                mod.site_target("bad", bad, 3100)

    def test_only_reads_nonsecret_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env"
            path.write_text(
                'SITE_ENGLISH_URL="https://english.happyclass.asia"\n'
                'SITE_VIETNAMESE_URL=https://tiengviet.happyclass.asia\n'
                'HC_API_HOST_PORT=3101\nSEPAY_WEBHOOK_KEY=TOPSECRET\n', encoding="utf-8"
            )
            values = mod.read_env_values(path)
            self.assertNotIn("SEPAY_WEBHOOK_KEY", values)
            self.assertEqual(values["SITE_ENGLISH_URL"], "https://english.happyclass.asia")

    def test_health_success_and_redirect_never_followed(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), DummyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            target = mod.Target("API", "127.0.0.1", "/api/health", server.server_address[1], True)
            ok, _, reason = mod.run_one(target)
            self.assertTrue(ok, reason)
            redirected = mod.Target("Redirect", "example.local", "/redirect", server.server_address[1])
            ok, _, reason = mod.run_one(redirected)
            self.assertFalse(ok)
            self.assertEqual(reason, "HTTP 302")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
