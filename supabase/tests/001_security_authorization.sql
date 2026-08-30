-- Run against a disposable Supabase test database with:
--   supabase test db
-- The transaction is rolled back and never changes production data.

begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','security-a@example.invalid','',now(),'{}','{}',now(),now()),
('20000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','security-b@example.invalid','',now(),'{}','{}',now(),now()),
('30000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','security-admin@example.invalid','',now(),'{}','{}',now(),now()),
('40000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','security-banned@example.invalid','',now(),'{}','{}',now(),now());

update public.profiles set access=3 where id='30000000-0000-4000-8000-000000000003';
update public.profiles set access=0 where id='40000000-0000-4000-8000-000000000004';

insert into public.characters(id,user_id,slot,name,class_id,level) values
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'UserA','Warrior',1),
('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',2,'UserA2','Mage',1),
('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',1,'UserB','Archer',1),
('44000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004',1,'Banned','Warrior',1);

insert into public.character_saves(character_id,user_id,save_data,world_seed) values
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"seed":"TEST","player":{"name":"UserA","classId":"Warrior","level":1,"x":100,"y":100,"hp":100,"maxHp":100,"mana":20,"maxMana":20,"xp":0},"gold":10,"inventory":[],"quest":{"biomes":[]}}','TEST'),
('22000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','{"seed":"TEST","player":{"name":"UserB","classId":"Archer","level":1,"x":100,"y":100,"hp":100,"maxHp":100,"mana":20,"maxMana":20,"xp":0},"gold":10,"inventory":[],"quest":{"biomes":[]}}','TEST'),
('44000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','{"seed":"TEST","player":{"name":"Banned","classId":"Warrior","level":1,"x":100,"y":100,"hp":100,"maxHp":100,"mana":20,"maxMana":20,"xp":0},"gold":10,"inventory":[],"quest":{"biomes":[]}}','TEST');

-- Scale fixture: 120 additional characters with non-trivial saves. The list RPC
-- must cap the page and return metadata only instead of these JSON documents.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select
  md5('astraeon-scale-user-' || value)::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated','authenticated',
  format('security-scale-%s@example.invalid', value),'',now(),'{}'::jsonb,'{}'::jsonb,now(),now()
from generate_series(1,120) as scale(value);

insert into public.characters(id,user_id,slot,name,class_id,level)
select
  md5('astraeon-scale-character-' || value)::uuid,
  md5('astraeon-scale-user-' || value)::uuid,
  1,
  'Scale' || value,
  'Warrior',
  1
from generate_series(1,120) as scale(value);

insert into public.character_saves(character_id,user_id,save_data,world_seed)
select
  md5('astraeon-scale-character-' || value)::uuid,
  md5('astraeon-scale-user-' || value)::uuid,
  jsonb_build_object(
    'seed','TEST','player',jsonb_build_object(
      'name','Scale' || value,'classId','Warrior','level',1,'x',100,'y',100,
      'hp',100,'maxHp',100,'mana',20,'maxMana',20,'xp',0
    ),
    'gold',10,'inventory','[]'::jsonb,'quest',jsonb_build_object('biomes','[]'::jsonb),
    'padding',repeat('x',16384)
  ),
  'TEST'
from generate_series(1,120) as scale(value);

create temporary table security_test_save_timestamps as
select character_id, updated_at
from public.character_saves
where character_id in (
  '22000000-0000-4000-8000-000000000002'::uuid,
  '44000000-0000-4000-8000-000000000004'::uuid
);

set local role anon;
select throws_ok($$select public.claim_username('Anonymous_1')$$,'42501','authentication_required','anonymous role cannot execute authenticated identity RPCs');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.character_saves where user_id='10000000-0000-4000-8000-000000000001'),1::bigint,'A reads own save');
select is((select count(*) from public.character_saves where user_id='20000000-0000-4000-8000-000000000002'),0::bigint,'A cannot read B save');
select lives_ok($$insert into public.character_saves(character_id,user_id,save_data,world_seed) values('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"seed":"TEST","player":{"name":"UserA2","classId":"Mage","level":1,"x":100,"y":100,"hp":100,"maxHp":100,"mana":20,"maxMana":20,"xp":0},"gold":10,"inventory":[],"quest":{"biomes":[]}}','TEST')$$,'A inserts a valid own save');
select lives_ok($$update public.character_saves set updated_at=now() where character_id='11000000-0000-4000-8000-000000000001'$$,'A updates own mutable save column');
update public.character_saves set updated_at=clock_timestamp()
where character_id='22000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select updated_at from public.character_saves where character_id='22000000-0000-4000-8000-000000000002'),
  (select updated_at from security_test_save_timestamps where character_id='22000000-0000-4000-8000-000000000002'),
  'A update against B changes no rows'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
delete from public.character_saves
where character_id='22000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select count(*) from public.character_saves where character_id='22000000-0000-4000-8000-000000000002'),
  1::bigint,
  'A cannot delete B save'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.profiles where id='10000000-0000-4000-8000-000000000001'),1::bigint,'A reads own internal profile');
