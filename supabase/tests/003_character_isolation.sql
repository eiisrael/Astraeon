-- Character creation/deletion isolation contracts. Disposable DB only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','isolation@example.invalid','',now(),'{}','{}',now(),now());

create temporary table isolation_ids(label text primary key,id uuid not null);
grant select, insert on isolation_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into isolation_ids values('paladine',(public.create_astraeon_character('PalAntigo','Paladine')).id);
insert into isolation_ids values('warrior',(public.create_astraeon_character('GuerreiroNovo','Warrior')).id);

select isnt((select id from isolation_ids where label='paladine'),(select id from isolation_ids where label='warrior'),'characters receive distinct UUIDs');
select is((select count(*) from public.character_saves where user_id='71000000-0000-4000-8000-000000000001'),2::bigint,'each character owns a dedicated save row');
select is((select save_data#>>'{player,classId}' from public.character_saves where character_id=(select id from isolation_ids where label='paladine')),'Paladine','paladine save identity is isolated');
select is((select save_data#>>'{player,classId}' from public.character_saves where character_id=(select id from isolation_ids where label='warrior')),'Warrior','warrior save identity is isolated');
select is((select save_data#>>'{meta,initialized}' from public.character_saves where character_id=(select id from isolation_ids where label='warrior')),'false','new server save starts pending client initialization');
select is((select save_data#>>'{meta,characterId}' from public.character_saves where character_id=(select id from isolation_ids where label='warrior')),(select id::text from isolation_ids where label='warrior'),'save is stamped with its own character UUID');

reset role;
insert into public.character_skills(character_id,skill_id)
values((select id from isolation_ids where label='paladine'),'paladine_juramento_01');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok(format('select public.set_active_astraeon_character(%L::uuid)',(select id from isolation_ids where label='paladine')),'deleted candidate can be made active');
select lives_ok(format('select public.delete_astraeon_character(%L::uuid)',(select id from isolation_ids where label='paladine')),'active character deletion succeeds');
select is((select active_character_id from public.profiles where id='71000000-0000-4000-8000-000000000001'),(select id from isolation_ids where label='warrior'),'profile falls back to the remaining character');
select is((select class_id from public.profiles where id='71000000-0000-4000-8000-000000000001'),'Warrior','profile class follows fallback instead of deleted paladine');
select is((select display_name from public.profiles where id='71000000-0000-4000-8000-000000000001'),'GuerreiroNovo','profile display name follows fallback character');
select is((select count(*) from public.character_saves where character_id=(select id from isolation_ids where label='paladine')),0::bigint,'deleted character save cascades away');
select is((select count(*) from public.character_skills where character_id=(select id from isolation_ids where label='paladine')),0::bigint,'deleted character skills cascade away');

select * from finish();
rollback;
