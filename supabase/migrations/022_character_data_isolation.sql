-- ASTRAEON CHARACTERS 8.1 — hard isolation between character identities.
-- Execute after 021_skill_purchase_level_sync.sql.

begin;

create or replace function public.astraeon_initial_character_save(character_name text, character_class text)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  hp integer;
  mana integer;
  speed integer;
  power integer;
  defense integer;
  attack_range integer;
  crit numeric;
begin
  case character_class
    when 'Warrior' then hp:=190; mana:=70; speed:=178; power:=18; defense:=7; attack_range:=58; crit:=0.08;
    when 'Mage' then hp:=118; mana:=180; speed:=168; power:=24; defense:=2; attack_range:=230; crit:=0.12;
    when 'Archer' then hp:=138; mana:=120; speed:=188; power:=20; defense:=3; attack_range:=260; crit:=0.18;
    when 'Assassin' then hp:=128; mana:=130; speed:=205; power:=22; defense:=2; attack_range:=74; crit:=0.25;
    when 'Paladine' then hp:=172; mana:=120; speed:=170; power:=17; defense:=8; attack_range:=74; crit:=0.10;
    else raise exception 'invalid_character_class';
  end case;

  return jsonb_build_object(
    'version','2.0.0',
    'seed','',
    'player',jsonb_build_object(
      'name',left(coalesce(character_name,'Viajante'),18),
      'classId',character_class,
      'x',0,'y',0,
      'hp',hp,'maxHp',hp,
      'mana',mana,'maxMana',mana,
      'level',1,'xp',0,'xpNext',100,
      'power',power,'defense',defense,'speed',speed,'range',attack_range,'crit',crit,
      'attackCd',0,'invuln',0,'facing',1
    ),
    'gold',0,
    'inventory','[]'::jsonb,
    'quest',jsonb_build_object('kills',0,'biomes','[]'::jsonb,'reward',false),
    'meta',jsonb_build_object('initialized',false)
  );
end;
$$;

revoke all on function public.astraeon_initial_character_save(text,text) from public, anon;
grant execute on function public.astraeon_initial_character_save(text,text) to authenticated;

create or replace function public.create_astraeon_character(character_name text, character_class text)
returns public.characters
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  chosen_slot smallint;
  created public.characters;
begin
  perform public.astraeon_require_online_access();
  character_name := btrim(coalesce(character_name, ''));
  if char_length(character_name) < 1 or char_length(character_name) > 18 then
    raise exception 'invalid_character_name';
  end if;
  if character_class not in ('Warrior','Mage','Archer','Assassin','Paladine') then
    raise exception 'invalid_character_class';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text)::bigint);
  select s into chosen_slot
    from generate_series(1, 4) s
   where not exists (
     select 1 from public.characters c where c.user_id = uid and c.slot = s
   )
   order by s
   limit 1;
  if chosen_slot is null then raise exception 'character_limit_reached'; end if;

  insert into public.characters(user_id, slot, name, class_id)
  values(uid, chosen_slot, character_name, character_class)
  returning * into created;

  insert into public.character_saves(character_id,user_id,save_data,world_seed)
  values(
    created.id,
    uid,
    jsonb_set(public.astraeon_initial_character_save(created.name,created.class_id),'{meta,characterId}',to_jsonb(created.id),true),
    ''
  );

  update public.profiles
     set active_character_id = created.id,
         display_name = created.name,
         class_id = created.class_id,
         level = created.level
   where id = uid;

  perform public.record_astraeon_security_event(
    'character_created', uid, 'character_rpc',
    jsonb_build_object('character_id',created.id,'slot',created.slot,'class_id',created.class_id)
  );
  return created;
exception when unique_violation then
  raise exception 'character_name_in_use';
end;
$$;

create or replace function public.delete_astraeon_character(target_character uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  deleted_name text;
  fallback public.characters;
begin
  perform public.astraeon_require_online_access();
  select name into deleted_name
    from public.characters
   where id = target_character and user_id = uid
   for update;
  if deleted_name is null then raise exception 'character_not_found'; end if;

  delete from public.characters
   where id = target_character and user_id = uid;

  select * into fallback
    from public.characters
   where user_id = uid
   order by slot
   limit 1;

  update public.profiles p
     set active_character_id = fallback.id,
         display_name = coalesce(fallback.name,p.username,'Viajante'),
         class_id = coalesce(fallback.class_id,'Warrior'),
         level = coalesce(fallback.level,1)
   where p.id = uid;

  perform public.record_astraeon_security_event(
    'character_deleted', uid, 'character_rpc',
    jsonb_build_object('character_id',target_character,'name',deleted_name,'fallback_character_id',fallback.id)
  );
  return true;
end;
$$;

revoke all on function public.create_astraeon_character(text,text) from public, anon;
revoke all on function public.delete_astraeon_character(uuid) from public, anon;
grant execute on function public.create_astraeon_character(text,text) to authenticated;
grant execute on function public.delete_astraeon_character(uuid) to authenticated;

-- Every existing character gets its own row. Missing rows are pending fresh saves,
-- never aliases of another character's browser state.
insert into public.character_saves(character_id,user_id,save_data,world_seed)
select c.id,c.user_id,
  jsonb_set(public.astraeon_initial_character_save(c.name,c.class_id),'{meta,characterId}',to_jsonb(c.id),true),
  ''
from public.characters c
where not exists(select 1 from public.character_saves cs where cs.character_id=c.id)
on conflict(character_id) do nothing;

-- Mark known cross-character/class contamination as pending rebuild. The client
-- will create a clean class-specific save instead of loading a foreign identity.
update public.character_saves cs
   set save_data = jsonb_set(
     jsonb_set(
       jsonb_set(cs.save_data,'{player,name}',to_jsonb(c.name),true),
       '{player,classId}',to_jsonb(c.class_id),true
     ),
     '{meta}',
     coalesce(cs.save_data->'meta','{}'::jsonb) || jsonb_build_object(
       'characterId',c.id,
       'initialized',case
         when cs.save_data#>>'{player,classId}' is distinct from c.class_id then false
         when cs.save_data#>>'{meta,characterId}' is not null and cs.save_data#>>'{meta,characterId}' is distinct from c.id::text then false
         else case lower(coalesce(cs.save_data#>>'{meta,initialized}','')) when 'false' then false when 'true' then true else true end
       end
     ),
     true
   ) - 'skillsV1',
       updated_at = now()
  from public.characters c
 where c.id = cs.character_id;

comment on function public.create_astraeon_character(text,text) is
  'Creates the character and its dedicated character_saves row in one transaction.';
comment on function public.delete_astraeon_character(uuid) is
  'Deletes one character through FK cascades and synchronizes the profile identity to the fallback character.';

commit;
