// enemies.js — the Tidy Empire: bots that think animals are clutter.
// Plus three bosses: MOWTRON 9000, THE SUCC-5000, and THE SUPERVISOR.

import { Pool, Grid, clamp, lerp, dist2, randRange, makeSprite } from './pool.js';
import { ENEMIES, enemyScale, TIDY_LINES } from './data.js';

export class EnemySystem {
  constructor(arenaW, arenaH) {
    this.pool = new Pool(() => ({
      x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
      kind: null, def: null, hp: 1, maxHp: 1, dmg: 1, speed: 50, size: 12,
      state: 'move', t1: 0, t2: 0, dirX: 0, dirY: 0, face: 1,
      hitT: 0, slowT: 0, kx: 0, ky: 0, touchCd: 0,
      dead: false, elite: false, boss: false, bagged: null, atk: 0, phase2: false,
      barkT: 0,
    }));
    this.grid = new Grid(arenaW, arenaH, 90);
    this.sprites = {};
    this.telegraphs = []; // spawn-in markers
    this.time = 0;
  }

  clear() { this.pool.clear(); this.telegraphs.length = 0; }
  count() { return this.pool.n; }

  telegraphSpawn(kind, x, y, elite) {
    this.telegraphs.push({ kind, x, y, t: 0.6, elite });
  }

  spawnNow(game, kind, x, y, elite) {
    const def = ENEMIES[kind];
    const sc = enemyScale(game.waveNum);
    const e = this.pool.alloc();
    e.x = e.px = x; e.y = e.py = y;
    e.vx = 0; e.vy = 0;
    e.kind = kind; e.def = def;
    e.elite = !!elite;
    e.maxHp = e.hp = def.hp * sc.hp * (elite ? 2.2 : 1);
    e.dmg = Math.max(1, Math.round(def.dmg * sc.dmg * (elite ? 1.5 : 1)));
    e.speed = def.speed * randRange(0.9, 1.1) * (elite ? 1.15 : 1);
    e.size = def.size * (elite ? 1.25 : 1);
    e.state = 'move'; e.t1 = randRange(0.5, 2); e.t2 = 0; e.atk = 0;
    e.hitT = 0; e.slowT = 0; e.kx = 0; e.ky = 0; e.touchCd = 0;
    e.dead = false; e.bagged = null; e.boss = !!def.boss; e.phase2 = false;
    e.face = 1; e.barkT = randRange(4, 12);
    if (e.boss) {
      game.boss = e;
      game.audio.sfx('boss');
      game.shake(0.6);
    }
    return e;
  }

  nearest(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    const P = this.pool;
    for (let i = 0; i < P.n; i++) {
      const e = P.get(i);
      if (e.dead || e.kind === 'cone') continue;
      const d2 = dist2(x, y, e.x, e.y);
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }
  each(x, y, r, fn) {
    const P = this.pool;
    this.grid.query(x, y, r + 40, e => {
      if (e.dead) return;
      if (dist2(x, y, e.x, e.y) <= (r + e.size) * (r + e.size)) fn(e);
    });
  }

  hurt(game, e, dmg, src, opts) {
    if (e.dead || e.hp <= 0) return 0;
    const amt = Math.max(1, Math.round(dmg));
    e.hp -= amt;
    e.hitT = 0.12;
    e.kx += (opts.kx || 0) / (e.boss ? 12 : 2);
    e.ky += (opts.ky || 0) / (e.boss ? 12 : 2);
    game.fx.num(e.x, e.y - e.size - 4, amt, dmg >= statNoise(dmg) ? '#fff' : '#fff', 11);
    game.audio.sfx('pop');
    if (e.hp <= 0) this.die(game, e);
    return amt;
  }

  die(game, e) {
    e.dead = true;
    game.fx.botScrap(e.x, e.y, 8 + (e.boss ? 24 : 0));
    game.audio.sfx('botdie');
    game.runStats.bots++;
    // Sometimes a snack falls out (the bots confiscated them from picnics).
    if (Math.random() < 0.09 && !e.boss) game.dropSnack(e.x, e.y);
    if (e.boss) { game.dropSnack(e.x - 20, e.y); game.dropSnack(e.x + 20, e.y); }
    // Acorns!
    const n = e.def.xp;
    for (let i = 0; i < Math.min(n, 6); i++) {
      game.dropAcorn(e.x + randRange(-10, 10), e.y + randRange(-10, 10), Math.ceil(n / Math.min(n, 6)));
    }
    // Bag-bots release their prisoner.
    if (e.bagged) {
      const c = e.bagged;
      c.bagged = false;
      c.x = e.x; c.y = e.y;
      e.bagged = null;
      game.fx.confetti(e.x, e.y, 10);
      game.fx.num(e.x, e.y - 18, 'FREED!', '#7ec850', 13);
      game.audio.sfx('recruit');
    }
    if (e.boss) {
      game.boss = null;
      game.onBossDown(e);
    }
  }

  update(dt, game) {
    this.time += dt;
    // Spawn telegraphs.
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.spawnNow(game, t.kind, t.x, t.y, t.elite);
        this.telegraphs.splice(i, 1);
      }
    }
    // Grid rebuild.
    this.grid.clear();
    const P = this.pool;
    for (let i = 0; i < P.n; i++) { const e = P.get(i); if (!e.dead) this.grid.insert(e.x, e.y, e); }

