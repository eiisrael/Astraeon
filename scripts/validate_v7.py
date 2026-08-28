#!/usr/bin/env python3
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []

def text(path):
    p = ROOT / path
    if not p.exists():
        ERRORS.append(f'arquivo ausente: {path}')
        return ''
    return p.read_text(encoding='utf-8')

def require(path, needles):
    body = text(path)
    for needle in needles:
        if needle not in body:
            ERRORS.append(f'{path}: contrato V7 ausente: {needle}')
    return body

required = [
    'src/gameplay-v7.js','src/inventory-v7.js','src/inventory-v7.css',
    'src/menu-account-v7.js','src/menu-account-v7.css','src/spawn-runtime-v7.js',
    'src/system-style-v7.js','src/admin-v7.js','src/admin-v7.css',
    'supabase/migrations/010_astraeon_v7_runtime_admin.sql'
]
for path in required:
    if not (ROOT / path).exists(): ERRORS.append(f'arquivo V7 ausente: {path}')

require('src/gameplay-v7.js', [
    'macroHeld','macroStep','cooldowns','contextmenu','e.button!==2',
    "e.key!=='Enter'",'focusChat','5000','skill-editing','drawObjectShadows','astra-sun-v7'
])
inv = require('src/inventory-v7.js', [
    'backpackCapacity=25','for(let i=visible;i<25;i++)','data-inv-tab="itemlist"',
    'item-tooltip-v7','itemHoldV7','allowedClasses','Valor de venda','saleValue','enforceCapacity'
])
for forbidden in ['10% do valor','10% do preço','valor de compra sempre']:
    if forbidden.lower() in inv.lower(): ERRORS.append(f'src/inventory-v7.js: regra interna de preço exposta na interface: {forbidden}')
require('src/inventory-v7.css', ['grid-template-columns:repeat(5','item-tooltip-v7','inventory-v7-empty-slot'])
require('src/menu-account-v7.js', [
    'ASTRAEON UNIVERSE ONLINE · CIDADES VIVAS · QUESTS · MMORPG','Bem vindo(a)',
    'GUIA DO VIAJANTE','characterCreateFromPanel',"b.textContent='Jogar'",'avatar_url',
    "storage.from('avatars')",'signInWithPassword','request_astraeon_account_deletion',
    'cancel_astraeon_account_deletion','7 dias'
])
require('src/menu-account-v7.css', ['.world-art:after{content:""!important;display:none!important}','account-welcome-v7','account-delete-v7'])
require('src/spawn-runtime-v7.js', ['map_mob_spawn_rates','spawn_rate','currentMap','postgres_changes','rateFor'])
require('src/system-style-v7.js', ['system_messages','line_width','--sys-line-width-v7','postgres_changes'])
require('src/admin-v7.js', [
    'Meus Personagens','Regras do Jogo','Balanceamento das Classes','admin-tool-grid-v7',
    'map_mob_spawn_rates','Rate de Spawn por Mapa','system-line-width-v7','state.drag',
    'Objeto movido','Área movida','scene-remove-v7'
])
require('src/admin-v7.css', ['admin-tool-grid-v7','admin-my-chars-v7','mob-spawn-rate-v7','item-detail-editor','system-line-width-v7'])

auth = require('src/admin-auth-v4.js', ['Promise.all','src/admin-v7.js',"document.title='ASTRAEON — ADMIN STUDIO'"])
ui = require('src/ui-v3.js', [
    'src/gameplay-v7.js','src/inventory-v7.js','src/menu-account-v7.js','src/system-style-v7.js','src/spawn-runtime-v7.js'
])

migration = require('supabase/migrations/010_astraeon_v7_runtime_admin.sql', [
    'add column if not exists avatar_url','grant update (avatar_url)','add column if not exists line_width',
    'create table if not exists public.map_mob_spawn_rates','create table if not exists public.account_deletion_requests',
    "interval '7 days'",'set access=2','request_astraeon_account_deletion','cancel_astraeon_account_deletion',
    'process_astraeon_account_deletions','delete from storage.objects','delete from auth.users',
    "values('avatars','avatars',true,2097152",'astraeon_avatar_insert_own','supabase_realtime','pg_cron'
])

try:
    pkg = json.loads(text('package.json'))
    if pkg.get('version') != '7.0.0': ERRORS.append('package.json: version deve ser 7.0.0')
except Exception as exc:
    ERRORS.append(f'package.json inválido: {exc}')

if ERRORS:
    print('ASTRAEON 7.0 validation FAILED')
    for err in ERRORS: print(' -', err)
    sys.exit(1)
print('ASTRAEON 7.0 validation OK')
print('Gameplay, inventário, conta, spawn, mensagens, Admin Studio e migration 010: contratos presentes.')
