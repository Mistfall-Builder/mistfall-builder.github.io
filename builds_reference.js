/* LES BUILDS QUE LA COMMUNAUTÉ JOUE VRAIMENT.
 *
 * Ce fichier ne contient plus d'archétypes inventés. Chaque entrée vient
 * d'un guide publié, elle porte son lien, et le choix des affixes est celui
 * de la source — pas le nôtre.
 *
 * CE QUI VIENT DE LA SOURCE : la classe, l'arme, la LISTE des affixes, et
 * leur niveau quand le guide le donne. Quand un guide se contente de
 * nommer un affixe sans niveau — c'est fréquent —, on le pousse à son
 * palier, c'est-à-dire au niveau où il débloque son second effet. C'est
 * dit dans le texte du build à chaque fois.
 *
 * CE QUI VIENT DE NOUS : le stuff. Les guides disent quels affixes viser,
 * jamais quelles pièces porter. Le moteur du site cherche la rareté la
 * plus basse qui atteint la consigne, Victory Wine compris, et le code
 * d'import en découle. Les douze ont été vérifiés : zéro cible manquée,
 * douze codes distincts, chacun se redécodant sur la bonne classe.
 *
 * CE QU'ON NE REPREND PAS : les descriptions d'affixes des guides. Deux
 * d'entre eux décrivent Fervid comme un bonus « au-dessus de 70 % de vie »
 * et Fervor comme cumulatif ; les données du jeu disent autre chose. On
 * garde leur CHOIX d'affixes, on décrit les effets d'après donnees.json.
 *
 * Relevé le 12 août 2026. Un guide qui change ne se met pas à jour tout
 * seul ici.
 */
window.D_SOURCES = {
  gamerant: { nom: 'GameRant' },
  keengamer: { nom: 'KeenGamer' },
  skycoach: { nom: 'Skycoach' },
  mhguide: { nom: 'Mistfall Hunter Guide' },
};

