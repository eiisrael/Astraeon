#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]

def require(path,*needles):
    file=ROOT/path
    if not file.exists():
        errors.append(f'{path}: ausente')
        return
    text=file.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            errors.append(f'{path}: contrato ausente: {needle}')

require('supabase/migrations/008_world_maps_places.sql',
        'create table if not exists public.world_maps',
        'create table if not exists public.world_places',
        "'map1','Mapa 1'",
        'world_maps_admin_all',
        'world_places_admin_all',
        'supabase_realtime')
require('src/admin-worldmaps-v61.js',
        'MobList & Drops',
        'mob-gallery',
        'Mapas & Locais',
        'createAdjacentMap',
        "from('world_maps')",
        "from('world_places')",
        'Abrir no Editor visual')
require('src/worldmaps-runtime-v61.js',
        'world_maps',
        'world_places',
        'transition',
        'adjacent',
        'mapKey',
        'postgres_changes',
        'applyBiomeNames',
        'applyCities')
require('src/admin-auth-v4.js','src/admin-worldmaps-v61.js')
require('src/ui-v3.js','src/worldmaps-runtime-v61.js')

if errors:
    print('ASTRAEON WORLDMAPS V6.1 validation FAILED')
    for error in errors:
        print(' -',error)
    sys.exit(1)
print('ASTRAEON WORLDMAPS V6.1 validation OK')
