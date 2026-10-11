// ============================================================
// Brumelune — Les Veilleurs · models.js
// Modèles low-poly 100 % originaux (aucun asset réutilisé) :
// chibis à grosse tête, monstres et PNJ de Nérélys.
// ============================================================
import * as THREE from '../lib/three.module.js';

const mat = (c, r = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });

// ---------- Barre de PV flottante ----------
export function makeHpBar() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 22;
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(2.3, 0.4, 1); sp.position.y = 2.75;
  sp.userData = { canvas: c, tex };
  return sp;
}
export function drawHp(sp, hp, max, shield = false) {
  const ctx = sp.userData.canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 22);
  ctx.fillStyle = 'rgba(8,6,20,0.72)'; ctx.fillRect(0, 0, 128, 22);
  const r = Math.max(0, Math.min(1, hp / max));
  ctx.fillStyle = r > 0.5 ? '#5be38a' : (r > 0.25 ? '#ffd94a' : '#ff6b7a');
  ctx.fillRect(3, 4, 122 * r, 14);
  if (shield) { ctx.fillStyle = 'rgba(140,200,255,0.95)'; ctx.fillRect(3, 4, 122 * r, 5); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(Math.max(0, Math.ceil(hp)) + '/' + max, 64, 16);
  sp.userData.tex.needsUpdate = true;
}
export function makeNameSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 44;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(8,6,20,0.6)'; ctx.fillRect(0, 4, 256, 36);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, 20), 128, 31);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(2.7, 0.47, 1); sp.position.y = 3.3;
  return sp;
}

// ---------- Base chibi : corps + grosse tête ----------
function chibiBase(skin = 0xffd9b3, tunic = 0x7c6cf0) {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.62, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.05; g.add(blob);
  // jambes courtes
  [-1, 1].forEach((s) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 7), mat(0x4a3a5a));
    leg.position.set(s * 0.18, 0.28, 0); leg.castShadow = true; g.add(leg);
    (g.userData.legs ||= []).push(leg);
  });
  // corps tunique
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.5, 6, 12), mat(tunic));
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  // bras
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.35, 4, 8), mat(tunic));
    arm.position.set(s * 0.5, 1.0, 0); arm.rotation.z = s * 0.25; arm.castShadow = true; g.add(arm);
    (g.userData.arms ||= []).push(arm);
  });
  // grosse tête
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16), mat(skin));
  head.position.y = 1.78; head.castShadow = true; g.add(head);
  // yeux + joues (expressif)
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1a1430 }));
    eye.position.set(s * 0.17, 1.85, 0.39); g.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), glow(0xffffff));
    shine.position.set(s * 0.17 + 0.02, 1.88, 0.455); g.add(shine);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9d9d, transparent: true, opacity: 0.55 }));
    cheek.position.set(s * 0.3, 1.68, 0.33); cheek.scale.z = 0.4; g.add(cheek);
  });
  g.userData.body = body; g.userData.head = head;
  return g;
}

