# lawn

Lawn is a self-hosted video review platform for creative teams. Upload videos,
review versions, leave timestamped comments, and share work with a team or a
client. Originally built by Theo.

## What changed in this fork

- Replaced Clerk with a small Laravel auth API. People can sign in with a
  passkey or email and password. The API issues JWTs that Convex verifies.
- Removed subscriptions, storage quotas, and the billing flow. Accounts can
  create teams and upload without choosing a plan; the operator pays the
  infrastructure and video service costs.
- Replaced the hosted product's marketing and pricing pages with a simple
  homepage for the self-hosted app. The video review features remain: projects,
  version stacks, comments, and share links.
- Added Laravel Cloud deployments for the web app, self-hosted Convex, auth API,
  and Convex dashboard.

## Hosting on Laravel Cloud

Four Cloud applications deploy from this repository:

| Application      | Root directory      | Purpose                                                                                                       |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `lawn-frontend`  | `/`                 | Builds and serves the TanStack Start frontend as a single-page app; pushes Convex functions during its build. |
| `lawn`           | `convex-backend/`   | Runs the self-hosted Convex backend and HTTP actions, backed by Cloud MySQL and a private Cloud bucket.       |
| `lawn-api`       | `auth-api/`         | Laravel API for passkeys, email and password sign-in, and JWT issuance.                                       |
| `lawn-dashboard` | `convex-dashboard/` | Serves the self-hosted Convex admin dashboard and connects to the existing backend.                           |

Video uploads use a separate private Cloud bucket through the `RAILWAY_*` Convex
environment variables. Mux encodes and serves video; Convex creates Mux assets
and playback IDs and receives Mux webhooks. The Mux token, signing key, and
webhook secret are set in the **production Convex deployment** as `MUX_*`
environment variables. Current playback IDs are public; the configured signing
key is not yet used to restrict playback. Keep credentials in ignored local
files or the deployment's secret store; do not commit them.

Production endpoints: [Lawn](https://lawn-frontend-production-a0y7al.laravel.cloud),
[Convex dashboard](https://lawn-dashboard-production-sijoow.laravel.cloud),
[Convex backend](https://lawn-production-pkhb7d.laravel.cloud), and
[auth API](https://lawn-api-production-7njahc.laravel.cloud). The dashboard
prompts for the existing Convex admin key; its app environment contains only
the backend URL. The backend uses the `lawn` database in the attached Cloud
MySQL cluster. Cloud's private MySQL endpoint has a certificate Convex cannot
verify, so this connection runs without TLS within Cloud's private network.

The backend's one-minute Mux reconciliation cron makes public HTTP requests
that reset Cloud's idle timer. Hibernation is enabled for the backend, but it
does not currently scale to zero while that cron runs.

For the exact Cloud resources, environment variables, and deployment order,
see [Deployment](docs/deployment.md). For local development, see
[Setup](docs/setup.md).

## Why lawn exists

Lawn gives creative teams one place to review video versions, discuss exact
moments, and share feedback with clients. This fork lets a team run that
workflow on its own Laravel Cloud resources, with its own database and storage.
Sign-in is handled by the Lawn auth API, and there are no subscription plans or
per-seat limits in the app. The operator pays for Cloud resources and Mux usage.

## Docs

- [Local setup](docs/setup.md) — install dependencies, run Lawn locally, and
  configure development environment variables.
- [Laravel Cloud deployment](docs/deployment.md) — deploy the four applications,
  connect MySQL and storage, and set production Convex variables.
- [Auth API](auth-api/README.md) — passkey and password sign-in, JWTs, and API
  endpoints.
- [Convex backend](convex-backend/README.md) — build and run the self-hosted
  backend on Cloud, including database and networking notes.
- [Convex dashboard](convex-dashboard/README.md) — host the admin UI and connect
  it to the production backend.
- [Design philosophy](docs/philosophy.md) — visual style and component guidance.
