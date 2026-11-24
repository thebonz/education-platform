#!/usr/bin/env bash
# Read-only HappyClass runtime health snapshot. No Docker restart, no service changes.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root
[ -f .env ] || die "Không tìm thấy .env."
command -v python3 >/dev/null 2>&1 || die "Cần python3."
command -v docker >/dev/null 2>&1 || die "Cần Docker."
command -v curl >/dev/null 2>&1 || true
compose config --quiet || die "Docker Compose config không hợp lệ."
python3 "$REPO_DIR/ops/runtime-health.py"
