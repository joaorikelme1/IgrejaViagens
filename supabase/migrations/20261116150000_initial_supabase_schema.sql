create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'traveler');
create type public.receipt_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf char(11) not null unique check (cpf ~ '^[0-9]{11}$'),
  name text not null check (length(trim(name)) > 0),
  role public.app_role not null default 'traveler',
  birthdate date,
  first_login boolean not null default true,
  married boolean not null default false,
  spouse_id uuid references public.profiles(id) on delete set null,
  spouse_name text not null default '',
  has_kids boolean not null default false,
  profile_photo_path text,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_not_own_spouse check (spouse_id is null or spouse_id <> id)
);

create table public.family_relationships (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  destination text not null default '',
  departure_place text not null default '',
  departure_time time,
  departure_date date,
  max_people integer not null check (max_people > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  arrecadation_goal numeric(12,2) not null default 0 check (arrecadation_goal >= 0),
  rules text not null default '',
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_travelers (
  trip_id uuid not null references public.trips(id) on delete cascade,
  traveler_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (trip_id, traveler_id)
);

create table public.buses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  floors smallint not null check (floors in (1, 2)),
  seats_floor1 integer not null check (seats_floor1 >= 0),
  seats_floor2 integer not null default 0 check (seats_floor2 >= 0),
  created_at timestamptz not null default now(),
  check ((floors = 1 and seats_floor2 = 0) or floors = 2),
  unique (id, trip_id)
);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (id, trip_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  hotel_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  room_type text not null default 'custom',
  capacity smallint not null check (capacity > 0),
  created_at timestamptz not null default now(),
  foreign key (hotel_id, trip_id) references public.hotels(id, trip_id) on delete cascade,
  unique (id, trip_id)
);

create table public.room_occupants (
  room_id uuid not null,
  trip_id uuid not null,
  traveler_id uuid not null,
  primary key (room_id, traveler_id),
  unique (trip_id, traveler_id),
  foreign key (room_id, trip_id) references public.rooms(id, trip_id) on delete cascade,
  foreign key (trip_id, traveler_id) references public.trip_travelers(trip_id, traveler_id) on delete cascade
);

create table public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  bus_id uuid not null,
  floor smallint not null check (floor in (1, 2)),
  seat_number integer not null check (seat_number > 0),
  traveler_id uuid not null,
  foreign key (bus_id, trip_id) references public.buses(id, trip_id) on delete cascade,
  foreign key (trip_id, traveler_id) references public.trip_travelers(trip_id, traveler_id) on delete cascade,
  unique (trip_id, bus_id, floor, seat_number),
  unique (trip_id, traveler_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  traveler_id uuid not null,
  total_installments smallint not null check (total_installments between 1 and 24),
  paid_installments smallint not null default 0 check (paid_installments between 0 and total_installments),
  due_day smallint not null default 10 check (due_day between 1 and 31),
  locked boolean not null default false,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, traveler_id),
  foreign key (trip_id, traveler_id) references public.trip_travelers(trip_id, traveler_id) on delete cascade
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  installment smallint not null check (installment > 0),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  note text not null default '',
  status public.receipt_status not null default 'pending',
  uploaded_at timestamptz not null default now(),
  unique (payment_id, installment)
);

create table public.trip_traveler_preferences (
  trip_id uuid not null,
  traveler_id uuid not null,
  mobility_requirement text not null default 'NONE',
  seat_region text not null default 'ANY',
  preferred_bus_floor smallint check (preferred_bus_floor in (1, 2)),
  preferred_room_type text,
  include_in_ai_planning boolean not null default true,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (trip_id, traveler_id),
  foreign key (trip_id, traveler_id) references public.trip_travelers(trip_id, traveler_id) on delete cascade
);

create table public.preference_companions (
  trip_id uuid not null,
  traveler_id uuid not null,
  companion_id uuid not null,
  primary key (trip_id, traveler_id, companion_id),
  check (traveler_id <> companion_id),
  foreign key (trip_id, traveler_id) references public.trip_traveler_preferences(trip_id, traveler_id) on delete cascade,
  foreign key (trip_id, companion_id) references public.trip_travelers(trip_id, traveler_id) on delete cascade
);

