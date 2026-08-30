(function (global) {
  'use strict';

  const KEYS = Object.freeze(['damage', 'intelligence', 'dexterity', 'constitution']);
  const STAT_KEYS = Object.freeze(['maxHp', 'maxMana', 'power', 'defense', 'speed', 'range', 'crit']);
  const EMPTY = Object.freeze({ damage: 0, intelligence: 0, dexterity: 0, constitution: 0 });

  function level(value) {
    return Math.max(1, Math.floor(Number(value) || 1));
  }

  function earnedPoints(value) {
    const current = level(value);
    const throughFifty = Math.min(current, 50) * 5;
    const afterFifty = Math.max(0, current - 50) * 3;
    return throughFifty + afterFifty;
  }

  function normalizeAttributes(input, maxTotal = Infinity) {
    const next = { ...EMPTY };
    KEYS.forEach(key => { next[key] = Math.max(0, Math.floor(Number(input?.[key]) || 0)); });
    let excess = Math.max(0, KEYS.reduce((sum, key) => sum + next[key], 0) - Math.max(0, Number(maxTotal) || 0));
    [...KEYS].reverse().forEach(key => {
      if (!excess) return;
      const removed = Math.min(excess, next[key]);
      next[key] -= removed;
      excess -= removed;
    });
    return next;
  }

  function spentPoints(input) {
    const attributes = normalizeAttributes(input);
    return KEYS.reduce((sum, key) => sum + attributes[key], 0);
  }

  function availablePoints(currentLevel, input) {
    return Math.max(0, earnedPoints(currentLevel) - spentPoints(input));
  }

  function bonuses(input) {
    const attributes = normalizeAttributes(input);
    return {
      maxHp: attributes.constitution * 3,
      maxMana: attributes.intelligence * 3,
      power: attributes.damage,
      defense: attributes.constitution * 0.25,
      speed: attributes.dexterity * 0.8,
      range: 0,
      crit: attributes.dexterity * 0.001
    };
  }

  function normalizeStats(input) {
    const next = {};
    STAT_KEYS.forEach(key => { next[key] = Number(input?.[key]) || 0; });
    next.maxHp = Math.max(1, next.maxHp);
    next.maxMana = Math.max(0, next.maxMana);
    next.speed = Math.max(1, next.speed);
    next.range = Math.max(1, next.range);
    next.crit = Math.max(0, next.crit);
    return next;
  }

  function addStats(base, extra) {
    const source = normalizeStats(base);
    const result = {};
    STAT_KEYS.forEach(key => { result[key] = source[key] + (Number(extra?.[key]) || 0); });
    result.maxHp = Math.max(1, Math.round(result.maxHp));
    result.maxMana = Math.max(0, Math.round(result.maxMana));
    result.power = Math.max(0, Math.round(result.power));
    result.defense = Math.max(0, Math.round(result.defense));
    result.speed = Math.max(60, Math.round(result.speed));
    result.range = Math.max(32, Math.round(result.range));
    result.crit = Math.max(0, Math.min(.75, +result.crit.toFixed(3)));
    return result;
  }

  function subtractStats(total, extra) {
    const source = normalizeStats(total);
    const result = {};
    STAT_KEYS.forEach(key => { result[key] = source[key] - (Number(extra?.[key]) || 0); });
    return normalizeStats(result);
  }

  global.AstraeonCharacteristicsModelV1 = Object.freeze({
    VERSION: '1.0', KEYS, STAT_KEYS, EMPTY, level, earnedPoints, normalizeAttributes,
    spentPoints, availablePoints, bonuses, normalizeStats, addStats, subtractStats
  });
})(typeof window !== 'undefined' ? window : globalThis);
