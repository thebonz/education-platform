#!/usr/bin/env bash
# Read-only preflight for HappyClass on Ubuntu / HPE ProLiant DL380.
# Does not install packages, change firewall rules, mount disks, or touch containers.
set -uo pipefail
PASS=0; WARN=0; FAIL=0
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }
pass() { PASS=$((PASS+1)); printf '  [OK]   %s\n' "$1"; }
warn() { WARN=$((WARN+1)); printf '  [WARN] %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); printf '  [FAIL] %s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

section "HappyClass / Ubuntu DL380 preflight (read-only)"
printf 'Date: %s\nHost: %s\n' "$(date -Is 2>/dev/null || date)" "$(hostname 2>/dev/null || echo unknown)"

section "Operating system"
if [ -r /etc/os-release ]; then
  . /etc/os-release
  printf '  %s (%s) / %s\n' "${PRETTY_NAME:-Linux}" "${VERSION_ID:-unknown}" "$(uname -m)"
  [ "${ID:-}" = ubuntu ] && pass "Ubuntu detected" || warn "Expected Ubuntu; detected ${ID:-unknown}"
  case "${VERSION_ID:-}" in 22.04|24.04) pass "Ubuntu LTS version";; *) warn "Prefer Ubuntu Server 22.04 or 24.04 LTS";; esac
else fail "Cannot read /etc/os-release"; fi
[ "$(uname -m)" = x86_64 ] && pass "x86_64 architecture" || warn "Verify architecture compatibility"

section "Hardware and resources"
printf '  CPU: '; lscpu 2>/dev/null | awk -F: '/Model name/ {sub(/^[ \t]+/, "", $2); print $2; exit}'
printf '  Logical CPUs: %s\n' "$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo unknown)"
if [ -r /proc/meminfo ]; then
  awk '/MemTotal/ {printf "  RAM: %.1f GiB\n", $2/1048576} /MemAvailable/ {printf "  Available RAM: %.1f GiB\n", $2/1048576}' /proc/meminfo
  avail="$(awk '/MemAvailable/ {print $2}' /proc/meminfo)"
  [ "${avail:-0}" -ge 8388608 ] && pass "At least 8 GiB currently available" || warn "Less than 8 GiB currently available; assess workload"
fi
if have lsblk; then lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS 2>/dev/null | sed 's/^/  /'; else warn "lsblk unavailable"; fi
if [ -d /data ]; then
  df -hP /data | sed 's/^/  /'
  avail="$(df -Pk /data 2>/dev/null | awk 'NR==2 {print $4}')"
  [ "${avail:-0}" -ge 52428800 ] && pass "/data has at least 50 GiB free" || warn "/data has less than 50 GiB free"
else warn "/data does not exist; attach intended RAID-backed filesystem before production"; fi

section "Time and network"
if timedatectl status >/dev/null 2>&1; then
  timedatectl status | grep -E 'System clock synchronized|NTP service|Time zone' | sed 's/^/  /'
  timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qi yes && pass "Clock synchronized" || warn "Clock synchronization not confirmed"
else warn "timedatectl unavailable; verify NTP"; fi
if have getent && getent hosts github.com >/dev/null 2>&1; then pass "DNS resolution works"; else warn "DNS resolution failed"; fi
if have curl && curl -fsSI --max-time 8 https://registry-1.docker.io/ >/dev/null 2>&1; then pass "Outbound HTTPS to Docker registry works"; else warn "Cannot confirm outbound HTTPS to Docker registry"; fi

section "Docker"
if have docker; then
  docker --version
  if docker compose version >/dev/null 2>&1; then docker compose version; pass "Docker Compose v2 available"; else fail "Docker Compose v2 plugin missing"; fi
  if docker info >/dev/null 2>&1; then
    pass "Docker daemon reachable by current user"
    docker info --format '  Server: {{.ServerVersion}} | Storage: {{.Driver}} | Cgroup: {{.CgroupVersion}}' 2>/dev/null || true
  else warn "Docker daemon inaccessible as current user; try sudo for this check"; fi
else fail "Docker Engine not installed"; fi

section "Ports and firewall"
if have ss; then
  for port in 3100 3101; do
    if ss -ltnH "( sport = :$port )" 2>/dev/null | grep -q .; then
      warn "Port $port is already listening; identify owner before deployment"
      ss -ltnp "( sport = :$port )" 2>/dev/null | sed 's/^/    /'
    else pass "Port $port currently free"; fi
  done
else warn "ss unavailable; cannot inspect ports"; fi
if have ufw; then ufw status 2>/dev/null | sed 's/^/  /'; else warn "UFW unavailable; inspect nftables/iptables or upstream firewall"; fi
printf '  Reminder: Web/API should bind only to 127.0.0.1; PostgreSQL must not publish a host port.\n'

section "Deployment path and tools"
if [ -d /data ]; then
  mountpoint -q /data 2>/dev/null && pass "/data is a separate mount" || warn "/data is not a separate mount; verify root disk and RAID logical volume"
  [ -w /data ] && pass "/data writable by current user" || warn "/data not writable by current user (sudo deployment may write)"
else warn "Create and mount the intended RAID-backed /data filesystem"; fi
for bin in git openssl curl; do have "$bin" && pass "$bin available" || fail "$bin missing"; done

section "Summary"
printf '  OK: %d  WARN: %d  FAIL: %d\n' "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -gt 0 ]; then printf 'Resolve FAIL items before deployment. Review warnings with the server operator.\n'; exit 1; fi
printf 'Preflight completed; no system changes were made. Review every warning before proceeding.\n'
