-- ASTRAEON ONLINE 5.1 — Admin live tools, styled system messages and MobList
-- Execute after 004_system_message_kinds.sql.

alter table public.system_messages
  add column if not exists font_size smallint not null default 24,
  add column if not exists font_family text not null default 'Inter, sans-serif',
  add column if not exists color text not null default '#ffd34f';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'system_messages_font_size_check') then
    alter table public.system_messages add constraint system_messages_font_size_check check (font_size between 12 and 48);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'system_messages_font_family_check') then
    alter table public.system_messages add constraint system_messages_font_family_check check (char_length(font_family) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'system_messages_color_check') then
    alter table public.system_messages add constraint system_messages_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

create table if not exists public.mob_configs (
  mob_type text primary key,
  display_name text not null check (char_length(display_name) between 1 and 40),
  enabled boolean not null default true,
  stats jsonb not null default '{}'::jsonb check (octet_length(stats::text) <= 8192),
  drops jsonb not null default '[]'::jsonb check (jsonb_typeof(drops) = 'array' and octet_length(drops::text) <= 65536),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.mob_configs is 'Server-managed mob stats and drop lists. Read by authenticated players; write only by Access 3.';

drop trigger if exists mob_configs_set_updated_at on public.mob_configs;
create trigger mob_configs_set_updated_at
before update on public.mob_configs
for each row execute function public.set_updated_at();

insert into public.mob_configs(mob_type,display_name,stats,drops) values
 ('Slime','Slime','{"hp":42,"power":6,"speed":76,"xp":16,"gold":[1,5]}'::jsonb,'[]'::jsonb),
 ('Wolf','Lobo','{"hp":58,"power":8,"speed":112,"xp":24,"gold":[2,8]}'::jsonb,'[]'::jsonb),
 ('Globin','Goblin','{"hp":66,"power":9,"speed":88,"xp":28,"gold":[3,10]}'::jsonb,'[]'::jsonb),
 ('Orc','Orc','{"hp":88,"power":12,"speed":82,"xp":38,"gold":[4,14]}'::jsonb,'[]'::jsonb),
 ('Troll','Troll','{"hp":126,"power":15,"speed":62,"xp":54,"gold":[7,18]}'::jsonb,'[]'::jsonb),
 ('Pig_Monster','Monstro Javali','{"hp":74,"power":10,"speed":92,"xp":31,"gold":[3,11]}'::jsonb,'[]'::jsonb),
 ('Golem_Gelo','Golem de Gelo','{"hp":138,"power":15,"speed":54,"xp":62,"gold":[8,22]}'::jsonb,'[]'::jsonb),
 ('Spider','Aranha','{"hp":54,"power":9,"speed":105,"xp":27,"gold":[2,9]}'::jsonb,'[]'::jsonb),
 ('zombie','Zumbi','{"hp":82,"power":11,"speed":58,"xp":35,"gold":[3,12]}'::jsonb,'[]'::jsonb),
 ('sombra','Sombra','{"hp":70,"power":14,"speed":98,"xp":44,"gold":[5,16]}'::jsonb,'[]'::jsonb),
 ('Caveira','Caveira','{"hp":76,"power":12,"speed":90,"xp":37,"gold":[4,12]}'::jsonb,'[]'::jsonb),
 ('Squelleton','Esqueleto','{"hp":96,"power":13,"speed":78,"xp":43,"gold":[5,15]}'::jsonb,'[]'::jsonb),
 ('Draconato','Draconato','{"hp":168,"power":18,"speed":74,"xp":78,"gold":[10,28]}'::jsonb,'[]'::jsonb)
on conflict (mob_type) do nothing;

alter table public.mob_configs enable row level security;

drop policy if exists "astraeon_mob_configs_read" on public.mob_configs;
create policy "astraeon_mob_configs_read" on public.mob_configs
for select to authenticated using (public.astraeon_has_online_access());

drop policy if exists "astraeon_mob_configs_admin_insert" on public.mob_configs;
create policy "astraeon_mob_configs_admin_insert" on public.mob_configs
for insert to authenticated with check (public.astraeon_is_admin());

drop policy if exists "astraeon_mob_configs_admin_update" on public.mob_configs;
create policy "astraeon_mob_configs_admin_update" on public.mob_configs
for update to authenticated using (public.astraeon_is_admin()) with check (public.astraeon_is_admin());

drop policy if exists "astraeon_mob_configs_admin_delete" on public.mob_configs;
create policy "astraeon_mob_configs_admin_delete" on public.mob_configs
for delete to authenticated using (public.astraeon_is_admin());

revoke all on public.mob_configs from anon;
grant select, insert, update, delete on public.mob_configs to authenticated;

create or replace function public.admin_get_player_detail(target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.astraeon_is_admin() then raise exception 'admin_access_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id',p.id,'username',p.username,'display_name',p.display_name,'class_id',p.class_id,'level',p.level,'access',p.access,
      'last_seen',p.last_seen,'created_at',p.created_at,'updated_at',p.updated_at,
      'email',u.email,'email_confirmed_at',u.email_confirmed_at,'auth_created_at',u.created_at
    ),
    'save', ps.save_data,
    'world_seed', ps.world_seed,
    'save_updated_at', ps.updated_at
  ) into result
  from public.profiles p
  join auth.users u on u.id=p.id
  left join public.player_saves ps on ps.user_id=p.id
  where p.id=target_user;
  if result is null then raise exception 'player_not_found'; end if;
  return result;
