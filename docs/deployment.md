# Deployment

## Deploying to Vercel (with Convex)

This repo is configured so Vercel runs:

```bash
bun run build:vercel
```

`build:vercel` runs Convex deployment first, then runs the app build via Convex:

```bash
bunx convex deploy --cmd 'bun run build' --cmd-url-env-var-name VITE_CONVEX_URL
```

Required Vercel environment variable:

- `CONVEX_DEPLOY_KEY` (create a production deploy key in Convex and add it in Vercel project settings)

## Deploying to Laravel Cloud (with self-hosted Convex)

Four Cloud applications from this one repository (Cloud's monorepo support):

| App              | Root directory      | Runtime            | Build command         | Start command         |
| ---------------- | ------------------- | ------------------ | --------------------- | --------------------- |
| `lawn`           | `convex-backend/`   | Node 22 (lockfile) | `bash build.sh`       | `bash start.sh`       |
| `lawn-frontend`  | repo root           | Bun (`bun.lock`)   | `bun run build:cloud` | `bun run start:cloud` |
| `lawn-api`       | `auth-api/`         | PHP 8.5            | (Cloud default)       | (Cloud default)       |
| `lawn-dashboard` | `convex-dashboard/` | Node 22            | `npm run build`       | `npm run start`       |

Deploy `lawn` and `lawn-api` first; `lawn-frontend`'s build pushes the Convex
functions to `lawn`, whose auth config points at `lawn-api`.

### `lawn`: the Convex backend

`build.sh` downloads the prebuilt `convex-local-backend` binary (pin with
`CONVEX_BACKEND_VERSION`). `start.sh` runs it on `$PORT` and serves HTTP actions
from the same origin under `/http`. The container must stay stateless because
Cloud's disk is ephemeral:

- **Database:** attach Cloud Postgres (17) and name the database after
  `INSTANCE_NAME` with `-` replaced by `_` (`lawn` -> `lawn`). `start.sh` strips the
  database name from `DATABASE_URL` and refuses to boot on a mismatch.
- **Storage:** attach a private bucket as the default disk. All five Convex
  storage buckets share it unless `S3_STORAGE_*_BUCKET` overrides are set.
- **Instances:** exactly one replica, always on (not Flex scale-to-zero).
  Self-hosted Convex is single-node, holds WebSocket subscriptions in memory, and
  runs `convex/crons.ts`. 2 GB RAM or more. In this app, the one-minute Mux
  reconciliation cron invokes a Node action that makes three HTTP mutation
  requests through the public Convex origin on each run. Those inbound requests
  reset Laravel Cloud's scale-to-zero idle timer, so enabling hibernation does
  not currently make this app sleep. If the backend does sleep, its in-process
  Convex cron jobs cannot run until it wakes.

Environment variables:

- `INSTANCE_NAME`, `INSTANCE_SECRET` (`openssl rand -hex 32`, never let it default)
- `CONVEX_CLOUD_ORIGIN`: this app's public URL, e.g. `https://convex.example.com`
- `DISABLE_BEACON=1`, `REDACT_LOGS_TO_CLIENT=1` (optional)

Generate the admin key from the same name and secret (any platform's release
binary works):

```bash
convex-local-backend keygen admin-key --instance-name "$INSTANCE_NAME" --instance-secret "$INSTANCE_SECRET"
```

### `lawn-dashboard`: Convex admin UI

The self-hosted dashboard is a **separate service**; `lawn` does not serve it.
The `convex-dashboard/` app downloads the application layers from the official
dashboard image pinned to the same Convex commit as `convex-backend/build.sh`.
It verifies the layer hashes, extracts the standalone Next.js app, and serves it
on Cloud's `$PORT`. It has no database or bucket of its own. Set
`NEXT_PUBLIC_DEPLOYMENT_URL=https://lawn-production-pkhb7d.laravel.cloud` on
this Cloud app. Visit its public URL and enter the existing Convex admin key
from the git-ignored `.env.cloud.local` when prompted. Do not set the admin key
as a `NEXT_PUBLIC_*` variable or expose it in the Cloud app's environment.

For temporary local access instead, run the matching official dashboard image
on a machine with Docker:

```bash
docker run --rm -p 6791:6791 \
  -e NEXT_PUBLIC_DEPLOYMENT_URL=https://lawn-production-pkhb7d.laravel.cloud \
  ghcr.io/get-convex/convex-dashboard:27ef2346e0fea1f7e9fbfe7bfae895164c89dbec
```

Open `http://localhost:6791` and enter the existing Convex admin key from the
git-ignored `.env.cloud.local` file. Both dashboard options read and write the
**existing production Convex deployment**; neither needs a database migration.

### `lawn-frontend`: the SPA

`build:cloud` is `build:vercel` with `-y`; the Convex CLI switches to self-hosted
mode when these are set, and injects `VITE_CONVEX_URL` from the backend:

- `CONVEX_SELF_HOSTED_URL`: `lawn`'s public URL (do not also set `CONVEX_DEPLOY_KEY`)
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `VITE_AUTH_URL`: `lawn-api`'s public URL

`start:cloud` serves `dist/client` with the same fallback routing as `vercel.json`.

### `lawn-api`: sign-in (passkeys + passwords)

A small Laravel app in `auth-api/` replaces Clerk. It signs RS256 JWTs that
Convex verifies against its `/.well-known/jwks.json`. Setup, env vars and the
API are in [`auth-api/README.md`](../auth-api/README.md).

### Convex deployment env

Backend secrets live in the Convex deployment, not in Cloud. Set them once
before the first `lawn-web` deploy (the push fails without `AUTH_ISSUER_URL`):

```bash
export CONVEX_SELF_HOSTED_URL=https://convex.example.com CONVEX_SELF_HOSTED_ADMIN_KEY='lawn|...'
bunx convex env set --from-file .env.convex.production
```

Use the same keys as `convex/.env.example` (`AUTH_ISSUER_URL`
(`lawn-api`'s public URL), `MUX_*`, `RAILWAY_*`, `CHUNKIFY_*`). There is no
billing: every account can create teams and upload.

`RAILWAY_*` configures lawn's S3 client for video uploads. Use a **separate
private Cloud bucket** from the one attached to `lawn` for Convex's own
storage. Lawn gives browsers signed upload URLs and Mux a 24-hour signed object
URL for ingest, so the bucket does not need public read access. Set
`RAILWAY_ENDPOINT`, `RAILWAY_ACCESS_KEY_ID`, `RAILWAY_SECRET_ACCESS_KEY`, and
`RAILWAY_BUCKET_NAME` in Convex. Configure bucket CORS for the web app's origin
so browsers can upload directly.

In the Mux **Production** environment, create a Video access token with Read
and Write permission, a signing key, and a webhook to
`https://convex.example.com/http/webhooks/mux`. Set `MUX_TOKEN_ID`,
`MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY` (key ID), `MUX_PRIVATE_KEY` (base64 private
key), and `MUX_WEBHOOK_SECRET` in the production Convex deployment. Keep these
values out of version control. The current playback path creates public Mux
playback IDs; it does not yet use the signing key for access-controlled playback.
