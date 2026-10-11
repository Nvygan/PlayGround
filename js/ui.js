// ============================================================
// Brumelune — Les Veilleurs · ui.js
// Toute l’interface : HUD, sorts, inventaire, quêtes,
// dialogues, boutique, sauvegarde, écrans de fin.
// ============================================================
import { $, $$, sfx, toast, hasSave, toggleMute } from './core.js';
import { CLASSES, ITEMS, RAR_LABEL, SLOTS, SLOT_EMOJI, QUESTS, SHOP_STOCK } from './data.js';
import { G, heroStats, newGame, doSave, doLoad, doReset, endTurn, usePotionInCombat, equipItem, unequipItem, useConsumable, removeItem, countItem, showHints, completeQuest, travelZone, afterEndPanel, npcDialog, openChest, gatherGlow } from './game.js';
import { setQuality, isoZoomBy, tiles as WTILES, inBounds as WINBOUNDS } from './world.js';
import { drawHp } from './models.js';

let selClass = 'eclaireuse';
let invTab = 'all';

// ---------- Journal ----------
export function log(html) {
  const el = $('#combat-log');
  const d = document.createElement('div');
  d.innerHTML = html;
  el.prepend(d);
  while (el.children.length > 40) el.lastChild.remove();
}

// ---------- Menu : choix de classe ----------
export function buildMenu() {
  const grid = $('#class-grid');
  grid.innerHTML = '';
  for (const c of Object.values(CLASSES)) {
    const b = document.createElement('button');
    b.className = 'class-card' + (c.id === selClass ? ' selected' : '');
    b.innerHTML = `<div class="cc-top"><div class="cc-emoji">${c.emoji}</div>
      <div><div class="cc-name">${c.name}</div><div class="cc-role">${c.role}</div></div></div>
      <div class="cc-desc">${c.desc}</div>
      <div class="cc-stats">❤️${c.hp} · ✦${c.pa} · 👣${c.pm} · ${c.spells.length} sorts</div>
      <div class="cc-desc" style="min-height:0;color:#9fd8ff">${c.spells.map((s) => s.emoji + ' ' + s.name).join(' · ')}</div>`;
    b.onclick = () => { selClass = c.id; sfx.ui(); buildMenu(); };
    grid.appendChild(b);
  }
  $('#btn-new').onclick = () => { sfx.ui(); startAdventure(selClass); };
  if (hasSave()) {
    $('#btn-continue').classList.remove('hidden');
    $('#btn-continue').onclick = () => { sfx.ui(); startAdventure(null); };
  }
  $('#loading').textContent = 'Moteur 3D prêt ✅ — choisissez votre Veilleur !';
}
function startAdventure(classId) {
  $('#menu').classList.add('hidden');
  ['#hud-top', '#dock', '#combat-log'].forEach((s) => $(s).classList.remove('hidden'));
  if (classId) { newGame(classId); log(`🌙 <b>Aventure commencée !</b> Vous êtes <b>${CLASSES[classId].name}</b>. Parlez à <b>Sélanire</b> au camp !`); }
  else { doLoad(); log('📂 <b>Aventure reprise.</b> La brume vous attendait.'); }
  refreshAll();
}