// ---------- Héros par classe (silhouettes originales) ----------
export function buildHero(classId) {
  if (classId === 'eclaireuse') { // cape de feuilles + arc cristallin + bandeau étoile
    const g = chibiBase(0xffd9b3, 0x2f8f86);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0x7a4a2e));
    hair.position.y = 1.86; g.add(hair);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 18), mat(0x3fd0c9, 0.4));
    band.position.y = 1.95; band.rotation.x = Math.PI / 2.15; g.add(band);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow(0xffe27a));
    star.position.set(0, 2.02, 0.42); g.add(star); g.userData.star = star;
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 7), mat(0x3fa34d, 0.9, { flatShading: true }));
    cape.position.set(0, 1.0, -0.5); cape.rotation.x = 0.25; cape.castShadow = true; g.add(cape);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 18, Math.PI * 1.2), mat(0x8fd3ff, 0.3));
    bow.position.set(0.62, 1.05, 0.1); bow.rotation.z = -0.5; g.add(bow);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), glow(0x9fe8ff));
    gem.position.set(0.62, 1.05, 0.1); g.add(gem);
    g.userData.idle = 'sway'; g.userData.atk = 'shoot';
    return g;
  }
  if (classId === 'arcaniste') { // chapeau asymétrique + lanterne flottante
    const g = chibiBase(0xf2c9a0, 0xb04a3a);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 8), mat(0x5a2e6e, 0.85));
    hat.position.set(0.12, 2.5, 0); hat.rotation.z = -0.35; hat.castShadow = true; g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 12), mat(0x5a2e6e));
    brim.position.set(0.05, 2.08, 0); brim.rotation.z = -0.12; g.add(brim);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.7, 6), mat(0x6b4a2e));
    staff.position.set(-0.6, 1.1, 0.1); staff.castShadow = true; g.add(staff);
    const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow(0xff9d3d));
    ember.position.set(-0.6, 2.1, 0.1); g.add(ember); g.userData.ember = ember;
    const lant = new THREE.Group(); // lanterne flottante compagne
    const cage = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), glow(0xffd94a));
    lant.add(cage);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.1, 8), mat(0x3a2a4a));
    cap.position.y = 0.24; lant.add(cap);
    lant.position.set(0.85, 1.9, 0.2); g.add(lant); g.userData.lantern = lant;
    g.userData.idle = 'floaty'; g.userData.atk = 'cast';
    return g;
  }
  if (classId === 'gardien') { // manteau de métal + bouclier-graine + casque mousse
    const g = chibiBase(0xe8b88a, 0x4a6b4f);
    [-1, 1].forEach((s) => { // épaulettes métal
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat(0xb0b8cc, 0.35));
      pad.position.set(s * 0.52, 1.35, 0); pad.scale.y = 0.7; pad.castShadow = true; g.add(pad);
    });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8a9aad, 0.4));
    helm.position.y = 1.8; g.add(helm);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat(0x6fbf5a, 1, { flatShading: true }));
    moss.position.set(0.25, 2.2, 0.1); g.add(moss);
    const hammer = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 7), mat(0x6b4a2e));
    hammer.position.set(0.66, 1.1, 0.15); hammer.rotation.z = -0.5; hammer.castShadow = true; g.add(hammer);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mat(0xc9a86a, 0.9, { flatShading: true }));
    head.position.set(0.9, 1.55, 0.15); head.castShadow = true; g.add(head);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(0xc9a86a, 0.85)); // bouclier graine
    shield.scale.set(1, 1.15, 0.45); shield.position.set(-0.66, 1.0, 0.15); shield.castShadow = true; g.add(shield);
    const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), mat(0x6fbf5a));
    sprout.position.set(-0.66, 1.55, 0.15); g.add(sprout);
    g.userData.idle = 'sturdy'; g.userData.atk = 'smash';
    return g;
  }
  // tisseur : écharpe + bâton à anneau + breloque
  const g = chibiBase(0xffd0b0, 0x6a4a9e);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 8, 14), mat(0xffd94a, 0.9));
  scarf.position.y = 1.42; scarf.rotation.x = Math.PI / 2; g.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.06), mat(0xffd94a, 0.9));
  tail.position.set(0.3, 1.0, -0.35); tail.rotation.z = 0.2; g.add(tail); g.userData.scarfTail = tail;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 8), mat(0x4a3670, 0.9));
  hood.position.set(-0.08, 2.35, -0.05); hood.rotation.z = 0.25; hood.castShadow = true; g.add(hood);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.8, 6), mat(0x8a6a4a));
  staff.position.set(0.62, 1.15, 0); g.add(staff);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), mat(0xffd94a, 0.4));
  hoop.position.set(0.62, 2.2, 0); g.add(hoop);
  const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), glow(0xc99dff));
  wisp.position.set(0.62, 2.2, 0); g.add(wisp); g.userData.wisp = wisp;
  g.userData.idle = 'weave'; g.userData.atk = 'cast';
  return g;
}

