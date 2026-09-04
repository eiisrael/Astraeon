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
const migration = fs.readFileSync(new URL('../supabase/migrations/024_characteristics_persistence.sql', import.meta.url), 'utf8');

assert.match(index, /id="characteristicsApply"[^>]*>Salvar pontos</, 'painel expõe uma ação explícita de salvamento');
assert.match(runtime, /client\.rpc\('set_astraeon_characteristics'/, 'Salvar pontos usa a RPC autoritativa por personagem');
assert.match(runtime, /client\.from\('character_progress'\)[\s\S]*attribute_damage,attribute_intelligence,attribute_dexterity,attribute_constitution,level/, 'carregamento reconcilia os quatro atributos do banco');
assert.match(runtime, /\.maybeSingle\(\)\s*\.retry\(false\)/, 'leitura de características desativa retries internos do cliente Supabase');
assert.match(runtime, /cancelPendingCharacterSave\(activeCharacterId\);/, 'salvar características cancela o autosave antigo antes que ele sobrescreva o snapshot novo');
assert.match(runtime, /activeCharacterId \? await global\.AstraeonCharactersV6\.saveCharacterNow\(\) : true/, 'espelho JSON atualizado é persistido imediatamente após cancelar o save atrasado');
assert.match(runtime, /legacyAttributes \? M\.subtractStats\(base, previous\) : M\.normalizeStats\(base\)/, 'save legado com player.characteristics não pode aplicar bônus duas vezes ao reconstruir stats');
assert.match(runtime, /authorityUnavailableUntil/, 'cliente mantém compatibilidade temporária enquanto migration 024 ainda não estiver em produção');
assert.ok(runtime.includes('Pontos salvos no personagem · validação online pendente'), 'status ao jogador deve explicar a pendência sem expor infraestrutura');
assert.ok(!runtime.includes('aguardando migration 024') && !runtime.includes('após a migration 024'), 'mensagens ao jogador não devem expor detalhes de migration');
assert.doesNotMatch(runtime, /setInterval\(/, 'sincronização de características não mantém polling permanente no main thread');
assert.equal((runtime.match(/syncActiveCharacter\(\);/g) || []).length, 2, 'criar e continuar personagem disparam uma única sincronização online');
assert.match(characters, /saveTimers:new Map\(\)/, 'autosaves continuam isolados por personagem');

for (const column of ['attribute_damage','attribute_intelligence','attribute_dexterity','attribute_constitution']) {
  assert.ok(migration.includes(column), `banco deve possuir coluna autoritativa ${column}`);
}
assert.match(migration, /least\(current_row\.level,50\)\*5 \+ greatest\(current_row\.level-50,0\)\*3/, 'servidor calcula o orçamento de características pelo nível autoritativo');
assert.match(migration, /if spent > earned then raise exception 'characteristic_points_exceeded'/, 'servidor bloqueia pontos acima do orçamento');
assert.match(migration, /characteristic_respec_not_allowed/, 'servidor impede reduzir pontos confirmados para reaproveitamento indevido');
assert.match(migration, /cp\.user_id=uid[\s\S]*c\.user_id=uid/, 'RPC exige propriedade do character_progress e do personagem');
assert.match(migration, /grant execute on function public\.set_astraeon_characteristics\(uuid,integer,integer,integer,integer\) to authenticated/, 'somente a RPC validada é exposta ao cliente autenticado');

console.log('ASTRAEON CHARACTERISTICS V1 persistence + authority validation OK');
