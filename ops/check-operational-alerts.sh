#!/usr/bin/env bash
# On-demand incident monitor. Read-only checks of *only* HappyClass.
# No systemd/cron, notification delivery, migrations, Docker restarts or DB writes.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root

[ -f .env ] || die "Không tìm thấy .env."
command -v docker >/dev/null 2>&1 || die "Cần Docker."
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
compose config --quiet || die "Docker Compose config không hợp lệ."

cid="$(compose ps -q postgres)"
[ -n "$cid" ] || die "Không tìm thấy PostgreSQL thuộc HappyClass."
project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$cid")"
[ "$project" = "happyclass" ] || die "Sai Docker Compose project; từ chối kiểm tra."

exec python3 "$REPO_DIR/ops/monitor-once.py" "$@"