    for (let i = P.n - 1; i >= 0; i--) {
      const e = P.get(i);
      if (e.dead) { P.release(i); continue; }
      e.px = e.x; e.py = e.y;
      e.hitT = Math.max(0, e.hitT - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      e.touchCd = Math.max(0, e.touchCd - dt);
      e.barkT -= dt;
      if (e.barkT <= 0 && !e.boss) {
        e.barkT = randRange(14, 30);
        if (Math.random() < 0.25) game.fx.num(e.x, e.y - e.size - 10, TIDY_LINES[Math.floor(Math.random() * TIDY_LINES.length)], '#b8bec8', 8);
      }

      this.behave(e, dt, game);

      // Knockback decay + apply.
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx *= 1 - Math.min(1, 8 * dt);
      e.ky *= 1 - Math.min(1, 8 * dt);
      e.x = clamp(e.x, 26, game.arena.w - 26);
      e.y = clamp(e.y, 26, game.arena.h - 26);
      if (Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;

      // Contact damage: critters first, then pipers.
      if (e.touchCd <= 0 && e.dmg > 0 && e.kind !== 'bagbot') {
        let hitSomething = false;
        game.mob.grid.query(e.x, e.y, e.size + 12, c => {
          if (hitSomething || c.bagged) return;
          if (dist2(e.x, e.y, c.x, c.y) < (e.size + 10) * (e.size + 10)) {
            game.mob.hurt(game, c, e.dmg, e);
            hitSomething = true;
          }
        });
        if (!hitSomething) {
          for (const p of game.players) {
            if (p.dead || p.downed) continue;
            if (dist2(e.x, e.y, p.x, p.y) < (e.size + 12) * (e.size + 12)) {
              p.hurt(game, e.dmg * 6, e);
              hitSomething = true;
            }
          }
        }
        if (hitSomething) e.touchCd = 0.7;
      }
    }
  }

  // Target: nearest critter, else nearest piper. Tanks taunt.
  pickTarget(e, game) {
    let best = null, bd = Infinity, bestTank = null, bt = Infinity;
    for (const c of game.mob.list) {
      if (c.bagged) continue;
      const d2 = dist2(e.x, e.y, c.x, c.y);
      if (d2 < bd) { bd = d2; best = c; }
      if (c.sp === 'turtle' && d2 < bt) { bt = d2; bestTank = c; }
    }
    if (bestTank && bt < 130 * 130) return bestTank;
    let bp = null, bpd = Infinity;
    for (const p of game.players) {
      if (p.dead || p.downed) continue;
      const d2 = dist2(e.x, e.y, p.x, p.y);
      if (d2 < bpd) { bpd = d2; bp = p; }
    }
    if (!best) return bp;
    if (bp && bpd * 1.6 < bd) return bp; // piper much closer: go bother them
    return best;
  }

  behave(e, dt, game) {
    const slowMul = e.slowT > 0 ? 0.45 : 1;
    const seek = (x, y, sp) => {
      const d = Math.hypot(x - e.x, y - e.y) || 1;
      e.vx = (x - e.x) / d * sp * slowMul;
      e.vy = (y - e.y) / d * sp * slowMul;
      e.x += e.vx * dt; e.y += e.vy * dt;
    };
    const t = this.pickTarget(e, game);

    switch (e.def.behavior) {
      case 'chase':
        if (t) seek(t.x, t.y, e.speed);
        break;
      case 'mowcharge':
        if (e.state === 'move') {
          if (t) seek(t.x, t.y, e.speed);
          e.t1 -= dt;
          if (e.t1 <= 0 && t && dist2(e.x, e.y, t.x, t.y) < 260 * 260) {
            e.state = 'aim'; e.t2 = e.def.telegraph;
            const a = Math.atan2(t.y - e.y, t.x - e.x);
            e.dirX = Math.cos(a); e.dirY = Math.sin(a);
            game.audio.sfx('telegraph');
          }
        } else if (e.state === 'aim') {
          e.vx = e.vy = 0;
          e.t2 -= dt;
          if (e.t2 <= 0) { e.state = 'dash'; e.t2 = 0.6; game.audio.sfx('stomp'); }
        } else {
          e.vx = e.dirX * e.def.chargeSpeed;
          e.vy = e.dirY * e.def.chargeSpeed;
          e.x += e.vx * dt * slowMul; e.y += e.vy * dt * slowMul;
          e.t2 -= dt;
          if (e.t2 <= 0) { e.state = 'move'; e.t1 = e.def.chargeCd * randRange(0.8, 1.2); }
        }
        break;
      case 'shooter': {
        if (!t) break;
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d > e.def.keepDist + 30) seek(t.x, t.y, e.speed);
        else if (d < e.def.keepDist - 40) seek(e.x * 2 - t.x, e.y * 2 - t.y, e.speed * 0.8);
        else { e.vx *= 0.8; e.vy *= 0.8; }
        e.t1 -= dt;
        if (e.t1 <= 0 && d < e.def.range) {
          e.t1 = e.def.shootCd * randRange(0.85, 1.2);
          const a = Math.atan2(t.y - e.y, t.x - e.x);
          game.spawnEnemyProj(e.x, e.y, Math.cos(a) * e.def.projSpeed, Math.sin(a) * e.def.projSpeed, e.dmg);
          game.audio.sfx('zap');
        }
        break;
      }
      case 'sweeper':
        if (t) seek(t.x, t.y, e.speed);
        e.t1 -= dt;
        if (e.t1 <= 0 && t && dist2(e.x, e.y, t.x, t.y) < e.def.sweepRange * e.def.sweepRange) {
          e.t1 = e.def.sweepCd;
          e.atk = 0.3; // sweep visual timer
          game.audio.sfx('telegraph');
          game.fx.ring(e.x, e.y, e.def.sweepRange, '#c9a05a', 0.3);
          game.mob.grid.query(e.x, e.y, e.def.sweepRange, c => {
            if (c.bagged) return;
            if (dist2(e.x, e.y, c.x, c.y) < e.def.sweepRange * e.def.sweepRange) {
              game.mob.hurt(game, c, e.dmg, e);
              const a = Math.atan2(c.y - e.y, c.x - e.x);
              c.x += Math.cos(a) * 50; c.y += Math.sin(a) * 50;
            }
          });
          for (const p of game.players) {
            if (!p.dead && !p.downed && dist2(e.x, e.y, p.x, p.y) < e.def.sweepRange * e.def.sweepRange) p.hurt(game, e.dmg * 6, e);
          }
        }
        e.atk = Math.max(0, e.atk - dt);
        break;
      case 'bagger': {
        if (e.bagged) {
          // Flee to the edge with the prisoner!
          const ex = e.x < game.arena.w / 2 ? 20 : game.arena.w - 20;
          seek(ex, e.y, e.speed * 1.2);
          if (e.x < 40 || e.x > game.arena.w - 40) {
            // Escaped with a friend. Tragedy.
            game.fx.num(e.x, e.y - 16, 'BAGGED & FILED', '#e05c5c', 11);
            game.mob.remove(e.bagged === true ? null : e.bagged);
            e.bagged = null;
            this.die(game, e);
          }
          break;
        }
        const c = game.mob.nearest(e.x, e.y, 400);
        if (c) {
          seek(c.x, c.y, e.speed);
          if (dist2(e.x, e.y, c.x, c.y) < (e.size + 10) * (e.size + 10)) {
            c.bagged = true;
            e.bagged = c;
            game.fx.num(e.x, e.y - 16, 'GOTCHA!', '#e05c5c', 12);
            game.audio.sfx('cage');
          }
        } else if (t) seek(t.x, t.y, e.speed * 0.7);
        break;
      }
      case 'coner':
        if (t) {
          const d = Math.hypot(t.x - e.x, t.y - e.y);
          if (d > 150) seek(t.x, t.y, e.speed);
          else { e.vx *= 0.8; e.vy *= 0.8; }
        }
        e.t1 -= dt;
        if (e.t1 <= 0) {
          e.t1 = e.def.coneCd;
          this.spawnNow(game, 'cone', e.x + randRange(-30, 30), e.y + randRange(-30, 30), false);
          game.audio.sfx('thunk');
        }
        break;
      case 'static':
        e.vx = 0; e.vy = 0;
        break;
      case 'boss_mowtron': this.bossMowtron(e, dt, game, t, seek); break;
      case 'boss_succ': this.bossSucc(e, dt, game, t, seek); break;
      case 'boss_supervisor': this.bossSupervisor(e, dt, game, t, seek); break;
    }
  }

