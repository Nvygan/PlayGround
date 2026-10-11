// ============================================================
// Brumelune — Les Veilleurs · data.js
// TOUT le contenu est une création originale pour Nérélys.
// Classes, sorts, monstres, objets et quêtes inventés ici.
// ============================================================

// ---------- Classes jouables (4) ----------
export const CLASSES = {
  eclaireuse: {
    id: 'eclaireuse', name: 'Éclaireuse astrale', emoji: '🌠', color: 0x3fd0c9,
    role: 'Distance · mobilité · pièges',
    desc: 'Ancienne cartographe des routes de brume. Elle peint ses flèches avec de la poussière d’étoile et ne se perd jamais. Enfin… presque.',
    hp: 120, pa: 6, pm: 5, power: 10, dodge: 15, crit: 15, init: 14, resPhys: 0, resElem: 5,
    spells: [
      { id: 'pas-lunaire', name: 'Pas lunaire', emoji: '🌙', pa: 2, range: [0, 0], kind: 'dash', anim: 'dash', desc: 'Glissade lunaire : bondit jusqu’à 3 cases et gagne +2 PM pour ce tour.' },
      { id: 'fleche-azur', name: 'Flèche d’azur', emoji: '🏹', pa: 3, range: [2, 6], kind: 'dmg', dmg: [14, 20], anim: 'arrow', line: true, desc: 'Tir précis en ligne droite, 14-20 dégâts azur.' },
      { id: 'pluie-etoiles', name: 'Pluie d’étoiles', emoji: '🌟', pa: 5, range: [2, 5], kind: 'aoe', dmg: [10, 16], radius: 1, anim: 'meteor', desc: 'Une averse d’étoiles piquantes : 10-16 en zone 3×3.' },
      { id: 'marque-brume', name: 'Marque de la brume', emoji: '🎯', pa: 2, range: [1, 5], kind: 'debuff', debuff: { type: 'mark', turns: 3, value: 0.35 }, anim: 'mark', desc: 'Marque la cible : +35 % de dégâts subis pendant 3 tours.' },
      { id: 'camouflage', name: 'Camouflage', emoji: '🍃', pa: 2, range: [0, 0], kind: 'buff', buff: { type: 'dodge', turns: 2, value: 40 }, anim: 'buff', desc: 'Se fond dans les feuilles : +40 % d’esquive pendant 2 tours.' },
    ],
  },
  arcaniste: {
    id: 'arcaniste', name: 'Arcaniste des braises', emoji: '🔥', color: 0xff8b4d,
    role: 'Dégâts · zones · fragile',
    desc: 'Il a avalé une braise d’étoile pour rire. Depuis, il rote des étincelles et fait tout exploser. De bon cœur, évidemment.',
    hp: 100, pa: 6, pm: 3, power: 16, dodge: 5, crit: 12, init: 10, resPhys: 0, resElem: 10,
    spells: [
      { id: 'etincelle', name: 'Étincelle', emoji: '✨', pa: 2, range: [1, 4], kind: 'dmg', dmg: [8, 13], anim: 'spark', desc: 'Petite étincelle voyageuse : 8-13 dégâts.' },
      { id: 'boule-braise', name: 'Boule de braise', emoji: '☄️', pa: 4, range: [2, 5], kind: 'burn', dmg: [18, 26], burn: { turns: 2, dmg: 4 }, anim: 'fireball', desc: 'Gros rocher chaud : 18-26 + brûlure 4/tour.' },
      { id: 'meteore', name: 'Météore', emoji: '💥', pa: 5, range: [2, 6], kind: 'aoe', dmg: [16, 24], radius: 1, anim: 'meteor', desc: 'Un bout de ciel qui tombe : 16-24 en zone 3×3.' },
      { id: 'mur-braise', name: 'Mur incandescent', emoji: '🧱', pa: 3, range: [1, 4], kind: 'wall', wallTurns: 2, wallDmg: 8, anim: 'wall', desc: 'Dresse 3 braises : bloque et brûle (8) qui traverse, 2 tours.' },
      { id: 'soin-runique', name: 'Soin runique', emoji: '💚', pa: 3, range: [0, 4], kind: 'heal', dmg: [20, 30], ally: true, selfOk: true, anim: 'heal', cleanse: true, desc: 'Soigne 20-30 et dissipe les états négatifs.' },
    ],
  },
  gardien: {
    id: 'gardien', name: 'Gardien des racines', emoji: '🛡️', color: 0x6fbf5a,
    role: 'Tank · protection · mêlée',
    desc: 'Élevé par des chênes très stricts. Son bouclier-graine a déjà arrêté une météorite. Enfin, une petite.',
    hp: 160, pa: 6, pm: 3, power: 12, dodge: 5, crit: 8, init: 8, resPhys: 15, resElem: 0,
    spells: [
      { id: 'frappe-fer', name: 'Frappe de fer', emoji: '🔨', pa: 3, range: [1, 1], kind: 'dmg', dmg: [18, 26], melee: true, anim: 'slash', desc: 'Grand coup de masse-graine : 18-26 au contact.' },
      { id: 'provocation', name: 'Provocation', emoji: '📯', pa: 2, range: [1, 4], kind: 'taunt', tauntTurns: 2, anim: 'shout', desc: '“HÉ ! C’EST MOI LE PAYSAGE !” Les ennemis le visent 2 tours.' },
      { id: 'onde-choc', name: 'Onde de choc', emoji: '🌊', pa: 4, range: [0, 0], kind: 'nova', dmg: [12, 18], anim: 'nova', desc: 'Frappe le sol : 12-18 + repousse les voisins d’1 case.' },
      { id: 'ecorce', name: 'Écorce protectrice', emoji: '🪵', pa: 2, range: [0, 4], kind: 'buff', buff: { type: 'armor', turns: 3, value: 20 }, ally: true, selfOk: true, anim: 'buff', desc: 'Peau d’écorce : +20 % de résistances pendant 3 tours.' },
      { id: 'bastion', name: 'Bastion', emoji: '🏰', pa: 3, range: [0, 0], kind: 'bastion', heal: [8, 12], anim: 'shield', desc: 'Devient un mur : −70 % de dégâts 2 tours + petit soin.' },
    ],
  },
  tisseur: {
    id: 'tisseur', name: 'Tisseur d’esprits', emoji: '✨', color: 0xb48cff,
    role: 'Invocation · soutien · sorts',
    desc: 'Il tricote des esprits avec de la brume et des blagues. Sa Lueur s’appelle Mirette et elle mord les mollets corrompus.',
    hp: 110, pa: 6, pm: 3, power: 12, dodge: 8, crit: 10, init: 12, resPhys: 0, resElem: 5,
    spells: [
      { id: 'esprit-gardien', name: 'Esprit gardien', emoji: '💡', pa: 4, range: [1, 3], kind: 'summon', anim: 'summon', desc: 'Invoque Mirette, petite lueur bagarreuse (40 PV, griffes 8-14).' },
      { id: 'lien-vital', name: 'Lien vital', emoji: '💞', pa: 3, range: [0, 5], kind: 'heal', dmg: [24, 34], ally: true, selfOk: true, selfHalf: true, anim: 'heal', desc: 'Soigne un allié 24-34 et se soigne de la moitié.' },
      { id: 'brume-lente', name: 'Brume lente', emoji: '🌫️', pa: 3, range: [1, 5], kind: 'aoe-slow', dmg: [6, 10], radius: 1, slow: 2, anim: 'mist', desc: 'Brume collante en zone : 6-10 et −2 PM.' },
      { id: 'echange-ame', name: 'Échange d’âme', emoji: '🔀', pa: 3, range: [0, 5], kind: 'swap', heal: [10, 14], ally: true, anim: 'swap', desc: 'Échange sa place avec un allié ; les deux sont soignés.' },
      { id: 'eclat', name: 'Éclat protecteur', emoji: '🔰', pa: 2, range: [0, 4], kind: 'shield', ally: true, selfOk: true, anim: 'shield', desc: 'Éclat d’étoile : −50 % de dégâts subis 2 tours.' },
    ],
  },
};

