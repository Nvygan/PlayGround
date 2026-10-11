// ============================================================
// Brumelune — Les Veilleurs · main.js
// Démarrage, caméra isométrique, entrées tactiles, boucle.
// ============================================================
import * as THREE from '../lib/three.module.js';
import { $, sfx } from './core.js';
import * as W from './world.js';
import * as Gmod from './game.js';
import * as UI from './ui.js';

// ---------- Vérifie WebGL avant tout ----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

let renderer, scene, camera;
const canvas = $('#scene');
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();

boot();
function boot() {
  if (!webglOK()) { // gestion d’erreur visible
    $('#nogl').classList.remove('hidden');
    $('#menu').classList.add('hidden');
    $('#loading').textContent = 'WebGL indisponible.';
    return;
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true });
  } catch (e) {
    $('#nogl').classList.remove('hidden');
    $('#menu').classList.add('hidden');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-11, 11, 11, -11, 0.1, 300);
  W.initWorld(scene, camera, renderer);
  W.buildMap(1); // décor d’accueil derrière le menu
  W.setQuality('M');

  // branche l’UI sur le jeu (évite les imports circulaires)
  Gmod.setHooks({ log: UI.log, refresh: UI.refreshAll, end: UI.showEnd, shop: UI.openShop, interact: UI.updateInteractBtn });
  UI.buildMenu();
  UI.wireChrome();
  wireInput();
  onResize();
  addEventListener('resize', onResize);
  $('#loading').textContent = 'Monde de Nérélys prêt ✅ — choisissez votre Veilleur !';
  window.__gameReady = true;
  window.__game = debugApi();
  requestAnimationFrame(loop);
}
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  W.updateIsoCam();
}

// ---------- Boucle ----------
let last = performance.now(), elapsed = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; elapsed += dt;
  W.updateWorld(dt);
  Gmod.updateEntities(dt, elapsed);
  // halos des sorts sélectionnés : pulsation
  renderer.render(scene, camera);
}

// ---------- Entrées : toucher = agir, glisser = panoramique, pincer = zoom ----------
let pdown = null, moved = 0, pinch0 = 0, zoom0 = 11, panX = 0, panZ = 0;
function wireInput() {
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    if (!pdown) pdown = { x: ev.clientX, y: ev.clientY, t: Date.now(), id: ev.pointerId };
    else pinch0 = Math.hypot(ev.clientX - pdown.x, ev.clientY - pdown.y);
    moved = 0;
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!pdown) return;
    if (ev.pointerId !== pdown.id && pinch0) { // pincement : zoom iso
      const d = Math.hypot(ev.clientX - pdown.x, ev.clientY - pdown.y);
      const f = pinch0 / Math.max(40, d);
      pinch0 = d;
      W.isoZoomBy(Math.max(0.9, Math.min(1.1, f)));
      return;
    }
    if (ev.pointerId !== pdown.id) return;
    moved = Math.max(moved, Math.abs(ev.clientX - pdown.x) + Math.abs(ev.clientY - pdown.y));
  });
  canvas.addEventListener('pointerup', (ev) => {
    const tap = pdown && moved < 14 && Date.now() - pdown.t < 600 && ev.pointerId === pdown.id;
    pdown = null; pinch0 = 0;
    if (tap) handleTap(ev.clientX, ev.clientY);
  });
  canvas.addEventListener('wheel', (ev) => W.isoZoomBy(ev.deltaY > 0 ? 1.1 : 0.9), { passive: true });
  $('#hero-face').onclick = () => { const h = Gmod.G.hero; if (h) W.isoFocus(h.x, h.z); };
}

