-- ASTRAEON 7.0 — runtime/admin expansion
-- Execute after 009_admin_realtime_backups.sql.

alter table public.profiles
  add column if not exists avatar_url text;

-- Migration 002 intentionally restricts profile UPDATE to named columns.
-- Explicitly allow each authenticated user to update only their own avatar_url through the existing own-profile RLS policy.
grant update (avatar_url) on public.profiles to authenticated;

alter table public.system_messages
  add column if not exists line_width integer not null default 220;

alter table public.system_messages drop constraint if exists system_messages_line_width_check;
alter table public.system_messages
  add constraint system_messages_line_width_check check (line_width between 40 and 420);

create table if not exists public.map_mob_spawn_rates (
  map_id uuid not null references public.world_maps(id) on delete cascade,
  mob_type text not null check (char_length(mob_type) between 1 and 64),
  spawn_rate numeric(4,2) not null default 1.00 check (spawn_rate between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (map_id, mob_type)
);

alter table public.map_mob_spawn_rates enable row level security;

drop policy if exists "astraeon_spawn_rates_read" on public.map_mob_spawn_rates;
create policy "astraeon_spawn_rates_read" on public.map_mob_spawn_rates
for select to authenticated using (public.astraeon_has_online_access());

drop policy if exists "astraeon_spawn_rates_admin_insert" on public.map_mob_spawn_rates;
create policy "astraeon_spawn_rates_admin_insert" on public.map_mob_spawn_rates
for insert to authenticated with check (public.astraeon_is_admin());

drop policy if exists "astraeon_spawn_rates_admin_update" on public.map_mob_spawn_rates;
create policy "astraeon_spawn_rates_admin_update" on public.map_mob_spawn_rates
for update to authenticated using (public.astraeon_is_admin()) with check (public.astraeon_is_admin());

drop policy if exists "astraeon_spawn_rates_admin_delete" on public.map_mob_spawn_rates;
create policy "astraeon_spawn_rates_admin_delete" on public.map_mob_spawn_rates
for delete to authenticated using (public.astraeon_is_admin());

revoke all on public.map_mob_spawn_rates from anon;
grant select,insert,update,delete on public.map_mob_spawn_rates to authenticated;

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  delete_after timestamptz not null default (now() + interval '7 days'),
  previous_access smallint not null default 1 check (previous_access between 0 and 3),
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "astraeon_account_deletion_read_own" on public.account_deletion_requests;
create policy "astraeon_account_deletion_read_own" on public.account_deletion_requests
for select to authenticated using (user_id = auth.uid());

revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;

create or replace function public.request_astraeon_account_deletion()
returns table(delete_after timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  current_access smallint;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select access into current_access from public.profiles where id=uid;
  if current_access is null then raise exception 'profile_required'; end if;

  insert into public.account_deletion_requests(user_id,requested_at,delete_after,previous_access,cancelled_at,updated_at)
  values(uid,now(),now()+interval '7 days',current_access,null,now())
  on conflict (user_id) do update set
    requested_at=excluded.requested_at,
    delete_after=excluded.delete_after,
    previous_access=case when public.account_deletion_requests.cancelled_at is null then public.account_deletion_requests.previous_access else current_access end,
    cancelled_at=null,
    updated_at=now();

  update public.profiles set access=2, updated_at=now() where id=uid;
  return query select r.delete_after from public.account_deletion_requests r where r.user_id=uid;
end;
$$;

create or replace function public.cancel_astraeon_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  old_access smallint;
begin
  if uid is null then return false; end if;
  select previous_access into old_access
    from public.account_deletion_requests
   where user_id=uid and cancelled_at is null and delete_after > now();
  if old_access is null then return false; end if;
  update public.account_deletion_requests set cancelled_at=now(),updated_at=now() where user_id=uid;
  update public.profiles set access=case when old_access=0 then 1 else old_access end,updated_at=now() where id=uid;
  return true;
end;
$$;

create or replace function public.process_astraeon_account_deletions()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r record;
  removed integer := 0;
begin
  for r in
    select q.user_id,q.requested_at,q.previous_access,p.last_seen
      from public.account_deletion_requests q
      left join public.profiles p on p.id=q.user_id
     where q.cancelled_at is null and q.delete_after <= now()
  loop
    if r.last_seen is not null and r.last_seen > r.requested_at then
      update public.account_deletion_requests set cancelled_at=now(),updated_at=now() where user_id=r.user_id;
      update public.profiles set access=case when r.previous_access=0 then 1 else r.previous_access end,updated_at=now() where id=r.user_id;
    else
      delete from auth.users where id=r.user_id;
      removed := removed + 1;
    end if;
  end loop;
  return removed;
end;
$$;

revoke all on function public.request_astraeon_account_deletion() from public;
revoke all on function public.cancel_astraeon_account_deletion() from public;
revoke all on function public.process_astraeon_account_deletions() from public;
grant execute on function public.request_astraeon_account_deletion() to authenticated;
grant execute on function public.cancel_astraeon_account_deletion() to authenticated;

-- Avatar bucket. Public read; each user can only write below avatars/<uid>/...
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "astraeon_avatar_insert_own" on storage.objects;
create policy "astraeon_avatar_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "astraeon_avatar_update_own" on storage.objects;
create policy "astraeon_avatar_update_own" on storage.objects
for update to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "astraeon_avatar_delete_own" on storage.objects;
create policy "astraeon_avatar_delete_own" on storage.objects
for delete to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='map_mob_spawn_rates'
  ) then
    execute 'alter publication supabase_realtime add table public.map_mob_spawn_rates';
  end if;
end;
$$;

-- Schedule permanent account cleanup hourly when pg_cron is available.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception when others then
    raise notice 'pg_cron unavailable; process_astraeon_account_deletions() remains callable manually.';
  end;
end;
$$;

do $$
declare jid bigint;
begin
  if to_regnamespace('cron') is null then return; end if;
  for jid in select jobid from cron.job where jobname='astraeon-account-deletion-cleanup' loop
    perform cron.unschedule(jid);
  end loop;
  perform cron.schedule(
    'astraeon-account-deletion-cleanup',
    '17 * * * *',
    'select public.process_astraeon_account_deletions();'
  );
exception when others then
  raise notice 'Could not schedule account deletion cleanup: %', sqlerrm;
end;
$$;
