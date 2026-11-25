-- Production hardening: server-side validation, financial atomicity, audit,
-- capacity enforcement and assistant abuse protection. This migration does
-- not change the existing trip-retention policy or delete business data.

create or replace function public.is_valid_cpf(value text) returns boolean
language plpgsql immutable strict set search_path = public as $$
declare
  digits text := regexp_replace(value, '\D', '', 'g');
  total integer;
  remainder integer;
  index integer;
begin
  if length(digits) <> 11 or digits ~ '^(\d)\1{10}$' then return false; end if;
  total := 0;
  for index in 1..9 loop total := total + substring(digits, index, 1)::integer * (11 - index); end loop;
  remainder := (total * 10) % 11;
  if remainder = 10 then remainder := 0; end if;
  if remainder <> substring(digits, 10, 1)::integer then return false; end if;
  total := 0;
  for index in 1..10 loop total := total + substring(digits, index, 1)::integer * (12 - index); end loop;
  remainder := (total * 10) % 11;
  if remainder = 10 then remainder := 0; end if;
  return remainder = substring(digits, 11, 1)::integer;
end;
$$;

revoke all on function public.is_valid_cpf(text) from public, anon;
grant execute on function public.is_valid_cpf(text) to authenticated, service_role;

do $$
begin
  if exists (select 1 from public.profiles where not public.is_valid_cpf(cpf)) then
    raise exception 'invalid CPF already exists in profiles; correct it before applying production hardening';
  end if;
end;
$$;

alter table public.profiles
  add constraint profiles_cpf_check_digits check (public.is_valid_cpf(cpf));

-- Auth user deletion now cascades through the profile and trip memberships in
-- the same database statement. This avoids the previous two-step Edge Function
-- flow that could remove trip data and then fail before deleting the identity.
alter table public.trip_travelers drop constraint trip_travelers_traveler_id_fkey;
alter table public.trip_travelers add constraint trip_travelers_traveler_id_fkey
  foreign key (traveler_id) references public.profiles(id) on delete cascade;

create or replace function public.has_completed_first_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and first_login = false
  );
$$;
revoke all on function public.has_completed_first_access() from public, anon;
grant execute on function public.has_completed_first_access() to authenticated;

create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    if new.role <> old.role or new.cpf <> old.cpf or new.first_login <> old.first_login
       or new.married <> old.married or new.spouse_id is distinct from old.spouse_id
       or new.has_kids <> old.has_kids or new.name <> old.name
       or new.birthdate is distinct from old.birthdate
       or new.spouse_name <> old.spouse_name or new.child_names <> old.child_names then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- A traveler may choose and lock only their own plan. Payment confirmation,
-- receipt review and all later edits remain administrative operations.
create or replace function public.save_own_payment_plan(
  p_trip_id uuid,
  p_total_installments smallint,
  p_due_day smallint
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  saved public.payments;
begin
  if auth.uid() is null or not public.has_completed_first_access() then
    raise exception 'first access must be completed' using errcode = '42501';
  end if;
  if p_total_installments not between 1 and 24 or p_due_day not between 1 and 31 then
    raise exception 'invalid payment plan' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.trip_travelers
    where trip_id = p_trip_id and traveler_id = auth.uid()
  ) then raise exception 'forbidden' using errcode = '42501'; end if;

  select * into saved from public.payments
  where trip_id = p_trip_id and traveler_id = auth.uid()
  for update;
  if found and saved.locked then
    raise exception 'payment plan is locked' using errcode = '23514';
  end if;

  insert into public.payments (
    trip_id, traveler_id, total_installments, paid_installments, due_day, locked
  ) values (p_trip_id, auth.uid(), p_total_installments, 0, p_due_day, true)
  on conflict (trip_id, traveler_id) do update set
    total_installments = excluded.total_installments,
    due_day = excluded.due_day,
    locked = true
  returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_own_payment_plan(uuid,smallint,smallint) from public, anon;
grant execute on function public.save_own_payment_plan(uuid,smallint,smallint) to authenticated;

