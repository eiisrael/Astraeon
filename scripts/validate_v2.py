#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []

class Inspector(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if 'id' in d: self.ids.append(d['id'])
        if tag=='script' and d.get('src'): self.refs.append(d['src'])
        if tag=='link' and d.get('href') and not d['href'].startswith(('http://','https://')): self.refs.append(d['href'])

def inspect_html(name):
    path=ROOT/name
    if not path.exists(): ERRORS.append(f'{name}: ausente'); return set()
    p=Inspector(); p.feed(path.read_text(encoding='utf-8'))
    dup={x for x in p.ids if p.ids.count(x)>1}
    if dup: ERRORS.append(f'{name}: IDs duplicados: {sorted(dup)}')
    for ref in p.refs:
        clean=ref.split('?',1)[0].split('#',1)[0]
        if clean and not (ROOT/clean).exists(): ERRORS.append(f'{name}: referência local ausente: {clean}')
    return set(p.ids)

def check_js_ids(js_name, html_ids):
    path=ROOT/js_name
    if not path.exists(): ERRORS.append(f'{js_name}: ausente'); return
    text=path.read_text(encoding='utf-8')
    selectors=set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)", text))
    selectors.update(re.findall(r"document\.querySelector\(['\"]#([A-Za-z0-9_-]+)['\"]\)", text))
    missing=sorted(selectors-html_ids)
    if missing: ERRORS.append(f'{js_name}: IDs não encontrados no HTML: {missing}')

def require_needles(file_name, needles):
    path=ROOT/file_name
    if not path.exists(): return
    text=path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text: ERRORS.append(f'{file_name}: contrato ausente: {needle}')

index_ids=inspect_html('index.html')
editor_ids=inspect_html('game-editor.html')
check_js_ids('src/game-v2.js', index_ids)
check_js_ids('src/inventory-v2.js', index_ids)
check_js_ids('src/editor-v2.js', editor_ids)
check_js_ids('src/ui-v3.js', index_ids)
check_js_ids('src/admin-runtime-v3c.js', index_ids)
check_js_ids('src/admin-auth-v4.js', editor_ids)

required=[
 'src/world-v2.js','src/game-v2.js','src/inventory-v2.js','src/inventory-v3.js','src/ui-v3.js','src/systems-v3b.js','src/admin-runtime-v3c.js',
 'src/world-online-v4.js','src/npcs-v4.js','src/realtime-security-v1.js','src/multiplayer-v4.js','src/online-controller-v4.js','src/chat-system-v4.js','src/combat-focus-v4.js','src/account-status-v4.js','src/online-v4.css','src/online-fixes-v4.css','src/live-runtime-v5.js','src/vendor/supabase-v2.js',
 'src/production-runtime-v6.js','src/character-system-v6.js','src/production-v6.css',
 'src/editor-v2.js','src/admin-v3c.js','src/admin-studio-v4.js','src/admin-auth-v4.js','src/admin-mfa-v1.js','src/admin-accounts-v4.js','src/admin-system-messages-v4.js','src/admin-live-tools-v5.js','src/admin-character-slots-v6.js','src/admin-production-v6.js','src/admin-auth-v4.css','src/admin-fullscreen-v64.css','src/astraeon-v2.css','src/inventory-v2.css','src/ui-v3.css','src/ui-v3b.css','src/typography-v3c.css','src/editor-v2.css','src/editor-v3c.css','src/editor-studio-v4.css',
 'api/config.js','api/admin-access.js','api/progression-authority.js','vercel.json','package.json','package-lock.json','.env.example','.gitignore','README.md','INSTALLME.md','ONLINE_SETUP.md','SECURITY.md','COPYRIGHT.md','LICENSE','scripts/check_secrets.py','scripts/build_vendor.mjs','scripts/test_security_contracts.mjs','supabase/config.toml','supabase/tests/001_security_authorization.sql',
 'supabase/migrations/001_astraeon_online.sql','supabase/migrations/002_access_admin_security.sql','supabase/migrations/003_system_messages.sql','supabase/migrations/004_system_message_kinds.sql','supabase/migrations/005_admin_live_tools.sql','supabase/migrations/006_characters_itemlist.sql','supabase/migrations/007_admin_character_slots.sql','supabase/migrations/008_world_maps_places.sql','supabase/migrations/009_admin_realtime_backups.sql','supabase/migrations/010_inventory_standard_slots.sql','supabase/migrations/011_security_hardening.sql','supabase/migrations/012_public_profiles.sql','supabase/migrations/013_admin_pagination.sql','supabase/migrations/014_realtime_hardening.sql','supabase/migrations/015_server_authoritative_progression.sql','supabase/migrations/016_progression_authority_gateway.sql','supabase/migrations/017_progression_idempotency_and_reconciliation.sql','supabase/migrations/018_service_role_authority_guard.sql',
 'Assets/Classes/Warrior.png','Assets/Classes/Mage.png','Assets/Classes/Archer.png','Assets/Classes/Assassin.png','Assets/Classes/Paladine.png',
 'Assets/Mob/Slime.png','Assets/Mob/Wolf.png','Assets/Mob/Globin.png','Assets/Mob/Orc.png','Assets/Mob/Troll.png','Assets/Mob/Pig_Monster.png',
 'Assets/Mob/Golem_Gelo.png','Assets/Mob/Spider.png','Assets/Mob/zombie.png','Assets/Mob/sombra.png','Assets/Mob/Caveira.png','Assets/Mob/Squelleton.png','Assets/Mob/Draconato.png'
]
for item in required:
    if not (ROOT/item).exists(): ERRORS.append(f'arquivo necessário ausente: {item}')

