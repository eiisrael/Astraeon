(function (global) {
  'use strict';

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const durations = { Warrior: .34, Mage: .46, Archer: .34, Assassin: .3, Paladine: .52 };

  function create(player, aim, color) {
    const classId = player?.classId || 'Warrior';
    const x = Number(player?.x) || 0, y = Number(player?.y) || 0;
    const tx = Number(aim?.x) || x, ty = Number(aim?.y) || y;
    const max = durations[classId] || .36;
    return {
      type: 'class-basic-attack', classId, x, y, tx, ty,
      angle: Math.atan2(ty - y, tx - x), color: color || '#ffffff', life: max, max
    };
  }

  function lineProgress(ctx, ax, ay, bx, by, progress) {
    const q = clamp(progress);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, q), lerp(ay, by, q)); ctx.stroke();
  }

  function warrior(ctx, e, t) {
    const first = clamp(t / .48), second = clamp((t - .32) / .58);
    ctx.translate(e.tx, e.ty); ctx.rotate(e.angle);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffd7a0'; ctx.shadowBlur = 14; ctx.shadowColor = '#ff7a3d';
    lineProgress(ctx, -24, -22, 24, 22, first);
    if (second > 0) lineProgress(ctx, -24, 22, 24, -22, second);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha *= .8;
    lineProgress(ctx, -23, -22, 23, 22, first);
    if (second > 0) lineProgress(ctx, -23, 22, 23, -22, second);
  }

  function mage(ctx, e, t) {
    const radius = 11 + 24 * Math.sin(Math.PI * clamp(t));
    ctx.translate(e.tx, e.ty); ctx.rotate(t * 2.4);
    ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 20; ctx.shadowColor = '#b94dff';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 1.35);
    glow.addColorStop(0, 'rgba(247,220,255,.88)'); glow.addColorStop(.34, 'rgba(187,71,255,.45)'); glow.addColorStop(1, 'rgba(83,19,133,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d998ff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff3ff'; ctx.beginPath(); ctx.arc(0, 0, radius * .62, -.5, 4.35); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#f5dcff'; ctx.fill(); }
  }

  function archer(ctx, e, t) {
    const q = clamp(1 - Math.pow(1 - Math.min(1, t * 1.5), 3));
    const x = lerp(e.x, e.tx, q), y = lerp(e.y, e.ty, q);
    ctx.translate(x, y); ctx.rotate(e.angle); ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.strokeStyle = '#d9ffb2'; ctx.lineWidth = 7; ctx.shadowBlur = 13; ctx.shadowColor = '#79df76';
    ctx.beginPath(); ctx.moveTo(-27, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.fillStyle = '#f0ffd0'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(5, -9); ctx.lineTo(8, 0); ctx.lineTo(5, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8de68c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-31, -8); ctx.moveTo(-22, 0); ctx.lineTo(-31, 8); ctx.stroke();
  }

  function paladine(ctx, e, t) {
    const pulse = Math.sin(Math.PI * clamp(t)), radius = 16 + pulse * 18;
    ctx.translate(e.tx, e.ty); ctx.rotate(-t * 1.8); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffe38b'; ctx.fillStyle = '#fff4bd'; ctx.shadowBlur = 18; ctx.shadowColor = '#ffc94c';
    ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, radius * .62, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, px = Math.cos(a) * radius, py = Math.sin(a) * radius;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 4); ctx.strokeRect(-3.2, -3.2, 6.4, 6.4); ctx.restore();
    }
    ctx.rotate(t * 3.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-radius * .48, 0); ctx.lineTo(radius * .48, 0); ctx.moveTo(0, -radius * .48); ctx.lineTo(0, radius * .48); ctx.stroke();
  }

  function assassin(ctx, e, t) {
    const q = clamp(1 - Math.pow(1 - Math.min(1, t * 1.8), 4));
    const x = lerp(e.x, e.tx, q), y = lerp(e.y, e.ty, q);
    ctx.translate(x, y); ctx.rotate(e.angle); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#efe4ff'; ctx.shadowBlur = 14; ctx.shadowColor = '#a854ff';
    for (let i = -1; i <= 1; i++) {
      ctx.globalAlpha *= i === 0 ? 1 : .42; ctx.lineWidth = i === 0 ? 4 : 1.5;
      ctx.beginPath(); ctx.moveTo(-34 - Math.abs(i) * 7, i * 6); ctx.lineTo(12, i * 2); ctx.stroke();
      if (i !== 0) ctx.globalAlpha /= .42;
    }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(5, -5); ctx.lineTo(8, 0); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c69aff'; ctx.lineWidth = 1.6; ctx.globalAlpha *= .68;
    ctx.beginPath(); ctx.arc(-6, 0, 13, -1.1, 1.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(-13, 0, 20, -.88, .88); ctx.stroke();
  }

  function draw(ctx, effect, progress) {
    if (effect?.type !== 'class-basic-attack') return false;
    const render = { Warrior: warrior, Mage: mage, Archer: archer, Assassin: assassin, Paladine: paladine }[effect.classId] || warrior;
    render(ctx, effect, clamp(progress));
    return true;
  }

  global.AstraeonCombatEffectsV1 = { create, draw, durations };
})(window);
