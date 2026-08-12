/* Contrôle du lecteur d'effets, hors navigateur : node test_fiche.js
 *
 * POURQUOI CE FICHIER. La fiche de personnage repose entièrement sur la
 * lecture des libellés du jeu. Un motif oublié ne se voit pas à l'écran :
 * le total est simplement un peu faux, et personne ne s'en aperçoit. Ce
 * test passe les 44 affixes à leurs 7 niveaux et exige que TOUT soit
 * compris — sauf les phrases sans le moindre chiffre, qui décrivent un
 * effet qualitatif (« ne peut plus être interrompu ») et n'ont rien à
 * apporter à une fiche.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ici = __dirname;
const lire = (f) => fs.readFileSync(path.join(ici, f), 'utf8');

// On charge les deux fichiers du site dans un faux `window`.
global.window = {};
new Function(lire('fiche.js')).call(global);
const brut = lire('donnees.js');
const D = JSON.parse(brut.slice(brut.indexOf('{'), brut.lastIndexOf('}') + 1));

const { lireEffet } = global.window.Fiche;

let phrases = 0;
let compris = 0;
const soucis = [];
const qualitatifs = [];

for (const [nom, info] of Object.entries(D.affixes)) {
  (info.eff || []).forEach((phrase, i) => {
    phrases += 1;
    const { trouve, restes } = lireEffet(phrase);
    if (restes.length) {
      soucis.push(`${nom} niveau ${i + 1} : ${restes.join(' | ')}
        (phrase entière : ${phrase})`);
    } else if (Object.keys(trouve).length) {
      compris += 1;
    } else {
      qualitatifs.push(`${nom} ${i + 1} : ${phrase}`);
    }
  });
}

// Contrôles chiffrés sur des valeurs vérifiables une par une.
const cas = [
  ['Valor', 7, 'attaquePourcent', 0.105],
  ['Valor', 7, 'penetration', 0.018],
  ['Valor', 4, 'attaquePourcent', 0.06],
  ['Fervor', 7, 'degatsPhysiques', 0.028],
  ['Fervor', 7, 'degatsMagiques', 0.028],
  ['Fervor', 7, 'penetration', 0.025],
  ['Aegis', 5, 'defensePlate', 75],
  ['Aegis', 5, 'resistPhysique', 0.025],
  ['Aegis', 7, 'defensePlate', 105],
  ['Eloquence', 7, 'vitesseIncant', 0.21],
];
const faux = [];
for (const [nom, niveau, cle, attendu] of cas) {
  const { trouve } = lireEffet(D.affixes[nom].eff[niveau - 1]);
  const eu = trouve[cle];
  if (eu === undefined || Math.abs(eu - attendu) > 1e-9) {
    faux.push(`${nom} ${niveau} → ${cle} = ${eu}, attendu ${attendu}`);
  }
}

// La courbe de défense doit reproduire l'exemple publié par le wiki.
const courbe = JSON.parse(lire('skills.js')
  .match(/window\.D_COURBE_DEFENSE = (\[[^;]+\]);/)[1]);
global.window.D_COURBE_DEFENSE = courbe;
const r400 = global.window.Fiche.reductionDefense(400);
if (Math.abs(r400 - 0.331) > 0.0006) {
  faux.push(`courbe : Défense 400 → ${(r400 * 100).toFixed(2)} %, le wiki dit 33.1 %`);
}
const r705 = global.window.Fiche.reductionDefense(705);
if (Math.abs(r705 - 0.50) > 1e-9) {
  faux.push(`courbe : Défense 705 → ${(r705 * 100).toFixed(2)} %, attendu 50 %`);
}

console.log(`${phrases} phrases d'effet lues`);
console.log(`  ${compris} apportent des nombres à la fiche`);
console.log(`  ${qualitatifs.length} sont qualitatives (aucun nombre à porter)`);
console.log(`  ${soucis.length} mal comprises`);
console.log(`${cas.length} valeurs contrôlées une par une, ${faux.length} fausses`);
if (qualitatifs.length) {
  console.log('\nqualitatives :');
  for (const q of qualitatifs) console.log('   ', q);
}
if (soucis.length) {
  console.log('\nMAL COMPRISES :');
  for (const s of soucis) console.log('   ', s);
}
if (faux.length) {
  console.log('\nVALEURS FAUSSES :');
  for (const f of faux) console.log('   ', f);
}
process.exit(soucis.length + faux.length ? 1 : 0);