contracts={
    'src/typography-v3c.css':['clamp(','--fs-body','@media(max-width:760px)'],
    'src/admin-v3c.js':['astraeon:v3c:admin','Admin 3.0-C','adminJsonSave','adminJsonWorld'],
    'src/admin-runtime-v3c.js':['adminConfigV3C','godMode','lootChance','sprintMultiplier','ensureOnlineV4','src/realtime-security-v1.js','src/account-status-v4.js','src/chat-system-v4.js','src/live-runtime-v5.js'],
    'src/world-online-v4.js':['Astralum','Lúmenfall','Solvaris','Nivora','Umbra Vale','Cinzalta','cityStructures'],
    'src/npcs-v4.js':['Mestre de Habilidades','Segure E ou clique · Aprender','npc-dialogue','updateNpcs'],
    'src/realtime-security-v1.js':['statePerSecond:15','actionPerSecond:12','stale_seq','impossible_movement','maxEffects:300'],
    'src/multiplayer-v4.js':['signUp','signInWithPassword','player_state','postgres_changes','player_saves','CHAT_OPACITY_KEY','textContent','resolve_public_astraeon_profiles','publish_astraeon_player_state'],
    'src/chat-system-v4.js':['CHAT_LIMIT','64','exportChat','online-chat-counter','installSprintRuntime'],
    'src/account-status-v4.js':['Conta confirmada com sucesso. Seja bem-vindo!','Acesso 0','Acesso 1',"3:'Admin'",'pending-confirmation'],
    'src/online-controller-v4.js':['openChat','onlineChatInput','login será solicitado','keydown','MutationObserver','installRightMouseGuard','contextmenu','auxclick','MIN_SPRINT_MULTIPLIER','installSprintFix','desiredDistance'],
    'src/production-runtime-v6.js':['sceneObjects','mob_exclusion','player_spawn','item_configs','lastActivity','drawIdleZ','60','healPct','manaPct'],
    'src/character-system-v6.js':['Criar Personagem','Escolher personagem','Informações da Conta','guestAccountSpotlight','character_saves','create_astraeon_character','delete_astraeon_character','signInWithPassword'],
    'src/editor-v2.js':['AUTO_EXPORT_KEY','showSaveFilePicker','downloadExport','validateDesign','validateAndRender','scheduleAutosave','linkExportFile','exportDesign'],
    'src/online-v4.css':['--online-chat-alpha','online-chat','npc-dialogue','@media(max-width:760px)'],
    'src/online-fixes-v4.css':['online-chat-launcher','online-access-badge','data-account-blocked','astraeonSprintPulse','body.is-sprinting .stamina-line>span','.online-chat>.online-chat-messages{grid-row:3;min-height:0}','.online-chat>form{grid-row:4}'],
    'src/admin-studio-v4.js':['ADMIN STUDIO 5.0','decorateDashboard','studioAdminLauncher','Salvar + exportar','World Production'],
    'src/admin-auth-v4.js':['/api/admin-access','signInWithPassword','Acesso 3','admin-editor-locked','admin-live-tools-v5.js','admin-character-slots-v6.js','admin-production-v6.js','Admin Studio 6.0','src/admin-mfa-v1.js','MFA · AAL2'],
    'src/admin-mfa-v1.js':['getAuthenticatorAssuranceLevel','listFactors','enroll','challenge','verify','unenroll','seis dígitos'],
    'src/admin-accounts-v4.js':['admin_list_profiles','admin_set_access','Contas & Acesso','Em análise'],
    'src/admin-system-messages-v4.js':['Mensagens do Sistema','system_messages','interval_minutes'],
    'src/admin-character-slots-v6.js':['admin_list_characters_v6','admin_get_character_v6','admin_update_character_v6','admin_delete_character_v6','Personagens por Conta','page_limit'],
    'src/admin-production-v6.js':['Objeto 2D','Spawn Player','Área sem mobs','sceneObjects','zones','ItemList','item_configs','strength','magic','dexterity','healPct','manaPct'],
    'src/admin-auth-v4.css':['admin-access-gate','admin-accounts-table'],
    'src/editor-studio-v4.css':['studio-v5','studio-topbar','studio-commandbar','grid-template-rows:56px 36px minmax(0,1fr) 26px','grid-template-columns:224px minmax(0,1fr) 280px','admin-studio-v5','studio-dashboard-addon','studio-world-health'],
    'api/config.js':['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','no-store'],
    'api/admin-access.js':['/auth/v1/user','/rest/v1/profiles','access===3','Authorization'],
    'api/progression-authority.js':['timingSafeEqual','ASTRAEON_AUTHORITY_TOKEN','apply_astraeon_progression_event','x-astraeon-authority','SUPABASE_SECRET_KEY'],
    'supabase/migrations/001_astraeon_online.sql':['enable row level security','chat_rate_limited','realtime.topic()','claim_username','player_saves','chat_messages','supabase_realtime'],
    'supabase/migrations/002_access_admin_security.sql':['default 1','profiles_access_check','astraeon_is_admin','astraeon_has_online_access','admin_list_profiles','admin_set_access','cannot_remove_own_admin_access'],
    'supabase/migrations/003_system_messages.sql':['system_messages','interval_minutes','astraeon_is_admin','astraeon_has_online_access'],
    'supabase/migrations/004_system_message_kinds.sql':['message_kind','periodic','on_join'],
    'supabase/migrations/005_admin_live_tools.sql':['mob_configs','admin_get_player_detail','font_size'],
    'supabase/migrations/006_characters_itemlist.sql':['public.characters','character_saves','slot between 1 and 4','create_astraeon_character','set_active_astraeon_character','delete_astraeon_character','item_configs','strength','magic','dexterity','healPct','manaPct'],
    'supabase/migrations/007_admin_character_slots.sql':['admin_list_characters_v6','admin_update_character_v6','admin_delete_character_v6','astraeon_is_admin'],
    'supabase/migrations/011_security_hardening.sql':['guard_character_save_identity','character_id_is_immutable','user_id_is_immutable','astraeon_require_online_access','astraeon_is_admin_mfa','validate_astraeon_save','pg_advisory_xact_lock'],
    'supabase/migrations/012_public_profiles.sql':['astraeon_profiles_read_own','public_profiles','resolve_public_astraeon_profiles'],
    'supabase/migrations/013_admin_pagination.sql':['page_limit integer default 24','save_size_bytes','admin_get_character_v6','astraeon_require_admin(true)'],
    'supabase/migrations/014_realtime_hardening.sql':['player_runtime_states','player_runtime_actions','publish_astraeon_player_state','realtime_impossible_movement'],
    'supabase/migrations/015_server_authoritative_progression.sql':['character_progress','character_inventory','spend_astraeon_gold','service_role'],
    'supabase/migrations/016_progression_authority_gateway.sql':['apply_astraeon_progression_event','authority_gateway','grant execute','service_role'],
    'supabase/migrations/017_progression_idempotency_and_reconciliation.sql':['bootstrap_astraeon_character_progress','operation_id_conflict','reconcile_astraeon_progression','trusted_reconciliation'],
    'supabase/migrations/018_service_role_authority_guard.sql':['astraeon_require_service_authority','service_role_required','request.jwt.claim.role','revoke all'],
    'supabase/config.toml':['minimum_password_length = 10','enable_confirmations = true','enroll_enabled = true','sign_in_sign_ups = 20'],
    'vercel.json':['Content-Security-Policy','X-Content-Type-Options','wss://*.supabase.co','/api/admin-access','/api/progression-authority',"script-src 'self'"],
    'ONLINE_SETUP.md':['Table Editor','auth.users','npx vercel dev','Enter = abrir/focar','Admin Studio'],
    'README.md':['ASTRAEON ONLINE','INSTALLME.md','SUPABASE_PUBLISHABLE_KEY','MIT License'],
    'INSTALLME.md':['npx vercel link','npx vercel dev','SUPABASE_PUBLISHABLE_KEY','service_role','Checklist antes de publicar'],
    '.env.example':['PROJECT_REF.supabase.co','SUPABASE_PUBLISHABLE_KEY','ASTRAEON_REALTIME_TOPIC','ASTRAEON_AUTHORITY_TOKEN','SUPABASE_SECRET_KEY','DO NOT ADD SECRETS'],
    '.gitignore':['.env.*','!.env.example','.vercel/','.envrc'],
    'SECURITY.md':['npm run check:secrets','Supabase secret/service-role keys','If a secret was committed','Environment Variables'],
    'scripts/check_secrets.py':['git", "ls-files','git", "log"','ASTRAEON SECRET SCAN','sb_secret_','VERCEL_TOKEN'],
    'COPYRIGHT.md':['Erick Israel','MIT License','LICENSE'],
    'LICENSE':['MIT License','Copyright (c) 2026 Erick Israel','Permission is hereby granted']
}
for file_name, needles in contracts.items():
    require_needles(file_name, needles)

