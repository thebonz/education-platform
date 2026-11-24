#!/usr/bin/env bash
# HappyClass only. Read is default; explicit --attest/--revoke updates local 0600 metadata.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
exec python3 "$REPO_DIR/ops/manual-acceptance.py" "$@"
