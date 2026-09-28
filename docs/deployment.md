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

Two Cloud applications from this one repository (Cloud's monorepo support):

| App           | Root directory    | Runtime            | Build command         | Start command         |
| ------------- | ----------------- | ------------------ | --------------------- | --------------------- |
| `lawn-convex` | `convex-backend/` | Node 22 (lockfile) | `bash build.sh`       | `bash start.sh`       |
| `lawn-web`    | repo root         | Bun (`bun.lock`)   | `bun run build:cloud` | `bun run start:cloud` |

Deploy `lawn-convex` first; `lawn-web`'s build pushes the Convex functions to it.

### `lawn-convex`: the Convex backend

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
  runs `convex/crons.ts`. 2 GB RAM or more.

Environment variables:

- `INSTANCE_NAME`, `INSTANCE_SECRET` (`openssl rand -hex 32`, never let it default)
- `CONVEX_CLOUD_ORIGIN`: this app's public URL, e.g. `https://convex.example.com`
- `DISABLE_BEACON=1`, `REDACT_LOGS_TO_CLIENT=1` (optional)

Generate the admin key from the same name and secret (any platform's release
binary works):

```bash
convex-local-backend keygen admin-key --instance-name "$INSTANCE_NAME" --instance-secret "$INSTANCE_SECRET"
```

### `lawn-web`: the SPA

`build:cloud` is `build:vercel` with `-y`; the Convex CLI switches to self-hosted
mode when these are set, and injects `VITE_CONVEX_URL` from the backend:

- `CONVEX_SELF_HOSTED_URL`: `lawn-convex`'s public URL (do not also set `CONVEX_DEPLOY_KEY`)
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`

`start:cloud` serves `dist/client` with the same fallback routing as `vercel.json`.

### Convex deployment env

Backend secrets live in the Convex deployment, not in Cloud. Set them once
before the first `lawn-web` deploy (the push fails without the Stripe and Clerk
values):

```bash
export CONVEX_SELF_HOSTED_URL=https://convex.example.com CONVEX_SELF_HOSTED_ADMIN_KEY='lawn|...'
bunx convex env set --from-file .env.convex.production
```

Use the same keys as `.env.example` (`STRIPE_*`, `CLERK_SECRET_KEY`,
`CLERK_JWT_ISSUER_DOMAIN`, `MUX_*`, `RAILWAY_*`, `AUTUMN_SECRET_KEY`,
`CHUNKIFY_*`). `RAILWAY_*` is lawn's own S3 client for video uploads and can
point at a second, public Cloud bucket. Stripe and Mux webhooks go to
`https://convex.example.com/http/...`.
