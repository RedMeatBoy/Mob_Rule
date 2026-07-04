// fx.js — the juice: particles, damage numbers, whistle rings, merge
// fanfares, confetti, screen shake. If it happens, it sparkles.

import { Pool, randRange, pick, clamp, lerp } from './pool.js';

const LEAF = ['#7ec850', '#5aa53a', '#a8e070'];
const SPARK = ['#fff6b0', '#ffe066', '#ffffff'];
const CONFETTI = ['#ff8fb3', '#ffd166', '#7ec850', '#5aa9ff', '#c792ea'];

export class FX {
  constructor() {
    this.parts = new Pool(() => ({
      x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      size: 3, color: '#fff', type: 'dot', rot: 0, vrot: 0, grav: 0, drag: 2,
    }));
    this.nums = new Pool(() => ({ x: 0, y: 0, vy: 0, life: 0, txt: '', color: '#fff', size: 12 }));
    this.rings = [];
    this.trauma = 0;
    this.shakeEnabled = true;
    this.shakeX = 0; this.shakeY = 0;
  }
  clear() { this.parts.clear(); this.nums.clear(); this.rings.length = 0; this.trauma = 0; }
  shake(n) { this.trauma = clamp(this.trauma + n, 0, 1); }

  spawn(x, y, o) {
    const p = this.parts.alloc();
    p.x = p.px = x; p.y = p.py = y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = p.maxLife = o.life || 0.6;
    p.size = o.size || 3; p.color = o.color || '#fff';
    p.type = o.type || 'dot';
    p.rot = randRange(0, 6.28); p.vrot = o.vrot != null ? o.vrot : randRange(-6, 6);
    p.grav = o.grav || 0; p.drag = o.drag != null ? o.drag : 2;
    return p;
  }
  burst(x, y, n, speed, o) {
    for (let i = 0; i < n; i++) {
      const a = randRange(0, 6.28), s = randRange(speed * 0.4, speed);
      this.spawn(x, y, {
        ...o, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: randRange((o.life || 0.6) * 0.6, (o.life || 0.6) * 1.3),
        size: randRange((o.size || 3) * 0.7, (o.size || 3) * 1.4),
        color: o.colors ? pick(o.colors) : o.color,
      });
    }
  }
  leaves(x, y, n) { this.burst(x, y, n, 120, { type: 'leaf', colors: LEAF, size: 4, life: 0.6, grav: 70 }); }
  sparks(x, y, n) { this.burst(x, y, n, 160, { type: 'spark', colors: SPARK, size: 2.5, life: 0.3 }); }
  botScrap(x, y, n) {
    this.burst(x, y, n, 150, { type: 'spark', colors: ['#b8bec8', '#8a8a96', '#5aa9ff'], size: 3, life: 0.45, grav: 240 });
    this.burst(x, y, 3, 60, { type: 'puff', colors: ['#d8d8e0'], size: 5, life: 0.5, grav: -40 });
  }
  confetti(x, y, n) { this.burst(x, y, n || 26, 240, { type: 'confetti', colors: CONFETTI, size: 5, life: 1.3, grav: 160, drag: 1.2 }); }
  hearts(x, y, n) { this.burst(x, y, n, 60, { type: 'heart', colors: ['#ff8fb3', '#ffb7c5'], size: 5, life: 0.8, grav: -60 }); }
  notes(x, y, n) { this.burst(x, y, n, 60, { type: 'note', colors: ['#fff', '#aef2ff'], size: 8, life: 0.9, grav: -50, vrot: 2 }); }
  mergeFlash(x, y) {
    this.sparks(x, y, 16);
    this.confetti(x, y, 12);
    this.ring(x, y, 70, '#ffd166', 0.5);
    this.ring(x, y, 40, '#ffffff', 0.35);
  }
  ring(x, y, r, color, dur) { this.rings.push({ x, y, r, color, life: dur, maxLife: dur }); }
  num(x, y, txt, color, size, life) {
    const d = this.nums.alloc();
    d.x = x + randRange(-6, 6); d.y = y - 8;
    d.life = life || 0.55;
    d.vy = d.life > 1 ? -14 : -50; // long-lived text drifts slowly so it's readable
    d.txt = String(txt); d.color = color || '#fff'; d.size = size || 12;
  }
  // Important announcements: big, slow, on screen long enough to actually read.
  notice(x, y, txt, color, size) { this.num(x, y, txt, color, size || 15, 2.6); }

  update(dt) {
    const P = this.parts;
    for (let i = P.n - 1; i >= 0; i--) {
      const p = P.get(i);
      p.px = p.x; p.py = p.y;
      p.life -= dt;
      if (p.life <= 0) { P.release(i); continue; }
      p.vy += p.grav * dt;
      const dr = 1 - Math.min(1, p.drag * dt);
      p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    const N = this.nums;
    for (let i = N.n - 1; i >= 0; i--) {
      const d = N.get(i);
      d.life -= dt;
      if (d.life <= 0) { N.release(i); continue; }
      d.y += d.vy * dt; d.vy *= 1 - 2.5 * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    if (this.shakeEnabled && this.trauma > 0) {
      const m = this.trauma * this.trauma * 13;
      this.shakeX = randRange(-m, m); this.shakeY = randRange(-m, m);
    } else { this.shakeX = 0; this.shakeY = 0; }
  }

  render(ctx, alpha) {
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + t), 0, 6.29); ctx.stroke();
    }
    const P = this.parts;
    for (let i = 0; i < P.n; i++) {
      const p = P.get(i);
      const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.fillStyle = p.color;
      switch (p.type) {
        case 'leaf':
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, 6.29); ctx.fill();
          ctx.restore();
          break;
        case 'confetti':
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
          break;
        case 'spark': {
          const s = p.size * t;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
          break;
        }
        case 'heart':
          ctx.font = `${p.size * 2}px sans-serif`;
          ctx.fillText('♥', x, y);
          break;
        case 'note':
          ctx.font = `bold ${p.size + 4}px sans-serif`;
          ctx.fillText('♪', x, y);
          break;
        case 'puff':
          ctx.beginPath(); ctx.arc(x, y, p.size * (1.4 - t * 0.5), 0, 6.29); ctx.fill();
          break;
        default:
          ctx.beginPath(); ctx.arc(x, y, p.size * (0.5 + t * 0.5), 0, 6.29); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const N = this.nums;
    ctx.textAlign = 'center';
    for (let i = 0; i < N.n; i++) {
      const d = N.get(i);
      ctx.globalAlpha = Math.min(1, d.life * 3);
      ctx.font = `bold ${d.size}px "Trebuchet MS", sans-serif`;
      ctx.strokeStyle = 'rgba(30,40,20,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(d.txt, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(d.txt, d.x, d.y);
    }
    ctx.globalAlpha = 1;
  }
}
