begin;

select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table demo_people (person_no integer primary key, id uuid not null) on commit drop;
insert into demo_people
select substring(cpf::text from 2)::integer, id
from public.profiles
where cpf::text like '8%';

create temporary table demo_trips (trip_no integer primary key, id uuid not null) on commit drop;
insert into demo_trips
select n, md5('igreja-viagens-demo-trip-' || n)::uuid
from generate_series(1, 5) as series(n);

-- Atualiza nomes, idades e a composição familiar dos perfis de demonstração.
with names as (
  select p.id, d.person_no,
    (array['Aline','André','Beatriz','Caio','Cecília','Davi','Eduarda','Fábio','Flávia','Gustavo','Helena','Igor','Jéssica','Kaique','Lívia','Marcelo','Natália','Otávio','Priscila','Rafael','Renata','Samuel','Talita','Vinícius','Yasmin','Alexandre','Bianca','Cássio','Débora','Enzo','Fernanda','Giovana','Hugo','Irene','Juliano','Luana','Marlon','Nádia','Paulo','Raquel','Sérgio','Tânia','Ulisses','Valéria','Wesley','Zuleica','Adriana','Breno'])[1 + ((d.person_no * 17 + 11) % 48)]
      || ' ' ||
    (array['Araújo','Bittencourt','Campos','Duarte','Farias','Guimarães','Haddad','Inácio','Jardim','Klein','Lacerda','Macedo','Noronha','Queiroz','Ramos','Siqueira','Tavares','Uchoa','Vasconcelos','Xavier','Zanetti','Aguiar','Borges','Cunha','Domingues','Falcão','Goulart','Horta','Leal','Meireles','Navarro','Paes','Rezende','Saldanha','Teixeira','Viana','Werneck','Azevedo','Batista','Cavalcante','Diniz','Freitas','Gusmão','Lins','Moraes','Neves','Pacheco','Ribeiro','Soares','Torres'])[1 + ((d.person_no * 29 + 5) % 50)] as name,
    case
      when d.person_no between 45 and 70 or d.person_no between 81 and 95 then date '2006-01-01' + ((d.person_no * 59) % 5600)
      when d.person_no between 108 and 128 then date '1997-01-01' + ((d.person_no * 83) % 7500)
      else date '1954-01-01' + ((d.person_no * 97) % 15500)
    end as birthdate
  from public.profiles p join demo_people d on d.id = p.id
)
update public.profiles p
set name = n.name, birthdate = n.birthdate, married = false, spouse_id = null, spouse_name = '', has_kids = false, child_names = array[]::text[]
from names n
where p.id = n.id;

-- Vinte e dois casais cadastrados; doze deles têm filhos vinculados ao sistema.
with couples as (
  select left_person.id as person_id, right_person.id as spouse_id, right_profile.name as spouse_name
  from generate_series(1, 22) as series(pair_no)
  join demo_people left_person on left_person.person_no = pair_no
  join demo_people right_person on right_person.person_no = pair_no + 22
  join public.profiles right_profile on right_profile.id = right_person.id
  union all
  select right_person.id, left_person.id, left_profile.name
  from generate_series(1, 22) as series(pair_no)
  join demo_people left_person on left_person.person_no = pair_no
  join demo_people right_person on right_person.person_no = pair_no + 22
  join public.profiles left_profile on left_profile.id = left_person.id
)
update public.profiles p
set married = true, spouse_id = c.spouse_id, spouse_name = c.spouse_name
from couples c
where p.id = c.person_id;

-- Doze perfis têm cônjuge não cadastrado, com nomes próprios e situações variadas.
update public.profiles p
set married = true,
  spouse_name = (array['Mônica','Leandro','Solange','Roberto','Cristiane','Márcio','Elaine','Rodrigo','Vera','Fabrício','Márcia','Nelson'])[d.person_no - 95],
  has_kids = d.person_no between 96 and 101,
  child_names = case d.person_no
    when 96 then array['Breno','Lara'] when 97 then array['Caetano'] when 98 then array['Manuela','Pedro','Theo']
    when 99 then array['Gabriel','Heloísa'] when 100 then array['Mirela'] when 101 then array['Davi','Isis'] else array[]::text[] end
