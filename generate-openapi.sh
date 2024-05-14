#!/bin/sh

set -eux

curl --fail -o ./frontend/openapi.json http://localhost:8080/api/spec.json

if [ -x docker-compose ]; then
    docker-compose exec -u node -w /app frontend npm run openapi
else
    docker compose exec -u node -w /app frontend npm run openapi
fi
