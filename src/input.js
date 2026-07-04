// input.js — 2 player slots, any device (kb1 WASD, kb2 arrows, Xbox pads).
// Verbs: move, whistle (send mob), recall, pause. Menus: confirm/back/dirs.

const PAD = { A: 0, B: 1, X: 2, Y: 3, RB: 5, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.18;
const ACTS = ['up', 'down', 'left', 'right', 'whistle', 'recall', 'confirm', 'back', 'pause', 'mute'];

const KB = {
  kb1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    whistle: ['Space'], recall: ['ShiftLeft', 'KeyQ'],
    confirm: ['Space', 'Enter'], back: ['Escape'], pause: ['Escape'], mute: ['KeyM'],
    label: 'Keyboard WASD', glyphs: { whistle: 'Space', recall: 'Shift', confirm: 'Space', back: 'Esc', pause: 'Esc' },
  },
  kb2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    whistle: ['Enter'], recall: ['ShiftRight', 'Slash'],
    confirm: ['Enter'], back: ['Backspace'], pause: ['Escape'], mute: ['KeyM'],
    label: 'Keyboard Arrows', glyphs: { whistle: 'Enter', recall: 'RShift', confirm: 'Enter', back: 'Bksp', pause: 'Esc' },
  },
};
const PAD_GLYPHS = { whistle: 'A', recall: 'B', confirm: 'A', back: 'B', pause: 'Start' };

class Device {
  constructor(id, type, padIndex) {
    this.id = id; this.type = type; this.padIndex = padIndex;
    this.connected = true;
    this.state = {}; this.prev = {};
    for (const a of ACTS) { this.state[a] = false; this.prev[a] = false; }
    this.mx = 0; this.my = 0;
    this.rep = { up: 0, down: 0, left: 0, right: 0 };
    this.fired = { up: false, down: false, left: false, right: false };
  }
  pressed(a) { return this.state[a] && !this.prev[a]; }
  menu(d) { return this.fired[d]; }
  glyph(a) { return this.type === 'kb' ? (KB[this.id].glyphs[a] || a) : (PAD_GLYPHS[a] || a); }
  get label() { return this.type === 'kb' ? KB[this.id].label : `Controller ${this.padIndex + 1}`; }
}

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.devices = new Map([['kb1', new Device('kb1', 'kb')], ['kb2', new Device('kb2', 'kb')]]);
    this.slots = [null, null];
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  update(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && !this.devices.has('pad' + i)) this.devices.set('pad' + i, new Device('pad' + i, 'pad', i));
    }
    for (const dev of this.devices.values()) {
      for (const a of ACTS) dev.prev[a] = dev.state[a];
      if (dev.type === 'kb') {
        const m = KB[dev.id];
        for (const a of ACTS) dev.state[a] = (m[a] || []).some(c => this.keys.has(c));
        let mx = (dev.state.right ? 1 : 0) - (dev.state.left ? 1 : 0);
        let my = (dev.state.down ? 1 : 0) - (dev.state.up ? 1 : 0);
        if (mx && my) { mx *= 0.7071; my *= 0.7071; }
        dev.mx = mx; dev.my = my;
      } else {
        const gp = pads[dev.padIndex];
        if (!gp || !gp.connected) {
          dev.connected = false;
          for (const a of ACTS) dev.state[a] = false;
          dev.mx = 0; dev.my = 0;
          continue;
        }
        dev.connected = true;
        const bd = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
        let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const mag = Math.hypot(ax, ay);
        if (mag < DEAD) { ax = 0; ay = 0; }
        else { const s = Math.min(1, (mag - DEAD) / (1 - DEAD)); ax = ax / mag * s; ay = ay / mag * s; }
        if (bd(PAD.LEFT)) ax = -1; if (bd(PAD.RIGHT)) ax = 1;
        if (bd(PAD.UP)) ay = -1; if (bd(PAD.DOWN)) ay = 1;
        dev.mx = ax; dev.my = ay;
        dev.state.up = ay < -0.5; dev.state.down = ay > 0.5;
        dev.state.left = ax < -0.5; dev.state.right = ax > 0.5;
        dev.state.whistle = bd(PAD.A);
        dev.state.recall = bd(PAD.B);
        dev.state.confirm = bd(PAD.A);
        dev.state.back = bd(PAD.B);
        dev.state.pause = bd(PAD.START);
        dev.state.mute = bd(PAD.BACK);
      }
      for (const d of ['up', 'down', 'left', 'right']) {
        dev.fired[d] = false;
        if (dev.state[d]) {
          if (!dev.prev[d]) { dev.fired[d] = true; dev.rep[d] = 0.35; }
          else { dev.rep[d] -= dt; if (dev.rep[d] <= 0) { dev.fired[d] = true; dev.rep[d] = 0.13; } }
        }
      }
    }
  }

  assign(slot, id) {
    const other = 1 - slot;
    if (this.slots[other] === id) this.slots[other] = null;
    this.slots[slot] = id;
  }
  unassign(slot) { this.slots[slot] = null; }
  deviceFor(slot) { return this.slots[slot] ? this.devices.get(this.slots[slot]) : null; }
  joinPress() {
    for (const dev of this.devices.values()) {
      if (!dev.connected || this.slots.includes(dev.id)) continue;
      if (dev.pressed('confirm') || (dev.type === 'pad' && dev.pressed('pause'))) return dev.id;
    }
    return null;
  }
  move(slot) {
    const d = this.deviceFor(slot);
    return d && d.connected ? { x: d.mx, y: d.my } : { x: 0, y: 0 };
  }
  down(slot, a) { const d = this.deviceFor(slot); return d ? d.state[a] : false; }
  pressed(slot, a) { const d = this.deviceFor(slot); return d ? d.pressed(a) : false; }
  menu(slot, dir) { const d = this.deviceFor(slot); return d ? d.menu(dir) : false; }
  anyPressed(a) {
    for (const dev of this.devices.values()) if (dev.connected && dev.pressed(a)) return true;
    return false;
  }
  anyMenu(dir) {
    for (const dev of this.devices.values()) if (dev.connected && dev.menu(dir)) return true;
    return false;
  }
  assignedPressed(a) {
    for (const id of this.slots) {
      if (!id) continue;
      const d = this.devices.get(id);
      if (d && d.pressed(a)) return true;
    }
    return false;
  }
  disconnectedSlot() {
    for (let s = 0; s < 2; s++) {
      const d = this.deviceFor(s);
      if (d && d.type === 'pad' && !d.connected) return s;
    }
    return -1;
  }
  glyph(slot, a) {
    const d = this.deviceFor(slot) || this.devices.get('kb1');
    return d.glyph(a);
  }
}
