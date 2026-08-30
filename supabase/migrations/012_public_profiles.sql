-- ASTRAEON SECURITY 7.0 — isolate internal profiles and expose only deliberate
-- public identity projections through bounded, access-aware RPCs.
-- Execute after 011_security_hardening.sql.

begin;

drop policy if exists "astraeon_profiles_read" on public.profiles;
drop policy if exists "astraeon_profiles_read_own" on public.profiles;
create policy "astraeon_profiles_read_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = true)
as
select
  p.username,
  p.display_name,
  coalesce(c.class_id, p.class_id) as class_id,
  coalesce(c.level, p.level) as level
from public.profiles p
left join public.characters c
  on c.id = p.active_character_id
 and c.user_id = p.id
where p.access <> 0;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

create or replace function public.resolve_public_astraeon_profiles(target_users uuid[])
returns table (
  user_id uuid,
  username text,
  display_name text,
  class_id text,
  level integer,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.astraeon_require_online_access();
  if coalesce(cardinality(target_users), 0) = 0 then return; end if;
  if cardinality(target_users) > 100 then raise exception 'profile_lookup_limit'; end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    coalesce(c.class_id, p.class_id),
    coalesce(c.level, p.level),
    p.access = 3
  from public.profiles p
  join (select distinct unnest(target_users) as id) requested on requested.id = p.id
  left join public.characters c
    on c.id = p.active_character_id
   and c.user_id = p.id
  where p.access <> 0;
end;
$$;

create or replace function public.resolve_public_astraeon_profile_names(target_usernames text[])
returns table (
  username text,
  display_name text,
  class_id text,
  level integer,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.astraeon_require_online_access();
  if coalesce(cardinality(target_usernames), 0) = 0 then return; end if;
  if cardinality(target_usernames) > 50 then raise exception 'profile_lookup_limit'; end if;

  return query
  select
    p.username,
    p.display_name,
    coalesce(c.class_id, p.class_id),
    coalesce(c.level, p.level),
    p.access = 3
  from public.profiles p
  join (
    select distinct lower(btrim(value)) as username
    from unnest(target_usernames) as requested_name(value)
    where value ~ '^[A-Za-z0-9_]{3,18}$'
  ) requested on requested.username = lower(p.username)
  left join public.characters c
    on c.id = p.active_character_id
   and c.user_id = p.id
  where p.access <> 0;
end;
$$;

revoke all on function public.resolve_public_astraeon_profiles(uuid[]) from public;
revoke all on function public.resolve_public_astraeon_profile_names(text[]) from public;
grant execute on function public.resolve_public_astraeon_profiles(uuid[]) to authenticated;
grant execute on function public.resolve_public_astraeon_profile_names(text[]) to authenticated;

comment on view public.public_profiles is
  'Minimal self-visible profile projection. Cross-user identity resolution uses bounded RPCs.';
comment on function public.resolve_public_astraeon_profiles(uuid[]) is
  'Returns only public presentation metadata for at most 100 non-banned users.';

commit;
