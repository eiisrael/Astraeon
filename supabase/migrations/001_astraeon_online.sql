-- ASTRAEON ONLINE 4.0
-- Execute once in the Supabase SQL editor (or through Supabase migrations).
-- Persistent data is protected by Auth + Row Level Security. Realtime movement is cosmetic only.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,18}$'),
  display_name text not null check (char_length(display_name) between 1 and 24),
  class_id text check (class_id is null or class_id in ('Warrior','Mage','Archer','Assassin','Paladine')),
  level integer not null default 1 check (level between 1 and 999),
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username));

create table if not exists public.player_saves (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  save_data jsonb not null check (octet_length(save_data::text) <= 1048576),
  world_seed text not null default '' check (char_length(world_seed) <= 64),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null default '',
  body text not null check (char_length(body) between 1 and 240),
  channel text not null default 'world' check (channel = 'world'),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_created_idx on public.chat_messages(channel, created_at desc);
create index if not exists chat_messages_user_created_idx on public.chat_messages(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

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
  insert into public.profiles(id, username, display_name)
  values (new.id, generated_username, generated_username)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_astraeon on auth.users;
create trigger on_auth_user_created_astraeon
after insert on auth.users
for each row execute function public.handle_new_astraeon_user();

create or replace function public.claim_username(desired text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or desired is null or desired !~ '^[A-Za-z0-9_]{3,18}$' then
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

revoke all on function public.claim_username(text) from public;
grant execute on function public.claim_username(text) to authenticated;

create or replace function public.guard_astraeon_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid;
  profile_name text;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'authentication_required';
  end if;

  select username into profile_name from public.profiles where id = uid;
  if profile_name is null then
    raise exception 'profile_required';
  end if;

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
     where user_id = uid
       and created_at > now() - interval '900 milliseconds'
  ) then
    raise exception 'chat_rate_limited';
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_guard on public.chat_messages;
create trigger chat_messages_guard
before insert on public.chat_messages
for each row execute function public.guard_astraeon_chat_message();

alter table public.profiles enable row level security;
alter table public.player_saves enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "astraeon_profiles_read" on public.profiles;
create policy "astraeon_profiles_read" on public.profiles
for select to authenticated using (true);

drop policy if exists "astraeon_profiles_insert_own" on public.profiles;
create policy "astraeon_profiles_insert_own" on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "astraeon_profiles_update_own" on public.profiles;
create policy "astraeon_profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "astraeon_saves_read_own" on public.player_saves;
create policy "astraeon_saves_read_own" on public.player_saves
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "astraeon_saves_insert_own" on public.player_saves;
create policy "astraeon_saves_insert_own" on public.player_saves
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "astraeon_saves_update_own" on public.player_saves;
create policy "astraeon_saves_update_own" on public.player_saves
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "astraeon_saves_delete_own" on public.player_saves;
create policy "astraeon_saves_delete_own" on public.player_saves
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "astraeon_chat_read" on public.chat_messages;
create policy "astraeon_chat_read" on public.chat_messages
for select to authenticated using (channel = 'world');

drop policy if exists "astraeon_chat_insert" on public.chat_messages;
create policy "astraeon_chat_insert" on public.chat_messages
for insert to authenticated with check ((select auth.uid()) = user_id and channel = 'world');

revoke all on public.profiles, public.player_saves, public.chat_messages from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.player_saves to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant usage, select on sequence public.chat_messages_id_seq to authenticated;

drop policy if exists "astraeon_realtime_receive" on realtime.messages;
create policy "astraeon_realtime_receive" on realtime.messages
for select to authenticated
using (
  (select realtime.topic()) like 'world:astraeon:%'
  and realtime.messages.extension in ('broadcast','presence')
);

drop policy if exists "astraeon_realtime_send" on realtime.messages;
create policy "astraeon_realtime_send" on realtime.messages
for insert to authenticated
with check (
  (select realtime.topic()) like 'world:astraeon:%'
  and realtime.messages.extension in ('broadcast','presence')
);

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end;
$$;
