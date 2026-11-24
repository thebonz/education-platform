#!/usr/bin/env bash
# On-demand PostgreSQL metadata snapshot/delta; DB queries are READ ONLY.
# The only write is a root-readable local status JSON, never to PostgreSQL.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root

[ -f .env ] || die "Không tìm thấy .env."
command -v docker >/dev/null 2>&1 || die "Cần Docker."
command -v python3 >/dev/null 2>&1 || die "Cần Python 3."
[ -f "$REPO_DIR/ops/postgres-trend.sql" ] || die "Không tìm thấy SQL chỉ đọc."
compose config --quiet || die "Docker Compose config không hợp lệ."
cid="$(compose ps -q postgres)"
[ -n "$cid" ] || die "PostgreSQL HappyClass chưa chạy."
project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$cid")"
[ "$project" = "happyclass" ] || die "Container không thuộc project HappyClass."
health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
[ "$health" = "healthy" ] || die "PostgreSQL HappyClass chưa healthy ($health)."

data_dir="${HC_DATA_DIR:-$(env_value HC_DATA_DIR || true)}"
data_dir="${data_dir:-/data/education-games-platform}"
data_dir="${data_dir#\"}"
data_dir="${data_dir%\"}"
[ "${data_dir#/}" != "$data_dir" ] || die "HC_DATA_DIR phải là đường dẫn tuyệt đối."

log "PostgreSQL trend HappyClass: lần đo chỉ đọc, so với mốc local"
python3 "$REPO_DIR/ops/postgres-trend.py" "$REPO_DIR" "$data_dir"
