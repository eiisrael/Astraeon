import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/game-v2.js', import.meta.url), 'utf8');
const adminRuntime = fs.readFileSync(new URL('../src/admin-runtime-v3c.js', import.meta.url), 'utf8');
const positionMatch = source.match(/\r?\n    incomingDamagePosition\(effect\) \{([\s\S]*?)\r?\n    \}\r?\n\r?\n    incomingDamage\(/);
const match = source.match(/\r?\n    incomingDamage\(source, amount\) \{([\s\S]*?)\r?\n    \}\r?\n\r?\n    playerDeath\(/);
assert(positionMatch, 'incomingDamagePosition deve existir no núcleo do jogo');
assert(match, 'incomingDamage deve existir no núcleo do jogo');
assert(!match[1].includes('facing'), 'o impacto direcional não pode depender do facing ou do sprite');
assert(/game\.damagePlayer=function\(amount,source=null\)[\s\S]*?originalDamagePlayer\([\s\S]*?,source\)/.test(adminRuntime), 'o runtime administrativo deve preservar o mob que originou o dano');

const incomingDamagePosition = new Function('effect', positionMatch[1]);
const incomingDamage = new Function('source', 'amount', match[1]);
const player = { x: 100, y: 100, facing: 1 };
const game = { player, effects: [], incomingDamagePosition };
const cases = [
  ['direita', { x: 190, y: 100 }, p => p.x > player.x && Math.abs(p.y - (player.y - 8)) < .001],
  ['esquerda', { x: 10, y: 100 }, p => p.x < player.x && Math.abs(p.y - (player.y - 8)) < .001],
  ['acima', { x: 100, y: 10 }, p => p.y < player.y - 8 && Math.abs(p.x - player.x) < .001],
  ['abaixo', { x: 100, y: 190 }, p => p.y > player.y - 8 && Math.abs(p.x - player.x) < .001]
];

for (const [name, attacker, valid] of cases) {
  game.effects.length = 0;
  incomingDamage.call(game, attacker, 7);
  assert.equal(game.effects.length, 1, `ataque pela ${name} deve criar um impacto`);
  const effect = game.effects[0];
  assert(valid(game.incomingDamagePosition(effect)), `impacto da ${name} deve permanecer no lado do agressor`);
  const expectedAngle = Math.atan2(attacker.y - player.y, attacker.x - player.x);
  assert(Math.abs(Math.atan2(Math.sin(effect.angle - expectedAngle), Math.cos(effect.angle - expectedAngle))) < 1e-9, `arco da ${name} deve apontar para o agressor`);

  const beforeMove = game.incomingDamagePosition(effect);
  player.x += 53; player.y -= 29;
  const afterMove = game.incomingDamagePosition(effect);
  assert.equal(afterMove.x - beforeMove.x, 53, `impacto da ${name} deve acompanhar o jogador no eixo X`);
  assert.equal(afterMove.y - beforeMove.y, -29, `impacto da ${name} deve acompanhar o jogador no eixo Y`);
  player.x -= 53; player.y += 29;
}

game.effects.length = 0;
player.facing = 1;
incomingDamage.call(game, null, 3);
assert.equal(game.effects.length, 0, 'dano sem mob de origem não pode inventar uma direção visual');

console.log('ASTRAEON COMBAT CAMERA V1 directional impact validation OK');