select is((select count(*) from public.profiles where id='20000000-0000-4000-8000-000000000002'),0::bigint,'A cannot enumerate B internal profile');
select throws_ok($$update public.profiles set access=3 where id='10000000-0000-4000-8000-000000000001'$$,'42501',null,'A cannot self-promote');
select throws_ok($$select public.admin_list_profiles()$$,'42501','admin_access_required','A cannot list admin profiles');
select throws_ok($$select public.admin_set_access('20000000-0000-4000-8000-000000000002',3::smallint)$$,'42501','admin_access_required','A cannot change access');
select throws_ok($$select public.admin_get_player_detail('20000000-0000-4000-8000-000000000002')$$,'42501','admin_access_required','A cannot get player detail');
select throws_ok($$select public.admin_update_player_profile('20000000-0000-4000-8000-000000000002','UserB','User B','Archer',1,1::smallint)$$,'42501','admin_access_required','A cannot update player profile');
select throws_ok($$select public.admin_update_player_save('20000000-0000-4000-8000-000000000002','{}'::jsonb)$$,'42501','admin_access_required','A cannot update player save');
select throws_ok($$select public.admin_list_characters_v6()$$,'42501','admin_access_required','A cannot list characters');

reset role;
select throws_ok($$update public.character_saves set character_id='12000000-0000-4000-8000-000000000001' where character_id='11000000-0000-4000-8000-000000000001'$$,'42501','character_id_is_immutable','character id trigger rejects ownership swap');
select throws_ok($$update public.character_saves set user_id='20000000-0000-4000-8000-000000000002' where character_id='11000000-0000-4000-8000-000000000001'$$,'42501','user_id_is_immutable','user id trigger rejects ownership swap');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$insert into public.chat_messages(user_id,body) values('40000000-0000-4000-8000-000000000004','blocked')$$,'42501','online_access_required','banned chat denied');
update public.character_saves set updated_at=clock_timestamp()
where user_id='40000000-0000-4000-8000-000000000004';
reset role;
select is(
  (select updated_at from public.character_saves where character_id='44000000-0000-4000-8000-000000000004'),
  (select updated_at from security_test_save_timestamps where character_id='44000000-0000-4000-8000-000000000004'),
  'banned save mutation changes no rows'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.create_astraeon_character('Blocked','Warrior')$$,'42501','online_access_required','banned create denied');
select throws_ok($$select public.set_active_astraeon_character('44000000-0000-4000-8000-000000000004')$$,'42501','online_access_required','banned active character denied');
select throws_ok($$select public.delete_astraeon_character('44000000-0000-4000-8000-000000000004')$$,'42501','online_access_required','banned delete denied');
select throws_ok($$select public.claim_username('Blocked_1')$$,'42501','online_access_required','banned username claim denied');
select throws_ok($$select public.publish_astraeon_player_state(10,10,1::smallint,1,1780000000000)$$,'42501','online_access_required','banned realtime mutation denied');
select throws_ok($$select public.spend_astraeon_gold('44000000-0000-4000-8000-000000000004',1,'45000000-0000-4000-8000-000000000004')$$,'42501','online_access_required','banned gameplay economy RPC denied');

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.admin_list_characters_v6()$$,'admin can read paginated character list with aal1');
select is((select count(*) from public.admin_list_characters_v6(1000,0,null)),100::bigint,'admin page limit is capped at 100 rows');
select is((select max(total_count) from public.admin_list_characters_v6(1000,0,null)),124::bigint,'admin pagination reports the full 124-row scale fixture');
select ok((select max(save_size_bytes) from public.admin_list_characters_v6(1000,0,null)) > 16000,'admin list measures large saves without returning their JSON');
select throws_ok($$select public.admin_set_access('20000000-0000-4000-8000-000000000002',2::smallint)$$,'42501','admin_mfa_required','admin destructive mutation requires aal2');
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.admin_set_access('20000000-0000-4000-8000-000000000002',2::smallint)$$,'admin mutation succeeds with aal2');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.publish_astraeon_player_state(100,100,1::smallint,1,floor(extract(epoch from now())*1000)::bigint)$$,'runtime state accepts authenticated owner');
select is((select user_id from public.player_runtime_states limit 1),'10000000-0000-4000-8000-000000000001'::uuid,'runtime identity is derived from auth.uid');
select throws_ok($$update public.character_progress set gold=999999 where user_id='10000000-0000-4000-8000-000000000001'$$,'42501',null,'client cannot directly edit authoritative gold');
select throws_ok($$select public.apply_astraeon_progression_event('11000000-0000-4000-8000-000000000001','award_xp',10,null,null,'{}'::jsonb,'70000000-0000-4000-8000-000000000007')$$,'42501',null,'client cannot invoke the service-only progression gateway');

reset role;
set local role service_role;
select lives_ok($$select public.award_astraeon_xp('11000000-0000-4000-8000-000000000001',10,'80000000-0000-4000-8000-000000000008')$$,'trusted service can award XP to initialized progress');
select throws_ok($$select public.award_astraeon_xp('22000000-0000-4000-8000-000000000002',10,'80000000-0000-4000-8000-000000000008')$$,'P0001','operation_id_conflict','operation ID cannot be reused for another character');
select lives_ok($$select public.reconcile_astraeon_progression('11000000-0000-4000-8000-000000000001',100,2,50,'90000000-0000-4000-8000-000000000009','validated import batch 2026')$$,'trusted service can reconcile reviewed historical progression');

select * from finish();
rollback;
