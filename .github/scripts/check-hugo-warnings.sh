#!/usr/bin/env bash
# Fails when a Hugo build log contains warnings that are not listed in
# .github/hugo-known-warnings.txt.
set -euo pipefail

log_file=${1:?usage: check-hugo-warnings.sh <hugo-build.log>}
allowlist=${2:-"$(dirname "$0")/../hugo-known-warnings.txt"}

[ -f "$log_file" ] || { echo "No such log file: $log_file" >&2; exit 1; }
[ -f "$allowlist" ] || { echo "No such allowlist: $allowlist" >&2; exit 1; }

warnings=$(grep -E '^WARN' "$log_file" || true)
if [ -z "$warnings" ]; then
  echo "No Hugo warnings at all."
  exit 0
fi

patterns=$(grep -vE '^[[:space:]]*(#|$)' "$allowlist" || true)
if [ -z "$patterns" ]; then
  unexpected=$warnings
else
  unexpected=$(printf '%s\n' "$warnings" | grep -vF "$patterns" || true)

  # Point out allowlist entries that no longer occur, without failing the build.
  while IFS= read -r pattern; do
    if ! printf '%s\n' "$warnings" | grep -qF "$pattern"; then
      echo "Note: known warning no longer occurs, drop it from the allowlist: $pattern"
    fi
  done <<<"$patterns"
fi

if [ -n "$unexpected" ]; then
  echo
  echo "New Hugo warning(s):"
  printf '%s\n' "$unexpected"
  echo
  echo "Fix them, or add the message to $(basename "$allowlist") if it is acceptable."
  exit 1
fi

echo "Only known Hugo warnings occurred."