from demo_people d
where p.id = d.id and d.person_no between 96 and 107;

delete from public.family_relationships fr
using demo_people d
where fr.parent_id = d.id or fr.child_id = d.id;

insert into public.family_relationships (parent_id, child_id)
select parent.id, child.id
from generate_series(1, 10) as series(pair_no)
join demo_people parent on parent.person_no in (pair_no, pair_no + 22)
join demo_people child on child.person_no in (45 + (pair_no - 1) * 2, 46 + (pair_no - 1) * 2);

insert into public.family_relationships (parent_id, child_id)
select parent.id, child.id
from generate_series(11, 12) as series(pair_no)
join demo_people parent on parent.person_no in (pair_no, pair_no + 22)
join demo_people child on child.person_no between 65 + (pair_no - 11) * 3 and 67 + (pair_no - 11) * 3;

insert into public.family_relationships (parent_id, child_id)
select parent.id, child.id
from demo_people parent
join demo_people child on child.person_no between 81 + (parent.person_no - 71) * 2 and 82 + (parent.person_no - 71) * 2
where parent.person_no between 71 and 75;

insert into public.family_relationships (parent_id, child_id)
select parent.id, child.id
from demo_people parent
join demo_people child on child.person_no = 91 + (parent.person_no - 76)
where parent.person_no between 76 and 80;

update public.profiles p
set has_kids = exists (select 1 from public.family_relationships fr where fr.parent_id = p.id),
  child_names = coalesce((select array_agg(child.name order by child.birthdate) from public.family_relationships fr join public.profiles child on child.id = fr.child_id where fr.parent_id = p.id), array[]::text[])
where p.id in (select id from demo_people) and p.id not in (select d.id from demo_people d where d.person_no between 96 and 101);

-- Substitui as alocações previsíveis por participação e estrutura de viagem irregulares.
delete from public.trip_travelers tt
using demo_people d, demo_trips t
where tt.traveler_id = d.id and tt.trip_id = t.id;

delete from public.buses b using demo_trips t where b.trip_id = t.id;
delete from public.hotels h using demo_trips t where h.trip_id = t.id;

update public.trips t
set name = v.name, destination = v.destination, departure_place = v.departure_place,
  departure_date = v.departure_date, departure_time = v.departure_time, max_people = v.max_people,
  price = v.price, arrecadation_goal = v.goal, rules = v.rules
from (values
  (1, 'Retiro Renovar', 'Caldas Novas - GO', 'Templo Central', date '2027-01-22', time '05:45', 78, 945::numeric, 62000::numeric, 'Bagagem de mão, roupa de banho e presença no culto de abertura.'),
  (2, 'Congresso Famílias em Harmonia', 'Goiânia - GO', 'Estacionamento da igreja', date '2027-03-19', time '06:15', 145, 490::numeric, 57000::numeric, 'Crianças devem viajar com responsáveis; quartos serão confirmados pela equipe.'),
  (3, 'Caminhos de Fé', 'Aparecida - SP', 'Templo Central', date '2027-05-14', time '04:30', 118, 1390::numeric, 124000::numeric, 'Documento obrigatório, missa de encerramento e tolerância de 15 minutos.'),
  (4, 'Acampamento Raízes', 'Pirenópolis - GO', 'Anexo Jovem', date '2027-07-09', time '08:30', 72, 610::numeric, 41000::numeric, 'Menores devem portar autorização; programação inclui trilha leve.'),
  (5, 'Celebração Comunidade Viva', 'Brasília - DF', 'Templo Central', date '2027-10-15', time '09:15', 105, 315::numeric, 33000::numeric, 'Evento de um dia; levar garrafa de água e identificação.')
) as v(trip_no, name, destination, departure_place, departure_date, departure_time, max_people, price, goal, rules)
join demo_trips d on d.trip_no = v.trip_no
where t.id = d.id;

