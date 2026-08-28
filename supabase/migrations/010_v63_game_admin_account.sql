-- ASTRAEON 6.3 — gameplay/admin/account expansion
-- Execute after 009_admin_realtime_backups.sql.
-- This migration is intentionally compatible with the discarded Astraeon 7.0 migration
-- in case that SQL was already executed in the same Supabase project.

-- V7 created request_astraeon_account_deletion() with RETURNS TABLE(delete_after timestamptz).
-- PostgreSQL cannot change a function return type with CREATE OR REPLACE, so remove only
-- the legacy no-argument function before recreating the canonical 6.3 implementation.
drop function if exists public.request_astraeon_account_deletion();

-- The discarded V7 cleanup function used a different queue/table and avatar bucket.
-- Disable the legacy scheduled job and function so only the 6.3 deletion pipeline remains active.
do $$
declare
  old_job bigint;
begin
  begin
    if to_regnamespace('cron') is not null then
      for old_job in
        select jobid from cron.job
        where jobname in ('astraeon-account-deletion-cleanup','astraeon-account-deletion')
      loop
        perform cron.unschedule(old_job);
      end loop;
    end if;
  exception when others then
    raise notice 'Legacy account deletion cron cleanup skipped: %', sqlerrm;
  end;
end $$;

drop function if exists public.process_astraeon_account_deletions();

-- System announcement visual configuration.
alter table public.system_messages
  add column if not exists line_width smallint not null default 220;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='system_messages_line_width_check') then
    alter table public.system_messages
      add constraint system_messages_line_width_check check (line_width between 40 and 420);
  end if;
end $$;

-- Per-map spawn rate. JSON shape: {"map1":100,"map2":65} (percentage 0..300).
alter table public.mob_configs
  add column if not exists spawn_rates jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='mob_configs_spawn_rates_object_check') then
    alter table public.mob_configs
      add constraint mob_configs_spawn_rates_object_check
      check (jsonb_typeof(spawn_rates)='object' and octet_length(spawn_rates::text) <= 8192);
  end if;
end $$;

-- Public-safe account presentation fields and delayed account deletion state.
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_due_at timestamptz;

-- Normalize columns when they already came from the discarded V7 migration.
update public.profiles set avatar_url='' where avatar_url is null;
update public.profiles set bio='' where bio is null;
alter table public.profiles alter column avatar_url set default '';
alter table public.profiles alter column avatar_url set not null;
alter table public.profiles alter column bio set default '';
alter table public.profiles alter column bio set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_avatar_url_length_check') then
    alter table public.profiles add constraint profiles_avatar_url_length_check check (char_length(avatar_url) <= 1024);
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_bio_length_check') then
    alter table public.profiles add constraint profiles_bio_length_check check (char_length(bio) <= 240);
  end if;
end $$;

grant update (avatar_url,bio) on public.profiles to authenticated;

create table if not exists public.account_deletion_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  previous_access smallint not null default 1 check (previous_access between 0 and 3),
  requested_at timestamptz not null default now(),
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists account_deletion_queue_due_idx on public.account_deletion_queue(due_at);
alter table public.account_deletion_queue enable row level security;
drop policy if exists "astraeon_account_delete_read_own" on public.account_deletion_queue;
create policy "astraeon_account_delete_read_own" on public.account_deletion_queue
for select to authenticated using (user_id=auth.uid());
revoke all on public.account_deletion_queue from anon, authenticated;
grant select on public.account_deletion_queue to authenticated;

-- Preserve any still-active deletion request created by the discarded V7 migration.
do $$
begin
  if to_regclass('public.account_deletion_requests') is not null then
    execute $compat$
      insert into public.account_deletion_queue(user_id,previous_access,requested_at,due_at)
      select user_id, previous_access, requested_at, delete_after
        from public.account_deletion_requests
       where cancelled_at is null
      on conflict(user_id) do update
        set previous_access=excluded.previous_access,
            requested_at=excluded.requested_at,
            due_at=excluded.due_at
    $compat$;
  end if;
exception when others then
  raise notice 'Legacy account deletion requests were not migrated: %', sqlerrm;
end $$;

