(function(global){
'use strict';
let installed=false;
const $=s=>document.querySelector(s);
const ACCESS_OPTIONS=[[0,'Banido'],[1,'Jogador'],[2,'Em análise'],[3,'Admin']];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function fetchProfiles(){
  const client=global.AstraeonAdminAuth?.client;
  if(!client)throw new Error('admin_client_unavailable');
  const {data,error}=await client.rpc('admin_list_profiles');
  if(error)throw error;
  return Array.isArray(data)?data:[];
}
async function setAccess(userId,access){
  const client=global.AstraeonAdminAuth?.client;
  const {data,error}=await client.rpc('admin_set_access',{target_user:userId,target_access:Number(access)});
  if(error)throw error;
  return Number(data);
}
function accessSelect(row){return `<select class="admin-access-select" data-user-access="${esc(row.id)}">${ACCESS_OPTIONS.map(([value,label])=>`<option value="${value}" ${Number(row.access)===value?'selected':''}>${value} · ${label}</option>`).join('')}</select>`;}
function rowHtml(row){const access=Number(row.access??1);return `<tr data-account-row data-search="${esc(`${row.username||''} ${row.display_name||''} ${row.email||''}`.toLowerCase())}"><td><b>${esc(row.username||'—')}</b><br><small>${esc(row.display_name||'')}</small></td><td>${esc(row.email||'—')}</td><td>${esc(row.class_id||'—')} · Nv.${Number(row.level)||1}</td><td><span class="admin-account-badge a${access}">Acesso ${access}</span></td><td>${accessSelect(row)}</td><td>${row.last_seen?new Date(row.last_seen).toLocaleString('pt-BR'):'—'}</td><td><button class="admin-account-save" data-save-access="${esc(row.id)}">Salvar</button></td></tr>`;}
function pageHtml(rows){return `<div class="admin-page active admin-accounts-page"><div class="admin-page-head"><div><h3>Contas & Acesso</h3><p>Gerencie níveis protegidos do Supabase. Novas contas começam em Acesso 1.</p></div><span class="admin-badge">${rows.length} contas</span></div><div class="admin-accounts-toolbar"><input id="adminAccountSearch" class="admin-accounts-search" type="search" placeholder="Buscar username, nome ou e-mail…"><button id="adminAccountsRefresh" class="admin-btn">Atualizar</button></div><div class="admin-accounts-table-wrap"><table class="admin-accounts-table"><thead><tr><th>Jogador</th><th>E-mail</th><th>Personagem</th><th>Atual</th><th>Novo acesso</th><th>Último acesso</th><th>Ação</th></tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody></table></div><p id="adminAccountsMessage" class="admin-note">0 Banido · 1 Jogador · 2 Em análise · 3 Admin. O banco impede que jogadores promovam a própria conta.</p></div>`;}
async function renderAccounts(){
  const content=$('#adminContent');if(!content)return;
  content.innerHTML='<div class="admin-page active"><div class="admin-page-head"><div><h3>Contas & Acesso</h3><p>Carregando perfis protegidos…</p></div></div></div>';
  try{
    const rows=await fetchProfiles();
    content.innerHTML=pageHtml(rows);
    bindPage();
  }catch(error){
    console.error('[Astraeon Admin Accounts]',error);
    content.innerHTML='<div class="admin-page active"><div class="admin-card admin-warning"><h4>Acesso ao banco recusado</h4><p class="admin-note">Execute a migration 002 e confirme que esta conta possui Acesso 3.</p></div></div>';
  }
}
function bindPage(){
  const search=$('#adminAccountSearch');
  search?.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();document.querySelectorAll('[data-account-row]').forEach(row=>{row.hidden=!!q&&!String(row.dataset.search||'').includes(q);});});
  $('#adminAccountsRefresh')?.addEventListener('click',renderAccounts);
  document.querySelectorAll('[data-save-access]').forEach(button=>button.addEventListener('click',async()=>{
    const id=button.dataset.saveAccess,select=document.querySelector(`[data-user-access="${CSS.escape(id)}"]`),message=$('#adminAccountsMessage');
    if(!select)return;
    button.disabled=true;button.textContent='Salvando…';
    try{const value=await setAccess(id,select.value);if(message){message.textContent=`Acesso atualizado para ${value} · ${ACCESS_OPTIONS.find(([v])=>v===value)?.[1]||'—'}.`;message.style.color='#9fe3b2';}await renderAccounts();}
    catch(error){console.error('[Astraeon Admin Accounts] set access',error);if(message){message.textContent=error.message?.includes('cannot_remove_own_admin_access')?'Por segurança, você não pode remover o próprio Acesso 3 pelo painel.':'Não foi possível alterar o acesso. Verifique sua permissão administrativa.';message.style.color='#f0a1a1';}button.disabled=false;button.textContent='Salvar';}
  }));
}
function install(){
  if(installed)return;
  const panel=$('#adminPanel'),tabs=panel?.querySelector('.admin-tabs');
  if(!panel||!tabs||!global.AstraeonAdminAuth?.access){setTimeout(install,100);return;}
  if(Number(global.AstraeonAdminAuth.access)!==3)return;
  installed=true;
  const button=document.createElement('button');button.className='admin-tab';button.dataset.adminAccounts='1';button.textContent='Contas & Acesso';
  button.addEventListener('click',()=>{panel.querySelectorAll('.admin-tab').forEach(tab=>tab.classList.toggle('active',tab===button));void renderAccounts();});
  tabs.appendChild(button);
}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',install);else install();
})(window);
