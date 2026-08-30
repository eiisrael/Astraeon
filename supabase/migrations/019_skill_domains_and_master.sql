-- ASTRAEON SKILLS 8.0 — authoritative class domains, purchases and loadout.
-- Execute after 018_service_role_authority_guard.sql.

begin;

create table if not exists public.skill_catalog (
  skill_id text primary key check (skill_id ~ '^[a-z]+_[a-z]+_[0-9]{2}$'),
  class_id text not null check (class_id in ('Warrior','Mage','Archer','Assassin','Paladine')),
  domain_code text not null,
  tier smallint not null check (tier between 1 and 10),
  point_cost smallint not null check (point_cost between 1 and 30),
  level_required integer not null check (level_required between 1 and 999),
  gold_cost bigint not null default 0 check (gold_cost >= 0),
  unique(class_id,domain_code,tier)
);

with domains(class_id,domain_code) as (
  values ('Warrior','vanguarda'),('Warrior','colosso'),('Mage','arcano'),('Mage','elemental'),
         ('Archer','cacada'),('Archer','tempestade'),('Assassin','sangue'),('Assassin','bruxo'),
         ('Paladine','juramento'),('Paladine','egide')
), tiers as (select generate_series(1,10)::smallint as tier)
insert into public.skill_catalog(skill_id,class_id,domain_code,tier,point_cost,level_required,gold_cost)
select lower(class_id)||'_'||domain_code||'_'||lpad(tier::text,2,'0'), class_id, domain_code, tier,
  (array[1,2,3,4,5,6,8,10,13,18])[tier],
  (array[1,3,6,10,15,21,28,36,45,60])[tier],
  case when tier=10 then 5000000 else 0 end
from domains cross join tiers
on conflict(skill_id) do update set class_id=excluded.class_id,domain_code=excluded.domain_code,
  tier=excluded.tier,point_cost=excluded.point_cost,level_required=excluded.level_required,gold_cost=excluded.gold_cost;

create table if not exists public.character_skills (
  character_id uuid not null references public.characters(id) on delete cascade,
  skill_id text not null references public.skill_catalog(skill_id) on delete restrict,
  equipped_slot smallint check (equipped_slot between 0 and 4),
  learned_at timestamptz not null default now(),
  primary key(character_id,skill_id)
);
create unique index if not exists character_skills_equipped_slot_idx
  on public.character_skills(character_id,equipped_slot) where equipped_slot is not null;
create index if not exists character_skills_character_idx on public.character_skills(character_id,learned_at);

alter table public.skill_catalog enable row level security;
alter table public.character_skills enable row level security;
drop policy if exists "astraeon_skill_catalog_read" on public.skill_catalog;
create policy "astraeon_skill_catalog_read" on public.skill_catalog for select to authenticated using (true);
drop policy if exists "astraeon_character_skills_read_own" on public.character_skills;
create policy "astraeon_character_skills_read_own" on public.character_skills for select to authenticated
  using (exists(select 1 from public.characters c where c.id=character_id and c.user_id=auth.uid()));