// ---------- Sélection 3D ----------
function pick(cx, cy) {
  ptr.x = (cx / innerWidth) * 2 - 1;
  ptr.y = -(cy / innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  // 1) entités d’abord (sphères englobantes généreuses pour le tactile)
  const meshes = [];
  for (const e of Gmod.G.entities) if (e.alive && e.mesh) meshes.push(e.mesh);
  const hits = ray.intersectObjects(meshes, true);
  if (hits.length) {
    let o = hits[0].object;
    while (o) {
      const e = Gmod.G.entities.find((en) => en.mesh === o);
      if (e) return { entity: e, x: e.x, z: e.z };
      o = o.parent;
    }
  }
  // 2) cases
  const all = [];
  for (let x = 0; x < W.SIZE; x++) for (let z = 0; z < W.SIZE; z++) all.push(W.tiles[x][z].mesh);
  const th = ray.intersectObjects(all, false);
  if (th.length) {
    const m = th[0].object;
    for (let x = 0; x < W.SIZE; x++) for (let z = 0; z < W.SIZE; z++)
      if (W.tiles[x][z].mesh === m) return { x, z, entity: W.tiles[x][z].entity };
  }
  return null;
}

async function handleTap(cx, cy) {
  const G = Gmod.G;
  if (!G.P || G.mode === 'title' || G.mode === 'dialog' || G.busy || G.over) return;
  if (!$('#panel-end').classList.contains('hidden')) return; // modale ouverte
  if (!$('#dialog').classList.contains('hidden')) return;
  const hit = pick(cx, cy);
  if (!hit) return;
  const occ = hit.entity && hit.entity.alive ? hit.entity : null;
  if (occ) UI.showTarget(occ, Gmod.manh(G.hero.x, G.hero.z, occ.x, occ.z));
  else UI.showTarget(null);

  if (G.mode === 'explore') await exploreTap(hit, occ);
  else if (G.mode === 'combat') await combatTap(hit, occ);
}

// ---------- Exploration : marcher, parler, fouiller ----------
async function exploreTap(hit, occ) {
  const G = Gmod.G;
  if (G.busy) return;
  const h = G.hero;
  if (occ && occ.kind === 'foe') { // un monstre : on s’approche puis combat !
    const pack = G.packs.find((p) => p.members.includes(occ.id));
    const adj = freeAdjacent(occ.x, occ.z);
    if (!adj && Gmod.manh(h.x, h.z, occ.x, occ.z) > 1) { UI.log('⛔ Impossible d’approcher.'); return; }
    if (adj) {
      G.busy = true;
      const path = Gmod.bfsPath(h.x, h.z, adj[0], adj[1], 99);
      if (path) await Gmod.walkPath(h, path, () => UI.refreshAll());
      G.busy = false; UI.refreshAll(); updateInteractBtn();
    }
    const foes = pack ? pack.members.map((id) => G.entities.find((e) => e.id === id)).filter((e) => e && e.alive) : [occ];
    if (foes.length) Gmod.startCombat(foes);
    return;
  }
  if (occ && occ.kind === 'npc') {
    const adj = freeAdjacent(occ.x, occ.z) || [h.x, h.z];
    if (Gmod.manh(h.x, h.z, occ.x, occ.z) > 1 && adj) {
      G.busy = true;
      const path = Gmod.bfsPath(h.x, h.z, adj[0], adj[1], 99);
      if (path) await Gmod.walkPath(h, path, () => UI.refreshAll());
      G.busy = false;
    }
    UI.openDialog(Gmod.npcDialog(occ.npcId));
    return;
  }
  const t = W.tiles[hit.x][hit.z];
  if (t.interact && !t.entity) { // coffre / champignon / pierre / donjon : approcher puis agir
    const spots = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = hit.x + dx, nz = hit.z + dz;
      if (W.inBounds(nx, nz) && !W.tiles[nx][nz].obstacle && !W.tiles[nx][nz].water && (!W.tiles[nx][nz].entity || W.tiles[nx][nz].entity === h)) spots.push([nx, nz]);
    }
    if (spots.length && !(h.x === hit.x && h.z === hit.z)) {
      spots.sort((a, b) => Gmod.manh(h.x, h.z, a[0], a[1]) - Gmod.manh(h.x, h.z, b[0], b[1]));
      G.busy = true;
      const path = Gmod.bfsPath(h.x, h.z, spots[0][0], spots[0][1], 99);
      if (path) await Gmod.walkPath(h, path, () => UI.refreshAll());
      G.busy = false; UI.refreshAll();
    }
    doInteract(t);
    updateInteractBtn();
    return;
  }
  if (t.entity && t.entity !== h) return;
  if (t.obstacle || t.water || t.wall) return;
  G.busy = true;
  const path = Gmod.bfsPath(h.x, h.z, hit.x, hit.z, 99);
  if (path) await Gmod.walkPath(h, path, () => { UI.refreshAll(); });
  else UI.log('⛔ Chemin bloqué.');
  G.busy = false; UI.refreshAll(); updateInteractBtn();
  W.isoFocus(h.x, h.z);
}
function freeAdjacent(x, z) {
  const opts = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, nz = z + dz;
    if (!W.inBounds(nx, nz)) continue;
    const t = W.tiles[nx][nz];
    if (!t.obstacle && !t.water && !t.wall && (!t.entity || t.entity === Gmod.G.hero)) opts.push([nx, nz]);
  }
  const h = Gmod.G.hero;
  opts.sort((a, b) => Gmod.manh(h.x, h.z, a[0], a[1]) - Gmod.manh(h.x, h.z, b[0], b[1]));
  return opts[0] || null;
}
const updateInteractBtn = () => UI.updateInteractBtn();

