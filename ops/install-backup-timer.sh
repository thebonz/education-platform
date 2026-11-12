#!/usr/bin/env bash
# =============================================================================
# Lên lịch sao lưu tự động bằng systemd timer (thay đổi duy nhất trên máy chủ: 4 file unit
# /etc/systemd/system/happyclass-backup.* và happyclass-restore-test.*; không đụng cron/dịch vụ khác).
#   - 02:30 hằng ngày: ops/backup-offsite.sh
#   - 04:00 thứ Hai:   ops/restore-test.sh (diễn tập khôi phục)
# Gỡ: sudo bash ops/install-backup-timer.sh --remove
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root
units="happyclass-backup.service happyclass-backup.timer happyclass-restore-test.service happyclass-restore-test.timer"
if [ "${1:-}" = "--remove" ]; then
  systemctl disable --now happyclass-backup.timer happyclass-restore-test.timer 2>/dev/null || true
  for u in $units; do rm -f "/etc/systemd/system/$u"; done
  systemctl daemon-reload; ok "Đã gỡ lịch sao lưu tự động"; exit 0
fi
load_backup_env
command -v systemctl > /dev/null || die "Máy chủ không dùng systemd."
unit() { # unit <tên> <mô tả> <script>
  cat > "/etc/systemd/system/$1.service" <<UNIT
[Unit]
Description=$2
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=HC_DATA_DIR=$DATA_DIR
ExecStart=/bin/bash $REPO_DIR/ops/$3
Nice=10
IOSchedulingClass=idle
UNIT
}
unit happyclass-backup "HappyClass – sao lưu mã hoá ra ngoài máy chủ" backup-offsite.sh
unit happyclass-restore-test "HappyClass – diễn tập khôi phục bản sao lưu" restore-test.sh
cat > /etc/systemd/system/happyclass-backup.timer <<UNIT
[Unit]
Description=HappyClass – sao lưu hằng ngày 02:30

[Timer]
OnCalendar=*-*-* 02:30:00
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
UNIT
cat > /etc/systemd/system/happyclass-restore-test.timer <<UNIT
[Unit]
Description=HappyClass – diễn tập khôi phục thứ Hai 04:00

[Timer]
OnCalendar=Mon *-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now happyclass-backup.timer happyclass-restore-test.timer > /dev/null
systemctl list-timers 'happyclass-*' --no-pager
ok "Đã lên lịch. Xem log: tail -n 50 $DATA_DIR/logs/backup.log  ·  journalctl -u happyclass-backup"
