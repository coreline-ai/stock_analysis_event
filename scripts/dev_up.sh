#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3333}"

PID_FILE="${PID_FILE:-/tmp/mahoraga-dev.pid}"
LOG_FILE="${LOG_FILE:-/tmp/mahoraga-dev.log}"

is_listening() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

supervisor_running() {
  [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" >/dev/null 2>&1
}

if is_listening; then
  echo "Already listening on :${PORT}"
  exit 0
fi

if supervisor_running; then
  echo "Supervisor is running (pid=$(cat "${PID_FILE}")) but :${PORT} is not listening yet."
  echo "Tail logs: tail -f ${LOG_FILE}"
  exit 0
fi

mkdir -p "$(dirname "${LOG_FILE}")" || true

# Start a tiny supervisor that restarts Next dev if it crashes.
nohup bash -lc "
  set -euo pipefail
  cd '${ROOT_DIR}'
  export NEXT_TELEMETRY_DISABLED=1
  export PORT='${PORT}'
  export LLM_PROVIDER=\"\${LLM_PROVIDER:-stub}\"
  export LOCK_MODE=\"\${LOCK_MODE:-memory}\"

  now() { date -u \"+%Y-%m-%dT%H:%M:%SZ\"; }

  echo \"[supervisor] starting on port ${PORT} at \$(now)\"
  while true; do
    echo \"[supervisor] launching next dev at \$(now)\"
    npm run -s dev:3333:all
    code=\$?
    echo \"[supervisor] next dev exited with code=\${code} at \$(now); restarting in 1s\"
    sleep 1
  done
" >"${LOG_FILE}" 2>&1 &

echo $! >"${PID_FILE}"

echo "Started supervisor pid=$(cat "${PID_FILE}")"
echo "Logs: ${LOG_FILE}"
