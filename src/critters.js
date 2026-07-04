// critters.js — THE MOB. Critters follow the path their piper walked (a
// living conga-swarm), fight automatically by role, and auto-merge 3 → 1
// evolved. The mob is the health bar, the weapon, and the progression.

import { Pool, Grid, clamp, lerp, dist2, randRange, makeSprite } from './pool.js';
import { SPECIES, TIER_MULT, MOB_CAP, MERGE_LINES } from './data.js';

const AGGRO = 150;         // enemies this close to a critter get attacked
const LEASH = 420;         // farther than this from the piper: come home
const SENT_AGGRO = 240;    // aggro radius around a whistle rally point

export function statFor(sp, tier, key) {
  const base = SPECIES[sp][key] || 0;
  if (key === 'dmg' || key === 'hp' || key === 'heal') return base * Math.pow(TIER_MULT.dmg, tier - 1);
  if (key === 'size') return base * Math.pow(TIER_MULT.size, tier - 1);
  return base;
}

export class MobSystem {
  constructor() {
    this.list = [];
    this.grid = new Grid(1800, 1400, 80);
    this.sprites = {};
    this.buffs = { dmg: 0, hp: 0, speed: 0, atkspd: 0, crit: 0 };
    this.wild = { bunnyBreed: false, crown: false, beeFuneral: false };
    this.time = 0;
    this.biggest = 0;
  }

  count() { return this.list.length; }
  countOf(sp, tier) {
    let n = 0;
    for (const c of this.list) if (c.sp === sp && c.tier === tier && !c.bagged) n++;
    return n;
  }

  add(game, sp, tier, x, y, owner, silent) {
    if (this.list.length >= MOB_CAP) {
      // Full house: turn the recruit into snacks (and a joke).
      game.acorns(3, x, y);
      if (!silent) game.fx.num(x, y - 14, 'MOB FULL! +3 🌰', '#ffd166', 11);
      return null;
    }
    const def = SPECIES[sp];
    const c = {
      sp, tier: tier || 1,
      x, y, px: x, py: y, vx: 0, vy: 0,
      hp: this.maxHp(sp, tier || 1), owner: owner || 0,
      state: 'follow', target: null,
      atkT: randRange(0, 0.4), cdT: 0,
      lag: 12 + this.list.length * 2.2 + randRange(0, 10),
      side: randRange(-16, 16),
      wob: randRange(0, 6.28), squash: 0, hitT: 0,
      face: 1, bagged: false, crowned: false,
      breedT: randRange(8, 14),
    };
    this.list.push(c);
    this.biggest = Math.max(this.biggest, this.list.length);
    if (!silent) {
      game.fx.hearts(x, y - 10, 3);
      game.audio.sfx('recruit');
      game.audio.sfx(def.sound);
    }
    this.tryMerge(game, c);
    return c;
  }

  maxHp(sp, tier) {
    return statFor(sp, tier, 'hp') * (1 + this.buffs.hp);
  }
  dmgOf(c) {
    let d = statFor(c.sp, c.tier, 'dmg') * (1 + this.buffs.dmg);
    if (c.crowned) d *= 1.5;
    if (Math.random() < this.buffs.crit) d *= 2;
    return d;
  }

  // Three of a kind become one bigger kind. Cascades. Fanfare mandatory.
  tryMerge(game, newest) {
    const same = this.list.filter(c => c.sp === newest.sp && c.tier === newest.tier && !c.bagged);
    if (same.length < 3 || newest.tier >= 3) return;
    // Absorb the two oldest into the newest.
    const eat = same.filter(c => c !== newest).slice(0, 2);
    for (const c of eat) this.remove(c);
    newest.tier += 1;
    newest.hp = this.maxHp(newest.sp, newest.tier);
    game.fx.mergeFlash(newest.x, newest.y);
    game.fx.num(newest.x, newest.y - 26, MERGE_LINES[Math.floor(Math.random() * MERGE_LINES.length)], '#ffd166', 16);
    game.fx.num(newest.x, newest.y - 10, SPECIES[newest.sp].tierNames[newest.tier - 1], '#fff', 12);
    game.audio.sfx('merge');
    game.shake(0.15);
    if (this.wild.crown) this.recrown(game);
    this.tryMerge(game, newest); // cascade
  }