window.D_BUILDS = [
  /* ------------------------------------------------------------ MERCENARY */
  {
    c: 10, a: 'Hammer', k: 'merc-hammer', r: '8 × Excellent',
    code: 'Gtf38QtLbhBASC1w2mYuvVzM5qNeWJokKSNa9w',
    t: [['Stoic', 5], ['Seeker', 5], ['Unyielding', 5], ['Tenacious', 5]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-best-mercenary-build-gear-gem-affixes-talent-skill/',
    nom: { fr: 'Marteau — bruiser', en: 'Hammer — bruiser', ru: 'Молот — брузер' },
    d: {
      fr: "Le build tank du Mercenary. Stoic 5 rend 15 % de vie sous 30 %, Unyielding 5 cumule ses résistances, Tenacious 5 monte la vie et les soins reçus, Seeker 5 rattrape la lenteur de l'arme. Le guide nomme aussi Aegis et Elusive sans donner de niveau ; ils passent en prime sur le stuff trouvé.",
      en: "The Mercenary tank build. Stoic 5 restores 15 % health below 30 %, Unyielding 5 stacks its resistances, Tenacious 5 raises health and healing received, Seeker 5 offsets the weapon's slowness. The guide also names Aegis and Elusive without levels; they come along as extras on the gear found.",
      ru: 'Танковая сборка Mercenary. Stoic 5 возвращает 15 % здоровья ниже 30 %, Unyielding 5 копит сопротивления, Tenacious 5 поднимает здоровье и лечение, Seeker 5 компенсирует медлительность оружия. Гайд называет также Aegis и Elusive без уровней; они идут бонусом на найденном снаряжении.',
    },
  },
  {
    c: 10, a: 'Sword and Shield', k: 'merc-bloc', r: '8 × Excellent',
    code: 'Gtf38QtLw49jJRP2008RVXS0BfKLu5yaUjO6ls',
    t: [['Bulwark', 4], ['Stoic', 5], ['Wrath', 5], ['Valor', 5]],
    src: 'mhguide',
    url: 'https://www.mistfallhunterguide.org/builds/mercenary-build',
    nom: { fr: 'Bouclier — blocage PvP', en: 'Shield — PvP block', ru: 'Щит — блок в PvP' },
    d: {
      fr: "L'ordre de priorité est celui du guide : Bulwark d'abord, puis Stoic et Wrath, Valor ensuite. Bulwark est poussé à 4, son palier — au-delà, seul le taux de réduction au blocage monte encore. Wrath 5 est le plus gros affixe de dégâts du jeu, +14,7 % physique et magique à son maximum.",
      en: "The priority order is the guide's: Bulwark first, then Stoic and Wrath, Valor after. Bulwark is pushed to 4, its breakpoint — past that only the block reduction rate keeps rising. Wrath 5 is the biggest damage affix in the game, +14.7 % physical and magic at its cap.",
      ru: 'Порядок приоритета взят из гайда: сначала Bulwark, затем Stoic и Wrath, потом Valor. Bulwark доведён до 4 — его порог; дальше растёт только процент снижения урона при блоке. Wrath 5 — самый большой аффикс урона в игре, +14,7 % физического и магического на максимуме.',
    },
  },
  {
    c: 10, a: 'Sword and Shield', k: 'merc-ss', r: '8 × Rare',
    code: 'lfMC2Y5gb47HxYtAkJ0C8QW4tMm',
    t: [['Elusive', 3], ['Vitality', 4], ['Valor', 5]],
    src: 'skycoach',
    url: 'https://skycoach.gg/blog/mistfall-hunter/articles/gyldhunters-best-builds',
    nom: { fr: 'Épée et bouclier — trio Elusive/Vitality/Valor',
           en: 'Sword and shield — the Elusive/Vitality/Valor trio',
           ru: 'Меч и щит — трио Elusive/Vitality/Valor' },
    d: {
      fr: "Ce trio revient dans presque tous les guides, toutes classes confondues : Elusive pour l'esquive, Vitality pour l'énergie, Valor pour l'attaque. Vitality est à 4, son palier, où il rend immunisé au découvert d'énergie. Trois affixes seulement, et le stuff tient entièrement en Rare — c'est le build le moins exigeant de la liste avec celui du Blackarrow.",
      en: "This trio recurs in nearly every guide, across all classes: Elusive for dodging, Vitality for energy, Valor for attack. Vitality sits at 4, its breakpoint, where it grants immunity to energy overdraft. Three affixes only, and the gear holds entirely in Rare — the least demanding build on this list alongside the Blackarrow one.",
      ru: 'Это трио встречается почти во всех гайдах, у всех классов: Elusive — уклонение, Vitality — энергия, Valor — атака. Vitality на 4, на своём пороге, где даёт иммунитет к перерасходу энергии. Всего три аффикса, и снаряжение полностью держится на Rare — наименее требовательная сборка списка наряду с Blackarrow.',
    },
  },

  /* ------------------------------------------------------------- SORCERER */
  {
    c: 11, a: 'Staff', k: 'sorc-stardust', r: '8 × Epic',
    code: 'Gtf32uR1CQkMXZEOei4wXBwMmvOBvTJJUQUtOa',
    t: [['Ranged', 7], ['Eloquence', 7], ['Elusive', 3], ['Aegis', 3],
        ['Fervid', 2], ['Fervor', 1]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-sorcerer-build-guide/',
    nom: { fr: 'Stardust PvP', en: 'Stardust PvP', ru: 'Stardust PvP' },
    d: {
      fr: "Le seul build relevé dont la source donne tous les niveaux, et le seul à monter deux affixes jusqu'à 7 : Ranged 7 et Eloquence 7. Le reste est volontairement bas — Elusive 3, Aegis 3, Fervid 2, Fervor 1. C'est l'inverse d'un build étalé : deux affixes très hauts, quatre en appoint. Il faut de l'Epic pour y arriver.",
      en: "The only build found whose source gives every level, and the only one taking two affixes to 7: Ranged 7 and Eloquence 7. The rest is deliberately low — Elusive 3, Aegis 3, Fervid 2, Fervor 1. The opposite of a spread build: two very high affixes, four topping up. It takes Epic gear to get there.",
      ru: 'Единственная найденная сборка, где источник даёт все уровни, и единственная, поднимающая два аффикса до 7: Ranged 7 и Eloquence 7. Остальное намеренно низкое — Elusive 3, Aegis 3, Fervid 2, Fervor 1. Противоположность размазанной сборке: два очень высоких аффикса и четыре добора. Нужен Epic.',
    },
  },
  {
    c: 11, a: 'Staff', k: 'sorc-elem', r: '8 × Excellent',
    code: 'Gtf32uPde4oPQgHtY0T2itNDCJ7QqFhK6DhDRA',
    t: [['Eloquence', 5], ['Elusive', 3], ['Vitality', 4], ['Ranged', 5], ['Fervor', 5]],
    src: 'skycoach',
    url: 'https://skycoach.gg/blog/mistfall-hunter/articles/gyldhunters-best-builds',
    nom: { fr: 'Élémentaire — Eloquence d\'abord', en: 'Elemental — Eloquence first',
           ru: 'Стихийный — сначала Eloquence' },
    d: {
      fr: "« Eloquence 5 en premier, puis Elusive, Vitality, Ranged, Fervor » — l'ordre est celui du guide, mot pour mot. Eloquence 5 est le palier qui rend l'incantation ininterrompable par les impacts mineurs, et toutes les sources consultées le mettent en tête pour cette classe. Les affixes cités sans niveau sont posés à leur palier.",
      en: "\"Eloquence 5 first, then Elusive, Vitality, Ranged, Fervor\" — the order is the guide's, word for word. Eloquence 5 is the breakpoint that makes chanting immune to minor impacts, and every source consulted puts it first for this class. Affixes named without a level are set at their breakpoint.",
      ru: '«Сначала Eloquence 5, затем Elusive, Vitality, Ranged, Fervor» — порядок взят из гайда дословно. Eloquence 5 — порог, на котором каст перестаёт прерываться мелкими импактами, и все просмотренные источники ставят его первым для этого класса. Аффиксы без уровня выставлены на порог.',
    },
  },

  /* ----------------------------------------------------------- BLACKARROW */
  {
    c: 12, a: 'Bow', k: 'ba-pvp', r: '8 × Excellent',
    code: 'Gtf335RxxSYa1zqzZeMEdz8OyqldqWDQpE6L1U',
    t: [['Ranged', 5], ['Focused', 5], ['Elusive', 3], ['Fervid', 5]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-best-blackarrow-build-gear-gem-affixes-talent-skill-pvp-pve/',
    nom: { fr: 'Arc — PvP à distance', en: 'Bow — ranged PvP', ru: 'Лук — дальний PvP' },
    d: {
      fr: "Le guide classe les affixes par importance sans donner de niveau : Ranged et Focused en tête, Elusive et Fervid ensuite, Fervor et Valor en appoint. Les quatre premiers sont posés à leur palier. Ranged 5 ajoute +12 % de portée efficace, Focused 5 ajoute +10 % de vitesse de déplacement à la vitesse de charge.",
      en: "The guide ranks affixes by importance without giving levels: Ranged and Focused on top, Elusive and Fervid next, Fervor and Valor as filler. The first four are set at their breakpoint. Ranged 5 adds +12 % effective range, Focused 5 adds +10 % movement speed on top of charging speed.",
      ru: 'Гайд ранжирует аффиксы по важности без уровней: Ranged и Focused во главе, затем Elusive и Fervid, Fervor и Valor как добор. Первые четыре выставлены на порог. Ranged 5 добавляет +12 % эффективной дистанции, Focused 5 — +10 % скорости передвижения сверх скорости зарядки.',
    },
  },
  {
    c: 12, a: 'Bow', k: 'ba-curse', r: '8 × Common',
    code: '2nLRaa5USjOvOgczZzLA1Q8H2',
    t: [['Curse', 4], ['Focused', 2], ['Elusive', 3], ['Seeker', 2], ['Ranged', 2]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-best-blackarrow-build-gear-gem-affixes-talent-skill-pvp-pve/',
    nom: { fr: 'Arc — PvE debuffs', en: 'Bow — PvE debuffs', ru: 'Лук — PvE дебаффы' },
    d: {
      fr: "Curse en priorité absolue : il allonge la durée de tous les debuffs qu'on applique. Le reste est bas exprès — Focused 2, Seeker 2, Ranged 2, Elusive 3. C'est le build le moins exigeant de tout le site : le stuff tient en **Common**, la rareté de départ. À prendre tel quel pour débuter, sans rien acheter.",
      en: "Curse is the absolute priority: it extends the duration of every debuff you apply. The rest is deliberately low — Focused 2, Seeker 2, Ranged 2, Elusive 3. This is the least demanding build on the whole site: the gear holds in **Common**, the starting rarity. Take it as-is to begin, without buying anything.",
      ru: 'Curse — абсолютный приоритет: он продлевает длительность всех накладываемых дебаффов. Остальное намеренно низкое — Focused 2, Seeker 2, Ranged 2, Elusive 3. Самая нетребовательная сборка на сайте: снаряжение держится на **Common**, стартовой редкости. Берётся как есть для начала, без покупок.',
    },
  },

  /* ---------------------------------------------------------- SHADOWSTRIX */
  {
    c: 13, a: 'Dual Blades', k: 'shadow-db', r: '8 × Excellent',
    code: 'Gtf33GVawHROjSv4J4M4CD4F45rtHkG7t2rMcS',
    t: [['Fervor', 5], ['Valor', 5], ['Vitality', 4], ['Elusive', 3], ['Seeker', 4]],
    src: 'keengamer',
    url: 'https://www.keengamer.com/articles/guides/mistfall-hunter-best-shadowstrix-build-skills-talents-and-affixes/',
    nom: { fr: 'Lames jumelles — pression', en: 'Dual blades — pressure',
           ru: 'Парные клинки — давление' },
    d: {
      fr: "Six emplacements chez la source : Fervor, Valor, Vitality, Elusive, Seeker, puis Fervid ou Smiting au choix. Les cinq premiers sont retenus, chacun à son palier. Un autre guide donne pour cette classe la cible de fin de partie « Valor 5 + Fervor 5 » : ce sont exactement les deux premiers, ce qui recoupe.",
      en: "Six slots at the source: Fervor, Valor, Vitality, Elusive, Seeker, then Fervid or Smiting by choice. The first five are kept, each at its breakpoint. Another guide gives this class the endgame target \"Valor 5 + Fervor 5\": those are exactly the first two, which corroborates.",
      ru: 'Шесть слотов в источнике: Fervor, Valor, Vitality, Elusive, Seeker, затем Fervid или Smiting на выбор. Первые пять взяты, каждый на своём пороге. Другой гайд даёт для этого класса эндгейм-цель «Valor 5 + Fervor 5» — это ровно первые два, что подтверждает.',
    },
  },

  /* ----------------------------------------------------------------- SEER */
  {
    c: 14, a: 'Mace', k: 'seer-blasph', r: '8 × Excellent',
    code: '17lpVBXOYaFMoB5eKc0yxHX0xQqHZafZ7ZGcrz4S',
    t: [['Stoic', 5], ['Tenacious', 5], ['Fervor', 5], ['Strife', 5]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-best-seer-build-gear-gem-affixes-talent-skill/',
    nom: { fr: 'Masse — Blasphemer', en: 'Mace — Blasphemer', ru: 'Булава — Blasphemer' },
    d: {
      fr: "Le Seer au corps-à-corps, quatre affixes tous à 5, niveaux donnés par la source. Une précision qui compte : le soin de ce build ne vient d'aucun affixe, il vient de la compétence Drain Rune. Tenacious 5 augmente les soins REÇUS (+7,5 %) en plus des +9 % de vie — c'est le seul affixe du jeu qui touche au soin.",
      en: "The melee Seer, four affixes all at 5, levels given by the source. One clarification that matters: this build's healing comes from no affix at all, it comes from the Drain Rune skill. Tenacious 5 raises healing RECEIVED (+7.5 %) on top of +9 % health — it is the only affix in the game that touches healing.",
      ru: 'Seer в ближнем бою, четыре аффикса на 5, уровни даны источником. Важное уточнение: лечение этой сборки не идёт ни от одного аффикса — оно идёт от умения Drain Rune. Tenacious 5 повышает ПОЛУЧАЕМОЕ лечение (+7,5 %) сверх +9 % здоровья: это единственный аффикс в игре, связанный с лечением.',
    },
  },
  {
    c: 14, a: 'Catalyst', k: 'seer-rev', r: '8 × Excellent',
    code: 'Gtf33RYZbSQakhGAW5hB460ogiW74b0pNF39Xc',
    t: [['Valor', 5], ['Eloquence', 5], ['Stoic', 5], ['Elusive', 3]],
    src: 'skycoach',
    url: 'https://skycoach.gg/blog/mistfall-hunter/articles/gyldhunters-best-builds',
    nom: { fr: 'Catalyseur — Reverent', en: 'Catalyst — Reverent', ru: 'Катализатор — Reverent' },
    d: {
      fr: "« Valor 5, Eloquence 5, Stoic 5, Elusive le plus haut possible » — les niveaux sont ceux du guide. Elusive plafonne à 5 mais n'a pas de palier ; il est ici à 3, le niveau que les guides citent le plus souvent pour trois barres d'esquive. Eloquence 5 vaut ici ce qu'il vaut au Sorcerer : les runes s'incantent.",
      en: "\"Valor 5, Eloquence 5, Stoic 5, Elusive as high as possible\" — the levels are the guide's. Elusive caps at 5 but has no breakpoint; it sits at 3 here, the level guides most often quote for three dodge bars. Eloquence 5 is worth here what it is worth on the Sorcerer: runes are chanted.",
      ru: '«Valor 5, Eloquence 5, Stoic 5, Elusive как можно выше» — уровни из гайда. Elusive упирается в 5, но порога не имеет; здесь он на 3 — уровень, который гайды чаще всего называют для трёх полос уклонения. Eloquence 5 здесь стоит того же, что у Sorcerer: руны читаются.',
    },
  },

  /* ------------------------------------------------------ WITHERED KNIGHT */
  {
    c: 15, a: 'Greatsword', k: 'wk-burst', r: '8 × Excellent',
    code: 'Gtf33cbMQ0mwFoHZo7Da4WlwLdGT2OgCosw82K',
    t: [['Tenacious', 5], ['Burst', 5], ['Fervid', 5], ['Stoic', 5]],
    src: 'mhguide',
    url: 'https://www.mistfallhunterguide.org/builds/withered-knight-build',
    nom: { fr: 'Espadon — duelliste', en: 'Greatsword — duelist', ru: 'Двуручник — дуэлянт' },
    d: {
      fr: "Tenacious 5 « à prendre tôt » selon la source, puis Burst, qualifié de gain propre à la classe : +25 % de dégâts d'exécution sur les cibles à basse vie. Le guide préfère explicitement Fervor à Valor ici, « parce que le Chevalier frappe vite ». Burst n'a pas de palier ; il est posé à son maximum, 5.",
      en: "Tenacious 5 \"to take early\" per the source, then Burst, called the class-specific payoff: +25 % execution damage on low-health targets. The guide explicitly prefers Fervor over Valor here, \"because the Knight attacks fast\". Burst has no breakpoint; it is set at its cap, 5.",
      ru: 'Tenacious 5 «брать рано» по источнику, затем Burst, названный классовой выплатой: +25 % урона добивания по целям с низким здоровьем. Гайд явно предпочитает здесь Fervor вместо Valor, «потому что Рыцарь бьёт быстро». У Burst нет порога; он выставлен на максимум, 5.',
    },
  },
  {
    c: 15, a: 'Polearm and Shield', k: 'wk-trio', r: '8 × Excellent',
    code: '17lpUcxOFtpdWkZsvcjFImDLlwLq99Zf6dt85e0e',
    t: [['Unyielding', 5], ['Resilience', 4], ['Valor', 5], ['Seamless', 5]],
    src: 'mhguide',
    url: 'https://www.mistfallhunterguide.org/builds/withered-knight-build',
    nom: { fr: 'Hallebarde et bouclier — trio', en: 'Polearm and shield — trio',
           ru: 'Древковое и щит — трио' },
    d: {
      fr: "Les cibles de fin de partie données pour la variante trio, telles quelles : 5 Unyielding, 4 Resilience, 5 Valor, 5 Seamless. Resilience 4 est son palier — il y ajoute −25 % de durée des debuffs subis. Seamless 5 accélère les recharges de compétences ; c'est le seul build de la liste à le prendre.",
      en: "The endgame targets given for the trio variant, as they stand: 5 Unyielding, 4 Resilience, 5 Valor, 5 Seamless. Resilience 4 is its breakpoint — it adds −25 % duration on debuffs you suffer. Seamless 5 speeds up skill cooldowns; it is the only build on this list that takes it.",
      ru: 'Эндгейм-цели для трио-варианта, как есть: 5 Unyielding, 4 Resilience, 5 Valor, 5 Seamless. Resilience 4 — его порог, добавляет −25 % длительности накладываемых на тебя дебаффов. Seamless 5 ускоряет перезарядку умений; это единственная сборка списка, которая его берёт.',
    },
  },
];
