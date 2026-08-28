-- ASTRAEON ADMIN STUDIO 6.2 — realtime save backups
-- Execute after 008_world_maps_places.sql.

create table if not exists public.admin_backups (
  id bigint generated always as identity primary key,
  resource_type text not null check (resource_type ~ '^[a-z0-9_\-]{2,48}$'),
  resource_key text not null default '' check (char_length(resource_key) <= 160),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) in ('object','array') and octet_length(snapshot::text) <= 4194304),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists admin_backups_resource_idx on public.admin_backups(resource_type,resource_key,created_at desc);
create index if not exists admin_backups_creator_idx on public.admin_backups(created_by,created_at desc);

alter table public.admin_backups enable row level security;

drop policy if exists "astraeon_admin_backups_admin_read" on public.admin_backups;
create policy "astraeon_admin_backups_admin_read" on public.admin_backups
for select to authenticated using (public.astraeon_is_admin());

drop policy if exists "astraeon_admin_backups_admin_insert" on public.admin_backups;
create policy "astraeon_admin_backups_admin_insert" on public.admin_backups
for insert to authenticated with check (public.astraeon_is_admin() and created_by = auth.uid());

drop policy if exists "astraeon_admin_backups_admin_delete" on public.admin_backups;
create policy "astraeon_admin_backups_admin_delete" on public.admin_backups
for delete to authenticated using (public.astraeon_is_admin());

revoke all on public.admin_backups from anon;
grant select,insert,delete on public.admin_backups to authenticated;
grant usage,select on sequence public.admin_backups_id_seq to authenticated;

create or replace function public.protect_default_astraeon_map()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.is_default then
    raise exception 'cannot_delete_default_map' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_default_astraeon_map_delete on public.world_maps;
create trigger protect_default_astraeon_map_delete
before delete on public.world_maps
for each row execute function public.protect_default_astraeon_map();
