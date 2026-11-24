#!/usr/bin/env python3
"""Read-only prelaunch aggregate summary of HappyClass game and account states.

Queries only counts using PostgreSQL BEGIN READ ONLY via compose postgres.
Does not return IDs, user/game names, emails, hashes, SQL rows or credentials.
This is NOT a substitute for teacher review, admin review or owner signoff.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "ops" / "prelaunch-aggregate.sql"
FIELDS = (
    "games_total", "games_published", "games_pending_review",
    "games_changes_requested", "games_approved", "published_not_approved",
    "published_without_published_version", "users_total", "users_active",
    "users_inactive", "active_super_admins", "active_content_reviewers",
    "staff_role_assignments",
)


def validate(raw: Any) -> dict[str, int]:
    """Strict metadata allowlist so nothing identifying can escape as JSON."""
    if not isinstance(raw, dict) or raw.get("schema_version") != 1:
        raise ValueError("bad aggregate schema")
    if any(key not in raw for key in FIELDS):
        raise ValueError("missing count")
    counts = {key: raw[key] for key in FIELDS}
    if any(type(value) is not int or value < 0 for value in counts.values()):
        raise ValueError("invalid aggregate count")
    if (counts["games_published"] > counts["games_total"] or
            counts["games_approved"] + counts["games_pending_review"] +
            counts["games_changes_requested"] != counts["games_total"] or
            counts["published_not_approved"] > counts["games_published"] or
            counts["published_without_published_version"] > counts["games_published"] or
            counts["users_active"] + counts["users_inactive"] != counts["users_total"] or
            counts["active_super_admins"] > counts["users_active"] or
            counts["active_content_reviewers"] > counts["users_active"]):
        raise ValueError("inconsistent aggregate counts")
    return counts


def parse_psql(stdout: str) -> dict[str, int]:
    if not isinstance(stdout, str) or len(stdout) > 8000:
        raise ValueError("invalid output size")
    return validate(json.loads(stdout.strip()))


def sql_is_safe(contents: str) -> bool:
    """Reject accidentally changed SQL that could write or reveal rows."""
    import re
    if not contents.strip().startswith("-- HappyClass pre-launch audit:"):
        return False
    if "BEGIN TRANSACTION READ ONLY;" not in contents or "COMMIT;" not in contents:
        return False
    # Defense-in-depth static guard; PostgreSQL READ ONLY is authoritative.
    forbidden = re.compile(
        r"\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|"
        r"COPY|DO|CALL|EXECUTE|VACUUM|ANALYZE|LOCK|FOR\s+UPDATE)\b",
        re.IGNORECASE
    )
    # Exclude literal comments first: human documentation isn't SQL.
    code = "\n".join(row.split("--", 1)[0] for row in contents.splitlines())
    return not bool(forbidden.search(code))


def collect(*, repo: Path = ROOT, sql_path: Path = SQL) -> dict[str, int]:
    contents = sql_path.read_text(encoding="utf-8")
    if not sql_is_safe(contents):
        raise ValueError("unsafe SQL")
    command = [
        "docker", "compose", "exec", "-T", "postgres", "sh", "-c",
        'exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
    ]
    done = subprocess.run(command, cwd=repo, input=contents, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=25, check=False)
    if done.returncode != 0:
        # Never include raw Docker/psql stderr in logs.
        raise RuntimeError("DB aggregate probe failed")
    return parse_psql(done.stdout)


def evaluate(counts: dict[str, int], *, captured: dt.datetime | None = None) -> dict[str, Any]:
    counts = validate({"schema_version": 1, **counts})
    checks: list[dict[str, str]] = []

    def add(key: str, level: str, message: str) -> None:
        checks.append({"key": key, "level": level, "message": message})

    if counts["published_not_approved"]:
        add("content.published_without_approval", "block",
            "Có game công khai chưa có trạng thái APPROVED; cần rà soát trong Admin.")
    else:
        add("content.published_without_approval", "pass",
            "Không có game công khai thiếu trạng thái APPROVED.")

    if counts["published_without_published_version"]:
        add("content.missing_published_version", "block",
            "Có game công khai thiếu phiên bản nội dung được xuất bản.")
    else:
        add("content.missing_published_version", "pass",
            "Game công khai đều có phiên bản nội dung xuất bản.")

    if counts["games_pending_review"] or counts["games_changes_requested"]:
        add("content.review_queue", "manual",
            "Còn game PENDING/CHANGES_REQUESTED; cần giáo viên xem chi tiết trong Admin.")
    else:
        add("content.review_queue", "pass",
            "Không có game đang PENDING hoặc CHANGES_REQUESTED.")

    if counts["active_super_admins"] < 1:
        add("accounts.super_admin", "block",
            "Không có Super Admin còn hiệu lực; cần kiểm tra phân quyền.")
    else:
        add("accounts.super_admin", "pass",
            "Có ít nhất một Super Admin còn hiệu lực.")

    if counts["active_content_reviewers"] < 1:
        add("accounts.content_reviewer", "manual",
            "Chưa thấy tài khoản content_reviewer còn hiệu lực; xác minh giáo viên duyệt.")
    else:
        add("accounts.content_reviewer", "pass",
            "Có tài khoản content_reviewer còn hiệu lực.")

    # Never infer test users from email, display name or recent-login data.
    add("accounts.human_review", "manual",
        "Cần chủ dự án rà soát tài khoản thử, quyền nhân sự và quyền truy cập Admin.")

    count = {key: sum(row["level"] == key for row in checks) for key in ("pass", "block", "manual")}
    now = captured or dt.datetime.now(dt.timezone.utc)
    return {
        "schema_version": 1,
        "captured_at": now.astimezone(dt.timezone.utc).isoformat(timespec="seconds"),
        "assessment": "blocked" if count["block"] else "manual_review_required",
        "counts": count,
        "aggregates": counts,
        "checks": checks,
        "no_personal_data": True,
        "read_only": True,
        "content_review_approved": False,
        "admin_accounts_approved": False,
        "public_release_allowed": False,
        "sepay_live_enabled": False,
        "database_modified": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="HappyClass content/account summary – read only")
    parser.add_argument("--json", action="store_true", help="Chỉ in JSON metadata")
    args = parser.parse_args(argv)
    try:
        result = evaluate(collect())
    except Exception:
        # Fail closed, no exception text containing SQL, config or user data.
        if args.json:
            print('{"schema_version":1,"assessment":"blocked",'
                  '"error":"Không xác minh được dữ liệu tổng hợp.",'
                  '"public_release_allowed":false,"database_modified":false}')
        else:
            print("✗ Không đọc được số liệu tổng hợp HappyClass. Không thay đổi DB.")
        return 2
    if args.json:
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    else:
        print("HappyClass – Nội dung & phân quyền (chỉ số tổng hợp, chỉ đọc)")
        for key, value in result["aggregates"].items():
            print(f"  {key}: {value}")
        for row in result["checks"]:
            icon = {"pass": "✓", "block": "✗", "manual": "?"}[row["level"]]
            print(f"  {icon} [{row['key']}] {row['message']}")
        print("==> " + result["assessment"] + " | "
              + ", ".join(f"{level}: {n}" for level, n in result["counts"].items()))
        print("Không xuất email, tên, token, dữ liệu trò chơi; không sửa PostgreSQL.")
        print("Chưa phải phê duyệt nội dung, phân quyền hay mở công khai.")
    return 2 if result["counts"]["block"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
