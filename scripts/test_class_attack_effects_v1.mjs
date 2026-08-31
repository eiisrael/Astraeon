import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const effectsSource = fs.readFileSync(new URL('../src/combat-effects-v1.js', import.meta.url), 'utf8');
const gameSource = fs.readFileSync(new URL('../src/game-v2.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(effectsSource, sandbox);
const FX = sandbox.window.AstraeonCombatEffectsV1;
assert(FX?.create && FX?.draw, 'O módulo de efeitos de classe deve expor criação e desenho.');

function recordingContext() {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(['addColorStop', ...args]) };
  const methods = ['save','restore','translate','rotate','beginPath','moveTo','lineTo','stroke','fill','arc','strokeRect','closePath'];
  const ctx = { calls, createRadialGradient: (...args) => (calls.push(['createRadialGradient', ...args]), gradient) };
  for (const method of methods) ctx[method] = (...args) => calls.push([method, ...args]);
  ctx.globalAlpha = 1;
  return ctx;
}

const classes = ['Warrior', 'Mage', 'Archer', 'Assassin', 'Paladine'];
for (const classId of classes) {
  const effect = FX.create({ classId, x: 10, y: 20 }, { x: 110, y: 70 }, '#abcdef');
  assert.equal(effect.type, 'class-basic-attack', `${classId} deve usar o efeito exclusivo.`);
  assert.equal(effect.classId, classId);
  assert.equal(effect.tx, 110); assert.equal(effect.ty, 70);
  assert(effect.max > 0 && effect.life === effect.max, `${classId} deve ter duração válida.`);
  const ctx = recordingContext();
  assert.equal(FX.draw(ctx, effect, .72), true, `${classId} deve ser renderizado.`);
  assert(ctx.calls.length > 5, `${classId} deve produzir uma composição visual completa.`);
}

const warrior = FX.create({ classId: 'Warrior', x: 0, y: 0 }, { x: 30, y: 0 });
const early = recordingContext(), late = recordingContext();
FX.draw(early, warrior, .2); FX.draw(late, warrior, .8);
assert(early.calls.filter(([name]) => name === 'lineTo').length < late.calls.filter(([name]) => name === 'lineTo').length,
  'O X do Guerreiro deve revelar o segundo traço depois do primeiro.');

const mage = recordingContext(); FX.draw(mage, FX.create({ classId:'Mage', x:0, y:0 }, { x:40, y:0 }), .5);
assert(mage.calls.some(([name]) => name === 'createRadialGradient'), 'O Mago deve criar brilho radial roxo.');
const paladine = recordingContext(); FX.draw(paladine, FX.create({ classId:'Paladine', x:0, y:0 }, { x:40, y:0 }), .5);
assert.equal(paladine.calls.filter(([name]) => name === 'strokeRect').length, 6, 'O círculo mágico do Paladino deve ter seis runas.');
const assassin = recordingContext(); FX.draw(assassin, FX.create({ classId:'Assassin', x:0, y:0 }, { x:40, y:0 }), .5);
assert(assassin.calls.filter(([name]) => name === 'arc').length >= 2, 'O Assassino deve desenhar o microvento perfurante.');

assert(indexSource.indexOf('src/combat-effects-v1.js') < indexSource.indexOf('src/game-v2.js'),
  'O módulo de efeitos precisa carregar antes do núcleo do jogo.');
assert.match(gameSource, /this\.effects\.push\(this\.basicAttackEffect\(target\)\)/,
  'Ataques que acertam mobs devem usar o efeito da classe.');
assert.match(gameSource, /e\.type === 'class-basic-attack'/,
  'O renderizador principal deve desenhar o novo efeito.');

console.log('ASTRAEON CLASS ATTACK EFFECTS V1 validation OK');
