// main.js — bootstrap: 1280×720 stage, CSS letterbox, rAF loop.

import { Game, VIEW_W, VIEW_H } from './game.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

function fit() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${VIEW_W * s}px`;
  canvas.style.height = `${VIEW_H * s}px`;
}
fit();
window.addEventListener('resize', fit);

const game = new Game(canvas);
const unlock = () => {
  game.audio.ensure();
  if (game.state === 'title' && !game.audio.playing) game.audio.startMusic();
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
