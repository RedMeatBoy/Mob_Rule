// audio.js — WebAudio synth. Jaunty march loop (lookahead scheduler — the
// lesson from Demon Hunters 2: no drift, no un-normalized reverb, keep it
// dry and LOUD enough to hear). Species blips, whistle trills, boss klaxons.

function nf(n) { return 440 * Math.pow(2, (n - 69) / 12); }

// A cheerful two-chord march in G: G — C, with a fife-y melody.
const MARCH = {
  stepDur: 0.16,
  bass: [43, null, 50, null, 43, null, 50, null, 48, null, 55, null, 48, null, 55, null],
  mel:  [67, 69, 71, null, 74, null, 71, 69, 72, null, 76, 74, 72, null, 71, null],
  mel2: [null, null, null, 79, null, 78, null, null, null, 79, null, null, null, 81, null, 79],
  hat:  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
};

export class AudioSystem {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null;
    this.muted = false; this.last = new Map();
    this.playing = false; this.beat = 0; this.nextT = 0; this.interval = null;
    this.intensity = 0; // 0..1, layers in the second melody voice
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);
    const n = this.ctx.sampleRate * 0.4;
    this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; }

  tone(f, t, dur, type, vol, dest, slide, vib) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    if (vib) {
      const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
      l.frequency.value = vib; lg.gain.value = f * 0.03;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  nz(t, dur, vol, hp) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ---- music ----
  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.beat = 0;
    this.nextT = this.ctx.currentTime + 0.05;
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.pump(), 25);
  }
  stopMusic() {
    this.playing = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }
  pump() {
    if (!this.playing || this.muted) { if (this.ctx) this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.1); return; }
    while (this.nextT < this.ctx.currentTime + 0.15) {
      const s = this.beat % 16;
      const t = this.nextT;
      if (MARCH.bass[s] != null) this.tone(nf(MARCH.bass[s]), t, 0.14, 'triangle', 0.34, this.musicGain);
      if (MARCH.mel[s] != null) this.tone(nf(MARCH.mel[s]), t, 0.15, 'square', 0.10, this.musicGain, 0, 12);
      if (this.intensity > 0.5 && MARCH.mel2[s] != null) this.tone(nf(MARCH.mel2[s]), t, 0.13, 'square', 0.07, this.musicGain, 0, 14);
      if (MARCH.hat[s]) this.nz(t, 0.03, 0.05, 7000);
      if (s === 0 || s === 8) this.tone(58, t, 0.12, 'sine', 0.3, this.musicGain, 40);
      this.beat++;
      this.nextT += MARCH.stepDur;
    }
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - (this.last.get(name) || 0) < 45) return;
    this.last.set(name, now);
    const t = this.ctx.currentTime;
    switch (name) {
      // Species voices (tiny, characterful)
      case 'ribbit': this.tone(160, t, 0.09, 'square', 0.10, null, 90); this.tone(140, t + 0.08, 0.07, 'square', 0.08, null, 180); break;
      case 'quack': this.tone(300, t, 0.1, 'sawtooth', 0.10, null, 210); break;
      case 'bleat': this.tone(420, t, 0.16, 'sawtooth', 0.09, null, 380, 22); break;
      case 'buzz': this.tone(190, t, 0.12, 'sawtooth', 0.06, null, 205, 30); break;
      case 'thunk': this.tone(120, t, 0.08, 'square', 0.10, null, 70); break;
      case 'squeak': this.tone(900, t, 0.06, 'sine', 0.08, null, 1300); break;
      case 'pfft': this.nz(t, 0.2, 0.14, 400); break;
      case 'hoot': this.tone(520, t, 0.1, 'sine', 0.1, null, 420); this.tone(420, t + 0.11, 0.12, 'sine', 0.09, null, 380); break;
      case 'zap': this.tone(880, t, 0.08, 'square', 0.08, null, 1500); break;
      case 'honk': this.tone(280, t, 0.12, 'sawtooth', 0.12, null, 240); break;
      case 'chime': this.tone(1320, t, 0.2, 'sine', 0.07); this.tone(1980, t + 0.05, 0.15, 'sine', 0.05); break;
      case 'bellow': this.tone(110, t, 0.3, 'sawtooth', 0.14, null, 70, 8); break;
      // Game feel
      case 'whistle': this.tone(1200, t, 0.08, 'sine', 0.14, null, 1800); this.tone(1500, t + 0.08, 0.1, 'sine', 0.12, null, 2100); break;
      case 'recall': this.tone(1800, t, 0.08, 'sine', 0.12, null, 1100); this.tone(1400, t + 0.07, 0.1, 'sine', 0.1, null, 800); break;
      case 'pop': this.tone(500, t, 0.07, 'triangle', 0.14, null, 900); this.nz(t, 0.04, 0.06, 2500); break;
      case 'botdie': this.tone(300, t, 0.12, 'square', 0.12, null, 60); this.nz(t, 0.1, 0.1, 1500); break;
      case 'recruit': [660, 880, 1100].forEach((f, i) => this.tone(f, t + i * 0.05, 0.09, 'triangle', 0.11)); break;
      case 'merge': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.06, 0.14, 'square', 0.1)); this.nz(t + 0.3, 0.2, 0.08, 4000); break;
      case 'hurt': this.tone(200, t, 0.18, 'sawtooth', 0.16, null, 80); break;
      case 'critterlost': this.tone(600, t, 0.1, 'sine', 0.06, null, 300); break;
      case 'acorn': this.tone(1100, t, 0.04, 'sine', 0.07, null, 1400); break;
      case 'cage': this.nz(t, 0.12, 0.12, 900); this.tone(400, t + 0.05, 0.08, 'square', 0.08); break;
      case 'telegraph': this.tone(320, t, 0.14, 'sine', 0.1, null, 520); break;
      case 'boss': this.tone(65, t, 0.7, 'sawtooth', 0.2, null, 45); this.nz(t, 0.5, 0.14, 300); for (let i = 0; i < 3; i++) this.tone(220, t + i * 0.22, 0.14, 'square', 0.1); break;
      case 'stomp': this.nz(t, 0.4, 0.3, 250); this.tone(70, t, 0.3, 'sine', 0.25, null, 35); break;
      case 'vacuum': this.nz(t, 0.5, 0.12, 500); this.tone(180, t, 0.5, 'sawtooth', 0.06, null, 320); break;
      case 'uiMove': this.tone(440, t, 0.03, 'sine', 0.06); break;
      case 'uiPick': this.tone(660, t, 0.07, 'triangle', 0.1); this.tone(990, t + 0.06, 0.09, 'triangle', 0.08); break;
      case 'victory': [392, 494, 587, 784, 587, 784, 988].forEach((f, i) => this.tone(f, t + i * 0.12, 0.22, 'square', 0.11, null, 0, 10)); break;
      case 'defeat': [392, 370, 349, 294].forEach((f, i) => this.tone(f, t + i * 0.24, 0.3, 'sawtooth', 0.1, null, f * 0.94)); break;
      case 'wavestart': this.tone(392, t, 0.1, 'square', 0.1); this.tone(523, t + 0.1, 0.14, 'square', 0.1); break;
      case 'waveclear': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.08, 0.16, 'triangle', 0.12)); break;
      case 'crown': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.09, 0.18, 'triangle', 0.1)); break;
    }
  }
}
