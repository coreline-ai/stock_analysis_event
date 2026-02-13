#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3333}"
INTERVAL="${AUTO_TRIGGER_INTERVAL_SECONDS:-300}"
AUTO_TRIGGER_SCOPE="${AUTO_TRIGGER_SCOPE:-${DEFAULT_MARKET_SCOPE:-KR}}"
AUTO_TRIGGER_SCOPE="$(echo "${AUTO_TRIGGER_SCOPE}" | tr '[:lower:]' '[:upper:]')"
if [[ "${AUTO_TRIGGER_SCOPE}" != "US" && "${AUTO_TRIGGER_SCOPE}" != "KR" && "${AUTO_TRIGGER_SCOPE}" != "ALL" ]]; then
  AUTO_TRIGGER_SCOPE="KR"
fi

export NEXT_TELEMETRY_DISABLED=1
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-dev}"
export DATABASE_URL="${DATABASE_URL:-postgres://mahoraga:mahoraga@127.0.0.1:15432/mahoraga}"
export API_TOKEN="${API_TOKEN:-${MAHORAGA_API_TOKEN:-dev-token}}"
export MAHORAGA_API_TOKEN="${MAHORAGA_API_TOKEN:-${API_TOKEN}}"
export CRON_SECRET="${CRON_SECRET:-dev-cron}"
export LLM_PROVIDER="${LLM_PROVIDER:-glm}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export GEMINI_BASE_URL="${GEMINI_BASE_URL:-}"
export GEMINI_MODEL="${GEMINI_MODEL:-}"
export GEMINI_TEMPERATURE="${GEMINI_TEMPERATURE:-}"
export LOCK_MODE="${LOCK_MODE:-memory}"
export KR_MARKET_ENABLED="${KR_MARKET_ENABLED:-true}"
export DART_API_KEY="${DART_API_KEY:-}"
export NAVER_ENABLED="${NAVER_ENABLED:-true}"
export DART_ENABLED="${DART_ENABLED:-true}"
export KR_COMMUNITY_ENABLED="${KR_COMMUNITY_ENABLED:-true}"
export KR_NEWS_ENABLED="${KR_NEWS_ENABLED:-true}"

cd "${ROOT_DIR}"

npm run -s db:up
npm run -s db:migrate

trigger_once() {
  local strategy="us_default"
  if [[ "${AUTO_TRIGGER_SCOPE}" == "KR" ]]; then
    strategy="kr_default"
  elif [[ "${AUTO_TRIGGER_SCOPE}" == "ALL" ]]; then
    strategy="all_default"
  fi
  curl -fsS -X POST "http://127.0.0.1:${PORT}/api/agent/trigger" \
    -H "x-api-token: ${API_TOKEN}" \
    -H "content-type: application/json" \
    -d "{\"marketScope\":\"${AUTO_TRIGGER_SCOPE}\",\"strategyKey\":\"${strategy}\"}" >/dev/null
}

trigger_loop() {
  until curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null; do
    sleep 1
  done

  echo "[dev:active] server is ready; triggering pipeline once"
  trigger_once || true

  while true; do
    sleep "${INTERVAL}"
    echo "[dev:active] periodic trigger"
    trigger_once || true
  done
}

trigger_loop &
TRIGGER_PID=$!

cleanup() {
  kill "${TRIGGER_PID}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

echo "[dev:active] running on http://localhost:${PORT}"
echo "[dev:active] auto trigger interval: ${INTERVAL}s"
echo "[dev:active] auto trigger scope: ${AUTO_TRIGGER_SCOPE}"
npm run dev:3333:all