  bossMowtron(e, dt, game, t, seek) {
    if (e.state === 'move') {
      if (t) seek(t.x, t.y, e.speed);
      e.t1 -= dt;
      e.t2 -= dt;
      if (e.t2 <= 0) { // periodic minion belch
        e.t2 = 8;
        for (let k = 0; k < 2; k++) this.telegraphSpawn('dustbot', e.x + randRange(-60, 60), e.y + randRange(-60, 60));
      }
      if (e.t1 <= 0 && t) {
        e.state = 'aim'; e.atk = e.def.telegraph;
        const a = Math.atan2(t.y - e.y, t.x - e.x);
        e.dirX = Math.cos(a); e.dirY = Math.sin(a);
        game.audio.sfx('telegraph');
      }
    } else if (e.state === 'aim') {
      e.vx = e.vy = 0;
      e.atk -= dt;
      if (e.atk <= 0) { e.state = 'dash'; e.atk = 0.9; game.audio.sfx('stomp'); game.shake(0.3); }
    } else {
      e.vx = e.dirX * e.def.chargeSpeed;
      e.vy = e.dirY * e.def.chargeSpeed;
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (Math.random() < 0.4) game.fx.leaves(e.x - e.dirX * 20, e.y - e.dirY * 20, 2);
      e.atk -= dt;
      if (e.atk <= 0 || e.x < 60 || e.x > game.arena.w - 60 || e.y < 60 || e.y > game.arena.h - 60) {
        e.state = 'move'; e.t1 = 3.5;
      }
    }
  }

