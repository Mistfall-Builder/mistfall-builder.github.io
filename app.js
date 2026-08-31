/* Mistfall Builder — l'onglet Build, dans un navigateur.
 *
 * Portage fidèle du moteur de l'outil de bureau : mêmes scores, même
 * recherche locale, même pose de gemmes (gloutonne pour chercher, exacte pour
 * finaliser), même codec. Rien de ce qui touche au marché, aux prix ou à l'or.
 *
 * Tout se passe côté navigateur : aucune donnée n'est envoyée nulle part.
 */
'use strict';

let D = null;                       // les données du jeu
const cibles = new Map();           // affixe -> niveau visé
const vinManuel = new Map();        // affixe -> points de vin imposés

/* TE GUIDER, QUAND IL LE FAUT — et seulement là.
 *
 * Une cible dit « il m'en faut tant ». Ça ne dit pas si un affixe qui tombe
 * gratuitement est bienvenu ou parasite : le Sky Piercer offert à un mage
 * n'intéresse personne, alors qu'un Vitality gratuit est toujours bon à
 * prendre. Sans cette nuance, l'outil proposait les deux à égalité.
 *
 * Trois états, un seul bouton, et le neutre par défaut : qui ne veut pas
 * s'en occuper ne voit rien changer.
 *   neutre  — l'outil décide seul (comportement d'avant)
 *   bonus   — « si c'est gratuit, j'en veux » : compte double en suggestion
 *   non     — « ne me le propose pas » : jamais suggéré
 */
/* ======================================================================
   LES PIÈCES VERROUILLÉES

   « Celle-là je l'ai déjà, elle ne bouge pas. » On règle ses affixes petit
   à petit, et sans cadenas chaque recalcul rebat tout le stuff : la pièce
   qu'on venait de trouver en jeu disparaissait au clic suivant.

   Un verrou fige l'objet, SES gemmes et SON inné. Le moteur construit
   autour : il ne remplace pas la pièce, ne la dégrade pas à l'allègement,
   et ne touche pas à ses sertissures.

   Les verrous ne survivent pas à un changement de contexte — charger un
   build, importer un code, changer de classe ou d'arme les libère tous.
   Garder un plastron de Mercenary verrouillé en passant au Seer n'aurait
   aucun sens, et le silence sur ce point serait pire que la perte.
   ====================================================================== */
const verrouilles = new Map();      // slot -> { item, gemmes: [gemme|null, …] }

function verrousObjet() {
  const o = {};
  for (const [slot, v] of verrouilles.entries()) o[slot] = v;
  return Object.keys(o).length ? o : undefined;
}

function libererVerrous(pourquoi) {
  if (!verrouilles.size) return;
  verrouilles.clear();
  const n = $('noteVerrous');
  if (n) n.textContent = pourquoi ? t(pourquoi) : '';
}

/* LA PIÈCE QUE LA RECHERCHE AUTOMATIQUE NE PEUT PAS TROUVER.
 *
 * Holy et Prismatic (paliers 7 et 8) n'ont AUCUN objet dans les données
 * récupérées — ni le codec officiel, ni les captures communautaires : le
 * jeu les propose, personne ne les a indexés. Le moteur ne peut donc rien
 * chercher à ces paliers, quelle que soit la classe ou l'emplacement.
 *
 * La sortie n'est pas d'attendre une source qui n'existe pas : c'est de
 * décrire la pièce qu'on a réellement sous les yeux (nom, inné, emplacements
 * de gemme) et de la poser dans `verrouilles`, exactement comme le cadenas
 * du paperdoll. `construireAuGrade` l'impose alors telle quelle (voir
 * `bloque[slot].item`), et `assembler` ne fige QUE les gemmes déjà posées
 * (`figees`) — un emplacement resté vide dans le formulaire reste libre à la
 * recherche. Le reste du stuff se calcule normalement autour. */
const TYPES_GEMME_MANUEL = [
  [1, 'Agate'], [2, 'Amethyst'], [3, 'Moonstone'], [4, 'Peridot'], [-1, 'Universal'],
];

function poserPieceManuelle() {
  if (!D) return;
  const selSlot = $('manuelSlot');
  if (selSlot) {
    remplirSelect(selSlot, D.ordreSlots.map((s) => [s, D.nomsSlots[s] || s]), selSlot.value);
  }
  const selPalier = $('manuelPalier');
  if (selPalier) {
    remplirSelect(selPalier,
      Object.keys(D.raretes).map(Number).sort((a, b) => a - b)
        .map((g) => [g, D.raretes[String(g)]]),
      selPalier.value || '7');
  }
  const selInne = $('manuelInne');
  if (selInne) {
    const noms = Object.keys(D.affixes).sort((a, b) => libelleAffixe(a).localeCompare(libelleAffixe(b)));
    remplirSelect(selInne, [['', t('manuel.aucun')]].concat(noms.map((n) => [n, libelleAffixe(n)])),
      selInne.value);
  }
  const optionsSocket = [['', t('manuel.aucun')]].concat(
    TYPES_GEMME_MANUEL.flatMap(([type, nom]) => [
      [`${type},1`, `${nom} I`],
      [`${type},2`, `${nom} II`],
    ]),
  );
  for (const id of ['manuelSocket1', 'manuelSocket2']) {
    const sel = $(id);
    if (sel) remplirSelect(sel, optionsSocket, sel.value);
  }
}

function verrouillerPieceManuelle() {
  const slot = $('manuelSlot').value;
  const nom = $('manuelNom').value.trim();
  const note = $('manuelNote');
  if (!slot || !nom) {
    if (note) { note.className = 'ko'; note.textContent = t('manuel.nomManquant'); }
    return;
  }
  const grade = Number($('manuelPalier').value) || 1;
  const inne = $('manuelInne').value || null;
  const sockets = [$('manuelSocket1').value, $('manuelSocket2').value]
    .filter(Boolean)
    .map((v) => v.split(',').map(Number));
  const it = {
    id: `manuel-${slot}-${Date.now()}`, n: nom, g: grade,
    s: sockets, i: inne, aff: 0, at: {}, d: '', ic: null,
  };
  verrouilles.set(slot, { item: it, gemmes: sockets.map(() => null) });
  majNoteVerrous();
  if (note) {
    note.className = 'ok';
    note.textContent = t('manuel.pose', { nom, slot: D.nomsSlots[slot] || slot });
  }
}

const prefs = new Map();            // affixe -> 'bonus' | 'non'
const CYCLE_PREF = [undefined, 'bonus', 'non'];

/* Le tri par préférence, partagé par la colonne de gauche et la grille
   plein écran. Marquer un affixe d'une étoile ne servait à rien tant
   qu'on ne pouvait pas ensuite ne voir que ceux-là. */
let filtrePref = '';                // '' | 'bonus' | 'non' | 'vise'
function passeFiltrePref(nom) {
  if (!filtrePref) return true;
  if (filtrePref === 'vise') return cibles.has(nom);
  return prefs.get(nom) === filtrePref;
}
let dernier = null;                 // dernier build calculé

const $ = (id) => document.getElementById(id);
const SLOT_ARME = 'weapon';

/* ------------------------------------------------------------------ codec */
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

class Ecrivain {
  constructor() { this.octets = []; this.pos = 0; }
  ecrire(largeur, valeur) {
    for (let i = 0; i < largeur; i += 1) {
      while ((this.pos >> 3) >= this.octets.length) this.octets.push(0);
      if ((valeur >>> i) & 1) this.octets[this.pos >> 3] |= 1 << (this.pos & 7);
      this.pos += 1;
    }
  }
}
class Lecteur {
  constructor(octets) { this.octets = octets; this.pos = 0; }
  lire(largeur) {
    let v = 0;
    for (let i = 0; i < largeur; i += 1) {
      const o = this.pos >> 3;
      if (o >= this.octets.length) throw new Error(t('code.tronque'));
      v |= ((this.octets[o] >> (this.pos & 7)) & 1) << i;
      this.pos += 1;
    }
    return v >>> 0;
  }
}

function versBase62(octets) {
  let n = 0n;
  for (const o of octets) n = (n << 8n) | BigInt(o);
  if (n === 0n) return '0';
  let s = '';
  while (n > 0n) { s = B62[Number(n % 62n)] + s; n /= 62n; }
  return s;
}
function depuisBase62(code) {
  let n = 0n;
  for (const c of code.trim()) {
    const i = B62.indexOf(c);
    if (i < 0) throw new Error(`caractère « ${c} » hors base62`);
    n = n * 62n + BigInt(i);
  }
  const octets = [];
  while (n > 0n) { octets.unshift(Number(n & 255n)); n >>= 8n; }
  return octets;
}

function encoderCode(classe, objets) {
  const par = D.codec.equipParClasseEtSlot[String(classe)];
  if (!par) throw new Error(`classe ${classe} inconnue`);
  const e = new Ecrivain();
  e.ecrire(24, D.codec.head);
  e.ecrire(10, D.codec.version);
  e.ecrire(4, classe);
  for (const slot of D.codec.slots) {
    const liste = par[String(slot)] || [0];
    const entree = objets[slot];
    if (!entree || !entree.cfg) { e.ecrire(10, 0); continue; }
    const idx = liste.indexOf(Number(entree.cfg));
    if (idx < 0) throw new Error(`objet ${entree.cfg} absent de l'emplacement ${slot}`);
    e.ecrire(10, idx);
    const trous = D.codec.trous[String(entree.cfg)] || 0;
    for (let i = 0; i < trous; i += 1) {
      const g = (entree.gemmes || [])[i];
      e.ecrire(10, g ? Math.max(0, D.codec.gemIds.indexOf(Number(g))) : 0);
    }
  }
  return versBase62(e.octets);
}

function decoderCode(code) {
  const L = new Lecteur(depuisBase62(code));
  if (L.lire(24) !== D.codec.head) throw new Error("en-tête inattendu : ce n'est pas un code Mistfall");
  const version = L.lire(10);
  if (version !== D.codec.version) throw new Error(`version ${version} inconnue`);
  const classe = L.lire(4);
  const par = D.codec.equipParClasseEtSlot[String(classe)] || {};
  const out = [];
  for (const slot of D.codec.slots) {
    const liste = par[String(slot)] || [0];
    const idx = L.lire(10);
    if (idx >= liste.length) throw new Error(`index ${idx} hors table (emplacement ${slot})`);
    const cfg = liste[idx];
    const gemmes = [];
    if (cfg) {
      const trous = D.codec.trous[String(cfg)] || 0;
      for (let i = 0; i < trous; i += 1) gemmes.push(D.codec.gemIds[L.lire(10)]);
    }
    out.push({ slot, cfg, gemmes });
  }
  return { classe, emplacements: out };
}

/* ----------------------------------------------------------------- moteur */
const gemParId = new Map();
const affixVersGemmes = new Map();

function socketAccepte(s, type, niveau) {
  return (s.type === -1 || s.type === type) && niveau <= s.level;
}

function plafond(nom) { return (D.affixes[nom] || {}).cap || 7; }
function palier(nom) { return (D.affixes[nom] || {}).palier || null; }

function couvertureEffective(couvert, want, priorite) {
  const paliers = new Set();
  for (const [nom, lvl] of Object.entries(want)) {
    const p = palier(nom);
    if (p && p <= lvl && (couvert[nom] || 0) >= p) paliers.add(nom);
  }
  if (!priorite || !priorite.length) {
    let t = 0;
    for (const [nom, lvl] of Object.entries(want)) {
      t += Math.min(couvert[nom] || 0, lvl) + (paliers.has(nom) ? D.poidsPalier : 0);
    }
    return t;
  }
  const rang = new Map(priorite.map((n, i) => [n, i]));
  let t = 0;
  for (const [nom, lvl] of Object.entries(want)) {
    const poids = Math.pow(16, priorite.length - (rang.has(nom) ? rang.get(nom) : priorite.length));
    t += (Math.min(couvert[nom] || 0, lvl) + (paliers.has(nom) ? D.poidsPalier : 0)) * poids;
  }
  return t;
}

function surplus(couvert, want) {
  let total = 0, compte = 0;
  for (const v of Object.values(couvert)) total += v;
  for (const [nom, lvl] of Object.entries(want)) compte += Math.min(couvert[nom] || 0, lvl);
  return total - compte;
}

/* Pose gloutonne — port exact de _place_gems. */
function poserGemmesGlouton(sockets, want, couvert) {
  const options = {};
  for (const nom of Object.keys(want)) {
    const s = new Set((affixVersGemmes.get(nom) || []).map((g) => g.t));
    options[nom] = s.size || 1;
  }
  const reste = (n) => (want[n] || 0) - (couvert[n] || 0);

  for (const tier of [2, 1]) {
    const bloques = new Set();
    for (;;) {
      const besoins = Object.keys(want).filter((n) => !bloques.has(n) && reste(n) > 0);
      if (!besoins.length) break;
      const rarete = {};
      for (const nom of besoins) {
        let c = 0;
        for (const g of affixVersGemmes.get(nom) || []) {
          if (g.l !== tier) continue;
          for (const s of sockets) if (!s.gem && socketAccepte(s, g.t, tier)) c += 1;
        }
        if (c) rarete[nom] = c;
      }
      const noms = Object.keys(rarete);
      if (!noms.length) break;
      noms.sort((a, b) => (rarete[a] - rarete[b]) || (options[a] - options[b]) || (a < b ? -1 : 1));
      const nom = noms[0];

      const candidats = (affixVersGemmes.get(nom) || []).filter((g) => g.l === tier).slice();
      candidats.sort((x, y) => {
        const val = (g) => g.a.reduce((s, a) => s + (reste(a) > 0 ? 1 / (options[a] || 1) : 0), 0);
        return val(y) - val(x);
      });

      let pose = false;
      for (const g of candidats) {
        if (g.a.some((a) => (couvert[a] || 0) + 1 > plafond(a))) continue;
        for (const s of sockets) {
          if (s.gem || !socketAccepte(s, g.t, g.l)) continue;
          s.gem = g;
          for (const a of g.a) couvert[a] = (couvert[a] || 0) + 1;
          pose = true; break;
        }
        if (pose) break;
      }
      if (!pose) bloques.add(nom);
    }
  }
  return couvert;
}

/* Pose EXACTE — programmation dynamique, port de gemmes_exactes. */
const LIMITE_ETATS = 400000;
function poserGemmesExact(sockets, want, couvert) {
  const noms = Object.keys(want).filter((n) => want[n] > 0);
  if (!noms.length) return true;
  if (noms.length > 12) return false;
  const libres = sockets.filter((s) => !s.gem);
  if (!libres.length) return true;
  if (libres.length > 32) return false;

  const caps = noms.map((n) => want[n]);
  let total = 1;
  for (const c of caps) { total *= c + 1; if (total > LIMITE_ETATS) return false; }
  const strides = [];
  let acc = 1;
  for (let i = caps.length - 1; i >= 0; i -= 1) { strides[i] = acc; acc *= caps[i] + 1; }

  // profils par (type, tier) d'emplacement
  const cache = new Map();
  const profilsDe = (s) => {
    const cle = `${s.type},${s.level}`;
    if (cache.has(cle)) return cache.get(cle);
    const vus = new Map();
    for (const g of D.gemmes) {
      if (!socketAccepte(s, g.t, g.l)) continue;
      const d = new Array(noms.length).fill(0);
      let utile = false;
      for (const a of g.a) {
        const i = noms.indexOf(a);
        if (i >= 0) { d[i] += 1; utile = true; }
      }
      if (!utile) continue;
      const k = d.join(',');
      if (!vus.has(k)) vus.set(k, { d, gem: g });
    }
    vus.set(new Array(noms.length).fill(0).join(','), { d: new Array(noms.length).fill(0), gem: null });
    const liste = [...vus.values()];
    cache.set(cle, liste);
    return liste;
  };

  const INF = Infinity;
  let table = new Float64Array(total).fill(INF);
  let depart = 0;
  noms.forEach((n, i) => { depart += Math.min(couvert[n] || 0, caps[i]) * strides[i]; });
  table[depart] = 0;

  const etapes = [table];
  const choix = [];
  for (const s of libres) {
    const profils = profilsDe(s);
    const suivant = new Float64Array(total).fill(INF);
    const prise = new Int16Array(total).fill(-1);
    const prec = etapes[etapes.length - 1];
    for (let p = 0; p < profils.length; p += 1) {
      const d = profils[p].d;
      for (let idx = 0; idx < total; idx += 1) {
        const v = prec[idx];
        if (v === INF) continue;
        let cible = idx;
        for (let a = 0; a < caps.length; a += 1) {
          if (!d[a]) continue;
          const chiffre = Math.floor(idx / strides[a]) % (caps[a] + 1);
          const neuf = Math.min(caps[a], chiffre + d[a]);
          cible += (neuf - chiffre) * strides[a];
        }
        if (v < suivant[cible]) { suivant[cible] = v; prise[cible] = p; }
      }
    }
    etapes.push(suivant);
    choix.push({ profils, prise });
  }

  // meilleur état final
  //
  // « QUE LE VIN NE PEUT PAS COMBLER » PASSE AVANT LE SCORE, PAS APRES.
  //
  // couvertureEffective plafonne chaque affixe à sa cible et ajoute un tout
  // petit bonus (D.poidsPalier, 0.01) quand un affixe franchit son palier.
  // Ce bonus est cense departager des etats par ailleurs equivalents -- pas
  // decider a la place du reste. Or un etat qui sacrifie ENTIEREMENT un
  // affixe (0 gemme dessus) pour en faire franchir le palier de QUATRE
  // AUTRES peut battre de 0,02 point un etat qui, lui, couvre les SIX cibles
  // au prix d'un seul palier manque. Mesure sur un stuff reel : le premier
  // etat notait 24,04 (Stoic laisse a 2 sur 5, hors de portee du vin qui ne
  // rattrape que 2), le second 24,02 (les six cibles servies, vin compris)
  // -- le meilleur SCORE gagnait, et le build echouait alors qu'un stuff
  // identique, gemme differemment, marchait.
  //
  // Le vin ne rattrapant que 2 points par affixe, un manque de plus de 2
  // est un ECHEC GARANTI sur cet affixe, quel que soit le score par
  // ailleurs. C'est donc CE critere qui doit trancher en premier ; le score
  // (paliers compris) ne departage plus qu'entre etats a egalite de
  // rattrapabilite.
  const finale = etapes[etapes.length - 1];
  let meilleur = -1, meilleureNote = -Infinity, meilleurSecours = -Infinity;
  for (let idx = 0; idx < total; idx += 1) {
    if (finale[idx] === INF) continue;
    const c = {};
    noms.forEach((n, i) => { c[n] = Math.floor(idx / strides[i]) % (caps[i] + 1); });
    const note = couvertureEffective(c, want, noms);
    let secours = 0;
    for (const [n, lvl] of Object.entries(want)) {
      secours -= Math.max(0, (lvl - (c[n] || 0)) - 2);
    }
    if (secours > meilleurSecours || (secours === meilleurSecours && note > meilleureNote)) {
      meilleureNote = note; meilleurSecours = secours; meilleur = idx;
    }
  }
  if (meilleur < 0) return false;

  // remontée
  const poses = new Array(libres.length).fill(null);
  let etat = meilleur;
  for (let r = libres.length - 1; r >= 0; r -= 1) {
    const p = choix[r].prise[etat];
    if (p < 0) return false;
    const { d, gem } = choix[r].profils[p];
    poses[r] = gem;
    // antécédent : on cherche celui de coût minimal parmi les possibles
    let source = etat;
    for (let a = 0; a < caps.length; a += 1) {
      if (!d[a]) continue;
      const chiffre = Math.floor(etat / strides[a]) % (caps[a] + 1);
      const avant = chiffre < caps[a] ? chiffre - d[a] : Math.max(0, caps[a] - d[a]);
      if (avant < 0) return false;
      source += (avant - chiffre) * strides[a];
    }
    etat = source;
  }
  libres.forEach((s, i) => {
    const g = poses[i];
    if (!g) return;
    s.gem = g;
    for (const a of g.a) couvert[a] = (couvert[a] || 0) + 1;
  });
  return true;
}

/* Des verrous vers la forme attendue par `assembler`. */
function figeesDe(verrous) {
  const f = {};
  for (const [slot, v] of Object.entries(verrous || {})) f[slot] = v.gemmes || [];
  return f;
}

/* CE QUE LE STUFF DOIT FOURNIR : la cible MOINS le vin.
 *
 * La règle vaut partout, et c'était le problème : `construire` l'appliquait,
 * les deux gestionnaires de clic — appliquer une suggestion, poser une pièce
 * interchangeable — reposaient les gemmes sur les cibles pleines. Le moteur
 * dépensait alors des gemmes sur des niveaux déjà payés par le vin, et la
 * revérification qui suit déclarait perdue une cible que l'outil venait
 * lui-même de valider. Une seule fonction, donc, plutôt que trois copies. */
function ciblesPourStuff(cibleMap, vinPoints) {
  const vp = vinPoints || new Map();
  return Object.fromEntries([...cibleMap.entries()]
    .map(([n, l]) => [n, l - (vp.get(n) || 0)])
    .filter(([, l]) => l > 0));
}

/* `figees` fige les gemmes d'un emplacement : { slot: [gemme|null, …] }.
   C'est ce qui rend un verrou honnête — verrouiller une pièce sans ses
   gemmes la laisserait se faire re-sertir au tour suivant, et le joueur
   qui a deja pose ses gemmes en jeu verrait le site lui en proposer
   d'autres. Les deux poseurs ne remplissent que les emplacements VIDES :
   pre-remplir suffit donc a les mettre hors de portee. */
function assembler(slotItems, want, exact, figees) {
  const sockets = [];
  const couvert = {};
  const sources = [];
  for (const [slot, it] of Object.entries(slotItems)) {
    if (!it) continue;
    const fig = figees && figees[slot];
    it.s.forEach((sk, idx) => {
      const g = fig ? (fig[idx] || null) : null;
      sockets.push({ slot, index: idx, type: sk[0], level: sk[1], gem: g });
      if (g) for (const a of g.a) couvert[a] = (couvert[a] || 0) + 1;
    });
    if (it.i) { couvert[it.i] = (couvert[it.i] || 0) + 1; sources.push({ slot, affixe: it.i }); }
  }
  let pose = false;
  if (exact) pose = poserGemmesExact(sockets, want, couvert);
  if (!pose) poserGemmesGlouton(sockets, want, couvert);
  return { sockets, couvert, sources };
}

function scoreObjet(it, want) {
  let score = 0;
  if (it.i && (want[it.i] || 0) > 0) score += 3;
  const types = new Set();
  for (const nom of Object.keys(want)) {
    for (const g of affixVersGemmes.get(nom) || []) types.add(g.t);
  }
  for (const sk of it.s) {
    if (sk[0] === -1) score += 2;
    else if (types.has(sk[0])) score += 1;
    if ((sk[0] === -1 || types.has(sk[0])) && sk[1] === 2) score += 0.5;
  }
  return score;
}

/* MEME CHOSE, MAIS SANS LE BONUS D'INNÉ.
 *
 * scoreObjet() préfère une pièce à inné correspondant (+3), même face à une
 * variante à deux encoches qui, elle, peut servir DEUX affixes visés au
 * lieu d'un seul figé. Quand aucune pièce de la classe ne porte certains
 * affixes visés en inné (Unyielding et Valor n'existent nulle part en inné
 * pour un Withered Knight, uniquement en gemme), ce +3 pousse le départ
 * glouton vers des pièces qui ne PEUVENT pas les couvrir, au prix des
 * encoches qui, elles, le pourraient.
 *
 * Sert uniquement à fournir UN départ de plus à la montée locale (voir
 * DEPART_ENCOCHES ci-dessous) : la montée reste libre de revenir aux pièces
 * à inné si elles s'avèrent meilleures une fois les gemmes vraiment posées.
 */
function scoreEncoches(it, want) {
  const types = new Set();
  for (const nom of Object.keys(want)) {
    for (const g of affixVersGemmes.get(nom) || []) types.add(g.t);
  }
  let score = 0;
  for (const sk of it.s) {
    if (sk[0] === -1) score += 2;
    else if (types.has(sk[0])) score += 1;
    if ((sk[0] === -1 || types.has(sk[0])) && sk[1] === 2) score += 0.5;
  }
  return score;
}

/* CE QUE DONNE UNE PIÈCE, RÉSUMÉ EN UN OU DEUX AXES.
 *
 * Auditée sur TOUTE la base d'objets, pas seulement Ring/Necklace : quatre
 * emplacements ont plusieurs pièces du même palier qui ne se distinguent que
 * par leur stat brute — jamais par leurs affixes ni leurs trous. Mais pas de
 * la même façon partout :
 *
 *   - Ring, Necklace : DEUX axes varient — le stat principal (Attaque ou
 *     Vie) ET l'élément (Physique ou Magique). Quatre déclinaisons.
 *   - Gauntlets, Boots : UN seul axe varie, l'élément. Leur stat, lui, ne
 *     se choisit pas : Gauntlets porte toujours Attaque, Boots porte
 *     toujours Attaque ET Vie ensemble. Deux déclinaisons.
 *   - Helmet, Clothes, Pants : aucune variance, une seule combinaison
 *     existe. Rien à proposer, ils ne portent pas ce réglage.
 *
 * `saveurDe` (les deux axes) sert Ring/Necklace ; `elementDe` (l'axe seul)
 * sert Gauntlets/Boots. Un palier bas (2) n'a pas encore la déclinaison
 * élémentaire : les deux rendent alors `null`, et le choix de l'utilisateur
 * ne matche rien à ce palier-là (voir poolSlot, qui revient au pool complet
 * plutôt que de bloquer une recherche sur un choix sans objet ici). */
const SAVEUR_STAT = { attack: 'atk', maxHealth: 'hp' };
const SAVEUR_ELEM = {
  physicalIncrease: 'phys', physicalReduction: 'phys',
  magicalIncrease: 'mag', magicalReduction: 'mag',
};
const SLOTS_SAVEUR_COMPLET = ['Ring', 'Necklace'];
const SLOTS_SAVEUR_ELEMENT = ['Gauntlets', 'Boots'];
const SLOTS_SAVEUR = [...SLOTS_SAVEUR_COMPLET, ...SLOTS_SAVEUR_ELEMENT];

/* L'ELEMENT PAR DEFAUT DE CHAQUE CLASSE, POUR RING/NECKLACE/GAUNTLETS/
 * BOOTS QUAND RIEN N'EST CHOISI A LA MAIN. Verifie sur les degats reels de
 * chaque competence (skills.js, champ `coups[].type`) plutot que suppose :
 * Sorcerer (Staff) et Seer (Catalyst ET Mace) sont magiques a 100% des
 * coups types ; Mercenary/Blackarrow/Shadowstrix/Withered Knight sont
 * physiques. Un choix manuel sur un emplacement l'emporte toujours -- voir
 * poolSlot, qui n'applique ce defaut que si `saveurs[slot]` est vide. */
const ELEMENT_PAR_CLASSE = {
  10: 'phys', 11: 'mag', 12: 'phys', 13: 'phys', 14: 'mag', 15: 'phys',
};

function elementDe(it) {
  const at = (it && it.at) || {};
  for (const cle of Object.keys(at)) if (SAVEUR_ELEM[cle]) return SAVEUR_ELEM[cle];
  return null;
}

function saveurDe(it) {
  const at = (it && it.at) || {};
  let stat = null, elem = null;
  for (const cle of Object.keys(at)) {
    if (SAVEUR_STAT[cle]) stat = SAVEUR_STAT[cle];
    if (SAVEUR_ELEM[cle]) elem = SAVEUR_ELEM[cle];
  }
  return stat && elem ? `${stat}-${elem}` : null;
}

/* Le bon descripteur pour le bon emplacement — voir le commentaire plus
 * haut. Renvoie `null` pour un emplacement sans variance (rien ne matche
 * jamais, donc le filtre de poolSlot retombe toujours sur le pool complet,
 * ce qui est exactement le comportement souhaité). */
function descripteurSaveur(slot, it) {
  if (SLOTS_SAVEUR_ELEMENT.includes(slot)) return elementDe(it);
  if (SLOTS_SAVEUR_COMPLET.includes(slot)) return saveurDe(it);
  return null;
}

/* LE POOL D'UN EMPLACEMENT, AVEC SA RARETE IMPOSEE.
 *
 * `raretes[slot]` n'est plus un plancher mais un choix EXACT : « des bottes
 * bleues », pas « au moins bleues ». Le plancher ne savait pas exprimer
 * « tout en Excellent sauf l'arme en Epic et le plastron en Legendary »,
 * puisqu'il ne connaissait qu'un seul cran pour tous les emplacements coches
 * — et « monter en priorite » disait deja qu'on montait, ce qui rendait le
 * choix du cran redondant autant qu'ambigu.
 *
 * `saveurs`, LUI, EST FACULTATIF ET NE FILTRE QUE LA RECHERCHE INITIALE.
 * Passé uniquement par construire()/alleger() — jamais par alternatives(),
 * suggestions() ou gainsParPiece(), qui continuent de tout montrer après
 * coup. Si le palier réellement atteint n'offre pas la saveur demandée
 * (voir saveurDe), on revient au pool complet plutôt que de bloquer une
 * recherche sur un choix qui n'a pas de sens à ce cran-là. */
function poolSlot(classe, slot, arme, grade, mixte, raretes, saveurs) {
  const impose = raretes && raretes[slot];
  const pool = impose ? poolDe(classe, slot, arme, impose, false)
                       : poolDe(classe, slot, arme, grade, mixte);
  // PAS DE `saveurs` DU TOUT (alternatives/suggestions/gainsParPiece) :
  // ces appels montrent TOUJOURS tout, le defaut de classe ci-dessous ne
  // les concerne pas -- voir le commentaire au-dessus de la fonction.
  if (!saveurs) return pool;
  const voulue = saveurs[slot];
  if (voulue) {
    const filtre = pool.filter((it) => descripteurSaveur(slot, it) === voulue);
    return filtre.length ? filtre : pool;
  }
  // RIEN CHOISI A LA MAIN : l'element qui correspond aux degats de la
  // classe (magique pour Sorcerer/Seer, physique pour les autres). On ne
  // filtre que sur l'element (`elementDe`, pas `descripteurSaveur`) : la
  // classe n'impose pas de preference attaque/vie, seulement physique ou
  // magique -- filtrer sur les deux axes aurait ecarte a tort les pieces
  // qui portent le bon element avec l'autre stat.
  if (SLOTS_SAVEUR.includes(slot)) {
    const elemVoulu = ELEMENT_PAR_CLASSE[classe];
    if (elemVoulu) {
      const filtre = pool.filter((it) => elementDe(it) === elemVoulu);
      if (filtre.length) return filtre;
    }
  }
  return pool;
}

function poolDe(classe, slot, arme, grade, mixte) {
  const morceaux = [];
  for (let g = grade; g <= 6; g += 1) {
    const cle = `${classe}|${slot}|${slot === SLOT_ARME ? (arme || '') : ''}|${g}`;
    const p = D.objets[cle];
    if (!p) continue;
    morceaux.push(...p);
    if (!mixte) break;
  }
  return morceaux;
}

// Combien de departs secoues au PLUS, en rareté UNIQUE seulement (voir plus
// bas pourquoi le panache n'en profite pas). Un plafond haut ne coute cher
// QUE sur les cas difficiles : la boucle qui l'utilise s'arrete des que les
// cibles sont couvertes, donc un cas facile n'en consomme jamais plus de
// deux ou trois avant de s'arreter tout seul.
const RELANCES_RARETE_UNIQUE = 20;

function construireAuGrade(classe, arme, cibleListe, grade, mixte, planchers, affinite,
                           depart, verrous, saveurs) {
  const want = Object.fromEntries(cibleListe);
  // Les pièces verrouillees : leur objet est impose, leurs gemmes figees,
  // et la recherche n'a plus le droit d'y toucher.
  const bloque = verrous || {};
  const figees = {};
  for (const [slot, v] of Object.entries(bloque)) figees[slot] = v.gemmes || [];
  const options = {};
  const slotItemsDepart = {};
  for (const slot of D.ordreSlots) {
    if (bloque[slot] && bloque[slot].item) {
      slotItemsDepart[slot] = bloque[slot].item;
      options[slot] = [bloque[slot].item];
      continue;
    }
    const pool = poolSlot(classe, slot, arme, grade, mixte, planchers, saveurs);
    options[slot] = pool;
    const impose = depart && depart[slot];
    if (impose) { slotItemsDepart[slot] = impose; continue; }
    let best = null, bestCle = null;
    for (const it of pool) {
      const cle = [scoreObjet(it, want), affinite ? (affinite === 'magic' ? it.aff : -it.aff) : 0];
      if (!best || cle[0] > bestCle[0] || (cle[0] === bestCle[0] && cle[1] > bestCle[1])) {
        best = it; bestCle = cle;
      }
    }
    slotItemsDepart[slot] = best || null;
  }

  const priorite = Object.keys(want);
  const note = (items, e) => {
    const base = couvertureEffective(e.couvert, want, priorite);
    const sur = surplus(e.couvert, want);
    if (!mixte) return [base, sur];
    let raretes = 0;
    for (const it of Object.values(items)) if (it) raretes += it.g;
    return [base, sur, -raretes];
  };
  const mieux = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  };

  // TOUTES LES CIBLES SONT-ELLES ATTEINTES, RIEN QU'AU STUFF (want est déjà
  // le vin retiré) ? Sert à ARRÊTER DE CHERCHER dès que c'est le cas, aussi
  // bien EN PLEINE MONTEE (continuer à affiner un score une fois les cibles
  // couvertes ne rend rien de plus à l'utilisateur) qu'ENTRE deux montees.
  const complet = (c) => Object.entries(want).every(([n, l]) => (c[n] || 0) >= l);

  // LA MONTEE LOCALE, ISOLEE POUR POUVOIR LA REJOUER DEPUIS PLUSIEURS
  // DEPARTS. Un echange isole a la fois, le premier qui ameliore ; identique
  // au comportement d'avant quand on ne l'appelle qu'une fois -- sauf
  // qu'elle s'arrete des que les cibles sont toutes couvertes, plutot que
  // de continuer a chercher un score meilleur qui ne changerait rien.
  const grimper = (depItems) => {
    let items = { ...depItems };
    let etat = assembler(items, want, false, figees);
    let meilleur = note(items, etat);
    for (let tour = 0; tour < D.toursRecherche && !complet(etat.couvert); tour += 1) {
      let ameliore = false;
      for (const slot of D.ordreSlots) {
        // Un emplacement verrouille ne se remplace pas, meme si le moteur
        // trouverait mieux : c'est tout l'objet du cadenas.
        if (bloque[slot]) continue;
        const pool = options[slot];
        if (!pool || pool.length <= 1) continue;
        for (const alt of pool) {
          if (alt === items[slot]) continue;
          const essaiItems = { ...items, [slot]: alt };
          const essai = assembler(essaiItems, want, false, figees);
          const n = note(essaiItems, essai);
          if (mieux(n, meilleur)) { items = essaiItems; etat = essai; meilleur = n; ameliore = true; break; }
        }
        if (ameliore) break;
      }
      if (!ameliore) break;
    }
    return { items, meilleur, etat };
  };

  let { items, meilleur, etat } = grimper(slotItemsDepart);

  /* UN DEPART DE PLUS, CENTRE SUR LES ENCOCHES PLUTOT QUE SUR L'INNE.
   *
   * Le depart glouton (scoreObjet) privilegie une piece a inné qui
   * correspond, meme au prix d'une seule encoche contre deux. Pour un
   * affixe qui n'existe EN INNE NULLE PART -- rien à faire de ce côté,
   * seule une encoche du bon materiau y arrive -- ce départ-là ne peut
   * jamais couvrir cet affixe, quel que soit le nombre de relances
   * secouées ensuite : elles restent tirées AU HASARD dans le pool, et
   * n'ont donc qu'une chance limitée de retomber juste sur la variante à
   * deux encoches qu'il fallait. Ce départ-ci choisit directement celle-là, pièce
   * par pièce, avant même la première relance. */
  if (!mixte && !complet(etat.couvert)) {
    const departEncoches = {};
    for (const slot of D.ordreSlots) {
      if (bloque[slot] || (depart && depart[slot])) { departEncoches[slot] = slotItemsDepart[slot]; continue; }
      const pool = options[slot];
      if (!pool || !pool.length) { departEncoches[slot] = slotItemsDepart[slot]; continue; }
      let best = null, bestScore = -Infinity;
      for (const it of pool) {
        const s = scoreEncoches(it, want);
        if (s > bestScore) { best = it; bestScore = s; }
      }
      departEncoches[slot] = best;
    }
    const tentativeEncoches = grimper(departEncoches);
    if (mieux(tentativeEncoches.meilleur, meilleur)) {
      items = tentativeEncoches.items; meilleur = tentativeEncoches.meilleur; etat = tentativeEncoches.etat;
    }
  }

  /* PLUSIEURS DEPARTS SECOUES, EN RARETE UNIQUE SEULEMENT.
   *
   * La montee locale s'arrete au PREMIER optimum rencontre : deux
   * emplacements qui, changes chacun seul, n'ameliorent rien peuvent
   * pourtant, changes ENSEMBLE, debloquer une cible restee hors de portee.
   * Mesure sur un vrai rapport : la passe grecque seule laissait Unyielding
   * a 2 alors qu'un choix different (a la main) montait a 4 pour les MEMES
   * cibles et la MEME rarete -- l'optimum global existait, la recherche a
   * un seul depart ne le voyait pas.
   *
   * Repartir d'un depart secoue (quelques emplacements tires au hasard dans
   * leur pool, hors verrous et hors depart impose) puis regrimper depuis la
   * retrouve parfois cette combinaison. On ne garde que si c'est
   * STRICTEMENT mieux que ce qu'on a deja : ces relances ne peuvent donc
   * jamais degrader un resultat, seulement l'ameliorer.
   *
   * RESERVE A LA RARETE UNIQUE. Le panache a deja ses deux departs (plus
   * bas, dans construire()) et se paie cher a la cible -- jusqu'a 1,4 s,
   * lire le commentaire de dessinerAffixes().
   *
   * S'ARRETE DES QUE C'EST SUFFISANT, PAS APRES LE COMPTE FIXE. Chercher un
   * MEILLEUR resultat une fois les cibles deja toutes couvertes ne rend
   * rien de plus a l'utilisateur -- seulement plus lent. Ca laisse la
   * marge d'aller chercher BEAUCOUP plus loin (60 relances, pas 10) sur les
   * cas difficiles sans ralentir les cas faciles, qui s'arretent des la
   * premiere ou deuxieme relance utile. Mesure sur le rapport qui a lance
   * ce chantier : 31 % de reussite a 10 relances FIXES, 90 % a 60 -- mais
   * 60 relances fixes, meme quand la 2e suffisait deja, aurait fait 7 s de
   * page figee par calcul. Avec l'arret anticipe, le meme taux se paie au
   * prix des seuls calculs qui en ont vraiment besoin. */
  if (!mixte) {
    for (let relance = 0; relance < RELANCES_RARETE_UNIQUE && !complet(etat.couvert); relance += 1) {
      const secoue = { ...slotItemsDepart };
      for (const slot of D.ordreSlots) {
        if (bloque[slot] || (depart && depart[slot])) continue;
        const pool = options[slot];
        if (!pool || pool.length <= 1) continue;
        secoue[slot] = pool[Math.floor(Math.random() * pool.length)];
      }
      const tentative = grimper(secoue);
      if (mieux(tentative.meilleur, meilleur)) {
        items = tentative.items; meilleur = tentative.meilleur; etat = tentative.etat;
      }
    }
  }

  const final = assembler(items, want, true, figees);
  return { slotItems: items, ...final, options };
}

/* Redescend chaque pièce aussi bas que possible SANS perdre une cible.
 *
 * La recherche d'objets optimise la couverture ; la rareté n'y est qu'un
 * départage de dernier recours, donc elle sur-améliore. Une fois les cibles
 * atteintes, tout cran de rareté en trop est du gaspillage. Un échange n'est
 * accepté que s'il garde TOUTES les cibles : la passe ne peut donc jamais
 * dégrader un build, seulement l'alléger. Mesuré : 8 Légendaires -> 2
 * Légendaires + 5 Épiques + 1 Excellent sur un build réel. */
function alleger(slotItems, classe, arme, cibleListe, planchers, vinPoints, tours, verrous, saveurs) {
  const want = Object.fromEntries(cibleListe);
  const bloque = verrous || {};
  const figees = {};
  for (const [sl, v] of Object.entries(bloque)) figees[sl] = v.gemmes || [];
  /* POURQUOI CETTE VERIFICATION EST GLOUTONNE, ET NON EXACTE.
   *
   * `construire` finalise avec la DP exacte, alors qu'on juge ici avec la
   * pose gloutonne : une piece que la DP saurait exploiter est donc parfois
   * refusee, et le set rendu n'est pas toujours le moins cher. C'est un
   * defaut connu, et il est assume.
   *
   * La version exacte a ete essayee, mesuree, et retiree. En secours de
   * chaque refus glouton, elle multipliait par cinq le nombre d'appels a la
   * DP — 397 pour un seul build a cinq cibles hautes, 70 % du temps total —
   * et faisait passer le calcul de 4,4 a 18 secondes : le navigateur
   * annoncait « la page ralentit ». Rationnee a vingt-quatre appels, elle
   * cessait d'etre monotone : `alleger` etant glouton d'un tour a l'autre,
   * un secours accorde tot bloque un meilleur allegement plus tard, et un
   * build sur 120 ressortait PLUS CHER qu'avec le glouton seul.
   *
   * Gagner une rarete sur deux builds sur 120 ne vaut pas de figer la page
   * ni de rendre le resultat instable. Si ce defaut doit etre corrige un
   * jour, c'est en rendant la DP moins chere, pas en l'appelant plus. */
  const tient = (items) => {
    const a = assembler(items, want, false, figees);
    return cibleListe.every(([n, l]) =>
      (a.couvert[n] || 0) + (vinPoints.get(n) || 0) >= l);
  };

  if (!tient(slotItems)) return slotItems;

  let courant = { ...slotItems };
  const options = {};
  for (const slot of D.ordreSlots) {
    options[slot] = poolSlot(classe, slot, arme, 1, true, planchers, saveurs);
  }
  for (let t = 0; t < (tours || 4); t += 1) {
    let bouge = false;
    const ordre = [...D.ordreSlots].sort(
      (a, b) => ((courant[b] && courant[b].g) || 0) - ((courant[a] && courant[a].g) || 0));
    for (const slot of ordre) {
      // Alleger une piece verrouillee reviendrait a la remplacer : interdit.
      if (bloque[slot]) continue;
      const actuel = courant[slot];
      if (!actuel) continue;
      // Une rarete imposee ne s'allege pas : c'est un choix, pas un plancher.
      if (planchers[slot]) continue;
      const cands = options[slot]
        .filter((o) => o.g < actuel.g)
        .sort((a, b) => a.g - b.g);
      for (const alt of cands) {
        const essai = { ...courant, [slot]: alt };
        if (tient(essai)) { courant = essai; bouge = true; break; }
      }
    }
    if (!bouge) break;
  }
  return courant;
}

function sommeRaretes(slotItems) {
  return Object.values(slotItems).reduce((s, it) => s + (it ? it.g : 0), 0);
}

function construire(classe, arme, cibleListe, grade, vin, mixte, planchers, vinChoisi,
                    verrous, saveurs) {
  const affinite = D.affinites[String(classe)] || null;

  /* LE VIN SE RETIRE DES CIBLES AVANT DE CHERCHER, PAS APRÈS.
   *
   * Il ne servait qu'au contrôle final : la recherche, elle, visait les
   * niveaux PLEINS. Elle dépensait donc ses gemmes à pousser Eloquence
   * vers 7 alors que le vin en apportait déjà 2, et concluait qu'il fallait
   * monter d'un cran de rareté.
   *
   * Symptôme rapporté, reproduit à l'identique : Sorcerer visant Eloquence 7,
   * Valor 7, Elusive 5, Fervid 5 avec +2 de vin sur chacun sortait 8 pièces
   * Epic, alors que demander 5/5/3/3 sans vin — exactement la même chose —
   * sortait 8 pièces Excellent.
   *
   * Le stuff n'a donc à fournir que `niveau visé − vin`. Un affixe entièrement
   * couvert par le vin disparaît de la recherche : lui réserver une gemme
   * volerait la place d'une cible qui, elle, en a besoin. */
  const essaiVin = (vinPoints, g, mx, dep) => {
    const cibleGear = cibleListe
      .map(([n, l]) => [n, l - (vinPoints.get(n) || 0)])
      .filter(([, l]) => l > 0);
    const want = Object.fromEntries(cibleGear);
    const priorite = Object.keys(want);
    const a = construireAuGrade(classe, arme, cibleGear, g, mx, planchers, null, dep, verrous, saveurs);
    let r = a;
    if (affinite) {
      const b = construireAuGrade(classe, arme, cibleGear, g, mx, planchers, affinite, dep, verrous, saveurs);
      const na = [couvertureEffective(a.couvert, want, priorite), surplus(a.couvert, want)];
      const nb = [couvertureEffective(b.couvert, want, priorite), surplus(b.couvert, want)];
      r = (nb[0] > na[0] || (nb[0] === na[0] && nb[1] >= na[1])) ? b : a;
    }
    return { r, cibleGear, want };
  };
  // Le contrôle reste sur les cibles PLEINES : c'est la promesse faite à
  // l'utilisateur, et elle doit être vérifiée telle qu'il l'a formulée.
  const suffitVin = (r, vinPoints) => cibleListe.every(([n, l]) =>
    (r.couvert[n] || 0) + (vinPoints.get(n) || 0) >= l);

  // UNE SEULE PASSE DE GRADE, POUR UNE REPARTITION DE VIN DONNEE.
  const tenter = (vinPoints) => {
    let res = null;
    let justeEnDessous = null;
    const grades = grade ? [grade] : [1, 2, 3, 4, 5, 6];
    let want = {}, cibleGear = [];
    for (const g of grades) {
      const e = essaiVin(vinPoints, g, false, null);
      res = e.r; want = e.want; cibleGear = e.cibleGear;
      if (suffitVin(res, vinPoints)) break;
      justeEnDessous = res;
    }
    return { res, justeEnDessous, want, cibleGear };
  };

  const vinPoints = vin ? repartitionVin(cibleListe, vinChoisi) : new Map();
  let { res, justeEnDessous, want, cibleGear } = tenter(vinPoints);

  /* UNE SECONDE REPARTITION, SI LA PREMIERE NE SUFFIT PAS.
   *
   * repartitionVin() sert le vin aux quatre cibles les plus hautes, deux
   * points chacune, et rien aux autres -- une decision prise AVANT de savoir
   * ce que le stuff peut vraiment fournir. Quand un affixe delaisse n'existe
   * QU'EN GEMME nulle part en inne, le laisser a zero de vin l'oblige a
   * tenir seul sur les encoches disponibles, souvent hors de portee, alors
   * qu'un partage plus egal l'aurait complete. Mesure sur un rapport reel :
   * la repartition concentree echouait sur Unyielding ET Stoic ; etalee sur
   * les six cibles, le meme stuff les couvrait toutes les deux.
   *
   * Reserve au vin AUTOMATIQUE (une consigne manuelle est un choix du
   * joueur, pas a corriger) et a la rareté UNIQUE -- le panache a deja ses
   * deux departs et se paie cher a la cible ; doubler ce cout ici referait
   * la page figee que dessinerAffixes() decoupe justement pour eviter. */
  const vinAutomatique = vin && (!vinChoisi || ![...vinChoisi.values()].some((p) => p > 0));
  if (!mixte && vinAutomatique && res && !suffitVin(res, vinPoints)) {
    const vinPointsEtalee = repartitionVinEtalee(cibleListe);
    const tentative = tenter(vinPointsEtalee);
    if (tentative.res && suffitVin(tentative.res, vinPointsEtalee)) {
      ({ res, justeEnDessous, want, cibleGear } = tentative);
      vinPoints.clear();
      for (const [n, p] of vinPointsEtalee) vinPoints.set(n, p);
    }
  }
  const vinNoms = new Set(vinPoints.keys());

  const essai = (g, mx, dep) => essaiVin(vinPoints, g, mx, dep).r;
  const suffit = (r) => suffitVin(r, vinPoints);

  if (mixte) {
    // DEUX POINTS DE DÉPART, PAS UN.
    //
    // Partir du seul build suffisant (souvent tout doré) ne laisse au
    // panaché qu'une chose à faire : redescendre. Or descendre d'un cran
    // fait perdre une cible, donc la recherche locale refuse et ne bouge
    // plus. Le second départ est le dernier palier insuffisant : de là, on
    // ne monte que les pièces qui manquent vraiment.
    // Mesuré sur un build réel : départ unique -> 8 Légendaires ; avec les
    // deux -> 2 Épiques et 6 Légendaires.
    //
    // À couverture égale on garde la rareté LA PLUS BASSE : sans ce terme,
    // le panaché rhabille tout en Légendaire puisque les emplacements en
    // trop ne changent plus le score une fois les cibles atteintes.
    const raretes = (r) => Object.values(r.slotItems)
      .reduce((s, it) => s + (it ? it.g : 0), 0);
    const departs = [{ ...res.slotItems }];
    if (justeEnDessous) departs.push({ ...justeEnDessous.slotItems });
    for (const dep of departs) {
      const pan = essai(grade || 1, true, dep);
      const np = [couvertureEffective(pan.couvert, want, Object.keys(want)), -raretes(pan)];
      const nr = [couvertureEffective(res.couvert, want, Object.keys(want)), -raretes(res)];
      if (np[0] > nr[0] || (np[0] === nr[0] && np[1] > nr[1])) res = pan;
    }
  }
  res.suffisant = suffit(res);

  // ALLÈGEMENT FINAL, uniquement en panaché : à rareté unique toutes les
  // pièces partagent le même cran, il n'y a rien à rendre.
  if (mixte && res.suffisant) {
    // Le vin est DÉJÀ retiré de `cibleGear` : on passe une allocation vide,
    // sinon il serait compté deux fois et l'allègement descendrait trop bas.
    const legers = alleger(res.slotItems, classe, arme, cibleGear,
                           planchers, new Map(), undefined, verrous, saveurs);
    if (sommeRaretes(legers) < sommeRaretes(res.slotItems)) {
      const a = assembler(legers, want, true, figeesDe(verrous));
      const candidat = { slotItems: legers, sockets: a.sockets,
                         couvert: a.couvert, sources: a.sources };
      if (cibleListe.every(([n, l]) =>
          (candidat.couvert[n] || 0) + (vinPoints.get(n) || 0) >= l)) {
        res = candidat;
        res.suffisant = true;
      }
    }
  }
  res.vin = vinNoms;
  res.vinPoints = vinPoints;
  // Instantané pris UNE SEULE FOIS, à la sortie du moteur : la valeur de
  // repli quand on remet une ligne du tableau sur « auto » après l'avoir
  // touchée à la main. Voir appliquerVin — on ne relance jamais le moteur
  // pour ça, on revient juste à ce qu'il avait décidé ici.
  res.vinAuto = new Map(vinPoints);
  return res;
}

/* TOUTES LES PIÈCES QUI CONVIENNENT, EMPLACEMENT PAR EMPLACEMENT.
 *
 * « Tous les stuffs possibles » est une question mal posée : si trois pièces
 * conviennent à chacun des huit emplacements, ça fait 6561 stuffs, et une
 * liste de 6561 lignes n'aide personne. Ce qui aide, c'est de savoir QUELLES
 * pièces sont interchangeables à chaque emplacement — le joueur compose
 * ensuite avec ce qu'il a en stock ou trouve à l'hôtel des ventes.
 *
 * Chaque candidate est VÉRIFIÉE : on la pose réellement, on repose les
 * gemmes, et on ne la garde que si toutes les cibles tiennent encore. La
 * rareté n'est jamais changée. */
function alternatives(res, classe, arme, cibleListe, planchers, vinPoints) {
  const items = { ...res.slotItems };
  // MÊME RÈGLE QUE DANS LE MOTEUR : la POSE DE GEMMES vise ce que le stuff
  // doit réellement fournir, c'est-à-dire la cible moins le vin. La viser
  // pleine faisait dépenser des gemmes sur des niveaux déjà couverts, et
  // rejetait des pièces pourtant valables.
  //
  // `tient` et les paliers, eux, restent sur le TOTAL (stuff + vin) : un
  // palier se franchit avec le vin compris.
  const wantGear = Object.fromEntries(cibleListe
    .map(([n, l]) => [n, l - (vinPoints.get(n) || 0)])
    .filter(([, l]) => l > 0));

  const tot = (cov, n) => Math.min(plafond(n), (cov[n] || 0) + (vinPoints.get(n) || 0));

  // LES PALIERS DÉJÀ FRANCHIS COMPTENT AUTANT QUE LES CIBLES. Un affixe visé
  // à 3 mais obtenu à 5 franchit son palier ; le laisser redescendre à 3
  // respecterait la cible tout en perdant le bonus, sans que rien ne le
  // dise. On relève donc ce qui est franchi, et on l'exige aussi.
  const base = assembler(items, wantGear, false).couvert;
  const paliersTenus = [];
  for (const n of Object.keys(base)) {
    const p = palier(n);
    if (p && tot(base, n) >= p) paliersTenus.push([n, p]);
  }
  const tient = (cov) => cibleListe.every(([n, l]) => tot(cov, n) >= l)
    && paliersTenus.every(([n, p]) => tot(cov, n) >= p);

  const sortie = [];
  for (const slot of D.ordreSlots) {
    // Une pièce verrouillée ne bouge pas : ne rien proposer dessus. Le contrat
    // du cadenas était déjà tenu par le moteur mais pas par ces deux cartes,
    // qui proposaient de remplacer la pièce qu'on venait de figer.
    if (verrouilles.has(slot)) continue;
    const actuel = items[slot];
    if (!actuel) continue;
    const opts = poolSlot(classe, slot, arme, 1, true, planchers);
    const bonnes = [];
    const vus = new Set();
    for (const alt of opts) {
      if (alt.g !== actuel.g) continue;
      // Deux entrées identiques (même nom, mêmes trous, même inné) ne sont
      // qu'un seul objet pour qui doit l'acheter.
      const sig = `${alt.n}|${JSON.stringify(alt.s)}|${alt.i}`;
      if (vus.has(sig)) continue;
      vus.add(sig);
      if (alt === actuel) { bonnes.push({ item: alt, actuel: true }); continue; }
      const cov = assembler({ ...items, [slot]: alt }, wantGear, false).couvert;
      if (!tient(cov)) continue;
      bonnes.push({ item: alt, actuel: false });
    }
    if (bonnes.length > 1) sortie.push({ slot, bonnes });
  }
  return sortie;
}

/* « QUAND EST-CE QUE JE PEUX M'ARRÊTER ? »
 *
 * Un build laisse presque toujours des emplacements de gemme vides. L'écran
 * disait combien il en restait et de quel matériau — ce qui oblige à
 * tâtonner : ajouter un affixe, recalculer, voir si ça passe, recommencer.
 *
 * On répond directement : pour chaque affixe, jusqu'où les emplacements
 * LIBRES pourraient le monter, sans rien changer d'autre au stuff.
 *
 * CHAQUE LIGNE EST PRISE SEULE, et l'écran le dit. Deux affixes peuvent
 * convoiter le même emplacement : additionner les marges donnerait un total
 * qu'aucun build ne réalise. C'est la même règle que pour les pièces
 * interchangeables — un chiffre vérifié vaut mieux qu'un chiffre flatteur. */
function marge(res, vinPoints) {
  // LES EMPLACEMENTS NE SONT JAMAIS VIDES. L'optimiseur comble les trous
  // restants avec des gemmes bonus — c'était voulu, mais ça rend « compter
  // les emplacements libres » faux : il n'y en a aucun.
  //
  // Ce qui est réellement disponible, ce sont les emplacements
  // RÉAFFECTABLES : ceux dont la gemme ne sert AUCUNE cible demandée. Les
  // vider ne coûte rien, donc leur contenu est négociable.
  const vises = new Set(cibles.keys());
  const sockets = res.sockets || [];
  const negociables = [];
  for (const s of sockets) {
    if (!s.gem) { negociables.push(s); continue; }
    if (!s.gem.a.some((a) => vises.has(a))) negociables.push(s);
  }
  if (!negociables.length) return [];

  // La base : ce qui reste quand on a retiré les gemmes négociables. Sans
  // cette soustraction, un affixe déjà porté par une gemme bonus verrait sa
  // marge comptée deux fois.
  const base = {};
  for (const it of Object.values(res.slotItems || {})) {
    if (it && it.i) base[it.i] = (base[it.i] || 0) + 1;
  }
  const negoSet = new Set(negociables);
  for (const s of sockets) {
    if (!s.gem || negoSet.has(s)) continue;
    for (const a of s.gem.a) base[a] = (base[a] || 0) + 1;
  }

  const sortie = [];
  for (const nom of Object.keys(D.affixes)) {
    if (!affixeReel(nom)) continue;
    const cap = plafond(nom);
    const socle = Math.min(cap, (base[nom] || 0)
                                + ((vinPoints && vinPoints.get(nom)) || 0));
    const actuel = Math.min(cap, (res.couvert[nom] || 0)
                                 + ((vinPoints && vinPoints.get(nom)) || 0));
    if (socle >= cap) continue;
    const gemmes = affixVersGemmes.get(nom) || [];
    if (!gemmes.length) continue;
    // Un emplacement compte s'il existe AU MOINS une gemme de cet affixe
    // qu'il accepte : bon matériau, et niveau de gemme dans ses moyens.
    let places = 0;
    for (const s of negociables) {
      if (gemmes.some((g) => socketAccepte(s, g.t, g.l))) places += 1;
    }
    if (!places) continue;
    const atteignable = Math.min(cap, socle + places);
    // On n'annonce que ce qui dépasse ce que le build donne DÉJÀ.
    if (atteignable <= actuel) continue;
    sortie.push({ nom, actuel, atteignable, gain: atteignable - actuel,
                  vise: vises.has(nom), palier: palier(nom) });
  }
  // Le plus gros gain d'abord ; à gain égal, ce qui franchit un palier.
  return sortie.sort((a, b) => (b.gain - a.gain)
    || ((b.palier && b.atteignable >= b.palier ? 1 : 0)
        - (a.palier && a.atteignable >= a.palier ? 1 : 0))
    || a.nom.localeCompare(b.nom));
}

/* TOUT CE QUI EST ENCORE GAGNABLE, PAR N'IMPORTE QUEL MOYEN.
 *
 * `marge()` ne regarde que les gemmes. Elle ne pouvait donc pas voir qu'un
 * affixe etait accessible par l'INNE d'une autre piece — et elle sautait
 * meme entierement les affixes qu'aucune gemme ne porte. Resultat : un
 * Focused montable a 5 n'apparaissait nulle part, alors que la carte est
 * censee repondre a « qu'est-ce que je peux encore prendre ? ».
 *
 * Ce balayage complete la reponse par la seconde voie : remplacer une piece
 * par une autre du MEME cran, a condition que toutes les cibles tiennent
 * encore. Il ne garde pas « le meilleur echange par emplacement » comme le
 * fait la liste de recommandations — ici on inventorie, on ne conseille
 * pas, donc une piece qui n'apporte qu'un affixe non demande compte quand
 * meme : c'est justement ce que l'utilisateur veut savoir.
 */
function gainsParPiece(res, classe, arme, planchers, vinPoints) {
  const cibleListe = [...cibles.entries()];
  const wantGear = Object.fromEntries(cibleListe
    .map(([n, l]) => [n, l - (vinPoints.get(n) || 0)])
    .filter(([, l]) => l > 0));
  const items = { ...res.slotItems };
  const tot = (cov, n) => Math.min(plafond(n), (cov[n] || 0) + (vinPoints.get(n) || 0));
  const tient = (cov) => cibleListe.every(([n, l]) => tot(cov, n) >= l);
  const base = assembler(items, wantGear, false).couvert;

  const meilleur = new Map();   // affixe -> { niveau, slot, piece }
  for (const slot of D.ordreSlots) {
    const actuel = items[slot];
    if (!actuel) continue;
    // Une piece verrouillee ne bouge pas : ne rien proposer dessus.
    if (verrouilles.has(slot)) continue;
    const opts = poolSlot(classe, slot, arme, 1, true, planchers);
    for (const alt of opts) {
      if (alt === actuel || alt.g !== actuel.g) continue;
      const cov = assembler({ ...items, [slot]: alt }, wantGear, false).couvert;
      if (!tient(cov)) continue;
      for (const n of Object.keys(cov)) {
        const gagne = tot(cov, n);
        if (gagne <= tot(base, n)) continue;
        const vu = meilleur.get(n);
        if (!vu || gagne > vu.niveau) meilleur.set(n, { niveau: gagne, slot, piece: alt });
      }
    }
  }
  return meilleur;
}

/* « En changeant CETTE pièce, tu gagnerais ça. »
 *
 * L'optimiseur rend un build ; il ne dit pas ce qui se jouait à un cheveu.
 * On essaie donc, pour chaque emplacement, les autres pièces disponibles, et
 * on garde celles qui font gagner quelque chose sans faire perdre de cible.
 *
 * ON NE TOUCHE JAMAIS À LA RARETÉ, dans aucun mode. Le bouton « panacher »
 * et les planchers par emplacement sont faits pour ça : c'est l'utilisateur
 * qui décide quelle pièce monte. Une suggestion ne compare que des pièces du
 * MÊME cran, qui diffèrent par leur inné ou leurs emplacements.
 *
 * Rien n'est appliqué automatiquement : chaque suggestion est un bouton. */
function suggestions(res, classe, arme, cibleListe, planchers, vinPoints) {
  const want = Object.fromEntries(cibleListe);
  const items = { ...res.slotItems };
  // MÊME RÈGLE QUE DANS LE MOTEUR : la POSE DE GEMMES vise ce que le stuff
  // doit réellement fournir, c'est-à-dire la cible moins le vin. La viser
  // pleine faisait dépenser des gemmes sur des niveaux déjà couverts, et
  // rejetait des pièces pourtant valables.
  //
  // `tient` et les paliers, eux, restent sur le TOTAL (stuff + vin) : un
  // palier se franchit avec le vin compris.
  const wantGear = Object.fromEntries(cibleListe
    .map(([n, l]) => [n, l - (vinPoints.get(n) || 0)])
    .filter(([, l]) => l > 0));

  // La référence est mesurée COMME les essais (pose gloutonne). Comparer une
  // pose exacte à des poses gloutonnes faisait paraître perdant tout
  // échange, et la fonction ne rendait jamais rien.
  const base = assembler(items, wantGear, false).couvert;
  const tot = (cov, n) => Math.min(plafond(n), (cov[n] || 0) + (vinPoints.get(n) || 0));
  const tient = (cov) => cibleListe.every(([n, l]) => tot(cov, n) >= l);

  const sortie = [];
  for (const slot of D.ordreSlots) {
    // Une pièce verrouillée ne bouge pas : ne rien proposer dessus. Le contrat
    // du cadenas était déjà tenu par le moteur mais pas par ces deux cartes,
    // qui proposaient de remplacer la pièce qu'on venait de figer.
    if (verrouilles.has(slot)) continue;
    const actuel = items[slot];
    if (!actuel) continue;
    const opts = poolSlot(classe, slot, arme, 1, true, planchers);
    // LA RARETÉ NE SE TOUCHE JAMAIS. Le bouton « panacher » et les planchers
    // par emplacement existent pour ça : c'est l'utilisateur qui décide
    // quelle pièce monte. Une suggestion ne propose qu'une AUTRE pièce du
    // MÊME cran, pour son inné ou ses emplacements.
    let meilleur = null;
    for (const alt of opts) {
      if (alt === actuel || alt.g !== actuel.g) continue;
      const essai = { ...items, [slot]: alt };
      const cov = assembler(essai, wantGear, false).couvert;
      if (!tient(cov)) continue;
      const gains = [], pertes = [], paliers = [];
      for (const n of new Set([...Object.keys(cov), ...Object.keys(base)])) {
        const a = tot(base, n), b = tot(cov, n);
        if (a === b) continue;
        (b > a ? gains : pertes).push([n, a, b]);
        const p = palier(n);
        if (p && b >= p && a < p) paliers.push(n);
      }
      if (!gains.length || (pertes.length && !paliers.length)) continue;
      // Un affixe marqué « ne me le propose pas » disqualifie l'échange :
      // c'est une consigne, pas une pondération.
      if (gains.some(([n]) => prefs.get(n) === 'non')) continue;
      /* UN ÉCHANGE DOIT SERVIR CE QU'ON A DEMANDÉ.
       *
       * Un affixe non demandé pesait quand même 1, si bien qu'un échange
       * dont le SEUL gain était un affixe dont on n'a jamais parlé
       * remontait comme proposition — « change tes bottes pour gagner
       * Sky Piercer », alors que rien ne demandait Sky Piercer. La carte
       * l'annonçait elle-même (« non demandé ») et le proposait pourtant.
       *
       * Changer une pièce n'est pas gratuit : ça se mérite par un affixe
       * VISÉ, ou marqué ★ comme bonus souhaité. Le reste passe en simple
       * mention à côté du gain, sans jamais déclencher la proposition. */
      if (!gains.some(([n]) => want[n] || prefs.get(n) === 'bonus')) continue;
      // Un affixe visé pèse le plus, un bonus explicitement souhaité vient
      // juste après, le reste ne compte que pour mémoire.
      const poids = (n) => (want[n] ? 3 : (prefs.get(n) === 'bonus' ? 2 : 1));
      let valeur = 0;
      for (const [n, a, b] of gains) valeur += (b - a) * poids(n);
      for (const [n, a, b] of pertes) valeur -= (a - b) * poids(n);
      valeur += paliers.length * 5;
      // D'OÙ VIENT LE GAIN. « Sky Piercer +1 » ne dit rien : est-ce l'inné de
      // la pièce, ou une gemme qu'un emplacement libéré a permis de poser ?
      // La réponse change la décision, donc elle s'affiche.
      const origine = {};
      for (const [n] of gains) {
        origine[n] = (alt.i === n && actuel.i !== n) ? 'inne' : 'gemme';
      }
      const e = { slot, avant: actuel, apres: alt, gains, pertes, paliers,
                  valeur, origine,
                  demande: Object.fromEntries(gains.map(([n]) =>
                    [n, want[n] ? 'cible' : (prefs.get(n) === 'bonus' ? 'bonus' : '')])) };
      if (!meilleur || e.valeur > meilleur.valeur) meilleur = e;
    }
    if (meilleur) sortie.push(meilleur);
  }
  return sortie.sort((a, b) => b.valeur - a.valeur).slice(0, 6);
}

/* Tous les mélanges de raretés qui atteignent les cibles, du moins cher au
   plus cher. Un même objectif s'atteint de plusieurs façons : beaucoup de
   pièces moyennes, ou peu de pièces très rares — et ce n'est pas forcément
   celle que l'outil choisit qu'on a sous la main. */
/* Combien de points de vin chaque affixe reçoit. Mêmes règles que l'outil de
   bureau : un budget de reglesVin().total points, au plus reglesVin().bonus
   sur un meme affixe. Une consigne qui déborde est rognée —
   un build calculé sur un vin impossible serait faux. */
/* LES QUATRE BREWS.
 *
 * Ce qui distingue une boisson d'une autre, c'est son BUDGET TOTAL — 2, 4, 6
 * ou 8 points, de la plus mediocre a la meilleure. Le plafond par affixe, lui,
 * ne bouge pas : deux points, jamais plus.
 *
 * Le nombre d'affixes servis en decoule donc, il ne se decrete pas : huit
 * points a deux par affixe, ça fait quatre affixes. C'est exactement le
 * modele en place depuis le debut du projet, valide en jeu — Gods' Brew
 * reste le defaut et rien ne change pour qui ne touche pas au selecteur.
 *
 * (Une premiere version de ce bloc reprenait les chiffres de theorycrafter.gg,
 * qui annonce des nombres d'affixes par boisson — 2, 4, 6, 8 affixes — au lieu
 * de budgets. C'etait faux : la boisson donne des POINTS.)
 *
 * RESTE UNE QUESTION OUVERTE, signalee plutot qu'arbitree : peut-on etaler
 * huit points a raison d'UN point sur huit affixes differents ? Le code
 * l'interdit aujourd'hui — il plafonne a `total / 2` affixes — parce que
 * c'est le comportement en place et qu'il n'a jamais pose probleme. Si le jeu
 * l'autorise, il suffit de changer `max` ci-dessous.
 */
const BREWS = [
  { id: 'mortal',   nom: 'Mortal Tonic', total: 2, parAffixe: 1 },
  { id: 'hero',     nom: "Hero's Ale",   total: 4, parAffixe: 1 },
  { id: 'warblood', nom: 'Warblood',     total: 6, parAffixe: 2 },
  { id: 'gods',     nom: "Gods' Brew",   total: 8, parAffixe: 2 },
];
let _brew = 'gods';

/* Les regles du vin en vigueur. Tout le moteur passe par ici, si bien que
   changer de boisson ne demande aucune autre retouche.
   `max` est le nombre d'affixes SERVIS AU PLUS : en etalant un point par
   affixe, un budget de huit en touche huit. */
function reglesVin() {
  const b = BREWS.find((x) => x.id === _brew) || BREWS[BREWS.length - 1];
  return { nom: b.nom, total: b.total, bonus: b.parAffixe, max: b.total };
}

/* LE MÊME SÉLECTEUR DE VIN, OÙ QU'IL SOIT.
   Un seul endroit décrit les options : sinon la colonne de gauche et le
   tableau des résultats divergent au premier changement de boisson. */
function selectVin(nom, classe = 'vin') {
  const choisi = vinManuel.has(nom) ? String(vinManuel.get(nom)) : '';
  const opt = (valeur, libelle) =>
    `<option value="${valeur}"${valeur === choisi ? ' selected' : ''}>${libelle}</option>`;
  return `<select class="${classe}" data-a="${echapper(nom)}">`
    + opt('', t('affixes.auto'))
    + Array.from({ length: reglesVin().bonus + 1 },
                 (_, i) => opt(String(i), i ? '+' + i : '—')).join('')
    + '</select>';
}

/* CORRIGER SON VIN SANS RIEN RELANCER.
 *
 * Le vin se réglait dans la colonne de gauche, donc loin des chiffres qu'il
 * fait bouger : pour corriger un point il fallait remonter, changer, et
 * relancer un build complet pour voir le résultat. Le réglage est maintenant
 * DANS le tableau des affixes obtenus, à l'endroit exact où on constate le
 * manque.
 *
 * Ce que ce geste ne fait PAS, et c'est le point : il ne relance NI une
 * recherche de stuff NI même un recalcul du vin des autres lignes. Poser un
 * chiffre sur une ligne n'écrit QUE cette ligne — l'ancienne version
 * repassait par l'algorithme de répartition (budget total, plafond par
 * affixe) à chaque changement, et régler une seule ligne en faisait
 * dégringoler d'autres qu'on n'avait pas touchées, jusqu'à deux cibles à
 * 4 ✓ tombant à 2 ✗ pour un réglage qui ne les concernait pas. C'est un
 * réglage purement visuel : équipement, gemmes, paperdoll et code d'import
 * restent identiques au caractère près, et les lignes non touchées aussi.
 *
 * « auto » ramène la ligne à ce que CE build a calculé pour elle
 * (res.vinAuto, un instantané pris une seule fois à la sortie du moteur) —
 * pas à un nouveau calcul, à ce qu'il y avait déjà.
 *
 * La colonne « coût » fait exception : elle vient d'une recherche de build
 * par cible, donc la recalculer serait exactement ce qu'on refuse de faire.
 * Ses cases repassent au marqueur d'attente plutôt que d'afficher un chiffre
 * qui n'est plus vrai. */
function repeindreLigneVin(res, nom) {
  const table = $('tableauAffixes');
  const tr = table && table.querySelector(`tr[data-a="${CSS.escape(nom)}"]`);
  if (!tr) return;
  const cellules = tr.querySelectorAll('td');
  if (cellules.length < 6) return;
  const eq = res.couvert[nom] || 0;
  const accorde = (res.vinPoints && res.vinPoints.get(nom)) || 0;
  const total = Math.min(plafond(nom), eq + accorde);
  const vise = cibles.has(nom) ? cibles.get(nom) : null;
  const tient = vise == null ? null : total >= vise;

  tr.classList.toggle('ligneKo', tient === false);
  const cellTotal = cellules[5];
  cellTotal.className = 'n total ' + (tient == null ? '' : (tient ? 'ok' : 'ko'));
  // MÊME DÉPASSEMENT QU'AU RENDU INITIAL — voir le commentaire sur .majCible
  // plus haut dans afficher(). Cette fonction repeint la même cellule après
  // coup (à l'ouverture de la carte, à chaque réglage de vin) et l'écrasait
  // en texte brut, perdant le bouton posé au premier rendu.
  const depasse = vise != null && total > vise;
  const totalAffiche = depasse
    ? `<button type="button" class="majCible" data-a="${echapper(nom)}" data-n="${total}"
         title="${echapper(t('table.dejaPlus', { n: total }))}">${total}</button>`
    : String(total);
  cellTotal.innerHTML = `${totalAffiche}<span class="marque">${
    tient == null ? '' : (tient ? '✓' : '✗')}</span>`;

  const sel = cellules[4].querySelector('select');
  if (!sel) return;
  // LA VALEUR DU SÉLECTEUR DIT SI C'EST TOI OU LE MOTEUR QUI A DÉCIDÉ.
  // Une ligne jamais touchée reste sur « auto », même quand le moteur lui a
  // donné des points — sinon on ne distinguerait plus « ce que tu as
  // corrigé » de « ce que le moteur a mis tout seul ».
  sel.value = vinManuel.has(nom) ? String(vinManuel.get(nom)) : '';
  // LA COLONNE DISAIT UN NOMBRE, ELLE NE DOIT PAS DIRE MOINS.
  // Remplacer le chiffre par un sélecteur sur « auto » aurait fait perdre
  // l'information : on ne voyait plus combien de points partaient là. Le
  // libellé de l'option automatique porte donc le compte actuellement
  // servi sur cette ligne.
  const opt = sel.querySelector('option[value=""]');
  if (opt) opt.textContent = accorde ? `${t('affixes.auto')} +${accorde}` : t('affixes.auto');
}

/* Toutes les lignes d'un coup : seul moment où c'est légitime, juste après
   avoir construit le tableau — chaque ligne lit sa propre valeur, aucune ne
   dépend d'une autre. */
function repeindreVin(res) {
  const table = $('tableauAffixes');
  if (!table) return;
  for (const tr of table.querySelectorAll('tr[data-a]')) repeindreLigneVin(res, tr.dataset.a);
}

/* Le dernier résultat affiché, pour que les deux sélecteurs de vin — celui
   du tableau et celui de la colonne de gauche — repeignent les mêmes
   chiffres. Sans lui, changer le vin à gauche laissait le tableau afficher
   l'ancienne répartition jusqu'au prochain build. */
let _resAffiche = null;

/* LE SEUL CHEMIN POUR CHANGER LE VIN. Les deux sélecteurs passent par ici,
   donc ils ne peuvent pas se contredire. */
function appliquerVin(nom, valeur) {
  // Retenu pour le PROCHAIN build : si tu relances Calculer plus tard, ce
  // réglage compte encore. Mais ça ne relance RIEN maintenant — c'est une
  // note pour plus tard, pas une action.
  if (valeur === '') vinManuel.delete(nom);
  else vinManuel.set(nom, Number(valeur));

  // LE RÉSULTAT AFFICHÉ NE BOUGE QUE SUR CETTE LIGNE.
  if (_resAffiche) {
    const auto = (_resAffiche.vinAuto && _resAffiche.vinAuto.get(nom)) || 0;
    const pose = valeur === '' ? auto : Number(valeur);
    if (pose > 0) _resAffiche.vinPoints.set(nom, pose);
    else _resAffiche.vinPoints.delete(nom);
    repeindreLigneVin(_resAffiche, nom);
    // Le coût par palier vient d'une recherche de build par cible : le
    // refaire ici serait exactement la relance qu'on veut éviter. On cesse
    // donc de l'affirmer plutôt que d'afficher un chiffre périmé.
    const ligne = $('tableauAffixes').querySelector(`tr[data-a="${CSS.escape(nom)}"] td.cout`);
    if (ligne && ligne.textContent.trim()) ligne.innerHTML = '<span class="pas">…</span>';
  }
  majBudgetVin();
  majCompteursGrille();

  // L'autre sélecteur du même affixe suit, sans redessiner quoi que ce soit.
  for (const jumeau of document.querySelectorAll(
      `[data-affixe="${CSS.escape(nom)}"] .vin, .vinCase select[data-a="${CSS.escape(nom)}"]`)) {
    if (jumeau.value !== valeur) jumeau.value = valeur;
  }
}

/* Rend les sélecteurs du tableau vivants. */
function brancherVinTableau() {
  const table = $('tableauAffixes');
  if (!table) return;
  const compte = $('vin').checked;
  for (const sel of table.querySelectorAll('.vinCase select')) {
    sel.disabled = !compte;
    if (!compte) sel.title = t('affixes.vinEteint');
    sel.onchange = () => appliquerVin(sel.dataset.a, sel.value);
  }
  // Verrouille ce que le vin donnait déjà en plus, voir le commentaire au
  // point d'origine de .majCible. Délégué sur la table (posé une seule
  // fois) car .majCible est recréé à chaque repeinture — repeindreLigneVin
  // notamment — et un branchement par bouton se serait perdu à chaque fois.
  if (!table.dataset.majCibleBranche) {
    table.dataset.majCibleBranche = '1';
    table.addEventListener('click', (ev) => {
      const bouton = ev.target.closest('.majCible');
      if (!bouton) return;
      cibles.set(bouton.dataset.a, Number(bouton.dataset.n));
      dessinerAffixes();
      majBudgetVin();
      calculer();
    });
  }
}

function repartitionVin(cibleListe, manuel) {
  // UNE CONSIGNE DE VIN VAUT SANS CIBLE. On visait autrefois les seuls
  // affixes ciblés, pour qu'une allocation oubliée ne mange pas une des
  // quatre places. Mais c'est un geste légal du jeu : verser deux points sur
  // un affixe que le stuff ne porte pas du tout, et le voir monter à 2. Le
  // filtre l'interdisait. Ce qu'il protégeait est maintenant tenu par le
  // bandeau de budget, qui montre en clair les places occupées.
  const utile = manuel
    ? [...manuel.entries()].filter(([, p]) => p > 0)
    : [];
  if (!utile.length) {
    /* REPARTITION AUTOMATIQUE, SOUS CONTRAINTE DE BUDGET.
       Elle versait `bonus` points a chaque affixe retenu sans jamais compter
       le total : correct tant qu'il n'existait qu'une boisson, faux des qu'il
       y en a quatre — Warblood aurait servi deux points a six affixes, soit
       douze pour un budget de six. On sert donc au plus fort d'abord, et on
       s'arrete quand la carafe est vide. */
    const r = reglesVin();
    const auto = new Map();
    let reste = r.total;
    for (const n of choisirVin(cibleListe)) {
      if (reste <= 0) break;
      const donne = Math.min(r.bonus, reste);
      auto.set(n, donne);
      reste -= donne;
    }
    return auto;
  }
  const budgetTotal = reglesVin().total;
  const voulus = utile
    .map(([n, p]) => [n, Math.max(0, Math.min(p, reglesVin().bonus))])
    .filter(([, p]) => p > 0)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  const sortie = new Map();
  let reste = budgetTotal;
  for (const [n, p] of voulus.slice(0, reglesVin().max)) {
    if (reste <= 0) break;
    const donne = Math.min(p, reste);
    sortie.set(n, donne);
    reste -= donne;
  }
  return sortie;
}

/* LE MEME BUDGET, ETALE AU LIEU DE CONCENTRE.
 *
 * repartitionVin() sert le vin aux affixes de plus haut niveau visé,
 * jusqu'a quatre, deux points chacun -- et RIEN aux autres, quel que soit
 * ce qu'ils ont vraiment besoin. Ce choix est fait AVANT toute recherche de
 * stuff : il ne sait pas lesquels de ces affixes sont faciles en objets et
 * lesquels ne vivent que par gemme. Quand deux affixes visés n'existent
 * QU'EN GEMME (aucun inné nulle part dans la classe), les laisser à zero de
 * vin leur demande de tenir seuls sur les encoches disponibles -- souvent
 * hors de portee, alors qu'un partage plus egal les aurait completes.
 *
 * Sert de secours dans construire() : si la repartition concentree ne
 * suffit pas, on retente avec celle-ci avant de renoncer. */
function repartitionVinEtalee(cibleListe) {
  const r = reglesVin();
  const ordre = cibleListe.slice()
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => n);
  const donne = new Map(ordre.map((n) => [n, 0]));
  let reste = r.total;
  let progresse = true;
  while (reste > 0 && progresse) {
    progresse = false;
    for (const n of ordre) {
      if (reste <= 0) break;
      if (donne.get(n) >= r.bonus) continue;
      donne.set(n, donne.get(n) + 1);
      reste -= 1;
      progresse = true;
    }
  }
  for (const n of [...donne.keys()]) if (!donne.get(n)) donne.delete(n);
  return donne;
}

function choisirVin(cibleListe) {
  const ordre = cibleListe.slice().sort((a, b) => {
    const sansGemme = (n) => ((affixVersGemmes.get(n) || []).length ? 1 : 0);
    return (sansGemme(a[0]) - sansGemme(b[0])) || (b[1] - a[1]);
  });
  return new Set(ordre.slice(0, reglesVin().max).map(([n]) => n));
}

/* --------------------------------------------------------------------- UI */
/* L'explication de la case « Compter le Victory Wine » tient en infobulle :
   dans le libellé elle en ferait un pavé, et hors du libellé personne ne
   la relierait à la case. */
function poserAideVin() {
  const l = $('labelVin');
  if (l) l.title = t('perso.vinAide');
}

function remplirSelect(el, entrees, valeurSel) {
  el.innerHTML = '';
  for (const [val, txt] of entrees) {
    const o = document.createElement('option');
    o.value = String(val); o.textContent = txt;
    el.appendChild(o);
  }
  if (valeurSel !== undefined) el.value = String(valeurSel);
}

function majArmes() {
  const c = $('classe').value;
  remplirSelect($('arme'), (D.armes[c] || []).map((a) => [a, a]));
  // La deuxieme arme partage la meme liste de types que la classe : un
  // Sorcerer n'a qu'un Staff pour les deux, une Withered Knight peut porter
  // Greatsword ET Polearm and Shield a la fois.
  if ($('secondeArmeType')) {
    remplirSelect($('secondeArmeType'), (D.armes[c] || []).map((a) => [a, a]));
  }
}

/* CE QUE L'ARME ACTIVE FOURNIT VRAIMENT : son inné, plus un point par
 * affixe de chaque gemme posée dans ses encoches (jamais deux, meme pour
 * une gemme a deux affixes -- voir assembler(), qui compte pareil). C'est
 * CE tally que la deuxieme arme doit reproduire pour etre "la meme arme"
 * du point de vue des affixes. */
function affixesArmeActive(res) {
  const tally = {};
  const it = res && res.slotItems && res.slotItems[SLOT_ARME];
  if (!it) return tally;
  if (it.i) tally[it.i] = (tally[it.i] || 0) + 1;
  for (const s of res.sockets || []) {
    if (s.slot !== SLOT_ARME || !s.gem) continue;
    for (const a of s.gem.a) tally[a] = (tally[a] || 0) + 1;
  }
  return tally;
}

/* PICK DE LA DEUXIEME ARME : hors solveur, hors cibles, mais PAS hors
 * affixes -- le but est justement qu'elle rende les MEMES, pour que passer
 * de l'une a l'autre en jeu ne change rien au perso.
 *
 * Meme type ET meme rarete que l'arme active : c'est litteralement la meme
 * piece, memes gemmes -- rien a chercher, la reproduction est parfaite par
 * construction. Des qu'UN DES DEUX differe (un autre type, ou le meme type
 * mais une rarete demandee plus basse -- l'arme jaune reste jaune, la
 * deuxieme est violette voulue) on CHERCHE plutot : dans le pool du type et
 * de la rarete demandes, la piece dont l'inne et les encoches se
 * rapprochent le plus du tally de l'arme active. `approche` dit si la
 * reproduction obtenue est totale ou seulement partielle, pour que l'écran
 * puisse le dire honnetement plutôt que de laisser croire à une identité
 * qui n'a pas eu lieu. */
function choisirSecondeArme(classe, arme, grade, cibleAffixes, res, armeActuelle) {
  if (!arme) return null;
  const armePrincipale = res && res.slotItems && res.slotItems[SLOT_ARME];
  if (arme === armeActuelle && armePrincipale && (!grade || grade === armePrincipale.g)) {
    const item = armePrincipale;
    const sockets = (res.sockets || []).filter((s) => s.slot === SLOT_ARME);
    return { item, sockets, approche: false, manque: {} };
  }
  if (!grade) return null;
  const pool = poolDe(classe, SLOT_ARME, arme, grade, false);
  if (!pool.length) return null;
  const totalVoulu = cibleAffixes
    ? Object.values(cibleAffixes).reduce((s, n) => s + n, 0) : 0;
  if (!totalVoulu) {
    const it = pool.find((x) => x.i) || pool[0];
    return { item: it, approche: false, manque: {}, sockets: it.s.map((sk, idx) => (
      { slot: SLOT_ARME, index: idx, type: sk[0], level: sk[1], gem: null })) };
  }
  let meilleur = null, meilleurScore = -1, meilleurSockets = null, meilleurCouvert = null;
  for (const it of pool) {
    const r = assembler({ [SLOT_ARME]: it }, cibleAffixes, true, {});
    let score = 0;
    for (const [a, n] of Object.entries(cibleAffixes)) score += Math.min(r.couvert[a] || 0, n);
    if (score > meilleurScore) {
      meilleur = it; meilleurScore = score; meilleurSockets = r.sockets; meilleurCouvert = r.couvert;
    }
  }
  if (!meilleur) return null;
  // CE QUI MANQUE PRECISEMENT, PAS JUSTE "C'EST APPROXIMATIF". Rareté plus
  // basse ou type different qui n'a pas les bons emplacements : la carte
  // doit dire LESQUELS des affixes de l'arme active ne sont pas repris, et
  // de combien -- l'ecran qui se contente d'un "approximatif" oblige a
  // comparer les deux cartes a la main pour savoir ce qui a vraiment ete
  // perdu.
  const manque = {};
  for (const [a, n] of Object.entries(cibleAffixes)) {
    const trou = n - (meilleurCouvert[a] || 0);
    if (trou > 0) manque[a] = trou;
  }
  return { item: meilleur, sockets: meilleurSockets, approche: meilleurScore < totalVoulu, manque };
}

function secondeArmeActuelle(classe, res) {
  if (!$('secondeArmeActive') || !$('secondeArmeActive').checked) return null;
  const arme = $('secondeArmeType').value || null;
  const grade = $('secondeArmeRarete').value ? Number($('secondeArmeRarete').value) : null;
  const armeActuelle = $('arme').value || null;
  const cible = affixesArmeActive(res);
  return choisirSecondeArme(classe, arme, grade, cible, res, armeActuelle);
}

function poserSecondeArmeRarete() {
  const sel = $('secondeArmeRarete');
  if (!sel) return;
  const avant = sel.value;
  remplirSelect(sel, [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]]), avant || '5');
}

/* LA VRAIE ICÔNE DU JEU, PAS UN DESSIN.
   On croyait longtemps que les affixes n'avaient pas d'image et on en
   dessinait une par catégorie. C'était faux : le jeu les range sous
   T_UI_Icon_EquipSkill_*, une par affixe, et les 43 fichiers sont dans les
   données. Ce sont ces images qu'on sert.

   Elles sont en blanc sur transparent. Plutôt que de les poser telles
   quelles, on s'en sert de MASQUE et on peint dessous la couleur de la
   catégorie : le dessin du jeu est intact, et la couleur qui distinguait
   offense de défense d'un coup d'œil n'est pas perdue.

   `ic` n'est pas un nom de fichier mais la clé du jeu : l'image elle-même
   est inlinée dans icones_affixes.css, sous la classe `ia-<clé>`. Un masque
   qui pointe un fichier est refusé en file:// (contrôle d'origine) et il ne
   resterait qu'un carré plein — le data-URI, lui, passe partout.

   Le dessin par catégorie reste en secours, pour un affixe qui arriverait
   sans image. */
const SYMBOLE = {
  offense: '<path d="M4 20 16 8M11 4l9 9M12.5 19.5 16 16"/>',
  defense: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/>',
  mobility: '<path d="M3 12h11M9 7l5 5-5 5M17 5v14"/>',
  support: '<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3Z"/>',
};
function pastille(nom) {
  const info = (D.affixes || {})[nom] || {};
  const cat = info.cat || 'support';
  if (info.ic) {
    return `<span class="pastille c-${cat}" title="${echapper(cat)}"
      ><i class="icA ia-${echapper(info.ic)}"></i></span>`;
  }
  return `<span class="pastille c-${cat}" title="${echapper(cat)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round">${SYMBOLE[cat]}</svg>
  </span>`;
}

/* Une image du jeu, ou un carré vide si l'objet n'en a pas (les 155 pièces
   absentes du catalogue public n'ont pas d'icône téléchargeable). */
function vignette(fichier, teinte, taille) {
  const style = teinte ? `--tinte:${teinte};--halo:${teinte}33` : '';
  const dedans = fichier
    ? `<img src="icones/${fichier}" alt="" loading="lazy">`
    : '<span class="rien">◇</span>';
  return `<div class="vignette" style="${style}${taille ? `;width:${taille}px;height:${taille}px` : ''}">${dedans}</div>`;
}

// Les 10 statistiques que portent réellement les objets. Celles en fraction
// (0.07) sont des pourcentages dans le jeu : on les affiche comme tels.
/* Les libellés passent par le dictionnaire : écrits en dur, ils restaient
   en français dans les infobulles des trois versions du site. Le second
   membre dit si la valeur est un pourcentage. */
const NOM_STAT = {
  attack: ['stat.attack', 0], defence: ['stat.defence', 0],
  maxHealth: ['stat.maxHealth', 0], combatValue: ['stat.combatValue', 0],
  blockRate: ['stat.blockRate', 1],
  physicalIncrease: ['stat.physicalIncrease', 1],
  magicalIncrease: ['stat.magicalIncrease', 1],
  physicalReduction: ['stat.physicalReduction', 1],
  magicalReduction: ['stat.magicalReduction', 1],
  criticalReduction: ['stat.criticalReduction', 1],
};
function statsLisibles(at) {
  return Object.entries(at || {}).map(([k, v]) => {
    const [cle, pct] = NOM_STAT[k] || [null, 0];
    const nom = cle ? t(cle) : k;
    return pct ? `${nom} ${(v * 100).toFixed(1).replace(/\.0$/, '')} %` : `${nom} ${v}`;
  }).join(' · ');
}

// Le jeu appelle le matériau rouge « Ruby » au tier I et « Agate »/« Onyx »
// au tier II. Nommer un seul des deux ferait rater la moitié du stock à qui
// cherche à l'hôtel des ventes.
function nomMateriau(type) {
  const a = D.materiaux[`${type},1`];
  const b = D.materiaux[`${type},2`];
  return a === b ? a : `${a} / ${b}`;
}
/* CE QUI DISTINGUE DEUX PIÈCES DU MÊME NOM.
 *
 * 340 groupes de noms sur 388 contiennent plusieurs pièces différentes :
 * « Commander Sword and Shield » désigne huit objets, qui ne diffèrent que
 * par leur inné et leurs emplacements. Afficher « X → X » dans une
 * suggestion ne dit donc rigoureusement rien.
 *
 * On décrit ce qui change réellement : l'inné, puis les emplacements. */
function signature(it) {
  if (!it) return '—';
  const bouts = [it.i ? it.i : t('piece.sansInne')];
  const s = it.s || [];
  if (!s.length) {
    bouts.push(t('piece.sansTrou'));
  } else {
    // Groupés par matériau : « 2 Moonstone I » se lit, « Moonstone I,
    // Moonstone I » se compte.
    const par = new Map();
    for (const [type, niv] of s) {
      const k = `${materiau(type, niv)} ${niv === 2 ? 'II' : 'I'}`;
      par.set(k, (par.get(k) || 0) + 1);
    }
    bouts.push([...par.entries()]
      .map(([k, n]) => (n > 1 ? `${n} × ${k}` : k)).join(', '));
  }
  return bouts.join(' · ');
}

/* Le titre d'un échange : le nom seulement s'il change, sinon ce qui change
   vraiment. Deux pièces homonymes ne se distinguent que par leur contenu. */
function titreEchange(avant, apres) {
  const memeNom = avant && apres && avant.n === apres.n;
  const nom = memeNom
    ? `<b>${echapper(apres.n)}</b>`
    : `<b>${echapper(avant ? avant.n : '—')}</b> → <b>${echapper(apres.n)}</b>`;
  return `${nom}<span class="quoiChange">${signature(avant)}`
    + ` <i>→</i> ${signature(apres)}</span>`;
}

function infobulle(it) {
  const bouts = [it.n, D.raretes[String(it.g)]];
  const st = statsLisibles(it.at);
  if (st) bouts.push(st);
  if (it.i) bouts.push(t('equip.inne') + ' ' + it.i);
  if (it.d) bouts.push(it.d);
  return bouts.filter(Boolean).join('\n');
}

/* LE VIN NE DÉPEND PAS DU STUFF. Sigrid pose ses points sur l'affixe qu'on
   lui demande, qu'on ait déjà quelque chose dessus ou rien du tout : un
   affixe absent de tout l'équipement monte quand même à 2 avec deux points
   de vin. Griser la case tant qu'un niveau n'était pas visé interdisait ce
   geste, qui est pourtant légal dans le jeu.
   Seule la case « compter le Victory Wine », décochée, grise la colonne —
   là c'est vrai, aucun point ne compte. */
function majEtatVin(ligne) {
  const vin = ligne.querySelector('.vin');
  if (!vin) return;
  const compte = $('vin').checked;
  vin.disabled = !compte;
  vin.title = compte ? t('affixes.vinTitre', { max: reglesVin().max, bonus: reglesVin().bonus })
                     : t('affixes.vinEteint');
}

/* Dit en clair où en est le budget de vin, faute de quoi une consigne rognée
   en silence passerait pour un bug. */
function majBudgetVin() {
  const el = $('budgetVin');
  if (!el) return;
  // Decochee, la case rend tout le budget sans objet : l'annoncer quand
  // meme laissait croire que ces points comptaient dans le build.
  if (!$('vin').checked) {
    el.className = 'pas';
    el.textContent = t('vin.eteint');
    return;
  }
  const retenu = repartitionVin([...cibles.entries()], vinManuel);
  const total = [...retenu.values()].reduce((s, v) => s + v, 0);
  // Le budget EST le total de la boisson. Le calculer par max x bonus
  // donnait 16 pour Gods' Brew depuis que `max` compte les affixes
  // servis (huit a un point) et non les places a deux points.
  const budget = reglesVin().total;
  const demande = [...vinManuel.values()].reduce((s, v) => s + v, 0);
  // ZÉRO POINT N'OCCUPE PAS UNE PLACE. Régler un affixe sur « — » veut dire
  // « pas de vin ici », pas « une des quatre fioles part là-dessus ». Compter
  // ces zéros faisait dire au bandeau, mot pour mot : « 8/8 points sur 4/4
  // affixes — la consigne dépasse les règles du jeu ». Il s'accusait de
  // déborder en affichant lui-même qu'il ne débordait pas.
  const poses = [...vinManuel.values()].filter((v) => v > 0).length;
  const auto = !poses;
  const trop = !auto && (demande > budget || poses > reglesVin().max);
  el.className = trop ? 'ko' : 'pas';
  el.textContent = auto
    ? t('vin.auto', { total, budget })
    : t(trop ? 'vin.trop' : 'vin.manuel',
        { total, budget, n: retenu.size, max: reglesVin().max });
}

/* Le texte cherchable d'un affixe : son nom, sa description, et les libellés
   de tous ses niveaux. Calculé une fois puis gardé — refaire la
   concaténation à chaque frappe sur 44 affixes × 7 niveaux se sentirait. */
/* LES DEUX NOMS DU MÊME AFFIXE.
 *
 * Un joueur a signale que « Deft » manquait. Il ne manquait pas : le jeu
 * l'appelle « Deft » dans les noms de gemmes — « Deft Peridot », « Fierce
 * Battle: Deft Peridot » — et « Sleight of Hand » dans la table des
 * affixes, d'ou vient notre catalogue. Six affixes sont dans ce cas, la
 * plupart sur le couple energie/vigueur.
 *
 * On ne renomme rien : nos noms viennent des tables du codec, et c'est
 * elles qui font foi pour le code d'import. Mais chercher l'autre nom doit
 * marcher, et l'infobulle doit le dire — sinon chacun croit a un oubli.
 *
 * Verifie affixe par affixe contre le wiki : meme description, meme
 * plafond, meme famille.
 */
const AUTRES_NOMS = {
  'Sleight of Hand': 'Deft',
  'Sky Piercer': 'Skypiercing',
  'Critical Damage': 'Headshot Damage',
  'Magic Damage Reduction': 'Magical Damage Reduction',
  'Energy Recovery Speed Increase': 'Increased Stamina Recovery Speed',
  'Block Energy Cost Reduction': 'Reduced Block Stamina Cost',
  'Skill Energy Cost Reduction': 'Reduced Skill Stamina Cost',
};

/* ON AFFICHE LE NOM DU JEU, ON GARDE LA CLE INTERNE.
 *
 * « Deft » est le nom que le joueur voit : c'est celui du wiki, celui de
 * MistfallDB, et celui de nos propres gemmes (« Deft Peridot »). « Sleight
 * of Hand » ne vit que dans la table du codec.
 *
 * Renommer la CLE casserait tous les builds deja enregistres, qui la
 * citent. On ne touche donc qu'a l'etiquette : les cibles, les preferences
 * et les codes d'import continuent de parler la meme langue qu'avant. */
function libelleAffixe(nom) { return AUTRES_NOMS[nom] || nom; }

/* LES AFFIXES QUI N'EXISTENT PAS SUR L'EQUIPEMENT.
 *
 * Notre table vient du codec, qui contient 44 entrees. Le filtre du jeu,
 * lui, n'en propose que 32 — et les 12 en trop sont exactement ceux
 * qu'AUCUNE gemme ne donne et qu'AUCUN objet ne porte en inne. Verifie sur
 * les 1947 pieces du catalogue : zero. Ils ne peuvent donc apparaitre dans
 * aucun build, jamais.
 *
 * Les laisser dans la liste coutait cher : douze tuiles a regler pour rien,
 * douze cibles impossibles a poser par erreur, et douze affixes testes en
 * vain par l'inventaire complet — un tiers de ses sept secondes.
 *
 * On ne les efface pas des donnees : le codec peut y faire reference. On
 * les deduit a l'ouverture, et ils ne sortent plus de la. Se fier a la
 * DONNEE plutot qu'a une liste ecrite a la main garantit que la regle
 * suivra une mise a jour du jeu toute seule. */
let _affixesReels = null;
function affixeReel(nom) {
  if (!_affixesReels) {
    _affixesReels = new Set();
    for (const g of D.gemmes || []) for (const a of g.a || []) _affixesReels.add(a);
    for (const pool of Object.values(D.objets || {})) {
      for (const it of pool) if (it.i) _affixesReels.add(it.i);
    }
  }
  return _affixesReels.has(nom);
}

const _texteAffixe = new Map();
function texteCherchable(nom) {
  if (_texteAffixe.has(nom)) return _texteAffixe.get(nom);
  const info = D.affixes[nom] || {};
  const t = [nom, AUTRES_NOMS[nom] || '', info.desc || '', ...(info.eff || [])]
    .join(' ').toLowerCase();
  _texteAffixe.set(nom, t);
  return t;
}

function correspondAffixe(nom, filtre) {
  // Plusieurs mots = tous doivent être présents, dans n'importe quel ordre :
  // « magic res » doit trouver « Magic Damage Reduction ».
  const mots = filtre.split(/\s+/).filter(Boolean);
  if (!mots.length) return true;
  const t = texteCherchable(nom);
  return mots.every((m) => t.includes(m));
}

function dessinerAffixes() {
  const conteneur = $('listeAffixes');
  if (!conteneur) return;
  const filtre = ($('recherche').value || '').toLowerCase();
  conteneur.innerHTML = '';
  // Les affixes qui n'existent sur aucune piece passent en dernier : on les
  // garde sous les yeux, sans qu'ils s'intercalent entre ceux qui servent.
  const ordre = Object.keys(D.affixes).sort((x, y) =>
    (affixeReel(y) ? 1 : 0) - (affixeReel(x) ? 1 : 0) || x.localeCompare(y));
  for (const nom of ordre) {
    // LA RECHERCHE PORTE AUSSI SUR L'EFFET, PAS SEULEMENT SUR LE NOM.
    // Personne ne devine que la vitesse de déplacement s'appelle « Swift »
    // ou « Focused » : chercher « speed » doit les trouver. On balaie donc
    // la description et les libellés d'effet de chaque niveau.
    if (filtre && !correspondAffixe(nom, filtre)) continue;
    if (!passeFiltrePref(nom)) continue;
    conteneur.appendChild(tuileAffixe(nom));
  }
  dessinerChipsPref($('triPref'), () => {
    dessinerAffixes();
    if ($('grilleAffixes') && !$('grilleAffixes').hidden) dessinerGrilleAffixes();
  });
  /* UNE GRILLE VIDE DOIT S'EXPLIQUER ET SE DÉFAIRE.
   *
   * Elle ressemble sinon a une panne — et ça n'a rien de theorique : au
   * rechargement, un navigateur peut restaurer tout seul le contenu d'un
   * champ, y compris un texte colle la par erreur. Les 44 affixes
   * disparaissaient alors sans que rien ne dise pourquoi, sur un message
   * qui parlait en plus de builds et pas d'affixes.
   *
   * On nomme donc le filtre en cause et on donne le bouton qui le leve. */
  if (!conteneur.children.length) {
    const quoi = filtre ? t('affixes.aucunTexte', { filtre })
                        : t('affixes.aucunTri');
    conteneur.className = '';
    conteneur.innerHTML = `<div class="vide-filtre">${echapper(quoi)}
      <button id="leverFiltres">${t('affixes.leverFiltres')}</button></div>`;
    $('leverFiltres').onclick = () => {
      $('recherche').value = '';
      filtrePref = '';
      dessinerAffixes();
    };
  } else {
    conteneur.className = '';
  }
  const c = $('compteCibles');
  if (c) c.textContent = cibles.size ? t('grille.compte', { n: cibles.size }) : '';
  dessinerPriorite();
}

/* ================================================================
   LE RECAP DE PRIORITE

   La grille ci-dessus dit QUELS affixes et à quel niveau ; elle ne dit
   jamais dans quel ORDRE les servir si le stuff ne peut pas tout tenir.
   `cibles` est une Map, donc déjà ordonnée par construction (dernier
   niveau posé = dernière position) -- ce recap la rend VISIBLE et
   réordonnable, et son ordre est ce que `construire()` lit comme
   priorité (voir couvertureEffective). Rien ne change tant qu'on n'y
   touche pas : l'ordre de clic reste la priorité par défaut. */
let _prioriteTraine = null;

function reordonnerCibles(depuis, versNom, avant) {
  const entrees = [...cibles.entries()];
  const iDepuis = entrees.findIndex(([n]) => n === depuis);
  if (iDepuis < 0) return;
  const [entree] = entrees.splice(iDepuis, 1);
  let iVers = entrees.findIndex(([n]) => n === versNom);
  if (iVers < 0) iVers = entrees.length;
  else if (!avant) iVers += 1;
  entrees.splice(iVers, 0, entree);
  cibles.clear();
  for (const [n, v] of entrees) cibles.set(n, v);
}

function lignePriorite(nom, rang) {
  const el = document.createElement('div');
  el.className = 'prioriteLigne';
  el.draggable = true;
  el.dataset.affixe = nom;
  const vise = cibles.get(nom);
  const p = palier(nom);
  const max = plafond(nom);
  el.innerHTML = `<span class="poignee" aria-hidden="true">⠿</span>
    <span class="rang">${rang + 1}</span>
    ${pastille(nom)}<span class="txt">${echapper(libelleAffixe(nom))}</span>
    <span class="niv">${vise}/${max}</span>
    <span class="rapide">
      <button type="button" class="palier"${p ? '' : ' disabled'}
        title="${p ? echapper(t('priorite.viserPalier', { n: p })) : echapper(t('priorite.sansPalier'))}"
        >${t('priorite.palier')}</button>
      <button type="button" class="max" title="${echapper(t('priorite.viserMax', { n: max }))}"
        >${t('priorite.max')}</button>
    </span>
    <button type="button" class="retirer" title="${echapper(t('affixes.retirer'))}">✕</button>`;

  const btnPalier = el.querySelector('.palier');
  const btnMax = el.querySelector('.max');
  btnPalier.classList.toggle('actif', !!p && vise === p);
  btnMax.classList.toggle('actif', vise === max);
  if (p) btnPalier.onclick = () => { cibles.set(nom, p); dessinerAffixes(); majBudgetVin(); };
  btnMax.onclick = () => { cibles.set(nom, max); dessinerAffixes(); majBudgetVin(); };
  el.querySelector('.retirer').onclick = () => { cibles.delete(nom); dessinerAffixes(); majBudgetVin(); };

  el.ondragstart = (ev) => {
    _prioriteTraine = nom;
    el.classList.add('traine');
    ev.dataTransfer.effectAllowed = 'move';
    // Firefox exige des donnees pour autoriser le glisser -- inutilisees
    // ici, la reorganisation se fait via _prioriteTraine.
    ev.dataTransfer.setData('text/plain', nom);
  };
  el.ondragend = () => {
    _prioriteTraine = null;
    el.classList.remove('traine');
    el.parentElement?.querySelectorAll('.prioriteLigne.survole')
      .forEach((n) => n.classList.remove('survole'));
  };
  el.ondragover = (ev) => {
    if (!_prioriteTraine || _prioriteTraine === nom) return;
    ev.preventDefault();
    el.classList.add('survole');
  };
  el.ondragleave = () => el.classList.remove('survole');
  el.ondrop = (ev) => {
    ev.preventDefault();
    el.classList.remove('survole');
    if (!_prioriteTraine || _prioriteTraine === nom) return;
    const rect = el.getBoundingClientRect();
    const avant = ev.clientY < rect.top + rect.height / 2;
    reordonnerCibles(_prioriteTraine, nom, avant);
    dessinerPriorite();
  };
  return el;
}

function dessinerPriorite() {
  const conteneur = $('listePriorite');
  if (!conteneur) return;
  const noms = [...cibles.keys()];
  conteneur.hidden = !noms.length;
  if (!noms.length) { conteneur.innerHTML = ''; return; }
  conteneur.innerHTML = `<div class="prioriteTete">${t('priorite.titre')}${
    noms.length > 1 ? ' — ' + t('priorite.aide') : ''}</div>
    <div class="prioriteListe"></div>`;
  const boite = conteneur.querySelector('.prioriteListe');
  noms.forEach((nom, i) => boite.appendChild(lignePriorite(nom, i)));
}

/* ======================================================================
   LA GRILLE PLEIN ÉCRAN

   La colonne de gauche montre quatre affixes à la fois sur quarante-quatre.
   Choisir une poignée de cibles y demande de faire défiler entre chaque
   clic, et de perdre de vue ce qu'on a déjà pris. La grille les met tous
   sous les yeux d'un coup.

   DEUX PARTIS PRIS.

   Les niveaux sont des BOUTONS, pas une liste déroulante : poser Valor 5
   devient un clic au lieu de trois, et on voit d'un coup d'œil où en est
   chaque affixe sans rien ouvrir.

   La recherche DÉSIGNE au lieu de filtrer. Filtrer réorganise la grille à
   chaque frappe et fait perdre les repères ; ici les positions ne bougent
   jamais, les correspondances s'allument et le reste s'efface. On garde
   ainsi la mémoire visuelle d'une recherche à l'autre.
   ====================================================================== */
function tuileAffixe(nom) {
  const info = D.affixes[nom];
  const el = document.createElement('div');
  const reel = affixeReel(nom);
  el.className = 'gAff affixe' + (reel ? '' : ' horsEquip');
  el.dataset.affixe = nom;
  // L'autre nom du jeu en tete : c'est ce que cherchera le joueur qui l'a
  // On affiche le nom du jeu ; l'infobulle rappelle l'AUTRE, celui de nos
  // tables, pour qui l'aurait croise dans un vieux build ou un export.
  const bouts = [];
  if (!reel) bouts.push(t('affixes.horsEquip'));
  if (AUTRES_NOMS[nom]) bouts.push(t('affixes.aussi', { nom }));
  if (info.desc) bouts.push(info.desc);
  el.title = bouts.join('\n\n')
    + (info.eff ? '\n\n' + info.eff.map((e, i) => `${i + 1}. ${e}`).join('\n') : '');
  // DEUX LIGNES, PAS UNE. Sur une seule, le nom devait céder sa place aux
  // huit boutons et « Energy Recovery Speed Increase » finissait en
  // « Energy Rec… ». Le nom prend la première ligne et se lit en entier,
  // les niveaux prennent la seconde sur toute la largeur.
  // Le nombre de boutons DIT déjà le maximum de l'affixe : répéter
  // « max 7 » à côté prendrait la place du nom pour ne rien apprendre.
  el.innerHTML = `<div class="gTete">
      <button class="gPref pref"></button>
      ${pastille(nom)}<span class="txt">${echapper(libelleAffixe(nom))}</span>
      ${selectVin(nom)}
    </div>
    <div class="gNiv"></div>`;
  const rangee = el.querySelector('.gNiv');

  // Le Victory Wine se règle ici aussi : c'est la même consigne que le
  // niveau visé, la séparer sur deux écrans obligeait à faire l'aller-retour.
  // Le tableau des résultats porte le même sélecteur, construit par la même
  // fonction ; les deux restent d'accord sans qu'on ait à les synchroniser.
  const vin = el.querySelector('.vin');
  vin.onchange = () => appliquerVin(nom, vin.value);
  majEtatVin(el);

  // L'étoile est aussi ici : sans elle, on ne pourrait marquer ses favoris
  // que dans la colonne étroite, donc jamais depuis la vue qui sert à les
  // parcourir tous.
  const bp = el.querySelector('.gPref');
  const majPref = () => {
    const v = prefs.get(nom);
    bp.dataset.etat = v || 'neutre';
    bp.textContent = v === 'bonus' ? '★' : (v === 'non' ? '✕' : '☆');
    bp.title = t(v === 'bonus' ? 'pref.bonus' : (v === 'non' ? 'pref.non' : 'pref.neutre'));
  };
  bp.onclick = () => {
    const i = CYCLE_PREF.indexOf(prefs.get(nom));
    const suivant = CYCLE_PREF[(i + 1) % CYCLE_PREF.length];
    if (suivant) prefs.set(nom, suivant); else prefs.delete(nom);
    majPref();
    dessinerAffixes();
    // Sous filtre, l'affixe qu'on vient de démarquer n'a plus sa place ici.
    if (filtrePref) dessinerGrilleAffixes();
  };
  majPref();

  const peindre = () => {
    const vise = cibles.get(nom);
    el.classList.toggle('actif', cibles.has(nom));
    for (const b of rangee.children) {
      const v = b.dataset.niveau === '' ? undefined : Number(b.dataset.niveau);
      b.classList.toggle('choisi', v === undefined ? !cibles.has(nom) : v === vise);
    }
  };

  const poser = (v) => {
    if (v === null) cibles.delete(nom); else cibles.set(nom, v);
    peindre();
    majCompteursGrille();
    // La colonne de gauche montre le même état : elle se refait tout de
    // suite, pour qu'on ne découvre pas l'écart en refermant la grille.
    dessinerAffixes();
    majBudgetVin();
  };

  const bouton = (libelle, valeur, palier) => {
    const b = document.createElement('button');
    b.textContent = libelle;
    b.dataset.niveau = valeur === null ? '' : String(valeur);
    if (palier) b.classList.add('palier');
    b.title = palier ? t('grille.palier', { n: valeur }) : '';
    // Recliquer le niveau déjà posé le retire : c'est le geste attendu, et
    // ça évite d'aller chercher le tiret à l'autre bout de la rangée.
    // Un affixe qu'aucune piece ne porte ne peut pas etre vise : le bouton
    // resterait un piege, il est donc inerte.
    b.disabled = !reel;
    if (reel) b.onclick = () => poser(cibles.get(nom) === valeur ? null : valeur);
    rangee.appendChild(b);
  };
  bouton('—', null, false);
  for (let i = 1; i <= info.cap; i += 1) bouton(String(i), i, info.palier === i);
  peindre();
  return el;
}

function majCompteursGrille() {
  const c = $('grilleCompte');
  if (c) c.textContent = t('grille.compte', { n: cibles.size });
  const b = $('grilleBudget');
  if (b) { b.textContent = $('budgetVin').textContent; b.className = $('budgetVin').className; }
}

function dessinerGrilleAffixes() {
  const corps = $('grilleCorps');
  if (!corps) return;
  corps.innerHTML = '';
  const ordre = Object.keys(D.affixes).sort((x, y) =>
    (affixeReel(y) ? 1 : 0) - (affixeReel(x) ? 1 : 0) || x.localeCompare(y));
  for (const nom of ordre) {
    if (!passeFiltrePref(nom)) continue;
    corps.appendChild(tuileAffixe(nom));
  }
  dessinerChipsPref($('triPrefGrille'), () => {
    dessinerGrilleAffixes(); dessinerAffixes();
  });
  majCompteursGrille();
  eclairerGrille($('grilleRecherche').value || '');
}

/* Les puces de tri, identiques des deux côtés. Le filtre est une seule
   variable partagée : choisir « ★ » dans la grille laisse la colonne de
   gauche sur les mêmes affixes en refermant, ce qui évite de se demander
   pourquoi la liste a changé. */
function dessinerChipsPref(boite, apres) {
  if (!boite) return;
  const OPTS = [['', '—', 'pref.tous'], ['bonus', '★', 'pref.filtreFav'],
                ['non', '✕', 'pref.filtreNon'], ['vise', '●', 'pref.filtreVise']];
  boite.innerHTML = '';
  for (const [v, sym, cle] of OPTS) {
    const b = document.createElement('button');
    b.className = 'chipPref' + (filtrePref === v ? ' actif' : '');
    b.textContent = sym;
    b.title = t(cle);
    // Recliquer la puce active revient à « tout » : pas besoin de viser le
    // tiret pour sortir d'un filtre.
    b.onclick = () => { filtrePref = (filtrePref === v ? '' : v); apres(); };
    boite.appendChild(b);
  }
}

function eclairerGrille(filtre) {
  const corps = $('grilleCorps');
  if (!corps) return;
  const f = (filtre || '').trim().toLowerCase();
  let premier = null;
  let trouves = 0;
  for (const tuile of corps.children) {
    const ok = !f || correspondAffixe(tuile.dataset.affixe, f);
    tuile.classList.toggle('brille', !!f && ok);
    tuile.classList.toggle('terne', !!f && !ok);
    if (f && ok) { trouves += 1; if (!premier) premier = tuile; }
  }
  const c = $('grilleCompte');
  if (c) {
    c.textContent = f
      ? t(trouves ? 'grille.trouves' : 'grille.aucun', { n: trouves })
      : t('grille.compte', { n: cibles.size });
  }
  // On amène la première correspondance sous les yeux, sans sauter : si
  // elle est déjà visible, `nearest` ne bouge rien.
  if (premier) premier.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function ouvrirGrille() {
  const v = $('grilleAffixes');
  if (!v) return;
  dessinerGrilleAffixes();
  v.hidden = false;
  // La page derrière ne doit pas défiler pendant qu'on est dans la grille.
  document.body.style.overflow = 'hidden';
  const ch = $('grilleRecherche');
  if (ch) { ch.value = ($('recherche').value || ''); ch.focus(); ch.select(); }
  eclairerGrille(ch ? ch.value : '');
}

function fermerGrille() {
  const v = $('grilleAffixes');
  if (!v || v.hidden) return;
  v.hidden = true;
  document.body.style.overflow = '';
  // Rien à valider : la grille écrivait déjà dans le même état. On remet
  // seulement la colonne de gauche et le budget au propre.
  dessinerAffixes();
  majBudgetVin();
}

function materiau(type, niveau) {
  return D.materiaux[`${type},${niveau}`] || '?';
}

/* Combien de pièces sont figées, et de quoi les libérer d'un clic. Un
   verrou oublié explique des résultats bizarres — il doit se voir. */
function majNoteVerrous() {
  const n = $('noteVerrous');
  if (!n) return;
  if (!verrouilles.size) { n.innerHTML = ''; return; }
  n.innerHTML = `<span class="ok">${t('verrou.compte', { n: verrouilles.size })}</span>
    <button id="toutDeverrouiller">${t('verrou.tout')}</button>`;
  $('toutDeverrouiller').onclick = () => {
    verrouilles.clear();
    if (dernier) afficher(dernier, Number($('classe').value));
    else majNoteVerrous();
  };
}

// N'APPELÉE QU'APRÈS UN BUILD RÉUSSI (res.suffisant) : c'est le seul moment
// où l'outil vient de livrer sa valeur. Une fermeture est définitive
// (localStorage), donc réappeler cette fonction ensuite ne redonne rien.
function afficherRappelDon() {
  const box = $('donRappel');
  if (!box || localStorage.getItem('donRappelFerme') === '1') return;
  box.hidden = false;
  $('donRappelFermer').onclick = () => {
    box.hidden = true;
    localStorage.setItem('donRappelFerme', '1');
  };
}

function afficher(res, classe) {
  const pd = $('paperdoll');
  pd.innerHTML = '';
  for (const slot of D.ordreSlots) {
    const it = res.slotItems[slot];
    const carte = document.createElement('div');
    carte.className = 'piece';
    carte.dataset.slot = slot;
    if (!it) {
      carte.innerHTML = `<div class="slot">${D.nomsSlots[slot] || slot}</div>
                         <div class="vide">—</div>`;
      pd.appendChild(carte); continue;
    }
    const couleur = D.couleurs[String(it.g)] || '#9fb2c4';
    const gems = res.sockets.filter((s) => s.slot === slot)
      .map((s) => `<div class="socket">
        ${s.gem && s.gem.ic ? `<img src="icones/${s.gem.ic}" alt="" loading="lazy">`
                            : '<span class="creux"></span>'}
        <span>${s.gem ? `<b>${s.gem.n}</b>` : `<span class="pas">${t('equip.vide')}</span>`}
          <span class="mat">${materiau(s.type, s.level)} ${s.level === 2 ? 'II' : 'I'}</span></span>
      </div>`).join('');
    carte.style.setProperty('--tinte', couleur);
    carte.style.borderColor = couleur + '66';
    carte.title = infobulle(it);
    // LA FLÈCHE N'EST POSÉE QUE POUR LES SLOTS OÙ ELLE SERT (voir
    // SLOTS_ALT_PAPERDOLL) : les emplacements où plusieurs pièces du même
    // palier ne se distinguent que par une stat brute (dégâts / résistance /
    // armure) — pas par leurs affixes. Le conteneur reste vide tant que
    // brancherAltPaperdoll() n'a pas confirmé qu'il existe une autre option ;
    // afficher() lui-même ne calcule rien, pour rester rapide.
    const zoneAlt = SLOTS_ALT_PAPERDOLL.includes(slot)
      ? `<div class="altPieceSlot" data-slot="${echapper(slot)}"></div>` : '';
    // LE MÊME MOT QUE LE SÉLECTEUR AU-DESSUS DES AFFIXES : dire quelle
    // déclinaison la pièce porte réellement, sans ouvrir de menu — qu'elle
    // vienne d'un choix explicite ou de l'auto.
    const badgeSaveur = libelleSaveur(slot, it);
    carte.innerHTML = `<div class="slot">${D.nomsSlots[slot] || slot}</div>
      ${vignette(it.ic, couleur)}
      <div class="nom" style="color:${couleur}">${it.n}</div>
      ${badgeSaveur ? `<div class="saveurTag">${badgeSaveur}</div>` : ''}
      <div class="inne${it.i ? '' : ' sans'}">${it.i ? t('equip.inne') + ' ' + it.i : t('equip.aucunInne')}</div>
      ${zoneAlt}
      ${gems}
      <button class="cadenas" type="button"></button>
      <button class="retirer" type="button" title="${echapper(t('equip.retirer'))}">✕</button>`;
    // LA CROIX. Vide CE slot et relance le solveur dessus, en figeant
    // temporairement les sept autres pièces (leurs cadenas réels restent
    // intacts, on n'écrit jamais dans `verrouilles` pour elles) : le reste
    // du build ne bouge pas, seul cet emplacement change.
    carte.querySelector('.retirer').onclick = (ev) => {
      ev.stopPropagation();
      supprimerPiece(slot);
    };
    // LE CADENAS. Il fige CETTE pièce avec les gemmes qu'elle porte à cet
    // instant : c'est la photo du moment, pas une consigne abstraite.
    const cad = carte.querySelector('.cadenas');
    const gemmesIci = res.sockets.filter((s) => s.slot === slot)
      .sort((a, b) => a.index - b.index).map((s) => s.gem || null);
    const majCadenas = () => {
      const ferme = verrouilles.has(slot);
      cad.textContent = ferme ? '🔒' : '🔓';
      cad.classList.toggle('ferme', ferme);
      carte.classList.toggle('verrouille', ferme);
      cad.title = t(ferme ? 'verrou.ouvrir' : 'verrou.fermer');
    };
    cad.onclick = (ev) => {
      ev.stopPropagation();
      if (verrouilles.has(slot)) verrouilles.delete(slot);
      else verrouilles.set(slot, { item: it, gemmes: gemmesIci });
      majCadenas();
      majNoteVerrous();
      // LE CADENAS FIGE, LA FLÈCHE PROPOSE : les deux ne peuvent pas dire le
      // contraire. Sans ce recalcul, verrouiller Ring laissait sa flèche
      // continuer d'offrir des échanges — le clic bloqué par le moteur, la
      // pièce n'aurait juste plus bougé sans que ce soit expliqué.
      if (SLOTS_ALT_PAPERDOLL.includes(slot)) {
        setTimeout(() => dessinerAlternatives(res, classe), 0);
      }
    };
    majCadenas();
    pd.appendChild(carte);
  }
  // LA DEUXIEME ARME, A PART. Une 9e carte, hors de la boucle des 8
  // emplacements du solveur : elle ne porte ni cadenas ni flèche
  // d'alternative, puisqu'elle ne participe a aucun calcul. La note rappelle
  // pourquoi elle n'apparait dans aucune ligne du tableau des affixes.
  if (res.secondeArme && res.secondeArme.item) {
    const it2 = res.secondeArme.item;
    const couleur2 = D.couleurs[String(it2.g)] || '#9fb2c4';
    const carte2 = document.createElement('div');
    carte2.className = 'piece secondeArme';
    carte2.style.setProperty('--tinte', couleur2);
    carte2.style.borderColor = couleur2 + '66';
    carte2.title = infobulle(it2);
    const gems2 = (res.secondeArme.sockets || []).map((s) => `<div class="socket">
        ${s.gem && s.gem.ic ? `<img src="icones/${s.gem.ic}" alt="" loading="lazy">`
                            : '<span class="creux"></span>'}
        <span>${s.gem ? `<b>${s.gem.n}</b>` : `<span class="pas">${t('equip.vide')}</span>`}
          <span class="mat">${materiau(s.type, s.level)} ${s.level === 2 ? 'II' : 'I'}</span></span>
      </div>`).join('');
    const noteArme2 = res.secondeArme.approche
      ? t('perso.secondeArmeApproche') : t('perso.secondeArmeNote');
    // CE QUI MANQUE, PAR AFFIXE. "Approximatif" seul oblige a comparer les
    // deux cartes a la main pour savoir quoi -- ici la carte le dit tout de
    // suite : quels affixes de l'arme active la deuxieme ne reprend pas en
    // entier, et de combien il s'en faut.
    const manque = res.secondeArme.manque || {};
    const manqueTexte = Object.entries(manque)
      .sort((a, b) => b[1] - a[1])
      .map(([a, n]) => `${echapper(a)} −${n}`).join(' · ');
    carte2.innerHTML = `<div class="slot">${t('equip.secondeArme')}</div>
      ${vignette(it2.ic, couleur2)}
      <div class="nom" style="color:${couleur2}">${it2.n}</div>
      <div class="inne${it2.i ? '' : ' sans'}">${it2.i ? t('equip.inne') + ' ' + it2.i : t('equip.aucunInne')}</div>
      ${gems2}
      <div class="pas" style="font-size:11px;margin-top:4px">${noteArme2}</div>
      ${manqueTexte ? `<div class="ko" style="font-size:11px;margin-top:2px">${
          t('perso.secondeArmeManque')} ${manqueTexte}</div>` : ''}`;
    pd.appendChild(carte2);
  }
  majNoteVerrous();

  // UN AFFIXE MONTÉ AU VIN SEUL DOIT FIGURER ICI. On ne parcourait que les
  // cibles ; verser deux points sur un affixe qu'on ne vise pas donnait donc
  // un réglage sans aucune trace à l'écran. Il entre dans le tableau avec un
  // tiret dans la colonne « visé » : rien n'était demandé, et pourtant il est
  // là.
  const vinSeul = [...((res.vinPoints || new Map()).entries())]
    .filter(([n, p]) => p > 0 && !cibles.has(n))
    .map(([n]) => n);
  const rangs = [...[...cibles.entries()].sort((a, b) => b[1] - a[1])
                   .map(([n, v]) => [n, v]),
                 ...vinSeul.sort().map((n) => [n, null])];
  const lignes = rangs.map(([nom, vise]) => {
    const eq = res.couvert[nom] || 0;
    const v = (res.vinPoints && res.vinPoints.get(nom)) || 0;
    const total = Math.min(plafond(nom), eq + v);
    const cls = vise == null ? '' : (total >= vise ? 'ok' : 'ko');
    const cat = (D.affixes[nom] || {}).cat;
    // TOUTE LA LIGNE EST MARQUÉE, pas seulement le total. Un chiffre rouge
    // isolé dans la dernière colonne oblige à repartir vers la gauche pour
    // savoir DE QUEL affixe il s'agit ; sur dix lignes on se trompe. La
    // ligne entière porte la couleur, le nom est trouvé sans chercher.
    // Le ✓ / ✗ se lit avant le nombre : on sait si ça passe sans comparer
    // deux chiffres de colonnes différentes.
    const marque = vise == null ? '' : (total >= vise ? '✓' : '✗');
    // LE PALIER, EN COLONNE : le chiffre est toujours là (à quel niveau
    // il se trouve), le losange ne s'allume que si LE BUILD ACTUEL
    // l'atteint vraiment (stuff + vin). Un tiret pour les affixes qui
    // n'en ont pas — Elusive, Curse — plutôt qu'un vide qui laisse croire
    // à un oubli.
    const p = palier(nom);
    const colonnePalier = p
      ? `${p}${total >= p ? ` <span class="losange" title="${
            echapper(t('palier.quoi', { n: p }))}">◆</span>` : ''}`
      : '—';
    // LE VIN PEUT DÉPASSER LA CIBLE SANS LE DIRE. Warblood verse jusqu'à son
    // plafond par affixe même au-delà de ce qui était demandé — la cible
    // reste écrite « 3 » pendant que le total vaut déjà 4. Rien ne signalait
    // ce cadeau : la Marge de manœuvre le tait aussi, puisque de son point de
    // vue actuelDe() vaut déjà 4 et qu'il n'y a plus rien à gagner. Un joueur
    // a fini par le découvrir en tâtonnant manuellement. Le total devient
    // cliquable pour verrouiller ce que le vin donne déjà, au lieu de
    // dépendre d'un hasard de réglage qu'un autre changement peut effacer.
    const depasse = vise != null && total > vise;
    const totalAffiche = depasse
      ? `<button type="button" class="majCible" data-a="${echapper(nom)}" data-n="${total}"
           title="${echapper(t('table.dejaPlus', { n: total }))}">${total}</button>`
      : String(total);
    return `<tr data-a="${echapper(nom)}"${cls === 'ko' ? ' class="ligneKo"' : ''}>
            <td><span style="display:flex;align-items:center;gap:8px">
              ${pastille(nom)}${libelleAffixe(nom)}</span></td>
            <td class="n appoint">${vise == null ? '—' : vise}</td>
            <td class="n appoint palierCol">${colonnePalier}</td>
            <td class="n appoint">${eq}</td>
            <td class="n vinCase">${selectVin(nom)}</td>
            <td class="n total ${cls}">${totalAffiche}<span class="marque">${marque}</span></td>
            ${$('mixte').checked ? `<td class="n cout" data-cout="${echapper(nom)}">${
              vise == null ? '' : '<span class="pas">…</span>'}</td>` : ''}</tr>`;
  }).join('');
  const bonus = Object.entries(res.couvert)
    .filter(([n]) => !cibles.has(n) && !vinSeul.includes(n))
    .sort((a, b) => b[1] - a[1])
    .map(([n, v]) => `${n} ${v}`).join(' · ');
  $('tableauAffixes').innerHTML = lignes
    ? `<table><tr><th>${t('table.affixe')}</th><th>${t('table.vise')}</th>`
      + `<th title="${echapper(t('table.palierQuoi'))}">${t('table.palier')}</th>`
      + `<th>${t('table.equip')}</th><th>${t('table.vin')}</th>`
      + `<th>${t('table.total')}</th>`
      + ($('mixte').checked
          ? `<th title="${echapper(t('cout.quoi'))}">${t('table.cout')}</th>` : '')
      + `</tr>${lignes}</table>`
      /* EN RARETE UNIQUE, LA COLONNE N'AURAIT RIEN A DIRE.
         Les huit pieces partagent un seul cran : descendre une cible d'un
         niveau ne fait pas tomber tout le build d'un rang, donc chaque ligne
         afficherait « gratuit » et on croirait a une panne. Mesure : 0 pour
         les quatre cibles en rarete unique, 1 / 2 / 0 sur les memes cibles en
         panache. On explique l'absence plutot que d'afficher du vide. */
      + ($('mixte').checked ? ''
          : `<div class="pas" style="margin-top:7px;font-size:11.5px">${
              t('cout.uniquement')}</div>`)
      + (bonus ? `<div style="margin-top:6px" class="pas">${t('table.prime')} ${bonus}</div>` : '')
    : `<span class="pas">${t('table.aucun')}</span>`;
  // Les sélecteurs de vin du tableau deviennent vivants ici : c'est le seul
  // moment où ils existent dans le document.
  _resAffiche = res;
  brancherVinTableau();
  repeindreVin(res);

  // En différé : chercher les suggestions coûte presque autant qu'un build,
  // et le faire ici retarderait l'affichage de tout le reste pour rien.
  setTimeout(() => { dessinerSuggestions(res, classe);
                     dessinerAlternatives(res, classe);
                     dessinerFiche(res, classe);
                     lancerCoutPaliers(res, classe, $('arme').value || null); }, 0);

  const libres = res.sockets.filter((s) => !s.gem).length;
  const compte = {};
  for (const s of res.sockets) if (!s.gem) {
    const k = `${materiau(s.type, s.level)} ${s.level === 2 ? 'II' : 'I'}`;
    compte[k] = (compte[k] || 0) + 1;
  }
  $('bilan').textContent = libres
    ? `${t('equip.libres', { n: libres })} ` +
      Object.entries(compte).map(([k, n]) => `${n} ${k}`).join(' · ')
    : t('equip.pleins');

  /* LE VERDICT, SOUS L'ÉQUIPEMENT. La même réponse qu'en haut à gauche,
     mais posée là où l'on regarde ses pièces et ses gemmes : savoir si le
     compte y est ne doit pas obliger à remonter la page.
     Il est recalculé ici, et non recopié de la ligne d'état, pour rester
     juste après un build chargé ou une suggestion appliquée — deux cas où
     la ligne d'état parle d'autre chose. */
  const verdict = $('verdictEquip');
  if (verdict) {
    const atteint = (nom) => Math.min(plafond(nom),
      (res.couvert[nom] || 0)
      + ((res.vinPoints && res.vinPoints.get(nom)) || 0));
    const manques = rangs
      .filter(([nom, vise]) => vise != null && atteint(nom) < vise)
      .map(([nom, vise]) => `${nom} ${vise}`);
    if (!rangs.some(([, vise]) => vise != null)) {
      verdict.textContent = '';
      verdict.className = '';
    } else if (!manques.length) {
      verdict.className = 'ok';
      verdict.textContent = t('etat.ok');
    } else {
      verdict.className = 'ko';
      verdict.textContent = t('equip.manquent', { liste: manques.join(', ') });
    }
  }

  dessinerMarge(res);

  try {
    const objets = {};
    for (const [codeSlot, slotOutil] of Object.entries(D.codec.versGameData)) {
      const it = res.slotItems[slotOutil];
      if (!it) continue;
      const trous = D.codec.trous[String(it.id)] || 0;
      const gemmes = new Array(trous).fill(0);
      for (const s of res.sockets) {
        if (s.slot === slotOutil && s.gem && s.index < trous) gemmes[s.index] = Number(s.gem.id);
      }
      objets[Number(codeSlot)] = { cfg: Number(it.id), gemmes };
    }
    // LA DEUXIEME ARME A SON PROPRE EMPLACEMENT DANS LE JEU (11), JUSTE
    // APRES L'ARME PRINCIPALE (10) -- versGameData ne connaissait que les 8
    // emplacements que le solveur remplit, donc le code genere oubliait
    // cette 9e piece meme quand le paperdoll la montrait. Sean l'a signale :
    // la piece verte n'arrivait jamais en jeu. Table verifiee identique a
    // celle de l'arme principale (memes 114 objets), c'est bien elle.
    if (res.secondeArme && res.secondeArme.item) {
      const it2 = res.secondeArme.item;
      const trous2 = D.codec.trous[String(it2.id)] || 0;
      const gemmes2 = new Array(trous2).fill(0);
      for (const s of (res.secondeArme.sockets || [])) {
        if (s.gem && s.index < trous2) gemmes2[s.index] = Number(s.gem.id);
      }
      objets[11] = { cfg: Number(it2.id), gemmes: gemmes2 };
    }
    $('code').value = encoderCode(classe, objets);
    // La classe DOUBLE la pseudo-classe :disabled. Certains moteurs ne
    // recalculent pas le style quand `disabled` change par script : le
    // bouton restait alors gris alors qu'il était devenu cliquable. Une
    // classe posée explicitement, elle, invalide toujours.
    activerCopie(true);
    $('noteCode').textContent = '';
  } catch (err) {
    $('code').value = '';
    activerCopie(false);
    $('noteCode').textContent = t('code.impossible', { message: err.message });
  }

  /* Un resultat existe : la colonne cede l'accueil aux vraies cartes, et les
     deux qui etaient vides s'ouvrent — sauf si l'utilisateur les avait
     explicitement repliees, auquel cas son choix prime. */
  dessinerAccueil();
  // L'equipement ET le tableau des affixes obtenus s'ouvrent tout seuls :
  // sans ca, un clic sur "Build it" pouvait ne rien montrer de neuf a
  // l'ecran si tous les bandeaux etaient deja replies -- rien ne prouvait
  // qu'un calcul avait eu lieu. Le code d'import, lui, reste replie tant
  // qu'on ne le demande pas.
  poserPliAuto('carteEquip', true);
  poserPliAuto('carteTableau', true);
}

function activerCopie(oui) {
  const b = $('copier');
  if (!b) return;
  b.disabled = !oui;
  b.classList.toggle('pret', !!oui);
}

/* La marge à l'écran. Cliquer une ligne pose l'affixe comme cible au niveau
   annoncé : c'est le geste qu'on allait faire à la main juste après. */
/* ======================================================================
   MARGE DE MANŒUVRE — une seule carte, trois sens

   « Qu'est-ce que je peux encore bouger ? » se pose de trois façons, et
   les répartir sur deux cartes les faisait se contredire à l'écran : les
   Suggestions proposaient d'échanger des bottes pour un Sky Piercer que
   personne n'avait demandé, pendant que « Encore disponible », qui ne
   regarde que les emplacements libres, n'en parlait pas.

   DESCENDRE — les cibles ne passent pas : jusqu'où redescendre. Aucun
   recalcul, aucune estimation : le moteur a déjà produit le meilleur stuff
   pour la consigne, donc ramener chaque cible manquée au niveau qu'il
   atteint déjà rend l'ensemble réalisable avec ces pièces exactement.

   MONTER — ce que les emplacements de gemme encore libres permettent, sans
   toucher à une seule pièce. C'est toujours le geste le moins cher.

   ÉCHANGER — remplacer une pièce par une autre du même cran. Ça ne se
   propose que si le gain sert un affixe visé ou marqué ★ : changer une
   pièce se mérite.
   ====================================================================== */
let _nbEchanges = 0;
let _nbMarge = 0;
let _nbBaisse = 0;

/* L'INVENTAIRE COMPLET, A LA DEMANDE.
 *
 * Les deux voies rapides — gemme sur emplacement reaffectable, inne d'une
 * piece echangeable — ne disent pas tout. Mesure sur un build reel : 41
 * affixes etaient reellement montables d'un cran a rarete constante, la
 * carte n'en annoncait que 16. Les 25 manquants demandaient au moteur de
 * redisposer PLUSIEURS pieces a la fois, ce qu'aucune des deux voies ne
 * sait voir.
 *
 * La seule reponse exacte est donc de poser la question au moteur, affixe
 * par affixe : « si je demande un cran de plus sur celui-la, tu y arrives
 * sans rien perdre et sans monter en rarete ? ». C'est exactement ce que
 * fera le clic, donc la reponse ne peut pas mentir.
 *
 * Ca coute 161 ms par affixe, ~7 s au total : hors de question a chaque
 * build. Mais la carte est repliee par defaut — on ne paie qu'a
 * l'ouverture, par tranches, et les lignes apparaissent au fur et a mesure
 * plutot que de figer la page.
 */
/* Les planchers de rarete regles par l'utilisateur, lus a un seul endroit.
   Ils etaient recopies dans `dessinerMarge` et OUBLIES dans l'analyse
   complete, qui passait `{}` : la carte proposait alors des gains que le
   clic suivant ne pouvait pas tenir, puisque `calculer` applique bien les
   planchers, lui. */
/* Ce que coute un set, en crans de rarete cumules. Sert a verifier qu'une
   ligne de marge ne se paie pas en montant en rarete. */
function coutRarete(slotItems) {
  return Object.values(slotItems || {})
    .reduce((t, it) => t + ((it && it.g) || 0), 0);
}

/* CE QUE L'UTILISATEUR A DEMANDE, EMPLACEMENT PAR EMPLACEMENT.
 *
 * Deux niveaux de consigne, et le plus precis gagne :
 *   - la rarete generale, quand elle n'est pas sur « Auto » ;
 *   - le reglage d'un emplacement, qui la remplace pour lui seul.
 *
 * « Tout en Excellent sauf l'arme en Epic et le plastron en Legendary »
 * s'ecrit donc exactement comme on le dit. La rarete generale ne peut plus
 * etre un simple plancher : avec le panachage, l'allegement descendait sous
 * elle et sortait du Rare sur trois pieces alors qu'on avait demande du bleu
 * partout. Une consigne donnee est une consigne tenue.
 *
 * « Auto » laisse le moteur libre : c'est le defaut, et rien ne change pour
 * qui n'y touche pas. */
function planchersActuels() {
  const pl = {};
  if (!$('mixte') || !$('mixte').checked) return pl;
  const general = $('rarete') && $('rarete').value ? Number($('rarete').value) : 0;
  if (general) for (const slot of D.ordreSlots) pl[slot] = general;
  for (const sel of document.querySelectorAll('#plancherSlots select')) {
    if (sel.value) pl[sel.dataset.slot] = Number(sel.value);
  }
  return pl;
}

let _analyse = null;

function arreterAnalyse() {
  if (_analyse) { _analyse.stop = true; _analyse = null; }
}

function lancerAnalyseComplete(res) {
  arreterAnalyse();
  const boite = $('listeMarge');
  const note = $('margeMot');
  if (!boite || !res || !res.slotItems) return;
  const jeton = { stop: false };
  _analyse = jeton;

  const classe = Number($('classe').value);
  const arme = $('arme').value || null;
  const vp = res.vinPoints || new Map();
  const pieces = Object.values(res.slotItems).filter(Boolean);
  if (!pieces.length) return;
  const grade = Math.min(...pieces.map((i) => i.g));
  const mixte = $('mixte').checked;
  const vin = $('vin').checked;
  const cibleBase = [...cibles.entries()];
  const planchers = planchersActuels();
  const saveurs = saveursActuelles();
  const coutActuel = coutRarete(res.slotItems);
  const actuelDe = (n) => Math.min(plafond(n),
    (res.couvert[n] || 0) + (vp.get(n) || 0));

  const aTester = Object.keys(D.affixes)
    .filter((n) => affixeReel(n) && actuelDe(n) < plafond(n))
    .sort((a, b) => (cibles.has(b) ? 1 : 0) - (cibles.has(a) ? 1 : 0)
                 || a.localeCompare(b));
  // Les lignes deja posees par les deux voies rapides sont des ESTIMATIONS :
  // « il reste un emplacement qui accepte cette gemme ». Elles ne savent pas
  // que cet emplacement est peut-etre convoite par une autre cible. Le
  // moteur, lui, tranche. On les fait donc toutes confirmer, et celle qu'il
  // dement disparait au lieu de rester la a mentir.
  const dejaLa = new Map([...boite.querySelectorAll('.lm')]
    .map((e) => [e.dataset.affixe, e]));
  let i = 0;

  /* LA DICHOTOMIE D'UN AFFIXE SURVIT D'UNE TRANCHE A L'AUTRE.
   *
   * Le budget etait de 90 ms alors qu'une tache devient « longue » — donc
   * bloquante pour le navigateur — au-dela de 50 : aucune tranche ne pouvait
   * passer sous le seuil. Pire, il n'etait teste qu'entre deux AFFIXES, alors
   * qu'un affixe demande jusqu'a trois appels au moteur : une tranche pouvait
   * donc deborder largement au-dela de son budget.
   *
   * On garde donc l'etat de la recherche en cours et on rend la main entre
   * deux essais. Le plancher reste UN appel a `construire` : c'est la plus
   * petite unite indivisible, et descendre en dessous demanderait de sortir
   * le moteur du fil principal. */
  const BUDGET = 12;        // ms : une trame a 60 Hz
  let etat = null;          // dichotomie en cours : { nom, a, p, bas, haut, vise }

  const essaye = (nom, niveau) => {
    try {
      const r = construire(classe, arme,
        cibleBase.filter(([x]) => x !== nom).concat([[nom, niveau]]),
        grade, vin, mixte, planchers, vinManuel, verrousObjet(), saveurs);
      if (!r || !r.suffisant) return false;
      /* « SANS RIEN PERDRE » VEUT AUSSI DIRE SANS PAYER PLUS.
       *
       * En mode panache, `grade` est un PLANCHER : le moteur a le droit de
       * monter en rarete pour y arriver. La carte promettait pourtant
       * « l'inne d'une autre piece du meme cran », et validait des lignes qui
       * exigeaient deux Legendaires de plus. On refuse donc tout resultat qui
       * coute plus cher que le build actuel. */
      return coutRarete(r.slotItems) <= coutActuel;
    } catch (e) { return false; }
  };

  const poser = (e) => {
    let vise = e.vise;
    if (!vise && e.bas > e.a) vise = e.bas;
    const existante = dejaLa.get(e.nom);
    if (!vise) {
      // Le moteur dement l'estimation : la ligne s'en va.
      if (existante) { existante.remove(); dejaLa.delete(e.nom); }
      return;
    }
    if (existante) {
      // La ligne rapide existe deja ; on ne la remplace que si le moteur va
      // PLUS HAUT qu'elle ne l'annoncait.
      const dit = Number(existante.dataset.niveau || 0);
      if (dit >= vise) return;
      existante.remove(); dejaLa.delete(e.nom);
    }
    const ligne = ligneMarge({ nom: e.nom, actuel: e.a, atteignable: vise,
                               gain: vise - e.a, palier: e.p, via: 'moteur' });
    boite.appendChild(ligne);
    dejaLa.set(e.nom, ligne);
  };

  const tranche = () => {
    if (jeton.stop) return;
    const t0 = performance.now();
    while (performance.now() - t0 < BUDGET) {
      if (!etat) {
        if (i >= aTester.length) break;
        const nom = aTester[i]; i += 1;
        /* ON CHERCHE LE MAXIMUM, PAS LE CRAN SUIVANT.
         *
         * Annoncer « 0 → 1 » quand le build encaisse 0 → 5 d'un coup oblige a
         * cliquer cinq fois pour decouvrir ce qu'on pouvait savoir tout de
         * suite. Tester le palier puis retomber sur +1 ne suffisait pas non
         * plus : quand le palier ne passe pas, +4 passe peut-etre.
         *
         * On cherche donc le plus haut niveau qui tient, par dichotomie. Une
         * cible plus basse est toujours plus facile qu'une cible plus haute,
         * donc la reponse est monotone et la dichotomie est valide : trois
         * essais suffisent la ou en essayer sept coutait le double. */
        etat = { nom, a: actuelDe(nom), p: palier(nom),
                 bas: actuelDe(nom), haut: plafond(nom), vise: 0 };
      }
      if (etat.bas < etat.haut) {
        // UN essai par tour de boucle : c'est la granularite du budget.
        const milieu = Math.ceil((etat.bas + etat.haut) / 2);
        if (essaye(etat.nom, milieu)) { etat.vise = milieu; etat.bas = milieu; }
        else { etat.haut = milieu - 1; }
      } else {
        poser(etat);
        etat = null;
      }
    }
    if (note) {
      note.className = 'pas';
      if (i < aTester.length || etat) {
        note.textContent = t('marge.recherche', { fait: i, total: aTester.length });
      } else if (boite.querySelector('.lm')) {
        note.textContent = t('marge.aideCourt2');
      } else {
        /* LE BALAYAGE PEUT TOUT REFUTER.
         *
         * Les deux voies rapides posent des lignes, le moteur les dement une
         * a une, et la liste finit vide — mais le texte d'introduction, lui,
         * restait celui qui annonce « voici ce que tu peux prendre ». On
         * lisait donc une promesse au-dessus d'un vide, sur un build ou
         * quatre pieces sans inne sautaient aux yeux. La carte doit dire ce
         * qu'elle a trouve : rien, et pourquoi. */
        let raisons = [];
        try {
          raisons = pourquoiRien(res, Number($('classe').value), $('arme').value || null);
        } catch (e) { raisons = []; }
        note.innerHTML = `${echapper(t('marge.rien'))}`
          + (raisons.length
            ? '<ul style="margin:7px 0 0;padding-left:18px;line-height:1.6">'
              + raisons.map((r) => `<li>${echapper(r)}</li>`).join('') + '</ul>'
            : '');
      }
    }
    _nbMarge = boite.querySelectorAll('.lm').length;
    majCompteMarge();
    if (i < aTester.length || etat) setTimeout(tranche, 0);
    else if (_analyse === jeton) _analyse = null;
  };
  if (note) { note.className = 'pas';
              note.textContent = t('marge.recherche', { fait: 0, total: aTester.length }); }
  setTimeout(tranche, 0);
}

/* Une ligne de la marge, quelle que soit sa provenance : gemme, inne d'une
   piece, ou reponse directe du moteur. Toutes se cliquent pareil — on pose
   la cible et on relance. Poser la piece a la main paraissait plus direct,
   mais ça revenait a re-repartir les gemmes hors du moteur : le premier
   essai montait bien Stoic de 3 a 5 et faisait tomber Aegis et Fervor au
   passage. */
function ligneMarge(m) {
  const b = document.createElement('button');
  const franchit = m.palier && m.atteignable >= m.palier && m.actuel < m.palier;
  b.className = 'lm' + (franchit ? ' pal' : '') + (m.via === 'piece' ? ' viaPiece' : '');
  b.dataset.affixe = m.nom;
  b.dataset.niveau = String(m.atteignable);
  b.title = m.via === 'piece'
    ? t('marge.parPiece', { nom: m.nom, n: m.atteignable,
                            piece: m.piece.n, slot: D.nomsSlots[m.slot] || m.slot })
    : t('marge.poser', { nom: m.nom, n: m.atteignable });
  const moyen = m.via === 'piece' ? 'marge.viaPiece'
              : (m.via === 'moteur' ? 'marge.viaMoteur' : 'marge.viaGemme');
  b.innerHTML = `${pastille(m.nom)}
    <span class="nomA">${libelleAffixe(m.nom)}</span>
    ${franchit ? `<span class="marquePal"
      title="${t('palier.quoi', { n: m.palier })}">${t('sugg.palier')}</span>` : ''}
    <span class="moyen">${t(moyen)}</span>
    <span class="fleche">${m.actuel} → <span class="cible">${m.atteignable}</span></span>`;
  b.onclick = () => {
    cibles.set(m.nom, m.atteignable);
    dessinerAffixes();
    majBudgetVin();
    calculer();
  };
  return b;
}

function majCompteMarge() {
  const c = $('compteMarge');
  if (!c) return;
  if (_nbBaisse) { c.textContent = t('marge.compteBas', { n: _nbBaisse }); return; }
  // On compte l'inventaire, pas les echanges : ceux-la ont leur propre
  // section et leur propre titre. Additionner les deux donnait « 46 » a
  // cote d'une liste de 41 lignes.
  c.textContent = _nbMarge ? t('marge.compteHaut', { n: _nbMarge }) : '';
}

/* POURQUOI IL N'Y A RIEN.
 *
 * Une carte vide se lit comme une panne. Sur un build sature elle l'etait,
 * alors que la reponse existe et qu'elle est interessante : quatre pieces
 * sans inne, et pourtant aucune marge.
 *
 * La raison tient a une regle du jeu que la carte ne disait pas — sur un
 * meme cran, une piece a SOIT un inne, SOIT deux logements de gemme, jamais
 * les deux. Echanger une piece sans inne contre une piece qui en a un fait
 * donc perdre un logement ; si ce logement servait une cible, l'echange
 * coute plus qu'il ne rapporte. C'est exactement ce que le moteur trouve,
 * et c'est ce qu'il faut ecrire.
 */
function pourquoiRien(res, classe, arme) {
  const raisons = [];
  const vp = res.vinPoints || new Map();
  const cibleListe = [...cibles.entries()];
  const wantGear = Object.fromEntries(cibleListe
    .map(([n, l]) => [n, l - (vp.get(n) || 0)]).filter(([, l]) => l > 0));
  const tot = (cov, n) => Math.min(plafond(n), (cov[n] || 0) + (vp.get(n) || 0));
  const items = { ...res.slotItems };

  const libres = (res.sockets || []).filter((s) => !s.gem).length;
  const servent = (res.sockets || []).filter((s) => s.gem
    && s.gem.a.some((a) => cibles.has(a))).length;
  if (!libres && servent) raisons.push(t('marge.rienSockets', { n: servent }));

  // Les echanges qui gagneraient un inne mais couteraient un logement.
  for (const slot of D.ordreSlots) {
    const it = items[slot];
    if (!it || it.i || verrouilles.has(slot)) continue;
    const pool = poolDe(classe, slot, arme, 1, true)
      .filter((o) => o.g === it.g && o.i && (o.s || []).length < (it.s || []).length);
    if (!pool.length) continue;
    const cov = assembler({ ...items, [slot]: pool[0] }, wantGear, false).couvert;
    const casse = cibleListe.filter(([n, l]) => tot(cov, n) < l)
      .map(([n]) => libelleAffixe(n));
    if (!casse.length) continue;
    raisons.push(t('marge.rienEchange', {
      slot: D.nomsSlots[slot] || slot,
      inne: libelleAffixe(pool[0].i),
      casse: casse.join(', '),
    }));
  }
  return raisons;
}

function dessinerMarge(res) {
  // Un nouveau build rend l'analyse precedente caduque.
  arreterAnalyse();
  arreterCout();
  const carte = $('carteMarge');
  const boite = $('listeMarge');
  const mot = $('margeMot');
  if (!carte || !boite) return;
  carte.hidden = false;

  const atteint = (nom) => Math.min(plafond(nom), (res.couvert[nom] || 0)
    + ((res.vinPoints && res.vinPoints.get(nom)) || 0));
  const bas = [...cibles.entries()]
    .map(([nom, vise]) => ({ nom, vise, a: atteint(nom) }))
    .filter((x) => x.a < x.vise)
    .sort((x, y) => (y.vise - y.a) - (x.vise - x.a));

  _nbBaisse = bas.length;
  boite.className = 'grilleMarge';
  boite.innerHTML = '';

  if (bas.length) {
    // Tant que ça ne passe pas, monter ou échanger n'a aucun sens : la
    // seule question est de combien redescendre.
    if (mot) { mot.className = 'ko'; mot.style.fontSize = '12.5px';
               mot.textContent = t('marge.trop', { n: bas.length }); }
    for (const x of bas) {
      const b = document.createElement('button');
      b.className = 'lm baisse';
      b.title = t('marge.poser', { nom: x.nom, n: x.a });
      b.innerHTML = `${pastille(x.nom)}
        <span class="nomA">${libelleAffixe(x.nom)}</span>
        <span class="fleche">${x.vise} → <span class="cible">${x.a}</span></span>`;
      b.onclick = () => {
        if (x.a > 0) cibles.set(x.nom, x.a); else cibles.delete(x.nom);
        dessinerAffixes(); majBudgetVin(); calculer();
      };
      boite.appendChild(b);
    }
    const tout = document.createElement('button');
    tout.className = 'lm toutBaisser';
    tout.textContent = t('marge.toutBaisser');
    tout.onclick = () => {
      for (const x of bas) {
        if (x.a > 0) cibles.set(x.nom, x.a); else cibles.delete(x.nom);
      }
      dessinerAffixes(); majBudgetVin(); calculer();
    };
    boite.appendChild(tout);
    _nbMarge = 0;
    majCompteMarge();
    return;
  }

  /* DEUX VOIES, UN SEUL INVENTAIRE. Les gemmes des emplacements
   * reaffectables, ET l'inne des pieces qu'on pourrait echanger. Un affixe
   * n'apparaissait pas du tout si aucune gemme ne le portait ou si aucun
   * emplacement libre ne l'acceptait — alors qu'une autre piece du meme
   * cran l'apportait. Chaque ligne dit desormais par quel moyen. */
  const vp = res.vinPoints || new Map();
  const parGemme = marge(res, vp);
  let parPiece = new Map();
  try {
    const pl = planchersActuels();
    parPiece = gainsParPiece(res, Number($('classe').value),
                             $('arme').value || null, pl, vp);
  } catch (e) { parPiece = new Map(); }

  const fusion = new Map();
  for (const m of parGemme) {
    fusion.set(m.nom, { nom: m.nom, actuel: m.actuel, atteignable: m.atteignable,
                        gain: m.gain, palier: m.palier, via: 'gemme' });
  }
  for (const [nom, g] of parPiece.entries()) {
    const actuel = Math.min(plafond(nom), (res.couvert[nom] || 0) + (vp.get(nom) || 0));
    if (g.niveau <= actuel) continue;
    const vu = fusion.get(nom);
    // A niveau egal la gemme l'emporte : elle ne coute pas un changement de
    // piece. La piece ne s'affiche que si elle mene PLUS HAUT.
    if (vu && vu.atteignable >= g.niveau) continue;
    fusion.set(nom, { nom, actuel, atteignable: g.niveau, gain: g.niveau - actuel,
                      palier: palier(nom), via: 'piece', slot: g.slot, piece: g.piece });
  }
  const liste = [...fusion.values()].sort((x, y) => (y.gain - x.gain)
    || ((y.palier && y.atteignable >= y.palier ? 1 : 0)
        - (x.palier && x.atteignable >= x.palier ? 1 : 0))
    || x.nom.localeCompare(y.nom));

  _nbMarge = liste.length;
  if (mot) {
    mot.className = 'pas'; mot.style.fontSize = '12px';
    if (liste.length) {
      mot.textContent = t('marge.aideCourt2');
    } else {
      /* UNE CARTE VIDE SE LIT COMME UNE PANNE. Elle l'etait sur un build
       * sature : quatre pieces sans inne a l'ecran, et pas un mot. La
       * reponse existe pourtant, et elle est instructive. */
      let raisons = [];
      try {
        raisons = pourquoiRien(res, Number($('classe').value), $('arme').value || null);
      } catch (e) { raisons = []; }
      mot.innerHTML = `${echapper(t('marge.rien'))}`
        + (raisons.length
          ? '<ul style="margin:7px 0 0;padding-left:18px;line-height:1.6">'
            + raisons.map((r) => `<li>${echapper(r)}</li>`).join('') + '</ul>'
          : '');
    }
  }
  // Une dizaine suffit : au-delà, la liste devient un annuaire et personne
  // ne la lit. Les plus gros gains sont en tête.
  for (const m of liste) boite.appendChild(ligneMarge(m));
  majCompteMarge();
  /* ON NE RELANCE PLUS LE BALAYAGE TOUT SEUL.
   *
   * La carte enchainait sur l'inventaire complet des qu'elle etait ouverte.
   * Comme son etat etait retenu d'une visite a l'autre, l'avoir ouverte une
   * fois suffisait a payer plusieurs secondes de moteur a CHAQUE recalcul —
   * et le scenario « je monte mes cibles cran par cran » en enchaine des
   * dizaines. Le balayage redevient ce qu'il n'aurait jamais du cesser
   * d'etre : quelque chose qu'on demande. */
  if (carte.open) carte.open = false;
}

/* ------------------------------------------------------------ mes builds --
   Un build, c'est ses CONSIGNES (classe, arme, rareté, affixes, vin,
   planchers), pas son résultat : en les rejouant on retrouve le même stuff,
   et un build enregistré profite des corrections futures du moteur. Le code
   d'import est gardé à côté, pour le relire sans tout recalculer. */
const CLE_BIBLIO = 'mistfall.builds.v1';

/* ======================================================================
   LES SECTIONS REPLIÉES SE SOUVIENNENT

   Replier « Mes builds » pour ne plus l'avoir sous les yeux n'a d'intérêt
   que si ça tient : sans mémoire, tout se rouvrait au rechargement et il
   fallait recommencer à chaque visite.

   C'est gardé dans le navigateur, pas sur le compte : la mise en page est
   propre à l'écran devant lequel on est, et on n'a pas besoin d'un compte
   pour l'avoir. Sur une autre machine, on retrouve les valeurs par défaut.

   Ce qui est enregistré, c'est l'ÉCART au défaut, pas l'état brut : ainsi
   changer un jour un défaut dans le HTML s'applique à tout le monde, sauf
   à ceux qui avaient justement touché à cette section-là.
   ====================================================================== */
const CLE_PLIS = 'mistfall.plis.v1';

function lirePlis() {
  try { return JSON.parse(localStorage.getItem(CLE_PLIS) || '{}'); }
  catch (e) { return {}; }
}

/* ------------------------------------------------ LES SOIXANTE PREMIERES
 * SECONDES.
 *
 * Un joueur qui arrive ne connait ni l'outil, ni le mot « palier ». Il voit
 * un gros bouton orange et clique dessus. Sans cible, ce clic ne produisait
 * qu'une ligne de refus de 12 px et rendait la main : le geste le plus
 * probable du nouveau venu ne menait nulle part, et les douze builds tires
 * de guides publies — exactement la reponse a « je clique ou ? » — vivaient
 * dans un onglet qu'aucun chemin du code ne designait.
 *
 * Rien ici ne touche au moteur : on ne fait que rendre atteignable ce qui
 * existe deja. builds_reference.js est charge en fin de page ; toutes ces
 * fonctions sortent en silence s'il manque. */

function buildsDeLaClasse(classe) {
  if (!window.D_BUILDS) return [];
  return window.D_BUILDS.filter((b) => b.c === classe);
}

function nomDeReference(b) {
  const lg = (window.I18N && I18N.courante()) || 'fr';
  return (b.nom && (b.nom[lg] || b.nom.fr)) || b.k;
}

function chargerReference(b) {
  const etat = { k: b.code, c: b.c, a: b.a, g: null, v: true, m: false,
                 pa: false, pg: 6, ps: [], t: b.t, w: [] };
  appliquerEtat(etat);
  restituer({ nom: `${D.classes[String(b.c)] || ''} — ${nomDeReference(b)}`,
              etat, code: b.code });
}

/* Le bandeau qui evite le malentendu : ces cibles ne sont pas les tiennes. */
function montrerBandeauDemo(b) {
  const el = $('bandeauDemo');
  if (!el) return;
  const src = (window.D_SOURCES || {})[b.src];
  el.textContent = t('demo.bandeau',
    { nom: nomDeReference(b), source: src ? src.nom : '—' });
  el.hidden = false;
  // Charger un build fait defiler la page vers le stuff : sans ce retour en
  // haut, l'avertissement « ce n'est pas ton build » reste hors de vue.
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cacherBandeauDemo() {
  const el = $('bandeauDemo');
  if (el) el.hidden = true;
}

/* Appele par le CLIC sur « Calculer », jamais par calculer() lui-meme :
   sinon la page se remplirait toute seule au chargement. Rend vrai si une
   demonstration a ete chargee, donc s'il n'y a plus rien a calculer. */
function demarrerParUnExemple() {
  if (cibles.size) return false;
  const liste = buildsDeLaClasse(Number($('classe').value));
  if (!liste.length) return false;
  const b = liste[0];
  chargerReference(b);
  montrerBandeauDemo(b);
  return true;
}

/* La colonne de resultats, tant qu'elle n'a pas de resultat : ce que fait
   l'outil, et deux ou trois builds pour partir de quelque part. */
function dessinerAccueil() {
  const bloc = $('accueilResultats');
  const boite = $('accueilBuilds');
  if (!bloc || !boite) return;
  bloc.hidden = !!(dernier && dernier.slotItems);
  if (bloc.hidden) return;
  boite.innerHTML = '';
  const liste = buildsDeLaClasse(Number($('classe').value)).slice(0, 3);
  if (!liste.length) return;
  const mot = document.createElement('span');
  mot.className = 'vgnMot';
  mot.textContent = t('accueil.essaie');
  boite.appendChild(mot);
  for (const b of liste) {
    const src = (window.D_SOURCES || {})[b.src];
    const v = document.createElement('button');
    v.className = 'vgn';
    // Le nom et la source suffisent : c'est sur la source qu'on juge.
    v.innerHTML = `<b>${echapper(nomDeReference(b))}</b>${
      src ? `<small>${echapper(src.nom)}</small>` : ''}`;
    v.onclick = () => { chargerReference(b); montrerBandeauDemo(b); };
    boite.appendChild(v);
  }
  const tous = document.createElement('button');
  tous.className = 'vgnTous';
  tous.textContent = t('accueil.tous');
  tous.onclick = () => montrerPage('pageCommunaute');
  boite.appendChild(tous);
}

/* PLIER OU DEPLIER SANS FAIRE PASSER CA POUR UN CHOIX DE L'UTILISATEUR.
 *
 * `brancherPlis` retient l'ECART AU DEFAUT. Le defaut de ces deux cartes
 * reste donc « ouvert » dans le HTML : si on l'avait mis a « replie », un
 * repli voulu par l'utilisateur serait devenu indiscernable du defaut, donc
 * non enregistre, et la carte se serait rouverte au build suivant.
 *
 * Le code se contente de replier a l'arrivee et de rouvrir au premier
 * resultat, en marquant chaque fois l'element pour que le `toggle` — qui
 * part de facon asynchrone, d'ou le marqueur sur l'element plutot qu'une
 * variable — ne prenne pas ce geste pour une preference. Des que
 * l'utilisateur a exprime un choix, on ne touche plus a rien. */
function poserPliAuto(id, ouvert) {
  const d = $(id);
  if (!d || d.open === ouvert) return;
  if (Object.prototype.hasOwnProperty.call(lirePlis(), id)) return;
  d.dataset.pliAuto = '1';
  d.open = ouvert;
}

/* La seule carte dont l'ouverture COUTE : la retenir ouverte relancerait un
   balayage complet du moteur a chaque recalcul, soit plusieurs secondes de
   page figee par clic. Elle se redemande, a chaque fois. */
const PLI_JAMAIS_RETENU = new Set(['carteMarge']);

function brancherPlis() {
  const plis = lirePlis();
  for (const d of document.querySelectorAll('details.carte.pliable[id]')) {
    if (PLI_JAMAIS_RETENU.has(d.id)) continue;
    // Les cartes qui apparaissent et disparaissent selon le build (les
    // suggestions, les pièces interchangeables) gardent leur propre
    // logique : leur état ne veut rien dire d'une visite à l'autre.
    if (d.hasAttribute('hidden')) continue;
    const defaut = d.hasAttribute('open');
    if (Object.prototype.hasOwnProperty.call(plis, d.id)) d.open = !!plis[d.id];
    d.addEventListener('toggle', () => {
      if (d.dataset.pliAuto) { delete d.dataset.pliAuto; return; }
      const p = lirePlis();
      if (d.open === defaut) delete p[d.id]; else p[d.id] = d.open;
      try { localStorage.setItem(CLE_PLIS, JSON.stringify(p)); } catch (e) { /* quota */ }
    });
  }
}

function etatActuel() {
  return {
    // Le code du stuff affiché : c'est lui qui permet de rendre le build
    // tel quel plus tard, au lieu de le recomposer.
    k: $('code').value || '',
    c: Number($('classe').value),
    a: $('arme').value || null,
    g: $('rarete').value ? Number($('rarete').value) : null,
    v: $('vin').checked,
    m: $('mixte').checked,
    pr: planchersActuels(),
    sv: saveursActuelles(),
    t: [...cibles.entries()],
    w: [...vinManuel.entries()],
    b: _brew,
    sa: !!($('secondeArmeActive') && $('secondeArmeActive').checked),
    st: $('secondeArmeType') ? ($('secondeArmeType').value || null) : null,
    sg: $('secondeArmeRarete') && $('secondeArmeRarete').value
      ? Number($('secondeArmeRarete').value) : null,
  };
}

function appliquerEtat(e) {
  // Changer de build change tout le stuff : garder un cadenas d'un autre
  // build ferait construire autour d'une piece qui n'est plus la.
  libererVerrous();
  if (!e) return;
  $('classe').value = String(e.c);
  majArmes();
  if (e.a) $('arme').value = e.a;
  $('rarete').value = e.g === null || e.g === undefined ? '' : String(e.g);
  $('vin').checked = e.v !== false;
  $('mixte').checked = !!e.m;
  $('blocPlancher').hidden = !$('mixte').checked;
  /* Les builds d'avant portaient un plancher unique (pa/pg/ps) : on le
     convertit en raretes par piece, ce qui donne exactement le meme stuff. */
  const pr = e.pr || (e.pa && e.pg
    ? Object.fromEntries((e.ps || []).map((sl) => [sl, e.pg])) : {});
  for (const sel of document.querySelectorAll('#plancherSlots select')) {
    sel.value = pr[sel.dataset.slot] ? String(pr[sel.dataset.slot]) : '';
  }
  const voulus = new Set(e.ps || []);
  for (const c of document.querySelectorAll('#plancherSlots input')) {
    c.checked = voulus.has(c.value);
  }
  const sv = e.sv || {};
  for (const sel of document.querySelectorAll('#saveurSlots select')) {
    sel.value = sv[sel.dataset.slot] || '';
  }
  // Absent des builds d'avant cette fonctionnalite : `!!e.sa` retombe a
  // false, la case reste decochee, rien ne change pour eux.
  if ($('secondeArmeActive')) {
    $('secondeArmeActive').checked = !!e.sa;
    $('blocSecondeArme').hidden = !e.sa;
    if (e.st) $('secondeArmeType').value = e.st;
    if (e.sg) $('secondeArmeRarete').value = String(e.sg);
  }
  cibles.clear();
  for (const [n, l] of e.t || []) cibles.set(n, l);
  vinManuel.clear();
  for (const [n, p] of e.w || []) vinManuel.set(n, p);
  // Un build d'avant le choix des boissons n'en porte pas : il garde la
  // meilleure, celle sur laquelle il a ete calcule.
  _brew = (e.b && BREWS.some((b) => b.id === e.b)) ? e.b : 'gods';
  if ($('brew')) $('brew').value = _brew;
  dessinerAffixes();
  majBudgetVin();
}

function biblio() {
  try {
    return JSON.parse(localStorage.getItem(CLE_BIBLIO) || '[]');
  } catch (e) {
    return [];
  }
}

function ecrireBiblio(liste) {
  try {
    localStorage.setItem(CLE_BIBLIO, JSON.stringify(liste));
    return true;
  } catch (e) {
    // Quota plein ou stockage refusé (navigation privée) : on le DIT, sinon
    // l'utilisateur croit son build enregistré alors qu'il est perdu.
    $('noteBuilds').innerHTML =
      `<span class="ko">${tH('builds.stockageKo', { message: e.message })}</span>`;
    return false;
  }
}

/* L'HISTORIQUE DES CHARGEMENTS -- pas des enregistrements. On y met un nom
   dès qu'un build est CHARGÉ (bouton "Charger" d'une carte), jamais quand
   il est créé : c'est "les builds que je suis allé rechercher", pas "les
   builds que j'ai faits". Huit derniers, sans doublon -- recharger un
   build déjà dans la liste le remonte en tête plutôt que de le répéter. */
const CLE_RECENTS = 'mistfall.builds.recents.v1';
const RECENTS_MAX = 8;

function recentsNoms() {
  try {
    return JSON.parse(localStorage.getItem(CLE_RECENTS) || '[]');
  } catch (e) {
    return [];
  }
}

function enregistrerRecent(nom) {
  try {
    const l = recentsNoms().filter((n) => n !== nom);
    l.unshift(nom);
    localStorage.setItem(CLE_RECENTS, JSON.stringify(l.slice(0, RECENTS_MAX)));
  } catch (e) { /* pas grave : juste le confort du raccourci qui manque */ }
}

/* ------------------------------------------------------------- comptes ----
   La bibliothèque locale reste la référence : elle marche hors ligne et sans
   compte. Le compte n'ajoute qu'UNE chose, la synchronisation entre
   appareils. Se déconnecter ne doit donc rien effacer. */
function connecteMaintenant() {
  return comptesDispo() && !!window.Comptes.connecte();
}

function comptesDispo() {
  return window.Comptes && window.Comptes.actif();
}

function majBandeauCompte() {
  const bloc = $('blocCompte');
  if (!bloc) return;
  if (!comptesDispo()) { bloc.hidden = true; return; }
  bloc.hidden = false;
  const email = window.Comptes.courriel();
  $('compteDeconnecte').hidden = !!email;
  $('compteConnecte').hidden = !email;
  if (email) $('compteEmail').textContent = email;
}

async function synchroniser(silencieux) {
  if (!comptesDispo() || !window.Comptes.connecte()) return;
  const dire = (html) => { if (!silencieux) $('noteBuilds').innerHTML = html; };
  try {
    dire(`<span class="pas">${t('sync.encours')}</span>`);
    const distants = await window.Comptes.listerBuilds();
    const locaux = biblio();
    // FUSION, jamais remplacement : on ne perd ni ce qui est sur le serveur
    // ni ce qui vient d'être créé hors ligne.
    const par = new Map(locaux.map((b) => [b.nom, b]));
    let recus = 0;
    for (const d of distants || []) {
      const local = par.get(d.nom);
      if (!local) recus += 1;
      // LES CASES DE VISIBILITÉ S'ADDITIONNENT, ELLES NE SE REMPLACENT PAS.
      //
      // L'ancienne version reconstruisait l'entrée à partir du serveur seul.
      // Deux dégâts : la case « ami », qui n'était même pas demandée dans la
      // requête, disparaissait à chaque synchronisation ; et une case cochée
      // ici mais pas encore arrivée là-bas était décochée puis RENVOYÉE
      // décochée — cocher « public » puis recharger dépubliait en silence.
      //
      // Un OU règle les deux : dépublier reste possible, mais demande un
      // décochage explicite, ce qui est exactement ce à quoi on s'attend.
      par.set(d.nom, {
        nom: d.nom,
        etat: d.etat,
        code: d.code || '',
        pub: !!d.public || !!(local && local.pub),
        ami: !!d.partage || !!(local && local.ami),
      });
    }
    const fusion = [...par.values()];
    ecrireBiblio(fusion);
    dessinerBuilds();
    await window.Comptes.envoyerBuilds(fusion);
    dire(`<span class="pas">${tH('sync.ok', { n: fusion.length, r: recus })}</span>`);
  } catch (e) {
    dire(`<span class="ko">${tH('sync.ko', { message: e.message })}</span>`);
  }
}

/* ------------------------------------------------------------- les amis --
   PAS D'ANNUAIRE. La première version listait tous les joueurs dans un menu
   déroulant : curieux à dix, inutilisable à mille, et personne n'a envie
   d'y figurer pour avoir montré un build à un ami. On ajoute quelqu'un par
   son CODE, donné de la main à la main, et la liste reste sur la machine. */
const CLE_AMIS = 'mistfall.amis.v1';

function amis() {
  try {
    return JSON.parse(localStorage.getItem(CLE_AMIS) || '[]');
  } catch (e) {
    return [];
  }
}

function ecrireAmis(liste) {
  try {
    localStorage.setItem(CLE_AMIS, JSON.stringify(liste));
    return true;
  } catch (e) {
    return false;
  }
}

async function ajouterAmi() {
  const champ = $('amiPseudo');
  const note = $('noteAmis');
  const brut = (champ.value || '').trim();
  if (brut.length < 2) {
    note.innerHTML = `<span class="ko">${t('ami.tropCourt')}</span>`;
    return;
  }
  note.innerHTML = '<span class="pas">…</span>';
  try {
    const trouve = await window.Comptes.parPseudo(brut);
    if (!trouve) {
      note.innerHTML = `<span class="ko">${t('ami.introuvable')}</span>`;
      return;
    }
    const liste = amis();
    if (liste.some((a) => a.pseudo.toLowerCase() === trouve.pseudo.toLowerCase())) {
      note.innerHTML = `<span class="pas">${tH('ami.deja', { nom: trouve.pseudo })}</span>`;
      return;
    }
    liste.push({ pseudo: trouve.pseudo });
    ecrireAmis(liste);
    champ.value = '';
    note.innerHTML = `<span class="ok">${tH('ami.ajoute', { nom: trouve.pseudo })}</span>`;
    dessinerAmis();
  } catch (e) {
    note.innerHTML = `<span class="ko">${echapper(e.message)}</span>`;
  }
}

async function dessinerAmis() {
  const boite = $('listeAmis');
  const liste = amis();
  // Pas de message quand la liste est vide : le champ juste au-dessus dit
  // déjà quoi faire, et une phrase de plus n'apprend rien.
  boite.innerHTML = '';
  if (!liste.length) return;
  for (const a of liste) {
    const bloc = document.createElement('div');
    bloc.className = 'amiBloc';
    // Un pseudo vient du serveur : il est choisi par autrui, donc échappé.
    bloc.innerHTML = `<div class="amiTete"><b>${echapper(a.pseudo)}</b>
      <button class="amiSuppr" title="${t('ami.retirer')}">×</button></div>
      <div class="amiListe"></div>`;
    bloc.querySelector('.amiSuppr').onclick = () => {
      ecrireAmis(amis().filter((x) => x.pseudo !== a.pseudo));
      dessinerAmis();
    };
    boite.appendChild(bloc);
    try {
      const d = await window.Comptes.parPseudo(a.pseudo);
      const dedans = bloc.querySelector('.amiListe');
      if (!d || !d.builds.length) {
        dedans.innerHTML = `<span class="pas">${tH('ami.rien', { nom: a.pseudo })}</span>`;
        continue;
      }
      for (const b of d.builds) dedans.appendChild(carteBuildDistant(b, a.pseudo));
    } catch (e) { /* un ami injoignable ne casse pas la liste */ }
  }
}

/* Une carte de build venu d'ailleurs : charger pour l'essayer, copier pour
   le garder. Les deux sont explicites — rien n'entre chez toi sans clic. */
function carteBuildDistant(b, auteur) {
  const el = document.createElement('div');
  el.className = 'buildDistant';
  const cl = D.classes[String(b.etat && b.etat.c)] || '?';
  // Nom et auteur viennent d'un compte tiers : tout est échappé, comme la galerie.
  el.innerHTML = `<div class="bd"><b>${echapper(b.nom)}</b>
      <small>${cl}${auteur ? ' · ' + t('gal.par') + ' ' + echapper(auteur) : ''}</small></div>
    <button class="bdCharger">${t('gal.charger')}</button>
    <button class="bdCopier">${t('gal.copier')}</button>`;
  el.querySelector('.bdCharger').onclick = () => {
    appliquerEtat(b.etat);
    restituer(b);
  };
  const vote = el.querySelector('.vote');
  if (vote && b.id && connecteMaintenant()) {
    vote.onclick = async () => {
      vote.disabled = true;
      try {
        const r = await window.Comptes.basculerVote(b.id);
        b.votes = r.total; b.jaiVote = r.jaiVote;
        vote.querySelector('.n').textContent = r.total;
        vote.dataset.mien = r.jaiVote ? '1' : '0';
      } catch (e) {
        $('noteGalerie').innerHTML = `<span class="ko">${echapper(e.message)}</span>`;
      }
      vote.disabled = false;
    };
  }
  el.querySelector('.bdCopier').onclick = () => {
    const liste = biblio();
    const nom = liste.some((x) => x.nom === b.nom) ? `${b.nom} (copie)` : b.nom;
    liste.push({ nom, etat: b.etat, code: b.code || '', pub: false, ami: false });
    if (!ecrireBiblio(liste)) return;
    dessinerBuilds();
    $('noteBuilds').innerHTML =
      `<span class="pas">${tH('partage.copieOk', { nom })}</span>`;
  };
  return el;
}

/* ------------------------------------------------------ galerie publique --
 *
 * FILTRER EN BASE, PAS DANS LE NAVIGATEUR. À mille builds, tout télécharger
 * pour en cacher 990 serait absurde : le tri, la recherche, le filtre de
 * classe et la page partent dans l'appel, et la base renvoie le total avec
 * chaque ligne pour que la pagination sache où elle en est sans deuxième
 * requête. */
const PAR_PAGE = 24;
const galEtat = { page: 0, total: 0, tri: 'recent', classe: '', recherche: '' };

/* Une carte de build : ce qu'on veut savoir avant de cliquer. */
function carteBuildGalerie(b) {
  const el = document.createElement('div');
  el.className = 'cb';
  const e = b.etat || {};
  const cl = D.classes[String(e.c)] || '?';
  const ra = e.g ? (D.raretes[String(e.g)] || '') : t('perso.auto');
  const cibles = (e.t || []).slice().sort((x, y) => y[1] - x[1]);
  // `etat` est du jsonb libre côté base et l'import avale n'importe quel JSON :
  // le nom d'affixe et son niveau sont donc du texte d'attaquant, pas du nôtre.
  const puces = cibles.slice(0, 6)
    .map(([n, l]) => `<span class="puce">${echapper(n)} ${echapper(l)}</span>`).join('');
  const reste = cibles.length > 6 ? `<span class="puce">+${cibles.length - 6}</span>` : '';
  const quand = b.maj ? new Date(b.maj).toLocaleDateString() : '';
  el.innerHTML = `<h4>${echapper(b.nom)}</h4>
    <div class="meta">
      <span class="auteur">${b.auteur ? echapper(b.auteur) : t('gal.anonyme')}</span>
      <span>${cl}</span><span>${echapper(e.a || '')}</span><span>${ra}</span>
      ${quand ? `<span>${quand}</span>` : ''}
    </div>
    <div class="puces">${puces}${reste}</div>
    <div class="actions">
      <button class="bdCharger">${t('gal.charger')}</button>
      <button class="bdCode" ${b.code ? '' : 'disabled'}>${t('gal.code')}</button>
      <button class="bdCopier">${t('gal.copier')}</button>
      ${b.id ? `<button class="vote" data-mien="${b.jaiVote ? 1 : 0}"
        ${connecteMaintenant() ? '' : 'disabled'}
        title="${connecteMaintenant() ? t('vote.aide') : t('vote.connexion')}">
        ▲ <span class="n">${b.votes || 0}</span></button>` : ''}
    </div>`;
  el.querySelector('.bdCharger').onclick = () => {
    appliquerEtat(b.etat);
    restituer(b);
    montrerPage('main');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  el.querySelector('.bdCode').onclick = (ev) => {
    if (!b.code) return;
    copierTexte(b.code, ev.target, t('gal.codeCopie'), t('gal.code'));
  };
  el.querySelector('.bdCopier').onclick = () => {
    const liste = biblio();
    const nom = liste.some((x) => x.nom === b.nom) ? `${b.nom} (copie)` : b.nom;
    liste.push({ nom, etat: b.etat, code: b.code || '', pub: false, ami: false });
    if (!ecrireBiblio(liste)) return;
    dessinerBuilds();
    $('noteGalerie').innerHTML =
      `<span class="pas">${tH('partage.copieOk', { nom })}</span>`;
  };
  return el;
}

/* Copier sans quitter la page : le bouton confirme lui-même puis revient.
   Un message ailleurs dans la page passerait inaperçu. */
function copierTexte(texte, bouton, ok, avant) {
  const rendre = () => { if (bouton) bouton.textContent = avant; };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texte).then(() => {
      if (bouton) { bouton.textContent = ok; setTimeout(rendre, 1600); }
    }, () => {});
    return;
  }
  const z = document.createElement('textarea');
  z.value = texte; document.body.appendChild(z); z.select();
  try { document.execCommand('copy'); } catch (e) { /* rien à faire */ }
  z.remove();
  if (bouton) { bouton.textContent = ok; setTimeout(rendre, 1600); }
}

function echapper(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* La pagination : deux flèches et un compteur. Numéroter les pages n'aide
   personne quand on ne sait pas ce qu'il y a dedans. */
function dessinerPages(boite, etat, parPage, aller) {
  const pages = Math.max(1, Math.ceil(etat.total / parPage));
  if (etat.total <= parPage) { boite.innerHTML = ''; return; }
  boite.innerHTML = '';
  const bouton = (txt, versPage, actif) => {
    const b = document.createElement('button');
    b.textContent = txt;
    b.disabled = !actif;
    if (actif) b.onclick = () => aller(versPage);
    boite.appendChild(b);
  };
  bouton('‹', etat.page - 1, etat.page > 0);
  const ou = document.createElement('span');
  ou.className = 'ou';
  ou.textContent = t('gal.page', { n: etat.page + 1, sur: pages, total: etat.total });
  boite.appendChild(ou);
  bouton('›', etat.page + 1, etat.page + 1 < pages);
}

async function chargerGalerie(page) {
  const boite = $('listeGalerie');
  const note = $('noteGalerie');
  if (!comptesDispo() || !boite) return;
  if (typeof page === 'number') galEtat.page = Math.max(0, page);
  note.innerHTML = `<span class="pas">${t('partage.chargement')}</span>`;
  try {
    const r = await window.Comptes.galerie({
      limite: PAR_PAGE,
      decalage: galEtat.page * PAR_PAGE,
      tri: galEtat.tri,
      classe: galEtat.classe === '' ? null : Number(galEtat.classe),
      recherche: galEtat.recherche,
    });
    galEtat.total = r.total;
    boite.innerHTML = '';
    for (const b of r.lignes) boite.appendChild(carteBuildGalerie(b));
    dessinerPages($('galPages'), galEtat, PAR_PAGE, chargerGalerie);
    if (r.lignes.length) { note.innerHTML = ''; return; }
    // DEUX VIDES À NE PAS CONFONDRE : « personne n'a rien publié » et
    // « ton filtre ne ramène rien » demandent des gestes opposés.
    const filtre = galEtat.recherche || galEtat.classe !== '';
    if (!filtre) { note.innerHTML = `<span class="pas">${t('gal.vide')}</span>`; return; }
    const combien = await window.Comptes.combienDeBuildsPublics();
    note.innerHTML = `<span class="pas">${combien
      ? t('gal.videFiltre', { n: combien }) : t('gal.vide')}</span>`;
  } catch (e) {
    note.innerHTML = `<span class="ko">${tH('partage.ko', { message: e.message })}</span>`;
  }
}

/* Rendre un build enregistré À L'IDENTIQUE.
 *
 * Un build garde son code d'import : c'est la seule chose qui décrit les
 * pièces réellement choisies. Sans ça, rouvrir un build ne faisait que
 * relancer l'optimiseur sur la liste d'affixes, et un panaché 6 Épique +
 * 2 Légendaire ressortait tout doré — « du jaune partout ». On ne recalcule
 * que si aucun code n'a été gardé. */
function restituer(b) {
  const code = b && (b.code || (b.etat && b.etat.k));
  if (code) {
    try {
      // LE CODE D'IMPORT NE TRANSPORTE PAS LE VIN. Il ne décrit que du stuff.
      // Rouvrir un build visé à Valor 5 le montrait donc « Valor 3 » avec une
      // colonne Vin vide, alors que ses deux points étaient bien enregistrés.
      // Tous les appelants passent par appliquerEtat juste avant : cibles et
      // vinManuel décrivent déjà ce build, on rejoue la même répartition.
      afficherCode(code, $('vin').checked
        ? repartitionVin([...cibles.entries()], vinManuel)
        : new Map());
      return;
    } catch (e) {
      // Code devenu illisible (données du jeu changées) : on retombe sur le
      // calcul plutôt que de ne rien afficher, mais on le DIT.
      $('noteBuilds').innerHTML =
        `<span class="avert">${tH('builds.codeKo', { message: e.message })}</span>`;
    }
  } else if (b && b.nom) {
    // BUILD D'AVANT LA CORRECTION. Il ne contient que des objectifs, pas de
    // stuff. Le recomposer donnera autre chose que ce qui avait été vu, et
    // c'est exactement ce qui donnait « du jaune partout » sans explication.
    // La clé porte la phrase ENTIÈRE dans les trois langues : le préfixe
    // français la redisait, si bien qu'un anglophone lisait le français
    // puis sa traduction. `t` échappe déjà ses variables.
    $('noteBuilds').innerHTML =
      `<span class="avert">${tH('builds.vieux', { nom: b.nom })}</span>`;
  }
  calculer();
}

/* Le filtre de la bibliothèque locale. Il ne trie pas une liste de trois
   builds : les contrôles restent cachés tant qu'il n'y en a pas assez pour
   que chercher coûte moins cher que parcourir. */
const SEUIL_FILTRES = 6;
const bEtat = { recherche: '', classe: '', rarete: '', tri: 'nom' };
// La classe dont l'onglet est ouvert dans "Mes builds". Null tant qu'aucun
// build n'a encore été dessiné une fois -- dessinerBuilds() la pose sur la
// première classe disponible dès son premier appel.
let _ongletBuildsActif = null;

/* La rareté d'un build enregistré n'est pas celle de son réglage : « Auto »
   ne dit rien, et le panaché non plus. On la relit donc dans le STUFF, en
   décodant le code gardé — c'est la seule source qui dise ce qui est
   réellement porté. Une seule couleur → cette couleur ; plusieurs →
   panaché. */
const _raretesCache = new Map();
function raretesDuBuild(b) {
  const code = b.code || (b.etat && b.etat.k);
  if (!code) return null;
  if (_raretesCache.has(code)) return _raretesCache.get(code);
  let sortie = null;
  try {
    const lu = decoderCode(code);
    const grades = new Set();
    // Le 3e chiffre d'un identifiant EST la rareté : structure vérifiée en
    // jeu, [2 préfixe d'emplacement][1 rareté][2 famille][2 variante]. Pas
    // besoin de retrouver la pièce dans le catalogue pour la connaître, ce
    // qui vaut mieux : les 155 pièces reconstituées n'y figurent pas.
    // Le detail PAR EMPLACEMENT, pour le mini paperdoll des cartes -- meme
    // decodage, on ne le refait pas une deuxieme fois pour ça.
    const parSlot = new Map();
    for (const e of lu.emplacements || []) {
      const g = Number(String(e.cfg)[2]);
      if (g >= 1 && g <= 8) grades.add(g);
      const nomSlot = D.codec.versGameData[String(e.slot)];
      if (nomSlot) parSlot.set(nomSlot, e.cfg ? { g, cfg: e.cfg } : null);
    }
    if (grades.size) {
      sortie = { grades: [...grades].sort((x, y) => x - y),
                 panache: grades.size > 1, parSlot };
    }
  } catch (e) { /* code illisible : on ne prétend rien */ }
  _raretesCache.set(code, sortie);
  return sortie;
}

/* L'ID DE CHAQUE OBJET VERS SA FICHE COMPLETE (nom, icône…) -- construit
   une seule fois, à la première carte qui en a besoin. D.objets est rangé
   par « classe|type|arme|grade », impossible à interroger directement par
   id ; cet index inverse les ~1900 pièces du catalogue en un seul passage,
   après quoi chaque carte n'a plus qu'une lecture de Map à faire. */
let _catalogueParId = null;
function catalogueParId() {
  if (_catalogueParId) return _catalogueParId;
  _catalogueParId = new Map();
  for (const liste of Object.values(D.objets)) {
    for (const it of liste) _catalogueParId.set(Number(it.id), it);
  }
  return _catalogueParId;
}

/* HUIT PETITS CARRÉS, UN PAR EMPLACEMENT DU VRAI PAPERDOLL -- teintés par
   la rareté de la pièce qui s'y trouve (fond) ET avec l'icône réelle de
   l'objet par-dessus, dans le même ordre (D.ordreSlots) que la fiche
   d'équipement du Builder. Un emplacement vide (jamais censé arriver sur
   un build fixé, mais un vieux build peut l'être) reste un simple contour.
   Une pièce reconstituée (catalogue incomplet, ~155 d'entre elles) garde
   sa couleur mais pas d'icône -- pas d'image à inventer à sa place. */
function miniPaperdoll(b) {
  const r = raretesDuBuild(b);
  if (!r || !r.parSlot) return '';
  const catalogue = catalogueParId();
  const points = D.ordreSlots.map((slot) => {
    const info = r.parSlot.get(slot);
    const nom = D.nomsSlots[slot] || slot;
    if (!info) return `<span class="mbDoll vide" title="${echapper(nom)}"></span>`;
    const objet = catalogue.get(info.cfg);
    const couleur = D.couleurs[String(info.g)] || '#5a6570';
    const titre = `${nom} — ${objet ? objet.n + ', ' : ''}${D.raretes[String(info.g)] || ''}`;
    const icone = objet && objet.ic
      ? `<img src="icones/${echapper(objet.ic)}" alt="" loading="lazy">` : '';
    return `<span class="mbDoll" style="--c:${couleur}" title="${echapper(titre)}">${icone}</span>`;
  }).join('');
  return `<div class="mbPaperdoll">${points}</div>`;
}

function etiquetteRarete(b) {
  const r = raretesDuBuild(b);
  if (!r) return b.etat.g ? (D.raretes[String(b.etat.g)] || '') : t('perso.auto');
  if (!r.panache) return D.raretes[String(r.grades[0])] || '';
  return `${t('perso.mixte')} ${r.grades.map((g) => D.raretes[String(g)]).join(' + ')}`;
}

function rectArrondi(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const COULEUR_CAT_IMG = { offense: '#c9603f', defense: '#5a86ad', mobility: '#4c9e88', support: '#c9a253' };

/* LA CARTE PNG DU BUILD -- résumé partageable (paperdoll + affixes visés),
   entièrement dessiné en <canvas> côté client : mêmes données que l'UI
   (raretesDuBuild, catalogueParId), pas de service tiers ni de
   bibliothèque externe pour "photographier" le DOM. Prend l'état d'un
   build (`etat`, pas forcément enregistré -- peut être celui en cours de
   calcul) et le nom à afficher séparément, puisqu'un build pas encore
   sauvegardé n'en a pas dans `etat`. */
function genererImageBuild(etat, nomAffiche) {
  const b = { etat, code: etat.k || '' };
  const r = raretesDuBuild(b);
  const catalogue = catalogueParId();
  const cibles = etat.t || [];

  const ECH = 2; // @2x pour rester net sur un écran retina
  const LARGEUR = 840;
  const PAD = 32;
  const TAILLE_DOLL = 56;
  const GAP_DOLL = 10;
  const COL_AFFIXE = (LARGEUR - PAD * 2 - 20) / 2;
  const LIGNES_AFFIXES = Math.max(1, Math.ceil(cibles.length / 2));
  const H_AFFIXES = LIGNES_AFFIXES * 34;
  const HAUTEUR = PAD + 74 + 16 + TAILLE_DOLL + 24 + H_AFFIXES + 24 + 26 + PAD;

  const slotsOccupes = (r && r.parSlot ? D.ordreSlots : []).map((slot) => {
    if (!r || !r.parSlot) return null;
    const info = r.parSlot.get(slot);
    if (!info) return null;
    return { g: info.g, objet: catalogue.get(info.cfg) };
  });
  const slots = r && r.parSlot ? slotsOccupes : D.ordreSlots.map(() => null);

  const charger = (src) => new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
  const imgClasse = CLASSE_IMAGE[etat.c]
    ? charger(`icones_classes/${CLASSE_IMAGE[etat.c]}.webp`) : Promise.resolve(null);
  const imgsDoll = Promise.all(slots.map((s) =>
    s && s.objet && s.objet.ic ? charger(`icones/${s.objet.ic}`) : Promise.resolve(null)));

  return Promise.all([imgClasse, imgsDoll]).then(([iconClasse, iconsDoll]) => {
    const canvas = document.createElement('canvas');
    canvas.width = LARGEUR * ECH;
    canvas.height = HAUTEUR * ECH;
    const ctx = canvas.getContext('2d');
    ctx.scale(ECH, ECH);

    ctx.fillStyle = '#0b0f11';
    ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    ctx.strokeStyle = '#202528';
    ctx.strokeRect(0.5, 0.5, LARGEUR - 1, HAUTEUR - 1);

    let y = PAD;
    const xTexte = PAD + (iconClasse ? 50 : 0);
    if (iconClasse) ctx.drawImage(iconClasse, PAD, y, 40, 40);
    ctx.fillStyle = '#ece7dd';
    ctx.font = '700 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(nomAffiche, xTexte, y + 28);
    const classe = D.classes[String(etat.c)] || '';
    ctx.fillStyle = '#8a877f';
    ctx.font = '400 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${classe} · ${etat.a || ''} · ${etiquetteRarete(b)}`, xTexte, y + 48);
    y += 74;

    slots.forEach((s, i) => {
      const x = PAD + i * (TAILLE_DOLL + GAP_DOLL);
      const couleur = s ? (D.couleurs[String(s.g)] || '#5a6570') : '#202528';
      ctx.fillStyle = `${couleur}33`;
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 1.5;
      rectArrondi(ctx, x, y, TAILLE_DOLL, TAILLE_DOLL, 8);
      ctx.fill();
      ctx.stroke();
      const icone = iconsDoll[i];
      if (icone) {
        const m = 8;
        ctx.drawImage(icone, x + m, y + m, TAILLE_DOLL - m * 2, TAILLE_DOLL - m * 2);
      }
    });
    y += TAILLE_DOLL + 24;

    cibles.forEach(([nom, niveau], i) => {
      const col = i % 2;
      const ligne = Math.floor(i / 2);
      const x = PAD + col * (COL_AFFIXE + 20);
      const cy = y + ligne * 34 + 12;
      const cat = (D.affixes[nom] || {}).cat || 'support';
      ctx.fillStyle = COULEUR_CAT_IMG[cat] || '#8a877f';
      ctx.beginPath();
      ctx.arc(x + 5, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfcbc3';
      ctx.font = '400 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(libelleAffixe(nom), x + 18, cy + 5);
      ctx.fillStyle = '#f19a61';
      ctx.font = '700 15px system-ui, -apple-system, sans-serif';
      const txtNiv = `+${niveau}`;
      ctx.fillText(txtNiv, x + COL_AFFIXE - ctx.measureText(txtNiv).width, cy + 5);
    });
    y += H_AFFIXES + 24;

    ctx.fillStyle = '#8a877f';
    ctx.font = '400 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('mistfall-builder.github.io', PAD, y + 12);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  });
}

function telechargerImageBuild(etat, nomAffiche) {
  genererImageBuild(etat, nomAffiche).then((blob) => {
    if (!blob) {
      $('noteBuilds').innerHTML = `<span class="ko">${t('builds.imageKo')}</span>`;
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mistfall-${nomAffiche.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    $('noteBuilds').innerHTML = `<span class="pas">${t('builds.imageOk')}</span>`;
  });
}

function filtrerBuilds(liste) {
  const q = bEtat.recherche.toLowerCase();
  let vus = liste.filter((b) => {
    if (q && !b.nom.toLowerCase().includes(q)) return false;
    if (bEtat.classe !== '' && String(b.etat.c) !== bEtat.classe) return false;
    if (bEtat.rarete !== '') {
      const r = raretesDuBuild(b);
      if (bEtat.rarete === 'panache') return !!(r && r.panache);
      if (!r) return String(b.etat.g || '') === bEtat.rarete;
      // Une couleur demandée : le build la contient, panaché ou non.
      return r.grades.includes(Number(bEtat.rarete));
    }
    return true;
  });
  const cle = {
    nom: (b) => b.nom.toLowerCase(),
    classe: (b) => (D.classes[String(b.etat.c)] || '').toLowerCase(),
    affixes: (b) => -((b.etat.t || []).length),
  }[bEtat.tri] || ((b) => b.nom.toLowerCase());
  vus = vus.slice().sort((a, b) => {
    const x = cle(a); const y = cle(b);
    return x < y ? -1 : x > y ? 1 : a.nom.localeCompare(b.nom);
  });
  return vus;
}

/* UNE CARTE PAR BUILD, GROUPÉES PAR CLASSE.
 *
 * Même logique qu'avant (chargement, ami/pub, comparaison, suppression),
 * seule la présentation change : la liste vivait sur 210 px de haut dans
 * une colonne de 360 px, les affixes n'étaient qu'un compte ("4 affixes").
 * Ici chaque carte montre les affixes eux-mêmes (icône + niveau), et la
 * rareté réellement portée teinte son bord gauche.
 */
function carteBuild(b, i) {
  const r = raretesDuBuild(b);
  const couleur = r
    ? (r.panache ? 'var(--accent)' : (D.couleurs[String(r.grades[0])] || '#5a6570'))
    : '#5a6570';
  const avecCompte = comptesDispo() && window.Comptes.connecte();
  const fige = !!(b.code || (b.etat && b.etat.k));
  const titre = fige ? t('builds.charger') : t('builds.chargerVieux');
  const chips = (b.etat.t || []).map(([n, l]) =>
    `<span class="mbChip">${pastille(n)}${echapper(libelleAffixe(n))} <b>${l}</b></span>`
  ).join('');
  const carte = document.createElement('div');
  carte.className = 'mbCarte';
  carte.style.setProperty('--tinte', couleur);
  // Un nom de build n'est pas forcément le tien : « Copier » depuis la galerie
  // conserve le nom choisi par l'auteur, et l'import de fichier avale du JSON
  // arbitraire. La bibliothèque locale échappe donc comme la galerie.
  carte.innerHTML = `
    <div class="mbCarteTete">
      <b title="${echapper(b.nom)}">${echapper(b.nom)}${fige ? '' : ' <i>⚠</i>'}</b>
      <span class="mbRarete" style="color:${couleur}">${echapper(etiquetteRarete(b))}</span>
    </div>
    <div class="mbCarteMeta">${echapper(b.etat.a || '—')} · ${t('builds.affixes', { n: (b.etat.t || []).length })}</div>
    ${miniPaperdoll(b)}
    <div class="mbChips">${chips || `<span class="pas" style="font-size:11px">${t('mesb.rien')}</span>`}</div>
    <div class="mbActions">
      <label class="ami" title="${avecCompte ? t('ami.marque') : t('ami.marqueNon')}">
        <input type="checkbox" ${b.ami ? 'checked' : ''}
               ${avecCompte ? '' : 'disabled'}><span>${t('builds.pastilleAmi')}</span></label>
      <label class="pub" title="${avecCompte ? t('builds.public') : t('builds.publicNon')}">
        <input type="checkbox" ${b.pub ? 'checked' : ''}
               ${avecCompte ? '' : 'disabled'}><span>${t('builds.pastillePub')}</span></label>
      <button class="cmpB${_cmpA === b.nom || _cmpB === b.nom ? ' actif' : ''}"
              title="${t('cmp.mettre')}">⇄</button>
      <button class="renom" title="${t('builds.renommer')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      </button>
      <button class="dupli" title="${t('builds.dupliquer')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
      <button class="img" title="${t('builds.imageCarte')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button class="suppr" title="${t('builds.supprimer')}">🗑</button>
      <button class="ouvrir" title="${titre}">${t('builds.chargerBtn')}</button>
    </div>`;
  const brancher = (sel, cle, cleOui, cleNon) => {
    const c = carte.querySelector(sel);
    if (!c) return;
    c.onchange = () => {
      const l = biblio();
      l[i] = { ...l[i], [cle]: c.checked };
      if (!ecrireBiblio(l)) { c.checked = !c.checked; return; }
      window.Comptes.envoyerBuilds([l[i]]).then(() => {
        $('noteBuilds').innerHTML = `<span class="pas">`
          + t(c.checked ? cleOui : cleNon, { nom: b.nom }) + '</span>';
      }).catch((e) => {
        $('noteBuilds').innerHTML = `<span class="ko">${echapper(e.message)}</span>`;
      });
    };
  };
  // Deux visibilités distinctes, indépendantes : « ami » se donne avec un
  // code, « pub » entre dans la galerie. Un build peut être l'un, l'autre,
  // les deux, ou rien — c'est le défaut.
  brancher('.pub input', 'pub', 'builds.estPublic', 'builds.plusPublic');
  brancher('.ami input', 'ami', 'ami.marque', 'ami.marque');
  carte.querySelector('.ouvrir').onclick = () => {
    appliquerEtat(b.etat);
    $('noteBuilds').innerHTML = `<span class="pas">${tH('builds.chargeOk', { nom: b.nom })}</span>`;
    restituer(b);
    enregistrerRecent(b.nom);
    // Ce qu'on vient de charger devient la cible du bouton « Écraser », côté
    // colonne de gauche -- modifier puis réenregistrer sous ce même nom sans
    // retaper le champ.
    _buildCharge = b.nom;
    majBoutonEcraser();
    // Choisir un build referme la fenêtre : le charger EST la conclusion de
    // la visite, il n'y a rien d'autre à y faire ensuite.
    fermerModalBuilds();
  };
  // Un clic met ce build en A, un clic sur un SECOND le met en B : c'est
  // la manœuvre « lequel des deux je garde ? », faite sans passer par le
  // build courant. Recliquer sur un build déjà posé le retire.
  carte.querySelector('.cmpB').onclick = () => {
    if (_cmpA === b.nom) _cmpA = '';
    else if (_cmpB === b.nom) _cmpB = '';
    else if (!_cmpA) _cmpA = b.nom;
    else _cmpB = b.nom;
    dessinerBuilds();
    dessinerComparaison();
    const carteCmp = $('carteComparer');
    if (carteCmp && !carteCmp.hidden) {
      carteCmp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  carte.querySelector('.renom').onclick = () => {
    const propose = (prompt(t('builds.renommerInvite', { nom: b.nom }), b.nom) || '').trim();
    if (!propose || propose === b.nom) return;
    renommerBuild(b.nom, propose);
  };
  carte.querySelector('.dupli').onclick = () => dupliquerBuild(b.nom);
  carte.querySelector('.img').onclick = () => telechargerImageBuild(b.etat, b.nom);
  carte.querySelector('.suppr').onclick = () => {
    // Un clic de trop sur une icône serrée entre d'autres boutons ne doit
    // pas suffire à perdre un build : on demande confirmation avant toute
    // suppression, contrairement à Écraser (qui vise un build déjà chargé
    // et donc voulu).
    if (!confirm(t('builds.confirmerSuppr', { nom: b.nom }))) return;
    const l = biblio();
    const [parti] = l.splice(i, 1);
    if (!ecrireBiblio(l)) return;
    // Un build supprimé ne peut plus être un côté de la comparaison :
    // sans ça la carte resterait sur un build qui n'existe plus.
    if (_cmpA === b.nom) _cmpA = '';
    if (_cmpB === b.nom) _cmpB = '';
    // Ni la cible du bouton Écraser -- il n'y aurait plus rien à écraser.
    if (_buildCharge === b.nom) { _buildCharge = ''; majBoutonEcraser(); }
    dessinerBuilds();
    dessinerComparaison();
    if (comptesDispo() && window.Comptes.connecte() && parti) {
      // Sinon la prochaine synchro le ferait réapparaître.
      window.Comptes.supprimerBuild(parti.nom).catch(() => {});
    }
  };
  return carte;
}

function dessinerBuilds() {
  const toute = biblio();
  const boite = $('listeBuilds');
  const filtres = $('filtresBuilds');
  if (filtres) filtres.hidden = toute.length < SEUIL_FILTRES;
  // Le résumé de la colonne et le bouton flottant : un simple compte total,
  // toujours visible même quand aucune fenêtre n'est ouverte pour le lire
  // en détail.
  if ($('compteBuilds')) $('compteBuilds').textContent = toute.length || '';
  const boutonFlottant = $('boutonFlottantBuilds');
  if (boutonFlottant) {
    boutonFlottant.hidden = !toute.length;
    const badge = $('compteFlottantBuilds');
    if (badge) badge.textContent = toute.length || '';
  }
  if (!toute.length) {
    boite.innerHTML = `<div class="vide-liste">${t('builds.vide')}</div>`;
    if ($('compteBuildsFiltre')) $('compteBuildsFiltre').textContent = '';
    return;
  }
  const liste = toute.length < SEUIL_FILTRES ? toute : filtrerBuilds(toute);
  if ($('compteBuildsFiltre')) {
    $('compteBuildsFiltre').textContent = liste.length === toute.length
      ? '' : t('mesb.compte', { n: liste.length, total: toute.length });
  }
  // UN ONGLET PAR CLASSE, DANS L'ORDRE DU JEU : le tri choisi (nom / classe /
  // affixes) reste actif À L'INTÉRIEUR de l'onglet ouvert. Les onglets
  // eux-mêmes suivent le filtre en cours — chercher "Stardust" ne laisse
  // que les classes qui ont une correspondance.
  const parClasse = new Map();
  for (const b of liste) {
    const c = b.etat.c;
    if (!parClasse.has(c)) parClasse.set(c, []);
    parClasse.get(c).push(b);
  }
  const ordre = Object.keys(D.classes).map(Number).filter((c) => parClasse.has(c));
  for (const c of parClasse.keys()) if (!ordre.includes(c)) ordre.push(c);

  // L'ONGLET "RÉCENTS", EN TÊTE. Pas les builds créés — ceux CHARGÉS (voir
  // enregistrerRecent, appelé au clic sur "Charger") : c'est l'historique
  // de ce qu'on est venu rechercher, pas de ce qu'on a fait. Indépendant
  // des filtres classe/recherche du dessous — un raccourci vers "ce que je
  // viens d'utiliser", pas une nouvelle vue à filtrer.
  const recentsListe = recentsNoms()
    .map((nom) => toute.find((x) => x.nom === nom))
    .filter(Boolean);
  if (recentsListe.length) ordre.unshift('recent');

  const ongletsBoite = $('ongletsBuilds');
  // AUCUN ONGLET DU TOUT : ni classe correspondante, ni historique -- la
  // recherche/le filtre en cours ne renvoie rien nulle part.
  if (!ordre.length) {
    if (ongletsBoite) ongletsBoite.innerHTML = '';
    boite.innerHTML = `<div class="vide-filtre">${t('mesb.rien')}</div>`;
    return;
  }
  // L'onglet ouvert survit à un redessin (recherche, ami/pub, suppression) ;
  // il ne retombe sur le premier — "Récents" s'il existe, sinon la
  // première classe — que s'il a disparu.
  if (!ordre.includes(_ongletBuildsActif)) [_ongletBuildsActif] = ordre;
  if (ongletsBoite) {
    ongletsBoite.innerHTML = ordre.map((c) => {
      if (c === 'recent') {
        return `<button type="button" class="${_ongletBuildsActif === 'recent' ? 'actif' : ''}" data-c="recent">
          ${echapper(t('mesb.recents'))}
          <span class="n">${recentsListe.length}</span>
        </button>`;
      }
      const img = CLASSE_IMAGE[c];
      return `<button type="button" class="${c === _ongletBuildsActif ? 'actif' : ''}" data-c="${c}">
        ${img ? `<img src="icones_classes/${img}.webp" alt="" loading="lazy" decoding="async">` : ''}
        ${echapper(D.classes[String(c)] || '?')}
        <span class="n">${parClasse.get(c).length}</span>
      </button>`;
    }).join('');
    for (const b of ongletsBoite.querySelectorAll('button')) {
      b.onclick = () => {
        _ongletBuildsActif = b.dataset.c === 'recent' ? 'recent' : Number(b.dataset.c);
        dessinerBuilds();
      };
    }
  }

  boite.innerHTML = '';
  const groupe = _ongletBuildsActif === 'recent' ? recentsListe
    : (parClasse.get(_ongletBuildsActif) || []);
  // Ne devrait pas arriver (chaque entrée d'`ordre` vient d'un groupe non
  // vide), gardé quand même : un onglet qui ouvrirait sur du vide sans un
  // mot serait pris pour une panne.
  if (!groupe.length) {
    boite.innerHTML = `<div class="vide-filtre">${t('mesb.rien')}</div>`;
    return;
  }
  const grille = document.createElement('div');
  grille.className = 'mbGrille';
  for (const b of groupe) {
    const i = toute.findIndex((x) => x.nom === b.nom);
    grille.appendChild(carteBuild(b, i));
  }
  boite.appendChild(grille);
}

/* LA FENÊTRE "MES BUILDS". Même squelette que la grille d'affixes
   (ouvrirGrille/fermerGrille) : cacher/montrer, bloquer le défilement de la
   page derrière, rien à valider en fermant puisque chaque action (charger,
   supprimer, marquer ami/pub) s'applique déjà en direct. */
function ouvrirModalBuilds() {
  const v = $('modalMesBuilds');
  if (!v) return;
  dessinerBuilds();
  v.hidden = false;
  document.body.style.overflow = 'hidden';
  const ch = $('bChercher');
  if (ch) ch.focus();
}

function fermerModalBuilds() {
  const v = $('modalMesBuilds');
  if (!v || v.hidden) return;
  v.hidden = true;
  document.body.style.overflow = '';
}

// LE SEUL CHEMIN QUI ÉCRIT UN BUILD DANS LA BIBLIOTHÈQUE. « Enregistrer »
// (nom tapé dans le champ) et « Écraser » (nom du build déjà chargé) n'en
// sont que deux façons de fournir ce nom -- partagé pour que les deux
// gestes gardent la même règle de fusion (pub/ami préservés, etc.) sans
// jamais diverger.
function sauvegarderBuildSous(nom) {
  if (!cibles.size) {
    $('noteBuilds').innerHTML = `<span class="ko">${t('builds.affixeRequis')}</span>`;
    return;
  }
  const liste = biblio();
  const deja = liste.findIndex((b) => b.nom === nom);
  const etat = etatActuel();
  const entree = { nom, etat, code: etat.k || '',
                   // Réenregistrer un build ne doit pas le dépublier en
                   // douce, ni lui faire perdre sa pastille ami : on garde
                   // son état de partage.
                   pub: deja >= 0 ? !!liste[deja].pub : false,
                   ami: deja >= 0 ? !!liste[deja].ami : false };
  if (deja >= 0) liste[deja] = entree; else liste.push(entree);
  if (!ecrireBiblio(liste)) return;
  // Ce qu'on vient d'enregistrer devient « le build chargé » : le bouton
  // Écraser, s'il réapparaît après une modification de plus, visera celui-ci.
  _buildCharge = nom;
  majBoutonEcraser();
  dessinerBuilds();
  $('noteBuilds').innerHTML =
    `<span class="pas">${t(deja >= 0 ? 'builds.remplace' : 'builds.enregistre', { nom })}</span>`;
  if (comptesDispo() && window.Comptes.connecte()) {
    window.Comptes.envoyerBuilds([entree]).catch((e) => {
      $('noteBuilds').innerHTML =
        `<span class="ko">${tH('sync.partiel', { message: e.message })}</span>`;
    });
  }
}

function enregistrerBuild() {
  const champ = $('nomBuild');
  const nom = (champ.value || '').trim();
  if (!nom) {
    $('noteBuilds').innerHTML = `<span class="ko">${t('builds.nomRequis')}</span>`;
    champ.focus();
    return;
  }
  sauvegarderBuildSous(nom);
  champ.value = '';
}

// RÉENREGISTRE SOUS SON PROPRE NOM le build actuellement chargé (celui posé
// par carteBuild() à l'ouverture, ou par un enregistrement précédent) --
// sans repasser par le champ « nom du build ». Le bouton qui l'appelle est
// caché tant que _buildCharge est vide (voir majBoutonEcraser), donc ce
// garde ne devrait normalement jamais se déclencher.
function ecraserBuild() {
  if (!_buildCharge) return;
  sauvegarderBuildSous(_buildCharge);
}

// CHANGE LE NOM D'UN BUILD SANS TOUCHER À SON CONTENU. `nom` sert de clé
// partout ailleurs (biblio, comparaison, Écraser, Récents, la ligne côté
// serveur) : renommer doit donc mettre à jour CHAQUE endroit qui le garde
// en mémoire, sinon l'un d'eux continuerait de viser un nom qui n'existe
// plus.
function renommerBuild(ancienNom, nouveauNom) {
  const liste = biblio();
  const idx = liste.findIndex((x) => x.nom === ancienNom);
  if (idx < 0) return;
  if (liste.some((x) => x.nom === nouveauNom)) {
    $('noteBuilds').innerHTML =
      `<span class="ko">${t('builds.nomPris', { nom: nouveauNom })}</span>`;
    return;
  }
  const avant = liste[idx];
  liste[idx] = { ...avant, nom: nouveauNom };
  if (!ecrireBiblio(liste)) return;

  if (_cmpA === ancienNom) _cmpA = nouveauNom;
  if (_cmpB === ancienNom) _cmpB = nouveauNom;
  if (_buildCharge === ancienNom) { _buildCharge = nouveauNom; majBoutonEcraser(); }
  try {
    const r = recentsNoms().map((n) => (n === ancienNom ? nouveauNom : n));
    localStorage.setItem(CLE_RECENTS, JSON.stringify(r));
  } catch (e) { /* pas grave : juste le confort du raccourci qui manque */ }

  dessinerBuilds();
  dessinerComparaison();
  $('noteBuilds').innerHTML =
    `<span class="pas">${t('builds.renomme', { avant: ancienNom, apres: nouveauNom })}</span>`;

  // Le nom est la clé côté serveur (user_id, nom) : un simple ré-envoi sous
  // le nouveau nom laisserait l'ancienne ligne orpheline pour toujours,
  // d'où le retrait explicite avant l'envoi.
  if (comptesDispo() && window.Comptes.connecte()) {
    window.Comptes.supprimerBuild(ancienNom)
      .then(() => window.Comptes.envoyerBuilds([liste[idx]]))
      .catch((e) => {
        $('noteBuilds').innerHTML =
          `<span class="ko">${tH('sync.partiel', { message: e.message })}</span>`;
      });
  }
}

// UN NOM DE COPIE LIBRE, PROPOSÉ D'OFFICE dans le prompt : « Nom (copie) »,
// et si ça existe déjà « Nom (copie) 2 », 3, etc. -- l'utilisateur peut
// toujours le remplacer avant de valider.
function nomCopieDisponible(nom, liste) {
  const pris = new Set(liste.map((x) => x.nom));
  const base = t('builds.suffixeCopie', { nom });
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

// CRÉE UNE COPIE INDÉPENDANTE d'un build existant, sous un nouveau nom --
// pour essayer une variante sans toucher à l'original ni retaper tout le
// stuff/les cibles à la main. La copie part toujours privée (pub/ami à
// zéro) : publier était une décision prise pour l'original, pas pour un
// brouillon de test.
function dupliquerBuild(nom) {
  const liste = biblio();
  const original = liste.find((x) => x.nom === nom);
  if (!original) return;
  const suggestion = nomCopieDisponible(nom, liste);
  const propose = (prompt(t('builds.dupliquerInvite', { nom }), suggestion) || '').trim();
  if (!propose) return;
  if (liste.some((x) => x.nom === propose)) {
    $('noteBuilds').innerHTML =
      `<span class="ko">${t('builds.nomPris', { nom: propose })}</span>`;
    return;
  }
  const copie = { ...original, nom: propose, pub: false, ami: false };
  liste.push(copie);
  if (!ecrireBiblio(liste)) return;
  dessinerBuilds();
  $('noteBuilds').innerHTML =
    `<span class="pas">${t('builds.enregistre', { nom: propose })}</span>`;
  if (comptesDispo() && window.Comptes.connecte()) {
    window.Comptes.envoyerBuilds([copie]).catch((e) => {
      $('noteBuilds').innerHTML =
        `<span class="ko">${tH('sync.partiel', { message: e.message })}</span>`;
    });
  }
}

/* Le lien partageable. Tout l'état tient dans l'adresse : rien à héberger,
   rien à synchroniser, et le lien marche chez qui le reçoit. */
function versLien(etat) {
  const txt = unescape(encodeURIComponent(JSON.stringify(etat)));
  return btoa(txt).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisLien(frag) {
  const b64 = frag.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

let _etatPartage = null;

function lirePermalien() {
  const frag = (location.hash || '').replace(/^#b=/, '');
  if (!frag || frag === location.hash) return false;
  try {
    const e = depuisLien(frag);
    appliquerEtat(e);
    _etatPartage = e;
    return true;
  } catch (err) {
    return false;
  }
}

/* Les suggestions à l'écran. On PROPOSE : chaque ligne a son bouton, rien
   n'est appliqué tant qu'on ne clique pas. Une carte vide disparaît plutôt
   que d'afficher « aucune suggestion » à longueur de build. */
function dessinerSuggestions(res, classe) {
  // Les echanges vivent maintenant DANS la carte « Marge de manoeuvre » :
  // c'est la meme question que « jusqu'ou puis-je monter ? », posee sur les
  // pieces au lieu des emplacements libres. Deux cartes separees en
  // arrivaient a se contredire a l'ecran.
  const carte = $('blocEchanges');
  const boite = $('listeSuggestions');
  if (!carte || !boite || !res || !res.slotItems) return;
  let liste = [];
  try {
    const pl = {};
    Object.assign(pl, planchersActuels());
    liste = suggestions(res, classe, $('arme').value || null,
                        [...cibles.entries()], pl,
                        res.vinPoints || new Map());
  } catch (e) {
    liste = [];
  }
  carte.hidden = !liste.length;
  // Le nombre d'echanges remonte au sommaire de la carte, qui totalise les
  // trois sens : replie, on sait deja s'il y a quelque chose a regarder.
  _nbEchanges = liste.length;
  majCompteMarge();
  if (!liste.length) return;
  boite.innerHTML = '';
  liste.forEach((e) => {
    const couleurA = D.couleurs[String(e.avant.g)] || '#9fb0c4';
    const couleurB = D.couleurs[String(e.apres.g)] || '#9fb0c4';
    const puces = e.gains.map(([n, a, b]) => {
      const pal = e.paliers.includes(n);
      const quoi = (e.demande && e.demande[n]) || '';
      const src = e.origine && e.origine[n] === 'inne'
        ? t('sugg.inne') : t('sugg.gemme');
      const etiq = pal ? ` · <b title="${t('palier.quoi', { n: palier(n) })}">`
        + t('sugg.palier') + '</b>'
        : (quoi === 'bonus' ? ' · ★' : (quoi ? '' : ' · ' + t('sugg.nonDemande')));
      return `<span class="puceG${pal ? ' palier' : ''}${quoi ? '' : ' bonus'}" `
        + `title="${src}">${n} ${a}→${b}${etiq}</span>`;
    }).join('')
      + e.pertes.map(([n, a, b]) =>
        `<span class="puceP">${n} ${a}→${b}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'sugg';
    div.innerHTML = `
      <div class="txt">
        <div class="ou">${D.nomsSlots[e.slot] || e.slot}</div>
        <div class="qui" style="--a:${couleurA};--b:${couleurB}">${
          titreEchange(e.avant, e.apres)}</div>
        <div class="pu">${puces}</div>
      </div>
      <button class="appl">${t('sugg.appliquer')}</button>`;
    div.querySelector('.appl').onclick = () => {
      const neufs = { ...res.slotItems, [e.slot]: e.apres };
      const a = assembler(neufs, ciblesPourStuff(cibles, res.vinPoints), true,
                          figeesDe(verrousObjet()));
      const majeur = { slotItems: neufs, sockets: a.sockets, couvert: a.couvert,
                       sources: a.sources, vin: res.vin,
                       vinPoints: res.vinPoints, suffisant: true,
                       secondeArme: res.secondeArme };
      dernier = majeur;
      afficher(majeur, classe);
      // `avant` et `apres` nus n'existaient pas dans cette portée : l'affectation
      // levait une ReferenceError à chaque clic. Les deux clés i18n portent déjà
      // la phrase entière dans les trois langues — le français en dur la redisait.
      $('etat').innerHTML = `<span class="ok">${t('etat.suggApp')}</span>`
        + `<span class="pas"> ${tH('etat.suggAppNote', { avant: e.avant.n, apres: e.apres.n })}</span>`;
    };
    boite.appendChild(div);
  });
}

/* Les pièces interchangeables, à l'écran. Une ligne par emplacement, la
   pièce en place marquée, les autres cliquables. Rien n'est appliqué sans
   clic — comme les suggestions. */
/* POSER UNE AUTRE PIÈCE SUR UN SLOT, EN REVÉRIFIANT.
   Seul chemin qui échange une pièce : le panneau "Pièces interchangeables"
   et la flèche sur le paperdoll (Ring/Necklace) passent tous les deux par
   ici, donc ils se comportent exactement pareil. */
function echangerPiece(res, classe, slot, item) {
  const neufs = { ...res.slotItems, [slot]: item };
  const vp = res.vinPoints || new Map();
  const a = assembler(neufs, ciblesPourStuff(cibles, vp), true, figeesDe(verrousObjet()));
  // On REVÉRIFIE après coup : c'est le seul moment où l'on connaît l'effet
  // combiné de tous les échanges déjà faits.
  const manques = [...cibles.entries()].filter(([n, l]) =>
    Math.min(plafond(n), (a.couvert[n] || 0) + (vp.get(n) || 0)) < l);
  const maj = { slotItems: neufs, sockets: a.sockets, couvert: a.couvert,
                sources: a.sources, vin: res.vin,
                vinPoints: vp, suffisant: !manques.length,
                secondeArme: res.secondeArme };
  dernier = maj;
  afficher(maj, classe);
  $('etat').innerHTML = manques.length
    ? `<span class="ko">${t('alt.perdu')}</span><span class="pas"> — `
      + manques.map(([n, l]) => `${n} ${l}`).join(', ') + '.</span>'
    : `<span class="ok">${t('alt.pose')}</span>`
      + `<span class="pas"> — ${item.n}.</span>`;
  // Le panneau et la flèche du paperdoll pointaient tous les deux vers
  // l'ANCIEN état : sans ce recalcul, un second échange écraserait le
  // premier au lieu de partir de son résultat.
  setTimeout(() => dessinerAlternatives(maj, classe), 0);
}

/* Les slots dont le paperdoll porte une petite flèche déroulante : ce sont
   les emplacements où plusieurs pièces du même palier ne se distinguent que
   par une stat brute (dégâts / résistance / armure...), pas par leurs
   affixes — l'endroit où le choix visuel compte vraiment. Mêmes quatre
   emplacements que SLOTS_SAVEUR (même propriété, deux réglages différents :
   celui-ci montre les options APRÈS coup, l'autre en choisit une AVANT).
   Une constante séparée plutôt qu'une seule : rien n'oblige les deux listes
   à rester égales si un jour l'une évolue sans l'autre. */
const SLOTS_ALT_PAPERDOLL = ['Ring', 'Necklace', 'Gauntlets', 'Boots'];

/* La flèche sur la pièce elle-même : mêmes données que le panneau plus bas,
   affichées là où on les cherche en premier. */
function brancherAltPaperdoll(liste, res, classe) {
  for (const slot of SLOTS_ALT_PAPERDOLL) {
    const zone = document.querySelector(
      `#paperdoll .altPieceSlot[data-slot="${CSS.escape(slot)}"]`);
    if (!zone) continue;
    zone.innerHTML = '';
    const entree = liste.find((e) => e.slot === slot);
    if (!entree) continue;
    const couleur = D.couleurs[String(entree.bonnes[0].item.g)] || '#9fb2c4';
    const det = document.createElement('details');
    det.className = 'altPiece';
    det.innerHTML = `<summary>${t('alt.autresChoix', { n: entree.bonnes.length - 1 })}</summary>`;
    const menu = document.createElement('div');
    menu.className = 'altPieceMenu';
    for (const b of entree.bonnes) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'altPieceOpt' + (b.actuel ? ' actuel' : '');
      opt.style.color = couleur;
      // CE QUI CHANGE VRAIMENT, PAS SEULEMENT LA STAT BRUTE.
      // Quatre pièces qui partagent le même nom, la même stat brute et
      // aucun trou ne se distinguent QUE par leur inné (le cas courant à
      // rareté basse, où les emplacements de gemme n'existent pas encore) —
      // sans l'afficher, les quatre lignes de ce menu sont mot pour mot
      // identiques et personne ne peut choisir en connaissance de cause.
      const stat = statsLisibles(b.item.at);
      opt.innerHTML = `<span class="nomOpt">${echapper(b.item.n)}</span>`
        + `<span class="statOpt">${echapper(signature(b.item))}</span>`
        + (stat ? `<span class="statOpt">${echapper(stat)}</span>` : '');
      if (b.actuel) {
        opt.disabled = true;
        opt.title = t('alt.actuel');
      } else {
        opt.title = t('alt.poser');
        opt.onclick = () => { det.open = false; echangerPiece(res, classe, slot, b.item); };
      }
      menu.appendChild(opt);
    }
    det.appendChild(menu);
    zone.appendChild(det);
  }
}

function dessinerAlternatives(res, classe) {
  const carte = $('blocAlternatives');
  const boite = $('listeAlternatives');
  if (!carte || !res || !res.slotItems) return;
  let liste = [];
  try {
    const pl = {};
    Object.assign(pl, planchersActuels());
    liste = alternatives(res, classe, $('arme').value || null,
                         [...cibles.entries()], pl, res.vinPoints || new Map());
  } catch (e) { liste = []; }
  brancherAltPaperdoll(liste, res, classe);
  carte.hidden = !liste.length;
  if (!liste.length) return;
  // PAS DE PRODUIT DES POSSIBILITÉS. Multiplier les compteurs donnerait un
  // nombre flatteur mais faux : chaque pièce n'est vérifiée que SEULE, et
  // les gemmes étant partagées par tout le build, deux échanges qui tiennent
  // séparément peuvent très bien ne pas tenir ensemble. On annonce donc ce
  // qu'on a réellement mesuré, et l'échange est revérifié au clic.
  $('noteAlternatives').innerHTML = `<span class="pas">${t('alt.aide')}</span>`;
  boite.innerHTML = '';
  for (const e of liste) {
    const bloc = document.createElement('div');
    bloc.className = 'altSlot';
    const couleur = D.couleurs[String(e.bonnes[0].item.g)] || '#9fb0c4';
    bloc.innerHTML = `<div class="ou">${D.nomsSlots[e.slot] || e.slot}
      <span class="nb">${e.bonnes.length}</span></div>`;
    const rangee = document.createElement('div');
    rangee.className = 'altListe';
    for (const b of e.bonnes) {
      const el = document.createElement('button');
      el.className = 'altItem' + (b.actuel ? ' actuel' : '');
      el.style.color = couleur;
      el.innerHTML = `${echapper(b.item.n)}<small>${signature(b.item)}</small>`;
      el.title = b.actuel ? t('alt.actuel') : t('alt.poser');
      if (!b.actuel) el.onclick = () => echangerPiece(res, classe, e.slot, b.item);
      rangee.appendChild(el);
    }
    bloc.appendChild(rangee);
    boite.appendChild(bloc);
  }
}

/* VIDER UN SLOT ET NE RECALCULER QUE LUI.
 *
 * Pas un simple retrait à l'affichage : ça laisserait le tableau des
 * affixes mentir sur ce que le stuff couvre vraiment. On fige donc
 * TEMPORAIREMENT les sept autres pièces à ce qu'elles sont déjà — jamais
 * dans `verrouilles` lui-même, sinon les cadenas réels du joueur se
 * retrouveraient fermés partout sans qu'il l'ait demandé — et on relance
 * construire() dessus. Un vrai cadenas posé sur une autre pièce garde la
 * priorité sur ce qu'on vient de lire dans le dernier résultat.
 */
function supprimerPiece(slot) {
  if (!dernier) return;
  const classe = Number($('classe').value);
  const arme = $('arme').value || null;
  const grade = $('rarete').value ? Number($('rarete').value) : null;
  const mixte = $('mixte').checked;
  const planchers = planchersActuels();
  const saveurs = saveursActuelles();

  const verrousTemp = {};
  for (const [s, it] of Object.entries(dernier.slotItems)) {
    if (s === slot || !it) continue;
    const gemmes = dernier.sockets.filter((g) => g.slot === s)
      .sort((a, b) => a.index - b.index).map((g) => g.gem || null);
    verrousTemp[s] = { item: it, gemmes };
  }
  for (const [s, v] of verrouilles) if (s !== slot) verrousTemp[s] = v;
  // La croix passe outre un cadenas éventuel sur CE slot précis : demander
  // de retirer une pièce puis la revoir revenir sans bouger n'aurait aucun
  // sens.
  if (verrouilles.has(slot)) verrouilles.delete(slot);
  majNoteVerrous();

  $('etat').textContent = t('etat.calcul');
  const res = construire(classe, arme, [...cibles.entries()], grade,
                         $('vin').checked, mixte, planchers, vinManuel,
                         verrousTemp, saveurs);
  res.secondeArme = secondeArmeActuelle(classe, res);
  dernier = res;
  afficher(res, classe);
  $('etat').innerHTML = res.suffisant
    ? `<span class="ok">${t('etat.ok')}</span>`
    : `<span class="ko">${t('etat.ko')}</span>`;
}

function calculer() {
  // Des que l'utilisateur calcule quelque chose a lui, l'exemple n'a plus
  // lieu d'etre annonce.
  cacherBandeauDemo();
  if (!cibles.size) {
    $('etat').textContent = t('etat.choisir');
    // Sans cible, le verdict d'en bas n'a plus d'objet : le laisser
    // afficherait « toutes les cibles sont atteintes » pour zéro cible.
    if ($('verdictEquip')) { $('verdictEquip').textContent = ''; $('verdictEquip').className = ''; }
    return;
  }
  // COMBIEN DE CALCULS SONT VRAIMENT LANCES, PAS COMBIEN DE BUILDS SONT
  // ENREGISTRES : la table `builds` ne voit que ce qui est sauvegarde dans
  // un compte, une fraction de ce que les visiteurs essaient vraiment.
  // Meme bascule et meme anonymat que compter_visite() -- un clic, un
  // comptage, jamais les tentatives internes de relance d'un meme calcul.
  if (comptesDispo() && window.MISTFALL_CONFIG.compterVisites) {
    fetch(`${window.MISTFALL_CONFIG.supabaseUrl}/rest/v1/rpc/compter_calcul`, {
      method: 'POST',
      headers: { apikey: window.MISTFALL_CONFIG.supabaseAnonKey,
                 Authorization: 'Bearer ' + window.MISTFALL_CONFIG.supabaseAnonKey,
                 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
  }
  const classe = Number($('classe').value);
  const arme = $('arme').value || null;
  const grade = $('rarete').value ? Number($('rarete').value) : null;
  const mixte = $('mixte').checked;
  const planchers = planchersActuels();
  const saveurs = saveursActuelles();
  $('etat').textContent = t('etat.calcul');
  const t0 = performance.now();

  /* LA RELANCE EST AUTOMATIQUE, PAS AU JOUEUR DE RE-CLIQUER.
   *
   * La recherche en rareté unique tire des départs au hasard (voir
   * construireAuGrade) : elle réussit dans l'écrasante majorité des cas dès
   * le premier calcul, mais pas tous. Faire découvrir ça au joueur en le
   * laissant re-cliquer "Calculer" pour retomber, par chance, sur un tirage
   * qui marche est absurde — la machine peut retirer les dés elle-même.
   * Trois tentatives internes, chacune sa propre recherche fraîche, avant
   * de vraiment renoncer et proposer une autre rareté. Réservé à la rareté
   * unique : le panaché a déjà ses deux départs et coûte cher à la cible,
   * le refaire trois fois referait la page figée qu'on cherche à éviter. */
  const TENTATIVES_MAX = mixte ? 1 : 3;

  const tenter = (tentative) => {
    setTimeout(() => {
      try {
        const res = construire(classe, arme, [...cibles.entries()], grade,
                               $('vin').checked, mixte, planchers, vinManuel, verrousObjet(), saveurs);
        if (!res.suffisant && tentative < TENTATIVES_MAX) {
          tenter(tentative + 1);
          return;
        }
        res.secondeArme = secondeArmeActuelle(classe, res);
        dernier = res;
        afficher(res, classe);
        const raretes = {};
        for (const it of Object.values(res.slotItems)) if (it) raretes[it.g] = (raretes[it.g] || 0) + 1;
        const detail = Object.entries(raretes).sort()
          .map(([g, n]) => `${n} × ${D.raretes[g]}`).join(', ');
        const chrono = t('etat.chrono',
                         { detail, ms: Math.round(performance.now() - t0) });
        if (res.suffisant) {
          $('etat').innerHTML =
            `<span class="ok">${t('etat.ok')}</span><br>${chrono}`;
          afficherRappelDon();
          return;
        }
        // ÉCHEC : ne pas s'arrêter à « pas atteignable ». Une rareté figée
        // n'escalade JAMAIS, par construction — c'est le piège quand on passe
        // d'un build tout-violet à un build qui a besoin de deux pièces
        // dorées. On cherche donc ce qui marcherait, et on le propose.
        $('etat').innerHTML =
          `<span class="ko">${t('etat.ko')}</span><br>${chrono}`
          + `<br><span class="pas">${t('etat.recherche')}</span>`;
        const issue = chercherUneIssue(classe, arme, grade, mixte, planchers, saveurs);
        $('etat').innerHTML =
          `<span class="ko">${t('etat.ko')}</span><br>${chrono}`
          + (issue ? `<br>${issue}` : `<br><span class="pas">${t('etat.rien')}</span>`);
      } catch (err) {
        $('etat').innerHTML = `<span class="ko">${tH('etat.erreur', { message: err.message })}</span>`;
      }
    }, 10);
  };
  tenter(1);
}

/* Quel réglage atteindrait les cibles ? On essaie, dans l'ordre du moins
   cher au plus cher, et on rend un bouton qui l'applique. Un message qui dit
   seulement « non » est un cul-de-sac ; celui-ci dit « oui, comme ça ». */
function chercherUneIssue(classe, arme, grade, mixte, planchers, saveurs) {
  const liste = [...cibles.entries()];
  const vin = $('vin').checked;
  const essais = [];
  if (!mixte) {
    essais.push({ cle: 'panache', texte: t('issue.panache'),
                  grade, mixte: true });
  }
  if (grade !== null) {
    essais.push({ cle: 'auto', texte: t('issue.auto'),
                  grade: null, mixte });
    if (!mixte) {
      essais.push({ cle: 'auto-panache', texte: t('issue.autoPanache'),
                    grade: null, mixte: true });
    }
  }
  for (const e of essais) {
    let r;
    try {
      // « panache » garde le grade verrouille comme PLANCHER (c'est
      // planchersActuels() qui l'imposera une fois applique, rarete non
      // vide + mixte coche) : l'apercu doit deja le respecter, sinon il
      // promet un mix qui redescend sous ce plancher et Appliquer echoue
      // silencieusement sur une combinaison qu'on vient de montrer comme
      // fonctionnant. « auto »/« auto-panache » vident rarete (e.grade
      // null) donc n'ont aucun plancher a simuler ici.
      const planchersEssai = e.mixte
        ? (e.grade ? Object.fromEntries(D.ordreSlots.map((s) => [s, e.grade])) : planchers)
        : {};
      r = construire(classe, arme, liste, e.grade, vin, e.mixte,
                     planchersEssai, vinManuel, verrousObjet(), saveurs);
    } catch (err) { continue; }
    if (!r.suffisant) continue;
    const raretes = {};
    for (const it of Object.values(r.slotItems)) if (it) raretes[it.g] = (raretes[it.g] || 0) + 1;
    const detail = Object.entries(raretes).sort()
      .map(([g, n]) => `${n} × ${D.raretes[g]}`).join(', ');
    setTimeout(() => {
      const b = $('appliquerIssue');
      if (!b) return;
      b.onclick = () => {
        if (e.grade === null) $('rarete').value = '';
        else $('rarete').value = String(e.grade);
        $('mixte').checked = e.mixte;
        $('blocPlancher').hidden = !e.mixte;
        calculer();
      };
    }, 0);
    return `<span class="ok">${tH('etat.issue', { comment: e.texte })}</span> (${detail}). `
      + '<button id="appliquerIssue" style="padding:3px 9px;font-size:12px">'
      + `${t('etat.appliquer')}</button>`;
  }
  return null;
}

function importer() {
  const code = prompt(t('code.demande'));
  if (!code) return;
  try {
    afficherCode(code.trim());
  } catch (err) {
    $('etat').innerHTML = `<span class="ko">${tH('etat.codeIllisible', { message: err.message })}</span>`;
  }
}

/* AFFICHER UN BUILD TEL QUEL, depuis son code.
 *
 * C'est la différence entre « voici ce que tu avais » et « voici ce que je
 * recomposerais avec les mêmes objectifs ». Un build enregistré doit rendre
 * le PREMIER : sinon un panaché 6 Épique + 2 Légendaire réenregistré puis
 * rouvert ressortait tout en Légendaire, parce que seule la liste d'affixes
 * avait été gardée et que l'optimiseur repartait de zéro. */
function afficherCode(code, vinPoints) {
  libererVerrous();
  {
    // Sans second argument on affiche un code nu — celui qu'un inconnu vient
    // de coller. On ne lui prête aucun vin : rien dans le code ne le dit.
    const vp = vinPoints || new Map();
    const lu = decoderCode(code.trim());
    const parId = new Map();
    for (const pool of Object.values(D.objets)) for (const it of pool) parId.set(it.id, it);
    const slotItems = {};
    const sockets = [];
    const couvert = {};
    let hors = 0;
    // L'EMPLACEMENT 11, C'EST LA DEUXIEME ARME (voir dessinerAffixes() côté
    // export) : hors de versGameData, donc absent de la boucle normale, sans
    // quoi un code réel portant une deuxième arme la ferait disparaître au
    // premier aller-retour import → export sur le site.
    let secondeArmeLue = null;
    for (const e of lu.emplacements) {
      if (e.slot === 11) {
        if (e.cfg) {
          const it2 = parId.get(String(e.cfg));
          if (it2) {
            const sockets2 = it2.s.map((sk, idx) => {
              const gid = e.gemmes[idx];
              const g = gid ? gemParId.get(String(gid)) : null;
              return { slot: SLOT_ARME, index: idx, type: sk[0], level: sk[1], gem: g || null };
            });
            secondeArmeLue = { item: it2, sockets: sockets2, approche: false, manque: {} };
          } else { hors += 1; }
        }
        continue;
      }
      const slot = D.codec.versGameData[String(e.slot)];
      if (!slot || !e.cfg) continue;
      const it = parId.get(String(e.cfg));
      if (!it) { hors += 1; continue; }
      slotItems[slot] = it;
      if (it.i) couvert[it.i] = (couvert[it.i] || 0) + 1;
      it.s.forEach((sk, idx) => {
        const gid = e.gemmes[idx];
        const g = gid ? gemParId.get(String(gid)) : null;
        if (g) for (const a of g.a) couvert[a] = (couvert[a] || 0) + 1;
        sockets.push({ slot, index: idx, type: sk[0], level: sk[1], gem: g || null });
      });
    }
    // Ce que ce build A, stuff ET vin réunis : c'est le total que le joueur
    // verra en jeu, et donc le niveau visé qu'on réaffiche.
    cibles.clear();
    for (const nom of new Set([...Object.keys(couvert), ...vp.keys()])) {
      const total = Math.min((couvert[nom] || 0) + (vp.get(nom) || 0), plafond(nom));
      if (total > 0) cibles.set(nom, total);
    }
    $('classe').value = String(lu.classe);
    majArmes();
    const arme = slotItems[SLOT_ARME];
    if (arme) {
      for (const a of D.armes[String(lu.classe)] || []) {
        const cle = `${lu.classe}|weapon|${a}|${arme.g}`;
        if ((D.objets[cle] || []).some((x) => x.id === arme.id)) { $('arme').value = a; break; }
      }
    }
    dessinerAffixes();
    majBudgetVin();
    dernier = { slotItems, sockets, couvert, vin: new Set(vp.keys()), vinPoints: vp,
                suffisant: true, sources: [], secondeArme: secondeArmeLue };
    // La case et ses réglages suivent ce que le code portait vraiment,
    // sinon "Deuxième arme" reste décochée alors que le paperdoll en montre
    // une, ou coché sur un type qui n'est plus celui lu.
    if ($('secondeArmeActive')) {
      $('secondeArmeActive').checked = !!secondeArmeLue;
      $('blocSecondeArme').hidden = !secondeArmeLue;
      if (secondeArmeLue && $('secondeArmeType') && $('secondeArmeRarete')) {
        for (const a of D.armes[String(lu.classe)] || []) {
          const cle = `${lu.classe}|weapon|${a}|${secondeArmeLue.item.g}`;
          if ((D.objets[cle] || []).some((x) => x.id === secondeArmeLue.item.id)) {
            $('secondeArmeType').value = a; break;
          }
        }
        $('secondeArmeRarete').value = String(secondeArmeLue.item.g);
      }
    }
    afficher(dernier, lu.classe);
    const raretes = {};
    for (const it of Object.values(slotItems)) if (it) raretes[it.g] = (raretes[it.g] || 0) + 1;
    const detail = Object.entries(raretes).sort()
      .map(([g, n]) => `${n} × ${D.raretes[g]}`).join(', ');
    // `perdus` n'a jamais existé : cette branche levait une ReferenceError dès
    // qu'un code portait une pièce hors catalogue. La clé i18n dit déjà la
    // phrase entière dans les trois langues, le préfixe français faisait double.
    const tete = hors
      ? `<span class="avert">${t('etat.horsCatalogue', { n: hors })}</span>`
      : `<span class="ok">${t('etat.charge')}</span>`;
    $('etat').innerHTML = `${tete}<br>${detail} — <span class="pas">`
      + t('etat.chargeNote') + '</span>';
    return { hors, raretes };
  }
}

/* ------------------------------------------------------------- démarrage --
   Les données arrivent par une balise <script> et NON par fetch() : ouvert
   depuis le disque (file://), un fetch est refusé par le navigateur et la
   page restait vide — listes d'affixes comprises. */
/* Le sélecteur de langue. Il est posé avant tout le reste : si le chargement
   des données échouait, on veut quand même pouvoir changer de langue pour
   lire le message d'erreur. */
/* Deux pages, pas un site à onglets : le builder, et la galerie publique.
   La galerie ne se charge qu'à la première visite — inutile d'interroger la
   base pour quelqu'un qui ne la regardera jamais. */
let _galerieChargee = false;

/* ======================================================================
   FICHE DE PERSONNAGE

   Tous les nombres viennent de fiche.js, qui les calcule avec la formule
   publiée par le wiki. Ici on ne fait que les mettre en page — et surtout
   on montre D'OÙ ils viennent, parce qu'une fiche qu'on ne peut pas
   vérifier ne vaut rien.
   ====================================================================== */
let _sortChoisi = null;
/* ON RETIENT CE QUI EST FERMÉ, PAS CE QUI EST OUVERT.
 *
 * La version d'avant retenait les groupes OUVERTS et n'ouvrait par défaut
 * que si l'ensemble était vide. Conséquence : dès qu'on touchait un seul
 * groupe, l'ensemble cessait d'être vide et TOUS les autres se refermaient
 * au redessin suivant. On voyait alors une barre de titre et plus une seule
 * compétence.
 *
 * En retenant les groupes FERMÉS, le défaut est l'ouverture : un groupe
 * n'est replié que si on l'a replié soi-même. */
const _ecolesFermees = new Set();
let _brancheChoisie = 0;

function nb(x, dec) {
  const d = dec == null ? 0 : dec;
  return Number(x || 0).toLocaleString(undefined,
    { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pc(x, dec) {
  return `${(Number(x || 0) * 100).toFixed(dec == null ? 1 : dec)} %`;
}

/* Un pictogramme par statistique. Dessinés ici plutôt que téléchargés : le
   jeu n'expose pas d'icône pour ses stats, et une image « qui ressemble »
   prise ailleurs serait une invention de plus. Le trait suit celui des
   pastilles de catégorie, déjà en place. */
const PICTO_STAT = {
  attaque: '<path d="m4 20 8-8M6 4l14 14M14 4h6v6"/>',
  defense: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/>',
  vie: '<path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z"/>',
  ehp: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="M9 12h6"/>',
  physique: '<path d="M14.5 3.5 20 9l-9.5 9.5L5 13l9.5-9.5ZM5 13l-2 6 6-2"/>',
  magique: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>',
  penetration: '<path d="M3 12h13M12 7l5 5-5 5M19 5v14"/>',
  critique: '<path d="m13 2-8 11h6l-2 9 8-11h-6l2-9Z"/>',
};
function pictoStat(nom) {
  const d = PICTO_STAT[nom];
  if (!d) return '';
  return `<svg class="pStat" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/* CE QUI N'EST PAS COMPTÉ DANS LE CHIFFRE AU-DESSUS, ET POURQUOI.
 *
 * Signalé par un joueur : Stoic (sous 50% de Vie) et Resilience (en
 * subissant un CC) apportaient de la Résistance qui n'est pas permanente,
 * additionnée quand même — la fiche affichait une Résistance qu'on n'a pas
 * en dehors de ces moments. Voir fiche.js (CONDITIONNELS_CONNUS) pour le
 * calcul ; ici on ne fait que l'écrire, sous le chiffre qu'elle ne compte
 * plus. */
function situationnelsTexte(liste) {
  if (!liste || !liste.length) return '';
  return t('fiche.situationnel') + ' '
    + liste.map((s) => `${s.nom} +${pc(s.valeur)} (${t('fiche.cond.' + s.condKey)})`).join(' · ');
}

function carteStat(lib, val, sous, fort, picto) {
  return `<div class="stat${fort ? ' fort' : ''}">
    <div class="lib">${pictoStat(picto)}<span>${lib}</span></div>
    <div class="val">${val}</div>
    ${sous ? `<div class="sous">${sous}</div>` : ''}</div>`;
}

function dessinerFiche(res, classeId) {
  const bloc = $('blocFiche');
  if (!bloc || !window.Fiche) return;
  const f = window.Fiche.ficheDe(res, classeId, D);
  bloc.hidden = false;

  // Les pièces du build, en bandeau : la fiche doit dire de QUI elle parle.
  const vignettes = D.ordreSlots.map((slot) => {
    const it = res.slotItems[slot];
    if (!it) return '';
    const couleur = D.couleurs[String(it.g)] || '#9fb2c4';
    return `<span class="piecette" style="--tinte:${couleur}" title="${infobulle(it)}">
      ${it.ic ? `<img src="icones/${it.ic}" alt="" decoding="async">`
              : '<i></i>'}</span>`;
  }).join('');

  $('fiche').innerHTML = `
    <div class="enteteFiche">
      <div class="qui"><b>${f.nomClasse}</b>
        <small>${$('arme').value || ''} · ${f.pieces} ${t('fiche.pieces')}</small></div>
      <div class="miniStuff">${vignettes}</div>
    </div>
    <div class="statsGrille">
    ${carteStat(t('fiche.attaque'), nb(f.attaque),
                t('fiche.attaqueSous', { base: nb(f.base.Attack),
                  stuff: nb(f.stuff.attack || 0) }), true, 'attaque')}
    ${carteStat(t('fiche.defense'), nb(f.defense),
                t('fiche.defenseSous', { red: pc(f.reduction) }), true, 'defense')}
    ${carteStat(t('fiche.vie'), nb(f.vie), '', false, 'vie')}
    ${carteStat(t('fiche.ehpPhys'), nb(f.ehpPhysique),
                t('fiche.ehpSous'), false, 'ehp')}
    ${carteStat(t('fiche.ehpMag'), nb(f.ehpMagique), t('fiche.ehpSous'), false, 'ehp')}
    ${carteStat(t('fiche.degPhys'), '+' + pc(f.bonusPhysique), '', false, 'physique')}
    ${carteStat(t('fiche.degMag'), '+' + pc(f.bonusMagique), '', false, 'magique')}
    ${carteStat(t('fiche.resPhys'), pc(f.resistPhysique),
                situationnelsTexte(f.conditionnels.resistPhysique), false, 'defense')}
    ${carteStat(t('fiche.resMag'), pc(f.resistMagique),
                situationnelsTexte(f.conditionnels.resistMagique), false, 'defense')}
    ${carteStat(t('fiche.penetration'), pc(f.penetration), '', false, 'penetration')}
    ${carteStat(t('fiche.resCrit'), pc(f.resistCritique), '', false, 'critique')}
    ${carteStat(t('fiche.critique'), pc(f.critique, 0),
                t('fiche.critiqueSous'), false, 'critique')}
  </div>`;

  // La provenance : chaque ligne dit ce qui vient de la classe, du stuff et
  // des affixes. C'est ce tableau qui permet de contredire l'outil.
  const l = [];
  const ligne = (quoi, base, stuff, aff, total) =>
    `<tr><td>${quoi}</td><td class="n">${base}</td><td class="n">${stuff}</td>
     <td class="n">${aff}</td><td class="n"><b>${total}</b></td></tr>`;
  l.push(ligne(t('fiche.attaque'), nb(f.base.Attack), nb(f.stuff.attack || 0),
    f.aff.attaquePourcent ? '×' + (1 + f.aff.attaquePourcent).toFixed(3) : '—',
    nb(f.attaque)));
  l.push(ligne(t('fiche.defense'), nb(f.base.Defense), nb(f.stuff.defence || 0),
    nb(f.aff.defensePlate || 0), nb(f.defense)));
  l.push(ligne(t('fiche.vie'), nb(f.base.Health), nb(f.stuff.maxHealth || 0),
    f.aff.viePourcent ? '×' + (1 + f.aff.viePourcent).toFixed(3) : '—',
    nb(f.vie)));
  l.push(ligne(t('fiche.degPhys'), '—', pc(f.stuff.physicalIncrease || 0),
    pc(f.aff.degatsPhysiques || 0), pc(f.bonusPhysique)));
  l.push(ligne(t('fiche.degMag'), '—', pc(f.stuff.magicalIncrease || 0),
    pc(f.aff.degatsMagiques || 0), pc(f.bonusMagique)));
  l.push(ligne(t('fiche.resPhys'), '—', pc(f.stuff.physicalReduction || 0),
    pc(f.aff.resistPhysique || 0), pc(f.resistPhysique)));
  l.push(ligne(t('fiche.resMag'), '—', pc(f.stuff.magicalReduction || 0),
    pc(f.aff.resistMagique || 0), pc(f.resistMagique)));

  const apports = f.detailAffixes
    .filter((a) => Object.keys(a.apports).length)
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((a) => `<tr><td><span class="avecPastille">${
        pastille(a.nom)}${a.nom}
        <b class="niv">${a.niveau}</b></span></td>
      <td colspan="4">${echapper(a.phrase)}</td></tr>`).join('');
  const muets = f.detailAffixes.filter((a) => !Object.keys(a.apports).length);

  $('ficheProvenance').innerHTML = `
    <p class="pas" style="font-size:12px">${t('fiche.explique')}</p>
    <p class="pas" style="font-size:12px">${t('sorts.reserve')}</p>
    <table>
      <tr><th>${t('fiche.stat')}</th><th class="n">${t('fiche.deClasse')}</th>
          <th class="n">${t('fiche.deStuff')}</th>
          <th class="n">${t('fiche.deAffixes')}</th>
          <th class="n">${t('fiche.total')}</th></tr>
      ${l.join('')}
    </table>
    ${apports ? `<p class="pas" style="font-size:12px;margin-top:10px">
        ${t('fiche.affixesLus')}</p><table>${apports}</table>` : ''}
    ${muets.length ? `<p class="pas" style="font-size:12px;margin-top:8px">
        ${t('fiche.affixesHorsFiche', {
          liste: muets.map((a) => `${a.nom} ${a.niveau}`).join(', ') })}</p>` : ''}
    ${f.restes.length ? `<p class="ko" style="font-size:12px;margin-top:8px">
        ${t('fiche.nonCompris', {
          liste: f.restes.map((r) => `${r[0]} ${r[1]} : ${r[2].join(' / ')}`)
            .join(' — ') })}</p>` : ''}`;

  dessinerSorts(res, classeId, f);
  dessinerComparaison();
}

/* ======================================================================
   COMPÉTENCES

   Les coefficients viennent du wiki, l'Attack vient du build : le produit
   des deux est un vrai chiffre, pas une estimation. Ce que le jeu ne
   publie pas — résistance des monstres, taux de critique — vaut zéro et
   l'écran le dit, plutôt que d'être deviné.
   ====================================================================== */
function cibleCourante(f) {
  const v = ($('sortsCible') || {}).value || 'brut';
  if (v === 'brut') return { defense: 0, resistPhysique: 0, resistMagique: 0 };
  if (v === 'moi') {
    return { defense: f.defense, resistPhysique: f.resistPhysique,
             resistMagique: f.resistMagique };
  }
  return { defense: window.D_DEFENSE_MONSTRE || 705,
           resistPhysique: 0, resistMagique: 0 };
}

/* LA FICHE « SI C'ETAIT L'AUTRE ARME QUI ETAIT EN MAIN ».
 *
 * Seule l'Attaque (et les autres stats brutes de l'objet -- degats
 * physiques/magiques en %) change : les affixes, eux, ne bougent pas,
 * puisque la deuxieme arme est justement construite pour les reproduire
 * (voir choisirSecondeArme). Recalculer toute la fiche avec l'objet
 * substitue reste donc exact sans avoir a deviner quoi ajuster a la main. */
function ficheAvecSecondeArme(res, classeId) {
  if (!res.secondeArme || !res.secondeArme.item) return null;
  const resAlt = { ...res, slotItems: { ...res.slotItems, [SLOT_ARME]: res.secondeArme.item } };
  return window.Fiche.ficheDe(resAlt, classeId, D);
}

function dessinerSorts(res, classeId, f) {
  const boite = $('listeSorts');
  if (!boite || !window.Fiche) return;
  const nomClasse = D.classes[String(classeId)];
  const tous = window.Fiche.competencesDe(nomClasse);
  const arme = ($('arme') || {}).value || '';
  // LA DEUXIEME ARME COMPTE AUSSI COMME « MON ARME » ICI : sinon "Seulement
  // mon arme" cachait ses sorts des qu'on l'activait, alors qu'elle est
  // bien portee et bien jouable.
  const armeSecondaire = (res.secondeArme && $('secondeArmeType'))
    ? $('secondeArmeType').value : null;
  const filtrer = ($('sortsArme') || {}).checked;
  const memeArme = (s) => !arme || !s.arme
    || s.arme.split(' / ').some((a) => a === arme || a === armeSecondaire);
  const liste = filtrer ? tous.filter(memeArme) : tous;
  const cible = cibleCourante(f);
  const f2 = armeSecondaire ? ficheAvecSecondeArme(res, classeId) : null;

  $('sortsAide').textContent = t('sorts.aide', {
    n: tous.length, classe: nomClasse,
    chiffrees: tous.filter((s) => s.coups.length).length,
  });

  // GROUPÉ PAR ÉCOLE, PAS EN VRAC. Le jeu sépare les compétences d'une
  // classe en branches qui ne se jouent pas ensemble : le Sorcerer choisit
  // entre Stardust et Elemental, les autres classes se départagent surtout
  // par l'arme. Les groupes viennent des pages de classe du wiki, pas d'un
  // découpage inventé ici.
  const groupes = new Map();
  for (const s of liste) {
    const cle = s.ecole || s.arme || '—';
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(s);
  }
  boite.innerHTML = '';
  for (const [titre, membres] of groupes) {
    const bloc = document.createElement('details');
    bloc.className = 'ecole';
    // Ouvert par défaut si l'arme du build en fait partie : c'est le groupe
    // qu'on vient consulter. Les autres restent repliés.
    bloc.open = !_ecolesFermees.has(titre);
    const chiffrees = membres.filter((s) => s.coups.length).length;
    bloc.innerHTML = `<summary><b>${echapper(titre)}</b>
      <small>${membres.length} · ${t('sorts.chiffrees', { n: chiffrees })}</small></summary>
      <div class="grilleSorts"></div>`;
    bloc.addEventListener('toggle', () => {
      if (bloc.open) _ecolesFermees.delete(titre); else _ecolesFermees.add(titre);
    });
    boite.appendChild(bloc);
    // CE GROUPE EST-IL CELUI DE LA DEUXIEME ARME ? Seulement s'il lui est
    // PROPRE (le titre est exactement son type, jamais un sort partage
    // "Greatsword / Polearm and Shield" -- pour un sort partage, laquelle
    // des deux armes compterait n'a pas de reponse honnete, donc on garde
    // la principale, comme avant).
    const ficheGroupe = (f2 && titre === armeSecondaire) ? f2 : f;
    remplirGroupe(bloc.querySelector('.grilleSorts'), membres,
                  ficheGroupe, cible, memeArme, res, classeId,
                  ficheGroupe === f2);
  }
  const sortChoisi = liste.find((s) => s.nom === _sortChoisi);
  const ficheDetail = (f2 && sortChoisi
    && (sortChoisi.ecole || sortChoisi.arme) === armeSecondaire) ? f2 : f;
  dessinerDetailSort(sortChoisi, ficheDetail, cible, res, classeId);
}

function remplirGroupe(boite, membres, f, cible, memeArme, res, classeId, secondeArme) {
  for (const s of membres) {
    const b = document.createElement('button');
    b.className = 'sort' + (s.coups.length ? '' : ' muet')
      + (memeArme(s) ? '' : ' autreArme')
      + (_sortChoisi === s.nom ? ' actif' : '');
    const tot = window.Fiche.totalCompetence(s, f, cible, _brancheChoisie);
    b.innerHTML = `
      <span class="icoSort">${s.ic
        ? `<img src="icones_sorts/${s.ic}" alt="" decoding="async">` : '<i></i>'}</span>
      <span class="txtSort">
        <span class="n">${echapper(s.nom)}${
          secondeArme ? ` <small class="pas" title="${t('perso.secondeArmeNote')}">(${t('equip.secondeArme')})</small>` : ''}</span>
        <span class="d">${s.coups.length ? nb(tot.degats) : t('sorts.sansDegats')}</span>
        <span class="m">${[
          s.energie != null ? `${nb(s.energie, 1)} ${t('sorts.energie')}` : '',
          s.cd != null ? `${nb(s.cd, 0)} s` : ''].filter(Boolean).join(' · ')}</span>
      </span>`;
    b.onclick = () => {
      _sortChoisi = (_sortChoisi === s.nom) ? null : s.nom;
      _brancheChoisie = 0;
      dessinerSorts(res, classeId, f);
    };
    boite.appendChild(b);
  }
}

/* LES TALENTS QUI TOUCHENT CE SORT.
 *
 * Ils ne sont PAS comptés dans les dégâts affichés, et c'est dit. Les
 * appliquer demanderait de simuler la sélection en jeu : on sait qu'on
 * dispose de 8 points au niveau 12 et que les branches s'ouvrent à des
 * niveaux différents, mais ni les prérequis ni les exclusivités exactes ne
 * sont documentés. Un simulateur bâti là-dessus aurait l'air officiel sans
 * l'être — on montre donc les talents et leurs valeurs, et on laisse le
 * joueur faire le calcul qu'il est le seul à pouvoir faire juste. */
function tableauTalents(s) {
  const par = window.D_TALENTS_PAR_SORT || {};
  const tous = window.D_TALENTS || [];
  const slug = (s.url || '').replace(/\/$/, '').split('/').pop();
  const noms = par[slug] || [];
  if (!noms.length) return '';
  const fiches = noms
    .map((n) => tous.find((t) => t.nom === n && t.classe === s.classe)
             || tous.find((t) => t.nom === n))
    .filter(Boolean);
  if (!fiches.length) return '';
  return `<details class="talentsSort" open>
    <summary>${t('talent.titre', { n: fiches.length })}</summary>
    <div class="corpsTal">
      <p class="pas" style="font-size:11.5px;margin:0 0 8px">${t('talent.horsCalcul')}</p>
      ${fiches.map((x) => `<div class="tal">
        <div class="talTete"><b>${echapper(x.nom)}</b>
          ${x.branche ? `<span class="jeton">${echapper(x.branche)}</span>` : ''}
          ${x.niveau ? `<span class="jeton">${t('talent.niveau', { n: x.niveau })}</span>` : ''}
        </div>
        ${x.desc ? `<div class="talDesc">${echapper(x.desc)}</div>` : ''}
        ${x.effets.length ? `<table>${x.effets.map(([k, v]) =>
          `<tr><td>${echapper(k)}</td><td class="n">${echapper(v)}</td></tr>`)
          .join('')}</table>` : ''}
      </div>`).join('')}
    </div>
  </details>`;
}

function dessinerDetailSort(s, f, cible, res, classeId) {
  const boite = $('detailSort');
  if (!boite) return;
  if (!s) { boite.innerHTML = ''; return; }
  // La description d'abord : c'est ce qu'on lit avant les chiffres.
  const description = s.desc
    ? `<p class="descSort">${echapper(s.desc)}</p>` : '';
  const entete = `<div class="teteSort">
    <span class="grandeIco">${s.ic
      ? `<img src="icones_sorts/${s.ic}" alt="" decoding="async">` : '<i></i>'}</span>
    <div>
      <h3>${echapper(s.nom)}</h3>
      <div class="jetons">
        ${s.arme ? `<span class="jeton">${echapper(s.arme)}</span>` : ''}
        ${s.energie != null ? `<span class="jeton">${nb(s.energie, 1)} ${t('sorts.energie')}</span>` : ''}
        ${s.cd != null ? `<span class="jeton">${nb(s.cd, 0)} s</span>` : ''}
      </div>
    </div>
  </div>`;
  // TOUT CE QU'ON A, MEME SANS COEFFICIENT. Une compétence sans dégâts
  // publiés garde son cooldown, son coût, ses effets et sa durée
  // d'animation : les cacher parce qu'il manque UN chiffre reviendrait à
  // perdre les quatre autres.
  const tableauEffets = () => {
    const l = [];
    if (s.cd != null) l.push([t('sorts.cooldown'), `${nb(s.cd, 0)} s`]);
    if (s.energie != null) l.push([t('sorts.coutEnergie'), nb(s.energie, 1)]);
    if (s.anim != null) l.push([t('sorts.animation'), `${nb(s.anim, 2)} s`]);
    for (const [k, v] of (s.effets || [])) l.push([echapper(k), echapper(v)]);
    if (!l.length) return '';
    return `<table style="margin-top:10px">${l.map(([k, v]) =>
      `<tr><td>${k}</td><td class="n">${v}</td></tr>`).join('')}</table>`;
  };

  if (!s.coups.length) {
    // Un sort sans dégâts publiés a quand même ses talents : les cacher
    // aurait privé de talents la moitié des soins et des déplacements.
    boite.innerHTML = entete + description
      + `<p class="pas">${t('sorts.riendePublie')}</p>`
      + tableauEffets() + tableauTalents(s);
    return;
  }

  // Une frappe suit UNE branche : on la choisit, on ne les additionne pas.
  let branches = '';
  if (s.branches.length) {
    branches = `<div class="branches">${s.branches.map((b, i) =>
      `<button class="${i === _brancheChoisie ? 'actif' : ''}" data-b="${i}">
        ${t('sorts.branche', { n: i + 1, coups: b.coups.length })}</button>`)
      .join('')}</div>
      <p class="pas" style="font-size:12px">${t('sorts.brancheAide')}</p>`;
  }

  const dansBranche = s.branches.length
    ? new Set(s.branches[_brancheChoisie].coups) : null;
  const lignes = s.coups.map((c) => {
    const d = window.Fiche.degatsDuCoup(c.coef, c.type || 'physical', f, cible);
    const dedans = !dansBranche || dansBranche.has(c.nom);
    return `<tr style="${dedans ? '' : 'opacity:.35'}">
      <td>${c.nom}${dedans ? '' : ' <span class="pas">' + t('sorts.horsBranche') + '</span>'}</td>
      <td class="n">${c.coef.toFixed(6)}</td>
      <td>${t('sorts.type.' + (c.type || 'physical'))}</td>
      <td class="n">${nb(d.brut)}</td>
      <td class="n">${nb(d.final)}</td>
      <td class="n">${c.tough != null ? nb(c.tough, 1) : '—'}</td>
      <td class="n">${c.fen || '—'}</td></tr>`;
  }).join('');

  const tot = window.Fiche.totalCompetence(s, f, cible, _brancheChoisie);
  const dps = (s.cd || s.anim)
    ? tot.degats / Math.max(s.cd || 0, s.anim || 0) : null;

  boite.innerHTML = entete + `
    ${description}
    ${branches}
    <table>
      <tr><th>${t('sorts.coup')}</th><th class="n">${t('sorts.coef')}</th>
          <th>${t('sorts.typeCol')}</th><th class="n">${t('sorts.brut')}</th>
          <th class="n">${t('sorts.subis')}</th>
          <th class="n">${t('sorts.tough')}</th>
          <th class="n">${t('sorts.fenetre')}</th></tr>
      ${lignes}
      <tr class="tot"><td>${t('sorts.total')}</td>
        <td class="n">${tot.coef.toFixed(6)}</td><td></td>
        <td class="n">${nb(tot.brut)}</td><td class="n">${nb(tot.degats)}</td>
        <td class="n">${nb(tot.tough, 1)}</td><td></td></tr>
    </table>
    <p class="pas" style="font-size:12px;margin-top:8px">
      ${t('sorts.calcul', { att: nb(f.attaque),
        red: pc(Math.max(window.Fiche.reductionDefense(cible.defense) - f.penetration, 0)),
        // Le bonus qui s'applique dépend du TYPE de la compétence : afficher
        // le bonus physique sous un sort magique ferait mentir la ligne.
        bonus: pc(((s.coups[0] || {}).type === 'magical')
                  ? f.bonusMagique : f.bonusPhysique) })}
      ${dps ? ' · ' + t('sorts.dps', { n: nb(dps, 1) }) : ''}
    </p>
    ${tableauEffets()}
    ${tableauTalents(s)}`;

  for (const b of boite.querySelectorAll('.branches button')) {
    b.onclick = () => {
      _brancheChoisie = Number(b.dataset.b);
      dessinerSorts(res, classeId, f);
    };
  }
}



/* ======================================================================
   COMPARER DEUX BUILDS

   « Le mien ou celui-là ? » est la question qu'on se pose vraiment. On met
   les deux fiches côte à côte et on montre l'ÉCART, pas deux colonnes de
   chiffres à soustraire de tête.

   Les deux builds sont rejoués par le même moteur, depuis leur code
   d'import : on compare ce qui serait réellement porté, pas ce qui était
   visé.
   ====================================================================== */
let _comparer = null;   // le build mis de côté par le bouton « Comparer »
let _cmpA = '';         // nom d'un build enregistré, ou '' = le mis de côté
let _cmpB = '';         // nom d'un build enregistré, ou '' = le build courant

// LE BUILD ACTUELLEMENT CHARGÉ, POUR LE BOUTON « ÉCRASER ». Posé quand on
// charge une carte depuis « Mes builds » ou qu'on vient d'enregistrer sous
// ce nom ; vidé si on efface les cibles ou si ce build précis est
// supprimé. Rien à voir avec la comparaison (_cmpA/_cmpB) : ça peut
// pointer vers un build qui n'est même pas affiché en ce moment.
let _buildCharge = '';
function majBoutonEcraser() {
  const bouton = $('ecraserBuild');
  if (!bouton) return;
  bouton.hidden = !_buildCharge;
  if (_buildCharge) {
    bouton.textContent = t('builds.ecraser', { nom: _buildCharge });
    bouton.title = bouton.textContent;
  }
}

function etatDepuisCode(code, classe, arme) {
  const lu = decoderCode(code.trim());
  const parId = new Map();
  for (const pool of Object.values(D.objets)) for (const it of pool) parId.set(it.id, it);
  const slotItems = {};
  const sockets = [];
  const couvert = {};
  for (const e of lu.emplacements) {
    const slot = D.codec.versGameData[String(e.slot)];
    if (!slot || !e.cfg) continue;
    const it = parId.get(String(e.cfg));
    if (!it) continue;
    slotItems[slot] = it;
    if (it.i) couvert[it.i] = (couvert[it.i] || 0) + 1;
    (e.gemmes || []).forEach((gid, idx) => {
      const g = gid ? gemParId.get(String(gid)) : null;
      const sk = (it.s || [])[idx] || [0, 1];
      sockets.push({ slot, index: idx, type: sk[0], level: sk[1], gem: g || null });
      if (g) for (const a of g.a) couvert[a] = (couvert[a] || 0) + 1;
    });
  }
  return { slotItems, sockets, couvert, vinPoints: new Map(),
           classe: lu.classe, arme };
}

/* Un côté de la comparaison, rejoué depuis son code d'import.
   `choix` vide veut dire « pas un build enregistré » : c'est alors le
   repli qui décide — le build mis de côté à gauche, le build courant à
   droite. C'est ce qui permet aux deux usages de coexister sans que le
   second casse le premier. */
function coteComparaison(choix, repli) {
  if (choix) {
    const b = biblio().find((x) => x.nom === choix);
    if (!b) return null;
    const code = b.code || (b.etat && b.etat.k);
    if (!code || !b.etat) return null;
    try {
      const etat = etatDepuisCode(code, b.etat.c, b.etat.a);
      // LE VIN DOIT REVENIR AVEC LE BUILD. Le code d'import ne porte que le
      // stuff : un build visé à Valor 5 dont le vin apporte 2 points est
      // gravé « Valor 3 » sur les pièces. Sans cette ligne la comparaison
      // affichait 3 et le joueur ne reconnaissait pas son propre build.
      // L'état sauvegardé garde la case cochée et l'allocation manuelle :
      // on rejoue la même répartition, on ne la devine pas.
      etat.vinPoints = b.etat.v
        ? repartitionVin(b.etat.t || [], new Map(b.etat.w || []))
        : new Map();
      return { nom: b.nom, classe: b.etat.c, etat };
    } catch (e) { return null; }
  }
  return repli();
}

/* La liste déroulante d'un côté : les builds enregistrés, plus l'entrée
   par défaut de ce côté-là. Sans build enregistré, le sélecteur ne sert à
   rien et n'est pas affiché. */
function optionsComparaison(choix, libelleDefaut) {
  const l = biblio();
  if (!l.length) return '';
  const opts = [`<option value=""${choix ? '' : ' selected'}>${
    echapper(libelleDefaut)}</option>`];
  for (const b of l) {
    opts.push(`<option value="${echapper(b.nom)}"${
      b.nom === choix ? ' selected' : ''}>${echapper(b.nom)}</option>`);
  }
  return opts.join('');
}

function dessinerComparaison() {
  const carte = $('carteComparer');
  if (!carte) return;

  const A = coteComparaison(_cmpA, () => {
    if (!_comparer) return null;
    try {
      const etat = etatDepuisCode(_comparer.code, _comparer.classe,
                                  _comparer.arme);
      etat.vinPoints = _comparer.vinPoints || new Map();
      return { nom: _comparer.nom || t('cmp.miseDeCote'),
               classe: _comparer.classe, etat };
    } catch (e) { return null; }
  });
  const B = coteComparaison(_cmpB, () => (dernier
    ? { nom: t('cmp.courant'), classe: Number($('classe').value), etat: dernier }
    : null));

  if (!A || !B) { carte.hidden = true; return; }

  const gauche = A.etat;
  const droite = B.etat;
  const classeG = A.classe;
  const classeD = B.classe;
  const fg = window.Fiche.ficheDe(gauche, classeG, D);
  const fd = window.Fiche.ficheDe(droite, classeD, D);

  const LIGNES = [
    ['fiche.attaque', (f) => f.attaque, 0],
    ['fiche.defense', (f) => f.defense, 0],
    ['fiche.vie', (f) => f.vie, 0],
    ['fiche.ehpPhys', (f) => f.ehpPhysique, 0],
    ['fiche.ehpMag', (f) => f.ehpMagique, 0],
    ['fiche.degPhys', (f) => f.bonusPhysique, 1],
    ['fiche.degMag', (f) => f.bonusMagique, 1],
    ['fiche.resPhys', (f) => f.resistPhysique, 1],
    ['fiche.resMag', (f) => f.resistMagique, 1],
    ['fiche.penetration', (f) => f.penetration, 1],
  ];
  const lignes = LIGNES.map(([cle, prendre, pct]) => {
    const a = prendre(fg); const b = prendre(fd);
    const d = b - a;
    // Un écart nul se dit « = » : un « +0 » se lit comme un gain.
    const signe = Math.abs(d) < (pct ? 0.0005 : 0.5) ? 'nul' : (d > 0 ? 'plus' : 'moins');
    const fmt = (x) => (pct ? pc(x) : nb(x));
    const ecart = signe === 'nul' ? '=' : (d > 0 ? '+' : '−') + fmt(Math.abs(d));
    return `<tr><td>${t(cle)}</td><td class="n">${fmt(a)}</td>
      <td class="n">${fmt(b)}</td>
      <td class="n ec ${signe}">${ecart}</td></tr>`;
  }).join('');

  // Les affixes obtenus des deux côtés, réunis.
  const noms = [...new Set([...Object.keys(gauche.couvert),
                            ...Object.keys(droite.couvert)])].sort();
  const aff = noms.map((n) => {
    const va = (gauche.vinPoints && gauche.vinPoints.get(n)) || 0;
    const a = Math.min(plafond(n), (gauche.couvert[n] || 0) + va);
    const vd = (droite.vinPoints && droite.vinPoints.get(n)) || 0;
    const b = Math.min(plafond(n), (droite.couvert[n] || 0) + vd);
    if (!a && !b) return '';
    const d = b - a;
    const signe = d === 0 ? 'nul' : (d > 0 ? 'plus' : 'moins');
    return `<tr><td><span class="avecPastille">${
      pastille(n)}${libelleAffixe(n)}</span></td>
      <td class="n">${a || '—'}</td><td class="n">${b || '—'}</td>
      <td class="n ec ${signe}">${d === 0 ? '=' : (d > 0 ? '+' : '−') + Math.abs(d)}</td></tr>`;
  }).join('');

  const rarG = sommeRaretes(gauche.slotItems);
  const rarD = sommeRaretes(droite.slotItems);
  const optA = optionsComparaison(_cmpA, t('cmp.miseDeCote'));
  const optB = optionsComparaison(_cmpB, t('cmp.courant'));
  carte.hidden = false;
  $('comparaison').innerHTML = `
    <div class="cmpTete">
      <div><span class="cmpQui">A</span> ${echapper(A.nom)}
        <small>${D.classes[String(classeG)] || ''} · ${nb(rarG)} ${t('cmp.crans')}</small></div>
      <div><span class="cmpQui b">B</span> ${echapper(B.nom)}
        <small>${D.classes[String(classeD)] || ''} · ${nb(rarD)} ${t('cmp.crans')}</small></div>
      <button id="cmpVider">${t('cmp.vider')}</button>
    </div>
    ${optA ? `<div class="cmpChoix">
      <label><span class="cmpQui">A</span>
        <select id="cmpSelA">${optA}</select></label>
      <label><span class="cmpQui b">B</span>
        <select id="cmpSelB">${optB}</select></label>
    </div>` : ''}
    <table class="cmp"><tr><th>${t('fiche.stat')}</th><th class="n">A</th>
      <th class="n">B</th><th class="n">${t('cmp.ecart')}</th></tr>${lignes}</table>
    <table class="cmp" style="margin-top:10px"><tr><th>${t('table.affixe')}</th>
      <th class="n">A</th><th class="n">B</th><th class="n">${t('cmp.ecart')}</th></tr>
      ${aff}</table>`;
  $('cmpVider').onclick = () => {
    _comparer = null; _cmpA = ''; _cmpB = ''; dessinerComparaison();
  };
  if ($('cmpSelA')) {
    $('cmpSelA').onchange = (e) => { _cmpA = e.target.value; dessinerComparaison(); };
    $('cmpSelB').onchange = (e) => { _cmpB = e.target.value; dessinerComparaison(); };
  }
}

/* Mettre le build courant « de côté » : c'est le A de la comparaison. */
function mettreDeCote() {
  const code = $('code').value;
  if (!code || !dernier) return;
  // Un build sans nom garde `null` et non le libellé traduit : figer le
  // texte ici le laisserait en français après un changement de langue.
  _comparer = { code, nom: ($('nomBuild').value || '').trim() || null,
                classe: Number($('classe').value), arme: $('arme').value || null,
                // Le vin du build posé, capturé tel qu'il était calculé : le
                // code d'import ne le transporte pas.
                vinPoints: dernier.vinPoints || new Map() };
  // Poser un build de côté rend forcément A au build posé, sinon le bouton
  // n'aurait aucun effet visible après un choix dans la liste.
  _cmpA = '';
  dessinerComparaison();
  $('etat').innerHTML += ` <span class="pas">${t('cmp.pose')}</span>`;
}

/* ======================================================================
   COMMUNAUTÉ

   Une page, trois vues. Les identifiants des anciennes pages sont
   conservés : tout le code qui pilotait la galerie et les guides continue
   de fonctionner tel quel, il ne change que de contenant.
   ====================================================================== */
const CLASSE_IMAGE = {
  10: 'mercenary', 11: 'sorcerer', 12: 'blackarrow',
  13: 'shadowstrix', 14: 'seer', 15: 'withered-knight',
};

function montrerVue(id) {
  for (const v of document.querySelectorAll('#pageCommunaute .vue')) {
    v.hidden = v.id !== id;
  }
  for (const b of document.querySelectorAll('#sousOnglets button')) {
    b.classList.toggle('actif', b.dataset.vue === id);
  }
  if (id === 'vuePublics' && !_galerieChargee) {
    _galerieChargee = true;
    chargerGalerie(0);
  }
  if (id === 'vueGuides' && !_guidesCharges) {
    _guidesCharges = true;
    chargerGuides(0);
    chargerMesGuides();
  }
}

/* Les builds, groupés par classe, avec l'illustration du jeu. Ils vivent
   dans un fichier et non en base : ils doivent s'afficher sans compte et
   même si Supabase est injoignable. */
function dessinerBuildsClasses() {
  const boite = $('listeReference');
  if (!boite || !window.D_BUILDS) return;
  const langue = (window.I18N && I18N.courante()) || 'fr';
  const SRC = window.D_SOURCES || {};
  const parClasse = new Map();
  for (const b of window.D_BUILDS) {
    if (!parClasse.has(b.c)) parClasse.set(b.c, []);
    parClasse.get(b.c).push(b);
  }
  boite.innerHTML = '';
  for (const [classe, liste] of [...parClasse.entries()].sort((a, b) => a[0] - b[0])) {
    const bloc = document.createElement('div');
    bloc.className = 'classeBloc';
    const img = CLASSE_IMAGE[classe];
    bloc.innerHTML = `<div class="classeTete">
        ${img ? `<img src="icones_classes/${img}.webp" alt=""
             loading="lazy" decoding="async">` : ''}
        <div><h3>${D.classes[String(classe)] || classe}</h3>
          <small>${[...new Set(liste.map((b) => b.a))].join(' · ')}
            — ${t('ref.combien', { n: liste.length })}</small></div>
      </div>
      <div class="refGrille"></div>`;
    const grille = bloc.querySelector('.refGrille');
    for (const b of liste) {
      const nom = (b.nom && (b.nom[langue] || b.nom.fr)) || b.k;
      const desc = (b.d && (b.d[langue] || b.d.fr)) || '';
      // LA SOURCE EST AFFICHÉE, PAS SOUS-ENTENDUE. Ces builds viennent de
      // guides publiés : le lecteur doit pouvoir aller vérifier lui-même,
      // et voir quand deux guides ne disent pas la même chose.
      const src = SRC[b.src];
      const carte = document.createElement('div');
      carte.className = 'refCarte';
      carte.innerHTML = `<h4>${echapper(nom)}</h4>
        <div class="meta">
          <span class="puce">${echapper(b.a)}</span>
          <span class="puce">${echapper(b.r)}</span>
          ${b.t.map(([n, l]) => `<span class="puce">${n} ${l}</span>`).join('')}
        </div>
        <div class="quoi">${echapper(desc)}</div>
        ${src ? `<div class="refSource">${t('ref.dapres')}
          <a href="${echapper(b.url)}" target="_blank"
             rel="noopener noreferrer nofollow">${echapper(src.nom)}</a></div>` : ''}
        <div class="actions">
          <button class="refCharger">${t('gal.charger')}</button>
          <button class="refCode">${t('gal.code')}</button>
          <button class="refCopier">${t('gal.copier')}</button>
        </div>`;
      const etiquette = `${D.classes[String(b.c)] || ''} — ${nom}`;
      const etat = { k: b.code, c: b.c, a: b.a, g: null, v: true, m: false,
                     pa: false, pg: 6, ps: [], t: b.t, w: [] };
      carte.querySelector('.refCharger').onclick = () => {
        appliquerEtat(etat);
        restituer({ nom: etiquette, etat, code: b.code });
        montrerPage('main');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      carte.querySelector('.refCode').onclick = (ev) => {
        copierTexte(b.code, ev.target, t('gal.codeCopie'), t('gal.code'));
      };
      carte.querySelector('.refCopier').onclick = () => {
        const l = biblio();
        const n2 = l.some((x) => x.nom === etiquette) ? `${etiquette} (copie)` : etiquette;
        l.push({ nom: n2, etat, code: b.code, pub: false, ami: false });
        if (!ecrireBiblio(l)) return;
        dessinerBuilds();
        $('noteGalerie').innerHTML =
          `<span class="pas">${tH('partage.copieOk', { nom: n2 })}</span>`;
      };
      grille.appendChild(carte);
    }
    boite.appendChild(bloc);
  }
}

/* Une fiche par classe, écrite à partir des données récoltées. Elles vivent
   dans un fichier, comme les builds : ni compte ni réseau pour les lire.
   Elles se replient et ne s'ouvrent qu'à la demande — six pavés dépliés
   feraient une page illisible. */
function dessinerGuidesClasses() {
  const boite = $('guidesClasses');
  if (!boite || !window.D_GUIDES_CLASSES) return;
  const langue = (window.I18N && I18N.courante()) || 'fr';
  const ouverts = new Set();
  for (const d of boite.querySelectorAll('details')) {
    if (d.open) ouverts.add(d.dataset.k);
  }
  boite.innerHTML = '';
  for (const g of window.D_GUIDES_CLASSES) {
    const el = document.createElement('details');
    el.className = 'guide';
    el.dataset.k = g.k;
    el.open = ouverts.has(g.k);
    const img = CLASSE_IMAGE[g.c];
    const titre = g.titre[langue] || g.titre.fr;
    const nb = (window.D_BUILDS || []).filter((b) => b.c === g.c).length;
    el.innerHTML = `<summary>
        ${img ? `<img class="vignetteClasse" src="icones_classes/${img}.webp"
                      alt="" decoding="async" loading="lazy">` : ''}
        <b>${echapper(titre)}</b>
        <small>${echapper(D.classes[String(g.c)] || '')}${
          nb ? ' · ' + t('ref.combien', { n: nb }) : ''}</small>
      </summary>
      <div class="corpsGuide">${rendreGuide(g.corps[langue] || g.corps.fr)}</div>`;
    boite.appendChild(el);
  }
}

/* ======================================================================
   GUIDES

   Mêmes règles que les builds : rien n'est visible tant que l'auteur ne
   coche pas, et la liste ne transporte jamais le corps des guides.
   ====================================================================== */
let _guidesCharges = false;
const GU_PAR_PAGE = 20;
const guEtat = { page: 0, total: 0, classe: '', recherche: '' };

/* Un balisage minuscule et volontairement pauvre : titres, puces,
   paragraphes. Accepter du HTML dans un texte écrit par un inconnu et
   affiché à tout le monde serait une faille, pas une fonctionnalité. */
function rendreGuide(texte) {
  const lignes = String(texte || '').split(/\r?\n/);
  const sortie = [];
  let liste = false;
  const fermer = () => { if (liste) { sortie.push('</ul>'); liste = false; } };
  // On échappe D'ABORD, on met en gras ENSUITE : l'étoile n'est jamais
  // produite par l'échappement, donc aucun texte ne peut fabriquer une
  // balise en se faisant passer pour du gras.
  const ligne = (s) => echapper(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const brute of lignes) {
    const l = brute.trim();
    if (!l) { fermer(); continue; }
    if (l.startsWith('#')) {
      fermer();
      sortie.push(`<h4>${ligne(l.replace(/^#+\s*/, ''))}</h4>`);
    } else if (l.startsWith('-') || (l.startsWith('*') && !l.startsWith('**'))) {
      if (!liste) { sortie.push('<ul>'); liste = true; }
      sortie.push(`<li>${ligne(l.slice(1).trim())}</li>`);
    } else {
      fermer();
      sortie.push(`<p>${ligne(l)}</p>`);
    }
  }
  fermer();
  return sortie.join('');
}

async function chargerGuides(page) {
  const boite = $('listeGuides');
  const note = $('noteGuides');
  if (!comptesDispo() || !boite) return;
  if (typeof page === 'number') guEtat.page = Math.max(0, page);
  note.innerHTML = `<span class="pas">${t('partage.chargement')}</span>`;
  try {
    const r = await window.Comptes.guidesPublics({
      limite: GU_PAR_PAGE,
      decalage: guEtat.page * GU_PAR_PAGE,
      classe: guEtat.classe === '' ? null : Number(guEtat.classe),
      recherche: guEtat.recherche,
    });
    guEtat.total = r.total;
    boite.innerHTML = '';
    for (const g of r.lignes) boite.appendChild(carteGuide(g));
    dessinerPages($('guPages'), guEtat, GU_PAR_PAGE, chargerGuides);
    note.innerHTML = r.lignes.length ? ''
      : `<span class="pas">${t('guide.vide')}</span>`;
  } catch (e) {
    note.innerHTML = `<span class="ko">${tH('partage.ko', { message: e.message })}</span>`;
  }
}

function carteGuide(g) {
  const el = document.createElement('details');
  el.className = 'guide';
  const cl = g.classe != null ? (D.classes[String(g.classe)] || '') : '';
  el.innerHTML = `<summary>
      <b>${echapper(g.titre)}</b>
      <small>${[cl, g.auteur ? t('gal.par') + ' ' + echapper(g.auteur)
        : t('gal.anonyme'),
        g.maj ? new Date(g.maj).toLocaleDateString() : ''
      ].filter(Boolean).join(' · ')}</small>
    </summary>
    <div class="corpsGuide"><span class="pas">${t('partage.chargement')}</span></div>`;
  let charge = false;
  el.addEventListener('toggle', async () => {
    // Le corps ne descend qu'à l'ouverture : une liste de vingt guides
    // ferait sinon voyager des dizaines de milliers de caractères.
    if (!el.open || charge) return;
    charge = true;
    const corps = el.querySelector('.corpsGuide');
    try {
      const plein = await window.Comptes.guideComplet(g.id);
      corps.innerHTML = plein ? rendreGuide(plein.corps)
        : `<span class="pas">${t('guide.introuvable')}</span>`;
    } catch (e) {
      charge = false;
      corps.innerHTML = `<span class="ko">${echapper(e.message)}</span>`;
    }
  });
  return el;
}

async function chargerMesGuides() {
  const bloc = $('blocEcrireGuide');
  if (!bloc) return;
  const ouvert = comptesDispo() && window.Comptes.connecte();
  bloc.hidden = !ouvert;
  if (!ouvert) return;
  try {
    const liste = await window.Comptes.mesGuides();
    const boite = $('mesGuides');
    boite.innerHTML = liste.length
      ? `<div class="pas" style="font-size:12px;margin-bottom:6px">${t('guide.mes')}</div>`
      : '';
    for (const g of liste) {
      const el = document.createElement('div');
      el.className = 'buildDistant';
      el.innerHTML = `<div class="bd"><b>${echapper(g.titre)}</b>
          <small>${g.public ? t('guide.estPublic') : t('guide.brouillon')}
            · ${g.corps.length} ${t('guide.signes')}</small></div>
        <button class="gEdit">${t('guide.modifier')}</button>
        <button class="gSuppr">×</button>`;
      el.querySelector('.gEdit').onclick = () => {
        $('guideTitre').value = g.titre;
        $('guideClasse').value = g.classe == null ? '' : String(g.classe);
        $('guideCorps').value = g.corps;
        $('guidePublic').checked = !!g.public;
        $('guideTitre').scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      el.querySelector('.gSuppr').onclick = async () => {
        await window.Comptes.supprimerGuide(g.id).catch(() => {});
        chargerMesGuides();
        chargerGuides(0);
      };
      boite.appendChild(el);
    }
  } catch (e) {
    $('noteGuide').innerHTML = `<span class="ko">${echapper(e.message)}</span>`;
  }
}

async function enregistrerGuide() {
  const note = $('noteGuide');
  const titre = ($('guideTitre').value || '').trim();
  const corps = ($('guideCorps').value || '').trim();
  if (titre.length < 3) {
    note.innerHTML = `<span class="ko">${t('guide.titreCourt')}</span>`; return;
  }
  if (corps.length < 20) {
    note.innerHTML = `<span class="ko">${t('guide.corpsCourt')}</span>`; return;
  }
  note.innerHTML = `<span class="pas">…</span>`;
  try {
    const cl = $('guideClasse').value;
    await window.Comptes.enregistrerGuide({
      titre, corps, classe: cl === '' ? null : Number(cl),
      public: $('guidePublic').checked,
    });
    note.innerHTML = `<span class="ok">${t('guide.enregistre')}</span>`;
    chargerMesGuides();
    chargerGuides(0);
  } catch (e) {
    // L'index unique de la table refuse deux guides de même titre pour un
    // même auteur : c'est une règle, pas une panne. On le dit comme telle
    // plutôt que de recracher l'erreur Postgres.
    note.innerHTML = /duplicate|unique|23505/i.test(e.message)
      ? `<span class="ko">${t('guide.titrePris')}</span>`
      : `<span class="ko">${tH('partage.ko', { message: e.message })}</span>`;
  }
}

/* ------------------------------------------------- CE QUE COUTE UN PALIER
 *
 * Le site marque les paliers d'un point orange depuis toujours, sans jamais
 * dire ce qu'ils coutent. Le joueur pose cinq cibles, lit « 8 x Epic », et
 * ignore laquelle des cinq a fait monter tout le build d'un cran. Pour le
 * savoir il devait baisser une cible a la main, recalculer, comparer,
 * remonter, recommencer — cinq fois. Personne ne le faisait.
 *
 * LE CALCUL : un appel de plus au moteur par cible, ce seul affixe descendu
 * d'un cran. L'ecart de rarete entre les deux builds EST le prix du dernier
 * pas. Ce n'est pas une estimation, c'est une soustraction.
 *
 * CHAQUE LIGNE SE LIT PRISE SEULE. Si Valor coute 5 crans et Aegis 1,
 * baisser les deux n'en economise pas forcement 6 : ils partagent peut-etre
 * la meme piece. Meme regle que dans la Marge de manoeuvre, meme mention a
 * l'ecran.
 *
 * ET ÇA SE PAIE. Un calcul coute 16 ms en rarete unique — invisible — mais
 * jusqu'a 1,4 s en panache, ou cinq cibles feraient sept secondes de page
 * figee. On decoupe donc comme le balayage de la Marge : une cible par
 * tranche, la main rendue entre chaque.
 */
let _cout = null;

function arreterCout() {
  if (_cout) { _cout.stop = true; _cout = null; }
}

function lancerCoutPaliers(res, classe, arme) {
  arreterCout();
  const table = $('tableauAffixes');
  if (!table || !res || !res.slotItems || !cibles.size) return;
  // Sans panachage il n'y a rien a mesurer : voir le commentaire du tableau.
  if (!$('mixte').checked) return;
  const jeton = { stop: false };
  _cout = jeton;

  const base = sommeRaretes(res.slotItems);
  const cibleBase = [...cibles.entries()];
  const grade = $('rarete').value ? Number($('rarete').value) : null;
  const vin = $('vin').checked;
  const mixte = $('mixte').checked;
  const planchers = planchersActuels();
  const saveurs = saveursActuelles();
  const aFaire = cibleBase.filter(([, niveau]) => niveau > 0);
  let i = 0;

  const tranche = () => {
    if (jeton.stop) return;
    if (i >= aFaire.length) { if (_cout === jeton) _cout = null; return; }
    const [nom, niveau] = aFaire[i]; i += 1;
    const cell = table.querySelector(`[data-cout="${CSS.escape(nom)}"]`);
    try {
      // Le meme build, cet affixe seul descendu d'un cran. En dessous de 1,
      // la cible disparait : c'est bien « ne pas la demander du tout ».
      const moins = cibleBase
        .map(([x, l]) => (x === nom ? [x, l - 1] : [x, l]))
        .filter(([, l]) => l > 0);
      const r = moins.length
        ? construire(classe, arme, moins, grade, vin, mixte, planchers,
                     vinManuel, verrousObjet(), saveurs)
        : null;
      const gain = r && r.suffisant ? base - sommeRaretes(r.slotItems) : null;
      if (cell) {
        if (gain === null) {
          cell.innerHTML = `<span class="pas">—</span>`;
        } else if (gain <= 0) {
          // Gratuit : le stuff l'apporte de toute façon.
          cell.innerHTML = `<span class="coutNul">${t('cout.gratuit')}</span>`;
        } else {
          const fort = gain >= 3 ? ' coutFort' : '';
          cell.innerHTML = `<b class="coutN${fort}">${gain}</b>`;
          cell.title = t('cout.detail', { n: gain, nom: libelleAffixe(nom), niveau });
        }
      }
    } catch (e) {
      if (cell) cell.innerHTML = `<span class="pas">—</span>`;
    }
    setTimeout(tranche, 0);
  };
  setTimeout(tranche, 0);
}

/* ------------------------------------------------------------ LA CARTE ---
 *
 * Dessinee, pas recopiee. Les points viennent de l'atlas du jeu, dans son
 * systeme 0-10 000 ; le SVG les replace tels quels. Les REGIONS, elles, ne
 * sont pas connues : on n'a que des nuages de points. Chacune est donc
 * figuree par une ellipse posee au barycentre de ses points, dimensionnee
 * sur leur dispersion. C'est juste dans les positions relatives, et honnete
 * sur le reste — ça dit ou aller, pas ou poser le pied.
 */
const CARTE_TYPES = ['sortie', 'faille', 'marchand', 'passage', 'ferry'];
let _carteActive = 'Brandrgarde';
let _carteFiltre = new Set(CARTE_TYPES);

/* DES TERRITOIRES, PAS DES BULLES.
 *
 * La premiere version posait une ellipse autour des points de chaque region :
 * ça se chevauchait, ça laissait du vide entre les zones, et le resultat
 * ressemblait a un nuage de points plutot qu'a une carte.
 *
 * On PARTAGE le terrain a la place. Chaque parcelle revient a la region dont
 * le point connu est le plus proche — un decoupage de Voronoi, calcule sur
 * les memes coordonnees reelles. Les territoires sont contigus, sans trou ni
 * recouvrement, et leur forme decoule de la repartition reelle des points.
 *
 * Ça reste une approximation, pour la meme raison qu'avant : on connait des
 * points, pas des frontieres. Mais une approximation qui ressemble a une
 * carte se lit, la ou huit ellipses superposees ne se lisent pas.
 */
const CARTE_GRILLE = 110;   // parcelles par cote

function territoires(pts, echelle) {
  const noms = [...new Set(pts.map((p) => p[1]))];
  const idx = new Map(noms.map((n, i) => [n, i]));
  const pas = echelle / CARTE_GRILLE;
  const grille = new Int16Array(CARTE_GRILLE * CARTE_GRILLE);
  for (let gy = 0; gy < CARTE_GRILLE; gy += 1) {
    const cy = (gy + 0.5) * pas;
    for (let gx = 0; gx < CARTE_GRILLE; gx += 1) {
      const cx = (gx + 0.5) * pas;
      let meilleur = 0;
      let dist = Infinity;
      for (const [, region, x, y] of pts) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 < dist) { dist = d2; meilleur = idx.get(region); }
      }
      grille[gy * CARTE_GRILLE + gx] = meilleur;
    }
  }
  // Chaque region devient une suite de bandes horizontales : quelques
  // centaines de rectangles au total, au lieu de 12 100 parcelles.
  const zones = noms.map((n) => ({ nom: n, bandes: [], cx: 0, cy: 0, aire: 0 }));
  for (let gy = 0; gy < CARTE_GRILLE; gy += 1) {
    let debut = 0;
    for (let gx = 1; gx <= CARTE_GRILLE; gx += 1) {
      const courant = grille[gy * CARTE_GRILLE + debut];
      const ici = gx < CARTE_GRILLE ? grille[gy * CARTE_GRILLE + gx] : -2;
      if (ici === courant) continue;
      zones[courant].bandes.push([debut * pas, gy * pas, (gx - debut) * pas, pas]);
      debut = gx;
    }
  }
  // L'etiquette se pose au centre de gravite du TERRITOIRE, pas des points :
  // c'est la qu'elle tombe dans la zone, meme si celle-ci est allongee.
  for (const z of zones) {
    let sx = 0; let sy = 0; let a = 0;
    for (const [x, y, w, h] of z.bandes) {
      const aire = w * h;
      sx += (x + w / 2) * aire; sy += (y + h / 2) * aire; a += aire;
    }
    if (a) { z.cx = sx / a; z.cy = sy / a; z.aire = a; }
  }
  return zones.filter((z) => z.aire > 0);
}

function dessinerCarte(zonesVisees, zonesDeduites) {
  const boite = $('carteZone');
  const C = self.D_CARTES;
  if (!boite || !C) return;
  const tous = C.cartes[_carteActive] || [];
  const pts = tous.filter((p) => _carteFiltre.has(p[0]));
  const zones = territoires(tous, C.echelle);
  const vises = new Set(zonesVisees || []);
  const deduites = new Set(zonesDeduites || []);

  const terrains = zones.map((z, i) => {
    const ici = vises.has(z.nom);
    const ded = !ici && deduites.has(z.nom);
    const rects = z.bandes.map(([x, y, w, h]) =>
      `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${Math.ceil(w)}" height="${Math.ceil(h)}"></rect>`).join('');
    return `<g class="cz czT${i % 8}${ici ? ' czIci' : ''}${ded ? ' czDeduit' : ''}"><title>${echapper(z.nom)}</title>${rects}</g>`;
  }).join('');

  const noms = zones.map((z) =>
    `<text class="czNom" x="${z.cx.toFixed(0)}" y="${z.cy.toFixed(0)}" text-anchor="middle" dominant-baseline="middle">${echapper(z.nom)}</text>`).join('');

  const marques = pts.map(([type, region, x, y]) => {
    const ici = vises.has(region) || deduites.has(region);
    return `<circle class="cp cp-${type}${ici ? ' cpIci' : ''}" cx="${x}" cy="${y}" r="82"><title>${echapper(t('carte.' + type) + ' — ' + region)}</title></circle>`;
  }).join('');

  boite.innerHTML = `<svg viewBox="0 0 ${C.echelle} ${C.echelle}"
      preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${echapper(_carteActive)}">
      <g class="cTerrains">${terrains}</g>${noms}${marques}
    </svg>`;
}

function dessinerLegendeCarte() {
  const l = $('carteLegende');
  const C = self.D_CARTES;
  if (!l || !C) return;
  const dispo = new Set((C.cartes[_carteActive] || []).map((p) => p[0]));
  l.innerHTML = CARTE_TYPES.filter((x) => dispo.has(x)).map((x) => {
    const n = (C.cartes[_carteActive] || []).filter((p) => p[0] === x).length;
    return `<button class="cLeg cp-${x}${_carteFiltre.has(x) ? ' actif' : ''}"
        data-type="${x}"><i></i>${t('carte.' + x)} <b>${n}</b></button>`;
  }).join('');
  for (const b of l.querySelectorAll('.cLeg')) {
    b.onclick = () => {
      const x = b.dataset.type;
      if (_carteFiltre.has(x)) _carteFiltre.delete(x); else _carteFiltre.add(x);
      dessinerLegendeCarte();
      dessinerCarte(_carteZones, _carteDeduites);
    };
  }
}

let _carteZones = [];
let _carteDeduites = [];

function brancherCarte() {
  const onglets = $('carteOnglets');
  if (!onglets || !self.D_CARTES) return;
  onglets.innerHTML = Object.keys(self.D_CARTES.cartes).map((m) =>
    `<button data-m="${echapper(m)}"${m === _carteActive ? ' class="actif"' : ''}
      >${echapper(m)}</button>`).join('');
  for (const b of onglets.querySelectorAll('button')) {
    b.onclick = () => {
      _carteActive = b.dataset.m;
      for (const x of onglets.querySelectorAll('button')) {
        x.classList.toggle('actif', x === b);
      }
      dessinerLegendeCarte();
      dessinerCarte(_carteZones, _carteDeduites);
    };
  }
  const note = $('carteNote');
  if (note) {
    note.innerHTML = t('carte.note') + ' '
      + (self.D_CARTES.src || []).map((u, i) =>
          `<a href="${echapper(u)}" target="_blank"
              rel="noopener noreferrer nofollow">${i + 1}</a>`).join(' · ');
  }
  dessinerLegendeCarte();
  dessinerCarte([]);
}

/* Cliquer un objet situe deplace la carte sur SA carte et allume ses zones. */
function viserSurCarte(prov) {
  if (!self.D_CARTES || !prov) return;
  const c = (prov.cartes || [])[0];
  if (!c) return;
  if (self.D_CARTES.cartes[c.m]) {
    _carteActive = c.m;
    const onglets = $('carteOnglets');
    if (onglets) {
      for (const x of onglets.querySelectorAll('button')) {
        x.classList.toggle('actif', x.dataset.m === c.m);
      }
    }
  }
  _carteZones = (prov.cartes || []).flatMap((x) => x.z || []);
  _carteDeduites = (prov.cartes || []).flatMap((x) => x.deduites || []);
  dessinerLegendeCarte();
  dessinerCarte(_carteZones, _carteDeduites);
  const boite = $('carteBloc');
  if (boite) boite.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ------------------------------------------------------- LES RESSOURCES --
 *
 * 530 objets consommables, materiaux, contenants, munitions — jusqu'au tier
 * Holy. Ils vivent dans `ressources.js`, 104 Ko qui ne sont JAMAIS charges
 * tant que personne n'ouvre cette vue : un `<script>` injecte a la demande,
 * une seule fois.
 *
 * Ce que les donnees du jeu contiennent : le nom, la categorie, le tier de
 * rarete, l'icone, et A QUOI L'OBJET SERT. Ce qu'elles ne contiennent pas :
 * ou il se ramasse. D'ou le meme « ? » que pour l'equipement.
 */
const RES_PAR_PAGE = 60;
const resEtat = { page: 0, total: 0 };
let _resCharge = null;

function chargerRessources() {
  if (_resCharge) return _resCharge;
  _resCharge = new Promise((ok, ko) => {
    if (self.D_RESSOURCES) { ok(self.D_RESSOURCES); return; }
    /* Le meme numero de version que le reste, sinon ce fichier resterait en
       cache indefiniment : bump.py reecrit tous les `?v=` d'index.html, on
       relit donc celui d'app.js plutot que d'inventer une constante que
       personne ne penserait a incrementer. */
    const moi = document.querySelector('script[src^="app.js"]');
    const v = ((moi && moi.getAttribute('src').match(/\?v=(\d+)/)) || [])[1] || '1';
    const charge = (nom) => new Promise((o2, k2) => {
      const sc = document.createElement('script');
      sc.src = nom + '?v=' + v;
      sc.onload = o2;
      sc.onerror = () => k2(new Error(nom));
      document.head.appendChild(sc);
    });
    // Les provenances sont facultatives : leur absence ne doit pas empecher
    // le catalogue de s'afficher.
    charge('ressources.js')
      .then(() => Promise.all([charge('provenances.js').catch(() => {}),
                               charge('cartes.js').catch(() => {})]))
      .then(() => ok(self.D_RESSOURCES || []))
      .catch(ko);
  });
  return _resCharge;
}

let _resUniq = null;

/* La base porte des doublons — Celestigold y figure deux fois, Golden Coffer
   sept. Ce sont des identifiants distincts pour un meme objet aux yeux du
   joueur : on n'en affiche qu'un. */
function ressourcesUniques() {
  if (_resUniq) return _resUniq;
  const vus = new Map();
  for (const o of (self.D_RESSOURCES || [])) {
    const cle = o.n + '|' + o.c + '|' + o.g;
    if (!vus.has(cle)) vus.set(cle, o);
  }
  // Ceux dont on sait ou ils se ramassent d'abord : c'est l'interet de la page.
  _resUniq = [...vus.values()].sort((a, b) =>
    (provenanceDe(b.n) ? 1 : 0) - (provenanceDe(a.n) ? 1 : 0)
    || b.g - a.g || a.n.localeCompare(b.n));
  return _resUniq;
}

function resFiltres() {
  const liste = ressourcesUniques();
  const q = ($('resRecherche').value || '').trim().toLowerCase();
  const c = $('resCat').value;
  const g = $('resTier').value;
  const su = $('resSu') && $('resSu').checked;
  return liste.filter((o) => {
    if (su && !provenanceDe(o.n)) return false;
    if (c && o.c !== c) return false;
    if (g !== '' && String(o.g) !== g) return false;
    if (!q) return true;
    return o.n.toLowerCase().includes(q)
        || (o.u && o.u.t.toLowerCase().includes(q));
  });
}

/* L'usage est du texte du jeu, avec son propre balisage <Emphasize>. Il a ete
   decoupe a la generation en { t: texte plat, f: [passages mis en avant] } :
   la page n'interprete donc jamais de balisage venu d'ailleurs, elle se
   contente de rehausser des morceaux qu'elle retrouve dans son propre texte. */
function usageEnHtml(u) {
  if (!u) return '';
  let html = echapper(u.t);
  for (const f of (u.f || [])) {
    if (!f) continue;
    html = html.replace(echapper(f), `<b>${echapper(f)}</b>`);
  }
  return html;
}

/* La provenance, quand on la connait. `provenances.js` voyage avec
   `ressources.js` : deux fichiers, un seul chargement differe. */
function provenanceDe(nom) {
  const P = self.D_PROVENANCES;
  if (!P) return null;
  return (P.objets || []).find((x) => x.n === nom) || null;
}

/* LE PLAN DES ZONES.
 *
 * Ce n'est pas la carte du jeu : je n'en ai pas la geographie, et la
 * dessiner de memoire reviendrait a l'inventer. C'est un plan des ZONES
 * CONNUES, ou s'allument celles qui concernent l'objet survole. Ça repond a
 * la seule question qu'on se pose vraiment — ou est-ce que je vais ? — sans
 * pretendre a une precision qu'on n'a pas. */
function planDesZones(prov) {
  const P = self.D_PROVENANCES || {};
  const dedans = new Map();
  for (const c of (prov.cartes || [])) dedans.set(c.m, new Set(c.z || []));
  const cartes = Object.entries(P.cartes || {}).map(([m, zones]) => {
    const vises = dedans.get(m);
    const actif = vises ? ' plActif' : '';
    return `<div class="plCarte${actif}">
        <h5>${echapper(m)}</h5>
        <div class="plZones">${zones.map((z) => {
          const ici = vises && vises.has(z);
          return `<span class="plZone${ici ? ' ici' : ''}">${echapper(z)}</span>`;
        }).join('')}</div>
      </div>`;
  }).join('');
  const noeuds = (prov.noeuds || []).length
    ? `<div class="plNoeuds"><span class="plTitre">${t('prov.noeuds')}</span>
        ${prov.noeuds.map((n) => `<em>${echapper(n)}</em>`).join('')}</div>` : '';
  const lg = (window.I18N && I18N.courante()) || 'fr';
  const texte = prov.note && (typeof prov.note === 'string'
    ? prov.note : (prov.note[lg] || prov.note.en || prov.note.fr));
  const note = texte ? `<p class="plNote">${echapper(texte)}</p>` : '';
  const src = (prov.src || []).length
    ? `<p class="plSrc">${t('prov.sources')} ${prov.src.map((u, i) =>
        `<a href="${echapper(u)}" target="_blank"
            rel="noopener noreferrer nofollow">${i + 1}</a>`).join(' · ')}</p>` : '';
  return `<div class="plan">${cartes}${noeuds}${note}${src}</div>`;
}

function carteRessource(o) {
  const el = document.createElement('div');
  el.className = 'objCarte';
  const coul = D.couleurs[String(o.g)] || 'var(--bord)';
  el.style.borderLeftColor = coul;
  el.innerHTML = `
    ${o.ic ? `<img src="icones_objets/${echapper(o.ic)}" alt=""
                   loading="lazy" decoding="async">`
           : '<span class="objSansIcone" aria-hidden="true"></span>'}
    <div class="objTxt">
      <span class="objNom">${echapper(o.n)}</span>
      <span class="objMeta"><span class="objTier" style="color:${coul}">${
        echapper(D.raretes[String(o.g)] || t('res.sansTier'))}</span
        ><span class="objCat">${echapper(t('res.cat.' + o.c) || o.c)}</span></span>
      ${o.u ? `<span class="objUsage">${usageEnHtml(o.u)}</span>` : ''}
    </div>
    <span class="objOu" title="${echapper(t('obj.ouInconnu'))}">?</span>`;

  const prov = provenanceDe(o.n);
  if (prov) {
    const marque = el.querySelector('.objOu');
    marque.className = 'objOu objSu';
    marque.textContent = '◉';
    marque.title = t('prov.voir');
    const plan = document.createElement('div');
    plan.className = 'planBoite';
    plan.innerHTML = planDesZones(prov);
    el.appendChild(plan);
    // Au survol ET au clic : la souris pour aller vite, le clic pour le
    // tactile, ou survoler n'existe pas.
    marque.onclick = (ev) => {
      ev.stopPropagation();
      el.classList.toggle('ouvert');
      viserSurCarte(prov);
    };
  }
  return el;
}

function dessinerRessources(page) {
  const boite = $('resGrille');
  if (!boite) return;
  if (typeof page === 'number') resEtat.page = page;
  const liste = resFiltres();
  resEtat.total = liste.length;
  if (resEtat.page * RES_PAR_PAGE >= liste.length) resEtat.page = 0;
  const tranche = liste.slice(resEtat.page * RES_PAR_PAGE,
                              resEtat.page * RES_PAR_PAGE + RES_PAR_PAGE);
  boite.innerHTML = '';
  if (!tranche.length) {
    boite.innerHTML = `<div class="objVide">${t('obj.rien')}</div>`;
  } else {
    const f = document.createDocumentFragment();
    for (const o of tranche) f.appendChild(carteRessource(o));
    boite.appendChild(f);
  }
  $('resCompte').textContent = t('obj.compte', { n: liste.length });
  if ($('resNote')) {
    const su = (self.D_PROVENANCES && self.D_PROVENANCES.objets || []).length;
    $('resNote').innerHTML = `<b>◉</b> ${t('prov.note', { n: su })}`;
  }
  dessinerPages($('resPages'), resEtat, RES_PAR_PAGE, dessinerRessources);
}

/* UNE RARETE PAR EMPLACEMENT.
   Huit lignes, « auto » partout par defaut : l'utilisateur ne subit rien
   tant qu'il ne demande rien. Les libelles suivent la langue, d'ou le
   passage par cette fonction a chaque changement. */
function poserRaretesParPiece() {
  const boite = $('plancherSlots');
  if (!boite || !D) return;
  const avant = {};
  for (const sel of boite.querySelectorAll('select')) avant[sel.dataset.slot] = sel.value;
  boite.innerHTML = '';
  for (const slot of D.ordreSlots) {
    const l = document.createElement('label');
    const nom = document.createElement('span');
    nom.textContent = D.nomsSlots[slot] || slot;
    const sel = document.createElement('select');
    sel.dataset.slot = slot;
    l.appendChild(nom);
    l.appendChild(sel);
    boite.appendChild(l);
    remplirSelect(sel,
      [['', t('perso.auto')]].concat(
        [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]])),
      avant[slot] || '');
    sel.onchange = () => { if (cibles.size) calculer(); };
  }
}

function poserBrews() {
  if (!$('brew')) return;
  remplirSelect($('brew'), BREWS.map((b) => [b.id,
    `${b.nom} — ${t('vin.regle', { n: b.total, p: b.parAffixe })}`]), _brew);
}

/* CHOISIR RING, NECKLACE, GAUNTLETS ET BOOTS, SANS OBLIGATION.
 *
 * « Auto » (par défaut) laisse le moteur choisir comme aujourd'hui — rien ne
 * change pour qui n'y touche pas. Un choix ne fait que PRÉFÉRER cette
 * déclinaison pendant la recherche ; il n'empêche jamais la pièce d'être
 * changée après coup sur le paperdoll (la flèche déroulante de Ring/Necklace
 * continue de montrer TOUTES les options, saveur comprise — voir
 * alternatives()).
 *
 * Deux jeux d'options, pas un seul : Ring/Necklace varient sur stat ET
 * élément (quatre choix), Gauntlets/Boots ne varient que sur l'élément
 * (deux choix) — voir le commentaire au-dessus de `saveurDe`. */
const SAVEURS_PIECE = [
  ['atk-phys', 'saveur.atkPhys'],
  ['atk-mag', 'saveur.atkMag'],
  ['hp-phys', 'saveur.hpPhys'],
  ['hp-mag', 'saveur.hpMag'],
];
const SAVEURS_ELEMENT = [
  ['phys', 'saveur.phys'],
  ['mag', 'saveur.mag'],
];

function optionsSaveur(slot) {
  return SLOTS_SAVEUR_ELEMENT.includes(slot) ? SAVEURS_ELEMENT : SAVEURS_PIECE;
}

function poserSaveurs() {
  const boite = $('saveurSlots');
  if (!boite || !D) return;
  const avant = {};
  for (const sel of boite.querySelectorAll('select')) avant[sel.dataset.slot] = sel.value;
  boite.innerHTML = '';
  for (const slot of SLOTS_SAVEUR) {
    const l = document.createElement('label');
    const nom = document.createElement('span');
    nom.textContent = D.nomsSlots[slot] || slot;
    const sel = document.createElement('select');
    sel.dataset.slot = slot;
    l.appendChild(nom);
    l.appendChild(sel);
    boite.appendChild(l);
    remplirSelect(sel,
      [['', t('perso.auto')]].concat(optionsSaveur(slot).map(([cle, libelle]) => [cle, t(libelle)])),
      avant[slot] || '');
    // PAS DE RECALCUL AUTOMATIQUE. Comme les niveaux d'affixe visés (les
    // boutons de la grille ne relancent rien non plus) : ce menu note une
    // intention, elle ne prend effet qu'au prochain clic sur « Calculer ».
    // Le déclencher ici rejouait toute la cascade qui suit un calcul —
    // suggestions, pièces interchangeables, fiche de personnage, coût par
    // palier — à chaque changement d'option, plusieurs secondes perçues
    // comme un blocage pour un simple choix dans un menu déroulant.
  }
}

function saveursActuelles() {
  const s = {};
  for (const sel of document.querySelectorAll('#saveurSlots select')) {
    if (sel.value) s[sel.dataset.slot] = sel.value;
  }
  return s;
}

/* LE BADGE SUR LE PAPERDOLL : LE MÊME MOT QUE LE SÉLECTEUR AURAIT MONTRÉ.
 * Dit quelle déclinaison la pièce EN JEU porte réellement, qu'elle vienne
 * d'un choix explicite ou de l'auto — sans avoir à ouvrir un menu pour le
 * savoir. `null` pour un emplacement sans variance (Weapon excepté, voir
 * plus haut) ou une pièce trop basse pour porter la déclinaison élémentaire. */
function libelleSaveur(slot, it) {
  if (!SLOTS_SAVEUR.includes(slot)) return null;
  const cle = descripteurSaveur(slot, it);
  const entree = optionsSaveur(slot).find(([c]) => c === cle);
  return entree ? t(entree[1]) : null;
}

function poserFiltresRessources() {
  if (!$('resCat') || !D) return;
  const cats = [...new Set(ressourcesUniques().map((o) => o.c))].sort();
  remplirSelect($('resCat'),
    [['', t('res.toutesCat')]].concat(cats.map((c) => [c, t('res.cat.' + c) || c])),
    $('resCat').value);
  const tiers = [...new Set(ressourcesUniques().map((o) => o.g))]
    .sort((a, b) => b - a);
  remplirSelect($('resTier'),
    [['', t('res.tousTiers')]].concat(
      tiers.map((g) => [String(g), D.raretes[String(g)] || t('res.sansTier')])),
    $('resTier').value);
}

async function ouvrirRessources() {
  const boite = $('resGrille');
  if (!boite) return;
  if (!self.D_RESSOURCES) {
    boite.innerHTML = `<div class="objVide">${t('res.chargement')}</div>`;
    try { await chargerRessources(); } catch (e) {
      boite.innerHTML = `<div class="objVide">${t('res.chargeKo')}</div>`;
      return;
    }
    poserFiltresRessources();
    brancherCarte();
    const relire = () => dessinerRessources(0);
    $('resRecherche').oninput = relire;
    $('resCat').onchange = relire;
    $('resTier').onchange = relire;
    if ($('resSu')) $('resSu').onchange = relire;
  }
  dessinerRessources();
}

function montrerPage(id) {
  for (const el of document.querySelectorAll('main, .page')) {
    el.hidden = (id === 'main') ? (el.tagName !== 'MAIN') : (el.id !== id);
  }
  // La fiche vit dans la colonne de droite, donc <main> la cache déjà quand
  // on quitte l'onglet Builder -- mais elle a SA PROPRE condition en plus :
  // ne rien montrer tant qu'aucun build n'a été calculé, même sur l'onglet
  // Builder. La boucle ci-dessus ne sait pas faire ce second cas.
  const fiche = $('blocFiche');
  if (fiche) fiche.hidden = (id !== 'main') || !dernier;
  for (const b of document.querySelectorAll('#nav button')) {
    b.classList.toggle('actif', b.dataset.page === id);
  }
  // Le catalogue ne se dessine qu'ici : c'est ce qui garantit qu'il ne
  // coute rien tant qu'on reste sur le Builder.
  if (id === 'pageObjets') ouvrirRessources();
  if (id === 'pageButin') ouvrirButin();
  if (id === 'pageCarte') ouvrirCarte();
  if (id === 'pageCraft') ouvrirCraft();
  if (id === 'pageMeca') ouvrirMeca();
  if (id === 'pageCommunaute') {
    dessinerBuildsClasses();
    dessinerGuidesClasses();
    // La vue active garde sa place d'une visite à l'autre ; au premier
    // passage c'est la référence, qui a toujours du contenu.
    const active = document.querySelector('#pageCommunaute .vue:not([hidden])');
    montrerVue(active ? active.id : 'vueReference');
  }
  window.scrollTo({ top: 0 });
}

const BUTIN_PAR_PAGE = 60;
const butinEtat = { page: 0, total: 0 };
let _butinIndex = null;

/* L'ORDRE D'AFFICHAGE DES CATEGORIES, PAS L'ORDRE ALPHABETIQUE : les
   ressources d'artisanat et les objets d'esprit sont ce qui interesse le
   plus (farming), l'equipement le moins (on le trouve deja en jouant) --
   voir tools/recolter_loot.py pour comment D_LOOT_CAT est calcule. */
const BUTIN_CATEGORIES = ['ressources', 'esprit', 'cles', 'autres', 'items'];

/* Un objet peut venir de plusieurs coffres ET de plusieurs monstres, a
   des chances differentes selon la source : on aplatit D_LOOT (coffres,
   pourcentage fixe) et D_LOOT_MOBS (monstres, fourchette selon le mode)
   en une seule liste par NOM d'objet, chaque source deja mise en forme
   pour l'affichage -- pas de branchement par type au moment de dessiner. */
function indexButin() {
  if (_butinIndex) return _butinIndex;
  const parNom = new Map();
  const decroche = (nom, rarete) => {
    if (!parNom.has(nom)) {
      const cat = (self.D_LOOT_CAT || {})[nom] || 'autres';
      const chemin = (self.D_LOOT_ICONES || {})[nom] || null;
      parNom.set(nom, { nom, rarete, categorie: cat, sources: [], chemin, usage: null });
    }
    return parNom.get(nom);
  };
  for (const table of (self.D_LOOT || [])) {
    for (const l of table.loot) {
      decroche(l.nom, l.rarete).sources.push({
        cat: 'coffres', noms: table.conteneurs,
        label: table.conteneurs.join(' / '), valeur: `${l.part}%`, tauxMax: l.part,
      });
    }
  }
  for (const table of (self.D_LOOT_MOBS || [])) {
    for (const l of table.loot) {
      decroche(l.nom, l.rarete).sources.push({
        cat: 'monstres', noms: table.monstres,
        label: table.monstres.join(' / '), valeur: formaterTaux(l.taux),
        tauxMax: maxDeTaux(l.taux), long: true,
      });
    }
  }
  // LE CATALOGUE DE RESSOURCES (ressources.js, charge a part -- voir
  // ouvrirButin) AJOUTE deux choses que les tables de butin n'ont pas :
  // l'usage ("sert a...") et, pour ~70 objets, l'existence meme -- des
  // ressources connues qui ne sortent d'aucune table de butin publiee
  // (ramassage au sol, artisanat) auraient sinon disparu de la fusion.
  for (const o of (self.D_RESSOURCES || [])) {
    const fiche = decroche(o.n, D.raretes[String(o.g)] || null);
    if (!fiche.chemin && o.ic) fiche.chemin = 'icones_objets/' + o.ic;
    if (o.u) fiche.usage = o.u;
  }
  _butinIndex = [...parNom.values()].sort((a, b) => {
    const oa = BUTIN_CATEGORIES.indexOf(a.categorie);
    const ob = BUTIN_CATEGORIES.indexOf(b.categorie);
    return oa !== ob ? oa - ob : a.nom.localeCompare(b.nom);
  });
  return _butinIndex;
}

function raretVersGrade(nom) {
  for (const [g, n] of Object.entries(D.raretes)) if (n === nom) return g;
  return null;
}

function butinFiltres() {
  const q = ($('butinRecherche').value || '').trim().toLowerCase();
  const liste = indexButin();
  if (!q) return liste;
  return liste.filter((o) => o.nom.toLowerCase().includes(q));
}

function carteButin(o) {
  const el = document.createElement('div');
  el.className = 'objCarte';
  const coul = D.couleurs[raretVersGrade(o.rarete)] || 'var(--bord)';
  el.style.borderLeftColor = coul;
  // DU PLUS PROBABLE AU MOINS PROBABLE : sans ce tri, l'ordre venait de
  // celui des tables sur le wiki, sans rapport avec la chance reelle --
  // la meilleure source pouvait finir en bas de la liste.
  const parTaux = [...o.sources].sort((a, b) => b.tauxMax - a.tauxMax);
  // `s.valeur` est soit un simple nombre+% (coffres, intrinsequement sans
  // danger), soit deja echappe par formaterTaux (monstres, qui coud lui-
  // meme les libelles d'intensite) -- l'echapper ICI le double-echapperait.
  // SUR LA CARTE OU PAS : une source dont aucun des noms n'existe sur une
  // zone connue de D_MAPS (mob generique jamais releve, etc.) ne peut mener
  // nulle part -- elle reste une ligne d'info, pas un lien mort.
  const surCarte = (s) => (self.D_MAPS || []).some(
    (z) => (z[s.cat] || []).some((g) => s.noms.includes(g.nom)));
  const sources = parTaux.map((s, i) => `
    <div class="butinSource${s.long ? ' long' : ''}${surCarte(s) ? ' cliquable' : ''}"
         data-idx="${i}" ${surCarte(s) ? `title="${echapper(t('carte.voirSur'))}"` : ''}>
      <span class="butinConteneurs">${echapper(s.label)}</span>
      <span class="butinChance">${s.valeur}</span>
    </div>`).join('');
  el.innerHTML = `
    ${o.chemin ? `<img src="${echapper(o.chemin)}" alt=""
                       loading="lazy" decoding="async">`
                : '<span class="objSansIcone" aria-hidden="true"></span>'}
    <div class="objTxt">
      <span class="objNom">${echapper(o.nom)}</span>
      <span class="objMeta"><span class="objTier" style="color:${coul}">${echapper(o.rarete || '?')}</span></span>
      ${o.usage ? `<span class="objUsage">${usageEnHtml(o.usage)}</span>` : ''}
      <div class="butinSources">${sources || `<div class="pas" style="font-size:11px">${t('butin.aucuneSource')}</div>`}</div>
    </div>`;
  // UNE SOURCE CLIQUEE OUVRE LA CARTE DESSUS, PAS BESOIN DE LA RECHERCHER
  // A LA MAIN : "Où farmer" dit qu'un objet tombe ici, "Carte" montre où
  // "ici" se trouve -- la boucle se ferme comme pour Artisanat -> Où farmer.
  el.querySelectorAll('.butinSource.cliquable').forEach((div) => {
    div.onclick = () => allerVersCarteSource(o, parTaux[Number(div.dataset.idx)]);
  });
  return el;
}

function dessinerButin(page) {
  const boite = $('butinGrille');
  if (!boite) return;
  if (typeof page === 'number') butinEtat.page = page;
  const liste = butinFiltres();
  butinEtat.total = liste.length;
  if (butinEtat.page * BUTIN_PAR_PAGE >= liste.length) butinEtat.page = 0;
  const tranche = liste.slice(butinEtat.page * BUTIN_PAR_PAGE,
                               butinEtat.page * BUTIN_PAR_PAGE + BUTIN_PAR_PAGE);
  boite.innerHTML = '';
  if (!tranche.length) {
    boite.innerHTML = `<div class="objVide">${t('obj.rien')}</div>`;
  } else {
    const f = document.createDocumentFragment();
    // UN TITRE QUAND LA CATEGORIE CHANGE, PAS A CHAQUE OBJET : la liste
    // est deja triee par categorie (indexButin), donc un simple "categorie
    // precedente" suffit -- pas besoin de grouper en amont.
    let categoriePrecedente = null;
    for (const o of tranche) {
      if (o.categorie !== categoriePrecedente) {
        categoriePrecedente = o.categorie;
        const titre = document.createElement('div');
        titre.className = 'butinCatTitre';
        titre.textContent = t('butin.cat.' + o.categorie);
        f.appendChild(titre);
      }
      f.appendChild(carteButin(o));
    }
    boite.appendChild(f);
  }
  $('butinCompte').textContent = t('obj.compte', { n: liste.length });
  dessinerPages($('butinPages'), butinEtat, BUTIN_PAR_PAGE, dessinerButin);
}

let _butinBranche = false;
function ouvrirButin() {
  if (!_butinBranche) {
    _butinBranche = true;
    $('butinRecherche').oninput = () => dessinerButin(0);
  }
  dessinerButin();
  // ICONES ET USAGES VIENNENT DE ressources.js, CHARGE A PART (memes
  // fichiers que l'ancien onglet Ressources, fusionne ici) : la page
  // s'affiche tout de suite avec ce qu'on a deja, puis se redessine une
  // fois ressources.js arrive -- jamais d'attente visible, juste un
  // complement discret (icones qui apparaissent, ~70 objets en plus).
  if (!self.D_RESSOURCES) {
    chargerRessources().then(() => {
      _butinIndex = null;
      dessinerButin();
    }).catch(() => {});
  }
}

/* ARTISANAT. L'AUTRE MOITIE DE LA QUESTION : "Ou farmer" dit ou trouver un
 * objet, "Artisanat" dit avec quoi en FABRIQUER un. Un materiau cliquable
 * renvoie vers "Ou farmer" deja rempli avec son nom -- la boucle se ferme
 * sans ressaisir la recherche. */
const CRAFT_PAR_PAGE = 60;
const craftEtat = { page: 0, total: 0 };

function craftFiltres() {
  const liste = self.D_CRAFT || [];
  const q = ($('craftRecherche').value || '').trim().toLowerCase();
  const cat = $('craftCat').value;
  const cls = $('craftClasse').value;
  return liste.filter((r) => {
    if (cat && r.categorie !== cat) return false;
    if (cls && r.classe !== cls) return false;
    if (!q) return true;
    return r.nom.toLowerCase().includes(q)
        || r.materiaux.some((m) => m.toLowerCase().includes(q));
  });
}

function allerVersButin(nom) {
  montrerPage('pageButin');
  $('butinRecherche').value = nom;
  dessinerButin(0);
}

function carteCraft(r) {
  const el = document.createElement('div');
  el.className = 'objCarte';
  const coul = D.couleurs[raretVersGrade(r.rarete)] || 'var(--bord)';
  el.style.borderLeftColor = coul;
  const iconesButin = self.D_LOOT_ICONES || {};
  const materiaux = r.materiaux.map((m) => {
    const chemin = iconesButin[m];
    return `<span class="craftMat" data-nom="${echapper(m)}">
      ${chemin ? `<img src="${echapper(chemin)}" alt="" loading="lazy">` : ''}
      ${echapper(m)}</span>`;
  }).join('');
  el.innerHTML = `
    ${r.icone ? `<img src="${echapper(r.icone)}" alt="" loading="lazy" decoding="async">`
               : '<span class="objSansIcone" aria-hidden="true"></span>'}
    <div class="objTxt">
      <span class="objNom">${echapper(r.nom)}</span>
      <span class="objMeta"><span class="objTier" style="color:${coul}">${echapper(r.rarete)}</span>
        ${r.classe ? `<span class="objCat">${echapper(r.classe)}</span>` : ''}</span>
      <div class="craftInfo">
        <span>${t('craft.atelier', { n: r.atelier })}</span>
        <span><b>${r.or}</b> ${t('craft.or')}</span>
      </div>
      <div class="craftMateriaux">${materiaux}</div>
    </div>`;
  for (const puce of el.querySelectorAll('.craftMat')) {
    puce.onclick = () => allerVersButin(puce.dataset.nom);
  }
  return el;
}

function dessinerCraft(page) {
  const boite = $('craftGrille');
  if (!boite) return;
  if (typeof page === 'number') craftEtat.page = page;
  const liste = craftFiltres();
  craftEtat.total = liste.length;
  if (craftEtat.page * CRAFT_PAR_PAGE >= liste.length) craftEtat.page = 0;
  const tranche = liste.slice(craftEtat.page * CRAFT_PAR_PAGE,
                               craftEtat.page * CRAFT_PAR_PAGE + CRAFT_PAR_PAGE);
  boite.innerHTML = '';
  if (!tranche.length) {
    boite.innerHTML = `<div class="objVide">${t('obj.rien')}</div>`;
  } else {
    const f = document.createDocumentFragment();
    for (const r of tranche) f.appendChild(carteCraft(r));
    boite.appendChild(f);
  }
  $('craftCompte').textContent = t('obj.compte', { n: liste.length });
  dessinerPages($('craftPages'), craftEtat, CRAFT_PAR_PAGE, dessinerCraft);
}

let _craftBranche = false;
function ouvrirCraft() {
  if (!_craftBranche) {
    _craftBranche = true;
    remplirSelect($('craftCat'), [
      ['', t('craft.toutesCat')], ['weapons', t('craft.catArmes')],
      ['armor', t('craft.catArmures')], ['gems', t('craft.catGemmes')]], '');
    const classes = [...new Set((self.D_CRAFT || [])
      .map((r) => r.classe).filter(Boolean))].sort();
    remplirSelect($('craftClasse'),
      [['', t('craft.toutesClasses')]].concat(classes.map((c) => [c, c])), '');
    $('craftRecherche').oninput = () => dessinerCraft(0);
    $('craftCat').onchange = () => dessinerCraft(0);
    $('craftClasse').onchange = () => dessinerCraft(0);
  }
  dessinerCraft();
}

/* MECANIQUES AVANCEES. Purement informatif -- transcrit une fois depuis
 * /mechanics/ du wiki communautaire, pas une donnee qui bouge assez
 * souvent pour justifier un scraper dedie. Seul le tableau solo/trio par
 * arme est construit en JS (deux blocs, meme forme) ; le reste de la
 * page est du balisage statique dans index.html. */
const MECA_ARMES_SOLO = [
  ['Bow', '+10%', '+10%', '0%', '+10%'],
  ['Greatsword', '+18%', '+5%', '+10%', '0%'],
  ['Catalyst', '+18%', '+15%', '0%', '+10%'],
  ['Dagger', '+18%', '-5%', '+10%', '0%'],
  ['Dual Blades', '+18%', '-10%', '+5%', '0%'],
  ['Hammer', '+18%', '+10%', '+15%', '0%'],
  ['Mace', '+18%', '-5%', '0%', '0%'],
  ['Polearm and Shield', '+18%', '+10%', '+10%', '0%'],
  ['Staff', '+12%', '0%', '0%', '+10%'],
  ['Sword and Shield', '+18%', '+10%', '+10%', '0%'],
];
const MECA_ARMES_TRIO = [
  ['Bow', '0%', '0%', '-10%', '0%'],
  ['Greatsword', '0%', '+10%', '+10%', '0%'],
  ['Catalyst', '0%', '0%', '-10%', '0%'],
  ['Dagger', '0%', '+5%', '+10%', '0%'],
  ['Dual Blades', '0%', '0%', '+5%', '0%'],
  ['Hammer', '0%', '+10%', '+15%', '0%'],
  ['Mace', '0%', '0%', '+5%', '0%'],
  ['Polearm and Shield', '0%', '+10%', '+10%', '0%'],
  ['Staff', '0%', '-5%', '0%', '0%'],
  ['Sword and Shield', '0%', '+10%', '+10%', '0%'],
];

let _mecaBranchee = false;
function ouvrirMeca() {
  if (_mecaBranchee) return;
  _mecaBranchee = true;
  const corps = $('mecTableauArmes');
  const ligne = (mode, [arme, pvp, pve, reducPve, tenacite]) => `
    <tr><td>${echapper(arme)}</td><td>${mode}</td><td>${pvp}</td><td>${pve}</td>
      <td>${reducPve}</td><td>${tenacite}</td></tr>`;
  corps.innerHTML =
    `<tr class="butinCatTitre" style="border-bottom:none"><td colspan="6">${t('mec.tbl.solo')}</td></tr>`
    + MECA_ARMES_SOLO.map((l) => ligne(t('mec.tbl.solo'), l)).join('')
    + `<tr class="butinCatTitre" style="border-bottom:none"><td colspan="6">${t('mec.tbl.trio')}</td></tr>`
    + MECA_ARMES_TRIO.map((l) => ligne(t('mec.tbl.trio'), l)).join('');
}

/* CARTE. Vide par defaut : un joueur nous a ecrit que devoir decocher
   toutes les cases avant chaque run genait plus que ca n'aidait -- ici on
   coche ce qu'on veut voir, rien de plus, et on peut sauver la selection
   pour la retrouver la prochaine fois (localStorage, pas de compte). */
const CARTE_CLE_PRESETS = 'mistfallCartePresets';
const CARTE_CATEGORIES = [
  ['coffres', 'var(--accent)', 'carte.coffres'],
  ['monstres', 'var(--ko)', 'carte.monstres'],
  ['pois', 'var(--def)', 'carte.pois'],
];
// `meilleur` : les cles ('cat|nom') de la ou des sources ou l'objet
// cherche a la plus grande chance de tomber -- vide en navigation normale,
// rempli seulement par une recherche d'objet (carteSelectionnerObjet).
const carteEtat = { zone: null, selection: new Set(), meilleur: new Set() };
const carteVue = { x: 0, y: 0, w: 1000, h: 1000 };
let carteGlisseDist = 0;

let _lootParConteneur = null;
function indexLootParConteneur() {
  if (_lootParConteneur) return _lootParConteneur;
  const idx = new Map();
  for (const table of (self.D_LOOT || [])) {
    for (const c of table.conteneurs) idx.set(c, table.loot);
  }
  _lootParConteneur = idx;
  return idx;
}

let _lootParMonstre = null;
function indexLootParMonstre() {
  if (_lootParMonstre) return _lootParMonstre;
  const idx = new Map();
  for (const table of (self.D_LOOT_MOBS || [])) {
    for (const m of table.monstres) idx.set(m, table.loot);
  }
  _lootParMonstre = idx;
  return idx;
}

// L'ORDRE D'AFFICHAGE : Normal, Chaos, Cataclysm d'abord (croissant en
// difficulte), puis tout le reste (garanti, ou le texte brut du wiki
// quand aucune intensite precise n'est identifiable) par ordre alphabetique.
const ORDRE_INTENSITES = ['Normal', 'Chaos', 'Cataclysm'];
function trierIntensites(cles) {
  return [...cles].sort((a, b) => {
    const ia = ORDRE_INTENSITES.indexOf(a);
    const ib = ORDRE_INTENSITES.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}
function maxDeTaux(taux) {
  return Math.max(...Object.values(taux).map(([, mx]) => mx));
}
function formaterTaux(taux) {
  return trierIntensites(Object.keys(taux)).map((cle) => {
    const [mn, mx] = taux[cle];
    const plage = mn === mx ? `${mn}%` : `${mn}–${mx}%`;
    return `${echapper(cle)} ${plage}`;
  }).join(' · ');
}

function carteZoneActuelle() {
  return (self.D_MAPS || []).find((z) => z.slug === carteEtat.zone);
}

function carteListeItems() {
  const z = carteZoneActuelle();
  if (!z) return [];
  const q = ($('carteRecherche').value || '').trim().toLowerCase();
  const items = [];
  for (const [cat] of CARTE_CATEGORIES) {
    for (const groupe of z[cat]) {
      if (q && !groupe.nom.toLowerCase().includes(q)) continue;
      items.push({ cat, nom: groupe.nom, n: groupe.n, points: groupe.points });
    }
  }
  return items;
}

function carteClePresets() {
  try { return JSON.parse(localStorage.getItem(CARTE_CLE_PRESETS)) || []; }
  catch (e) { return []; }
}

function dessinerZonesCarte() {
  const boite = $('carteZones');
  boite.innerHTML = '';
  for (const z of (self.D_MAPS || [])) {
    const b = document.createElement('button');
    b.textContent = z.nom;
    b.className = z.slug === carteEtat.zone ? 'actif' : '';
    b.onclick = () => changerZoneCarte(z.slug);
    boite.appendChild(b);
  }
}

function changerZoneCarte(slug) {
  carteEtat.zone = slug;
  carteEtat.selection.clear();
  if (carteEtat.meilleur.size) {
    carteEtat.meilleur.clear();
    $('carteObjetActif').hidden = true;
    $('carteObjetInput').value = '';
  }
  resetVueCarte();
  dessinerZonesCarte();
  dessinerCarte();
}

/* PAN/ZOOM PAR VIEWBOX : pas de librairie, juste deplacer et retailler le
   cadre visible. `w` et `h` restent toujours egaux (le cadre est carre,
   comme le contenu) pour ne jamais deformer les points. */
function appliquerVueCarte() {
  $('carteSvg').setAttribute('viewBox',
    `${carteVue.x} ${carteVue.y} ${carteVue.w} ${carteVue.h}`);
}
function clamperVueCarte() {
  carteVue.w = Math.min(1000, Math.max(40, carteVue.w));
  carteVue.h = carteVue.w;
  carteVue.x = Math.min(1000 - carteVue.w, Math.max(0, carteVue.x));
  carteVue.y = Math.min(1000 - carteVue.h, Math.max(0, carteVue.y));
}
function resetVueCarte() {
  carteVue.x = 0; carteVue.y = 0; carteVue.w = 1000; carteVue.h = 1000;
  appliquerVueCarte();
}
function zoomerCarte(facteur, px, py) {
  const w2 = carteVue.w * facteur;
  const wc = Math.min(1000, Math.max(40, w2));
  carteVue.x = px - (px - carteVue.x) * (wc / carteVue.w);
  carteVue.y = py - (py - carteVue.y) * (wc / carteVue.h);
  carteVue.w = wc; carteVue.h = wc;
  clamperVueCarte();
  appliquerVueCarte();
}
function cartePointVersSvg(ev, rect) {
  return {
    x: carteVue.x + ((ev.clientX - rect.left) / rect.width) * carteVue.w,
    y: carteVue.y + ((ev.clientY - rect.top) / rect.height) * carteVue.h,
  };
}
function brancherPanZoom() {
  const svg = $('carteSvg');
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = cartePointVersSvg(ev, svg.getBoundingClientRect());
    zoomerCarte(ev.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
  let actif = false;
  let dx0 = 0;
  let dy0 = 0;
  svg.addEventListener('pointerdown', (ev) => {
    actif = true; dx0 = ev.clientX; dy0 = ev.clientY; carteGlisseDist = 0;
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!actif) return;
    const rect = svg.getBoundingClientRect();
    const dxPx = ev.clientX - dx0;
    const dyPx = ev.clientY - dy0;
    carteGlisseDist += Math.abs(dxPx) + Math.abs(dyPx);
    carteVue.x -= (dxPx / rect.width) * carteVue.w;
    carteVue.y -= (dyPx / rect.height) * carteVue.h;
    dx0 = ev.clientX; dy0 = ev.clientY;
    clamperVueCarte();
    appliquerVueCarte();
  });
  const finGlisse = () => { actif = false; };
  svg.addEventListener('pointerup', finGlisse);
  svg.addEventListener('pointerleave', finGlisse);
  $('carteZoomPlus').onclick = () => zoomerCarte(1 / 1.4,
    carteVue.x + carteVue.w / 2, carteVue.y + carteVue.h / 2);
  $('carteZoomMoins').onclick = () => zoomerCarte(1.4,
    carteVue.x + carteVue.w / 2, carteVue.y + carteVue.h / 2);
  $('carteZoomReset').onclick = resetVueCarte;
}

function dessinerListeCarte() {
  const boite = $('carteListe');
  boite.innerHTML = '';
  const items = carteListeItems();
  if (!items.length) {
    boite.innerHTML = `<div class="objVide">${t('obj.rien')}</div>`;
    return;
  }
  const f = document.createDocumentFragment();
  for (const it of items) {
    const cle = it.cat + '|' + it.nom;
    const [, couleur] = CARTE_CATEGORIES.find(([c]) => c === it.cat);
    const l = document.createElement('label');
    l.className = 'carteItem';
    const puce = document.createElement('span');
    puce.className = 'puce';
    puce.style.background = couleur;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = carteEtat.selection.has(cle);
    cb.onchange = () => {
      if (cb.checked) carteEtat.selection.add(cle);
      else carteEtat.selection.delete(cle);
      // Une case cochee/decochee a la main sort du mode "recherche
      // d'objet" : garder une couleur "meilleure source" sans rapport
      // avec ce qu'on regarde maintenant serait trompeur.
      if (carteEtat.meilleur.size) {
        carteEtat.meilleur.clear();
        $('carteObjetActif').hidden = true;
        $('carteObjetInput').value = '';
      }
      dessinerSvgCarte();
    };
    const nom = document.createElement('span');
    nom.className = 'nom';
    nom.textContent = it.nom;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = it.n;
    l.appendChild(cb); l.appendChild(puce); l.appendChild(nom); l.appendChild(n);
    f.appendChild(l);
  }
  boite.innerHTML = '';
  boite.appendChild(f);
}

const NS_SVG = 'http://www.w3.org/2000/svg';
function svgEl(nom, attrs) {
  const el = document.createElementNS(NS_SVG, nom);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

/* UN SEUL clipPath, PARTAGE PAR TOUS LES POINTS "monstre" : decouper une
   icone en rond, pas de raison d'en redefinir un par point. */
function carteDefsClip() {
  const defs = svgEl('defs', {});
  const clip = svgEl('clipPath', { id: 'carteClipRond' });
  clip.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 6 }));
  defs.appendChild(clip);
  return defs;
}

/* LE MARQUEUR D'UN POINT, EN COORDONNEES LOCALES (0,0 = le point lui-meme
 * -- le <g> parent porte deja le `translate`). Trois familles :
 *   - monstre  : la vraie icone du bestiaire (recoltee par
 *     tools/recolter_bestiary_icones.py), sur un fond rond colore ;
 *   - coffre   : un glyphe de coffre simple (meme silhouette pour tous
 *     les types -- il en existe ~150, aucune source ne donne une icone
 *     par type, la rareté/couleur fait deja la distinction utile) ;
 *   - POI      : un losange, pas un rond -- 34 types differents, la
 *     plupart des codes internes sans equivalent visuel evident (ex.
 *     "loose-loot-pack-1001"), la FORME distingue au moins la famille
 *     sans inventer un sens a des codes qu'on ne peut pas verifier.
 * Le contour des glyphes passe par une CLASSE (`carteGlyphe`), pas un
 * attribut `stroke` en JS -- meme raison que pour la couleur de fond. */
function carteMarqueur(it) {
  const frag = document.createDocumentFragment();
  if (it.cat === 'monstres') {
    frag.appendChild(svgEl('circle', { r: 7 }));
    const fichier = (self.D_ICONES_MONSTRES || {})[it.nom];
    if (fichier) {
      const img = svgEl('image', {
        x: -6, y: -6, width: 12, height: 12, 'clip-path': 'url(#carteClipRond)',
      });
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'icones_monstres/' + fichier);
      img.setAttribute('href', 'icones_monstres/' + fichier);
      frag.appendChild(img);
    }
    return frag;
  }
  if (it.cat === 'coffres') {
    frag.appendChild(svgEl('circle', { r: 6 }));
    const corps = svgEl('rect', {
      x: -3.4, y: -2.4, width: 6.8, height: 4.8, rx: 0.7, class: 'carteGlyphe',
    });
    const couvercle = svgEl('line', {
      x1: -3.4, y1: -0.5, x2: 3.4, y2: -0.5, class: 'carteGlyphe',
    });
    frag.appendChild(corps);
    frag.appendChild(couvercle);
    return frag;
  }
  frag.appendChild(svgEl('rect', {
    x: -4.6, y: -4.6, width: 9.2, height: 9.2, rx: 1.3, transform: 'rotate(45)',
  }));
  return frag;
}

function dessinerSvgCarte() {
  const svg = $('carteSvg');
  svg.innerHTML = '';
  const z = carteZoneActuelle();
  if (!z) return;
  // LE VRAI FOND DE CARTE : un rendu du terrain du jeu (meme nature que
  // les icones d'objets/competences deja reprises sur ce site), pas une
  // illustration originale du wiki -- toujours en premier, sous tout le
  // reste. `href` seul suffit aux navigateurs actuels ; `xlink:href` en
  // plus pour les moteurs SVG plus anciens qui ne lisent que lui.
  if (z.image) {
    const img = svgEl('image', { x: 0, y: 0, width: 1000, height: 1000 });
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'maps/' + z.image);
    img.setAttribute('href', 'maps/' + z.image);
    svg.appendChild(img);
  }
  const items = carteListeItems();
  const choisis = items.filter((it) => carteEtat.selection.has(it.cat + '|' + it.nom));

  // RIEN DE COCHE : de petits reperes d'aires, discrets -- la carte est
  // deja lisible par elle-meme, pas besoin de grosses bulles par-dessus.
  if (!choisis.length) {
    for (const a of z.aires) {
      const g = svgEl('g', { class: 'carteAire' });
      g.appendChild(svgEl('circle', { cx: a.pos[0] * 1000, cy: a.pos[1] * 1000, r: 4 }));
      const texte = svgEl('text', { x: a.pos[0] * 1000, y: a.pos[1] * 1000 - 8 });
      texte.textContent = a.nom;
      g.appendChild(texte);
      svg.appendChild(g);
    }
    return;
  }
  svg.appendChild(carteDefsClip());
  for (const it of choisis) {
    for (const p of it.points) {
      // La couleur passe par une CLASSE CSS, pas par un attribut `fill`
      // pose en JS : `var(--accent)` colle dans une regle de style, mais
      // les navigateurs ne le resolvent pas tous depuis un attribut de
      // presentation SVG pose via setAttribute -- le point rendait alors
      // noir, sans erreur, donc sans rien a debugger dans la console.
      const surligne = carteEtat.meilleur.has(it.cat + '|' + it.nom);
      const g = svgEl('g', {
        class: 'cartePoint carteCat-' + it.cat + (surligne ? ' carteMeilleur' : ''),
        transform: `translate(${p[0] * 1000},${p[1] * 1000})`,
      });
      g.appendChild(carteMarqueur(it));
      g.onclick = (ev) => {
        // UN CLIC QUI SUIT UN GLISSEMENT DE CARTE N'EST PAS UN CLIC SUR LE
        // POINT : sans ce garde-fou, relacher le glisser-deposer pile sur
        // un point ouvrait sa fiche au lieu de simplement finir le geste.
        if (carteGlisseDist > 6) return;
        ev.stopPropagation();
        carteInfobulle(ev, it, p[2]);
      };
      // SURVOLER MONTRE DEJA LE DETAIL, PAS BESOIN DE CLIQUER : le clic
      // reste utile au clavier/tactile (rien a survoler), donc les deux
      // cohabitent sans se marcher dessus.
      g.onmouseenter = (ev) => carteInfobulle(ev, it, p[2]);
      g.onmouseleave = () => {
        const bulle = $('carteTooltip');
        if (bulle) bulle.hidden = true;
      };
      svg.appendChild(g);
    }
  }
}

/* LES TAUX DE DROP, DIRECTEMENT SUR LA CARTE. Un coffre porte le meme nom
   ici et dans les tables de butin (loot.js) -- le lien se fait par ce nom,
   sans dupliquer les chiffres nulle part. */
function carteInfobulle(ev, it, aire) {
  let bulle = $('carteTooltip');
  if (!bulle) {
    bulle = document.createElement('div');
    bulle.id = 'carteTooltip';
    $('carteSvg').parentElement.appendChild(bulle);
  }
  let html = `<button type="button" class="tFermer">✕</button>
    <div class="tTitre">${echapper(it.nom)}</div>`;
  if (aire) html += `<div class="tAire">${echapper(aire)}</div>`;
  if (it.cat === 'coffres') {
    const loot = indexLootParConteneur().get(it.nom);
    if (loot && loot.length) {
      const tries = [...loot].sort((a, b) => b.part - a.part);
      html += tries.slice(0, 8).map((l) => {
        const coul = D.couleurs[raretVersGrade(l.rarete)] || 'var(--terne)';
        return `<div class="tLoot"><span style="color:${coul}">${echapper(l.nom)}</span>
          <span class="n">${l.part}%</span></div>`;
      }).join('');
      if (tries.length > 8) {
        html += `<div class="tLoot pas">${t('carte.plusObjets', { n: tries.length - 8 })}</div>`;
      }
    }
  } else if (it.cat === 'monstres') {
    // LE TAUX VARIE SELON LA DIFFICULTE (Normal/Chaos/Cataclysm) : on
    // montre chaque intensite separement plutot qu'une fourchette globale
    // qui masquerait que Cataclysm peut donner 10x plus que Normal (voir
    // tools/recolter_loot.py pour le detail).
    const loot = indexLootParMonstre().get(it.nom);
    if (loot && loot.length) {
      const tries = [...loot].sort((a, b) => maxDeTaux(b.taux) - maxDeTaux(a.taux));
      html += tries.slice(0, 6).map((l) => {
        const coul = D.couleurs[raretVersGrade(l.rarete)] || 'var(--terne)';
        return `<div class="tLoot tLootMob">
          <span style="color:${coul}">${echapper(l.nom)}</span>
          <span class="n">${formaterTaux(l.taux)}</span></div>`;
      }).join('');
      if (tries.length > 6) {
        html += `<div class="tLoot pas">${t('carte.plusObjets', { n: tries.length - 6 })}</div>`;
      }
    }
  }
  bulle.innerHTML = html;
  bulle.querySelector('.tFermer').onclick = () => { bulle.hidden = true; };
  const cadre = $('carteSvg').getBoundingClientRect();
  const gauche = Math.min(ev.clientX - cadre.left + 10, Math.max(0, cadre.width - 250));
  bulle.style.left = gauche + 'px';
  bulle.style.top = (ev.clientY - cadre.top + 10) + 'px';
  bulle.hidden = false;
}

function dessinerPresetsCarte() {
  const boite = $('cartePresetsListe');
  boite.innerHTML = '';
  const presets = carteClePresets();
  for (let i = 0; i < presets.length; i += 1) {
    const p = presets[i];
    const el = document.createElement('span');
    el.className = 'cartePreset';
    const nom = document.createElement('span');
    nom.textContent = p.nom;
    nom.onclick = () => appliquerPresetCarte(p);
    const suppr = document.createElement('button');
    suppr.type = 'button';
    suppr.textContent = '✕';
    suppr.title = t('carte.presetSupprimer');
    suppr.onclick = (ev) => {
      ev.stopPropagation();
      const tous = carteClePresets();
      tous.splice(i, 1);
      localStorage.setItem(CARTE_CLE_PRESETS, JSON.stringify(tous));
      dessinerPresetsCarte();
    };
    el.appendChild(nom); el.appendChild(suppr);
    boite.appendChild(el);
  }
}

function appliquerPresetCarte(p) {
  carteEtat.zone = p.zone;
  carteEtat.selection = new Set(p.selection);
  dessinerZonesCarte();
  dessinerCarte();
}

function sauverPresetCarte() {
  const champ = $('cartePresetNom');
  const nom = (champ.value || '').trim();
  if (!nom || !carteEtat.selection.size) return;
  const presets = carteClePresets();
  presets.push({ nom, zone: carteEtat.zone, selection: [...carteEtat.selection] });
  localStorage.setItem(CARTE_CLE_PRESETS, JSON.stringify(presets));
  champ.value = '';
  dessinerPresetsCarte();
}

/* RECHERCHE D'UN OBJET PRECIS (pas un type de coffre/monstre) : trouve
 * TOUTES ses sources (indexButin, deja croise coffres+monstres), coche
 * automatiquement celles qui existent sur une carte, et retient la ou
 * les sources au taux le plus haut pour les colorer a part. */
function carteObjetsFiltres() {
  const q = ($('carteObjetInput').value || '').trim().toLowerCase();
  if (!q) return [];
  return indexButin().filter((o) => o.nom.toLowerCase().includes(q)).slice(0, 8);
}

function dessinerSuggestionsObjet() {
  const boite = $('carteObjetSuggestions');
  const items = carteObjetsFiltres();
  if (!items.length) { boite.hidden = true; boite.innerHTML = ''; return; }
  boite.innerHTML = '';
  for (const o of items) {
    const meilleure = [...o.sources].sort((a, b) => b.tauxMax - a.tauxMax)[0];
    const chemin = (self.D_LOOT_ICONES || {})[o.nom];
    const el = document.createElement('div');
    el.className = 'carteSuggestion';
    el.innerHTML = `
      ${chemin ? `<img src="${echapper(chemin)}" alt="" loading="lazy">`
                : '<span class="sansIcone"></span>'}
      <span class="nom">${echapper(o.nom)}</span>
      <span class="n">${echapper(meilleure.valeur)}</span>`;
    el.onclick = () => carteSelectionnerObjet(o);
    boite.appendChild(el);
  }
  boite.hidden = false;
}

function carteEffacerObjetActif() {
  carteEtat.meilleur.clear();
  carteEtat.selection.clear();
  $('carteObjetActif').hidden = true;
  $('carteObjetInput').value = '';
  dessinerCarte();
}

function carteSelectionnerObjet(o) {
  // NE MONTRER QUE LA/LES MEILLEURES SOURCES, PAS TOUTES : un objet
  // partage par une table de 30 monstres allumait toute la carte, la
  // plupart a un taux minuscule a cote d'une vraie bonne source (ex.
  // Celestigold : ~0.05% par monstre generique contre 16.67% sur
  // Medium/Small Ore Pile -- c'est CA qu'on veut voir, pas les 30 autres).
  // Le retour d'un joueur a l'origine de la recherche par type disait
  // deja la meme chose : mieux vaut partir de rien que de tout cocher.
  const tauxTop = Math.max(...o.sources.map((s) => s.tauxMax));
  const meilleures = o.sources.filter((s) => s.tauxMax === tauxTop);

  const zones = self.D_MAPS || [];
  const aUneSource = (zone, s) => zone[s.cat].some((g) => s.noms.includes(g.nom));
  let zoneCible = zones.find((z) => z.slug === carteEtat.zone
    && meilleures.some((s) => aUneSource(z, s)));
  if (!zoneCible) zoneCible = zones.find((z) => meilleures.some((s) => aUneSource(z, s)));
  if (!zoneCible) return;  // meme la meilleure source n'existe sur aucune carte connue

  if (carteEtat.zone !== zoneCible.slug) {
    carteEtat.zone = zoneCible.slug;
    resetVueCarte();
    dessinerZonesCarte();
  }
  carteEtat.selection.clear();
  carteEtat.meilleur.clear();
  for (const s of meilleures) {
    if (!aUneSource(zoneCible, s)) continue;  // pas sur CETTE carte -- rien a cocher ici
    for (const nom of s.noms) {
      if (!zoneCible[s.cat].some((g) => g.nom === nom)) continue;
      const cle = s.cat + '|' + nom;
      carteEtat.selection.add(cle);
      carteEtat.meilleur.add(cle);
    }
  }

  const chemin = (self.D_LOOT_ICONES || {})[o.nom];
  const autres = o.sources.length - meilleures.length;
  const actif = $('carteObjetActif');
  actif.innerHTML = `
    ${chemin ? `<img src="${echapper(chemin)}" alt="" loading="lazy">` : ''}
    <span class="nom">${echapper(o.nom)}<span class="carteObjetTaux">${echapper(meilleures[0].valeur)}</span></span>
    <button type="button" id="carteObjetEffacer">✕</button>`;
  if (autres > 0) {
    actif.innerHTML += `<div class="carteObjetAutres">${t('carte.autresSourcesM', { n: autres })}</div>`;
  }
  actif.hidden = false;
  $('carteObjetEffacer').onclick = carteEffacerObjetActif;
  $('carteObjetInput').value = o.nom;
  $('carteObjetSuggestions').hidden = true;
  dessinerCarte();
}

/* DEPUIS "OU FARMER", VERS LA CARTE, SUR UNE SOURCE PRECISE.
   carteSelectionnerObjet() ne garde que la MEILLEURE source d'un objet --
   utile pour « où le trouver le mieux », pas pour « montre-moi CETTE ligne
   que je viens de cliquer ». Ici on sait déjà laquelle : on la coche telle
   quelle, sans la comparer aux autres sources du même objet. */
function allerVersCarteSource(o, s) {
  montrerPage('pageCarte');

  const zones = self.D_MAPS || [];
  const aCetteSource = (zone) => (zone[s.cat] || []).some((g) => s.noms.includes(g.nom));
  let zoneCible = zones.find((z) => z.slug === carteEtat.zone && aCetteSource(z));
  if (!zoneCible) zoneCible = zones.find(aCetteSource);
  if (!zoneCible) return;  // cette source n'existe sur aucune carte connue

  if (carteEtat.zone !== zoneCible.slug) {
    carteEtat.zone = zoneCible.slug;
    resetVueCarte();
    dessinerZonesCarte();
  }
  carteEtat.selection.clear();
  carteEtat.meilleur.clear();
  for (const nom of s.noms) {
    if (!zoneCible[s.cat].some((g) => g.nom === nom)) continue;
    const cle = s.cat + '|' + nom;
    carteEtat.selection.add(cle);
    carteEtat.meilleur.add(cle);
  }

  const actif = $('carteObjetActif');
  actif.innerHTML = `
    ${o.chemin ? `<img src="${echapper(o.chemin)}" alt="" loading="lazy">` : ''}
    <span class="nom">${echapper(o.nom)}<span class="carteObjetTaux">${s.valeur}</span></span>
    <button type="button" id="carteObjetEffacer">✕</button>`;
  actif.hidden = false;
  $('carteObjetEffacer').onclick = carteEffacerObjetActif;
  $('carteObjetInput').value = o.nom;
  $('carteObjetSuggestions').hidden = true;
  dessinerCarte();
}

function dessinerCarte() {
  dessinerListeCarte();
  dessinerSvgCarte();
}

let _carteBranchee = false;
function ouvrirCarte() {
  if (!_carteBranchee) {
    _carteBranchee = true;
    if (!carteEtat.zone && (self.D_MAPS || []).length) carteEtat.zone = self.D_MAPS[0].slug;
    dessinerZonesCarte();
    brancherPanZoom();
    $('carteRecherche').oninput = dessinerListeCarte;
    $('carteObjetInput').oninput = dessinerSuggestionsObjet;
    $('cartePresetSauver').onclick = sauverPresetCarte;
    dessinerPresetsCarte();
    // Un clic hors du champ/de la liste de suggestions les referme.
    document.addEventListener('click', (ev) => {
      const boite = $('carteObjetSuggestions');
      if (boite && !boite.hidden && !ev.target.closest('.carteObjetRecherche')) {
        boite.hidden = true;
      }
    });
    // Un clic hors de la fiche (ou sur un autre point) la referme : pas
    // besoin de chercher la petite croix a chaque fois.
    document.addEventListener('click', (ev) => {
      const bulle = $('carteTooltip');
      if (bulle && !bulle.hidden && !bulle.contains(ev.target)
          && !ev.target.closest('.cartePoint')) bulle.hidden = true;
    });
  }
  dessinerCarte();
}

function poserNavigation() {
  for (const b of document.querySelectorAll('#nav button')) {
    b.onclick = () => montrerPage(b.dataset.page);
    // Sans compte branché, cet onglet n'a rien à montrer : un onglet qui
    // ouvre sur du vide est pire que pas d'onglet. Où farmer, Carte et
    // Ressources et Artisanat n'ont besoin d'aucun compte, ce sont des
    // tables statiques.
    if (b.dataset.page !== 'main' && b.dataset.page !== 'pageButin'
        && b.dataset.page !== 'pageCarte' && b.dataset.page !== 'pageObjets'
        && b.dataset.page !== 'pageCraft' && b.dataset.page !== 'pageMeca'
        && !comptesDispo()) b.hidden = true;
  }
}

function poserLangues() {
  const boite = $('langues');
  if (!boite || !window.I18N) return;
  boite.innerHTML = '';
  for (const l of I18N.langues) {
    const b = document.createElement('button');
    b.textContent = I18N.drapeau(l);
    b.title = I18N.nom(l);
    b.className = l === I18N.courante() ? 'actif' : '';
    b.onclick = () => I18N.choisir(l);
    boite.appendChild(b);
  }
}

/* Rejoué à chaque changement de langue : les textes statiques sont repris
   par I18N.appliquer(), mais tout ce que le script a écrit lui-même (liste
   d'affixes, tableau, paperdoll, messages) doit être redessiné. */
window.surChangementDeLangue = function () {
  poserLangues();
  poserAideVin();
  if (typeof BREWS !== 'undefined') poserBrews();
  poserRaretesParPiece();
  poserSecondeArmeRarete();
  poserSaveurs();
  poserPieceManuelle();
  if (!D) return;
  remplirSelect($('rarete'),
    [['', t('perso.auto')]].concat(
      [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]])),
    $('rarete').value);
  dessinerAffixes();
  majBudgetVin();
  if (window._poserFiltresBuilds) window._poserFiltresBuilds();
  dessinerBuilds();
  // Les builds de référence portent leurs textes dans les trois langues :
  // sans redessin ils restaient dans la langue du premier affichage.
  dessinerBuildsClasses();
  dessinerAccueil();
  // L'onglet Ressources est retire : sa page peut ne plus exister.
  if ($('pageObjets') && !$('pageObjets').hidden && self.D_RESSOURCES) {
    poserFiltresRessources(); dessinerRessources();
  }
  dessinerGuidesClasses();
  dessinerComparaison();
  // Le compteur de la grille et les infobulles des paliers sont posés en
  // JS : sans redessin ils restaient dans la langue précédente.
  if ($('grilleAffixes') && !$('grilleAffixes').hidden) dessinerGrilleAffixes();
  // Les listes déroulantes portent des libellés traduits : sans ce
  // remplissage, tri et filtres resteraient dans la langue précédente.
  remplirSelect($('sortsCible'), [
    ['brut', t('sorts.cible.brut')],
    ['monstre', t('sorts.cible.monstre')],
    ['moi', t('sorts.cible.moi')]], ($('sortsCible') || {}).value || 'brut');
  // Les listes distantes aussi : elles contiennent des libellés traduits
  // (« Charger », « Copier chez moi ») que seul un redessin met à jour.
  if (comptesDispo()) {
    dessinerAmis();
    remplirSelect($('galTri'), [
      ['recent', t('gal.tri.recent')], ['populaire', t('gal.tri.populaire')],
      ['ancien', t('gal.tri.ancien')],
      ['nom', t('gal.tri.nom')], ['auteur', t('gal.tri.auteur')]], galEtat.tri);
    for (const [el, val] of [[$('galClasse'), galEtat.classe],
                             [$('guClasse'), guEtat.classe],
                             [$('guideClasse'), ($('guideClasse') || {}).value]]) {
      if (!el) continue;
      const vide = el.id === 'guideClasse' ? t('guide.sansClasse') : t('gal.toutesClasses');
      remplirSelect(el, [['', vide]].concat(
        Object.entries(D.classes).map(([k, v]) => [k, v])), val || '');
    }
    if (_galerieChargee) chargerGalerie();
    if (_guidesCharges) { chargerGuides(); chargerMesGuides(); }
  }
  if (dernier) afficher(dernier, Number($('classe').value));
};

/* « J'AI RECHARGÉ ET JE VOIS ENCORE L'ANCIENNE VERSION. »
 *
 * GitHub Pages sert index.html avec `max-age=600` : pendant dix minutes
 * après une mise en ligne, un visiteur déjà venu garde l'ancienne page —
 * donc l'ancien balisage, avec les nouveaux scripts ou non. On ne peut pas
 * changer cet en-tête, mais on peut s'en apercevoir.
 *
 * `version.txt` est relu à chaque chargement en contournant le cache, et
 * comparé au `?v=` du script courant. S'ils diffèrent, on le DIT au lieu de
 * laisser quelqu'un croire à un bug. On ne recharge jamais tout seul : une
 * page qui se recharge sous les doigts fait perdre ce qu'on était en train
 * de régler. */
function guetterVersion() {
  const src = document.querySelector('script[src*="app.js"]');
  const ici = src && (src.src.match(/[?&]v=(\d+)/) || [])[1];
  if (!ici) return;
  fetch('version.txt', { cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : null))
    .then((t) => {
      const la = t && t.trim();
      if (!la || la === ici) return;
      const b = document.createElement('div');
      b.className = 'majDispo';
      b.innerHTML = `<span>${t2('maj.dispo')}</span>
        <button type="button">${t2('maj.recharger')}</button>`;
      b.querySelector('button').onclick = () => location.reload(true);
      document.body.appendChild(b);
    })
    .catch(() => {});
}
// Un `t` qui survit même si le dictionnaire n'a pas encore été chargé : ce
// bandeau doit pouvoir s'afficher précisément quand le reste va mal.
function t2(cle) {
  try { return t(cle); } catch (e) { return cle; }
}

function demarrer(donnees) {
  D = donnees;
  guetterVersion();
  // Le compteur de visites, si et seulement si on l'a allumé. Une erreur ici
  // ne doit jamais empêcher le site de fonctionner : c'est accessoire.
  if (comptesDispo() && window.MISTFALL_CONFIG.compterVisites) {
    fetch(`${window.MISTFALL_CONFIG.supabaseUrl}/rest/v1/rpc/compter_visite`, {
      method: 'POST',
      headers: { apikey: window.MISTFALL_CONFIG.supabaseAnonKey,
                 Authorization: 'Bearer ' + window.MISTFALL_CONFIG.supabaseAnonKey,
                 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
  }
  if (window.I18N) { I18N.appliquer(); poserLangues(); }
  poserNavigation();
  for (const g of D.gemmes) {
    gemParId.set(g.id, g);
    for (const a of g.a) {
      if (!affixVersGemmes.has(a)) affixVersGemmes.set(a, []);
      affixVersGemmes.get(a).push(g);
    }
  }
  for (const [, liste] of affixVersGemmes) liste.sort((a, b) => b.a.length - a.a.length);

  remplirSelect($('classe'), Object.entries(D.classes).map(([id, n]) => [id, n]), '11');
  majArmes();
  // PAR DÉFAUT « Auto », et non Epic. Une rareté figée n'escalade jamais :
  // avec Epic imposé d'entrée, tout build ayant besoin d'une pièce dorée
  // échouait en annonçant « pas atteignable », ce qui ressemble à une panne
  // alors que c'est une consigne de l'utilisateur qu'il n'a jamais donnée.
  // Le libellé passe par t() comme partout ailleurs : écrit en dur ici, il
  // restait en français dans les trois langues et ignorait toute retouche
  // du dictionnaire.
  remplirSelect($('rarete'),
    [['', t('perso.auto')]].concat(
      [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]])), '');
  poserRaretesParPiece();
  poserSecondeArmeRarete();
  poserSaveurs();
  poserPieceManuelle();
  dessinerAffixes();
  majBudgetVin();

  poserBrews();
  brancherPlis();
  /* L'INVENTAIRE COMPLET SE PAIE A L'OUVERTURE, PAS AVANT. Sept secondes de
   * calcul a chaque build seraient insupportables ; la carte etant repliee
   * par defaut, on ne les depense que si quelqu'un veut vraiment savoir. */
  if ($('carteMarge')) {
    $('carteMarge').addEventListener('toggle', () => {
      if ($('carteMarge').open && dernier) lancerAnalyseComplete(dernier);
      else arreterAnalyse();
    });
  }
  /* LE FILTRE REPART TOUJOURS VIDE.
   *
   * Le navigateur remplissait ce champ tout seul — une fois un code
   * d'import, une fois une adresse e-mail piochee dans son gestionnaire de
   * saisie : sans `name` ni `autocomplete`, il le prenait pour un champ de
   * formulaire. Les 44 affixes disparaissaient alors derriere un filtre
   * que personne n'avait tape, et une adresse personnelle s'affichait au
   * milieu de la liste.
   *
   * Le champ porte desormais un nom explicite et `autocomplete="off"` ;
   * cette remise a zero reste la ceinture, y compris au retour arriere
   * (bfcache), ou la page revient telle qu'elle etait. */
  const netFiltre = () => {
    if ($('recherche') && $('recherche').value) { $('recherche').value = ''; dessinerAffixes(); }
  };
  netFiltre();
  window.addEventListener('pageshow', netFiltre);
  $('classe').onchange = () => {
    libererVerrous(); majArmes();
    // Les builds proposés sont ceux de la classe affichée.
    dessinerAccueil();
  };
  if ($('arme')) $('arme').addEventListener('change', () => libererVerrous());
  $('recherche').oninput = dessinerAffixes;
  /* Remettre le vin a zero SANS perdre ses cibles. « Tout vider » effaçait
     les deux, si bien que corriger une repartition de vin obligeait a
     ressaisir tous ses affixes. */
  if ($('brew')) {
    $('brew').onchange = () => {
      _brew = $('brew').value;
      // Changer de boisson change le budget : une repartition manuelle faite
      // pour une autre n'a plus de sens, le moteur la refait.
      vinManuel.clear();
      dessinerAffixes(); majBudgetVin();
      if (cibles.size) calculer();
    };
  }

  $('viderVin').onclick = () => {
    if (!vinManuel.size) return;
    vinManuel.clear();
    dessinerAffixes(); majBudgetVin();
    if (cibles.size) calculer();
  };

  $('manuelVerrouiller').onclick = verrouillerPieceManuelle;
  $('vider').onclick = () => {
    cibles.clear(); vinManuel.clear(); dessinerAffixes(); majBudgetVin();
    cacherBandeauDemo();
    // Plus de cibles, plus de build « en cours d'édition » à proposer
    // d'écraser.
    _buildCharge = '';
    majBoutonEcraser();
  };
  /* Le clic a vide ne refuse plus : il montre. Le refus reste dans
     `calculer` pour tous les autres appelants. */
  $('calculer').onclick = () => { if (!demarrerParUnExemple()) calculer(); };

  // La grille plein écran.
  if ($('ouvrirGrille')) {
    $('ouvrirGrille').onclick = ouvrirGrille;
    $('grilleFermer').onclick = fermerGrille;
    $('grilleRecherche').oninput = (e) => eclairerGrille(e.target.value);
    $('grilleVider').onclick = () => {
      cibles.clear(); vinManuel.clear();
      dessinerGrilleAffixes(); dessinerAffixes(); majBudgetVin();
    };
    // Cliquer le voile ferme, cliquer la boîte non : sinon le moindre clic
    // à côté d'un bouton refermerait la grille en pleine sélection.
    $('grilleAffixes').onclick = (e) => {
      if (e.target === $('grilleAffixes')) fermerGrille();
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermerGrille();
    });
  }

  // La fenêtre "Mes builds" : même mécanique que la grille d'affixes
  // ci-dessus (voile cliquable, Échap, un seul écouteur clavier de plus).
  if ($('modalMesBuilds')) {
    if ($('voirMesBuilds')) $('voirMesBuilds').onclick = ouvrirModalBuilds;
    if ($('boutonFlottantBuilds')) $('boutonFlottantBuilds').onclick = ouvrirModalBuilds;
    $('mbFermer').onclick = fermerModalBuilds;
    $('modalMesBuilds').onclick = (e) => {
      if (e.target === $('modalMesBuilds')) fermerModalBuilds();
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermerModalBuilds();
    });
  }
  // Les sous-onglets de la page Communauté, et le bouton de comparaison.
  for (const b of document.querySelectorAll('#sousOnglets button')) {
    b.onclick = () => montrerVue(b.dataset.vue);
  }
  if ($('comparer')) $('comparer').onclick = mettreDeCote;
  // Ouvrir le bandeau suffit à dire « j'ai vu » : le battement s'arrête.
  const bs = $('blocSuggestions');
  if (bs) bs.addEventListener('toggle', () => {
    if (bs.open) delete bs.dataset.neuf;
  });

  // LA FICHE. Changer de cible ou de filtre d'arme ne touche que
  // l'affichage : on redessine sans relancer le moteur de build.
  remplirSelect($('sortsCible'), [
    ['brut', t('sorts.cible.brut')],
    ['monstre', t('sorts.cible.monstre')],
    ['moi', t('sorts.cible.moi')]], ($('sortsCible') || {}).value || 'brut');
  const redessinerFiche = () => {
    if (dernier) dessinerFiche(dernier, Number($('classe').value));
  };
  $('sortsCible').onchange = redessinerFiche;
  $('sortsArme').onchange = redessinerFiche;

  // MES BUILDS : tri et filtres. Ils ne touchent que l'affichage, la
  // bibliotheque reste intacte.
  const poserFiltresBuilds = () => {
    remplirSelect($('bClasse'), [['', t('mesb.toutesClasses')]].concat(
      Object.entries(D.classes).map(([k, v]) => [k, v])), bEtat.classe);
    remplirSelect($('bRarete'), [['', t('mesb.toutesRaretes')],
      ['panache', t('mesb.panache')]].concat(
      [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]])), bEtat.rarete);
    remplirSelect($('bTri'), [['nom', t('mesb.triNom')],
      ['classe', t('mesb.triClasse')],
      ['affixes', t('mesb.triAffixes')]], bEtat.tri);
  };
  poserFiltresBuilds();
  window._poserFiltresBuilds = poserFiltresBuilds;
  for (const [id, cle] of [['bClasse', 'classe'], ['bRarete', 'rarete'],
                           ['bTri', 'tri']]) {
    $(id).onchange = () => { bEtat[cle] = $(id).value; dessinerBuilds(); };
  }
  let mb = null;
  $('bChercher').oninput = () => {
    clearTimeout(mb);
    mb = setTimeout(() => {
      bEtat.recherche = $('bChercher').value.trim();
      dessinerBuilds();
    }, 200);
  };

  poserAideVin();
  $('vin').onchange = () => {
    document.querySelectorAll('#listeAffixes .affixe').forEach(majEtatVin);
    majBudgetVin();
  };

  // ------------------------------------------------------- mes builds
  dessinerBuilds();

  // Le retour du lien de confirmation reçu par e-mail, AVANT tout le reste :
  // c'est lui qui décide si l'on arrive connecté ou non.
  let retourAuth = null;
  if (comptesDispo()) {
    try { retourAuth = window.Comptes.lireFragmentAuth(); } catch (e) { retourAuth = null; }
  }
  majBandeauCompte();
  if (retourAuth && retourAuth.erreur) {
    $('noteCompte').innerHTML = `<span class="ko">${retourAuth.erreur}</span>`;
  } else if (retourAuth && retourAuth.connecte) {
    $('noteCompte').innerHTML = retourAuth.type === 'signup'
      ? `<span class="ok">${t('compte.confirme')}</span>`
      : `<span class="ok">${t('compte.connecteOk')}</span>`;
  }
  // Au démarrage ordinaire la synchro est muette (personne n'a rien demandé),
  // mais juste après un lien de confirmation l'utilisateur ATTEND de voir
  // quelque chose se passer : là, on parle.
  if (comptesDispo() && window.Comptes.connecte()) {
    synchroniser(!(retourAuth && retourAuth.connecte));
    window.Comptes.monProfilComplet().then((p) => {
      if (p && p.pseudo) $('pseudo').value = p.pseudo;
    }).catch(() => {});
  }

  // ---------------------------------------------------- amis et galerie
  if (comptesDispo()) {
    $('blocPartage').hidden = false;
    dessinerAmis();
    $('amiAjouter').onclick = ajouterAmi;
    $('amiPseudo').onkeydown = (ev) => { if (ev.key === 'Enter') ajouterAmi(); };
    // LA GALERIE. Chaque filtre relance la requête en repartant page 1 :
    // rester page 4 d'un filtre qui n'a plus que deux pages afficherait un
    // vide qu'on prendrait pour une panne.
    $('galRafraichir').onclick = () => chargerGalerie(0);
    remplirSelect($('galTri'), [
      ['recent', t('gal.tri.recent')], ['populaire', t('gal.tri.populaire')],
      ['ancien', t('gal.tri.ancien')],
      ['nom', t('gal.tri.nom')], ['auteur', t('gal.tri.auteur')]], galEtat.tri);
    remplirSelect($('galClasse'),
      [['', t('gal.toutesClasses')]].concat(
        Object.entries(D.classes).map(([k, v]) => [k, v])), galEtat.classe);
    $('galTri').onchange = () => { galEtat.tri = $('galTri').value; chargerGalerie(0); };
    $('galClasse').onchange = () => { galEtat.classe = $('galClasse').value; chargerGalerie(0); };
    let minuteur = null;
    $('galRecherche').oninput = () => {
      // On attend que la frappe se calme : une requête par lettre saturerait
      // la base pour des résultats que personne n'a le temps de lire.
      clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        galEtat.recherche = $('galRecherche').value.trim();
        chargerGalerie(0);
      }, 320);
    };

    // LES GUIDES.
    remplirSelect($('guClasse'),
      [['', t('gal.toutesClasses')]].concat(
        Object.entries(D.classes).map(([k, v]) => [k, v])), guEtat.classe);
    remplirSelect($('guideClasse'),
      [['', t('guide.sansClasse')]].concat(
        Object.entries(D.classes).map(([k, v]) => [k, v])), '');
    $('guRafraichir').onclick = () => chargerGuides(0);
    $('guClasse').onchange = () => { guEtat.classe = $('guClasse').value; chargerGuides(0); };
    let minuteurG = null;
    $('guRecherche').oninput = () => {
      clearTimeout(minuteurG);
      minuteurG = setTimeout(() => {
        guEtat.recherche = $('guRecherche').value.trim();
        chargerGuides(0);
      }, 320);
    };
    $('guideEnregistrer').onclick = enregistrerGuide;

    // Le pseudo engendre le code ami à sa première écriture, puis ne le
    // change plus : sinon les amis à qui on l'a donné le perdraient.
    $('enregistrerPseudo').onclick = async () => {
      const p = ($('pseudo').value || '').trim();
      const note = $('notePseudo');
      if (p.length < 2 || p.length > 24) {
        note.innerHTML = `<span class="ko">${t('compte.pseudoTaille')}</span>`;
        return;
      }
      try {
        await window.Comptes.definirPseudo(p);
        note.innerHTML = `<span class="ok">${t('compte.pseudoOk')}</span>`;
      } catch (e) {
        note.innerHTML = /duplicate|unique/i.test(e.message)
          ? `<span class="ko">${t('compte.pseudoPris')}</span>`
          : `<span class="ko">${echapper(e.message)}</span>`;
      }
    };
  }

  const agirCompte = async (quoi) => {
    const email = ($('compteEmail_in').value || '').trim();
    const mdp = $('compteMdp').value || '';
    const note = $('noteCompte');
    if (!email || !mdp) {
      note.innerHTML = `<span class="ko">${t('compte.champs')}</span>`;
      return;
    }
    note.innerHTML = '<span class="pas">…</span>';
    try {
      if (quoi === 'inscription') {
        const r = await window.Comptes.inscrire(email, mdp);
        if (!r.connecte) { note.innerHTML = `<span class="pas">${r.message}</span>`; }
      } else {
        await window.Comptes.connecter(email, mdp);
      }
      $('compteMdp').value = '';
      majBandeauCompte();
      if (window.Comptes.connecte()) {
        note.innerHTML = '';
        await synchroniser(false);
      }
    } catch (e) {
      note.innerHTML = `<span class="ko">${echapper(e.message)}</span>`;
    }
  };
  if ($('compteConnexion')) {
    $('compteConnexion').onclick = () => agirCompte('connexion');
    $('compteInscription').onclick = () => agirCompte('inscription');
    $('compteMdp').onkeydown = (ev) => { if (ev.key === 'Enter') agirCompte('connexion'); };
    $('compteDeconnexion').onclick = async () => {
      await window.Comptes.deconnecter();
      majBandeauCompte();
      // Les builds locaux RESTENT : se déconnecter n'est pas effacer.
      $('noteBuilds').innerHTML =
        `<span class="pas">${t('compte.deconnecteOk')}</span>`;
    };
    $('compteSync').onclick = () => synchroniser(false);
  }

  $('enregistrerBuild').onclick = enregistrerBuild;
  $('nomBuild').onkeydown = (ev) => { if (ev.key === 'Enter') enregistrerBuild(); };
  $('ecraserBuild').onclick = ecraserBuild;
  $('lienBuild').onclick = () => {
    if (!cibles.size) {
      $('noteBuilds').innerHTML = `<span class="ko">${t('etat.choisir')}</span>`;
      return;
    }
    const lien = location.origin + location.pathname + '#b=' + versLien(etatActuel());
    history.replaceState(null, '', '#b=' + versLien(etatActuel()));
    $('noteBuilds').innerHTML = `<span class="pas">${t('builds.lienBarre')}</span>`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lien).then(() => {
        $('noteBuilds').innerHTML =
          `<span class="pas">${t('builds.lienCopie')}</span>`;
      }, () => {});
    }
  };
  $('exporterBuilds').onclick = () => {
    const liste = biblio();
    if (!liste.length) {
      $('noteBuilds').innerHTML =
        `<span class="ko">${t('builds.rienExporter')}</span>`;
      return;
    }
    const blob = new Blob([JSON.stringify(liste, null, 2)],
                          { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mes-builds-mistfall.json';
    a.click();
    URL.revokeObjectURL(a.href);
    $('noteBuilds').innerHTML =
      `<span class="pas">${t('builds.exporte', { n: liste.length })}</span>`;
  };
  $('importerBuilds').onclick = () => $('fichierBuilds').click();
  $('exporterImage').onclick = () => {
    if (!cibles.size) {
      $('noteBuilds').innerHTML = `<span class="ko">${t('builds.affixeRequis')}</span>`;
      return;
    }
    const nom = _buildCharge || ($('nomBuild').value || '').trim() || t('builds.imageSansNom');
    telechargerImageBuild(etatActuel(), nom);
  };
  $('fichierBuilds').onchange = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        const venus = JSON.parse(lecteur.result);
        if (!Array.isArray(venus)) throw new Error('format inattendu');
        // On FUSIONNE au lieu de remplacer : importer la sauvegarde d'un
        // ami ne doit pas effacer ses propres builds.
        const liste = biblio();
        let ajoutes = 0;
        for (const b of venus) {
          if (!b || !b.nom || !b.etat) continue;
          const i = liste.findIndex((x) => x.nom === b.nom);
          if (i >= 0) liste[i] = b; else { liste.push(b); ajoutes += 1; }
        }
        if (ecrireBiblio(liste)) {
          dessinerBuilds();
          $('noteBuilds').innerHTML = `<span class="pas">${
            t('builds.importe', { a: ajoutes, r: venus.length - ajoutes })}</span>`;
        }
      } catch (e) {
        $('noteBuilds').innerHTML =
          `<span class="ko">${tH('builds.fichierKo', { message: e.message })}</span>`;
      }
      ev.target.value = '';
    };
    lecteur.readAsText(f);
  };
  $('mixte').onchange = () => { $('blocPlancher').hidden = !$('mixte').checked; };
  if ($('secondeArmeActive')) {
    $('secondeArmeActive').onchange = () => {
      $('blocSecondeArme').hidden = !$('secondeArmeActive').checked;
      if (cibles.size) calculer();
    };
    $('secondeArmeType').onchange = () => { if ($('secondeArmeActive').checked) calculer(); };
    $('secondeArmeRarete').onchange = () => { if ($('secondeArmeActive').checked) calculer(); };
  }
  $('importer').onclick = importer;
  $('copier').onclick = () => {
    // navigator.clipboard n'existe pas sur une page ouverte depuis le disque
    // (contexte non sécurisé) : sans ce repli, le bouton ne faisait rien du
    // tout et rien ne le disait.
    const champ = $('code');
    const dire = (ok) => {
      $('noteCode').textContent = ok ? t('code.copie') : t('code.copieKo');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(champ.value).then(() => dire(true), () => dire(false));
      return;
    }
    champ.removeAttribute('readonly');
    champ.select();
    champ.setSelectionRange(0, champ.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    champ.setAttribute('readonly', '');
    dire(ok);
  };

  // Un lien partagé ouvre directement sur son build, rendu tel quel.
  if (lirePermalien()) {
    restituer({ code: (_etatPartage && _etatPartage.k) || '' });
    return;
  }
  // Rien à montrer encore : la colonne propose des builds à charger, et
  // les deux cartes vides se replient plutôt que d'afficher un champ vide
  // et un bouton grisé.
  dessinerAccueil();
  poserPliAuto('carteEquip', false);
  poserPliAuto('carteTableau', false);
  $('etat').textContent = t('etat.pret');
}

// LE SITE NE DEMARRE PAS DU TOUT TANT QUE LE VERROU EST FERME.
//
// verrou.js montre l'ecran de mot de passe et ne touche a rien d'autre --
// demarrer() (fetch de donnees.json, rendu de l'interface, compteur de
// visites...) resterait sinon executé en arrière-plan derrière un simple
// cache CSS, ce qui n'a rien d'un verrou : quelqu'un qui ouvre les outils
// dev verrait le site tourner normalement. Inerte sans Supabase configuré,
// comme verrou.js lui-même -- un clone du dépôt sans config.js rempli
// n'a pas à être bloqué sans porte de sortie.
function siteVerrouille() {
  const cfg = window.MISTFALL_CONFIG;
  if (!cfg || !cfg.verrouActif || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return false;
  try { return localStorage.getItem('mistfall.verrou.v1') !== '1'; } catch (e) { return false; }
}

if (!siteVerrouille()) {
  if (window.D_MISTFALL) {
    demarrer(window.D_MISTFALL);
  } else {
    // Repli pour un vrai serveur web, si donnees.js n'a pas été engendré.
    fetch('donnees.json').then((r) => r.json()).then(demarrer).catch((e) => {
      $('etat').innerHTML =
        `<span class="ko">Data not found: ${echapper(e.message)}</span>`;
    });
  }
}