// ---------- Monstres originaux ----------
export function buildMonster(monId, scale = 1, corrupted = false) {
  const tint = corrupted ? 0x9d4dff : null;
  if (monId === 'mornet') { // cape de brume + masque + sarbacane
    const g = new THREE.Group();
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.6 * scale, 1.5 * scale, 8),
      mat(corrupted ? 0x6a3aa0 : 0x8fa3c8, 0.9, { flatShading: true, transparent: true, opacity: 0.92 }));
    cloak.position.y = 0.75 * scale; cloak.castShadow = true; g.add(cloak);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 12, 12), mat(0xf4efff, 0.6));
    mask.position.set(0, 1.35 * scale, 0.25 * scale); mask.scale.z = 0.7; g.add(mask);
    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 8), new THREE.MeshBasicMaterial({ color: corrupted ? 0xff4dff : 0x3a4a8a }));
      eye.position.set(s * 0.12 * scale, 1.42 * scale, 0.45 * scale); g.add(eye);
    });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.09 * scale, 0.9 * scale, 6), mat(0x4a5a7a));
    tube.rotation.z = Math.PI / 2.3; tube.position.set(0.4 * scale, 0.9 * scale, 0.2); g.add(tube);
    if (corrupted) { const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * scale), glow(0xff4dff)); spike.position.y = 1.7 * scale; g.add(spike); g.userData.spike = spike; }
    addBlob(g, 0.55 * scale);
    g.userData.body = cloak; g.userData.idle = 'hover'; g.userData.atk = 'shoot';
    return g;
  }
  if (monId === 'cendreux') { // golem de cendres aux fissures braisées
    const g = new THREE.Group();
    const base = corrupted ? 0x6a5a8a : 0x9a8a7a;
    const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62 * scale, 0), mat(base, 1, { flatShading: true }));
    belly.position.y = 0.75 * scale; belly.castShadow = true; g.add(belly);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 * scale, 0), mat(base, 1, { flatShading: true }));
    head.position.y = 1.55 * scale; head.castShadow = true; g.add(head);
    [-1, 1].forEach((s) => { // bras piliers
      const arm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * scale, 0), mat(base, 1, { flatShading: true }));
      arm.position.set(s * 0.75 * scale, 0.8 * scale, 0); arm.castShadow = true; g.add(arm);
      (g.userData.arms ||= []).push(arm);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 6, 6), glow(corrupted ? 0xff4dff : 0xff9d3d));
      eye.position.set(s * 0.15 * scale, 1.6 * scale, 0.32 * scale); g.add(eye);
    });
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.5 * scale, 0.1), glow(corrupted ? 0xff4dff : 0xff6b2d));
    crack.position.set(0, 0.8 * scale, 0.55 * scale); g.add(crack);
    addBlob(g, 0.8 * scale);
    g.userData.body = belly; g.userData.idle = 'sturdy'; g.userData.atk = 'smash';
    return g;
  }
  // luciole : scarabée rond, élytres, abdomen lanterne
  const g = new THREE.Group();
  const yb = corrupted ? 0xb08aff : 0xffd94a;
  const bodyL = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 14, 14), mat(yb, 0.7));
  bodyL.position.y = 0.62 * scale; bodyL.scale.set(1, 0.85, 1.2); bodyL.castShadow = true; g.add(bodyL);
  [-1, 1].forEach((s) => { // élytres
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34 * scale, 10, 10), mat(corrupted ? 0x6a3aa0 : 0xc98a2d, 0.6));
    shell.scale.set(0.7, 0.5, 1); shell.position.set(s * 0.28 * scale, 0.95 * scale, -0.1); shell.castShadow = true; g.add(shell);
    if (s < 0) g.userData.wingL = shell; else g.userData.wingR = shell;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1a1430 }));
    eye.position.set(s * 0.2 * scale, 0.75 * scale, 0.55 * scale); g.add(eye);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, 0.4 * scale, 5), mat(0x4a3a2a));
    ant.position.set(s * 0.15 * scale, 1.1 * scale, 0.5 * scale); ant.rotation.x = -0.5; g.add(ant);
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 10, 10), glow(corrupted ? 0xff4dff : 0xfff59d));
  lamp.position.set(0, 0.5 * scale, -0.55 * scale); g.add(lamp); g.userData.lamp = lamp;
  [-1, 1, 0].forEach((s) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.35 * scale, 5), mat(0x4a3a2a));
    leg.position.set(s * 0.35 * scale, 0.2 * scale, 0); g.add(leg);
  });
  addBlob(g, 0.55 * scale);
  g.userData.body = bodyL; g.userData.idle = 'skitter'; g.userData.atk = 'bite';
  return g;
}
function addBlob(g, r) {
  const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.05; g.add(blob);
}

