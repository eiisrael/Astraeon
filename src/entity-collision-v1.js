(function (global) {
  'use strict';

  const RADII = { player: 13, mob: 12, npc: 12, remote: 13 };
  const STEP = 5;
  const finite = value => Number.isFinite(Number(value));

  function radiusOf(game, entity) {
    if (entity === game?.player) return RADII.player;
    if ((game?.mobs || []).includes(entity)) return RADII.mob;
    if ((game?.npcsV4 || []).includes(entity)) return RADII.npc;
    return RADII.remote;
  }

  function bodies(game, mover) {
    const list = [];
    if (game?.player && game.player !== mover) list.push([game.player, RADII.player]);
    for (const mob of game?.mobs || []) if (mob && mob !== mover && !mob.dead) list.push([mob, RADII.mob]);
    for (const npc of game?.npcsV4 || []) if (npc && npc !== mover) list.push([npc, RADII.npc]);
    const remotes = global.AstraeonMultiplayerV4?.state?.remote?.values?.();
    if (remotes) for (const remote of remotes) if (remote && remote !== mover) list.push([remote, RADII.remote]);
    return list;
  }

  function blocks(game, mover, x, y, radius, originX = mover?.x, originY = mover?.y) {
    if (!finite(x) || !finite(y)) return true;
    for (const [body, bodyRadius] of bodies(game, mover)) {
      if (!finite(body.x) || !finite(body.y)) continue;
      const minimum = radius + bodyRadius;
      const before = Math.hypot(Number(originX) - body.x, Number(originY) - body.y);
      const after = Math.hypot(x - body.x, y - body.y);
      if (after < minimum && after <= before + .001) return true;
    }
    return false;
  }

  function constrain(game, entity, targetX, targetY, radius = radiusOf(game, entity)) {
    let x = Number(entity?.x), y = Number(entity?.y);
    if (!finite(x) || !finite(y) || !finite(targetX) || !finite(targetY)) return { x, y };
    const dx = Number(targetX) - x, dy = Number(targetY) - y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / STEP));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      const nextX = x + sx;
      if (!blocks(game, entity, nextX, y, radius, x, y)) x = nextX;
      const nextY = y + sy;
      if (!blocks(game, entity, x, nextY, radius, x, y)) y = nextY;
    }
    return { x, y };
  }

  function install(game) {
    if (!game || game.entityCollisionV1Installed || typeof game.moveEntity !== 'function') return;
    game.entityCollisionV1Installed = true;
    const originalMove = game.moveEntity.bind(game);
    game.moveEntity = function (entity, dx, dy, radius = radiusOf(this, entity)) {
      if (!entity || !finite(entity.x) || !finite(entity.y)) return;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(Number(dx) || 0), Math.abs(Number(dy) || 0)) / STEP));
      const sx = (Number(dx) || 0) / steps, sy = (Number(dy) || 0) / steps;
      for (let i = 0; i < steps; i++) {
        const beforeX = entity.x, beforeY = entity.y;
        originalMove(entity, sx, 0, radius);
        if (blocks(this, entity, entity.x, entity.y, radius, beforeX, beforeY)) entity.x = beforeX;
        const verticalX = entity.x, verticalY = entity.y;
        originalMove(entity, 0, sy, radius);
        if (blocks(this, entity, entity.x, entity.y, radius, verticalX, verticalY)) entity.y = verticalY;
      }
    };
  }

  global.AstraeonEntityCollisionV1 = { RADII, blocks, constrain, install, radiusOf };
})(window);