// ---------- HUD ----------
export function refreshAll() {
  if (!G.P) return;
  const h = G.hero, st = heroStats();
  $('#hero-face').textContent = CLASSES[G.P.classId].emoji;
  $('#hero-name').textContent = `${CLASSES[G.P.classId].name} · Nv ${G.P.level}`;
  const hpFill = $('#hp-fill');
  hpFill.style.width = Math.max(0, h.hp / h.maxHp * 100) + '%';
  hpFill.parentElement.classList.toggle('low', h.hp / h.maxHp <= 0.3);
  $('#hp-txt').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
  $('#xp-fill').style.width = (G.P.xp / (G.P.level * 100) * 100) + '%';
  $('#pa-pill').textContent = '✦ ' + (G.active === h && G.mode === 'combat' ? h.pa : st.pa);
  $('#pm-pill').textContent = '👣 ' + (G.active === h && G.mode === 'combat' ? h.pm : st.pm);
  $('#lvl-pill').textContent = `🪙 ${G.P.gold}`;
  renderInit();
  renderSpells();
  $('#mode-banner').classList.remove('hidden');
  $('#mode-banner').textContent = G.mode === 'combat'
    ? `⚔️ Combat — Tour ${G.turnNum} · ${G.zone === 2 ? 'Voile Profond' : 'Clairière des Brumes'}`
    : `🌿 Exploration — ${G.zone === 2 ? 'Voile Profond' : 'Clairière des Brumes'}`;
  const inCombat = G.mode === 'combat';
  $('#btn-end').classList.toggle('hidden', !inCombat);
  $('#btn-wait').classList.toggle('hidden', !inCombat);
}
function renderInit() {
  const strip = $('#init-strip');
  strip.innerHTML = '';
  if (G.mode !== 'combat') return;
  for (const e of G.order) {
    const d = document.createElement('div');
    d.className = 'init-dot' + (e === G.active ? ' cur' : '') + (e.team === 'foe' ? ' foe' : '') + (!e.alive ? ' dead' : '');
    d.textContent = e.emoji;
    d.title = `${e.name} (${e.alive ? Math.ceil(e.hp) + ' PV' : 'K.O.'})`;
    strip.appendChild(d);
  }
}
function renderSpells() {
  const bar = $('#spell-bar');
  bar.innerHTML = '';
  const h = G.hero;
  if (!h || G.mode !== 'combat') {
    // hors combat : raccourci potion
    const b = document.createElement('button');
    b.className = 'spell';
    b.innerHTML = `<div class="s-emoji">🧪</div><div class="s-name">Potion (${countItem('potion-seve') + countItem('potion-etoile')})</div><div class="s-cost">soigne</div>`;
    b.onclick = () => {
      const id = countItem('potion-seve') ? 'potion-seve' : countItem('potion-etoile') ? 'potion-etoile' : null;
      if (!id) return toast('🧪 Aucune potion !');
      removeItem(id, 1);
      const def = ITEMS[id];
      h.hp = Math.min(h.maxHp, h.hp + (def.heal[0] + def.heal[1]) / 2);
      drawHp(h.hpBar, h.hp, h.maxHp);
      log(`🧪 Potion bue : +PV (${Math.ceil(h.hp)}/${h.maxHp})`);
      refreshAll();
    };
    bar.appendChild(b);
    return;
  }
  const cls = CLASSES[G.P.classId];
  cls.spells.forEach((s, i) => {
    const mine = G.active === h && h.controlled && h.alive;
    const b = document.createElement('button');
    b.className = 'spell' + (G.sel === s ? ' selected' : '') + ((!mine || h.pa < s.pa) ? ' disabled' : '');
    b.innerHTML = `<div class="s-emoji">${s.emoji}</div><div class="s-name">${s.name}</div><div class="s-cost">✦${s.pa}</div><div class="s-key">${i + 1}</div>`;
    b.onclick = () => selectSpell(s);
    bar.appendChild(b);
  });
  // bouton potion de combat
  const pb = document.createElement('button');
  pb.className = 'spell';
  pb.innerHTML = `<div class="s-emoji">🧪</div><div class="s-name">Potion</div><div class="s-cost">✦2</div>`;
  pb.onclick = () => usePotionInCombat();
  bar.appendChild(pb);
}
export function selectSpell(s) {
  if (G.mode !== 'combat' || G.active !== G.hero) return;
  if (G.hero.pa < s.pa) { toast('⛔ Pas assez de ✦ !'); return; }
  G.sel = G.sel === s ? null : s;
  sfx.ui(); refreshAll(); showHints();
  const tip = $('#spell-tip');
  if (G.sel) { tip.innerHTML = `<b>${s.emoji} ${s.name}</b> — ${s.desc} <i>(portée ${s.range[0]}-${s.range[1]}, ✦${s.pa})</i>`; tip.classList.remove('hidden'); }
  else tip.classList.add('hidden');
}

// ---------- Cible ----------
export function showTarget(e, dist) {
  const card = $('#target-card');
  if (!e) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  $('#target-emoji').textContent = e.corrupted ? '😈' : e.emoji;
  $('#target-name').textContent = e.name + (e.corrupted ? ' (corrompu)' : '');
  $('#target-hp').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  const extra = e.kind === 'foe'
    ? `${e.dmg ? e.dmg[0] + '-' + e.dmg[1] + ' dégâts' : ''} · 📏 ${dist} cases`
    : e.kind === 'npc' ? 'Parlez-lui en vous approchant' : `Allié · ${Math.ceil(e.hp)}/${e.maxHp} PV`;
  $('#target-info').textContent = extra;
}

