#!/bin/sh

set -eu

curl --fail --silent --show-error "${OPENAPI_URL:-http://localhost:8080/api/spec.json}" |
    docker compose exec -T -w /app frontend npm run --silent openapi
