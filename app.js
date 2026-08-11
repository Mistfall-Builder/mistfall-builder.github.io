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
      if (o >= this.octets.length) throw new Error('code tronqué');
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
  const finale = etapes[etapes.length - 1];
  let meilleur = -1, meilleureNote = -Infinity;
  for (let idx = 0; idx < total; idx += 1) {
    if (finale[idx] === INF) continue;
    const c = {};
    noms.forEach((n, i) => { c[n] = Math.floor(idx / strides[i]) % (caps[i] + 1); });
    const note = couvertureEffective(c, want, null);
    if (note > meilleureNote) { meilleureNote = note; meilleur = idx; }
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

function assembler(slotItems, want, exact) {
  const sockets = [];
  const couvert = {};
  const sources = [];
  for (const [slot, it] of Object.entries(slotItems)) {
    if (!it) continue;
    it.s.forEach((sk, idx) => {
      sockets.push({ slot, index: idx, type: sk[0], level: sk[1], gem: null });
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

function construireAuGrade(classe, arme, cibleListe, grade, mixte, planchers, affinite, depart) {
  const want = Object.fromEntries(cibleListe);
  const options = {};
  const slotItems = {};
  for (const slot of D.ordreSlots) {
    const sol = Math.max(grade, planchers[slot] || 0);
    const pool = poolDe(classe, slot, arme, sol, mixte);
    options[slot] = pool;
    const impose = depart && depart[slot];
    if (impose) { slotItems[slot] = impose; continue; }
    let best = null, bestCle = null;
    for (const it of pool) {
      const cle = [scoreObjet(it, want), affinite ? (affinite === 'magic' ? it.aff : -it.aff) : 0];
      if (!best || cle[0] > bestCle[0] || (cle[0] === bestCle[0] && cle[1] > bestCle[1])) {
        best = it; bestCle = cle;
      }
    }
    slotItems[slot] = best || null;
  }

  let etat = assembler(slotItems, want, false);
  const note = (items, e) => {
    const base = couvertureEffective(e.couvert, want, null);
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

  let items = { ...slotItems };
  let meilleur = note(items, etat);
  for (let tour = 0; tour < D.toursRecherche; tour += 1) {
    let ameliore = false;
    for (const slot of D.ordreSlots) {
      const pool = options[slot];
      if (!pool || pool.length <= 1) continue;
      for (const alt of pool) {
        if (alt === items[slot]) continue;
        const essaiItems = { ...items, [slot]: alt };
        const essai = assembler(essaiItems, want, false);
        const n = note(essaiItems, essai);
        if (mieux(n, meilleur)) { items = essaiItems; etat = essai; meilleur = n; ameliore = true; break; }
      }
      if (ameliore) break;
    }
    if (!ameliore) break;
  }

  const final = assembler(items, want, true);
  return { slotItems: items, ...final, options };
}

function construire(classe, arme, cibleListe, grade, vin, mixte, planchers, vinChoisi) {
  const want = Object.fromEntries(cibleListe);
  const affinite = D.affinites[String(classe)] || null;
  const vinPoints = vin ? repartitionVin(cibleListe, vinChoisi) : new Map();
  const vinNoms = new Set(vinPoints.keys());

  const essai = (g, mx, dep) => {
    const a = construireAuGrade(classe, arme, cibleListe, g, mx, planchers, null, dep);
    if (!affinite) return a;
    const b = construireAuGrade(classe, arme, cibleListe, g, mx, planchers, affinite, dep);
    const na = [couvertureEffective(a.couvert, want, null), surplus(a.couvert, want)];
    const nb = [couvertureEffective(b.couvert, want, null), surplus(b.couvert, want)];
    return (nb[0] > na[0] || (nb[0] === na[0] && nb[1] >= na[1])) ? b : a;
  };
  const suffit = (r) => cibleListe.every(([n, l]) =>
    (r.couvert[n] || 0) + (vinPoints.get(n) || 0) >= l);

  let res = null;
  // On retient le dernier palier INSUFFISANT : c'est le meilleur point de
  // départ pour le panaché (voir plus bas).
  let justeEnDessous = null;
  const grades = grade ? [grade] : [1, 2, 3, 4, 5, 6];
  for (const g of grades) {
    res = essai(g, false, null);
    if (suffit(res)) break;
    justeEnDessous = res;
  }

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
      const np = [couvertureEffective(pan.couvert, want, null), -raretes(pan)];
      const nr = [couvertureEffective(res.couvert, want, null), -raretes(res)];
      if (np[0] > nr[0] || (np[0] === nr[0] && np[1] > nr[1])) res = pan;
    }
  }
  res.vin = vinNoms;
  res.vinPoints = vinPoints;
  res.suffisant = suffit(res);
  return res;
}

/* Combien de points de vin chaque affixe reçoit. Mêmes règles que l'outil de
   bureau : au plus D.vin.max affixes, D.vin.bonus points chacun, et
   D.vin.max × D.vin.bonus au total. Une consigne qui déborde est rognée —
   un build calculé sur un vin impossible serait faux. */
function repartitionVin(cibleListe, manuel) {
  // Le vin posé sur un affixe qu'on ne vise plus ne compte pas. Sans ce
  // filtre, retirer une cible laissait son allocation derrière elle : on
  // dépassait les 4 affixes sans comprendre pourquoi, et le rognage
  // sacrifiait une cible réelle au profit d'une cible fantôme.
  const vises = new Set(cibleListe.map(([n]) => n));
  const utile = manuel
    ? [...manuel.entries()].filter(([n]) => vises.has(n))
    : [];
  if (!utile.length) {
    return new Map([...choisirVin(cibleListe)].map((n) => [n, D.vin.bonus]));
  }
  const budgetTotal = D.vin.max * D.vin.bonus;
  const voulus = utile
    .map(([n, p]) => [n, Math.max(0, Math.min(p, D.vin.bonus))])
    .filter(([, p]) => p > 0)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  const sortie = new Map();
  let reste = budgetTotal;
  for (const [n, p] of voulus.slice(0, D.vin.max)) {
    if (reste <= 0) break;
    const donne = Math.min(p, reste);
    sortie.set(n, donne);
    reste -= donne;
  }
  return sortie;
}

function choisirVin(cibleListe) {
  const ordre = cibleListe.slice().sort((a, b) => {
    const sansGemme = (n) => ((affixVersGemmes.get(n) || []).length ? 1 : 0);
    return (sansGemme(a[0]) - sansGemme(b[0])) || (b[1] - a[1]);
  });
  return new Set(ordre.slice(0, D.vin.max).map(([n]) => n));
}

/* --------------------------------------------------------------------- UI */
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
}

/* Les affixes n'ont pas d'icône dans le jeu (ce sont des modificateurs de
   stats, pas des objets). Comme l'outil de bureau, on dessine un symbole par
   catégorie plutôt que d'inventer des images à la provenance douteuse. */
const SYMBOLE = {
  offense: '<path d="M4 20 16 8M11 4l9 9M12.5 19.5 16 16"/>',
  defense: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/>',
  mobility: '<path d="M3 12h11M9 7l5 5-5 5M17 5v14"/>',
  support: '<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3Z"/>',
};
function pastille(cat) {
  return `<span class="pastille c-${cat || 'support'}" title="${cat || ''}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
         stroke-linecap="round" stroke-linejoin="round">${SYMBOLE[cat] || SYMBOLE.support}</svg>
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
const NOM_STAT = {
  attack: ['Attaque', 0], defence: ['Défense', 0], maxHealth: ['Vie max', 0],
  combatValue: ['Puissance', 0], blockRate: ['Blocage', 1],
  physicalIncrease: ['Dégâts physiques', 1], magicalIncrease: ['Dégâts magiques', 1],
  physicalReduction: ['Réduction physique', 1], magicalReduction: ['Réduction magique', 1],
  criticalReduction: ['Réduction critique', 1],
};
function statsLisibles(at) {
  return Object.entries(at || {}).map(([k, v]) => {
    const [nom, pct] = NOM_STAT[k] || [k, 0];
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
function infobulle(it) {
  const bouts = [it.n, D.raretes[String(it.g)]];
  const st = statsLisibles(it.at);
  if (st) bouts.push(st);
  if (it.i) bouts.push('Inné : ' + it.i);
  if (it.d) bouts.push(it.d);
  return bouts.filter(Boolean).join('\n');
}

/* Le vin ne se règle que sur un affixe qu'on VISE. Griser la case le dit à
   l'écran plutôt que de laisser croire à un réglage qui ne compte pas. */
function majEtatVin(ligne) {
  const nom = ligne.dataset.affixe;
  const vin = ligne.querySelector('.vin');
  if (!vin) return;
  const vise = cibles.has(nom);
  vin.disabled = !vise;
  // On remet la case sur « auto » : la laisser afficher « +2 » alors que
  // l'affixe n'est plus visé donnerait un réglage qui ne compte pas.
  if (!vise) vin.value = '';
  vin.title = vise
    ? `Points de Victory Wine sur cet affixe (au plus ${D.vin.max} affixes, `
      + `${D.vin.bonus} points chacun).`
    : "Choisis d'abord un niveau visé pour cet affixe.";
}

/* Dit en clair où en est le budget de vin, faute de quoi une consigne rognée
   en silence passerait pour un bug. */
function majBudgetVin() {
  const el = $('budgetVin');
  if (!el) return;
  const retenu = repartitionVin([...cibles.entries()], vinManuel);
  const total = [...retenu.values()].reduce((s, v) => s + v, 0);
  const budget = D.vin.max * D.vin.bonus;
  const demande = [...vinManuel.values()].reduce((s, v) => s + v, 0);
  const auto = !vinManuel.size;
  const trop = !auto && (demande > budget || vinManuel.size > D.vin.max);
  el.className = trop ? 'ko' : 'pas';
  el.textContent = auto
    ? `Vin réparti automatiquement (${total}/${budget} points).`
    : `Vin : ${total}/${budget} points sur ${retenu.size}/${D.vin.max} affixes`
      + (trop ? ' — la consigne dépasse les règles du jeu, elle a été rognée.' : '.');
}

function dessinerAffixes() {
  const filtre = ($('recherche').value || '').toLowerCase();
  const conteneur = $('listeAffixes');
  conteneur.innerHTML = '';
  for (const nom of Object.keys(D.affixes).sort()) {
    if (filtre && !nom.toLowerCase().includes(filtre)) continue;
    const info = D.affixes[nom];
    const ligne = document.createElement('div');
    ligne.dataset.affixe = nom;
    ligne.className = 'affixe' + (cibles.has(nom) ? ' actif' : '');
    const sansGemme = !info.mat.length;
    ligne.innerHTML = pastille(info.cat) + `<span class="nom">${nom}
      <small>max ${info.cap}${sansGemme ? ' · vin seulement' : ''}</small></span>`;
    ligne.title = (info.desc || '') + (info.eff ? '\n\n' + info.eff
      .map((e, i) => `${i + 1}. ${e}`).join('\n') : '');

    const sel = document.createElement('select');
    sel.className = 'niveau';
    sel.title = 'Niveau visé';
    sel.innerHTML = '<option value="">—</option>' +
      Array.from({ length: info.cap }, (_, i) => `<option>${i + 1}</option>`).join('');
    sel.value = cibles.has(nom) ? String(cibles.get(nom)) : '';
    sel.onchange = () => {
      if (sel.value) {
        cibles.set(nom, Number(sel.value));
      } else {
        // On retire aussi le vin : le garder sur un affixe abandonné faisait
        // sauter le plafond de 4 sans que rien ne l'explique à l'écran.
        cibles.delete(nom);
        vinManuel.delete(nom);
      }
      ligne.classList.toggle('actif', cibles.has(nom));
      majEtatVin(ligne);
      majBudgetVin();
    };
    ligne.appendChild(sel);

    // LE VIN, AFFIXE PAR AFFIXE — comme dans l'outil de bureau. Sigrid donne
    // au plus 2 points à au plus 4 affixes, 8 en tout, et rien n'oblige à
    // mettre 2 partout : « auto » laisse choisir, sinon c'est toi qui décides.
    const vin = document.createElement('select');
    vin.className = 'vin';
    vin.title = `Points de Victory Wine sur cet affixe (au plus ${D.vin.max} `
      + `affixes, ${D.vin.bonus} points chacun).`;
    vin.innerHTML = '<option value="">auto</option>'
      + Array.from({ length: D.vin.bonus + 1 },
                   (_, i) => `<option value="${i}">${i ? '+' + i : '—'}</option>`).join('');
    vin.value = vinManuel.has(nom) ? String(vinManuel.get(nom)) : '';
    vin.onchange = () => {
      if (vin.value === '') vinManuel.delete(nom);
      else vinManuel.set(nom, Number(vin.value));
      majBudgetVin();
    };
    ligne.appendChild(vin);
    majEtatVin(ligne);
    conteneur.appendChild(ligne);
  }
}

function materiau(type, niveau) {
  return D.materiaux[`${type},${niveau}`] || '?';
}

function afficher(res, classe) {
  const pd = $('paperdoll');
  pd.innerHTML = '';
  for (const slot of D.ordreSlots) {
    const it = res.slotItems[slot];
    const carte = document.createElement('div');
    carte.className = 'piece';
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
        <span>${s.gem ? `<b>${s.gem.n}</b>` : '<span class="pas">vide</span>'}
          <span class="mat">${materiau(s.type, s.level)} ${s.level === 2 ? 'II' : 'I'}</span></span>
      </div>`).join('');
    carte.style.setProperty('--tinte', couleur);
    carte.style.borderColor = couleur + '66';
    carte.title = infobulle(it);
    carte.innerHTML = `<div class="slot">${D.nomsSlots[slot] || slot}</div>
      ${vignette(it.ic, couleur)}
      <div class="nom" style="color:${couleur}">${it.n}</div>
      <div class="inne${it.i ? '' : ' sans'}">${it.i ? 'inné : ' + it.i : 'aucun inné'}</div>
      ${gems}`;
    pd.appendChild(carte);
  }

  const lignes = [...cibles.entries()].sort((a, b) => b[1] - a[1]).map(([nom, vise]) => {
    const eq = res.couvert[nom] || 0;
    const v = (res.vinPoints && res.vinPoints.get(nom)) || 0;
    const total = Math.min(plafond(nom), eq + v);
    const cls = total >= vise ? 'ok' : 'ko';
    const cat = (D.affixes[nom] || {}).cat;
    return `<tr><td><span style="display:flex;align-items:center;gap:8px">
              ${pastille(cat)}${nom}</span></td>
            <td class="n">${vise}</td><td class="n">${eq}</td>
            <td class="n">${v || ''}</td><td class="n ${cls}">${total}</td></tr>`;
  }).join('');
  const bonus = Object.entries(res.couvert)
    .filter(([n]) => !cibles.has(n))
    .sort((a, b) => b[1] - a[1])
    .map(([n, v]) => `${n} ${v}`).join(' · ');
  $('tableauAffixes').innerHTML = lignes
    ? `<table><tr><th>Affixe</th><th>Visé</th><th>Équip.</th><th>Vin</th><th>Total</th></tr>${lignes}</table>`
      + (bonus ? `<div style="margin-top:6px" class="pas">En prime, non demandés : ${bonus}</div>` : '')
    : '<span class="pas">Aucun affixe visé.</span>';

  const libres = res.sockets.filter((s) => !s.gem).length;
  const compte = {};
  for (const s of res.sockets) if (!s.gem) {
    const k = `${materiau(s.type, s.level)} ${s.level === 2 ? 'II' : 'I'}`;
    compte[k] = (compte[k] || 0) + 1;
  }
  $('bilan').textContent = libres
    ? `${libres} emplacement(s) encore libre(s) : ` +
      Object.entries(compte).map(([k, n]) => `${n} ${k}`).join(' · ')
    : 'Tous les emplacements de gemme sont remplis.';

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
    $('code').value = encoderCode(classe, objets);
    $('copier').disabled = false;
    $('noteCode').textContent = '';
  } catch (err) {
    $('code').value = '';
    $('copier').disabled = true;
    $('noteCode').textContent = `Code impossible : ${err.message}`;
  }
}

