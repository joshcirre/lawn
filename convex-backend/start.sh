#!/usr/bin/env bash
#
# Laravel Cloud start command for the self-hosted Convex backend.
#
# Maps Cloud's injected env (DATABASE_URL, AWS_* from an attached bucket, PORT)
# onto convex-local-backend flags. Modeled on the official Docker entrypoint:
# github.com/get-convex/convex-backend/blob/main/self-hosted/docker-build/run_backend.sh
#
# Cloud gives each app a single port, so HTTP actions (Stripe/Mux webhooks) are
# served from the same origin under /http instead of a second port.
#
# Required env:
#   INSTANCE_NAME        e.g. lawn. Postgres database must be named the same
#                        with "-" -> "_" (the admin key is derived from it too).
#   INSTANCE_SECRET      64 hex chars (openssl rand -hex 32). Never let it
#                        default: the disk is ephemeral.
#   CONVEX_CLOUD_ORIGIN  public URL of this app, e.g. https://convex.example.com
#                        (falls back to APP_URL).
#
set -euo pipefail
cd "$(dirname "$0")"

fail() {
  echo "start: $*" >&2
  exit 1
}

[ -n "${INSTANCE_NAME:-}" ] || fail "INSTANCE_NAME is required"
[ -n "${INSTANCE_SECRET:-}" ] || fail "INSTANCE_SECRET is required"
origin="${CONVEX_CLOUD_ORIGIN:-${APP_URL:-}}"
[ -n "$origin" ] || fail "CONVEX_CLOUD_ORIGIN (or APP_URL) is required"
origin="${origin%/}"
site="${CONVEX_SITE_ORIGIN:-$origin/http}"

port="${PORT:-3000}"
# Internal only; Cloud's proxy never routes to it.
site_port="${CONVEX_SITE_PROXY_PORT:-$((port + 1))}"

data_dir="${DATA_DIR:-/tmp/convex}"
export TMPDIR="${TMPDIR_OVERRIDE:-$data_dir/tmp}"
mkdir -p "$TMPDIR" "$data_dir/storage"

# --- persistence -------------------------------------------------------------
# Convex wants a server URL WITHOUT the database name or query params; it picks
# the database from INSTANCE_NAME. Cloud injects DATABASE_URL with both.
expected_db="${INSTANCE_NAME//-/_}"
# Cloud may inject Laravel-style DB_* vars instead of a URL; build one from them.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
  case "${DB_CONNECTION:-pgsql}" in
    pgsql | postgres | postgresql) db_scheme=postgres ;;
    mysql | mariadb) db_scheme=mysql ;;
    *) fail "unsupported DB_CONNECTION '${DB_CONNECTION}'" ;;
  esac
  db_user="$(node -p 'encodeURIComponent(process.env.DB_USERNAME ?? "")')"
  db_pass="$(node -p 'encodeURIComponent(process.env.DB_PASSWORD ?? "")')"
  DATABASE_URL="$db_scheme://$db_user:$db_pass@$DB_HOST${DB_PORT:+:$DB_PORT}/${DB_DATABASE:-}"
fi
db_flags=()
db_spec="$data_dir/db.sqlite3"
if [ -n "${POSTGRES_URL:-}" ]; then
  db_flags=(--db postgres-v5)
  db_spec="$POSTGRES_URL"
elif [ -n "${MYSQL_URL:-}" ]; then
  db_flags=(--db mysql-v5)
  db_spec="$MYSQL_URL"
elif [ -n "${DATABASE_URL:-}" ]; then
  scheme="${DATABASE_URL%%://*}"
  db_name="$(printf '%s' "$DATABASE_URL" | sed -E 's#^[a-z0-9+]+://[^/]+/?##; s#\?.*$##')"
  server="$(printf '%s' "$DATABASE_URL" | sed -E 's#^([a-z0-9+]+://[^/?]+).*#\1#')"
  if [ -n "$db_name" ] && [ "$db_name" != "$expected_db" ]; then
    fail "attached database is '$db_name' but INSTANCE_NAME=$INSTANCE_NAME expects '$expected_db'"
  fi
  case "$scheme" in
    postgres | postgresql) db_flags=(--db postgres-v5) ;;
    mysql) db_flags=(--db mysql-v5) ;;
    *) fail "unsupported DATABASE_URL scheme '$scheme'" ;;
  esac
  db_spec="$server"
else
  echo "start: WARNING no database attached; using SQLite on the ephemeral disk (data is lost on every deploy)." >&2
fi

# --- file storage ------------------------------------------------------------
# Cloud injects AWS_BUCKET / AWS_ENDPOINT_URL for the attached (R2) bucket.
# Convex wants five buckets; unless overridden they all share that bucket
# (Convex stores objects under generated keys, so they don't collide).
storage_flags=(--local-storage "$data_dir/storage")
if [ -n "${AWS_BUCKET:-}${S3_STORAGE_MODULES_BUCKET:-}" ]; then
  default_bucket="${AWS_BUCKET:-}"
  export S3_STORAGE_EXPORTS_BUCKET="${S3_STORAGE_EXPORTS_BUCKET:-$default_bucket}"
  export S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET="${S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET:-$default_bucket}"
  export S3_STORAGE_MODULES_BUCKET="${S3_STORAGE_MODULES_BUCKET:-$default_bucket}"
  export S3_STORAGE_FILES_BUCKET="${S3_STORAGE_FILES_BUCKET:-$default_bucket}"
  export S3_STORAGE_SEARCH_BUCKET="${S3_STORAGE_SEARCH_BUCKET:-$default_bucket}"
  export AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-auto}}"
  if [ -z "${S3_ENDPOINT_URL:-}" ]; then
    endpoint="${AWS_ENDPOINT_URL:-${AWS_ENDPOINT:-}}"
    [ -n "$endpoint" ] && export S3_ENDPOINT_URL="$endpoint"
  fi
  if [ -n "${S3_ENDPOINT_URL:-}" ]; then
    export AWS_S3_FORCE_PATH_STYLE="${AWS_S3_FORCE_PATH_STYLE:-true}"
  fi
  storage_flags=(--s3-storage)
else
  echo "start: WARNING no bucket attached; using local file storage on the ephemeral disk (deployed functions and uploads are lost on every deploy)." >&2
fi

node_version="$(node --version 2>/dev/null || true)"
case "$node_version" in
  v20.* | v22.* | v24.*) ;;
  *) echo "start: WARNING \"use node\" actions need node v20/v22/v24 on PATH (found '${node_version:-none}')." >&2 ;;
esac

echo "start: origin=$origin site=$site port=$port db=${db_flags[1]:-sqlite} storage=${storage_flags[0]}"

exec bin/convex-local-backend \
  --instance-name "$INSTANCE_NAME" \
  --instance-secret "$INSTANCE_SECRET" \
  --port "$port" \
  --site-proxy-port "$site_port" \
  --convex-origin "$origin" \
  --convex-site "$site" \
  ${DISABLE_BEACON:+--disable-beacon} \
  ${REDACT_LOGS_TO_CLIENT:+--redact-logs-to-client} \
  ${DO_NOT_REQUIRE_SSL:+--do-not-require-ssl} \
  ${db_flags[@]+"${db_flags[@]}"} \
  "${storage_flags[@]}" \
  "$db_spec"
