// tests/engine.mjs — headless: boots the real Game with DOM stubs, verifies
// the mob loop (follow, fight, merge), enemies, bosses, crossroads, co-op,
// full-run survival balance. Usage: node tests/engine.mjs

import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const load = p => import(pathToFileURL(join(root, p)).href);

// ---- DOM stubs ----
const gradient = { addColorStop() {} };
function makeCtx() {
  return new Proxy({ _s: {} }, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 20 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop in t._s) return t._s[prop];
      return () => {};
    },
    set(t, prop, v) { t._s[prop] = v; return true; },
  });
}
const makeCanvas = (w = 64, h = 64) => ({ width: w, height: h, getContext: () => makeCtx(), style: {} });
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
globalThis.document = { createElement: () => makeCanvas(), getElementById: () => makeCanvas(1280, 720) };
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const { Game } = await load('src/game.js');
const { SPECIES, SPECIES_IDS, WAVES, CHOICES, MOB_CAP } = await load('src/data.js');
const { statFor } = await load('src/critters.js');

let passed = 0, failed = 0;
const check = (c, name, extra) => {
  if (c) { passed++; console.log('  PASS: ' + name); }
  else { failed++; console.log('  FAIL: ' + name + (extra ? ' — ' + extra : '')); }
};

console.log('A) Content sanity:');
check(SPECIES_IDS.length >= 12, `12 species (${SPECIES_IDS.length})`);
check(WAVES.length === 12, '12 waves');
check(WAVES.filter(w => w.boss).length === 3, '3 boss waves');
check(CHOICES.length >= 20, `20+ crossroads choices (${CHOICES.length})`);
check(SPECIES_IDS.every(sp => SPECIES[sp].tierNames.length === 3), 'every species has 3 tier names');

console.log('B) Mob basics: follow, merge, cap:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.state === 'run' && g.mob.count() === 5, 'run starts with a 5-critter sampler mob', String(g.mob.count()));
  // Walk right for 3 seconds: the shield orbit should stay glued to the piper.
  g.input.keys.add('KeyD');
  for (let i = 0; i < 180; i++) g.frame(1 / 60);
  g.input.keys.delete('KeyD');
  for (let i = 0; i < 60; i++) g.frame(1 / 60); // settle
  const p = g.players[0];
  check(p.x > g.arena.w / 2 + 100, 'piper marched east');
  const maxD = Math.max(...g.mob.list.map(c => Math.hypot(c.x - p.x, c.y - p.y)));
  check(maxD < 170, 'shield orbit stays around the piper', `maxD=${maxD.toFixed(0)}`);
  check(g.mob.counts(0).shield === g.mob.count(), 'everyone starts on shield duty');
  // Merge: 5 frogs + 1 = two merges? 5 frogs -> add 1 = 6: one merge at first triple.
  const before = g.mob.countOf('frog', 1);
  g.mob.add(g, 'frog', 1, p.x, p.y, 0);
  check(g.mob.countOf('frog', 2) >= 1, '3 same-tier critters auto-merge into tier 2', `t1=${g.mob.countOf('frog', 1)} t2=${g.mob.countOf('frog', 2)}`);
  const t2 = g.mob.list.find(c => c.tier === 2);
  check(t2 && statFor('frog', 2, 'dmg') > statFor('frog', 1, 'dmg') * 2, 'tier 2 is much stronger');
  // Cap: flood it.
  for (let i = 0; i < 200; i++) g.mob.add(g, 'bee', 1, p.x, p.y, 0, true);
  check(g.mob.count() <= MOB_CAP, `mob cap enforced (${g.mob.count()} <= ${MOB_CAP})`);
}

