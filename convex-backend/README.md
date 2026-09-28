# Self-hosted Convex on Laravel Cloud

This folder deploys the open-source Convex backend (`convex-local-backend`) as
its own Laravel Cloud application. It is self-contained: copy `convex-backend/`
into any Convex project, point a Cloud app at it, and follow the checklist below.

Verified working on 2026-09-28 with backend release
`precompiled-2026-09-26-27ef234` and `convex@1.41.0`: function push, Convex
components, `"use node"` actions, HTTP actions, and WebSocket sync.

Lawn now uses Cloud MySQL for Convex persistence. Use `DB_CONNECTION=mysql`
with Cloud's `DB_*` variables, or a `DATABASE_URL` beginning with `mysql://`.
When using those attached database variables, remove stale `POSTGRES_URL` and
`MYSQL_URL` overrides: they take precedence, with `POSTGRES_URL` checked first.
The startup script still supports Postgres for deployments that choose it.

## How it works

```
Cloudflare ─▶ nginx (Cloud, in-container) ─▶ proxy.mjs [::]:$PORT ─▶ convex-local-backend 127.0.0.1:$PORT+10
                                                                        ├─ MySQL (Cloud database)
                                                                        └─ S3 (Cloud bucket)
```

| File           | Role                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| `package.json` | Makes Cloud pick the **JavaScript/Node** runtime (needed for `"use node"` actions). |
| `build.sh`     | Downloads the prebuilt Rust binary for the build machine's arch; smoke-tests it.    |
| `start.sh`     | Maps Cloud's env onto backend flags, starts backend + proxy, exits if either dies.  |
| `proxy.mjs`    | Dual-stack TCP forwarder; restores the WebSocket upgrade headers nginx strips.      |

## Everything we had to work around

Each of these cost a failed deploy. Symptom → cause → fix.

1. **"Cloud detects it as JavaScript, not Rust."** Expected. Nothing is compiled;
   the Rust binary is downloaded. The Node runtime is _required_, because the
   backend spawns `node` for `"use node"` actions.

2. **`start: INSTANCE_NAME is required` crash loop.** Cloud env vars were never
   set. Set `INSTANCE_NAME`, `INSTANCE_SECRET` (`openssl rand -hex 32`, never let
   it default since the disk is ephemeral) and `CONVEX_CLOUD_ORIGIN`.

3. **Wrong database name.** If Cloud creates a database called
   `production`, Convex still needs a database named after `INSTANCE_NAME`
   (`-` → `_`). Create a database with that name in the same cluster
   (`cloud database:create <cluster> --name=<instance>`) and attach that one.
   `start.sh` refuses to boot on a mismatch rather than silently using another DB.

4. **Env var names.** Cloud may inject Laravel-style `DB_HOST`/`DB_DATABASE`/…
   and `AWS_ENDPOINT` instead of `DATABASE_URL`/`AWS_ENDPOINT_URL`. `start.sh`
   accepts both; otherwise the backend silently falls back to SQLite on the
   ephemeral disk (it logs a loud `WARNING` when that happens).

