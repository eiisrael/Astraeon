-- ASTRAEON PROGRESSION 8.2 — strictly subtractive death XP penalty.
-- Execute after 022_character_data_isolation.sql.

begin;

create or replace function public.apply_astraeon_death_penalty(
  target_character uuid,
  request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  current_xp bigint;
  current_level integer;
  lost_xp bigint;
  final_xp bigint;
  stored jsonb;
begin
  perform public.astraeon_require_online_access();
  if request_id is null then raise exception 'invalid_death_penalty_operation'; end if;

  -- Ownership is checked before looking at the operation ledger so a caller can
  -- never use idempotency IDs to probe another player's progression metadata.
  if not exists (
    select 1 from public.characters
     where id = target_character and user_id = uid
  ) then raise exception 'character_not_found'; end if;

  if public.astraeon_operation_is_applied(request_id, target_character, 'death_xp_penalty') then
    select metadata into stored
      from public.progression_operations
     where operation_id = request_id;
    return coalesce(stored, '{}'::jsonb) || jsonb_build_object(
      'character_id', target_character,
      'operation_id', request_id,
      'idempotent', true
    );
  end if;

  select cp.xp, cp.level
    into current_xp, current_level
    from public.character_progress cp
   where cp.character_id = target_character
     and cp.user_id = uid
   for update;

  if not found then raise exception 'progress_not_found'; end if;

  current_xp := greatest(0, coalesce(current_xp, 0));
  lost_xp := case
    when current_xp <= 0 then 0
    else greatest(1::bigint, ceil(current_xp::numeric * 0.15)::bigint)
  end;
  final_xp := greatest(0::bigint, current_xp - lost_xp);

  -- Security invariant: this RPC has no code path that can increase XP or level.
  if final_xp > current_xp then raise exception 'death_penalty_invariant_violation'; end if;

  update public.character_progress
     set xp = final_xp
   where character_id = target_character
     and user_id = uid;

  insert into public.progression_operations(operation_id, character_id, operation_type, amount, metadata)
  values(
    request_id,
    target_character,
    'death_xp_penalty',
    -lost_xp,
    jsonb_build_object(
      'before_xp', current_xp,
      'lost_xp', lost_xp,
      'after_xp', final_xp,
      'level', current_level,
      'rate', 0.15
    )
  );

  perform public.record_astraeon_security_event(
    'progression_death_penalty',
    uid,
    'death_penalty_rpc',
    jsonb_build_object(
      'character_id', target_character,
      'operation_id', request_id,
      'before_xp', current_xp,
      'lost_xp', lost_xp,
      'after_xp', final_xp,
      'level', current_level
    )
  );

  return jsonb_build_object(
    'character_id', target_character,
    'operation_id', request_id,
    'before_xp', current_xp,
    'lost_xp', lost_xp,
    'after_xp', final_xp,
    'level', current_level,
    'idempotent', false
  );
exception when unique_violation then
  if public.astraeon_operation_is_applied(request_id, target_character, 'death_xp_penalty') then
    select metadata into stored from public.progression_operations where operation_id = request_id;
    return coalesce(stored, '{}'::jsonb) || jsonb_build_object(
      'character_id', target_character,
      'operation_id', request_id,
      'idempotent', true
    );
  end if;
  raise;
end;
$$;

revoke all on function public.apply_astraeon_death_penalty(uuid,uuid) from public, anon;
grant execute on function public.apply_astraeon_death_penalty(uuid,uuid) to authenticated;

comment on function public.apply_astraeon_death_penalty(uuid,uuid) is
  'Authenticated owner-only, idempotent death penalty. Computes 15% server-side, clamps XP at zero, and never changes level.';

commit;