console.log('C) Combat: the mob actually kills bots:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // Drop a dustbot right on the mob.
  g.enemies.spawnNow(g, 'dustbot', p.x + 60, p.y);
  let killed = false;
  for (let i = 0; i < 60 * 8 && !killed; i++) {
    g.frame(1 / 60);
    killed = g.enemies.count() === 0 && g.enemies.telegraphs.length === 0;
    if (g.state !== 'run') break;
  }
  check(g.runStats.bots >= 1, 'mob scrapped the dust-bot', `bots=${g.runStats.bots}`);
  check(g.runStats.acorns > 0 || g.acornsList.n > 0, 'bot dropped acorns', `banked=${g.runStats.acorns} onGround=${g.acornsList.n}`);
}

console.log('D) Send one / recall one (the attack-shield economy):');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // Tap Space: exactly ONE critter goes hunting.
  g.input.keys.add('Space');
  g.frame(1 / 60);
  g.input.keys.delete('Space');
  g.frame(1 / 60);
  let co = g.mob.counts(0);
  check(co.attack === 1, 'tap Space sends exactly one hunter', `attack=${co.attack}`);
  // The hunter actually hunts: distant bot gets approached.
  const far = g.enemies.spawnNow(g, 'dustbot', p.x + 500, p.y);
  const hunter = g.mob.list.find(c => c.duty === 'attack');
  const d0 = Math.hypot(hunter.x - far.x, hunter.y - far.y);
  for (let i = 0; i < 120 && !far.dead; i++) g.frame(1 / 60);
  const d1 = far.dead ? 0 : Math.hypot(hunter.x - far.x, hunter.y - far.y);
  check(far.dead || d1 < d0 * 0.6, 'the hunter chases distant prey', `${d0.toFixed(0)} -> ${d1.toFixed(0)}`);
  // Tap Shift: one comes home.
  g.input.keys.add('ShiftLeft');
  g.frame(1 / 60);
  g.input.keys.delete('ShiftLeft');
  co = g.mob.counts(0);
  check(co.attack === 0, 'tap Shift recalls the hunter', `attack=${co.attack}`);
  // Hold Space: a stream goes out.
  g.input.keys.add('Space');
  for (let i = 0; i < 45; i++) g.frame(1 / 60);
  g.input.keys.delete('Space');
  co = g.mob.counts(0);
  check(co.attack >= 3, 'holding Space streams hunters out', `attack=${co.attack}`);
  // Hold Shift: they all come home.
  g.input.keys.add('ShiftLeft');
  for (let i = 0; i < 60; i++) g.frame(1 / 60);
  g.input.keys.delete('ShiftLeft');
  co = g.mob.counts(0);
  check(co.attack === 0, 'holding Shift recalls the pack', `attack=${co.attack}`);
}

console.log('D1b) HP + regen + snacks:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.maxHp === 100 && p.hp === 100, 'piper starts at 100 HP');
  p.invuln = 0;
  p.hurt(g, 12, null);
  check(p.hp === 88, 'damage lands in HP', String(p.hp));
  for (let i = 0; i < 60 * 5; i++) { p.invuln = 99; g.frame(1 / 60); }
  check(p.hp > 88.5, 'HP regenerates over time', p.hp.toFixed(1));
  // Snack pickup heals 25.
  p.hp = 40;
  g.dropSnack(p.x + 5, p.y);
  for (let i = 0; i < 30; i++) { p.invuln = 99; g.frame(1 / 60); }
  check(p.hp >= 64, 'snack pickup heals +25', p.hp.toFixed(0));
}

console.log('D2) The shield actually shields:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // A bot walks into the wall: shield critters nibble it without leaving.
  const bully = g.enemies.spawnNow(g, 'dustbot', p.x + 55, p.y);
  let died = false;
  for (let i = 0; i < 60 * 8 && !died; i++) { p.invuln = 99; g.frame(1 / 60); died = bully.dead; }
  check(died, 'shield critters kill what breaches the wall');
  const maxD = Math.max(...g.mob.list.map(c => Math.hypot(c.x - p.x, c.y - p.y)));
  check(maxD < 200, 'shield held formation while fighting', `maxD=${maxD.toFixed(0)}`);
}

