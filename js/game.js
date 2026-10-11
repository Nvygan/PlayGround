// ============================================================
// Brumelune — Les Veilleurs · game.js
// État, exploration, combat tour par tour, IA, dégâts (crits,
// esquives, résistances), XP, loot, quêtes, PNJ, sauvegarde.
// ============================================================
import * as THREE from '../lib/three.module.js';
import { $, clamp, rand, chance, sfx, toast, saveGame, loadGame, clearSave } from './core.js';
import { CLASSES, MONSTERS, ITEMS, QUESTS } from './data.js';
import { buildHero, buildMonster, buildSpirit, buildNPC, makeHpBar, drawHp, makeNameSprite } from './models.js';
import * as W from './world.js';

// ---------- État global ----------
export const G = {
  mode: 'title',          // title | explore | combat | dialog
  zone: 1, unlockedVoile: false,
  P: null,                // profil persistant du héros
  entities: [],           // toutes les entités 3D de la carte
  hero: null,             // entité héros
  order: [], orderIdx: 0, turnNum: 1,
  active: null, sel: null, // sort sélectionné
  busy: false, over: false,
  packs: [],              // groupes de monstres [{members:[ids], cx, cz}]
  combatFoes: [], pendingXp: 0, pendingGold: 0, pendingLoot: [],
  quality: 'M',
};
window.__brum = G; // debug/tests

// ---------- Profil ----------
function freshProfile(classId) {
  return {
    classId, name: 'Veilleur', level: 1, xp: 0, gold: 30,
    inv: [{ id: 'potion-seve', qty: 2 }], equip: {},
    quests: {
      coeur: { status: 'todo', kills: 0, dust: 0 },
      chapeaux: { status: 'todo', gathered: 0 },
      carto: { status: 'todo', visited: [] },
    },
    zone: 1, unlockedVoile: false,
    chests: {}, glows: {}, hp: null,
  };
}
// Stats dérivées = base classe + niveau + équipement
export function heroStats() {
  const cls = CLASSES[G.P.classId];
  const lvl = G.P.level;
  const s = {
    hp: cls.hp + (lvl - 1) * 14, pa: cls.pa, pm: cls.pm,
    power: cls.power + (lvl - 1) * 2, dodge: cls.dodge, crit: cls.crit,
    init: cls.init + Math.floor((lvl - 1) / 2), resPhys: cls.resPhys, resElem: cls.resElem,
  };
  for (const slot of Object.keys(G.P.equip)) {
    const it = ITEMS[G.P.equip[slot]];
    if (it && it.bonus) for (const k of Object.keys(it.bonus)) s[k] = (s[k] || 0) + it.bonus[k];
  }
  return s;
}

// ---------- Démarrage ----------
export function newGame(classId) {
  G.P = freshProfile(classId);
  G.zone = 1; G.unlockedVoile = false;
  enterZone(1, true);
}
function enterZone(zone, first = false) {
  G.zone = zone; G.P.zone = zone;
  W.buildMap(zone);
  restoreInteracts();
  spawnAll(first);
  G.mode = 'explore'; G.over = false; G.busy = false; G.sel = null;
  W.clearHL(); W.isoFocus(G.hero.x, G.hero.z);
  refreshPanels(); syncInteract();
}
export function travelZone() {
  if (G.zone === 1) {
    if (!G.P.unlockedVoile) { toast('🔒 Le Voile est scellé. Terminez « Le cœur de la brume ».'); return; }
    saveHeroHp(); enterZone(2); toast('🌌 Vous entrez dans le Voile Profond…');
  } else { saveHeroHp(); enterZone(1); toast('🌿 Retour à la Clairière des Brumes.'); }
}
function saveHeroHp() { if (G.hero && G.hero.alive) G.P.hp = G.hero.hp; }

// ---------- Apparitions ----------
const NPC_SPOTS = [{ id: 'selanire', x: 1, z: 2 }, { id: 'pilpin', x: 3, z: 1 }, { id: 'tombelon', x: 3, z: 3 }];
function packDefs(zone) {
  if (zone === 1) return [
    { cx: 5, cz: 7, list: [{ m: 'mornet' }, { m: 'mornet', corrupted: true }] },
    { cx: 10, cz: 6, list: [{ m: 'cendreux', corrupted: true }, { m: 'luciole' }] },
    { cx: 6, cz: 10, list: [{ m: 'luciole', corrupted: true }, { m: 'mornet' }] },
  ];
  return [
    { cx: 5, cz: 7, list: [{ m: 'mornet' }, { m: 'mornet' }, { m: 'luciole' }] },
    { cx: 10, cz: 6, list: [{ m: 'cendreux' }, { m: 'luciole' }, { m: 'mornet' }] },
    { cx: 6, cz: 10, list: [{ m: 'luciole' }, { m: 'luciole' }, { m: 'cendreux' }] },
  ];
}
function spawnAll(first) {
  // retire anciens meshes
  for (const e of G.entities) if (e.mesh) W.scene.remove(e.mesh);
  G.entities = []; G.packs = [];
  const st = heroStats();
  const hero = {
    id: 'hero', kind: 'hero', team: 'hero', name: 'Vous', emoji: CLASSES[G.P.classId].emoji,
    classId: G.P.classId, x: 2, z: 3, level: G.P.level,
    hp: first ? st.hp : (G.P.hp ?? st.hp), maxHp: st.hp,
    pa: st.pa, pm: st.pm, controlled: true, alive: true, levelScale: 1,
  };
  syncStats(hero);
  G.hero = hero; G.entities.push(hero);
  for (const n of NPC_SPOTS) {
    const e = { id: 'npc-' + n.id, kind: 'npc', team: 'none', npcId: n.id, x: n.x, z: n.z, alive: true, hp: 1, maxHp: 1 };
    G.entities.push(e);
  }
  let k = 0;
  for (const p of packDefs(G.zone)) {
    const members = [];
    for (const s of p.list) {
      const def = MONSTERS[s.m];
      const lvl = G.zone === 2 ? 3 : 1;
      const hp = Math.round(def.hp * (s.corrupted ? 1.3 : 1) * (G.zone === 2 ? 1.8 : 1));
      const e = {
        id: 'foe' + (k++), kind: 'foe', team: 'foe', monId: s.m, corrupted: !!s.corrupted,
        name: (s.corrupted ? 'Corrompu · ' : '') + def.name + (G.zone === 2 ? ' du Voile' : ''),
        emoji: s.corrupted ? '😈' : def.emoji,
        x: clamp(p.cx + rand(-1, 1), 0, W.SIZE - 1), z: clamp(p.cz + rand(-1, 1), 0, W.SIZE - 1),
        hp, maxHp: hp, pa: def.pa, pm: def.pm, level: lvl, alive: true,
        dmg: [def.dmg[0] + (G.zone === 2 ? 6 : 0), def.dmg[1] + (G.zone === 2 ? 6 : 0)],
        controlled: false,
      };
      syncStats(e);
      members.push(e.id); G.entities.push(e);
    }
    G.packs.push({ members, cx: p.cx, cz: p.cz });
  }
  // place les entités (décale si occupé)
  for (const e of G.entities) {
    if (W.tiles[e.x][e.z].entity) {
      outer: for (let r = 1; r < 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const nx = e.x + dx, nz = e.z + dz;
        if (W.inBounds(nx, nz) && !W.tiles[nx][nz].obstacle && !W.tiles[nx][nz].entity && !W.tiles[nx][nz].water) {
          e.x = nx; e.z = nz; break outer;
        }
      }
    }
    W.tiles[e.x][e.z].entity = e;
    e.mesh = e.kind === 'hero' ? buildHero(e.classId)
      : e.kind === 'npc' ? buildNPC(e.npcId)
      : buildMonster(e.monId, e.monId === 'cendreux' ? 1 : 0.95, e.corrupted);
    const { wx, wz } = W.gridToWorld(e.x, e.z);
    e.mesh.position.set(wx, W.topY(e.x, e.z), wz);
    W.scene.add(e.mesh);
    if (e.kind !== 'npc') {
      e.hpBar = makeHpBar(); e.mesh.add(e.hpBar); drawHp(e.hpBar, e.hp, e.maxHp);
      e.nameTag = makeNameSprite(e.emoji + ' ' + e.name); e.mesh.add(e.nameTag);
    }
    e.born = 0;
  }
}
export function syncStats(e) {
  if (e.kind === 'hero') {
    const s = heroStats();
    e.maxHp = s.hp; e.basePa = s.pa; e.basePm = s.pm;
    e.power = s.power; e.dodge = s.dodge; e.crit = s.crit; e.init = s.init;
    e.resPhys = s.resPhys; e.resElem = s.resElem;
    e.hp = clamp(e.hp ?? s.hp, 0, s.hp);
    e.pa = e.basePa; e.pm = e.basePm;
  } else if (e.kind === 'foe' || e.kind === 'ally') {
    const d = e.kind === 'ally' ? { pa: 4, pm: 4, dodge: 10, crit: 10, init: 11, resPhys: 0, resElem: 0, power: 6 }
      : MONSTERS[e.monId];
    e.basePa = d.pa; e.basePm = d.pm; e.pa = d.pa; e.pm = d.pm;
    e.power = d.power ?? 0; e.dodge = d.dodge; e.crit = d.crit; e.init = d.init;
    e.resPhys = d.resPhys ?? 0; e.resElem = d.resElem ?? 0;
  }
}

