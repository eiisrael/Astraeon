-- Character characteristics persistence/security contracts. Disposable DB only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('74000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','characteristics-owner@example.invalid','',now(),'{}','{}',now(),now()),
('74100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','characteristics-other@example.invalid','',now(),'{}','{}',now(),now());

create temporary table characteristics_ids(label text primary key,id uuid not null);
grant select, insert on characteristics_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into characteristics_ids values('owner',(public.create_astraeon_character('AttrOwner','Warrior')).id);
reset role;

update public.character_progress
   set level=10
 where character_id=(select id from characteristics_ids where label='owner');
update public.characters
   set level=10
 where id=(select id from characteristics_ids where label='owner');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);

select is(
  (select attribute_damage from public.character_progress where character_id=(select id from characteristics_ids where label='owner')),
  0,
  'new character starts with zero authoritative characteristic points'
);

select lives_ok(format(
  'select public.set_astraeon_characteristics(%L::uuid,10,5,4,1)',
  (select id from characteristics_ids where label='owner')
),'owner can persist a valid characteristic distribution');

select is((select attribute_damage from public.character_progress where character_id=(select id from characteristics_ids where label='owner')),10,'damage points persist');
select is((select attribute_intelligence from public.character_progress where character_id=(select id from characteristics_ids where label='owner')),5,'intelligence points persist');
select is((select attribute_dexterity from public.character_progress where character_id=(select id from characteristics_ids where label='owner')),4,'dexterity points persist');
select is((select attribute_constitution from public.character_progress where character_id=(select id from characteristics_ids where label='owner')),1,'constitution points persist');

select lives_ok(format(
  'select public.set_astraeon_characteristics(%L::uuid,10,5,4,1)',
  (select id from characteristics_ids where label='owner')
),'saving the same distribution is idempotent');

select throws_ok(format(
  'select public.set_astraeon_characteristics(%L::uuid,9,5,4,1)',
  (select id from characteristics_ids where label='owner')
),'P0001','characteristic_respec_not_allowed','confirmed points cannot be reduced and recycled');

select throws_ok(format(
  'select public.set_astraeon_characteristics(%L::uuid,51,5,4,1)',
  (select id from characteristics_ids where label='owner')
),'P0001','characteristic_points_exceeded','client cannot spend more points than the authoritative level allows');

select set_config('request.jwt.claims','{"sub":"74100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok(format(
  'select public.set_astraeon_characteristics(%L::uuid,10,5,4,2)',
  (select id from characteristics_ids where label='owner')
),'P0001','character_not_found','another user cannot alter characteristics of a character they do not own');

reset role;
select is(
  has_table_privilege('authenticated','public.character_progress','UPDATE'),
  false,
  'authenticated clients still have no direct UPDATE privilege on authoritative progression'
);

select * from finish();
rollback;
