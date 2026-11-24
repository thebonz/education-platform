#!/usr/bin/env python3
"""HappyClass PostgreSQL trend snapshots; only reads DB metadata, writes a local 0600 JSON baseline.

Never touches application rows, other Compose projects, credentials or server settings.
This is an on-demand comparison, not a daemon or a performance benchmark.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

SCHEMA_VERSION = 1
COUNTERS = ("xact_commit", "xact_rollback", "blks_hit", "blks_read",
            "deadlocks", "temp_files", "temp_bytes")
NUMBERS = ("database_oid", "database_size_bytes", "max_connections",
           "total_connections", "active_connections", "idle_in_transaction",
           "waiting_for_lock", *COUNTERS)
FIELDS = ("schema_version", "captured_at", "server_started_at", "stats_reset",
          "autovacuum", *NUMBERS)
STATE_FILE = "postgres-trend.json"


def parse_time(value: str) -> dt.datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("timestamp must be UTC")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() != dt.timedelta(0):
        raise ValueError("timestamp must be UTC")
    return parsed


def validate_sample(value: object) -> dict:
    if not isinstance(value, dict) or value.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("unsupported snapshot schema")
    if any(k not in value for k in FIELDS):
        raise ValueError("missing snapshot field")
    for key in NUMBERS:
        if type(value[key]) is not int or value[key] < 0:
            raise ValueError("invalid numeric field")
    if value["max_connections"] < 1 or value["database_oid"] < 1:
        raise ValueError("invalid database metadata")
    if value["total_connections"] > value["max_connections"]:
        raise ValueError("connections exceed capacity")
    if type(value["autovacuum"]) is not bool:
        raise ValueError("invalid autovacuum flag")
    for key in ("captured_at", "server_started_at"):
        parse_time(value[key])
    if value["stats_reset"] is not None:
        parse_time(value["stats_reset"])
    # Only these known numeric metadata fields are ever persisted; no extra keys,
    # SQL text, usernames, query text or untrusted data leave the DB process.
    return {key: value[key] for key in FIELDS}


def parse_psql_output(output: str) -> dict:
    return validate_sample(json.loads(output.strip()))


def compare(previous: dict | None, current: dict) -> tuple[dict | None, str]:
    if previous is None:
        return None, "Chưa có mẫu trước; đã tạo mốc đo ban đầu."
    if previous["database_oid"] != current["database_oid"]:
        return None, "Database đã thay đổi; thiết lập mốc đo mới."
    if previous["server_started_at"] != current["server_started_at"]:
        return None, "PostgreSQL đã khởi động lại; thiết lập mốc đo mới."
    if previous["stats_reset"] != current["stats_reset"]:
        return None, "Bộ đếm PostgreSQL đã reset; thiết lập mốc đo mới."
    seconds = (parse_time(current["captured_at"]) -
               parse_time(previous["captured_at"])).total_seconds()
    if seconds <= 0:
        return None, "Đồng hồ không tăng giữa hai lần đo; thiết lập mốc đo mới."
    deltas = {key: current[key] - previous[key] for key in COUNTERS}
    if any(value < 0 for value in deltas.values()):
        return None, "Bộ đếm giảm (có thể reset); thiết lập mốc đo mới."
    return {"seconds": seconds, **deltas}, ""


def classify(sample: dict, delta: dict | None) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    errors: list[str] = []
    utilization = sample["total_connections"] / sample["max_connections"]
    if utilization >= 0.95:
        errors.append("Số kết nối PostgreSQL >= 95% giới hạn.")
    elif utilization >= 0.80:
        warnings.append("Số kết nối PostgreSQL >= 80% giới hạn.")
    if sample["idle_in_transaction"]:
        warnings.append("Có kết nối idle in transaction; cần quan sát lặp lại.")
    if sample["waiting_for_lock"]:
        warnings.append("Có kết nối đợi lock; cần quan sát lặp lại.")
    if not sample["autovacuum"]:
        warnings.append("autovacuum đang tắt; cần kiểm tra cấu hình.")
    if delta is not None:
        if delta["deadlocks"]:
            warnings.append(f"Phát sinh {delta['deadlocks']} deadlock giữa hai mẫu.")
        transactions = delta["xact_commit"] + delta["xact_rollback"]
        if transactions >= 20 and delta["xact_rollback"] / transactions >= 0.05:
            warnings.append("Tỷ lệ transaction rollback >= 5% (ít nhất 20 giao dịch).")
    return warnings, errors


def print_report(sample: dict, delta: dict | None, reason: str) -> int:
    total, maximum = sample["total_connections"], sample["max_connections"]
    print("HappyClass PostgreSQL Trend – metadata, không thay đổi DB")
    print(f"  Database: {sample['database_size_bytes'] / 1024**2:.2f} MiB")
    print(f"  Kết nối: {total}/{maximum} ({100 * total / maximum:.1f}%), "
          f"active={sample['active_connections']}, "
          f"idle in transaction={sample['idle_in_transaction']}, "
          f"đợi lock={sample['waiting_for_lock']}")
    if delta is None:
        print("  " + reason)
    else:
        minutes = delta["seconds"] / 60
        print(f"  So sánh trong {minutes:.1f} phút: "
              f"commit +{delta['xact_commit']}, rollback +{delta['xact_rollback']}, "
              f"deadlock +{delta['deadlocks']}, temp files +{delta['temp_files']}, "
              f"temp bytes +{delta['temp_bytes']}")
        blocks = delta["blks_hit"] + delta["blks_read"]
        if blocks:
            print(f"  Cache hit riêng trong khoảng đo: {100 * delta['blks_hit'] / blocks:.2f}%")
        else:
            print("  Cache hit riêng trong khoảng đo: N/A (không có block hit/read mới)")
    warnings, errors = classify(sample, delta)
    for note in warnings:
        print("  ! " + note)
    for note in errors:
        print("  ✗ " + note)
    if not warnings and not errors:
        if delta is None:
            print("  ✓ Chỉ số tại thời điểm đo chưa có tín hiệu bất thường; "
                  "chưa đủ hai mẫu hợp lệ để đánh giá xu hướng.")
        else:
            print("  ✓ Chưa phát hiện tín hiệu cần can thiệp trong khoảng giữa hai mẫu.")
    print("  Chỉ số ngưỡng là gợi ý giám sát, không tự tuning/VACUUM/restart.")
    return 2 if errors else 1 if warnings else 0


def collect(repo: Path, sql_file: Path) -> dict:
    command = [
        "docker", "compose", "exec", "-T", "postgres", "sh", "-c",
        'exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
    ]
    sql = sql_file.read_text(encoding="utf-8")
    # SQL is shipped in the repository and is explicitly BEGIN READ ONLY.
    result = subprocess.run(command, cwd=repo, input=sql, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=25, check=False)
    if result.returncode != 0:
        # Never show raw Docker/psql stderr: it might contain configuration data.
        raise RuntimeError("Không lấy được thống kê PostgreSQL.")
    return parse_psql_output(result.stdout)


def write_state(path: Path, sample: dict) -> None:
    status = path.parent
    if status.is_symlink() or path.is_symlink():
        raise OSError("Đường dẫn snapshot không được là symlink.")
    status.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(prefix=".postgres-trend-", suffix=".tmp", dir=status)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(sample, stream, ensure_ascii=False, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def run(repo: Path, data_dir: Path) -> int:
    if not data_dir.is_absolute():
        raise ValueError("HC_DATA_DIR phải là đường dẫn tuyệt đối.")
    path = data_dir / "status" / STATE_FILE
    if path.is_symlink():
        raise ValueError("File trạng thái không được là symlink.")
    previous = None
    if path.exists():
        previous = validate_sample(json.loads(path.read_text(encoding="utf-8")))
    current = collect(repo, repo / "ops" / "postgres-trend.sql")
    delta, reason = compare(previous, current)
    # Persist first, so a short follow-up run can compare this point.
    write_state(path, current)
    return print_report(current, delta, reason)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Sử dụng: postgres-trend.py <source-dir> <HC_DATA_DIR>", file=sys.stderr)
        sys.exit(2)
    try:
        sys.exit(run(Path(sys.argv[1]), Path(sys.argv[2])))
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError,
            subprocess.TimeoutExpired, RuntimeError):
        print("✗ Không thể đọc/lưu snapshot PostgreSQL; không thay đổi database. "
              "Kiểm tra quyền thư mục status và Docker Compose.", file=sys.stderr)
        sys.exit(2)