  remove(c) {
    c._gone = true; // survives mid-iteration removal (merges during combat)
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
  }

  recrown(game) {
    let best = null, bs = -1;
    for (const c of this.list) {
      c.crowned = false;
      const s = statFor(c.sp, c.tier, 'hp') + statFor(c.sp, c.tier, 'dmg') * 5;
      if (s > bs) { bs = s; best = c; }
    }
    if (best && !best.crowned) {
      best.crowned = true;
      game.fx.sparks(best.x, best.y - 14, 8);
      game.audio.sfx('crown');
    }
  }

  hurt(game, c, dmg, src) {
    if (c.bagged) return;
    c.hp -= dmg;
    c.hitT = 0.12;
    if (c.hp <= 0) {
      this.remove(c);
      game.fx.leaves(c.x, c.y, 6);
      game.audio.sfx('critterlost');
      if (c.crowned && this.wild.crown) this.recrown(game);
      if (this.wild.beeFuneral && c.sp !== 'bee') {
        const owner = game.players[c.owner] || game.players[0];
        this.add(game, 'bee', 1, c.x, c.y, c.owner, true);
        game.fx.num(c.x, c.y - 14, 'a bee remembers', '#ffd24a', 10);
      }
    }
  }

  update(dt, game) {
    this.time += dt;
    this.grid.clear();
    for (const c of this.list) this.grid.insert(c.x, c.y, c);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      // Merges triggered mid-pass (boss drops, bunny breeding) can shrink the
      // list at arbitrary indices — guard both the hole and stale entries.
      if (!c || c._gone || c.bagged) continue;
      c.px = c.x; c.py = c.y;
      c.wob += dt * 8;
      c.hitT = Math.max(0, c.hitT - dt);
      c.squash = Math.max(0, c.squash - dt * 4);
      c.atkT -= dt;
      c.cdT -= dt;

      const piper = game.players[c.owner] && !game.players[c.owner].dead
        ? game.players[c.owner]
        : game.players.find(p => !p.dead);
      if (!piper) continue;
      const def = SPECIES[c.sp];
      const spd = statFor(c.sp, c.tier, 'speed') * (1 + this.buffs.speed);

      // ---- target acquisition ----
      const sent = piper.rallyT > 0;
      const anchor = sent ? piper.rally : { x: c.x, y: c.y };
      const seekR = sent ? SENT_AGGRO : AGGRO;
      if (!c.target || c.target.dead) {
        c.target = null;
        if (def.role !== 'heal') {
          c.target = game.enemies.nearest(anchor.x, anchor.y, seekR)
            || (sent ? game.enemies.nearest(c.x, c.y, AGGRO) : null);
        }
      } else if (!sent && dist2(c.target.x, c.target.y, piper.x, piper.y) > LEASH * LEASH) {
        c.target = null; // don't chase to the next county
      }

      // ---- role behaviors ----
      let moved = false;
      if (def.role === 'heal') {
        moved = this.behaveHealer(c, dt, game, piper, spd);
      } else if (c.target) {
        moved = this.behaveCombat(c, dt, game, def, spd);
      }

      if (!moved) {
        // FOLLOW: trail of the piper — the conga line that makes it alive.
        const pt = piper.trailPoint(c.lag, c.side);
        const dx = pt.x - c.x, dy = pt.y - c.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) {
          const rush = sent ? 1.35 : d > 120 ? 1.5 : 1;
          c.vx = (dx / d) * spd * rush;
          c.vy = (dy / d) * spd * rush;
        } else { c.vx *= 0.8; c.vy *= 0.8; }
        if (sent) {
          // Whistled: surge toward the rally point instead.
          const rx = piper.rally.x + c.side * 1.5, ry = piper.rally.y + (c.lag % 60) - 30;
          const rd = Math.hypot(rx - c.x, ry - c.y);
          if (rd > 14) { c.vx = (rx - c.x) / rd * spd * 1.4; c.vy = (ry - c.y) / rd * spd * 1.4; }
        }
      }