  bossSucc(e, dt, game, t, seek) {
    if (!e.phase2 && e.hp < e.maxHp * 0.5) { e.phase2 = true; e.speed *= 1.3; game.audio.sfx('boss'); }
    if (e.state === 'move') {
      if (t) seek(t.x, t.y, e.speed);
      e.t1 -= dt;
      if (e.t1 <= 0) { e.state = 'vacuum'; e.atk = e.phase2 ? 3.6 : 2.8; game.audio.sfx('vacuum'); }
    } else if (e.state === 'vacuum') {
      e.vx = e.vy = 0;
      e.atk -= dt;
      const R = e.def.pullRadius, F = e.def.pullForce;
      // PULL: critters and pipers drift toward the nozzle. Waddle away!
      for (const c of game.mob.list) {
        if (c.bagged) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d < R && d > 10) { c.x += (e.x - c.x) / d * F * dt; c.y += (e.y - c.y) / d * F * dt; }
      }
      for (const p of game.players) {
        if (p.dead || p.downed) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < R && d > 10) { p.x += (e.x - p.x) / d * F * 0.8 * dt; p.y += (e.y - p.y) / d * F * 0.8 * dt; }
      }
      if (Math.random() < 0.5) {
        const a = randRange(0, 6.28);
        game.fx.spawn(e.x + Math.cos(a) * R * 0.8, e.y + Math.sin(a) * R * 0.8, {
          vx: -Math.cos(a) * 180, vy: -Math.sin(a) * 180, life: 0.5, size: 3, color: '#c8ccd8', type: 'dot',
        });
      }
      if (e.atk <= 0) { e.state = 'spit'; e.atk = 0.8; }
    } else { // spit
      e.atk -= dt;
      if (e.atk <= 0.4 && !e._spat) {
        e._spat = true;
        const p = t || game.players[0];
        for (let k = -1; k <= 1; k++) {
          const a = Math.atan2(p.y - e.y, p.x - e.x) + k * 0.3;
          game.spawnEnemyProj(e.x, e.y, Math.cos(a) * 200, Math.sin(a) * 200, e.dmg);
        }
        game.audio.sfx('pfft');
      }
      if (e.atk <= 0) { e.state = 'move'; e.t1 = 3; e._spat = false; }
    }
  }

  bossSupervisor(e, dt, game, t, seek) {
    if (!e.phase2 && e.hp < e.maxHp * 0.5) {
      e.phase2 = true; e.speed *= 1.25;
      game.audio.sfx('boss');
      game.fx.num(e.x, e.y - 50, 'PERFORMANCE REVIEW TIME', '#e8c33a', 14);
    }
    const cd = e.phase2 ? 0.7 : 1;
    if (e.state === 'move') {
      if (t) seek(t.x, t.y, e.speed);
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.atk = (e.atk + 1) % 3;
        if (e.atk === 0) { e.state = 'stomp'; e.t2 = 1.0; game.audio.sfx('telegraph'); }
        else if (e.atk === 1) { e.state = 'clipboard'; e.t2 = 0.5; }
        else { e.state = 'summon'; e.t2 = 0.6; }
      }
    } else if (e.state === 'stomp') {
      e.vx = e.vy = 0;
      e.t2 -= dt;
      if (e.t2 <= 0) {
        game.audio.sfx('stomp');
        game.shake(0.6);
        game.fx.ring(e.x, e.y, 190, '#e8c33a', 0.5);
        game.mob.grid.query(e.x, e.y, 190, c => {
          if (!c.bagged && dist2(e.x, e.y, c.x, c.y) < 190 * 190) game.mob.hurt(game, c, e.dmg, e);
        });
        for (const p of game.players) {
          if (!p.dead && !p.downed && dist2(e.x, e.y, p.x, p.y) < 190 * 190) p.hurt(game, 20, e);
        }
        e.state = 'move'; e.t1 = 3.2 * cd;
      }
    } else if (e.state === 'clipboard') {
      e.t2 -= dt;
      if (e.t2 <= 0) {
        const p = t || game.players[0];
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        game.spawnEnemyProj(e.x, e.y, Math.cos(a) * 230, Math.sin(a) * 230, e.dmg, true);
        game.audio.sfx('zap');
        e.state = 'move'; e.t1 = 2.6 * cd;
      }
    } else { // summon
      e.t2 -= dt;
      if (e.t2 <= 0) {
        const kinds = ['dustbot', 'tidydrone', 'mower'];
        for (let k = 0; k < 3; k++) {
          this.telegraphSpawn(kinds[k], e.x + randRange(-90, 90), e.y + randRange(-90, 90), e.phase2);
        }
        game.fx.num(e.x, e.y - 50, 'SEE ME AFTER CLASS', '#b8bec8', 12);
        e.state = 'move'; e.t1 = 4.5 * cd;
      }
    }
  }

  // ---- rendering ----
  sprite(kind, elite) {
    const key = kind + (elite ? 'E' : '');
    if (!this.sprites[key]) {
      const def = ENEMIES[kind];
      const size = def.size * (elite ? 1.25 : 1);
      this.sprites[key] = makeSprite(Math.ceil(size * 3 + 12), ctx => drawBot(ctx, def, size, elite));
    }
    return this.sprites[key];
  }

  renderGround(ctx) {
    for (const t of this.telegraphs) {
      const pulse = (Math.sin(this.time * 12) + 1) / 2;
      ctx.strokeStyle = `rgba(232,195,58,${0.35 + pulse * 0.35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, 14 + pulse * 5, 0, 6.29); ctx.stroke();
    }
  }

  render(ctx, alpha, game) {
    const P = this.pool;
    for (let i = 0; i < P.n; i++) {
      const e = P.get(i);
      if (e.dead) continue;
      const x = lerp(e.px, e.x, alpha);
      const y = lerp(e.py, e.y, alpha);

      // Charge telegraph line.
      if (e.state === 'aim') {
        ctx.strokeStyle = 'rgba(224,92,92,0.55)';
        ctx.lineWidth = 6;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + e.dirX * 320, y + e.dirY * 320); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (e.state === 'stomp') {
        const t = 1 - e.t2 / 1.0;
        ctx.strokeStyle = 'rgba(232,195,58,0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 190, 0, 6.29); ctx.stroke();
        ctx.fillStyle = 'rgba(232,195,58,0.15)';
        ctx.beginPath(); ctx.arc(x, y, 190 * t, 0, 6.29); ctx.fill();
      }
      if (e.state === 'vacuum') {
        ctx.strokeStyle = 'rgba(200,204,216,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 10]);
        ctx.beginPath(); ctx.arc(x, y, e.def.pullRadius * (0.7 + Math.sin(this.time * 6) * 0.05), 0, 6.29); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shadow + body.
      ctx.fillStyle = 'rgba(40,60,30,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y + e.size * 0.8, e.size * 0.85, e.size * 0.32, 0, 0, 6.29); ctx.fill();
      const spr = this.sprite(e.kind, e.elite);
      const shake = (e.state === 'aim' || e.state === 'vacuum') ? Math.sin(this.time * 40) * 1.5 : 0;
      ctx.save();
      ctx.translate(x + shake, y);
      ctx.scale(e.face, 1);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();

      if (e.hitT > 0) {
        ctx.globalAlpha = e.hitT * 5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, e.size * 1.05, 0, 6.29); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.slowT > 0) {
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#aef2ff';
        ctx.fillText('@', x + Math.sin(this.time * 8) * 6, y - e.size - 6);
      }
      if (e.bagged) {
        ctx.fillStyle = 'rgba(232,232,240,0.9)';
        ctx.beginPath(); ctx.ellipse(x, y - e.size - 8, 8, 9, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#5a5a66'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y - e.size - 8, 8, 9, 0, 0, 6.29); ctx.stroke();
      }
      if (e.elite && !e.boss) {
        ctx.fillStyle = '#e8c33a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', x, y - e.size - 6);
      }
    }
  }
}

function statNoise(x) { return x; }

// ---- procedural bot bodies ----
function drawBot(ctx, def, size, elite) {
  const s = size / 12;
  ctx.lineWidth = Math.max(1.4, 1.6 * s);
  ctx.strokeStyle = 'rgba(20,25,35,0.5)';
  const body = elite ? '#a88ab8' : def.body;

  switch (def.behavior) {
    case 'chase': // dust-bot: roomba with a grudge
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 2 * s, 9 * s, 5 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.beginPath(); ctx.arc(0, -2 * s, 4 * s, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e05c5c';
      ctx.fillRect(-1.4 * s, -3.4 * s, 2.8 * s, 2 * s); // angry eye
      // Little brushes.
      ctx.strokeStyle = '#5a5a66';
      ctx.beginPath(); ctx.moveTo(-8 * s, 5 * s); ctx.lineTo(-11 * s, 7 * s); ctx.moveTo(8 * s, 5 * s); ctx.lineTo(11 * s, 7 * s); ctx.stroke();
      break;
    case 'mowcharge': // mower drone
      ctx.fillStyle = body;
      ctx.fillRect(-10 * s, -4 * s, 20 * s, 10 * s);
      ctx.strokeRect(-10 * s, -4 * s, 20 * s, 10 * s);
      ctx.fillStyle = def.accent;
      ctx.fillRect(6 * s, -2 * s, 5 * s, 6 * s); // blade housing
      ctx.fillStyle = '#3a3a44';
      ctx.beginPath(); ctx.arc(-5 * s, 7 * s, 3 * s, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(5 * s, 7 * s, 3 * s, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(-8 * s, -3 * s, 3 * s, 2 * s);
      break;
    case 'shooter': // tidy drone (flying)
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 5 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.beginPath(); ctx.arc(0, -1 * s, 2.4 * s, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#8a8a96';
      ctx.beginPath(); ctx.moveTo(-7 * s, -3 * s); ctx.lineTo(-11 * s, -6 * s); ctx.moveTo(7 * s, -3 * s); ctx.lineTo(11 * s, -6 * s); ctx.stroke();
      ctx.fillStyle = '#c8ccd8';
      ctx.beginPath(); ctx.ellipse(-11 * s, -6 * s, 4 * s, 1.2 * s, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(11 * s, -6 * s, 4 * s, 1.2 * s, 0, 0, 6.29); ctx.fill();
      break;
    case 'sweeper': // broom mech
      ctx.fillStyle = body;
      ctx.fillRect(-6 * s, -8 * s, 12 * s, 14 * s);
      ctx.strokeRect(-6 * s, -8 * s, 12 * s, 14 * s);
      ctx.fillStyle = def.accent;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(i * 2.5 * s - 1 * s, 6 * s, 2 * s, 5 * s); // bristles
      }
      ctx.fillStyle = '#e05c5c';
      ctx.fillRect(-3 * s, -6 * s, 2 * s, 2 * s);
      ctx.fillRect(1 * s, -6 * s, 2 * s, 2 * s);
      break;
    case 'bagger': // bag-bot
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 8 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.beginPath(); ctx.ellipse(0, 3 * s, 5 * s, 4 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(-2.4 * s, -6 * s, 4.8 * s, 1.6 * s); // visor
      // Grabby arms.
      ctx.strokeStyle = '#8a8a96';
      ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(-11 * s, -3 * s); ctx.moveTo(7 * s, 0); ctx.lineTo(11 * s, -3 * s); ctx.stroke();
      break;
    case 'coner':
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 3 * s, 8 * s, 5 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.beginPath(); ctx.moveTo(-4 * s, 0); ctx.lineTo(0, -9 * s); ctx.lineTo(4 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'static': // traffic cone
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(-7 * s, 8 * s); ctx.lineTo(0, -8 * s); ctx.lineTo(7 * s, 8 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.fillRect(-4 * s, 0, 8 * s, 2.6 * s);
      break;
    case 'boss_mowtron':
      ctx.fillStyle = body;
      ctx.fillRect(-16 * s, -8 * s, 32 * s, 16 * s);
      ctx.strokeRect(-16 * s, -8 * s, 32 * s, 16 * s);
      ctx.fillStyle = def.accent;
      ctx.fillRect(10 * s, -6 * s, 8 * s, 12 * s);
      ctx.fillStyle = '#3a3a44';
      for (const wx of [-10, 0, 10]) { ctx.beginPath(); ctx.arc(wx * s, 10 * s, 4 * s, 0, 6.29); ctx.fill(); }
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(-14 * s, -6 * s, 5 * s, 3 * s); // cab light
      ctx.fillStyle = '#e05c5c';
      ctx.fillRect(-6 * s, -5 * s, 3 * s, 3 * s); ctx.fillRect(0, -5 * s, 3 * s, 3 * s); // eyes
      break;
    case 'boss_succ':
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, 15 * s, 12 * s, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = def.accent; // the bag
      ctx.beginPath(); ctx.ellipse(-8 * s, -8 * s, 8 * s, 10 * s, -0.4, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a3a44'; // nozzle
      ctx.fillRect(12 * s, -3 * s, 9 * s, 6 * s);
      ctx.fillStyle = '#e05c5c';
      ctx.fillRect(-2 * s, -6 * s, 3 * s, 3 * s); ctx.fillRect(4 * s, -6 * s, 3 * s, 3 * s);
      break;
    case 'boss_supervisor':
      ctx.fillStyle = body;
      ctx.fillRect(-12 * s, -14 * s, 24 * s, 26 * s);
      ctx.strokeRect(-12 * s, -14 * s, 24 * s, 26 * s);
      ctx.fillStyle = def.accent; // tie
      ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.lineTo(-2.4 * s, 0); ctx.lineTo(0, 8 * s); ctx.lineTo(2.4 * s, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8ccd8'; // clipboard arm
      ctx.fillRect(12 * s, -6 * s, 7 * s, 9 * s);
      ctx.fillStyle = '#fff';
      ctx.fillRect(13 * s, -5 * s, 5 * s, 7 * s);
      ctx.fillStyle = '#e05c5c';
      ctx.fillRect(-7 * s, -11 * s, 4 * s, 3 * s); ctx.fillRect(3 * s, -11 * s, 4 * s, 3 * s);
      break;
  }
}
