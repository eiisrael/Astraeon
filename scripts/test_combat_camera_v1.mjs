import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/game-v2.js', import.meta.url), 'utf8');
const match = source.match(/\r?\n    incomingDamage\(source, amount\) \{([\s\S]*?)\r?\n    \}\r?\n\r?\n    playerDeath\(/);
assert(match, 'incomingDamage deve existir no núcleo do jogo');
assert(!match[1].includes('facing'), 'o impacto direcional não pode depender do facing ou do sprite');

const incomingDamage = new Function('source', 'amount', match[1]);
const player = { x: 100, y: 100, facing: 1 };
const game = { player, effects: [] };
const cases = [
  ['direita', { x: 190, y: 100 }, e => e.x > player.x && Math.abs(e.y - player.y) < .001],
  ['esquerda', { x: 10, y: 100 }, e => e.x < player.x && Math.abs(e.y - player.y) < .001],
  ['acima', { x: 100, y: 10 }, e => e.y < player.y && Math.abs(e.x - player.x) < .001],
  ['abaixo', { x: 100, y: 190 }, e => e.y > player.y && Math.abs(e.x - player.x) < .001]
];

for (const [name, attacker, valid] of cases) {
  game.effects.length = 0;
  incomingDamage.call(game, attacker, 7);
  assert.equal(game.effects.length, 1, `ataque pela ${name} deve criar um impacto`);
  const effect = game.effects[0];
  assert(valid(effect), `impacto da ${name} deve permanecer no lado do agressor`);
  const expectedAngle = Math.atan2(attacker.y - player.y, attacker.x - player.x);
  assert(Math.abs(Math.atan2(Math.sin(effect.angle - expectedAngle), Math.cos(effect.angle - expectedAngle))) < 1e-9, `arco da ${name} deve apontar para o agressor`);
}

game.effects.length = 0;
player.facing = 1;
incomingDamage.call(game, null, 3);
const fallbackRightFacing = { ...game.effects[0] };
game.effects.length = 0;
player.facing = -1;
incomingDamage.call(game, null, 3);
const fallbackLeftFacing = game.effects[0];
assert.equal(fallbackRightFacing.x, fallbackLeftFacing.x, 'facing não pode inverter o impacto sem agressor');
assert.equal(fallbackRightFacing.y, fallbackLeftFacing.y, 'sprite não pode deslocar o impacto sem agressor');

console.log('ASTRAEON COMBAT CAMERA V1 directional impact validation OK');