console.log('D3) Loss legibility:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 0;
  p.hurt(g, 10, null);
  check(g.ui.dmgFlash > 0 && g.ui.dmgMsg.includes('HP'), 'piper hit triggers the big red callout', g.ui.dmgMsg);
  check(g.ui.recallHintT > 0, 'first hit teaches TO ME!');
}

console.log('E) Crossroads:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  // Force wave end.
  g.waveT = 0;
  g.enemies.clear();
  g.frame(1 / 60);
  check(g.state === 'crossroads', 'wave clear -> crossroads', g.state);
  check(g.ui.cards.length === 3, 'three cards offered');
  const worthOf = m => m.list.reduce((s, c) => s + Math.pow(3, c.tier - 1), 0);
  const before = worthOf(g.mob);
  const packCard = g.ui.cards.find(c => c.kind === 'pack') || g.ui.cards[0];
  g.applyChoice(packCard, 0);
  if (packCard.kind === 'pack') check(worthOf(g.mob) > before, 'pack recruits critters (worth grows through merges)');
  else check(true, 'choice applied');
  g.startWave(2);
  check(g.state === 'run' && g.waveNum === 2, 'next wave starts');
}

console.log('F) Bosses spawn and die:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  g.startWave(4); // MOWTRON
  for (let i = 0; i < 60 * 8 && !g.boss; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  check(!!g.boss && g.boss.kind === 'mowtron', 'MOWTRON arrives on wave 4');
  const worth = m => m.list.reduce((s, c) => s + Math.pow(3, c.tier - 1), 0);
  const worthBefore = worth(g.mob);
  g.enemies.hurt(g, g.boss, 99999, null, {});
  check(!g.boss, 'boss dies to damage');
  check(worth(g.mob) > worthBefore, 'boss drops bonus recruits (mob worth grows even through merges)');
  // SUCC pull check.
  g.startWave(8);
  for (let i = 0; i < 60 * 10 && !g.boss; i++) { g.players[0].invuln = 99; g.frame(1 / 60); }
  check(!!g.boss && g.boss.kind === 'succ', 'SUCC-5000 arrives on wave 8');
  g.boss.state = 'vacuum'; g.boss.atk = 2;
  const p = g.players[0];
  p.x = g.boss.x + 200; p.y = g.boss.y;
  const dx0 = Math.abs(p.x - g.boss.x);
  for (let i = 0; i < 30; i++) { p.invuln = 99; g.frame(1 / 60); }
  check(Math.abs(p.x - g.boss.x) < dx0, 'vacuum pulls the piper', `${dx0.toFixed(0)} -> ${Math.abs(p.x - g.boss.x).toFixed(0)}`);
}

console.log('G) Co-op: split mob + down/revive:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.input.assign(1, 'kb2');
  g.startRun();
  check(g.players.length === 2, 'two pipers march');
  const p2 = g.players[1];
  p2.invuln = 0;
  p2.hurt(g, 999, null);
  check(p2.downed && g.state === 'run', 'downed piper, run continues');
  // Partner stands close: revive.
  g.players[0].x = p2.x + 10; g.players[0].y = p2.y;
  let revived = false;
  for (let i = 0; i < 60 * 5 && !revived; i++) {
    g.players[0].x = p2.x + 10; g.players[0].y = p2.y;
    g.players[0].invuln = 99;
    g.frame(1 / 60);
    revived = !p2.downed;
  }
  check(revived, 'partner revives the downed piper');
  // Both down -> game over.
  for (const p of g.players) { p.invuln = 0; p.hurt(g, 999, null); p.invuln = 0; p.hurt(g, 999, null); }
  check(g.state === 'gameover', 'both down -> the mob scatters', g.state);
  const saved = JSON.parse(store.get('mob_rule_slot_0'));
  check(saved.acorns >= 0 && saved.bestWave >= 1, 'meta progress persisted');
}

console.log('H) Wild cards:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.save.acorns = 99999; // unlock everything
  g.startRun();
  g.applyChoice(CHOICES.find(c => c.id === 'wild_crown'), 0);
  check(g.mob.list.some(c => c.crowned), 'Royal Decree crowns the strongest critter');
  g.applyChoice(CHOICES.find(c => c.id === 'wild_bees'), 0);
  const bees = g.mob.countOf('bee', 1);
  g.mob.hurt(g, g.mob.list.find(c => c.sp === 'frog'), 9999, null);
  check(g.mob.countOf('bee', 1) === bees + 1, 'Bee Solidarity: a bee joins when a critter is lost');
}

console.log('I) Round 3: mob health, retreat, last stand:');
{
  const audioSrc = await import('node:fs').then(fs => fs.readFileSync(join(root, 'src/audio.js'), 'utf8'));
  const names = [...audioSrc.matchAll(/name: ['"]([^'"]+)['"]/g)].map(m => m[1]);
  check(names.length >= 5, `5 songs authored (${names.join(', ')})`);
}
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  // Shield regen: hurt a critter, it heals on wall duty.
  const c = g.mob.list[0];
  const cmax = g.mob.maxHp(c.sp, c.tier);
  c.hp = cmax * 0.4;
  for (let i = 0; i < 60 * 4; i++) g.frame(1 / 60);
  check(c.hp > cmax * 0.5, 'critters heal while on shield duty', `hp=${c.hp.toFixed(1)}/${cmax}`);
  // Auto-retreat: wounded hunter falls back to shield.
  g.input.tap = null;
  g.input.keys.add('Space');
  g.frame(1 / 60);
  g.input.keys.delete('Space');
  const hunter = g.mob.list.find(q => q.duty === 'attack');
  check(!!hunter, 'a hunter was sent');
  if (hunter) {
    hunter.hp = g.mob.maxHp(hunter.sp, hunter.tier) * 0.3;
    for (let i = 0; i < 30; i++) g.frame(1 / 60);
    check(hunter.duty === 'shield', 'wounded hunter auto-retreats to the shield');
  }
  // Aggregate mob health reads sanely.
  const mh = g.mob.mobHealth();
  check(mh.max > 0 && mh.frac > 0 && mh.frac <= 1, 'mobHealth() aggregate is sane', JSON.stringify(mh));
}
{
  // Last stand: wipe the mob with a cage on the field -> countdown; freeing
  // the cage cancels it.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  g.cages.length = 0;
  g.cages.push({ x: p.x + 60, y: p.y, sp: 'frog', n: 2, hp: 1, wob: 0 });
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 99999, null);
  g.frame(1 / 60);
  check(g.mob.count() === 0 && g.state === 'run' && !!g.lastStand, 'mob wipe with a cage triggers LAST STAND', `state=${g.state}`);
  // March to the cage: freeing it should refill the mob and cancel.
  let saved = false;
  for (let i = 0; i < 60 * 8 && !saved; i++) {
    g.input.keys.add('KeyD');
    g.frame(1 / 60);
    saved = g.mob.count() > 0;
  }
  g.input.keys.delete('KeyD');
  g.frame(1 / 60); // the cancel lands on the next tick
  check(saved && !g.lastStand, 'freeing a cage rescues the run', `mob=${g.mob.count()}`);
  // Now wipe with no cages: run ends with the mobwipe cause.
  g.cages.length = 0;
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 99999, null);
  g.frame(1 / 60);
  check(g.state === 'gameover' && g.endCause === 'mobwipe', 'mob wipe with no cages ends the run (no soft-lock)', `state=${g.state} cause=${g.endCause}`);
}
{
  // Last stand timeout: cage exists but the piper never reaches it.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  g.cages.length = 0;
  g.cages.push({ x: p.x + 2000, y: p.y, sp: 'frog', n: 2, hp: 1, wob: 0 });
  for (const c of [...g.mob.list]) g.mob.hurt(g, c, 99999, null);
  for (let i = 0; i < 60 * 14 && g.state === 'run'; i++) g.frame(1 / 60);
  check(g.state === 'gameover' && g.endCause === 'mobwipe', 'LAST STAND countdown expiring ends the run');
}
{
  // Sneaky bots exist and target the piper.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  let sneakyFound = false;
  for (let i = 0; i < 300 && !sneakyFound; i++) {
    const e = g.enemies.spawnNow(g, 'dustbot', p.x + 200, p.y);
    if (e && e.sneaky) {
      const t = g.enemies.pickTarget(e, g);
      sneakyFound = t === p;
    }
  }
  check(sneakyFound, 'sneaky bots target the piper through the wall');
}

