#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import re, sys

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
    text=(ROOT/js_name).read_text(encoding='utf-8')
    selectors=set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)", text))
    missing=sorted(selectors-html_ids)
    if missing: ERRORS.append(f'{js_name}: IDs não encontrados no HTML: {missing}')

index_ids=inspect_html('index.html')
editor_ids=inspect_html('game-editor.html')
check_js_ids('src/game-v2.js', index_ids)
check_js_ids('src/editor-v2.js', editor_ids)

required=[
 'src/world-v2.js','src/game-v2.js','src/editor-v2.js','src/astraeon-v2.css','src/editor-v2.css',
 'Assets/Classes/Warrior.png','Assets/Classes/Mage.png','Assets/Classes/Archer.png','Assets/Classes/Assassin.png','Assets/Classes/Paladine.png',
 'Assets/Mob/Slime.png','Assets/Mob/Wolf.png','Assets/Mob/Globin.png','Assets/Mob/Orc.png','Assets/Mob/Troll.png','Assets/Mob/Pig_Monster.png',
 'Assets/Mob/Golem_Gelo.png','Assets/Mob/Spider.png','Assets/Mob/zombie.png','Assets/Mob/sombra.png','Assets/Mob/Caveira.png','Assets/Mob/Squelleton.png','Assets/Mob/Draconato.png'
]
for item in required:
    if not (ROOT/item).exists(): ERRORS.append(f'arquivo necessário ausente: {item}')

if ERRORS:
    print('ASTRAEON 2.0 validation FAILED')
    for err in ERRORS: print(' -',err)
    sys.exit(1)
print('ASTRAEON 2.0 validation OK')
print(f'index IDs: {len(index_ids)} | editor IDs: {len(editor_ids)} | required files: {len(required)}')
