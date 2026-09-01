(function (global) {
  'use strict';

  const M = global.AstraeonCharacteristicsModelV1;
  const W = global.AstraeonWorld;
  if (!M || !W) throw new Error('Dependências do painel de características não carregadas.');

  const $ = selector => document.querySelector(selector);
  const CLASS_LABELS = { Warrior: 'Guerreiro', Mage: 'Mago', Archer: 'Arqueiro', Assassin: 'Assassino', Paladine: 'Paladino' };
  const ATTRIBUTE_META = Object.freeze({
    damage: { icon: '⚔', name: 'Dano', subtitle: 'Força ofensiva', description: 'Amplia ataques básicos e habilidades.', next: '+1 de poder por ponto' },
    intelligence: { icon: '✦', name: 'Inteligência', subtitle: 'Reserva arcana', description: 'Expande a mana disponível para habilidades.', next: '+3 de mana por ponto' },
    dexterity: { icon: '➶', name: 'Destreza', subtitle: 'Agilidade e precisão', description: 'Aumenta velocidade e chance de crítico.', next: '+0,8 velocidade · +0,1% crítico' },
    constitution: { icon: '◆', name: 'Constituição', subtitle: 'Resistência vital', description: 'Fortalece a vida máxima e a defesa.', next: '+3 de vida · +0,25 defesa' }
  });
  const state = { installed: false, draft: null, committed: null, serverSyncedCharacterId: null, syncing: false, authorityUnavailableUntil: 0 };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function sameAttributes(a, b) { return M.KEYS.every(key => Number(a?.[key]) === Number(b?.[key])); }
  function readSave() { try { return JSON.parse(localStorage.getItem(W.STORAGE_SAVE) || 'null'); } catch (_) { return null; } }
  function game() { return global.astraeon; }
  function onlineContext() {
    return {
      id: global.AstraeonCharactersV6?.activeCharacterId || null,
      client: global.AstraeonMultiplayerV4?.state?.client || null
    };
  }

  function equipmentBonuses(instance) {
    if (typeof instance?.getEquipmentBonuses === 'function') return instance.getEquipmentBonuses();
    return { maxHp: 0, maxMana: 0, power: 0, defense: 0, speed: 0, range: 0, crit: 0 };
  }

  function normalizeForLevel(attributes, currentLevel) {
    return M.normalizeAttributes(attributes, M.earnedPoints(currentLevel));
  }

  function attributesFromProgress(row, level) {
    return normalizeForLevel({
      damage: row?.attribute_damage ?? row?.damage ?? 0,
      intelligence: row?.attribute_intelligence ?? row?.intelligence ?? 0,
      dexterity: row?.attribute_dexterity ?? row?.dexterity ?? 0,
      constitution: row?.attribute_constitution ?? row?.constitution ?? 0
    }, row?.level || level || 1);
  }

  function authorityUnavailable(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || error || '').toLowerCase();
    return code === 'PGRST202' || code === '42883' ||
      (message.includes('set_astraeon_characteristics') && (message.includes('schema cache') || message.includes('does not exist'))) ||
      (message.includes('attribute_damage') && (message.includes('does not exist') || message.includes('column')));
  }

  function cancelPendingCharacterSave(characterId) {
    const timers = global.AstraeonCharactersV6?.state?.saveTimers;
    if (!characterId || !(timers instanceof Map)) return false;
    const timer = timers.get(characterId);
    if (!timer) return false;
    clearTimeout(timer);
    timers.delete(characterId);
    return true;
  }

  function captureCore(instance, saved) {
    const stored = saved?.characteristics?.coreStats;
    if (stored) return M.normalizeStats(stored);
    const base = saved?.baseStats || instance?.baseStats || instance?.player;
    const legacyAttributes = saved?.characteristics?.attributes || saved?.player?.characteristics;
    const previous = saved?.characteristics?.bonuses || M.bonuses(legacyAttributes);
    return legacyAttributes ? M.subtractStats(base, previous) : M.normalizeStats(base);
  }

  function applyCharacterStats(instance, { preserveResources = true } = {}) {
    if (!instance?.player || !instance.characterCoreStats) return;
    const player = instance.player;
    const hpRatio = preserveResources ? Math.max(0, Math.min(1, Number(player.hp) / Math.max(1, Number(player.maxHp) || 1))) : 1;
    const manaRatio = preserveResources ? Math.max(0, Math.min(1, Number(player.mana) / Math.max(1, Number(player.maxMana) || 1))) : 1;
    instance.characteristics = normalizeForLevel(instance.characteristics, player.level);
    instance.characteristicBonuses = M.bonuses(instance.characteristics);
    instance.baseStats = M.addStats(instance.characterCoreStats, instance.characteristicBonuses);
    if (typeof instance.recalculateEquipmentStats === 'function') instance.recalculateEquipmentStats();
    else Object.assign(player, M.addStats(instance.baseStats, equipmentBonuses(instance)));
    player.hp = preserveResources ? Math.max(1, Math.min(player.maxHp, Math.round(player.maxHp * hpRatio))) : player.maxHp;
    player.mana = preserveResources ? Math.max(0, Math.min(player.maxMana, Math.round(player.maxMana * manaRatio))) : player.maxMana;
    player.characteristics = clone(instance.characteristics);
    player.attributePoints = M.availablePoints(player.level, instance.characteristics);
    instance.updateUI?.();
  }

  function installCharacterState(instance, saved, fresh = false) {
    if (!instance?.player) return;
    const source = fresh ? M.EMPTY : saved?.characteristics?.attributes || saved?.player?.characteristics || M.EMPTY;
    instance.characteristics = normalizeForLevel(source, instance.player.level);
    instance.characterCoreStats = fresh ? M.normalizeStats(instance.baseStats || instance.player) : captureCore(instance, saved);
    applyCharacterStats(instance, { preserveResources: !fresh });
  }

  function saveCharacteristics(instance) {
    if (!instance?.player || !instance.characterCoreStats) return;
    try {
      const data = readSave() || {};
      data.baseStats = clone(instance.characterCoreStats);
      data.player = data.player || clone(instance.player);
      data.player.characteristics = clone(instance.characteristics);
      data.player.attributePoints = M.availablePoints(instance.player.level, instance.characteristics);
      data.characteristics = {
        version: M.VERSION,
        attributes: clone(instance.characteristics),
        bonuses: clone(instance.characteristicBonuses || M.bonuses(instance.characteristics)),
        coreStats: clone(instance.characterCoreStats),
        earned: M.earnedPoints(instance.player.level),
        spent: M.spentPoints(instance.characteristics)
      };
      localStorage.setItem(W.STORAGE_SAVE, JSON.stringify(data));
    } catch (error) { console.warn('[Astraeon Características] falha ao persistir', error); }
  }

  async function syncFromServer(characterId = onlineContext().id, { force = false } = {}) {
    const instance = game();
    const { id: activeId, client } = onlineContext();
    const targetId = characterId || activeId;
    if (!instance?.player || !client || !targetId || activeId !== targetId || state.syncing) return false;
    if (!force && state.serverSyncedCharacterId === targetId) return true;
    if (performance.now() < state.authorityUnavailableUntil) return false;
    state.syncing = true;
    try {
      const { data, error } = await client.from('character_progress')
        .select('attribute_damage,attribute_intelligence,attribute_dexterity,attribute_constitution,level')
        .eq('character_id', targetId)
        .maybeSingle();
      if (error) {
        if (authorityUnavailable(error)) state.authorityUnavailableUntil = performance.now() + 30000;
        else console.warn('[Astraeon Características] leitura autoritativa', error.message || error);
        return false;
      }
      if (!data || global.AstraeonCharactersV6?.activeCharacterId !== targetId) return false;
      const authoritative = attributesFromProgress(data, instance.player.level);
      instance.characteristics = authoritative;
      applyCharacterStats(instance);
      instance.save?.();
      cancelPendingCharacterSave(targetId);
      await global.AstraeonCharactersV6?.saveCharacterNow?.();
      state.serverSyncedCharacterId = targetId;
      state.committed = clone(authoritative);
      if (!state.draft || sameAttributes(state.draft, state.committed)) state.draft = clone(authoritative);
      if (!$('#characteristicsPanel')?.classList.contains('hidden')) render();
      return true;
    } finally { state.syncing = false; }
  }

  async function persistAuthoritative(next) {
    const { id, client } = onlineContext();
    if (!id || !client) return { ok: true, authoritative: false, attributes: next };
    const { data, error } = await client.rpc('set_astraeon_characteristics', {
      target_character: id,
      damage_points: next.damage,
      intelligence_points: next.intelligence,
      dexterity_points: next.dexterity,
      constitution_points: next.constitution
    });
    if (error) {
      if (authorityUnavailable(error)) {
        state.authorityUnavailableUntil = performance.now() + 30000;
        return { ok: true, authoritative: false, attributes: next, migrationPending: true };
      }
      console.warn('[Astraeon Características] persistência autoritativa', error.message || error);
      return { ok: false, error };
    }
    return { ok: true, authoritative: true, attributes: attributesFromProgress(data, game()?.player?.level) };
  }

  function previewStats(instance, attributes) {
    const withAttributes = M.addStats(instance.characterCoreStats, M.bonuses(attributes));
    return M.addStats(withAttributes, equipmentBonuses(instance));
  }

  function formatNumber(value, digits = 0) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function effectText(key, points) {
    if (key === 'damage') return `+${formatNumber(points)} poder`;
    if (key === 'intelligence') return `+${formatNumber(points * 3)} mana`;
    if (key === 'dexterity') return `+${formatNumber(points * .8, 1)} velocidade · +${formatNumber(points * .1, 1)}% crítico`;
    return `+${formatNumber(points * 3)} vida · +${formatNumber(points * .25, 2)} defesa`;
  }

  function attributeCard(key, attributes, committed, available) {
    const meta = ATTRIBUTE_META[key];
    const value = attributes[key];
    const pending = value - committed[key];
    return `<article class="characteristic-attribute" data-characteristic="${key}">
      <div class="characteristic-icon">${meta.icon}</div>
      <div class="characteristic-copy"><span>${esc(meta.subtitle)}</span><h3>${esc(meta.name)}</h3><p>${esc(meta.description)}</p><small>${esc(effectText(key, value))}</small></div>
      <div class="characteristic-allocation">
        <button class="minus-one" type="button" data-attribute-minus="${key}" data-amount="1" ${pending <= 0 ? 'disabled' : ''} aria-label="Remover um ponto pendente de ${esc(meta.name)}">−</button>
        <output>${value}${pending > 0 ? `<small>+${pending}</small>` : ''}</output>
        <button class="plus-one" type="button" data-attribute-plus="${key}" data-amount="1" ${available <= 0 ? 'disabled' : ''} aria-label="Adicionar um ponto em ${esc(meta.name)}">+</button>
        <button class="minus-five" type="button" data-attribute-minus="${key}" data-amount="5" ${pending <= 0 ? 'disabled' : ''} aria-label="Remover cinco pontos pendentes de ${esc(meta.name)}">−5</button>
        <button class="plus-five" type="button" data-attribute-plus="${key}" data-amount="5" ${available <= 0 ? 'disabled' : ''} aria-label="Adicionar cinco pontos em ${esc(meta.name)}">+5</button>
      </div>
      <footer>${esc(meta.next)}</footer>
    </article>`;
  }

  function derivedCard(label, value, next, icon) {
    const changed = String(value) !== String(next);
    return `<div class="characteristic-derived"><span>${icon} ${esc(label)}</span><b>${esc(value)}</b>${changed ? `<em>→ ${esc(next)}</em>` : '<em>atual</em>'}</div>`;
  }

  function render() {
    const instance = game();
    const panel = $('#characteristicsPanel');
    if (!panel || !instance?.player || panel.classList.contains('hidden')) return;
    const player = instance.player;
    state.committed = clone(instance.characteristics || M.EMPTY);
    if (!state.draft) state.draft = clone(state.committed);
    state.draft = normalizeForLevel(state.draft, player.level);
    const earned = M.earnedPoints(player.level);
    const spent = M.spentPoints(state.draft);
    const available = Math.max(0, earned - spent);
    const current = previewStats(instance, state.committed);
    const preview = previewStats(instance, state.draft);
    const classData = W.CLASS_DATA[player.classId] || W.CLASS_DATA.Warrior;
    const portrait = $('#characteristicsPortrait');
    if (portrait) portrait.src = `Assets/Classes/${classData.sprite}`;
    $('#characteristicsName').textContent = player.name || 'Viajante';
    $('#characteristicsClass').textContent = `${CLASS_LABELS[player.classId] || player.classId} · Nível ${player.level}`;
    $('#characteristicsAvailable').textContent = available;
    $('#characteristicsEarned').textContent = earned;
    $('#characteristicsSpent').textContent = spent;
    $('#characteristicsProgress').style.width = `${earned ? Math.min(100, spent / earned * 100) : 0}%`;
    $('#characteristicsAttributeGrid').innerHTML = M.KEYS.map(key => attributeCard(key, state.draft, state.committed, available)).join('');
    $('#characteristicsDerived').innerHTML = [
      derivedCard('Poder', current.power, preview.power, '⚔'),
      derivedCard('Mana', current.maxMana, preview.maxMana, '✦'),
      derivedCard('Velocidade', current.speed, preview.speed, '➶'),
      derivedCard('Crítico', `${formatNumber(current.crit * 100, 1)}%`, `${formatNumber(preview.crit * 100, 1)}%`, '◇'),
      derivedCard('Defesa', current.defense, preview.defense, '◆'),
      derivedCard('Vida', current.maxHp, preview.maxHp, '♥')
    ].join('');
    const changed = !sameAttributes(state.draft, state.committed);
    $('#characteristicsApply').disabled = !changed;
    $('#characteristicsReset').disabled = !changed;
    $('#characteristicsPending').textContent = changed ? `${M.spentPoints(state.draft) - M.spentPoints(state.committed)} ponto(s) aguardando aplicação` : 'Nenhuma alteração pendente';
    panel.classList.toggle('has-pending', changed);
  }

  function openPanel() {
    const instance = game();
    const panel = $('#characteristicsPanel');
    if (!instance?.running || !instance.player || !panel) return;
    document.querySelectorAll('.overlay-panel:not(#characteristicsPanel)').forEach(element => element.classList.add('hidden'));
    state.committed = clone(instance.characteristics || M.EMPTY);
    state.draft = clone(state.committed);
    panel.classList.remove('hidden');
    render();
    const id = global.AstraeonCharactersV6?.activeCharacterId;
    if (id && state.serverSyncedCharacterId !== id) void syncFromServer(id);
  }

  function closePanel() {
    $('#characteristicsPanel')?.classList.add('hidden');
    state.draft = null;
    state.committed = null;
  }

  function adjust(key, delta, amount = 1) {
    const instance = game();
    if (!instance?.player || !M.KEYS.includes(key)) return;
    if (!state.draft) state.draft = clone(instance.characteristics || M.EMPTY);
    const committed = instance.characteristics?.[key] || 0;
    const available = M.availablePoints(instance.player.level, state.draft);
    if (delta > 0) state.draft[key] += Math.min(amount, available);
    else state.draft[key] = Math.max(committed, state.draft[key] - amount);
    render();
  }

  async function applyDraft() {
    const instance = game();
    if (!instance?.player || !state.draft) return;
    const saveButton = $('#characteristicsApply');
    const next = normalizeForLevel(state.draft, instance.player.level);
    if (M.spentPoints(next) < M.spentPoints(instance.characteristics)) return;
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Salvando…'; }

    const serverSave = await persistAuthoritative(next);
    if (!serverSave.ok) {
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Salvar pontos'; }
      $('#characteristicsPending').textContent = 'O servidor rejeitou a distribuição. Nenhum ponto foi alterado.';
      instance.toast?.('Não foi possível salvar os pontos. Recarregue o personagem e tente novamente.');
      return;
    }

    const accepted = normalizeForLevel(serverSave.attributes, instance.player.level);
    instance.characteristics = accepted;
    applyCharacterStats(instance);
    instance.save?.();
    const activeCharacterId = global.AstraeonCharactersV6?.activeCharacterId || null;
    cancelPendingCharacterSave(activeCharacterId);
    state.committed = clone(accepted);
    state.draft = clone(accepted);
    state.serverSyncedCharacterId = serverSave.authoritative ? activeCharacterId : state.serverSyncedCharacterId;
    render();

    const onlineSave = activeCharacterId ? await global.AstraeonCharactersV6.saveCharacterNow() : true;
    if (saveButton) saveButton.textContent = 'Salvar pontos';
    const fullySaved = onlineSave && (serverSave.authoritative || !activeCharacterId);
    const migrationPending = !!serverSave.migrationPending;
    $('#characteristicsPending').textContent = fullySaved
      ? 'Pontos salvos neste personagem'
      : migrationPending && onlineSave
        ? 'Pontos salvos no personagem · proteção autoritativa aguardando migration 024'
        : 'Salvo localmente · sincronização online pendente';
    instance.toast?.(fullySaved
      ? 'Pontos salvos neste personagem.'
      : migrationPending && onlineSave
        ? 'Pontos salvos. A proteção autoritativa será ativada após a migration 024.'
        : 'Pontos salvos localmente. Não foi possível sincronizar agora.');
    instance.beep?.(760, .08, .035);
  }

  function bindUi() {
    $('#characteristicsBtn')?.addEventListener('click', openPanel);
    $('#touchCharacteristics')?.addEventListener('click', event => { event.preventDefault(); openPanel(); });
    $('#characteristicsPanel')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) { closePanel(); return; }
      const plus = event.target.closest('[data-attribute-plus]');
      const minus = event.target.closest('[data-attribute-minus]');
      if (plus) adjust(plus.dataset.attributePlus, 1, event.shiftKey ? 5 : Number(plus.dataset.amount) || 1);
      if (minus) adjust(minus.dataset.attributeMinus, -1, event.shiftKey ? 5 : Number(minus.dataset.amount) || 1);
    });
    $('#characteristicsClose')?.addEventListener('click', closePanel);
    $('#characteristicsReset')?.addEventListener('click', () => { state.draft = clone(game()?.characteristics || M.EMPTY); render(); });
    $('#characteristicsApply')?.addEventListener('click', applyDraft);
    global.addEventListener('keydown', event => {
      if (global.AstraeonInputGuardV1?.blocksPanelHotkeys(event)) return;
      const active = document.activeElement;
      if (active?.closest?.('input,textarea,select,[contenteditable="true"],#onlineChat,#onlineAccountPanel,#npcDialogue')) return;
      if (event.key === 'Escape' && !$('#characteristicsPanel')?.classList.contains('hidden')) {
        event.preventDefault(); event.stopImmediatePropagation(); closePanel(); return;
      }
      if ((event.code === 'KeyC' || event.key.toLowerCase() === 'c') && !event.repeat && game()?.running) {
        event.preventDefault(); event.stopImmediatePropagation();
        if ($('#characteristicsPanel')?.classList.contains('hidden')) openPanel(); else closePanel();
      }
    }, true);
  }

  function installGameHooks(instance) {
    if (instance.characteristicsV1Installed) return;
    instance.characteristicsV1Installed = true;
    const originalStart = instance.startNew.bind(instance);
    const originalContinue = instance.continueGame.bind(instance);
    const originalSave = instance.save.bind(instance);
    const originalGainXp = instance.gainXp.bind(instance);

    instance.startNew = function () {
      const result = originalStart();
      if (!this.player) return result;
      state.serverSyncedCharacterId = null;
      installCharacterState(this, null, true);
      this.save();
      return result;
    };
    instance.continueGame = function () {
      const saved = readSave();
      const result = originalContinue();
      if (!this.player) return result;
      state.serverSyncedCharacterId = null;
      installCharacterState(this, saved, false);
      return result;
    };
    instance.save = function () {
      const result = originalSave();
      saveCharacteristics(this);
      return result;
    };
    instance.gainXp = function (amount) {
      if (!this.player || !this.characterCoreStats) return originalGainXp(amount);
      const beforeLevel = M.level(this.player.level);
      this.baseStats = clone(this.characterCoreStats);
      this.recalculateEquipmentStats?.();
      const result = originalGainXp(amount);
      this.characterCoreStats = M.normalizeStats(this.baseStats || this.player);
      const afterLevel = M.level(this.player.level);
      applyCharacterStats(this, { preserveResources: afterLevel <= beforeLevel });
      if (afterLevel > beforeLevel) {
        const gained = M.earnedPoints(afterLevel) - M.earnedPoints(beforeLevel);
        this.toast?.(`Nível ${afterLevel}! +${gained} pontos de características disponíveis.`);
        this.save();
        if (!$('#characteristicsPanel')?.classList.contains('hidden')) { state.draft = clone(this.characteristics); render(); }
      }
      return result;
    };
  }

  function installServerSyncWatch() {
    setInterval(() => {
      const instance = game();
      const id = global.AstraeonCharactersV6?.activeCharacterId || null;
      if (!id) { state.serverSyncedCharacterId = null; return; }
      if (instance?.running && instance.player && state.serverSyncedCharacterId !== id && !state.syncing) void syncFromServer(id);
    }, 700);
  }

  function install() {
    if (state.installed) return;
    const instance = game();
    if (!instance || !$('#characteristicsPanel')) { setTimeout(install, 80); return; }
    state.installed = true;
    installGameHooks(instance);
    bindUi();
    installServerSyncWatch();
    global.AstraeonCharacteristicsV1 = { VERSION: '1.2', state, open: openPanel, close: closePanel, render, applyCharacterStats, syncFromServer };
  }

  if (document.readyState === 'loading') global.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window);
