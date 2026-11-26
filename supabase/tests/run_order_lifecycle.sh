#!/bin/sh
# Starts and destroys its own isolated PostgreSQL cluster. Optional: PG_BINDIR.
set -eu
cd "$(dirname "$0")/../.."
pg_bin=${PG_BINDIR:-$(pg_config --bindir)}
tmp=$(mktemp -d /tmp/sisi-lifecycle-test.XXXXXX)
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
  -f supabase/migrations/create_order_settings_table.sql \
  -f supabase/migrations/20261126001000_restrict_order_availability.sql \
  -f supabase/migrations/20261126002000_atomic_checkout.sql \
  -f supabase/migrations/20261126003000_order_lifecycle.sql \
  -f supabase/tests/order_lifecycle.sql

run() { "$psql" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $1"; }
start() {
  first_sql=$1
  marker=$2
  "$psql" -XAtq -v ON_ERROR_STOP=1 > "$tmp/$marker.out" <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
$first_sql
\! touch '$tmp/$marker'
SELECT pg_sleep(1);
COMMIT;
SQL
  worker=$!
  i=0
  while [ ! -f "$tmp/$marker" ]; do
    i=$((i+1))
    if [ "$i" -gt 50 ] || ! kill -0 "$worker" 2>/dev/null; then cat "$tmp/$marker.out"; return 1; fi
    sleep .05
  done
}
actor=b0000000-0000-4000-8000-000000000010
first=b0000000-0000-4000-8000-000000000020
second=b0000000-0000-4000-8000-000000000021
run "INSERT INTO public.orders (id,status,payment_method,payment_status,total_price,p24_session_id)
 VALUES ('$first','placed','Online','pending',20,'cancel-first'),('$second','placed','Online','pending',20,'callback-first');"

start "SELECT public.sisi_change_order('$first','{\"status\":\"cancelled\"}','$actor')->>'outcome';" cancel-first
test "$(run "SELECT public.sisi_confirm_p24_payment('cancel-first','50',2000)->>'outcome';")" = refund_pending
wait "$worker"
grep -qx ok "$tmp/cancel-first.out"
test "$(run "SELECT public.sisi_begin_pos_dispatch('$first');")" = f
test "$(run "SELECT public.sisi_confirm_p24_payment('cancel-first','50',2000)->>'outcome';")" = already_paid

start "SELECT public.sisi_confirm_p24_payment('callback-first','51',2000)->>'outcome';" callback-first
test "$(run "SELECT public.sisi_change_order('$second','{\"status\":\"cancelled\"}','$actor')->>'outcome';")" = ok
wait "$worker"
grep -qx paid "$tmp/callback-first.out"
test "$(run "SELECT public.sisi_begin_pos_dispatch('$second');")" = f
test "$(run "SELECT count(*) FROM public.order_followups WHERE kind='refund_p24' AND amount_grosze=2000;")" = 2
test "$(run "SELECT count(*) FROM public.orders WHERE status='cancelled' AND payment_status='paid';")" = 2
test "$(run "SELECT count(*) FROM public.order_state_events;")" = 4
echo 'Passed cancel-first and P24-first races. One refund task per order, no new POS dispatch.'