/* ------------------------------------------------------------ mes builds --
   Un build, c'est ses CONSIGNES (classe, arme, rareté, affixes, vin,
   planchers), pas son résultat : en les rejouant on retrouve le même stuff,
   et un build enregistré profite des corrections futures du moteur. Le code
   d'import est gardé à côté, pour le relire sans tout recalculer. */
const CLE_BIBLIO = 'mistfall.builds.v1';

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
    pa: $('plancherActif').checked,
    pg: Number($('plancherGrade').value),
    ps: [...document.querySelectorAll('#plancherSlots input:checked')].map((c) => c.value),
    t: [...cibles.entries()],
    w: [...vinManuel.entries()],
  };
}

function appliquerEtat(e) {
  if (!e) return;
  $('classe').value = String(e.c);
  majArmes();
  if (e.a) $('arme').value = e.a;
  $('rarete').value = e.g === null || e.g === undefined ? '' : String(e.g);
  $('vin').checked = e.v !== false;
  $('mixte').checked = !!e.m;
  $('blocPlancher').hidden = !$('mixte').checked;
  $('plancherActif').checked = !!e.pa;
  if (e.pg) $('plancherGrade').value = String(e.pg);
  const voulus = new Set(e.ps || []);
  for (const c of document.querySelectorAll('#plancherSlots input')) {
    c.checked = voulus.has(c.value);
  }
  cibles.clear();
  for (const [n, l] of e.t || []) cibles.set(n, l);
  vinManuel.clear();
  for (const [n, p] of e.w || []) vinManuel.set(n, p);
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
      `<span class="ko">Enregistrement impossible : ${e.message}</span>`;
    return false;
  }
}

