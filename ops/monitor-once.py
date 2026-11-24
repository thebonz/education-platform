#!/usr/bin/env python3
"""Single-shot HappyClass incident check, structured for future alerting.

Reads *only* existing runtime health signals and PostgreSQL metadata through the
HappyClass Compose project. No cron, webhooks, alerts, restarts, data updates,
outbound requests, or state-file writes.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import importlib.util
import io
import json
import subprocess
from pathlib import Path
import sys
from typing import Any


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Không thể mở mô-đun kiểm tra.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


ROOT = Path(__file__).resolve().parents[1]
health = load_module("happyclass_monitor_runtime", ROOT / "ops" / "runtime-health.py")
postgres = load_module("happyclass_monitor_postgres", ROOT / "ops" / "postgres-trend.py")


def stable_check_key(group: str, message: str, ordinal: int) -> str:
    """Stable identity independent of changing metric values or warning order."""
    if group in ("container", "resources"):
        name = message.split(":", 1)[0].strip()
        if name in health.SERVICES:
            return f"{group}.{name}"
    if group == "host":
        if message.startswith("Ổ chứa dữ liệu"):
            return "host.disk"
        if message.startswith("RAM khả dụng"):
            return "host.ram"
    if group == "api":
        return "api.health"
    if group == "backup":
        if message.startswith("Sao lưu offsite"):
            return "backup.offsite"
        if message.startswith("Diễn tập khôi phục"):
            return "backup.restore"
    if group == "postgres":
        patterns = (
            ("Số kết nối PostgreSQL", "connections"),
            ("Có kết nối idle in transaction", "idle_transaction"),
            ("Có kết nối đợi lock", "lock_wait"),
            ("autovacuum đang tắt", "autovacuum"),
            ("Phát sinh", "deadlocks"),
            ("Tỷ lệ transaction rollback", "rollbacks"),
            ("Không đọc được mốc PostgreSQL", "baseline"),
            ("Không lấy được metadata PostgreSQL", "metadata"),
            ("Bỏ qua truy vấn PostgreSQL", "unavailable"),
            ("Metadata PostgreSQL hiện tại", "healthy"),
        )
        for prefix, token in patterns:
            if message.startswith(prefix):
                return f"postgres.{token}"
    # Future checks receive a fallback identity rather than silently disappearing.
    return f"{group}.check_{ordinal}"


class AlertReport(health.Report):
    """Collect safely constructed health messages, never live SQL or secrets."""

    def __init__(self) -> None:
        super().__init__()
        self.group = "runtime"
        self.checks: list[dict[str, str]] = []
        self.indices: dict[str, int] = {}
        self.notes: list[str] = []

    def record(self, level: str, message: str) -> None:
        self.indices[self.group] = self.indices.get(self.group, 0) + 1
        # Guard against accidental multiline data in a future health probe.
        safe = " ".join(str(message).split())[:240]
        self.checks.append({
            "code": f"{self.group}.{self.indices[self.group]}",
            "key": stable_check_key(self.group, safe, self.indices[self.group]),
            "level": level,
            "message": safe,
        })
        if level == "ok":
            self.passed += 1
        elif level == "warning":
            self.warnings += 1
        elif level == "critical":
            self.failed += 1

    def ok(self, message: str) -> None:
        self.record("ok", message)

    def warn(self, message: str) -> None:
        self.record("warning", message)

    def fail(self, message: str) -> None:
        self.record("critical", message)


def read_previous_baseline(data_dir: Path) -> dict | None:
    """Read the snapshot PR #37 created; never modify or replace it."""
    path = data_dir / "status" / postgres.STATE_FILE
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("Mốc PostgreSQL không được là symlink.")
    if not path.exists():
        return None
    if not path.is_file():
        raise ValueError("Mốc PostgreSQL không phải file.")
    return postgres.validate_sample(json.loads(path.read_text(encoding="utf-8")))


def check_runtime(repo: Path, report: AlertReport, env: dict[str, str]) -> dict[str, str]:
    # The existing probes print section headings; suppress those here to
    # guarantee --json emits one valid, allowlisted JSON object, nothing else.
    with contextlib.redirect_stdout(io.StringIO()):
        report.group = "container"
        ids = health.check_container_states(
            repo, report, bool(env.get("CLOUDFLARE_TUNNEL_TOKEN"))
        )
        report.group = "api"
        health.check_api_health(repo, env, report)
        report.group = "host"
        health.check_host_resources(repo, env, report)
        report.group = "resources"
        health.check_docker_stats(repo, ids, report)
        report.group = "backup"
        health.check_backups(
            Path(env.get("HC_DATA_DIR") or "/data/education-games-platform"), report
        )
    return ids


