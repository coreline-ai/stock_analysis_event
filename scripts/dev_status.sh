#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3333}"
PID_FILE="${PID_FILE:-/tmp/mahoraga-dev.pid}"
LOG_FILE="${LOG_FILE:-/tmp/mahoraga-dev.log}"

echo "port=${PORT}"

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "listening=yes"
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN || true
else
  echo "listening=no"
fi

if [[ -f "${PID_FILE}" ]]; then
  pid="$(cat "${PID_FILE}")"
  if kill -0 "${pid}" >/dev/null 2>&1; then
    echo "supervisor_pid=${pid} (running)"
  else
    echo "supervisor_pid=${pid} (stale)"
  fi
else
  echo "supervisor_pid=(none)"
fi

if [[ -f "${LOG_FILE}" ]]; then
  echo "log_tail:"
  tail -n 40 "${LOG_FILE}" || true
else
  echo "log_tail: (missing ${LOG_FILE})"
fi