// ---------- Dialogue ----------
export function openDialog(dlg) {
  G.mode = 'dialog';
  $('#dialog').classList.remove('hidden');
  $('#dlg-name').textContent = dlg.name;
  $('#dlg-text').textContent = dlg.text;
  const box = $('#dlg-btns');
  box.innerHTML = '';
  for (const b of dlg.buttons) {
    const btn = document.createElement('button');
    btn.className = 'qbtn'; btn.textContent = b.label;
    btn.onclick = () => { sfx.ui(); $('#dialog').classList.add('hidden'); G.mode = 'explore'; b.fn && b.fn(); refreshAll(); };
    box.appendChild(btn);
  }
}

// ---------- Inventaire ----------
const TABS = [['all', '⭐ Tout'], ['equip', '🛡️ Équip.'], ['conso', '🧪 Conso'], ['ressource', '🌿 Ress.'], ['quete', '✨ Quête']];
export function openInv() {
  renderEquip(); renderTabs(); renderInvGrid(null);
  $('#panel-inv').classList.remove('hidden');
}
function renderEquip() {
  const row = $('#equip-row');
  row.innerHTML = '';
  const slots = ['arme', 'casque', 'cape', 'anneau', 'amulette', 'bottes'];
  const EM = { arme: '🗡️', casque: '⛑️', cape: '🧥', anneau: '💍', amulette: '📿', bottes: '🥾' };
  for (const s of slots) {
    const id = G.P.equip[s];
    const d = document.createElement('div');
    d.className = 'eq-slot' + (id ? ' filled' : '');
    d.innerHTML = id
      ? `<div class="eq-ico">${ITEMS[id].emoji}</div><b>${ITEMS[id].name}</b><span>${s}</span>`
      : `<div class="eq-ico">${EM[s]}</div><span>${s} (vide)</span>`;
    d.onclick = () => { if (id) { unequipItem(s); renderEquip(); renderInvGrid(null); } };
    row.appendChild(d);
  }
  $('#gold-line').textContent = `🪙 ${G.P.gold}`;
}
function renderTabs() {
  const t = $('#inv-tabs');
  t.innerHTML = '';
  for (const [id, label] of TABS) {
    const b = document.createElement('button');
    b.className = 'itab' + (invTab === id ? ' sel' : '');
    b.textContent = label;
    b.onclick = () => { invTab = id; sfx.ui(); renderTabs(); renderInvGrid(null); };
    t.appendChild(b);
  }
}
function catOf(id) {
  const d = ITEMS[id];
  if (d.slot) return 'equip';
  return d.type || 'ressource';
}
function renderInvGrid(filter) {
  const g = $('#inv-grid');
  g.innerHTML = '';
  $('#item-detail').classList.add('hidden');
  const list = G.P.inv.filter((i) => invTab === 'all' || catOf(i.id) === invTab);
  if (!list.length) g.innerHTML = '<div style="grid-column:1/-1;text-align:center;opacity:.7">Vide… les monstres gardent des trésors !</div>';
  for (const it of list) {
    const d = ITEMS[it.id];
    const c = document.createElement('div');
    c.className = 'inv-cell ' + ({ unco: 'unco', rare: 'rare', epic: 'epic', legend: 'legend' }[d.rar] || '');
    c.innerHTML = `<div class="i-ico">${d.emoji}</div><div class="i-n">${d.name}</div>${it.qty > 1 ? `<div class="qty">×${it.qty}</div>` : ''}`;
    c.onclick = () => showItem(it.id);
    g.appendChild(c);
  }
}
function showItem(id) {
  const d = ITEMS[id];
  const el = $('#item-detail');
  el.classList.remove('hidden');
  const bonus = d.bonus ? Object.entries(d.bonus).map(([k, v]) => `+${v} ${k}`).join(', ') : '';
  el.innerHTML = `<b>${d.emoji} ${d.name}</b> <span class="rar-${d.rar}">(${d.rar === 'com' ? 'commun' : d.rar === 'unco' ? 'inhabituel' : d.rar === 'rare' ? 'rare' : d.rar === 'epic' ? 'épique' : 'légendaire'})</span>
    <div>${d.desc}</div>${bonus ? `<div>Bonus : <b>${bonus}</b></div>` : ''}${d.heal ? `<div>Soigne ${d.heal[0]}-${d.heal[1]} PV</div>` : ''}<div class="row"></div>`;
  const row = el.querySelector('.row');
  if (d.slot) {
    const b = document.createElement('button'); b.textContent = '🛡️ Équiper';
    b.onclick = () => { equipItem(id); renderEquip(); renderInvGrid(null); el.classList.add('hidden'); };
    row.appendChild(b);
  }
  if (d.type === 'conso') {
    const b = document.createElement('button'); b.textContent = '🧪 Utiliser';
    b.onclick = () => { useConsumable(id); refreshAll(); renderInvGrid(null); el.classList.add('hidden'); };
    row.appendChild(b);
  }
  if (d.price > 0 && d.type !== 'quete') {
    const b = document.createElement('button'); b.textContent = `🪙 Vendre (${Math.floor(d.price * 0.4)})`; b.className = 'sell';
    b.onclick = () => { removeItem(id, 1); G.P.gold += Math.floor(d.price * 0.4); renderEquip(); renderInvGrid(null); el.classList.add('hidden'); };
    row.appendChild(b);
  }
}

