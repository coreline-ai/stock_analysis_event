#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3333}"
PID_FILE="${PID_FILE:-/tmp/mahoraga-dev.pid}"
LOG_FILE="${LOG_FILE:-/tmp/mahoraga-dev.log}"
AGENT_LABEL="${AGENT_LABEL:-com.stock_analysis_event.dev}"

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

if [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1; then
  uid="$(id -u)"
  if launchctl print "gui/${uid}/${AGENT_LABEL}" >/tmp/mahoraga-launchctl-status.txt 2>/dev/null; then
    launch_pid="$(grep -m 1 'pid = ' /tmp/mahoraga-launchctl-status.txt | sed -E 's/.*pid = ([0-9]+).*/\1/' || true)"
    if [[ -n "${launch_pid}" ]]; then
      echo "launch_agent=${AGENT_LABEL} (running pid=${launch_pid})"
    else
      echo "launch_agent=${AGENT_LABEL} (loaded)"
    fi
  else
    echo "launch_agent=${AGENT_LABEL} (not loaded)"
  fi
fi

if [[ -f "${LOG_FILE}" ]]; then
  echo "log_tail:"
  tail -n 40 "${LOG_FILE}" || true
else
  echo "log_tail: (missing ${LOG_FILE})"
fi