      // Separation (soft, cheap).
      let sx = 0, sy = 0, cnt = 0;
      this.grid.query(c.x, c.y, 18, o => {
        if (o === c || cnt >= 4) return;
        const d2 = dist2(c.x, c.y, o.x, o.y);
        if (d2 > 1 && d2 < 18 * 18) {
          const d = Math.sqrt(d2);
          sx += (c.x - o.x) / d * (18 - d);
          sy += (c.y - o.y) / d * (18 - d);
          cnt++;
        }
      });
      c.x += (c.vx + sx * 3.2) * dt;
      c.y += (c.vy + sy * 3.2) * dt;
      c.x = clamp(c.x, 30, game.arena.w - 30);
      c.y = clamp(c.y, 30, game.arena.h - 30);
      if (Math.abs(c.vx) > 8) c.face = c.vx > 0 ? 1 : -1;

      // Wild: bunny breeding.
      if (this.wild.bunnyBreed && c.sp === 'bunny') {
        c.breedT -= dt;
        if (c.breedT <= 0) {
          c.breedT = randRange(10, 16);
          if (this.list.length < MOB_CAP) {
            this.add(game, 'bunny', 1, c.x + randRange(-8, 8), c.y + randRange(-8, 8), c.owner, true);
            game.fx.hearts(c.x, c.y - 12, 4);
            game.audio.sfx('squeak');
          }
        }
      }
    }
  }

  behaveCombat(c, dt, game, def, spd) {
    const t = c.target;
    const d = Math.hypot(t.x - c.x, t.y - c.y);
    const reach = t.size + statFor(c.sp, c.tier, 'size') * 0.7 + 4;

    switch (def.role) {
      case 'ranged':
      case 'homing': {
        const range = def.range * (1 + (c.tier - 1) * 0.15);
        if (d > range) { this.seek(c, t.x, t.y, spd); return true; }
        c.vx *= 0.8; c.vy *= 0.8;
        c.face = t.x > c.x ? 1 : -1;
        if (c.atkT <= 0) {
          c.atkT = def.atkTime / (1 + this.buffs.atkspd);
          c.squash = 0.5;
          game.spawnProj(c.x, c.y - 6, t, this.dmgOf(c), def.role === 'homing', SPECIES[c.sp].accent);
          game.audio.sfx(def.sound);
        }
        return true;
      }
      case 'charge': {
        if (c.cdT <= 0 && d < 180 && d > 30) {
          c.cdT = def.atkTime / (1 + this.buffs.atkspd);
          const a = Math.atan2(t.y - c.y, t.x - c.x);
          c.vx = Math.cos(a) * spd * 3.2;
          c.vy = Math.sin(a) * spd * 3.2;
          c.squash = 0.6;
          game.audio.sfx(def.sound);
          return true;
        }
        if (d < reach + 6 && Math.hypot(c.vx, c.vy) > spd * 1.5) {
          game.enemies.hurt(game, t, this.dmgOf(c), c, { kx: c.vx * 0.8, ky: c.vy * 0.8 });
          c.vx *= -0.4; c.vy *= -0.4;
          return true;
        }
        this.seek(c, t.x, t.y, spd);
        return true;
      }
      case 'aoe': {
        if (d > def.radius * 0.8) { this.seek(c, t.x, t.y, spd); return true; }
        c.vx *= 0.8; c.vy *= 0.8;
        if (c.cdT <= 0) {
          c.cdT = def.cooldown;
          game.skunkCloud(c.x, c.y, def.radius * (1 + (c.tier - 1) * 0.25), this.dmgOf(c), c.tier);
          game.audio.sfx('pfft');
          c.squash = 0.6;
        }
        return true;
      }
      case 'slam': {
        if (d > reach + 10) { this.seek(c, t.x, t.y, spd); return true; }
        c.vx *= 0.7; c.vy *= 0.7;
        if (c.atkT <= 0) {
          c.atkT = def.atkTime / (1 + this.buffs.atkspd);
          c.squash = 0.8;
          const r = def.radius * (1 + (c.tier - 1) * 0.3);
          game.fx.ring(c.x, c.y, r, '#c9a05a', 0.35);
          game.shake(0.12);
          game.audio.sfx(def.sound);
          game.enemies.each(t.x, t.y, r, e => game.enemies.hurt(game, e, this.dmgOf(c), c, {}));
        }
        return true;
      }
      case 'pierce': {
        if (c.cdT <= 0 && d < 220) {
          c.cdT = def.atkTime / (1 + this.buffs.atkspd);
          const a = Math.atan2(t.y - c.y, t.x - c.x);
          c.vx = Math.cos(a) * spd * 3.8;
          c.vy = Math.sin(a) * spd * 3.8;
          c.slideT = 0.5;
          c.squash = 0.6;
          game.audio.sfx(def.sound);
        }
        if (c.slideT > 0) {
          c.slideT -= dt;
          game.enemies.each(c.x, c.y, 20, e => {
            if (e._slid !== c) { e._slid = c; game.enemies.hurt(game, e, this.dmgOf(c), c, { kx: c.vx * 0.3, ky: c.vy * 0.3 }); }
          });
          return true;
        }
        this.seek(c, t.x, t.y, spd * 0.8);
        return true;
      }
      default: { // melee / tank
        if (d > reach) { this.seek(c, t.x, t.y, spd); return true; }
        c.vx *= 0.6; c.vy *= 0.6;
        c.face = t.x > c.x ? 1 : -1;
        if (c.atkT <= 0) {
          c.atkT = def.atkTime / (1 + this.buffs.atkspd);
          c.squash = 0.6;
          game.enemies.hurt(game, t, this.dmgOf(c), c, {});
          if (Math.random() < 0.25) game.audio.sfx(def.sound);
        }
        return true;
      }
    }
  }

  behaveHealer(c, dt, game, piper, spd) {
    // Find the hurt friend, hover nearby, pulse.
    let best = null, bd = Infinity;
    for (const o of this.list) {
      if (o === c || o.bagged) continue;
      const max = this.maxHp(o.sp, o.tier);
      if (o.hp >= max) continue;
      const d2 = dist2(c.x, c.y, o.x, o.y);
      if (d2 < bd) { bd = d2; best = o; }
    }
    if (!best) return false;
    const d = Math.sqrt(bd);
    if (d > 40) this.seek(c, best.x, best.y, spd);
    else { c.vx *= 0.8; c.vy *= 0.8; }
    if (c.atkT <= 0 && d < SPECIES[c.sp].radius) {
      c.atkT = SPECIES[c.sp].atkTime / (1 + this.buffs.atkspd);
      const amt = statFor(c.sp, c.tier, 'heal');
      let healed = 0;
      for (const o of this.list) {
        if (healed >= 3 || o.bagged) continue;
        if (dist2(c.x, c.y, o.x, o.y) < SPECIES[c.sp].radius ** 2) {
          const max = this.maxHp(o.sp, o.tier);
          if (o.hp < max) {
            o.hp = Math.min(max, o.hp + amt);
            game.fx.hearts(o.x, o.y - 10, 1);
            healed++;
          }
        }
      }
      if (healed) { game.audio.sfx('chime'); c.squash = 0.4; }
    }
    return true;
  }

  seek(c, x, y, spd) {
    const d = Math.hypot(x - c.x, y - c.y) || 1;
    c.vx = (x - c.x) / d * spd;
    c.vy = (y - c.y) / d * spd;
  }

  nearest(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const c of this.list) {
      if (c.bagged) continue;
      const d2 = dist2(x, y, c.x, c.y);
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  // ---- rendering ----
  sprite(sp, tier) {
    const key = sp + tier;
    if (!this.sprites[key]) {
      const size = statFor(sp, tier, 'size') * 2.6 + 16;
      this.sprites[key] = makeSprite(Math.ceil(size), (ctx, s) => drawCritterBody(ctx, SPECIES[sp], statFor(sp, tier, 'size'), tier));
    }
    return this.sprites[key];
  }

  render(ctx, alpha, game) {
    for (const c of this.list) {
      if (c.bagged) continue;
      const x = lerp(c.px, c.x, alpha);
      const y = lerp(c.py, c.y, alpha);
      const def = SPECIES[c.sp];
      const size = statFor(c.sp, c.tier, 'size');
      const spr = this.sprite(c.sp, c.tier);
      const hop = def.flies
        ? Math.sin(c.wob) * 3
        : (Math.abs(c.vx) + Math.abs(c.vy) > 20 ? Math.abs(Math.sin(c.wob)) * -4 : 0);
      const sq = 1 + c.squash * 0.3;

      // Shadow.
      ctx.fillStyle = 'rgba(40,60,30,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.8, size * 0.8, size * 0.3, 0, 0, 6.29);
      ctx.fill();

      ctx.save();
      ctx.translate(x, y + hop);
      ctx.scale(c.face * sq, 2 - sq);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();

      if (c.hitT > 0) {
        ctx.globalAlpha = c.hitT * 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y + hop, size, 0, 6.29); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (c.crowned) drawCrown(ctx, x, y + hop - size - 6, size * 0.7);
      if (c.tier === 3) { // kings sparkle
        if (Math.random() < 0.06) game.fx.sparks(x + randRange(-8, 8), y - size, 1);
      }
    }
  }
}

