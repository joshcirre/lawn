# Setup

## Development

Install dependencies:

```bash
bun install
```

Run app + Convex locally:

```bash
bun run dev
```

Run only the web app:

```bash
bun run dev:web
```

## Build / Run

```bash
bun run build
bun run start
```

## Quality checks

```bash
bun run typecheck
bun run lint
```

## Environment variables

Copy `.env.example` to `.env.local` and fill it in — it lists every variable,
grouped by section (convex, auth, mux, storage, chunkify).

- Root `.env.example` — local dev env (client `VITE_*` vars + secrets that
  `bun run dev` seeds into the local Convex deployment).
- `convex/.env.example` — the Convex **deployment** env vars to set in the
  dashboard or via `npx convex env set` for cloud/prod.
