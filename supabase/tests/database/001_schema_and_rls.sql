begin;
select plan(12);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'trips', 'trips exists');
select has_table('public', 'payments', 'payments exists');
select has_table('public', 'room_occupants', 'room occupants is relational');
select has_table('public', 'seat_assignments', 'seat assignments is relational');
select has_function('public', 'add_trip_traveler', 'membership RPC exists');
select has_function('public', 'replace_seat_assignments', 'seat RPC exists');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'payments RLS is enabled');
select ok(exists(
  select 1
  from pg_constraint
  where conrelid = 'public.payments'::regclass
    and confrelid = 'public.profiles'::regclass
    and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.payments'::regclass and attname = 'traveler_id')]::smallint[]
), 'payments exposes a direct traveler profile relationship');
select ok(exists(
  select 1
  from pg_constraint
  where conrelid = 'public.room_occupants'::regclass
    and confrelid = 'public.profiles'::regclass
    and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.room_occupants'::regclass and attname = 'traveler_id')]::smallint[]
), 'room occupants exposes a direct traveler profile relationship');
select ok(exists(
  select 1
  from pg_constraint
  where conrelid = 'public.seat_assignments'::regclass
    and confrelid = 'public.profiles'::regclass
    and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.seat_assignments'::regclass and attname = 'traveler_id')]::smallint[]
), 'seat assignments exposes a direct traveler profile relationship');
select unlike(
  pg_get_functiondef('public.add_trip_traveler(uuid,uuid)'::regprocedure),
  '%max_people%',
  'trip traveler membership is not limited by the planning estimate'
);

select * from finish();
rollback;