// ---------- Quêtes ----------
function questText(id) {
  const q = G.P.quests[id], Q = QUESTS[id];
  if (q.status === 'todo') return 'Non commencée — parlez au donneur.';
  if (id === 'coeur') {
    if (q.status === 'active') return `Vaincre les corrompues : ${q.kills}/3\nPoussière d’étoile : ${q.dust}/1`;
    if (q.status === 'report') return 'À rapporter à Sélanire !';
    return 'Terminée ✅ — le Voile Profond est ouvert.';
  }
  if (id === 'chapeaux') {
    if (q.status === 'active') return `Chapeaux luisants cueillis : ${q.gathered}/4`;
    if (q.status === 'report') return 'À rapporter à Pilpin (4 chapeaux requis) !';
    return 'Terminée ✅';
  }
  if (q.status === 'active') return `Lieux visités : ${q.visited.join(', ') || 'aucun'} (${q.visited.length}/3)`;
  if (q.status === 'report') return 'À rapporter à Tombelon !';
  return 'Terminée ✅';
}
export function openQuests() {
  const list = $('#quest-list');
  list.innerHTML = '';
  for (const Q of Object.values(QUESTS)) {
    const q = G.P.quests[Q.id];
    const d = document.createElement('div');
    d.className = 'quest' + (q.status === 'done' ? ' done' : '');
    d.innerHTML = `<div class="q-title">${Q.kind === 'main' ? '🌙' : '🌿'} ${Q.name}</div>
      <div class="q-obj">${q.status === 'todo' ? Q.intro : questText(Q.id)}</div>
      <div class="q-rew">🎁 ${Q.rewardTxt}</div>`;
    list.appendChild(d);
  }
  $('#panel-quest').classList.remove('hidden');
}

// ---------- Personnage ----------
export function openHero() {
  const st = heroStats();
  const cls = CLASSES[G.P.classId];
  const eq = Object.entries(G.P.equip).map(([s, id]) => `${ITEMS[id].emoji} ${ITEMS[id].name}`).join('<br>') || 'Rien équipé… les coffres vous attendent !';
  $('#hero-sheet').innerHTML = `<b>${cls.emoji} ${cls.name}</b> — Nv ${G.P.level} (${G.P.xp}/${G.P.level * 100} XP)<br><i>${cls.role}</i>
    <div class="stat-grid">
    <span>❤️ PV : <b>${Math.ceil(G.hero.hp)} / ${st.hp}</b></span><span>✦ PA : <b>${st.pa}</b> · 👣 PM : <b>${st.pm}</b></span>
    <span>⚔️ Puissance : <b>${st.power}</b></span><span>💨 Esquive : <b>${st.dodge} %</b></span>
    <span>💥 Critique : <b>${st.crit} %</b></span><span>🎲 Initiative : <b>${st.init}</b></span>
    <span>🛡️ Ré. physique : <b>${st.resPhys} %</b></span><span>🔥 Ré. élémentaire : <b>${st.resElem} %</b></span>
    </div><div style="margin-top:8px"><b>Équipement :</b><br>${eq}</div>
    <div style="margin-top:6px">🪙 Or : <b>${G.P.gold}</b> · Zone : <b>${G.zone === 2 ? 'Voile Profond' : 'Clairière'}</b></div>`;
  $('#panel-hero').classList.remove('hidden');
}

