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
const prefs = new Map();            // affixe -> 'bonus' | 'non'
const CYCLE_PREF = [undefined, 'bonus', 'non'];
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

/* Redescend chaque pièce aussi bas que possible SANS perdre une cible.
 *
 * La recherche d'objets optimise la couverture ; la rareté n'y est qu'un
 * départage de dernier recours, donc elle sur-améliore. Une fois les cibles
 * atteintes, tout cran de rareté en trop est du gaspillage. Un échange n'est
 * accepté que s'il garde TOUTES les cibles : la passe ne peut donc jamais
 * dégrader un build, seulement l'alléger. Mesuré : 8 Légendaires -> 2
 * Légendaires + 5 Épiques + 1 Excellent sur un build réel. */
function alleger(slotItems, classe, arme, cibleListe, planchers, vinPoints, tours) {
  const want = Object.fromEntries(cibleListe);
  const tient = (items) => {
    const a = assembler(items, want, false);
    return cibleListe.every(([n, l]) =>
      (a.couvert[n] || 0) + (vinPoints.get(n) || 0) >= l);
  };
  if (!tient(slotItems)) return slotItems;

  let courant = { ...slotItems };
  const options = {};
  for (const slot of D.ordreSlots) {
    options[slot] = poolDe(classe, slot, arme,
                           Math.max(1, planchers[slot] || 0), true);
  }
  for (let t = 0; t < (tours || 4); t += 1) {
    let bouge = false;
    const ordre = [...D.ordreSlots].sort(
      (a, b) => ((courant[b] && courant[b].g) || 0) - ((courant[a] && courant[a].g) || 0));
    for (const slot of ordre) {
      const actuel = courant[slot];
      if (!actuel) continue;
      const sol = planchers[slot] || 0;
      const cands = options[slot]
        .filter((o) => o.g < actuel.g && o.g >= sol)
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
  res.suffisant = suffit(res);

  // ALLÈGEMENT FINAL, uniquement en panaché : à rareté unique toutes les
  // pièces partagent le même cran, il n'y a rien à rendre.
  if (mixte && res.suffisant) {
    const legers = alleger(res.slotItems, classe, arme, cibleListe,
                           planchers, vinPoints);
    if (sommeRaretes(legers) < sommeRaretes(res.slotItems)) {
      const a = assembler(legers, want, true);
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
  const want = Object.fromEntries(cibleListe);
  const items = { ...res.slotItems };
  const tot = (cov, n) => Math.min(plafond(n), (cov[n] || 0) + (vinPoints.get(n) || 0));

  // LES PALIERS DÉJÀ FRANCHIS COMPTENT AUTANT QUE LES CIBLES. Un affixe visé
  // à 3 mais obtenu à 5 franchit son palier ; le laisser redescendre à 3
  // respecterait la cible tout en perdant le bonus, sans que rien ne le
  // dise. On relève donc ce qui est franchi, et on l'exige aussi.
  const base = assembler(items, want, false).couvert;
  const paliersTenus = [];
  for (const n of Object.keys(base)) {
    const p = palier(n);
    if (p && tot(base, n) >= p) paliersTenus.push([n, p]);
  }
  const tient = (cov) => cibleListe.every(([n, l]) => tot(cov, n) >= l)
    && paliersTenus.every(([n, p]) => tot(cov, n) >= p);

  const sortie = [];
  for (const slot of D.ordreSlots) {
    const actuel = items[slot];
    if (!actuel) continue;
    const opts = poolDe(classe, slot, arme, Math.max(1, planchers[slot] || 0), true);
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
      const cov = assembler({ ...items, [slot]: alt }, want, false).couvert;
      if (!tient(cov)) continue;
      bonnes.push({ item: alt, actuel: false });
    }
    if (bonnes.length > 1) sortie.push({ slot, bonnes });
  }
  return sortie;
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
  // La référence est mesurée COMME les essais (pose gloutonne). Comparer une
  // pose exacte à des poses gloutonnes faisait paraître perdant tout
  // échange, et la fonction ne rendait jamais rien.
  const base = assembler(items, want, false).couvert;
  const tot = (cov, n) => Math.min(plafond(n), (cov[n] || 0) + (vinPoints.get(n) || 0));
  const tient = (cov) => cibleListe.every(([n, l]) => tot(cov, n) >= l);

  const sortie = [];
  for (const slot of D.ordreSlots) {
    const actuel = items[slot];
    if (!actuel) continue;
    const opts = poolDe(classe, slot, arme, Math.max(1, planchers[slot] || 0), true);
    // LA RARETÉ NE SE TOUCHE JAMAIS. Le bouton « panacher » et les planchers
    // par emplacement existent pour ça : c'est l'utilisateur qui décide
    // quelle pièce monte. Une suggestion ne propose qu'une AUTRE pièce du
    // MÊME cran, pour son inné ou ses emplacements.
    let meilleur = null;
    for (const alt of opts) {
      if (alt === actuel || alt.g !== actuel.g) continue;
      const essai = { ...items, [slot]: alt };
      const cov = assembler(essai, want, false).couvert;
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
function infobulle(it) {
  const bouts = [it.n, D.raretes[String(it.g)]];
  const st = statsLisibles(it.at);
  if (st) bouts.push(st);
  if (it.i) bouts.push(t('equip.inne') + ' ' + it.i);
  if (it.d) bouts.push(it.d);
  return bouts.filter(Boolean).join('\n');
}

/* Le vin ne se règle que sur un affixe qu'on VISE. Griser la case le dit à
   l'écran plutôt que de laisser croire à un réglage qui ne compte pas. */
function majEtatVin(ligne) {
  const nom = ligne.dataset.affixe;
  const vin = ligne.querySelector('.vin');
  if (!vin) return;
  const compte = $('vin').checked;
  const vise = cibles.has(nom);
  vin.disabled = !vise || !compte;
  // On remet la case sur « auto » : la laisser afficher « +2 » alors que
  // l'affixe n'est plus visé donnerait un réglage qui ne compte pas.
  if (!vise) vin.value = '';
  vin.title = !compte ? t('affixes.vinEteint')
    : (vise ? t('affixes.vinTitre', { max: D.vin.max, bonus: D.vin.bonus })
            : t('affixes.vinSansCible'));
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
  const budget = D.vin.max * D.vin.bonus;
  const demande = [...vinManuel.values()].reduce((s, v) => s + v, 0);
  const auto = !vinManuel.size;
  const trop = !auto && (demande > budget || vinManuel.size > D.vin.max);
  el.className = trop ? 'ko' : 'pas';
  el.textContent = auto
    ? t('vin.auto', { total, budget })
    : t(trop ? 'vin.trop' : 'vin.manuel',
        { total, budget, n: retenu.size, max: D.vin.max });
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
      <small>${t('affixes.max')} ${info.cap}${sansGemme ? ' · ' + t('affixes.vinSeul') : ''}</small></span>`;
    ligne.title = (info.desc || '') + (info.eff ? '\n\n' + info.eff
      .map((e, i) => `${i + 1}. ${e}`).join('\n') : '');

    const sel = document.createElement('select');
    sel.className = 'niveau';
    sel.title = t('affixes.niveauVise');
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
    vin.innerHTML = `<option value="">${t('affixes.auto')}</option>`
      + Array.from({ length: D.vin.bonus + 1 },
                   (_, i) => `<option value="${i}">${i ? '+' + i : '—'}</option>`).join('');
    vin.value = vinManuel.has(nom) ? String(vinManuel.get(nom)) : '';
    vin.onchange = () => {
      if (vin.value === '') vinManuel.delete(nom);
      else vinManuel.set(nom, Number(vin.value));
      majBudgetVin();
    };
    ligne.appendChild(vin);

    const pref = document.createElement('button');
    pref.className = 'pref';
    const majPref = () => {
      const v = prefs.get(nom);
      pref.dataset.etat = v || 'neutre';
      pref.textContent = v === 'bonus' ? '★' : (v === 'non' ? '✕' : '☆');
      pref.title = t(v === 'bonus' ? 'pref.bonus'
                     : (v === 'non' ? 'pref.non' : 'pref.neutre'));
    };
    pref.onclick = () => {
      const i = CYCLE_PREF.indexOf(prefs.get(nom));
      const suivant = CYCLE_PREF[(i + 1) % CYCLE_PREF.length];
      if (suivant) prefs.set(nom, suivant); else prefs.delete(nom);
      majPref();
      if (dernier) setTimeout(() => dessinerSuggestions(dernier,
        Number($('classe').value)), 0);
    };
    majPref();
    ligne.appendChild(pref);

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
        <span>${s.gem ? `<b>${s.gem.n}</b>` : `<span class="pas">${t('equip.vide')}</span>`}
          <span class="mat">${materiau(s.type, s.level)} ${s.level === 2 ? 'II' : 'I'}</span></span>
      </div>`).join('');
    carte.style.setProperty('--tinte', couleur);
    carte.style.borderColor = couleur + '66';
    carte.title = infobulle(it);
    carte.innerHTML = `<div class="slot">${D.nomsSlots[slot] || slot}</div>
      ${vignette(it.ic, couleur)}
      <div class="nom" style="color:${couleur}">${it.n}</div>
      <div class="inne${it.i ? '' : ' sans'}">${it.i ? t('equip.inne') + ' ' + it.i : t('equip.aucunInne')}</div>
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
    ? `<table><tr><th>${t('table.affixe')}</th><th>${t('table.vise')}</th>`
      + `<th>${t('table.equip')}</th><th>${t('table.vin')}</th>`
      + `<th>${t('table.total')}</th></tr>${lignes}</table>`
      + (bonus ? `<div style="margin-top:6px" class="pas">${t('table.prime')} ${bonus}</div>` : '')
    : `<span class="pas">${t('table.aucun')}</span>`;

  // En différé : chercher les suggestions coûte presque autant qu'un build,
  // et le faire ici retarderait l'affichage de tout le reste pour rien.
  setTimeout(() => { dessinerSuggestions(res, classe);
                     dessinerAlternatives(res, classe);
                     dessinerFiche(res, classe); }, 0);

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
    $('noteCode').textContent = t('code.impossible', { message: err.message });
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
    dire(`<span class="pas">Synchronisé : ${fusion.length} build(s), `
         + `${recus} récupéré(s) du compte.</span>`);
  } catch (e) {
    dire(`<span class="ko">Synchronisation impossible : ${e.message}</span>`);
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
      note.innerHTML = `<span class="pas">${t('ami.deja', { nom: trouve.pseudo })}</span>`;
      return;
    }
    liste.push({ pseudo: trouve.pseudo });
    ecrireAmis(liste);
    champ.value = '';
    note.innerHTML = `<span class="ok">${t('ami.ajoute', { nom: trouve.pseudo })}</span>`;
    dessinerAmis();
  } catch (e) {
    note.innerHTML = `<span class="ko">${e.message}</span>`;
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
    bloc.innerHTML = `<div class="amiTete"><b>${a.pseudo}</b>
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
        dedans.innerHTML = `<span class="pas">${t('ami.rien', { nom: a.pseudo })}</span>`;
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
  el.innerHTML = `<div class="bd"><b>${b.nom}</b>
      <small>${cl}${auteur ? ' · ' + t('gal.par') + ' ' + auteur : ''}</small></div>
    <button class="bdCharger">${t('gal.charger')}</button>
    <button class="bdCopier">${t('gal.copier')}</button>`;
  el.querySelector('.bdCharger').onclick = () => {
    appliquerEtat(b.etat);
    restituer(b);
  };
  el.querySelector('.bdCopier').onclick = () => {
    const liste = biblio();
    const nom = liste.some((x) => x.nom === b.nom) ? `${b.nom} (copie)` : b.nom;
    liste.push({ nom, etat: b.etat, code: b.code || '', pub: false, ami: false });
    if (!ecrireBiblio(liste)) return;
    dessinerBuilds();
    $('noteBuilds').innerHTML =
      `<span class="pas">${t('partage.copieOk', { nom })}</span>`;
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
  const puces = cibles.slice(0, 6)
    .map(([n, l]) => `<span class="puce">${n} ${l}</span>`).join('');
  const reste = cibles.length > 6 ? `<span class="puce">+${cibles.length - 6}</span>` : '';
  const quand = b.maj ? new Date(b.maj).toLocaleDateString() : '';
  el.innerHTML = `<h4>${echapper(b.nom)}</h4>
    <div class="meta">
      <span class="auteur">${b.auteur ? echapper(b.auteur) : t('gal.anonyme')}</span>
      <span>${cl}</span><span>${e.a || ''}</span><span>${ra}</span>
      ${quand ? `<span>${quand}</span>` : ''}
    </div>
    <div class="puces">${puces}${reste}</div>
    <div class="actions">
      <button class="bdCharger">${t('gal.charger')}</button>
      <button class="bdCode" ${b.code ? '' : 'disabled'}>${t('gal.code')}</button>
      <button class="bdCopier">${t('gal.copier')}</button>
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
      `<span class="pas">${t('partage.copieOk', { nom })}</span>`;
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
    note.innerHTML = `<span class="ko">${t('partage.ko', { message: e.message })}</span>`;
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
      afficherCode(code);
      return;
    } catch (e) {
      // Code devenu illisible (données du jeu changées) : on retombe sur le
      // calcul plutôt que de ne rien afficher, mais on le DIT.
      $('noteBuilds').innerHTML =
        `<span class="avert">Code du build illisible (${e.message}), `
        + t('builds.codeKo', { message: e.message }) + '</span>';
    }
  } else if (b && b.nom) {
    // BUILD D'AVANT LA CORRECTION. Il ne contient que des objectifs, pas de
    // stuff. Le recomposer donnera autre chose que ce qui avait été vu, et
    // c'est exactement ce qui donnait « du jaune partout » sans explication.
    $('noteBuilds').innerHTML =
      `<span class="avert">« ${b.nom} » a été enregistré avant que les builds `
      + 'gardent leur stuff : il n\'y a que les affixes, le stuff est donc '
      + t('builds.vieux', { nom: b.nom }) + '</span>';
  }
  calculer();
}

/* Le filtre de la bibliothèque locale. Il ne trie pas une liste de trois
   builds : les contrôles restent cachés tant qu'il n'y en a pas assez pour
   que chercher coûte moins cher que parcourir. */
const SEUIL_FILTRES = 6;
const bEtat = { recherche: '', classe: '', rarete: '', tri: 'nom' };

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
    for (const e of lu.emplacements || []) {
      const g = Number(String(e.cfg)[2]);
      if (g >= 1 && g <= 8) grades.add(g);
    }
    if (grades.size) {
      sortie = { grades: [...grades].sort((x, y) => x - y),
                 panache: grades.size > 1 };
    }
  } catch (e) { /* code illisible : on ne prétend rien */ }
  _raretesCache.set(code, sortie);
  return sortie;
}

function etiquetteRarete(b) {
  const r = raretesDuBuild(b);
  if (!r) return b.etat.g ? (D.raretes[String(b.etat.g)] || '') : t('perso.auto');
  if (!r.panache) return D.raretes[String(r.grades[0])] || '';
  return `${t('perso.mixte')} ${r.grades.map((g) => D.raretes[String(g)]).join(' + ')}`;
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

function dessinerBuilds() {
  const toute = biblio();
  const boite = $('listeBuilds');
  const filtres = $('filtresBuilds');
  if (filtres) filtres.hidden = toute.length < SEUIL_FILTRES;
  if (!toute.length) {
    boite.innerHTML = `<div class="vide-liste">${t('builds.vide')}</div>`;
    if ($('compteBuilds')) $('compteBuilds').textContent = '';
    return;
  }
  const liste = toute.length < SEUIL_FILTRES ? toute : filtrerBuilds(toute);
  if ($('compteBuilds')) {
    $('compteBuilds').textContent = liste.length === toute.length
      ? '' : t('mesb.compte', { n: liste.length, total: toute.length });
  }
  boite.innerHTML = '';
  if (!liste.length) {
    boite.innerHTML = `<div class="vide-filtre">${t('mesb.rien')}</div>`;
    return;
  }
  liste.forEach((b) => {
    // L'index doit désigner la ligne dans la bibliothèque ENTIÈRE : après
    // filtrage, l'index de la vue supprimerait le mauvais build.
    const i = toute.findIndex((x) => x.nom === b.nom);
    const ligne = document.createElement('div');
    ligne.className = 'buildLigne';
    const cl = (D.classes[String(b.etat.c)] || '?');
    // La rareté RÉELLEMENT portée, pas le réglage : « Auto » ne dit rien à
    // qui relit sa liste trois semaines plus tard.
    const ra = etiquetteRarete(b);
    // La case « public » n'a de sens qu'avec un compte : sans lui, il n'y a
    // nulle part où publier. On la montre grisée plutôt que de la cacher,
    // pour que la possibilité soit visible.
    const avecCompte = comptesDispo() && window.Comptes.connecte();
    const fige = !!(b.code || (b.etat && b.etat.k));
    const titre = fige
      ? t('builds.charger')
      : t('builds.chargerVieux');
    ligne.innerHTML = `<button class="ouvrir" title="${titre}">
        <b>${b.nom}${fige ? '' : ' <i>⚠</i>'}</b>
        <small>${cl} · ${ra} · ${t('builds.affixes', { n: (b.etat.t || []).length })}</small>
      </button>
      <label class="ami" title="${avecCompte
        ? t('ami.marque') : t('ami.marqueNon')}">
        <input type="checkbox" ${b.ami ? 'checked' : ''}
               ${avecCompte ? '' : 'disabled'}><span>ami</span></label>
      <label class="pub" title="${avecCompte
        ? t('builds.public')
        : t('builds.publicNon')}">
        <input type="checkbox" ${b.pub ? 'checked' : ''}
               ${avecCompte ? '' : 'disabled'}><span>pub</span></label>
      <button class="suppr" title="${t('builds.supprimer')}">×</button>`;
    const brancher = (sel, cle, cleOui, cleNon) => {
      const c = ligne.querySelector(sel);
      if (!c) return;
      c.onchange = () => {
        const l = biblio();
        l[i] = { ...l[i], [cle]: c.checked };
        if (!ecrireBiblio(l)) { c.checked = !c.checked; return; }
        window.Comptes.envoyerBuilds([l[i]]).then(() => {
          $('noteBuilds').innerHTML = `<span class="pas">`
            + t(c.checked ? cleOui : cleNon, { nom: b.nom }) + '</span>';
        }).catch((e) => {
          $('noteBuilds').innerHTML = `<span class="ko">${e.message}</span>`;
        });
      };
    };
    // Deux visibilités distinctes, indépendantes : « ami » se donne avec un
    // code, « pub » entre dans la galerie. Un build peut être l'un, l'autre,
    // les deux, ou rien — c'est le défaut.
    brancher('.pub input', 'pub', 'builds.estPublic', 'builds.plusPublic');
    brancher('.ami input', 'ami', 'ami.marque', 'ami.marque');
    ligne.querySelector('.ouvrir').onclick = () => {
      appliquerEtat(b.etat);
      $('noteBuilds').innerHTML = `<span class="pas">${t('builds.chargeOk', { nom: b.nom })}</span>`;
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
    $('noteBuilds').innerHTML = `<span class="ko">${t('builds.nomRequis')}</span>`;
    champ.focus();
    return;
  }
  if (!cibles.size) {
    $('noteBuilds').innerHTML = `<span class="ko">${t('builds.affixeRequis')}</span>`;
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
    `<span class="pas">${t(deja >= 0 ? 'builds.remplace' : 'builds.enregistre', { nom })}</span>`;
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

/* Les suggestions à l'écran. On PROPOSE : chaque ligne a son bouton, rien
   n'est appliqué tant qu'on ne clique pas. Une carte vide disparaît plutôt
   que d'afficher « aucune suggestion » à longueur de build. */
function dessinerSuggestions(res, classe) {
  const carte = $('blocSuggestions');
  const boite = $('listeSuggestions');
  if (!carte || !res || !res.slotItems) return;
  let liste = [];
  try {
    const pl = {};
    if ($('mixte').checked && $('plancherActif').checked) {
      const gr = Number($('plancherGrade').value);
      for (const c of document.querySelectorAll('#plancherSlots input:checked')) {
        pl[c.value] = gr;
      }
    }
    liste = suggestions(res, classe, $('arme').value || null,
                        [...cibles.entries()], pl,
                        res.vinPoints || new Map());
  } catch (e) {
    liste = [];
  }
  carte.hidden = !liste.length;
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
      const etiq = pal ? ' · ' + t('sugg.palier')
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
        <div class="qui"><span style="color:${couleurA}">${e.avant.n}</span>
          → <span style="color:${couleurB}">${e.apres.n}</span></div>
        <div class="pu">${puces}</div>
      </div>
      <button class="appl">Appliquer</button>`;
    div.querySelector('.appl').onclick = () => {
      const neufs = { ...res.slotItems, [e.slot]: e.apres };
      const a = assembler(neufs, Object.fromEntries(cibles), true);
      const majeur = { slotItems: neufs, sockets: a.sockets, couvert: a.couvert,
                       sources: a.sources, vin: res.vin,
                       vinPoints: res.vinPoints, suffisant: true };
      dernier = majeur;
      afficher(majeur, classe);
      $('etat').innerHTML = '<span class="ok">Suggestion appliquée</span>'
        + `<span class="pas"> — ${e.avant.n} remplacé par ${e.apres.n}. `
        + t('etat.suggAppNote', { avant: avant, apres: apres }) + '</span>';
    };
    boite.appendChild(div);
  });
}

/* Les pièces interchangeables, à l'écran. Une ligne par emplacement, la
   pièce en place marquée, les autres cliquables. Rien n'est appliqué sans
   clic — comme les suggestions. */
function dessinerAlternatives(res, classe) {
  const carte = $('blocAlternatives');
  const boite = $('listeAlternatives');
  if (!carte || !res || !res.slotItems) return;
  let liste = [];
  try {
    const pl = {};
    if ($('mixte').checked && $('plancherActif').checked) {
      const gr = Number($('plancherGrade').value);
      for (const c of document.querySelectorAll('#plancherSlots input:checked')) {
        pl[c.value] = gr;
      }
    }
    liste = alternatives(res, classe, $('arme').value || null,
                         [...cibles.entries()], pl, res.vinPoints || new Map());
  } catch (e) { liste = []; }
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
      el.innerHTML = `${b.item.n}<small>${b.item.i
        ? t('equip.inne') + ' ' + b.item.i : t('equip.aucunInne')}</small>`;
      el.title = b.actuel ? t('alt.actuel') : t('alt.poser');
      if (!b.actuel) {
        el.onclick = () => {
          const neufs = { ...res.slotItems, [e.slot]: b.item };
          const a = assembler(neufs, Object.fromEntries(cibles), true);
          const vp = res.vinPoints || new Map();
          // On REVÉRIFIE après coup : c'est le seul moment où l'on connaît
          // l'effet combiné de tous les échanges déjà faits.
          const manques = [...cibles.entries()].filter(([n, l]) =>
            Math.min(plafond(n), (a.couvert[n] || 0) + (vp.get(n) || 0)) < l);
          const maj = { slotItems: neufs, sockets: a.sockets, couvert: a.couvert,
                        sources: a.sources, vin: res.vin,
                        vinPoints: vp, suffisant: !manques.length };
          dernier = maj;
          afficher(maj, classe);
          $('etat').innerHTML = manques.length
            ? `<span class="ko">${t('alt.perdu')}</span><span class="pas"> — `
              + manques.map(([n, l]) => `${n} ${l}`).join(', ') + '.</span>'
            : `<span class="ok">${t('alt.pose')}</span>`
              + `<span class="pas"> — ${b.item.n}.</span>`;
        };
      }
      rangee.appendChild(el);
    }
    bloc.appendChild(rangee);
    boite.appendChild(bloc);
  }
}

