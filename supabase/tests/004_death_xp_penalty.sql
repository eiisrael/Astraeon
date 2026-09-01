-- Death XP penalty security contracts. Disposable DB only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('72000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','death-owner@example.invalid','',now(),'{}','{}',now(),now()),
('72100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','death-other@example.invalid','',now(),'{}','{}',now(),now());

create temporary table death_ids(label text primary key,id uuid not null);
grant select, insert on death_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into death_ids values('owner',(public.create_astraeon_character('DeathOwner','Warrior')).id);
reset role;

update public.character_progress
   set xp=1000,level=10
 where character_id=(select id from death_ids where label='owner');
update public.characters set level=10 where id=(select id from death_ids where label='owner');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok(format(
  'select public.apply_astraeon_death_penalty(%L::uuid,%L::uuid)',
  (select id from death_ids where label='owner'),
  '72000000-0000-4000-8000-000000000101'
),'owner can apply a death penalty');
select is((select xp from public.character_progress where character_id=(select id from death_ids where label='owner')),850::bigint,'15 percent of 1000 XP is removed');
select is((select level from public.character_progress where character_id=(select id from death_ids where label='owner')),10,'authoritative level never changes');
select is((select level from public.characters where id=(select id from death_ids where label='owner')),10,'character level never changes');
select is((select count(*) from public.progression_operations where operation_id='72000000-0000-4000-8000-000000000101'),0::bigint,'authenticated player cannot read the protected progression ledger');

reset role;
select is((select amount from public.progression_operations where operation_id='72000000-0000-4000-8000-000000000101'),(-150)::bigint,'protected ledger records only a negative XP amount');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok(format(
  'select public.apply_astraeon_death_penalty(%L::uuid,%L::uuid)',
  (select id from death_ids where label='owner'),
  '72000000-0000-4000-8000-000000000101'
),'same operation id is idempotent');
select is((select xp from public.character_progress where character_id=(select id from death_ids where label='owner')),850::bigint,'idempotent replay cannot subtract or award XP twice');

reset role;
update public.character_progress set xp=1 where character_id=(select id from death_ids where label='owner');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok(format(
  'select public.apply_astraeon_death_penalty(%L::uuid,%L::uuid)',
  (select id from death_ids where label='owner'),
  '72000000-0000-4000-8000-000000000102'
),'one remaining XP can be penalized');
select is((select xp from public.character_progress where character_id=(select id from death_ids where label='owner')),0::bigint,'death penalty clamps XP at zero');

select set_config('request.jwt.claims','{"sub":"72100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok(format(
  'select public.apply_astraeon_death_penalty(%L::uuid,%L::uuid)',
  (select id from death_ids where label='owner'),
  '72000000-0000-4000-8000-000000000103'
),'P0001','character_not_found','another user cannot penalize a character they do not own');

select * from finish();
rollback;
