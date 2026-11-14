"""HappyClass TTS: máy chủ HTTP nhỏ quanh Piper. Chỉ chạy trong mạng nội bộ Docker (không mở cổng ra ngoài).

POST /synthesize  {"text": "..."}  → audio/wav
GET  /health                       → 200
"""
import json
import os
import subprocess
import threading
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PIPER = "/opt/piper/piper"
MODEL = "/opt/voices/vi.onnx"
MAX_CHARS = 300
# Trẻ nhỏ nghe chậm hơn một chút
LENGTH_SCALE = os.environ.get("TTS_LENGTH_SCALE", "1.15")
SLOTS = threading.BoundedSemaphore(int(os.environ.get("TTS_CONCURRENCY", "2")))


def synthesize(text: str) -> bytes:
    with SLOTS:
        proc = subprocess.run(
            [PIPER, "-q", "-m", MODEL, "-f", "-", "--length_scale", LENGTH_SCALE, "--sentence_silence", "0.1"],
            input=text.encode("utf-8"), capture_output=True, timeout=30, check=False,
        )
    if proc.returncode != 0 or not proc.stdout.startswith(b"RIFF"):
        raise RuntimeError(proc.stderr.decode("utf-8", "replace")[-300:])
    return proc.stdout


class Handler(BaseHTTPRequestHandler):
    server_version = "hc-tts"
    sys_version = ""

    def log_message(self, fmt, *args):  # không ghi nội dung câu đọc vào log
        pass

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            ok = os.path.exists(MODEL) and os.access(PIPER, os.X_OK)
            self._send(200 if ok else 503, b'{"ok":true}' if ok else b'{"ok":false}', "application/json")
        else:
            self._send(404, b"{}", "application/json")

    def do_POST(self):
        if self.path != "/synthesize":
            return self._send(404, b"{}", "application/json")
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                return self._send(413, b'{"error":"too_large"}', "application/json")
            text = unicodedata.normalize("NFC", str(json.loads(self.rfile.read(length)).get("text", ""))).strip()
            if not text or len(text) > MAX_CHARS:
                return self._send(400, b'{"error":"invalid_text"}', "application/json")
            self._send(200, synthesize(text), "audio/wav")
        except (ValueError, json.JSONDecodeError):
            self._send(400, b'{"error":"invalid_json"}', "application/json")
        except Exception:  # noqa: BLE001 – lỗi Piper/timeout: không làm sập máy chủ
            self._send(500, b'{"error":"synthesis_failed"}', "application/json")


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 5002), Handler).serve_forever()
