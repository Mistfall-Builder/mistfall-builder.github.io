/* LES BUILDS QUE LA COMMUNAUTÉ JOUE VRAIMENT.
 *
 * Ce fichier ne contient plus d'archétypes inventés. Chaque entrée vient
 * d'un guide publié, elle porte son lien, et le choix des affixes est celui
 * de la source — pas le nôtre.
 *
 * CE QUI VIENT DE LA SOURCE : la classe, l'arme, la LISTE des affixes, et
 * leur niveau quand le guide le donne. Quand un guide se contente de
 * nommer un affixe sans niveau — c'est fréquent —, on le pousse à son
 * palier, c'est-à-dire au niveau où il débloque son second effet. Pour un
 * affixe qui n'a pas de palier (Curse, Blessing, Elusive...), on le pousse
 * à son cap s'il est cité en tête de liste sans niveau, ou on retient le
 * niveau que les guides citent le plus souvent (Elusive à 3, pour trois
 * barres d'esquive). C'est dit dans le texte du build à chaque fois.
 *
 * CE QUI VIENT DE NOUS : le stuff. Les guides disent quels affixes viser,
 * jamais quelles pièces porter. Le moteur du site cherche la rareté la
 * plus basse qui atteint la consigne, Victory Wine compris, et le code
 * d'import en découle. Les quatorze ont été vérifiés : zéro cible
 * manquée, quatorze codes distincts, chacun se redécodant sur la bonne
 * classe.
 *
 * CE QU'ON NE REPREND PAS : les descriptions d'affixes des guides, ni un
 * niveau d'affixe qui dépasse son cap réel. Lors de ce relevé, un candidat
 * a été écarté pour un niveau impossible (Seamless 9 alors que son cap est
 * 7, Curse 7 alors que son cap est 5) et un autre pour un nom d'affixe qui
 * n'existe pas dans les données du jeu — la vérification passe par
 * donnees.json, pas seulement par la citation trouvée sur la page. On
 * garde le CHOIX d'affixes des guides, on décrit les effets d'après
 * donnees.json.
 *
 * Relevé le 25 août 2026, après les patchs des 12, 15 et 19 août. Un guide
 * qui change ne se met pas à jour tout seul ici.
 */
window.D_SOURCES = {
  gamerant: { nom: 'GameRant' },
  keengamer: { nom: 'KeenGamer' },
  mhguide: { nom: 'Mistfall Hunter Guide' },
  mfhapp: { nom: 'MistfallHunter.app' },
  odealo: { nom: 'Odealo' },
};

