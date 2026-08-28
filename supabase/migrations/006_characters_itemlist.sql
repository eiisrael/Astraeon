-- ASTRAEON ONLINE 6.0 — character slots + editable ItemList
-- Execute after 005_admin_live_tools.sql.

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 4),
  name text not null check (char_length(name) between 1 and 18),
  class_id text not null check (class_id in ('Warrior','Mage','Archer','Assassin','Paladine')),
  level integer not null default 1 check (level between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slot)
);
create unique index if not exists characters_user_name_lower_uidx on public.characters(user_id, lower(name));
create index if not exists characters_user_updated_idx on public.characters(user_id, updated_at desc);

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at before update on public.characters
for each row execute function public.set_updated_at();

create table if not exists public.character_saves (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  save_data jsonb not null default '{}'::jsonb check (octet_length(save_data::text) <= 1048576),
  world_seed text not null default '' check (char_length(world_seed) <= 64),
  updated_at timestamptz not null default now(),
  unique(character_id, user_id)
);
create index if not exists character_saves_user_updated_idx on public.character_saves(user_id, updated_at desc);

alter table public.profiles add column if not exists active_character_id uuid references public.characters(id) on delete set null;

alter table public.characters enable row level security;
alter table public.character_saves enable row level security;

drop policy if exists "astraeon_characters_read_own" on public.characters;
create policy "astraeon_characters_read_own" on public.characters for select to authenticated
using (user_id = auth.uid() and public.astraeon_has_online_access());

drop policy if exists "astraeon_character_saves_read_own" on public.character_saves;
create policy "astraeon_character_saves_read_own" on public.character_saves for select to authenticated
using (user_id = auth.uid() and public.astraeon_has_online_access());

drop policy if exists "astraeon_character_saves_insert_own" on public.character_saves;
create policy "astraeon_character_saves_insert_own" on public.character_saves for insert to authenticated
with check (user_id = auth.uid() and public.astraeon_has_online_access() and exists(select 1 from public.characters c where c.id=character_id and c.user_id=auth.uid()));

drop policy if exists "astraeon_character_saves_update_own" on public.character_saves;
create policy "astraeon_character_saves_update_own" on public.character_saves for update to authenticated
using (user_id = auth.uid() and public.astraeon_has_online_access())
with check (user_id = auth.uid() and public.astraeon_has_online_access());

revoke all on public.characters, public.character_saves from anon;
grant select on public.characters to authenticated;
grant select, insert, update on public.character_saves to authenticated;

create or replace function public.create_astraeon_character(character_name text, character_class text)
returns public.characters
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  chosen_slot smallint;
  created public.characters;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if not public.astraeon_has_online_access() then raise exception 'online_access_required'; end if;
  character_name := btrim(coalesce(character_name,''));
  if char_length(character_name) < 1 or char_length(character_name) > 18 then raise exception 'invalid_character_name'; end if;
  if character_class not in ('Warrior','Mage','Archer','Assassin','Paladine') then raise exception 'invalid_character_class'; end if;
  select s into chosen_slot from generate_series(1,4) s
  where not exists(select 1 from public.characters c where c.user_id=uid and c.slot=s)
  order by s limit 1;
  if chosen_slot is null then raise exception 'character_limit_reached'; end if;
  insert into public.characters(user_id,slot,name,class_id) values(uid,chosen_slot,character_name,character_class) returning * into created;
  update public.profiles set active_character_id=created.id, display_name=created.name, class_id=created.class_id, level=created.level where id=uid;
  return created;
exception when unique_violation then
  raise exception 'character_name_in_use';
end;
$$;
revoke all on function public.create_astraeon_character(text,text) from public;
grant execute on function public.create_astraeon_character(text,text) to authenticated;