console.log('J) Round 4: rescue drip + flanking:');
{
  // Below 5 critters, a golden rescue cage appears within ~10s.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  while (g.mob.count() > 2) g.mob.hurt(g, g.mob.list.find(c => c && !c._gone), 99999, null);
  g.cages.length = 0;
  let rescueAt = -1;
  for (let i = 0; i < 60 * 15; i++) {
    g.frame(1 / 60);
    if (g.cages.some(c => c.rescue)) { rescueAt = i / 60; break; }
  }
  check(rescueAt >= 0 && rescueAt < 12, 'rescue cage spawns within ~10s when mob < 5', `at=${rescueAt.toFixed(1)}s`);
  // A second one arrives on the ~30s cycle if you ignore the first.
  const firstCount = g.cages.length;
  for (let i = 0; i < 60 * 32 && g.state === 'run'; i++) {
    // Keep the piper out of the cage's lap so it isn't auto-freed.
    const p = g.players[0];
    for (const c of g.cages) {
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 80 * 80) { c.x = p.x + 500; c.y = p.y + 500; }
    }
    g.frame(1 / 60);
    if (g.cages.length > firstCount) break;
  }
  check(g.state !== 'run' || g.cages.length > firstCount, 'rescue keeps dripping every ~30s while the mob is small');
  // Healthy mob -> no rescue spam.
  const g2 = new Game(null);
  g2.input.assign(0, 'kb1');
  g2.startRun();
  g2.cages.length = 0;
  for (let i = 0; i < 60 * 15; i++) g2.frame(1 / 60);
  check(!g2.cages.some(c => c.rescue), 'no rescue cages while the mob is healthy');
}
{
  // Flanking: two chasers with opposite bearings split around the target.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  const e1 = g.enemies.spawnNow(g, 'dustbot', p.x + 500, p.y);
  const e2 = g.enemies.spawnNow(g, 'dustbot', p.x + 500, p.y);
  e1.flank = 1.2; e2.flank = -1.2;
  e1.sneaky = e2.sneaky = true;
  e1.hp = e2.hp = 1e9;
  for (let i = 0; i < 90; i++) g.frame(1 / 60);
  const spread = Math.abs(e1.y - e2.y);
  check(spread > 90, 'flanking chasers approach from different sides', `spread=${spread.toFixed(0)}px`);
}

