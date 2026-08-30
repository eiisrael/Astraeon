-- ASTRAEON SECURITY 7.0 — server-authoritative progression foundation.
-- This migration does not enable PvP, trade, marketplace or competitive ranking.
-- Execute after 014_realtime_hardening.sql.

begin;

create table if not exists public.character_progress (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp bigint not null default 0 check (xp between 0 and 9000000000000),
  level integer not null default 1 check (level between 1 and 999),
  gold bigint not null default 0 check (gold between 0 and 9000000000000),
  updated_at timestamptz not null default now(),
  unique(character_id, user_id)
);

create index if not exists character_progress_user_idx
  on public.character_progress(user_id, updated_at desc);

create table if not exists public.character_inventory (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id text not null references public.item_configs(item_id) on update cascade on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 9999),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists character_inventory_character_idx
  on public.character_inventory(character_id, created_at);

create table if not exists public.progression_operations (
  operation_id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  operation_type text not null check (operation_type ~ '^[a-z0-9_\-]{3,48}$'),
  amount bigint,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  created_at timestamptz not null default now()
);

drop trigger if exists character_progress_set_updated_at on public.character_progress;
create trigger character_progress_set_updated_at before update on public.character_progress
for each row execute function public.set_updated_at();
drop trigger if exists character_inventory_set_updated_at on public.character_inventory;
create trigger character_inventory_set_updated_at before update on public.character_inventory
for each row execute function public.set_updated_at();

-- Deliberately do not bootstrap XP or gold from the client-controlled legacy
-- save JSON. Existing characters receive a neutral authoritative balance and
-- can be reconciled later by a trusted, audited server-side process.
insert into public.character_progress(character_id, user_id, xp, level, gold)
select c.id, c.user_id, 0, c.level, 0
from public.characters c
on conflict(character_id) do nothing;

alter table public.character_progress enable row level security;
alter table public.character_inventory enable row level security;
alter table public.progression_operations enable row level security;

drop policy if exists "astraeon_character_progress_read_own" on public.character_progress;
create policy "astraeon_character_progress_read_own" on public.character_progress
for select to authenticated
using (
  (user_id = auth.uid() and public.astraeon_has_online_access())
  or public.astraeon_is_admin()
);

drop policy if exists "astraeon_character_inventory_read_own" on public.character_inventory;
create policy "astraeon_character_inventory_read_own" on public.character_inventory
for select to authenticated
using (
  exists (
    select 1 from public.characters c
     where c.id = character_id
       and (
         (c.user_id = auth.uid() and public.astraeon_has_online_access())
         or public.astraeon_is_admin()
       )
  )
);

drop policy if exists "astraeon_progression_operations_admin_read" on public.progression_operations;
create policy "astraeon_progression_operations_admin_read" on public.progression_operations
for select to authenticated using (public.astraeon_is_admin());

revoke all on public.character_progress, public.character_inventory, public.progression_operations
from anon, authenticated;
grant select on public.character_progress, public.character_inventory to authenticated;
grant select on public.progression_operations to authenticated;

