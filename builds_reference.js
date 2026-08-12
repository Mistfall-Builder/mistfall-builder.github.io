/* BUILDS DE RÉFÉRENCE — deux par classe.
 *
 * D'OÙ ILS VIENNENT. Ils ont été PRODUITS par l'optimiseur de ce site, pas
 * recopiés ailleurs. Chacun a été vérifié : ses cibles sont atteintes, et
 * son code d'import a été engendré par le même codec que celui du builder.
 * Un build copié sur une capture d'écran pourrait ne même pas être légal en
 * jeu ; ceux-ci le sont par construction.
 *
 * CE QU'ILS SONT, ET CE QU'ILS NE SONT PAS. Des points de départ lisibles :
 * une intention claire, des affixes cohérents, la rareté la plus basse qui
 * suffit. Pas « le meilleur build du jeu » — cette notion dépend du contenu
 * joué, du niveau, et de ce qu'on a en stock.
 *
 * Les textes sont écrits ici, dans les trois langues, plutôt que dans le
 * dictionnaire : ce sont des données au même titre que les cibles.
 */
window.D_REFERENCE = [
  {
    k: 'merc-tank', c: 10, a: 'Sword and Shield',
    code: 'Gtf32jM0e0qXkylnAy9JE1GVdVm4eDPdOGAQF6',
    t: [['Aegis', 5], ['Tenacious', 5], ['Stoic', 5], ['Bulwark', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Mur de bouclier', en: 'Shield Wall', ru: 'Стена щитов' },
    d: {
      fr: "Trois affixes défensifs poussés à leur palier : Aegis 5 débloque la résistance physique, Tenacious 5 la vie, Stoic 5 le filet de sécurité sous 50 % de vie. Bulwark complète sans coûter de rareté. Le build qui encaisse pendant que les autres frappent.",
      en: 'Three defensive affixes pushed to their breakpoint: Aegis 5 unlocks physical resistance, Tenacious 5 the health bonus, Stoic 5 the safety net below 50 % health. Bulwark rounds it off at no extra rarity. The one that soaks while the others hit.',
      ru: 'Три защитных аффикса на пороге: Aegis 5 даёт физическое сопротивление, Tenacious 5 — здоровье, Stoic 5 — страховку ниже 50 % HP. Bulwark добирает остальное без роста редкости.',
    },
  },
  {
    k: 'merc-degat', c: 10, a: 'Hammer',
    code: 'Gtf32jMSWO4yWwU2j0j3VCCXKE3PCh3Z2ais9Q',
    t: [['Valor', 5], ['Fervor', 5], ['Wrath', 5], ['Swift', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Marteau lourd', en: 'Heavy Hammer', ru: 'Тяжёлый молот' },
    d: {
      fr: "Valor 5 et Fervor 5 franchissent tous deux leur palier, ce qui ajoute de la pénétration de défense en plus de l'attaque brute — contre un monstre à 50 % de réduction, c'est là que se gagne le vrai gain. Swift compense la lenteur du marteau.",
      en: 'Valor 5 and Fervor 5 both cross their breakpoint, which adds defence penetration on top of raw attack — against a monster sitting at 50 % reduction, that is where the real gain is. Swift offsets the hammer being slow.',
      ru: 'Valor 5 и Fervor 5 переходят порог и добавляют пробивание защиты сверх голой атаки — против монстра с 50 % снижения это и решает. Swift компенсирует медлительность молота.',
    },
  },
  {
    k: 'sorc-degat', c: 11, a: 'Staff',
    code: 'Gtf32uOzJ2hsCAequMxoovS2B3wyXPEaIRhBBI',
    t: [['Eloquence', 5], ['Fervor', 5], ['Valor', 5]],
    r: '8 × Excellent',
    nom: { fr: 'Incantation rapide', en: 'Fast Casting', ru: 'Быстрый каст' },
    d: {
      fr: "Trois cibles seulement, toutes à leur palier. Eloquence 5 rend l'incantation ininterrompable par les impacts mineurs — sur une classe qui passe son temps à canaliser, ça vaut plus que quelques pourcents de dégâts. Volontairement resserré : ajouter un quatrième affixe faisait basculer tout le stuff en Légendaire.",
      en: 'Three targets only, all at their breakpoint. Eloquence 5 makes chanting immune to minor impacts — on a class that spends its life channelling, that beats a few percent of damage. Deliberately tight: adding a fourth affix pushed the whole set to Legendary.',
      ru: 'Только три цели, все на пороге. Eloquence 5 делает каст невосприимчивым к мелким импактам — для класса, который постоянно читает заклинания, это важнее пары процентов урона. Намеренно сжато: четвёртый аффикс уводил весь сет в Legendary.',
    },
  },
  {
    k: 'sorc-tenue', c: 11, a: 'Staff',
    code: 'Gtf32uPd9baWz1YZhQggDqSecVGm5Pcip7Jyu8',
    t: [['Eloquence', 5], ['Tenacious', 5], ['Aegis', 5], ['Ethereal', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Mage qui survit', en: 'Sorcerer That Lives', ru: 'Выживающий маг' },
    d: {
      fr: "Le même Eloquence 5, mais le reste part en défense. Un sorcier meurt en canalisant : Aegis et Tenacious à leur palier lui donnent de quoi finir son sort. Ethereal pour se sortir des corps-à-corps qu'il n'aurait jamais dû accepter.",
      en: 'The same Eloquence 5, but the rest goes into defence. A sorcerer dies mid-channel: Aegis and Tenacious at their breakpoint give it enough to finish the cast. Ethereal to leave the melee it should never have accepted.',
      ru: 'Тот же Eloquence 5, но остальное — в защиту. Маг умирает во время каста: Aegis и Tenacious на пороге дают дочитать. Ethereal — чтобы выйти из ближнего боя.',
    },
  },
  {
    k: 'arc-degat', c: 12, a: 'Bow',
    code: 'Gtf35wE3uuXuh1p00cNka6D3bBJq9oamSZVHnc',
    t: [['Ranged', 5], ['Valor', 5], ['Fervor', 5], ['Sky Piercer', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Tir tendu', en: 'Straight Shot', ru: 'Прямой выстрел' },
    d: {
      fr: "Ranged 5 allonge la portée efficace, Valor et Fervor franchissent leur palier et apportent chacun de la pénétration. Sky Piercer en complément. Le build qui tire de loin et ne s'approche jamais.",
      en: 'Ranged 5 extends effective range, Valor and Fervor cross their breakpoint and each bring penetration. Sky Piercer tops it off. The one that shoots from afar and never closes in.',
      ru: 'Ranged 5 увеличивает эффективную дистанцию, Valor и Fervor переходят порог и дают пробивание. Sky Piercer добирает. Стреляет издалека и не сближается.',
    },
  },
  {
    k: 'arc-mobile', c: 12, a: 'Bow',
    code: 'Gtf335RxwpUJVajODOmXDaFqStAbmx49cGVbKC',
    t: [['Swift', 5], ['Elusive', 5], ['Seeker', 5], ['Ranged', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Insaisissable', en: 'Untouchable', ru: 'Неуловимый' },
    d: {
      fr: "Tout en déplacement : Swift, Elusive et Seeker à 5. On ne gagne pas en dégâts par coup, on gagne en nombre de coups placés et en fuites réussies. Contre des joueurs, ça vaut souvent mieux qu'un affixe offensif de plus.",
      en: 'Everything in movement: Swift, Elusive and Seeker at 5. You do not gain damage per hit, you gain hits landed and escapes made. Against players that often beats one more offensive affix.',
      ru: 'Всё в подвижность: Swift, Elusive и Seeker на 5. Не урон за удар, а число попаданий и удачных отходов. Против игроков это часто ценнее ещё одного атакующего аффикса.',
    },
  },
  {
    k: 'strix-burst', c: 13, a: 'Dagger',
    code: '17lpUbU7lxeXFRZQSdRBrckZxgBgkUaBY6vLyUmO',
    t: [['Fervid', 5], ['Valor', 5], ['Swift', 5], ['Burst', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Ouverture au poignard', en: 'Dagger Opener', ru: 'Вскрытие кинжалом' },
    d: {
      fr: "Fervid et Valor à leur palier pour que la fenêtre d'ouverture fasse mal, Swift 5 pour y arriver et en repartir. Burst en appoint. Un build qui décide du combat dans les deux premières secondes, ou qui le perd.",
      en: 'Fervid and Valor at their breakpoint so the opening window hurts, Swift 5 to get there and get out. Burst on top. It decides the fight in the first two seconds, or loses it.',
      ru: 'Fervid и Valor на пороге, чтобы окно вскрытия било больно, Swift 5 — чтобы дойти и уйти. Burst сверху. Бой решается в первые две секунды.',
    },
  },
  {
    k: 'strix-duree', c: 13, a: 'Dual Blades',
    code: 'Gtf33GVc4Z0Ni6DXEC2zHfjOcU6xs7WFvqy6am',
    t: [['Fervor', 5], ['Strife', 5], ['Valor', 5], ['Elusive', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Lames jumelles', en: 'Twin Blades', ru: 'Парные клинки' },
    d: {
      fr: "L'inverse du poignard : Fervor et Strife montent avec les coups répétés, donc le build gagne en valeur plus le combat dure. Valor 5 pour la pénétration, Elusive pour rester au contact sans se faire enfermer.",
      en: 'The opposite of the dagger: Fervor and Strife ramp with repeated hits, so the build gains value the longer the fight runs. Valor 5 for penetration, Elusive to stay in contact without getting pinned.',
      ru: 'Противоположность кинжалу: Fervor и Strife растут от повторных ударов, поэтому чем дольше бой, тем лучше. Valor 5 — пробивание, Elusive — держаться в контакте.',
    },
  },
  {
    k: 'seer-soutien', c: 14, a: 'Catalyst',
    code: 'lfMCCbQ2jMxsUkhIXC5oerotDX6',
    t: [['Eloquence', 5], ['Blessing', 5], ['Brotherhood', 3], ['Creation', 3]],
    r: '8 × Rare',
    nom: { fr: 'Soutien de groupe', en: 'Party Support', ru: 'Поддержка группы' },
    d: {
      fr: "Le seul de la liste qui tient en Rare sur les huit pièces — la preuve qu'un build de soutien n'a pas besoin d'être doré. Eloquence 5 pour ne pas se faire interrompre, Blessing 5 pour le soin, Brotherhood et Creation pour les constructions.",
      en: 'The only one on the list that holds at Rare across all eight pieces — proof a support build need not be gold. Eloquence 5 to avoid interruption, Blessing 5 for healing, Brotherhood and Creation for constructs.',
      ru: 'Единственный в списке, который держится на Rare во всех восьми предметах — доказательство, что саппорту не нужно золото. Eloquence 5 против прерываний, Blessing 5 — лечение.',
    },
  },
  {
    k: 'seer-mele', c: 14, a: 'Mace',
    code: 'Gtf33RYYwef3oalw0RW77ML2ZHgwo0AZGvWOUC',
    t: [['Aegis', 5], ['Valor', 5], ['Tenacious', 5], ['Smiting', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Seer de mêlée', en: 'Melee Seer', ru: 'Ближний сир' },
    d: {
      fr: "La masse plutôt que le catalyseur : on renonce au soutien pur pour tenir la ligne. Aegis, Valor et Tenacious à leur palier — un affixe défensif, un offensif, un de vie. Smiting rend de l'énergie sur les coups portés.",
      en: 'Mace over catalyst: you give up pure support to hold the line. Aegis, Valor and Tenacious at their breakpoint — one defensive, one offensive, one health. Smiting returns energy on hits landed.',
      ru: 'Булава вместо катализатора: отказ от чистой поддержки ради удержания линии. Aegis, Valor и Tenacious на пороге. Smiting возвращает энергию за удары.',
    },
  },
  {
    k: 'wk-degat', c: 15, a: 'Greatsword',
    code: 'Gtf39K8FC9PTBshbbkihIUxlHnXyuiUcA6MiI4',
    t: [['Valor', 5], ['Wrath', 5], ['Fervor', 5], ['Swift', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Espadon', en: 'Greatsword', ru: 'Двуручник' },
    d: {
      fr: "Trois offensifs à leur palier, dont deux qui apportent de la pénétration. Contre les monstres, tous à 705 de défense soit 50 % de réduction, chaque point de pénétration retire un point entier de mitigation — c'est le meilleur rendement du jeu.",
      en: 'Three offensive affixes at their breakpoint, two of which bring penetration. Against monsters, all sitting at 705 defence for a flat 50 % reduction, every point of penetration removes a whole point of mitigation — the best return in the game.',
      ru: 'Три атакующих аффикса на пороге, два дают пробивание. У всех монстров 705 защиты, то есть 50 % снижения, и каждая единица пробивания снимает целый процент — лучшая отдача в игре.',
    },
  },
  {
    k: 'wk-tank', c: 15, a: 'Polearm and Shield',
    code: 'Gtf36TNBhWZJ2NgOEETvSTTca2dU5MiUje0pFo',
    t: [['Aegis', 5], ['Bulwark', 5], ['Tenacious', 5], ['Stoic', 3]],
    r: '8 × Excellent',
    nom: { fr: 'Ligne de front', en: 'Front Line', ru: 'Передовая' },
    d: {
      fr: "Quatre défensifs, trois à leur palier. La lance et bouclier bloque : Bulwark 5 réduit ce que le blocage laisse passer, Aegis 5 la défense de fond. On ne tue personne vite, on ne meurt pas.",
      en: 'Four defensive affixes, three at their breakpoint. Polearm and shield blocks: Bulwark 5 cuts what gets through the block, Aegis 5 handles the base defence. You kill nobody fast, you die to nobody.',
      ru: 'Четыре защитных аффикса, три на пороге. Копьё со щитом блокирует: Bulwark 5 срезает прошедший урон, Aegis 5 — базовая защита. Никого не убьёшь быстро, но и не умрёшь.',
    },
  },
];
