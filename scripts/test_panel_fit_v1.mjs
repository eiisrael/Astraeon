import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/panel-fit-v1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/panel-fit-v1.css', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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

console.log('ASTRAEON PANEL FIT V1 validation OK');
