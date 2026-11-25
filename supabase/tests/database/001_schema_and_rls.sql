begin;
select plan(44);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'trips', 'trips exists');
select has_table('public', 'payments', 'payments exists');
select has_table('public', 'room_occupants', 'room occupants is relational');
select has_table('public', 'seat_assignments', 'seat assignments is relational');
select has_function('public', 'add_trip_traveler', 'membership RPC exists');
select has_function('public', 'replace_seat_assignments', 'seat RPC exists');
select has_function('public', 'replace_trip_allocations', array['uuid', 'jsonb', 'jsonb'], 'atomic room and seat RPC exists');
select ok(
  position('ASSERT_ADMIN' in upper(pg_get_functiondef('public.replace_trip_allocations(uuid,jsonb,jsonb)'::regprocedure))) > 0,
  'combined allocation RPC enforces administrator access'
);
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
select ok(
  position('max_people' in pg_get_functiondef('public.add_trip_traveler(uuid,uuid)'::regprocedure)) = 0,
  'trip traveler membership is not limited by the planning estimate'
);
select has_column('public', 'profiles', 'child_names', 'family child names are persisted');
select has_column('public', 'hotels', 'address', 'hotel address is persisted');
select has_column('public', 'buses', 'company', 'bus company is persisted');
select has_function('public', 'sync_family_relationships', array['uuid', 'uuid', 'uuid[]', 'text[]'], 'family synchronization RPC exists');
select ok(
  position('ON CONFLICT (ID) DO UPDATE' in upper(pg_get_functiondef('public.replace_buses(uuid,jsonb)'::regprocedure))) > 0,
  'bus synchronization preserves identifiers'
);
select ok(
  position('ON CONFLICT (ID) DO UPDATE' in upper(pg_get_functiondef('public.replace_hotels(uuid,jsonb)'::regprocedure))) > 0,
  'hotel synchronization preserves identifiers'
);

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004');
insert into public.profiles(id, cpf, name, role) values
  ('00000000-0000-0000-0000-000000000001', '11144477735', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-000000000002', '52998224725', 'Responsável', 'traveler'),
  ('00000000-0000-0000-0000-000000000003', '12345678909', 'Cônjuge', 'traveler'),
  ('00000000-0000-0000-0000-000000000004', '98765432100', 'Filho', 'traveler');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.trips(id, name, max_people) values ('10000000-0000-0000-0000-000000000001', 'Teste', 4);
insert into public.trip_travelers(trip_id, traveler_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004');
insert into public.buses(id, trip_id, floors, seats_floor1, seats_floor2)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 10, 0);
insert into public.seat_assignments(id, trip_id, bus_id, floor, seat_number, traveler_id)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 1, '00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$select public.replace_buses('10000000-0000-0000-0000-000000000001', '[{"id":"20000000-0000-0000-0000-000000000001","label":"Executivo","company":"Empresa","plate":"ABC1D23","driver_name":"Motorista","floors":1,"seats_floor1":12,"seats_floor2":0}]'::jsonb)$$,
  'bus structure can be synchronized'
);
select ok(
  exists(select 1 from public.buses where id = '20000000-0000-0000-0000-000000000001' and seats_floor1 = 12)
  and exists(select 1 from public.seat_assignments where id = '30000000-0000-0000-0000-000000000001'),
  'bus synchronization preserves its seat assignments'
);

insert into public.hotels(id, trip_id, name) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Hotel');
insert into public.rooms(id, trip_id, hotel_id, name, capacity) values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '101', 3);
insert into public.room_occupants(room_id, trip_id, traveler_id) values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$select public.replace_hotels('10000000-0000-0000-0000-000000000001', '[{"id":"40000000-0000-0000-0000-000000000001","name":"Hotel Atualizado","address":"Rua A","notes":"","rooms":[{"id":"50000000-0000-0000-0000-000000000001","name":"101","room_type":"family","capacity":4}]}]'::jsonb)$$,
  'hotel structure can be synchronized'
);
select ok(
  exists(select 1 from public.rooms where id = '50000000-0000-0000-0000-000000000001' and capacity = 4)
  and exists(select 1 from public.room_occupants where room_id = '50000000-0000-0000-0000-000000000001'),
  'hotel synchronization preserves room occupants'
);

select ok(public.is_valid_cpf('52998224725'), 'server accepts a CPF with valid check digits');
select ok(not public.is_valid_cpf('11111111111'), 'server rejects repeated CPF digits');
select has_function('public', 'save_own_payment_plan', array['uuid', 'smallint', 'smallint'], 'traveler payment-plan RPC exists');
select has_function('public', 'review_payment_receipt', array['uuid', 'integer', 'receipt_status', 'text', 'bigint'], 'atomic receipt review RPC exists');
select has_table('public', 'payment_audit_log', 'financial audit table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_audit_log'::regclass), 'financial audit RLS is enabled');
select ok(exists(select 1 from pg_trigger where tgrelid = 'public.seat_assignments'::regclass and tgname = 'seat_assignments_position' and not tgisinternal), 'seat capacity trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid = 'public.room_occupants'::regclass and tgname = 'room_occupants_capacity' and not tgisinternal), 'room capacity trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid = 'public.buses'::regclass and tgname = 'buses_capacity_update' and not tgisinternal), 'bus resize trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid = 'public.rooms'::regclass and tgname = 'rooms_capacity_update' and not tgisinternal), 'room resize trigger exists');
select ok(not exists(
  select 1 from aclexplode((select proacl from pg_proc where oid = 'public.add_trip_traveler(uuid,uuid)'::regprocedure))
  where grantee = 0 and privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute privileged membership RPC');
select ok(not has_function_privilege('anon', 'public.add_trip_traveler(uuid,uuid)', 'execute'), 'anonymous role cannot execute privileged membership RPC');
select ok(not has_function_privilege('authenticated', 'public.consume_assistant_quota(uuid)', 'execute'), 'clients cannot consume or bypass assistant quota directly');

select lives_ok(
  $$select public.sync_family_relationships('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', array['00000000-0000-0000-0000-000000000004'::uuid], array['Filho'])$$,
  'family relationships can be synchronized'
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000002' and spouse_id = '00000000-0000-0000-0000-000000000003' and child_names = array['Filho'])
  and exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000003' and spouse_id = '00000000-0000-0000-0000-000000000002')
  and exists(select 1 from public.family_relationships where parent_id = '00000000-0000-0000-0000-000000000002' and child_id = '00000000-0000-0000-0000-000000000004'),
  'family synchronization is reciprocal and persists children'
);

insert into public.payments(id, trip_id, traveler_id, total_installments) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 3),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 3);
update public.profiles set first_login = false where id = '00000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.profiles where id = '00000000-0000-0000-0000-000000000003'$$,
  array[0::bigint],
  'traveler cannot read another profile directly'
);
select results_eq(
  $$select count(*)::bigint from public.payments where traveler_id = '00000000-0000-0000-0000-000000000003'$$,
  array[0::bigint],
  'traveler cannot read another payment'
);
select results_eq(
  $$select count(*)::bigint from public.payments where traveler_id = '00000000-0000-0000-0000-000000000002'$$,
  array[1::bigint],
  'traveler can read only their own payment after first access'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000002'$$,
  '42501',
  'forbidden',
  'traveler cannot elevate their own role'
);
select throws_ok(
  $$select public.replace_seat_assignments('10000000-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  '42501',
  'forbidden',
  'traveler cannot invoke administrative allocation RPC'
);
reset role;

select * from finish();
rollback;