create table public.preference_separations (
  trip_id uuid not null,
  traveler_id uuid not null,
  separated_from_id uuid not null,
  primary key (trip_id, traveler_id, separated_from_id),
  check (traveler_id <> separated_from_id),
  foreign key (trip_id, traveler_id) references public.trip_traveler_preferences(trip_id, traveler_id) on delete cascade,
  foreign key (trip_id, separated_from_id) references public.trip_travelers(trip_id, traveler_id) on delete cascade
);

create table public.ai_plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'APPLIED')),
  provider text,
  model text,
  prompt_version text,
  snapshot_hash char(64) not null,
  result jsonb,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost numeric(18,8),
  error_code text,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);

create index trip_travelers_traveler_idx on public.trip_travelers(traveler_id);
create index payments_traveler_idx on public.payments(traveler_id);
create index rooms_trip_idx on public.rooms(trip_id);
create index seats_trip_idx on public.seat_assignments(trip_id);
create index ai_plans_trip_created_idx on public.ai_plans(trip_id, created_at desc);

create or replace function public.set_updated_at_and_version() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); new.version = old.version + 1; return new; end;
$$;
create trigger trips_version before update on public.trips for each row execute function public.set_updated_at_and_version();
create trigger payments_version before update on public.payments for each row execute function public.set_updated_at_and_version();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at_and_version();
create trigger preferences_version before update on public.trip_traveler_preferences for each row execute function public.set_updated_at_and_version();
create trigger plans_version before update on public.ai_plans for each row execute function public.set_updated_at_and_version();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.assert_admin() returns void
language plpgsql security definer set search_path = public as $$
begin if auth.uid() is null or not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if; end;
$$;
revoke all on function public.assert_admin() from public;
grant execute on function public.assert_admin() to authenticated;

create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if new.role <> old.role or new.cpf <> old.cpf or (new.first_login <> old.first_login and not (old.first_login = true and new.first_login = false))
       or new.married <> old.married or new.spouse_id is distinct from old.spouse_id
       or new.has_kids <> old.has_kids or new.name <> old.name or new.birthdate is distinct from old.birthdate
       or new.spouse_name <> old.spouse_name then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.role = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'the last administrator cannot be deleted' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'the last administrator cannot be demoted' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger profiles_last_admin_update before update on public.profiles for each row execute function public.guard_last_admin();
create trigger profiles_last_admin_delete before delete on public.profiles for each row execute function public.guard_last_admin();