// ---------- Monstres originaux ----------
export const MONSTERS = {
  mornet: {
    id: 'mornet', name: 'Mornet des Brumes', emoji: '🌀', color: 0x8fa3c8,
    hp: 55, pa: 5, pm: 4, dmg: [8, 13], minR: 2, maxR: 4, dodge: 15, crit: 5,
    init: 12, resPhys: 0, resElem: 10, xp: 22, gold: [5, 12],
    ai: 'skirmish', desc: 'Rapide et timide, crache des dards de brume en gardant ses distances.',
    loot: [{ item: 'eclat-brume', chance: 0.35 }, { item: 'potion-seve', chance: 0.12 }, { item: 'anneau-rosee', chance: 0.06 }],
  },
  cendreux: {
    id: 'cendreux', name: 'Cendreux Gardien', emoji: '🗿', color: 0x9a8a7a,
    hp: 110, pa: 5, pm: 2, dmg: [12, 18], minR: 1, maxR: 1, dodge: 0, crit: 5,
    init: 6, resPhys: 20, resElem: 0, xp: 30, gold: [8, 16],
    ai: 'tank', guardAura: 0.3, desc: 'Un golem de cendres très poli qui protège ses amis (−30 % de dégâts aux alliés adjacents).',
    loot: [{ item: 'coeur-cendre', chance: 0.4 }, { item: 'heaume-graine', chance: 0.07 }, { item: 'potion-seve', chance: 0.15 }],
  },
  luciole: {
    id: 'luciole', name: 'Luciole Vorace', emoji: '🪲', color: 0xffd94a,
    hp: 40, pa: 5, pm: 5, dmg: [6, 11], minR: 1, maxR: 1, dodge: 25, crit: 10,
    init: 15, resPhys: 0, resElem: 0, xp: 18, gold: [10, 20],
    ai: 'hitrun', desc: 'Mord, brille, s’enfuit. Collectionne les trésors des autres. Généreuse en butin !',
    loot: [{ item: 'aile-luciole', chance: 0.5 }, { item: 'fragment-etoile', chance: 0.1 }, { item: 'potion-etoile', chance: 0.1 }, { item: 'or-sup', chance: 0.3 }],
  },
};

