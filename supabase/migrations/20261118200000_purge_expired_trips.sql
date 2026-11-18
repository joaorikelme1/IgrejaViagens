-- Trips are retained for three complete calendar months after their departure.
-- A trip without a departure date is never eligible for automatic deletion.
create or replace function public.purge_expired_trips()
returns table(deleted_trips integer, deleted_receipt_files integer)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  expiration_date date := (current_date - interval '3 months')::date;
begin
  -- Storage is not covered by the relational foreign-key cascades. Remove every
  -- receipt object for expired payments, including obsolete replacements.
  delete from storage.objects as object
  where object.bucket_id = 'payment-receipts'
    and exists (
      select 1
      from public.payments as payment
      join public.trips as trip on trip.id = payment.trip_id
      where trip.departure_date is not null
        and trip.departure_date <= expiration_date
        and (
          object.name like payment.id::text || '/%'
          or object.name like 'pending/' || payment.id::text || '/%'
        )
    );
  get diagnostics deleted_receipt_files = row_count;

  -- Related rows (travelers, allocations, payments, receipts and plans) are
  -- removed by the existing foreign-key cascades.
  delete from public.trips
  where departure_date is not null
    and departure_date <= expiration_date;
  get diagnostics deleted_trips = row_count;

  return next;
end;
$$;

revoke all on function public.purge_expired_trips() from public, anon, authenticated;

create extension if not exists pg_cron;

-- Run daily at 06:10 UTC (03:10 in São Paulo). The job name makes the
-- retention policy visible and manageable in Supabase's Cron dashboard.
select cron.schedule(
  'purge-expired-trips-after-three-months',
  '10 6 * * *',
  $$select public.purge_expired_trips();$$
);
