-- ASTRAEON SECURITY 7.2 — progression bootstrap, idempotency conflict safety
-- and a service-only reconciliation path for audited historical migration.
-- Execute after 016_progression_authority_gateway.sql.

begin;

create or replace function public.bootstrap_astraeon_character_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.character_progress(character_id, user_id, xp, level, gold)
  values(new.id, new.user_id, 0, new.level, 0)
  on conflict(character_id) do nothing;
  return new;
end;
$$;

drop trigger if exists bootstrap_astraeon_character_progress on public.characters;
create trigger bootstrap_astraeon_character_progress
after insert on public.characters
for each row execute function public.bootstrap_astraeon_character_progress();

insert into public.character_progress(character_id, user_id, xp, level, gold)
select c.id, c.user_id, 0, c.level, 0
from public.characters c
on conflict(character_id) do nothing;

create or replace function public.astraeon_operation_is_applied(
  request_id uuid,
  target_character uuid,
  expected_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stored_character uuid;
  stored_type text;
begin
  if request_id is null or expected_type is null then raise exception 'invalid_operation_id'; end if;
  select character_id, operation_type into stored_character, stored_type
  from public.progression_operations
  where operation_id = request_id;
  if not found then return false; end if;
  if stored_character <> target_character or stored_type <> expected_type then
    raise exception 'operation_id_conflict';
  end if;
  return true;
end;
$$;

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
  if spend_amount is null or spend_amount <= 0 or spend_amount > 1000000000 or request_id is null then
    raise exception 'invalid_gold_operation';
  end if;
  if not exists (select 1 from public.characters where id = target_character and user_id = uid) then
    raise exception 'character_not_found';
  end if;
  if public.astraeon_operation_is_applied(request_id, target_character, 'spend_gold') then
    select gold into current_gold from public.character_progress where character_id = target_character;
    return current_gold;
  end if;

  begin
    update public.character_progress
       set gold = gold - spend_amount
     where character_id = target_character and user_id = uid and gold >= spend_amount
    returning gold into current_gold;
    if current_gold is null then raise exception 'insufficient_gold'; end if;
    insert into public.progression_operations(operation_id, character_id, operation_type, amount)
    values(request_id, target_character, 'spend_gold', -spend_amount);
    return current_gold;
  exception when unique_violation then
    if public.astraeon_operation_is_applied(request_id, target_character, 'spend_gold') then
      select gold into current_gold from public.character_progress where character_id = target_character;
      return current_gold;
    end if;
    raise;
  end;
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
  if award_amount is null or award_amount <= 0 or award_amount > 1000000000 or request_id is null then
    raise exception 'invalid_xp_operation';
  end if;
  if not exists (select 1 from public.characters where id = target_character) then raise exception 'character_not_found'; end if;
  if public.astraeon_operation_is_applied(request_id, target_character, 'award_xp') then
    select xp into current_xp from public.character_progress where character_id = target_character;
    return current_xp;
  end if;

  begin
    update public.character_progress
       set xp = least(9000000000000, xp + award_amount)
     where character_id = target_character
    returning xp into current_xp;
    if current_xp is null then raise exception 'progress_not_found'; end if;
    insert into public.progression_operations(operation_id, character_id, operation_type, amount)
    values(request_id, target_character, 'award_xp', award_amount);
    return current_xp;
  exception when unique_violation then
    if public.astraeon_operation_is_applied(request_id, target_character, 'award_xp') then
      select xp into current_xp from public.character_progress where character_id = target_character;
      return current_xp;
    end if;
    raise;
  end;
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
  if public.astraeon_operation_is_applied(request_id, target_character, 'grant_drop') then
    select (metadata ->> 'inventory_id')::uuid into inventory_id
    from public.progression_operations where operation_id = request_id;
    return inventory_id;
  end if;

  begin
    insert into public.character_inventory(character_id, item_id, quantity, metadata)
    values(target_character, target_item, target_quantity, coalesce(target_metadata, '{}'::jsonb))
    returning id into inventory_id;
    insert into public.progression_operations(operation_id, character_id, operation_type, amount, metadata)
    values(request_id, target_character, 'grant_drop', target_quantity,
      jsonb_build_object('inventory_id', inventory_id, 'item_id', target_item));
    return inventory_id;
  exception when unique_violation then
    if public.astraeon_operation_is_applied(request_id, target_character, 'grant_drop') then
      select (metadata ->> 'inventory_id')::uuid into inventory_id
      from public.progression_operations where operation_id = request_id;
      return inventory_id;
    end if;
    raise;
  end;
end;
$$;

create or replace function public.reconcile_astraeon_progression(
  target_character uuid,
  trusted_xp bigint,
  trusted_level integer,
  trusted_gold bigint,
  request_id uuid,
  reconciliation_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user uuid;
  output jsonb;
begin
  if trusted_xp is null or trusted_xp not between 0 and 9000000000000
     or trusted_gold is null or trusted_gold not between 0 and 9000000000000
     or trusted_level is null or trusted_level not between 1 and 999
     or request_id is null
     or reconciliation_reason is null or reconciliation_reason !~ '^[A-Za-z0-9 _.,:;()\-/]{8,160}$' then
    raise exception 'invalid_reconciliation';
  end if;
  select user_id into target_user from public.characters where id = target_character;
  if target_user is null then raise exception 'character_not_found'; end if;
  if public.astraeon_operation_is_applied(request_id, target_character, 'reconcile_progression') then
    select jsonb_build_object('character_id', character_id, 'xp', xp, 'level', level, 'gold', gold)
      into output from public.character_progress where character_id = target_character;
    return output;
  end if;

  begin
    update public.character_progress
       set xp = trusted_xp, level = trusted_level, gold = trusted_gold
     where character_id = target_character;
    if not found then raise exception 'progress_not_found'; end if;
    update public.characters set level = trusted_level where id = target_character;
    insert into public.progression_operations(operation_id, character_id, operation_type, amount, metadata)
    values(request_id, target_character, 'reconcile_progression', trusted_xp,
      jsonb_build_object('level', trusted_level, 'gold', trusted_gold, 'reason', reconciliation_reason));
    perform public.record_astraeon_security_event(
      'progression_reconciled', target_user, 'trusted_reconciliation',
      jsonb_build_object('character_id', target_character, 'operation_id', request_id, 'reason', reconciliation_reason)
    );
  exception when unique_violation then
    if not public.astraeon_operation_is_applied(request_id, target_character, 'reconcile_progression') then raise; end if;
  end;
  select jsonb_build_object('character_id', character_id, 'xp', xp, 'level', level, 'gold', gold)
    into output from public.character_progress where character_id = target_character;
  return output;
end;
$$;

revoke all on function public.astraeon_operation_is_applied(uuid,uuid,text) from public;
revoke all on function public.spend_astraeon_gold(uuid,bigint,uuid) from public;
revoke all on function public.award_astraeon_xp(uuid,bigint,uuid) from public;
revoke all on function public.grant_astraeon_drop(uuid,text,integer,jsonb,uuid) from public;
revoke all on function public.reconcile_astraeon_progression(uuid,bigint,integer,bigint,uuid,text) from public;
grant execute on function public.astraeon_operation_is_applied(uuid,uuid,text) to service_role;
grant execute on function public.spend_astraeon_gold(uuid,bigint,uuid) to authenticated;
grant execute on function public.award_astraeon_xp(uuid,bigint,uuid) to service_role;
grant execute on function public.grant_astraeon_drop(uuid,text,integer,jsonb,uuid) to service_role;
grant execute on function public.reconcile_astraeon_progression(uuid,bigint,integer,bigint,uuid,text) to service_role;

comment on function public.reconcile_astraeon_progression(uuid,bigint,integer,bigint,uuid,text) is
  'Service-only audited reconciliation. Feed only a reviewed, trusted historical source.';

commit;