// ---------- Objets ----------
// slots : arme, casque, cape, anneau, amulette, bottes | types : conso, ressource, quete, camelote
export const ITEMS = {
  // armes
  'baton-seve': { name: 'Bâton de sève', emoji: '🪄', slot: 'arme', rar: 'com', lvl: 1, bonus: { power: 3 }, price: 50, desc: 'Un bâton qui colle un peu. +3 puissance.' },
  'arc-cristal': { name: 'Arc de cristal pâle', emoji: '🏹', slot: 'arme', rar: 'unco', lvl: 1, bonus: { power: 5, crit: 4 }, price: 90, desc: 'Tendu comme un jour de pluie. +5 puissance, +4 % critique.' },
  'masse-graine': { name: 'Masse-graine', emoji: '🔨', slot: 'arme', rar: 'rare', lvl: 2, bonus: { power: 8, hp: 15 }, price: 180, desc: 'Germera peut-être. +8 puissance, +15 PV.' },
  'lanterne-braise': { name: 'Lanterne de braise', emoji: '🏮', slot: 'arme', rar: 'epic', lvl: 3, bonus: { power: 12, crit: 6 }, price: 320, desc: 'Une braise d’étoile en cage. +12 puissance, +6 % critique.' },
  // casques
  'chapeau-travers': { name: 'Chapeau de travers', emoji: '🎩', slot: 'casque', rar: 'unco', lvl: 1, bonus: { dodge: 5, init: 2 }, price: 70, desc: 'Très chic, très penché. +5 % esquive, +2 initiative.' },
  'capuche-brume': { name: 'Capuche de brume', emoji: '🧥', slot: 'casque', rar: 'rare', lvl: 2, bonus: { dodge: 8, resElem: 6 }, price: 150, desc: 'On ne voit que le nez. +8 % esquive, +6 % ré. élémentaire.' },
  'heaume-graine': { name: 'Heaume-graine', emoji: '🪖', slot: 'casque', rar: 'rare', lvl: 2, bonus: { hp: 25, resPhys: 6 }, price: 160, desc: 'Arroser une fois par semaine. +25 PV, +6 % ré. physique.' },
  // capes
  'cape-feuilles': { name: 'Cape de feuilles', emoji: '🍂', slot: 'cape', rar: 'com', lvl: 1, bonus: { dodge: 4 }, price: 40, desc: 'Rouille en automne. +4 % esquive.' },
  'cape-brume': { name: 'Cape de Brume', emoji: '🌫️', slot: 'cape', rar: 'epic', lvl: 1, bonus: { dodge: 8, pm: 1 }, price: 250, desc: 'Tissée par Sélanire elle-même. +8 % esquive, +1 PM.' },
  'voile-stellaire': { name: 'Voile stellaire', emoji: '🌌', slot: 'cape', rar: 'legend', lvl: 4, bonus: { power: 8, dodge: 10, pm: 1 }, price: 800, desc: 'Un bout de nuit tombé du ciel. +8 puissance, +10 % esquive, +1 PM.' },
  // anneaux / amulettes / bottes
  'anneau-rosee': { name: 'Anneau de rosée', emoji: '💍', slot: 'anneau', rar: 'unco', lvl: 1, bonus: { hp: 15, init: 2 }, price: 65, desc: 'Frais du matin. +15 PV, +2 initiative.' },
  'anneau-veilleur': { name: 'Anneau du Veilleur', emoji: '💎', slot: 'anneau', rar: 'rare', lvl: 2, bonus: { power: 4, crit: 5 }, price: 170, desc: 'Gravé d’une petite lune. +4 puissance, +5 % critique.' },
  'fragment-etoile': { name: 'Fragment d’étoile', emoji: '⭐', slot: 'amulette', rar: 'rare', lvl: 2, bonus: { power: 6 }, price: 200, desc: 'Chaud comme un secret. +6 puissance.' },
  'dent-luciole': { name: 'Dent de luciole', emoji: '🦷', slot: 'amulette', rar: 'unco', lvl: 1, bonus: { crit: 6 }, price: 80, desc: 'Brille dans le noir. +6 % critique.' },
  'bottes-mousse': { name: 'Bottes de mousse', emoji: '🥾', slot: 'bottes', rar: 'com', lvl: 1, bonus: { pm: 0, dodge: 3, init: 1 }, price: 45, desc: 'Silencieuses et spongieuses. +3 % esquive, +1 initiative.' },
  'bottes-sentier': { name: 'Bottes du sentier', emoji: '👢', slot: 'bottes', rar: 'rare', lvl: 3, bonus: { pm: 1, dodge: 5 }, price: 220, desc: 'Elles connaissent le chemin. +1 PM, +5 % esquive.' },
  // consommables
  'potion-seve': { name: 'Potion de sève', emoji: '🧪', type: 'conso', rar: 'com', lvl: 1, heal: [35, 45], price: 15, desc: 'Goût de pin et de courage. Soigne 35-45 PV (hors combat ou via inventaire).' },
  'potion-etoile': { name: 'Potion d’étoile', emoji: '🌟', type: 'conso', rar: 'rare', lvl: 2, heal: [70, 90], price: 40, desc: 'Pétillante ! Soigne 70-90 PV.' },
  'elixir-pas': { name: 'Élixir de pas légers', emoji: '🍵', type: 'conso', rar: 'unco', lvl: 1, buff: { type: 'pm', turns: 99, value: 2 }, price: 25, desc: 'Donne des jambes de biche : +2 PM pour le combat en cours.' },
  'baume-clair': { name: 'Baume clair', emoji: '🧴', type: 'conso', rar: 'com', lvl: 1, cleanse: true, price: 12, desc: 'Dissipe brûlure, marque et lenteur.' },
  // ressources & quête
  'chapeau-luisant': { name: 'Chapeau luisant', emoji: '🍄', type: 'ressource', rar: 'com', lvl: 1, price: 6, desc: 'Un champignon qui fait veilleuse. Pilpin en raffole.' },
  'eclat-brume': { name: 'Éclat de brume', emoji: '💧', type: 'ressource', rar: 'com', lvl: 1, price: 5, desc: 'De la brume solidifiée. Les artisans en font des vitres.' },
  'aile-luciole': { name: 'Aile de luciole', emoji: '🪶', type: 'ressource', rar: 'unco', lvl: 1, price: 12, desc: 'Vibre encore un peu. Très demandée.' },
  'coeur-cendre': { name: 'Cœur de cendre', emoji: '🪨', type: 'ressource', rar: 'unco', lvl: 1, price: 14, desc: 'Tiède et lourd. Les Cendreux en avaient un, paraît-il.' },
  'poussiere-etoile': { name: 'Poussière d’étoile', emoji: '✨', type: 'quete', rar: 'epic', lvl: 1, price: 0, desc: 'Scintille et chuchote. À rapporter à Sélanire.' },
  'or-sup': { name: 'Bourse rebondie', emoji: '👛', type: 'camelote', rar: 'com', lvl: 1, gold: 25, price: 25, desc: 'Une bourse “empruntée” par une luciole. Revendable.' },
};
export const RAR_LABEL = { com: 'commun', unco: 'inhabituel', rare: 'rare', epic: 'épique', legend: 'légendaire' };
export const SLOTS = ['arme', 'casque', 'cape', 'anneau', 'amulette', 'bottes'];
export const SLOT_EMOJI = { arme: '🗡️', casque: '⛑️', cape: '🧥', anneau: '💍', amulette: '📿', bottes: '🥾' };