// ---------- Pathfinding ----------
export function bfsRange(sx, sz, mp) {
  const dist = { [W.key(sx, sz)]: 0 }; const q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.shift(); const d = dist[W.key(x, z)];
    if (d >= mp) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = W.key(nx, nz);
      if (!W.inBounds(nx, nz) || dist[k] !== undefined) continue;
      const t = W.tiles[nx][nz];
      if (t.obstacle || t.water || t.wall) continue;
      if (t.entity && t.entity.alive && t.entity.kind !== 'npc') continue;
      dist[k] = d + 1; q.push([nx, nz]);
    }
  }
  return dist;
}
export function bfsPath(sx, sz, tx, tz, mp = 99) {
  const prev = { [W.key(sx, sz)]: null }; const q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.shift();
    if (x === tx && z === tz) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = W.key(nx, nz);
      if (!W.inBounds(nx, nz) || prev[k] !== undefined) continue;
      const t = W.tiles[nx][nz];
      if (t.obstacle || t.water || t.wall) continue;
      if (t.entity && t.entity.alive && t.entity.kind !== 'npc' && !(nx === tx && nz === tz)) continue;
      const steps = (prev[W.key(x, z)]?.steps ?? 0) + 1;
      if (steps > mp) continue;
      prev[k] = { x, z, steps }; q.push([nx, nz]);
    }
  }
  if (prev[W.key(tx, tz)] === undefined) return null;
  const path = []; let cur = { x: tx, z: tz };
  while (cur) { path.unshift([cur.x, cur.z]); const p = prev[W.key(cur.x, cur.z)]; cur = p ? { x: p.x, z: p.z } : null; }
  return path;
}
export const manh = (ax, az, bx, bz) => Math.abs(ax - bx) + Math.abs(az - bz);
export function lineOfSight(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, steps = Math.max(Math.abs(dx), Math.abs(dz));
  for (let i = 1; i < steps; i++) {
    const x = Math.round(ax + dx * i / steps), z = Math.round(az + dz * i / steps);
    if (W.inBounds(x, z) && (W.tiles[x][z].obstacle || W.tiles[x][z].wall) && !W.tiles[x][z].water) {
      if (W.tiles[x][z].tree) continue; // les arbres ne bloquent pas la vue
      return false;
    }
  }
  return true;
}
function adjacentFoe(e) {
  return G.entities.some(o => o.alive && o.team === 'foe' && G.mode === 'combat' && manh(e.x, e.z, o.x, o.z) === 1);
}

