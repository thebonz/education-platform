#!/usr/bin/env python3
"""Read-only single-snapshot health report for HappyClass containers on a shared DL380.

No container operations other than ps/inspect/stats, no outbound HTTP, no writes.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

SERVICES = ("postgres", "api", "web", "tts", "tunnel")
CORE_SERVICES = {"postgres", "api", "web"}
EXPECTED_CPU_LIMITS = {
    "postgres": 180.0,  # Docker Compose cpus=2
    "api": 90.0,        # Docker Compose cpus=1
    "web": 180.0,      # Docker Compose cpus=2
    "tts": 90.0,       # Docker Compose cpus=1
    "tunnel": 45.0,    # Docker Compose cpus=0.5
}


@dataclass
class Report:
    passed: int = 0
    warnings: int = 0
    failed: int = 0

    def ok(self, message: str) -> None:
        self.passed += 1
        print("  ✓ " + message)

    def warn(self, message: str) -> None:
        self.warnings += 1
        print("  ! " + message)

    def fail(self, message: str) -> None:
        self.failed += 1
        print("  ✗ " + message)


def classify_disk(used_percent: float) -> str:
    if used_percent >= 97:
        return "fail"
    if used_percent >= 85:
        return "warn"
    return "ok"


def classify_available_ram(available_percent: float) -> str:
    if available_percent < 5:
        return "fail"
    if available_percent < 10:
        return "warn"
    return "ok"


def classify_container_memory(used_percent: float) -> str:
    return "warn" if used_percent >= 85 else "ok"


def classify_cpu(cpu_percent: float, allowed_percent: float) -> str:
    return "warn" if cpu_percent >= allowed_percent else "ok"


def parse_percent(value: str) -> float:
    if not re.fullmatch(r"\s*\d+(?:\.\d+)?%\s*", value):
        raise ValueError("invalid percentage")
    return float(value.strip()[:-1])


def status_age_hours(path: Path, *, now: dt.datetime | None = None) -> float:
    data = json.loads(path.read_text(encoding="utf-8"))
    timestamp = data.get("lastSuccess")
    if not isinstance(timestamp, str):
        raise ValueError("missing lastSuccess")
    when = dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if when.tzinfo is None:
        raise ValueError("lastSuccess must have timezone")
    current = now or dt.datetime.now(dt.timezone.utc)
    age = (current - when).total_seconds() / 3600
    if age < 0:
        raise ValueError("future timestamp")
    return age


def read_nonsecret_env(path: Path) -> dict[str, str]:
    keys = {"HC_DATA_DIR", "HC_API_HOST_PORT", "CLOUDFLARE_TUNNEL_TOKEN"}
    result: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        if k in keys:
            result[k] = v.strip().strip('"\'')
    # Do not print returned token; only use its presence to decide whether a tunnel is expected.
    result["CLOUDFLARE_TUNNEL_TOKEN"] = "set" if result.get("CLOUDFLARE_TUNNEL_TOKEN") else ""
    return result


def call(command: list[str], *, cwd: Path, timeout: int = 12) -> str:
    completed = subprocess.run(
        command, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False
    )
    if completed.returncode != 0:
        raise RuntimeError("command failed")
    return completed.stdout.strip()


def call_compose(repo: Path, *args: str) -> str:
    return call(["docker", "compose", "--profile", "tunnel", *args], cwd=repo)


def add_result(report: Report, level: str, msg: str) -> None:
    {"ok": report.ok, "warn": report.warn, "fail": report.fail}[level](msg)


def check_container_states(repo: Path, report: Report, tunnel_required: bool) -> dict[str, str]:
    print("\n==> Trạng thái container (chỉ đọc)")
    ids: dict[str, str] = {}
    for service in SERVICES:
        required = service in CORE_SERVICES or (service == "tunnel" and tunnel_required)
        try:
            cid = call_compose(repo, "ps", "-q", service)
            if not cid:
                add_result(report, "fail" if required else "warn", service + ": container không chạy")
                continue
            line = call(
                ["docker", "inspect", "-f",
                 "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}",
                 cid],
                cwd=repo,
            )
            state, health, restarts = line.split("|", 2)
        except (RuntimeError, ValueError, subprocess.TimeoutExpired):
            add_result(report, "fail" if required else "warn", service + ": không đọc được trạng thái")
            continue
        if state != "running":
            add_result(report, "fail" if required else "warn", service + ": " + state)
            continue
        if service in CORE_SERVICES and health != "healthy":
            report.fail(service + ": đang chạy nhưng health=" + health)
            continue
        ids[service] = cid
        report.ok(service + ": running" + (", healthy" if health == "healthy" else "") +
                  " (restart count=" + restarts + ")")
    return ids


def check_api_health(repo: Path, env: dict[str, str], report: Report) -> None:
    print("\n==> API và PostgreSQL")
    raw = env.get("HC_API_HOST_PORT", "3101")
    if not re.fullmatch(r"[0-9]{1,5}", raw) or not 1 <= int(raw) <= 65535:
        report.fail("Cổng API trong .env không hợp lệ")
        return
    url = "http://127.0.0.1:" + raw + "/api/health"
    try:
        opener = build_opener(ProxyHandler({}))
        with opener.open(Request(url, method="GET", headers={"User-Agent": "HC-Local-Monitor/1.0"}),
                         timeout=6) as res:
            if res.status != 200:
                report.fail("API health không trả HTTP 200")
                return
            payload = json.loads(res.read(4096))
        if payload.get("status") == "ok" and payload.get("database") == "connected":
            report.ok("API /health = ok, PostgreSQL = connected")
        else:
            report.fail("API health hoặc PostgreSQL không đạt")
    except (OSError, ValueError, json.JSONDecodeError):
        report.fail("Không truy cập được API health qua localhost")


def check_host_resources(repo: Path, env: dict[str, str], report: Report) -> None:
    print("\n==> Dung lượng ổ đĩa và bộ nhớ máy chủ")
    target = Path(env.get("HC_DATA_DIR") or "/data/education-games-platform")
    try:
        usage = shutil.disk_usage(target)
        used = (usage.used / usage.total) * 100
        add_result(report, classify_disk(used),
                   f"Ổ chứa dữ liệu HappyClass: sử dụng {used:.1f}% (còn {usage.free / 1024**3:.1f} GiB)")
    except OSError:
        report.fail("Không đọc được ổ chứa dữ liệu HappyClass")

    try:
        info: dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            match = re.match(r"^(MemTotal|MemAvailable):\s+(\d+) kB", line)
            if match:
                info[match.group(1)] = int(match.group(2))
        available = 100 * info["MemAvailable"] / info["MemTotal"]
        add_result(report, classify_available_ram(available),
                   f"RAM khả dụng toàn máy chủ: {available:.1f}%")
    except (OSError, ValueError, KeyError, ZeroDivisionError):
        report.warn("Không đọc được MemAvailable từ /proc/meminfo")


def check_docker_stats(repo: Path, ids: dict[str, str], report: Report) -> None:
    print("\n==> CPU/RAM container HappyClass (một ảnh chụp, không phải tải đỉnh)")
    if not ids:
        report.fail("Không có container HappyClass để đo")
        return
    try:
        output = call(
            ["docker", "stats", "--no-stream",
             "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemPerc}}", *ids.values()],
            cwd=repo, timeout=20,
        )
    except (RuntimeError, subprocess.TimeoutExpired):
        report.warn("Không đọc được docker stats; kiểm tra thủ công")
        return
    stats_by_name = {}
    for line in output.splitlines():
        parts = line.split("|")
        if len(parts) == 3:
            stats_by_name[parts[0].strip()] = (parts[1], parts[2])
    for service, cid in ids.items():
        # Docker's name may differ across Compose versions; select only by the
        # expected project/service name, never inspect unrelated containers.
        matching = [
            (name, values) for name, values in stats_by_name.items()
            if name.startswith("happyclass-") and name.endswith("-" + service + "-1")
        ]
        if len(matching) != 1:
            report.warn(service + ": không khớp được số liệu docker stats")
            continue
        _, values = matching[0]
        try:
            cpu, mem = parse_percent(values[0]), parse_percent(values[1])
        except ValueError:
            report.warn(service + ": số liệu CPU/RAM không đúng định dạng")
            continue
        state = "warn" if (
            classify_cpu(cpu, EXPECTED_CPU_LIMITS[service]) == "warn" or
            classify_container_memory(mem) == "warn"
        ) else "ok"
        add_result(report, state, f"{service}: CPU {cpu:.1f}% một lần lấy mẫu, RAM {mem:.1f}% giới hạn container")


def check_backups(data_dir: Path, report: Report) -> None:
    print("\n==> Độ mới bản sao lưu và khôi phục")
    for file_name, label, max_hours, critical in (
        ("backup.json", "Sao lưu offsite", 48, True),
        ("restore-test.json", "Diễn tập khôi phục", 192, False),
    ):
        try:
            hours = status_age_hours(data_dir / "status" / file_name)
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            add_result(report, "fail" if critical else "warn",
                       label + ": thiếu hoặc không đọc được trạng thái")
            continue
        add_result(
            report, "ok" if hours <= max_hours else ("fail" if critical else "warn"),
            f"{label}: cách đây {hours:.1f} giờ (giới hạn {max_hours} giờ)"
        )


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    report = Report()
    env_file = repo / ".env"
    if not env_file.is_file():
        print("✗ Không tìm thấy .env. Chạy từ source đã triển khai HappyClass.")
        return 2
    try:
        env = read_nonsecret_env(env_file)
    except OSError:
        print("✗ Không đọc được .env.")
        return 2
    print("HappyClass Runtime Health – kiểm tra chỉ đọc, không thay đổi dịch vụ")
    ids = check_container_states(repo, report, bool(env.get("CLOUDFLARE_TUNNEL_TOKEN")))
    check_api_health(repo, env, report)
    check_host_resources(repo, env, report)
    check_docker_stats(repo, ids, report)
    check_backups(Path(env.get("HC_DATA_DIR") or "/data/education-games-platform"), report)
    print(f"\n==> Tổng kết: Đạt {report.passed}, Cảnh báo {report.warnings}, Lỗi {report.failed}")
    print("Đây là một lần lấy mẫu, không phải hệ thống cảnh báo 24/7; Cloudflare WAF/Access vẫn kiểm tra riêng.")
    if report.failed:
        return 2
    if report.warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
