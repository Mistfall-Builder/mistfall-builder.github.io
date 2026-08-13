/* OÙ SE RAMASSENT LES RESSOURCES.
 *
 * Ce fichier est le SEUL endroit du site dont le contenu ne vient pas des
 * données du jeu. Il est donc tenu à une règle plus stricte que le reste :
 *
 *   AUCUNE ENTRÉE SANS DEUX SOURCES INDÉPENDANTES QUI CONCORDENT.
 *
 * Pourquoi cette sévérité : plusieurs sites affichent des taux de drop au
 * dixième de pourcent près sans dire d'où ils les tiennent, et certains
 * donnent le même chiffre à tous les objets — signature d'un gabarit, pas
 * d'une mesure. Un chiffre faux est pire que pas de chiffre : il envoie
 * farmer au mauvais endroit en donnant l'illusion de savoir.
 *
 * CE QU'ON RETIENT : les LIEUX et les TYPES DE NŒUDS, quand deux sources
 * indépendantes les donnent pareil.
 * CE QU'ON ÉCARTE : les POURCENTAGES, tant qu'ils restent isolés. Pour
 * Celestigold, un site annonce « Large Ore Pile 9,8 % » ; un autre écrit
 * noir sur blanc que les taux sont « non résolus » et refuse d'en publier ;
 * et le premier site n'en donne aucun pour l'Adamantite Ingot. Un chiffre
 * qu'une seule source avance n'est pas une donnée, c'est une affirmation.
 *
 * Structure d'une entrée :
 *   n      le nom exact de l'objet, tel qu'il figure dans ressources.js
 *   cartes [{ m: carte, z: [zones] }]   où aller
 *   noeuds [types de conteneurs/filons]  quoi fouiller sur place
 *   note   une phrase utile, si le jeu impose une contrainte
 *   src    les URL qui ont servi, pour que le lecteur puisse vérifier
 *
 * L'inventaire est très incomplet — 165 matériaux, une poignée renseignée.
 * C'est assumé et affiché : mieux vaut trois entrées vérifiables que cent
 * cinquante devinées.
 */
self.D_PROVENANCES = {
  meta: {
    verifieLe: '2026-08-13',
    regle: 'deux sources independantes concordantes, sinon rien',
  },

  /* Les cartes du jeu et leurs zones connues. La liste des zones est elle
     aussi incomplete : on n'affiche que ce qui a ete lu quelque part. */
  cartes: {
    Brandrgarde: ['Pathway', 'Mine Pit', 'Gold Mine Pit', 'Cobalt Grove',
                  'Sealed Grounds', 'Main Hall'],
    Hallowgrove: ['Divine Anchor', "Hastine's Fall"],
  },

  objets: [
    {
      n: 'Celestigold',
      cartes: [{ m: 'Brandrgarde', z: ['Mine Pit', 'Pathway', 'Gold Mine Pit',
                                       'Cobalt Grove'] }],
      noeuds: ['Lazurite', 'Large Ore Pile', 'Medium Ore Pile', 'Mining Cart',
               'Gilded Chest', 'Forge Furnace'],
      note: {
        fr: 'Extrait de la Lazurite, rendement très faible. Les agencements '
          + 'sont procéduraux : aucune course ne le garantit.',
        en: 'Extracted from Lazurite, extremely low yield. Layouts are '
          + 'procedural, so no single run guarantees it.',
        ru: 'Добывается из лазурита, выход крайне низкий. Расположение '
          + 'процедурное — один заход ничего не гарантирует.',
      },
      src: ['https://www.mistfallhunterguide.org/items/celestigold',
            'https://mistfallhub.com/guides/celestigold-location/'],
    },
  ],
};
