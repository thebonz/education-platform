#!/usr/bin/env bash
# Only HappyClass aggregate counts: never modifies PostgreSQL or project settings.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root
[ -f .env ] || die "Không tìm thấy .env HappyClass."
command -v docker >/dev/null 2>&1 || die "Cần Docker."
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
compose config --quiet || die "Docker Compose config không hợp lệ."
# Never print expanded Compose config, which may contain secrets.
project="$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name",""))')" \
  || die "Không xác minh được Docker Compose project."
[ "$project" = "happyclass" ] || die "Sai Compose project, chỉ cho phép happyclass."
exec python3 "$REPO_DIR/ops/prelaunch-aggregate.py" "$@"