// ---------- Déplacement ----------
export function moveEntity(e, tx, tz) {
  W.tiles[e.x][e.z].entity = null;
  e.x = tx; e.z = tz; W.tiles[tx][tz].entity = e;
  const { wx, wz } = W.gridToWorld(tx, tz);
  e.targetPos = new THREE.Vector3(wx, W.topY(tx, tz), wz);
  e.mesh.lookAt(wx, e.mesh.position.y, wz);
}
export async function walkPath(e, path, onStep) {
  for (let i = 1; i < path.length; i++) {
    const [nx, nz] = path[i];
    const t = W.tiles[nx][nz];
    if (!W.inBounds(nx, nz) || t.obstacle || t.water || t.wall) break;
    if (t.entity && t.entity.alive && t.entity.kind !== 'npc') break;
    let cost = 1;
    if (G.mode === 'combat' && adjacentFoe(e)) { cost = 2; } // tacle : quitter un contact coûte +1 PM
    if (e.pm < cost) { uiLog('⛔ Plus assez de PM' + (cost === 2 ? ' (tacle !)' : '') + '.'); break; }
    e.pm -= cost;
    moveEntity(e, nx, nz);
    sfx.move();
    if (onStep) onStep();
    await wait(200);
    checkTrap(e); checkWallBurn(e);
    if (!e.alive) break;
    if (G.mode === 'explore') checkExploreTriggers(e);
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// pièges : seuls les Mornets en posent (ronces de brume)
function checkTrap(e) {
  const t = W.tiles[e.x][e.z];
  if (t.trap && e.team === 'foe' && t.trap.team === 'hero') {
    damage(e, rand(8, 14), 'piège de ronces', { elem: true });
    uiLog(`🪤 Le piège de ronces mord ${e.name} !`);
    t.trap = null;
  }
}
function checkWallBurn(e) {
  const t = W.tiles[e.x][e.z];
  if (t.wall) { damage(e, t.wall.dmg, 'braises', { elem: true }); uiLog(`🔥 ${e.name} traverse les braises !`); }
}

// ---------- Déclencheurs d'exploration ----------
function checkExploreTriggers(e) {
  if (e !== G.hero || G.mode !== 'explore') return;
  // checkpoints cartographe
  const marks = [];
  if (e.x === 8 && e.z === 5) marks.push('pont');
  if (manh(e.x, e.z, 10, 10) <= 1) marks.push('donjon');
  if (manh(e.x, e.z, 5, 2) <= 1) marks.push('pierre');
  for (const m of marks) questVisit(m);
}

// ---------- Formule de dégâts : esquive, critique, résistances ----------
export function damage(target, base, label = '', opt = {}) {
  if (!target.alive) return 0;
  // esquive
  let ddg = target.dodge + buffVal(target, 'dodge');
  if (chance(ddg / 100)) {
    floatAt(target, 'ESQUIVE', 'float-miss'); sfx.miss();
    uiLog(`💨 ${target.name} esquive !`);
    return 0;
  }
  let amt = base;
  if (opt.caster) { // puissance + marque + aura gardienne
    amt *= 1 + (opt.caster.power || 0) / 50;
    amt *= 1 + debuffVal(target, 'mark');
    if (guardAura(target)) amt *= 0.7;
  }
  const res = (opt.elem ? target.resElem : target.resPhys) + buffVal(target, 'armor');
  amt *= 1 - clamp(res, -50, 75) / 100;
  if (hasShield(target)) amt *= target.bastion ? 0.3 : 0.5;
  if (opt.canCrit !== false && opt.caster && chance(((opt.caster.crit || 0)) / 100)) {
    amt *= 1.5; opt.wasCrit = true;
  }
  amt = Math.max(1, Math.round(amt));
  target.hp -= amt;
  floatAt(target, '-' + amt, opt.wasCrit ? 'float-crit' : 'float-hurt');
  target.mesh.userData.hitT = 0.35;
  drawHp(target.hpBar, target.hp, target.maxHp, hasShield(target));
  if (opt.wasCrit) sfx.crit(); else sfx.hit();
  W.burst(target.mesh.position.x, 1.5, target.mesh.position.z, opt.elem ? 0xff9d3d : 0xfff59d, opt.wasCrit ? 18 : 10);
  if (target.hp <= 0) {
    target.hp = 0; target.alive = false;
    drawHp(target.hpBar, 0, target.maxHp, false);
    target.mesh.userData.dying = true;
    W.tiles[target.x][target.z].entity = null;
    uiLog(`💀 <b>${target.name}</b> s’effondre ${label}…`);
    W.leafBurst(target.mesh.position.x, 1.2, target.mesh.position.z, 10);
    onKill(target, opt.caster);
  } else if (!opt.silent) {
    uiLog(`${target.emoji} <b>${target.name}</b> perd <b>${amt}</b> PV${opt.wasCrit ? ' <b>CRITIQUE !</b>' : ''} ${label}`);
  }
  refreshPanels();
  return amt;
}
function guardAura(target) { // Cendreux ami adjacent ?
  return G.entities.some(o => o.alive && o.kind === 'foe' && o.monId === 'cendreux' && o.team === target.team && o !== target && manh(o.x, o.z, target.x, target.z) === 1);
}
export function healEnt(target, amount, quiet = false) {
  if (!target.alive) return 0;
  const real = Math.min(amount, target.maxHp - target.hp);
  target.hp += real;
  floatAt(target, '+' + real, 'float-heal');
  drawHp(target.hpBar, target.hp, target.maxHp, hasShield(target));
  sfx.heal();
  W.burst(target.mesh.position.x, 1.6, target.mesh.position.z, 0x5dff8f, 12);
  if (!quiet) uiLog(`💚 <b>${target.name}</b> récupère <b>${real}</b> PV`);
  refreshPanels();
  return real;
}
// ---------- Buffs / debuffs / dots ----------
function buffsOf(e) { return e.buffs || (e.buffs = []); }
function buffVal(e, type) { return buffsOf(e).filter((b) => b.type === type).reduce((a, b) => a + b.value, 0); }
function debuffVal(e, type) { return (e.debuffs || []).filter((b) => b.type === type).reduce((a, b) => a + b.value, 0); }
function hasShield(e) { return buffsOf(e).some((b) => b.type === 'shield'); }
export function addBuff(e, buff, label) {
  const arr = buffsOf(e); const ex = arr.find((b) => b.type === buff.type);
  if (ex) { ex.turns = buff.turns; ex.value = buff.value; } else arr.push({ ...buff });
  floatAt(e, label, 'float-buff'); sfx.buff();
  uiLog(`${e.emoji} <b>${e.name}</b> : <b>${label}</b> (${buff.turns} tours)`);
  refreshPanels();
}
export function addDebuff(e, d, label) {
  e.debuffs ||= []; const ex = e.debuffs.find((b) => b.type === d.type);
  if (ex) { ex.turns = d.turns; ex.value = d.value; } else e.debuffs.push({ ...d });
  floatAt(e, label, 'float-info');
  uiLog(`🎯 <b>${e.name}</b> : ${label}`);
}
export function addDot(e, d) { e.dots ||= []; e.dots.push({ ...d }); }
export function cleanse(e) { e.dots = []; e.debuffs = []; uiLog(`🧴 <b>${e.name}</b> est purifié.`); }
export function buffTxt(e) {
  const icons = { power: '⚔️', dodge: '🍃', armor: '🪵', shield: '🔰', regen: '🌿', pm: '👣' };
  return buffsOf(e).map((b) => `${icons[b.type] || '✨'}${b.turns}t`).join(' ');
}
function tickDots(e) {
  if (!e.dots) return;
  for (const d of [...e.dots]) {
    damage(e, d.dmg, d.label || '', { silent: true });
    uiLog(`${d.emoji || '🔥'} <b>${e.name}</b> subit <b>${d.dmg}</b> (${d.label || 'état'})`);
    if (--d.turns <= 0) e.dots.splice(e.dots.indexOf(d), 1);
    if (!e.alive) return;
  }
}
function tickRegen(e) {
  const r = buffsOf(e).find((b) => b.type === 'regen');
  if (r && e.hp < e.maxHp) healEnt(e, Math.min(r.value, e.maxHp - e.hp), true);
}
function decayStatuses() {
  for (const e of G.entities) {
    if (!e.alive) continue;
    for (const arr of [buffsOf(e), e.debuffs || []]) for (let i = arr.length - 1; i >= 0; i--) {
      if (--arr[i].turns <= 0) arr.splice(i, 1);
    }
    if (e.taunt && --e.taunt.turns <= 0) e.taunt = null;
  }
  // murs de braises
  for (let x = 0; x < W.SIZE; x++) for (let z = 0; z < W.SIZE; z++) {
    const t = W.tiles[x][z];
    if (t.wall && --t.wall.turns <= 0) { W.scene.remove(t.wall.mesh); t.wall = null; }
  }
}

// ---------- Lancement de sort (moteur générique) ----------
export function castSpell(caster, spell, tx, tz) {
  if (caster.pa < spell.pa) { uiLog('⛔ Pas assez de ✦.'); return false; }
  const dist = manh(caster.x, caster.z, tx, tz);
  const [mn, mx] = spell.range;
  if (dist < mn || dist > mx) { uiLog(`⛔ Portée ${mn}-${mx} requise.`); return false; }
  if (spell.line && !(tx === caster.x || tz === caster.z)) { uiLog('⛔ En ligne droite uniquement.'); return false; }
  if (!W.lineOfSight(caster.x, caster.z, tx, tz)) { uiLog('⛔ Vue bloquée !'); return false; }
  const target = W.inBounds(tx, tz) ? W.tiles[tx][tz].entity : null;
  const from = caster.mesh.position.clone();
  const { wx, wz } = W.gridToWorld(tx, tz);
  const to = new THREE.Vector3(wx, 0, wz);
  const face = () => caster.mesh.lookAt(wx, caster.mesh.position.y, wz);
  const payAndAnim = () => { caster.pa -= spell.pa; caster.mesh.userData.atkT = 0.45; };

  if (spell.kind === 'dash') { // Pas lunaire : case libre + PM
    if (target && target.alive) { uiLog('⛔ Case occupée.'); return false; }
    payAndAnim(); face();
    W.ringFx(from.x, from.z, 0x9fe8ff, 2.5, 0.5);
    moveEntity(caster, tx, tz);
    caster.pm += 2;
    W.starBurst(wx, 1.2, wz, 8);
    uiLog(`🌙 <b>${caster.name}</b> glisse d’un pas lunaire (+2 👣) !`);
    afterAction(caster); return true;
  }
  if (spell.kind === 'summon') { // Esprit gardien
    if (G.entities.some((e) => e.alive && e.kind === 'ally')) { uiLog('⛔ Mirette est déjà là !'); return false; }
    if (target && target.alive) { uiLog('⛔ Case occupée.'); return false; }
    payAndAnim(); face();
    const sp = {
      id: 'ally0', kind: 'ally', team: 'hero', name: 'Mirette', emoji: '💡',
      x: tx, z: tz, hp: 40, maxHp: 40, pa: 4, pm: 4, alive: true, controlled: false,
      spells: [{ id: 'griffe', name: 'Griffe', pa: 2, range: [1, 1], kind: 'dmg', dmg: [8, 14], melee: true }],
    };
    syncStats(sp);
    return summonAlly(caster, spell, sp, tx, tz);
  }
  if (spell.kind === 'buff' || spell.kind === 'shield' || spell.kind === 'bastion') {
    if (!target || !target.alive || target.team !== 'hero') { uiLog('⛔ Visez un allié.'); return false; }
    payAndAnim(); face();
    playAnim(spell.anim, tx, tz, 0xffd94a);
    G.busy = true;
    setTimeout(() => {
      if (spell.kind === 'bastion') { target.bastion = true; addBuff(target, { type: 'shield', turns: 2, value: 0 }, 'Bastion 🧱'); healEnt(target, rand(spell.heal[0], spell.heal[1]), true); }
      else if (spell.kind === 'shield') addBuff(target, { type: 'shield', turns: 2, value: 0 }, 'Éclat 🔰');
      else addBuff(target, { ...spell.buff }, spell.name);
      G.busy = false; afterAction(caster);
    }, 380);
    return true;
  }
  if (spell.kind === 'heal') {
    if (!target || !target.alive || target.team !== 'hero') { uiLog('⛔ Visez un allié.'); return false; }
    payAndAnim(); face(); playAnim('heal', tx, tz);
    G.busy = true;
    W.shootFx(from, to, 0x5dff8f, () => {
      healEnt(target, rand(spell.dmg[0], spell.dmg[1]));
      if (spell.selfHalf && caster !== target && caster.alive) healEnt(caster, Math.round(target.hp * 0 + rand(10, 15)), true);
      if (spell.cleanse) cleanse(target);
      G.busy = false; afterAction(caster);
    });
    return true;
  }
  if (spell.kind === 'debuff') {
    if (!target || !target.alive || target.team !== 'foe') { uiLog('⛔ Visez un ennemi.'); return false; }
    payAndAnim(); face(); playAnim('mark', tx, tz);
    G.busy = true;
    W.shootFx(from, to, 0xc99dff, () => {
      addDebuff(target, { ...spell.debuff }, 'Marqué 🎯');
      G.busy = false; afterAction(caster);
    });
    return true;
  }
  if (spell.kind === 'taunt') {
    payAndAnim(); face(); playAnim('shout', caster.x, caster.z);
    let n = 0;
    for (const e of G.entities) if (e.alive && e.team === 'foe' && manh(caster.x, caster.z, e.x, e.z) <= 6) { e.taunt = { id: caster.id, turns: spell.tauntTurns }; n++; }
    uiLog(`📯 <b>${caster.name}</b> provoque ${n} ennemi(s) !`);
    afterAction(caster); return true;
  }
  if (spell.kind === 'nova') {
    payAndAnim();
    playAnim('nova', caster.x, caster.z);
    const hits = G.entities.filter((e) => e.alive && e.team !== caster.team && manh(e.x, e.z, caster.x, caster.z) === 1);
    for (const e of hits) {
      damage(e, Math.round(rand(spell.dmg[0], spell.dmg[1]) * 1), `(${spell.name})`, { caster });
      // repousse
      const dx = Math.sign(e.x - caster.x), dz = Math.sign(e.z - caster.z);
      const nx = e.x + dx, nz = e.z + dz;
      if (W.inBounds(nx, nz) && !W.tiles[nx][nz].obstacle && !W.tiles[nx][nz].entity && !W.tiles[nx][nz].water) moveEntity(e, nx, nz);
    }
    if (!hits.length) uiLog(`💨 <b>${spell.name}</b> soulève de la poussière…`);
    afterAction(caster); return true;
  }
  if (spell.kind === 'wall') {
    payAndAnim(); face(); playAnim('wall', tx, tz);
    const cells = [];
    const tryCell = (cx, cz) => {
      if (!W.inBounds(cx, cz)) return;
      const t = W.tiles[cx][cz];
      if (t.obstacle || t.water || t.wall) return;
      if (t.entity && t.entity.alive) return; // jamais sur un occupant
      cells.push([cx, cz]);
    };
    tryCell(tx, tz);
    // perpendiculaire à la visée
    const horiz = tz === caster.z;
    for (const o of [-1, 1]) tryCell(horiz ? tx : tx + o, horiz ? tz + o : tz);
    if (!cells.length) { uiLog('⛔ Aucune case libre pour le mur.'); caster.pa += spell.pa; return false; }
    for (const [cx, cz] of cells) { W.wallFx(cx, cz, spell.wallTurns); W.tiles[cx][cz].wall.dmg = spell.wallDmg; }
    uiLog(`🧱 <b>${spell.name}</b> : un mur de braises se dresse !`);
    afterAction(caster); return true;
  }
  if (spell.kind === 'swap') {
    if (!target || !target.alive || target.team !== 'hero' || target === caster) { uiLog('⛔ Visez un allié (Mirette adore ça).'); return false; }
    payAndAnim();
    playAnim('swap', tx, tz);
    const ax = caster.x, az = caster.z;
    W.tiles[ax][az].entity = null; W.tiles[tx][tz].entity = null;
    caster.x = tx; caster.z = tz; target.x = ax; target.z = az;
    W.tiles[tx][tz].entity = caster; W.tiles[ax][az].entity = target;
    const { wx: w1, wz: z1 } = W.gridToWorld(tx, tz); caster.targetPos = new THREE.Vector3(w1, W.topY(tx, tz), z1);
    const { wx: w2, wz: z2 } = W.gridToWorld(ax, az); target.targetPos = new THREE.Vector3(w2, W.topY(ax, az), z2);
    healEnt(caster, rand(spell.heal[0], spell.heal[1]), true);
    healEnt(target, rand(spell.heal[0], spell.heal[1]), true);
    uiLog(`🔀 <b>${caster.name}</b> échange son âme de place avec <b>${target.name}</b> !`);
    afterAction(caster); return true;
  }
  if (spell.kind === 'aoe' || spell.kind === 'aoe-slow') {
    payAndAnim(); face();
    playAnim(spell.anim, tx, tz);
    G.busy = true;
    const r = spell.radius || 1;
    const hits = G.entities.filter((e) => e.alive && e.team !== caster.team && Math.abs(e.x - tx) <= r && Math.abs(e.z - tz) <= r);
    setTimeout(() => {
      for (const e of hits) {
        damage(e, rand(spell.dmg[0], spell.dmg[1]), `(${spell.name})`, { caster, elem: true });
        if (spell.slow && e.alive) { e.pm = Math.max(0, e.pm - spell.slow); uiLog(`🌫️ ${e.name} est ralenti (−${spell.slow} 👣) !`); }
      }
      if (!hits.length) uiLog(`💨 <b>${spell.name}</b> dans le vide…`);
      G.busy = false; afterAction(caster);
    }, 450);
    return true;
  }
  // dégâts simples (projectile)
  if (!target || !target.alive || target.team === caster.team) {
    if (spell.aoeOnly) return false;
    if (!target || target.team === caster.team) { uiLog(target ? '⛔ C’est un allié !' : '⛔ Aucune cible.'); return false; }
  }
  payAndAnim(); face();
  G.busy = true;
  const col = caster.team === 'hero' ? classColor(caster) : 0xb08aff;
  W.shootFx(from, to, col, () => {
    if (spell.kind === 'burn') {
      playAnim('fireball', tx, tz);
      damage(target, rand(spell.dmg[0], spell.dmg[1]), `(${spell.name})`, { caster, elem: true });
      if (target.alive) { addDot(target, { ...spell.burn, label: 'brûlure', emoji: '🔥' }); uiLog(`🔥 ${target.name} brûle !`); }
    } else {
      if (spell.anim === 'arrow' || !spell.anim) W.burst(wx, 1.2, wz, col, 10);
      damage(target, rand(spell.dmg[0], spell.dmg[1]), `(${spell.name})`, { caster, elem: spell.anim === 'spark' });
      if (spell.kind === 'slowHit' && target.alive) { target.pm = Math.max(0, target.pm - 2); }
    }
    G.busy = false; afterAction(caster);
  }, spell.anim === 'arrow' ? 'arrow' : 'bolt');
  return true;
}
function await0() { return null; }
void await0;
function summonAlly(caster, spell, sp, tx, tz) {
  playAnim('summon', tx, tz);
  G.busy = true;
  setTimeout(() => {
    sp.mesh = buildSpirit(0.9);
    const { wx, wz } = W.gridToWorld(tx, tz);
    sp.mesh.position.set(wx, W.topY(tx, tz), wz);
    W.scene.add(sp.mesh);
    sp.hpBar = makeHpBar(); sp.mesh.add(sp.hpBar); drawHp(sp.hpBar, sp.hp, sp.maxHp);
    sp.nameTag = makeNameSprite('💡 Mirette'); sp.mesh.add(sp.nameTag);
    sp.born = 0;
    G.entities.push(sp);
    W.tiles[tx][tz].entity = sp;
    G.order.splice(G.orderIdx + 1, 0, sp); // agit juste après
    uiLog(`💡 <b>Mirette</b> apparaît dans un tourbillon d’étincelles !`);
    G.busy = false; afterAction(caster);
  }, 420);
  return true;
}
function classColor(caster) {
  return { eclaireuse: 0x7df0ff, arcaniste: 0xff9d3d, gardien: 0xa5f0b8, tisseur: 0xc99dff }[caster.classId] || 0xffffff;
}
// ---------- Animations de sorts (lumière, feuilles, étoiles : rien de violent) ----------
function playAnim(anim, tx, tz, color = 0xffd94a) {
  const { wx, wz } = W.gridToWorld(tx, tz); const y = W.topY(tx, tz);
  switch (anim) {
    case 'slash': sfx.slash(); W.ringFx(wx, y + 0.2, wz, 0xffffff, 1.6, 0.35); W.leafBurst(wx, 1.2, wz, 8); W.shake(0.2); break;
    case 'arrow': W.burst(wx, 1.4, wz, 0x7df0ff, 5); break;
    case 'meteor':
      sfx.boom(); W.shake(0.7); W.flashFx(wx, 3, wz, 0xffd94a, 55, 0.5);
      W.pillarFx(wx, y, wz, 0xffd94a, 6, 0.6); W.ringFx(wx, y + 0.15, wz, 0xff8b4d, 4.5, 0.7);
      W.starBurst(wx, 3, wz, 14); W.burst(wx, 0.8, wz, 0x8a6a55, 10); break;
    case 'fireball':
      sfx.boom(); W.shake(0.45); W.flashFx(wx, 2, wz, 0xff6b2d, 45, 0.45);
      W.ringFx(wx, y + 0.15, wz, 0xff9d3d, 3.5, 0.6); W.burst(wx, 1.2, wz, 0xff6b2d, 20); W.burst(wx, 1.8, wz, 0x555555, 8); break;
    case 'spark': W.starBurst(wx, 1.4, wz, 7); W.flashFx(wx, 1.6, wz, 0xfff59d, 20, 0.3); break;
    case 'heal': sfx.heal(); W.pillarFx(wx, y, wz, 0x5dff8f, 4.5, 0.9); W.ringFx(wx, y + 0.12, wz, 0x5dff8f, 3, 0.8); W.leafBurst(wx, 1.4, wz, 10); break;
    case 'buff': W.pillarFx(wx, y, wz, color, 5.5, 1.0); W.ringFx(wx, y + 0.12, wz, color, 3.2, 0.8); W.flashFx(wx, 2.4, wz, color, 32, 0.6); W.starBurst(wx, 1.6, wz, 8); break;
    case 'shield': W.ringFx(wx, y + 0.12, wz, 0x9fd8ff, 2.8, 0.8); W.pillarFx(wx, y, wz, 0x9fd8ff, 3.5, 0.7); W.flashFx(wx, 2, wz, 0x9fd8ff, 28, 0.5); break;
    case 'mark': W.ringFx(wx, y + 0.12, wz, 0xc99dff, 2.4, 0.7); W.burst(wx, 2.2, wz, 0xc99dff, 8); break;
    case 'mist': W.pillarFx(wx, y, wz, 0xbcd8ff, 3, 1.0); W.ringFx(wx, y + 0.12, wz, 0xbcd8ff, 3.4, 0.9); break;
    case 'wall': sfx.boom(); W.pillarFx(wx, y, wz, 0xff6b2d, 4, 0.8); W.ringFx(wx, y + 0.12, wz, 0xff6b2d, 3, 0.6); W.flashFx(wx, 2, wz, 0xff6b2d, 35, 0.5); break;
    case 'shout': W.ringFx(wx, y + 0.2, wz, 0xffd94a, 4, 0.6); W.ringFx(wx, y + 0.9, wz, 0xffffff, 3, 0.5); sfx.buff(); break;
    case 'nova': sfx.boom(); W.shake(0.5); W.ringFx(wx, y + 0.15, wz, 0xa5f0b8, 4.5, 0.6); W.burst(wx, 0.6, wz, 0x8a6a55, 16); break;
    case 'summon': W.pillarFx(wx, y, wz, 0xc99dff, 5, 0.9); W.ringFx(wx, y + 0.12, wz, 0xc99dff, 3, 0.8); W.starBurst(wx, 1.6, wz, 12); break;
    case 'swap': W.ringFx(wx, y + 0.12, wz, 0x9fe8ff, 2.6, 0.6); W.starBurst(wx, 1.4, wz, 8); break;
    case 'dash': W.ringFx(wx, y + 0.12, wz, 0x9fe8ff, 2.2, 0.5); W.starBurst(wx, 1.0, wz, 8); break;
    default: W.burst(wx, 1.2, wz, color, 10);
  }
}

// ---------- Tours ----------
export function startCombat(foes) {
  if (G.mode === 'combat') return;
  G.mode = 'combat'; G.sel = null; G.over = false;
  syncInteract();
  G.combatFoes = foes;
  G.pendingXp = 0; G.pendingGold = 0; G.pendingLoot = [];
  const parts = [G.hero, ...G.entities.filter((e) => e.kind === 'ally' && e.alive), ...foes];
  G.order = parts.sort((a, b) => (b.init + rand(0, 6)) - (a.init + rand(0, 6)));
  G.orderIdx = 0; G.turnNum = 1;
  uiLog(`⚔️ <b>Combat !</b> ${foes.map((f) => f.name).join(', ')}`);
  toast('⚔️ Combat !');
  startTurn();
}
function startTurn() {
  if (G.over) return;
  let guard = 0;
  while (!G.order[G.orderIdx].alive && guard++ < 20) G.orderIdx = (G.orderIdx + 1) % G.order.length;
  const e = G.order[G.orderIdx];
  e.pa = e.basePa + buffVal(e, 'pa'); e.pm = e.basePm + buffVal(e, 'pm');
  tickDots(e);
  if (!e.alive) return nextTurn();
  tickRegen(e);
  G.active = e; G.sel = null;
  refreshPanels(); showHints();
  W.isoFocus(e.x, e.z);
  uiLog(`—— <b>Tour ${G.turnNum}</b> : ${e.emoji} ${e.name} ——`);
  if (e.team === 'foe' || (e.kind === 'ally')) { G.busy = true; setTimeout(() => aiPlay(e), 650); }
  else G.busy = false;
}
export function endTurn() {
  if (G.mode !== 'combat' || G.over || G.busy) return;
  if (G.active.team !== 'hero' || !G.active.controlled) return;
  G.busy = true; G.sel = null; W.clearHL();
  uiLog(`⏭ ${G.active.name} termine son tour.`);
  nextTurn();
}
function nextTurn() {
  G.orderIdx = (G.orderIdx + 1) % G.order.length;
  if (G.orderIdx === 0) { G.turnNum++; decayStatuses(); }
  if (checkCombatEnd()) return;
  setTimeout(startTurn, 320);
}
function checkCombatEnd() {
  const foesAlive = G.combatFoes.some((f) => f.alive);
  if (!G.hero.alive) { // défaite
    G.over = true; G.mode = 'combat'; G.hero.mesh.userData.loseT = 1;
    sfx.lose();
    setTimeout(() => showEnd(false), 1200);
    return true;
  }
  if (!foesAlive) { // victoire
    G.over = true;
    G.hero.mesh.userData.winT = 1;
    sfx.win();
    applyVictory();
    return true;
  }
  return false;
}
function onKill(victim, caster) {
  if (victim.team === 'foe' && G.mode === 'combat') {
    const def = MONSTERS[victim.monId];
    G.pendingXp += Math.round(def.xp * (victim.level > 1 ? 2.2 : 1) * (victim.corrupted ? 1.5 : 1));
    G.pendingGold += rand(def.gold[0], def.gold[1]) * (victim.level > 1 ? 2 : 1);
    for (const drop of def.loot) {
      let ch = drop.chance * (victim.monId === 'luciole' ? 1.4 : 1);
      if (chance(ch)) G.pendingLoot.push(drop.item);
    }
    if (victim.corrupted) { // quête : poussière d’étoile garantie
      G.pendingLoot.push('poussiere-etoile');
      G.P.quests.coeur.kills++;
      uiLog(`😈 Créature corrompue vaincue ! (${G.P.quests.coeur.kills}/3)`);
      sfx.quest();
    }
    W.ringFx(victim.mesh.position.x, 0.2, victim.mesh.position.z, 0xffd94a, 2.5, 0.6);
  }
}
function applyVictory() {
  const P = G.P;
  P.xp += G.pendingXp; P.gold += G.pendingGold;
  for (const id of G.pendingLoot) addItem(id, 1, true);
  if (G.pendingLoot.includes('poussiere-etoile')) P.quests.coeur.dust++;
  // montée de niveau (plusieurs possibles)
  let ups = 0;
  while (P.xp >= P.level * 100) { P.xp -= P.level * 100; P.level++; ups++; }
  if (ups) {
    const s = heroStats();
    G.hero.maxHp = s.hp; G.hero.hp = s.hp; syncStats(G.hero);
    drawHp(G.hero.hpBar, G.hero.hp, G.hero.maxHp);
    W.pillarFx(G.hero.mesh.position.x, 0, G.hero.mesh.position.z, 0xffd94a, 6, 1.0);
    uiLog(`🌟 <b>Niveau ${P.level} !</b> PV et puissance augmentés.`);
    sfx.quest();
  }
  checkQuestProgress();
  setTimeout(() => showEnd(true, ups), 1100);
}

// ---------- Après l’écran de fin : nettoyage / retour au camp ----------
export function afterEndPanel() {
  if (G.hero.alive) { // victoire : on retire les corps, on repart explorer
    for (const f of G.combatFoes) {
      if (f.mesh) W.scene.remove(f.mesh);
      G.entities.splice(G.entities.indexOf(f), 1);
    }
    G.combatFoes = [];
    // Mirette survit et continue de nous suivre
    G.mode = 'explore'; G.over = false; G.busy = false; G.sel = null;
    W.clearHL();
    uiLog('🌿 La clairière respire à nouveau…');
  } else { // défaite : réveil au camp, la meute se reforme
    const hx = 2, hz = 3;
    if (W.tiles[G.hero.x][G.hero.z].entity === G.hero) W.tiles[G.hero.x][G.hero.z].entity = null;
    G.hero.x = hx; G.hero.z = hz;
    G.hero.hp = G.hero.maxHp; G.hero.alive = true;
    G.hero.mesh.rotation.x = 0; G.hero.mesh.scale.setScalar(1);
    const { wx, wz } = W.gridToWorld(hx, hz);
    G.hero.mesh.position.set(wx, W.topY(hx, hz), wz);
    W.tiles[hx][hz].entity = G.hero;
    drawHp(G.hero.hpBar, G.hero.hp, G.hero.maxHp);
    for (const f of G.combatFoes) { // les monstres reprennent des forces
      if (!f.alive) {
        f.alive = true; f.hp = f.maxHp;
        f.mesh.rotation.x = 0; f.mesh.scale.setScalar(1); f.mesh.visible = true;
        if (!W.tiles[f.x][f.z].entity) W.tiles[f.x][f.z].entity = f;
        drawHp(f.hpBar, f.hp, f.maxHp);
      }
    }
    G.mode = 'explore'; G.over = false; G.busy = false; G.sel = null;
    W.clearHL(); W.isoFocus(hx, hz);
    uiLog('🏕️ Vous vous réveillez au camp. Sélanire hausse un sourcil.');
  }
  syncInteract();
  refreshPanels();
}
async function aiPlay(e) {
  if (G.over || !e.alive) return nextTurn();
  await wait(350);
  const foes = G.entities.filter((o) => o.alive && o.team !== e.team && (o.kind === 'hero' || o.kind === 'ally'));
  if (!foes.length) return nextTurn();
  // provocation : vise le provocateur
  const taunted = e.taunt && G.entities.find((o) => o.id === e.taunt.id && o.alive);
  foes.sort((a, b) => manh(e.x, e.z, a.x, a.z) - manh(e.x, e.z, b.x, b.z));
  const prey = taunted || foes[0];
  const def = e.kind === 'ally' ? null : MONSTERS[e.monId];
  const minR = def ? def.minR : 1, maxR = def ? def.maxR : 1;
  const ai = def ? def.ai : 'ally';
  const d = () => manh(e.x, e.z, prey.x, prey.z);

  if (ai === 'skirmish') { // Mornet : garde ses distances
    if (d() < minR) await aiFlee(e, prey, 4);
    else if (d() <= maxR && W.lineOfSight(e.x, e.z, prey.x, prey.z)) await aiShoot(e, prey);
    else { await aiApproach(e, prey, maxR); if (d() <= maxR && d() >= minR && e.pa >= 3) await aiShoot(e, prey); }
  } else if (ai === 'tank') { // Cendreux : avance et cogne
    if (d() <= 1) await aiStrike(e, prey);
    else { await aiApproach(e, prey, 1); if (d() <= 1 && e.pa >= 3) await aiStrike(e, prey); }
  } else if (ai === 'hitrun') { // Luciole : mord puis fuit
    if (d() > 1) await aiApproach(e, prey, 1);
    if (d() <= 1 && e.pa >= 3) await aiStrike(e, prey);
    if (e.alive && e.pm > 0) await aiFlee(e, prey, 2);
  } else { // Mirette (alliée) : fonce et griffe
    if (d() > 1) await aiApproach(e, prey, 1);
    if (d() <= 1 && e.pa >= 2) await aiStrike(e, prey, 2);
  }
  await wait(250);
  nextTurn();
}
async function aiShoot(e, prey) {
  if (e.pa < 3) return;
  e.pa -= 3; e.mesh.lookAt(prey.mesh.position.x, e.mesh.position.y, prey.mesh.position.z);
  e.mesh.userData.atkT = 0.45;
  const from = e.mesh.position.clone(), to = prey.mesh.position.clone();
  await new Promise((res) => W.shootFx(from, to, 0xb08aff, () => {
    damage(prey, rand(e.dmg[0], e.dmg[1]), '(dard de brume)', { caster: e });
    res();
  }));
}
async function aiStrike(e, prey, cost = 3) {
  if (e.pa < cost) return;
  e.pa -= cost; e.mesh.lookAt(prey.mesh.position.x, e.mesh.position.y, prey.mesh.position.z);
  e.mesh.userData.atkT = 0.45;
  await wait(280);
  W.burst(prey.mesh.position.x, 1.2, prey.mesh.position.z, 0xff8a7a, 10);
  damage(prey, rand(e.dmg[0], e.dmg[1]), `(${e.name})`, { caster: e });
}
async function aiApproach(e, prey, want) {
  const reach = bfsRange(e.x, e.z, e.pm);
  let best = null, bd = manh(e.x, e.z, prey.x, prey.z);
  for (const k of Object.keys(reach)) {
    const [x, z] = k.split(',').map(Number);
    if (x === e.x && z === e.z) continue;
    const dd = manh(x, z, prey.x, prey.z);
    if (dd < bd && dd >= want - 1) { bd = dd; best = [x, z]; }
  }
  if (!best) { // sinon : la case qui rapproche le plus
    for (const k of Object.keys(reach)) {
      const [x, z] = k.split(',').map(Number);
      const dd = manh(x, z, prey.x, prey.z);
      if (dd < bd) { bd = dd; best = [x, z]; }
    }
  }
  if (best) {
    const path = bfsPath(e.x, e.z, best[0], best[1], e.pm);
    if (path) for (let i = 1; i < path.length && e.pm > 0; i++) {
      const [nx, nz] = path[i];
      if (W.tiles[nx][nz].entity) break;
      e.pm--; moveEntity(e, nx, nz); await wait(190);
    }
  }
}
async function aiFlee(e, prey, want) {
  const reach = bfsRange(e.x, e.z, e.pm);
  let best = null, bd = manh(e.x, e.z, prey.x, prey.z);
  for (const k of Object.keys(reach)) {
    const [x, z] = k.split(',').map(Number);
    const dd = manh(x, z, prey.x, prey.z);
    if (dd > bd && dd <= want + 2) { bd = dd; best = [x, z]; }
  }
  if (best) {
    const path = bfsPath(e.x, e.z, best[0], best[1], e.pm);
    if (path) for (let i = 1; i < path.length && e.pm > 0; i++) {
      const [nx, nz] = path[i];
      if (W.tiles[nx][nz].entity) break;
      e.pm--; moveEntity(e, nx, nz); await wait(190);
    }
  }
}

// ---------- Surlignages tactiques ----------
export function showHints() {
  W.clearHL();
  if (G.mode !== 'combat' || !G.active || !G.active.alive || G.over) return;
  const e = G.active;
  if (e.team !== 'hero' || !e.controlled) return;
  if (e.pm > 0) for (const k of Object.keys(bfsRange(e.x, e.z, e.pm))) {
    const [x, z] = k.split(',').map(Number);
    if (x !== e.x || z !== e.z) W.setHL(x, z, 0x3aa0ff, 0.5);
  }
  W.setHL(e.x, e.z, 0x5be38a, 0.35);
  if (G.sel) {
    const s = G.sel;
    for (let x = 0; x < W.SIZE; x++) for (let z = 0; z < W.SIZE; z++) {
      const dist = manh(e.x, e.z, x, z);
      if (dist < s.range[0] || dist > s.range[1]) continue;
      if (s.line && !(x === e.x || z === e.z)) continue;
      if (s.melee && dist !== 1) continue;
      if (!W.lineOfSight(e.x, e.z, x, z)) continue;
      const occ = W.tiles[x][z].entity;
      let ok = false;
      if (s.kind === 'heal' || s.kind === 'shield' || s.kind === 'buff') ok = occ && occ.alive && occ.team === 'hero';
      else if (s.kind === 'summon' || s.kind === 'dash') ok = !occ || !occ.alive;
      else if (s.kind === 'wall' || s.kind === 'aoe' || s.kind === 'aoe-slow') ok = true;
      else if (s.kind === 'swap') ok = occ && occ.alive && occ.team === 'hero' && occ !== e;
      else ok = occ && occ.alive && occ.team === 'foe';
      if (ok) W.setHL(x, z, (s.kind === 'heal' || s.kind === 'shield' || s.kind === 'buff') ? 0x5be38a : 0xff5a5a, 0.62);
    }
  }
}

// ---------- Inventaire / équipement ----------
export function addItem(id, qty = 1, silent = false) {
  const f = G.P.inv.find((i) => i.id === id);
  if (f) f.qty += qty; else G.P.inv.push({ id, qty });
  if (!silent) { uiLog(`🎒 Reçu : <b>${ITEMS[id].name}</b> ×${qty}`); sfx.loot(); }
  refreshPanels();
}
export function removeItem(id, qty = 1) {
  const f = G.P.inv.find((i) => i.id === id);
  if (!f || f.qty < qty) return false;
  f.qty -= qty;
  if (f.qty <= 0) G.P.inv.splice(G.P.inv.indexOf(f), 1);
  refreshPanels();
  return true;
}
export function countItem(id) { return G.P.inv.find((i) => i.id === id)?.qty || 0; }
export function equipItem(id) {
  const def = ITEMS[id];
  if (!def.slot) return;
  const prev = G.P.equip[def.slot];
  if (prev) addItem(prev, 1, true);
  removeItem(id, 1);
  G.P.equip[def.slot] = id;
  const s = heroStats();
  G.hero.maxHp = s.hp; G.hero.hp = Math.min(G.hero.hp + (def.bonus.hp || 0), s.hp);
  syncStats(G.hero); drawHp(G.hero.hpBar, G.hero.hp, G.hero.maxHp);
  uiLog(`🛡️ Équipé : <b>${def.name}</b>`);
  sfx.buff(); refreshPanels();
}
export function unequipItem(slot) {
  const id = G.P.equip[slot];
  if (!id) return;
  delete G.P.equip[slot];
  addItem(id, 1, true);
  const s = heroStats();
  G.hero.maxHp = s.hp; G.hero.hp = Math.min(G.hero.hp, s.hp);
  syncStats(G.hero); drawHp(G.hero.hpBar, G.hero.hp, G.hero.maxHp);
  refreshPanels();
}
export function useConsumable(id) {
  const def = ITEMS[id];
  if (def.type !== 'conso' || !removeItem(id, 1)) return;
  if (def.heal) healEnt(G.hero, rand(def.heal[0], def.heal[1]));
  if (def.buff) addBuff(G.hero, { ...def.buff }, def.name);
  if (def.cleanse) cleanse(G.hero);
  if (def.gold) { G.P.gold += def.gold; uiLog(`🪙 +${def.gold} or !`); }
}

// ---------- Quêtes ----------
export function questVisit(mark) {
  const q = G.P.quests.carto;
  if (q.status === 'active' && !q.visited.includes(mark)) {
    q.visited.push(mark);
    uiLog(`🗺️ Lieu cartographié : <b>${mark}</b> (${q.visited.length}/3)`);
    sfx.quest(); checkQuestProgress(); refreshPanels();
  }
}
export function checkQuestProgress() {
  const P = G.P;
  if (P.quests.coeur.status === 'active' && P.quests.coeur.kills >= 3 && P.quests.coeur.dust >= 1) {
    P.quests.coeur.status = 'report';
    toast('📜 Quête : rapportez la poussière à Sélanire !');
    sfx.quest();
  }
  if (P.quests.chapeaux.status === 'active' && P.quests.chapeaux.gathered >= 4) {
    P.quests.chapeaux.status = 'report';
    toast('📜 Quête : rapportez les chapeaux à Pilpin !');
    sfx.quest();
  }
  if (P.quests.carto.status === 'active' && P.quests.carto.visited.length >= 3) {
    P.quests.carto.status = 'report';
    toast('📜 Quête : rapportez la carte à Tombelon !');
    sfx.quest();
  }
  const dot = Object.values(P.quests).some((q) => q.status === 'report');
  const qd = document.querySelector('#quest-dot');
  if (qd) qd.classList.toggle('hidden', !dot);
}
export function completeQuest(id) {
  const P = G.P, q = P.quests[id];
  const Q = QUESTS[id];
  if (id === 'chapeaux' && !removeItem('chapeau-luisant', 4)) { toast('🍄 Il faut 4 chapeaux luisants !'); return false; }
  if (id === 'coeur' && !removeItem('poussiere-etoile', 1)) { toast('✨ Il faut 1 poussière d’étoile !'); return false; }
  P.xp += Q.reward.xp; P.gold += Q.reward.gold;
  for (const it of Q.reward.items || []) addItem(it, 1, true);
  q.status = 'done';
  if (Q.reward.unlock === 'voile') { P.unlockedVoile = true; G.unlockedVoile = true; }
  uiLog(`🏆 Quête accomplie : <b>${Q.name}</b> ! ${Q.rewardTxt}`);
  toast(`🏆 ${Q.name} accomplie !`);
  sfx.win();
  // niveau ?
  while (P.xp >= P.level * 100) { P.xp -= P.level * 100; P.level++; }
  const s = heroStats();
  G.hero.maxHp = s.hp; syncStats(G.hero);
  checkQuestProgress(); refreshPanels();
  return true;
}

// ---------- Coffres / champignons / pierre ----------
function restoreInteracts() {
  const z = G.zone;
  for (const [i, c] of W.chestSpots().entries()) {
    const t = W.tiles[c.x][c.z];
    if (t.interact && G.P.chests[z + ':' + i]) { t.interact.opened = true; t.interact.lid.rotation.x = -1.8; t.obstacle = false; }
  }
  for (const [i, s] of W.glowSpots().entries()) {
    const t = W.tiles[s.x][s.z];
    if (t.interact && G.P.glows[z + ':' + i]) { t.interact.taken = true; t.interact.mesh.visible = false; }
  }
}
export function openChest(x, z) {
  const t = W.tiles[x][z];
  if (!t.interact || t.interact.opened) return;
  t.interact.opened = true; t.interact.lid.rotation.x = -1.8; t.obstacle = false;
  const idx = W.chestSpots().findIndex((c) => c.x === x && c.z === z);
  G.P.chests[G.zone + ':' + idx] = true;
  const lvlBonus = G.zone === 2;
  const gold = rand(25, 45) * (lvlBonus ? 2 : 1);
  G.P.gold += gold;
  const item = chance(0.5) ? (lvlBonus ? 'anneau-veilleur' : 'arc-cristal') : (lvlBonus ? 'bottes-sentier' : 'chapeau-travers');
  addItem(item, 1, true);
  const { wx, wz } = W.gridToWorld(x, z);
  W.starBurst(wx, 1.2, wz, 14); W.pillarFx(wx, W.topY(x, z), wz, 0xffd94a, 4, 0.8);
  sfx.loot();
  uiLog(`🎁 Coffre ouvert : <b>+${gold} 🪙</b> et <b>${ITEMS[item].name}</b> !`);
  toast(`🎁 ${ITEMS[item].name} !`);
  refreshPanels();
}
export function gatherGlow(x, z) {
  const t = W.tiles[x][z];
  if (!t.interact || t.interact.taken) return;
  t.interact.taken = true; t.interact.mesh.visible = false;
  const idx = W.glowSpots().findIndex((c) => c.x === x && c.z === z);
  G.P.glows[G.zone + ':' + idx] = true;
  addItem('chapeau-luisant', 1, true);
  const { wx, wz } = W.gridToWorld(x, z);
  W.burst(wx, 1, wz, 0x7df0ff, 10);
  if (G.P.quests.chapeaux.status === 'active') {
    G.P.quests.chapeaux.gathered++;
    uiLog(`🍄 Chapeau luisant cueilli ! (${G.P.quests.chapeaux.gathered}/4)`);
    checkQuestProgress();
  } else uiLog('🍄 Chapeau luisant cueilli !');
  sfx.loot(); refreshPanels();
}

// ---------- PNJ : dialogues ----------
export function npcDialog(npcId) {
  const P = G.P;
  const dlg = { name: '', text: '', buttons: [] };
  if (npcId === 'selanire') {
    dlg.name = '🔮 Sélanire, Gardienne du camp';
    const q = P.quests.coeur;
    if (q.status === 'todo') {
      dlg.text = QUESTS.coeur.intro;
      dlg.buttons.push({ label: '🌙 Accepter la quête', fn: () => { q.status = 'active'; uiLog('📜 Quête acceptée : <b>Le cœur de la brume</b>'); sfx.quest(); checkQuestProgress(); } });
    } else if (q.status === 'active') {
      dlg.text = `« Alors ? Les corrompues : ${q.kills}/3. Poussière : ${q.dust}/1. Ma théière s’impatiente autant que moi. »`;
    } else if (q.status === 'report') {
      dlg.text = '« Oh ! Elle chante encore ! Tenez, votre récompense, jeune Veilleur. Et si le Voile vous appelle… ne répondez pas après minuit. »';
      dlg.buttons.push({ label: '🏆 Terminer la quête', fn: () => completeQuest('coeur') });
    } else {
      dlg.text = '« Le Voile Profond s’est ouvert au donjon. Restez groupé, et n’embrassez aucun Cendreux. »';
      dlg.buttons.push({ label: '💚 Me soigner (gratuit)', fn: () => { G.hero.hp = G.hero.maxHp; drawHp(G.hero.hpBar, G.hero.hp, G.hero.maxHp); uiLog('💚 Sélanire vous soigne entièrement.'); } });
    }
  } else if (npcId === 'pilpin') {
    dlg.name = '🧺 Pilpin, marchand bavard';
    const q = P.quests.chapeaux;
    if (q.status === 'todo') {
      dlg.text = QUESTS.chapeaux.intro;
      dlg.buttons.push({ label: '🍄 Accepter', fn: () => { q.status = 'active'; uiLog('📜 Quête acceptée : <b>Des chapeaux pour Pilpin</b>'); sfx.quest(); checkQuestProgress(); } });
    } else if (q.status === 'report') {
      dlg.text = '« Des chapeaux ! BEAUX ! Légèrement baveux, mais beaux ! Voici votre dû, et un ragot gratuit : les Lucioles cachent de l’or. »';
      dlg.buttons.push({ label: '🏆 Terminer', fn: () => completeQuest('chapeaux') });
    } else {
      dlg.text = q.status === 'active'
        ? `« Mes chapeaux : ${q.gathered}/4. Ils brillent près des rochers, impossible de les rater ! Comme mon nez. »`
        : '« Pilpin, marchand, poète à temps partiel ! Ma caravane est ouverte jour et nuit. Surtout jour. »';
    }
    dlg.buttons.push({ label: '🛍️ Voir la boutique', fn: () => openShop() });
  } else {
    dlg.name = '🗺️ Vieux Tombelon, cartographe';
    const q = P.quests.carto;
    if (q.status === 'todo') {
      dlg.text = QUESTS.carto.intro;
      dlg.buttons.push({ label: '🗺️ Accepter', fn: () => { q.status = 'active'; uiLog('📜 Quête acceptée : <b>Cartographier le voile</b>'); sfx.quest(); checkQuestProgress(); } });
    } else if (q.status === 'report') {
      dlg.text = '« Pont… donjon… pierre… TOUT ÉTAIT VRAI ?! Ma carte est donc fausse dans l’autre sens ! Tenez, cet anneau porte-bonheur. Il ne marche pas, mais il brille. »';
      dlg.buttons.push({ label: '🏆 Terminer', fn: () => completeQuest('carto') });
    } else {
      dlg.text = q.status === 'active'
        ? `« Lieux vérifiés : ${q.visited.join(', ') || 'aucun'} (${q.visited.length}/3). Marchez dessus, la carte boit vos pas ! »`
        : '« Saviez-vous que les îles flottent parce qu’elles ont peur de l’eau ? Moi non plus, je viens de l’inventer. »';
    }
  }
  dlg.buttons.push({ label: '👋 Partir', fn: () => {} });
  return dlg;
}

// ---------- Sauvegarde ----------
export function doSave() {
  saveHeroHp();
  const ok = saveGame({ P: G.P, savedAt: Date.now() });
  toast(ok ? '💾 Partie sauvegardée !' : '⚠️ Sauvegarde impossible.');
  return ok;
}
export function doLoad() {
  const d = loadGame();
  if (!d || !d.P) { toast('📂 Aucune sauvegarde.'); return false; }
  G.P = d.P; G.unlockedVoile = !!d.P.unlockedVoile;
  enterZone(G.P.zone || 1, false);
  G.hero.hp = clamp(G.P.hp ?? heroStats().hp, 1, heroStats().hp);
  drawHp(G.hero.hpBar, G.hero.hp, G.hero.maxHp);
  toast('📂 Partie chargée !');
  return true;
}
export function doReset() {
  clearSave();
  const cls = G.P ? G.P.classId : 'eclaireuse';
  G.P = freshProfile(cls);
  G.unlockedVoile = false;
  enterZone(1, true);
  toast('🔥 Nouvelle aventure !');
}

// ---------- Divers ----------
export function floatAt(e, txt, cls) {
  const v = new THREE.Vector3(e.mesh.position.x, 2.9, e.mesh.position.z).project(W.camera);
  const d = document.createElement('div');
  d.className = 'float-dmg ' + cls; d.textContent = txt;
  d.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
  d.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
  $('#float-layer').appendChild(d);
  setTimeout(() => d.remove(), 1150);
}
export function afterAction(caster) {
  if (G.mode !== 'combat') return;
  refreshPanels(); showHints();
}
export function usePotionInCombat() {
  const h = G.hero;
  if (G.mode !== 'combat' || G.active !== h || h.pa < 2) { toast('⛔ Il faut 2 ✦ et votre tour.'); return; }
  const p = countItem('potion-seve') ? 'potion-seve' : countItem('potion-etoile') ? 'potion-etoile' : null;
  if (!p) { toast('🧪 Aucune potion !'); return; }
  h.pa -= 2; removeItem(p, 1);
  const def = ITEMS[p];
  healEnt(h, rand(def.heal[0], def.heal[1]));
  afterAction(h);
}

// hooks vers ui.js (assignés par ui pour éviter les imports circulaires)
let uiLog = (m) => console.log(m);
let refreshPanels = () => {};
let showEnd = (win) => {};
let openShop = () => {};
let syncInteract = () => {};
export function setHooks(h) { uiLog = h.log; refreshPanels = h.refresh; showEnd = h.end; openShop = h.shop; syncInteract = h.interact || (() => {}); }

// ---------- Mise à jour des animations ----------
export function updateEntities(dt, t) {
  for (const e of G.entities) {
    if (!e.mesh) continue;
    const u = e.mesh.userData;
    if (!e.alive) {
      if (u.dying) {
        e.mesh.rotation.x += dt * 2.5;
        e.mesh.position.y -= dt * 1.0;
        const s = Math.max(0.05, e.mesh.scale.x - dt * 0.7);
        e.mesh.scale.setScalar(s);
      }
      continue;
    }
    if (e.born < 1) { e.born = Math.min(1, e.born + dt * 2); e.mesh.scale.setScalar(Math.max(0.05, e.born)); }
    // marche
    if (e.targetPos) {
      const d = e.targetPos.clone().sub(e.mesh.position); d.y = 0;
      if (d.length() < 0.1) { e.mesh.position.copy(e.targetPos); e.targetPos = null; }
      else {
        e.mesh.position.addScaledVector(d.normalize(), dt * 6.5);
        e.mesh.position.y = W.topY(e.x, e.z) + Math.abs(Math.sin(t * 13)) * 0.3;
      }
    }
    // attitudes d’attente par archétype
    const idle = u.idle;
    if (idle === 'sway') e.mesh.rotation.y = Math.sin(t * 1.2 + e.x) * 0.12;
    else if (idle === 'floaty') e.mesh.position.y += Math.sin(t * 2.2 + e.z) * dt * 0.35;
    else if (idle === 'hover' && !e.targetPos) e.mesh.position.y = W.topY(e.x, e.z) + 0.35 + Math.sin(t * 3 + e.x) * 0.12;
    else if (idle === 'skitter') e.mesh.rotation.y += Math.sin(t * 5) * dt * 0.6;
    // attaque / touché / victoire / défaite
    if (u.atkT > 0) { u.atkT -= dt; e.mesh.position.y += Math.sin((0.45 - u.atkT) / 0.45 * Math.PI) * dt * 5; }
    if (u.hitT > 0) { u.hitT -= dt; e.mesh.position.x += Math.sin(t * 55) * dt * 1.4; }
    if (u.winT > 0) { u.winT -= dt * 0.5; e.mesh.position.y = W.topY(e.x, e.z) + Math.abs(Math.sin(u.winT * 8)) * 0.9; }
    if (u.loseT > 0) { u.loseT -= dt * 0.5; e.mesh.rotation.x = Math.min(1.2, e.mesh.rotation.x + dt); }
    // accessoires vivants
    if (u.lantern) { u.lantern.position.y = 1.9 + Math.sin(t * 2.5) * 0.15; u.lantern.rotation.y = t; }
    if (u.ember) u.ember.rotation.y = t * 2;
    if (u.star) u.star.rotation.y = t * 1.5;
    if (u.wisp) u.wisp.position.y = 2.2 + Math.sin(t * 3) * 0.12;
    if (u.scarfTail) u.scarfTail.rotation.x = Math.sin(t * 2) * 0.25;
    if (u.orb) u.orb.position.y = 2.35 + Math.sin(t * 2) * 0.1;
    if (u.lamp) u.lamp.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
    if (u.spike) u.spike.rotation.y = t * 2;
    if (u.wingL) { const w = Math.sin(t * (e.kind === 'foe' && e.monId === 'luciole' ? 22 : 9)) * 0.5; u.wingL.rotation.z = 0.2 + w; u.wingR.rotation.z = -0.2 - w; }
    if (u.legs && e.targetPos) u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 13 + i * Math.PI) * 0.6; });
    else if (u.legs) u.legs.forEach((l) => { l.rotation.x *= 0.9; });
  }
}
