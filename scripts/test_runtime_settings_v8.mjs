import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const settings=read('src/settings-menu-v8.js');
const settingsCss=read('src/settings-menu-v8.css');
const input=read('src/input-guard-v1.js');
const dialog=read('src/ingame-dialog-v1.js');
const inventory=read('src/inventory-v4.js');

// ESC em runtime abre Configurações e não pausa o mundo.
assert.match(input,/function routeRuntimeEscape\(event\)/,'ESC runtime deve possuir roteador próprio.');
assert.match(input,/global\.AstraeonSettingsMenuV8\?\.toggle\?\.\('general'\)/,'ESC deve alternar o menu de Configurações.');
assert.match(input,/game\.paused = false/,'ESC deve manter o mundo online rodando.');
assert.match(input,/this\.paused = false/,'togglePause legado deve ser neutralizado em runtime.');
assert.match(input,/if \(game\.runtimeSettingsBridgeV8Installed\) return true/,'bootstrap deve encerrar o timer após instalar a ponte de configurações.');
assert.match(input,/ESC configurações/,'dica do HUD deve anunciar Configurações, não pausa.');
assert.doesNotMatch(input,/blockOnlineEscapePause/,'guard antigo de ESC sem ação não deve permanecer.');
assert.doesNotMatch(input,/onlineNoPauseV1Installed/,'ponte antiga de pausa deve ser removida.');

// Menu em tabs.
for(const label of ['Geral','Vídeo','Áudio','Controles','Conta'])assert.ok(settings.includes(`'${label}'`),`tab ${label} deve existir`);
for(const id of ['mouseSensitivityRange','showPlayerInfoToggle','showHudTipsToggle','videoResolutionSelect','videoQualitySelect','videoShadowsToggle','videoVignetteToggle','masterVolumeRange','effectsVolumeRange','musicVolumeRange','masterMuteToggle'])assert.ok(settings.includes(id),`controle ${id} deve existir`);
assert.match(settings,/RESOLUTIONS=\{auto:null,'1920x1080':\[1920,1080\],'1600x900':\[1600,900\],'1280x720':\[1280,720\],'1024x768':\[1024,768\]\}/,'presets de resolução devem existir.');
assert.match(settings,/qualityCap=settings\.quality==='low'\?1:settings\.quality==='medium'\?1\.5:2/,'qualidade deve alterar densidade de renderização.');
assert.match(settings,/game\.beep=function\(freq,duration=\.04,gain=\.02\)/,'efeitos sonoros devem respeitar volumes do menu.');
assert.match(settings,/document\.querySelectorAll\('audio'\)/,'música/áudio HTML deve receber volume master.');
assert.match(settings,/body\?\.classList\.toggle\('hide-player-info'/,'visibilidade das informações do jogador deve ser configurável.');
assert.match(settings,/body\?\.classList\.toggle\('hide-vignette-v8'/,'vignette deve ser configurável.');
assert.match(settings,/makeTab\('account','Informações da Conta'\)/,'menu ESC deve expor a aba Informações da Conta.');
assert.match(settings,/function syncAccountInfo\(\)/,'aba de conta deve refletir a sessão online.');
assert.match(settings,/function openAccountPanel\(\)/,'aba de conta deve abrir as ações de conta e nuvem.');
assert.match(settingsCss,/\.settings-account-card\{/,'aba de conta deve possuir layout próprio.');

// Arrastar sem competir com transform do Panel Fit e resetar ao centro.
assert.match(settings,/card\.style\.translate=`\$\{Math\.round\(x\)\}px \$\{Math\.round\(y\)\}px`/,'menu deve usar translate para arrastar.');
assert.match(settings,/function resetPosition[\s\S]*card\.style\.translate='0px 0px'/,'posição deve resetar ao centro.');
assert.match(settings,/if\(hidden===wasHidden\)return/,'o observer deve reagir apenas a transições reais de visibilidade.');
assert.match(settings,/if\(hidden\)resetPosition\(card\)/,'fechamento deve limpar posição arrastada.');
assert.match(settingsCss,/#settingsPanel\{[\s\S]*background:rgba\(2,4,6,\.18\)!important/,'fundo deve permitir visualizar claramente o jogo.');

// Messagebox ingame e descarte sem chamar APIs nativas do navegador no caminho efetivo.
assert.match(dialog,/global\.AstraeonMessageBoxV1=\{request,confirm,alert,prompt,install\}/,'API de diálogos ingame deve estar disponível.');
assert.match(dialog,/game\.discardInventoryRef=async function\(ref\)/,'descarte deve ser substituído por fluxo assíncrono ingame.');
assert.match(dialog,/const accepted=await confirm\(/,'descarte deve aguardar a messagebox ingame.');
assert.doesNotMatch(dialog,/global\.(?:confirm|alert|prompt)|window\.(?:confirm|alert|prompt)/,'runtime ingame não pode chamar APIs nativas do navegador.');
assert.match(inventory,/global\.confirm/,'contrato documenta o legado que é interceptado antes do uso pelo runtime ingame.');
assert.match(settingsCss,/\.astraeon-messagebox\{/,'messagebox deve possuir camada visual dentro do jogo.');

console.log('ASTRAEON RUNTIME SETTINGS V8 + INGAME DIALOG contracts OK');
