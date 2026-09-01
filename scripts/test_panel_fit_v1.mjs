import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/panel-fit-v1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/panel-fit-v1.css', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const onlineFixes = fs.readFileSync(new URL('../src/online-fixes-v4.css', import.meta.url), 'utf8');
const typography = fs.readFileSync(new URL('../src/typography-v3c.css', import.meta.url), 'utf8');
const inputGuardSource = fs.readFileSync(new URL('../src/input-guard-v1.js', import.meta.url), 'utf8');
const combatUxSource = fs.readFileSync(new URL('../src/combat-ux-guard-v1.js', import.meta.url), 'utf8');
const listeners = new Map();
const document = {
  readyState: 'complete',
  body: {},
  documentElement: { dataset: {} },
  querySelectorAll: () => [],
  addEventListener: (name, listener) => listeners.set(name, listener)
};
const window = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: (name, listener) => listeners.set(name, listener),
  getComputedStyle: () => ({ display: 'grid', visibility: 'visible', getPropertyValue: () => '1' }),
  requestAnimationFrame: callback => { callback(); return 1; },
  cancelAnimationFrame: () => {}
};
const sandbox = { window, document, MutationObserver: class { observe() {} } };
vm.runInNewContext(source, sandbox);
const Fit = window.AstraeonPanelFitV1;

assert.equal(Fit.calculateScale(1000, 700, 1880, 1040, 1), 1, 'Painel que cabe não deve ser ampliado sem pedido.');
assert.equal(Fit.calculateScale(1000, 900, 1280, 720, 1), .8, 'Altura deve limitar a escala do painel.');
assert.equal(Fit.calculateScale(1000, 500, 800, 1000, 1.15), .8, 'Largura deve limitar a escala mesmo com UI ampliada.');
assert.equal(Fit.calculateScale(1000, 500, 2000, 1000, .85), .85, 'Preferência de escala reduzida deve ser respeitada.');
assert.match(css, /overflow:\s*hidden\s*!important/, 'O host não pode manter barra de rolagem externa.');
assert.match(css, /skills-master-workspace[\s\S]*grid-template-columns:\s*repeat\(2/, 'Mestre e jogador devem permanecer lado a lado em baixa resolução.');
assert.match(index, /src\/panel-fit-v1\.css/, 'O CSS responsivo deve carregar no jogo.');
assert.match(index, /src\/panel-fit-v1\.js/, 'O runtime responsivo deve carregar no jogo.');

assert.match(inputGuardSource, /combat-ux-guard-v1\.js/, 'O guard de combate deve ser carregado pelo bootstrap de entrada.');
assert.doesNotThrow(() => new vm.Script(combatUxSource), 'O guard de combate deve possuir JavaScript válido.');
assert.match(combatUxSource, /SKILL_CHAIN_DELAY_MS\s*=\s*900/, 'Skills devem respeitar 900 ms entre usos consecutivos.');
assert.match(combatUxSource, /TARGET_MIN_DISTANCE\s*=\s*320/, 'O alvo deve possuir distância mínima explícita.');
assert.match(combatUxSource, /range \+ TARGET_RANGE_BUFFER/, 'Classes de longo alcance devem ganhar margem de alvo proporcional.');
assert.match(combatUxSource, /focus\.selected = null/, 'Alvo distante deve ser limpo.');
assert.match(combatUxSource, /#mobTargetPanel/, 'Painel do mob deve ser fechado ao perder o alvo.');

assert.match(onlineFixes, /max-height:82vh!important/, 'Inventário desktop deve ficar mais baixo.');
assert.match(onlineFixes, /grid-template-columns:repeat\(5,52px\)!important/, 'Mochila deve usar slots compactos de 52 px.');
assert.match(onlineFixes, /#inventoryMeta>b:last-child/, 'Ouro deve ter mostrador dedicado dentro do inventário.');
assert.match(typography, /--fs-micro:clamp\(12px/, 'Texto micro não pode cair abaixo de 12 px.');
assert.match(typography, /small\{font-size:var\(--fs-small\)!important;line-height:1\.3!important\}/, 'Elementos small devem permanecer legíveis.');

console.log('ASTRAEON PANEL FIT + INVENTORY/COMBAT UX validation OK');
