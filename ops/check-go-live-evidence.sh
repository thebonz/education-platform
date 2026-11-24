#!/usr/bin/env bash
# Read-only HappyClass go-live evidence; DOES NOT approve public launch.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
exec python3 "$REPO_DIR/ops/go-live-evidence.py" "$@"