// ---------- Combat : sorts, déplacements ----------
async function combatTap(hit, occ) {
  const G = Gmod.G;
  if (G.busy || G.active !== G.hero || !G.hero.controlled) return;
  const h = G.hero;
  if (G.sel) {
    const s = G.sel;
    const ok = Gmod.castSpell(h, s, hit.x, hit.z);
    if (ok) {
      if (h.pa < (G.sel?.pa ?? 99)) { G.sel = null; $('#spell-tip').classList.add('hidden'); }
      UI.refreshAll(); Gmod.showHints();
    }
    return;
  }
  if (occ && occ.team === 'foe' && occ.alive) { // attaque rapide : premier sort dispo à portée
    const cls = __CLASSES[G.P.classId];
    const dmg = cls.spells.find((s) => ['dmg', 'burn'].includes(s.kind) && h.pa >= s.pa
      && Gmod.manh(h.x, h.z, occ.x, occ.z) >= s.range[0] && Gmod.manh(h.x, h.z, occ.x, occ.z) <= s.range[1]);
    if (dmg) {
      UI.selectSpell(dmg);
      Gmod.castSpell(h, dmg, occ.x, occ.z);
      G.sel = null; $('#spell-tip').classList.add('hidden');
      UI.refreshAll(); Gmod.showHints();
    } else { UI.log('⛔ Hors de portée — approchez-vous ou choisissez un sort.'); sfx.miss(); }
    return;
  }
  if (occ && (occ.team === 'hero') && occ !== h) { UI.showTarget(occ, 0); return; }
  if (!occ) {
    if (h.pm <= 0) { UI.log('⛔ Plus de 👣 ! Terminez le tour.'); return; }
    const dist = Gmod.bfsRange(h.x, h.z, h.pm);
    if (dist[W.key(hit.x, hit.z)] === undefined) { UI.log('⛔ Case inaccessible.'); return; }
    const path = Gmod.bfsPath(h.x, h.z, hit.x, hit.z, h.pm);
    if (!path) return;
    G.busy = true;
    await Gmod.walkPath(h, path, () => UI.refreshAll());
    G.busy = false; UI.refreshAll(); Gmod.showHints();
  }
}

// ---------- API de test / debug ----------
function debugApi() {
  const G = Gmod.G;
  return {
    G, version: 'brumelune-v1',
    state: () => ({ mode: G.mode, zone: G.zone, turn: G.turnNum, active: G.active?.id, hero: G.hero ? { x: G.hero.x, z: G.hero.z, hp: G.hero.hp, pa: G.hero.pa, pm: G.hero.pm, lvl: G.P.level, xp: G.P.xp, gold: G.P.gold } : null, foes: G.entities.filter((e) => e.team === 'foe').map((e) => `${e.name}:${Math.ceil(e.hp)}:${e.x},${e.z}:${e.alive ? 'ok' : 'ko'}`).join(' | ') }),
    start: (cls) => { $('#menu').classList.add('hidden'); ['#hud-top', '#dock', '#combat-log'].forEach((s) => $(s).classList.remove('hidden')); Gmod.newGame(cls || 'eclaireuse'); UI.refreshAll(); },
    tap: (x, z) => handleTapTile(x, z),
    stepTo: async (tx, tz) => { const h = G.hero; const reach = Gmod.bfsRange(h.x, h.z, h.pm); let best = null, bd = 1e9; for (const k of Object.keys(reach)) { const [x, z] = k.split(',').map(Number); if (x === h.x && z === h.z) continue; const d = Math.abs(x - tx) + Math.abs(z - tz); if (d < bd) { bd = d; best = [x, z]; } } if (!best) return 'nopath'; const path = Gmod.bfsPath(h.x, h.z, best[0], best[1], h.pm); if (!path) return 'nopath'; G.busy = true; await Gmod.walkPath(h, path, () => UI.refreshAll()); G.busy = false; UI.refreshAll(); Gmod.showHints(); return 'moved:' + best; },
    cast: (spellId, tx, tz) => { const h = G.hero; const sp = spellList(G.P.classId).find((q) => q.id === spellId); if (!sp) return 'no-spell'; G.sel = sp; const ok = Gmod.castSpell(h, sp, tx, tz); G.sel = null; UI.refreshAll(); return ok ? 'cast-ok' : 'cast-fail'; },
    endTurn: () => Gmod.endTurn(),
    near: (x, z) => { const h = G.hero; if (W.tiles[h.x][h.z].entity === h) W.tiles[h.x][h.z].entity = null; let tx = x, tz = z; if (W.tiles[tx][tz].entity) { outer: for (let r = 1; r < 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const nx = x + dx, nz = z + dz; if (W.inBounds(nx, nz) && !W.tiles[nx][nz].entity && !W.tiles[nx][nz].obstacle && !W.tiles[nx][nz].water) { tx = nx; tz = nz; break outer; } } } h.x = tx; h.z = tz; W.tiles[tx][tz].entity = h; const { wx, wz } = W.gridToWorld(tx, tz); h.mesh.position.set(wx, W.topY(tx, tz), wz); UI.refreshAll(); updateInteractBtn(); return tx + ',' + tz; },
    interact: () => { const b = $('#interact-btn'); return b.classList.contains('hidden') ? 'none' : b.textContent; },
    pressInteract: () => $('#interact-btn').click(),
    quests: () => JSON.parse(JSON.stringify(G.P.quests)),
    inv: () => JSON.parse(JSON.stringify({ inv: G.P.inv, equip: G.P.equip, gold: G.P.gold })),
  };
}
function heroSpells() {
  // sorts du héros (import statique en bas de fichier)
  return Gmod.G.P ? spellList(Gmod.G.P.classId) : [];
}
import { CLASSES as __CLASSES } from './data.js';
function spellList(classId) { return __CLASSES[classId].spells; }
async function handleTapTile(x, z) {
  // rejoue un toucher au centre de la case (utile aux tests)
  const { wx, wz } = W.gridToWorld(x, z);
  const v = new THREE.Vector3(wx, 1, wz).project(camera);
  await handleTap((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
  return 'tapped';
}
