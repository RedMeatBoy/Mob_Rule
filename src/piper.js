// piper.js — the player. You walk, the mob follows YOUR path. You whistle,
// the mob surges. That's the whole verb set, and it's enough.

import { clamp, lerp } from './pool.js';

export const PIPER_COLORS = ['#e05c5c', '#5aa9ff'];

export class Piper {
  constructor(slot, x, y, little) {
    this.slot = slot;
    this.little = !!little;
    this.color = PIPER_COLORS[slot];
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.speed = 175;
    this.hearts = 3 + (little ? 2 : 0);
    this.maxHearts = this.hearts;
    this.invuln = 0;
    this.face = 1;
    this.walk = 0;
    this.dead = false; this.downed = false;
    this.reviveP = 0;
    this.whistleMult = 1 + (little ? 0.2 : 0);
    this.charm = false;
    // Rally (whistle target).
    this.rally = { x, y };
    this.rallyT = 0;
    this.whistleAnim = 0;
    // Trail: points every TRAIL_STEP px of movement; critters index into it.
    this.trail = [{ x, y }];
    this.trailDist = 0;
    this.magnet = little ? 150 : 95;
  }

  trailPoint(lag, side) {
    const idx = Math.min(this.trail.length - 1, Math.floor(lag / TRAIL_STEP));
    const p = this.trail[idx];
    const q = this.trail[Math.min(this.trail.length - 1, idx + 1)];
    // Perpendicular offset for a fat, organic swarm instead of a single file.
    const dx = q.x - p.x, dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (-dy / d) * side, y: p.y + (dx / d) * side };
  }

  update(dt, game, inp) {
    this.px = this.x; this.py = this.y;
    this.invuln = Math.max(0, this.invuln - dt);
    this.whistleAnim = Math.max(0, this.whistleAnim - dt);
    if (this.dead || this.downed) { this.rallyT = 0; return; }

    const spd = this.speed;
    this.x += inp.x * spd * dt;
    this.y += inp.y * spd * dt;
    this.x = clamp(this.x, 34, game.arena.w - 34);
    this.y = clamp(this.y, 34, game.arena.h - 34);
    if (inp.x !== 0) this.face = inp.x > 0 ? 1 : -1;
    const moving = inp.x !== 0 || inp.y !== 0;
    if (moving) this.walk += dt * 10;

    // Trail recording.
    const last = this.trail[0];
    const md = Math.hypot(this.x - last.x, this.y - last.y);
    if (md >= TRAIL_STEP) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 420) this.trail.pop();
    }

    // Whistle: hold to keep the mob rallied ahead of you.
    if (inp.whistle) {
      const reach = 240 * this.whistleMult;
      let tx = this.x + (inp.x || this.face) * reach;
      let ty = this.y + inp.y * reach;
      // Assist: snap toward the biggest nearby bot cluster.
      const target = game.enemies.nearest(tx, ty, 200);
      if (target) { tx = target.x; ty = target.y; }
      this.rally.x = clamp(tx, 34, game.arena.w - 34);
      this.rally.y = clamp(ty, 34, game.arena.h - 34);
      if (this.rallyT <= 0) {
        game.audio.sfx('whistle');
        game.fx.notes(this.x, this.y - 24, 3);
      }
      this.rallyT = 0.35; // refreshed while held
      this.whistleAnim = 0.3;
      if (Math.random() < 0.15) game.fx.notes(this.rally.x, this.rally.y - 10, 1);
    } else if (this.rallyT > 0) {
      this.rallyT -= dt;
    }
    if (inp.recallP) {
      this.rallyT = 0;
      game.audio.sfx('recall');
      game.fx.ring(this.x, this.y, 60, '#aef2ff', 0.4);
      game.fx.notes(this.x, this.y - 24, 4);
    }

    // Charm aura (crossroads pick): nearby bots get dizzy.
    if (this.charm) {
      game.enemies.each(this.x, this.y, 110, e => { e.slowT = Math.max(e.slowT || 0, 0.4); });
    }
  }

  hurt(game, dmg, src) {
    if (this.invuln > 0 || this.dead || this.downed) return;
    this.hearts -= dmg;
    this.invuln = this.little ? 1.6 : 1.0;
    game.audio.sfx('hurt');
    game.shake(0.3);
    game.fx.sparks(this.x, this.y, 6);
    if (src) {
      const dx = this.x - src.x, dy = this.y - src.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += dx / d * 14; this.y += dy / d * 14;
    }
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.downed = true;
      this.reviveP = 0;
      game.onPiperDown(this);
    }
  }

  revive(game) {
    this.downed = false;
    this.hearts = Math.ceil(this.maxHearts / 2);
    this.invuln = 2;
    game.audio.sfx('waveclear');
    game.fx.confetti(this.x, this.y - 10, 16);
  }

  render(ctx, alpha, game) {
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const bob = Math.abs(Math.sin(this.walk)) * 3;

    // Shadow.
    ctx.fillStyle = 'rgba(40,60,30,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 13, 11, 4.5, 0, 0, 6.29); ctx.fill();

    if (this.downed) {
      // Sitting sadly; the mob will gather.
      ctx.fillStyle = '#8a8a96';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 9, 7, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath(); ctx.arc(x, y - 7, 6, 0, 6.29); ctx.fill();
      if (this.reviveP > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 24, 0, 6.29); ctx.stroke();
        ctx.strokeStyle = '#7ec850';
        ctx.beginPath(); ctx.arc(x, y, 24, -1.57, -1.57 + this.reviveP * 6.29); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(126,242,154,0.4)'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(x, y, 24, 0, 6.29); ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }

    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.save();
    ctx.translate(x, y - bob);
    ctx.scale(this.face, 1);
    // Legs.
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(-5, 5, 4, 8);
    ctx.fillRect(1, 5, 4, 8);
    // Marching-band jacket.
    ctx.fillStyle = this.color;
    ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = '#ffd966';
    ctx.fillRect(-1, -6, 2, 12); // gold braid
    // Head.
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath(); ctx.arc(0, -12, 6.5, 0, 6.29); ctx.fill();
    // Big band hat.
    ctx.fillStyle = this.color;
    ctx.fillRect(-5, -25, 10, 9);
    ctx.fillStyle = '#ffd966';
    ctx.fillRect(-5, -18, 10, 2.4);
    ctx.beginPath(); ctx.arc(0, -25, 3, 0, 6.29); ctx.fill(); // pom
    // Eye.
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(2.5, -13, 2, 2.4);
    // Flute (out while whistling).
    if (this.whistleAnim > 0) {
      ctx.fillStyle = '#c9a05a';
      ctx.fillRect(4, -11, 12, 2.6);
      ctx.fillStyle = '#8a6b45';
      ctx.fillRect(7, -11, 1.6, 2.6);
      ctx.fillRect(11, -11, 1.6, 2.6);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Player ring + label.
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 13, 15, 6, 0, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;
    if (this.little) {
      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', x + 14, y - 24);
    }

    // Rally marker while whistling.
    if (this.rallyT > 0) {
      const t = game.time * 6;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -t * 8;
      ctx.beginPath(); ctx.arc(this.rally.x, this.rally.y, 26 + Math.sin(t) * 4, 0, 6.29); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('♪', this.rally.x, this.rally.y - 32 - Math.sin(t) * 3);
    }
  }
}

const TRAIL_STEP = 7;
