-- ASTRAEON ONLINE 4.3 — managed system messages
-- Execute after 002_access_admin_security.sql.

create table if not exists public.system_messages (
  id bigint generated always as identity primary key,
  body text not null check (char_length(body) between 1 and 160),
  interval_minutes smallint not null default 10 check (interval_minutes in (5,10,30,50,60)),
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.system_messages is
  'Periodic chat system messages managed only by Astraeon Access 3 administrators.';

drop trigger if exists system_messages_set_updated_at on public.system_messages;
create trigger system_messages_set_updated_at
before update on public.system_messages
for each row execute function public.set_updated_at();

alter table public.system_messages enable row level security;

drop policy if exists "astraeon_system_messages_read" on public.system_messages;
create policy "astraeon_system_messages_read" on public.system_messages
for select to authenticated
using (public.astraeon_has_online_access());

drop policy if exists "astraeon_system_messages_admin_insert" on public.system_messages;
create policy "astraeon_system_messages_admin_insert" on public.system_messages
for insert to authenticated
with check (public.astraeon_is_admin());

drop policy if exists "astraeon_system_messages_admin_update" on public.system_messages;
create policy "astraeon_system_messages_admin_update" on public.system_messages
for update to authenticated
using (public.astraeon_is_admin())
with check (public.astraeon_is_admin());

drop policy if exists "astraeon_system_messages_admin_delete" on public.system_messages;
create policy "astraeon_system_messages_admin_delete" on public.system_messages
for delete to authenticated
using (public.astraeon_is_admin());

revoke all on public.system_messages from anon;
grant select, insert, update, delete on public.system_messages to authenticated;
grant usage, select on sequence public.system_messages_id_seq to authenticated;
