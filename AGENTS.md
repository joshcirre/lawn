## Agent info

Generally speaking, you should browse the codebase to figure out what is going on.

We have a few "philosophies" I want to make sure we honor throughout development:

### 1. Performance above all else

When in doubt, do the thing that makes the app feel the fastest to use.

This includes things like

- Optimistic updates
- Using the custom data loader patterns and custom link components with prewarm on hover
- Avoiding waterfalls in anything from js to file fetching

### 2. Good defaults

Users should expect things to behave well by default. Less config is best.

### 3. Convenience

We should not compromise on simplicity and good ux. We want to be pleasant to use with as little friction as possible. This means things like:

- All links are "share" links by default
- Getting from homepage to latest video should always be fewer than 4 clicks
- Minimize blocking states to let users get into app asap

### 4. Security

We want to make things convenient, but we don't want to be insecure. Be thoughtful about how things are implemented. Check team status and user status before committing changes. Be VERY thoughtful about endpoints exposed "publicly". Use auth and auth checks where they make sense to.

## Local development

`bun run dev` runs the app against a **local Convex deployment** that is unique
to this git worktree (anonymous mode, data in `./.convex`, no login, offline).
This lets multiple Conductor workspaces run in parallel without sharing one
cloud dev backend. The script (`scripts/dev.sh`) provisions the deployment on
first run via `scripts/convex-local-setup.sh`, which configures it and seeds its
env vars from `.env.local` (including `AUTH_ISSUER_URL`, the URL of the
Laravel auth API in `auth-api/`).

- `bun run dev` — Vite + local Convex (the default).
- `bun run dev:cloud` — Vite + the shared cloud dev deployment (old behavior).
- `bun run convex:local` — re-provision the local deployment (or delete
  `.convex/.seeded` and re-run `dev`).

Some deployment secrets live only in the Convex cloud dashboard and are **not**
in `.env.local`, so those features need extra setup to work locally — add the
values to `.env.convex.local` (git-ignored, auto-seeded):

- `RAILWAY_*` — S3-compatible storage (video file uploads)
- `MUX_*` — Mux encoding / playback

They are read at runtime, so the function push still succeeds without them.
External webhooks (Chunkify, Mux) can't reach a `127.0.0.1` backend
without a tunnel, so use `dev:cloud` (or a tunnel) when testing webhook flows.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
