#!/usr/bin/env bash
# Prepare an archive locally; this script never uploads or deploys anything.
set -euo pipefail

if [[ $# != 2 || ! "$1" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  printf 'Usage: bash dev/package-chart.sh <application-version> <output-directory>\n' >&2
  exit 1
fi

app_version="$1"
chart_version="${app_version#v}"
destination="$2"
chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../chart" && pwd)"

mkdir -p "$destination"
helm package "$chart_dir" --version "$chart_version" --app-version "$app_version" --destination "$destination"
archive="$destination/asl-bissieux-${chart_version}.tgz"
helm lint --strict "$archive"
helm template release "$archive" > "$destination/rendered.yaml"
(
  cd "$destination"
  sha256sum "asl-bissieux-${chart_version}.tgz" > SHA256SUMS
)
