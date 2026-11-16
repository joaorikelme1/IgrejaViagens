begin;
select plan(8);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'trips', 'trips exists');
select has_table('public', 'payments', 'payments exists');
select has_table('public', 'room_occupants', 'room occupants is relational');
select has_table('public', 'seat_assignments', 'seat assignments is relational');
select has_function('public', 'add_trip_traveler', 'membership RPC exists');
select has_function('public', 'replace_seat_assignments', 'seat RPC exists');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'payments RLS is enabled');

select * from finish();
rollback;