5. **MySQL TLS certificate fails with `UnknownIssuer`.** Laravel Cloud's
   private MySQL endpoint presented a ProxySQL-generated server certificate
   issued by `ProxySQL_Auto_Generated_CA_Certificate`, with no subject
   alternative name. Convex requires a verified certificate by default.
   Pointing `MYSQL_CA_FILE` at the system CA bundle did not help, and a
   hostname-valid certificate is not available from this endpoint. Set
   `DO_NOT_REQUIRE_SSL=1` for the attached Cloud MySQL database. This sends
   database traffic unencrypted inside Cloud's private network; it does not
   change HTTPS between clients and the Convex backend. Revisit this setting
   if Cloud provides a verifiable MySQL certificate. See
   [Laravel Cloud's MySQL connection docs](https://laravel.com/cloud/docs/resources/databases/laravel-mysql#laravel-mysql-ssl-connections).

6. **Historical Postgres-only issue: `TLS handshake: certificate not valid for name "…pg.laravel.cloud"`.** Cloud
   Postgres hostnames are CNAMEs to Neon, and the backend's Rust TLS client ends
   up with Neon's certificate (`*.c-N.REGION.aws.neon.tech`). `start.sh` rewrites
   `ep-x.c-N.aws-REGION.pg.laravel.cloud` → `ep-x.c-N.REGION.aws.neon.tech`, the
   same endpoint under the name the certificate covers. This workaround does not
   apply to the current MySQL setup.

7. **Healthy logs but "App unhealthy … state: crashing".** Cloud health-checks
   and routes over **IPv6**; the backend's `--interface` only accepts IPv4
   (`::` is rejected). The backend binds `127.0.0.1` and `proxy.mjs` listens on
   `[::]:$PORT` (dual-stack) in front of it. Side effect of the crash loop
   before this fix: restarted processes stole each other's Postgres lease
   (`Lease Lost`), which is a symptom, not a cause.

8. **WebSocket sync returns 400 `Connection header did not include upgrade`.**
   Cloud's in-container nginx strips the hop-by-hop `Upgrade` and `Connection`
   headers. `proxy.mjs` recognises the handshake by `Sec-WebSocket-Key`, puts
   both headers back, and once Convex answers `101` nginx tunnels the socket.
   Cloud's WebSockets resource (Reverb, Pusher protocol) is **not** a
   substitute: Convex's socket is its own query-sync protocol.

9. **Instance size.** `flex-512mb` gives ~256 MB of ephemeral disk (Cloud: 512 MB
   disk per 1 GB RAM); the binary alone is about that. Use `flex-2gb` or larger.

10. **One replica; current cron prevents sleep.** The backend is single-node
    (database lease), keeps subscriptions in memory and runs crons. Min = max =
    1 replica. Lawn's one-minute Mux cron makes public HTTP calls that reset
    Cloud's idle timer, so the enabled hibernation setting does not currently
    let this app scale to zero. If it did sleep, in-process crons would pause.

11. **Push-to-deploy is on by default.** Every push to the deploy branch
    redeploys, so don't also trigger manual deploys while iterating.

12. **Function push needs env first.** `convex deploy` evaluates modules at
    push time, so any module that reads env at import (e.g. a Stripe
    component's API key) fails the push until `convex env set` has run.

## Auth without Clerk (optional)

Convex's `customJwt` provider accepts any RS256 issuer with a JWKS URL, so a
small Laravel app on Cloud can replace Clerk. Lawn's is in
[`auth-api/`](../auth-api/README.md): passkeys (official `laravel/passkeys`)
plus email/password, 15-minute JWTs and rotating refresh tokens. Convex side:

```ts
// convex/auth.config.ts
{ type: "customJwt", applicationID: "convex", issuer: process.env.AUTH_ISSUER_URL,
  jwks: `${process.env.AUTH_ISSUER_URL}/.well-known/jwks.json`, algorithm: "RS256" }
```

Gotchas: the token's `iss` must equal `AUTH_ISSUER_URL` exactly (no trailing
slash, same host spelling, e.g. `localhost` vs `127.0.0.1`), and the auth config
is read at function-push time, so set `AUTH_ISSUER_URL` before `convex deploy`.

## Checklist for a new project

1. Copy this folder to `convex-backend/` in the repo; push to the deploy branch.
2. Cloud: new app from the repo, **root directory** `convex-backend/`,
   build `bash build.sh`, start `bash start.sh`, size `flex-2gb`, 1 replica.
3. Attach MySQL; create a database named after `INSTANCE_NAME`; attach it.
4. Attach a private bucket.
5. Env: `INSTANCE_NAME`, `INSTANCE_SECRET`, `CONVEX_CLOUD_ORIGIN=<app url>`,
   `DB_CONNECTION=mysql` when using `DB_*`, `DO_NOT_REQUIRE_SSL=1` for Cloud's
   private MySQL endpoint (see TLS limitation above), optionally
   `DISABLE_BEACON=1`, `REDACT_LOGS_TO_CLIENT=1`.
6. Deploy. Expect in logs: `db=mysql-v5 … storage=--s3-storage`,
   `proxy: [::]:3000 -> 127.0.0.1:3010`, `backend listening on 127.0.0.1:3010`.
7. Admin key (locally, any platform's release binary):
   `convex-local-backend keygen admin-key --instance-name $INSTANCE_NAME --instance-secret $INSTANCE_SECRET`
8. `export CONVEX_SELF_HOSTED_URL=<app url> CONVEX_SELF_HOSTED_ADMIN_KEY=<key>`,
   then `npx convex env set …` for app secrets, then `npx convex deploy`.
9. Verify: `curl <url>/version` → 200; a WebSocket to `wss://<host>/api/<ver>/sync`
   opens; HTTP actions answer under `<url>/http/…`.

## Prompt for an agent

> Deploy this project's Convex backend to Laravel Cloud as a self-hosted
> `convex-local-backend`. Copy the `convex-backend/` folder from
> github.com/joshcirre/lawn (build.sh, start.sh, proxy.mjs, package.json,
> package-lock.json, .gitignore) into this repo unchanged, then follow its
> README checklist with the `cloud` CLI: create the app with root directory
> `convex-backend/`, size flex-2gb, one replica, attach MySQL (database named
> after INSTANCE_NAME) and a private bucket, set INSTANCE_NAME / INSTANCE_SECRET
> / CONVEX_CLOUD_ORIGIN, DB_CONNECTION=mysql for DB_* credentials, and
> DO_NOT_REQUIRE_SSL=1 for Cloud's private MySQL endpoint; deploy, generate
> the admin key, set the Convex env
> vars, push functions, and verify /version, WebSocket sync and /http routes.
> Read the "Everything we had to work around" section before debugging.