/* ------------------------------------------------------------- comptes ----
   La bibliothèque locale reste la référence : elle marche hors ligne et sans
   compte. Le compte n'ajoute qu'UNE chose, la synchronisation entre
   appareils. Se déconnecter ne doit donc rien effacer. */
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
    dire('<span class="pas">Synchronisation…</span>');
    const distants = await window.Comptes.listerBuilds();
    const locaux = biblio();
    // FUSION, jamais remplacement : on ne perd ni ce qui est sur le serveur
    // ni ce qui vient d'être créé hors ligne.
    const par = new Map(locaux.map((b) => [b.nom, b]));
    let recus = 0;
    for (const d of distants || []) {
      if (!par.has(d.nom)) recus += 1;
      par.set(d.nom, { nom: d.nom, etat: d.etat, code: d.code || '',
                       pub: !!d.public });
    }
    const fusion = [...par.values()];
    ecrireBiblio(fusion);
    dessinerBuilds();
    await window.Comptes.envoyerBuilds(fusion);
    dire(`<span class="pas">Synchronisé : ${fusion.length} build(s), `
         + `${recus} récupéré(s) du compte.</span>`);
  } catch (e) {
    dire(`<span class="ko">Synchronisation impossible : ${e.message}</span>`);
  }
}

/* ------------------------------------------------------ builds partagés --
   Une liste d'auteurs, et pour chacun ses builds marqués publics. On ne
   montre QUE le pseudo : l'adresse e-mail ne sort jamais de la base. */