create or replace function public.add_trip_traveler(p_trip_id uuid, p_traveler_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare capacity integer;
begin
  perform public.assert_admin();
  select max_people into capacity from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;
  if not exists (select 1 from public.profiles where id = p_traveler_id) then raise exception 'traveler not found'; end if;
  if not exists (select 1 from public.trip_travelers where trip_id = p_trip_id and traveler_id = p_traveler_id)
     and (select count(*) from public.trip_travelers where trip_id = p_trip_id) >= capacity then raise exception 'trip capacity reached'; end if;
  insert into public.trip_travelers(trip_id, traveler_id) values (p_trip_id, p_traveler_id) on conflict do nothing;
end;
$$;

create or replace function public.remove_trip_traveler(p_trip_id uuid, p_traveler_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform public.assert_admin(); delete from public.trip_travelers where trip_id = p_trip_id and traveler_id = p_traveler_id; end;
$$;

create or replace function public.replace_room_assignments(p_trip_id uuid, p_rooms jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare item jsonb; occupant text; room_capacity integer; room_trip uuid;
begin
  perform public.assert_admin();
  perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;
  foreach item in array coalesce(array(select value from jsonb_array_elements(p_rooms)), array[]::jsonb[]) loop
    select capacity, trip_id into room_capacity, room_trip from public.rooms where id = (item->>'id')::uuid for update;
    if room_trip is distinct from p_trip_id then raise exception 'invalid room'; end if;
    if jsonb_array_length(coalesce(item->'occupants', '[]'::jsonb)) > room_capacity then raise exception 'room capacity exceeded'; end if;
  end loop;
  delete from public.room_occupants where trip_id = p_trip_id;
  for item in select value from jsonb_array_elements(p_rooms) loop
    for occupant in select jsonb_array_elements_text(coalesce(item->'occupants', '[]'::jsonb)) loop
      insert into public.room_occupants(room_id, trip_id, traveler_id) values ((item->>'id')::uuid, p_trip_id, occupant::uuid);
    end loop;
  end loop;
end;
$$;

create or replace function public.replace_seat_assignments(p_trip_id uuid, p_seats jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare item jsonb; capacity integer;
begin
  perform public.assert_admin(); perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;
  for item in select value from jsonb_array_elements(p_seats) loop
    select case when (item->>'floor')::int = 1 then seats_floor1 else seats_floor2 end into capacity from public.buses where id = (item->>'busId')::uuid and trip_id = p_trip_id;
    if capacity is null or (item->>'seatNumber')::int > capacity then raise exception 'invalid seat'; end if;
  end loop;
  delete from public.seat_assignments where trip_id = p_trip_id;
  insert into public.seat_assignments(trip_id,bus_id,floor,seat_number,traveler_id)
  select p_trip_id,(v->>'busId')::uuid,(v->>'floor')::smallint,(v->>'seatNumber')::int,(v->>'travelerId')::uuid from jsonb_array_elements(p_seats) v;
end;
$$;

create or replace function public.replace_buses(p_trip_id uuid, p_buses jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin(); perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;
  delete from public.buses where trip_id = p_trip_id;
  insert into public.buses(trip_id, floors, seats_floor1, seats_floor2)
  select p_trip_id, (v->>'floors')::smallint, (v->>'seats_floor1')::int, coalesce((v->>'seats_floor2')::int, 0)
  from jsonb_array_elements(p_buses) v;
end;
$$;

create or replace function public.replace_hotels(p_trip_id uuid, p_hotels jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare item jsonb; created_hotel uuid;
begin
  perform public.assert_admin(); perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;
  delete from public.hotels where trip_id = p_trip_id;
  for item in select value from jsonb_array_elements(p_hotels) loop
    insert into public.hotels(trip_id,name) values (p_trip_id, item->>'name') returning id into created_hotel;
    insert into public.rooms(trip_id,hotel_id,name,room_type,capacity)
    select p_trip_id, created_hotel, v->>'name', coalesce(v->>'room_type','custom'), (v->>'capacity')::smallint from jsonb_array_elements(coalesce(item->'rooms','[]'::jsonb)) v;
  end loop;
end;
$$;

create or replace function public.save_payment(p_payment_id uuid, p_trip_id uuid, p_traveler_id uuid, p_total_installments smallint, p_paid_installments smallint, p_due_day smallint, p_locked boolean, p_expected_version bigint default null)
returns public.payments language plpgsql security definer set search_path = public as $$
declare saved public.payments;
begin
  perform public.assert_admin();
  if p_expected_version is not null and exists(select 1 from public.payments where id = p_payment_id and version <> p_expected_version) then raise exception 'concurrent update' using errcode = '40001'; end if;
  insert into public.payments(id,trip_id,traveler_id,total_installments,paid_installments,due_day,locked)
  values (coalesce(p_payment_id, gen_random_uuid()),p_trip_id,p_traveler_id,p_total_installments,p_paid_installments,p_due_day,p_locked)
  on conflict (id) do update set total_installments = excluded.total_installments, paid_installments = excluded.paid_installments, due_day = excluded.due_day, locked = excluded.locked
  returning * into saved;
  return saved;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.add_trip_traveler(uuid,uuid), public.remove_trip_traveler(uuid,uuid), public.replace_room_assignments(uuid,jsonb), public.replace_seat_assignments(uuid,jsonb), public.replace_buses(uuid,jsonb), public.replace_hotels(uuid,jsonb), public.save_payment(uuid,uuid,uuid,smallint,smallint,smallint,boolean,bigint) to authenticated;

alter table public.profiles enable row level security;
alter table public.family_relationships enable row level security;
alter table public.trips enable row level security;
alter table public.trip_travelers enable row level security;
alter table public.buses enable row level security;
alter table public.hotels enable row level security;
alter table public.rooms enable row level security;
alter table public.room_occupants enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.payments enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.trip_traveler_preferences enable row level security;
alter table public.preference_companions enable row level security;
alter table public.preference_separations enable row level security;
alter table public.ai_plans enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy admin_all_family on public.family_relationships for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy trip_read on public.trips for select to authenticated using (public.is_admin() or exists(select 1 from public.trip_travelers tt where tt.trip_id = id and tt.traveler_id = auth.uid()));
create policy admin_write_trips on public.trips for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy memberships_read on public.trip_travelers for select to authenticated using (public.is_admin() or traveler_id = auth.uid());
create policy admin_memberships on public.trip_travelers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy operational_read on public.buses for select to authenticated using (public.is_admin() or exists(select 1 from public.trip_travelers tt where tt.trip_id = buses.trip_id and tt.traveler_id = auth.uid()));
create policy operational_write_buses on public.buses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy hotel_read on public.hotels for select to authenticated using (public.is_admin() or exists(select 1 from public.trip_travelers tt where tt.trip_id = hotels.trip_id and tt.traveler_id = auth.uid()));
create policy hotel_write on public.hotels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy room_read on public.rooms for select to authenticated using (public.is_admin() or exists(select 1 from public.trip_travelers tt where tt.trip_id = rooms.trip_id and tt.traveler_id = auth.uid()));
create policy room_write on public.rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy room_occupant_read on public.room_occupants for select to authenticated using (public.is_admin() or traveler_id = auth.uid());
create policy room_occupant_write on public.room_occupants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy seat_read on public.seat_assignments for select to authenticated using (public.is_admin() or traveler_id = auth.uid());
create policy seat_write on public.seat_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_read on public.payments for select to authenticated using (public.is_admin() or traveler_id = auth.uid());
create policy payments_write on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy receipts_read on public.payment_receipts for select to authenticated using (public.is_admin() or exists(select 1 from public.payments p where p.id = payment_id and p.traveler_id = auth.uid()));
create policy receipts_write on public.payment_receipts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy preferences_own on public.trip_traveler_preferences for all to authenticated using (public.is_admin() or traveler_id = auth.uid()) with check (public.is_admin() or traveler_id = auth.uid());
create policy companions_own on public.preference_companions for all to authenticated using (public.is_admin() or traveler_id = auth.uid()) with check (public.is_admin() or traveler_id = auth.uid());
create policy separations_own on public.preference_separations for all to authenticated using (public.is_admin() or traveler_id = auth.uid()) with check (public.is_admin() or traveler_id = auth.uid());
create policy plans_admin on public.ai_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 600000, array['image/jpeg','image/png','image/webp']),
       ('payment-receipts', 'payment-receipts', false, 5000000, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false;
create policy profile_photos_read on storage.objects for select to authenticated using (bucket_id = 'profile-photos' and (owner_id = auth.uid()::text or public.is_admin()));
create policy profile_photos_write on storage.objects for insert to authenticated with check (bucket_id = 'profile-photos' and owner_id = auth.uid()::text);
create policy profile_photos_delete on storage.objects for delete to authenticated using (bucket_id = 'profile-photos' and owner_id = auth.uid()::text);
create policy receipts_read on storage.objects for select to authenticated using (bucket_id = 'payment-receipts' and public.is_admin());
create policy receipts_write on storage.objects for insert to authenticated with check (bucket_id = 'payment-receipts' and (owner_id = auth.uid()::text or public.is_admin()));
