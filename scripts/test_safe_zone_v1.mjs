import assert from 'node:assert/strict';

const design = {
  zones: [{ type: 'mob_exclusion', shape: 'rect', x1: 0, y1: 0, x2: 100, y2: 100, enabled: true }],
  sceneObjects: []
};
let attacks = 0;
let hits = 0;
let warnings = 0;
let updateMobStep = null;
const mobs = [];

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; } };
globalThis.document = { readyState: 'complete', querySelector() { return null; } };
globalThis.AstraeonWorld = { TILE: 48, loadWorldDesign() { return design; } };
globalThis.astraeon = {
  player: { x: 50, y: 50 }, mobs, npcsV4: [],
  drawTerrain() {}, drawPlayer() {}, startNew() {}, continueGame() {},
  update() { updateMobStep?.(); }, addMob(type, x, y) { const mob = { id: `${type}-${mobs.length}`, type, x, y, homeX: x, homeY: y, dead: false, aggro: true }; mobs.push(mob); return mob; },
  basicAttack() { attacks++; }, castSkill() { attacks++; }, hitMob() { hits++; },
  toast() { warnings++; }
};

await import('../src/production-runtime-v6.js');
const P = globalThis.AstraeonProductionV6;
assert.ok(P, 'runtime de produção deve expor as regras de área protegida');
assert.equal(P.playerProtected(50, 50), true, 'centro da exclusão protege o jogador');
assert.equal(P.playerProtected(150, 50), false, 'proteção de ataque termina na borda exata');
assert.equal(P.mobForbidden(150, 50), true, 'mobs respeitam margem de dois tiles fora da área');
assert.equal(P.mobForbidden(240, 50), false, 'mobs continuam permitidos longe da área');

globalThis.astraeon.addMob('Orc', 150, 50);
assert.equal(mobs.length, 0, 'spawn próximo da área é rejeitado');
globalThis.astraeon.addMob('Orc', 240, 50);
assert.equal(mobs.length, 1, 'spawn distante permanece permitido');
updateMobStep = () => { mobs[0].x = 190; };
globalThis.astraeon.update(.016);
assert.equal(mobs[0].x, 240, 'mob que tenta entrar na margem retorna à posição segura');
assert.equal(mobs[0].aggro, false, 'mob abandona perseguição ao alcançar a barreira');

globalThis.astraeon.basicAttack();
globalThis.astraeon.castSkill(0);
globalThis.astraeon.hitMob(mobs[0], 10, false);
assert.equal(attacks, 0, 'jogador não executa ataques dentro da área');
assert.equal(hits, 0, 'nenhuma rota alternativa causa dano dentro da área');
assert.ok(warnings >= 1, 'bloqueio informa o jogador');

globalThis.astraeon.player.x = 240;
globalThis.astraeon.basicAttack();
globalThis.astraeon.hitMob(mobs[0], 10, false);
assert.equal(attacks, 1, 'ataque funciona fora da área');
assert.equal(hits, 1, 'dano funciona fora da área');

clearInterval(P.state.itemTimer);
console.log('ASTRAEON SAFE ZONE V1 combat, approach and spawn validation OK');
