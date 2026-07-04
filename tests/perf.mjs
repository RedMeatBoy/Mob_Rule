// tests/perf.mjs — logic tick time with a max mob (150) + heavy bot pressure.
// Usage: node tests/perf.mjs

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
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const { Game } = await load('src/game.js');
const { SPECIES_IDS } = await load('src/data.js');

const g = new Game(null);
g.save.acorns = 99999;
g.input.assign(0, 'kb1');
g.startRun();
g.startWave(11);
const p = g.players[0];
p.invuln = 1e9;
// Max mob (raw-pushed to bypass auto-merge — worst-case entity count).
for (let i = 0; i < 150; i++) {
  const sp = SPECIES_IDS[i % SPECIES_IDS.length];
  g.mob.list.push({
    sp, tier: 1, x: p.x + (i % 20) * 12 - 120, y: p.y + Math.floor(i / 20) * 12,
    px: 0, py: 0, vx: 0, vy: 0, hp: 1e9, owner: 0, state: 'follow', target: null,
    atkT: 0, cdT: 0, lag: 12 + i * 2.2, side: (i % 9) - 4, wob: i, squash: 0,
    hitT: 0, face: 1, bagged: false, crowned: false, breedT: 9,
  });
}
for (let i = 0; i < 100; i++) {
  g.enemies.spawnNow(g, ['dustbot', 'mower', 'tidydrone', 'broom'][i % 4], 200 + (i * 37) % 1300, 200 + (i * 53) % 900, i % 3 === 0);
}
g.waveT = 1e9;

for (let i = 0; i < 120; i++) g.frame(1 / 60); // warm up
const N = 600;
let worst = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const s = performance.now();
  g.frame(1 / 60);
  const d = performance.now() - s;
  if (d > worst) worst = d;
}
const avg = (performance.now() - t0) / N;
console.log(`mob: ${g.mob.count()}, bots: ${g.enemies.count()}, projectiles: ${g.proj.n}`);
console.log(`avg logic frame: ${avg.toFixed(3)} ms, worst: ${worst.toFixed(3)} ms (budget 16.6 ms incl. render)`);
console.log(avg < 5 ? 'PERF OK' : 'PERF WARNING');
