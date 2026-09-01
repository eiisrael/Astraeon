(function (global) {
  'use strict';

  const SKILL_CHAIN_DELAY_MS = 900;
  const TARGET_RANGE_BUFFER = 120;
  const TARGET_MIN_DISTANCE = 320;
  const WATCH_INTERVAL_MS = 100;
  let watchTimer = 0;

  function targetDistanceLimit(game) {
    const range = Math.max(0, Number(game?.player?.range) || 0);
    return Math.max(TARGET_MIN_DISTANCE, range + TARGET_RANGE_BUFFER);
  }

  function closeDistantTarget(game) {
    const focus = game?.mobCombatFocusV4;
    const mob = focus?.selected;
    if (!focus || !mob) return false;
    const player = game?.player;
    const invalid = !player || mob.dead || !Array.isArray(game.mobs) || !game.mobs.includes(mob);
    const tooFar = !invalid && Math.hypot(Number(mob.x) - Number(player.x), Number(mob.y) - Number(player.y)) > targetDistanceLimit(game);
    if (!invalid && !tooFar) return false;
    focus.selected = null;
    document.querySelector?.('#mobTargetPanel')?.classList?.add?.('hidden');
    return true;
  }

  function installSkillChainGuard(game) {
    if (!game || typeof game.castSkill !== 'function' || game.skillChainGuardV1Installed) return false;
    game.skillChainGuardV1Installed = true;
    game.skillChainDelayMs = SKILL_CHAIN_DELAY_MS;
    const originalCastSkill = game.castSkill.bind(game);
    let lastSkillCastAt = -Infinity;

    game.castSkill = function (index, ...args) {
      const now = performance.now();
      const elapsed = now - lastSkillCastAt;
      const remaining = SKILL_CHAIN_DELAY_MS - elapsed;
      if (remaining > 0) {
        const macro = this.mobCombatFocusV4;
        if (macro?.rightHeld) macro.nextMacroAt = Math.max(Number(macro.nextMacroAt) || 0, now + remaining);
        return false;
      }

      const slot = Math.max(0, Math.min(4, Math.trunc(Number(index) || 0)));
      const beforeCooldown = Math.max(0, Number(this.cooldowns?.[slot]) || 0);
      const beforeMana = Math.max(0, Number(this.player?.mana) || 0);
      const result = originalCastSkill(slot, ...args);
      const afterCooldown = Math.max(0, Number(this.cooldowns?.[slot]) || 0);
      const afterMana = Math.max(0, Number(this.player?.mana) || 0);
      const used = beforeCooldown <= .001 && (afterCooldown > .001 || afterMana < beforeMana);

      if (used) {
        lastSkillCastAt = now;
        const macro = this.mobCombatFocusV4;
        if (macro?.rightHeld) macro.nextMacroAt = Math.max(Number(macro.nextMacroAt) || 0, now + SKILL_CHAIN_DELAY_MS);
      }
      return used ? true : result;
    };
    return true;
  }

  function tick() {
    const game = global.astraeon;
    if (!game) return;
    installSkillChainGuard(game);
    closeDistantTarget(game);
  }

  function start() {
    if (watchTimer || typeof global.setInterval !== 'function') return;
    tick();
    watchTimer = global.setInterval(tick, WATCH_INTERVAL_MS);
  }

  global.AstraeonCombatUxGuardV1 = Object.freeze({
    SKILL_CHAIN_DELAY_MS,
    TARGET_RANGE_BUFFER,
    TARGET_MIN_DISTANCE,
    targetDistanceLimit,
    closeDistantTarget,
    installSkillChainGuard,
    tick
  });

  start();
})(window);
