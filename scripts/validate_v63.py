#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []


def read(path):
    p = ROOT / path
    if not p.exists():
        ERRORS.append(f'arquivo ausente: {path}')
        return ''
    return p.read_text(encoding='utf-8')


def require(path, needles):
    body = read(path)
    for needle in needles:
        if needle not in body:
            ERRORS.append(f'{path}: contrato 6.3 ausente: {needle}')
    return body


required = [
    'src/gameplay-v63.js', 'src/gameplay-v63.css',
    'src/inventory-v63.js', 'src/inventory-v63.css',
    'src/menu-account-v63.js', 'src/menu-account-v63.css',
    'src/system-announcement-v63.js',
    'src/admin-v63.js', 'src/admin-v63.css',
    'supabase/migrations/010_v63_game_admin_account.sql',
]
for path in required:
    if not (ROOT / path).exists():
        ERRORS.append(f'arquivo 6.3 ausente: {path}')

require('src/game-v2.js', ["e.button !== 0", 'this.basicAttack()'])
require('src/gameplay-v63.js', [
    'BAG_CAPACITY=25', 'macroHeld', 'readySkill', 'cooldowns', 'SKILL_COSTS',
    'e.button===2', 'contextmenu', "e.key!=='Enter'", '5000',
    'skill-layout-editing', 'mobile-skill-layout', 'sunVector', 'entityShadow',
    'spawn_rates', 'applySpawnRates'
])

inventory = require('src/inventory-v63.js', [
    'const BAG=25', 'data-inv-tab="itemlist"', 'itemTooltipV63',
    'Valor de venda', 'allowedClasses', 'saleValue', 'purchaseValue',
    'while(grid.children.length<BAG)'
])
for exposed in ('10% do valor', '10% do preço', 'sempre será 10%', 'valor de compra sempre'):
    if exposed.lower() in inventory.lower():
        ERRORS.append(f'src/inventory-v63.js: regra interna de venda exposta: {exposed}')
require('src/inventory-v63.css', ['grid-template-columns:repeat(5', 'item-tooltip-v63', 'item-hold-loading'])

require('src/menu-account-v63.js', [
    'ASTRAEON UNIVERSE ONLINE - CIDADES VIVAS - QUESTS - MMORPG',
    'Bem vindo(a)', 'GUIA DO VIAJANTE', "b.textContent='Jogar'",
    'characterCreateFromPanel', 'avatar_url', 'bio', 'astraeon-avatars',
    'signInWithPassword', 'request_astraeon_account_deletion',
    'cancel_astraeon_account_deletion', '7 dias'
])
require('src/menu-account-v63.css', [
    '#startScreen .world-art:after{content:none!important}',
    'member-welcome-v63', 'character-slot-grid', 'account-delete-v63'
])

require('src/system-announcement-v63.js', ['line_width', '--sys-line-width'])
require('src/admin-runtime-v3c.js', ['backpackCapacity:25', 'cfg.gameplay.backpackCapacity=25', 'Number(g.backpackCapacity)||25'])
require('src/admin-v63.js', [
    'ADMIN STUDIO', 'Meus Personagens', 'Regras do Jogo',
    'Balanceamento das Classes', 'admin-tool-grid-v63',
    'Rate de Spawn por mapa', 'spawn_rates', 'line_width',
    'scene-row-delete-v63', 'beginCanvasDrag', 'moveCanvasDrag',
    'Objeto movido', 'Área movida'
])
require('src/admin-v63.css', [
    'admin-tool-grid-v63', 'own-char-layout-v63', 'mob-spawn-v63',
    'system-line-control-v63', 'item-editor-v63', 'scene-row-delete-v63'
])

ui = require('src/ui-v3.js', [
    'src/gameplay-v63.js', 'src/inventory-v63.js',
    'src/menu-account-v63.js', 'src/system-announcement-v63.js'
])
for forbidden in ('src/gameplay-v7.js', 'src/inventory-v7.js', 'src/menu-account-v7.js', 'src/admin-v7.js'):
    if forbidden in ui:
        ERRORS.append(f'src/ui-v3.js: loader concorrente proibido: {forbidden}')
if "querySelectorAll('#mobileControls [data-skill]')" in ui:
    ERRORS.append('src/ui-v3.js: skill mobile deve ser controlada apenas por gameplay-v63.js')

auth = require('src/admin-auth-v4.js', ['Promise.all', 'src/admin-v63.js', "document.title='ASTRAEON — ADMIN STUDIO'"])
if 'admin-v7.js' in auth:
    ERRORS.append('src/admin-auth-v4.js: admin-v7 concorrente não pode ser carregado')

migration = require('supabase/migrations/010_v63_game_admin_account.sql', [
    'add column if not exists line_width',
    'add column if not exists spawn_rates',
    'add column if not exists avatar_url',
    'add column if not exists bio',
    'create table if not exists public.account_deletion_queue',
    "interval '7 days'", 'set access=2',
    'request_astraeon_account_deletion', 'cancel_astraeon_account_deletion',
    'process_due_astraeon_account_deletions',
    "bucket_id='astraeon-avatars'", 'delete from storage.objects',
    'delete from auth.users', 'pg_cron'
])

try:
    pkg = json.loads(read('package.json'))
    if pkg.get('version') != '6.3.0':
        ERRORS.append('package.json: version deve ser 6.3.0')
except Exception as exc:
    ERRORS.append(f'package.json inválido: {exc}')

if ERRORS:
    print('ASTRAEON 6.3 validation FAILED')
    for error in ERRORS:
        print(' -', error)
    sys.exit(1)

print('ASTRAEON 6.3 validation OK')
print('Base cb9 + gameplay, inventário 25 slots, conta e Admin Studio: contratos presentes.')
