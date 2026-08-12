/* FICHE DE PERSONNAGE ET DÉGÂTS RÉELS.
 *
 * D'OÙ VIENNENT LES NOMBRES. Aucun n'est estimé :
 *
 *   - les stats de départ (Attack 100, Defense 50, Health 618, augmentation
 *     critique) viennent des pages de classe du wiki, récoltées dans
 *     skills.js ;
 *   - les stats des objets viennent du jeu lui-même (bloc `at` de chaque
 *     pièce du catalogue) ;
 *   - les effets d'affixes viennent des libellés du jeu, lus au niveau
 *     réellement atteint par le build ;
 *   - la courbe Défense → réduction et la formule de dégâts viennent de la
 *     page /mechanics/ du wiki, citée dans skills.js.
 *
 * LA FORMULE, TELLE QUE PUBLIÉE :
 *
 *   dégâts = Attack × coefficient
 *                   × (1 − réduction de défense)
 *                   × (1 + bonus de dégâts de l'attaquant)
 *                   × (1 − résistance de la cible)
 *   réduction = max(courbe(Défense) − pénétration, 0)
 *
 * CE QUE LE JEU NE PUBLIE PAS, ET QUE JE N'INVENTE PAS. La résistance des
 * monstres n'est publiée nulle part : elle vaut 0 dans le calcul, et
 * l'écran le dit. Le coup critique non plus n'entre pas dans le calcul :
 * on connaît l'augmentation critique de la classe, pas le taux de critique.
 * Les dégâts affichés sont donc des dégâts NON critiques.
 */
