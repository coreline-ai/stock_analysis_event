#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for db:up"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  docker compose up -d db
else
  docker-compose up -d db
fi

echo "db=up"
