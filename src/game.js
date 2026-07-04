// game.js — state machine + run loop. Waves, projectiles, cages, acorns,
// crossroads picks, camera, meta unlocks.

import { Pool, clamp, lerp, dist2, randRange, weightedPick, mulberry32 } from './pool.js';
import { SPECIES, SPECIES_IDS, WAVES, CHOICES, UNLOCK_ORDER, MOB_CAP } from './data.js';
import { MobSystem } from './critters.js';
import { EnemySystem } from './enemies.js';
import { Piper } from './piper.js';
import { InputManager } from './input.js';
import { AudioSystem } from './audio.js';
import { FX } from './fx.js';
import { UI } from './ui.js';

const STEP = 1 / 60;
const SAVE_KEY = 'mob_rule_v1';
export const VIEW_W = 1280, VIEW_H = 720;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.arena = { w: 1700, h: 1300 };
    this.input = new InputManager();
    this.audio = new AudioSystem();
    this.fx = new FX();
    this.mob = new MobSystem();
    this.enemies = new EnemySystem(this.arena.w, this.arena.h);
    this.ui = new UI(this);

    this.state = 'title'; // title|run|crossroads|gameover|victory|help|(pause overlay)
    this.paused = false;
    this.pauseReason = '';
    this.players = [];
    this.waveNum = 0;
    this.waveT = 0;
    this.spawnAcc = 0;
    this.boss = null;
    this.time = 0;
    this.acc = 0;
    this.alpha = 1;
    this.runStats = { bots: 0, acorns: 0, time: 0 };
    this.lastStand = null;
    this.endCause = null;
    this.rescueT = 10;
    this.camera = { x: 850, y: 650, zoom: 1, px: 850, py: 650, pz: 1 };

    this.proj = new Pool(() => ({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 0, friendly: true, homing: false, target: null, life: 0, color: '#fff', spin: false, ang: 0 }));
    this.acornsList = new Pool(() => ({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, val: 1, bob: 0 }));
    this.cages = [];
    this.clouds = [];
    this.snacks = [];
    this.rng = Math.random;

    this.save = this.load();
    this.fx.shakeEnabled = this.save.settings.shake;
    this.audio.setMuted(this.save.settings.muted);
    this.decor = [];
    this.buildDecor();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          acorns: s.acorns || 0, bestWave: s.bestWave || 0, wins: s.wins || 0,
          biggestMob: s.biggestMob || 0,
          settings: { muted: !!(s.settings && s.settings.muted), shake: s.settings ? s.settings.shake !== false : true },
          little: s.little || [false, false],
        };
      }
    } catch (e) {}
    return { acorns: 0, bestWave: 0, wins: 0, biggestMob: 0, settings: { muted: false, shake: true }, little: [false, false] };
  }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) {} }
  setMuted(m) { this.audio.setMuted(m); this.save.settings.muted = m; this.persist(); }
  setShake(v) { this.fx.shakeEnabled = v; this.save.settings.shake = v; this.persist(); }
  unlocked(sp) { return SPECIES[sp].unlock <= this.save.acorns; }
  unlockedList() { return SPECIES_IDS.filter(sp => this.unlocked(sp)); }
  shake(n) { this.fx.shake(n); }

  // ---------- run flow ----------
  startRun() {
    this.mob = new MobSystem();
    this.enemies.clear();
    this.proj.clear(); this.acornsList.clear();
    this.cages.length = 0; this.clouds.length = 0; this.snacks.length = 0;
    this.fx.clear();
    this.runStats = { bots: 0, acorns: 0, time: 0 };
    this.boss = null;
    this.lastStand = null;
    this.endCause = null;
    this.rescueT = 10;
    this.acornHintDone = false;
    this.players = [];
    const p1 = new Piper(0, this.arena.w / 2 - 30, this.arena.h / 2, this.save.little[0]);
    this.players.push(p1);
    if (this.input.deviceFor(1)) {
      this.players.push(new Piper(1, this.arena.w / 2 + 30, this.arena.h / 2, this.save.little[1]));
    }
    // Starting mob: a sampler platter — melee, ranged, and one goat.
    const starters = ['frog', 'frog', 'duck', 'duck', 'goat'];
    for (const sp of starters) {
      this.mob.add(this, sp, 1, p1.x + randRange(-30, 30), p1.y + randRange(20, 50), 0, true);
    }
    this.camera.x = p1.x; this.camera.y = p1.y;
    this.audio.ensure();
    this.audio.startMusic();
    this.startWave(1);
  }

  startWave(n) {
    this.waveNum = n;
    const def = WAVES[n - 1];
    this.waveT = def.duration;
    this.spawnAcc = 0;
    this.bossSpawned = false;
    this.state = 'run';
    this.paused = false;
    this.audio.sfx('wavestart');
    this.audio.intensity = n / 12;
    this.ui.banner(def.boss ? `WAVE ${n} — ${this.bossName(def.boss)}` : `WAVE ${n}`, def.boss ? '#e05c5c' : '#fff');
    this.audio.say(def.boss ? `Wave ${n}! Here comes the big boss! You can do it!` : `Wave ${n}! Here they come!`, true);
    // Scatter recruitment cages.
    for (let i = 0; i < def.cages; i++) {
      this.cages.push({
        x: randRange(150, this.arena.w - 150),
        y: randRange(150, this.arena.h - 150),
        wob: randRange(0, 6),
        opened: false,
      });
    }
  }
  bossName(id) { return { mowtron: 'MOWTRON 9000', succ: 'THE SUCC-5000', supervisor: 'THE SUPERVISOR' }[id]; }

  waveDone() {
    if (this.waveT > 0) return false;
    const def = WAVES[this.waveNum - 1];
    if (def.boss && this.boss) return false;
    return this.enemies.threats() === 0 && this.enemies.telegraphs.length === 0;
  }

  endWave() {
    // Any leftover cones tidy themselves away.
    for (let i = 0; i < this.enemies.pool.n; i++) {
      const e = this.enemies.pool.get(i);
      if (e.kind === 'cone') { e.dead = true; this.fx.leaves(e.x, e.y, 3); }
    }
    this.audio.sfx('waveclear');
    this.fx.confetti(this.camera.x, this.camera.y - 60, 20);
    // Sweep leftover pickups to the piper.
    if (this.waveNum >= 12) { this.endRun(true); return; }
    // Revive any downed piper between waves; heal the whole mob.
    for (const p of this.players) if (p.downed) p.revive(this);
    for (const c of this.mob.list) c.hp = this.mob.maxHp(c.sp, c.tier);
    this.state = 'crossroads';
    this.ui.openCrossroads();
  }

  onBossDown(e) {
    this.fx.confetti(e.x, e.y, 40);
    this.shake(0.7);
    this.audio.sfx('victory');
    this.ui.banner('BOSS SCRAPPED!', '#ffd166');
    this.audio.say('You did it! The boss is scrapped! Amazing!', true);
    // Bonus egg: 3 random higher-tier recruits.
    for (let i = 0; i < 3; i++) {
      const sp = this.randomSpecies();
      this.mob.add(this, sp, this.waveNum >= 8 ? 2 : 1, e.x + randRange(-30, 30), e.y + randRange(-30, 30), 0);
    }
  }

  onPiperDown(p) {
    this.audio.sfx('defeat');
    this.ui.banner(`P${p.slot + 1} IS DOWN!`, '#e05c5c');
    if (this.players.every(q => q.dead || q.downed)) {
      this.endRun(false);
    }
  }

  endRun(won, cause) {
    this.endCause = cause || null;
    this.audio.say(won
      ? 'Nature wins! Hooray! You saved all the critters!'
      : cause === 'mobwipe'
        ? 'Oh no, the mob is gone! Great try! Play again!'
        : 'Ouch! The piper got bonked! Great try! Play again!', true);
    this.save.bestWave = Math.max(this.save.bestWave, this.waveNum);
    this.save.biggestMob = Math.max(this.save.biggestMob, this.mob.biggest);
    this.save.acorns += this.runStats.acorns;
    if (won) this.save.wins++;
    // Unlock check for the end screen.
    this.newUnlocks = UNLOCK_ORDER.filter(sp =>
      SPECIES[sp].unlock > this.save.acorns - this.runStats.acorns && SPECIES[sp].unlock <= this.save.acorns);
    this.persist();
    this.audio.stopMusic();
    this.audio.sfx(won ? 'victory' : 'defeat');
    this.state = won ? 'victory' : 'gameover';
    this.ui.openEnd(won);
  }

  quitToTitle() {
    this.state = 'title';
    this.paused = false;
    this.audio.stopMusic();
    this.fx.clear();
  }

  randomSpecies() {
    const pool = this.unlockedList();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- crossroads ----------
  drawChoices(n) {
    const avail = CHOICES.filter(c => {
      if (c.needsUnlock && !this.unlocked(c.needsUnlock)) return false;
      if (c.kind === 'wild' && this.mob.wild[c.effect]) return false;
      if (c.id === 'piper_charm' && this.players.every(p => p.charm)) return false;
      return true;
    });
    const out = [];
    const pool = avail.slice();
    for (let i = 0; i < n && pool.length; i++) {
      const c = weightedPick(pool, ch =>
        ch.kind === 'pack' ? 10 : ch.kind === 'mobBuff' ? 7 : ch.kind === 'piperBuff' ? 5 : 4);
      out.push(c);
      pool.splice(pool.indexOf(c), 1);
    }
    return out;
  }

  applyChoice(c, slot) {
    const p = this.players[slot] || this.players[0];
    this.fx.notice(p.x, p.y - 34, c.title + '!', '#ffd166', 16);
    this.audio.say(c.title + '!');
    if (c.kind === 'pack') {
      for (let i = 0; i < c.count; i++) {
        this.mob.add(this, c.species, 1, p.x + randRange(-40, 40), p.y + randRange(20, 60), p.slot);
      }
    } else if (c.kind === 'mobBuff') {
      this.mob.buffs[c.stat] += c.amount;
    } else if (c.kind === 'piperBuff') {
      if (c.stat === 'maxhp') { p.maxHp += c.amount; p.hp = p.maxHp; }
      else if (c.stat === 'speed') p.speed *= (1 + c.amount);
      else if (c.stat === 'regen') p.regen += c.amount;
      else if (c.stat === 'charm') p.charm = true;
    } else if (c.kind === 'wild') {
      this.mob.wild[c.effect] = true;
      if (c.effect === 'crown') this.mob.recrown(this);
      this.fx.num(p.x, p.y - 30, c.title + '!', '#c792ea', 14);
    }
    this.audio.sfx('uiPick');
  }

  // ---------- spawn helpers ----------
  spawnProj(x, y, target, dmg, homing, color) {
    const pr = this.proj.alloc();
    pr.x = pr.px = x; pr.y = pr.py = y;
    const a = Math.atan2(target.y - y, target.x - x);
    const sp = homing ? 210 : 300;
    pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
    pr.dmg = dmg; pr.friendly = true; pr.homing = homing;
    pr.target = homing ? target : null;
    pr.life = 1.6; pr.color = color || '#fff'; pr.spin = false; pr.ang = 0;
  }
  spawnEnemyProj(x, y, vx, vy, dmg, spin) {
    const pr = this.proj.alloc();
    pr.x = pr.px = x; pr.y = pr.py = y;
    pr.vx = vx; pr.vy = vy;
    pr.dmg = dmg; pr.friendly = false; pr.homing = false; pr.target = null;
    pr.life = 2.6; pr.color = spin ? '#f0f0f0' : '#e8c33a'; pr.spin = !!spin; pr.ang = 0;
  }
  skunkCloud(x, y, r, dmg, tier) {
    this.clouds.push({ x, y, r, dmg, life: 2.2 + tier * 0.4, tickT: 0 });
  }
  dropSnack(x, y) {
    if (this.snacks.length > 12) return;
    this.snacks.push({ x, y, bob: Math.random() * 6 });
  }

  updateSnacks(dt) {
    for (let i = this.snacks.length - 1; i >= 0; i--) {
      const s = this.snacks[i];
      s.bob += dt * 4;
      for (const p of this.players) {
        if (p.dead || p.downed) continue;
        const d2 = dist2(s.x, s.y, p.x, p.y);
        // Only sticks to a piper who needs it — full pipers leave it for later.
        if (p.hp < p.maxHp && d2 < p.magnet * p.magnet) {
          const d = Math.sqrt(d2) || 1;
          s.x += (p.x - s.x) / d * 500 * dt;
          s.y += (p.y - s.y) / d * 500 * dt;
        }
        if (d2 < 22 * 22 && p.heal(this, 25)) {
          this.snacks.splice(i, 1);
          this.audio.say('Yummy apple!');
          break;
        }
      }
    }
  }

  dropAcorn(x, y, val) {
    const a = this.acornsList.alloc();
    a.x = a.px = x; a.y = a.py = y;
    const ang = randRange(0, 6.28);
    a.vx = Math.cos(ang) * 70; a.vy = Math.sin(ang) * 70;
    a.val = val; a.bob = randRange(0, 6);
  }
  acorns(n, x, y) {
    this.runStats.acorns += n;
    if (x != null) this.fx.num(x, y, `+${n} 🌰`, '#c9a05a', 11);
  }

  // ---------- frame ----------
  frame(dt) {
    this.input.update(dt);
    if (this.input.anyPressed('mute')) this.setMuted(!this.audio.muted);
    if (this.state === 'run') {
      if (this.input.assignedPressed('pause')) { this.paused = !this.paused; this.pauseReason = ''; this.ui.pauseIdx = 0; }
      if (!this.paused && this.input.disconnectedSlot() >= 0) { this.paused = true; this.pauseReason = 'controller disconnected'; }
    }
    this.ui.update(dt);
    if (this.state === 'run' && !this.paused) {
      this.acc += Math.min(dt, 0.1);
      let n = 0;
      while (this.acc >= STEP && n < 4) { this.tick(STEP); this.acc -= STEP; n++; }
      this.alpha = this.acc / STEP;
    } else this.alpha = 1;
    if (this.ctx) this.render();
  }

  tick(dt) {
    this.time += dt;
    this.runStats.time += dt;
    const def = WAVES[this.waveNum - 1];

    // Spawning.
    if (this.waveT > 0) {
      this.waveT = Math.max(0, this.waveT - dt);
      const prog = 1 - this.waveT / def.duration;
      const rate = lerp(def.rate[0], def.rate[1], prog) * (1 + 0.25 * (this.players.length - 1));
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1 && this.enemies.count() < 130) {
        this.spawnAcc -= 1;
        const kind = weightedPick(def.mix, m => m[1])[0];
        const pos = this.spawnPos();
        this.enemies.telegraphSpawn(kind, pos.x, pos.y, def.elite && Math.random() < 0.35);
      }
      if (def.boss && !this.bossSpawned && prog > 0.12) {
        this.bossSpawned = true;
        const pos = this.spawnPos();
        this.enemies.spawnNow(this, def.boss, pos.x, pos.y);
      }
    }

    // Players + the attack/shield economy: tap sends/recalls ONE, hold streams.
    for (const p of this.players) {
      const inp = this.input.move(p.slot);
      p.update(dt, this, { x: inp.x, y: inp.y });
      if (p.dead || p.downed) continue;
      if (this.input.pressed(p.slot, 'whistle')) {
        if (this.mob.sendOne(this, p)) { p.whistleAnim = 0.3; this.fx.notes(p.x, p.y - 24, 2); }
        p.sendAcc = -0.25; // grace before the hold-stream kicks in
      } else if (this.input.down(p.slot, 'whistle')) {
        p.sendAcc += dt;
        while (p.sendAcc >= 0.14) {
          p.sendAcc -= 0.14;
          if (this.mob.sendOne(this, p)) p.whistleAnim = 0.3;
        }
      } else p.sendAcc = 0;
      if (this.input.pressed(p.slot, 'recall')) {
        this.mob.recallOne(this, p);
        p.recallAcc = -0.25;
      } else if (this.input.down(p.slot, 'recall')) {
        p.recallAcc += dt;
        while (p.recallAcc >= 0.11) {
          p.recallAcc -= 0.11;
          this.mob.recallOne(this, p);
        }
      } else p.recallAcc = 0;
    }
    // Revive downed partner by proximity.
    for (const p of this.players) {
      if (!p.downed) continue;
      let near = false;
      for (const q of this.players) {
        if (q !== p && !q.dead && !q.downed && dist2(p.x, p.y, q.x, q.y) < 70 * 70) near = true;
      }
      if (near) { p.reviveP += dt / 3; if (p.reviveP >= 1) p.revive(this); }
      else p.reviveP = Math.max(0, p.reviveP - dt * 0.5);
    }

    this.mob.update(dt, this);
    this.enemies.update(dt, this);

    // MOB WIPE: without critters the run cannot be won — no soft-locks here.
    if (this.mob.count() === 0 && this.state === 'run') {
      if (!this.lastStand) {
        if (this.cages.length > 0) {
          this.lastStand = { t: 12 };
          this.ui.banner('MOB LOST — FREE A CAGE, FAST!', '#e05c5c');
          this.audio.sfx('defeat');
          this.audio.say('Oh no! Save the mob! Run to a cage, fast!', true);
        } else {
          this.endRun(false, 'mobwipe');
          return;
        }
      } else {
        this.lastStand.t -= dt;
        if (this.lastStand.t <= 0) { this.endRun(false, 'mobwipe'); return; }
        if (this.cages.length === 0) { this.endRun(false, 'mobwipe'); return; }
      }
    } else if (this.lastStand && this.mob.count() > 0) {
      this.lastStand = null;
      this.ui.banner('THE PARADE LIVES!', '#7ec850');
      this.audio.sfx('waveclear');
      this.fx.confetti(this.players[0].x, this.players[0].y - 30, 20);
    }

    // RESCUE DRIP: a shrinking mob must be recoverable, not a slow death
    // spiral. Below 5 critters a golden cage of wild volunteers appears
    // (first within ~10s, then every 30s) until you're back on your feet.
    if (this.state === 'run' && this.mob.count() < 5) {
      this.rescueT -= dt;
      if (this.rescueT <= 0) {
        this.rescueT = 30;
        const p = this.players.find(q => !q.dead && !q.downed) || this.players[0];
        const a = Math.random() * Math.PI * 2;
        const d = randRange(240, 380);
        this.cages.push({
          x: clamp(p.x + Math.cos(a) * d, 150, this.arena.w - 150),
          y: clamp(p.y + Math.sin(a) * d, 150, this.arena.h - 150),
          wob: 0,
          opened: false,
          rescue: true,
        });
        this.ui.banner('WILD CRITTERS SPOTTED!', '#ffd166');
        this.audio.sfx('cage');
        this.audio.say('Wild critters spotted! Follow the golden arrow!');
      }
    } else {
      this.rescueT = Math.min(this.rescueT, 10);
    }
    this.updateProjectiles(dt);
    this.updateClouds(dt);
    this.updateAcorns(dt);
    this.updateSnacks(dt);
    this.updateCages(dt);
    this.fx.update(dt);
    this.updateCamera(dt);

    if (this.waveDone()) this.endWave();
  }

  spawnPos() {
    // Ring around the camera view edge, inside the arena.
    for (let tries = 0; tries < 10; tries++) {
      const a = randRange(0, 6.28);
      const r = randRange(420, 560);
      const x = clamp(this.camera.x + Math.cos(a) * r, 60, this.arena.w - 60);
      const y = clamp(this.camera.y + Math.sin(a) * r, 60, this.arena.h - 60);
      let ok = true;
      for (const p of this.players) if (dist2(x, y, p.x, p.y) < 300 * 300) ok = false;
      if (ok) return { x, y };
    }
    return { x: randRange(80, this.arena.w - 80), y: 80 };
  }

  updateProjectiles(dt) {
    const P = this.proj;
    for (let i = P.n - 1; i >= 0; i--) {
      const pr = P.get(i);
      pr.px = pr.x; pr.py = pr.y;
      pr.life -= dt;
      pr.ang += dt * 10;
      if (pr.life <= 0) { P.release(i); continue; }
      if (pr.homing && pr.target && !pr.target.dead) {
        const a = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = lerp(pr.vx, Math.cos(a) * sp, 8 * dt);
        pr.vy = lerp(pr.vy, Math.sin(a) * sp, 8 * dt);
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.friendly) {
        const e = this.enemies.nearest(pr.x, pr.y, 26);
        if (e && dist2(pr.x, pr.y, e.x, e.y) < (e.size + 5) * (e.size + 5)) {
          this.enemies.hurt(this, e, pr.dmg, null, {});
          this.fx.sparks(pr.x, pr.y, 3);
          P.release(i);
        }
      } else {
        let hit = false;
        this.mob.grid.query(pr.x, pr.y, 16, c => {
          if (hit || c.bagged) return;
          if (dist2(pr.x, pr.y, c.x, c.y) < 14 * 14) { this.mob.hurt(this, c, pr.dmg, null); hit = true; }
        });
        if (!hit) {
          for (const p of this.players) {
            if (p.dead || p.downed) continue;
            if (dist2(pr.x, pr.y, p.x, p.y) < 15 * 15) { p.hurt(this, pr.dmg * 4 + 4, pr); hit = true; }
          }
        }
        if (hit) P.release(i);
      }
    }
  }

  updateClouds(dt) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      if (c.life <= 0) { this.clouds.splice(i, 1); continue; }
      c.tickT -= dt;
      if (c.tickT <= 0) {
        c.tickT = 0.5;
        this.enemies.each(c.x, c.y, c.r, e => {
          this.enemies.hurt(this, e, c.dmg, null, {});
          e.slowT = Math.max(e.slowT, 0.7);
        });
      }
    }
  }

  updateAcorns(dt) {
    const A = this.acornsList;
    for (let i = A.n - 1; i >= 0; i--) {
      const a = A.get(i);
      a.px = a.x; a.py = a.y;
      a.bob += dt * 4;
      a.vx *= 1 - 4 * dt; a.vy *= 1 - 4 * dt;
      let best = null, bd = Infinity;
      for (const p of this.players) {
        if (p.dead || p.downed) continue;
        const d2 = dist2(a.x, a.y, p.x, p.y);
        if (d2 < p.magnet * p.magnet && d2 < bd) { bd = d2; best = p; }
      }
      if (best) {
        const d = Math.sqrt(bd) || 1;
        a.vx += (best.x - a.x) / d * 900 * dt;
        a.vy += (best.y - a.y) / d * 900 * dt;
      }
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (best && bd < 20 * 20) {
        this.acorns(a.val);
        this.audio.sfx('acorn');
        this.fx.sparks(a.x, a.y, 2);
        this.fx.num(a.x, a.y - 4, `+${a.val} acorn`, '#e8c33a', 11);
        if (!this.acornHintDone) {
          this.acornHintDone = true;
          this.fx.notice(a.x, a.y - 28, 'Acorns unlock NEW critters!', '#ffd166', 16);
          this.audio.say('You got an acorn! Collect acorns to unlock new critters!');
        }
        A.release(i);
      }
    }
  }

  updateCages(dt) {
    for (let i = this.cages.length - 1; i >= 0; i--) {
      const c = this.cages[i];
      c.wob += dt * 3;
      for (const p of this.players) {
        if (p.dead || p.downed) continue;
        if (dist2(c.x, c.y, p.x, p.y) < 34 * 34) {
          this.cages.splice(i, 1);
          this.audio.sfx('cage');
          this.fx.leaves(c.x, c.y, 6);
          const sp = this.randomSpecies();
          const n = (c.rescue ? 4 : 3) + Math.floor(Math.random() * 2);
          for (let k = 0; k < n; k++) {
            this.mob.add(this, sp, 1, c.x + randRange(-14, 14), c.y + randRange(-14, 14), p.slot);
          }
          this.fx.notice(c.x, c.y - 20, `${n} ${SPECIES[sp].name}s freed!`, '#7ec850', 15);
          this.audio.say(c.rescue ? `Hooray! ${n} wild ${SPECIES[sp].name}s join the parade!` : `${n} ${SPECIES[sp].name}s join the parade!`);
          break;
        }
      }
    }
  }

  updateCamera(dt) {
    const cam = this.camera;
    cam.px = cam.x; cam.py = cam.y; cam.pz = cam.zoom;
    const alive = this.players.filter(p => !p.dead);
    if (!alive.length) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of alive) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const tx = (minX + maxX) / 2, ty = (minY + maxY) / 2;
    let tz = 1;
    if (alive.length > 1) {
      tz = clamp(Math.min(VIEW_W / (maxX - minX + 500), VIEW_H / (maxY - minY + 420)), 0.62, 1);
    }
    cam.zoom = lerp(cam.zoom, tz, Math.min(1, 3 * dt));
    cam.x = lerp(cam.x, tx, Math.min(1, 5 * dt));
    cam.y = lerp(cam.y, ty, Math.min(1, 5 * dt));
    const hw = VIEW_W / (2 * cam.zoom), hh = VIEW_H / (2 * cam.zoom);
    cam.x = clamp(cam.x, Math.min(hw, this.arena.w / 2), Math.max(this.arena.w - hw, this.arena.w / 2));
    cam.y = clamp(cam.y, Math.min(hh, this.arena.h / 2), Math.max(this.arena.h - hh, this.arena.h / 2));
  }

  buildDecor() {
    this.decor = [];
    for (let i = 0; i < 60; i++) {
      this.decor.push({
        x: (i * 313.7) % this.arena.w,
        y: (i * 197.3 + 60) % this.arena.h,
        kind: i % 4,
        c: ['#ff8fb3', '#ffd166', '#c792ea', '#fff'][i % 4],
        s: 0.8 + (i % 3) * 0.3,
      });
    }
  }

  render() {
    this.ui.render(this.ctx);
  }
}
