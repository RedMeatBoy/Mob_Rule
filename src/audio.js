// audio.js — WebAudio synth. Jaunty march loop (lookahead scheduler — the
// lesson from Demon Hunters 2: no drift, no un-normalized reverb, keep it
// dry and LOUD enough to hear). Species blips, whistle trills, boss klaxons.

function nf(n) { return 440 * Math.pow(2, (n - 69) / 12); }

// ---- The soundtrack: three real songs (30s+ each), rotated every ~2 min ----
// Songs are authored as 2-bar melody PHRASES concatenated into a full
// arrangement, with a chord progression driving the bass. Verse/chorus
// structure keeps a 30-50 second loop from wearing out its welcome.

const P = (...xs) => xs; // phrase helper
function flat(...phrases) { return [].concat(...phrases); }

// --- Song 1: "Meadow March" — G major, the parade classic, ~31s ---
const M_V1 = P(67, 69, 71, null, 74, null, 71, 69, 72, null, 71, 69, 67, null, null, null);
const M_V2 = P(67, 69, 71, null, 74, null, 76, 74, 72, 74, 72, 69, 67, null, null, null);
const M_C1 = P(76, null, 74, 72, 74, null, 72, 71, 72, null, 74, 76, 74, null, 71, null);
const M_C2 = P(76, null, 74, 72, 74, null, 76, 79, 78, 76, 74, 72, 71, null, 67, null);
const SONG_MARCH = {
  name: 'Meadow March', stepDur: 0.16, spb: 8,
  // 24 bars: verse(8) chorus(8) verse(8). Bass roots per bar (MIDI).
  bassBars: flat(
    P(43, 43, 48, 48, 43, 43, 50, 50),   // G G C C G G D D
    P(40, 40, 48, 48, 43, 43, 50, 50),   // Em Em C C G G D D
    P(43, 43, 48, 48, 43, 43, 50, 43),
  ),
  mel: flat(M_V1, M_V2, M_V1, M_V2, M_C1, M_C2, M_C1, M_C2, M_V1, M_V2, M_V1, M_V2),
  bassPat: [0, null, 7, null, 0, null, 7, null], // offsets from bar root
  kick: [1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0],
  hat: [0, 1, 0, 1, 0, 1, 0, 1],
  melVol: 0.10, melType: 'square', bassVol: 0.32,
};

// --- Song 2: "Puddle Parade" — C major, faster and bouncier, ~36s ---
const D_P1 = P(72, null, 76, null, 74, 72, 69, null, 71, null, 74, null, 72, null, null, null);
const D_P2 = P(72, null, 76, null, 79, null, 76, 74, 72, 74, 71, 69, 67, null, null, null);
const D_P3 = P(77, null, 76, 74, 72, null, 74, null, 71, 72, 74, null, 79, null, null, null);
const D_P4 = P(84, null, 83, 81, 79, null, 76, null, 77, 76, 74, 72, 71, 72, null, null);
const SONG_PARADE = {
  name: 'Puddle Parade', stepDur: 0.14, spb: 8,
  bassBars: flat(
    P(48, 45, 41, 43, 48, 45, 41, 43),   // C Am F G ×2
    P(41, 41, 43, 43, 48, 45, 41, 43),   // F F G G C Am F G
    P(48, 45, 41, 43, 48, 43, 48, 48),
    P(41, 43),                            // turnaround
  ),
  mel: flat(D_P1, D_P2, D_P1, D_P2, D_P3, D_P4, D_P1, D_P2, D_P3, D_P4, D_P1, D_P2, D_P3.slice(0, 16)),
  bassPat: [0, null, 12, null, 0, null, 12, 7],
  kick: [1, 0, 0, 1, 0, 0, 1, 0],
  snare: [0, 0, 1, 0, 0, 0, 1, 0],
  hat: [1, 1, 0, 1, 1, 0, 1, 1],
  melVol: 0.10, melType: 'triangle', bassVol: 0.30,
};