create or replace function public.set_active_astraeon_character(target_character uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
declare c public.characters;
begin
  select * into c from public.characters where id=target_character and user_id=auth.uid();
  if c.id is null then raise exception 'character_not_found'; end if;
  update public.profiles set active_character_id=c.id,display_name=c.name,class_id=c.class_id,level=c.level where id=auth.uid();
  return true;
end;$$;
revoke all on function public.set_active_astraeon_character(uuid) from public;
grant execute on function public.set_active_astraeon_character(uuid) to authenticated;

create or replace function public.delete_astraeon_character(target_character uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.characters where id=target_character and user_id=auth.uid()) then raise exception 'character_not_found'; end if;
  delete from public.characters where id=target_character and user_id=auth.uid();
  update public.profiles p set active_character_id=(select c.id from public.characters c where c.user_id=auth.uid() order by c.slot limit 1)
  where p.id=auth.uid();
  return true;
end;$$;
revoke all on function public.delete_astraeon_character(uuid) from public;
grant execute on function public.delete_astraeon_character(uuid) to authenticated;

-- Migrate the previous single cloud save to slot 1 once, without deleting the legacy row.
insert into public.characters(user_id,slot,name,class_id,level)
select p.id,1,
  left(coalesce(nullif(ps.save_data#>>'{player,name}',''),nullif(p.display_name,''),p.username,'Viajante'),18),
  case when coalesce(ps.save_data#>>'{player,classId}',p.class_id,'Warrior') in ('Warrior','Mage','Archer','Assassin','Paladine') then coalesce(ps.save_data#>>'{player,classId}',p.class_id,'Warrior') else 'Warrior' end,
  greatest(1,least(999,coalesce(nullif(ps.save_data#>>'{player,level}','')::integer,p.level,1)))
from public.profiles p join public.player_saves ps on ps.user_id=p.id
where not exists(select 1 from public.characters c where c.user_id=p.id)
on conflict do nothing;

insert into public.character_saves(character_id,user_id,save_data,world_seed,updated_at)
select c.id,ps.user_id,ps.save_data,ps.world_seed,ps.updated_at
from public.player_saves ps join public.characters c on c.user_id=ps.user_id and c.slot=1
on conflict(character_id) do nothing;

update public.profiles p set active_character_id=c.id
from public.characters c where c.user_id=p.id and c.slot=1 and p.active_character_id is null;

-- Editable server ItemList. stats keeps both classic and new RPG attributes.
create table if not exists public.item_configs (
  item_id text primary key check (item_id ~ '^[a-z0-9_\-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 64),
  item_type text not null default 'equipment' check (item_type in ('equipment','consumable','material')),
  slot text check (slot is null or slot in ('weapon','head','chest','hands','boots','ring','amulet','relic')),
  rarity text not null default 'common' check (rarity in ('common','uncommon','rare','epic','legendary')),
  allowed_classes text[] not null default array[]::text[],
  description text not null default '' check (char_length(description) <= 360),
  icon text not null default '◇' check (char_length(icon) <= 16),
  image_url text not null default '' check (char_length(image_url) <= 1024),
  stats jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists item_configs_set_updated_at on public.item_configs;
create trigger item_configs_set_updated_at before update on public.item_configs for each row execute function public.set_updated_at();
alter table public.item_configs enable row level security;
drop policy if exists "astraeon_items_read" on public.item_configs;
create policy "astraeon_items_read" on public.item_configs for select to authenticated using(public.astraeon_has_online_access());
drop policy if exists "astraeon_items_admin_all" on public.item_configs;
create policy "astraeon_items_admin_all" on public.item_configs for all to authenticated using(public.astraeon_is_admin()) with check(public.astraeon_is_admin());
revoke all on public.item_configs from anon;
grant select,insert,update,delete on public.item_configs to authenticated;

-- Seed the core catalog. Admin Studio can add/remove/edit any record afterwards.
insert into public.item_configs(item_id,name,item_type,slot,rarity,allowed_classes,description,icon,stats) values
('warrior_blade','Espada de Astrium','equipment','weapon','rare',array['Warrior'],'Lâmina astral de combate frontal.','⚔','{"power":4,"strength":4}'::jsonb),
('mage_staff','Cetro de Lúmen','equipment','weapon','rare',array['Mage'],'Canalizador de magia e mana.','⚕','{"power":4,"magic":5,"maxMana":12}'::jsonb),
('archer_bow','Arco de Éter','equipment','weapon','rare',array['Archer'],'Arco leve de longo alcance.','➶','{"power":4,"dexterity":5,"range":16}'::jsonb),
('assassin_blades','Lâminas do Vazio','equipment','weapon','rare',array['Assassin'],'Lâminas rápidas para golpes críticos.','⚔','{"power":4,"dexterity":5,"crit":0.025}'::jsonb),
('paladine_mace','Maça Solar','equipment','weapon','rare',array['Paladine'],'Arma jurada de impacto e proteção.','✹','{"power":3,"strength":3,"defense":2}'::jsonb),
('rune_blade','Lâmina Rúnica','equipment','weapon','uncommon',array['Warrior','Assassin'],'Lâmina marcada por runas instáveis.','⚔','{"power":3,"strength":2}'::jsonb),
('lumen_hood','Capuz de Lúmen','equipment','head','uncommon',array['Mage','Archer'],'Proteção leve do bosque.','♜','{"defense":2,"maxMana":6,"magic":2}'::jsonb),
('frost_crown','Coroa de Nivora','equipment','head','rare',array['Mage','Paladine'],'Cristais que estabilizam mente e corpo.','♜','{"defense":3,"maxMana":12,"magic":3}'::jsonb),
('wanderer_cloak','Manto do Caminhante','equipment','chest','uncommon',array['Warrior','Mage','Archer','Assassin','Paladine'],'Manto resistente a climas extremos.','◈','{"defense":3,"maxHp":12}'::jsonb),
('astrium_armor','Peitoral de Astrium','equipment','chest','rare',array['Warrior','Paladine'],'Placas que reverberam contra impactos.','◈','{"defense":5,"maxHp":24,"strength":2}'::jsonb),
('void_gloves','Luvas do Vazio','equipment','hands','rare',array['Assassin','Archer'],'Luvas de reação veloz.','✦','{"power":2,"crit":0.02,"dexterity":3}'::jsonb),
('hunter_boots','Botas de Caçador','equipment','boots','uncommon',array['Archer','Assassin'],'Botas para deslocamento rápido.','⌁','{"speed":8,"defense":1,"dexterity":3}'::jsonb),
('solar_boots','Passos de Solvar','equipment','boots','rare',array['Warrior','Paladine'],'Botas aquecidas por minério solar.','⌁','{"speed":12,"maxHp":8}'::jsonb),
('ether_ring','Anel de Éter','equipment','ring','rare',array['Warrior','Mage','Archer','Assassin','Paladine'],'Amplifica ressonância ofensiva.','◌','{"power":2,"crit":0.018}'::jsonb),
('umbria_ring','Selo de Umbria','equipment','ring','epic',array['Warrior','Mage','Archer','Assassin','Paladine'],'Recompensa precisão e risco.','◌','{"power":3,"crit":0.035}'::jsonb),
('climate_talisman','Talismã Climático','equipment','amulet','rare',array['Warrior','Mage','Archer','Assassin','Paladine'],'Equilibra energia em condições hostis.','◇','{"maxHp":18,"maxMana":10,"defense":2,"healPct":5,"manaPct":5}'::jsonb),
('convergence_amulet','Amuleto da Convergência','equipment','amulet','epic',array['Warrior','Mage','Archer','Assassin','Paladine'],'Condensa ecos de vários biomas.','◇','{"power":3,"defense":2,"maxMana":16,"healPct":8,"manaPct":8}'::jsonb),
('astral_core','Núcleo de Astra','equipment','relic','legendary',array['Warrior','Mage','Archer','Assassin','Paladine'],'Relíquia da Convergência.','✧','{"power":8,"defense":4,"maxHp":30,"maxMana":20,"strength":4,"magic":4,"dexterity":4,"healPct":12,"manaPct":12}'::jsonb),
('red_potion','Poção Rubra','consumable',null,'common',array[]::text[],'Restaura vida.','♥','{"heal":45,"healPct":0}'::jsonb),
('blue_potion','Poção de Éter','consumable',null,'uncommon',array[]::text[],'Restaura mana.','✦','{"mana":55,"manaPct":0}'::jsonb),
('astral_fragment','Fragmento Astral','material',null,'uncommon',array[]::text[],'Matéria condensada para artesanato.','◆','{}'::jsonb),
('core_fragment','Fragmento de Núcleo','material',null,'rare',array[]::text[],'Fragmento antigo ainda energizado.','◆','{}'::jsonb)
on conflict(item_id) do nothing;