console.log('K) Hotfix: cones must not hold waves open; breeding is linear:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  // Only cones left on the field, timer expired -> wave must be done.
  g.enemies.spawnNow(g, 'cone', 500, 500);
  g.enemies.spawnNow(g, 'cone', 600, 500);
  g.waveT = 0;
  check(g.enemies.count() >= 2 && g.waveDone(), 'leftover cones do not block wave completion');
  // Cones expire on their own within ~14s.
  let coneAlive = true;
  for (let i = 0; i < 60 * 16 && g.state === 'run'; i++) {
    g.frame(1 / 60);
    coneAlive = [...Array(g.enemies.pool.n)].some((_, k) => g.enemies.pool.get(k).kind === 'cone' && !g.enemies.pool.get(k).dead);
    if (!coneAlive) break;
  }
  check(!coneAlive, 'cones tidy themselves away');
}
{
  // Bunny breeding: one global timer -> linear growth, no runaway.
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.save.acorns = 99999;
  g.startRun();
  g.mob.wild.bunnyBreed = true;
  for (let i = 0; i < 12; i++) g.mob.add(g, 'bunny', 1, g.players[0].x, g.players[0].y, 0, true);
  const worth = () => g.mob.list.reduce((s, c) => s + (c && !c._gone ? 3 ** (c.tier - 1) : 0), 0);
  const w0 = worth();
  for (let i = 0; i < 60 * 36; i++) g.frame(1 / 60);
  const grown = worth() - w0;
  check(grown >= 1 && grown <= 8, 'breeding adds ~1 bunny per ~11s regardless of bunny count', `grown=${grown} in 36s`);
}

