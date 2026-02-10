#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3333}"
PID_FILE="${PID_FILE:-/tmp/mahoraga-dev.pid}"

if [[ -f "${PID_FILE}" ]]; then
  pid="$(cat "${PID_FILE}")"
  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    # Give it a moment to stop cleanly, then force kill if needed.
    for _ in 1 2 3 4 5; do
      if ! kill -0 "${pid}" >/dev/null 2>&1; then break; fi
      sleep 0.2
    done
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${PID_FILE}"
fi

# Best-effort: kill anything still listening on the port.
listen_pids="$(lsof -t -nP -iTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${listen_pids}" ]]; then
  kill ${listen_pids} >/dev/null 2>&1 || true
fi

echo "Stopped (port=:${PORT})"
