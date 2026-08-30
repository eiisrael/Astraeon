-- ASTRAEON SECURITY 7.1 — single, auditable service-only progression gateway.
-- Execute after 015_server_authoritative_progression.sql.

begin;

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
  if request_id is null
     or event_kind not in ('award_xp', 'grant_drop')
     or jsonb_typeof(coalesce(event_metadata, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(event_metadata, '{}'::jsonb)::text) > 8192 then
    raise exception 'invalid_progression_event';
  end if;

  select user_id into target_user
  from public.characters
  where id = target_character;
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

revoke all on function public.apply_astraeon_progression_event(uuid,text,bigint,text,integer,jsonb,uuid) from public;
grant execute on function public.apply_astraeon_progression_event(uuid,text,bigint,text,integer,jsonb,uuid) to service_role;

comment on function public.apply_astraeon_progression_event(uuid,text,bigint,text,integer,jsonb,uuid) is
  'Service-only, idempotent gateway for trusted game servers. Never call from a browser.';

commit;
