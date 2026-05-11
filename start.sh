#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${MODE:-prod}"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
NODE_ENV="${NODE_ENV:-development}"
DATA_DIR="${DATA_DIR:-../data}"
FRONTEND_DIR="${FRONTEND_DIR:-../frontend/dist}"
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-development-access-secret-with-at-least-thirty-two-characters}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-development-refresh-secret-with-at-least-thirty-two-characters}"
PAY_CALLBACK_SECRET="${PAY_CALLBACK_SECRET:-development-payment-secret-with-at-least-thirty-two-characters}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:${PORT},http://127.0.0.1:${PORT},http://localhost:5173}"

usage() {
  cat <<'USAGE'
HiCAD startup script

Usage:
  ./start.sh                 Build and start production-style backend on 127.0.0.1:3000
  MODE=dev ./start.sh        Start shared/backend/frontend dev servers
  PORT=3100 ./start.sh       Start backend on a custom port
  HICAD_KILL_PORT=1 ./start.sh
                             If the selected PORT is occupied, kill only those listed PIDs

Environment:
  MODE=prod|dev
  HOST=127.0.0.1
  PORT=3000
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
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

check_port() {
  local pids
  pids="$(port_pids)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  echo "Port $PORT is already in use by PID(s): $pids" >&2
  if [[ "${HICAD_KILL_PORT:-0}" != "1" ]]; then
    echo "Refusing to interfere with other projects. Choose another PORT or rerun with HICAD_KILL_PORT=1." >&2
    exit 1
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    echo "Stopping PID $pid on port $PORT"
    kill "$pid"
  done <<<"$pids"
}

need_command node
need_command pnpm

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Installing dependencies in $ROOT_DIR"
  pnpm install
fi

if [[ "$MODE" == "dev" ]]; then
  echo "Starting HiCAD in development mode"
  export HOST PORT NODE_ENV DATA_DIR FRONTEND_DIR JWT_ACCESS_SECRET JWT_REFRESH_SECRET PAY_CALLBACK_SECRET CORS_ORIGIN
  exec pnpm dev
fi

if [[ "$MODE" != "prod" ]]; then
  echo "Unknown MODE: $MODE" >&2
  usage
  exit 1
fi

check_port

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" || ! -f "$ROOT_DIR/frontend/dist/index.html" || "${HICAD_FORCE_BUILD:-0}" == "1" ]]; then
  echo "Building HiCAD workspace"
  pnpm build
fi

echo "Starting HiCAD at http://${HOST}:${PORT}"
export HOST PORT NODE_ENV DATA_DIR FRONTEND_DIR JWT_ACCESS_SECRET JWT_REFRESH_SECRET PAY_CALLBACK_SECRET CORS_ORIGIN
exec pnpm --filter @hicad/backend start
