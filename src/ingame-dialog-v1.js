(function(global){
'use strict';

let queue=Promise.resolve();
let inventoryRetry=0;

const $=selector=>document.querySelector(selector);
function escapeText(value){return String(value??'');}

function ensureBox(){
  let root=$('#astraeonMessageBox');
  if(root)return root;
  root=document.createElement('section');
  root.id='astraeonMessageBox';
  root.className='astraeon-messagebox hidden';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.innerHTML='<div class="astraeon-messagebox-card"><span id="astraeonMessageBoxKicker">ASTRAEON</span><h3 id="astraeonMessageBoxTitle">Confirmar ação</h3><p id="astraeonMessageBoxText"></p><div id="astraeonMessageBoxInputHost"></div><div class="astraeon-messagebox-actions"><button id="astraeonMessageBoxCancel" type="button">Não</button><button id="astraeonMessageBoxConfirm" class="primary" type="button">Sim</button></div></div>';
  document.body.appendChild(root);
  return root;
}

function request(options={}){
  const task=()=>new Promise(resolve=>{
    const root=ensureBox();
    const title=$('#astraeonMessageBoxTitle'),text=$('#astraeonMessageBoxText'),kicker=$('#astraeonMessageBoxKicker'),host=$('#astraeonMessageBoxInputHost'),cancel=$('#astraeonMessageBoxCancel'),confirm=$('#astraeonMessageBoxConfirm');
    const mode=options.mode||'confirm';
    kicker.textContent=options.kicker||'ASTRAEON · CONFIRMAÇÃO';
    title.textContent=options.title||'Confirmar ação';
    text.textContent=escapeText(options.message||'Deseja continuar?');
    host.replaceChildren();
    cancel.textContent=options.cancelText||'Não';
    confirm.textContent=options.confirmText||(mode==='alert'?'OK':'Sim');
    confirm.classList.toggle('danger',!!options.danger);confirm.classList.toggle('primary',!options.danger);
    cancel.classList.toggle('hidden',mode==='alert');
    let input=null;
    if(mode==='prompt'){
      input=document.createElement('input');input.type=options.inputType||'text';input.value=String(options.defaultValue||'');input.placeholder=options.placeholder||'';input.maxLength=Math.max(1,Number(options.maxLength)||180);host.appendChild(input);
    }
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;root.classList.add('hidden');root.removeEventListener('keydown',onKey,true);cancel.onclick=null;confirm.onclick=null;resolve(value);};
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(mode==='prompt'?null:false);}
      if(event.key==='Enter'&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();finish(mode==='prompt'?(input?.value??''):true);}
    };
    cancel.onclick=()=>finish(mode==='prompt'?null:false);
    confirm.onclick=()=>finish(mode==='prompt'?(input?.value??''):true);
    root.addEventListener('keydown',onKey,true);
    root.classList.remove('hidden');
    requestAnimationFrame(()=>{(input||confirm)?.focus?.({preventScroll:true});});
  });
  const result=queue.then(task,task);queue=result.catch(()=>{});return result;
}

function confirm(options){return request({...options,mode:'confirm'});}
function alert(options){return request({...options,mode:'alert'});}
function prompt(options){return request({...options,mode:'prompt'});}

function sameRef(a,b){return !!a&&!!b&&a.source===b.source&&String(a.index??a.slot)===String(b.index??b.slot);}
function installInventoryDiscard(){
  const game=global.astraeon;
  if(!game||typeof game.discardInventoryRef!=='function'){
    clearTimeout(inventoryRetry);inventoryRetry=setTimeout(installInventoryDiscard,100);return false;
  }
  if(game.ingameDiscardDialogV1Installed)return true;
  game.ingameDiscardDialogV1Installed=true;
  game.discardInventoryRef=async function(ref){
    if(!ref)return false;
    let item=null;
    if(ref.source==='inventory')item=this.inventory?.[Number(ref.index)]||null;
    if(ref.source==='equipment')item=this.equipment?.[ref.slot]||null;
    if(!item){this.toast?.('O item não está mais disponível.');return false;}
    const qty=Number(item.qty)>1?` x${Math.round(Number(item.qty))}`:'';
    const accepted=await confirm({
      kicker:'MOCHILA · AÇÃO IRREVERSÍVEL',
      title:'Descartar item?',
      message:`Descartar ${item.name}${qty}?\n\nEsta ação não pode ser desfeita.`,
      confirmText:'Sim, descartar',cancelText:'Não',danger:true
    });
    if(!accepted)return false;
    if(ref.source==='inventory')this.inventory.splice(Number(ref.index),1);
    else{this.equipment[ref.slot]=null;this.recalculateEquipmentStats?.();}
    if(sameRef(this.selectedInventoryRef,ref))this.selectedInventoryRef=null;
    $('#inventoryItemTooltip')?.classList.add('hidden');
    this.renderInventory?.();this.save?.();this.toast?.(`${item.name} foi descartado.`);this.beep?.(96,.055,.018);
    return true;
  };
  return true;
}

function install(){ensureBox();installInventoryDiscard();}
global.AstraeonMessageBoxV1={request,confirm,alert,prompt,install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
