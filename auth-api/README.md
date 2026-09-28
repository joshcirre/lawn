# Lawn Auth

A small Laravel 13 API that replaces Clerk for lawn. Users sign up and sign in
with a **passkey** (primary) or **email + password**, and the API issues
short-lived **RS256 JWTs** that Convex verifies through its `customJwt`
provider.

- Passkeys use the official [`laravel/passkeys`](https://github.com/laravel/passkeys-server)
  actions, driven statelessly (see "Why not the package routes?").
- Access tokens last 15 minutes. Refresh tokens are opaque, stored hashed, and
  rotate on every use; replaying a rotated token revokes that whole sign-in.
- No email verification: invites are protected by their secret link, and the
  JWT does not claim `email_verified`.

## API

All endpoints are JSON under `/api`. Token responses look like
`{ accessToken, refreshToken, expiresIn, user: { id, name, email, hasPassword, passkeyCount } }`.

| Method | Path                         | Auth   | Body                                               |
| ------ | ---------------------------- | ------ | -------------------------------------------------- |
| POST   | `/register`                  | –      | `name, email, password` → tokens                   |
| POST   | `/login`                     | –      | `email, password` → tokens                         |
| POST   | `/passkeys/register/options` | –      | `name, email` → `{ ceremony, options }`            |
| POST   | `/passkeys/register`         | –      | `ceremony, credential` → tokens (creates the user) |
| POST   | `/passkeys/login/options`    | –      | → `{ ceremony, options }` (any discoverable key)   |
| POST   | `/passkeys/login`            | –      | `ceremony, credential` → tokens                    |
| POST   | `/token/refresh`             | –      | `refresh_token` → tokens, or 401                   |
| POST   | `/logout`                    | –      | `refresh_token` → 204                              |
| GET    | `/me`                        | Bearer | → `{ user }`                                       |
| PUT    | `/password`                  | Bearer | `password` (+ `current_password` if one is set)    |
| POST   | `/passkeys/options`          | Bearer | → `{ ceremony, options }` to add a passkey         |
| POST   | `/passkeys`                  | Bearer | `ceremony, credential` → `{ passkey, user }`       |

`GET /.well-known/jwks.json` publishes the signing key for Convex.

`options` is standard WebAuthn JSON: pass it to
`PublicKeyCredential.parseCreationOptionsFromJSON()` /
`parseRequestOptionsFromJSON()` and send back `credential.toJSON()`. The
frontend client is `src/lib/auth.tsx` in the lawn repo.

### Why not the package routes?

`laravel/passkeys` keeps the WebAuthn challenge in the web session. Lawn's
frontend is on a different site (`*.laravel.cloud` subdomains don't share
cookies), so `App\Auth\PasskeyCeremony` caches the options under a random,
single-use `ceremony` id instead, and `PasskeyController` calls the package's
actions directly. Passkeys are bound to the **frontend's** host
(`PASSKEYS_RP_ID`, default: the host of the first `FRONTEND_URL`).

## Local development

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:keygen >> .env      # appends JWT_PRIVATE_KEY=...
php artisan migrate
php artisan serve                   # http://localhost:8000
php artisan test
```

In lawn's `.env.local`: `VITE_AUTH_URL=http://localhost:8000` and
`AUTH_ISSUER_URL=http://localhost:8000` (seeded into Convex).

## Deploying to Laravel Cloud

1. New application from the repo, **root directory** `auth-api/`, PHP 8.5.
   Smallest size is plenty; hibernation is fine.
2. Database: in the existing Postgres cluster, create a database named `auth`
   and attach it.
3. Deploy commands: `php artisan migrate --force`.
4. Environment variables:

   | Key                           | Value                                                         |
   | ----------------------------- | ------------------------------------------------------------- |
   | `APP_KEY`                     | `php artisan key:generate --show`                             |
   | `APP_URL`                     | this app's URL; it is the JWT issuer                          |
   | `JWT_PRIVATE_KEY`             | `php artisan jwt:keygen` (value after the `=`)                |
   | `FRONTEND_URL`                | lawn frontend URL, e.g. `https://lawn.example.com`            |
   | `PASSKEYS_USER_HANDLE_SECRET` | `openssl rand -hex 32` (so rotating `APP_KEY` keeps passkeys) |
   | `SESSION_DRIVER`              | `array`                                                       |
   | `CACHE_STORE`                 | `database` (passkey ceremonies must survive across requests)  |

5. In Convex: `npx convex env set AUTH_ISSUER_URL <this app's URL>` and redeploy
   functions. In the lawn frontend app: `VITE_AUTH_URL=<this app's URL>`.

Changing `FRONTEND_URL`'s host later invalidates existing passkeys (they are
bound to it). Pick the final frontend domain before real users sign up.
