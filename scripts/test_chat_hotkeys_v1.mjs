import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const guardSource = fs.readFileSync(new URL('../src/input-guard-v1.js', import.meta.url), 'utf8');
const gameSource = fs.readFileSync(new URL('../src/game-v2.js', import.meta.url), 'utf8');
const skillsSource = fs.readFileSync(new URL('../src/skills-v1.js', import.meta.url), 'utf8');
const characteristicsSource = fs.readFileSync(new URL('../src/characteristics-v1.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../src/panel-studio-runtime-v7.js', import.meta.url), 'utf8');
const npcSource = fs.readFileSync(new URL('../src/npcs-v4.js', import.meta.url), 'utf8');
const adminStudioSource = fs.readFileSync(new URL('../src/admin-studio-v4.js', import.meta.url), 'utf8');
const adminHubSource = fs.readFileSync(new URL('../src/admin-hub-v63.js', import.meta.url), 'utf8');
const legacyAdminSource = fs.readFileSync(new URL('../src/admin-v3c.js', import.meta.url), 'utf8');

const classes = new Set(['collapsed-mobile']);
const chat = { dataset: {}, classList: { contains: value => classes.has(value) } };
const input = { value: '', closest: selector => selector.includes('input') || selector === '#onlineChat' };
const neutral = { closest: () => false };
const document = {
  activeElement: neutral,
  querySelector: selector => selector === '#onlineChat' ? chat : selector === '#onlineChatInput' ? input : null
};
const context = { window: {}, document };
context.window.window = context.window;
vm.runInNewContext(guardSource, context);
const guard = context.window.AstraeonInputGuardV1;

assert.equal(guard.blocksPanelHotkeys({ target: neutral }), false, 'chat recolhido libera atalhos');
classes.clear();
assert.equal(guard.blocksPanelHotkeys({ target: neutral }), true, 'chat aberto bloqueia atalhos mesmo sem foco');
classes.add('chat-pro-collapsed');
input.value = 'oi';
assert.equal(guard.blocksPanelHotkeys({ target: neutral }), true, 'texto preservado bloqueia atalhos mesmo recolhido');
input.value = '';
document.activeElement = input;
assert.equal(guard.blocksPanelHotkeys({ target: input }), true, 'digitação focada bloqueia atalhos');
const chatToggle = { closest: selector => selector === '#onlineChat' };
document.activeElement = chatToggle;
assert.equal(guard.blocksPanelHotkeys({ target: chatToggle }), false, 'botão do chat recolhido não prende os atalhos');

for (const [name, source] of [
  ['jogo', gameSource],
  ['skills', skillsSource],
  ['características', characteristicsSource],
  ['painéis personalizados', runtimeSource],
  ['painel do Mestre por tecla E', npcSource],
  ['Admin Studio', adminStudioSource],
  ['central administrativa', adminHubSource],
  ['atalho administrativo legado', legacyAdminSource]
]) assert.match(source, /AstraeonInputGuardV1\?\.blocksPanelHotkeys/, `${name} usa a trava central`);

console.log('ASTRAEON CHAT HOTKEY GUARD V1 validation OK');
