-- PostgREST requires a direct foreign key to expose `profiles` as an
-- embedded resource. The composite membership foreign keys guarantee that
-- each traveler belongs to the trip, but they do not create a direct
-- `room_occupants/seat_assignments -> profiles` relationship.
alter table public.room_occupants
  add constraint room_occupants_traveler_id_fkey
  foreign key (traveler_id) references public.profiles(id) on delete cascade;

alter table public.seat_assignments
  add constraint seat_assignments_traveler_id_fkey
  foreign key (traveler_id) references public.profiles(id) on delete cascade;

-- Make the new relationships available to the REST API immediately.
notify pgrst, 'reload schema';
