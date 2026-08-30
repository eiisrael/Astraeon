-- ASTRAEON ONLINE 7.0 — server-bound identity for social Realtime state.
-- Client Broadcast is no longer accepted for player state/action identity.
-- Execute after 013_admin_pagination.sql.

begin;

create table if not exists public.player_runtime_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  x numeric(12,2) not null check (x between 0 and 10000000),
  y numeric(12,2) not null check (y between 0 and 10000000),
  facing smallint not null default 1 check (facing in (-1, 1)),
  seq bigint not null check (seq > 0),
  client_ts bigint not null check (client_ts > 0),
  updated_at timestamptz not null default now()
);

create index if not exists player_runtime_states_updated_idx
  on public.player_runtime_states(updated_at desc);

create table if not exists public.player_runtime_actions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('attack','skill')),
  action_index smallint not null default 0 check (action_index between 0 and 4),
  x numeric(12,2) not null check (x between 0 and 10000000),
  y numeric(12,2) not null check (y between 0 and 10000000),
  seq bigint not null check (seq > 0),
  client_ts bigint not null check (client_ts > 0),
  updated_at timestamptz not null default now()
);

alter table public.player_runtime_states enable row level security;
alter table public.player_runtime_actions enable row level security;

drop policy if exists "astraeon_runtime_states_read" on public.player_runtime_states;
create policy "astraeon_runtime_states_read" on public.player_runtime_states
for select to authenticated using (public.astraeon_has_online_access());

drop policy if exists "astraeon_runtime_actions_read" on public.player_runtime_actions;
create policy "astraeon_runtime_actions_read" on public.player_runtime_actions
for select to authenticated using (public.astraeon_has_online_access());

revoke all on public.player_runtime_states, public.player_runtime_actions from anon, authenticated;
grant select on public.player_runtime_states, public.player_runtime_actions to authenticated;

