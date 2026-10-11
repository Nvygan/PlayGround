// ============================================================
// Brumelune — Les Veilleurs · world.js
// Scène iso, terrain en relief, rivière + pont, campement,
// donjon, coffres, ressources, décor vivant et effets.
// ============================================================
import * as THREE from '../lib/three.module.js';
import { clamp } from './core.js';

export const SIZE = 12, TILE = 2;
export let scene = null, camera = null, renderer = null;
export let tiles = [];            // tiles[x][z]
let tileGroup, hlGroup, fxGroup, waterMats = [], flames = [], clouds = [], fireflies = [];
let isoZoom = 11, isoTarget = new THREE.Vector3(0, 0, 0);

export const key = (x, z) => x + ',' + z;
export const inBounds = (x, z) => x >= 0 && z >= 0 && x < SIZE && z < SIZE;
export function gridToWorld(x, z) { return { wx: (x - (SIZE - 1) / 2) * TILE, wz: (z - (SIZE - 1) / 2) * TILE }; }
export function topY(x, z) { return inBounds(x, z) ? tiles[x][z].h : 0; }
// Ligne de vue : rochers et murs de braises bloquent ; arbres et eau : non.
export function lineOfSight(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, steps = Math.max(Math.abs(dx), Math.abs(dz));
  for (let i = 1; i < steps; i++) {
    const x = Math.round(ax + (dx * i) / steps), z = Math.round(az + (dz * i) / steps);
    if (inBounds(x, z)) {
      const t = tiles[x][z];
      if ((t.obstacle && !t.tree && !t.water) || t.wall) return false;
    }
  }
  return true;
}

// ---------- Initialisation (appelée par main.js) ----------
export function initWorld(scn, cam, rnd) {
  scene = scn; camera = cam; renderer = rnd;
  tileGroup = new THREE.Group(); hlGroup = new THREE.Group(); fxGroup = new THREE.Group();
  scene.add(tileGroup, hlGroup, fxGroup);
  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x4a7a5a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
  sun.position.set(16, 24, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 });
  scene.add(sun);
  scene.background = new THREE.Color(0x9fd0f0);
  scene.fog = new THREE.Fog(0xaad4f0, 42, 110);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9fd0f0, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  updateIsoCam();
}
export function updateIsoCam() {
  if (!camera) return;
  const a = camera.aspect || 1;
  camera.left = -isoZoom * a; camera.right = isoZoom * a;
  camera.top = isoZoom; camera.bottom = -isoZoom;
  const d = 60;
  camera.position.set(isoTarget.x + d * 0.62 + shakeX, d * 0.78, isoTarget.z + d * 0.62);
  camera.lookAt(isoTarget.x, 0, isoTarget.z);
  camera.updateProjectionMatrix();
}
export function isoZoomBy(f) { isoZoom = clamp(isoZoom * f, 6, 20); updateIsoCam(); }
export function isoFocus(x, z) { const { wx, wz } = gridToWorld(x, z); isoTarget.set(wx, 0, wz); updateIsoCam(); }
let shakeX = 0;
export function shake(amt = 0.5) { shakeAmt = Math.min(1.4, shakeAmt + amt); }
let shakeAmt = 0;

// ---------- Construction de la carte ----------
const std = (c, r = 0.9, ex = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...ex });
const basic = (c, ex = {}) => new THREE.MeshBasicMaterial({ color: c, ...ex });

