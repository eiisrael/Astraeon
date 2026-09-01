(function (global) {
  'use strict';

  const DEATH_XP_RATE = 0.15;
  const INSTALL_RETRY_MS = 80;
  let installed = false;
  let retryTimer = 0;

  function normalizedXp(value) {
    const xp = Math.floor(Number(value));
    return Number.isFinite(xp) ? Math.max(0, xp) : 0;
  }

  function calculateDeathXp(value) {
    const before = normalizedXp(value);
    const loss = before > 0 ? Math.max(1, Math.ceil(before * DEATH_XP_RATE)) : 0;
    return { before, loss, after: Math.max(0, before - loss) };
  }

  function operationId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    global.crypto?.getRandomValues?.(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }

  async function auditOnlinePenalty(requestId) {
    const mp = global.AstraeonMultiplayerV4?.state;
    const characterId = global.AstraeonCharactersV6?.activeCharacterId;
    if (!mp?.client || !mp.session || !characterId || !requestId) return false;
    try {
      const { data, error } = await mp.client.rpc('apply_astraeon_death_penalty', {
        target_character: characterId,
        request_id: requestId
      });
      if (error) throw error;
      if (Number(data?.after_xp) > Number(data?.before_xp)) {
        console.error('[Astraeon Death Penalty] autoridade recusada: resposta aumentaria EXP');
        return false;
      }
      return true;
    } catch (error) {
      const message = String(error?.message || error || '');
      if (!/PGRST202|schema cache|apply_astraeon_death_penalty/i.test(message)) {
        console.warn('[Astraeon Death Penalty]', message);
      }
      return false;
    }
  }

  function install(game) {
    if (installed || !game || typeof game.playerDeath !== 'function') return false;
    installed = true;
    game.deathXpPenaltyV1Installed = true;
    game.deathXpPenaltyRate = DEATH_XP_RATE;

    const originalPlayerDeath = game.playerDeath.bind(game);
    game.playerDeath = function (...args) {
      const player = this.player;
      if (!player) return originalPlayerDeath(...args);

      const levelBefore = Math.max(1, Math.floor(Number(player.level) || 1));
      const xpNextBefore = Math.max(1, Math.floor(Number(player.xpNext) || 1));
      const penalty = calculateDeathXp(player.xp);
      const requestId = operationId();

      // The death path is strictly subtractive. It never calls gainXp(), never
      // changes level/xpNext and therefore cannot award levels, attributes or skill points.
      player.xp = penalty.after;
      const result = originalPlayerDeath(...args);

      if (this.player === player) {
        player.level = levelBefore;
        player.xpNext = xpNextBefore;
        player.xp = penalty.after;
        this.updateUI?.();
        this.save?.();
        if (penalty.loss > 0) {
          this.toast?.(`Derrota: -${penalty.loss} EXP (15%). EXP atual: ${penalty.after}.`);
        } else {
          this.toast?.('Derrota: sua EXP já está em 0.');
        }
        void auditOnlinePenalty(requestId);
      }
      return result;
    };
    return true;
  }

  function wait() {
    if (install(global.astraeon)) return;
    clearTimeout(retryTimer);
    retryTimer = global.setTimeout(wait, INSTALL_RETRY_MS);
  }

  global.AstraeonDeathPenaltyV1 = Object.freeze({
    DEATH_XP_RATE,
    normalizedXp,
    calculateDeathXp,
    install
  });

  wait();
})(window);
