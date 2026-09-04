import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const adminRuntime = read('src/admin-runtime-v3c.js');
const bootGuard = read('src/menu-boot-guard-v1.js');
const inputGuard = read('src/input-guard-v1.js');
const multiplayer = read('src/multiplayer-v4.js');
const settings = read('src/settings-menu-v8.js');
const onlineUx = read('src/online-ux-final-v1.css');
const interaction = read('src/game-interaction-v1.js');
const interactionCss = read('src/game-interaction-v1.css');

assert.match(index, /<title>ASTRAEON ONLINE — Multiplayer<\/title>/, 'O título inicial já deve ser o título definitivo.');
assert.match(index, /<body class="astraeon-boot-pending">/, 'O layout legado deve ficar protegido durante o boot.');
assert.match(index, /data-astraeon-first-paint="1"/, 'A proteção precisa existir antes do primeiro paint.');
assert.doesNotMatch(bootGuard, /classList\.remove\('astraeon-boot-pending'\)/, 'O menu não pode aparecer antes da resolução da autenticação.');
assert.match(inputGuard, /!body\.classList\.contains\('astraeon-main-menu-ready'\)/, 'O gate deve aguardar o menu moderno e a autenticação.');
assert.match(inputGuard, /body\.classList\.remove\('astraeon-boot-pending'\)/, 'Somente o gate resolvido deve liberar o primeiro paint.');
assert.doesNotMatch(adminRuntime, /document\.title|Hardcore Remaster 3\.0-C|ASTRAEON 3\.0-C/, 'O runtime administrativo não pode alterar a marca da entrada principal.');

assert.match(inputGuard, /const wasBlockingLogin = body\.classList\.contains\('astraeon-auth-booting'\)/, 'O painel de conta só deve fechar ao concluir um gate bloqueante.');
assert.match(inputGuard, /if \(wasBlockingLogin\) panel\.classList\.add\('hidden'\)/, 'Aberturas manuais do painel autenticado devem permanecer abertas.');
assert.match(inputGuard, /addEventListener\('astraeon:online-auth-state', syncOnlineLoginGate\)/, 'Mudanças de autenticação devem atualizar o gate por evento.');
assert.doesNotMatch(inputGuard, /body\.classList\.add\('astraeon-session-ready'\);[\s\S]{0,180}scheduleLoginGate\(\)/, 'Sessão pronta não pode manter polling que fecha o painel.');
assert.match(multiplayer, /function notifyAuthState\(\)/, 'O multiplayer deve publicar mudanças de autenticação.');

const makeClassList = initial => {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
    toggle: (name, force) => force === undefined ? (values.has(name) ? (values.delete(name), false) : (values.add(name), true)) : (force ? values.add(name) : values.delete(name), !!force)
  };
};
const body = { classList: makeClassList(['astraeon-main-menu-ready','astraeon-auth-booting','astraeon-boot-pending']) };
const accountPanel = { classList: makeClassList([]) };
const listeners = new Map();
const context = {
  console,
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  document: {
    body,
    head: { appendChild() {} },
    activeElement: null,
    readyState: 'complete',
    createElement: () => ({ dataset: {}, style: {}, setAttribute() {} }),
    querySelector: selector => selector === '#onlineAccountPanel' ? accountPanel : null,
    querySelectorAll: () => [],
    addEventListener() {}
  },
  addEventListener: (type, listener) => listeners.set(type, listener),
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 2,
  clearInterval() {}
};
context.window = context;
vm.runInNewContext(inputGuard, context);
context.AstraeonMultiplayerV4 = { state: { config: { enabled: true }, session: null, channelStatus: 'OFFLINE' } };
context.AstraeonInputGuardV1.syncOnlineLoginGate();
assert.equal(body.classList.contains('astraeon-login-required'), true, 'Visitante deslogado deve entrar diretamente no gate de login.');
assert.equal(body.classList.contains('astraeon-boot-pending'), false, 'O boot deve ser liberado já com o login pronto.');
assert.equal(accountPanel.classList.contains('hidden'), false, 'O login deve estar visível no primeiro paint liberado.');
context.AstraeonMultiplayerV4.state.session = { user: { id: 'test' } };
context.AstraeonMultiplayerV4.state.channelStatus = 'ONLINE';
context.AstraeonInputGuardV1.syncOnlineLoginGate();
assert.equal(accountPanel.classList.contains('hidden'), true, 'A conclusão do gate autenticado deve fechar o login inicial.');
accountPanel.classList.remove('hidden');
context.AstraeonInputGuardV1.syncOnlineLoginGate();
assert.equal(accountPanel.classList.contains('hidden'), false, 'O painel aberto manualmente por usuário autenticado não pode fechar sozinho.');
assert.equal(typeof listeners.get('astraeon:online-auth-state'), 'function', 'O listener de autenticação deve estar instalado.');

assert.match(settings, /if\(hidden===wasHidden\)return/, 'Mudanças internas do Panel Fit não podem reiniciar a aba ativa.');
assert.doesNotMatch(index, /cursor-v1\.css|Assets\/Cursors/, 'O ponteiro comum do navegador não deve substituir o cursor ingame solicitado.');
assert.match(interaction, /cursor-aura[\s\S]*cursor-sigil/, 'O cursor ingame deve possuir as novas camadas visuais.');
assert.match(interaction, /--cursor-x[\s\S]*--cursor-y/, 'O cursor ingame deve ser atualizado pelo compositor.');
assert.match(interactionCss, /translate3d\(var\(--cursor-x\),var\(--cursor-y\),0\)/, 'O movimento do cursor não deve reposicionar layout com left/top.');
assert.match(interactionCss, /#astraeonCursor\.attacking/, 'O cursor deve preservar feedback de ataque.');
assert.match(interactionCss, /#astraeonCursor\.interacting/, 'O cursor deve preservar feedback de interação.');
assert.match(onlineUx, /body\.astraeon-login-required #gameRoot[\s\S]*visibility:visible!important/, 'O menu principal deve permanecer visível sob o login.');
assert.doesNotMatch(onlineUx, /body\.astraeon-login-required #gameRoot\{[\s\S]{0,120}visibility:hidden/, 'O login não pode apagar o menu principal.');
for (const placeholder of ['Login','Seu e-mail','Sua senha','Sua senha (mínimo 10 caracteres)']) assert.ok(multiplayer.includes(`placeholder="${placeholder}"`), `placeholder ausente: ${placeholder}`);
assert.doesNotMatch(multiplayer, /Erick_01/, 'O formulário não pode conter nome pessoal no placeholder.');
assert.match(settings, /'account','Conta'/, 'O menu ESC deve incluir a aba de conta.');
assert.match(settings, /settingsAccountOpen/, 'A aba de conta deve abrir o painel Conta & Nuvem.');

console.log('ASTRAEON ATOMIC LOGIN + ACCOUNT TAB + INGAME CURSOR validation OK');