function relief(x, z) {
  return 0.22 * Math.sin(x * 0.8) * Math.cos(z * 0.7) + 0.12 * Math.sin(x * 0.4 + z * 0.5);
}
export function buildMap(level = 1) {
  // nettoie l'ancienne carte (décor + surlignages + fx)
  while (tileGroup.children.length) tileGroup.remove(tileGroup.children[0]);
  while (hlGroup.children.length) hlGroup.remove(hlGroup.children[0]);
  while (fxGroup.children.length) fxGroup.remove(fxGroup.children[0]);
  waterMats = []; flames = []; clouds = []; fireflies = [];
  tiles = [];
  const dark = level === 2; // Voile Profond : teintes plus mystérieuses
  if (scene) { scene.background.set(dark ? 0x7a90d8 : 0x9fd0f0); scene.fog.color.set(dark ? 0x8a9ce0 : 0xaad4f0); }

  const pathCells = new Set();
  for (let x = 1; x < SIZE; x++) pathCells.add(key(x, 5));       // sentier est-ouest
  for (let z = 1; z < 10; z++) pathCells.add(key(5, z));          // sentier nord-sud
  const rocks = new Set(['3,7', '6,3', '9,8', '2,9', '10,4', '4,10', '7,1', '1,6', '9,2', '6,8'].map(s => s));
  const fw = SIZE * TILE + 2;

  for (let x = 0; x < SIZE; x++) {
    tiles[x] = [];
    for (let z = 0; z < SIZE; z++) {
      const { wx, wz } = gridToWorld(x, z);
      const isRiver = (x === 8 && z !== 5);
      const isBridge = (x === 8 && z === 5);
      const rock = rocks.has(key(x, z));
      const h = isRiver ? -0.7 : relief(x, z);
      // dalle
      let col;
      if (isRiver) col = 0x4aa8d8;
      else if (isBridge) col = 0x9a6a3a;
      else if (pathCells.has(key(x, z))) col = dark ? 0xb09ac0 : 0xe0c890;
      else col = dark ? new THREE.Color(0x5a8a6a).offsetHSL(0.06, 0, 0).getHex() : [0x6fbf62, 0x7cc86e, 0x65b45a][(x * 7 + z * 3) % 3];
      const m = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.97, 1.2, TILE * 0.97), std(col));
      m.position.set(wx, h - 0.6, wz); m.receiveShadow = true;
      tileGroup.add(m);
      if (isRiver) { // surface d'eau animée
        const w = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.95, TILE * 0.95),
          new THREE.MeshBasicMaterial({ color: 0x5ac8f0, transparent: true, opacity: 0.75 }));
        w.rotation.x = -Math.PI / 2; w.position.set(wx, -0.32, wz);
        tileGroup.add(w); waterMats.push(w.material);
      }
      if (isBridge) { // rambardes du pont
        [-0.85, 0.85].forEach((o) => {
          const r = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 0.5, 0.12), std(0x7a5230));
          r.position.set(wx, h + 0.45, wz + o); r.castShadow = true; tileGroup.add(r);
        });
      }
      tiles[x][z] = {
        x, z, h, mesh: m, entity: null, hl: null, trap: null, wall: null,
        water: isRiver, bridge: isBridge, obstacle: rock || isRiver, interact: null,
      };
      if (rock) { // rocher bloquant
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), std(0x8d8d9a, 1, { flatShading: true }));
        r.position.set(wx, h + 0.5, wz); r.castShadow = r.receiveShadow = true; tileGroup.add(r);
        const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), std(0x7a7a88, 1, { flatShading: true }));
        r2.position.set(wx + 0.6, h + 0.25, wz + 0.3); r2.castShadow = true; tileGroup.add(r2);
      }
    }
  }
  // socle de l'île flottante + mini-îles + nuages
  const under = new THREE.Mesh(new THREE.ConeGeometry(fw * 0.72, 10, 9), std(dark ? 0x5a4a7a : 0x8a6a55, 1, { flatShading: true }));
  under.rotation.x = Math.PI; under.position.y = -6.2; tileGroup.add(under);
  for (let i = 0; i < 3; i++) { // îlots flottants
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 1, 8), std(0x6fbf62));
    top.position.y = 0; g.add(top);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3, 7), std(0x8a6a55, 1, { flatShading: true }));
    bot.rotation.x = Math.PI; bot.position.y = -2; g.add(bot);
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 7), std(0x2f7a4a, 0.9, { flatShading: true }));
    t.position.y = 1.8; g.add(t);
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.position.set(Math.cos(a) * 26, 6 + i * 2, Math.sin(a) * 26);
    g.userData.islet = { a, r: 26, h: 6 + i * 2, sp: 0.05 + i * 0.02 };
    tileGroup.add(g); clouds.push(g);
  }
  for (let i = 0; i < 6; i++) { // nuages doux
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random(), 10, 10), basic(0xffffff, { transparent: true, opacity: 0.85, fog: false }));
      s.position.set(j * 1.4 - 1.4, Math.random() * 0.5, 0); s.scale.y = 0.6; c.add(s);
    }
    const a = Math.random() * 6.28;
    c.position.set(Math.cos(a) * 30, 10 + Math.random() * 6, Math.sin(a) * 30);
    c.userData.cloud = { a, sp: 0.02 + Math.random() * 0.03 };
    tileGroup.add(c); clouds.push(c);
  }
  growVegetation(dark);
  buildCamp(); buildDungeon(); buildStonesAndChests();
  // le mobilier du camp bloque (on ne marche pas dans les tentes ni le feu)
  for (const [bx, bz] of [[1, 1], [2, 1], [2, 2], [5, 2]]) {
    if (inBounds(bx, bz) && !tiles[bx][bz].entity) tiles[bx][bz].obstacle = true;
  }
  spawnFireflies();
  isoTarget.set(0, 0, 0); updateIsoCam();
}

