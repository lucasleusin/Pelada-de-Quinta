#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${ENV_FILE:-deploy/pelada.env}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.pelada.yml}"
SERVICE_NAME="${SERVICE_NAME:-pelada-app}"
APP_URL="${APP_URL:-https://pelada.losportsconsulting.com}"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build "$SERVICE_NAME"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" npx prisma migrate deploy
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if command -v curl >/dev/null 2>&1; then
  curl --fail --silent --show-error --head "$APP_URL" >/dev/null
fi