-- Enforce room and seat capacity even when an administrator writes directly
-- to the REST tables instead of using the synchronization RPCs.
create or replace function public.validate_room_occupancy() returns trigger
language plpgsql set search_path = public as $$
declare room_capacity integer; occupied integer;
begin
  select capacity into room_capacity from public.rooms
  where id = new.room_id and trip_id = new.trip_id for update;
  if not found then raise exception 'invalid room'; end if;
  select count(*) into occupied from public.room_occupants
  where room_id = new.room_id
    and (tg_op <> 'UPDATE' or traveler_id <> old.traveler_id);
  if occupied >= room_capacity then raise exception 'room capacity exceeded' using errcode = '23514'; end if;
  return new;
end;
$$;
drop trigger if exists room_occupants_capacity on public.room_occupants;
create trigger room_occupants_capacity before insert or update on public.room_occupants
for each row execute function public.validate_room_occupancy();

create or replace function public.validate_room_resize() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.capacity < (select count(*) from public.room_occupants where room_id = old.id) then
    raise exception 'room capacity is lower than current occupancy' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists rooms_capacity_update on public.rooms;
create trigger rooms_capacity_update before update of capacity on public.rooms
for each row execute function public.validate_room_resize();

create or replace function public.validate_seat_position() returns trigger
language plpgsql set search_path = public as $$
declare capacity integer; bus_floors integer;
begin
  select floors, case when new.floor = 1 then seats_floor1 else seats_floor2 end
  into bus_floors, capacity from public.buses
  where id = new.bus_id and trip_id = new.trip_id for update;
  if not found or new.floor > bus_floors or new.seat_number > capacity then
    raise exception 'invalid seat' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists seat_assignments_position on public.seat_assignments;
create trigger seat_assignments_position before insert or update on public.seat_assignments
for each row execute function public.validate_seat_position();

create or replace function public.validate_bus_resize() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.seat_assignments seat
    where seat.bus_id = old.id and (
      seat.floor > new.floors
      or (seat.floor = 1 and seat.seat_number > new.seats_floor1)
      or (seat.floor = 2 and seat.seat_number > new.seats_floor2)
    )
  ) then raise exception 'bus capacity is lower than assigned seats' using errcode = '23514'; end if;
  return new;
end;
$$;
drop trigger if exists buses_capacity_update on public.buses;
create trigger buses_capacity_update before update of floors, seats_floor1, seats_floor2 on public.buses
for each row execute function public.validate_bus_resize();