create temporary table demo_bus_config (trip_no integer, bus_no integer, floors smallint, seats_floor1 integer, seats_floor2 integer, label text, company text, plate text, driver_name text) on commit drop;
insert into demo_bus_config values
  (1,1,2,44,40,'Água Viva 01','Viação Esperança','GOD-1727','Carlos Mendes'),
  (2,1,2,46,42,'Família 01','Rota da Fé','GOI-2317','Sônia Almeida'), (2,2,1,42,0,'Família 02','Transporte Luz','GOI-6812','Renato Alves'),
  (3,1,2,48,44,'Peregrino 01','Viação Aparecida','SPF-5207','Marcos Vinhal'), (3,2,2,46,42,'Peregrino 02','Viação Aparecida','SPF-5208','Luciana Reis'), (3,3,1,36,0,'Peregrino Apoio','Rota da Fé','SPF-5230','Rafael Torres'),
  (4,1,2,40,36,'Raízes','Viação Cerrado','PIR-7709','Elias Duarte'),
  (5,1,1,48,0,'Comunidade 01','Transporte Luz','BSB-1590','Marina Lopes'), (5,2,2,38,34,'Comunidade 02','Viação Esperança','BSB-1591','Tiago Ramos');

insert into public.buses (id, trip_id, floors, seats_floor1, seats_floor2, label, company, plate, driver_name)
select md5('igreja-viagens-demo-diverse-bus-' || b.trip_no || '-' || b.bus_no)::uuid, t.id, b.floors, b.seats_floor1, b.seats_floor2, b.label, b.company, b.plate, b.driver_name
from demo_bus_config b join demo_trips t on t.trip_no = b.trip_no;

create temporary table demo_hotel_config (trip_no integer, hotel_no integer, name text, address text, notes text, room_count integer) on commit drop;
insert into demo_hotel_config values
  (1,1,'Thermas Serra Azul','Rua das Águas, 580 - Caldas Novas','Piscinas térmicas; quartos próximos à recepção.',22),
  (2,1,'Plaza do Cerrado','Av. T-63, 1400 - Goiânia','Bloco reservado para famílias.',14), (2,2,'Hotel Ipê Roxo','Rua 9, 318 - Goiânia','Café antecipado no dia da saída.',12), (2,3,'Pousada Boa Semente','Setor Oeste, Goiânia','Acessibilidade em quatro quartos.',10),
  (3,1,'Santuário Hotel','Av. Itaguassú, 900 - Aparecida','Próximo ao santuário e com elevadores.',18), (3,2,'Hospedaria do Vale','Rua das Palmeiras, 72 - Aparecida','Ala silenciosa para idosos.',17),
  (4,1,'Refúgio das Pedras','Estrada do Carmo, km 4 - Pirenópolis','Chalés, área de convivência e trilha guiada.',24),
  (5,1,'Brasília Park Hotel','Setor Hoteleiro Norte, Brasília','Uso diurno para apoio e descanso.',14), (5,2,'Hotel Horizonte','Setor Hoteleiro Sul, Brasília','Salão reservado para a equipe.',12);

insert into public.hotels (id, trip_id, name, address, notes)
select md5('igreja-viagens-demo-diverse-hotel-' || h.trip_no || '-' || h.hotel_no)::uuid, t.id, h.name, h.address, h.notes
from demo_hotel_config h join demo_trips t on t.trip_no = h.trip_no;

insert into public.rooms (id, trip_id, hotel_id, name, room_type, capacity)
select
  md5('igreja-viagens-demo-diverse-room-' || h.trip_no || '-' || h.hotel_no || '-' || room_no)::uuid,
  t.id, md5('igreja-viagens-demo-diverse-hotel-' || h.trip_no || '-' || h.hotel_no)::uuid,
  (case h.hotel_no when 1 then 'A' when 2 then 'B' else 'C' end) || lpad((100 + room_no)::text, 3, '0'),
  case room_no % 4 when 0 then 'single' when 1 then 'double' when 2 then 'triple' else 'family' end,
  case room_no % 5 when 0 then 1 when 1 then 2 when 2 then 3 when 3 then 4 else 5 end