controller_text=(ROOT/'src/online-controller-v4.js').read_text(encoding='utf-8') if (ROOT/'src/online-controller-v4.js').exists() else ''
fixes_text=(ROOT/'src/online-fixes-v4.css').read_text(encoding='utf-8') if (ROOT/'src/online-fixes-v4.css').exists() else ''
for forbidden in ['onlineRuntimeHealth','Diagnóstico Online','onlineHealthRefresh']:
    if forbidden in controller_text: ERRORS.append(f'src/online-controller-v4.js: diagnóstico visual proibido: {forbidden}')
for forbidden in ['online-runtime-health','online-health-grid']:
    if forbidden in fixes_text: ERRORS.append(f'src/online-fixes-v4.css: estilo de diagnóstico visual proibido: {forbidden}')
for forbidden in ["content:' · CORRIDA'","content:' · RUN'"]:
    if forbidden in fixes_text: ERRORS.append(f'src/online-fixes-v4.css: rótulo de corrida proibido no STAM: {forbidden}')

index_text=(ROOT/'index.html').read_text(encoding='utf-8') if (ROOT/'index.html').exists() else ''
if 'Editor Astral<small>' in index_text or '>Editor Astral<' in index_text:
    ERRORS.append('index.html: Editor Astral não deve aparecer no menu principal')
