alter table public.profiles
  add column child_names text[] not null default array[]::text[];

alter table public.hotels
  add column address text not null default '',
  add column notes text not null default '';

alter table public.buses
  add column label text not null default '',
  add column company text not null default '',
  add column plate text not null default '',
  add column driver_name text not null default '';

create or replace function public.replace_buses(p_trip_id uuid, p_buses jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  target_id uuid;
  kept_ids uuid[] := array[]::uuid[];
begin
  perform public.assert_admin();
  perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_buses, '[]'::jsonb)) loop
    target_id := coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid());
    if exists(select 1 from public.buses where id = target_id and trip_id <> p_trip_id) then
      raise exception 'bus belongs to another trip';
    end if;
    insert into public.buses(id, trip_id, floors, seats_floor1, seats_floor2, label, company, plate, driver_name)
    values (
      target_id,
      p_trip_id,
      (item->>'floors')::smallint,
      (item->>'seats_floor1')::integer,
      coalesce((item->>'seats_floor2')::integer, 0),
      coalesce(item->>'label', ''),
      coalesce(item->>'company', ''),
      coalesce(item->>'plate', ''),
      coalesce(item->>'driver_name', '')
    )
    on conflict (id) do update set
      floors = excluded.floors,
      seats_floor1 = excluded.seats_floor1,
      seats_floor2 = excluded.seats_floor2,
      label = excluded.label,
      company = excluded.company,
      plate = excluded.plate,
      driver_name = excluded.driver_name;
    kept_ids := array_append(kept_ids, target_id);
  end loop;

  delete from public.buses
  where trip_id = p_trip_id and not (id = any(kept_ids));
end;
$$;

create or replace function public.replace_hotels(p_trip_id uuid, p_hotels jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  hotel_item jsonb;
  room_item jsonb;
  hotel_id uuid;
  room_id uuid;
  kept_hotel_ids uuid[] := array[]::uuid[];
  kept_room_ids uuid[] := array[]::uuid[];
begin
  perform public.assert_admin();
  perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found'; end if;

  for hotel_item in select value from jsonb_array_elements(coalesce(p_hotels, '[]'::jsonb)) loop
    hotel_id := coalesce(nullif(hotel_item->>'id', '')::uuid, gen_random_uuid());
    if exists(select 1 from public.hotels where id = hotel_id and trip_id <> p_trip_id) then
      raise exception 'hotel belongs to another trip';
    end if;
    insert into public.hotels(id, trip_id, name, address, notes)
    values (
      hotel_id,
      p_trip_id,
      trim(hotel_item->>'name'),
      coalesce(hotel_item->>'address', ''),
      coalesce(hotel_item->>'notes', '')
    )
    on conflict (id) do update set
      name = excluded.name,
      address = excluded.address,
      notes = excluded.notes;
    kept_hotel_ids := array_append(kept_hotel_ids, hotel_id);

    for room_item in select value from jsonb_array_elements(coalesce(hotel_item->'rooms', '[]'::jsonb)) loop
      room_id := coalesce(nullif(room_item->>'id', '')::uuid, gen_random_uuid());
      if exists(select 1 from public.rooms where id = room_id and trip_id <> p_trip_id) then
        raise exception 'room belongs to another trip';
      end if;
      insert into public.rooms(id, trip_id, hotel_id, name, room_type, capacity)
      values (
        room_id,
        p_trip_id,
        hotel_id,
        trim(room_item->>'name'),
        coalesce(room_item->>'room_type', 'custom'),
        (room_item->>'capacity')::smallint
      )
      on conflict (id) do update set
        hotel_id = excluded.hotel_id,
        name = excluded.name,
        room_type = excluded.room_type,
        capacity = excluded.capacity;
      kept_room_ids := array_append(kept_room_ids, room_id);
    end loop;
  end loop;

  delete from public.rooms
  where trip_id = p_trip_id and not (id = any(kept_room_ids));
  delete from public.hotels
  where trip_id = p_trip_id and not (id = any(kept_hotel_ids));
end;
$$;

create or replace function public.sync_family_relationships(
  p_profile_id uuid,
  p_spouse_id uuid,
  p_child_ids uuid[],
  p_child_names text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  previous_spouse_id uuid;
  selected_spouse_name text;
  profile_name text;
begin
  perform public.assert_admin();
  select spouse_id, name into previous_spouse_id, profile_name
  from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'profile not found'; end if;
  if p_spouse_id = p_profile_id then raise exception 'profile cannot be own spouse'; end if;

  if p_spouse_id is not null then
    select name into selected_spouse_name
    from public.profiles where id = p_spouse_id for update;
    if not found then raise exception 'spouse not found'; end if;
    if exists(
      select 1 from public.profiles
      where id = p_spouse_id and spouse_id is not null and spouse_id <> p_profile_id
    ) then raise exception 'spouse already linked to another profile'; end if;
  end if;

  if previous_spouse_id is not null and previous_spouse_id is distinct from p_spouse_id then
    update public.profiles set spouse_id = null
    where id = previous_spouse_id and spouse_id = p_profile_id;
  end if;

  update public.profiles
  set spouse_id = p_spouse_id,
      spouse_name = case when p_spouse_id is null then spouse_name else selected_spouse_name end,
      child_names = coalesce(p_child_names, array[]::text[])
  where id = p_profile_id;

  if p_spouse_id is not null then
    update public.profiles
    set married = true, spouse_id = p_profile_id, spouse_name = profile_name
    where id = p_spouse_id;
  end if;

  delete from public.family_relationships where parent_id = p_profile_id;
  insert into public.family_relationships(parent_id, child_id)
  select p_profile_id, child_id
  from unnest(coalesce(p_child_ids, array[]::uuid[])) child_id
  where child_id <> p_profile_id
  on conflict do nothing;
end;
$$;

grant execute on function public.sync_family_relationships(uuid,uuid,uuid[],text[]) to authenticated;

notify pgrst, 'reload schema';
