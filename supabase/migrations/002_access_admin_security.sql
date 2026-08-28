-- ASTRAEON ONLINE 4.2 — access levels and admin authorization
-- Execute after 001_astraeon_online.sql.
-- access: 0 = banned, 1 = player, 2 = under review, 3 = admin.

alter table public.profiles
  add column if not exists access smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_access_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_access_check check (access between 0 and 3);
  end if;
end;
$$;

comment on column public.profiles.access is
  'Astraeon access: 0 banned, 1 player, 2 under review, 3 admin';

-- New accounts always start as normal players.
create or replace function public.handle_new_astraeon_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generated_username text;
begin
  generated_username := 'Astral_' || substr(replace(new.id::text, '-', ''), 1, 8);
  insert into public.profiles(id, username, display_name, access)
  values (new.id, generated_username, generated_username, 1)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Users must never be able to promote themselves by updating profiles.access.
revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, display_name, class_id, level, last_seen) on public.profiles to authenticated;
grant update (username, display_name, class_id, level, last_seen) on public.profiles to authenticated;

create or replace function public.astraeon_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and access = 3
  );
$$;

revoke all on function public.astraeon_is_admin() from public;
grant execute on function public.astraeon_is_admin() to authenticated;

create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  class_id text,
  level integer,
  access smallint,
  created_at timestamptz,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.astraeon_is_admin() then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  return query
  select p.id,
         p.username,
         p.display_name,
         u.email::text,
         p.class_id,
         p.level,
         p.access,
         p.created_at,
         p.last_seen
    from public.profiles p
    join auth.users u on u.id = p.id
   order by p.created_at desc
   limit 500;
end;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

create or replace function public.admin_set_access(target_user uuid, target_access smallint)
returns smallint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result_access smallint;
begin
  if not public.astraeon_is_admin() then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  if target_access is null or target_access < 0 or target_access > 3 then
    raise exception 'invalid_access_level';
  end if;

  if target_user = auth.uid() and target_access <> 3 then
    raise exception 'cannot_remove_own_admin_access';
  end if;

  update public.profiles
     set access = target_access,
         updated_at = now()
   where id = target_user
   returning access into result_access;

  if result_access is null then
    raise exception 'profile_not_found';
  end if;

  return result_access;
end;
$$;

revoke all on function public.admin_set_access(uuid, smallint) from public;
grant execute on function public.admin_set_access(uuid, smallint) to authenticated;

-- A banned account can authenticate (so the UI can explain the status) but cannot
-- mutate gameplay data, chat or join the realtime world.
drop policy if exists "astraeon_profiles_update_own" on public.profiles;
create policy "astraeon_profiles_update_own" on public.profiles
for update to authenticated
using (
  (select auth.uid()) = id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
)
with check (
  (select auth.uid()) = id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_saves_read_own" on public.player_saves;
create policy "astraeon_saves_read_own" on public.player_saves
for select to authenticated using (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_saves_insert_own" on public.player_saves;
create policy "astraeon_saves_insert_own" on public.player_saves
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_saves_update_own" on public.player_saves;
create policy "astraeon_saves_update_own" on public.player_saves
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_saves_delete_own" on public.player_saves;
create policy "astraeon_saves_delete_own" on public.player_saves
for delete to authenticated using (
  (select auth.uid()) = user_id
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_chat_read" on public.chat_messages;
create policy "astraeon_chat_read" on public.chat_messages
for select to authenticated using (
  channel = 'world'
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_chat_insert" on public.chat_messages;
create policy "astraeon_chat_insert" on public.chat_messages
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and channel = 'world'
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_realtime_receive" on realtime.messages;
create policy "astraeon_realtime_receive" on realtime.messages
for select to authenticated
using (
  (select realtime.topic()) like 'world:astraeon:%'
  and realtime.messages.extension in ('broadcast','presence')
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);

drop policy if exists "astraeon_realtime_send" on realtime.messages;
create policy "astraeon_realtime_send" on realtime.messages
for insert to authenticated
with check (
  (select realtime.topic()) like 'world:astraeon:%'
  and realtime.messages.extension in ('broadcast','presence')
  and exists (select 1 from public.profiles me where me.id = auth.uid() and me.access <> 0)
);
