-- Skill domains, economy and ownership contracts. Runs only on disposable test DB.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select is((select count(*) from public.skill_catalog),100::bigint,'catalog has 100 skills');
select is((select count(distinct domain_code) from public.skill_catalog where class_id='Warrior'),2::bigint,'each class exposes two domains');
select is((select count(*) from public.skill_catalog where tier=10 and gold_cost=5000000),10::bigint,'all ten ultimate skills cost five million gold');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('51000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-a@example.invalid','',now(),'{}','{}',now(),now()),
('52000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','skills-b@example.invalid','',now(),'{}','{}',now(),now()),
('53000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-admin@example.invalid','',now(),'{}','{}',now(),now());
update public.profiles set access=3 where id='53000000-0000-4000-8000-000000000003';
insert into public.characters(id,user_id,slot,name,class_id,level) values
('51100000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,'SkillA','Warrior',1),
('52200000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002',1,'SkillB','Assassin',60);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','warrior_vanguarda_01')$$,'owner buys first class skill');
select is((public.get_astraeon_skill_state('51100000-0000-4000-8000-000000000001')->>'available')::integer,2,'level one starts with three points');
select throws_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','mage_arcano_01')$$,'P0001','skill_wrong_class','cannot buy another class skill');
select throws_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','warrior_vanguarda_02')$$,'P0001','skill_level_required','level requirement is enforced');
select lives_ok($$select public.equip_astraeon_skill('51100000-0000-4000-8000-000000000001','warrior_vanguarda_01',0::smallint)$$,'owner equips learned skill');
select throws_ok($$insert into public.character_skills(character_id,skill_id) values('51100000-0000-4000-8000-000000000001','warrior_vanguarda_03')$$,'42501',null,'client cannot bypass purchase RPC');
select throws_ok($$select public.admin_unlock_all_astraeon_skills('51100000-0000-4000-8000-000000000001')$$,'42501','admin_access_required','normal player cannot use allskill authority');

select set_config('request.jwt.claims','{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_astraeon_skill_state('51100000-0000-4000-8000-000000000001')$$,'42501','skill_access_denied','another player cannot read skill state');
reset role;
insert into public.character_skills(character_id,skill_id)
 select '52200000-0000-4000-8000-000000000002',skill_id from public.skill_catalog where class_id='Assassin' and domain_code='sangue' and tier<10;
update public.character_progress set gold=4999999 where character_id='52200000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.purchase_astraeon_skill('52200000-0000-4000-8000-000000000002','assassin_sangue_10')$$,'P0001','skill_gold_insufficient','ultimate requires five million gold');
reset role;
update public.character_progress set gold=5000000 where character_id='52200000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.purchase_astraeon_skill('52200000-0000-4000-8000-000000000002','assassin_sangue_10')$$,'ultimate purchase succeeds after all requirements');
select is((select gold from public.character_progress where character_id='52200000-0000-4000-8000-000000000002'),0::bigint,'ultimate purchase deducts five million gold');

select set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.admin_unlock_all_astraeon_skills('51100000-0000-4000-8000-000000000001')$$,'MFA admin can unlock all class skills');
select * from finish();
rollback;
