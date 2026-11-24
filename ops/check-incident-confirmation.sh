#!/usr/bin/env bash
# Manual, on-demand confirmation of HappyClass incident signals.
# Preview is read-only; --record only writes protected local metadata state.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root
[ -f .env ] || die "Không tìm thấy .env của HappyClass."
command -v docker >/dev/null 2>&1 || die "Cần Docker."
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
compose config --quiet || die "Docker Compose config không hợp lệ."
# Do not print Docker Compose expanded configuration (may contain secrets).
project="$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name", ""))')" \
  || die "Không xác minh được Docker Compose project."
[ "$project" = "happyclass" ] || die "Sai Docker Compose project; từ chối kiểm tra."
exec python3 "$REPO_DIR/ops/incident-confirm.py" "$@"