let _partages = null;

async function chargerPartages(silencieux) {
  if (!comptesDispo()) return;
  const note = $('notePartage');
  try {
    if (!silencieux) note.innerHTML = '<span class="pas">Chargement…</span>';
    _partages = await window.Comptes.partages();
    const sel = $('partageAuteur');
    const avant = sel.value;
    sel.innerHTML = '<option value="">— choisis un joueur —</option>'
      + _partages.map((p) =>
          `<option value="${p.pseudo}">${p.pseudo} (${p.builds.length})</option>`).join('');
    if (avant && _partages.some((p) => p.pseudo === avant)) sel.value = avant;
    dessinerBuildsPartages();
    note.innerHTML = _partages.length
      ? `<span class="pas">${_partages.length} joueur(s) partagent des builds.</span>`
      : '<span class="pas">Personne n\'a encore publié de build.</span>';
  } catch (e) {
    note.innerHTML = `<span class="ko">Impossible de charger : ${e.message}</span>`;
  }
}

function dessinerBuildsPartages() {
  const sel = $('partageBuild');
  const auteur = $('partageAuteur').value;
  const p = (_partages || []).find((x) => x.pseudo === auteur);
  sel.innerHTML = p
    ? p.builds.map((b, i) => `<option value="${i}">${b.nom}</option>`).join('')
    : '<option value="">—</option>';
  sel.disabled = !p;
  $('partageCharger').disabled = !p;
  $('partageCopier').disabled = !p;
}