// --- Song 3: "Waltz of the Frog King" — A minor, stately 3/4, ~34s ---
const W_1 = P(69, null, 72, null, 71, null, 72, null, 74, null, 72, null);
const W_2 = P(76, null, 74, null, 72, null, 71, null, 69, null, null, null);
const W_3 = P(72, null, 76, null, 79, null, 76, null, 74, null, 72, null);
const W_4 = P(71, null, 68, null, 64, null, 69, null, null, null, null, null);
const SONG_WALTZ = {
  name: 'Waltz of the Frog King', stepDur: 0.2, spb: 6,
  bassBars: flat(
    P(45, 45, 41, 41, 48, 48, 40, 40),   // Am Am F F C C E E
    P(45, 45, 41, 41, 48, 48, 40, 40),
    P(45, 41, 48, 40, 45, 41, 40, 45),
  ),
  mel: flat(W_1, W_2, W_3, W_4, W_1, W_2, W_3, W_4, W_1, W_3, W_2, W_4),
  bassPat: [0, null, null, null, null, null],   // oom (stabs handled below)
  waltzStab: [null, null, 1, null, 1, null],    // pah pah on 2 & 3
  kick: [1, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0],
  hat: [0, 0, 1, 0, 1, 0],
  melVol: 0.11, melType: 'triangle', bassVol: 0.34,
};

// --- Song 4: "Sunny Side Strut" — F major, syncopated swagger, ~29s ---
const S_1 = P(65, null, 69, null, 72, null, 69, 72, 74, null, 72, 69, 65, null, null, null);
const S_2 = P(65, null, 69, null, 72, null, 74, 76, 77, null, 76, 74, 72, null, null, null);
const S_3 = P(74, null, 74, 72, 70, null, 72, null, 69, null, 70, 72, 65, null, null, null);
const S_4 = P(77, 76, 74, null, 72, 74, 72, 69, 67, null, 69, 72, 65, null, null, null);
const SONG_STRUT = {
  name: 'Sunny Side Strut', stepDur: 0.15, spb: 8,
  bassBars: flat(
    P(41, 41, 46, 46, 41, 41, 48, 48),   // F F Bb Bb F F C C
    P(50, 50, 46, 46, 41, 48, 41, 41),   // Dm Dm Bb Bb F C F F
    P(41, 46, 41, 48, 41, 46, 48, 41),
  ),
  mel: flat(S_1, S_2, S_1, S_2, S_3, S_4, S_3, S_4, S_1, S_2, S_3, S_4),
  bassPat: [0, null, 7, null, 12, null, 7, null],
  kick: [1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 1, 0, 0, 0, 1, 0],
  hat: [1, 0, 1, 1, 0, 1, 1, 0],
  melVol: 0.10, melType: 'square', bassVol: 0.30,
};

// --- Song 5: "The Tidy Empire's Lament" — D minor, mischievous, ~33s ---
const L_1 = P(62, null, 65, null, 69, null, 65, 62, 64, null, 62, null, null, null, null, null);
const L_2 = P(62, null, 65, null, 69, null, 72, 70, 69, 67, 65, 67, 62, null, null, null);
const L_3 = P(70, null, 69, 67, 65, null, 67, null, 69, null, 73, null, 74, null, null, null);
const L_4 = P(74, 72, 70, 69, 67, 65, 64, 62, 61, null, 62, null, null, null, null, null);
const SONG_LAMENT = {
  name: "The Tidy Empire's Lament", stepDur: 0.17, spb: 8,
  bassBars: flat(
    P(38, 38, 43, 43, 38, 38, 45, 45),   // Dm Dm Gm Gm Dm Dm A A
    P(46, 46, 43, 43, 38, 45, 38, 38),   // Bb Bb Gm Gm Dm A Dm Dm
    P(38, 43, 38, 45, 46, 43, 45, 38),
  ),
  mel: flat(L_1, L_2, L_1, L_2, L_3, L_4, L_3, L_4, L_1, L_2, L_3, L_4),
  bassPat: [0, null, 12, null, 7, null, 12, null],
  kick: [1, 0, 0, 1, 0, 0, 1, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0],
  hat: [0, 1, 1, 0, 1, 1, 0, 1],
  melVol: 0.10, melType: 'triangle', bassVol: 0.32,
};

const SONGS = [SONG_MARCH, SONG_PARADE, SONG_STRUT, SONG_WALTZ, SONG_LAMENT];
const SONG_ROTATE_SEC = 120; // switch songs every ~2 minutes (at a song boundary)

