// pool.js — object pool, spatial grid, math, sprite cache, seeded rng.

export class Pool {
  constructor(factory) { this.factory = factory; this.items = []; this.n = 0; }
  alloc() {
    let it;
    if (this.n < this.items.length) it = this.items[this.n];
    else { it = this.factory(); this.items.push(it); }
    this.n++;
    return it;
  }
  release(i) {
    const last = this.n - 1;
    if (i !== last) { const t = this.items[i]; this.items[i] = this.items[last]; this.items[last] = t; }
    this.n--;
  }
  clear() { this.n = 0; }
  get(i) { return this.items[i]; }
}

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const randRange = (a, b) => a + Math.random() * (b - a);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedPick(entries, wfn, rng) {
  let total = 0;
  for (const e of entries) total += wfn(e);
  let r = (rng || Math.random)() * total;
  for (const e of entries) { r -= wfn(e); if (r <= 0) return e; }
  return entries[entries.length - 1];
}

export function makeSprite(size, drawFn) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  drawFn(ctx, size);
  return c;
}

export class Grid {
  constructor(w, h, cell) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell) + 2;
    this.rows = Math.ceil(h / cell) + 2;
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
  }
  clear() { for (const c of this.cells) c.length = 0; }
  insert(x, y, item) {
    const cx = clamp(Math.floor(x / this.cell) + 1, 0, this.cols - 1);
    const cy = clamp(Math.floor(y / this.cell) + 1, 0, this.rows - 1);
    this.cells[cy * this.cols + cx].push(item);
  }
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = clamp(Math.floor((x - r) / c) + 1, 0, this.cols - 1);
    const x1 = clamp(Math.floor((x + r) / c) + 1, 0, this.cols - 1);
    const y0 = clamp(Math.floor((y - r) / c) + 1, 0, this.rows - 1);
    const y1 = clamp(Math.floor((y + r) / c) + 1, 0, this.rows - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const cell = this.cells[cy * this.cols + cx];
      for (let i = 0; i < cell.length; i++) fn(cell[i]);
    }
  }
}
