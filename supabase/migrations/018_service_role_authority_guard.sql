-- ASTRAEON SECURITY 7.3 — defence in depth for service-only progression RPCs.
-- Execute after 017_progression_idempotency_and_reconciliation.sql.

begin;

create or replace function public.astraeon_require_service_authority()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.jwt() ->> 'role', ''),
    ''
  );
begin
  if request_role <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
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
  perform public.astraeon_require_service_authority();
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
  perform public.astraeon_require_service_authority();
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

create or replace function public.apply_astraeon_progression_event(
  target_character uuid,
  event_kind text,
  event_amount bigint default null,
  event_item text default null,
  event_quantity integer default null,
  event_metadata jsonb default '{}'::jsonb,
  request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user uuid;
  final_xp bigint;
  inventory_id uuid;
begin
  perform public.astraeon_require_service_authority();
  if request_id is null
     or event_kind not in ('award_xp', 'grant_drop')
     or jsonb_typeof(coalesce(event_metadata, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(event_metadata, '{}'::jsonb)::text) > 8192 then
    raise exception 'invalid_progression_event';
  end if;
  select user_id into target_user from public.characters where id = target_character;
  if target_user is null then raise exception 'character_not_found'; end if;
  if event_kind = 'award_xp' then
    final_xp := public.award_astraeon_xp(target_character, event_amount, request_id);
    perform public.record_astraeon_security_event(
      'progression_xp_awarded', target_user, 'authority_gateway',
      jsonb_build_object('character_id', target_character, 'operation_id', request_id, 'amount', event_amount)
    );
    return jsonb_build_object('kind', 'award_xp', 'operation_id', request_id, 'xp', final_xp);
  end if;
  if event_item is null or btrim(event_item) = '' then raise exception 'invalid_drop_operation'; end if;
  inventory_id := public.grant_astraeon_drop(
    target_character, event_item, event_quantity, coalesce(event_metadata, '{}'::jsonb), request_id
  );
  perform public.record_astraeon_security_event(
    'progression_drop_granted', target_user, 'authority_gateway',
    jsonb_build_object('character_id', target_character, 'operation_id', request_id, 'item_id', event_item, 'quantity', event_quantity)
  );
  return jsonb_build_object('kind', 'grant_drop', 'operation_id', request_id, 'inventory_id', inventory_id);
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
  perform public.astraeon_require_service_authority();
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

revoke all on function public.astraeon_require_service_authority() from public, anon, authenticated;
revoke all on function public.award_astraeon_xp(uuid,bigint,uuid) from public, anon, authenticated;
revoke all on function public.grant_astraeon_drop(uuid,text,integer,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.apply_astraeon_progression_event(uuid,text,bigint,text,integer,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.reconcile_astraeon_progression(uuid,bigint,integer,bigint,uuid,text) from public, anon, authenticated;
grant execute on function public.astraeon_require_service_authority() to service_role;
grant execute on function public.award_astraeon_xp(uuid,bigint,uuid) to service_role;
grant execute on function public.grant_astraeon_drop(uuid,text,integer,jsonb,uuid) to service_role;
grant execute on function public.apply_astraeon_progression_event(uuid,text,bigint,text,integer,jsonb,uuid) to service_role;
grant execute on function public.reconcile_astraeon_progression(uuid,bigint,integer,bigint,uuid,text) to service_role;

commit;
