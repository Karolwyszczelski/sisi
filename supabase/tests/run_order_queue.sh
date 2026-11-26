#!/bin/sh
# Runs queue acceptance tests on a private Unix socket. Optional: PG_BINDIR.
set -eu
cd "$(dirname "$0")/../.."
pg_bin=${PG_BINDIR:-$(pg_config --bindir)}
tmp=$(mktemp -d /tmp/sisi-queue-test.XXXXXX)
cleanup() {
  "$pg_bin/pg_ctl" -D "$tmp/data" -m fast stop >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT
export LC_ALL=C
"$pg_bin/initdb" -D "$tmp/data" -A trust --no-locale >/dev/null
"$pg_bin/pg_ctl" -D "$tmp/data" -o "-F -h '' -k $tmp" -l "$tmp/server.log" start
unset PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS PGUSER PGPORT PGDATABASE PGHOST
export PGHOST="$tmp" PGDATABASE=postgres
psql="$pg_bin/psql"
"$psql" -Xq -v ON_ERROR_STOP=1 \
  -f supabase/tests/fixtures/atomic_checkout_schema.sql \
  -f supabase/tests/fixtures/order_lifecycle_schema.sql \
  -f supabase/tests/fixtures/order_queue_schema.sql \
  -f supabase/migrations/create_order_settings_table.sql \
  -f supabase/migrations/20261126001000_restrict_order_availability.sql \
  -f supabase/migrations/20261126002000_atomic_checkout.sql \
  -f supabase/migrations/20261126003000_order_lifecycle.sql \
  -f supabase/migrations/20261126004000_order_queue.sql \
  -f supabase/tests/order_queue.sql

run() { "$psql" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $1"; }
order_id=d0000000-0000-4000-8000-000000000010
run "INSERT INTO public.orders (id,status,payment_method,payment_status,total_price)
 VALUES ('$order_id','placed','Online','pending',20);"
"$psql" -XAtq -v ON_ERROR_STOP=1 > "$tmp/first.out" <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.sisi_request_p24('$order_id');
SELECT id FROM public.sisi_claim_order_job('p24_register:$order_id');
\! touch '$tmp/first'
SELECT pg_sleep(1);
COMMIT;
SQL
worker=$!
i=0
while [ ! -f "$tmp/first" ]; do
  i=$((i+1))
  if [ "$i" -gt 50 ] || ! kill -0 "$worker" 2>/dev/null; then cat "$tmp/first.out"; exit 1; fi
  sleep .05
done
test "$(run "SELECT public.sisi_request_p24('$order_id')->>'outcome';")" = pending
test "$(run "SELECT count(*) FROM public.sisi_claim_order_job('p24_register:$order_id');")" = 0
wait "$worker"
test "$(run "SELECT count(*) FROM public.order_jobs WHERE job_key='p24_register:$order_id';")" = 1
echo 'Passed atomic job enqueue, retention of payload on retry, fencing, deduplication, and concurrent registration.'

"$psql" -Xq -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261126005000_pos_rollback_pause.sql \
  -f supabase/tests/pos_rollback_pause.sql
echo 'Passed POS rollback pause, continued P24, and exact resumption.'

# The pause transaction wins even if a stale worker already reached the SQL gate.
run "INSERT INTO public.orders (id,status,payment_method,total_price)
 VALUES ('fa000000-0000-4000-8000-000000000010','placed','Gotówka',20);"
"$psql" -Xq -v ON_ERROR_STOP=1 -c "UPDATE public.pos_dispatch_control SET enabled=true;"
"$psql" -XAtq -v ON_ERROR_STOP=1 > "$tmp/pause.out" <<SQL &
BEGIN;
UPDATE public.pos_dispatch_control SET enabled=false;
\! touch '$tmp/pause'
SELECT pg_sleep(1);
COMMIT;
SQL
worker=$!
i=0
while [ ! -f "$tmp/pause" ]; do
  i=$((i+1))
  if [ "$i" -gt 50 ] || ! kill -0 "$worker" 2>/dev/null; then cat "$tmp/pause.out"; exit 1; fi
  sleep .05
done
test "$(run "SELECT public.sisi_begin_pos_dispatch('fa000000-0000-4000-8000-000000000010');")" = f
wait "$worker"
echo 'Passed concurrent pause against a stale POS worker.'
