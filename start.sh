#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$ROOT_DIR"

MODE="${MODE:-prod}"
PORT="${PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
HOST="${HOST:-127.0.0.1}"
NODE_ENV="${NODE_ENV:-development}"
DATA_DIR="${DATA_DIR:-../data}"
FRONTEND_DIR="${FRONTEND_DIR:-../frontend/dist}"
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-development-access-secret-with-at-least-thirty-two-characters}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-development-refresh-secret-with-at-least-thirty-two-characters}"
PAY_CALLBACK_SECRET="${PAY_CALLBACK_SECRET:-development-payment-secret-with-at-least-thirty-two-characters}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:${PORT},http://127.0.0.1:${PORT},http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}}"

usage() {
  cat <<'USAGE'
HiCAD startup script

Usage:
  ./start.sh                 Build and start production-style backend on 127.0.0.1:3000
  MODE=dev ./start.sh        Start shared/backend/frontend dev servers
  PORT=3100 ./start.sh       Start backend on a custom port
  MODE=dev FRONTEND_PORT=5174 ./start.sh
                             Start frontend dev server on a custom port
  HICAD_AUTO_KILL_OWN_PORTS=0 ./start.sh
                             Disable automatic cleanup of previous HiCAD listeners
  HICAD_KILL_PORT=1 ./start.sh
                             Force-kill any process listening on the selected port
  HICAD_SKIP_PORT_CHECK=1 ./start.sh
                             Skip startup port preflight

Environment:
  MODE=prod|dev
  HOST=127.0.0.1
  PORT=3000
  FRONTEND_PORT=5173
  NODE_ENV=development
  DATA_DIR=../data
  FRONTEND_DIR=../frontend/dist
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

port_pids() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

process_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

process_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

is_own_hicad_listener() {
  local pid="$1"
  local cwd
  local command
  cwd="$(process_cwd "$pid")"
  command="$(process_command "$pid")"

  if [[ "$cwd" == "$ROOT_DIR/backend" ]]; then
    [[ "$command" == *node* || "$command" == *tsx* || "$command" == *nest* ]]
    return
  fi

  if [[ "$cwd" == "$ROOT_DIR/frontend" ]]; then
    [[ "$command" == *node* || "$command" == *vite* ]]
    return
  fi

  return 1
}

all_listeners_are_own_hicad() {
  local pids="$1"
  local pid
  local found=0
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    found=1
    if ! is_own_hicad_listener "$pid"; then
      return 1
    fi
  done <<<"$pids"
  [[ "$found" == "1" ]]
}

wait_for_port_release() {
  local port="$1"
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if [[ -z "$(port_pids "$port")" ]]; then
      return 0
    fi
    sleep 0.2
  done
  echo "Port $port is still in use after stopping the previous listener." >&2
  echo "Inspect it with: lsof -nP -iTCP:$port -sTCP:LISTEN" >&2
  exit 1
}

stop_port_listeners() {
  local port="$1"
  local pids="$2"
  local reason="$3"
  local pid
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    echo "Stopping PID $pid on port $port ($reason)"
    kill "$pid" 2>/dev/null || true
  done <<<"$pids"
  wait_for_port_release "$port"
}

check_port() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(port_pids "$port")"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  echo "Port $port ($label) is already in use by PID(s): $pids" >&2
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true

  if [[ "${HICAD_KILL_PORT:-0}" == "1" ]]; then
    stop_port_listeners "$port" "$pids" "HICAD_KILL_PORT=1"
    return 0
  fi

  if [[ "${HICAD_AUTO_KILL_OWN_PORTS:-1}" == "1" ]] && all_listeners_are_own_hicad "$pids"; then
    stop_port_listeners "$port" "$pids" "previous HiCAD process from this repository"
    return 0
  fi

  echo "Refusing to interfere with a process that does not look like this HiCAD checkout." >&2
  suggest_port_command "$port" "$label"
  echo "If you are sure, rerun with HICAD_KILL_PORT=1 to stop the listed PID(s)." >&2
  exit 1
}

suggest_port_command() {
  local occupied_port="$1"
  local label="$2"
  local suggested_port
  suggested_port="$(find_free_port "$((occupied_port + 1))" || true)"
  if [[ -z "$suggested_port" ]]; then
    echo "No free port found near $occupied_port. Stop the listed process or set a different PORT manually." >&2
    return 0
  fi
  if [[ "$label" == "frontend dev server" ]]; then
    echo "Try: MODE=dev FRONTEND_PORT=$suggested_port ./start.sh" >&2
  elif [[ "$MODE" == "dev" ]]; then
    echo "Try: MODE=dev PORT=$suggested_port ./start.sh" >&2
  else
    echo "Try: PORT=$suggested_port ./start.sh" >&2
  fi
}

find_free_port() {
  local port="$1"
  local end="$((port + 20))"
  while (( port <= end )); do
    if [[ -z "$(port_pids "$port")" ]]; then
      echo "$port"
      return 0
    fi
    port="$((port + 1))"
  done
  return 1
}

check_startup_ports() {
  if [[ "${HICAD_SKIP_PORT_CHECK:-0}" == "1" ]]; then
    echo "Skipping port preflight because HICAD_SKIP_PORT_CHECK=1"
    return 0
  fi
  if [[ "$MODE" == "prod" ]]; then
    check_port "$PORT" "HiCAD app"
  elif [[ "$MODE" == "dev" ]]; then
    check_port "$PORT" "backend API"
    check_port "$FRONTEND_PORT" "frontend dev server"
  fi
}

if [[ "$MODE" != "prod" && "$MODE" != "dev" ]]; then
  echo "Unknown MODE: $MODE" >&2
  usage
  exit 1
fi

need_command lsof
check_startup_ports
need_command node
need_command pnpm

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Installing dependencies in $ROOT_DIR"
  pnpm install
fi

if [[ "$MODE" == "dev" ]]; then
  echo "Starting HiCAD in development mode"
  export HOST PORT FRONTEND_PORT NODE_ENV DATA_DIR FRONTEND_DIR JWT_ACCESS_SECRET JWT_REFRESH_SECRET PAY_CALLBACK_SECRET CORS_ORIGIN
  exec pnpm dev
fi

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" || ! -f "$ROOT_DIR/frontend/dist/index.html" || "${HICAD_FORCE_BUILD:-0}" == "1" ]]; then
  echo "Building HiCAD workspace"
  pnpm build
fi

echo "Starting HiCAD at http://${HOST}:${PORT}"
export HOST PORT FRONTEND_PORT NODE_ENV DATA_DIR FRONTEND_DIR JWT_ACCESS_SECRET JWT_REFRESH_SECRET PAY_CALLBACK_SECRET CORS_ORIGIN
exec pnpm --filter @hicad/backend start