// ---------- Végétation ----------
function growVegetation(dark) {
  const free = [];
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const t = tiles[x][z];
    if (!t.obstacle && !t.water && !t.bridge) free.push(t);
  }
  // arbres (hors camp et sentiers centraux)
  let planted = 0;
  for (const t of [...free].sort(() => Math.random() - 0.5)) {
    if (planted >= 15) break;
    if (t.x < 4 && t.z < 4) continue;         // camp dégagé
    if (Math.abs(t.x - 5) < 2 && t.z > 3) continue;
    const { wx, wz } = gridToWorld(t.x, t.z);
    if (Math.random() < 0.5) { // arbre rond
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 7), std(0x6b4a2e));
      trunk.position.set(wx, t.h + 0.7, wz); trunk.castShadow = true; tileGroup.add(trunk);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 10), std(dark ? 0x5a6ab8 : 0x3f9e4d, 0.9, { flatShading: true }));
      leaf.position.set(wx, t.h + 2.1, wz); leaf.scale.y = 0.85; leaf.castShadow = true; tileGroup.add(leaf);
    } else { // pin
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.0, 6), std(0x6b4a2e));
      trunk.position.set(wx, t.h + 0.5, wz); trunk.castShadow = true; tileGroup.add(trunk);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.0, 7), std(dark ? 0x4a5ab8 : 0x2f7a4a, 0.9, { flatShading: true }));
      c.position.set(wx, t.h + 2.0, wz); c.castShadow = true; tileGroup.add(c);
    }
    t.obstacle = true; t.tree = true; planted++;
  }
  // fleurs + herbes (non bloquants)
  for (let i = 0; i < 46; i++) {
    const t = free[rand2(free.length)];
    if (!t || t.tree) continue;
    const { wx, wz } = gridToWorld(t.x, t.z);
    const ox = (Math.random() - 0.5) * 1.2, oz = (Math.random() - 0.5) * 1.2;
    if (Math.random() < 0.45) { // fleur
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), std(0x3f8a3a));
      stem.position.set(wx + ox, t.h + 0.2, wz + oz); tileGroup.add(stem);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
        basic([0xff7eb8, 0xffd94a, 0xffffff, 0xc99dff][i % 4]));
      top.position.set(wx + ox, t.h + 0.45, wz + oz); tileGroup.add(top);
    } else { // touffe
      const tu = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 5), std(dark ? 0x6a7ad8 : 0x4aa84e, 1, { flatShading: true }));
      tu.position.set(wx + ox, t.h + 0.22, wz + oz); tileGroup.add(tu);
    }
  }
}
function rand2(n) { return Math.floor(Math.random() * n); }

