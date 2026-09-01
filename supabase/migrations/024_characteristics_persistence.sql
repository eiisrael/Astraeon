-- Persistência autoritativa dos pontos do painel C por personagem.
-- Mantém o save JSON como espelho de compatibilidade, mas o orçamento de pontos
-- passa a ser validado no banco usando o nível autoritativo.

begin;

alter table public.character_progress
  add column if not exists attribute_damage integer not null default 0,
  add column if not exists attribute_intelligence integer not null default 0,
  add column if not exists attribute_dexterity integer not null default 0,
  add column if not exists attribute_constitution integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='character_progress_attributes_nonnegative') then
    alter table public.character_progress
      add constraint character_progress_attributes_nonnegative check (
        attribute_damage between 0 and 4000 and
        attribute_intelligence between 0 and 4000 and
        attribute_dexterity between 0 and 4000 and
        attribute_constitution between 0 and 4000
      );
  end if;
end $$;

-- Migra somente distribuições legadas estruturalmente válidas e que respeitam
-- o orçamento permitido pelo nível. JSON suspeito ou acima do orçamento é ignorado.
with raw as (
  select
    cp.character_id,
    cp.level,
    coalesce(nullif(cs.save_data #>> '{characteristics,attributes,damage}',''), nullif(cs.save_data #>> '{player,characteristics,damage}',''), '0') as damage_text,
    coalesce(nullif(cs.save_data #>> '{characteristics,attributes,intelligence}',''), nullif(cs.save_data #>> '{player,characteristics,intelligence}',''), '0') as intelligence_text,
    coalesce(nullif(cs.save_data #>> '{characteristics,attributes,dexterity}',''), nullif(cs.save_data #>> '{player,characteristics,dexterity}',''), '0') as dexterity_text,
    coalesce(nullif(cs.save_data #>> '{characteristics,attributes,constitution}',''), nullif(cs.save_data #>> '{player,characteristics,constitution}',''), '0') as constitution_text
  from public.character_progress cp
  left join public.character_saves cs on cs.character_id=cp.character_id
), parsed as (
  select
    character_id,
    level,
    case when damage_text ~ '^[0-9]{1,4}$' then damage_text::integer else 0 end as damage,
    case when intelligence_text ~ '^[0-9]{1,4}$' then intelligence_text::integer else 0 end as intelligence,
    case when dexterity_text ~ '^[0-9]{1,4}$' then dexterity_text::integer else 0 end as dexterity,
    case when constitution_text ~ '^[0-9]{1,4}$' then constitution_text::integer else 0 end as constitution
  from raw
), valid as (
  select *,
    least(level,50)*5 + greatest(level-50,0)*3 as earned
  from parsed
)
update public.character_progress cp
   set attribute_damage=v.damage,
       attribute_intelligence=v.intelligence,
       attribute_dexterity=v.dexterity,
       attribute_constitution=v.constitution
  from valid v
 where cp.character_id=v.character_id
   and cp.attribute_damage=0
   and cp.attribute_intelligence=0
   and cp.attribute_dexterity=0
   and cp.attribute_constitution=0
   and (v.damage+v.intelligence+v.dexterity+v.constitution) <= v.earned;

create or replace function public.set_astraeon_characteristics(
  target_character uuid,
  damage_points integer,
  intelligence_points integer,
  dexterity_points integer,
  constitution_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  current_row public.character_progress%rowtype;
  earned integer;
  spent integer;
begin
  perform public.astraeon_require_online_access();

  if target_character is null
     or damage_points is null or intelligence_points is null
     or dexterity_points is null or constitution_points is null
     or damage_points not between 0 and 4000
     or intelligence_points not between 0 and 4000
     or dexterity_points not between 0 and 4000
     or constitution_points not between 0 and 4000 then
    raise exception 'invalid_characteristics';
  end if;

  select cp.* into current_row
    from public.character_progress cp
    join public.characters c on c.id=cp.character_id
   where cp.character_id=target_character
     and cp.user_id=uid
     and c.user_id=uid
   for update of cp;

  if not found then raise exception 'character_not_found'; end if;

  earned := least(current_row.level,50)*5 + greatest(current_row.level-50,0)*3;
  spent := damage_points + intelligence_points + dexterity_points + constitution_points;

  if spent > earned then raise exception 'characteristic_points_exceeded'; end if;

  -- Não existe respec neste sistema. Um cliente adulterado não pode diminuir um
  -- atributo já confirmado para realocar os mesmos pontos em outro atributo.
  if damage_points < current_row.attribute_damage
     or intelligence_points < current_row.attribute_intelligence
     or dexterity_points < current_row.attribute_dexterity
     or constitution_points < current_row.attribute_constitution then
    raise exception 'characteristic_respec_not_allowed';
  end if;

  update public.character_progress
     set attribute_damage=damage_points,
         attribute_intelligence=intelligence_points,
         attribute_dexterity=dexterity_points,
         attribute_constitution=constitution_points
   where character_id=target_character and user_id=uid;

  return jsonb_build_object(
    'damage',damage_points,
    'intelligence',intelligence_points,
    'dexterity',dexterity_points,
    'constitution',constitution_points,
    'spent',spent,
    'earned',earned,
    'level',current_row.level
  );
end;
$$;

revoke all on function public.set_astraeon_characteristics(uuid,integer,integer,integer,integer) from public;
grant execute on function public.set_astraeon_characteristics(uuid,integer,integer,integer,integer) to authenticated;

comment on function public.set_astraeon_characteristics(uuid,integer,integer,integer,integer) is
  'Persiste características por personagem, valida orçamento pelo nível autoritativo e impede respec/redução pelo cliente.';

commit;