// ---- procedural critter bodies (cached once per species+tier) ----
function drawCritterBody(ctx, def, size, tier) {
  const s = size / 11;
  ctx.lineWidth = Math.max(1.4, 1.6 * s);
  ctx.strokeStyle = 'rgba(30,40,25,0.35)';

  if (def.wings) { // butterfly
    ctx.fillStyle = def.body;
    for (const m of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(m * 6 * s, -3 * s, 6 * s, 8 * s, m * 0.5, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.belly;
      ctx.beginPath(); ctx.arc(m * 6 * s, -2 * s, 2.5 * s, 0, 6.29); ctx.fill();
      ctx.fillStyle = def.body;
    }
    ctx.fillStyle = def.accent;
    ctx.beginPath(); ctx.ellipse(0, 0, 2 * s, 6 * s, 0, 0, 6.29); ctx.fill();
    dotEyes(ctx, s, -1.5, -5);
    return;
  }

  if (def.shape === 'quad') { // goat / skunk / moose
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(-1 * s, 0, 8.5 * s, 6 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
    // Head.
    ctx.beginPath(); ctx.arc(7 * s, -4 * s, 4.5 * s, 0, 6.29); ctx.fill(); ctx.stroke();
    // Legs.
    ctx.fillStyle = def.accent;
    ctx.fillRect(-6 * s, 4 * s, 2.4 * s, 5 * s);
    ctx.fillRect(2 * s, 4 * s, 2.4 * s, 5 * s);
    if (def.tail) { // skunk plume
      ctx.fillStyle = def.accent;
      ctx.beginPath(); ctx.ellipse(-9 * s, -5 * s, 4 * s, 7 * s, 0.5, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.body;
      ctx.beginPath(); ctx.ellipse(-9.5 * s, -5 * s, 1.6 * s, 5 * s, 0.5, 0, 6.29); ctx.fill();
    }
    if (def.horns) {
      ctx.fillStyle = '#c9b89a';
      ctx.beginPath(); ctx.moveTo(5 * s, -7 * s); ctx.quadraticCurveTo(3 * s, -11 * s, 6 * s, -11 * s); ctx.quadraticCurveTo(6.5 * s, -8.5 * s, 7.5 * s, -7.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (def.antlers) {
      ctx.fillStyle = '#c9a05a';
      for (const m of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(7 * s + m * 3.4 * s, -9.5 * s, 3.6 * s, 2 * s, m * 0.4, 0, 6.29); ctx.fill(); ctx.stroke();
      }
    }
    // Belly + eye.
    ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.ellipse(-1 * s, 2 * s, 5 * s, 3 * s, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(8 * s, -4.5 * s, 0.9 * s, 0, 6.29); ctx.fill();
    return;
  }

  if (def.shape === 'bird') { // duck / owl / penguin
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * s, 7.5 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.ellipse(1 * s, 2 * s, 4 * s, 4.5 * s, 0, 0, 6.29); ctx.fill();
    // Wing.
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(-4 * s, 0, 3 * s, 4.5 * s, -0.3, 0, 6.29); ctx.fill(); ctx.stroke();
    // Beak.
    ctx.fillStyle = def.accent;
    ctx.beginPath(); ctx.moveTo(5.5 * s, -3 * s); ctx.lineTo(9.5 * s, -2 * s); ctx.lineTo(5.5 * s, -0.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (def.tufts) {
      ctx.fillStyle = def.body;
      ctx.beginPath(); ctx.moveTo(-3 * s, -7 * s); ctx.lineTo(-2 * s, -10 * s); ctx.lineTo(-0.5 * s, -7 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1 * s, -7 * s); ctx.lineTo(2.5 * s, -10 * s); ctx.lineTo(3.5 * s, -7 * s); ctx.closePath(); ctx.fill();
    }
    dotEyes(ctx, s, 2, -4);
    return;
  }

  if (def.shape === 'shell') { // turtle
    ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.ellipse(4 * s, 2 * s, 4 * s, 3 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.arc(-1 * s, 0, 7 * s, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = def.accent;
    ctx.beginPath(); ctx.moveTo(-5 * s, -2 * s); ctx.lineTo(3 * s, -2 * s); ctx.moveTo(-1 * s, -6 * s); ctx.lineTo(-1 * s, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,40,25,0.35)';
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(7 * s, 0.5 * s, 0.9 * s, 0, 6.29); ctx.fill();
    return;
  }

  if (def.shape === 'bug') { // bee
    if (def.flies) {
      ctx.fillStyle = 'rgba(220,235,255,0.75)';
      ctx.beginPath(); ctx.ellipse(-1 * s, -6 * s, 4.5 * s, 2.2 * s, -0.3, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-3.5 * s, -5 * s, 3.6 * s, 1.8 * s, 0.25, 0, 6.29); ctx.fill();
    }
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * s, 5 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
    if (def.stripes) {
      ctx.fillStyle = def.accent;
      ctx.fillRect(-3.2 * s, -4.5 * s, 2 * s, 9 * s);
      ctx.fillRect(0.6 * s, -5 * s, 2 * s, 10 * s);
    }
    dotEyes(ctx, s, 3.4, -1.5);
    return;
  }

  // blob (frog / bunny / wizard mouse)
  ctx.fillStyle = def.body;
  ctx.beginPath(); ctx.ellipse(0, 0.5 * s, 7 * s, 6 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
  ctx.fillStyle = def.belly;
  ctx.beginPath(); ctx.ellipse(0.5 * s, 2.5 * s, 4.5 * s, 3.2 * s, 0, 0, 6.29); ctx.fill();
  if (def.ears) {
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(-2.5 * s, -8 * s, 1.8 * s, 5 * s, -0.1, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(2 * s, -8 * s, 1.8 * s, 5 * s, 0.1, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.accent;
    ctx.beginPath(); ctx.ellipse(-2.5 * s, -7.5 * s, 0.8 * s, 3 * s, -0.1, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2 * s, -7.5 * s, 0.8 * s, 3 * s, 0.1, 0, 6.29); ctx.fill();
  }
  if (def.hat) { // wizard
    ctx.fillStyle = def.accent;
    ctx.beginPath(); ctx.moveTo(-4.5 * s, -4.5 * s); ctx.lineTo(0.5 * s, -12 * s); ctx.lineTo(5 * s, -4.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd966';
    ctx.beginPath(); ctx.arc(0.5 * s, -8.5 * s, 1 * s, 0, 6.29); ctx.fill();
  }
  if (def.sound === 'ribbit') { // froggy eye bumps
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.arc(-2.6 * s, -5.5 * s, 2 * s, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(2.6 * s, -5.5 * s, 2 * s, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-2.6 * s, -5.5 * s, 1.2 * s, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(2.6 * s, -5.5 * s, 1.2 * s, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(-2.2 * s, -5.5 * s, 0.6 * s, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(3 * s, -5.5 * s, 0.6 * s, 0, 6.29); ctx.fill();
  } else dotEyes(ctx, s, 2, -2);
}

function dotEyes(ctx, s, ox, oy) {
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath(); ctx.arc(ox * s, oy * s, 1 * s, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc((ox + 3) * s, oy * s, 1 * s, 0, 6.29); ctx.fill();
}

export function drawCrown(ctx, x, y, w) {
  ctx.fillStyle = '#ffd966';
  ctx.strokeStyle = 'rgba(120,80,20,0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + 4);
  ctx.lineTo(x - w / 2, y - 3);
  ctx.lineTo(x - w / 4, y);
  ctx.lineTo(x, y - 5);
  ctx.lineTo(x + w / 4, y);
  ctx.lineTo(x + w / 2, y - 3);
  ctx.lineTo(x + w / 2, y + 4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}
