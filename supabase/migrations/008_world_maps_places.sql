-- ASTRAEON ONLINE — connected world maps + editable world place names
-- Execute after 007_admin_character_slots.sql.

create table if not exists public.world_maps (
  id uuid primary key default gen_random_uuid(),
  map_key text not null unique check (map_key ~ '^map[1-9][0-9]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 64),
  map_order integer not null default 1 check (map_order between 1 and 9999),
  grid_x integer not null default 0 check (grid_x between -100 and 100),
  grid_y integer not null default 0 check (grid_y between -100 and 100),
  width integer not null default 96 check (width between 16 and 512),
  height integer not null default 96 check (height between 16 and 512),
  seed text not null default 'ASTRAEON-2' check (char_length(seed) between 1 and 64),
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design)='object' and octet_length(design::text) <= 4194304),
  is_default boolean not null default false,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists world_maps_grid_uidx on public.world_maps(grid_x,grid_y);
create unique index if not exists world_maps_single_default_uidx on public.world_maps(is_default) where is_default=true;
create index if not exists world_maps_order_idx on public.world_maps(map_order,map_key);

drop trigger if exists world_maps_set_updated_at on public.world_maps;
create trigger world_maps_set_updated_at before update on public.world_maps
for each row execute function public.set_updated_at();

insert into public.world_maps(map_key,name,map_order,grid_x,grid_y,width,height,seed,design,is_default,enabled)
values(
  'map1','Mapa 1',1,0,0,96,96,'ASTRAEON-2',
  '{"version":"2.0.0","seed":"ASTRAEON-2","width":96,"height":96,"overrides":{},"spawns":[],"sceneObjects":[],"zones":[],"_legacy_import_pending":true}'::jsonb,
  true,true
)
on conflict(map_key) do nothing;

create table if not exists public.world_places (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.world_maps(id) on delete cascade,
  place_key text not null check (place_key ~ '^[a-z0-9_\-]{2,80}$'),
  place_type text not null check (place_type in ('area','city','village','continent')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  subtitle text not null default '' check (char_length(subtitle) <= 180),
  biome_id text check (biome_id is null or biome_id in ('forest','steppe','frost','swamp','highland')),
  x numeric(10,2),
  y numeric(10,2),
  radius numeric(10,2) check (radius is null or radius between 0 and 512),
  accent text not null default '#d7b86b' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(map_id,place_key)
);

create index if not exists world_places_map_idx on public.world_places(map_id,place_type,enabled);

drop trigger if exists world_places_set_updated_at on public.world_places;
create trigger world_places_set_updated_at before update on public.world_places
for each row execute function public.set_updated_at();

with m as (select id from public.world_maps where map_key='map1' limit 1),
seed(place_key,place_type,name,subtitle,biome_id,x,y,radius,accent) as (values
  ('continent_astraeon','continent','Astraeon','Continente vivo da Convergência',null,null,null,null,'#d7b86b'),
  ('area_forest','area','Bosque de Lúmen','Temperado úmido','forest',null,null,null,'#89d69a'),
  ('area_steppe','area','Ermos de Solvar','Árido e quente','steppe',null,null,null,'#ffc76c'),
  ('area_frost','area','Véu de Nivora','Glacial','frost',null,null,null,'#baf4ff'),
  ('area_swamp','area','Pântano de Umbria','Úmido e sombrio','swamp',null,null,null,'#9ad07a'),
  ('area_highland','area','Altos de Cinza','Rochoso e ventoso','highland',null,null,null,'#e5a772'),
  ('astralum','city','Astralum','Coração da Convergência','forest',48,48,7,'#e6b85f'),
  ('lumenfall','city','Lúmenfall','Cidade das Copas Antigas','forest',18,27,5,'#79c98c'),
  ('solvaris','city','Solvaris','Mercado do Sol Ardente','steppe',76,33,5,'#e4a657'),
  ('nivora','city','Nivora','Fortaleza do Véu','frost',50,11,5,'#9dd9e8'),
  ('umbravale','city','Umbra Vale','Refúgio das Águas Escuras','swamp',21,75,5,'#7fa57a'),
  ('cinzalta','city','Cinzalta','Bastião dos Altos de Cinza','highland',74,75,5,'#d08d67')
)
insert into public.world_places(map_id,place_key,place_type,name,subtitle,biome_id,x,y,radius,accent)
select m.id,s.place_key,s.place_type,s.name,s.subtitle,s.biome_id,s.x,s.y,s.radius,s.accent
from m cross join seed s
on conflict(map_id,place_key) do nothing;

alter table public.world_maps enable row level security;
alter table public.world_places enable row level security;

drop policy if exists "astraeon_world_maps_read" on public.world_maps;
create policy "astraeon_world_maps_read" on public.world_maps for select to authenticated
using (public.astraeon_has_online_access());

drop policy if exists "astraeon_world_maps_admin_all" on public.world_maps;
create policy "astraeon_world_maps_admin_all" on public.world_maps for all to authenticated
using (public.astraeon_is_admin()) with check (public.astraeon_is_admin());

drop policy if exists "astraeon_world_places_read" on public.world_places;
create policy "astraeon_world_places_read" on public.world_places for select to authenticated
using (public.astraeon_has_online_access());

drop policy if exists "astraeon_world_places_admin_all" on public.world_places;
create policy "astraeon_world_places_admin_all" on public.world_places for all to authenticated
using (public.astraeon_is_admin()) with check (public.astraeon_is_admin());

revoke all on public.world_maps, public.world_places from anon;
grant select,insert,update,delete on public.world_maps to authenticated;
grant select,insert,update,delete on public.world_places to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='world_maps'
  ) then
    alter publication supabase_realtime add table public.world_maps;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='world_places'
  ) then
    alter publication supabase_realtime add table public.world_places;
  end if;
end $$;
