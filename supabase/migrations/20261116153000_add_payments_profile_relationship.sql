-- PostgREST only exposes embedded resources when it can infer a direct
-- foreign-key relationship. Payments already require the traveler to belong
-- to the trip, but that composite relationship does not expose
-- `payments -> profiles` for `profiles(cpf)` embeds.
alter table public.payments
  add constraint payments_traveler_id_fkey
  foreign key (traveler_id) references public.profiles(id) on delete cascade;

-- Make the new relationship available to the REST API immediately.
notify pgrst, 'reload schema';