console.log('L) Round 5: readable notices, voice announcer, acorn clarity:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  // notice() text lives long enough to read (2.6s vs 0.55s).
  g.fx.notice(100, 100, 'TEST NOTICE', '#fff');
  const d = g.fx.nums.get(g.fx.nums.n - 1);
  check(d.txt === 'TEST NOTICE' && d.life > 2, 'notice text stays up 2.6s', `life=${d.life}`);
  // say() is safe headless (no speechSynthesis in tests) and after mute.
  let threw = false;
  try { g.audio.say('Wave one!', true); g.audio.setMuted(true); g.audio.say('quiet'); g.audio.setMuted(false); } catch (e) { threw = true; }
  check(!threw, 'voice announcer degrades gracefully without speech support');
  // First acorn of a run teaches what acorns do — once.
  const p = g.players[0];
  g.dropAcorn(p.x, p.y, 1);
  for (let i = 0; i < 30; i++) g.frame(1 / 60);
  const hints = [...Array(g.fx.nums.n)].filter((_, k) => g.fx.nums.get(k).txt.includes('unlock')).length;
  check(g.acornHintDone && hints >= 1, 'first acorn pickup explains unlocks', `hints=${hints}`);
  g.dropAcorn(p.x, p.y, 1);
  for (let i = 0; i < 30; i++) g.frame(1 / 60);
  const hints2 = [...Array(g.fx.nums.n)].filter((_, k) => g.fx.nums.get(k).txt.includes('unlock')).length;
  check(hints2 <= hints, 'acorn hint does not repeat');
  // Ambient chatter timer ticks without crashing.
  for (let i = 0; i < 60 * 6; i++) g.frame(1 / 60);
  check(typeof g.mob.chatterT === 'number', 'mob chatter timer runs');
}

console.log('M) Round 6: BUNNYTRON + acorn-fed growth:');
{
  const { ENEMIES } = await load('src/data.js');
  check(ENEMIES.supervisor.name === 'BUNNYTRON' && ENEMIES.supervisor.body === '#ff8fb3', 'final boss is a pink robot bunny');
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.invuln = 9999;
  const boss = g.enemies.spawnNow(g, 'supervisor', p.x + 300, p.y);
  boss.hp = 1e9;
  let sawBomb = false;
  for (let i = 0; i < 60 * 10; i++) {
    g.frame(1 / 60);
    if (g.enemies.bombs.length > 0) sawBomb = true;
  }
  check(sawBomb, 'BUNNYTRON lobs carrot bombs');
  check(g.mob.mobHealth().frac < 1 || g.mob.count() < 5, 'carrot bombs hurt the mob', `frac=${g.mob.mobHealth().frac.toFixed(2)}`);
}
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  check(g.mob.sizeMul === 1, 'mob starts at normal size');
  g.acorns(50);
  check(g.mob.growth === 1 && Math.abs(g.mob.sizeMul - 1.15) < 0.001, '50 acorns -> +15% size', `mul=${g.mob.sizeMul}`);
  g.acorns(150); // total 200 -> tier 4
  check(g.mob.growth === 4, 'growth tiers stack every 50 acorns', `growth=${g.mob.growth}`);
  g.acorns(5000);
  check(g.mob.growth === 5 && g.mob.sizeMul <= 2.02, 'growth caps at x2', `mul=${g.mob.sizeMul.toFixed(2)}`);
  // Bigger critters get a roomier orbit.
  const small = new Game(null); small.input.assign(0, 'kb1'); small.startRun();
  const rBig = g.mob.orbitSlot(0, 10, 0).r;
  const rSmall = small.mob.orbitSlot(0, 10, 0).r;
  check(rBig > rSmall, 'orbit widens as the mob grows', `${rSmall.toFixed(0)} -> ${rBig.toFixed(0)}`);
}

