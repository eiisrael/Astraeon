-- Skill domains, economy and ownership contracts. Runs only on disposable test DB.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select is((select count(*) from public.skill_catalog),100::bigint,'catalog has 100 skills');
select is((select count(distinct domain_code) from public.skill_catalog where class_id='Warrior'),2::bigint,'each class exposes two domains');
select is((select count(*) from public.skill_catalog where tier=10 and gold_cost=5000000),10::bigint,'all ten ultimate skills cost five million gold');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('51000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-a@example.invalid','',now(),'{}','{}',now(),now()),
('52000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','skills-b@example.invalid','',now(),'{}','{}',now(),now()),
('53000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-admin@example.invalid','',now(),'{}','{}',now(),now()),
('61000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-warrior-all@example.invalid','',now(),'{}','{}',now(),now()),
('62000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-mage-all@example.invalid','',now(),'{}','{}',now(),now()),
('63000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-archer-all@example.invalid','',now(),'{}','{}',now(),now()),
('64000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-assassin-all@example.invalid','',now(),'{}','{}',now(),now()),
('65000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','skills-paladine-all@example.invalid','',now(),'{}','{}',now(),now());
update public.profiles set access=3 where id='53000000-0000-4000-8000-000000000003';
insert into public.characters(id,user_id,slot,name,class_id,level) values
('51100000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,'SkillA','Warrior',1),
('52200000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002',1,'SkillB','Assassin',60),
('61100000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',1,'AllWarrior','Warrior',60),
('62200000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000002',1,'AllMage','Mage',60),
('63300000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000003',1,'AllArcher','Archer',60),
('64400000-0000-4000-8000-000000000004','64000000-0000-4000-8000-000000000004',1,'AllAssassin','Assassin',60),
('65500000-0000-4000-8000-000000000005','65000000-0000-4000-8000-000000000005',1,'AllPaladine','Paladine',60);
update public.character_progress set gold=10000000 where character_id in (
 '61100000-0000-4000-8000-000000000001','62200000-0000-4000-8000-000000000002',
 '63300000-0000-4000-8000-000000000003','64400000-0000-4000-8000-000000000004',
 '65500000-0000-4000-8000-000000000005'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','warrior_vanguarda_01')$$,'owner buys first class skill');
select is((public.get_astraeon_skill_state('51100000-0000-4000-8000-000000000001')->>'available')::integer,2,'level one starts with three points');
select throws_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','mage_arcano_01')$$,'P0001','skill_wrong_class','cannot buy another class skill');
select throws_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','warrior_vanguarda_02')$$,'P0001','skill_level_required','level requirement is enforced');
update public.profiles set level=10 where id='51000000-0000-4000-8000-000000000001';
select lives_ok($$select public.purchase_astraeon_skill('51100000-0000-4000-8000-000000000001','warrior_vanguarda_02')$$,'profile level repairs stale character level during purchase');
select is((public.get_astraeon_skill_state('51100000-0000-4000-8000-000000000001')->>'level')::integer,10,'skill state exposes the effective active level');
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

reset role;
set local role authenticated;
select lives_ok($purchase_all$
do $body$
declare actor record; selected_skill record;
begin
  for actor in select * from (values
    ('61000000-0000-4000-8000-000000000001'::uuid,'61100000-0000-4000-8000-000000000001'::uuid,'Warrior'::text),
    ('62000000-0000-4000-8000-000000000002'::uuid,'62200000-0000-4000-8000-000000000002'::uuid,'Mage'::text),
    ('63000000-0000-4000-8000-000000000003'::uuid,'63300000-0000-4000-8000-000000000003'::uuid,'Archer'::text),
    ('64000000-0000-4000-8000-000000000004'::uuid,'64400000-0000-4000-8000-000000000004'::uuid,'Assassin'::text),
    ('65000000-0000-4000-8000-000000000005'::uuid,'65500000-0000-4000-8000-000000000005'::uuid,'Paladine'::text)
  ) as rows(user_id,character_id,class_id)
  loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.user_id,'role','authenticated','aal','aal1')::text,true);
    for selected_skill in select skill_id from public.skill_catalog where class_id=actor.class_id order by domain_code,tier
    loop
      perform public.purchase_astraeon_skill(actor.character_id,selected_skill.skill_id);
    end loop;
  end loop;
end
$body$;
$purchase_all$,'all five classes can purchase all twenty skills through the authoritative RPC');
reset role;
select is((select count(*) from public.character_skills where character_id in (
 '61100000-0000-4000-8000-000000000001','62200000-0000-4000-8000-000000000002',
 '63300000-0000-4000-8000-000000000003','64400000-0000-4000-8000-000000000004',
 '65500000-0000-4000-8000-000000000005')),100::bigint,'all class purchase paths learn exactly one hundred skills');
select is((select sum(gold) from public.character_progress where character_id in (
 '61100000-0000-4000-8000-000000000001','62200000-0000-4000-8000-000000000002',
 '63300000-0000-4000-8000-000000000003','64400000-0000-4000-8000-000000000004',
 '65500000-0000-4000-8000-000000000005')),0::numeric,'both ultimate purchases deduct ten million gold per class');
select * from finish();
rollback;