function buildPartageChoisi() {
  const p = (_partages || []).find((x) => x.pseudo === $('partageAuteur').value);
  if (!p) return null;
  return p.builds[Number($('partageBuild').value) || 0] || null;
}

/* Rendre un build enregistré À L'IDENTIQUE.
 *
 * Un build garde son code d'import : c'est la seule chose qui décrit les
 * pièces réellement choisies. Sans ça, rouvrir un build ne faisait que
 * relancer l'optimiseur sur la liste d'affixes, et un panaché 6 Épique +
 * 2 Légendaire ressortait tout doré — « du jaune partout ». On ne recalcule
 * que si aucun code n'a été gardé. */
function restituer(b) {
  if (b && b.code) {
    try {
      afficherCode(b.code);
      return;
    } catch (e) {
      // Code devenu illisible (données du jeu changées) : on retombe sur le
      // calcul plutôt que de ne rien afficher, mais on le DIT.
      $('noteBuilds').innerHTML =
        `<span class="avert">Code du build illisible (${e.message}), `
        + 'le stuff est recomposé à partir des affixes.</span>';
    }
  }
  calculer();
}

function dessinerBuilds() {
  const liste = biblio();
  const boite = $('listeBuilds');
  if (!liste.length) {
    boite.innerHTML = '<div class="vide-liste">Aucun build enregistré.</div>';
    return;
  }
  boite.innerHTML = '';
  liste.forEach((b, i) => {
    const ligne = document.createElement('div');
    ligne.className = 'buildLigne';
    const cl = (D.classes[String(b.etat.c)] || '?');
    const ra = b.etat.g ? (D.raretes[String(b.etat.g)] || '') : 'auto';
    // La case « public » n'a de sens qu'avec un compte : sans lui, il n'y a
    // nulle part où publier. On la montre grisée plutôt que de la cacher,
    // pour que la possibilité soit visible.
    const avecCompte = comptesDispo() && window.Comptes.connecte();
    ligne.innerHTML = `<button class="ouvrir" title="Charger ce build">
        <b>${b.nom}</b><small>${cl} · ${ra} · ${(b.etat.t || []).length} affixe(s)</small>
      </button>
      <label class="pub" title="${avecCompte
        ? 'Rendre ce build visible par les autres'
        : 'Connecte-toi pour publier un build'}">
        <input type="checkbox" ${b.pub ? 'checked' : ''}
               ${avecCompte ? '' : 'disabled'}><span>pub</span></label>
      <button class="suppr" title="Supprimer">×</button>`;
    const casePub = ligne.querySelector('.pub input');
    casePub.onchange = () => {
      const l = biblio();
      l[i] = { ...l[i], pub: casePub.checked };
      if (!ecrireBiblio(l)) { casePub.checked = !casePub.checked; return; }
      window.Comptes.envoyerBuilds([l[i]]).then(() => {
        $('noteBuilds').innerHTML = casePub.checked
          ? `<span class="pas">« ${b.nom} » est maintenant public.</span>`
          : `<span class="pas">« ${b.nom} » n'est plus public.</span>`;
      }).catch((e) => {
        $('noteBuilds').innerHTML = `<span class="ko">${e.message}</span>`;
      });
    };
    ligne.querySelector('.ouvrir').onclick = () => {
      appliquerEtat(b.etat);
      $('noteBuilds').innerHTML = `<span class="pas">« ${b.nom} » chargé.</span>`;
      restituer(b);
    };
    ligne.querySelector('.suppr').onclick = () => {
      const l = biblio();
      const [parti] = l.splice(i, 1);
      if (!ecrireBiblio(l)) return;
      dessinerBuilds();
      if (comptesDispo() && window.Comptes.connecte() && parti) {
        // Sinon la prochaine synchro le ferait réapparaître.
        window.Comptes.supprimerBuild(parti.nom).catch(() => {});
      }
    };
    boite.appendChild(ligne);
  });
}

