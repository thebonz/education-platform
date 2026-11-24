#!/usr/bin/env bash
# On-demand incident monitor. Read-only checks of *only* HappyClass.
# No systemd/cron, notification delivery, migrations, Docker restarts or DB writes.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root

[ -f .env ] || die "Không tìm thấy .env."
command -v docker >/dev/null 2>&1 || die "Cần Docker."
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
compose config --quiet || die "Docker Compose config không hợp lệ."

# Check project identity from Compose configuration, even when PostgreSQL is DOWN.
# Do not require a running container: outages must produce an alert, not abort.
# The full expanded config is parsed in memory, never printed or saved.
project="$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name", ""))')" \
  || die "Không xác minh được Docker Compose project."
[ "$project" = "happyclass" ] || die "Sai Docker Compose project; từ chối kiểm tra."

exec python3 "$REPO_DIR/ops/monitor-once.py" "$@"
