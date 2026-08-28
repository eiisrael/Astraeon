-- ASTRAEON ADMIN 6.0 — multi-character administrative tools
-- Execute after 006_characters_itemlist.sql.

create or replace function public.admin_list_characters_v6()
returns table(
  character_id uuid,user_id uuid,email text,username text,slot smallint,name text,class_id text,level integer,
  created_at timestamptz,updated_at timestamptz,save_data jsonb,world_seed text,save_updated_at timestamptz
)
language plpgsql security definer set search_path=public,auth,pg_temp
as $$
begin
  if not public.astraeon_is_admin() then raise exception 'admin_access_required' using errcode='42501'; end if;
  return query
  select c.id,c.user_id,u.email::text,p.username,c.slot,c.name,c.class_id,c.level,c.created_at,c.updated_at,
         cs.save_data,cs.world_seed,cs.updated_at
  from public.characters c
  join auth.users u on u.id=c.user_id
  left join public.profiles p on p.id=c.user_id
  left join public.character_saves cs on cs.character_id=c.id
  order by u.email,c.slot;
end;$$;
revoke all on function public.admin_list_characters_v6() from public;
grant execute on function public.admin_list_characters_v6() to authenticated;

create or replace function public.admin_update_character_v6(
  target_character uuid,target_name text,target_class_id text,target_level integer,target_save jsonb
)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
declare c public.characters;
begin
  if not public.astraeon_is_admin() then raise exception 'admin_access_required' using errcode='42501'; end if;
  select * into c from public.characters where id=target_character;
  if c.id is null then raise exception 'character_not_found'; end if;
  target_name=btrim(coalesce(target_name,''));
  if char_length(target_name)<1 or char_length(target_name)>18 then raise exception 'invalid_character_name'; end if;
  if target_class_id not in ('Warrior','Mage','Archer','Assassin','Paladine') then raise exception 'invalid_character_class'; end if;
  target_level=greatest(1,least(999,coalesce(target_level,1)));
  update public.characters set name=target_name,class_id=target_class_id,level=target_level where id=target_character;
  if target_save is not null then
    insert into public.character_saves(character_id,user_id,save_data,world_seed,updated_at)
    values(target_character,c.user_id,target_save,coalesce(target_save->>'seed',''),now())
    on conflict(character_id) do update set save_data=excluded.save_data,world_seed=excluded.world_seed,updated_at=now();
  end if;
  if exists(select 1 from public.profiles where id=c.user_id and active_character_id=target_character) then
    update public.profiles set display_name=target_name,class_id=target_class_id,level=target_level where id=c.user_id;
  end if;
  return true;
end;$$;
revoke all on function public.admin_update_character_v6(uuid,text,text,integer,jsonb) from public;
grant execute on function public.admin_update_character_v6(uuid,text,text,integer,jsonb) to authenticated;

create or replace function public.admin_delete_character_v6(target_character uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
declare uid uuid;
begin
  if not public.astraeon_is_admin() then raise exception 'admin_access_required' using errcode='42501'; end if;
  select user_id into uid from public.characters where id=target_character;
  if uid is null then raise exception 'character_not_found'; end if;
  delete from public.characters where id=target_character;
  update public.profiles p set active_character_id=(select c.id from public.characters c where c.user_id=uid order by c.slot limit 1)
  where p.id=uid and (p.active_character_id=target_character or p.active_character_id is null);
  return true;
end;$$;
revoke all on function public.admin_delete_character_v6(uuid) from public;
grant execute on function public.admin_delete_character_v6(uuid) to authenticated;