// ---------- Campement ----------
function buildCamp() {
  const tent = (x, z, col) => {
    const { wx, wz } = gridToWorld(x, z); const h = topY(x, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.9, 8), std(col, 0.95));
    c.position.set(wx, h + 0.95, wz); c.castShadow = true; tileGroup.add(c);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), std(0x6b4a2e));
    p.position.set(wx, h + 1.1, wz); tileGroup.add(p);
  };
  tent(1, 1, 0xe88a5a); tent(2, 1, 0x7c6cf0);
  // feu de camp
  const { wx, wz } = gridToWorld(2, 2); const h = topY(2, 2);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), std(0x8d8d9a, 1, { flatShading: true }));
    const a = (i / 5) * 6.28;
    s.position.set(wx + Math.cos(a) * 0.55, h + 0.1, wz + Math.sin(a) * 0.55); tileGroup.add(s);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), basic(0xffb13d));
  flame.position.set(wx, h + 0.55, wz); tileGroup.add(flame); flames.push(flame);
  const l = new THREE.PointLight(0xff9d3d, 14, 12); l.position.set(wx, h + 1.2, wz); tileGroup.add(l);
}

// ---------- Donjon : arche runique ----------
export function dungeonPos() { return { x: 10, z: 10 }; }
function buildDungeon() {
  const { x, z } = dungeonPos();
  const { wx, wz } = gridToWorld(x, z); const h = topY(x, z);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), std(0x7a7a9a, 0.95));
    p.position.set(wx + s * 1.4, h + 1.7, wz); p.castShadow = true; tileGroup.add(p);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.7, 0.9), std(0x7a7a9a, 0.95));
  top.position.set(wx, h + 3.6, wz); top.castShadow = true; tileGroup.add(top);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.8),
    new THREE.MeshBasicMaterial({ color: 0x8a5ae0, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  portal.position.set(wx, h + 1.6, wz); tileGroup.add(portal);
  waterMats.push(portal.material);
  const rune = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 24), basic(0xffd94a, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  rune.position.set(wx, h + 0.1, wz + 1.6); rune.rotation.x = -Math.PI / 2; tileGroup.add(rune);
  tiles[x][z].interact = { type: 'dungeon' };
}

// ---------- Pierre de souvenir + coffres + champignons ----------
export function savePos() { return { x: 5, z: 2 }; }
export function chestSpots() { return [{ x: 4, z: 8 }, { x: 9, z: 4 }]; }
export function glowSpots() { return [{ x: 3, z: 5 }, { x: 6, z: 9 }, { x: 10, z: 7 }, { x: 1, z: 8 }, { x: 7, z: 3 }]; }
function buildStonesAndChests() {
  const sp = savePos(); // pierre de souvenir
  {
    const { wx, wz } = gridToWorld(sp.x, sp.z); const h = topY(sp.x, sp.z);
    const ob = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), std(0x9f8fff, 0.7, { flatShading: true }));
    ob.position.set(wx, h + 1.1, wz); ob.castShadow = true; tileGroup.add(ob);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.3, 24), basic(0x9f8fff, { transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.position.set(wx, h + 0.06, wz); ring.rotation.x = -Math.PI / 2; tileGroup.add(ring);
    tiles[sp.x][sp.z].interact = { type: 'save' };
  }
  for (const c of chestSpots()) { // coffres
    const { wx, wz } = gridToWorld(c.x, c.z); const h = topY(c.x, c.z);
    const g = new THREE.Group(); g.position.set(wx, h, wz);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.8), std(0x8a5a2e, 0.85));
    box.position.y = 0.3; box.castShadow = true; g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.8), std(0xa8763e, 0.85));
    lid.position.set(0, 0.72, -0.35); lid.geometry.translate(0, 0, 0.35); g.add(lid);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.1), basic(0xffd94a));
    lock.position.set(0, 0.45, 0.42); g.add(lock);
    tileGroup.add(g);
    tiles[c.x][c.z].interact = { type: 'chest', opened: false, lid };
    tiles[c.x][c.z].obstacle = true;
  }
  for (const s of glowSpots()) { // champignons luisants à cueillir
    const { wx, wz } = gridToWorld(s.x, s.z); const h = topY(s.x, s.z);
    const g = new THREE.Group(); g.position.set(wx, h, wz);
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.5, 6), std(0xf0e6d0));
      stem.position.set((i - 1) * 0.35, 0.25, (i % 2) * 0.3 - 0.15); g.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), basic(0x7df0ff));
      cap.position.copy(stem.position); cap.position.y = 0.5; g.add(cap);
    }
    tileGroup.add(g);
    tiles[s.x][s.z].interact = { type: 'glow', taken: false, mesh: g };
  }
}
function spawnFireflies() {
  for (let i = 0; i < 22; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), basic(0xfff59d, { transparent: true, opacity: 0.9 }));
    const x = Math.floor(Math.random() * SIZE), z = Math.floor(Math.random() * SIZE);
    const { wx, wz } = gridToWorld(x, z);
    f.position.set(wx, topY(x, z) + 1 + Math.random() * 2, wz);
    f.userData.ff = { x0: wx, z0: wz, t: Math.random() * 10, sp: 0.5 + Math.random() };
    tileGroup.add(f); fireflies.push(f);
  }
}

