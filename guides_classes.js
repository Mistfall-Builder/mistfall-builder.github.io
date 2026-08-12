/* Un guide par classe, écrit à partir des données du site.
 *
 * TOUT CE QUI EST CHIFFRÉ ICI SORT DES DONNÉES : les coefficients viennent
 * de skills.js, l'augmentation critique de la page de classe, les paliers
 * d'affixes de donnees.js, la règle des monstres à 705 de défense de la page
 * de mécaniques du wiki. Rien n'est estimé de tête.
 *
 * CE QUE CES GUIDES NE SONT PAS : un classement. « La meilleure classe »
 * dépend du contenu joué et de l'adversaire ; ce qui est écrit ici, ce sont
 * des faits mesurables et ce qu'ils impliquent.
 *
 * Le balisage est celui des guides de joueurs : # pour un titre, - pour une
 * puce, une ligne vide entre deux paragraphes.
 */
window.D_GUIDES_CLASSES = [
  {
    c: 10, k: 'mercenary',
    titre: { fr: 'Mercenary — le marteau paie la lenteur',
             en: 'Mercenary — the hammer pays for the slowness',
             ru: 'Mercenary — молот окупает медлительность' },
    corps: {
      fr: `Le Mercenary a les plus gros coefficients du jeu, et de loin.

# Les chiffres
- 12 compétences sur 13 ont un coefficient publié — c'est la classe la mieux documentée.
- Power Hammer cumule 10,18 × Attack sur onze coups, et sans branche : la somme entière tombe vraiment. Aucune autre classe n'approche ce nombre.
- Skullcrusher affiche 9,10 en somme, mais se sépare en deux branches : un coup réel vaut 6,34 ou 7,42 × Attack. 20 s de recharge.
- Augmentation critique : 35 %.

# Ce que ça implique
Un coefficient de 10 transforme chaque point d'Attaque en dix points de dégâts. Sur cette classe, Valor — qui augmente l'Attaque en pourcentage — rapporte donc mécaniquement plus que sur les autres.

Mais un coefficient énorme sur une recharge de 20 s veut dire que rater le coup coûte 20 s. La lenteur est le vrai prix, pas les dégâts.

# Les affixes qui comptent
- Valor 5 : + Attaque, et le palier ajoute de la pénétration de défense.
- Fervor 5 : + dégâts physiques et magiques, palier également en pénétration.
- Swift : ne fait aucun dégât mais raccourcit le temps passé à découvert entre deux frappes lentes.

Tous les monstres du jeu ont 705 de défense, soit 50 % de réduction. Chaque point de pénétration retire un point entier de cette mitigation : c'est le meilleur rendement disponible, et deux affixes offensifs en donnent gratuitement à leur palier.

# Les deux armes
Sword and Shield bloque et tient la ligne ; Hammer frappe fort et lentement. Le site sépare leurs compétences en deux groupes : ce ne sont pas les mêmes builds.`,
      en: `The Mercenary has the biggest coefficients in the game, by a wide margin.

# The numbers
- 12 of its 13 skills have a published coefficient — the best documented class.
- Power Hammer totals 10.18 × Attack over eleven hits, with no branching: the whole sum actually lands. No other class comes close.
- Skullcrusher shows 9.10 as a sum, but splits into two branches: a real cast is worth 6.34 or 7.42 × Attack. 20 s cooldown.
- Critical increase: 35 %.

# What follows from that
A coefficient of 10 turns every point of Attack into ten points of damage. On this class Valor — which raises Attack as a percentage — therefore pays more than it does elsewhere.

But a huge coefficient on a 20 s cooldown means missing costs you 20 s. Slowness is the real price, not damage.

# The affixes that matter
- Valor 5: + Attack, and the breakpoint adds defence penetration.
- Fervor 5: + physical and magic damage, breakpoint also in penetration.
- Swift: deals no damage but shortens the time spent exposed between two slow swings.

Every monster in the game has 705 defence, a flat 50 % reduction. Each point of penetration removes a whole point of that mitigation — the best return available, and two offensive affixes hand it to you for free at their breakpoint.

# The two weapons
Sword and Shield blocks and holds the line; Hammer hits hard and slow. The site splits their skills into two groups: these are not the same builds.`,
      ru: `У Mercenary самые большие коэффициенты в игре, с большим отрывом.

# Цифры
- У 12 из 13 умений опубликован коэффициент — самый задокументированный класс.
- Power Hammer даёт 10,18 × Атака за одиннадцать ударов и без веток: вся сумма действительно проходит. Ни один класс близко не подходит.
- Skullcrusher показывает 9,10 в сумме, но делится на две ветки: реальный каст стоит 6,34 или 7,42 × Атака. Перезарядка 20 с.
- Увеличение крит. урона: 35 %.

# Что из этого следует
Коэффициент 10 превращает каждую единицу Атаки в десять единиц урона. Поэтому Valor, повышающий Атаку в процентах, здесь окупается сильнее, чем у других.

Но огромный коэффициент при 20 с перезарядки означает, что промах стоит 20 с. Настоящая цена — медлительность, а не урон.

# Важные аффиксы
- Valor 5: + Атака, а порог добавляет пробивание защиты.
- Fervor 5: + физический и магический урон, порог тоже даёт пробивание.
- Swift: урона не даёт, но сокращает время под ударом между двумя медленными замахами.

У всех монстров 705 защиты, то есть 50 % снижения. Каждая единица пробивания снимает целый процент — лучшая отдача в игре, и два атакующих аффикса дают её бесплатно на пороге.

# Два оружия
Sword and Shield блокирует и держит линию; Hammer бьёт сильно и медленно. Сайт разделяет их умения на две группы: это разные сборки.`,
    },
  },
  {
    c: 11, k: 'sorcerer',
    titre: { fr: 'Sorcerer — trois écoles, un seul problème',
             en: 'Sorcerer — three schools, one problem',
             ru: 'Sorcerer — три школы, одна проблема' },
    corps: {
      fr: `Le Sorcerer a la plus forte augmentation critique du jeu : 40 %, contre 35 % pour la plupart et 25 % pour le Blackarrow.

# Trois écoles qui ne se jouent pas ensemble
Le jeu sépare ses 24 compétences en trois groupes de 8 : Stardust, Elemental, et les compétences partagées du bâton. Le site les affiche séparément parce que le jeu les sépare — construire à cheval sur deux écoles revient à ne rien approfondir.

# Le vrai problème : l'incantation
Les coefficients du Sorcerer sont modestes — Rockblast, le plus gros, plafonne à 1,87 × Attack pour 18 s de recharge. À côté des 10,18 du Mercenary, c'est peu.

La différence ne se joue donc pas sur le coefficient mais sur le fait de pouvoir terminer son sort. Un sorcier interrompu fait zéro dégât, quel que soit son stuff.

# Eloquence 5, la cible non négociable
- Niveaux 1 à 4 : + vitesse d'incantation, rien d'autre.
- Niveau 5 : l'incantation **ne peut plus être interrompue par les impacts mineurs**.

C'est le palier le plus rentable de la classe, et il ne coûte que d'y monter. Un build sorcier qui n'a pas Eloquence 5 laisse son plus gros gain sur la table.

# Le reste
Aegis et Tenacious à 5 pour survivre assez longtemps pour lancer. Valor et Fervor pour les dégâts, tous deux avec de la pénétration à leur palier — ce sont les **seuls** affixes du jeu qui en donnent.

Contre un monstre à 705 de défense, soit 50 % de réduction, chaque point de pénétration retire un point entier de mitigation. Un sorcier qui a Eloquence 5 et ces deux paliers a l'essentiel ; le reste est du réglage.`,
      en: `The Sorcerer has the highest critical increase in the game: 40 %, against 35 % for most and 25 % for the Blackarrow.

# Three schools that are not played together
The game splits its 24 skills into three groups of 8: Stardust, Elemental, and the shared staff skills. The site shows them separately because the game does — building across two schools means committing to neither.

# The real problem: chanting
Sorcerer coefficients are modest — Rockblast, the biggest, tops out at 1.87 × Attack on an 18 s cooldown. Next to the Mercenary's 10.18, that is small.

So the difference is not made on the coefficient but on being able to finish the cast. An interrupted sorcerer deals zero, whatever the gear.

# Eloquence 5, the non-negotiable target
- Levels 1 to 4: + chanting speed, nothing else.
- Level 5: chanting **can no longer be interrupted by minor impacts**.

That is the most profitable breakpoint of the class, and it costs only the climb. A sorcerer build without Eloquence 5 leaves its biggest gain on the table.

# The rest
Aegis and Tenacious at 5 to survive long enough to cast. Valor and Fervor for damage, both with penetration at their breakpoint — they are the **only** affixes in the game that grant any.

Against a monster at 705 defence, a flat 50 % reduction, each point of penetration removes a whole point of mitigation. A sorcerer with Eloquence 5 and those two breakpoints has the essentials; the rest is tuning.`,
      ru: `У Sorcerer самое высокое увеличение крит. урона в игре: 40 % против 35 % у большинства и 25 % у Blackarrow.

# Три школы, которые не играются вместе
Игра делит 24 умения на три группы по 8: Stardust, Elemental и общие умения посоха. Сайт показывает их раздельно, потому что так делает игра — строить на стыке двух школ значит не углубить ни одну.

# Настоящая проблема — каст
Коэффициенты Sorcerer скромные: Rockblast, самый большой, даёт 1,87 × Атака при 18 с перезарядки. Рядом с 10,18 у Mercenary это немного.

Разница решается не коэффициентом, а возможностью дочитать заклинание. Прерванный маг наносит ноль при любом снаряжении.

# Eloquence 5 — цель без вариантов
- Уровни 1–4: + скорость каста, и всё.
- Уровень 5: каст **больше не прерывается мелкими импактами**.

Это самый выгодный порог класса, и он стоит только подъёма. Сборка мага без Eloquence 5 оставляет свой главный выигрыш неиспользованным.

# Остальное
Aegis и Tenacious на 5, чтобы дожить до каста. Valor и Fervor для урона, оба с пробиванием на пороге — это **единственные** аффиксы в игре, которые его дают.

Против монстра с 705 защиты, то есть 50 % снижения, каждая единица пробивания снимает целый процент митигации. У мага с Eloquence 5 и этими двумя порогами есть главное; остальное — донастройка.`,
    },
  },
  {
    c: 12, k: 'blackarrow',
    titre: { fr: 'Blackarrow — la classe la moins documentée',
             en: 'Blackarrow — the least documented class',
             ru: 'Blackarrow — наименее задокументированный класс' },
    corps: {
      fr: `Une mise en garde d'abord : **5 compétences sur 12 seulement ont un coefficient publié**. C'est le plus mauvais taux du jeu. Les dégâts affichés par le site pour cette classe couvrent donc moins de la moitié de son arsenal.

# Les chiffres connus
- Sky Piercer : 2,10 × Attack, 20 s de recharge — le plus gros coefficient publié de la classe.
- Divine Infusion : 1,03 ×.
- Rapid Arrows : une seule ligne publiée, 0,47 × pour le « profil de tir », alors que la volée monte jusqu'à 5 flèches. Le total réel n'est donc pas déductible du wiki.
- Augmentation critique : **25 %**, la plus basse du jeu.

# Ce que ça implique
Une augmentation critique basse veut dire que miser sur les critiques rapporte moins ici qu'ailleurs. Le rendement se cherche plutôt du côté de la constance : toucher souvent, de loin, sans se faire toucher.

# Deux armes, deux jeux
Bow et Javelin ont chacun leurs 4 compétences, plus 4 partagées. Le site les sépare. La plupart des compétences de javelot n'ont pas de coefficient publié — c'est là que se concentre le trou de données.

# Les affixes
- Ranged : +8 % de dégâts à 5, et son palier ajoute +12 % de portée efficace. Sur une classe qui vit de sa distance, c'est un affixe offensif doublé d'un défensif.
- Swift, Elusive, Seeker à 5 : le build mobilité ne gagne pas en dégâts par coup, il gagne en coups placés et en fuites réussies.
- Valor et Fervor pour la pénétration de leur palier.`,
      en: `A warning first: **only 5 of its 12 skills have a published coefficient**. That is the worst rate in the game. The damage the site shows for this class therefore covers less than half its arsenal.

# The known numbers
- Sky Piercer: 2.10 × Attack, 20 s cooldown — the biggest published coefficient of the class.
- Divine Infusion: 1.03 ×.
- Rapid Arrows: a single published line, 0.47 × for the "hit profile", while the volley fires up to 5 arrows. The real total is therefore not derivable from the wiki.
- Critical increase: **25 %**, the lowest in the game.

# What follows from that
A low critical increase means betting on crits pays less here than elsewhere. The return is found in consistency instead: hit often, from afar, without being hit.

# Two weapons, two games
Bow and Javelin each have their 4 skills, plus 4 shared. The site separates them. Most javelin skills have no published coefficient — that is where the data gap sits.

# The affixes
- Ranged: +8 % damage at 5, and its breakpoint adds +12 % effective range. On a class that lives off its distance, that is an offensive affix doubling as a defensive one.
- Swift, Elusive, Seeker at 5: the mobility build gains no damage per hit, it gains hits landed and escapes made.
- Valor and Fervor for the penetration at their breakpoint.`,
      ru: `Сначала предупреждение: **коэффициент опубликован только у 5 из 12 умений**. Это худший показатель в игре. Урон, который сайт показывает для этого класса, покрывает меньше половины его арсенала.

# Известные цифры
- Sky Piercer: 2,10 × Атака, 20 с перезарядки — самый большой опубликованный коэффициент класса.
- Divine Infusion: 1,03 ×.
- Rapid Arrows: опубликована одна строка, 0,47 × за «профиль выстрела», тогда как залп доходит до 5 стрел. Реальную сумму по вики вывести нельзя.
- Увеличение крит. урона: **25 %**, самое низкое в игре.

# Что из этого следует
Низкое увеличение крит. урона означает, что ставка на криты здесь окупается хуже. Отдача — в постоянстве: попадать часто, издалека, не получая в ответ.

# Два оружия, две игры
У Bow и Javelin по 4 своих умения плюс 4 общих. Сайт их разделяет. У большинства умений копья коэффициент не опубликован — там и находится пробел в данных.

# Аффиксы
- Ranged: +8 % урона на 5, а порог добавляет +12 % эффективной дистанции. Для класса, живущего дистанцией, это атакующий аффикс, работающий и как защитный.
- Swift, Elusive, Seeker на 5: сборка на подвижность не даёт урона за удар, но даёт число попаданий и удачных отходов.
- Valor и Fervor ради пробивания на пороге.`,
    },
  },
  {
    c: 13, k: 'shadowstrix',
    titre: { fr: 'Shadowstrix — attention aux branches',
             en: 'Shadowstrix — mind the branches',
             ru: 'Shadowstrix — осторожно с ветками' },
    corps: {
      fr: `Le piège de cette classe n'est pas dans le stuff, il est dans la lecture des chiffres.

# Bloody Blade Dance : 14 coups, mais pas d'un coup
La compétence affiche 14 coups pour un total de 2,17 × Attack. Ce total **ne se réalise jamais** : le jeu sépare la compétence en deux branches, et une frappe n'en suit qu'une seule.

- Branche 1 : onze coups, 1,52 × Attack.
- Branche 2 : deux coups, 0,24 × Attack.
- Le quatorzième coup, à 0,40 ×, n'est dans aucune des deux : il tombe dans les deux cas.

Une frappe réelle vaut donc **1,92 ou 0,65 × Attack**, jamais 2,17. Le site fait choisir la branche et grise les coups de l'autre — c'est la seule lecture honnête.

# Les autres chiffres
- Spinning Slash : 1,36 × Attack, 15 s de recharge.
- Flurry Strike : 1,09 ×.
- 9 compétences sur 12 ont un coefficient publié.
- Augmentation critique : 35 %.

# Dagger contre Dual Blades
Deux jeux opposés, et le site les sépare :
- **Dagger** : ouvrir fort et disparaître. Fervid et Valor à leur palier pour que la fenêtre d'ouverture fasse mal, Swift 5 pour y arriver et en repartir.
- **Dual Blades** : Strife est le seul affixe qui se cumule (+2 % par charge à son palier), donc la valeur du build augmente avec la durée du combat.

Ce sont deux logiques inverses. Choisir l'arme, c'est choisir laquelle.`,
      en: `The trap on this class is not in the gear, it is in reading the numbers.

# Bloody Blade Dance: 14 hits, but not at once
The skill lists 14 hits totalling 2.17 × Attack. That total **never happens**: the game splits the skill into two branches, and one cast follows only one of them.

- Branch 1: eleven hits, 1.52 × Attack.
- Branch 2: two hits, 0.24 × Attack.
- The fourteenth hit, at 0.40 ×, belongs to neither: it lands either way.

A real cast is therefore worth **1.92 or 0.65 × Attack**, never 2.17. The site makes you pick the branch and greys out the other one's hits — the only honest reading.

# The other numbers
- Spinning Slash: 1.36 × Attack, 15 s cooldown.
- Flurry Strike: 1.09 ×.
- 9 of 12 skills have a published coefficient.
- Critical increase: 35 %.

# Dagger versus Dual Blades
Two opposite games, and the site separates them:
- **Dagger**: open hard and vanish. Fervid and Valor at their breakpoint so the opening window hurts, Swift 5 to get there and get out.
- **Dual Blades**: Strife is the one affix that stacks (+2 % per stack at its breakpoint), so the build gains value the longer the fight runs.

These are inverse logics. Picking the weapon is picking which one.`,
      ru: `Ловушка этого класса не в снаряжении, а в чтении цифр.

# Bloody Blade Dance: 14 ударов, но не разом
У умения указано 14 ударов на суммарные 2,17 × Атака. Эта сумма **не случается никогда**: игра делит умение на две ветки, и один каст идёт только по одной.

- Ветка 1: одиннадцать ударов, 1,52 × Атака.
- Ветка 2: два удара, 0,24 × Атака.
- Четырнадцатый удар, 0,40 ×, не входит ни в одну: он проходит в любом случае.

Реальный каст стоит **1,92 или 0,65 × Атака**, но не 2,17. Сайт заставляет выбрать ветку и гасит удары другой — единственное честное прочтение.

# Остальные цифры
- Spinning Slash: 1,36 × Атака, 15 с перезарядки.
- Flurry Strike: 1,09 ×.
- Коэффициент опубликован у 9 из 12 умений.
- Увеличение крит. урона: 35 %.

# Dagger против Dual Blades
Две противоположные игры, и сайт их разделяет:
- **Dagger**: сильно вскрыть и исчезнуть. Fervid и Valor на пороге, чтобы окно вскрытия било больно, Swift 5 — дойти и уйти.
- **Dual Blades**: Strife — единственный аффикс с накоплением (+2 % за заряд на пороге), поэтому чем дольше бой, тем ценнее сборка.

Это обратные логики. Выбор оружия — выбор одной из них.`,
    },
  },
  {
    c: 14, k: 'seer',
    titre: { fr: 'Seer — le plus grand arsenal du jeu',
             en: 'Seer — the largest arsenal in the game',
             ru: 'Seer — самый большой арсенал в игре' },
    corps: {
      fr: `25 compétences et 49 talents : le Seer a le plus gros arsenal du jeu, et de loin. C'est sa force et sa difficulté.

# Les chiffres
- Rune: Ankle Cut : 3,06 × Attack — le plus gros coefficient de la classe.
- Rune: Sweep : 2,68 ×.
- Shapeshift : 2,06 × pour 30 s de recharge.
- 15 compétences sur 25 ont un coefficient publié ; les 10 autres sont des runes de contrôle, des soins et des boucliers.
- Augmentation critique : 35 %.

# Catalyst ou Mace : deux classes en une
- **Catalyst**, 15 compétences : le jeu de runes. Contrôle, soin, boucliers. La moitié de ces compétences n'inflige aucun dégât et c'est voulu.
- **Mace**, 10 compétences : le corps-à-corps. On renonce au soutien pur pour tenir la ligne.

Le site les sépare. Un build catalyseur et un build masse n'ont presque rien en commun.

# Le build de soutien
Eloquence 5 contre les interruptions, Blessing 5 pour allonger la durée des effets, Aegis 5 pour rester debout. Trois affixes, trois rôles distincts : rien n'y est du remplissage.

Attention à une confusion fréquente : **Blessing ne soigne pas**, il fait durer les buffs (+25 % à 5). Le soin passe par Tenacious, dont le palier ajoute +7,5 % de soins en plus des +9 % de vie maximale.

# Les affixes
Eloquence 5 vaut ici ce qu'il vaut au Sorcerer : les runes s'incantent, et une rune interrompue ne fait rien. Après ça, Aegis et Tenacious pour tenir. Creation mérite un mot : son palier ajoute +5 % de dégâts physiques et magiques en plus de la durée des constructions — c'est un affixe de soutien qui finit par frapper.`,
      en: `25 skills and 49 talents: the Seer has the largest arsenal in the game by a wide margin. That is both its strength and its difficulty.

# The numbers
- Rune: Ankle Cut: 3.06 × Attack — the class's biggest coefficient.
- Rune: Sweep: 2.68 ×.
- Shapeshift: 2.06 × on a 30 s cooldown.
- 15 of 25 skills have a published coefficient; the other 10 are control runes, heals and shields.
- Critical increase: 35 %.

# Catalyst or Mace: two classes in one
- **Catalyst**, 15 skills: the rune game. Control, healing, shields. Half of these deal no damage, by design.
- **Mace**, 10 skills: melee. You give up pure support to hold the line.

The site separates them. A catalyst build and a mace build share almost nothing.

# The support build
Eloquence 5 against interruption, Blessing 5 to make effects last, Aegis 5 to stay standing. Three affixes, three distinct roles: nothing in it is filler.

Watch out for a common confusion: **Blessing does not heal**, it makes buffs last longer (+25 % at 5). Healing goes through Tenacious, whose breakpoint adds +7.5 % healing on top of +9 % maximum health.

# The affixes
Eloquence 5 is worth here what it is worth on the Sorcerer: runes are chanted, and an interrupted rune does nothing. After that, Aegis and Tenacious to hold. Creation deserves a mention: its breakpoint adds +5 % physical and magic damage on top of construct duration — a support affix that ends up hitting.`,
      ru: `25 умений и 49 талантов: у Seer самый большой арсенал в игре с большим отрывом. Это и сила, и сложность.

# Цифры
- Rune: Ankle Cut: 3,06 × Атака — самый большой коэффициент класса.
- Rune: Sweep: 2,68 ×.
- Shapeshift: 2,06 × при 30 с перезарядки.
- Коэффициент опубликован у 15 из 25 умений; остальные 10 — руны контроля, лечение и щиты.
- Увеличение крит. урона: 35 %.

# Catalyst или Mace: два класса в одном
- **Catalyst**, 15 умений: игра рун. Контроль, лечение, щиты. Половина из них не наносит урона, и так задумано.
- **Mace**, 10 умений: ближний бой. Отказ от чистой поддержки ради удержания линии.

Сайт их разделяет. Сборка на катализатор и сборка на булаву почти не пересекаются.

# Сборка поддержки
Eloquence 5 против прерываний, Blessing 5 — продлить длительность эффектов, Aegis 5 — устоять. Три аффикса, три разные роли: ничего лишнего.

Осторожно, частая путаница: **Blessing не лечит**, он продлевает баффы (+25 % на 5). Лечение идёт через Tenacious, чей порог добавляет +7,5 % лечения сверх +9 % максимального здоровья.

# Аффиксы
Eloquence 5 здесь стоит того же, что у Sorcerer: руны читаются, а прерванная руна не делает ничего. Дальше — Aegis и Tenacious, чтобы держаться. Creation стоит упомянуть отдельно: его порог добавляет +5 % физического и магического урона сверх длительности конструкций — аффикс поддержки, который в итоге бьёт.`,
    },
  },
  {
    c: 15, k: 'withered-knight',
    titre: { fr: 'Withered Knight — le meilleur compromis chiffré',
             en: 'Withered Knight — the best measured trade-off',
             ru: 'Withered Knight — лучший измеримый компромисс' },
    corps: {
      fr: `13 compétences sur 14 ont un coefficient publié, et les trois plus grosses dépassent 3,4 × Attack. C'est la classe la plus lisible du jeu après le Mercenary.

# Les chiffres
- Opportunistic Thrust : 3,44 × Attack, sans branche — c'est le plus gros coup qui tombe réellement d'un seul lancer.
- Pursuit : 3,87 en somme, mais deux branches : 3,05 ou 2,32 selon celle qui part.
- Breakthrough Charge : 3,75 en somme, deux branches à 2,13 chacune. 15 s de recharge.
- Augmentation critique : 35 %.

Les deux plus grosses sommes de la classe sont donc précisément celles qui se séparent en branches. Le site fait choisir la branche plutôt que d'additionner des coups qui ne tombent jamais ensemble — et le classement s'en trouve renversé.

# Greatsword ou Polearm and Shield
- **Greatsword**, 8 compétences : les gros coefficients ci-dessus. On avance, on frappe, on encaisse ce qui vient.
- **Polearm and Shield**, 6 compétences : le blocage. Bulwark réduit ce que le blocage laisse passer, Aegis tient le fond.

# Pourquoi la pénétration compte double ici
Les coefficients de la classe sont élevés ET ses compétences frappent souvent en physique. Contre un monstre à 705 de défense — 50 % de réduction —, passer de 50 % à 30 % de mitigation grâce à 20 % de pénétration augmente les dégâts subis de **40 %**, pas de 20 %.

Valor 5 et Fervor 5 en donnent tous les deux à leur palier. C'est le meilleur rendement disponible sans monter d'un cran de rareté.

# Le build défensif
Aegis, Tenacious et Stoic, tous les trois à 5 : trois affixes, trois paliers atteints. Aegis ajoute de la résistance physique, Tenacious du soin, Stoic une restauration de 15 % de vie. On ne tue personne vite, on ne meurt pas.

Contre des joueurs, tenir la ligne vaut souvent plus qu'un affixe offensif de plus.`,
      en: `13 of its 14 skills have a published coefficient, and the three biggest exceed 3.4 × Attack. It is the most legible class in the game after the Mercenary.

# The numbers
- Opportunistic Thrust: 3.44 × Attack, no branching — the biggest hit that actually lands from a single cast.
- Pursuit: 3.87 as a sum, but two branches: 3.05 or 2.32 depending on which one fires.
- Breakthrough Charge: 3.75 as a sum, two branches at 2.13 each. 15 s cooldown.
- Critical increase: 35 %.

So the two biggest sums of the class are exactly the ones that split into branches. The site makes you pick the branch rather than adding up hits that never land together — and the ranking flips.

# Greatsword or Polearm and Shield
- **Greatsword**, 8 skills: the big coefficients above. You walk in, you hit, you eat what comes.
- **Polearm and Shield**, 6 skills: blocking. Bulwark cuts what gets through the block, Aegis handles the base.

# Why penetration counts double here
The class's coefficients are high AND its skills mostly land as physical. Against a monster at 705 defence — 50 % reduction — going from 50 % to 30 % mitigation through 20 % penetration raises the damage taken by **40 %**, not by 20 %.

Valor 5 and Fervor 5 both hand you penetration at their breakpoint. That is the best return available without climbing a rarity tier.

# The defensive build
Aegis, Tenacious and Stoic, all three at 5: three affixes, three breakpoints reached. Aegis adds physical resistance, Tenacious adds healing, Stoic restores 15 % health. You kill nobody fast, you die to nobody.

Against players, holding the line is often worth more than one more offensive affix.`,
      ru: `У 13 из 14 умений опубликован коэффициент, а три самых больших превышают 3,4 × Атака. Это самый читаемый класс после Mercenary.

# Цифры
- Opportunistic Thrust: 3,44 × Атака, без веток — самый большой удар, который реально проходит за один каст.
- Pursuit: 3,87 в сумме, но две ветки: 3,05 или 2,32 в зависимости от того, какая пошла.
- Breakthrough Charge: 3,75 в сумме, две ветки по 2,13. Перезарядка 15 с.
- Увеличение крит. урона: 35 %.

То есть две самые большие суммы класса — как раз те, что делятся на ветки. Сайт заставляет выбрать ветку, а не складывать удары, которые никогда не приходят вместе, и порядок меняется.

# Greatsword или Polearm and Shield
- **Greatsword**, 8 умений: большие коэффициенты выше. Заходишь, бьёшь, принимаешь ответ.
- **Polearm and Shield**, 6 умений: блок. Bulwark срезает прошедший урон, Aegis держит базу.

# Почему пробивание здесь считается вдвойне
Коэффициенты класса высокие И умения в основном физические. Против монстра с 705 защиты — 50 % снижения — переход с 50 % на 30 % митигации за счёт 20 % пробивания повышает полученный урон на **40 %**, а не на 20 %.

Valor 5 и Fervor 5 дают пробивание на пороге. Это лучшая отдача без подъёма редкости.

# Защитная сборка
Aegis, Tenacious и Stoic, все три на 5: три аффикса, три достигнутых порога. Aegis даёт физическое сопротивление, Tenacious — лечение, Stoic восстанавливает 15 % здоровья. Никого не убьёшь быстро, но и не умрёшь.

Против игроков удержание линии часто ценнее ещё одного атакующего аффикса.`,
    },
  },
];
