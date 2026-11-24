#!/usr/bin/env python3
"""HappyClass pre-launch evidence gates (manual release approval is NEVER inferred).

Local read-only checks only: .env *key presence / approved nonsecret modes*,
backup/restore success ages, backup timer statuses, and legal draft markers.
Never sends email, simulates payments, changes Cloudflare, or writes state.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ENV_ALLOWED = {
    "HC_DATA_DIR", "API_NODE_ENV", "COOKIE_SECURE", "MAIL_TRANSPORT",
    "MAIL_FROM", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER",
    "SMTP_PASSWORD", "PAYMENT_MODE", "PAYMENT_BANK_ACCOUNT",
    "PAYMENT_BANK_ACCOUNT_NAME", "SEPAY_WEBHOOK_KEY", "OFFLINE_SIGNING_KEY",
    "CONTACT_ZALO",
}
MANUAL_GATES = (
    ("smtp.delivery", "Email thử nghiệm đến hộp thư thật đã được nhận và xác minh."),
    ("smtp.auth_flows", "Đã thử đăng ký, xác thực email, gửi lại và quên mật khẩu."),
    ("payment.sandbox_acceptance", "SePay Test Mode đã qua đúng tiền, thiếu tiền, sai mã và webhook lặp."),
    ("cloudflare.security", "Đã duyệt Access/WAF/TLS/rate-limit và webhook bypass đúng path."),
    ("legal.owner_approval", "Thông tin chủ thể/địa chỉ, quyền riêng tư và hoàn tiền đã được chủ dự án duyệt."),
    ("content.review", "Giáo viên đã duyệt nội dung chờ xuất bản và thử game trên điện thoại."),
    ("admin.accounts", "Tài khoản quản trị đã được rà soát, xoá/khóa tài khoản thử."),
    ("operator.signoff", "Chủ dự án quyết định riêng việc mở công khai và bật thanh toán Live."),
)
LEGAL_DRAFT = re.compile(
    r"(?im)^\s*draft\s*:\s*['\x22\x60][^\n]*(?:Bản dự thảo|Draft terms|Draft policy|will be added before public launch)"
)


class Gates:
    def __init__(self) -> None:
        self.entries: list[dict[str, str]] = []

    def add(self, key: str, status: str, explanation: str, action: str) -> None:
        if status not in ("pass", "block", "manual"):
            raise ValueError("invalid gate status")
        # All messages and keys are fixed application-authored strings, never input.
        self.entries.append({
            "key": key, "status": status, "explanation": explanation, "action": action
        })

    def pass_(self, key: str, explanation: str) -> None:
        self.add(key, "pass", explanation, "")

    def block(self, key: str, explanation: str, action: str) -> None:
        self.add(key, "block", explanation, action)

    def manual(self, key: str, explanation: str) -> None:
        self.add(key, "manual", explanation, "Xác nhận thủ công; không có thao tác tự động.")


def read_env_values(path: Path) -> dict[str, str]:
    if path.is_symlink() or not path.is_file():
        raise OSError("env file not regular")
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.lstrip()
        if stripped.startswith("#") or "=" not in line:
            continue
        name, raw = line.split("=", 1)
        key = name.strip()
        if key not in ENV_ALLOWED:
            continue
        raw = raw.strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
            raw = raw[1:-1]
        values[key] = raw
    return values


def valid_mail_from(value: str) -> bool:
    """Validate an address or conventional display name + <address> syntax."""
    if not isinstance(value, str) or "\r" in value or "\n" in value:
        return False
    candidate = value.strip()
    if "<" in candidate or ">" in candidate:
        match = re.fullmatch(r"[^<>\r\n]+\s*<([^<>\s]+)>", candidate)
        if not match:
            return False
        candidate = match.group(1)
    return bool(re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", candidate))


def status_age_hours(file: Path, *, now: dt.datetime) -> float:
    if file.is_symlink() or file.parent.is_symlink():
        raise ValueError("symlink status file")
    data = json.loads(file.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("invalid status metadata")
    when = data.get("lastSuccess")
    if not isinstance(when, str):
        raise ValueError("missing lastSuccess")
    moment = dt.datetime.fromisoformat(when.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        raise ValueError("missing timezone")
    age = (now - moment).total_seconds() / 3600
    if age < 0:
        raise ValueError("future success stamp")
    return age


def timer_ok(name: str) -> bool:
    if not re.fullmatch(r"happyclass-(?:backup|restore-test)\.timer", name):
        raise ValueError("timer not allowlisted")
    for action in ("is-enabled", "is-active"):
        proc = subprocess.run(
            ["systemctl", action, "--quiet", name],
            stdin=subprocess.DEVNULL, capture_output=True,
            timeout=5, text=True, check=False
        )
        if proc.returncode != 0:
            return False
    return True


def evaluate(env_path: Path, data_dir: Path | None, legal_file: Path,
             *, check_timers: bool = True, now: dt.datetime | None = None) -> dict[str, Any]:
    report = Gates()
    captured = now or dt.datetime.now(dt.timezone.utc)
    if captured.tzinfo is None:
        raise ValueError("timestamp must be aware")

    values: dict[str, str] = {}
    try:
        values = read_env_values(env_path)
        if stat.S_IMODE(env_path.stat().st_mode) == 0o600:
            report.pass_("env.permissions", ".env có quyền 0600.")
        else:
            report.block("env.permissions", ".env chưa có quyền 0600.",
                         "Xác minh đúng file rồi đặt quyền 0600 trước go-live.")
    except (OSError, UnicodeError):
        report.block("env.permissions", "Không đọc được file cấu hình hợp lệ.",
                     "Kiểm tra .env thuộc HappyClass; không gửi nội dung file.")
    def flag(key: str, expected: str, gate: str, action: str) -> None:
        if values.get(key) == expected:
            report.pass_(gate, "Đã xác minh chế độ cấu hình yêu cầu.")
        else:
            report.block(gate, "Chế độ cấu hình chưa đạt.", action)

    flag("API_NODE_ENV", "production", "api.production",
         "Chỉ chuyển production sau khi email và kiểm thử đạt.")
    flag("COOKIE_SECURE", "true", "session.secure_cookie",
         "Xác minh HTTPS/Tunnel rồi cấu hình COOKIE_SECURE=true.")

    from_addr = values.get("MAIL_FROM", "")
    smtp_host = values.get("SMTP_HOST", "")
    smtp_port = values.get("SMTP_PORT", "587")
    has_auth = bool(values.get("SMTP_USER")) == bool(values.get("SMTP_PASSWORD"))
    good_port = smtp_port.isascii() and smtp_port.isdecimal() and 1 <= int(smtp_port) <= 65535
    if (values.get("MAIL_TRANSPORT") == "smtp" and smtp_host
            and valid_mail_from(from_addr)
            and good_port and has_auth and values.get("SMTP_SECURE", "false") in ("true", "false", "1", "0")):
        report.pass_("smtp.config", "SMTP có cấu hình cơ bản; chưa kiểm chứng thư đến.")
    else:
        report.block("smtp.config", "SMTP chưa đủ điều kiện kiểm tra thực tế.",
                     "Kiểm tra MAIL_TRANSPORT, MAIL_FROM, SMTP_HOST/PORT/SECURE và cặp auth.")

    if values.get("PAYMENT_MODE") == "sandbox":
        report.pass_("payment.mode", "PAYMENT_MODE vẫn ở sandbox.")
    elif values.get("PAYMENT_MODE") == "live":
        report.block("payment.mode", "Đang ở Live trước nghiệm thu thủ công.",
                     "Không tự đổi chế độ; chủ dự án cần xác minh lựa chọn Live.")
    else:
        report.block("payment.mode", "Chưa đặt chế độ thanh toán sandbox.",
                     "Cấu hình sandbox để kiểm thử trước khi mở bán.")

    if (re.fullmatch(r"[0-9]{6,19}", values.get("PAYMENT_BANK_ACCOUNT", ""))
            and bool(values.get("PAYMENT_BANK_ACCOUNT_NAME"))):
        report.pass_("payment.bank", "Thông tin nhận tiền có định dạng hợp lệ (đã ẩn).")
    else:
        report.block("payment.bank", "Thiếu hoặc sai thông tin nhận tiền.",
                     "Kiểm tra PAYMENT_BANK_ACCOUNT và tên chủ tài khoản, không đăng giá trị.")

    if len(values.get("SEPAY_WEBHOOK_KEY", "")) >= 24:
        report.pass_("payment.webhook_key", "Khóa webhook có độ dài tối thiểu (đã ẩn).")
    else:
        report.block("payment.webhook_key", "Khóa webhook chưa đạt độ dài tối thiểu.",
                     "Thiết lập khóa webhook đủ dài; không gửi khóa vào chat.")

    for key, gate, desc in (
        ("OFFLINE_SIGNING_KEY", "offline.signing_key", "Khóa ký giấy phép offline"),
        ("CONTACT_ZALO", "support.zalo", "Liên hệ hỗ trợ Zalo")
    ):
        if values.get(key):
            report.pass_(gate, f"{desc} đã có (giá trị ẩn).")
        else:
            report.block(gate, f"Thiếu {desc}.",
                         f"Hoàn thiện {key} trước nghiệm thu.")

    target = data_dir or Path(values.get("HC_DATA_DIR") or "/data/education-games-platform")
    if not target.is_absolute() or target.is_symlink():
        target = None
    for file_name, gate, label, limit in (
        ("backup.json", "backup.offsite", "Sao lưu offsite", 48),
        ("restore-test.json", "backup.restore", "Diễn tập khôi phục", 192),
    ):
        try:
            if target is None:
                raise ValueError("bad data directory")
            age = status_age_hours(target / "status" / file_name, now=captured)
            if age <= limit:
                report.pass_(gate, f"{label} có lastSuccess trong {limit} giờ.")
            else:
                report.block(gate, f"{label} vượt quá {limit} giờ.",
                             "Kiểm tra lịch và kho backup, không tự restore dữ liệu production.")
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError, OverflowError):
            report.block(gate, f"Không xác minh được {label}.",
                         "Kiểm tra status JSON và quyền file trong HC_DATA_DIR/status.")

    for timer, gate, label in (
        ("happyclass-backup.timer", "timer.backup", "Sao lưu hằng ngày"),
        ("happyclass-restore-test.timer", "timer.restore", "Diễn tập khôi phục hằng tuần")
    ):
        if not check_timers:
            report.manual(gate, f"Chưa kiểm tra systemd timer: {label}.")
            continue
        try:
            if timer_ok(timer):
                report.pass_(gate, f"Timer {label} đã enabled và active.")
            else:
                report.block(gate, f"Timer {label} chưa enabled/active.",
                             "Kiểm tra lịch hệ thống HappyClass; không tự bật timer.")
        except (OSError, ValueError, subprocess.TimeoutExpired):
            report.block(gate, f"Không xác minh được timer {label}.",
                         "Kiểm tra systemctl tại máy chủ.")

    try:
        if legal_file.is_symlink() or not legal_file.is_file():
            raise OSError("bad legal file")
        content = legal_file.read_text(encoding="utf-8")
        if LEGAL_DRAFT.search(content):
            report.block("legal.draft", "Văn bản pháp lý vẫn mang nhãn dự thảo.",
                         "Chủ dự án cung cấp pháp nhân/địa chỉ và duyệt bản song ngữ.")
        else:
            report.pass_("legal.draft", "Không phát hiện các nhãn dự thảo đã biết.")
    except (OSError, UnicodeError):
        report.block("legal.draft", "Không đọc được văn bản pháp lý.",
                     "Kiểm tra apps/web/src/components/legal.tsx.")

    for key, explanation in MANUAL_GATES:
        report.manual(key, explanation)

    counts = {level: sum(x["status"] == level for x in report.entries)
              for level in ("pass", "block", "manual")}
    return {
        "schema_version": 1,
        "captured_at": captured.astimezone(dt.timezone.utc).isoformat(timespec="seconds"),
        "assessment": "blocked" if counts["block"] else "manual_review_required",
        "counts": counts,
        "gates": report.entries,
        "public_release_allowed": False,
        "requires_owner_approval": True,
        "smtp_test_email_sent": False,
        "sepay_transaction_created": False,
        "notifications_sent": False,
        "configuration_changed": False,
    }


def print_text(report: dict[str, Any]) -> None:
    print("HappyClass – Go-live Evidence (chỉ đọc; KHÔNG duyệt mở công khai)")
    for g in report["gates"]:
        symbol = {"pass": "✓", "block": "✗", "manual": "?"}[g["status"]]
        print(f"  {symbol} [{g['key']}] {g['explanation']}")
        if g["status"] == "block":
            print("    Cần làm: " + g["action"])
    c = report["counts"]
    print(f"==> {report['assessment']} | Đạt {c['pass']}, Chặn {c['block']}, "
          f"Cần xác minh thủ công {c['manual']}")
    print("Không gửi email, không tạo giao dịch SePay, không đổi Cloudflare/.env/Docker.")
    print("Không có kết quả nào của công cụ tự cấp quyền mở công khai hoặc bật thanh toán Live.")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Thu thập bằng chứng trước go-live, không mở dịch vụ.")
    p.add_argument("--json", action="store_true", help="In kết quả chỉ gồm metadata JSON.")
    p.add_argument("--env-file", type=Path, default=ROOT / ".env")
    p.add_argument("--data-dir", type=Path, default=None)
    p.add_argument("--legal-file", type=Path, default=ROOT / "apps/web/src/components/legal.tsx")
    p.add_argument("--no-systemd", action="store_true",
                   help="Kiểm tra ngoại tuyến; timer phải xác minh thủ công.")
    args = p.parse_args(argv)
    try:
        report = evaluate(args.env_file, args.data_dir, args.legal_file,
                          check_timers=not args.no_systemd)
    except Exception:
        # No raw exception text: may contain filesystem paths or config values.
        report = {
            "schema_version": 1, "assessment": "blocked", "counts": {
                "pass": 0, "block": 1, "manual": 1
            }, "gates": [{"key": "audit.failed", "status": "block",
                          "explanation": "Không thể hoàn thành kiểm định.",
                          "action": "Kiểm tra quyền truy cập và dữ liệu cục bộ."}],
            "public_release_allowed": False, "requires_owner_approval": True,
            "smtp_test_email_sent": False, "sepay_transaction_created": False,
            "notifications_sent": False, "configuration_changed": False,
        }
    if args.json:
        print(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
    else:
        print_text(report)
    return 2 if report["counts"]["block"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