from demo_hotel_config h
join demo_trips t on t.trip_no = h.trip_no
cross join lateral generate_series(1, h.room_count) as series(room_no);

insert into public.trip_travelers (trip_id, traveler_id)
select distinct trip_id, traveler_id
from (
  select t.id as trip_id, p.id as traveler_id
  from demo_people p join demo_trips t on t.trip_no = 1 + (abs(hashtext('base:' || p.id::text)) % 5)
  union all
  select t.id, p.id
  from demo_people p join demo_trips t on t.trip_no = 1 + (abs(hashtext('extra:' || p.id::text)) % 5)
  where abs(hashtext('extra-filter:' || p.id::text)) % 100 < 39
  union all
  select t.id, p.id
  from demo_people p join demo_trips t on t.trip_no = 1 + (abs(hashtext('third:' || p.id::text)) % 5)
  where abs(hashtext('third-filter:' || p.id::text)) % 100 < 17
) memberships;

with payment_input as (
  select tt.trip_id, tt.traveler_id, abs(hashtext(tt.trip_id::text || ':' || tt.traveler_id::text)) as key
  from public.trip_travelers tt join demo_trips t on t.id = tt.trip_id
), payment_plan as (
  select *, (array[1,2,3,4,6,8,10])[1 + (key % 7)] as installments from payment_input
)
insert into public.payments (id, trip_id, traveler_id, total_installments, paid_installments, due_day, locked)
select
  md5('igreja-viagens-demo-diverse-payment-' || trip_id || '-' || traveler_id)::uuid, trip_id, traveler_id, installments,
  case key % 7 when 0 then installments when 1 then greatest(installments - 1, 0) when 2 then installments / 2 when 3 then 0 when 4 then least(1, installments) when 5 then greatest(installments - 2, 0) else installments end,
  3 + (key % 23), key % 11 = 0
from payment_plan;

with membership_rank as (
  select tt.trip_id, tt.traveler_id, row_number() over (partition by tt.trip_id order by tt.traveler_id) as position
  from public.trip_travelers tt join demo_trips t on t.id = tt.trip_id
), seat_slots as (
  select b.trip_id, b.id as bus_id, 1 as floor, seat_no, row_number() over (partition by b.trip_id order by b.id, 1, seat_no) as position
  from public.buses b join demo_trips t on t.id = b.trip_id cross join lateral generate_series(1, b.seats_floor1) as series(seat_no)
  union all
  select b.trip_id, b.id, 2, seat_no, row_number() over (partition by b.trip_id order by b.id, 2, seat_no) + sum(b.seats_floor1) over (partition by b.trip_id) as position
  from public.buses b join demo_trips t on t.id = b.trip_id cross join lateral generate_series(1, b.seats_floor2) as series(seat_no)
)
insert into public.seat_assignments (trip_id, bus_id, floor, seat_number, traveler_id)
select m.trip_id, s.bus_id, s.floor, s.seat_no, m.traveler_id
from membership_rank m join seat_slots s on s.trip_id = m.trip_id and s.position = m.position;

with membership_rank as (
  select tt.trip_id, tt.traveler_id, row_number() over (partition by tt.trip_id order by tt.traveler_id) as position
  from public.trip_travelers tt join demo_trips t on t.id = tt.trip_id
), room_slots as (
  select r.trip_id, r.id as room_id, bed_no, row_number() over (partition by r.trip_id order by r.id, bed_no) as position
  from public.rooms r join demo_trips t on t.id = r.trip_id cross join lateral generate_series(1, r.capacity) as series(bed_no)
)
insert into public.room_occupants (room_id, trip_id, traveler_id)
select s.room_id, m.trip_id, m.traveler_id
from membership_rank m join room_slots s on s.trip_id = m.trip_id and s.position = m.position;

commit;