(function () {
  'use strict';

  /* ------------------------------------------------- effets des affixes --
   * Les libellés du jeu sont des phrases : « Defense +75. Physical
   * Resistance +2.5%. ». On les lit plutôt que de recopier des tables à la
   * main, qui divergeraient au premier patch.
   *
   * L'ORDRE COMPTE. « Defense Penetration » contient « Defense », et
   * « Critical Damage Resistance » contient « Damage » : les motifs sont
   * essayés du plus long au plus court, faute de quoi la pénétration serait
   * comptée comme de la défense plate. */
  const EFFETS = [
    ['Gyldhunter Knockdown Cooldown Refund', 'gyldhunter', '%'],
    ['Skill Energy Cost Reduction', 'coutCompetence', '%'],
    ['Dodge Energy Cost Reduction', 'coutEsquive', '%'],
    ['Block Damage Reduction Rate', 'blocageReduction', '%'],
    ['Block Energy Cost Reduction', 'coutBlocage', '%'],
    ['Critical Damage Resistance', 'resistCritique', '%'],
    ['Amount of Gyldenblod dropped', 'gyldenblod', '%'],
    ['Fall Damage Resistance', 'resistChute', '%'],
    ['Skill Cooldown Speed', 'vitesseRecharge', '%'],
    ['Defense Penetration', 'penetration', '%'],
    ['Physical Resistance', 'resistPhysique', '%'],
    ['Construct Duration', 'dureeConstruct', '%'],
    ['Execution Damage', 'degatsExecution', '%'],
    ['Magic Resistance', 'resistMagique', '%'],
    ['Maximum Health', 'viePourcent', '%'],
    ['Maximum Energy', 'energiePlate', ''],
    ['Physical Damage', 'degatsPhysiques', '%'],
    ['Shield Strength', 'forceBouclier', '%'],
    ['Chanting Speed', 'vitesseIncant', '%'],
    ['Movement Speed', 'vitesseDepl', '%'],
    ['Charging Speed', 'vitesseCharge', '%'],
    ['Debuff Duration', 'dureeMalus', '%'],
    ['Effective Range', 'portee', '%'],
    ['Buff Duration', 'dureeBonus', '%'],
    ['Magic Damage', 'degatsMagiques', '%'],
    // « Springhorn Healing » AVANT « Healing » : sans cet ordre, le soin du
    // springhorn serait compté comme du soin générique, ce qu'il n'est pas.
    ['Springhorn Healing', 'soinsSpringhorn', '%'],
    ['Springhorn Charges', 'chargesSpringhorn', ''],
    ['Energy Recovery Speed', 'recupEnergie', ''],
    ['Interaction Speed', 'vitesseInteraction', '%'],
    ['Headshot Damage', 'degatsTete', '%'],
    ['Healing', 'soins', '%'],
    ['Defense', 'defensePlate', ''],
    ['Attack', 'attaquePourcent', '%'],
  ];

  /* CE QUI EXISTE MAIS N'A PAS SA PLACE DANS UNE FICHE.
   *
   * « Stacks up to 4 times », « Restores 15% Health », « +2% per stack » :
   * ce sont de vrais effets, mais conditionnels — ils dépendent du combat,
   * pas du stuff. Les additionner aux totaux ferait afficher une résistance
   * qu'on n'a pas en permanence. On les reconnaît pour pouvoir les LISTER
   * à part, au lieu de les confondre avec un motif oublié. */
  const CONDITIONNELS = [
    /stack(?:s|ing)?\s+up\s+to\s+\d+/i,
    /\+?[\d.]+\s*%?\s*per\s+stack/i,
    /restores?\s+[\d.]+\s*%?\s*health/i,
    /resists?\s+minor\s+impacts?/i,
    /recover\s+energy\s+by\s+[\d.]+/i,
    /reduces?\s+cooldown\s+by\s+[\d.]+/i,
    /recover\s+health\s+equal\s+to\s+[\d.]+\s*%/i,
  ];

  /* Renvoie les apports chiffrés d'une phrase d'effet, plus ce qui reste.
   *
   * ON CHERCHE LES LIBELLÉS, ON NE DÉCOUPE PAS LA PHRASE. Découper puis
   * exiger le nombre en fin de morceau ratait « Movement Speed +4.5%,
   * stacking up to 2 times » : la vitesse était perdue parce que la phrase
   * finissait par « 2 times ». On balaie donc chaque libellé connu partout
   * dans le texte, et ce qui n'a été couvert par aucun est rapporté. */
  function lireEffet(phrase) {
    const texte = String(phrase || '');
    const trouve = {};
    const couvert = [];
    for (const [mot, cle, pct] of EFFETS) {
      const re = new RegExp(
        mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + '\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*(%?)', 'gi');
      let m = re.exec(texte);
      while (m) {
        const valeur = (pct === '%' || m[2] === '%')
          ? Number(m[1]) / 100 : Number(m[1]);
        // Un libellé plus long a pu couvrir la même zone : « Defense
        // Penetration » avant « Defense ». On ne compte pas deux fois.
        const chevauche = couvert.some(([a, b]) =>
          m.index < b && (m.index + m[0].length) > a);
        if (!chevauche) {
          trouve[cle] = (trouve[cle] || 0) + valeur;
          couvert.push([m.index, m.index + m[0].length]);
        }
        m = re.exec(texte);
      }
    }
    // Ce qui n'a été couvert par aucun libellé, morceau par morceau.
    couvert.sort((a, b) => a[0] - b[0]);
    const restes = [];
    let curseur = 0;
    const examiner = (bout) => {
      for (const p of bout.split(/[.,;]/)) {
        const q = p.trim();
        if (!q || !/\d/.test(q)) continue;
        if (CONDITIONNELS.some((r) => r.test(q))) continue;
        restes.push(q);
      }
    };
    for (const [a, b] of couvert) {
      if (a > curseur) examiner(texte.slice(curseur, a));
      curseur = Math.max(curseur, b);
    }
    if (curseur < texte.length) examiner(texte.slice(curseur));
    return { trouve, restes };
  }

  /* ------------------------------------------------ courbe de la défense --
   * « Entre les points ci-dessous la réduction est linéaire » (wiki).
   * Défense 400 doit donner 33,1 % — c'est le contrôle du bon calcul. */
  function reductionDefense(def) {
    const c = window.D_COURBE_DEFENSE || [[0, 0]];
    if (def <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i += 1) {
      const [d1, r1] = c[i - 1];
      const [d2, r2] = c[i];
      if (def <= d2) return r1 + (r2 - r1) * ((def - d1) / (d2 - d1));
    }
    return c[c.length - 1][1];
  }

  /* ------------------------------------------------------- la fiche même --
   * `res` est le résultat d'un build : res.slotItems, res.couvert,
   * res.vinPoints. `classe` est l'identifiant numérique du jeu. */
  function ficheDe(res, classeId, D) {
    const nomClasse = D.classes[String(classeId)];
    const base = (window.D_CLASSES || {})[nomClasse] || {};

    // 1. Ce que portent les objets, additionné tel quel.
    const stuff = {};
    let pieces = 0;
    for (const it of Object.values(res.slotItems || {})) {
      if (!it || !it.at) continue;
      pieces += 1;
      for (const [k, v] of Object.entries(it.at)) {
        stuff[k] = (stuff[k] || 0) + v;
      }
    }

    // 2. Ce qu'ajoutent les affixes, au niveau RÉELLEMENT atteint.
    const aff = {};
    const detailAffixes = [];
    const restes = [];
    const niveaux = {};
    for (const [nom, n] of Object.entries(res.couvert || {})) {
      niveaux[nom] = n;
    }
    if (res.vinPoints) {
      for (const [nom, n] of res.vinPoints.entries()) {
        niveaux[nom] = (niveaux[nom] || 0) + n;
      }
    }
    for (const [nom, brut] of Object.entries(niveaux)) {
      const info = D.affixes[nom];
      if (!info || !info.eff) continue;
      const niveau = Math.min(brut, info.cap || info.eff.length);
      if (niveau < 1) continue;
      const phrase = info.eff[niveau - 1];
      const { trouve, restes: r } = lireEffet(phrase);
      for (const [k, v] of Object.entries(trouve)) aff[k] = (aff[k] || 0) + v;
      if (r.length) restes.push([nom, niveau, r]);
      detailAffixes.push({ nom, niveau, phrase, apports: trouve });
    }

    // 3. Le total. L'ORDRE EST CELUI DU JEU : les pourcentages d'Attaque et
    //    de Vie multiplient ce qui a été additionné avant eux.
    const attaqueAvant = (base.Attack || 0) + (stuff.attack || 0);
    const attaque = attaqueAvant * (1 + (aff.attaquePourcent || 0));
    const defense = (base.Defense || 0) + (stuff.defence || 0)
                  + (aff.defensePlate || 0);
    const vieAvant = (base.Health || 0) + (stuff.maxHealth || 0);
    const vie = vieAvant * (1 + (aff.viePourcent || 0));

    const resistPhysique = (stuff.physicalReduction || 0) + (aff.resistPhysique || 0);
    const resistMagique = (stuff.magicalReduction || 0) + (aff.resistMagique || 0);
    const bonusPhysique = (stuff.physicalIncrease || 0) + (aff.degatsPhysiques || 0);
    const bonusMagique = (stuff.magicalIncrease || 0) + (aff.degatsMagiques || 0);
    const reduction = reductionDefense(defense);

    return {
      nomClasse,
      pieces,
      base,
      stuff,
      aff,
      detailAffixes,
      restes,
      attaque,
      attaqueAvant,
      defense,
      reduction,
      vie,
      vieAvant,
      resistPhysique,
      resistMagique,
      bonusPhysique,
      bonusMagique,
      penetration: aff.penetration || 0,
      resistCritique: (stuff.criticalReduction || 0) + (aff.resistCritique || 0),
      critique: base['Critical Increase'] || 0,
      blocage: stuff.blockRate || 0,
      // Vie effective : ce que la vie vaut vraiment une fois la défense et
      // la résistance appliquées. Formule du wiki.
      ehpPhysique: vie / ((1 - reduction) * (1 - resistPhysique)),
      ehpMagique: vie / ((1 - reduction) * (1 - resistMagique)),
      puissance: stuff.combatValue || 0,
    };
  }

  /* ------------------------------------------------------------ dégâts --
   * Un coup, contre une cible décrite par sa défense et sa résistance. */
  function degatsDuCoup(coef, type, f, cible) {
    const brut = f.attaque * coef;
    const bonus = type === 'magical' ? f.bonusMagique
                : type === 'physical' ? f.bonusPhysique : 0;
    // Les dégâts « true » ignorent défense ET résistances (wiki).
    if (type === 'true') return { brut, avecBonus: brut, final: brut };
    const red = Math.max(reductionDefense(cible.defense) - f.penetration, 0);
    const avecBonus = brut * (1 + bonus);
    const resistance = type === 'magical' ? (cible.resistMagique || 0)
                                          : (cible.resistPhysique || 0);
    return {
      brut,
      avecBonus,
      reduction: red,
      final: avecBonus * (1 - red) * (1 - resistance),
    };
  }

  /* Le total d'une compétence. Une compétence à BRANCHES n'en joue qu'une
     par frappe : additionner tous ses coups la surestimerait. */
  function totalCompetence(sk, f, cible, indexBranche) {
    if (sk.branches && sk.branches.length) {
      const b = sk.branches[Math.min(indexBranche || 0, sk.branches.length - 1)];
      const type = (sk.coups[0] || {}).type || 'physical';
      const d = degatsDuCoup(b.coef, type, f, cible);
      return { coef: b.coef, degats: d.final, brut: d.brut,
               tough: b.tough || 0, coups: b.coups.length, branche: b };
    }
    let coef = 0; let degats = 0; let brut = 0; let tough = 0;
    for (const c of sk.coups || []) {
      const d = degatsDuCoup(c.coef, c.type || 'physical', f, cible);
      coef += c.coef; degats += d.final; brut += d.brut; tough += c.tough || 0;
    }
    return { coef, degats, brut, tough, coups: (sk.coups || []).length };
  }

  function competencesDe(nomClasse) {
    return (window.D_SKILLS || []).filter((s) => s.classe === nomClasse);
  }

  window.Fiche = {
    ficheDe, degatsDuCoup, totalCompetence, competencesDe,
    reductionDefense, lireEffet, EFFETS,
  };
}());
