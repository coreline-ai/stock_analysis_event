#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for db:down"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  docker compose down
else
  docker-compose down
fi

echo "db=down"
