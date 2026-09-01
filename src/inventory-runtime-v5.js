(function (global) {
  'use strict';
  const state = { installed: false, authoritative: false, inventoryById: new Map(), equipment: {}, revision: 0 };
  const authority = () => global.AstraeonAuthorityV1;
  const game = () => global.astraeon;
  function normalizeServerItem(row) {
    if (!row) return null;
    const config = row.config || {};
    return { id: config.item_id || row.item_id, inventoryId: row.id, name: config.name || row.item_id || 'Item', type: config.item_type || 'material', slot: config.slot || null, rarity: config.rarity || 'common', allowedClasses: config.allowed_classes || [], description: config.description || '', icon: config.icon || '◇', imageUrl: config.image_url || '', stats: { ...(config.stats || {}) }, qty: Number(row.quantity) || 1, metadata: row.metadata || {}, authoritative: true };
  }
  function applySnapshot(snapshot) {
    const g = game(); if (!g || !snapshot?.inventory) return false;
    const items = (snapshot.inventory.items || []).map(normalizeServerItem).filter(Boolean);
    state.inventoryById = new Map(items.map(item => [item.inventoryId, item])); state.equipment = { ...(snapshot.inventory.equipment || {}) }; state.revision = Number(snapshot.inventory.revision || state.revision + 1); state.authoritative = true;
    g.inventory = items.filter(item => !Object.values(state.equipment).includes(item.inventoryId)); g.equipment = g.equipment || {};
    Object.keys(g.equipment).forEach(slot => { g.equipment[slot] = null; }); Object.entries(state.equipment).forEach(([slot, inventoryId]) => { g.equipment[slot] = state.inventoryById.get(inventoryId) || null; });
    g.gold = Number(snapshot.progress?.gold ?? g.gold ?? 0); g.renderInventory?.(); global.AstraeonEventBusV1?.emit?.('inventory:server-snapshot', { snapshot, revision: state.revision }); return true;
  }
  async function intent(kind, payload) { const client = authority(); if (!client?.isActive?.()) return null; const result = await client.intent(kind, payload); if (result?.snapshot) applySnapshot(result.snapshot); return result; }
  async function equip(ref, slot) { if (authority()?.isActive?.()) { const inventoryId = typeof ref === 'string' ? ref : ref?.inventoryId; if (!inventoryId) throw new Error('inventory_id_required'); return intent('inventory_equip', { inventoryId, slot }); } const g=game(),index=typeof ref==='number'?ref:g?.inventory?.findIndex?.(item=>item?.inventoryId===ref?.inventoryId); return g?.equipItem?.(index,slot); }
  async function unequip(slot) { if (authority()?.isActive?.()) return intent('inventory_unequip',{slot}); return game()?.unequipItem?.(slot); }
  async function use(ref) { if (authority()?.isActive?.()) { const inventoryId=typeof ref==='string'?ref:ref?.inventoryId; return intent('inventory_use',{inventoryId}); } const g=game(),index=typeof ref==='number'?ref:g?.inventory?.findIndex?.(item=>item===ref||item?.inventoryId===ref?.inventoryId); return g?.useInventoryItem?.(index); }
  async function discard(ref,quantity=1) { if(authority()?.isActive?.()){const inventoryId=typeof ref==='string'?ref:ref?.inventoryId;return intent('inventory_discard',{inventoryId,quantity});}return game()?.discardInventoryRef?.(ref); }
  async function reorder(ref,toIndex){if(authority()?.isActive?.()){const inventoryId=typeof ref==='string'?ref:ref?.inventoryId;return intent('inventory_reorder',{inventoryId,toIndex});}return game()?.reorderInventoryItem?.(ref?.index??ref,toIndex);}
  function install(){
    if(state.installed)return;const g=game();if(!g){setTimeout(install,60);return;}state.installed=true;g.inventoryRuntimeVersion='5.0.0';
    const itemsApi=global.AstraeonItems;if(itemsApi?.normalizeLegacyItem&&!itemsApi.authorityV5NormalizeInstalled){itemsApi.authorityV5NormalizeInstalled=true;const normalizeLegacy=itemsApi.normalizeLegacyItem.bind(itemsApi);itemsApi.normalizeLegacyItem=raw=>raw?.authoritative===true?raw:normalizeLegacy(raw);}
    const legacy={equipItem:typeof g.equipItem==='function'?g.equipItem.bind(g):null,unequipItem:typeof g.unequipItem==='function'?g.unequipItem.bind(g):null,useInventoryItem:typeof g.useInventoryItem==='function'?g.useInventoryItem.bind(g):null,discardInventoryRef:typeof g.discardInventoryRef==='function'?g.discardInventoryRef.bind(g):null,reorderInventoryItem:typeof g.reorderInventoryItem==='function'?g.reorderInventoryItem.bind(g):null};
    const report=error=>{console.warn('[Astraeon Inventory V5]',error);g.toast?.(`Inventário: ${String(error?.message||error).replaceAll('_',' ')}`);};
    g.equipItem=function(index,slot){if(!authority()?.isActive?.())return legacy.equipItem?.(index,slot);const item=this.inventory?.[Number(index)];if(!item?.inventoryId)return false;void equip(item,slot||item.slot).catch(report);return true;};
    g.unequipItem=function(slot){if(!authority()?.isActive?.())return legacy.unequipItem?.(slot);void unequip(slot).catch(report);return true;};
    g.useInventoryItem=function(index){if(!authority()?.isActive?.())return legacy.useInventoryItem?.(index);const item=this.inventory?.[Number(index)];if(!item?.inventoryId)return false;void use(item).catch(report);return true;};
    g.discardInventoryRef=function(ref){if(!authority()?.isActive?.())return legacy.discardInventoryRef?.(ref);const item=ref?.source==='equipment'?this.equipment?.[ref.slot]:this.inventory?.[Number(ref?.index)];if(!item?.inventoryId)return false;if(!global.confirm?.(`Descartar ${item.name}?\n\nEsta ação não pode ser desfeita.`))return false;void discard(item,Number(item.qty)||1).catch(report);return true;};
    g.reorderInventoryItem=function(fromIndex,toIndex){if(!authority()?.isActive?.())return legacy.reorderInventoryItem?.(fromIndex,toIndex);const item=this.inventory?.[Number(fromIndex)];if(!item?.inventoryId)return false;void reorder(item,toIndex).catch(report);return true;};
    global.AstraeonEventBusV1?.on?.('authority:snapshot',({snapshot})=>applySnapshot(snapshot));global.AstraeonInventoryRuntimeV5={state,applySnapshot,equip,unequip,use,discard,reorder,normalizeServerItem,legacy};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
