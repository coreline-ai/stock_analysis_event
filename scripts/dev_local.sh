#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PORT="${PORT:-3333}"
export NEXT_TELEMETRY_DISABLED=1

# Local-friendly defaults. Production stays strict; this is just a helper script.
export DATABASE_URL="${DATABASE_URL:-postgres://mahoraga:mahoraga@127.0.0.1:15432/mahoraga}"
export MAHORAGA_API_TOKEN="${MAHORAGA_API_TOKEN:-dev-token}"
export CRON_SECRET="${CRON_SECRET:-dev-cron}"
export LLM_PROVIDER="${LLM_PROVIDER:-stub}"
export LOCK_MODE="${LOCK_MODE:-memory}"

cd "${ROOT_DIR}"

npm run -s db:up
npm run -s db:migrate
npm run -s dev:up

echo "local ready:"
echo "  http://localhost:${PORT}"
echo "  health: curl http://localhost:${PORT}/api/health"