create or replace function public.get_astraeon_skill_state(target_character uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; character_level integer; character_gold bigint; spent integer; learned jsonb;
begin
  select user_id,level into owner_id,character_level from public.characters where id=target_character;
  if owner_id is null or (owner_id<>auth.uid() and not public.astraeon_is_admin()) then
    raise exception 'skill_access_denied' using errcode='42501';
  end if;
  select coalesce(sum(sc.point_cost),0),coalesce(jsonb_agg(jsonb_build_object('skillId',cs.skill_id,'slot',cs.equipped_slot) order by cs.learned_at),'[]'::jsonb)
    into spent,learned from public.character_skills cs join public.skill_catalog sc using(skill_id) where cs.character_id=target_character;
  select coalesce(gold,0) into character_gold from public.character_progress where character_id=target_character;
  return jsonb_build_object('characterId',target_character,'level',character_level,'earned',character_level*3,
    'spent',spent,'available',greatest(0,character_level*3-spent),'gold',coalesce(character_gold,0),'learned',coalesce(learned,'[]'::jsonb));
end;$$;

create or replace function public.purchase_astraeon_skill(target_character uuid,target_skill text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; character_class text; character_level integer; row_skill public.skill_catalog%rowtype;
  spent integer; missing_prior integer; current_gold bigint;
begin
  select user_id,class_id,level into owner_id,character_class,character_level from public.characters where id=target_character for update;
  if owner_id is null or owner_id<>auth.uid() then raise exception 'skill_access_denied' using errcode='42501'; end if;
  select * into row_skill from public.skill_catalog where skill_id=target_skill;
  if row_skill.skill_id is null or row_skill.class_id<>character_class then raise exception 'skill_wrong_class'; end if;
  if exists(select 1 from public.character_skills where character_id=target_character and skill_id=target_skill) then
    raise exception 'skill_already_learned';
  end if;
  if character_level<row_skill.level_required then raise exception 'skill_level_required'; end if;
  select coalesce(sum(sc.point_cost),0) into spent from public.character_skills cs join public.skill_catalog sc using(skill_id)
   where cs.character_id=target_character;
  if character_level*3-spent<row_skill.point_cost then raise exception 'skill_points_insufficient'; end if;
  if row_skill.tier=10 then
    select count(*) into missing_prior from public.skill_catalog sc where sc.class_id=row_skill.class_id and sc.domain_code=row_skill.domain_code
      and sc.tier<10 and not exists(select 1 from public.character_skills cs where cs.character_id=target_character and cs.skill_id=sc.skill_id);
    if missing_prior>0 then raise exception 'skill_domain_incomplete'; end if;
    select gold into current_gold from public.character_progress where character_id=target_character for update;
    if coalesce(current_gold,0)<row_skill.gold_cost then raise exception 'skill_gold_insufficient'; end if;
    update public.character_progress set gold=gold-row_skill.gold_cost where character_id=target_character;
  end if;
  insert into public.character_skills(character_id,skill_id) values(target_character,target_skill);
  perform public.record_astraeon_security_event('skill_purchased',owner_id,'skill_master',jsonb_build_object('character_id',target_character,'skill_id',target_skill));
  return public.get_astraeon_skill_state(target_character);
end;$$;

create or replace function public.equip_astraeon_skill(target_character uuid,target_skill text,target_slot smallint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;
begin
  if target_slot not between 0 and 4 then raise exception 'skill_slot_invalid'; end if;
  select user_id into owner_id from public.characters where id=target_character for update;
  if owner_id is null or owner_id<>auth.uid() then raise exception 'skill_access_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.character_skills where character_id=target_character and skill_id=target_skill) then raise exception 'skill_not_learned'; end if;
  update public.character_skills set equipped_slot=null where character_id=target_character and equipped_slot=target_slot;
  update public.character_skills set equipped_slot=target_slot where character_id=target_character and skill_id=target_skill;
  return public.get_astraeon_skill_state(target_character);
end;$$;

create or replace function public.admin_unlock_all_astraeon_skills(target_character uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare character_class text;
begin
  perform public.astraeon_require_admin(true);
  select class_id into character_class from public.characters where id=target_character;
  if character_class is null then raise exception 'character_not_found'; end if;
  insert into public.character_skills(character_id,skill_id)
    select target_character,skill_id from public.skill_catalog where class_id=character_class on conflict do nothing;
  update public.character_skills set equipped_slot=null where character_id=target_character;
  with first_five as (select skill_id,row_number() over(order by domain_code,tier)-1 as slot from public.skill_catalog where class_id=character_class order by domain_code,tier limit 5)
  update public.character_skills cs set equipped_slot=ff.slot from first_five ff where cs.character_id=target_character and cs.skill_id=ff.skill_id;
  perform public.record_astraeon_security_event('admin_all_skills_unlocked',auth.uid(),'admin_command',jsonb_build_object('character_id',target_character));
  return public.get_astraeon_skill_state(target_character);
end;$$;

revoke all on public.skill_catalog,public.character_skills from public,anon;
revoke insert,update,delete on public.skill_catalog,public.character_skills from authenticated;
grant select on public.skill_catalog,public.character_skills to authenticated;
revoke all on function public.get_astraeon_skill_state(uuid),public.purchase_astraeon_skill(uuid,text),public.equip_astraeon_skill(uuid,text,smallint),public.admin_unlock_all_astraeon_skills(uuid) from public,anon;
grant execute on function public.get_astraeon_skill_state(uuid),public.purchase_astraeon_skill(uuid,text),public.equip_astraeon_skill(uuid,text,smallint),public.admin_unlock_all_astraeon_skills(uuid) to authenticated;

commit;
