// tests/simulate.mjs — balance harness: a bot piper plays full runs with the
// REAL game loop (kites enemies, whistles at clusters, picks random cards).
// Reports how far runs get. Target: a mediocre bot reaches wave ~7-10, so a
// decent human reaches 12 and a kid has fun losing forward.
// Usage: node tests/simulate.mjs [runs=20]

import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const load = p => import(pathToFileURL(join(root, p)).href);

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
const makeCanvas = () => ({ width: 64, height: 64, getContext: () => makeCtx(), style: {} });
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
globalThis.document = { createElement: () => makeCanvas(), getElementById: () => makeCanvas() };
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const { Game } = await load('src/game.js');

const RUNS = parseInt(process.argv[2], 10) || 20;
const waveReached = [];
let wins = 0, totalMobPeak = 0;
const t0 = Date.now();

for (let r = 0; r < RUNS; r++) {
  const g = new Game(null);
  g.save.acorns = r % 2 === 0 ? 0 : 5000; // half the runs with unlocks
  g.input.assign(0, 'kb1');
  g.startRun();
  const p = g.players[0];
  let frames = 0;
  const MAXF = 60 * 60 * 25;

  while (g.state !== 'gameover' && g.state !== 'victory' && frames < MAXF) {
    frames++;
    if (g.state === 'run') {
      // Bot brain (deliberately mediocre): kite away from the nearest bot,
      // drift toward cages/acorns, whistle when a cluster is near the mob.
      const threat = g.enemies.nearest(p.x, p.y, 240);
      let mx = 0, my = 0;
      if (threat) {
        const d = Math.hypot(p.x - threat.x, p.y - threat.y) || 1;
        mx = (p.x - threat.x) / d; my = (p.y - threat.y) / d;
      } else if (g.cages.length) {
        const c = g.cages[0];
        const d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
        mx = (c.x - p.x) / d; my = (c.y - p.y) / d;
      } else {
        mx = Math.sin(frames / 90); my = Math.cos(frames / 130);
      }
      // Steer away from walls.
      if (p.x < 150) mx = Math.abs(mx) || 0.5;
      if (p.x > g.arena.w - 150) mx = -Math.abs(mx) || -0.5;
      if (p.y < 150) my = Math.abs(my) || 0.5;
      if (p.y > g.arena.h - 150) my = -Math.abs(my) || -0.5;
      // Inject input via the keyboard device.
      g.input.keys.clear();
      if (mx > 0.25) g.input.keys.add('KeyD');
      if (mx < -0.25) g.input.keys.add('KeyA');
      if (my > 0.25) g.input.keys.add('KeyS');
      if (my < -0.25) g.input.keys.add('KeyW');
      // Economy brain: hunt when healthy and prey is near; turtle up when hurt.
      const co = g.mob.counts(0);
      const total = co.shield + co.attack;
      const nearFoe = g.enemies.nearest(p.x, p.y, 420);
      const hurtBad = p.hp < p.maxHp * 0.4;
      if (hurtBad || (!nearFoe && co.attack > 0)) g.input.keys.add('ShiftLeft');
      else if (nearFoe && co.attack < total * 0.65) g.input.keys.add('Space');
      g.frame(1 / 60);
    } else if (g.state === 'crossroads') {
      // Random-ish picks, slight pack preference.
      const cards = g.ui.cards;
      const packs = cards.filter(c => c.kind === 'pack');
      const c = (Math.random() < 0.6 && packs.length) ? packs[Math.floor(Math.random() * packs.length)]
        : cards[Math.floor(Math.random() * cards.length)];
      g.applyChoice(c, 0);
      g.startWave(g.waveNum + 1);
    } else g.frame(1 / 60);
  }
  waveReached.push(g.waveNum);
  totalMobPeak += g.mob.biggest;
  if (g.state === 'victory') wins++;
  store.clear();
}

waveReached.sort((a, b) => a - b);
const avg = waveReached.reduce((s, w) => s + w, 0) / RUNS;
const median = waveReached[Math.floor(RUNS / 2)];
console.log(`\n=== MOB RULE balance report (${RUNS} bot runs) ===`);
console.log(`waves reached: min ${waveReached[0]}, median ${median}, avg ${avg.toFixed(1)}, max ${waveReached[RUNS - 1]}`);
console.log(`bot victories: ${wins}/${RUNS} (bot is mediocre by design; humans should beat it)`);
console.log(`avg peak mob size: ${(totalMobPeak / RUNS).toFixed(0)}`);
console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const verdict = median >= 6 && median <= 11 ? 'IN BAND (kid-friendly, dad-beatable)' :
  median < 6 ? 'TOO HARD — soften early waves' : 'TOO EASY — stiffen late waves';
console.log(`verdict: ${verdict}`);