def check_postgres(repo: Path, data_dir: Path, report: AlertReport,
                   postgres_running: bool) -> dict[str, Any] | None:
    report.group = "postgres"
    if not postgres_running:
        report.fail("Bỏ qua truy vấn PostgreSQL: container chưa running/healthy.")
        return None

    # The only SQL is a bounded BEGIN READ ONLY transaction (ops/postgres-trend.sql).
    try:
        sample = postgres.collect(repo, repo / "ops" / "postgres-trend.sql")
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired):
        report.fail("Không lấy được metadata PostgreSQL.")
        return None

    delta = None
    reason = "Chưa có mốc trước để tính delta."
    try:
        previous = read_previous_baseline(data_dir)
        delta, reason = postgres.compare(previous, sample)
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        report.warn("Không đọc được mốc PostgreSQL; chỉ đánh giá số liệu hiện tại.")
        reason = "Mốc cũ không hợp lệ; không tính delta."
    warnings, errors = postgres.classify(sample, delta)
    for warning in warnings:
        report.warn(warning)
    for error in errors:
        report.fail(error)
    if not warnings and not errors:
        report.ok("Metadata PostgreSQL hiện tại chưa có tín hiệu bất thường.")
    if delta is None:
        report.notes.append(reason)
    return {
        "database_size_mib": round(sample["database_size_bytes"] / 1024**2, 2),
        "connections": sample["total_connections"],
        "max_connections": sample["max_connections"],
        "active_connections": sample["active_connections"],
        "idle_in_transaction": sample["idle_in_transaction"],
        "waiting_for_lock": sample["waiting_for_lock"],
        "interval_minutes": round(delta["seconds"] / 60, 2) if delta else None,
        "new_deadlocks": delta["deadlocks"] if delta else None,
        "new_rollbacks": delta["xact_rollback"] if delta else None,
    }


def summarize(report: AlertReport, pg: dict[str, Any] | None) -> dict[str, Any]:
    status = "critical" if report.failed else "warning" if report.warnings else "ok"
    return {
        "schema_version": 1,
        "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "status": status,
        "counts": {
            "ok": report.passed, "warning": report.warnings, "critical": report.failed
        },
        "checks": report.checks,
        "postgres": pg,
        "notes": report.notes,
        "scope": "HappyClass localhost + own Docker Compose + read-only PostgreSQL",
        "scheduled": False,
        "notifications_sent": False,
    }


def render_text(document: dict[str, Any]) -> None:
    print("HappyClass – Incident Monitor (chạy một lần, không gửi cảnh báo)")
    for item in document["checks"]:
        label = {"ok": "✓", "warning": "!", "critical": "✗"}[item["level"]]
        print(f"  {label} [{item['code']}] {item['message']}")
    if document["postgres"] is not None:
        p = document["postgres"]
        print(f"  PostgreSQL: {p['database_size_mib']:.2f} MiB, "
              f"{p['connections']}/{p['max_connections']} connections")
        if p["interval_minutes"] is not None:
            print(f"  So với mốc PostgreSQL cách {p['interval_minutes']:.2f} phút: "
                  f"deadlock +{p['new_deadlocks']}, rollback +{p['new_rollbacks']}")
    for note in document["notes"]:
        print("  Ghi chú: " + note)
    counts = document["counts"]
    print(f"==> {document['status'].upper()} | "
          f"Đạt {counts['ok']} | Cảnh báo {counts['warning']} | Lỗi {counts['critical']}")
    print("Không có timer, không gửi thông báo, không thay đổi container hay database.")


def run(repo: Path) -> dict[str, Any]:
    env_file = repo / ".env"
    if not env_file.is_file():
        raise RuntimeError("Thiếu .env của HappyClass.")
    env = health.read_nonsecret_env(env_file)
    report = AlertReport()
    ids = check_runtime(repo, report, env)
    data_dir = Path(env.get("HC_DATA_DIR") or "/data/education-games-platform")
    pg = check_postgres(repo, data_dir, report, "postgres" in ids)
    return summarize(report, pg)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Kiểm tra cảnh báo vận hành thủ công; không tự bật giám sát 24/7."
    )
    parser.add_argument("--json", action="store_true", help="In một JSON object chỉ chứa metadata")
    args = parser.parse_args(argv)
    try:
        data = run(ROOT)
    except Exception:
        # Fail closed without showing any exception text from files or Docker.
        data = {
            "schema_version": 1,
            "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "status": "critical",
            "counts": {"ok": 0, "warning": 0, "critical": 1},
            "checks": [{"code": "monitor.1", "key": "monitor.unavailable", "level": "critical",
                        "message": "Không thể hoàn thành kiểm tra; xem cấu hình .env/Docker Compose."}],
            "postgres": None,
            "notes": [], "scope": "HappyClass only",
            "scheduled": False, "notifications_sent": False,
        }
    if args.json:
        print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    else:
        render_text(data)
    return {"ok": 0, "warning": 1, "critical": 2}[data["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