// ---------- Boutique ----------
export function openShop() {
  const list = $('#shop-list');
  const render = () => {
    list.innerHTML = `<div style="margin-bottom:8px;color:#ffd97a;font-weight:900">🪙 Votre or : ${G.P.gold}</div>`;
    for (const id of SHOP_STOCK) {
      const d = ITEMS[id];
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div class="s-ico">${d.emoji}</div><div class="s-mid"><b>${d.name}</b><div>${d.desc}</div></div>`;
      const b = document.createElement('button');
      b.className = 'shop-buy'; b.textContent = `🪙 ${d.price}`;
      b.onclick = () => {
        if (G.P.gold < d.price) return toast('🪙 Pas assez d’or !');
        G.P.gold -= d.price;
        const f = G.P.inv.find((i) => i.id === id);
        if (f) f.qty++; else G.P.inv.push({ id, qty: 1 });
        sfx.ui(); render(); refreshAll();
      };
      row.appendChild(b);
      list.appendChild(row);
    }
    const sell = document.createElement('button');
    sell.className = 'shop-buy'; sell.style.width = '100%'; sell.textContent = '💰 Tout vendre (babioles)';
    sell.onclick = () => {
      let gain = 0;
      for (const it of [...G.P.inv]) {
        const d = ITEMS[it.id];
        if (d.type === 'camelote' || d.type === 'ressource') { gain += Math.floor(d.price * 0.4) * it.qty; G.P.inv.splice(G.P.inv.indexOf(it), 1); }
      }
      G.P.gold += gain;
      toast(gain ? `💰 +${gain} 🪙 ! Pilpin adore vos babioles.` : 'Rien à vendre.');
      render(); refreshAll();
    };
    list.appendChild(sell);
  };
  render();
  $('#panel-shop').classList.remove('hidden');
}

// ---------- Sauvegarde ----------
export function openSave() {
  $('#save-info').innerHTML = `<div style="font-size:13px">Nv ${G.P.level} · 🪙 ${G.P.gold} · ${G.zone === 2 ? 'Voile Profond' : 'Clairière'} · quêtes : ${Object.values(G.P.quests).filter((q) => q.status === 'done').length}/3 terminées</div>`;
  $('#panel-save').classList.remove('hidden');
}

// ---------- Fin de partie ----------
export function showEnd(win, ups = 0) {
  $('#panel-end').classList.remove('hidden');
  $('#end-title').textContent = win ? '🌟 Victoire !' : '🌧️ Défaite…';
  $('#end-title').style.color = win ? '#ffd97a' : '#ff8a9a';
  const loot = $('#loot-list');
  loot.innerHTML = '';
  if (win) {
    $('#end-body').innerHTML = `+<b>${G.pendingXp}</b> XP · +<b>${G.pendingGold}</b> 🪙${ups ? ` · <b>Niveau ${G.P.level} !</b>` : ''}`;
    for (const id of G.pendingLoot) {
      const d = ITEMS[id];
      const div = document.createElement('div');
      div.className = 'loot';
      div.textContent = `${d.emoji} ${d.name} (${d.rar === 'com' ? 'commun' : d.rar === 'unco' ? 'inhabituel' : d.rar === 'rare' ? 'rare' : 'épique'})`;
      loot.appendChild(div);
    }
    if (!G.pendingLoot.length) loot.innerHTML = '<div class="loot">Pas d’objet cette fois… les coffres vous attendent !</div>';
  } else {
    $('#end-body').innerHTML = 'Les Veilleurs ne tombent jamais vraiment : la brume vous ramène au camp, un peu sonné mais entier.';
  }
  $('#btn-end-ok').textContent = win ? '✨ Continuer l’aventure' : '🏕️ Retourner au camp';
}

// ---------- Bouton contextuel (proximité) ----------
export function updateInteractBtn() {
  if (!G.P || G.mode !== 'explore') { setInteract(null); return; }
  const h = G.hero;
  const dist = (a, b, c, d) => Math.abs(a - c) + Math.abs(b - d);
  for (const e of G.entities) {
    if (e.alive && e.kind === 'npc' && dist(h.x, h.z, e.x, e.z) === 1) {
      const names = { selanire: '🔮 Sélanire', pilpin: '🧺 Pilpin', tombelon: '🗺️ Tombelon' };
      setInteract('💬 ' + (names[e.npcId] || 'Parler'), () => openDialog(npcDialog(e.npcId)));
      return;
    }
  }
  const cells = [[h.x, h.z], [h.x + 1, h.z], [h.x - 1, h.z], [h.x, h.z + 1], [h.x, h.z - 1]];
  for (const [x, z] of cells) {
    if (!WINBOUNDS(x, z)) continue;
    const it = WTILES[x][z].interact;
    if (!it) continue;
    if (it.type === 'chest' && !it.opened) { setInteract('🎁 Ouvrir le coffre', () => { openChest(x, z); updateInteractBtn(); }); return; }
    if (it.type === 'glow' && !it.taken) { setInteract('🍄 Cueillir', () => { gatherGlow(x, z); updateInteractBtn(); }); return; }
    if (it.type === 'save') { setInteract('💾 Sauvegarder', () => doSave()); return; }
    if (it.type === 'dungeon') { setInteract(G.zone === 1 && !G.P.unlockedVoile ? '🔒 Donjon scellé' : '⛩️ Entrer', () => travelZone()); return; }
  }
  setInteract(null);
}
export function setInteract(label, fn) {
  const b = $('#interact-btn');
  if (!label) { b.classList.add('hidden'); b.onclick = null; return; }
  b.classList.remove('hidden');
  b.textContent = label;
  b.onclick = () => { sfx.ui(); fn(); };
}
export function cycleQuality() {
  G.quality = G.quality === 'M' ? 'H' : G.quality === 'H' ? 'L' : 'M';
  setQuality(G.quality);
  $('#q-label').textContent = G.quality;
  toast('✨ Qualité : ' + (G.quality === 'L' ? 'basse' : G.quality === 'M' ? 'moyenne' : 'haute'));
}
export function wireChrome() {
  $$('[data-close]').forEach((b) => { b.onclick = () => $('#' + b.dataset.close).classList.add('hidden'); });
  $('#btn-inv').onclick = () => { sfx.ui(); openInv(); };
  $('#btn-quest').onclick = () => { sfx.ui(); openQuests(); };
  $('#btn-hero').onclick = () => { sfx.ui(); openHero(); };
  $('#btn-save').onclick = () => { sfx.ui(); openSave(); };
  $('#btn-end').onclick = () => endTurn();
  $('#btn-wait').onclick = () => { if (G.mode === 'combat' && !G.busy) { G.hero.pm = 0; endTurn(); } };
  $('#btn-cam-in').onclick = () => isoZoomBy(0.85);
  $('#btn-cam-out').onclick = () => isoZoomBy(1.18);
  $('#btn-quality').onclick = () => cycleQuality();
  $('#btn-help').onclick = () => $('#panel-help').classList.remove('hidden');
  $('#btn-do-save').onclick = () => { doSave(); };
  $('#btn-do-load').onclick = () => { $('#panel-save').classList.add('hidden'); doLoad(); refreshAll(); };
  $('#btn-do-reset').onclick = () => { if (confirm('Recommencer ? La sauvegarde sera effacée.')) { $('#panel-save').classList.add('hidden'); doReset(); refreshAll(); } };
  $('#btn-end-ok').onclick = () => {
    $('#panel-end').classList.add('hidden');
    afterEndPanel(); refreshAll();
  };
  $('#sound-btn').onclick = () => toggleMute();
  addEventListener('keydown', (ev) => {
    const n = parseInt(ev.key);
    if (n >= 1 && n <= 5 && G.P) {
      const s = CLASSES[G.P.classId].spells[n - 1];
      if (s) selectSpell(s);
    }
    if ((ev.key === ' ' || ev.key === 'Enter') && G.P && !$('#menu').offsetParent) { ev.preventDefault(); endTurn(); }
  });
}