-- Append-only financial audit. Table writes are possible only through its
-- SECURITY DEFINER trigger; administrators receive read-only access via RLS.
create table public.payment_audit_log (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payment_audit_payment_created_idx on public.payment_audit_log(payment_id, created_at desc);
alter table public.payment_audit_log enable row level security;
create policy payment_audit_admin_read on public.payment_audit_log for select to authenticated
using (public.is_admin());
grant select on public.payment_audit_log to authenticated;

create or replace function public.audit_payment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare target_payment uuid;
begin
  target_payment := case when tg_table_name = 'payments'
    then coalesce(new.id, old.id) else coalesce(new.payment_id, old.payment_id) end;
  insert into public.payment_audit_log(payment_id, actor_id, event_type, details)
  values (
    target_payment,
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    jsonb_build_object(
      'old', case when tg_op = 'INSERT' then null else to_jsonb(old) - 'storage_path' end,
      'new', case when tg_op = 'DELETE' then null else to_jsonb(new) - 'storage_path' end
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger payments_audit after insert or update on public.payments
for each row execute function public.audit_payment_change();
create trigger payment_receipts_audit after insert or update on public.payment_receipts
for each row execute function public.audit_payment_change();

-- Validate the real Storage object, bind its path to the payment and replace
-- receipt metadata atomically. Old replacement objects are removed only after
-- the new row is safely linked in this transaction.
create or replace function public.submit_payment_receipt(
  p_payment_id uuid,
  p_installment integer,
  p_storage_path text,
  p_file_name text,
  p_mime_type text
) returns void
language plpgsql security definer set search_path = public, storage as $$
declare
  payment_owner uuid;
  installment_total smallint;
  object_owner text;
  object_metadata jsonb;
  actual_mime text;
  actual_size bigint;
  previous_path text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select traveler_id, total_installments into payment_owner, installment_total
  from public.payments where id = p_payment_id for update;
  if not found or (payment_owner <> auth.uid() and not public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if payment_owner = auth.uid() and not public.has_completed_first_access() then
    raise exception 'first access must be completed' using errcode = '42501';
  end if;
  if p_installment < 1 or p_installment > installment_total then
    raise exception 'invalid installment' using errcode = '22023';
  end if;
  if length(p_storage_path) > 512 or p_storage_path not like p_payment_id::text || '/%'
     or length(trim(p_file_name)) not between 1 and 255 then
    raise exception 'invalid receipt metadata' using errcode = '22023';
  end if;
  select owner_id, metadata into object_owner, object_metadata
  from storage.objects where bucket_id = 'payment-receipts' and name = p_storage_path;
  if not found or object_owner <> auth.uid()::text then
    raise exception 'receipt file not found' using errcode = '42501';
  end if;
  actual_mime := coalesce(object_metadata->>'mimetype', p_mime_type);
  actual_size := case when coalesce(object_metadata->>'size','') ~ '^\d+$'
    then (object_metadata->>'size')::bigint else 0 end;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf')
     or actual_mime <> p_mime_type or actual_size <= 0 or actual_size > 4194304 then
    raise exception 'invalid receipt file' using errcode = '22023';
  end if;

  select storage_path into previous_path from public.payment_receipts
  where payment_id = p_payment_id and installment = p_installment for update;
  insert into public.payment_receipts(payment_id, installment, storage_path, file_name, mime_type, note, status)
  values (p_payment_id, p_installment, p_storage_path, trim(p_file_name), p_mime_type, '', 'pending')
  on conflict (payment_id, installment) do update set
    storage_path = excluded.storage_path, file_name = excluded.file_name,
    mime_type = excluded.mime_type, note = '', status = 'pending', uploaded_at = now();
  if previous_path is not null and previous_path <> p_storage_path then
    delete from storage.objects where bucket_id = 'payment-receipts' and name = previous_path;
  end if;
end;
$$;
revoke all on function public.submit_payment_receipt(uuid,integer,text,text,text) from public, anon;
grant execute on function public.submit_payment_receipt(uuid,integer,text,text,text) to authenticated;

create or replace function public.review_payment_receipt(
  p_payment_id uuid,
  p_installment integer,
  p_status public.receipt_status,
  p_note text default '',
  p_expected_version bigint default null
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare saved public.payments;
begin
  perform public.assert_admin();
  if p_status not in ('approved','rejected') then raise exception 'invalid review status' using errcode = '22023'; end if;
  if p_status = 'rejected' and length(trim(coalesce(p_note,''))) = 0 then
    raise exception 'rejection reason is required' using errcode = '22023';
  end if;
  select * into saved from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if p_expected_version is not null and saved.version <> p_expected_version then
    raise exception 'concurrent update' using errcode = '40001';
  end if;
  update public.payment_receipts set
    status = p_status,
    note = case when p_status = 'rejected' then left(trim(p_note), 500) else '' end
  where payment_id = p_payment_id and installment = p_installment;
  if not found then raise exception 'receipt not found'; end if;
  update public.payments set paid_installments = least(
    total_installments,
    (select count(*) from public.payment_receipts where payment_id = p_payment_id and status = 'approved')
  ) where id = p_payment_id returning * into saved;
  return saved;
end;
$$;
revoke all on function public.review_payment_receipt(uuid,integer,public.receipt_status,text,bigint) from public, anon;
grant execute on function public.review_payment_receipt(uuid,integer,public.receipt_status,text,bigint) to authenticated;

drop policy if exists receipts_write on storage.objects;
drop policy if exists receipts_traveler_upload on storage.objects;
create policy receipts_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'payment-receipts' and owner_id = auth.uid()::text
  and exists (
    select 1 from public.payments payment
    where payment.id::text = (storage.foldername(name))[1]
      and (payment.traveler_id = auth.uid() or public.is_admin())
  )
);
create policy receipts_delete_unlinked on storage.objects for delete to authenticated using (
  bucket_id = 'payment-receipts' and owner_id = auth.uid()::text
  and not exists (select 1 from public.payment_receipts receipt where receipt.storage_path = name)
);
create policy profile_photos_update on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and owner_id = auth.uid()::text)
with check (bucket_id = 'profile-photos' and owner_id = auth.uid()::text);

-- Request-count limiter for the administrative assistant. Only service_role
-- (the Edge Function) can consume quota or access the underlying records.
create table public.assistant_request_log (
  user_id uuid not null,
  requested_at timestamptz not null default now()
);
create index assistant_request_user_time_idx on public.assistant_request_log(user_id, requested_at desc);
alter table public.assistant_request_log enable row level security;
revoke all on public.assistant_request_log from public, anon, authenticated;

create or replace function public.consume_assistant_quota(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare minute_count integer; day_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from public.assistant_request_log where requested_at < now() - interval '2 days';
  select count(*) filter (where requested_at >= now() - interval '1 minute'),
         count(*) filter (where requested_at >= now() - interval '1 day')
  into minute_count, day_count from public.assistant_request_log where user_id = p_user_id;
  if minute_count >= 20 or day_count >= 500 then return false; end if;
  insert into public.assistant_request_log(user_id) values (p_user_id);
  return true;
end;
$$;
revoke all on function public.consume_assistant_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_assistant_quota(uuid) to service_role;

-- Remove PostgreSQL's implicit PUBLIC EXECUTE from every privileged RPC.
revoke all on function public.add_trip_traveler(uuid,uuid), public.remove_trip_traveler(uuid,uuid),
  public.replace_room_assignments(uuid,jsonb), public.replace_seat_assignments(uuid,jsonb),
  public.replace_buses(uuid,jsonb), public.replace_hotels(uuid,jsonb),
  public.save_payment(uuid,uuid,uuid,smallint,smallint,smallint,boolean,bigint),
  public.sync_family_relationships(uuid,uuid,uuid[],text[]) from public, anon;

-- A valid session with a temporary password can read only its own profile.
-- Every operational/financial traveler policy also requires completion of the
-- server-side first-access flow. Administrators are unaffected.
drop policy if exists trip_read on public.trips;
create policy trip_read on public.trips for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and exists(
    select 1 from public.trip_travelers tt where tt.trip_id = id and tt.traveler_id = auth.uid()
  ))
);
drop policy if exists memberships_read on public.trip_travelers;
create policy memberships_read on public.trip_travelers for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid())
);
drop policy if exists operational_read on public.buses;
create policy operational_read on public.buses for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and exists(
    select 1 from public.trip_travelers tt where tt.trip_id = buses.trip_id and tt.traveler_id = auth.uid()
  ))
);
drop policy if exists hotel_read on public.hotels;
create policy hotel_read on public.hotels for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and exists(
    select 1 from public.trip_travelers tt where tt.trip_id = hotels.trip_id and tt.traveler_id = auth.uid()
  ))
);
drop policy if exists room_read on public.rooms;
create policy room_read on public.rooms for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and exists(
    select 1 from public.trip_travelers tt where tt.trip_id = rooms.trip_id and tt.traveler_id = auth.uid()
  ))
);
drop policy if exists room_occupant_read on public.room_occupants;
create policy room_occupant_read on public.room_occupants for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid())
);
drop policy if exists seat_read on public.seat_assignments;
create policy seat_read on public.seat_assignments for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid())
);
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid())
);
drop policy if exists receipts_read on public.payment_receipts;
create policy receipts_read on public.payment_receipts for select to authenticated using (
  public.is_admin() or (public.has_completed_first_access() and exists(
    select 1 from public.payments p where p.id = payment_id and p.traveler_id = auth.uid()
  ))
);
drop policy if exists preferences_own on public.trip_traveler_preferences;
create policy preferences_own on public.trip_traveler_preferences for all to authenticated
using (public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid()))
with check (public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid()));
drop policy if exists companions_own on public.preference_companions;
create policy companions_own on public.preference_companions for all to authenticated
using (public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid()))
with check (public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid()));
drop policy if exists separations_own on public.preference_separations;
create policy separations_own on public.preference_separations for all to authenticated
using (public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid()))
with check (public.is_admin() or (public.has_completed_first_access() and traveler_id = auth.uid()));

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated using (
  bucket_id = 'payment-receipts' and (
    public.is_admin() or (public.has_completed_first_access() and exists (
      select 1 from public.payment_receipts receipt
      join public.payments payment on payment.id = receipt.payment_id
      where receipt.storage_path = storage.objects.name and payment.traveler_id = auth.uid()
    ))
  )
);

notify pgrst, 'reload schema';
