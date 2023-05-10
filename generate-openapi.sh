#!/bin/sh

set -eux

curl --fail -o ./frontend/openapi.json http://localhost:8080/api/spec.json

docker-compose exec -u node -w /app frontend npm run openapi
