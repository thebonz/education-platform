#!/usr/bin/env python3
"""Local operator assertions for HappyClass prelaunch tests; never launch the site.

Writes ONLY /status/manual-acceptance.json on deliberate --attest/--revoke.
No credentials, test payloads, account numbers, user data or outbound requests.
Assertions are time-limited operator statements, NOT independent test proof.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
NAME = "manual-acceptance.json"
VERSION = 1
VALID_DAYS = 7
MAX_SIZE = 16384
ALLOWED_KEYS = frozenset({
    "smtp.delivery",
    "smtp.auth_flows",
    "payment.sandbox_acceptance",
    "cloudflare.security",
    "content.review",
    "admin.accounts",
})


def timestamp(when: dt.datetime) -> str:
    return when.astimezone(dt.timezone.utc).isoformat(timespec="seconds")


def utc_stamp(value: Any) -> dt.datetime:
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError("bad timestamp")
    moment = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.tzinfo is None or moment.utcoffset() != dt.timedelta(0):
        raise ValueError("non-UTC timestamp")
    return moment


def empty_state() -> dict[str, Any]:
    return {"schema_version": VERSION, "entries": {}}


def validate(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or set(raw) != {"schema_version", "entries"}:
        raise ValueError("unknown state fields")
    if type(raw["schema_version"]) is not int or raw["schema_version"] != VERSION:
        raise ValueError("bad schema version")
    records = raw["entries"]
    if not isinstance(records, dict) or len(records) > len(ALLOWED_KEYS):
        raise ValueError("bad records")
    clean = {}
    for key, value in records.items():
        if key not in ALLOWED_KEYS or not isinstance(value, dict):
            raise ValueError("unknown manual evidence")
        if set(value) != {"attested_at", "expires_at"}:
            raise ValueError("extra evidence fields")
        start, end = utc_stamp(value["attested_at"]), utc_stamp(value["expires_at"])
        if end - start != dt.timedelta(days=VALID_DAYS):
            raise ValueError("invalid lifetime")
        clean[key] = {"attested_at": timestamp(start), "expires_at": timestamp(end)}
    return {"schema_version": VERSION, "entries": clean}


def state_path(data_dir: Path) -> Path:
    if not data_dir.is_absolute() or ".." in data_dir.parts:
        raise ValueError("invalid absolute data directory")
    status_dir = data_dir / "status"
    path = status_dir / NAME
    if data_dir.is_symlink() or status_dir.is_symlink() or path.is_symlink():
        raise ValueError("symlink forbidden")
    return path


def read_state(path: Path) -> dict[str, Any]:
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("symlink forbidden")
    if not path.exists():
        return empty_state()
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_SIZE:
        raise ValueError("invalid state file")
    if stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError("state is not private")
    return validate(json.loads(path.read_text(encoding="utf-8")))


def active_assertions(data_dir: Path, now: dt.datetime) -> tuple[list[str], list[str]]:
    """Read only. Missing state is normal. Bad state must fail closed."""
    data = read_state(state_path(data_dir))
    active, expired = [], []
    for key, value in sorted(data["entries"].items()):
        started = utc_stamp(value["attested_at"])
        expires = utc_stamp(value["expires_at"])
        if started > now + dt.timedelta(minutes=5):
            raise ValueError("future attestation")
        if started <= now < expires:
            active.append(key)
        else:
            expired.append(key)
    return active, expired


@contextlib.contextmanager
def locked(path: Path):
    if path.parent.is_symlink() or path.is_symlink():
        raise ValueError("symlink path")
    if not path.parent.exists() or not path.parent.is_dir():
        raise ValueError("HappyClass status directory must already exist")
    lock = path.parent / ".manual-acceptance.lock"
    if lock.is_symlink():
        raise ValueError("symlink lock")
    fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(fd, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(fd)


def write_state(path: Path, state: dict[str, Any]) -> None:
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("symlink path")
    content = (json.dumps(validate(state), ensure_ascii=False, sort_keys=True,
                          separators=(",", ":")) + "\n").encode("utf-8")
    if len(content) > MAX_SIZE:
        raise ValueError("state too large")
    fd, temporary = tempfile.mkstemp(prefix=".manual-acceptance-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            os.fchmod(output.fileno(), 0o600)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def change(path: Path, key: str, *, revoke: bool, now: dt.datetime) -> None:
    if key not in ALLOWED_KEYS:
        raise ValueError("key not supported")
    with locked(path):
        state = read_state(path)
        if revoke:
            state["entries"].pop(key, None)
        else:
            state["entries"][key] = {
                "attested_at": timestamp(now),
                "expires_at": timestamp(now + dt.timedelta(days=VALID_DAYS)),
            }
        write_state(path, state)


def configured_data_dir() -> Path:
    # Reuse the same allowlisted env parser as ops/go-live-evidence.py without
    # importing it, so this command remains standalone and does not echo secrets.
    file = ROOT / ".env"
    if not file.is_file() or file.is_symlink():
        raise ValueError("missing .env")
    directory = "/data/education-games-platform"
    for line in file.read_text(encoding="utf-8").splitlines():
        if line.startswith("HC_DATA_DIR="):
            directory = line.split("=", 1)[1].strip().strip('"').strip("'")
    return Path(os.environ.get("HC_DATA_DIR") or directory)


def report(path: Path, now: dt.datetime, *, changed: bool) -> dict[str, Any]:
    current, expired = active_assertions(path.parent.parent, now)
    return {
        "schema_version": VERSION,
        "captured_at": timestamp(now),
        "attested_keys": current,
        "expired_keys": expired,
        "allowed_keys": sorted(ALLOWED_KEYS),
        "changed": changed,
        "assertion_is_independent_proof": False,
        "legal_approved": False,
        "owner_signoff_recorded": False,
        "public_release_allowed": False,
        "sepay_live_enabled": False,
        "notifications_sent": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Ghi nhận kiểm thử thủ công, KHÔNG phê duyệt mở công khai.")
    ops = parser.add_mutually_exclusive_group()
    ops.add_argument("--attest", choices=sorted(ALLOWED_KEYS))
    ops.add_argument("--revoke", choices=sorted(ALLOWED_KEYS))
    parser.add_argument("--confirm", help="Chỉ ghi khi --confirm I_VERIFIED hoặc REVOKE.")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--data-dir", type=Path)
    args = parser.parse_args(argv)
    now = dt.datetime.now(dt.timezone.utc)
    changed = False
    try:
        path = state_path(args.data_dir or configured_data_dir())
        if args.attest or args.revoke:
            expected = "I_VERIFIED" if args.attest else "REVOKE"
            if args.confirm != expected:
                raise ValueError("requires explicit confirmation")
            change(path, args.attest or args.revoke, revoke=bool(args.revoke), now=now)
            changed = True
        elif args.confirm is not None:
            raise ValueError("confirmation without change")
        result = report(path, now, changed=changed)
    except Exception:
        # No raw errors: .env, state files and underlying path details are private.
        if args.json:
            print(json.dumps({"schema_version": VERSION, "error": "Không đọc/ghi được trạng thái.",
                              "public_release_allowed": False,
                              "assertion_is_independent_proof": False}, ensure_ascii=False))
        else:
            print("✗ Không đọc/ghi được trạng thái. Kiểm tra quyền, key hợp lệ và --confirm.")
        return 2
    if args.json:
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    else:
        print("HappyClass – ghi nhận kiểm thử thủ công (KHÔNG cấp quyền go-live)")
        if changed:
            print("  ✓ Đã cập nhật mốc tự xác nhận (metadata, quyền 0600).")
        print("  Còn hiệu lực: " + (", ".join(result["attested_keys"]) or "không có"))
        print("  Hết hiệu lực: " + (", ".join(result["expired_keys"]) or "không có"))
        print("  Không gửi thông báo, không bật SePay Live, không thay đổi Cloudflare/Docker.")
        print("  Không phải bằng chứng độc lập hay phê duyệt pháp lý / mở công khai.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