if 'src/online-controller-v4.js' not in index_text:
    ERRORS.append('index.html: controlador online não carregado')
if 'src/inventory-layout-v43.js' not in index_text:
    ERRORS.append('index.html: runtime do layout de inventário não carregado')
for skill in ['data-skill="3"','data-skill="4"']:
    if skill not in index_text: ERRORS.append(f'index.html: controle mobile ausente: {skill}')

editor_text=(ROOT/'game-editor.html').read_text(encoding='utf-8') if (ROOT/'game-editor.html').exists() else ''
for needle in ['Admin Studio 6.4','src/admin-auth-v4.css','src/admin-auth-v4.js','src/admin-fullscreen-v64.css','adminAccessGate','admin-editor-locked','studio-commandbar','autoExportToggle','worldHealth','studioAdminLauncher','name="robots"']:
    if needle not in editor_text: ERRORS.append(f'game-editor.html: contrato Admin Studio protegido ausente: {needle}')
for forbidden in ['<script src="src/world-v2.js"','<script src="src/editor-v2.js"','<script src="src/admin-v3c.js"','<script src="src/admin-studio-v4.js"']:
    if forbidden in editor_text: ERRORS.append(f'game-editor.html: runtime administrativo não deve carregar antes da autenticação: {forbidden}')

for name in ['vercel.json','package.json']:
    path=ROOT/name
    if path.exists():
        try: json.loads(path.read_text(encoding='utf-8'))
        except Exception as exc: ERRORS.append(f'{name}: JSON inválido: {exc}')

api_path=ROOT/'api/config.js'
if api_path.exists():
    api_text=api_path.read_text(encoding='utf-8').lower()
    for forbidden in ['service_role','supabase_secret_key','sb_secret_']:
        if forbidden in api_text: ERRORS.append(f'api/config.js: segredo proibido referenciado: {forbidden}')

if ERRORS:
    print('ASTRAEON ADMIN STUDIO 6.4 validation FAILED')
    for err in ERRORS: print(' -',err)
    sys.exit(1)
print('ASTRAEON ADMIN STUDIO 6.4 validation OK')
print(f'index IDs: {len(index_ids)} | editor IDs: {len(editor_ids)} | required files: {len(required)}')