function calculer() {
  if (!cibles.size) { $('etat').textContent = t('etat.choisir'); return; }
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
  $('etat').textContent = t('etat.calcul');
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
      const chrono = t('etat.chrono',
                       { detail, ms: Math.round(performance.now() - t0) });
      if (res.suffisant) {
        $('etat').innerHTML =
          `<span class="ok">${t('etat.ok')}</span><br>${chrono}`;
        return;
      }
      // ÉCHEC : ne pas s'arrêter à « pas atteignable ». Une rareté figée
      // n'escalade JAMAIS, par construction — c'est le piège quand on passe
      // d'un build tout-violet à un build qui a besoin de deux pièces
      // dorées. On cherche donc ce qui marcherait, et on le propose.
      $('etat').innerHTML =
        `<span class="ko">${t('etat.ko')}</span><br>${chrono}`
        + `<br><span class="pas">${t('etat.recherche')}</span>`;
      const issue = chercherUneIssue(classe, arme, grade, mixte, planchers);
      $('etat').innerHTML =
        `<span class="ko">${t('etat.ko')}</span><br>${chrono}`
        + (issue ? `<br>${issue}` : `<br><span class="pas">${t('etat.rien')}</span>`);
    } catch (err) {
      $('etat').innerHTML = `<span class="ko">${t('etat.erreur', { message: err.message })}</span>`;
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
    return `<span class="ok">${t('etat.issue', { comment: e.texte })}</span> (${detail}). `
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
    $('etat').innerHTML = `<span class="ko">${t('etat.codeIllisible', { message: err.message })}</span>`;
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
        + t('etat.horsCatalogue', { n: perdus }) + '</span>'
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
// Quels groupes l'utilisateur a ouverts : un redessin ne doit pas les
// refermer sous ses doigts.
const _ecolesOuvertes = new Set();
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
    return `<span class="mini" style="--tinte:${couleur}" title="${infobulle(it)}">
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
    ${carteStat(t('fiche.resPhys'), pc(f.resistPhysique), '', false, 'defense')}
    ${carteStat(t('fiche.resMag'), pc(f.resistMagique), '', false, 'defense')}
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
        pastille((D.affixes[a.nom] || {}).cat)}${a.nom}
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

function dessinerSorts(res, classeId, f) {
  const boite = $('listeSorts');
  if (!boite || !window.Fiche) return;
  const nomClasse = D.classes[String(classeId)];
  const tous = window.Fiche.competencesDe(nomClasse);
  const arme = ($('arme') || {}).value || '';
  const filtrer = ($('sortsArme') || {}).checked;
  const memeArme = (s) => !arme || !s.arme
    || s.arme.split(' / ').some((a) => a === arme);
  const liste = filtrer ? tous.filter(memeArme) : tous;
  const cible = cibleCourante(f);

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
    const pertinent = !arme || membres.some(memeArme);
    bloc.open = _ecolesOuvertes.has(titre) || (!_ecolesOuvertes.size && pertinent);
    const chiffrees = membres.filter((s) => s.coups.length).length;
    bloc.innerHTML = `<summary><b>${echapper(titre)}</b>
      <small>${membres.length} · ${t('sorts.chiffrees', { n: chiffrees })}</small></summary>
      <div class="grilleSorts"></div>`;
    bloc.addEventListener('toggle', () => {
      if (bloc.open) _ecolesOuvertes.add(titre); else _ecolesOuvertes.delete(titre);
    });
    boite.appendChild(bloc);
    remplirGroupe(bloc.querySelector('.grilleSorts'), membres,
                  f, cible, memeArme, res, classeId);
  }
  dessinerDetailSort(liste.find((s) => s.nom === _sortChoisi), f, cible,
                     res, classeId);
}

function remplirGroupe(boite, membres, f, cible, memeArme, res, classeId) {
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
        <span class="n">${echapper(s.nom)}</span>
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
  if (!s.coups.length) {
    boite.innerHTML = entete + description
      + `<p class="pas">${t('sorts.riendePublie')}</p>`;
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
    ${(s.effets || []).length ? `<table style="margin-top:8px">${
      s.effets.map(([k, v]) => `<tr><td>${echapper(k)}</td>
        <td class="n">${echapper(v)}</td></tr>`).join('')}</table>` : ''}`;

  for (const b of boite.querySelectorAll('.branches button')) {
    b.onclick = () => {
      _brancheChoisie = Number(b.dataset.b);
      dessinerSorts(res, classeId, f);
    };
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
  for (const brute of lignes) {
    const l = brute.trim();
    if (!l) { fermer(); continue; }
    if (l.startsWith('#')) {
      fermer();
      sortie.push(`<h4>${echapper(l.replace(/^#+\s*/, ''))}</h4>`);
    } else if (l.startsWith('-') || l.startsWith('*')) {
      if (!liste) { sortie.push('<ul>'); liste = true; }
      sortie.push(`<li>${echapper(l.slice(1).trim())}</li>`);
    } else {
      fermer();
      sortie.push(`<p>${echapper(l)}</p>`);
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
    note.innerHTML = `<span class="ko">${t('partage.ko', { message: e.message })}</span>`;
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
      corps.innerHTML = `<span class="ko">${e.message}</span>`;
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
    $('noteGuide').innerHTML = `<span class="ko">${e.message}</span>`;
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
    note.innerHTML = `<span class="ko">${t('partage.ko', { message: e.message })}</span>`;
  }
}

function montrerPage(id) {
  for (const el of document.querySelectorAll('main, .page')) {
    el.hidden = (id === 'main') ? (el.tagName !== 'MAIN') : (el.id !== id);
  }
  // La fiche vit hors de <main> (la colonne collante la recouvrait dedans),
  // donc la boucle ci-dessus ne la voit pas : elle suit l'onglet Builder et
  // ne s'affiche que si un build a été calculé.
  const fiche = $('blocFiche');
  if (fiche) fiche.hidden = (id !== 'main') || !dernier;
  for (const b of document.querySelectorAll('#nav button')) {
    b.classList.toggle('actif', b.dataset.page === id);
  }
  if (id === 'pageGalerie' && !_galerieChargee) {
    _galerieChargee = true;
    chargerGalerie(0);
  }
  if (id === 'pageGuides' && !_guidesCharges) {
    _guidesCharges = true;
    chargerGuides(0);
    chargerMesGuides();
  }
  window.scrollTo({ top: 0 });
}

function poserNavigation() {
  for (const b of document.querySelectorAll('#nav button')) {
    b.onclick = () => montrerPage(b.dataset.page);
    // Sans compte branché, ces deux onglets n'ont rien à montrer : un
    // onglet qui ouvre sur du vide est pire que pas d'onglet.
    if (b.dataset.page !== 'main' && !comptesDispo()) b.hidden = true;
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
  if (!D) return;
  remplirSelect($('rarete'),
    [['', t('perso.auto')]].concat(
      [1, 2, 3, 4, 5, 6].map((g) => [g, D.raretes[String(g)]])),
    $('rarete').value);
  dessinerAffixes();
  majBudgetVin();
  if (window._poserFiltresBuilds) window._poserFiltresBuilds();
  dessinerBuilds();
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
      ['recent', t('gal.tri.recent')], ['ancien', t('gal.tri.ancien')],
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

function demarrer(donnees) {
  D = donnees;
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
      ['recent', t('gal.tri.recent')], ['ancien', t('gal.tri.ancien')],
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
        `<span class="pas">${t('compte.deconnecteOk')}</span>`;
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
  $('etat').textContent = t('etat.pret');
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