// ---------- Surlignages ----------
export function clearHL() {
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const t = tiles[x] && tiles[x][z];
    if (t && t.hl) { hlGroup.remove(t.hl); t.hl.geometry.dispose(); t.hl = null; }
  }
}
export function setHL(x, z, color, opacity = 0.55) {
  if (!inBounds(x, z)) return;
  const t = tiles[x][z];
  if (!t || t.hl || t.water) return;
  const { wx, wz } = gridToWorld(x, z);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.88, TILE * 0.88),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(wx, t.h + 0.07, wz);
  hlGroup.add(m); t.hl = m;
}

// ---------- Effets : particules, anneaux, piliers, flash ----------
const projectiles = [], particles = [], rings = [], beams = [], flashes = [];
export function shootFx(from, to, color, onHit, kind = 'bolt') {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), basic(color)));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), basic(color, { transparent: true, opacity: 0.35 }));
  g.add(halo);
  g.position.copy(from).add(new THREE.Vector3(0, 1.5, 0));
  fxGroup.add(g);
  projectiles.push({ mesh: g, from: from.clone().add(new THREE.Vector3(0, 1.5, 0)), to: to.clone().add(new THREE.Vector3(0, 1.2, 0)), t: 0, onHit, kind });
}
export function burst(x, y, z, color, n = 12, up = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.09, 6, 6), basic(color, { transparent: true, opacity: 1 }));
    m.position.set(x, y, z); fxGroup.add(m);
    particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * up + 1, (Math.random() - 0.5) * 6), life: 0.6 + Math.random() * 0.35, grav: 9 });
  }
}
export function leafBurst(x, y, z, n = 12) { // feuilles virevoltantes (doux, non violent)
  const cols = [0x5be38a, 0x7cc86e, 0xffd94a];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), basic(cols[i % 3], { transparent: true, opacity: 1, side: THREE.DoubleSide }));
    m.position.set(x, y, z); fxGroup.add(m);
    particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4), life: 0.9 + Math.random() * 0.4, grav: 2.5, spin: true });
  }
}
export function starBurst(x, y, z, n = 10) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), basic(i % 2 ? 0xffe27a : 0xffffff, { transparent: true, opacity: 1 }));
    m.position.set(x, y, z); fxGroup.add(m);
    particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5), life: 0.8, grav: 5, spin: true });
  }
}
export function ringFx(x, y, z, color = 0xffd94a, maxR = 3.2, dur = 0.6) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.85, 32), basic(color, { transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); fxGroup.add(m);
  rings.push({ mesh: m, t: 0, dur, maxR });
}
export function pillarFx(x, y, z, color = 0xffd94a, h = 5, dur = 0.7) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, h, 14, 1, true), basic(color, { transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(x, y + h / 2, z); fxGroup.add(m);
  beams.push({ mesh: m, t: 0, dur });
}
export function flashFx(x, y, z, color = 0xffd94a, power = 30, dur = 0.4) {
  const l = new THREE.PointLight(color, power, 20); l.position.set(x, y, z); fxGroup.add(l);
  flashes.push({ light: l, t: 0, dur, power });
}
// manteau de mur de braises (tuiles enflammées temporaires)
export function wallFx(x, z, turns) {
  const t = tiles[x][z];
  const { wx, wz } = gridToWorld(x, z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.8, 0.9, TILE * 0.8),
    basic(0xff6b2d, { transparent: true, opacity: 0.75 }));
  m.position.set(wx, t.h + 0.45, wz); fxGroup.add(m);
  t.wall = { turns, mesh: m };
}

