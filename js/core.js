// ============================================================
// Brumelune — Les Veilleurs · core.js
// Utilitaires, générateur pseudo-aléatoire, audio chiptune,
// toasts et persistance locale. Aucune dépendance externe.
// ============================================================
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p; // p entre 0 et 1

// ---------- Journal + toasts ----------
export function toast(txt, ms = 2400) {
  const layer = $('#toast-layer');
  if (!layer) return;
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = txt;
  layer.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

// ---------- Audio : petits sons synthétisés (aucun fichier) ----------
let ctx = null, muted = false;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export function beep(freq = 440, dur = 0.12, type = 'sine', vol = 0.12, when = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  try {
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* appareil sans audio : on ignore */ }
}
export const sfx = {
  ui() { beep(620, 0.06, 'square', 0.05); },
  move() { beep(300, 0.07, 'sine', 0.06); },
  hit() { beep(150, 0.18, 'sawtooth', 0.15); beep(95, 0.22, 'sawtooth', 0.12, 0.06); },
  crit() { beep(880, 0.1, 'square', 0.12); beep(1320, 0.16, 'square', 0.1, 0.08); },
  miss() { beep(240, 0.15, 'sine', 0.08); },
  heal() { beep(520, 0.14, 'sine', 0.1); beep(784, 0.2, 'sine', 0.09, 0.1); },
  buff() { [392, 523, 659, 784].forEach((f, i) => beep(f, 0.16, 'triangle', 0.1, i * 0.09)); },
  boom() { beep(70, 0.45, 'sawtooth', 0.2); beep(46, 0.5, 'square', 0.15, 0.07); },
  slash() { beep(1150, 0.07, 'sawtooth', 0.09); beep(700, 0.09, 'sawtooth', 0.08, 0.05); },
  loot() { [660, 880, 1100].forEach((f, i) => beep(f, 0.14, 'triangle', 0.1, i * 0.08)); },
  quest() { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.2, 'sine', 0.1, i * 0.11)); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => beep(f, 0.28, 'sine', 0.12, i * 0.14)); },
  lose() { [400, 320, 240, 150].forEach((f, i) => beep(f, 0.3, 'sawtooth', 0.1, i * 0.16)); },
};
export function toggleMute() {
  muted = !muted;
  const b = $('#sound-btn');
  if (b) b.textContent = muted ? '🔇' : '🔊';
  return muted;
}

// ---------- Sauvegarde locale ----------
const SAVE_KEY = 'brumelune-save-v1';
export function saveGame(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch (e) { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function hasSave() { return !!loadGame(); }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
