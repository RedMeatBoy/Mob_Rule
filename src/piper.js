// piper.js — the player. You walk, the mob follows YOUR path. You whistle,
// the mob surges. That's the whole verb set, and it's enough.

import { clamp, lerp } from './pool.js';
import { CHARACTERS } from './data.js';

export const PIPER_COLORS = ['#e05c5c', '#5aa9ff'];

export class Piper {
  constructor(slot, x, y, little, chr) {
    this.slot = slot;
    this.little = !!little;
    this.char = chr || CHARACTERS[0];
    this.sendCd = 0;
    this.color = PIPER_COLORS[slot];
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.speed = 175 * (this.char.speedMul || 1);
    this.maxHp = little ? 140 : 100;
    this.hp = this.maxHp;
    this.regen = little ? 1.2 : 0.7;   // HP per second (pauses briefly after a hit)
    this.sinceHit = 99;
    this.invuln = 0;
    this.face = 1;
    this.walk = 0;
    this.dead = false; this.downed = false;
    this.reviveP = 0;
    this.charm = false;
    this.whistleAnim = 0;
    this.sendAcc = 0; this.recallAcc = 0;   // hold-to-stream send/recall
    this.magnet = little ? 150 : 95;
  }

  update(dt, game, inp) {
    this.px = this.x; this.py = this.y;
    this.invuln = Math.max(0, this.invuln - dt);
    this.sendCd = Math.max(0, this.sendCd - dt);
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

    // Regen: steady trickle that pauses for 2.5s after taking a hit.
    this.sinceHit += dt;
    if (this.sinceHit > 2.5 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    }
    this.whistleAnim = Math.max(0, this.whistleAnim - dt);

    // Charm aura (crossroads pick): nearby bots get dizzy.
    if (this.charm) {
      game.enemies.each(this.x, this.y, 110, e => { e.slowT = Math.max(e.slowT || 0, 0.4); });
    }
  }

  hurt(game, dmg, src) {
    if (this.invuln > 0 || this.dead || this.downed) return;
    let amount = Math.max(1, Math.round(dmg * (this.little ? 0.7 : 1)));
    this.hp -= amount;
    this.sinceHit = 0;
    this.invuln = this.little ? 1.1 : 0.8;
    game.audio.sfx('hurt');
    game.shake(0.3);
    game.fx.sparks(this.x, this.y, 6);
    game.fx.num(this.x, this.y - 30, '-' + amount, '#ff6a6a', 15);
    // Make piper damage IMPOSSIBLE to miss — the piper is the loss condition.
    game.ui.piperHit(this, amount);
    if (src) {
      const dx = this.x - src.x, dy = this.y - src.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += dx / d * 14; this.y += dy / d * 14;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.downed = true;
      this.reviveP = 0;
      game.onPiperDown(this);
    }
  }

  heal(game, amount) {
    if (this.dead || this.downed || this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    game.fx.hearts(this.x, this.y - 20, 4);
    game.fx.num(this.x, this.y - 34, '+' + amount, '#7ec850', 13);
    game.audio.sfx('chime');
    return true;
  }

  revive(game) {
    this.downed = false;
    this.hp = Math.ceil(this.maxHp * 0.5);
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
    if (this.char.id === 'vivi') {
      // Pink dress over the jacket, twirl-ready.
      ctx.fillStyle = '#ff9ec4';
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(7, -5); ctx.lineTo(10, 7); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff7eb0';
      ctx.fillRect(-7, -6, 14, 3);
      // Hair with two big bows.
      ctx.fillStyle = '#8a5a3a';
      ctx.beginPath(); ctx.arc(0, -13, 7.2, 3.3, 6.2); ctx.fill();
      for (const bx of [-6, 6]) {
        ctx.fillStyle = '#ff5c9e';
        ctx.beginPath(); ctx.ellipse(bx - 2, -18, 2.7, 1.9, -0.5, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx + 2, -18, 2.7, 1.9, 0.5, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#ffd0e4';
        ctx.beginPath(); ctx.arc(bx, -18, 1.4, 0, 6.29); ctx.fill();
      }
      // Eye + smile.
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(2.5, -13, 2, 2.4);
      // Violin (out while playing).
      if (this.whistleAnim > 0) {
        ctx.fillStyle = '#a06a3a';
        ctx.beginPath(); ctx.ellipse(8, -10, 4, 5.5, 0.4, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(9, -18, 2, 8);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(3, -16); ctx.lineTo(14, -6); ctx.stroke();
      }
    } else if (this.char.id === 'bam') {
      // Backwards cap.
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, -14.5, 6.5, 3.14, 6.29); ctx.fill();
      ctx.fillRect(-9, -15.5, 5, 3);
      // Eye.
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(2.5, -13, 2, 2.4);
      // Marching drum on his belly.
      ctx.fillStyle = '#efe6d4';
      ctx.beginPath(); ctx.ellipse(6, -1, 5, 6, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#c9a05a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(6, -1, 5, 6, 0, 0, 6.29); ctx.stroke();
      ctx.strokeStyle = '#e05c5c';
      ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(10, 3); ctx.moveTo(10, -5); ctx.lineTo(2, 3); ctx.stroke();
      // Drumsticks flail while drumming.
      if (this.whistleAnim > 0) {
        ctx.strokeStyle = '#c9a05a'; ctx.lineWidth = 2;
        const w = Math.sin(this.walk * 4) * 3;
        ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(8, -15 + w); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, -9); ctx.lineTo(14, -14 - w); ctx.stroke();
      }
    } else {
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
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Player ring + label.
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 13, 15, 6, 0, 0, 6.29); ctx.stroke();
    ctx.globalAlpha = 1;

    // HP bar floats over the piper's head — health lives where the eyes are.
    const frac = Math.max(0, this.hp / this.maxHp);
    const low = frac < 0.25;
    const bw = 34, bh = 5;
    ctx.fillStyle = 'rgba(20,30,15,0.6)';
    ctx.fillRect(x - bw / 2 - 1, y - 40, bw + 2, bh + 2);
    ctx.fillStyle = low ? (Math.sin(game.time * 10) > 0 ? '#ff5c5c' : '#c53030') : frac < 0.55 ? '#e8c33a' : '#7ec850';
    ctx.fillRect(x - bw / 2, y - 39, bw * frac, bh);
    if (this.little) {
      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', x + 14, y - 24);
    }

  }
}

