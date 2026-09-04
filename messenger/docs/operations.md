# Operations

## Adding / removing people

- Add: `./scripts/create-user.sh <username>` (prompts for a password). Give
  the username + password to the person out of band (not over this same
  server, obviously, since they don't have an account yet).
- Remove: deactivate rather than delete, so their message history in shared
  rooms stays intact for everyone else:
  ```
  docker compose exec synapse register_new_matrix_user  # not this one
  curl -s -XPOST -H "Authorization: Bearer <admin-access-token>" \
    "http://localhost:8008/_synapse/admin/v1/deactivate/@username:${SERVER_NAME}" \
    -d '{"erase": false}'
  ```
  Get an admin access token by logging in as a user created with
  `--admin`, e.g. via Element's own login, then reading it from
  Element → Settings → Help & About → Access Token.

## Backups

Everything that matters lives in two places:
- `db_data` docker volume (Postgres — all messages, rooms, account data).
- `synapse/data/media_store` (uploaded files/images) and
  `synapse/data/<server_name>.signing.key` (the server's identity key —
  losing this breaks every existing room signature).

Minimum viable backup:
```
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
tar czf media-$(date +%F).tar.gz synapse/data/media_store synapse/data/*.signing.key
```
Run both on a schedule (cron) and copy the results off-box.

## Updating

```
docker compose pull
docker compose up -d
```
Synapse's release notes occasionally call out a required config change —
skim them before pulling a new major version.

## Monitoring disk usage

Media storage is the main thing that grows unbounded. Check with:
```
du -sh synapse/data/media_store
```
Synapse has a built-in media retention/purge admin API if this becomes an
issue — see Synapse's `admin_api/media_admin_api.md` in its own docs.
