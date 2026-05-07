# Public Beta Deployment

This deployment path is for one public beta Node server. It is intentionally not a multi-instance architecture.

## Server Model

- One Node process serves the static client, API routes, WebSocket gameplay, rooms, and JSON account storage.
- Put the process behind HTTPS on a Node/WebSocket-capable host.
- For a quick Free public beta, omit `ACCOUNT_STORE_PATH` and let the server use the repo-local JSON file.
- For persistent accounts, attach a persistent volume and set `ACCOUNT_STORE_PATH` to a file on that volume.
- Do not run multiple processes against the same JSON file.

## Render Blueprint

This repo includes `render.yaml` for a Render Blueprint deploy. It creates one Free Node web service in the `singapore` region without a persistent disk. This is enough to let players join the game, but account JSON can reset when the Free instance restarts. For persistent accounts, upgrade the instance, attach a disk at `/data`, and set `ACCOUNT_STORE_PATH=/data/accounts.json`.

Render automatically provides `RENDER_EXTERNAL_URL`; the server uses it as the allowed public origin when `PUBLIC_BASE_URL` / `ALLOWED_ORIGINS` are not set manually.

## Required Production Environment

```bash
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://your-domain.example
ALLOWED_ORIGINS=https://your-domain.example
TRUST_PROXY=1
DEBUG_ENDPOINTS=false
```

Only add this on a paid instance with a persistent disk mounted at `/data`:

```txt
ACCOUNT_STORE_PATH=/data/accounts.json
```

Useful safety tuning:

```bash
SESSION_COOKIE_SECURE=auto
MAX_WS_CLIENTS=160
WS_HEARTBEAT_MS=25000
WS_HEARTBEAT_TIMEOUT_MS=10000
WS_MESSAGE_RATE_LIMIT=90
ACCOUNT_BACKUP_INTERVAL_MS=21600000
ACCOUNT_BACKUP_MAX_FILES=12
SHUTDOWN_GRACE_MS=8000
```

## Verification

1. Start with the production env above.
2. Open `/healthz`; expect `200` and no account/session secrets.
3. Open `/readyz`; expect `200` after boot.
4. Open the game page over HTTPS.
5. Register/login, quickplay, move/fire, then refresh and confirm the session persists during the current deploy.
6. If using a persistent disk, restart the server and confirm the account file remains at `ACCOUNT_STORE_PATH`.
7. If using a persistent disk, check the sibling `.backups` directory after the backup interval or after running backup tests.

## Rollback

- Stop the Node process.
- Restore the previous account JSON from the persistent volume or a `.bak` file if persistent storage is enabled.
- Revert env changes, especially `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, and `ACCOUNT_STORE_PATH`.
- Start one Node process again and verify `/readyz`.

## Known Limits

- JSON storage is acceptable for a first public beta, not for multi-instance scaling.
- Login rate limiting is process-local.
- Room state is process-local.
- Real scale-out should replace JSON storage with SQLite/Postgres and move room/session coordination out of process.
