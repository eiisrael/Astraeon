-- ASTRAEON SECURITY 7.0 — authorization, immutable ownership, save integrity,
-- chat rate limiting, admin MFA and security audit foundations.
-- Execute after 010_inventory_standard_slots.sql.

begin;

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type ~ '^[a-z0-9_\-]{3,64}$'),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'database' check (char_length(source) between 1 and 32),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 16384),
  created_at timestamptz not null default now()
);

create index if not exists security_events_created_idx
  on public.security_events(created_at desc);
create index if not exists security_events_actor_idx
  on public.security_events(actor_id, created_at desc);
create index if not exists security_events_type_idx
  on public.security_events(event_type, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists "astraeon_security_events_admin_read" on public.security_events;
create policy "astraeon_security_events_admin_read"
on public.security_events for select to authenticated
using (public.astraeon_is_admin());

revoke all on public.security_events from anon, authenticated;
grant select on public.security_events to authenticated;

create or replace function public.record_astraeon_security_event(
  event_name text,
  target_user uuid default null,
  event_source text default 'database',
  event_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if event_name is null or event_name !~ '^[a-z0-9_\-]{3,64}$' then
    return;
  end if;

  insert into public.security_events(event_type, actor_id, target_user_id, source, details)
  values (
    event_name,
    auth.uid(),
    target_user,
    left(coalesce(nullif(event_source, ''), 'database'), 32),
    case
      when jsonb_typeof(coalesce(event_details, '{}'::jsonb)) = 'object'
        and octet_length(coalesce(event_details, '{}'::jsonb)::text) <= 16384
      then coalesce(event_details, '{}'::jsonb)
      else '{}'::jsonb
    end
  );
end;
$$;

revoke all on function public.record_astraeon_security_event(text,uuid,text,jsonb) from public;

create or replace function public.astraeon_require_online_access()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not public.astraeon_has_online_access() then
    raise exception 'online_access_required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.astraeon_require_online_access() from public;
grant execute on function public.astraeon_require_online_access() to authenticated;

create or replace function public.astraeon_is_admin_mfa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.astraeon_is_admin()
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke all on function public.astraeon_is_admin_mfa() from public;
grant execute on function public.astraeon_is_admin_mfa() to authenticated;

create or replace function public.astraeon_require_admin(require_mfa boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.astraeon_is_admin() then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;
  if require_mfa and not public.astraeon_is_admin_mfa() then
    raise exception 'admin_mfa_required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.astraeon_require_admin(boolean) from public;
grant execute on function public.astraeon_require_admin(boolean) to authenticated;

create or replace function public.claim_username(desired text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.astraeon_require_online_access();
  if desired is null or desired !~ '^[A-Za-z0-9_]{3,18}$' then
    return false;
  end if;
  update public.profiles
     set username = desired,
         display_name = desired,
         updated_at = now()
   where id = auth.uid();
  return found;
exception when unique_violation then
  return false;
end;
$$;

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

  update public.profiles
     set active_character_id = created.id,
         display_name = created.name,
         class_id = created.class_id,
         level = created.level
   where id = uid;
  return created;
exception when unique_violation then
  raise exception 'character_name_in_use';
end;
$$;

create or replace function public.set_active_astraeon_character(target_character uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.characters;
begin
  perform public.astraeon_require_online_access();
  select * into c
    from public.characters
   where id = target_character
     and user_id = auth.uid();
  if c.id is null then raise exception 'character_not_found'; end if;

  update public.profiles
     set active_character_id = c.id,
         display_name = c.name,
         class_id = c.class_id,
         level = c.level
   where id = auth.uid();
  return true;
end;
$$;

create or replace function public.delete_astraeon_character(target_character uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.astraeon_require_online_access();
  if not exists (
    select 1 from public.characters
     where id = target_character and user_id = auth.uid()
  ) then
    raise exception 'character_not_found';
  end if;

  delete from public.characters
   where id = target_character and user_id = auth.uid();
  update public.profiles p
     set active_character_id = (
       select c.id from public.characters c
        where c.user_id = auth.uid() order by c.slot limit 1
     )
   where p.id = auth.uid();
  return true;
end;
$$;

revoke all on function public.claim_username(text) from public;
revoke all on function public.create_astraeon_character(text,text) from public;
revoke all on function public.set_active_astraeon_character(uuid) from public;
revoke all on function public.delete_astraeon_character(uuid) from public;
grant execute on function public.claim_username(text) to authenticated;
grant execute on function public.create_astraeon_character(text,text) to authenticated;
grant execute on function public.set_active_astraeon_character(uuid) to authenticated;
grant execute on function public.delete_astraeon_character(uuid) to authenticated;

drop policy if exists "astraeon_character_saves_update_own" on public.character_saves;
create policy "astraeon_character_saves_update_own"
on public.character_saves
for update
to authenticated
using (
  user_id = auth.uid()
  and public.astraeon_has_online_access()
  and exists (
    select 1 from public.characters c
     where c.id = character_id and c.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and public.astraeon_has_online_access()
  and exists (
    select 1 from public.characters c
     where c.id = character_id and c.user_id = auth.uid()
  )
);

create or replace function public.guard_character_save_identity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.character_id is distinct from new.character_id then
    raise exception 'character_id_is_immutable' using errcode = '42501';
  end if;
  if old.user_id is distinct from new.user_id then
    raise exception 'user_id_is_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists character_saves_guard_identity on public.character_saves;
create trigger character_saves_guard_identity
before update on public.character_saves
for each row execute function public.guard_character_save_identity();

revoke update on public.character_saves from authenticated;
grant update (save_data, world_seed, updated_at)
on public.character_saves to authenticated;

-- Username changes use claim_username(); active_character_id uses the ownership-aware RPC.
revoke insert, update on public.profiles from authenticated;
grant insert (id, username, display_name, class_id, level, last_seen)
on public.profiles to authenticated;
grant update (display_name, class_id, level, last_seen)
on public.profiles to authenticated;

create or replace function public.validate_astraeon_save(candidate jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  player jsonb;
  inventory jsonb;
begin
  if candidate is null or jsonb_typeof(candidate) <> 'object' then return false; end if;
  if octet_length(candidate::text) > 1048576 then return false; end if;

  player := candidate -> 'player';
  inventory := candidate -> 'inventory';
  if jsonb_typeof(player) <> 'object' then return false; end if;
  if jsonb_typeof(inventory) <> 'array' or jsonb_array_length(inventory) > 200 then return false; end if;

  if jsonb_typeof(player -> 'name') <> 'string'
     or char_length(player ->> 'name') not between 1 and 18 then return false; end if;
  if jsonb_typeof(player -> 'classId') <> 'string'
     or player ->> 'classId' not in ('Warrior','Mage','Archer','Assassin','Paladine') then return false; end if;
  if jsonb_typeof(player -> 'level') <> 'number'
     or (player ->> 'level')::numeric not between 1 and 999 then return false; end if;
  if jsonb_typeof(candidate -> 'gold') <> 'number'
     or (candidate ->> 'gold')::numeric not between 0 and 1000000000 then return false; end if;
  if jsonb_typeof(player -> 'x') <> 'number'
     or jsonb_typeof(player -> 'y') <> 'number'
     or abs((player ->> 'x')::numeric) > 10000000
     or abs((player ->> 'y')::numeric) > 10000000 then return false; end if;
  if jsonb_typeof(player -> 'hp') <> 'number'
     or jsonb_typeof(player -> 'maxHp') <> 'number'
     or (player ->> 'hp')::numeric < 0
     or (player ->> 'maxHp')::numeric not between 1 and 1000000000 then return false; end if;
  if jsonb_typeof(player -> 'mana') <> 'number'
     or jsonb_typeof(player -> 'maxMana') <> 'number'
     or (player ->> 'mana')::numeric < 0
     or (player ->> 'maxMana')::numeric not between 0 and 1000000000 then return false; end if;
  if candidate ? 'seed' and (
     jsonb_typeof(candidate -> 'seed') <> 'string'
     or char_length(candidate ->> 'seed') > 64
  ) then return false; end if;
  if candidate ? 'quest' and jsonb_typeof(candidate -> 'quest') <> 'object' then return false; end if;
  if jsonb_typeof(candidate #> '{quest,biomes}') = 'array'
     and jsonb_array_length(candidate #> '{quest,biomes}') > 10 then return false; end if;

  return true;
exception when numeric_value_out_of_range or invalid_text_representation then
  return false;
end;
$$;

revoke all on function public.validate_astraeon_save(jsonb) from public;
grant execute on function public.validate_astraeon_save(jsonb) to authenticated;

alter table public.character_saves
  drop constraint if exists character_saves_structure_check;
alter table public.character_saves
  add constraint character_saves_structure_check
  check (public.validate_astraeon_save(save_data)) not valid;

alter table public.player_saves
  drop constraint if exists player_saves_structure_check;
alter table public.player_saves
  add constraint player_saves_structure_check
  check (public.validate_astraeon_save(save_data)) not valid;

create or replace function public.guard_astraeon_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid;
  profile_name text;
  recent_count integer;
begin
  perform public.astraeon_require_online_access();
  uid := auth.uid();
  perform pg_advisory_xact_lock(hashtext(uid::text)::bigint);

  select username into profile_name from public.profiles where id = uid;
  if profile_name is null then raise exception 'profile_required'; end if;

  new.user_id := uid;
  new.username := profile_name;
  new.channel := 'world';
  new.created_at := now();
  new.body := btrim(regexp_replace(coalesce(new.body, ''), '[[:cntrl:]]', ' ', 'g'));
  new.body := regexp_replace(new.body, '[[:space:]]+', ' ', 'g');

  if char_length(new.body) < 1 or char_length(new.body) > 240 then
    raise exception 'invalid_chat_message';
  end if;
  if exists (
    select 1 from public.chat_messages
     where user_id = uid and created_at > now() - interval '900 milliseconds'
  ) then
    raise exception 'chat_rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into recent_count
    from public.chat_messages
   where user_id = uid and created_at > now() - interval '60 seconds';
  if recent_count >= 20 then
    raise exception 'chat_rate_limited_window' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Administrative reads remain available to Access 3. Mutations require aal2.
drop policy if exists "astraeon_system_messages_admin_insert" on public.system_messages;
create policy "astraeon_system_messages_admin_insert" on public.system_messages
for insert to authenticated with check (public.astraeon_is_admin_mfa());
drop policy if exists "astraeon_system_messages_admin_update" on public.system_messages;
create policy "astraeon_system_messages_admin_update" on public.system_messages
for update to authenticated using (public.astraeon_is_admin_mfa()) with check (public.astraeon_is_admin_mfa());
drop policy if exists "astraeon_system_messages_admin_delete" on public.system_messages;
create policy "astraeon_system_messages_admin_delete" on public.system_messages
for delete to authenticated using (public.astraeon_is_admin_mfa());

drop policy if exists "astraeon_mob_configs_admin_insert" on public.mob_configs;
create policy "astraeon_mob_configs_admin_insert" on public.mob_configs
for insert to authenticated with check (public.astraeon_is_admin_mfa());
drop policy if exists "astraeon_mob_configs_admin_update" on public.mob_configs;
create policy "astraeon_mob_configs_admin_update" on public.mob_configs
for update to authenticated using (public.astraeon_is_admin_mfa()) with check (public.astraeon_is_admin_mfa());
drop policy if exists "astraeon_mob_configs_admin_delete" on public.mob_configs;
create policy "astraeon_mob_configs_admin_delete" on public.mob_configs
for delete to authenticated using (public.astraeon_is_admin_mfa());

drop policy if exists "astraeon_items_admin_all" on public.item_configs;
create policy "astraeon_items_admin_all" on public.item_configs
for all to authenticated using (public.astraeon_is_admin_mfa()) with check (public.astraeon_is_admin_mfa());

drop policy if exists "astraeon_world_maps_admin_all" on public.world_maps;
create policy "astraeon_world_maps_admin_all" on public.world_maps
for all to authenticated using (public.astraeon_is_admin_mfa()) with check (public.astraeon_is_admin_mfa());
drop policy if exists "astraeon_world_places_admin_all" on public.world_places;
create policy "astraeon_world_places_admin_all" on public.world_places
for all to authenticated using (public.astraeon_is_admin_mfa()) with check (public.astraeon_is_admin_mfa());

drop policy if exists "astraeon_admin_backups_admin_insert" on public.admin_backups;
create policy "astraeon_admin_backups_admin_insert" on public.admin_backups
for insert to authenticated with check (public.astraeon_is_admin_mfa() and created_by = auth.uid());
drop policy if exists "astraeon_admin_backups_admin_delete" on public.admin_backups;
create policy "astraeon_admin_backups_admin_delete" on public.admin_backups
for delete to authenticated using (public.astraeon_is_admin_mfa());
drop policy if exists "astraeon_admin_runtime_config_admin_all" on public.admin_runtime_config;
create policy "astraeon_admin_runtime_config_admin_all" on public.admin_runtime_config
for all to authenticated using (public.astraeon_is_admin_mfa()) with check (public.astraeon_is_admin_mfa());

create or replace function public.admin_set_access(target_user uuid, target_access smallint)
returns smallint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result_access smallint;
  previous_access smallint;
begin
  perform public.astraeon_require_admin(true);
  if target_access is null or target_access < 0 or target_access > 3 then
    raise exception 'invalid_access_level';
  end if;
  if target_user = auth.uid() and target_access <> 3 then
    raise exception 'cannot_remove_own_admin_access';
  end if;

  select access into previous_access from public.profiles where id = target_user for update;
  if previous_access is null then raise exception 'profile_not_found'; end if;
  update public.profiles set access = target_access, updated_at = now()
   where id = target_user returning access into result_access;
  perform public.record_astraeon_security_event(
    'access_changed', target_user, 'admin_rpc',
    jsonb_build_object('from', previous_access, 'to', result_access)
  );
  return result_access;
end;
$$;

create or replace function public.admin_update_player_profile(
  target_user uuid,
  target_username text,
  target_display_name text,
  target_class_id text,
  target_level integer,
  target_access smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.astraeon_require_admin(true);
  if target_username is null or target_username !~ '^[A-Za-z0-9_]{3,18}$' then raise exception 'invalid_username'; end if;
  if target_display_name is null or char_length(btrim(target_display_name)) not between 1 and 24 then raise exception 'invalid_display_name'; end if;
  if target_class_id is not null and target_class_id not in ('Warrior','Mage','Archer','Assassin','Paladine') then raise exception 'invalid_class'; end if;
  if target_level not between 1 and 999 then raise exception 'invalid_level'; end if;
  if target_access not between 0 and 3 then raise exception 'invalid_access'; end if;
  if target_user = auth.uid() and target_access <> 3 then raise exception 'cannot_remove_own_admin_access'; end if;

  update public.profiles set
    username = target_username,
    display_name = btrim(target_display_name),
    class_id = target_class_id,
    level = target_level,
    access = target_access,
    updated_at = now()
  where id = target_user;
  if not found then raise exception 'player_not_found'; end if;
  perform public.record_astraeon_security_event('admin_profile_updated', target_user, 'admin_rpc');
  return public.admin_get_player_detail(target_user);
end;
$$;

create or replace function public.admin_update_player_save(target_user uuid, target_save jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  seed text;
begin
  perform public.astraeon_require_admin(true);
  if not public.validate_astraeon_save(target_save) then raise exception 'invalid_save'; end if;
  seed := left(coalesce(target_save ->> 'seed', ''), 64);
  insert into public.player_saves(user_id, save_data, world_seed, updated_at)
  values(target_user, target_save, seed, now())
  on conflict(user_id) do update
    set save_data = excluded.save_data,
        world_seed = excluded.world_seed,
        updated_at = excluded.updated_at;
  perform public.record_astraeon_security_event('admin_save_updated', target_user, 'admin_rpc');
  return public.admin_get_player_detail(target_user);
end;
$$;

create or replace function public.ensure_astraeon_default_map()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.world_maps where is_default) then
    raise exception 'cannot_remove_last_default_map' using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists world_maps_require_default_after_update on public.world_maps;
create constraint trigger world_maps_require_default_after_update
after update on public.world_maps
deferrable initially deferred
for each row execute function public.ensure_astraeon_default_map();

drop trigger if exists world_maps_require_default_after_delete on public.world_maps;
create constraint trigger world_maps_require_default_after_delete
after delete on public.world_maps
deferrable initially deferred
for each row execute function public.ensure_astraeon_default_map();

create or replace function public.admin_set_default_astraeon_map(target_map uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.astraeon_require_admin(true);
  if not exists (select 1 from public.world_maps where id = target_map) then
    raise exception 'map_not_found';
  end if;
  update public.world_maps set is_default = false where is_default and id <> target_map;
  update public.world_maps set is_default = true, updated_by = auth.uid() where id = target_map;
  perform public.record_astraeon_security_event(
    'default_map_changed', null, 'admin_rpc', jsonb_build_object('map_id', target_map)
  );
  return true;
end;
$$;

revoke all on function public.admin_set_default_astraeon_map(uuid) from public;
grant execute on function public.admin_set_default_astraeon_map(uuid) to authenticated;

create or replace function public.audit_astraeon_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  resource_id text;
begin
  resource_id := coalesce(
    row_data ->> 'id', row_data ->> 'item_id', row_data ->> 'mob_type',
    row_data ->> 'config_key', row_data ->> 'map_key', row_data ->> 'place_key', 'unknown'
  );
  perform public.record_astraeon_security_event(
    'admin_change', null, 'table_trigger',
    jsonb_build_object('table', tg_table_name, 'operation', tg_op, 'resource_id', left(resource_id, 160))
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_system_messages_admin_change on public.system_messages;
create trigger audit_system_messages_admin_change after insert or update or delete on public.system_messages
for each row execute function public.audit_astraeon_admin_change();
drop trigger if exists audit_mob_configs_admin_change on public.mob_configs;
create trigger audit_mob_configs_admin_change after insert or update or delete on public.mob_configs
for each row execute function public.audit_astraeon_admin_change();
drop trigger if exists audit_item_configs_admin_change on public.item_configs;
create trigger audit_item_configs_admin_change after insert or update or delete on public.item_configs
for each row execute function public.audit_astraeon_admin_change();
drop trigger if exists audit_world_maps_admin_change on public.world_maps;
create trigger audit_world_maps_admin_change after insert or update or delete on public.world_maps
for each row execute function public.audit_astraeon_admin_change();
drop trigger if exists audit_world_places_admin_change on public.world_places;
create trigger audit_world_places_admin_change after insert or update or delete on public.world_places
for each row execute function public.audit_astraeon_admin_change();
drop trigger if exists audit_admin_runtime_config_change on public.admin_runtime_config;
create trigger audit_admin_runtime_config_change after insert or update or delete on public.admin_runtime_config
for each row execute function public.audit_astraeon_admin_change();

commit;
