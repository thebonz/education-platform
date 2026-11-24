#!/usr/bin/env python3
"""Bounded, read-only HappyClass latency smoke check against localhost only.

Default: 12 GET requests for each of 3 targets, at most 2 workers per target.
Never sends requests to public domains, never authenticates, never writes data.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

MAX_REQUESTS = 20
MAX_CONCURRENCY = 3
TIMEOUT_SECONDS = 8


@dataclass(frozen=True)
class Target:
    name: str
    host: str
    path: str
    port: int
    check_json_health: bool = False

    @property
    def local_url(self) -> str:
        return f"http://127.0.0.1:{self.port}{self.path}"


class NeverFollowRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Redirects might point to Cloudflare or another public endpoint.
        # Never send this test traffic off the Ubuntu server.
        return None


def read_env_values(path: Path) -> dict[str, str]:
    """Read only nonsecret URL/port keys. Do not source or print the .env file."""
    permitted = {
        "SITE_ENGLISH_URL", "SITE_VIETNAMESE_URL",
        "HC_WEB_HOST_PORT", "HC_API_HOST_PORT",
    }
    result: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, raw = line.split("=", 1)
        key = key.strip()
        if key not in permitted:
            continue
        raw = raw.strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
            raw = raw[1:-1]
        result[key] = raw
    return result


def valid_port(value: str) -> int:
    if not re.fullmatch(r"[0-9]{1,5}", value):
        raise ValueError("Port không hợp lệ")
    port = int(value)
    if not (1 <= port <= 65535):
        raise ValueError("Port phải từ 1 đến 65535")
    return port


def site_target(name: str, url: str, port: int) -> Target:
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError(f"URL site {name} không hợp lệ")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"URL site {name} không được chứa thông tin đăng nhập/query")
    path = parsed.path.rstrip("/") or "/"
    if not path.startswith("/") or ".." in path:
        raise ValueError(f"Đường dẫn site {name} không hợp lệ")
    return Target(name=name, host=parsed.netloc, path=path, port=port)


def percentile_ms(samples: list[float], percentile: float) -> float:
    if not samples:
        return 0.0
    values = sorted(samples)
    index = max(0, math.ceil(percentile / 100 * len(values)) - 1)
    return values[index] * 1000


def run_one(target: Target) -> tuple[bool, float, str]:
    # No environment proxy; explicitly loopback. Redirects are never followed.
    opener = build_opener(ProxyHandler({}), NeverFollowRedirects())
    req = Request(target.local_url, headers={
        "Host": target.host,
        "User-Agent": "HappyClass-Local-ReadOnly-Smoke/1.0",
        "Accept": "text/html,application/json",
    }, method="GET")
    start = time.perf_counter()
    try:
        with opener.open(req, timeout=TIMEOUT_SECONDS) as res:
            code = res.status
            if code != 200:
                return False, time.perf_counter() - start, f"HTTP {code}"
            if target.check_json_health:
                data = json.loads(res.read(4096))
                if data.get("status") != "ok" or data.get("database") != "connected":
                    return False, time.perf_counter() - start, "API health/database không đạt"
            else:
                res.read(256)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
        # Avoid printing URLs, server response bodies or detailed exception strings.
        label = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else type(exc).__name__
        return False, time.perf_counter() - start, label
    return True, time.perf_counter() - start, "OK"


def check_target(target: Target, requests: int, concurrency: int) -> bool:
    # Sequential by target; at most 'concurrency' parallel requests in total.
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        results = list(pool.map(lambda _: run_one(target), range(requests)))
    times = [elapsed for ok, elapsed, _ in results if ok]
    failed = [(reason) for ok, _, reason in results if not ok]
    if failed:
        print(f"  ✗ {target.name}: {requests - len(failed)}/{requests} thành công; lỗi đầu tiên: {failed[0]}")
    else:
        print(
            f"  ✓ {target.name}: {requests}/{requests} HTTP 200 | "
            f"p50 {percentile_ms(times, 50):.0f}ms | "
            f"p95 {percentile_ms(times, 95):.0f}ms | "
            f"max {percentile_ms(times, 100):.0f}ms"
        )
    if times and percentile_ms(times, 95) > 2500:
        print("    ! p95 > 2500ms; đây là cảnh báo để điều tra, không tự động kết luận server quá tải.")
    return not failed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Đo độ trễ GET nhẹ trên localhost; không phải stress test, không tạo giao dịch."
    )
    parser.add_argument("--env-file", type=Path, default=Path(__file__).resolve().parents[1] / ".env")
    parser.add_argument("--requests", type=int, default=12, help="Số GET cho mỗi đích (1-20; mặc định 12)")
    parser.add_argument("--concurrency", type=int, default=2, help="Số yêu cầu đồng thời tối đa (1-3; mặc định 2)")
    args = parser.parse_args(argv)
    if not 1 <= args.requests <= MAX_REQUESTS or not 1 <= args.concurrency <= MAX_CONCURRENCY:
        parser.error("Giới hạn an toàn: --requests từ 1-20, --concurrency từ 1-3")
    try:
        data = read_env_values(args.env_file)
        api_port = valid_port(data.get("HC_API_HOST_PORT", "3101"))
        web_port = valid_port(data.get("HC_WEB_HOST_PORT", "3100"))
        targets = [
            Target("API health", "127.0.0.1", "/api/health", api_port, True),
            site_target("English", data["SITE_ENGLISH_URL"], web_port),
            site_target("Vietnamese", data["SITE_VIETNAMESE_URL"], web_port),
        ]
    except (OSError, ValueError, KeyError) as exc:
        print(f"✗ Cấu hình kiểm tra không hợp lệ: {type(exc).__name__}. Kiểm tra .env.", file=sys.stderr)
        return 2

    print(
        f"==> Smoke test GET nội bộ: {args.requests} yêu cầu/đích, "
        f"tối đa {args.concurrency} đồng thời, timeout {TIMEOUT_SECONDS}s"
    )
    print("    Chỉ gọi 127.0.0.1, không gửi traffic lên Cloudflare và không tạo dữ liệu/thanh toán.")
    passed = [check_target(t, args.requests, args.concurrency) for t in targets]
    if all(passed):
        print("✓ Cả 3 đích đều phản hồi HTTP 200; đây chỉ là kiểm thử tải nhẹ, KHÔNG phải chứng nhận chịu tải.")
        return 0
    print("✗ Có request lỗi. Kiểm tra API/Web logs trong project HappyClass trước khi tăng tải.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
