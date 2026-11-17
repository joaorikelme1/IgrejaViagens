-- max_people remains as a planning estimate, but it must not prevent an
-- administrator from associating additional travelers with the trip.
create or replace function public.add_trip_traveler(p_trip_id uuid, p_traveler_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  perform 1 from public.trips where id = p_trip_id;
  if not found then raise exception 'trip not found'; end if;
  if not exists (select 1 from public.profiles where id = p_traveler_id) then raise exception 'traveler not found'; end if;
  insert into public.trip_travelers(trip_id, traveler_id)
  values (p_trip_id, p_traveler_id)
  on conflict do nothing;
end;
$$;

notify pgrst, 'reload schema';
