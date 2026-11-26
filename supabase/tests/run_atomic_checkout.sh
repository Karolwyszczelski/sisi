#!/bin/sh
# Starts its own throwaway PostgreSQL cluster. Requires initdb, pg_ctl and psql.
# Optional: PG_BINDIR=/path/to/postgresql/bin
set -eu

cd "$(dirname "$0")/../.."
pg_bin=${PG_BINDIR:-$(pg_config --bindir)}
tmp=$(mktemp -d /tmp/sisi-checkout-test.XXXXXX)
cleanup() {
  "$pg_bin/pg_ctl" -D "$tmp/data" -m fast stop >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT
export LC_ALL=C
"$pg_bin/initdb" -D "$tmp/data" -A trust --no-locale >/dev/null
"$pg_bin/pg_ctl" -D "$tmp/data" -o "-F -h '' -k $tmp" -l "$tmp/server.log" start
psql="$pg_bin/psql"
# Every connection explicitly uses the private Unix socket and fixture database.
unset PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS PGUSER PGPORT PGDATABASE PGHOST
export PGHOST="$tmp" PGDATABASE=postgres
"$psql" -Xq -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/atomic_checkout_schema.sql \
  -f supabase/migrations/create_order_settings_table.sql \
  -c 'GRANT ALL ON public.order_settings TO anon, authenticated, service_role' \
  -f supabase/migrations/20261126001000_restrict_order_availability.sql \
  -f supabase/migrations/20261126002000_atomic_checkout.sql \
  -f supabase/tests/order_availability.sql -f supabase/tests/atomic_checkout.sql

key1=a0000000-0000-4000-8000-000000000011
key2=a0000000-0000-4000-8000-000000000012
key3=a0000000-0000-4000-8000-000000000013
code=PR2_CONCURRENT
call() {
  printf '%s' "SELECT public.sisi_create_checkout('$1', repeat('a',64), '{\"name\":\"Synthetic\",\"contact_email\":\"test@example.invalid\",\"selected_option\":\"local\",\"payment_method\":\"Gotówka\",\"status\":\"placed\"}', '[{\"product_id\":\"c0000000-0000-4000-8000-000000000001\",\"name\":\"Synthetic\",\"quantity\":1,\"unit_price\":20,\"line_no\":1}]', '{\"products\":2000,\"packaging\":0,\"delivery\":0,\"deposit\":0,\"lines\":[2000]}', $2, $3)$4;"
}
start() {
  cmd=$1
  marker=$2
  "$psql" -XAtq -v ON_ERROR_STOP=1 > "$tmp/$marker.out" <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
$cmd
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
run() { "$psql" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; $1"; }
"$psql" -Xq -v ON_ERROR_STOP=1 -c "UPDATE public.restaurant_info SET ordering_open = true; UPDATE public.order_settings SET orders_enabled=true;"
first=$(call "$key1" 2000 NULL "->>'status'")
start "$first" same-key
test "$(run "$(call "$key1" 2000 NULL "->>'replayed'")")" = true
wait "$worker"
grep -qx OK "$tmp/same-key.out"
test "$("$psql" -XAtq -c 'SELECT count(*) FROM public.orders')" = 1

"$psql" -Xq -v ON_ERROR_STOP=1 -c "INSERT INTO public.discount_codes (id,code,type,value,active,auto_apply,max_uses) VALUES ('90000000-0000-4000-8000-000000000003','$code','amount',5,true,false,1);"
start "$(call "$key2" 1500 "'$code'" "->>'status'")" last-coupon
test "$(run "$(call "$key3" 1500 "'$code'" "->>'status'")")" = PROMO_UNAVAILABLE
wait "$worker"
grep -qx OK "$tmp/last-coupon.out"
test "$("$psql" -XAtq -c 'SELECT count(*) FROM public.discount_redemptions')" = 1

settings_id=$("$psql" -XAtq -c 'SELECT id FROM public.order_settings')
close="SELECT public.sisi_update_order_availability('$settings_id', '{\"orders_enabled\":false}');"
start "$close" close-first
test "$(run "$(call "$key3" 2000 NULL "->>'status'")")" = CLOSED
wait "$worker"
test "$("$psql" -XAtq -c 'SELECT count(*) FROM public.orders')" = 2

run "SELECT public.sisi_update_order_availability('$settings_id', '{\"orders_enabled\":true}');" >/dev/null
start "$(call "$key3" 2000 NULL "->>'status'")" checkout-first
run "$close" >/dev/null
wait "$worker"
grep -qx OK "$tmp/checkout-first.out"
test "$("$psql" -XAtq -c 'SELECT count(*) FROM public.orders')" = 3
test "$(run "$(call a0000000-0000-4000-8000-000000000014 2000 NULL "->>'status'")")" = CLOSED
printf '%s\n' 'Passed parallel same-key, last-coupon, close-first and checkout-first cases.'