create or replace function public.spend_astraeon_gold(
  target_character uuid,
  spend_amount bigint,
  request_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  current_gold bigint;
begin
  perform public.astraeon_require_online_access();
  if spend_amount is null or spend_amount <= 0 or spend_amount > 1000000000
     or request_id is null then raise exception 'invalid_gold_operation'; end if;
  if not exists (
    select 1 from public.characters where id = target_character and user_id = uid
  ) then raise exception 'character_not_found'; end if;

  if exists (
    select 1 from public.progression_operations
     where progression_operations.operation_id = request_id
       and character_id = target_character
       and operation_type = 'spend_gold'
  ) then
    select gold into current_gold from public.character_progress where character_id = target_character;
    return current_gold;
  end if;

  update public.character_progress
     set gold = gold - spend_amount
   where character_id = target_character
     and user_id = uid
     and gold >= spend_amount
  returning gold into current_gold;
  if current_gold is null then raise exception 'insufficient_gold'; end if;

  insert into public.progression_operations(operation_id, character_id, operation_type, amount)
  values(request_id, target_character, 'spend_gold', -spend_amount);
  return current_gold;
exception when unique_violation then
  select gold into current_gold from public.character_progress where character_id = target_character;
  return current_gold;
end;
$$;

create or replace function public.award_astraeon_xp(
  target_character uuid,
  award_amount bigint,
  request_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_xp bigint;
begin
  if award_amount is null or award_amount <= 0 or award_amount > 1000000000
     or request_id is null then raise exception 'invalid_xp_operation'; end if;
  if not exists (select 1 from public.characters where id = target_character) then
    raise exception 'character_not_found';
  end if;
  if exists (
    select 1 from public.progression_operations
     where progression_operations.operation_id = request_id
       and character_id = target_character
       and operation_type = 'award_xp'
  ) then
    select xp into current_xp from public.character_progress where character_id = target_character;
    return current_xp;
  end if;

  update public.character_progress
     set xp = least(9000000000000, xp + award_amount)
   where character_id = target_character
  returning xp into current_xp;
  if current_xp is null then raise exception 'progress_not_found'; end if;
  insert into public.progression_operations(operation_id, character_id, operation_type, amount)
  values(request_id, target_character, 'award_xp', award_amount);
  return current_xp;
exception when unique_violation then
  select xp into current_xp from public.character_progress where character_id = target_character;
  return current_xp;
end;
$$;

create or replace function public.grant_astraeon_drop(
  target_character uuid,
  target_item text,
  target_quantity integer,
  target_metadata jsonb,
  request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inventory_id uuid;
begin
  if target_quantity is null or target_quantity not between 1 and 9999
     or request_id is null
     or jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(target_metadata, '{}'::jsonb)::text) > 8192 then
    raise exception 'invalid_drop_operation';
  end if;
  if not exists (select 1 from public.characters where id = target_character) then raise exception 'character_not_found'; end if;
  if not exists (select 1 from public.item_configs where item_id = target_item and enabled) then raise exception 'item_not_found'; end if;

  select (metadata ->> 'inventory_id')::uuid into inventory_id
    from public.progression_operations
   where progression_operations.operation_id = request_id
     and character_id = target_character
     and operation_type = 'grant_drop';
  if inventory_id is not null then return inventory_id; end if;

  insert into public.character_inventory(character_id, item_id, quantity, metadata)
  values(target_character, target_item, target_quantity, coalesce(target_metadata, '{}'::jsonb))
  returning id into inventory_id;
  insert into public.progression_operations(operation_id, character_id, operation_type, amount, metadata)
  values(
    request_id, target_character, 'grant_drop', target_quantity,
    jsonb_build_object('inventory_id', inventory_id, 'item_id', target_item)
  );
  return inventory_id;
exception when unique_violation then
  select (metadata ->> 'inventory_id')::uuid into inventory_id
    from public.progression_operations
   where progression_operations.operation_id = request_id;
  return inventory_id;
end;
$$;

revoke all on function public.spend_astraeon_gold(uuid,bigint,uuid) from public;
revoke all on function public.award_astraeon_xp(uuid,bigint,uuid) from public;
revoke all on function public.grant_astraeon_drop(uuid,text,integer,jsonb,uuid) from public;
grant execute on function public.spend_astraeon_gold(uuid,bigint,uuid) to authenticated;
grant execute on function public.award_astraeon_xp(uuid,bigint,uuid) to service_role;
grant execute on function public.grant_astraeon_drop(uuid,text,integer,jsonb,uuid) to service_role;

comment on table public.character_progress is
  'Authoritative progression foundation. Authenticated clients have no direct write grant.';
comment on table public.character_inventory is
  'Authoritative inventory foundation. Existing save JSON remains legacy/non-competitive.';
comment on function public.award_astraeon_xp(uuid,bigint,uuid) is
  'Server-only idempotent XP award. Never grant this RPC to authenticated.';

commit;
