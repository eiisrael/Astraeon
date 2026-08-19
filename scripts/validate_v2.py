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

required=[
 'src/world-v2.js','src/game-v2.js','src/inventory-v2.js','src/inventory-v3.js','src/ui-v3.js','src/systems-v3b.js','src/admin-runtime-v3c.js',
 'src/world-online-v4.js','src/npcs-v4.js','src/multiplayer-v4.js','src/online-v4.css',
 'src/editor-v2.js','src/admin-v3c.js','src/astraeon-v2.css','src/inventory-v2.css','src/ui-v3.css','src/ui-v3b.css','src/typography-v3c.css','src/editor-v2.css','src/editor-v3c.css',
 'api/config.js','vercel.json','package.json','ONLINE_SETUP.md','supabase/migrations/001_astraeon_online.sql',
 'Assets/Classes/Warrior.png','Assets/Classes/Mage.png','Assets/Classes/Archer.png','Assets/Classes/Assassin.png','Assets/Classes/Paladine.png',
 'Assets/Mob/Slime.png','Assets/Mob/Wolf.png','Assets/Mob/Globin.png','Assets/Mob/Orc.png','Assets/Mob/Troll.png','Assets/Mob/Pig_Monster.png',
 'Assets/Mob/Golem_Gelo.png','Assets/Mob/Spider.png','Assets/Mob/zombie.png','Assets/Mob/sombra.png','Assets/Mob/Caveira.png','Assets/Mob/Squelleton.png','Assets/Mob/Draconato.png'
]
for item in required:
    if not (ROOT/item).exists(): ERRORS.append(f'arquivo necessário ausente: {item}')

for file_name, needles in {
    'src/typography-v3c.css':['clamp(','--fs-body','@media(max-width:760px)'],
    'src/admin-v3c.js':['astraeon:v3c:admin','Admin 3.0-C','adminJsonSave','adminJsonWorld'],
    'src/admin-runtime-v3c.js':['adminConfigV3C','godMode','lootChance','sprintMultiplier','ensureOnlineV4','src/multiplayer-v4.js'],
    'src/world-online-v4.js':['Astralum','Lúmenfall','Solvaris','Nivora','Umbra Vale','Cinzalta','cityStructures'],
    'src/npcs-v4.js':['IA local contextual','E · Falar','npc-dialogue','updateNpcs'],
    'src/multiplayer-v4.js':['signUp','signInWithPassword','player_state','postgres_changes','player_saves','CHAT_OPACITY_KEY','textContent'],
    'src/online-v4.css':['--online-chat-alpha','online-chat','npc-dialogue','@media(max-width:760px)'],
    'api/config.js':['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','no-store'],
    'supabase/migrations/001_astraeon_online.sql':['enable row level security','chat_rate_limited','realtime.topic()','claim_username','player_saves','chat_messages'],
    'vercel.json':['Content-Security-Policy','X-Content-Type-Options','wss://*.supabase.co']
}.items():
    require_needles(file_name, needles)

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
    print('ASTRAEON ONLINE validation FAILED')
    for err in ERRORS: print(' -',err)
    sys.exit(1)
print('ASTRAEON ONLINE validation OK')
print(f'index IDs: {len(index_ids)} | editor IDs: {len(editor_ids)} | required files: {len(required)}')
