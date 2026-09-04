(function(global){
'use strict';

const STORAGE_KEY='astraeon:v8:settings';
const RETRY_MS=80;
const RESOLUTIONS={auto:null,'1920x1080':[1920,1080],'1600x900':[1600,900],'1280x720':[1280,720],'1024x768':[1024,768]};
const defaults={
  mouseSensitivity:100,
  showPlayerInfo:true,
  showHudTips:true,
  resolution:'auto',
  quality:'high',
  shadows:true,
  vignette:true,
  masterVolume:80,
  effectsVolume:85,
  musicVolume:65,
  mute:false
};
let settings=loadSettings();
let installed=false;
let retryTimer=0;
let shadowRetry=0;
let drag=null;

const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

function loadSettings(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')};}
  catch(_){return {...defaults};}
}
function saveSettings(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch(_){}}
function rowFor(id){return $(`#${id}`)?.closest('.setting-row')||null;}
function makeElement(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}

function makeRange(id,title,description,min,max,step,value,suffix='%'){
  const label=makeElement('label','setting-row settings-v8-row');
  const copy=makeElement('span');copy.append(makeElement('b','',title),makeElement('small','',description));
  const input=document.createElement('input');input.id=id;input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);
  const output=document.createElement('output');output.id=`${id}Value`;output.textContent=`${value}${suffix}`;
  label.append(copy,input,output);return label;
}
function makeToggle(id,title,description,checked){
  const label=makeElement('label','setting-row settings-v8-row');
  const copy=makeElement('span');copy.append(makeElement('b','',title),makeElement('small','',description));
  const input=document.createElement('input');input.id=id;input.type='checkbox';input.checked=!!checked;
  label.append(copy,input);return label;
}
function makeSelect(id,title,description,options,value){
  const label=makeElement('label','setting-row settings-v8-row');
  const copy=makeElement('span');copy.append(makeElement('b','',title),makeElement('small','',description));
  const select=document.createElement('select');select.id=id;
  for(const [key,labelText] of options){const option=document.createElement('option');option.value=key;option.textContent=labelText;select.appendChild(option);}
  select.value=value;label.append(copy,select);return label;
}
function makeTab(name,label){const section=makeElement('section','settings-tab-panel');section.dataset.settingsTab=name;section.setAttribute('aria-label',label);return section;}

function ensureMarkup(){
  const panel=$('#settingsPanel');
  const card=panel?.querySelector('.settings-card');
  const oldGrid=card?.querySelector('.settings-grid');
  if(!panel||!card)return null;
  if(card.dataset.settingsV8==='true')return {panel,card};
  if(!oldGrid)return null;

  card.dataset.settingsV8='true';
  card.classList.add('settings-v8-card');
  const header=card.querySelector('.overlay-head');
  header?.classList.add('settings-drag-handle');
  const kicker=header?.querySelector('.panel-kicker');if(kicker)kicker.textContent='Sistema · Online';
  const title=header?.querySelector('h2');if(title)title.textContent='Configurações';
  const description=header?.querySelector('p');if(description)description.textContent='Personalize interface, vídeo, áudio e controles sem pausar o mundo.';

  const tabs=makeElement('nav','settings-tabs');tabs.setAttribute('aria-label','Categorias de configurações');
  for(const [name,label] of [['general','Geral'],['video','Vídeo'],['audio','Áudio'],['controls','Controles'],['account','Conta']]){
    const button=makeElement('button','settings-tab-button',label);button.type='button';button.dataset.settingsTabTarget=name;button.setAttribute('aria-selected',name==='general'?'true':'false');if(name==='general')button.classList.add('active');tabs.appendChild(button);
  }

  const content=makeElement('div','settings-tabs-content');
  const general=makeTab('general','Geral');
  const video=makeTab('video','Vídeo');
  const audio=makeTab('audio','Áudio');
  const controls=makeTab('controls','Controles');
  const account=makeTab('account','Informações da Conta');

  general.append(
    makeRange('mouseSensitivityRange','Sensibilidade do mouse','Ajusta a resposta da mira e direção do cursor no mundo.',50,150,5,settings.mouseSensitivity),
    makeToggle('showPlayerInfoToggle','Informações dos jogadores','Mostra imagem, nick, nível, recursos e HUD do jogador.',settings.showPlayerInfo),
    makeToggle('showHudTipsToggle','Dicas de atalhos','Exibe a linha de atalhos na parte inferior da tela.',settings.showHudTips)
  );
  for(const id of ['uiScaleRange','damageToggle','minimapToggle','compactToggle']){const row=rowFor(id);if(row)general.appendChild(row);}

  video.append(
    makeSelect('videoResolutionSelect','Resolução de renderização','Altera a resolução interna do mundo mantendo a interface no tamanho da janela.',Object.keys(RESOLUTIONS).map(key=>[key,key==='auto'?'Automática (janela)':key]),settings.resolution),
    makeSelect('videoQualitySelect','Qualidade gráfica','Define a densidade de renderização e o custo visual.',[['low','Baixa'],['medium','Média'],['high','Alta']],settings.quality),
    makeToggle('videoShadowsToggle','Sombras','Ativa sombras dinâmicas dos objetos e elementos do mundo.',settings.shadows),
    makeToggle('videoVignetteToggle','Vignette','Escurecimento cinematográfico suave nas bordas da tela.',settings.vignette)
  );
  const weather=rowFor('weatherToggle');if(weather)video.appendChild(weather);

  audio.append(
    makeRange('masterVolumeRange','Volume geral','Controla todo o áudio produzido pelo jogo.',0,100,1,settings.masterVolume),
    makeRange('effectsVolumeRange','Efeitos sonoros','Golpes, interface, habilidades e feedback sonoro.',0,100,1,settings.effectsVolume),
    makeRange('musicVolumeRange','Música','Volume das trilhas e ambientes musicais.',0,100,1,settings.musicVolume),
    makeToggle('masterMuteToggle','Mute geral','Silencia todo o jogo sem alterar os volumes configurados.',settings.mute)
  );

  const touch=rowFor('touchToggle');if(touch)controls.appendChild(touch);
  const controlsGuide=makeElement('div','settings-controls-guide');
  controlsGuide.innerHTML='<div><kbd>WASD</kbd><span>Movimento</span></div><div><kbd>Shift</kbd><span>Correr</span></div><div><kbd>1–5</kbd><span>Habilidades</span></div><div><kbd>Enter</kbd><span>Chat</span></div><div><kbd>I / C</kbd><span>Inventário / Características</span></div><div><kbd>ESC</kbd><span>Abrir / fechar Configurações</span></div>';
  controls.appendChild(controlsGuide);

  const accountCard=makeElement('div','settings-account-card');
  accountCard.innerHTML='<span class="settings-account-kicker">Astraeon Online</span><h3>Informações da Conta</h3><p>Consulte sua identidade conectada e acesse as ações de nuvem sem sair do jogo.</p><div class="settings-account-identity" aria-live="polite"><i id="settingsAccountAvatar">A</i><div><b id="settingsAccountName">Sessão não iniciada</b><small id="settingsAccountEmail">Entre para sincronizar seu legado.</small></div><em id="settingsAccountState">Offline</em></div><button id="settingsAccountOpen" class="inventory-action primary" type="button">Abrir Conta &amp; Nuvem</button>';
  account.appendChild(accountCard);

  content.append(general,video,audio,controls,account);
  oldGrid.replaceWith(tabs,content);

  tabs.addEventListener('click',event=>{const button=event.target.closest('[data-settings-tab-target]');if(button)activateTab(button.dataset.settingsTabTarget);});
  accountCard.querySelector('#settingsAccountOpen')?.addEventListener('click',openAccountPanel);
  bindNewControls();
  installDrag(panel,card,header);
  observePanel(panel,card);
  return {panel,card};
}

function activateTab(name='general'){
  document.querySelectorAll('[data-settings-tab-target]').forEach(button=>{const active=button.dataset.settingsTabTarget===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
  document.querySelectorAll('[data-settings-tab]').forEach(section=>section.classList.toggle('active',section.dataset.settingsTab===name));
  if(name==='account')syncAccountInfo();
}

function syncAccountInfo(){
  const state=global.AstraeonMultiplayerV4?.state;
  const session=state?.session;
  const profile=state?.profile;
  const name=profile?.username||profile?.display_name||session?.user?.user_metadata?.username||'Sessão não iniciada';
  const email=session?.user?.email||'Entre para sincronizar seu legado.';
  const avatar=$('#settingsAccountAvatar'),nameEl=$('#settingsAccountName'),emailEl=$('#settingsAccountEmail'),status=$('#settingsAccountState');
  if(avatar)avatar.textContent=session?String(name).charAt(0).toUpperCase()||'A':'A';
  if(nameEl)nameEl.textContent=name;
  if(emailEl)emailEl.textContent=email;
  if(status){status.textContent=session?'Conectada':'Offline';status.dataset.connected=session?'true':'false';}
}

function openAccountPanel(){
  closeSettings();
  global.AstraeonMultiplayerV4?.install?.();
  const open=()=>{const panel=$('#onlineAccountPanel');if(!panel)return false;panel.classList.remove('hidden');return true;};
  if(!open())requestAnimationFrame(open);
}

function syncInputs(){
  const values={
    mouseSensitivityRange:settings.mouseSensitivity,showPlayerInfoToggle:settings.showPlayerInfo,showHudTipsToggle:settings.showHudTips,
    videoResolutionSelect:settings.resolution,videoQualitySelect:settings.quality,videoShadowsToggle:settings.shadows,videoVignetteToggle:settings.vignette,
    masterVolumeRange:settings.masterVolume,effectsVolumeRange:settings.effectsVolume,musicVolumeRange:settings.musicVolume,masterMuteToggle:settings.mute
  };
  for(const [id,value] of Object.entries(values)){const el=$(`#${id}`);if(!el)continue;if(el.type==='checkbox')el.checked=!!value;else el.value=String(value);const output=$(`#${id}Value`);if(output)output.textContent=`${value}%`;}
}

function bindNewControls(){
  const bindRange=(id,key)=>$(`#${id}`)?.addEventListener('input',event=>{settings[key]=clamp(event.target.value,0,key==='mouseSensitivity'?150:100);const out=$(`#${id}Value`);if(out)out.textContent=`${settings[key]}%`;applySettings();});
  bindRange('mouseSensitivityRange','mouseSensitivity');
  bindRange('masterVolumeRange','masterVolume');
  bindRange('effectsVolumeRange','effectsVolume');
  bindRange('musicVolumeRange','musicVolume');
  const bindToggle=(id,key)=>$(`#${id}`)?.addEventListener('change',event=>{settings[key]=!!event.target.checked;applySettings();});
  bindToggle('showPlayerInfoToggle','showPlayerInfo');bindToggle('showHudTipsToggle','showHudTips');bindToggle('videoShadowsToggle','shadows');bindToggle('videoVignetteToggle','vignette');bindToggle('masterMuteToggle','mute');
  $('#videoResolutionSelect')?.addEventListener('change',event=>{settings.resolution=RESOLUTIONS[event.target.value]===undefined?'auto':event.target.value;applySettings(true);});
  $('#videoQualitySelect')?.addEventListener('change',event=>{settings.quality=['low','medium','high'].includes(event.target.value)?event.target.value:'high';applySettings(true);});
  $('#resetSettingsBtn')?.addEventListener('click',()=>{Object.assign(settings,defaults);syncInputs();activateTab('general');applySettings(true);});
}

function applyRenderResolution(game){
  if(!game?.canvas||!game.ctx)return;
  const rect=game.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const preset=RESOLUTIONS[settings.resolution]||null;
  const resolutionScale=preset?Math.min(1,preset[0]/rect.width,preset[1]/rect.height):1;
  const qualityCap=settings.quality==='low'?1:settings.quality==='medium'?1.5:2;
  const ratio=Math.max(.5,Math.min(Number(global.devicePixelRatio)||1,qualityCap)*resolutionScale);
  const width=Math.max(1,Math.floor(rect.width*ratio)),height=Math.max(1,Math.floor(rect.height*ratio));
  if(game.canvas.width!==width)game.canvas.width=width;if(game.canvas.height!==height)game.canvas.height=height;
  game.ctx.setTransform(ratio,0,0,ratio,0,0);game.viewW=rect.width;game.viewH=rect.height;game.renderDprV8=ratio;
}

function hookGame(game){
  if(!game||game.settingsMenuV8Hooked)return;
  game.settingsMenuV8Hooked=true;
  const baseResize=game.resize?.bind(game);
  if(baseResize)game.resize=function(...args){const result=baseResize(...args);applyRenderResolution(this);return result;};
  const baseBeep=game.beep?.bind(game);
  if(baseBeep)game.beep=function(freq,duration=.04,gain=.02){if(settings.mute)return;const volume=(settings.masterVolume/100)*(settings.effectsVolume/100);if(volume<=0)return;return baseBeep(freq,duration,Math.max(.0001,Number(gain||.02)*volume));};
  const canvas=game.canvas;
  canvas?.addEventListener('mousemove',event=>{
    const sensitivity=clamp(settings.mouseSensitivity,50,150)/100;if(Math.abs(sensitivity-1)<.001)return;
    const rect=canvas.getBoundingClientRect(),rawX=event.clientX-rect.left,rawY=event.clientY-rect.top,cx=rect.width/2,cy=rect.height/2;
    game.mouse.x=clamp(cx+(rawX-cx)*sensitivity,0,rect.width);game.mouse.y=clamp(cy+(rawY-cy)*sensitivity,0,rect.height);
  });
  game.settingsV8=settings;
  hookShadows(game);
}
function hookShadows(game){
  if(game?.settingsMenuShadowHooked)return;
  if(typeof game?.drawRigidbodyShadow!=='function'){clearTimeout(shadowRetry);shadowRetry=setTimeout(()=>hookShadows(game),120);return;}
  game.settingsMenuShadowHooked=true;const original=game.drawRigidbodyShadow.bind(game);
  game.drawRigidbodyShadow=function(...args){if(settings.shadows===false||settings.quality==='low')return;return original(...args);};
}

function applyAudioElements(){
  const volume=settings.mute?0:(settings.masterVolume/100)*(settings.musicVolume/100);
  document.querySelectorAll('audio').forEach(audio=>{audio.volume=clamp(volume,0,1);audio.muted=!!settings.mute;});
}

function applySettings(resize=false){
  settings.mouseSensitivity=clamp(settings.mouseSensitivity,50,150);
  for(const key of ['masterVolume','effectsVolume','musicVolume'])settings[key]=clamp(settings[key],0,100);
  const body=document.body;
  body?.classList.toggle('hide-player-info',settings.showPlayerInfo===false);
  body?.classList.toggle('hide-hud-tips',settings.showHudTips===false);
  body?.classList.toggle('hide-vignette-v8',settings.vignette===false);
  body?.classList.toggle('video-shadows-off',settings.shadows===false||settings.quality==='low');
  if(body)body.dataset.videoQuality=settings.quality;
  const game=global.astraeon;if(game){game.settingsV8=settings;hookGame(game);if(resize)game.resize?.();else applyRenderResolution(game);}
  applyAudioElements();saveSettings();
}

function resetPosition(card=$('#settingsPanel .settings-card')){if(!card)return;card.style.translate='0px 0px';card.dataset.dragX='0';card.dataset.dragY='0';}
function openSettings(tab='general'){
  const markup=ensureMarkup();if(!markup)return false;
  resetPosition(markup.card);activateTab(tab);syncInputs();applySettings();markup.panel.classList.remove('hidden');return true;
}
function closeSettings(){const panel=$('#settingsPanel'),card=panel?.querySelector('.settings-card');panel?.classList.add('hidden');resetPosition(card);return true;}
function toggleSettings(tab='general'){const panel=$('#settingsPanel');if(!panel)return false;return panel.classList.contains('hidden')?openSettings(tab):closeSettings();}

function observePanel(panel,card){
  if(panel.dataset.settingsObserved==='true')return;panel.dataset.settingsObserved='true';
  let wasHidden=panel.classList.contains('hidden');
  new MutationObserver(()=>{const hidden=panel.classList.contains('hidden');if(hidden===wasHidden)return;wasHidden=hidden;if(hidden)resetPosition(card);else{resetPosition(card);activateTab('general');syncInputs();}}).observe(panel,{attributes:true,attributeFilter:['class']});
  panel.querySelector('.panelClose')?.addEventListener('click',()=>resetPosition(card));
}
function installDrag(panel,card,handle){
  if(!handle||handle.dataset.settingsDrag==='true')return;handle.dataset.settingsDrag='true';
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button,input,select'))return;
    const rect=card.getBoundingClientRect();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,baseX:Number(card.dataset.dragX)||0,baseY:Number(card.dataset.dragY)||0,width:rect.width,height:rect.height};
    handle.setPointerCapture?.(event.pointerId);card.classList.add('dragging');event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const limitX=Math.max(0,(innerWidth-drag.width)/2-8),limitY=Math.max(0,(innerHeight-drag.height)/2-8);const x=clamp(drag.baseX+event.clientX-drag.startX,-limitX,limitX),y=clamp(drag.baseY+event.clientY-drag.startY,-limitY,limitY);card.dataset.dragX=String(x);card.dataset.dragY=String(y);card.style.translate=`${Math.round(x)}px ${Math.round(y)}px`;});
  const end=event=>{if(!drag||drag.id!==event.pointerId)return;drag=null;card.classList.remove('dragging');};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
}

function install(){
  if(installed)return true;
  const game=global.astraeon;
  if(!game?.uiV30AInstalled||!$('#settingsPanel')){clearTimeout(retryTimer);retryTimer=setTimeout(install,RETRY_MS);return false;}
  const markup=ensureMarkup();if(!markup){retryTimer=setTimeout(install,RETRY_MS);return false;}
  installed=true;hookGame(game);applySettings(true);syncInputs();activateTab('general');
  syncAccountInfo();global.addEventListener('astraeon:online-auth-state',syncAccountInfo);
  const mediaObserver=new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('audio')||node.querySelector?.('audio')))))applyAudioElements();});mediaObserver.observe(document.body,{childList:true,subtree:true});
  global.addEventListener('resize',()=>{if(!markup.panel.classList.contains('hidden'))resetPosition(markup.card);applyRenderResolution(game);});
  return true;
}

global.AstraeonSettingsMenuV8={defaults,settings,install,open:openSettings,close:closeSettings,toggle:toggleSettings,apply:applySettings,resetPosition};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
