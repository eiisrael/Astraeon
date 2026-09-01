(function (global) {
  'use strict';

  class EventBus {
    constructor() { this.listeners = new Map(); }
    on(event, handler, options = {}) {
      if (typeof handler !== 'function') throw new TypeError('handler_required');
      const bucket = this.listeners.get(event) || new Set();
      const record = { handler, once: options.once === true };
      bucket.add(record); this.listeners.set(event, bucket);
      return () => bucket.delete(record);
    }
    once(event, handler) { return this.on(event, handler, { once: true }); }
    off(event, handler) {
      const bucket = this.listeners.get(event); if (!bucket) return false;
      let removed = false;
      for (const record of bucket) if (record.handler === handler) { bucket.delete(record); removed = true; }
      if (!bucket.size) this.listeners.delete(event); return removed;
    }
    emit(event, payload) {
      const bucket = this.listeners.get(event); if (!bucket?.size) return [];
      const results = [];
      for (const record of [...bucket]) {
        try { results.push(record.handler(payload)); }
        catch (error) {
          console.error('[Astraeon EventBus]', event, error);
          global.AstraeonObservabilityV1?.capture?.('lifecycle.listener_error', { event, message: String(error?.message || error) }, 'error');
        }
        if (record.once) bucket.delete(record);
      }
      if (!bucket.size) this.listeners.delete(event); return results;
    }
    async emitAsync(event, payload) { return Promise.allSettled(this.emit(event, payload).map(value => Promise.resolve(value))); }
    clear(event) { if (event) this.listeners.delete(event); else this.listeners.clear(); }
  }

  const bus = new EventBus();
  const wrapped = new WeakMap();
  function wrapMethod(game, name, beforeEvent, afterEvent) {
    if (!game || typeof game[name] !== 'function') return false;
    const registry = wrapped.get(game) || new Set(); if (registry.has(name)) return false;
    const original = game[name].bind(game);
    game[name] = function (...args) {
      const ctx = { game: this, args, method: name, at: performance.now() }; bus.emit(beforeEvent, ctx);
      let result;
      try { result = original(...args); }
      catch (error) { bus.emit('game:error', { ...ctx, error }); throw error; }
      if (result && typeof result.then === 'function') return result.then(value => { bus.emit(afterEvent, { ...ctx, result: value }); return value; }, error => { bus.emit('game:error', { ...ctx, error }); throw error; });
      bus.emit(afterEvent, { ...ctx, result }); return result;
    };
    registry.add(name); wrapped.set(game, registry); return true;
  }
  function attachGame(game) {
    if (!game || game.lifecycleV1Attached) return false; game.lifecycleV1Attached = true;
    [
      ['update','game:update:before','game:update:after'],['draw','game:draw:before','game:draw:after'],
      ['basicAttack','combat:attack:before','combat:attack:after'],['castSkill','combat:skill:before','combat:skill:after'],
      ['damagePlayer','combat:player-damage:before','combat:player-damage:after'],['killMob','combat:mob-kill:before','combat:mob-kill:after'],
      ['save','save:before','save:after'],['startNew','game:start:before','game:start:after'],['continueGame','game:continue:before','game:continue:after']
    ].forEach(args => wrapMethod(game, ...args));
    bus.emit('lifecycle:attached', { game }); return true;
  }
  function install() { const game = global.astraeon; if (!game) { global.setTimeout(install, 50); return; } attachGame(game); }
  global.AstraeonEventBusV1 = bus;
  global.AstraeonLifecycleV1 = { EventBus, bus, attachGame, wrapMethod };
  if (document.readyState === 'loading') global.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})(window);
