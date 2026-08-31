import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = async file => readFile(path.join(root, file), 'utf8');
const runtime = await source('src/production-runtime-v6.js');
const game = await source('src/game-v2.js');
const skills = await source('src/skills-v1.js');
const multiplayer = await source('src/multiplayer-v4.js');

assert.match(runtime, /global\.addEventListener\('keydown',activity/,
  'A ausência deve ser encerrada por qualquer tecla.');
for (const forbidden of ['pointermove', 'mousemove', 'pointerdown', 'touchstart', 'wheel']) {
  assert.doesNotMatch(runtime, new RegExp(`addEventListener\\(['\"]${forbidden}`),
    `${forbidden} não pode encerrar a ausência.`);
}
assert.match(runtime, /function playerMoved\(p\)/,
  'O runtime deve detectar deslocamento real do personagem.');
assert.match(runtime, /if\(playerMoved\(p\)\)return;/,
  'O desenho do estado ausente deve encerrar quando o personagem se mover.');
assert.ok((game.match(/AstraeonProductionV6\?\.activity\?\.\(\)/g) || []).length >= 2,
  'Ataque básico e habilidade base devem registrar atividade.');
assert.match(skills, /AstraeonProductionV6\?\.activity\?\.\(\)/,
  'Habilidades compradas devem registrar atividade.');
assert.match(multiplayer, /<b>Chat<\/b>/, 'O cabeçalho deve se chamar somente Chat.');
assert.doesNotMatch(multiplayer, /Chat de Astra/i, 'O nome antigo do chat não pode permanecer.');

const roots = ['src', 'supabase/migrations'];
const standaloneAstra = /\bAstra\b/i;
const violations = [];
async function scan(relative) {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) await scan(child);
    else if (/\.(?:js|css|html|sql|md)$/i.test(entry.name)) {
      const text = await source(child);
      if (standaloneAstra.test(text)) violations.push(child);
    }
  }
}
for (const directory of roots) await scan(directory);
for (const file of ['index.html', 'README.md', 'ONLINE_SETUP.md']) {
  if (standaloneAstra.test(await source(file))) violations.push(file);
}
assert.deepEqual(violations, [], `Referências isoladas a Astra: ${violations.join(', ')}`);

console.log('Idle/branding contracts: OK');
