# Private Messenger

A self-hosted, invite-only, end-to-end-encrypted group chat for a closed
group of ~50 people — Signal-equivalent privacy guarantees, but you run
the server instead of trusting a third party's.

## Why Matrix instead of a custom app

Signal's actual security property is the Double Ratchet protocol (X3DH key
agreement + per-message forward secrecy). Re-implementing that from
scratch is a multi-month cryptography effort with real risk of a subtle
bug silently breaking confidentiality. This deployment instead uses
[Matrix](https://matrix.org) / [Synapse](https://github.com/element-hq/synapse),
whose Olm/Megolm encryption is the same ratchet family, audited, and
battle-tested — you get the crypto for free and only own the deployment.

## Architecture

```
                         ┌─────────────┐
  people ──HTTPS──▶ Caddy │ TLS + proxy │
                         └──────┬──────┘
                    ┌───────────┼────────────┐
                    ▼                        ▼
            ┌───────────────┐        ┌──────────────┐
            │ Element Web    │        │ Synapse       │──▶ Postgres
            │ (chat client)  │        │ (homeserver)  │
            └───────────────┘        └──────┬───────┘
                                              │
                                       ┌──────┴──────┐
                                       │ coturn       │  (voice/video
                                       │ (TURN relay) │   NAT traversal)
                                       └─────────────┘
```

- **Federation is disabled** (`federation_domain_whitelist: []`) — this
  server never talks to any other Matrix homeserver. It's an island, not
  part of the public Matrix network.
- **Registration is disabled** — the only way to get an account is an
  admin running `scripts/create-user.sh`. No sign-up page, no invite
  links to strangers.
- **Every room is private/invite-only by convention** — Matrix's E2EE
  (Olm/Megolm) applies to any room marked encrypted, which private rooms
  are by default in Element.

## Quick start

Prerequisites: a Linux server (2 GB RAM is plenty for 50 users) with
Docker + Docker Compose, a domain name pointed at it, and ports 80/443
(HTTPS) plus 3478/49152-49172 UDP (TURN) open.

```
cp .env.example .env
$EDITOR .env                 # fill in DOMAIN, secrets (see comments in the file)
./scripts/setup.sh           # renders configs from .env into the *_/data dirs

docker compose up -d db
docker compose up -d synapse # first boot generates the server's signing key
docker compose up -d         # bring up element, caddy, coturn

./scripts/create-user.sh alice --admin   # first account, made admin
./scripts/create-user.sh bob
# ... repeat for everyone
```

Then visit `https://<your domain>` — that's Element Web, ready to log in.

See [docs/clients.md](docs/clients.md) for mobile/desktop apps and
verifying encryption, and [docs/operations.md](docs/operations.md) for
backups, updates, and removing people later.

## What this does *not* do

- No SMS/phone-number based identity like Signal — accounts are
  username/password, created by an admin. That's a feature here: no
  third party (a phone carrier, Signal's own servers) is in the trust
  path at all.
- No disappearing-by-default messages — Matrix supports per-room message
  retention policies if you want that; not configured here, see Synapse's
  retention docs if you want it.
- No mobile push via a company-run push gateway by default in this
  config — Element's default push (via Google/Apple + a sygnal relay)
  is not wired up. Calls and messages work fine; push notifications when
  the app is backgrounded need extra setup (see Synapse docs on
  `push` / running your own `sygnal` if you want to avoid Google/Apple
  entirely, or leave the default which is what most self-hosters do).
