-- ASTRAEON ADMIN 7.0 — paginated character listing and on-demand save detail.
-- Execute after 012_public_profiles.sql.

begin;

drop function if exists public.admin_list_characters_v6();

create or replace function public.admin_list_characters_v6(
  page_limit integer default 24,
  page_offset integer default 0,
  search_query text default null
)
returns table (
  character_id uuid,
  user_id uuid,
  email text,
  username text,
  slot smallint,
  name text,
  class_id text,
  level integer,
  created_at timestamptz,
  updated_at timestamptz,
  save_updated_at timestamptz,
  save_size_bytes bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(page_limit, 24), 100));
  safe_offset integer := greatest(0, least(coalesce(page_offset, 0), 1000000));
  safe_search text := left(btrim(coalesce(search_query, '')), 80);
begin
  perform public.astraeon_require_admin(false);

  return query
  select
    c.id,
    c.user_id,
    u.email::text,
    p.username,
    c.slot,
    c.name,
    c.class_id,
    c.level,
    c.created_at,
    c.updated_at,
    cs.updated_at,
    coalesce(octet_length(cs.save_data::text), 0)::bigint,
    count(*) over()::bigint
  from public.characters c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id
  left join public.character_saves cs on cs.character_id = c.id
  where safe_search = ''
     or u.email ilike '%' || safe_search || '%'
     or p.username ilike '%' || safe_search || '%'
     or c.name ilike '%' || safe_search || '%'
     or c.class_id ilike '%' || safe_search || '%'
  order by c.updated_at desc, u.email, c.slot
  limit safe_limit
  offset safe_offset;
end;
$$;

create or replace function public.admin_get_character_v6(target_character uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result jsonb;
begin
  perform public.astraeon_require_admin(false);
  select jsonb_build_object(
    'character_id', c.id,
    'user_id', c.user_id,
    'email', u.email,
    'username', p.username,
    'slot', c.slot,
    'name', c.name,
    'class_id', c.class_id,
    'level', c.level,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'save_data', cs.save_data,
    'world_seed', cs.world_seed,
    'save_updated_at', cs.updated_at,
    'save_size_bytes', coalesce(octet_length(cs.save_data::text), 0)
  ) into result
  from public.characters c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id
  left join public.character_saves cs on cs.character_id = c.id
  where c.id = target_character;

  if result is null then raise exception 'character_not_found'; end if;
  return result;
end;
$$;

create or replace function public.admin_update_character_v6(
  target_character uuid,
  target_name text,
  target_class_id text,
  target_level integer,
  target_save jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters;
begin
  perform public.astraeon_require_admin(true);
  select * into c from public.characters where id = target_character for update;
  if c.id is null then raise exception 'character_not_found'; end if;
  target_name := btrim(coalesce(target_name, ''));
  if char_length(target_name) < 1 or char_length(target_name) > 18 then raise exception 'invalid_character_name'; end if;
  if target_class_id not in ('Warrior','Mage','Archer','Assassin','Paladine') then raise exception 'invalid_character_class'; end if;
  target_level := greatest(1, least(999, coalesce(target_level, 1)));
  if target_save is not null and not public.validate_astraeon_save(target_save) then raise exception 'invalid_save'; end if;

  update public.characters
     set name = target_name, class_id = target_class_id, level = target_level
   where id = target_character;

  if target_save is not null then
    insert into public.character_saves(character_id, user_id, save_data, world_seed, updated_at)
    values(target_character, c.user_id, target_save, left(coalesce(target_save ->> 'seed', ''), 64), now())
    on conflict(character_id) do update
      set save_data = excluded.save_data,
          world_seed = excluded.world_seed,
          updated_at = now();
  end if;

  if exists (
    select 1 from public.profiles where id = c.user_id and active_character_id = target_character
  ) then
    update public.profiles
       set display_name = target_name, class_id = target_class_id, level = target_level
     where id = c.user_id;
  end if;

  perform public.record_astraeon_security_event(
    'admin_character_updated', c.user_id, 'admin_rpc',
    jsonb_build_object('character_id', target_character)
  );
  return true;
end;
$$;

create or replace function public.admin_delete_character_v6(target_character uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid;
begin
  perform public.astraeon_require_admin(true);
  select user_id into uid from public.characters where id = target_character for update;
  if uid is null then raise exception 'character_not_found'; end if;

  delete from public.characters where id = target_character;
  update public.profiles p
     set active_character_id = (
       select c.id from public.characters c where c.user_id = uid order by c.slot limit 1
     )
   where p.id = uid and (p.active_character_id = target_character or p.active_character_id is null);
  perform public.record_astraeon_security_event(
    'admin_character_deleted', uid, 'admin_rpc',
    jsonb_build_object('character_id', target_character)
  );
  return true;
end;
$$;

revoke all on function public.admin_list_characters_v6(integer,integer,text) from public;
revoke all on function public.admin_get_character_v6(uuid) from public;
revoke all on function public.admin_update_character_v6(uuid,text,text,integer,jsonb) from public;
revoke all on function public.admin_delete_character_v6(uuid) from public;
grant execute on function public.admin_list_characters_v6(integer,integer,text) to authenticated;
grant execute on function public.admin_get_character_v6(uuid) to authenticated;
grant execute on function public.admin_update_character_v6(uuid,text,text,integer,jsonb) to authenticated;
grant execute on function public.admin_delete_character_v6(uuid) to authenticated;

comment on function public.admin_list_characters_v6(integer,integer,text) is
  'Paginated metadata-only character list. save_data is deliberately excluded.';
comment on function public.admin_get_character_v6(uuid) is
  'Loads one character save on demand for an authorized administrator.';

commit;
