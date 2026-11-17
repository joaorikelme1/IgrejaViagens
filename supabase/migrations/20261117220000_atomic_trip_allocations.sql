create or replace function public.replace_trip_allocations(
  p_trip_id uuid,
  p_rooms jsonb,
  p_seats jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  perform public.replace_room_assignments(p_trip_id, coalesce(p_rooms, '[]'::jsonb));
  perform public.replace_seat_assignments(p_trip_id, coalesce(p_seats, '[]'::jsonb));
end;
$$;

revoke all on function public.replace_trip_allocations(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_trip_allocations(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
