begin;

create temporary table demo_people (
  person_no integer primary key,
  id uuid not null,
  cpf text not null,
  name text not null,
  role public.app_role not null,
  birthdate date not null
) on commit drop;

insert into demo_people (person_no, id, cpf, name, role, birthdate)
select
  n,
  md5('igreja-viagens-demo-person-' || n)::uuid,
  '8' || lpad(n::text, 10, '0'),
  case
    when n > 180 then (array['Mariana','Ricardo','Patrícia'])[n - 180]
    else (array['Ana','Bruno','Carla','Daniel','Elisa','Felipe','Gabriela','Henrique','Isabela','João','Larissa','Mateus'])[1 + ((n - 1) % 12)]
      || ' ' || (array['Almeida','Barbosa','Cardoso','Dias','Esteves','Ferreira','Gomes','Lima','Mendes','Nogueira','Oliveira','Pereira'])[1 + ((n * 5 - 1) % 12)]
  end,
  case when n > 180 then 'admin'::public.app_role else 'traveler'::public.app_role end,
  case
    when n between 61 and 100 or n between 111 and 120 then date '2007-01-01' + ((n * 41) % 4200)
    else date '1958-01-01' + ((n * 71) % 15000)
  end
from generate_series(1, 183) as series(n);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  coalesce((select instance_id from auth.users where instance_id is not null limit 1), '00000000-0000-0000-0000-000000000000'::uuid),
  p.id, 'authenticated', 'authenticated', p.cpf || '@auth.igreja-viagens.invalid',
  extensions.crypt('Viagem@2027', extensions.gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('cpf', p.cpf, 'email_verified', true), now(), now(), '', '', '', ''
from demo_people p
on conflict do nothing;

update auth.users user_record
set
  confirmation_token = '',
  email_change = '',
  email_change_token_new = '',
  recovery_token = '',
  raw_user_meta_data = jsonb_build_object('cpf', p.cpf, 'email_verified', true),
  updated_at = now()
from demo_people p
where user_record.id = p.id;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  md5('igreja-viagens-demo-identity-' || p.person_no)::uuid,
  p.id::text, p.id,
  jsonb_build_object('sub', p.id::text, 'email', p.cpf || '@auth.igreja-viagens.invalid', 'email_verified', false, 'phone_verified', false),
  'email', now(), now()
from demo_people p
on conflict do nothing;

update auth.identities identity
set
  provider_id = p.id::text,
  identity_data = jsonb_build_object('sub', p.id::text, 'email', p.cpf || '@auth.igreja-viagens.invalid', 'email_verified', false, 'phone_verified', false),
  updated_at = now()
from demo_people p
where identity.user_id = p.id and identity.provider = 'email';

insert into public.profiles (
  id, cpf, name, role, birthdate, first_login, married, spouse_id, spouse_name, has_kids, child_names
)
select
  p.id, p.cpf, p.name, p.role, p.birthdate, false,
  p.person_no between 1 and 60,
  spouse.id,
  coalesce(spouse.name, ''),
  p.person_no between 1 and 20 or p.person_no between 31 and 50 or p.person_no between 101 and 110,
  case
    when p.person_no between 1 and 20 then array[(select name from demo_people where person_no = 61 + (p.person_no - 1) * 2), (select name from demo_people where person_no = 62 + (p.person_no - 1) * 2)]
    when p.person_no between 31 and 50 then array[(select name from demo_people where person_no = 61 + (p.person_no - 31) * 2), (select name from demo_people where person_no = 62 + (p.person_no - 31) * 2)]
    when p.person_no between 101 and 110 then array[(select name from demo_people where person_no = p.person_no + 10)]
    else array[]::text[]
  end
from demo_people p
left join demo_people spouse on spouse.person_no = case
  when p.person_no between 1 and 30 then p.person_no + 30
  when p.person_no between 31 and 60 then p.person_no - 30
end
on conflict do nothing;

insert into public.family_relationships (parent_id, child_id)
select parent.id, child.id
from generate_series(1, 20) as series(pair_no)
join demo_people parent on parent.person_no in (pair_no, pair_no + 30)
join demo_people child on child.person_no in (61 + (pair_no - 1) * 2, 62 + (pair_no - 1) * 2)
on conflict do nothing;

insert into public.family_relationships (parent_id, child_id)
select parent.id, child.id
from demo_people parent
join demo_people child on child.person_no = parent.person_no + 10
where parent.person_no between 101 and 110
on conflict do nothing;

create temporary table demo_trips (
  trip_no integer primary key,
  id uuid not null,
  name text not null,
  destination text not null,
  departure_date date not null,
  departure_time time not null,
  price numeric not null
) on commit drop;

insert into demo_trips values
  (1, md5('igreja-viagens-demo-trip-1')::uuid, 'Retiro de Verão 2027', 'Caldas Novas - GO', date '2027-01-22', time '06:30', 890),
  (2, md5('igreja-viagens-demo-trip-2')::uuid, 'Congresso de Famílias', 'Goiânia - GO', date '2027-03-19', time '07:00', 420),
  (3, md5('igreja-viagens-demo-trip-3')::uuid, 'Peregrinação Histórica', 'Aparecida - SP', date '2027-05-14', time '05:30', 1250),
  (4, md5('igreja-viagens-demo-trip-4')::uuid, 'Acampamento de Jovens', 'Pirenópolis - GO', date '2027-07-09', time '08:00', 560),
  (5, md5('igreja-viagens-demo-trip-5')::uuid, 'Celebração de Encerramento', 'Brasília - DF', date '2027-10-15', time '09:00', 280);

insert into public.trips (id, name, destination, departure_place, departure_date, departure_time, max_people, price, arrecadation_goal, rules)
select id, name, destination, 'Igreja Comunidade da Fé', departure_date, departure_time, 180, price, price * 130,
  'Chegada com 30 minutos de antecedência; documento com foto obrigatório; respeitar horários e orientações da equipe.'
from demo_trips
on conflict do nothing;

insert into public.buses (id, trip_id, floors, seats_floor1, seats_floor2, label, company, plate, driver_name)
select
  md5('igreja-viagens-demo-bus-' || t.trip_no || '-' || bus_no)::uuid, t.id,
  2, 50, 50, 'Ônibus ' || bus_no, (array['Viação Esperança','Rota da Fé'])[bus_no],
  'DEM' || t.trip_no || bus_no || '27', (array['Carlos Mendes','Renato Alves'])[bus_no]
from demo_trips t cross join generate_series(1, 2) as series(bus_no)
on conflict do nothing;

insert into public.hotels (id, trip_id, name, address, notes)
select
  md5('igreja-viagens-demo-hotel-' || t.trip_no || '-' || hotel_no)::uuid, t.id,
  case hotel_no when 1 then 'Hotel Central ' || t.destination else 'Pousada Caminho da Fé ' || t.destination end,
  'Av. Principal, ' || (100 + hotel_no * 50) || ' - ' || t.destination,
  case hotel_no when 1 then 'Café da manhã incluso e recepção 24 horas.' else 'Hospedagem destinada prioritariamente a famílias.' end
from demo_trips t cross join generate_series(1, 2) as series(hotel_no)
on conflict do nothing;

insert into public.rooms (id, trip_id, hotel_id, name, room_type, capacity)
select
  md5('igreja-viagens-demo-room-' || t.trip_no || '-' || hotel_no || '-' || room_no)::uuid,
  t.id, md5('igreja-viagens-demo-hotel-' || t.trip_no || '-' || hotel_no)::uuid,
  lpad((100 + room_no)::text, 3, '0'),
  case when room_no % 3 = 0 then 'family' when room_no % 2 = 0 then 'double' else 'quadruple' end,
  4
from demo_trips t cross join generate_series(1, 2) as hotels(hotel_no) cross join generate_series(1, 12) as rooms(room_no)
on conflict do nothing;

insert into public.trip_travelers (trip_id, traveler_id)
select t.id, p.id
from demo_people p join demo_trips t on t.trip_no = ((p.person_no - 1) % 5) + 1
where p.role = 'traveler'
union
select t.id, p.id
from demo_people p join demo_trips t on t.trip_no = ((p.person_no + 1) % 5) + 1
where p.role = 'traveler' and p.person_no % 3 = 0
on conflict do nothing;

with ranked as (
  select tt.trip_id, tt.traveler_id, t.trip_no, p.person_no,
    row_number() over (partition by tt.trip_id order by p.person_no) as position
  from public.trip_travelers tt
  join demo_trips t on t.id = tt.trip_id
  join demo_people p on p.id = tt.traveler_id
)
insert into public.payments (id, trip_id, traveler_id, total_installments, paid_installments, due_day, locked)
select
  md5('igreja-viagens-demo-payment-' || trip_id || '-' || traveler_id)::uuid, trip_id, traveler_id,
  6,
  case person_no % 5 when 0 then 6 when 1 then 4 when 2 then 2 when 3 then 0 else 5 end,
  5 + (person_no % 20), person_no % 7 = 0
from ranked
on conflict do nothing;

with ranked as (
  select tt.trip_id, tt.traveler_id, t.trip_no,
    row_number() over (partition by tt.trip_id order by p.person_no) as position
  from public.trip_travelers tt
  join demo_trips t on t.id = tt.trip_id
  join demo_people p on p.id = tt.traveler_id
)
insert into public.seat_assignments (trip_id, bus_id, floor, seat_number, traveler_id)
select
  trip_id,
  md5('igreja-viagens-demo-bus-' || trip_no || '-' || (((position - 1) / 100) + 1))::uuid,
  case when ((position - 1) % 100) < 50 then 1 else 2 end,
  ((position - 1) % 50) + 1,
  traveler_id
from ranked
on conflict do nothing;

with ranked as (
  select tt.trip_id, tt.traveler_id, t.trip_no,
    row_number() over (partition by tt.trip_id order by p.person_no) as position
  from public.trip_travelers tt
  join demo_trips t on t.id = tt.trip_id
  join demo_people p on p.id = tt.traveler_id
)
insert into public.room_occupants (room_id, trip_id, traveler_id)
select
  md5('igreja-viagens-demo-room-' || trip_no || '-' || (((position - 1) / 48) + 1) || '-' || ((((position - 1) % 48) / 4) + 1))::uuid,
  trip_id, traveler_id
from ranked
on conflict do nothing;

commit;
