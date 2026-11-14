# Hàm dùng chung cho các script vận hành HappyClass. Được source, không chạy trực tiếp.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${HC_DATA_DIR:-/data/education-games-platform}"
cd "$REPO_DIR"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

require_root() { [ "$(id -u)" -eq 0 ] || die "Hãy chạy bằng sudo."; }

compose() { docker compose "$@"; }

env_value() { # đọc một biến từ .env mà không in ra màn hình
  grep -E "^$1=" .env | tail -n1 | cut -d= -f2-
}

# Trạng thái container của CMMS và Airdrop (bỏ thời gian chạy để so sánh trước/sau)
snapshot_other_projects() {
  docker ps -a --filter name=cmms_radiotherapy_hardcoded --filter name=airdrop-automation \
    --format '{{.Names}} {{.Status}}' | sed -E 's/(Up|Exited \([0-9]+\))[^()]*/\1 /; s/ +/ /g' | sort
}

wait_healthy() { # wait_healthy <service> <timeout_seconds>
  local svc="$1" timeout="${2:-120}" cid status
  cid="$(compose ps -q "$svc")"
  [ -n "$cid" ] || die "Service $svc chưa chạy."
  for _ in $(seq 1 "$timeout"); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
    [ "$status" = "healthy" ] && { ok "$svc healthy"; return 0; }
    sleep 1
  done
  compose logs --tail 60 "$svc" || true
  die "$svc không healthy sau ${timeout}s (trạng thái: $status)."
}

port_free_or_ours() { # port_free_or_ours <port>
  local port="$1"
  if ss -lntH "sport = :$port" | grep -q .; then
    docker ps --filter "label=com.docker.compose.project=happyclass" --format '{{.Ports}}' | grep -q "127.0.0.1:$port->" \
      || die "Cổng $port đang bị tiến trình khác dùng. Đổi HC_WEB_HOST_PORT/HC_API_HOST_PORT trong .env."
  fi
}

set_env() { # set_env KEY VALUE – thay hoặc thêm một dòng trong .env, không in giá trị bí mật
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" .env; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' .env > "$tmp"
  else
    cat .env > "$tmp"; printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > .env; rm -f "$tmp"
}

# ---- Sao lưu ngoài máy chủ (restic chạy trong container, không cài gì lên máy chủ) ----
RESTIC_IMAGE="${RESTIC_IMAGE:-restic/restic:0.17.3}"
BACKUP_DIR="$DATA_DIR/backup"
BACKUP_ENV="$BACKUP_DIR/backup.env"
# Bảng đếm để đối chiếu khi diễn tập khôi phục
COUNT_TABLES="users games game_versions orders entitlements bank_transactions classrooms class_students class_plays media_assets audit_logs"

load_backup_env() {
  [ -f "$BACKUP_ENV" ] || die "Chưa cấu hình sao lưu. Chạy: sudo bash ops/configure-backup.sh"
  set -a; # shellcheck disable=SC1090
  . "$BACKUP_ENV"; set +a
}

# restic <lệnh…> – chạy restic trong container dùng một lần; thông tin đăng nhập truyền qua --env-file (không hiện trên dòng lệnh)
restic() {
  mkdir -p "$BACKUP_DIR/cache"
  docker run --rm -i --env-file "$BACKUP_ENV" \
    ${BACKUP_DOCKER_NETWORK:+--network "$BACKUP_DOCKER_NETWORK"} \
    -v "$BACKUP_DIR/cache:/cache" ${RESTIC_MOUNTS:-} \
    "$RESTIC_IMAGE" --cache-dir /cache "$@"
}

db_counts() { # in "bảng số_dòng" cho các bảng quan trọng của database đang chạy
  local t
  for t in $COUNT_TABLES; do
    printf '%s %s\n' "$t" "$(compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc 'SELECT count(*) FROM $t'" | tr -d '\r ')"
  done
}