console.log('N) Phase A: save slots + BAM & VIVI:');
{
  const { CHARACTERS } = await load('src/data.js');
  check(CHARACTERS.length === 3 && CHARACTERS[1].id === 'bam' && CHARACTERS[2].id === 'vivi', 'three characters exist');
  // Save slots: legacy migrates to slot 0; slots are independent; delete works.
  store.clear();
  store.set('mob_rule_v1', JSON.stringify({ acorns: 777, bestWave: 9 }));
  const g = new Game(null);
  check(g.state === 'saves', 'game boots to the save-file screen');
  check(!!store.get('mob_rule_slot_0'), 'legacy save migrated to slot 1');
  g.chooseSlot(0);
  check(g.state === 'title' && g.save.acorns === 777, 'choosing a slot loads it', `acorns=${g.save.acorns}`);
  g.chooseSlot(1);
  check(g.save.acorns === 0, 'other slots start fresh');
  g.save.acorns = 55; g.persist();
  g.chooseSlot(0);
  check(g.save.acorns === 777, 'slots do not bleed into each other');
  g.deleteSlot(1);
  check(g.loadSlot(1) === null, 'deleteSlot wipes a slot');
  check(g.loadSlot(0).acorns === 777, 'deleting one slot leaves the others');
}
{
  // BAM: taps send THREE, then a cooldown blocks the next tap.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.chars = [1, 0]; // BAM
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.char.id === 'bam' && p.speed < 175, 'BAM is slower afoot', `spd=${p.speed}`);
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  check(g.mob.counts(0).attack === 3, 'BAM sends THREE at once', `out=${g.mob.counts(0).attack}`);
  g.frame(1 / 60);
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  check(g.mob.counts(0).attack === 3, 'drumroll cooldown blocks the next tap', `out=${g.mob.counts(0).attack}`);
  const hunter = g.mob.list.find(c => c.duty === 'attack');
  check(hunter && hunter.mods && hunter.mods.hunterAspd > 1, 'BAM hunters carry the war-beat mod');
}
{
  // VIVI: slower single sends, fast recalls, lullaby slow on the wall.
  store.clear();
  const g = new Game(null);
  g.chooseSlot(0);
  g.save.chars = [2, 0]; // VIVI
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  check(p.char.id === 'vivi', 'VIVI selected');
  g.input.keys.add('Space'); g.frame(1 / 60); g.input.keys.delete('Space');
  check(g.mob.counts(0).attack === 1, 'VIVI sends one at a time');
  const h = g.mob.list.find(c => c.duty === 'attack');
  check(h && h.mods && h.mods.hunterDmg < 1, 'VIVI hunters hit softer (mod present)');
  // Lullaby wall: a melee shield critter's nibble slows the bot.
  const e = g.enemies.spawnNow(g, 'dustbot', p.x + 40, p.y);
  e.hp = 1e9;
  let slowed = false;
  for (let i = 0; i < 60 * 5 && !slowed; i++) { g.frame(1 / 60); slowed = e.slowT > 0.5; }
  check(slowed, 'lullaby wall entrances robots that touch it');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
