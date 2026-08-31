import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const collisionSource = fs.readFileSync(new URL('../src/entity-collision-v1.js', import.meta.url), 'utf8');
const liveSource = fs.readFileSync(new URL('../src/live-runtime-v5.js', import.meta.url), 'utf8');
const multiplayerSource = fs.readFileSync(new URL('../src/multiplayer-v4.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const remote = new Map();
const sandbox = { window: { AstraeonMultiplayerV4: { state: { remote } } } };
vm.runInNewContext(collisionSource, sandbox);
const Collision = sandbox.window.AstraeonEntityCollisionV1;

function gameWith(player, mobs = [], npcsV4 = []) {
  return {
    player, mobs, npcsV4,
    moveEntity(entity, dx, dy) { entity.x += dx; entity.y += dy; }
  };
}

remote.clear();
const player = { x: 0, y: 0 }, mob = { x: 40, y: 0, dead: false };
const game = gameWith(player, [mob]);
Collision.install(game);
game.moveEntity(player, 120, 0, 13);
assert(player.x <= 15.001, 'Corrida não pode atravessar ou empurrar um mob.');
assert.deepEqual(mob, { x: 40, y: 0, dead: false }, 'O mob parado não pode ser deslocado pelo jogador.');

const player2 = { x: 0, y: 0 }, mob2 = { x: 50, y: 0, dead: false };
const game2 = gameWith(player2, [mob2]);
Collision.install(game2);
game2.moveEntity(mob2, -100, 0, 12);
assert(mob2.x >= 25 - .001, 'O mob deve parar na borda do jogador.');
assert.deepEqual(player2, { x: 0, y: 0 }, 'O mob não pode empurrar o jogador.');

const mobA = { x: 0, y: 0, dead: false }, mobB = { x: 35, y: 0, dead: false };
const game3 = gameWith({ x: -100, y: 0 }, [mobA, mobB]);
Collision.install(game3);
game3.moveEntity(mobA, 80, 0, 12);
assert(mobA.x <= 11.001, 'Um mob correndo não pode atravessar outro mob.');
assert.equal(mobB.x, 35, 'O mob atingido não pode ser empurrado.');

const overlappedPlayer = { x: 0, y: 0 }, overlappedMob = { x: 10, y: 0, dead: false };
const game4 = gameWith(overlappedPlayer, [overlappedMob]);
Collision.install(game4);
game4.moveEntity(overlappedPlayer, -10, 0, 13);
assert(overlappedPlayer.x < 0, 'Uma entidade já sobreposta deve conseguir se afastar sem ficar presa.');
assert.equal(overlappedMob.x, 10, 'A recuperação de sobreposição não pode deslocar o outro corpo.');

remote.clear();
const otherPlayer = { x: 40, y: 0 };
remote.set('remote-1', otherPlayer);
const localPlayer = { x: 0, y: 0 }, onlineGame = gameWith(localPlayer);
Collision.install(onlineGame);
onlineGame.moveEntity(localPlayer, 100, 0, 13);
assert(localPlayer.x <= 14.001, 'O jogador local não pode atravessar outro jogador online.');
assert.equal(otherPlayer.x, 40, 'O jogador remoto não pode ser empurrado localmente.');

const constrained = Collision.constrain(onlineGame, otherPlayer, -100, 0, 13);
assert(constrained.x >= 26 - .001, 'A interpolação remota deve parar na borda do jogador local.');
assert.equal(localPlayer.x <= 14.001, true, 'A interpolação remota não pode mover o jogador local.');

assert.doesNotMatch(liveSource, /function separate\(|resolveBodies\(/, 'A separação que empurrava os dois corpos deve ser removida.');
assert.match(liveSource, /AstraeonEntityCollisionV1\?\.install/, 'O runtime deve instalar a colisão rígida.');
assert.match(multiplayerSource, /collision\?\.constrain/, 'Jogadores remotos devem respeitar a colisão visual.');
assert(indexSource.indexOf('src/entity-collision-v1.js') < indexSource.indexOf('src/game-v2.js'), 'A colisão deve carregar antes do jogo.');

console.log('ASTRAEON ENTITY COLLISION V1 validation OK');