create or replace function public.publish_astraeon_player_state(
  target_x numeric,
  target_y numeric,
  target_facing smallint,
  target_seq bigint,
  target_ts bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  previous public.player_runtime_states;
  server_now timestamptz := clock_timestamp();
  server_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  elapsed_seconds numeric;
  delta_x numeric;
  delta_y numeric;
  distance numeric;
  max_distance numeric;
begin
  perform public.astraeon_require_online_access();
  if target_x is null or target_y is null
     or target_x not between 0 and 10000000
     or target_y not between 0 and 10000000
     or target_facing not in (-1, 1)
     or target_seq is null or target_seq <= 0
     or target_ts is null or target_ts < server_ms - 10000 or target_ts > server_ms + 5000 then
    return false;
  end if;

  select * into previous
    from public.player_runtime_states
   where user_id = uid
   for update;

  if previous.user_id is not null then
    if target_seq <= previous.seq or target_ts <= previous.client_ts then return false; end if;
    elapsed_seconds := extract(epoch from (server_now - previous.updated_at));
    if elapsed_seconds < 0.067 then
      if not exists (
        select 1 from public.security_events
         where actor_id = uid and event_type = 'realtime_state_flood'
           and created_at > now() - interval '60 seconds'
      ) then
        perform public.record_astraeon_security_event('realtime_state_flood', uid, 'realtime_rpc');
      end if;
      return false;
    end if;

    delta_x := target_x - previous.x;
    delta_y := target_y - previous.y;
    distance := sqrt(delta_x * delta_x + delta_y * delta_y);
    max_distance := 96 + elapsed_seconds * 520;
    if elapsed_seconds < 3 and distance > max_distance and distance > 0 then
      target_x := previous.x + delta_x / distance * max_distance;
      target_y := previous.y + delta_y / distance * max_distance;
      if not exists (
        select 1 from public.security_events
         where actor_id = uid and event_type = 'realtime_impossible_movement'
           and created_at > now() - interval '60 seconds'
      ) then
        perform public.record_astraeon_security_event(
          'realtime_impossible_movement', uid, 'realtime_rpc',
          jsonb_build_object('distance', round(distance, 2), 'elapsed_ms', round(elapsed_seconds * 1000))
        );
      end if;
    end if;

    update public.player_runtime_states
       set x = target_x,
           y = target_y,
           facing = target_facing,
           seq = target_seq,
           client_ts = target_ts,
           updated_at = server_now
     where user_id = uid;
  else
    insert into public.player_runtime_states(user_id, x, y, facing, seq, client_ts, updated_at)
    values(uid, target_x, target_y, target_facing, target_seq, target_ts, server_now);
  end if;
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.publish_astraeon_player_action(
  target_type text,
  target_index smallint,
  target_seq bigint,
  target_ts bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  current_state public.player_runtime_states;
  previous public.player_runtime_actions;
  server_now timestamptz := clock_timestamp();
  server_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  perform public.astraeon_require_online_access();
  if target_type not in ('attack','skill')
     or target_index not between 0 and 4
     or target_seq is null or target_seq <= 0
     or target_ts is null or target_ts < server_ms - 10000 or target_ts > server_ms + 5000 then
    return false;
  end if;

  select * into current_state
    from public.player_runtime_states
   where user_id = uid and updated_at > server_now - interval '5 seconds';
  if current_state.user_id is null then return false; end if;

  select * into previous
    from public.player_runtime_actions
   where user_id = uid
   for update;
  if previous.user_id is not null then
    if target_seq <= previous.seq or target_ts <= previous.client_ts then return false; end if;
    if previous.updated_at > server_now - interval '84 milliseconds' then
      if not exists (
        select 1 from public.security_events
         where actor_id = uid and event_type = 'realtime_action_flood'
           and created_at > now() - interval '60 seconds'
      ) then
        perform public.record_astraeon_security_event('realtime_action_flood', uid, 'realtime_rpc');
      end if;
      return false;
    end if;
    update public.player_runtime_actions
       set action_type = target_type,
           action_index = target_index,
           x = current_state.x,
           y = current_state.y,
           seq = target_seq,
           client_ts = target_ts,
           updated_at = server_now
     where user_id = uid;
  else
    insert into public.player_runtime_actions(
      user_id, action_type, action_index, x, y, seq, client_ts, updated_at
    ) values (
      uid, target_type, target_index, current_state.x, current_state.y,
      target_seq, target_ts, server_now
    );
  end if;
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.clear_astraeon_player_runtime()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.astraeon_require_online_access();
  delete from public.player_runtime_actions where user_id = auth.uid();
  delete from public.player_runtime_states where user_id = auth.uid();
  return true;
end;
$$;

revoke all on function public.publish_astraeon_player_state(numeric,numeric,smallint,bigint,bigint) from public;
revoke all on function public.publish_astraeon_player_action(text,smallint,bigint,bigint) from public;
revoke all on function public.clear_astraeon_player_runtime() from public;
grant execute on function public.publish_astraeon_player_state(numeric,numeric,smallint,bigint,bigint) to authenticated;
grant execute on function public.publish_astraeon_player_action(text,smallint,bigint,bigint) to authenticated;
grant execute on function public.clear_astraeon_player_runtime() to authenticated;

-- Client Broadcast cannot provide a verifiable sender identity. Keep only Presence
-- on the private channel; trusted state/actions arrive through RLS-backed tables.
drop policy if exists "astraeon_realtime_receive" on realtime.messages;
create policy "astraeon_realtime_receive" on realtime.messages
for select to authenticated
using (
  (select realtime.topic()) like 'world:astraeon:%'
  and realtime.messages.extension = 'presence'
  and public.astraeon_has_online_access()
);

drop policy if exists "astraeon_realtime_send" on realtime.messages;
create policy "astraeon_realtime_send" on realtime.messages
for insert to authenticated
with check (
  (select realtime.topic()) like 'world:astraeon:%'
  and realtime.messages.extension = 'presence'
  and public.astraeon_has_online_access()
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'player_runtime_states'
  ) then
    alter publication supabase_realtime add table public.player_runtime_states;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'player_runtime_actions'
  ) then
    alter publication supabase_realtime add table public.player_runtime_actions;
  end if;
end;
$$;

comment on table public.player_runtime_states is
  'Bounded cosmetic player state. Identity is always auth.uid(), never a broadcast payload.';
comment on table public.player_runtime_actions is
  'Bounded cosmetic action stream; one row per authenticated user prevents unbounded growth.';

commit;
