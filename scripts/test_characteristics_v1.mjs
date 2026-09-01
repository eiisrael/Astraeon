import '../src/characteristics-model-v1.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const M = globalThis.AstraeonCharacteristicsModelV1;
assert.ok(M, 'modelo de características deve ser exportado');
assert.equal(M.earnedPoints(1), 5);
assert.equal(M.earnedPoints(2), 10);
assert.equal(M.earnedPoints(50), 250);
assert.equal(M.earnedPoints(51), 253);
assert.equal(M.earnedPoints(75), 325);
assert.equal(M.availablePoints(10, { damage: 10, intelligence: 5, dexterity: 5, constitution: 5 }), 25);
assert.deepEqual(M.normalizeAttributes({ damage: 5, intelligence: 5, dexterity: 5, constitution: 5 }, 12), { damage: 5, intelligence: 5, dexterity: 2, constitution: 0 });
assert.deepEqual(M.bonuses({ damage: 5, intelligence: 4, dexterity: 10, constitution: 8 }), { maxHp: 24, maxMana: 12, power: 5, defense: 2, speed: 8, range: 0, crit: .01 });
assert.deepEqual(M.addStats({ maxHp: 100, maxMana: 50, power: 10, defense: 2, speed: 100, range: 50, crit: .1 }, M.bonuses({ damage: 5, intelligence: 4, dexterity: 10, constitution: 8 })), { maxHp: 124, maxMana: 62, power: 15, defense: 4, speed: 108, range: 50, crit: .11 });

const runtime = fs.readFileSync(new URL('../src/characteristics-v1.js', import.meta.url), 'utf8');
const characters = fs.readFileSync(new URL('../src/character-system-v6.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /id="characteristicsApply"[^>]*>Salvar pontos</, 'painel expõe uma ação explícita de salvamento');
assert.match(runtime, /await global\.AstraeonCharactersV6\.saveCharacterNow\(\)/, 'salvar pontos aguarda a persistência online');
assert.match(characters, /saveTimers:new Map\(\)/, 'autosaves são isolados por personagem');
assert.match(characters, /saveCharacterNow\(\{targetCharacterId,saveData\}\)/, 'autosave usa o personagem e o snapshot capturados no agendamento');
assert.match(characters, /targetCharacterId===state\.activeCharacterId/, 'save atrasado não sobrescreve o perfil do personagem atualmente selecionado');

console.log('ASTRAEON CHARACTERISTICS V1 balance validation OK');