// ---------- Esprit invoqué : Mirette ----------
export function buildSpirit(scale = 0.8) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 12, 12), glow(0xc99dff));
  core.position.y = 1.0 * scale; g.add(core);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.44 * scale, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xc99dff, transparent: true, opacity: 0.3 }));
  halo.position.y = 1.0 * scale; g.add(halo);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), new THREE.MeshBasicMaterial({ color: 0x2a1a4a }));
    eye.position.set(s * 0.12 * scale, 1.05 * scale, 0.27 * scale); g.add(eye);
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.5 * scale, 7), glow(0x8f6fdf));
  tail.position.y = 0.55 * scale; tail.rotation.x = Math.PI; g.add(tail);
  addBlob(g, 0.3 * scale);
  g.userData.body = core; g.userData.idle = 'hover'; g.userData.atk = 'bite';
  return g;
}

// ---------- PNJ originaux ----------
export function buildNPC(npcId) {
  if (npcId === 'selanire') { // grande robe, voile, orbe
    const g = chibiBase(0xe8d0ff, 0x4a3a8a);
    g.scale.setScalar(1.12);
    const veil = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.4, 8), mat(0x7c6cf0, 0.9, { transparent: true, opacity: 0.85 }));
    veil.position.y = 2.2; g.add(veil);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 6), mat(0xd8c890));
    staff.position.set(0.7, 1.2, 0); g.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), glow(0x9fe8ff));
    orb.position.set(0.7, 2.35, 0); g.add(orb); g.userData.orb = orb;
    g.userData.idle = 'floaty';
    return g;
  }
  if (npcId === 'pilpin') { // bedonnant, tablier, hotte, chapeau
    const g = chibiBase(0xf0b890, 0xc98a4a);
    g.userData.body.scale.set(1.25, 1, 1.1);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), mat(0x7a5a3a));
    apron.position.set(0, 0.9, 0.35); g.add(apron);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.35, 10), mat(0x8a5a2a));
    hat.position.y = 2.25; g.add(hat);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), mat(0xa8763e));
    pack.position.set(0, 1.05, -0.5); pack.castShadow = true; g.add(pack);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8), mat(0xe8d9b0));
    roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.4, -0.5); g.add(roll);
    g.userData.idle = 'sway';
    return g;
  }
  // tombelon : long manteau, rouleau de cartes, longue-vue
  const g = chibiBase(0xd8a878, 0x3f7a6a);
  const coat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 7), mat(0x3f7a6a, 0.95));
  coat.position.y = 0.7; g.add(coat);
  const map = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), mat(0xf0e6c0));
  map.rotation.z = Math.PI / 2.2; map.position.set(-0.55, 1.2, 0.2); g.add(map);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 8), mat(0xb08a3a, 0.4));
  scope.rotation.z = Math.PI / 2.5; scope.position.set(0.55, 1.3, 0.2); g.add(scope);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 8, 12), mat(0xff8b4d));
  scarf.position.y = 1.45; scarf.rotation.x = Math.PI / 2; g.add(scarf);
  g.userData.idle = 'sway';
  return g;
}
