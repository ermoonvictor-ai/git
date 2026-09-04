#!/usr/bin/env bash
# Creates one Matrix account on the running server. Since registration is
# disabled server-wide, this is the only way to add someone — invite links
# don't exist here, you create the account and hand them the password.
#
# Usage: ./scripts/create-user.sh <username> [--admin]
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <username> [--admin]" >&2
  exit 1
fi

username="$1"
admin_flag="--no-admin"
if [[ "${2:-}" == "--admin" ]]; then
  admin_flag="--admin"
fi

docker compose exec synapse register_new_matrix_user \
  -u "$username" \
  -c /data/homeserver.yaml \
  "$admin_flag" \
  http://localhost:8008
