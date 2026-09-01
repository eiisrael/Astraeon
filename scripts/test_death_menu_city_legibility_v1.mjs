import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const deathSource=fs.readFileSync(new URL('../src/death-penalty-v1.js',import.meta.url),'utf8');
const inputSource=fs.readFileSync(new URL('../src/input-guard-v1.js',import.meta.url),'utf8');
const menuBootSource=fs.readFileSync(new URL('../src/menu-boot-guard-v1.js',import.meta.url),'utf8');
const worldSource=fs.readFileSync(new URL('../src/world-online-v4.js',import.meta.url),'utf8');
const panelCss=fs.readFileSync(new URL('../src/panel-fit-v1.css',import.meta.url),'utf8');
const onlineUxCss=fs.readFileSync(new URL('../src/online-ux-final-v1.css',import.meta.url),'utf8');
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

const mockGame={
  player:{xp:1000,xpNext:4200,level:10,hp:0},
  playerDeath(){this.player.level=11;this.player.xpNext=5544;this.player.xp=9999;this.player.hp=50;},
  updateUI(){this.uiUpdated=true;},
  save(){this.saved=true;},
  toast(message){this.lastToast=message;}
};
assert.equal(Death.install(mockGame),true,'guard deve envolver o fluxo real de morte');
mockGame.playerDeath();
assert.equal(mockGame.player.xp,850,'morte real perde 15% da EXP');
assert.equal(mockGame.player.level,10,'morte real não promove nem rebaixa nível');
assert.equal(mockGame.player.xpNext,4200,'morte real não altera o limiar do próximo nível');
assert.equal(mockGame.uiUpdated,true,'HUD é atualizado após a penalidade');
assert.equal(mockGame.saved,true,'save recebe a EXP penalizada');

assert.match(deathSource,/DEATH_XP_RATE\s*=\s*0\.15/,'morte deve remover exatamente 15%');
assert.match(deathSource,/player\.level = levelBefore/,'nível deve ser restaurado ao valor anterior à morte');
assert.match(deathSource,/player\.xpNext = xpNextBefore/,'limiar de nível não pode ser alterado pela morte');
assert.doesNotMatch(deathSource,/this\.gainXp\s*\(/,'penalidade nunca pode chamar gainXp');
assert.match(inputSource,/death-penalty-v1\.js/,'bootstrap deve carregar a proteção de morte');
assert.match(inputSource,/menu-boot-guard-v1\.js/,'bootstrap deve carregar o guard do menu moderno');
assert.match(inputSource,/astraeon-auth-booting/,'primeiro frame deve bloquear o gameRoot até resolver autenticação');
assert.match(inputSource,/astraeon-login-required/,'visitante sem sessão deve permanecer somente no login');
assert.match(inputSource,/panel\.classList\.remove\('hidden'\)/,'login deve abrir automaticamente quando não há sessão');
assert.match(inputSource,/routeRuntimeEscape/,'ESC deve ser roteado para Configurações no modo online');
assert.match(inputSource,/game\.paused = false/,'ESC nunca pode deixar o jogo pausado');
assert.match(inputSource,/runtimeSettingsBridgeV8Installed/,'runtime deve substituir a pausa pelo menu de Configurações');
assert.match(inputSource,/ESC configurações/,'dica do HUD deve mostrar o novo uso do ESC');
assert.match(inputSource,/settings-menu-v8\.js/,'bootstrap deve carregar o menu de Configurações V8');
assert.match(inputSource,/ingame-dialog-v1\.js/,'bootstrap deve carregar a messagebox ingame');
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
assert.match(panelCss,/#inventoryPanel small[\s\S]*font-size:\s*12\.5px\s*!important/,'small dos painéis deve continuar legível');
assert.match(panelCss,/\.mob-target-eyebrow[\s\S]*font-size:\s*11px\s*!important/,'microtextos do alvo devem permanecer legíveis');

assert.match(onlineUxCss,/body:not\(\.game-running\) #hud[\s\S]*display:none!important/,'HUD não pode aparecer vazio durante F5/login');
assert.match(onlineUxCss,/\.overlay-panel:not\(\.online-account-panel\)[\s\S]*background:transparent!important[\s\S]*backdrop-filter:none!important/,'painéis comuns do jogo não devem criar véu translúcido no mundo');
assert.match(onlineUxCss,/\.player-card \.player-title small[\s\S]*font-size:7px!important/,'microtexto do HUD do jogador volta ao tamanho compacto anterior');
assert.match(onlineUxCss,/\.player-card \.bar-line,[\s\S]*font-size:7px!important/,'recursos do HUD do jogador devem ficar cerca de 4px menores que o override anterior');
assert.match(onlineUxCss,/\.city-location-hud[\s\S]*background:none!important[\s\S]*text-align:center!important/,'cidade acima do minimapa deve ser texto puro, sem card');
assert.match(onlineUxCss,/\.city-location-hud strong[\s\S]*color:#f0ddbb!important[\s\S]*font:700 12px\/1\.05 Georgia,serif!important/,'nome da cidade deve reproduzir fonte e cor do rótulo original');
assert.match(onlineUxCss,/\.city-location-hud span[\s\S]*color:var\(--city-accent\)!important[\s\S]*font:600 9px\/1\.1 Inter,sans-serif!important/,'descrição da cidade deve reproduzir cor e fonte do rótulo original');
assert.match(onlineUxCss,/bottom:194px!important/,'rótulo da cidade deve ficar imediatamente acima do minimapa desktop');

assert.match(migration,/grant execute on function public\.apply_astraeon_death_penalty\(uuid,uuid\) to authenticated/,'RPC de morte deve ser autenticada');
assert.match(migration,/where id = target_character and user_id = uid/,'RPC deve validar propriedade do personagem');
assert.ok(migration.indexOf('where id = target_character and user_id = uid') < migration.indexOf('astraeon_operation_is_applied(request_id'),'propriedade deve ser verificada antes da idempotência');
assert.match(migration,/ceil\(current_xp::numeric \* 0\.15\)/,'servidor calcula os 15% sem confiar em valor enviado pelo cliente');
assert.match(migration,/final_xp := greatest\(0::bigint, current_xp - lost_xp\)/,'servidor nunca permite EXP negativa');
assert.match(migration,/if final_xp > current_xp then raise exception/,'servidor bloqueia qualquer caminho que aumente EXP');
assert.doesNotMatch(migration,/set\s+level\s*=/i,'RPC de morte nunca pode alterar nível');

console.log('ASTRAEON DEATH + LOGIN BOOT + CITY HUD + RUNTIME SETTINGS contracts OK');