create or replace function public.request_astraeon_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  uid uuid:=auth.uid();
  current_access smallint;
  old_access smallint;
  due timestamptz:=now()+interval '7 days';
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select access into current_access from public.profiles where id=uid for update;
  if current_access is null then raise exception 'profile_required'; end if;
  select previous_access into old_access from public.account_deletion_queue where user_id=uid;
  if old_access is null then old_access:=current_access; end if;

  insert into public.account_deletion_queue(user_id,previous_access,requested_at,due_at)
  values(uid,old_access,now(),due)
  on conflict(user_id) do update
    set requested_at=excluded.requested_at,
        due_at=excluded.due_at,
        previous_access=public.account_deletion_queue.previous_access;

  update public.profiles
     set access=2,
         deletion_requested_at=now(),
         deletion_due_at=due,
         updated_at=now()
   where id=uid;
  return due;
end;
$$;
revoke all on function public.request_astraeon_account_deletion() from public;
grant execute on function public.request_astraeon_account_deletion() to authenticated;

create or replace function public.cancel_astraeon_account_deletion()
returns boolean
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  uid uuid:=auth.uid();
  prev smallint;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select previous_access into prev from public.account_deletion_queue where user_id=uid for update;
  if prev is null then
    update public.profiles set deletion_requested_at=null,deletion_due_at=null where id=uid;
    return false;
  end if;
  delete from public.account_deletion_queue where user_id=uid;
  update public.profiles
     set access=case when prev between 0 and 3 then prev else 1 end,
         deletion_requested_at=null,
         deletion_due_at=null,
         updated_at=now()
   where id=uid;
  return true;
end;
$$;
revoke all on function public.cancel_astraeon_account_deletion() from public;
grant execute on function public.cancel_astraeon_account_deletion() to authenticated;

-- Called only by the database scheduler. It is intentionally not executable by web roles.
create or replace function public.process_due_astraeon_account_deletions()
returns integer
language plpgsql
security definer
set search_path=public,auth,storage,pg_temp
as $$
declare
  q record;
  processed integer:=0;
  seen_at timestamptz;
begin
  for q in
    select * from public.account_deletion_queue
     where due_at<=now()
     order by due_at
     for update skip locked
  loop
    select last_seen into seen_at from public.profiles where id=q.user_id;
    -- Any activity/login after the request cancels the pending deletion.
    if seen_at is not null and seen_at>q.requested_at then
      update public.profiles
         set access=q.previous_access,
             deletion_requested_at=null,
             deletion_due_at=null,
             updated_at=now()
       where id=q.user_id;
      delete from public.account_deletion_queue where user_id=q.user_id;
      continue;
    end if;

    -- Storage objects are not guaranteed to cascade with auth.users.
    delete from storage.objects
     where bucket_id='astraeon-avatars'
       and (storage.foldername(name))[1]=q.user_id::text;

    -- Profiles, characters, saves and other user-owned rows cascade from auth.users.
    delete from auth.users where id=q.user_id;
    processed:=processed+1;
  end loop;
  return processed;
end;
$$;
revoke all on function public.process_due_astraeon_account_deletions() from public,anon,authenticated;

-- Avatar bucket. Public read, authenticated users may only manage files in their own UUID folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('astraeon-avatars','astraeon-avatars',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update
set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "astraeon_avatar_insert_own" on storage.objects;
create policy "astraeon_avatar_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id='astraeon-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "astraeon_avatar_update_own" on storage.objects;
create policy "astraeon_avatar_update_own" on storage.objects
for update to authenticated
using (bucket_id='astraeon-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='astraeon-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "astraeon_avatar_delete_own" on storage.objects;
create policy "astraeon_avatar_delete_own" on storage.objects
for delete to authenticated
using (bucket_id='astraeon-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Schedule permanent cleanup hourly when pg_cron is available in the Supabase project.
do $$
declare
  old_job bigint;
begin
  begin
    execute 'create extension if not exists pg_cron';
    for old_job in
      select jobid from cron.job
       where jobname in ('astraeon-account-deletion-cleanup','astraeon-account-deletion')
    loop
      perform cron.unschedule(old_job);
    end loop;
    perform cron.schedule(
      'astraeon-account-deletion',
      '17 * * * *',
      'select public.process_due_astraeon_account_deletions();'
    );
  exception when others then
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
  end;
end $$;