function enregistrerBuild() {
  const champ = $('nomBuild');
  const nom = (champ.value || '').trim();
  if (!nom) {
    $('noteBuilds').innerHTML = '<span class="ko">Donne un nom au build.</span>';
    champ.focus();
    return;
  }
  if (!cibles.size) {
    $('noteBuilds').innerHTML = '<span class="ko">Choisis au moins un affixe.</span>';
    return;
  }
  const liste = biblio();
  const deja = liste.findIndex((b) => b.nom === nom);
  const etat = etatActuel();
  const entree = { nom, etat, code: etat.k || '',
                   // Réenregistrer un build ne doit pas le dépublier en
                   // douce : on garde son état de partage.
                   pub: deja >= 0 ? !!liste[deja].pub : false };
  if (deja >= 0) liste[deja] = entree; else liste.push(entree);
  if (!ecrireBiblio(liste)) return;
  champ.value = '';
  dessinerBuilds();
  $('noteBuilds').innerHTML =
    `<span class="pas">« ${nom} » ${deja >= 0 ? 'remplacé' : 'enregistré'}.</span>`;
  if (comptesDispo() && window.Comptes.connecte()) {
    window.Comptes.envoyerBuilds([entree]).catch((e) => {
      $('noteBuilds').innerHTML =
        `<span class="ko">Enregistré ici, mais pas sur le compte : ${e.message}</span>`;
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

function calculer() {
  if (!cibles.size) { $('etat').textContent = 'Choisis au moins un affixe.'; return; }
  const classe = Number($('classe').value);
  const arme = $('arme').value || null;
  const grade = $('rarete').value ? Number($('rarete').value) : null;
  const mixte = $('mixte').checked;
  const planchers = {};
  if (mixte && $('plancherActif').checked) {
    const g = Number($('plancherGrade').value);
    for (const c of document.querySelectorAll('#plancherSlots input:checked')) {
      planchers[c.value] = g;
    }
  }
  $('etat').textContent = 'Calcul…';
  const t0 = performance.now();
  setTimeout(() => {
    try {
      const res = construire(classe, arme, [...cibles.entries()], grade,
                             $('vin').checked, mixte, planchers, vinManuel);
      dernier = res;
      afficher(res, classe);
      const raretes = {};
      for (const it of Object.values(res.slotItems)) if (it) raretes[it.g] = (raretes[it.g] || 0) + 1;
      const detail = Object.entries(raretes).sort()
        .map(([g, n]) => `${n} × ${D.raretes[g]}`).join(', ');
      const chrono = `${detail} — calculé en ${Math.round(performance.now() - t0)} ms.`;
      if (res.suffisant) {
        $('etat').innerHTML =
          `<span class="ok">Toutes les cibles sont atteintes.</span><br>${chrono}`;
        return;
      }
      // ÉCHEC : ne pas s'arrêter à « pas atteignable ». Une rareté figée
      // n'escalade JAMAIS, par construction — c'est le piège quand on passe
      // d'un build tout-violet à un build qui a besoin de deux pièces
      // dorées. On cherche donc ce qui marcherait, et on le propose.
      $('etat').innerHTML =
        `<span class="ko">Certaines cibles ne sont pas atteintes.</span><br>${chrono}`
        + '<br><span class="pas">Recherche d\'un réglage qui passe…</span>';
      const issue = chercherUneIssue(classe, arme, grade, mixte, planchers);
      $('etat').innerHTML =
        `<span class="ko">Certaines cibles ne sont pas atteintes.</span><br>${chrono}`
        + (issue ? `<br>${issue}` : '<br><span class="pas">Aucun réglage ne les '
           + 'atteint toutes, même en Légendaire panaché : les cibles sont hors '
           + 'de portée du jeu, pas du réglage.</span>');
    } catch (err) {
      $('etat').innerHTML = `<span class="ko">Erreur : ${err.message}</span>`;
    }
  }, 10);
}

/* Quel réglage atteindrait les cibles ? On essaie, dans l'ordre du moins
   cher au plus cher, et on rend un bouton qui l'applique. Un message qui dit
   seulement « non » est un cul-de-sac ; celui-ci dit « oui, comme ça ». */
function chercherUneIssue(classe, arme, grade, mixte, planchers) {
  const liste = [...cibles.entries()];
  const vin = $('vin').checked;
  const essais = [];
  if (!mixte) {
    essais.push({ cle: 'panache', texte: 'en panachant les raretés',
                  grade, mixte: true });
  }
  if (grade !== null) {
    essais.push({ cle: 'auto', texte: 'en rareté « Auto »',
                  grade: null, mixte });
    if (!mixte) {
      essais.push({ cle: 'auto-panache', texte: 'en « Auto » + panaché',
                    grade: null, mixte: true });
    }
  }
  for (const e of essais) {
    let r;
    try {
      r = construire(classe, arme, liste, e.grade, vin, e.mixte,
                     e.mixte ? planchers : {}, vinManuel);
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
    return `<span class="ok">Ça passe ${e.texte}</span> (${detail}). `
      + '<button id="appliquerIssue" style="padding:3px 9px;font-size:12px">'
      + 'Appliquer</button>';
  }
  return null;
}

function importer() {
  const code = prompt("Colle un code « Import Stuff » du jeu :");
  if (!code) return;
  try {
    afficherCode(code.trim());
  } catch (err) {
    $('etat').innerHTML = `<span class="ko">Code illisible : ${err.message}</span>`;
  }
}

/* AFFICHER UN BUILD TEL QUEL, depuis son code.
 *
 * C'est la différence entre « voici ce que tu avais » et « voici ce que je
 * recomposerais avec les mêmes objectifs ». Un build enregistré doit rendre
 * le PREMIER : sinon un panaché 6 Épique + 2 Légendaire réenregistré puis
 * rouvert ressortait tout en Légendaire, parce que seule la liste d'affixes
 * avait été gardée et que l'optimiseur repartait de zéro. */
function afficherCode(code) {
  {
    const lu = decoderCode(code.trim());
    const parId = new Map();
    for (const pool of Object.values(D.objets)) for (const it of pool) parId.set(it.id, it);
    const slotItems = {};
    const sockets = [];
    const couvert = {};
    let hors = 0;
    for (const e of lu.emplacements) {
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
    cibles.clear();
    for (const [nom, v] of Object.entries(couvert)) cibles.set(nom, Math.min(v, plafond(nom)));
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
    dernier = { slotItems, sockets, couvert, vin: new Set(), suffisant: true, sources: [] };
    afficher(dernier, lu.classe);
    const raretes = {};
    for (const it of Object.values(slotItems)) if (it) raretes[it.g] = (raretes[it.g] || 0) + 1;
    const detail = Object.entries(raretes).sort()
      .map(([g, n]) => `${n} × ${D.raretes[g]}`).join(', ');
    const tete = hors
      ? `<span class="avert">${hors} pièce(s) inconnue(s) du catalogue `
        + 'n\'ont pas été chargées.</span>'
      : '<span class="ok">Build chargé tel quel.</span>';
    $('etat').innerHTML = `${tete}<br>${detail} — <span class="pas">`
      + '« Calculer » recomposerait le stuff à partir des affixes visés.</span>';
    return { hors, raretes };
  }
}

/* ------------------------------------------------------------- démarrage --
   Les données arrivent par une balise <script> et NON par fetch() : ouvert
   depuis le disque (file://), un fetch est refusé par le navigateur et la
   page restait vide — listes d'affixes comprises. */
function demarrer(donnees) {
  D = donnees;
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
  remplirSelect($('rarete'),
    [['', 'Auto — la plus basse qui suffit']].concat(
      [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]])), '');
  // Une case par emplacement : plusieurs pièces peuvent monter ensemble.
  const boite = $('plancherSlots');
  for (const s of D.ordreSlots) {
    const l = document.createElement('label');
    l.className = 'coche mini';
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.value = s;
    l.appendChild(c);
    l.appendChild(document.createTextNode(D.nomsSlots[s] || s));
    boite.appendChild(l);
  }
  remplirSelect($('plancherGrade'),
    [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]]), 6);
  dessinerAffixes();
  majBudgetVin();

  $('classe').onchange = () => { majArmes(); };
  $('recherche').oninput = dessinerAffixes;
  $('vider').onclick = () => {
    cibles.clear(); vinManuel.clear(); dessinerAffixes(); majBudgetVin();
  };
  $('calculer').onclick = calculer;
  $('vin').onchange = majBudgetVin;

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
      ? '<span class="ok">Adresse confirmée, te voilà connecté.</span>'
      : '<span class="ok">Connecté.</span>';
  }
  // Au démarrage ordinaire la synchro est muette (personne n'a rien demandé),
  // mais juste après un lien de confirmation l'utilisateur ATTEND de voir
  // quelque chose se passer : là, on parle.
  if (comptesDispo() && window.Comptes.connecte()) {
    synchroniser(!(retourAuth && retourAuth.connecte));
    window.Comptes.monProfil().then((p) => {
      if (p) $('pseudo').value = p;
    }).catch(() => {});
  }

  // ---------------------------------------------------- builds partagés
  if (comptesDispo()) {
    $('blocPartage').hidden = false;
    chargerPartages(true);
    $('partageAuteur').onchange = dessinerBuildsPartages;
    $('partageRafraichir').onclick = () => chargerPartages(false);
    $('partageCharger').onclick = () => {
      const b = buildPartageChoisi();
      if (!b) return;
      appliquerEtat(b.etat);
      $('notePartage').innerHTML =
        `<span class="pas">« ${b.nom} » chargé — il n'est pas ajouté à tes builds.</span>`;
      restituer(b);
    };
    $('partageCopier').onclick = () => {
      const b = buildPartageChoisi();
      if (!b) return;
      const liste = biblio();
      const nom = liste.some((x) => x.nom === b.nom)
        ? `${b.nom} (copie)` : b.nom;
      liste.push({ nom, etat: b.etat, code: b.code || '', pub: false });
      if (!ecrireBiblio(liste)) return;
      dessinerBuilds();
      $('notePartage').innerHTML =
        `<span class="pas">« ${nom} » ajouté à tes builds (privé).</span>`;
      if (window.Comptes.connecte()) {
        window.Comptes.envoyerBuilds([liste[liste.length - 1]]).catch(() => {});
      }
    };
    $('enregistrerPseudo').onclick = async () => {
      const p = ($('pseudo').value || '').trim();
      const note = $('notePseudo');
      if (p.length < 2 || p.length > 24) {
        note.innerHTML = '<span class="ko">Entre 2 et 24 caractères.</span>';
        return;
      }
      try {
        await window.Comptes.definirPseudo(p);
        note.innerHTML = '<span class="ok">Pseudo enregistré.</span>';
        chargerPartages(true);
      } catch (e) {
        note.innerHTML = /duplicate|unique/i.test(e.message)
          ? '<span class="ko">Ce pseudo est déjà pris.</span>'
          : `<span class="ko">${e.message}</span>`;
      }
    };
  }

  const agirCompte = async (quoi) => {
    const email = ($('compteEmail_in').value || '').trim();
    const mdp = $('compteMdp').value || '';
    const note = $('noteCompte');
    if (!email || !mdp) {
      note.innerHTML = '<span class="ko">Adresse et mot de passe requis.</span>';
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
      note.innerHTML = `<span class="ko">${e.message}</span>`;
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
        '<span class="pas">Déconnecté. Tes builds restent sur cet appareil.</span>';
    };
    $('compteSync').onclick = () => synchroniser(false);
  }

  $('enregistrerBuild').onclick = enregistrerBuild;
  $('nomBuild').onkeydown = (ev) => { if (ev.key === 'Enter') enregistrerBuild(); };
  $('lienBuild').onclick = () => {
    if (!cibles.size) {
      $('noteBuilds').innerHTML = '<span class="ko">Choisis au moins un affixe.</span>';
      return;
    }
    const lien = location.origin + location.pathname + '#b=' + versLien(etatActuel());
    history.replaceState(null, '', '#b=' + versLien(etatActuel()));
    $('noteBuilds').innerHTML =
      `<span class="pas">Lien dans la barre d'adresse — copie-la pour partager ce build.</span>`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lien).then(() => {
        $('noteBuilds').innerHTML = '<span class="pas">Lien du build copié.</span>';
      }, () => {});
    }
  };
  $('exporterBuilds').onclick = () => {
    const liste = biblio();
    if (!liste.length) {
      $('noteBuilds').innerHTML = '<span class="ko">Rien à exporter.</span>';
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
      `<span class="pas">${liste.length} build(s) exporté(s).</span>`;
  };
  $('importerBuilds').onclick = () => $('fichierBuilds').click();
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
          $('noteBuilds').innerHTML =
            `<span class="pas">${ajoutes} ajouté(s), ${venus.length - ajoutes} remplacé(s).</span>`;
        }
      } catch (e) {
        $('noteBuilds').innerHTML =
          `<span class="ko">Fichier illisible : ${e.message}</span>`;
      }
      ev.target.value = '';
    };
    lecteur.readAsText(f);
  };
  $('mixte').onchange = () => { $('blocPlancher').hidden = !$('mixte').checked; };
  $('importer').onclick = importer;
  $('copier').onclick = () => {
    // navigator.clipboard n'existe pas sur une page ouverte depuis le disque
    // (contexte non sécurisé) : sans ce repli, le bouton ne faisait rien du
    // tout et rien ne le disait.
    const champ = $('code');
    const dire = (ok) => {
      $('noteCode').textContent = ok
        ? 'Copié. Colle-le dans Prepare → Manage/Import.'
        : 'Copie impossible ici — le code est sélectionné, fais Ctrl+C.';
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
  $('etat').textContent = 'Prêt.';
}

if (window.D_MISTFALL) {
  demarrer(window.D_MISTFALL);
} else {
  // Repli pour un vrai serveur web, si donnees.js n'a pas été engendré.
  fetch('donnees.json').then((r) => r.json()).then(demarrer).catch((e) => {
    $('etat').innerHTML =
      `<span class="ko">Données introuvables : ${e.message}</span>`;
  });
}
