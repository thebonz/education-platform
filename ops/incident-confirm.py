#!/usr/bin/env python3
"""Manual, local-only incident confirmation and deduplication for HappyClass.

Default preview is strictly read-only. --record explicitly writes a metadata-only
0600 state file. Neither mode schedules jobs, sends alerts or changes services.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 1
MIN_SEPARATION_SECONDS = 60
MAX_WARNING_GAP_SECONDS = 24 * 3600
STATE_NAME = "incident-confirmation.json"
ALLOWED_LEVELS = {"ok", "warning", "critical"}
INCIDENT_KEY = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$")


def load_monitor() -> Any:
    spec = importlib.util.spec_from_file_location(
        "happyclass_incident_monitor_confirmation", ROOT / "ops" / "monitor-once.py")
    if spec is None or spec.loader is None:
        raise ValueError("missing monitor module")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def timestamp(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat(timespec="microseconds")


def parse_timestamp(value: str) -> dt.datetime:
    if not isinstance(value, str):
        raise ValueError("bad timestamp")
    item = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if item.tzinfo is None or item.utcoffset() != dt.timedelta(0):
        raise ValueError("timestamp not UTC")
    return item


def check_monitor(data: Any) -> dict[str, str]:
    """Validate allowlisted stable keys before any state change."""
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise ValueError("bad monitor schema")
    if data.get("status") not in ALLOWED_LEVELS:
        raise ValueError("bad status")
    checks = data.get("checks")
    if not isinstance(checks, list) or len(checks) > 100:
        raise ValueError("bad check list")
    seen: dict[str, str] = {}
    for item in checks:
        if not isinstance(item, dict):
            raise ValueError("bad check")
        key, level = item.get("key"), item.get("level")
        if not isinstance(key, str) or not INCIDENT_KEY.fullmatch(key):
            raise ValueError("bad check key")
        if level not in ALLOWED_LEVELS or key in seen:
            raise ValueError("duplicate or bad check level")
        seen[key] = level
    if not checks:
        raise ValueError("empty monitor report")
    expected = ("critical" if "critical" in seen.values() else
                "warning" if "warning" in seen.values() else "ok")
    if data["status"] != expected:
        raise ValueError("inconsistent monitor report")
    return seen


def empty_state() -> dict[str, Any]:
    return {"schema_version": SCHEMA_VERSION, "captured_at": None, "incidents": {}}


def validate_state(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict) or data.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("bad state schema")
    last = data.get("captured_at")
    if last is not None:
        parse_timestamp(last)
    incidents = data.get("incidents")
    if not isinstance(incidents, dict) or len(incidents) > 100:
        raise ValueError("bad incident state")
    clean = {}
    for key, value in incidents.items():
        if not isinstance(key, str) or not INCIDENT_KEY.fullmatch(key) or not isinstance(value, dict):
            raise ValueError("bad incident identity")
        level = value.get("level")
        if level not in ("warning", "critical") or value.get("status") not in ("pending", "confirmed"):
            raise ValueError("bad incident level/status")
        count = value.get("consecutive")
        clean_count = value.get("clean_consecutive")
        if type(count) is not int or not 1 <= count <= 2:
            raise ValueError("bad incident streak")
        if type(clean_count) is not int or not 0 <= clean_count <= 1:
            raise ValueError("bad recovery streak")
        if not isinstance(value.get("last_seen"), str):
            raise ValueError("missing last_seen")
        parse_timestamp(value["last_seen"])
        last_clean = value.get("last_clean_at")
        if last_clean is not None:
            parse_timestamp(last_clean)
        if (clean_count == 0) != (last_clean is None):
            raise ValueError("recovery timestamp mismatch")
        clean[key] = {
            "level": level, "status": value["status"], "consecutive": count,
            "last_seen": value["last_seen"],
            "clean_consecutive": clean_count, "last_clean_at": last_clean,
        }
    return {"schema_version": SCHEMA_VERSION, "captured_at": last, "incidents": clean}


def state_path(data_dir: Path) -> Path:
    if not data_dir.is_absolute():
        raise ValueError("HC_DATA_DIR must be absolute")
    status = data_dir / "status"
    path = status / STATE_NAME
    if data_dir.is_symlink() or status.is_symlink() or path.is_symlink():
        raise ValueError("symlink state path")
    return path


def load_state(path: Path) -> dict[str, Any]:
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("symlink state")
    if not path.exists():
        return empty_state()
    if not path.is_file():
        raise ValueError("state is not regular file")
    return validate_state(json.loads(path.read_text(encoding="utf-8")))


def save_state(path: Path, state: dict[str, Any]) -> None:
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("symlink state path")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(prefix=".incident-confirm-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(validate_state(state), stream, separators=(",", ":"), sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@contextlib.contextmanager
def exclusive_record_lock(path: Path):
    if path.parent.is_symlink() or path.is_symlink():
        raise ValueError("symlink state")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = path.parent / ".incident-confirm.lock"
    if lock.is_symlink():
        raise ValueError("symlink lock")
    fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(fd, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(fd)


def evaluate(previous: dict[str, Any], levels: dict[str, str], current: dt.datetime
             ) -> tuple[dict[str, Any], dict[str, Any]]:
    previous = validate_state(previous)
    last = previous["captured_at"]
    if last is not None and current <= parse_timestamp(last):
        raise ValueError("non-monotonic snapshot timestamp")
    captured = timestamp(current)
    old = previous["incidents"]
    updated: dict[str, dict[str, Any]] = {}
    transitions: list[dict[str, str]] = []
    held: list[str] = []
    full_failure = levels.get("monitor.unavailable") == "critical"
    pg_missing = any(levels.get(key) == "critical" for key in
                     ("postgres.unavailable", "postgres.metadata"))
    active = {key: lev for key, lev in levels.items() if lev in ("critical", "warning")}

    for key in sorted(active):
        level = active[key]
        before = old.get(key)
        if before:
            elapsed = (current - parse_timestamp(before["last_seen"])).total_seconds()
            if elapsed < 0:
                raise ValueError("future state timestamp")
            if before["level"] == level:
                enough_time = elapsed >= MIN_SEPARATION_SECONDS
                streak = min(2, before["consecutive"] + (1 if enough_time else 0))
                if elapsed > MAX_WARNING_GAP_SECONDS and before["status"] == "pending":
                    streak = 1
                confirmed = (before["status"] == "confirmed" or
                             level == "critical" or streak >= 2)
            else:
                streak = 1
                confirmed = (level == "critical" or before["status"] == "confirmed")
            prior_status = before["status"]
            prior_level = before["level"]
        else:
            streak, prior_status, prior_level = 1, None, None
            confirmed = level == "critical"
            enough_time = True

        new_status = "confirmed" if confirmed else "pending"
        if prior_status == "confirmed" and prior_level == "warning" and level == "critical":
            transitions.append({"key": key, "type": "escalated", "level": level})
        elif prior_status == "confirmed" and prior_level == "critical" and level == "warning":
            transitions.append({"key": key, "type": "deescalated", "level": level})
        elif confirmed and prior_status != "confirmed":
            transitions.append({"key": key, "type": "confirmed", "level": level})
        updated[key] = {
            "level": level, "status": new_status, "consecutive": streak,
            "last_seen": captured if not before or prior_level != level or
                         (current - parse_timestamp(before["last_seen"])).total_seconds()
                         >= MIN_SEPARATION_SECONDS else before["last_seen"],
            "clean_consecutive": 0, "last_clean_at": None,
        }

    for key, prior in sorted(old.items()):
        if key in active:
            continue
        # A missing check is not proof that the underlying fault resolved.
        # Only declare recovery if the individual probe is OK or the PostgreSQL
        # metadata query succeeded, allowing absence of an old PG warning.
        pg_probed = (any(k.startswith("postgres.") for k in levels) and
                     not pg_missing and not full_failure)
        observed_clean = (levels.get(key) == "ok" or
                          (key.startswith("postgres.") and pg_probed) or
                          (key == "monitor.unavailable" and not full_failure))
        if not observed_clean:
            updated[key] = dict(prior)
            held.append(key)
            continue
        clean_at = prior["last_clean_at"]
        elapsed = ((current - parse_timestamp(clean_at)).total_seconds()
                   if clean_at is not None else None)
        if elapsed is not None and elapsed >= MIN_SEPARATION_SECONDS:
            if prior["status"] == "confirmed":
                transitions.append({"key": key, "type": "recovered", "level": prior["level"]})
            continue
        revised = dict(prior)
        if clean_at is None:
            revised["clean_consecutive"] = 1
            revised["last_clean_at"] = captured
        updated[key] = revised

    state = {"schema_version": SCHEMA_VERSION, "captured_at": captured,
             "incidents": updated}
    review = {
        "recorded": False,
        "active_confirmed": sorted(k for k, v in updated.items()
                                   if v["status"] == "confirmed" and k in active),
        "pending": sorted(k for k, v in updated.items()
                          if v["status"] == "pending" and k in active),
        "recovering": sorted(k for k, v in updated.items()
                            if v["clean_consecutive"] > 0),
        "held_unverified": sorted(held),
        "transitions": transitions,
        "notifications_sent": False,
        "scheduled": False,
    }
    return state, review


def create_report(*, record: bool) -> tuple[dict[str, Any], int]:
    monitor = load_monitor()
    config = monitor.health.read_nonsecret_env(ROOT / ".env")
    data_dir = Path(config.get("HC_DATA_DIR") or "/data/education-games-platform")
    path = state_path(data_dir)
    if record:
        with exclusive_record_lock(path):
            prev = load_state(path)
            observation = monitor.run(ROOT)
            keys = check_monitor(observation)
            state, review = evaluate(prev, keys, now_utc())
            save_state(path, state)
            review["recorded"] = True
    else:
        prev = load_state(path)
        observation = monitor.run(ROOT)
        keys = check_monitor(observation)
        _, review = evaluate(prev, keys, now_utc())
    observation["confirmation"] = review
    return observation, {"ok": 0, "warning": 1, "critical": 2}[observation["status"]]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Xác nhận sự cố theo mẫu liên tiếp (thủ công).")
    p.add_argument("--json", action="store_true", help="In JSON; không ghi dữ liệu")
    p.add_argument("--record", action="store_true", help="Lưu trạng thái metadata tại HC_DATA_DIR/status")
    args = p.parse_args(argv)
    try:
        data, code = create_report(record=args.record)
    except Exception:
        # Never print exception messages from .env, Docker or status files.
        print('{"status":"critical","error":"Không đọc được báo cáo/trạng thái, không có thông báo nào được gửi."}'
              if args.json else
              "✗ Không đọc được báo cáo/trạng thái. Không gửi cảnh báo hoặc thay đổi dịch vụ.",
              file=sys.stdout)
        return 2

    if args.json:
        print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    else:
        print(f"HappyClass Incident Confirmation – {data['status'].upper()}, "
              f"{'ĐÃ LƯU' if args.record else 'XEM TRƯỚC (KHÔNG GHI)'}")
        review = data["confirmation"]
        print("  Xác nhận: " + (", ".join(review["active_confirmed"]) or "không có"))
        print("  Theo dõi: " + (", ".join(review["pending"]) or "không có"))
        print("  Đang xác minh hồi phục: " + (", ".join(review["recovering"]) or "không có"))
        for event in review["transitions"]:
            print(f"  ! {event['key']} – {event['type']} ({event['level']})")
        print(f"  Kết quả nguồn: {data['counts']['ok']} đạt, "
              f"{data['counts']['warning']} cảnh báo, {data['counts']['critical']} lỗi")
        print("  Không gửi thông báo; không bật lịch; không thay đổi Docker/database.")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
