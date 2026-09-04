#!/usr/bin/env bash
# Renders the *.template config files (with values from .env substituted
# in) into the paths docker-compose.yml actually mounts. Re-run this any
# time you change .env or a *.template file.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example to .env and fill in real values first." >&2
  exit 1
fi

set -a
source .env
set +a

required_vars=(DOMAIN SERVER_NAME ACME_EMAIL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB \
  SYNAPSE_REGISTRATION_SHARED_SECRET TURN_SHARED_SECRET EXTERNAL_IP)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required variable in .env: $var" >&2
    exit 1
  fi
done

command -v envsubst >/dev/null || { echo "envsubst not found (install gettext)." >&2; exit 1; }

mkdir -p synapse/data element/data caddy/data coturn/data

envsubst < synapse/homeserver.yaml.template > synapse/data/homeserver.yaml
cp synapse/log.config synapse/data/log.config

envsubst < element/config.json.template > element/data/config.json

envsubst < caddy/Caddyfile.template > caddy/data/Caddyfile

envsubst < coturn/turnserver.conf.template > coturn/data/turnserver.conf

echo "Config rendered. Next steps:"
echo "  1. docker compose up -d db"
echo "  2. docker compose up -d synapse   # first boot creates the signing key"
echo "  3. docker compose up -d           # bring up element, caddy, coturn"
echo "  4. ./scripts/create-user.sh <username>   # add each of your ~50 people"
