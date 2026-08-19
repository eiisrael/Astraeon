(function () {
  'use strict';

  const W = window.AstraeonWorld;
  const ALL_CLASSES = ['Warrior','Mage','Archer','Assassin','Paladine'];
  const CLASS_INFO = {
    Warrior: { label:'Guerreiro', color:'#d36b45', accent:'#f4b06b', rune:'W' },
    Mage: { label:'Mago', color:'#5e7fc9', accent:'#9bc8ff', rune:'M' },
    Archer: { label:'Arqueiro', color:'#5d8d52', accent:'#a7e487', rune:'A' },
    Assassin: { label:'Assassino', color:'#72518f', accent:'#d3a0ff', rune:'S' },
    Paladine: { label:'Paladino', color:'#b78b3f', accent:'#ffe094', rune:'P' }
  };
  const CLASS_STARTERS = {
    Warrior:['warrior_blade','bastion_plate'],
    Mage:['mage_staff','arcanist_robe'],
    Archer:['archer_bow','ranger_vest'],
    Assassin:['assassin_blades','void_armor'],
    Paladine:['paladine_mace','solar_plate']
  };
  const CLASS_POOLS = {
    Warrior:['warrior_blade','bastion_helm','bastion_plate','bastion_gauntlets','bastion_boots','rune_blade'],
    Mage:['mage_staff','arcanist_circlet','arcanist_robe','arcanist_gloves','arcanist_steps','frost_crown','lumen_hood'],
    Archer:['archer_bow','ranger_hood','ranger_vest','ranger_bracers','ranger_boots','hunter_boots','lumen_hood'],
    Assassin:['assassin_blades','void_mask','void_armor','void_grips','void_steps','void_gloves','hunter_boots','rune_blade'],
    Paladine:['paladine_mace','solar_crown','solar_plate','solar_gauntlets','solar_greaves','astrium_armor','solar_boots','frost_crown']
  };
  const BIOME_EXTRAS = {
    forest:['ether_ring','climate_talisman','red_potion','astral_fragment'],
    steppe:['solar_boots','astrium_armor','red_potion','core_fragment'],
    frost:['frost_crown','climate_talisman','blue_potion','core_fragment'],
    swamp:['umbria_ring','void_gloves','blue_potion','astral_fragment'],
    highland:['convergence_amulet','rune_blade','core_fragment','astral_core']
  };

  function svgData(svg) {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
  }

  function artFor(item) {
    const cls = item.allowedClasses?.length === 1 ? item.allowedClasses[0] : null;
    const c = CLASS_INFO[cls] || { color:'#655846', accent:'#e1c887', rune:'✦' };
    const rarity = item.rarity || 'common';
    const glow = {common:'#a6a39b',uncommon:'#79c58f',rare:'#6ea7ee',epic:'#bd78ee',legendary:'#f2bf55'}[rarity] || '#a6a39b';
    const slot = item.slot || item.type;
    let shape = '';
    if (slot === 'weapon') {
      shape = `<path d="M31 8l7 7-5 5 13 13-5 5-13-13-5 5-7-7 5-5-7-7 4-4 7 7 6-6z" fill="${c.accent}" stroke="#19130e" stroke-width="2"/><path d="M13 45l8-8 6 6-8 8H9v-10z" fill="${c.color}" stroke="#19130e" stroke-width="2"/>`;
    } else if (slot === 'head') {
      shape = `<path d="M14 29c0-12 7-20 18-20s18 8 18 20v13H14V29z" fill="${c.color}" stroke="${c.accent}" stroke-width="2"/><path d="M20 29h24M26 15l6-6 6 6" stroke="${c.accent}" stroke-width="3" fill="none"/>`;
    } else if (slot === 'chest') {
      shape = `<path d="M20 10l12 6 12-6 9 10-7 10v22H18V30l-7-10 9-10z" fill="${c.color}" stroke="${c.accent}" stroke-width="2"/><path d="M32 16v34M22 26h20" stroke="${c.accent}" stroke-width="2" opacity=".72"/>`;
    } else if (slot === 'hands') {
      shape = `<path d="M12 19l9-5 7 9-3 24-11-2-4-17 2-9zm40 0l-9-5-7 9 3 24 11-2 4-17-2-9z" fill="${c.color}" stroke="${c.accent}" stroke-width="2"/>`;
    } else if (slot === 'boots') {
      shape = `<path d="M17 12h13v26l-8 12H8v-9l9-7V12zm30 0H34v26l8 12h14v-9l-9-7V12z" fill="${c.color}" stroke="${c.accent}" stroke-width="2"/>`;
    } else if (slot === 'ring') {
      shape = `<circle cx="32" cy="34" r="15" fill="none" stroke="${c.accent}" stroke-width="7"/><path d="M24 19l8-10 8 10-8 7z" fill="${glow}" stroke="#25180c" stroke-width="2"/>`;
    } else if (slot === 'amulet') {
      shape = `<path d="M15 10c3 14 8 22 17 27 9-5 14-13 17-27" fill="none" stroke="${c.accent}" stroke-width="3"/><path d="M32 27l10 9-10 17-10-17 10-9z" fill="${c.color}" stroke="${glow}" stroke-width="2"/>`;
    } else if (slot === 'relic') {
      shape = `<path d="M32 7l8 15 17 10-17 10-8 15-8-15L7 32l17-10 8-15z" fill="${c.color}" stroke="${glow}" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="${c.accent}"/>`;
    } else if (item.type === 'consumable') {
      shape = `<path d="M24 8h16v8l5 6v25c0 6-5 9-13 9s-13-3-13-9V22l5-6V8z" fill="${item.mana?'#315f9f':'#8e2f35'}" stroke="${glow}" stroke-width="2"/><path d="M22 33h20" stroke="#fff" stroke-width="3" opacity=".55"/>`;
    } else {
      shape = `<path d="M32 7l20 16-8 27H20l-8-27L32 7z" fill="${c.color}" stroke="${glow}" stroke-width="2"/><path d="M22 26l10-8 10 8-10 17-10-17z" fill="${c.accent}" opacity=".78"/>`;
    }
    const rune = (cls ? CLASS_INFO[cls].rune : '✦');
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="bg"><stop stop-color="${glow}" stop-opacity=".24"/><stop offset="1" stop-color="#090806" stop-opacity=".02"/></radialGradient><filter id="g"><feGaussianBlur stdDeviation="2.2"/></filter></defs><rect width="64" height="64" rx="12" fill="url(#bg)"/><circle cx="32" cy="32" r="25" fill="none" stroke="${glow}" stroke-opacity=".18"/><circle cx="32" cy="32" r="20" fill="${glow}" opacity=".07" filter="url(#g)"/>${shape}<text x="51" y="56" font-family="serif" font-size="10" font-weight="700" fill="${glow}" text-anchor="middle">${rune}</text></svg>`);
  }

  function itemIconMarkup(item) {
    return `<img class="item-art-img" src="${artFor(item)}" alt="">`;
  }

  function addClassItems(items) {
    const additions = {
      bastion_helm:{id:'bastion_helm',name:'Elmo do Bastião',type:'equipment',slot:'head',rarity:'uncommon',allowedClasses:['Warrior'],description:'Elmo pesado gravado com juramentos de linha de frente.',stats:{defense:3,maxHp:12}},
      bastion_plate:{id:'bastion_plate',name:'Couraça do Bastião',type:'equipment',slot:'chest',rarity:'common',allowedClasses:['Warrior'],description:'Placas densas feitas para permanecer de pé sob impacto.',stats:{defense:4,maxHp:22}},
      bastion_gauntlets:{id:'bastion_gauntlets',name:'Manoplas Quebra-Runa',type:'equipment',slot:'hands',rarity:'rare',allowedClasses:['Warrior'],description:'Manoplas que convertem impacto em força ofensiva.',stats:{power:3,defense:2}},
      bastion_boots:{id:'bastion_boots',name:'Grevas da Vanguarda',type:'equipment',slot:'boots',rarity:'rare',allowedClasses:['Warrior'],description:'Grevas de marcha para avançar sem ceder terreno.',stats:{speed:7,defense:3,maxHp:10}},
      arcanist_circlet:{id:'arcanist_circlet',name:'Círculo do Arcanista',type:'equipment',slot:'head',rarity:'rare',allowedClasses:['Mage'],description:'Aro de cristal que estabiliza pensamentos arcanos.',stats:{maxMana:22,power:2}},
      arcanist_robe:{id:'arcanist_robe',name:'Veste da Maré Astral',type:'equipment',slot:'chest',rarity:'common',allowedClasses:['Mage'],description:'Tecido encantado que amplia reservas de mana.',stats:{maxMana:18,defense:1}},
      arcanist_gloves:{id:'arcanist_gloves',name:'Luvas de Conjuração',type:'equipment',slot:'hands',rarity:'rare',allowedClasses:['Mage'],description:'Fios de éter aceleram a condução de magia.',stats:{power:3,maxMana:10}},
      arcanist_steps:{id:'arcanist_steps',name:'Passos da Miragem',type:'equipment',slot:'boots',rarity:'epic',allowedClasses:['Mage'],description:'Botas leves usadas por conjuradores de dobra espacial.',stats:{speed:10,maxMana:12}},
      ranger_hood:{id:'ranger_hood',name:'Capuz do Olho Verde',type:'equipment',slot:'head',rarity:'uncommon',allowedClasses:['Archer'],description:'Capuz de caçador que mantém a visão limpa sob chuva e neve.',stats:{range:12,defense:1}},
      ranger_vest:{id:'ranger_vest',name:'Colete da Fronteira',type:'equipment',slot:'chest',rarity:'common',allowedClasses:['Archer'],description:'Couro leve reforçado para patrulhas longas.',stats:{defense:2,maxHp:10}},
      ranger_bracers:{id:'ranger_bracers',name:'Braçadeiras do Falcão',type:'equipment',slot:'hands',rarity:'rare',allowedClasses:['Archer'],description:'Braçadeiras que estabilizam disparos em movimento.',stats:{power:2,range:16,crit:.012}},
      ranger_boots:{id:'ranger_boots',name:'Botas do Passo Silencioso',type:'equipment',slot:'boots',rarity:'rare',allowedClasses:['Archer'],description:'Solado discreto para reposicionamento rápido.',stats:{speed:13,crit:.012}},
      void_mask:{id:'void_mask',name:'Máscara do Vazio',type:'equipment',slot:'head',rarity:'rare',allowedClasses:['Assassin'],description:'Máscara escura que apaga reflexos e hesitação.',stats:{crit:.022,power:2}},
      void_armor:{id:'void_armor',name:'Armadura das Sombras',type:'equipment',slot:'chest',rarity:'common',allowedClasses:['Assassin'],description:'Camadas flexíveis que protegem sem comprometer velocidade.',stats:{defense:2,speed:5}},
      void_grips:{id:'void_grips',name:'Punhos da Execução',type:'equipment',slot:'hands',rarity:'epic',allowedClasses:['Assassin'],description:'Lâminas ocultas e couro encantado para golpes fatais.',stats:{power:4,crit:.028}},
      void_steps:{id:'void_steps',name:'Passos Sem Eco',type:'equipment',slot:'boots',rarity:'rare',allowedClasses:['Assassin'],description:'Botas leves para atravessar a linha inimiga.',stats:{speed:16,crit:.012}},
      solar_crown:{id:'solar_crown',name:'Coroa do Juramento Solar',type:'equipment',slot:'head',rarity:'rare',allowedClasses:['Paladine'],description:'Símbolo de proteção usado pelos juramentados de Solvar.',stats:{defense:3,maxMana:10}},
      solar_plate:{id:'solar_plate',name:'Armadura da Aurora',type:'equipment',slot:'chest',rarity:'common',allowedClasses:['Paladine'],description:'Placas douradas que equilibram defesa e energia sagrada.',stats:{defense:4,maxHp:16,maxMana:8}},
      solar_gauntlets:{id:'solar_gauntlets',name:'Manoplas da Consagração',type:'equipment',slot:'hands',rarity:'rare',allowedClasses:['Paladine'],description:'Manoplas que fortalecem golpes e ritos de proteção.',stats:{power:2,defense:3}},
      solar_greaves:{id:'solar_greaves',name:'Grevas do Peregrino Solar',type:'equipment',slot:'boots',rarity:'rare',allowedClasses:['Paladine'],description:'Grevas equilibradas para cruzadas longas.',stats:{speed:8,defense:2,maxHp:12}}
    };
    Object.assign(items, additions);
  }

  function applyRestrictions(items) {
    const one = (id, classes) => { if (items[id]) items[id].allowedClasses = classes; };
    one('warrior_blade',['Warrior']); one('mage_staff',['Mage']); one('archer_bow',['Archer']); one('assassin_blades',['Assassin']); one('paladine_mace',['Paladine']);
    one('rune_blade',['Warrior','Assassin']); one('lumen_hood',['Mage','Archer']); one('frost_crown',['Mage','Paladine']);
    one('wanderer_cloak',ALL_CLASSES); one('astrium_armor',['Warrior','Paladine']); one('void_gloves',['Assassin','Archer']);
    one('hunter_boots',['Archer','Assassin']); one('solar_boots',['Warrior','Paladine']); one('ether_ring',ALL_CLASSES);
    one('umbria_ring',ALL_CLASSES); one('climate_talisman',ALL_CLASSES); one('convergence_amulet',ALL_CLASSES); one('astral_core',ALL_CLASSES);
  }

  function install() {
    const game = window.astraeon;
    const A = window.AstraeonItems;
    if (!game || !A || game.inventoryV30AInstalled) return;
    game.inventoryV30AInstalled = true;

    const items = A.items;
    addClassItems(items);
    applyRestrictions(items);

    Object.values(items).forEach(item => { item.icon = itemIconMarkup(item); });

    const originalEquipItem = game.equipItem.bind(game);
    const originalRenderInventory = game.renderInventory.bind(game);
    const originalRenderItemDetails = game.renderItemDetails.bind(game);
    const originalRollLoot = game.rollLoot.bind(game);
    const originalStartNew = game.startNew.bind(game);
    const originalContinue = game.continueGame.bind(game);

    game.canEquipClass = function (item) {
      if (!item || item.type !== 'equipment') return false;
      const allowed = item.allowedClasses;
      return !allowed || !allowed.length || allowed.includes(this.player?.classId);
    };

    game.classRequirementText = function (item) {
      if (!item?.allowedClasses?.length) return 'Todas as classes';
      return item.allowedClasses.map(c => CLASS_INFO[c]?.label || c).join(' · ');
    };

    game.equipItem = function (index, forcedSlot) {
      const item = this.inventory?.[index];
      if (item?.type === 'equipment' && !this.canEquipClass(item)) {
        this.toast(`${item.name} não pode ser equipado por ${CLASS_INFO[this.player?.classId]?.label || 'esta classe'}.`);
        this.beep?.(120,.05,.018);
        return false;
      }
      return originalEquipItem(index, forcedSlot);
    };

    game.starterInventory = function (classId) {
      const ids = CLASS_STARTERS[classId] || CLASS_STARTERS.Warrior;
      return [A.cloneItem(ids[0]), A.cloneItem(ids[1]), A.cloneItem('red_potion',{qty:3}), A.cloneItem('astral_fragment',{qty:2})];
    };

    game.rollLoot = function (mob) {
      const classId = this.player?.classId || 'Warrior';
      const classPool = CLASS_POOLS[classId] || [];
      const biomePool = BIOME_EXTRAS[mob?.biome] || [];
      const universal = ['ether_ring','climate_talisman','convergence_amulet','red_potion','blue_potion','astral_fragment','core_fragment'];
      const sourcePool = Math.random() < .68 ? classPool : (Math.random() < .7 ? biomePool : universal);
      const id = sourcePool[Math.floor(Math.random() * Math.max(1,sourcePool.length))];
      const source = items[id];
      if (!source) return originalRollLoot(mob);
      if (source.type !== 'equipment') return A.cloneItem(id,{qty:1});
      const r = Math.random();
      const rarity = r > .992 ? 'legendary' : r > .94 ? 'epic' : r > .76 ? 'rare' : r > .35 ? 'uncommon' : source.rarity || 'common';
      const mult = A.rarity[rarity]?.mult || 1;
      const levelScale = 1 + Math.max(0,(this.player?.level||1)-1) * .075;
      const stats = {};
      Object.entries(source.stats || {}).forEach(([k,v]) => {
        const n = Number(v) || 0;
        stats[k] = k === 'crit' ? +(n * mult).toFixed(3) : Math.max(1,Math.round(n * mult * levelScale));
      });
      return A.cloneItem(id,{
        rarity, stats, level:this.player?.level || 1,
        uid:`${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`
      });
    };

    game.renderItemDetails = function (root) {
      originalRenderItemDetails(root);
      if (!root) return;
      const item = this.getSelectedItem?.();
      if (!item) return;
      const actions = root.querySelector('.detail-actions');
      if (!actions || root.querySelector('.class-requirement')) return;
      const compatible = item.type !== 'equipment' || this.canEquipClass(item);
      const req = document.createElement('div');
      req.className = `class-requirement ${compatible ? 'compatible' : 'blocked'}`;
      req.innerHTML = `<span>${compatible ? '✓' : '×'}</span><div><b>${compatible ? 'Compatível' : 'Classe incompatível'}</b><small>${this.classRequirementText(item)}</small></div>`;
      actions.before(req);
      if (!compatible) {
        const primary = root.querySelector('#detailPrimaryAction');
        if (primary && this.selectedInventoryRef?.source === 'inventory') {
          primary.disabled = true;
          primary.textContent = 'Classe incompatível';
        }
      }
    };

    game.renderInventory = function () {
      originalRenderInventory();
      if (!this.player) return;
      document.querySelectorAll('#inventoryGrid .item-card-slot[data-index]').forEach(el => {
        const item = this.inventory?.[Number(el.dataset.index)];
        const locked = item?.type === 'equipment' && !this.canEquipClass(item);
        el.classList.toggle('class-locked', !!locked);
        if (locked) el.setAttribute('aria-label', `${item.name} — incompatível com sua classe`);
      });
      document.querySelectorAll('#equipmentGrid .equipment-slot').forEach(el => {
        const slot = el.dataset.slot;
        const item = this.equipment?.[slot];
        if (item && !this.canEquipClass(item)) el.classList.add('class-locked');
      });
      const portrait = document.querySelector('.equipment-portrait');
      const cls = W.CLASS_DATA?.[this.player.classId];
      if (portrait && cls) {
        portrait.style.setProperty('--portrait', `url("Assets/Classes/${cls.sprite}")`);
        portrait.dataset.class = this.player.classId;
        portrait.innerHTML = `<span>${CLASS_INFO[this.player.classId]?.label || cls.name}</span><small>${this.player.name} · Nv. ${this.player.level}</small>`;
      }
      const meta = document.querySelector('#inventoryMeta');
      if (meta) meta.innerHTML = `<span>${CLASS_INFO[this.player.classId]?.label || this.player.classId}</span><b>${this.inventory.length} itens</b><b>${this.gold} ouro</b>`;
    };

    function refreshSavedIcons(gameInstance) {
      (gameInstance.inventory || []).forEach(item => {
        const source = items[item?.id];
        if (source) {
          item.icon = source.icon;
          item.allowedClasses = source.allowedClasses;
          item.description = source.description;
        }
      });
      Object.values(gameInstance.equipment || {}).forEach(item => {
        const source = items[item?.id];
        if (item && source) {
          item.icon = source.icon;
          item.allowedClasses = source.allowedClasses;
          item.description = source.description;
        }
      });
    }

    game.startNew = function () {
      originalStartNew();
      refreshSavedIcons(this);
      this.renderInventory();
      this.save();
    };
    game.continueGame = function () {
      originalContinue();
      refreshSavedIcons(this);
      this.renderInventory();
    };

    refreshSavedIcons(game);
    game.renderInventory?.();

    window.AstraeonItemsV3 = { CLASS_INFO, CLASS_POOLS, artFor, canEquip:(item,classId)=>!item?.allowedClasses?.length||item.allowedClasses.includes(classId) };
  }

  window.addEventListener('DOMContentLoaded', install);
})();