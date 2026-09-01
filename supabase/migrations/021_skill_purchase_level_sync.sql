-- ASTRAEON SKILLS 8.1 — repair stale character levels used by the skill master.
-- The active profile is updated by the character save flow; use its newer level
-- while full gameplay progression authority is being integrated.

begin;

create or replace function public.get_astraeon_skill_state(target_character uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; character_level integer; character_gold bigint; spent integer; learned jsonb;
begin
  select c.user_id,greatest(c.level,coalesce(p.level,1))
    into owner_id,character_level
    from public.characters c left join public.profiles p on p.id=c.user_id
   where c.id=target_character;
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
  select c.user_id,c.class_id,greatest(c.level,coalesce(p.level,1))
    into owner_id,character_class,character_level
    from public.characters c left join public.profiles p on p.id=c.user_id
   where c.id=target_character for update of c;
  if owner_id is null or owner_id<>auth.uid() then raise exception 'skill_access_denied' using errcode='42501'; end if;
  select * into row_skill from public.skill_catalog where skill_id=target_skill;
  if row_skill.skill_id is null or row_skill.class_id<>character_class then raise exception 'skill_wrong_class'; end if;
  if exists(select 1 from public.character_skills where character_id=target_character and skill_id=target_skill) then raise exception 'skill_already_learned'; end if;
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
  update public.characters set level=greatest(level,character_level) where id=target_character;
  insert into public.character_skills(character_id,skill_id) values(target_character,target_skill);
  perform public.record_astraeon_security_event('skill_purchased',owner_id,'skill_master',jsonb_build_object('character_id',target_character,'skill_id',target_skill));
  return public.get_astraeon_skill_state(target_character);
end;$$;

revoke all on function public.get_astraeon_skill_state(uuid),public.purchase_astraeon_skill(uuid,text) from public,anon;
grant execute on function public.get_astraeon_skill_state(uuid),public.purchase_astraeon_skill(uuid,text) to authenticated;

commit;
