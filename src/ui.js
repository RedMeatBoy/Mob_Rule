// ui.js — world render, HUD (the BIG mob counter), crossroads cards,
// title/end/pause screens. Every screen works on keyboard and controller.

import { clamp, lerp } from './pool.js';
import { SPECIES, SPECIES_IDS, WAVES, UNLOCK_ORDER, MOB_CAP, TIPS, DEFEAT_LINES, VICTORY_LINES } from './data.js';
import { statFor, drawCrown } from './critters.js';
import { PIPER_COLORS } from './piper.js';
import { VIEW_W, VIEW_H } from './game.js';

const FONT = '"Trebuchet MS", "Comic Sans MS", sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class UI {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.menuIdx = 0;
    this.pauseIdx = 0;
    this.bannerData = null;
    this.cards = [];
    this.cardIdx = 0;
    this.pickSlot = 0;
    this.picksLeft = 1;
    this.endLine = '';
    this.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.mobPop = 0;
    this.lastMob = 0;
    this.titleParade = [];
    for (let i = 0; i < 8; i++) {
      this.titleParade.push({ sp: SPECIES_IDS[i % 5], x: Math.random() * VIEW_W, sp2: 30 + Math.random() * 40 });
    }
  }

  banner(text, color) { this.bannerData = { text, color: color || '#fff', t: 2.4, max: 2.4 }; }
  openCrossroads() {
    this.pickSlot = 0;
    this.picksLeft = this.g.players.length;
    this.cards = this.g.drawChoices(3);
    this.cardIdx = 1;
  }
  openEnd(won) {
    const pool = won ? VICTORY_LINES : DEFEAT_LINES;
    this.endLine = pool[Math.floor(Math.random() * pool.length)];
  }

  // ============ UPDATE ============
  update(dt) {
    this.t += dt;
    this.mobPop = Math.max(0, this.mobPop - dt);
    if (this.bannerData) { this.bannerData.t -= dt; if (this.bannerData.t <= 0) this.bannerData = null; }
    const g = this.g, inp = g.input;

    // Mob counter pop.
    const mc = g.mob ? g.mob.count() : 0;
    if (mc > this.lastMob) this.mobPop = 0.35;
    this.lastMob = mc;

    switch (g.state) {
      case 'title': {
        for (const p of this.titleParade) {
          p.x += p.sp2 * dt;
          if (p.x > VIEW_W + 40) p.x = -40;
        }
        // Device binding: first input claims P1.
        if (!inp.deviceFor(0)) {
          for (const dev of inp.devices.values()) {
            if (dev.connected && (dev.pressed('confirm') || dev.pressed('whistle'))) { inp.assign(0, dev.id); break; }
          }
          if (!inp.deviceFor(0)) {
            // Keyboard always available.
            if (inp.keys.size > 0) inp.assign(0, 'kb1');
          }
        }
        const join = inp.joinPress();
        if (join) { inp.assign(1, join); g.audio.sfx('recruit'); }
        const n = 4;
        if (inp.anyMenu('up')) { this.menuIdx = (this.menuIdx + n - 1) % n; g.audio.sfx('uiMove'); }
        if (inp.anyMenu('down')) { this.menuIdx = (this.menuIdx + 1) % n; g.audio.sfx('uiMove'); }
        if (inp.anyMenu('left') || inp.anyMenu('right')) {
          if (this.menuIdx === 1) { g.save.little[0] = !g.save.little[0]; g.persist(); g.audio.sfx('uiMove'); }
          if (this.menuIdx === 2) { g.save.little[1] = !g.save.little[1]; g.persist(); g.audio.sfx('uiMove'); }
        }
        if (inp.anyPressed('confirm')) {
          g.audio.ensure();
          if (this.menuIdx === 0) { if (inp.deviceFor(0)) g.startRun(); }
          else if (this.menuIdx === 1) { g.save.little[0] = !g.save.little[0]; g.persist(); }
          else if (this.menuIdx === 2) { g.save.little[1] = !g.save.little[1]; g.persist(); }
          else g.setMuted(!g.audio.muted);
          g.audio.sfx('uiPick');
        }
        break;
      }
      case 'crossroads': {
        const slot = this.pickSlot;
        if (inp.menu(slot, 'left') || inp.anyMenu('left')) { this.cardIdx = (this.cardIdx + 2) % 3; g.audio.sfx('uiMove'); }
        if (inp.menu(slot, 'right') || inp.anyMenu('right')) { this.cardIdx = (this.cardIdx + 1) % 3; g.audio.sfx('uiMove'); }
        if (inp.anyPressed('confirm')) {
          const c = this.cards[this.cardIdx];
          if (c) {
            g.applyChoice(c, slot);
            this.cards.splice(this.cardIdx, 1);
            this.cardIdx = Math.min(this.cardIdx, this.cards.length - 1);
          }
          this.picksLeft--;
          this.pickSlot++;
          if (this.picksLeft <= 0 || !this.cards.length) {
            g.startWave(g.waveNum + 1);
          }
        }
        break;
      }
      case 'run':
        if (g.paused) {
          const n = 4;
          if (inp.anyMenu('up')) { this.pauseIdx = (this.pauseIdx + n - 1) % n; g.audio.sfx('uiMove'); }
          if (inp.anyMenu('down')) { this.pauseIdx = (this.pauseIdx + 1) % n; g.audio.sfx('uiMove'); }
          if (inp.anyPressed('confirm')) {
            if (this.pauseIdx === 0) g.paused = false;
            else if (this.pauseIdx === 1) g.setMuted(!g.audio.muted);
            else if (this.pauseIdx === 2) g.setShake(!g.fx.shakeEnabled);
            else { g.quitToTitle(); }
            g.audio.sfx('uiPick');
          }
        }
        break;
      case 'gameover': case 'victory':
        if (inp.anyPressed('confirm')) { g.audio.sfx('uiPick'); g.quitToTitle(); }
        break;
    }
  }

  // ============ RENDER ============
  render(ctx) {
    const g = this.g;
    switch (g.state) {
      case 'title': this.renderTitle(ctx); break;
      case 'run': this.renderWorld(ctx); this.renderHUD(ctx); if (g.paused) this.renderPause(ctx); break;
      case 'crossroads': this.renderWorld(ctx); this.renderCrossroads(ctx); break;
      case 'gameover': this.renderWorld(ctx); this.renderEnd(ctx, false); break;
      case 'victory': this.renderWorld(ctx); this.renderEnd(ctx, true); break;
    }
  }

  meadow(ctx, w, h, ox, oy) {
    ctx.fillStyle = '#79b562';
    ctx.fillRect(0, 0, w, h);
  }

  renderWorld(ctx) {
    const g = this.g, cam = g.camera;
    const cx = lerp(cam.px, cam.x, g.alpha);
    const cy = lerp(cam.py, cam.y, g.alpha);
    const cz = lerp(cam.pz, cam.zoom, g.alpha);

    ctx.fillStyle = '#5a8a4a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(VIEW_W / 2 + g.fx.shakeX, VIEW_H / 2 + g.fx.shakeY);
    ctx.scale(cz, cz);
    ctx.translate(-cx, -cy);

    // Meadow.
    ctx.fillStyle = '#79b562';
    ctx.fillRect(0, 0, g.arena.w, g.arena.h);
    // Mowed-stripe texture (the Tidy Empire's dream, our battlefield).
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let y = 0; y < g.arena.h; y += 120) ctx.fillRect(0, y, g.arena.w, 60);
    // Decor.
    for (const d of g.decor) {
      if (d.kind === 0) {
        ctx.fillStyle = d.c;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.257;
          ctx.beginPath(); ctx.ellipse(d.x + Math.cos(a) * 5 * d.s, d.y + Math.sin(a) * 5 * d.s, 3.4 * d.s, 2.2 * d.s, a, 0, 6.29); ctx.fill();
        }
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(d.x, d.y, 2.6 * d.s, 0, 6.29); ctx.fill();
      } else if (d.kind === 1) {
        ctx.strokeStyle = '#5f9a4e'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(d.x + i * 3, d.y + 3); ctx.quadraticCurveTo(d.x + i * 5, d.y - 4, d.x + i * 6, d.y - 8 * d.s); ctx.stroke();
        }
      } else if (d.kind === 2) {
        ctx.fillStyle = '#8a9484';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 6 * d.s, 4 * d.s, 0.4, 0, 6.29); ctx.fill();
      } else {
        ctx.fillStyle = '#6aa557';
        ctx.beginPath(); ctx.arc(d.x, d.y, 8 * d.s, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#79b562';
        ctx.beginPath(); ctx.arc(d.x - 2, d.y - 2, 5 * d.s, 0, 6.29); ctx.fill();
      }
    }
    // Hedge border.
    ctx.fillStyle = '#3f6e35';
    for (let x = 0; x < g.arena.w; x += 46) {
      ctx.beginPath(); ctx.arc(x + 23, 12, 24, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 23, g.arena.h - 12, 24, 0, 6.29); ctx.fill();
    }
    for (let y = 0; y < g.arena.h; y += 46) {
      ctx.beginPath(); ctx.arc(12, y + 23, 24, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(g.arena.w - 12, y + 23, 24, 0, 6.29); ctx.fill();
    }

    // Cages.
    for (const c of g.cages) {
      const wb = Math.sin(c.wob) * 2;
      ctx.fillStyle = '#8a6b45';
      rr(ctx, c.x - 16, c.y - 14 + wb, 32, 26, 4); ctx.fill();
      ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 2.5;
      rr(ctx, c.x - 16, c.y - 14 + wb, 32, 26, 4); ctx.stroke();
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(c.x + i * 8, c.y - 14 + wb); ctx.lineTo(c.x + i * 8, c.y + 12 + wb); ctx.stroke();
      }
      // Peeking eyes!
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(c.x - 4, c.y - 2 + wb, 3, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(c.x + 4, c.y - 2 + wb, 3, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.arc(c.x - 4 + Math.sin(c.wob) * 1.4, c.y - 2 + wb, 1.4, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.arc(c.x + 4 + Math.sin(c.wob) * 1.4, c.y - 2 + wb, 1.4, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', c.x, c.y - 22 + wb);
    }

    // Skunk clouds.
    for (const c of g.clouds) {
      ctx.globalAlpha = Math.min(0.4, c.life * 0.3);
      ctx.fillStyle = '#9adf75';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.29); ctx.fill();
      ctx.globalAlpha = Math.min(0.3, c.life * 0.2);
      ctx.fillStyle = '#c8f0a8';
      ctx.beginPath(); ctx.arc(c.x + Math.sin(g.time * 3) * 8, c.y - 5, c.r * 0.6, 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Acorns.
    const A = g.acornsList;
    for (let i = 0; i < A.n; i++) {
      const a = A.get(i);
      const x = lerp(a.px, a.x, g.alpha), y = lerp(a.py, a.y, g.alpha) + Math.sin(a.bob) * 2;
      ctx.fillStyle = '#c9843a';
      ctx.beginPath(); ctx.ellipse(x, y + 1, 4, 5, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#8a5a2a';
      ctx.beginPath(); ctx.arc(x, y - 3, 3.6, Math.PI, 0); ctx.fill();
    }

    g.enemies.renderGround(ctx);
    g.enemies.render(ctx, g.alpha, g);
    g.mob.render(ctx, g.alpha, g);
    for (const p of g.players) p.render(ctx, g.alpha, g);

    // Projectiles.
    const P = g.proj;
    for (let i = 0; i < P.n; i++) {
      const pr = P.get(i);
      const x = lerp(pr.px, pr.x, g.alpha), y = lerp(pr.py, pr.y, g.alpha);
      if (pr.spin) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(pr.ang);
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(-6, -4, 12, 8);
        ctx.strokeStyle = '#5a5a66'; ctx.lineWidth = 1.5; ctx.strokeRect(-6, -4, 12, 8);
        ctx.restore();
      } else {
        ctx.fillStyle = pr.color;
        ctx.beginPath(); ctx.arc(x, y, pr.friendly ? 4 : 5.5, 0, 6.29); ctx.fill();
        if (!pr.friendly) { ctx.strokeStyle = 'rgba(60,50,20,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }

    g.fx.render(ctx, g.alpha);
    ctx.restore();
  }

  renderHUD(ctx) {
    const g = this.g;
    // THE MOB COUNTER — the star of the HUD.
    const mc = g.mob.count();
    const pop = this.mobPop > 0 ? 1 + this.mobPop * 0.8 : 1;
    ctx.save();
    ctx.translate(VIEW_W / 2, 46);
    ctx.scale(pop, pop);
    ctx.font = `bold 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.75)';
    ctx.lineWidth = 6;
    ctx.strokeText(`MOB ${mc}`, 0, 0);
    ctx.fillStyle = mc >= MOB_CAP ? '#ffd166' : '#fff';
    ctx.fillText(`MOB ${mc}`, 0, 0);
    ctx.restore();
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`wave ${g.waveNum}/12 · ${Math.ceil(g.waveT)}s`, VIEW_W / 2, 68);

    // Piper hearts.
    g.players.forEach((p, i) => {
      const x = i === 0 ? 18 : VIEW_W - 18 - p.maxHearts * 22;
      for (let h = 0; h < p.maxHearts; h++) {
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = h < p.hearts ? p.color : 'rgba(0,0,0,0.3)';
        ctx.fillText('♥', x + h * 22, 30);
      }
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.fillText(`P${i + 1}${p.little ? ' ★' : ''}${p.downed ? ' — DOWN!' : ''}`, x, 48);
    });

    // Acorns.
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`🌰 ${g.runStats.acorns}`, 18, 76);

    // Species tally (bottom-left): icon dots + counts.
    const tally = {};
    for (const c of g.mob.list) {
      if (c.bagged) continue;
      const k = c.sp + c.tier;
      tally[k] = tally[k] || { sp: c.sp, tier: c.tier, n: 0 };
      tally[k].n++;
    }
    const rows = Object.values(tally).sort((a, b) => (b.tier - a.tier) || (b.n - a.n)).slice(0, 8);
    let tx = 18;
    for (const r of rows) {
      const def = SPECIES[r.sp];
      ctx.fillStyle = def.body;
      ctx.beginPath(); ctx.arc(tx + 7, VIEW_H - 24, 6 + r.tier * 1.6, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(30,45,20,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tx + 7, VIEW_H - 24, 6 + r.tier * 1.6, 0, 6.29); ctx.stroke();
      if (r.tier >= 2) drawCrown(ctx, tx + 7, VIEW_H - 36 - r.tier, 8);
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`×${r.n}`, tx + 16 + r.tier, VIEW_H - 20);
      tx += 44 + r.tier * 3;
    }

    // Boss bar.
    if (g.boss) {
      const b = g.boss;
      const w = Math.min(520, VIEW_W - 220);
      const x = (VIEW_W - w) / 2, y = VIEW_H - 46;
      ctx.fillStyle = 'rgba(20,30,15,0.7)';
      rr(ctx, x - 8, y - 22, w + 16, 44, 8); ctx.fill();
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8c33a';
      ctx.fillText(b.def.name, VIEW_W / 2, y - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      rr(ctx, x, y, w, 12, 6); ctx.fill();
      const f = clamp(b.hp / b.maxHp, 0, 1);
      if (f > 0) { ctx.fillStyle = '#e05c5c'; rr(ctx, x, y, Math.max(10, w * f), 12, 6); ctx.fill(); }
    }

    // Whistle hint (first wave only).
    if (g.waveNum === 1 && g.runStats.time < 12) {
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${0.6 + Math.sin(this.t * 4) * 0.3})`;
      ctx.fillText(`move: stick/WASD · hold ${g.input.glyph(0, 'whistle')} to SEND the mob · ${g.input.glyph(0, 'recall')} recalls`, VIEW_W / 2, VIEW_H - 70);
    }

    // Banner.
    if (this.bannerData) {
      const b = this.bannerData;
      const t = b.t / b.max;
      const pop2 = t > 0.85 ? 1 + (1 - (t - 0.85) / 0.15) * 0.15 : 1;
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H * 0.3);
      ctx.scale(pop2, pop2);
      ctx.globalAlpha = Math.min(1, t * 4);
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(30,45,20,0.8)';
      ctx.lineWidth = 6;
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  renderCrossroads(ctx) {
    const g = this.g;
    ctx.fillStyle = 'rgba(25,40,18,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `bold 36px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.8)'; ctx.lineWidth = 5;
    ctx.strokeText('THE MOB GROWS', VIEW_W / 2, 110);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('THE MOB GROWS', VIEW_W / 2, 110);
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#d8ecc8';
    const who = g.players.length > 1 ? `PLAYER ${this.pickSlot + 1} picks!` : 'pick one!';
    ctx.fillText(who, VIEW_W / 2, 145);

    const cw = 300, ch = 340;
    const total = this.cards.length;
    this.cards.forEach((c, i) => {
      const x = VIEW_W / 2 + (i - (total - 1) / 2) * (cw + 30) - cw / 2;
      const y = 190;
      const hot = this.cardIdx === i;
      const lift = hot ? -14 : 0;
      ctx.fillStyle = hot ? '#fff8e8' : 'rgba(245,240,225,0.92)';
      rr(ctx, x, y + lift, cw, ch, 16); ctx.fill();
      ctx.strokeStyle = hot ? '#ffd166' : '#8a9a72';
      ctx.lineWidth = hot ? 5 : 3;
      rr(ctx, x, y + lift, cw, ch, 16); ctx.stroke();

      // Card art: species portrait or symbol.
      if (c.kind === 'pack' || (c.needsUnlock && SPECIES[c.needsUnlock])) {
        const sp = c.species || c.needsUnlock;
        if (sp && SPECIES[sp]) {
          const spr = g.mob.sprite(sp, c.kind === 'pack' ? 1 : 1);
          const scale = hot ? 2.6 : 2.3;
          ctx.save();
          ctx.translate(x + cw / 2, y + lift + 110);
          ctx.scale(scale, scale);
          if (hot) ctx.rotate(Math.sin(this.t * 5) * 0.08);
          ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
          ctx.restore();
        }
      } else {
        ctx.font = `${hot ? 74 : 64}px sans-serif`;
        ctx.textAlign = 'center';
        const glyphs = { star: '⭐', heart: '💪', wind: '💨', bolt: '⚡', burst: '💥', note: '🎵', swirl: '😵', crown: '👑' };
        ctx.fillText(glyphs[c.icon] || '✨', x + cw / 2, y + lift + 135);
      }

      ctx.font = `bold 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4a3a24';
      ctx.fillText(c.title, x + cw / 2, y + lift + 220);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = '#6a5a44';
      this.wrap(ctx, c.desc, x + cw / 2, y + lift + 252, cw - 40, 20);
      if (c.kind === 'pack' && SPECIES[c.species]) {
        ctx.font = `bold 13px ${FONT}`;
        ctx.fillStyle = '#8a7a5a';
        const def = SPECIES[c.species];
        ctx.fillText(`${def.role.toUpperCase()} · dmg ${def.dmg} · hp ${def.hp}`, x + cw / 2, y + lift + ch - 24);
      }
      if (hot) {
        ctx.font = `bold 15px ${FONT}`;
        ctx.fillStyle = '#c9531a';
        ctx.fillText(`${g.input.glyph(this.pickSlot, 'confirm')} — take it!`, x + cw / 2, y + lift + ch + 30);
      }
    });
  }

  renderPause(ctx) {
    const g = this.g;
    ctx.fillStyle = 'rgba(25,40,18,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `bold 42px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(g.pauseReason ? '🎮 ' + g.pauseReason.toUpperCase() : 'PAUSED', VIEW_W / 2, 200);
    const items = ['Keep marching', `Sound: ${g.audio.muted ? 'OFF' : 'on'}`, `Screen shake: ${g.fx.shakeEnabled ? 'on' : 'off'}`, 'Disband (quit)'];
    items.forEach((s, i) => {
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = this.pauseIdx === i ? '#ffd166' : '#d8ecc8';
      ctx.fillText((this.pauseIdx === i ? '🐸 ' : '') + s, VIEW_W / 2, 280 + i * 48);
    });
  }

  renderTitle(ctx) {
    const g = this.g;
    // Meadow sky.
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, '#8fd0ff');
    grd.addColorStop(0.55, '#c9ecff');
    grd.addColorStop(0.55, '#79b562');
    grd.addColorStop(1, '#5a8a4a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Parade of critters along the bottom.
    this.titleParade.forEach((p, i) => {
      const spr = g.mob.sprite(p.sp, 1 + (i % 3 === 0 ? 1 : 0));
      const hop = Math.abs(Math.sin(this.t * 6 + i)) * -6;
      ctx.save();
      ctx.translate(p.x, VIEW_H - 80 + hop);
      ctx.scale(2, 2);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
    });

    ctx.save();
    ctx.translate(VIEW_W / 2, 170);
    ctx.rotate(-0.02);
    ctx.font = `bold 96px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(30,45,20,0.85)';
    ctx.lineWidth = 10;
    ctx.strokeText('MOB RULE', 0, 0);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('MOB RULE', 0, 0);
    ctx.restore();
    ctx.font = `italic bold 22px ${FONT}`;
    ctx.fillStyle = '#3a5a2e';
    ctx.textAlign = 'center';
    ctx.fillText('lead the critters. flood the lawn. unplug the Tidy Empire.', VIEW_W / 2, 215);

    const items = [
      'MARCH!  (start run)',
      `P1 Little Piper mode: ${g.save.little[0] ? 'ON ★' : 'off'}`,
      `P2 Little Piper mode: ${g.save.little[1] ? 'ON ★' : 'off'}`,
      `Sound: ${g.audio.muted ? 'OFF' : 'ON'}`,
    ];
    items.forEach((s, i) => {
      ctx.font = `bold ${i === 0 ? 30 : 20}px ${FONT}`;
      ctx.fillStyle = this.menuIdx === i ? '#fff' : 'rgba(255,255,255,0.72)';
      if (this.menuIdx === i) {
        ctx.strokeStyle = 'rgba(30,45,20,0.6)'; ctx.lineWidth = 5;
        ctx.strokeText((i === 0 ? '🐸 ' : '') + s, VIEW_W / 2, 300 + i * 52);
      }
      ctx.fillText((this.menuIdx === i && i !== 0 ? '▶ ' : i === 0 && this.menuIdx === 0 ? '🐸 ' : '') + s, VIEW_W / 2, 300 + i * 52);
    });

    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const d0 = g.input.deviceFor(0), d1 = g.input.deviceFor(1);
    ctx.fillText(d0 ? `P1: ${d0.label}` : 'P1: press a button to claim a device', VIEW_W / 2, 530);
    ctx.fillText(d1 ? `P2: ${d1.label} — co-op ON` : 'P2: press a button on another device to join', VIEW_W / 2, 552);

    // Unlock strip.
    let ux = VIEW_W / 2 - (SPECIES_IDS.length * 34) / 2;
    for (const sp of SPECIES_IDS) {
      const un = g.unlocked(sp);
      ctx.globalAlpha = un ? 1 : 0.3;
      const spr = g.mob.sprite(sp, 1);
      ctx.drawImage(spr, ux, 580, 30, 30);
      if (!un) {
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${SPECIES[sp].unlock}🌰`, ux + 15, 624);
      }
      ctx.globalAlpha = 1;
      ux += 34;
    }
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`lifetime acorns: ${g.save.acorns} · best wave: ${g.save.bestWave} · biggest mob ever: ${g.save.biggestMob}`, VIEW_W / 2, 650);
    ctx.fillText('tip: ' + this.tip, VIEW_W / 2, 672);
  }

  renderEnd(ctx, won) {
    const g = this.g;
    ctx.fillStyle = won ? 'rgba(40,60,25,0.82)' : 'rgba(35,30,25,0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = `bold 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(20,30,12,0.85)'; ctx.lineWidth = 7;
    const title = won ? '🌿 NATURE WINS 🌿' : 'the mob scattered…';
    ctx.strokeText(title, VIEW_W / 2, 160);
    ctx.fillStyle = won ? '#ffd166' : '#d8d0c8';
    ctx.fillText(title, VIEW_W / 2, 160);
    ctx.font = `italic 19px ${FONT}`;
    ctx.fillStyle = '#e8e0d0';
    this.wrap(ctx, this.endLine, VIEW_W / 2, 205, 640, 24);

    ctx.font = `bold 19px ${FONT}`;
    ctx.fillStyle = '#fff';
    const s = g.runStats;
    const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    ctx.fillText(`wave ${g.waveNum}/12 · ${s.bots} bots scrapped · biggest mob: ${g.mob.biggest} · 🌰 ${s.acorns} · ${mins}:${String(secs).padStart(2, '0')}`, VIEW_W / 2, 270);

    if (this.gUnlockY == null) this.gUnlockY = 0;
    if (g.newUnlocks && g.newUnlocks.length) {
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = '#7ec850';
      ctx.fillText(`🎉 NEW SPECIES UNLOCKED: ${g.newUnlocks.map(sp => SPECIES[sp].name).join(', ')}!`, VIEW_W / 2, 320);
    }

    // The mob takes a bow (or wanders off).
    const rows = {};
    for (const c of g.mob.list) { rows[c.sp + c.tier] = rows[c.sp + c.tier] || { sp: c.sp, tier: c.tier, n: 0 }; rows[c.sp + c.tier].n++; }
    const list = Object.values(rows).sort((a, b) => b.tier - a.tier).slice(0, 10);
    let x = VIEW_W / 2 - list.length * 42;
    for (const r of list) {
      const spr = g.mob.sprite(r.sp, r.tier);
      const hop = won ? Math.abs(Math.sin(this.t * 6 + x)) * -8 : 0;
      ctx.save();
      ctx.translate(x + 40, 420 + hop);
      ctx.scale(1.8, 1.8);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(`×${r.n}`, x + 40, 465);
      x += 84;
    }

    if (Math.sin(this.t * 4) > -0.3) {
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText('press confirm — the meadow always needs a piper', VIEW_W / 2, VIEW_H - 80);
    }
  }

  wrap(ctx, str, cx, y, maxW, lh) {
    const words = String(str).split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); line = w; yy += lh; }
      else line = test;
    }
    if (line) ctx.fillText(line, cx, yy);
  }
}
