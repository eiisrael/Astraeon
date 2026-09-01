import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const deathSource=fs.readFileSync(new URL('../src/death-penalty-v1.js',import.meta.url),'utf8');
const inputSource=fs.readFileSync(new URL('../src/input-guard-v1.js',import.meta.url),'utf8');
const menuBootSource=fs.readFileSync(new URL('../src/menu-boot-guard-v1.js',import.meta.url),'utf8');
const worldSource=fs.readFileSync(new URL('../src/world-online-v4.js',import.meta.url),'utf8');
const panelCss=fs.readFileSync(new URL('../src/panel-fit-v1.css',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/023_death_xp_penalty.sql',import.meta.url),'utf8');

const sandbox={
  console,
  document:{querySelector:()=>null},
  setTimeout:()=>1,
  clearTimeout:()=>{},
  crypto:{randomUUID:()=> '73000000-0000-4000-8000-000000000001',getRandomValues:bytes=>bytes},
  AstraeonMultiplayerV4:null,
  AstraeonCharactersV6:null,
  astraeon:null
};
sandbox.window=sandbox;
vm.runInNewContext(deathSource,sandbox);
const Death=sandbox.AstraeonDeathPenaltyV1;
assert.ok(Death,'runtime de penalidade deve iniciar');

for(const [xp,before,loss,after] of [
  [1000,1000,150,850],
  [850,850,128,722],
  [1,1,1,0],
  [0,0,0,0],
  [-50,0,0,0]
]){
  const result=Death.calculateDeathXp(xp);
  assert.equal(result.before,before,`EXP inicial segura para ${xp}`);
  assert.equal(result.loss,loss,`perda correta para ${xp}`);
  assert.equal(result.after,after,`EXP final correta para ${xp}`);
}
assert.match(deathSource,/DEATH_XP_RATE\s*=\s*0\.15/,'morte deve remover exatamente 15%');
assert.match(deathSource,/player\.level = levelBefore/,'nível deve ser restaurado ao valor anterior à morte');
assert.match(deathSource,/player\.xpNext = xpNextBefore/,'limiar de nível não pode ser alterado pela morte');
assert.doesNotMatch(deathSource,/this\.gainXp\s*\(/,'penalidade nunca pode chamar gainXp');
assert.match(inputSource,/death-penalty-v1\.js/,'bootstrap deve carregar a proteção de morte');
assert.match(inputSource,/menu-boot-guard-v1\.js/,'bootstrap deve carregar o guard do menu moderno');
assert.doesNotThrow(()=>new vm.Script(menuBootSource),'guard de boot deve possuir JavaScript válido');
assert.match(menuBootSource,/astraeon-menu-v62/,'boot aguarda o menu cinematográfico atual');
assert.match(menuBootSource,/#cinematicWorldStage/,'boot aguarda a cena cinematográfica atual');
assert.match(menuBootSource,/#chooseCharacterBtn/,'boot aguarda o seletor atual de personagens');
assert.match(menuBootSource,/#accountInfoStartBtn/,'boot aguarda informações da conta atuais');
assert.match(menuBootSource,/Criar Personagem/,'boot não aceita o rótulo legado Nova jornada');
assert.match(menuBootSource,/classList\.add\('astraeon-main-menu-ready'\)/,'somente o menu completo pode liberar o primeiro frame');

const drawCities=worldSource.match(/function drawCities\([\s\S]*?\n  function pruneCityMobs/);
assert.ok(drawCities,'drawCities deve existir');
assert.doesNotMatch(drawCities[0],/fillText\s*\(/,'nome da cidade não deve mais ser desenhado no mundo');
assert.match(worldSource,/id = 'cityLocationHud'/,'HUD de cidade deve existir');
assert.match(worldSource,/minimap\.insertAdjacentElement\('beforebegin',hud\)/,'HUD de cidade deve ficar antes/acima do minimapa');
assert.match(worldSource,/updateCityHud\(game\)/,'cidade deve acompanhar a posição do jogador');

assert.match(panelCss,/^@import url\("menu-cinematic-v62\.css\?v=6\.2\.0"\);/,'CSS moderno do menu deve bloquear o primeiro frame');
assert.match(panelCss,/body:not\(\.astraeon-main-menu-ready\) #startScreen/,'HTML legado deve ficar invisível até o menu atual estar completo');
assert.match(panelCss,/#inventoryPanel small[\s\S]*font-size:\s*12\.5px\s*!important/,'small dos painéis deve ter piso legível');
assert.match(panelCss,/\.player-card \.bar-line[\s\S]*font-size:\s*10px\s*!important/,'recursos do HUD não podem voltar a 7 px');
assert.match(panelCss,/\.mob-target-eyebrow[\s\S]*font-size:\s*11px\s*!important/,'microtextos do alvo devem permanecer legíveis');
assert.match(panelCss,/\.city-location-hud[\s\S]*bottom:\s*230px/,'nome da cidade deve ficar acima do minimapa');

assert.match(migration,/grant execute on function public\.apply_astraeon_death_penalty\(uuid,uuid\) to authenticated/,'RPC de morte deve ser autenticada');
assert.match(migration,/where id = target_character and user_id = uid/,'RPC deve validar propriedade do personagem');
assert.ok(migration.indexOf('where id = target_character and user_id = uid') < migration.indexOf('astraeon_operation_is_applied(request_id'),'propriedade deve ser verificada antes da idempotência');
assert.match(migration,/ceil\(current_xp::numeric \* 0\.15\)/,'servidor calcula os 15% sem confiar em valor enviado pelo cliente');
assert.match(migration,/final_xp := greatest\(0::bigint, current_xp - lost_xp\)/,'servidor nunca permite EXP negativa');
assert.match(migration,/if final_xp > current_xp then raise exception/,'servidor bloqueia qualquer caminho que aumente EXP');
assert.doesNotMatch(migration,/set\s+level\s*=/i,'RPC de morte nunca pode alterar nível');

console.log('ASTRAEON DEATH + MENU BOOT + CITY HUD + LEGIBILITY contracts OK');
