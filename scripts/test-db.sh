#!/usr/bin/env bash
# Runs the Supabase migrations and behaviour tests against a throwaway local Postgres.
# Needs Postgres binaries (initdb, pg_ctl, psql) on PATH or under /usr/lib/postgresql/*/bin.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
export PATH="${PGBIN:+$PGBIN:}$PATH"
TMP=$(mktemp -d)
PORT=${PGPORT_TEST:-54329}
trap 'pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$TMP"; RUN=(runuser -u postgres --)
else
  RUN=()
fi
"${RUN[@]}" initdb -D "$TMP/data" -U postgres --auth=trust >/dev/null
"${RUN[@]}" pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null
PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/tests/10_behaviour_test.sql