end;
$$;

create or replace function public.admin_update_player_profile(
  target_user uuid,
  target_username text,
  target_display_name text,
  target_class_id text,
  target_level integer,
  target_access smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.astraeon_is_admin() then raise exception 'admin_access_required' using errcode='42501'; end if;
  if target_username is null or target_username !~ '^[A-Za-z0-9_]{3,18}$' then raise exception 'invalid_username'; end if;
  if target_display_name is null or char_length(btrim(target_display_name)) not between 1 and 24 then raise exception 'invalid_display_name'; end if;
  if target_class_id is not null and target_class_id not in ('Warrior','Mage','Archer','Assassin','Paladine') then raise exception 'invalid_class'; end if;
  if target_level not between 1 and 999 then raise exception 'invalid_level'; end if;
  if target_access not between 0 and 3 then raise exception 'invalid_access'; end if;
  if target_user=auth.uid() and target_access<>3 then raise exception 'cannot_remove_own_admin_access'; end if;
  update public.profiles set
    username=target_username,
    display_name=btrim(target_display_name),
    class_id=target_class_id,
    level=target_level,
    access=target_access,
    updated_at=now()
  where id=target_user;
  if not found then raise exception 'player_not_found'; end if;
  return public.admin_get_player_detail(target_user);
end;
$$;

create or replace function public.admin_update_player_save(target_user uuid, target_save jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  seed text;
begin
  if not public.astraeon_is_admin() then raise exception 'admin_access_required' using errcode='42501'; end if;
  if target_save is null or jsonb_typeof(target_save)<>'object' then raise exception 'invalid_save'; end if;
  if octet_length(target_save::text)>1048576 then raise exception 'save_too_large'; end if;
  seed:=left(coalesce(target_save->>'seed',''),64);
  insert into public.player_saves(user_id,save_data,world_seed,updated_at)
  values(target_user,target_save,seed,now())
  on conflict(user_id) do update set save_data=excluded.save_data,world_seed=excluded.world_seed,updated_at=excluded.updated_at;
  return public.admin_get_player_detail(target_user);
end;
$$;

revoke all on function public.admin_get_player_detail(uuid) from public;
revoke all on function public.admin_update_player_profile(uuid,text,text,text,integer,smallint) from public;
revoke all on function public.admin_update_player_save(uuid,jsonb) from public;
grant execute on function public.admin_get_player_detail(uuid) to authenticated;
grant execute on function public.admin_update_player_profile(uuid,text,text,text,integer,smallint) to authenticated;
grant execute on function public.admin_update_player_save(uuid,jsonb) to authenticated;
