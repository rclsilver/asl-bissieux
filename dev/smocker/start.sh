#!/bin/sh
set -eu

# Smocker 1.0 loads mocks through its admin API. Initialize on every restart.
/opt/smocker &
smocker_pid=$!
trap 'kill -TERM "$smocker_pid" 2>/dev/null || true; wait "$smocker_pid" || true' EXIT
trap 'exit 0' INT TERM

attempt=0
until wget -q -O /dev/null http://127.0.0.1:8181/version; do
  kill -0 "$smocker_pid"
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || exit 1
  sleep 1
done

fixture_url=${OVH_FIXTURE_URL:-http://ovh-fixture:8182}
case "$fixture_url" in
  http://ovh-fixture:8182|http://127.0.0.1:8182) ;;
  *) echo 'Unsupported development fixture URL' >&2; exit 1 ;;
esac
mocks=$(sed "s|OVH_FIXTURE_URL|$fixture_url|g" /etc/smocker/ovh.json)
wget -q -O /dev/null --header='Content-Type: application/json' --post-data="$mocks" http://127.0.0.1:8181/mocks
wait "$smocker_pid"