window.D_BUILDS = [
  /* ------------------------------------------------------------ MERCENARY */
  {
    c: 10, a: 'Hammer', k: 'merc-hammer', r: '8 × Epic',
    code: '4e5UdmtbKg01keihuD3wiZUFsQWYIB6sipZcI9Msy',
    t: [['Stoic', 5], ['Seeker', 4], ['Unyielding', 5], ['Aegis', 5], ['Tenacious', 5], ['Elusive', 3]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-best-mercenary-build-gear-gem-affixes-talent-skill/',
    nom: { fr: 'Marteau — bruiser', en: 'Hammer — bruiser', ru: 'Молот — брузер' },
    d: {
      fr: "Le guide a été mis à jour depuis notre dernier relevé : il liste désormais six affixes au lieu de quatre, Aegis et Elusive en plus. Stoic 5, Unyielding 5 et Tenacious 5 sont les niveaux donnés tels quels par la source. Seeker (palier 4) et Aegis (palier 5) sont poussés à leur palier faute de niveau précisé ; Elusive, qui n'a pas de palier, reste à 3 comme partout ailleurs sur ce site.",
      en: "The guide has been refreshed since our last capture: it now lists six affixes instead of four, adding Aegis and Elusive. Stoic 5, Unyielding 5 and Tenacious 5 are the levels the source gives outright. Seeker (breakpoint 4) and Aegis (breakpoint 5) are pushed to their breakpoint since no level was given; Elusive, which has no breakpoint, stays at 3 as everywhere else on this site.",
      ru: 'Гайд обновился с момента нашего последнего снимка: теперь в нём шесть аффиксов вместо четырёх, добавлены Aegis и Elusive. Stoic 5, Unyielding 5 и Tenacious 5 — уровни, данные источником напрямую. Seeker (порог 4) и Aegis (порог 5) подняты до порога, так как уровень не был указан; у Elusive порога нет, он остаётся на 3, как и везде на этом сайте.',
    },
  },
  {
    c: 10, a: 'Sword and Shield', k: 'merc-bof', r: '8 × Excellent',
    code: 'Gtf35a7tKagLIjTObtBng1zvA2bFqtfeBIeMi0',
    t: [['Stoic', 5], ['Tenacious', 5], ['Valor', 5], ['Wrath', 5]],
    src: 'keengamer',
    url: 'https://www.keengamer.com/articles/guides/mistfall-hunter-best-mercenary-build-skills-talents-and-affixes/',
    nom: { fr: 'Bouclier — préréglage Bond of Friendship', en: 'Shield — Bond of Friendship preset', ru: 'Щит — пресет Bond of Friendship' },
    d: {
      fr: "KeenGamer désigne ces quatre affixes comme les « Main Affixes » du build épée-et-bouclier, associés en jeu au préréglage légendaire Bond of Friendship (armure Champion) — aucun niveau n'est donné, les quatre sont donc à leur palier. Wrath 5 ajoute +10,5 % de dégâts physiques et magiques plus +3 % d'attaque ; à son maximum (7, hors de portée ici) il monte à +14,7 %. Le guide cite aussi Bulwark, Fervor, Elusive et Seamless comme options situationnelles, non retenues ici.",
      en: "KeenGamer names these four as the sword-and-shield build's \"Main Affixes\", tied in-game to the legendary Bond of Friendship preset (Champion armor set) — no level is given, so all four sit at their breakpoint. Wrath 5 adds +10.5 % physical and magic damage plus +3 % attack; at its cap (7, out of reach here) it reaches +14.7 %. The guide also names Bulwark, Fervor, Elusive and Seamless as situational options, not chased here.",
      ru: 'KeenGamer называет эти четыре аффикса «основными» для сборки меч-и-щит, привязанной в игре к легендарному пресету Bond of Friendship (комплект брони Champion) — уровень не указан, поэтому все четыре стоят на пороге. Wrath 5 даёт +10,5 % физического и магического урона плюс +3 % атаки; на максимуме (7, здесь недостижим) — до +14,7 %. Гайд также называет Bulwark, Fervor, Elusive и Seamless ситуативными опциями, здесь не взятыми.',
    },
  },

  /* ------------------------------------------------------------- SORCERER */
  {
    c: 11, a: 'Staff', k: 'sorc-stardust', r: '8 × Excellent',
    code: '1HDaxMmnsglwrsWFGLmLT6bRY033ZqNvu8X9J7diFKvw',
    t: [['Ranged', 7], ['Eloquence', 7], ['Elusive', 3], ['Aegis', 3],
        ['Fervid', 2], ['Fervor', 1]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-sorcerer-build-guide/',
    nom: { fr: 'Stardust PvP', en: 'Stardust PvP', ru: 'Stardust PvP' },
    d: {
      fr: "Reconfirmé à l'identique lors de ce relevé : même page, mêmes six niveaux donnés explicitement par la source. Ranged 7 et Eloquence 7 sont les deux seuls affixes du site poussés jusqu'au cap absolu (7) ; le reste reste volontairement bas — Elusive 3, Aegis 3, Fervid 2, Fervor 1. Il faut de l'Excellent pour y arriver, une rareté en dessous de l'Epic qu'exigeait la version relevée le 12 août — signe que le stuff disponible a changé, pas la cible.",
      en: "Reconfirmed unchanged on this pass: same page, same six levels given outright by the source. Ranged 7 and Eloquence 7 are the only two affixes on this site pushed to the absolute cap (7); the rest stays deliberately low — Elusive 3, Aegis 3, Fervid 2, Fervor 1. It takes Excellent gear to get there, one rarity tier below the Epic our August 12 capture needed — a sign the available gear pool shifted, not the target.",
      ru: 'На этом обновлении подтверждено без изменений: та же страница, те же шесть уровней, прямо данные источником. Ranged 7 и Eloquence 7 — единственные два аффикса на сайте, доведённые до абсолютного капа (7); остальное намеренно низкое — Elusive 3, Aegis 3, Fervid 2, Fervor 1. Нужен Excellent — на одну ступень редкости ниже Epic, который требовался на снимке от 12 августа — это говорит об изменении доступного снаряжения, а не цели.',
    },
  },
  {
    c: 11, a: 'Staff', k: 'sorc-solo', r: '8 × Excellent',
    code: '17lpUa0vwNh0C2HjXrOKcrTBu8u13zMRFDPTyUfA',
    t: [['Eloquence', 5], ['Ranged', 5], ['Fervid', 5]],
    src: 'mfhapp',
    url: 'https://mistfallhunter.app/builds/stardust-sorcerer-solo/',
    nom: { fr: 'Stardust — variante solo', en: 'Stardust — solo variant', ru: 'Stardust — соло-вариант' },
    d: {
      fr: "Trois affixes seulement — la version allégée du Stardust, pensée pour jouer seul plutôt qu'en trio. La source appelle Eloquence « la priorité numéro un, au-dessus de cinq stacks » et Ranged « pris une fois Eloquence satisfait » : les deux sont donnés explicitement à 5, leur palier, où l'incantation résiste aux petits impacts et où la portée efficace augmente. Fervid, cité sans niveau comme « l'autre moitié du dégât », est pareillement poussé à son palier.",
      en: "Three affixes only — the lean version of Stardust, built for playing solo rather than in a trio. The source calls Eloquence \"the number one priority, above five stacks\" and Ranged \"taken after Eloquence is satisfied\": both are given explicitly at 5, their breakpoint, where chanting resists minor impacts and effective range increases. Fervid, named without a level as \"the other half of the damage spread\", is likewise pushed to its breakpoint.",
      ru: 'Всего три аффикса — облегчённая версия Stardust для соло-игры, а не трио. Источник называет Eloquence «приоритетом номер один, выше пяти стаков», а Ranged — «берётся после того, как закрыт Eloquence»: оба даны явно на уровне 5, их пороге, где каст устойчив к мелким импактам, а эффективная дистанция растёт. Fervid, названный без уровня как «вторая половина урона», тоже поднят до порога.',
    },
  },
  {
    c: 11, a: 'Staff', k: 'sorc-elem', r: '8 × Epic',
    code: '17lpUa147WwIWAlXJb3iokFzfBkLdtkBYqe110jI',
    t: [['Eloquence', 5], ['Seeker', 5], ['Valor', 5], ['Ranged', 5], ['Fervid', 5]],
    src: 'odealo',
    url: 'https://odealo.com/articles/elemental-sorcerer-mistfall-hunter-build',
    nom: { fr: 'Élémentaire — Eloquence d\'abord', en: 'Elemental — Eloquence first',
           ru: 'Стихийный — сначала Eloquence' },
    d: {
      fr: "La table d'Odealo donne Eloquence et Seeker à 5, Valor et Ranged à 5 aussi, et situe Fervid dans une plage 3-5, « option secondaire utile en PvE soutenu » — poussé ici à son palier, 5, comme les autres. Le guide prévient lui-même : « ne traitez pas ce tableau comme une checklist où chaque affixe doit être au niveau 5 » ; Eloquence et Seeker restent les deux vrais paliers autour desquels construire. Remplace la version relevée le 12 août, dont la source ne donnait aucun niveau chiffré pour trois des cinq affixes.",
      en: "Odealo's table gives Eloquence and Seeker at 5, Valor and Ranged at 5 too, and places Fervid in a 3-5 range, \"a useful secondary option for sustained PvE spell uptime\" — pushed here to its breakpoint, 5, like the rest. The guide itself warns: \"do not treat the table as a checklist where every Affix has to be Level 5\"; Eloquence and Seeker remain the two real breakpoints to build around. Replaces the August 12 capture, whose source gave no numeric level for three of the five affixes.",
      ru: 'Таблица Odealo даёт Eloquence и Seeker на 5, Valor и Ranged тоже на 5, а Fervid помещает в диапазон 3-5, «полезная второстепенная опция для устойчивого PvE-каста» — здесь поднят до порога, 5, как и остальные. Сам гайд предупреждает: «не воспринимайте таблицу как чек-лист, где каждый аффикс обязан быть на 5 уровне»; Eloquence и Seeker остаются двумя настоящими порогами, вокруг которых строится сборка. Заменяет снимок от 12 августа, чей источник не давал числового уровня для трёх из пяти аффиксов.',
    },
  },

  /* ----------------------------------------------------------- BLACKARROW */
  {
    c: 12, a: 'Bow', k: 'ba-charged', r: '8 × Excellent',
    code: 'Gtf3Bdky9uAwtq8Mf9JWy89Nvu81xcDTN8MeVk',
    t: [['Valor', 5], ['Ranged', 5], ['Focused', 5], ['Seamless', 5], ['Elusive', 3]],
    src: 'keengamer',
    url: 'https://www.keengamer.com/articles/guides/mistfall-hunter-best-blackarrow-build/',
    nom: { fr: 'Arc — tir chargé polyvalent', en: 'Bow — versatile charged shot', ru: 'Лук — универсальный заряженный выстрел' },
    d: {
      fr: "KeenGamer classe Valor et Ranged comme les dégâts les plus fiables, Focused pour la vitesse de charge, Seamless et Elusive pour réduire les temps morts entre compétences — aucun niveau chiffré, les cinq passent donc à leur palier (3 pour Elusive, qui n'en a pas). Remplace le build du relevé précédent, sourcé sur la même page mais qui listait Fervid plutôt que Seamless.",
      en: "KeenGamer ranks Valor and Ranged as the most reliable damage, Focused for charge speed, Seamless and Elusive to cut downtime between skills — no numeric level given, so all five sit at their breakpoint (3 for Elusive, which has none). Replaces the previous capture's build, sourced from the same page but listing Fervid instead of Seamless.",
      ru: 'KeenGamer ставит Valor и Ranged как самый надёжный урон, Focused — за скорость зарядки, Seamless и Elusive — чтобы сократить простои между умениями; числового уровня не дано, поэтому все пять на пороге (3 для Elusive, у которого порога нет). Заменяет сборку из предыдущего снимка — та же страница, но со Fervid вместо Seamless.',
    },
  },
  {
    c: 12, a: 'Bow', k: 'ba-dot', r: '8 × Excellent',
    code: 'Gtf3BdkxflvvkhYtOR0fNHr3mTdf54DzQouF7o',
    t: [['Curse', 5], ['Valor', 5], ['Ranged', 5], ['Seamless', 5], ['Elusive', 3]],
    src: 'keengamer',
    url: 'https://www.keengamer.com/articles/guides/mistfall-hunter-best-blackarrow-build/',
    nom: { fr: 'Arc — variante debuffs (DoT)', en: 'Bow — debuff (DoT) variant', ru: 'Лук — вариант дебаффов (DoT)' },
    d: {
      fr: "Une deuxième liste, plus bas dans le même article : Curse remplace Focused, pour une variante axée sur la durée des debuffs plutôt que sur la vitesse de charge. Curse n'a pas de palier — il monte en continu jusqu'à 5 — mais la source le place en tête absolue de la liste ; il est donc à son maximum, comme Burst l'est ailleurs sur ce site quand une source le désigne prioritaire sans le chiffrer. Le reste suit la même logique que la variante tir chargé.",
      en: "A second list, further down the same article: Curse replaces Focused, for a variant built around debuff duration rather than charge speed. Curse has no breakpoint — it scales continuously up to 5 — but the source puts it at the absolute top of the list, so it's set at its cap, the same treatment Burst gets elsewhere on this site when a source names it top priority without a number. The rest follows the same logic as the charged-shot variant.",
      ru: 'Второй список, дальше в той же статье: Curse заменяет Focused — вариант, построенный вокруг длительности дебаффов, а не скорости зарядки. У Curse нет порога — он растёт непрерывно до 5 — но источник ставит его на абсолютную вершину списка, поэтому он на максимуме, как и Burst в другом месте на этом сайте, когда источник называет его приоритетом без цифры. Остальное следует той же логике, что и вариант с заряженным выстрелом.',
    },
  },

  /* ---------------------------------------------------------- SHADOWSTRIX */
  {
    c: 13, a: 'Dual Blades', k: 'shadow-db', r: '8 × Epic',
    code: 'Gtf367IbU17gJYyYa8eGIEyi5eAQaTosyecnC4',
    t: [['Fervor', 5], ['Valor', 5], ['Vitality', 4], ['Elusive', 3], ['Seeker', 4], ['Fervid', 5]],
    src: 'keengamer',
    url: 'https://www.keengamer.com/articles/guides/mistfall-hunter-best-shadowstrix-build-skills-talents-and-affixes/',
    nom: { fr: 'Lames jumelles — pression', en: 'Dual blades — pressure',
           ru: 'Парные клинки — давление' },
    d: {
      fr: "KeenGamer classe Fervor et Valor « Essential », Vitality et Elusive « Very High », Seeker et Fervid « High » — même composition que lors du relevé du 12 août, à un affixe près : Fervid remplace le choix « Fervid ou Smiting » laissé ouvert alors. Fervor 5 ajoute jusqu'à +10,5 % de dégâts en 5 stacks plus de la pénétration de défense ; les cinq autres sont à leur palier.",
      en: "KeenGamer ranks Fervor and Valor as \"Essential\", Vitality and Elusive as \"Very High\", Seeker and Fervid as \"High\" — the same composition as the August 12 capture, minus one open choice: Fervid replaces the \"Fervid or Smiting\" pick left open back then. Fervor 5 adds up to +10.5 % damage across 5 stacks plus defense penetration; the other five sit at their breakpoint.",
      ru: 'KeenGamer относит Fervor и Valor к «обязательным», Vitality и Elusive — к «очень высоким», Seeker и Fervid — к «высоким»: тот же состав, что и на снимке от 12 августа, за одним исключением — Fervid заменяет открытый тогда выбор «Fervid или Smiting». Fervor 5 даёт до +10,5 % урона на 5 стаках плюс пробитие защиты; остальные пять — на пороге.',
    },
  },
  {
    c: 13, a: 'Dual Blades', k: 'shadow-apex', r: '8 × Rare',
    code: 'lfMC43XyZYCUJx1BtJLgwX9OVDk',
    t: [['Valor', 5], ['Fervor', 5]],
    src: 'mhguide',
    url: 'https://www.mistfallhunterguide.org/builds/shadowstrix-build',
    nom: { fr: 'Lames jumelles — cœur d\'apex', en: 'Dual blades — apex core', ru: 'Парные клинки — ядро апекса' },
    d: {
      fr: "La page a été mise à jour le 24 août, après le patch du 19 — elle donne une consigne de fin de partie resserrée à deux affixes : « 5 Valor + 5 Fervor comme apex central, la même paire vers laquelle convergent les guides de lancement ». Deux cibles seulement, et le stuff tient entièrement en Rare — le build le plus accessible de la liste.",
      en: "The page was updated on August 24, after the August 19 patch — it gives a tightened endgame target of just two affixes: \"5 Valor + 5 Fervor as the core apex, the same pairing the launch guides converge on.\" Two targets only, and the gear holds entirely in Rare — the most accessible build on this list.",
      ru: 'Страница обновлена 24 августа, после патча 19 августа — она даёт сжатую эндгейм-цель всего из двух аффиксов: «5 Valor + 5 Fervor как центральный апекс, та же пара, к которой сходятся стартовые гайды». Всего две цели, и снаряжение полностью держится на Rare — самая доступная сборка списка.',
    },
  },

  /* ----------------------------------------------------------------- SEER */
  {
    c: 14, a: 'Catalyst', k: 'seer-rev', r: '8 × Excellent',
    code: 'Gtf3996LmZ6O7iZvzEcZXE3nbCYTQnVvgu3o9Y',
    t: [['Seamless', 5], ['Eloquence', 5], ['Creation', 5], ['Ranged', 5]],
    src: 'mhguide',
    url: 'https://mistfallhunterguide.org/classes/seer',
    nom: { fr: 'Catalyseur — Reverent', en: 'Catalyst — Reverent', ru: 'Катализатор — Reverent' },
    d: {
      fr: "Nouvelle source pour cette variante support : « les guides Reverent visent Seamless (temps de recharge), Eloquence (incantation plus rapide), Creation (durée des constructs plus longue) et Ranged (auto-attaques d'orbe plus fortes) », sans niveau chiffré — les quatre passent à leur palier, 5. Remplace la version du 12 août (Valor/Eloquence/Stoic/Elusive), qui visait l'attaque plutôt que le soutien.",
      en: "A new source for this support variant: \"Reverent guides target Seamless (cooldown uptime), Eloquence (faster chants), Creation (longer construct duration), and Ranged (stronger orb auto-attacks)\", with no numeric level — all four sit at their breakpoint of 5. Replaces the August 12 version (Valor/Eloquence/Stoic/Elusive), which aimed at attack rather than support.",
      ru: 'Новый источник для этого саппорт-варианта: «гайды Reverent целятся в Seamless (аптайм перезарядки), Eloquence (быстрый каст), Creation (более долгие конструкты) и Ranged (усиленные автоатаки орбом)» — без числового уровня, все четыре на пороге 5. Заменяет версию от 12 августа (Valor/Eloquence/Stoic/Elusive), нацеленную на атаку, а не на поддержку.',
    },
  },
  {
    c: 14, a: 'Mace', k: 'seer-blasph', r: '8 × Epic',
    code: '17lpUzlg9uC0PZ2Il1XgdP4NXSADsRDns6Nua8iu',
    t: [['Tenacious', 5], ['Stoic', 5], ['Strife', 5], ['Fervor', 5], ['Blessing', 5], ['Seamless', 5]],
    src: 'gamerant',
    url: 'https://gamerant.com/mistfall-hunter-best-seer-build-gear-gem-affixes-talent-skill/',
    nom: { fr: 'Masse — Blasphemer', en: 'Mace — Blasphemer', ru: 'Булава — Blasphemer' },
    d: {
      fr: "Le Seer au corps-à-corps, la même page que le relevé du 12 août mais relue en entier : elle liste six affixes dans l'ordre « 1. Tenacious 2. Stoic 3. Strife 4. Fervor 5. Blessing 6. Seamless », pas seulement les quatre premiers retenus alors. Tenacious et Stoic sont donnés explicitement « jusqu'au niveau 5 » ; Strife, Fervor et Seamless montent à leur palier. Blessing n'a pas de palier — il monte en continu jusqu'à 5 — et, cité en cinquième position sur six sans niveau donné, est posé à son maximum plutôt qu'à un chiffre arbitraire.",
      en: "The melee Seer, the same page as the August 12 capture but read in full this time: it lists six affixes in order — \"1. Tenacious 2. Stoic 3. Strife 4. Fervor 5. Blessing 6. Seamless\" — not just the first four kept back then. Tenacious and Stoic are given explicitly \"until level 5\"; Strife, Fervor and Seamless rise to their breakpoint. Blessing has no breakpoint — it scales continuously up to 5 — and, named fifth of six with no level given, is set at its cap rather than an arbitrary number.",
      ru: 'Seer в ближнем бою, та же страница, что и 12 августа, но теперь прочитанная целиком: она перечисляет шесть аффиксов по порядку — «1. Tenacious 2. Stoic 3. Strife 4. Fervor 5. Blessing 6. Seamless» — а не только первые четыре, взятые тогда. Tenacious и Stoic даны явно «до уровня 5»; Strife, Fervor и Seamless поднимаются до порога. У Blessing порога нет — он растёт непрерывно до 5 — и, будучи назван пятым из шести без указания уровня, выставлен на максимум, а не на произвольную цифру.',
    },
  },
  {
    c: 14, a: 'Catalyst', k: 'seer-caster', r: '8 × Epic',
    code: 'Gtf3996euaYRdzJerxXmG0OThFlDwEfQoR9ZLs',
    t: [['Eloquence', 5], ['Seamless', 5], ['Creation', 5], ['Fervor', 5], ['Fervid', 5], ['Tenacious', 5]],
    src: 'keengamer',
    url: 'https://www.keengamer.com/articles/guides/mistfall-hunter-best-seer-build-skills-talents-and-affixes/',
    nom: { fr: 'Catalyseur — préréglage légendaire offensif', en: 'Catalyst — legendary offensive preset', ru: 'Катализатор — легендарный атакующий пресет' },
    d: {
      fr: "Un préréglage légendaire distinct de la variante Reverent : KeenGamer classe six emplacements dans l'ordre Eloquence, Seamless, Creation, Fervor, Fervid, Tenacious, associés en jeu à Byrnes's Ash Urn (Catalyst légendaire) porté avec l'armure Holy Saint. Aucun niveau n'est chiffré ; les six passent à leur palier, 5. Plus orienté dégâts que le build Reverent, qui ne partage que quatre de ces six affixes et vise le soutien.",
      en: "A distinct legendary preset from the Reverent variant: KeenGamer ranks six slots in order — Eloquence, Seamless, Creation, Fervor, Fervid, Tenacious — tied in-game to Byrnes's Ash Urn (legendary Catalyst) worn with Holy Saint armor. No level is numeric; all six sit at their breakpoint, 5. More damage-leaning than the Reverent build, which shares only four of these six affixes and aims at support.",
      ru: 'Отдельный от варианта Reverent легендарный пресет: KeenGamer ранжирует шесть слотов по порядку — Eloquence, Seamless, Creation, Fervor, Fervid, Tenacious — привязанных в игре к Byrnes\'s Ash Urn (легендарный Catalyst) в комплекте с бронёй Holy Saint. Числового уровня нет; все шесть на пороге, 5. Более урон-ориентированная, чем сборка Reverent, которая делит лишь четыре из этих шести аффиксов и нацелена на поддержку.',
    },
  },

  /* ------------------------------------------------------ WITHERED KNIGHT */
  {
    c: 15, a: 'Greatsword', k: 'wk-pvp', r: '8 × Excellent',
    code: '17lpUcxOGYeAtcjLXEKN63MTUq7mAe6acrB4VENE',
    t: [['Burst', 5], ['Valor', 5], ['Tenacious', 5], ['Aegis', 5]],
    src: 'mfhapp',
    url: 'https://mistfallhunter.app/builds/withered-knight-greatsword-pvp/',
    nom: { fr: 'Espadon — PvP, tout à 5', en: 'Greatsword — PvP, all at 5', ru: 'Двуручник — PvP, всё на 5' },
    d: {
      fr: "Page mise à jour le 25 août — la source la plus récente citée sur ce site — transcrite d'un guide vidéo et taguée applicable au patch du 19 août. Les quatre affixes sont donnés explicitement au niveau/tier 5 : Burst, désigné numéro un, ajoute +25 % de dégâts d'exécution à son maximum (il plafonne justement à 5, sans palier). Valor, Tenacious et Aegis complètent en attaque, vie et défense.",
      en: "Page updated on August 25 — the most recent source cited on this site — transcribed from a video guide and tagged as applying to the August 19 patch. All four affixes are given explicitly at level/tier 5: Burst, named the number-one pick, adds +25 % execution damage at its cap (it caps exactly at 5, with no breakpoint). Valor, Tenacious and Aegis round it out with attack, health and defense.",
      ru: 'Страница обновлена 25 августа — самый свежий источник на этом сайте — расшифровка видео-гайда с пометкой применимости к патчу от 19 августа. Все четыре аффикса даны явно на уровне/тире 5: Burst, названный выбором номер один, даёт +25 % урона добивания на максимуме (он как раз упирается в 5, без порога). Valor, Tenacious и Aegis дополняют атакой, здоровьем и защитой.',
    },
  },
  {
    c: 15, a: 'Polearm and Shield', k: 'wk-trio', r: '8 × Excellent',
    code: '5H68d8GHZZh6rMfoYmwODr4OFGw0MH3NN5VnqNH4opTFY',
    t: [['Valor', 5], ['Seamless', 5], ['Unyielding', 5], ['Resilience', 4]],
    src: 'mhguide',
    url: 'https://mistfallhunterguide.org/builds/withered-knight-build',
    nom: { fr: 'Hallebarde et bouclier — trio', en: 'Polearm and shield — trio',
           ru: 'Древковое и щит — трио' },
    d: {
      fr: "Mêmes quatre cibles que lors du relevé du 12 août, reconfirmées indépendamment sur la page mise à jour du 24 août : « apex à 5 Valor + 5 Seamless, et en trio on ajoute 5 Unyielding et 4 Resilience ». Resilience 4 est son palier — il y ajoute +10 % de résistance physique et magique en plus de la réduction de durée des debuffs. Seamless 5 accélère les recharges de 11 % et rembourse 30 % de recharge sur un ennemi mis à terre ; c'est le seul build de la liste à le prendre.",
      en: "The same four targets as the August 12 capture, independently reconfirmed on the page's August 24 update: \"apex at 5 Valor + 5 Seamless, and in trios you add 5 Unyielding and 4 Resilience.\" Resilience 4 is its breakpoint — it adds +10 % physical and magic resistance on top of the shorter debuff duration. Seamless 5 speeds up cooldowns by 11 % and refunds 30 % cooldown on knocking an enemy down; it's the only build on this list that takes it.",
      ru: 'Те же четыре цели, что и на снимке от 12 августа, независимо подтверждённые на обновлённой 24 августа странице: «апекс на 5 Valor + 5 Seamless, а в трио добавляются 5 Unyielding и 4 Resilience». Resilience 4 — его порог, добавляет +10 % физического и магического сопротивления сверх сокращения длительности дебаффов. Seamless 5 ускоряет перезарядку на 11 % и возвращает 30 % перезарядки при нокдауне врага; это единственная сборка списка, которая его берёт.',
    },
  },
];