// ---------- Boucle monde : eau, flammes, nuages, lucioles ----------
let elapsed = 0;
export function updateWorld(dt) {
  elapsed += dt;
  waterMats.forEach((m, i) => { m.opacity = 0.65 + Math.sin(elapsed * 2 + i) * 0.12; });
  flames.forEach((f) => f.scale.set(1 + Math.sin(elapsed * 11) * 0.15, 1 + Math.sin(elapsed * 13) * 0.2, 1));
  clouds.forEach((c) => {
    if (c.userData.islet) {
      const d = c.userData.islet; d.a += dt * d.sp;
      c.position.set(Math.cos(d.a) * d.r, d.h + Math.sin(elapsed * 0.7 + d.r) * 0.6, Math.sin(d.a) * d.r);
    } else if (c.userData.cloud) {
      const d = c.userData.cloud; d.a += dt * d.sp;
      c.position.x = Math.cos(d.a) * 32; c.position.z = Math.sin(d.a) * 32;
    }
  });
  fireflies.forEach((f) => {
    const d = f.userData.ff; d.t += dt * d.sp;
    f.position.set(d.x0 + Math.sin(d.t * 1.3) * 1.5, f.position.y + Math.sin(d.t * 2.2) * dt * 0.8, d.z0 + Math.cos(d.t) * 1.5);
    f.material.opacity = 0.5 + Math.abs(Math.sin(d.t * 3)) * 0.5;
  });
  // projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.t += dt * 2.1;
    if (p.t >= 1) { fxGroup.remove(p.mesh); projectiles.splice(i, 1); p.onHit && p.onHit(); continue; }
    p.mesh.position.lerpVectors(p.from, p.to, p.t);
    p.mesh.position.y += Math.sin(p.t * Math.PI) * (p.kind === 'arrow' ? 1.6 : p.kind === 'meteor' ? -1 : 0.5);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    p.vel.y -= (p.grav || 9) * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.spin) { p.mesh.rotation.x += dt * 6; p.mesh.rotation.y += dt * 5; }
    p.mesh.material.opacity = Math.max(0, Math.min(1, p.life * 1.8));
    if (p.life <= 0) { fxGroup.remove(p.mesh); particles.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; const k = r.t / r.dur;
    if (k >= 1) { fxGroup.remove(r.mesh); rings.splice(i, 1); continue; }
    const s = 1 + k * r.maxR; r.mesh.scale.set(s, s, s);
    r.mesh.material.opacity = 0.95 * (1 - k);
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.t += dt; const k = b.t / b.dur;
    if (k >= 1) { fxGroup.remove(b.mesh); beams.splice(i, 1); continue; }
    b.mesh.material.opacity = 0.5 * (1 - k); b.mesh.rotation.y += dt * 3;
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.t += dt; const k = f.t / f.dur;
    if (k >= 1) { fxGroup.remove(f.light); flashes.splice(i, 1); continue; }
    f.light.intensity = f.power * (1 - k);
  }
  if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - dt * 2.4);
  shakeX = (Math.random() - 0.5) * shakeAmt * shakeAmt * 1.2;
  updateIsoCam();
}

// ---------- Qualité graphique ----------
export function setQuality(q) { // 'L' | 'M' | 'H'
  if (!renderer) return;
  renderer.setPixelRatio(q === 'L' ? 0.75 : q === 'M' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = q !== 'L';
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
}