// ---------- Boutique de Pilpin ----------
export const SHOP_STOCK = ['potion-seve', 'potion-etoile', 'elixir-pas', 'baume-clair', 'baton-seve', 'bottes-mousse', 'arc-cristal'];

// ---------- PNJ ----------
export const NPCS = {
  selanire: { name: 'Sélanire', title: 'Gardienne du camp', emoji: '🔮', color: 0x9f8fff },
  pilpin: { name: 'Pilpin', title: 'Marchand bavard', emoji: '🧺', color: 0xffb13d },
  tombelon: { name: 'Vieux Tombelon', title: 'Cartographe excentrique', emoji: '🗺️', color: 0x6fd3a7 },
};

// ---------- Quêtes ----------
export const QUESTS = {
  coeur: {
    id: 'coeur', kind: 'main', name: 'Le cœur de la brume',
    intro: 'Sélanire vous fixe comme si vous étiez déjà en retard : « La brume tousse, les bois grincent. Trois créatures corrompues rôdent — leur éclat violet les trahit. Rapportez-moi leur poussière d’étoile, et vite : mon thé refroidit. »',
    steps: ['Parler à Sélanire', 'Vaincre 3 créatures corrompues (0/3)', 'Récupérer 1 poussière d’étoile (0/1)', 'Rapporter la poussière à Sélanire'],
    reward: { xp: 80, gold: 60, items: ['potion-seve', 'potion-seve', 'cape-brume'], unlock: 'voile' },
    rewardTxt: '80 XP, 60 🪙, 2 potions, la Cape de Brume et l’accès au Voile Profond.',
  },
  chapeaux: {
    id: 'chapeaux', kind: 'side', name: 'Des chapeaux pour Pilpin',
    intro: 'Pilpin se lamente : « Mes chapeaux luisants ! Envolés ! Enfin… restés dans la clairière. Ramassez-m’en 4 et je vous paie en or ET en ragots. »',
    steps: ['Parler à Pilpin', 'Cueillir 4 chapeaux luisants (0/4)', 'Rapporter à Pilpin'],
    reward: { xp: 40, gold: 40, items: ['elixir-pas'] },
    rewardTxt: '40 XP, 40 🪙 et un Élixir de pas légers.',
  },
  carto: {
    id: 'carto', kind: 'side', name: 'Cartographier le voile',
    intro: 'Tombelon brandit une carte à l’envers : « TOUT est faux, jeune pousse ! Vérifiez le Pont, l’entrée du Donjon et la Pierre de souvenir, et je corrigerai… peut-être dans le bon sens. »',
    steps: ['Parler à Tombelon', 'Visiter : Pont, Donjon, Pierre (0/3)', 'Rapporter à Tombelon'],
    reward: { xp: 50, gold: 20, items: ['anneau-veilleur'] },
    rewardTxt: '50 XP, 20 🪙 et l’Anneau du Veilleur.',
  },
};
