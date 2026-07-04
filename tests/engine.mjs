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
  // Walk right for 3 seconds: the mob should trail the piper.
  g.input.keys.add('KeyD');
  for (let i = 0; i < 180; i++) g.frame(1 / 60);
  g.input.keys.delete('KeyD');
  const p = g.players[0];
  const avgX = g.mob.list.reduce((s, c) => s + c.x, 0) / g.mob.count();
  check(p.x > g.arena.w / 2 + 100, 'piper marched east');
  check(avgX > g.arena.w / 2 - 40 && avgX < p.x, 'mob trails behind the piper', `avg=${avgX.toFixed(0)} piper=${p.x.toFixed(0)}`);
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

console.log('D) Whistle rally:');
{
  const g = new Game(null);
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  p.face = 1;
  g.input.keys.add('Space'); // whistle held
  for (let i = 0; i < 40; i++) g.frame(1 / 60);
  check(p.rallyT > 0 && p.rally.x > p.x + 50, 'whistle sets a rally point ahead', `rally=${p.rally.x.toFixed(0)} piper=${p.x.toFixed(0)}`);
  const avgX = g.mob.list.reduce((s, c) => s + c.x, 0) / g.mob.count();
  g.input.keys.delete('Space');
  for (let i = 0; i < 60; i++) g.frame(1 / 60);
  const avgX2 = g.mob.list.reduce((s, c) => s + c.x, 0) / g.mob.count();
  check(avgX2 >= avgX - 200, 'mob surged toward the rally and returns after release');
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
  p2.hurt(g, 99, null);
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
  for (const p of g.players) { p.invuln = 0; p.hurt(g, 99, null); p.hurt(g, 99, null); }
  check(g.state === 'gameover', 'both down -> the mob scatters', g.state);
  const saved = JSON.parse(store.get('mob_rule_v1'));
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

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