export class AudioSystem {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null;
    this.muted = false; this.last = new Map();
    this.voice = null; // speech-synthesis announcer (picked lazily)
    this.lead = null;  // character instrument: null(flute)|'drum'|'sawtooth'
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
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
    if (m) { try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {} }
  }

  // Spoken announcer (Web Speech API — built into the browser, no assets).
  // Excited and positive: for the pre-readers in the audience.
  // priority=true interrupts whatever is being said; otherwise a busy
  // announcer just skips the line (no backlog of stale chatter).
  say(text, priority = false) {
    if (this.muted) return;
    try {
      if (typeof speechSynthesis === 'undefined') return;
      if (priority) speechSynthesis.cancel();
      else if (speechSynthesis.speaking || speechSynthesis.pending) return;
      const u = new SpeechSynthesisUtterance(text);
      if (!this.voice) {
        const vs = speechSynthesis.getVoices() || [];
        this.voice =
          vs.find(v => v.lang && v.lang.startsWith('en') && /aria|jenny|zira|samantha|female|google us english/i.test(v.name)) ||
          vs.find(v => v.lang && v.lang.startsWith('en')) || null;
      }
      if (this.voice) u.voice = this.voice;
      u.rate = 1.06;
      u.pitch = 1.3;   // bright and upbeat, not scary
      u.volume = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { /* no speech support — game stays fully playable */ }
  }

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

  // ---- music: song rotation with a lookahead scheduler ----
  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.beat = 0;
    this.songT = 0;
    if (this.songIdx == null) this.songIdx = Math.floor(Math.random() * SONGS.length);
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
    const song = SONGS[this.songIdx % SONGS.length];
    const totalSteps = song.mel.length;
    while (this.nextT < this.ctx.currentTime + 0.15) {
      const t = this.nextT;
      const step = this.beat % totalSteps;
      const bar = Math.floor(step / song.spb) % song.bassBars.length;
      const s = step % song.spb;
      const root = song.bassBars[bar];

      // Bass (+ waltz oom-pah stabs).
      if (song.bassPat[s] != null) {
        this.tone(nf(root + song.bassPat[s]), t, song.stepDur * 0.95, 'triangle', song.bassVol, this.musicGain);
      }
      if (song.waltzStab && song.waltzStab[s]) {
        this.tone(nf(root + 12), t, song.stepDur * 0.7, 'triangle', 0.14, this.musicGain);
        this.tone(nf(root + 19), t, song.stepDur * 0.7, 'triangle', 0.10, this.musicGain);
      }
      // Melody (octave doubler layers in when the horde is big).
      const m = song.mel[step];
      if (m != null) {
        this.tone(nf(m), t, song.stepDur * 1.1, this.lead === 'sawtooth' ? 'sawtooth' : song.melType, song.melVol, this.musicGain, 0, 11);
        if (this.intensity > 0.5) this.tone(nf(m + 12), t, song.stepDur * 0.8, 'sine', 0.035, this.musicGain);
      }
      // Drums.
      if (song.kick[s]) this.tone(58, t, 0.12, 'sine', 0.3, this.musicGain, 40);
      if (this.lead === 'drum' && s % 2 === 1) this.tone(70, t, 0.07, 'sine', 0.14, this.musicGain, 48); // BAM's extra beat
      if (song.snare[s]) this.nz(t, 0.09, 0.09, 1400);
      if (song.hat[s]) this.nz(t, 0.03, 0.05, 7000);

      this.beat++;
      this.songT += song.stepDur;
      this.nextT += song.stepDur;

      // Rotate at a song boundary once we've been on this tune ~2 minutes.
      if (this.beat % totalSteps === 0 && this.songT >= SONG_ROTATE_SEC) {
        this.songIdx = (this.songIdx + 1) % SONGS.length;
        this.beat = 0;
        this.songT = 0;
        this.nextT += 0.9; // one breath between songs
      }
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
      case 'drumriff': this.tone(85, t, 0.07, 'square', 0.14, null, 55); this.tone(85, t + 0.09, 0.07, 'square', 0.14, null, 55); this.tone(62, t + 0.18, 0.12, 'square', 0.18, null, 40); break;
      case 'stringriff': this.tone(392, t, 0.16, 'sawtooth', 0.09, null, 587, 14); this.tone(587, t + 0.14, 0.2, 'sawtooth', 0.08, null, 784, 14); break;
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
