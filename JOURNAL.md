# Mistfall Helper — journal de bord

But de ce fichier : permettre à n'importe qui (humain ou IA) de **reprendre
le projet sans rien savoir d'autre**. Il décrit ce qui existe, pourquoi, ce
qui est vérifié, et ce qui reste ouvert.

**À tenir à jour à chaque modification.** Une entrée = quoi, pourquoi, et
comment ça a été vérifié. Une correction non vérifiée n'est pas une
correction, c'est une hypothèse.

---

## 1. Ce que c'est

Deux choses qui partagent le même moteur :

| Quoi | Où | Pour qui |
|---|---|---|
| **Mistfall Helper** — application Windows | `C:\Projets Claude\AuctionAutoSell\` | l'auteur |
| **Mistfall Builder** — site public | `site/`, publié sur GitHub Pages | tout le monde |

Le jeu est *Mistfall Hunter*. On compose un ensemble d'équipement
(« stuff ») qui atteint des niveaux d'affixes visés, et on obtient le
**code d'import** que le jeu accepte dans *Prepare → Manage/Import*.

- Site en ligne : <https://mistfall-builder.github.io/>
- Dépôt du site : `mistfall-builder/mistfall-builder.github.io`
- Base de comptes : Supabase, projet `grnndksniashncksyzvv`

---

## 2. Règles absolues du projet

Elles viennent de l'auteur et priment sur toute autre considération.

1. **Ne jamais inventer.** Aucune donnée de jeu supposée. Si une valeur n'est
   pas mesurée, elle est inconnue et on le dit.
2. **Les noms du jeu restent en anglais** (objets, affixes, gemmes, raretés,
   classes), dans toutes les langues de l'interface. La conversation avec
   l'auteur est en français.
3. **Ne jamais recompiler l'exe sans demande explicite.** « build l'exe »
   ou équivalent.
4. **Ne pas compter la rareté `Damaged`.**
5. **Ne jamais parler d'une certaine capture d'un jeu tiers.**
6. Vérifier avant d'affirmer. Toute mesure comparative doit utiliser la
   **même méthode des deux côtés** (piège rencontré deux fois, voir §7).

---

## 3. Le moteur (partagé)

`game_data.py` côté Python, `site/app.js` côté navigateur. **Les deux
implémentations doivent rester d'accord** — un test le vérifie (§8).

### Enchaînement d'un build

1. `build_loadout(classe, cibles, arme, rareté, vin, panaché, planchers, vin_manuel)`
2. essaie chaque rareté de la plus basse à la plus haute jusqu'à ce qu'une
   suffise (sauf rareté imposée : aucune escalade, par construction)
3. si panaché : relance une recherche locale depuis **deux** points de
   départ — le build suffisant, et le dernier palier insuffisant
4. **passe d'allègement** : redescend chaque pièce tant que toutes les cibles
   tiennent
5. pose des gemmes : gloutonne pendant la recherche, **exacte** au final

### Fonctions notables

| Fonction | Rôle |
|---|---|
| `alleger(...)` | rend les crans de rareté inutiles |
| `suggestions(...)` | échanges d'UNE pièce qui gagnent sans rien perdre |
| `repartition_vin(...)` | Victory Wine, automatique ou imposé |
| `variantes(...)` | répartitions de raretés possibles (Python seulement) |
| `alternatives(...)` | pièces interchangeables par emplacement (JS) |

---

## 4. Le codec des codes d'import — **décodé et vérifié en jeu**

C'est la pièce maîtresse. `code_import.py`.

```
base62 → BigInt → octets (octet 0 = poids fort)
bits écrits POIDS FAIBLE EN TÊTE dans chaque octet
[24 bits en-tête 0x134E01][10 bits version=1][4 bits classe]
puis 9 emplacements [0,1,2,3,4,5,6,10,11], chacun :
   [10 bits index d'objet] puis holeCount × [10 bits index de gemme]
bourrage de zéros
```

- Structure d'un identifiant : 7 chiffres
  `[2 emplacement][1 rareté][2 famille][2 variante]`
- Les emplacements **10 et 11** sont les deux armes. La *Polearm and Shield*
  vit en 11, ce qui explique son absence du catalogue public.
- **Vérifié dans les deux sens** : 31/31 codes du registre font l'aller-retour
  à l'identique ; deux codes fabriqués ont été importés en jeu et ont donné
  exactement les pièces annoncées.

---

## 5. Règles du jeu mesurées

Détail complet dans `docs/regles_du_jeu.md`. L'essentiel :

- Variantes **01–07** : exactement 1 inné. **08–09** : aucun inné, mais un
  emplacement de gemme en plus (156/156 vérifiés pour chaque).
- **L'inné dépend de (emplacement, famille, variante) et de rien d'autre** :
  273 groupes sur 273 cohérents, 0 conflit sur 1092 objets. La rareté n'y
  change rien ; la famille si.
- 4 matériaux de gemme × 12 affixes. Colliers et bagues n'ont jamais d'inné.
- Le **palier** d'un affixe plafonné à 7 est au niveau **5**, pas 4.
- **Victory Wine** : au plus 2 points sur au plus 4 affixes, 8 au total.
  Rien n'oblige à mettre 2 partout.

### Les 155 objets absents du catalogue public

Reconstitués par élimination (`innes_deduits.py`). La méthode est lancée à
l'aveugle sur les captures d'hôtel des ventes puis **confrontée au
catalogue** : elle doit retrouver ce qu'il affirme déjà, sinon elle refuse
de publier. Score : **262 sur 262**, zéro erreur.

| Cas | Objets | Comment |
|---|---|---|
| variantes 08/09 | 34 | aucun inné, par règle |
| famille connue ailleurs | 63 | par la loi (emplacement, famille, variante) |
| famille 10 Polearm and Shield | 37 | par élimination, appariement **unique** |
| familles 11–13 (Holy jamais vues) | 21 | **inconnu**, et laissé inconnu |

Polearm and Shield, complète : 01 Unyielding · 02 Tenacious · 03 Bulwark ·
04 Distant Ward · 05 Brotherhood · 06 Spirit Shield · 07 Fervor ·
08 et 09 aucun.

---

## 6. Le site

`site/` — statique, aucun serveur, tout se calcule dans le navigateur.

| Fichier | Rôle |
|---|---|
| `index.html` | la page, le style, les balises `data-i18n` |
| `app.js` | moteur de build + interface |
| `i18n.js` | français / anglais / russe |
| `donnees.js` | données du jeu, chargées par balise `<script>` |
| `comptes.js` | comptes Supabase (facultatif) |
| `config.js` | URL + clé publique Supabase |
| `icones/`, `fond/` | images du jeu |

**`donnees.js` et pas `fetch(donnees.json)`** : ouvert depuis le disque
(`file://`), un `fetch` est refusé et la page restait vide.

**Les scripts portent `?v=N`** dans `index.html`. GitHub Pages sert l'ancien
JavaScript en cache plusieurs minutes après une mise en ligne : sans ce
numéro, page neuve + vieux code. **À incrémenter à chaque modification.**

### Fonctionnalités

- choix classe / arme / rareté (**« Auto » par défaut**), panaché, planchers
  par emplacement (plusieurs à la fois)
- 44 affixes listés : niveau visé, points de vin, **préférence** (neutre /
  bonus souhaité / refusé)
- code d'import généré et importable
- **Suggestions** : échanges d'une pièce, jamais appliqués sans clic, ne
  changent **jamais** la rareté
- **Pièces interchangeables** : par emplacement, toutes celles qui tiennent
- Mes builds : enregistrer, charger **à l'identique**, lien de partage,
  export/import, comptes Supabase, builds publics
- Trois langues, drapeaux en haut à droite

### Publier

```
cd site
git add -A && git commit -m "..." && git push
```
ou double-clic sur `pousser-le-site.bat`. Compter ~45 s avant la mise en
ligne effective.

---

## 7. Pièges rencontrés — à ne pas refaire

1. **Mesure biaisée.** Comparer une pose de gemmes *exacte* à des poses
   *gloutonnes* fait paraître perdant tout échange. Rencontré deux fois :
   sur les « occasions manquées », puis sur les suggestions qui ne rendaient
   jamais rien. **Toujours mesurer les deux côtés pareil.**
2. **Le panaché partait du build suffisant** (donc tout doré) et ne pouvait
   plus que redescendre — ce qu'une recherche locale ne sait pas faire.
3. **Une rareté figée n'escalade jamais.** Avec Epic par défaut, tout build
   ayant besoin d'une pièce dorée annonçait « pas atteignable ».
4. **Enregistrer un build n'enregistrait pas le build**, seulement la liste
   d'affixes : le rouvrir le recomposait et donnait autre chose.
5. **Le vin survivait à la suppression de sa cible** et mangeait une des
   quatre places.
6. **PowerShell `Set-Content` casse l'encodage** des fichiers accentués
   (double encodage UTF-8). **Utiliser Python** pour tout patch de fichier.
7. **La compilation échoue si l'application est ouverte** (`PermissionError`).

---

## 8. Vérifier avant de livrer

```
python innes_deduits.py                 # doit afficher 262/262, fiable=True
python tools/generer_site.py            # régénère donnees.js + icônes
node <scratchpad>/test_site.mjs         # JS et Python doivent concorder
```

Contrôles manuels utiles : importer un code puis le ré-exporter (doit être
identique) ; enregistrer un build, en charger un autre, revenir (doit être
identique).

---

## 9. Compiler

```
python build_exe.py                     # -> dist\Mistfall Helper.exe
python installer\build_installer.py     # -> dist\...Setup.exe
```

Fermer l'application d'abord. Tout module importé **dans une fonction**
doit figurer dans les `hidden imports` de `build_exe.py` (`innes_deduits`,
`theme_sombre`…) : l'analyse statique de PyInstaller ne les voit pas.

---

## 10. Ce qui reste ouvert

- **21 objets** (familles 11–13, armes *Holy*) : innés inconnus. Il faudrait
  un code d'import ou une capture par variante.
- **Interface de l'application** : les fonctions `variantes`, `alternatives`
  et `suggestions` existent dans `game_data.py` mais **ne sont exposées que
  sur le site**.
- **Thème sombre de l'application** : posé globalement, mais des styles
  bleus définis pièce par pièce subsistent et ne suivent pas l'accent orange.
- **Réglages Supabase** à faire dans le tableau de bord : décocher *Confirm
  email* (sinon quota d'envoi saturé → « trop d'essais » en boucle), et
  renseigner l'adresse du site dans *Authentication → URL Configuration*.
- **Le site publie ses données.** `donnees.js` est téléchargeable par qui
  regarde le code source. Seul un calcul côté serveur y changerait quelque
  chose.

---

## 11. Historique

Entrées les plus récentes en premier.

### Quatre chantiers d'un bloc

**1. Les suggestions disent enfin ce qui change.** 340 groupes de noms sur
388 contiennent plusieurs pièces différentes — « Commander Sword and Shield »
désigne huit objets. « X → X » n'apprenait donc rien. Une *signature*
remplace le nom : `Creation · Agate II, Peridot I → Fervid · Agate II,
Moonstone I`. Appliqué aussi aux pièces interchangeables.

**2. Les talents, récoltés et affichés.** 241 talents, 157 avec des effets
chiffrés, 89 compétences liées via le tableau « Talents that change how X
plays » de chaque page de sort. Ils apparaissent sous le sort concerné, dans
un dépliant.

**Ils ne sont PAS appliqués aux dégâts, et l'écran le dit.** On sait que le
jeu donne 8 points au niveau 12 et que les branches ouvrent à des niveaux
différents, mais ni les prérequis ni les exclusivités ne sont publiés. Un
simulateur bâti là-dessus aurait l'air officiel sans l'être.

Deux pièges du wiki, les mêmes que pour les compétences : le sommaire répète
les titres de section (« Exact values » y figure avant la vraie section — les
241 talents ressortaient sans un chiffre), et les liens internes découpent
les descriptions (« Focus Fire » se résumait à « Rapid Arrows »).

**3. Un onglet Communauté, trois vues.** Les deux onglets qui ouvraient sur
du vide sont fusionnés. Rien n'est supprimé : les identifiants des anciennes
pages sont conservés, le code qui les pilotait tourne tel quel.

La première vue ne peut pas être vide : **12 builds de référence**, deux par
classe, avec l'illustration de classe du jeu. Ils ont été **produits par
l'optimiseur de ce site**, pas recopiés : chacun atteint ses cibles et sort
un code d'import valide. Un build copié sur une capture pourrait ne même pas
être légal en jeu.

**Les votes.** Un par compte et par build, garanti par la clé primaire
`(build, votant)` — pas par une règle du navigateur, qui se contourne. Un
second vote bascule au lieu de s'ajouter. Le votant n'est jamais exposé : les
fonctions ne rendent qu'un compte et un « et toi ? » calculé pour l'appelant.
Tri « les plus votés » ajouté.

Défaut attrapé : `rpc()` n'envoyait pas le jeton, donc `auth.uid()` aurait
été nul et tout vote refusé. Un `rpcSigne()` s'en charge, et retombe sur
l'appel anonyme hors connexion.

**4. Comparer deux builds.** « Le mien ou celui-là ? ». Un bouton met le
build courant de côté, le suivant s'affiche à côté avec l'**écart** coloré,
sur dix statistiques et tous les affixes. Les deux sont rejoués depuis leur
code d'import : on compare ce qui serait porté, pas ce qui était visé.

**Vérifié avant publication** : 6 classes sur 6 calculent, sortent un code,
affichent fiche et compétences ; aucun débordement horizontal ; les trois
langues à 322 clés sans écart ; zéro erreur console. Et le site fonctionne
**avant** que les migrations soient appliquées — le bouton de vote ne
s'affiche que si la base rend un identifiant.

### Builds des amis rangés, et un guetteur de version

**« Builds de mes amis »** descend sous « Mes builds », dans la colonne de
gauche, replié et d'un cran plus discret : consulter la bibliothèque d'un ami
est occasionnel, et la carte occupait une largeur entière dans la colonne
principale.

**Le guetteur.** GitHub Pages sert `index.html` avec `max-age=600` : pendant
dix minutes après une mise en ligne, un visiteur déjà venu garde l'ancienne
page. Cet en-tête ne se change pas. Le site relit donc `version.txt` sans
cache à chaque chargement et le compare au `?v=` de son propre script ; s'ils
diffèrent, un bandeau discret le dit.

Il ne recharge **jamais** tout seul : une page qui se recharge sous les doigts
fait perdre le réglage en cours. Vérifié dans les deux sens — pas de bandeau
quand tout est à jour, bandeau quand la version distante est plus récente.

`bump.py` incrémente maintenant les `?v=` **et** `version.txt` d'un seul
geste. Les séparer, c'est garantir qu'un jour l'un avance sans l'autre et que
tout le monde voit le bandeau en boucle.

### Cartes repliables, et le palier expliqué

**Suggestions** devient un dépliant, **replié par défaut** : six propositions
prenaient la moitié d'un écran alors qu'on ne les consulte qu'à l'occasion.
Même flèche que « Pièces interchangeables », pour ne pas inventer un second
vocabulaire.

Repliées en silence, personne ne saurait qu'elles existent : le nombre
s'affiche dans le bandeau, et celui-ci **bat doucement** tant qu'on ne l'a
pas ouvert. Un battement de 2,1 s, pas un clignotement — un clignotement
franc attire l'œil puis l'épuise. Il s'arrête à la première ouverture :
signaler deux fois la même chose devient du harcèlement. Neutralisé sous
`prefers-reduced-motion`.

**Affixes visés** et **Affixes obtenus** deviennent repliables aussi, mais
**ouverts par défaut** : ce sont les tableaux qu'on vient consulter, on veut
seulement pouvoir les ranger en travaillant plus bas dans la page.

**Le palier**, enfin, dit ce qu'il est. L'étiquette n'apprenait rien à qui ne
connaît pas la mécanique. Une infobulle explique maintenant : au niveau
indiqué, l'affixe gagne un SECOND effet en plus de sa progression normale.
Aegis 4 donne Defense +60 ; Aegis 5 donne Defense +75 **et** Physical
Resistance +2.5 %. 24 affixes sur 44 en ont un — 18 au niveau 5, 6 au
niveau 4.

### « Quand est-ce que je peux m'arrêter ? »

Demandé sur Discord : après un build, savoir ce qu'on peut ENCORE prendre
sans rien perdre, au lieu de tâtonner en ajoutant un affixe, recalculant, et
recommençant.

Une carte « Encore disponible » liste, pour chaque affixe, jusqu'où on
pourrait le monter. Cliquer une ligne le pose comme cible à ce niveau et
relance le calcul.

**Première version fausse, corrigée avant publication.** J'ai d'abord compté
les emplacements de gemme VIDES — il n'y en a jamais : l'optimiseur comble
les trous restants avec des gemmes bonus, c'était voulu. La carte ne
s'affichait donc jamais.

Ce qui est réellement disponible, ce sont les emplacements **réaffectables**
— ceux dont la gemme ne sert aucune cible demandée. Les vider ne coûte rien.
Le socle est recalculé en retirant ces gemmes, sinon un affixe déjà porté par
une gemme bonus verrait sa marge comptée deux fois.

**Chaque ligne est prise SEULE, et l'écran le dit** : deux affixes peuvent
convoiter le même emplacement, leurs marges ne s'additionnent pas. Même
discipline que les pièces interchangeables.

Contrôlé : 33 builds, **132 promesses, 132 tenues**, et les cibles d'origine
gardées dans les 132 cas.

### La recherche d'affixes lit aussi les effets
Signalé sur Reddit : personne ne devine que la vitesse de déplacement
s'appelle « Swift » ou « Focused ». La recherche balaie maintenant le nom, la
description et les libellés des sept niveaux. « speed » ramène Eloquence,
Energy Recovery Speed Increase, Focused, Seamless, Seeker, Sleight of Hand et
Swift. Plusieurs mots se cumulent dans n'importe quel ordre : « magic res »
trouve « Magic Damage Reduction ».

### Le site occupe les grands écrans
1460 px laissaient un tiers d'un écran 1440p vide. La largeur passe à
1800 px, déclarée une seule fois (`--large`) au lieu de quatre valeurs
identiques dispersées, la colonne de réglages à 360 px, et au-delà de
1600 px les grilles de compétences, de builds et de statistiques prennent une
colonne de plus plutôt que d'étirer leurs cartes.

### Le Victory Wine ne comptait que pour le contrôle, pas pour la recherche

Signalé sur Reddit avec deux codes reproductibles, reproduit à l'identique.

Un Sorcerer visant Eloquence 7, Valor 7, Elusive 5, Fervid 5 **avec +2 de vin
sur chacun** sortait 8 pièces **Epic**. Demander 5/5/3/3 **sans vin** — la même
chose exactement, puisque le vin apporte les 2 manquants — sortait 8 pièces
**Excellent**. Un cran de rareté de trop sur les huit pièces.

**Cause.** `vinPoints` n'entrait que dans `suffit()`, le contrôle final. La
recherche, elle, visait les niveaux PLEINS : elle dépensait ses gemmes à
pousser Eloquence vers 7 alors que le vin en apportait déjà 2, puis concluait
qu'il fallait monter d'un cran. Le commentaire du moteur Python annonçait
pourtant l'intention (« un affixe déjà porté à 5 par le vin ne doit pas se
voir attribuer trois gemmes de plus ») — elle n'avait jamais été implémentée.

**Correctif.** Le vin se retire des cibles AVANT de chercher :
`cibleGear = visé − vin`, un affixe entièrement couvert par le vin sortant de
la recherche. Le contrôle final reste sur les cibles pleines, la promesse
faite à l'utilisateur. Même règle appliquée à `alleger`, `alternatives` et
`suggestions`, avec une allocation de vin vide quand elle est déjà soustraite
— sinon elle compterait deux fois.

**Mesuré, 140 cas déterministes, avant / après :**

| | avant | après |
|---|---|---|
| erreurs | 0 | 0 |
| suffisants | 88 | 88 |
| incohérents | 0 | 0 |
| somme des raretés | 4252 | **4052** |
| durée | 9093 ms | 6315 ms |

Rien de ce qui passait n'échoue, 200 crans de rareté rendus, et c'est plus
rapide puisque la recherche ne poursuit plus des niveaux déjà acquis. Les
deux réglages du rapport donnent désormais le **même code d'import**.

Côté Python : même correctif, 80 builds tirés au sort, 0 erreur, 0 promesse
rompue. L'exécutable n'est pas reconstruit pour autant.

### Images, écoles de compétences, filtres de bibliothèque

**Les icônes.** Le wiki publie une icône par compétence (`/icons/<id>.webp`) :
les 100 sont récupérées, reconnues à leur texte de remplacement (« <nom>
icon ») et non à leur position, sinon on ramassait celle d'un talent voisin.
La fiche gagne un bandeau des pièces portées, un pictogramme par
statistique, et les pastilles de catégorie devant chaque affixe dans
« D'où vient chaque nombre ».

`loading="lazy"` retiré des icônes : 25 images de 7 Ko par classe ne
justifient pas de différer, et l'attente laissait des cases vides quand
l'IntersectionObserver ne se déclenchait pas.

**Les écoles.** Les pages de classe du wiki groupent les compétences —
Sorcerer : Stardust / Elemental / Shared Staff Skills ; les autres classes
se départagent par l'arme. Ces groupes sont récoltés et le panneau les
présente en dépliants, ouverts sur celui de l'arme du build. Le dernier
groupe d'une page n'a pas de marqueur de fin : il est **borné par le compte
annoncé** (« 8 skills »), sans quoi il ramassait 19 compétences au lieu de 8.

**Les filtres de « Mes builds ».** Recherche, classe, rareté, tri. Ils
n'apparaissent qu'à partir de six builds : au-dessous, ils prennent plus de
place qu'ils n'en font gagner.

La rareté affichée est celle **réellement portée**, relue dans le code
d'import — le 3e chiffre d'un identifiant est la rareté (structure vérifiée
en jeu). Le réglage seul ne disait rien : un build enregistré en « Auto »
s'affichait « Auto » trois semaines plus tard. Une seule couleur → cette
couleur ; plusieurs → « Panaché Epic + Legendary ». Le filtre accepte donc
« panachés seulement » ou une couleur précise, qu'elle soit seule ou mêlée.

Piège évité : après filtrage, l'index d'une ligne ne désigne plus la même
entrée dans la bibliothèque. La suppression retrouve la ligne par son nom.

### Descriptions, dégâts bruts par défaut, et la colonne collante

Chaque compétence porte maintenant sa description. Elle est recollée depuis
la page : les liens internes la découpent en morceaux, et deux bornes
naïves l'avaient d'abord tronquée — s'arrêter au nom de la classe coupait
Rapid Arrows après quatre mots (la classe est citée *dans* le texte), et
borner à deux lignes avant « Browse Skills » laissait un mot orphelin sur
les pages qui listent deux armes. 100 descriptions, aucune parasitée.

La cible par défaut passe aux **dégâts bruts** : c'est le chiffre qui se
compare d'un sort à l'autre sans hypothèse sur l'adversaire.

Les mentions techniques sous chaque sort sont retirées de la vue courante ;
la réserve sur les critiques et la résistance des monstres tient en une
ligne dans le dépliant « D'où vient chaque nombre », qui est replié.

**La fiche recouvrait « Calculer le build ».** Elle était un troisième
élément de la grille de `<main>`, donc en ligne 2 — mais la colonne de
gauche est `position:sticky` et son aire de grille descend jusqu'au bas de
la ligne 1 : en défilant, elle passait par-dessus. La fiche est sortie de
`<main>` dans sa propre `<section>`, et `montrerPage` la suit explicitement.

### Les textes oubliés
« Auto — la plus basse qui suffit » devient « Auto ». Le libellé était
écrit en dur dans `app.js` : il restait en français dans les trois langues
et ignorait le dictionnaire.

Chasse systématique menée à ce moment-là : **12 autres messages** étaient
dans le même cas (« Rien à exporter », « Build chargé tel quel », « Inné : »,
les dix libellés de statistiques des infobulles d'objets…). Les clés
existaient pour la plupart, déclarées puis jamais utilisées — ce qui ne se
voit pas tant qu'on ne compare pas. Contrôle ajouté : aucune chaîne
accentuée ne subsiste hors dictionnaire, et les trois langues ont
**280 clés chacune, zéro écart**.

### D'où vient la Défense 705
Page `/mechanics/` du wiki, deux fois : « Every monster in the game ships
Defence 705, a flat 50% reduction », et l'exemple chiffré « Against Defence
705 (50%) the hit lands for 64.8 ». Notre courbe donne bien 50,0 % à 705 et
33,1 % à 400, la valeur que le wiki publie comme contrôle.

### Fiche de personnage, compétences, galerie et guides

**La fiche.** `site/fiche.js` calcule Attaque, Défense, Vie, résistances,
pénétration et vie effective. Rien n'est estimé : stats de départ des pages
de classe du wiki (Attack 100 / Defense 50 / Health 618 partout), stats des
pièces depuis le jeu, effets d'affixes lus au niveau réellement atteint.
La courbe Défense → réduction reproduit l'exemple publié par le wiki
(Défense 400 → 33,1 %) et le monstre standard (705 → 50 %).

**Les compétences.** Les 100 fiches du wiki, dont 70 avec coefficient. Le
panneau calcule coup par coup avec l'Attaque du build, contre un monstre,
en brut, ou contre un personnage identique. Les 30 compétences sans
coefficient publié le disent au lieu d'afficher un chiffre inventé.

**La galerie.** Tri, filtre de classe, recherche, pagination, tout côté
base. Le vide « personne n'a publié » est distingué du vide « ton filtre ne
ramène rien » via `combien_de_builds_publics()`.

**Les guides.** Table + RLS + deux fonctions. Balisage minuscule (titres,
puces, paragraphes) et échappement systématique : accepter du HTML écrit
par un inconnu et affiché à tous serait une faille.

### Trois bugs trouvés par les garde-fous, pas par hasard

1. **La synchronisation dépubliait en silence.** La fusion reconstruisait
   chaque build à partir du serveur seul : la case « ami » n'était même pas
   demandée dans la requête et disparaissait à chaque passage, et une case
   « public » cochée ici mais pas encore arrivée là-bas était décochée puis
   RENVOYÉE décochée. C'est ce qui a dépublié « Jaune tanky ». Les deux
   visibilités s'additionnent maintenant (OU) au lieu de se remplacer.

2. **`+10.5%` valait 10 %.** Le lecteur d'effets découpait sur les points,
   donc « Attack +10.5% » devenait « Attack +10 » et « 5% ». Valor 7
   rendait ×1.100 au lieu de ×1.105. Le point n'est une fin de phrase que
   s'il n'est pas suivi d'un chiffre.

3. **Le libellé cherché en fin de morceau.** « Movement Speed +4.5%,
   stacking up to 2 times » perdait sa vitesse parce que la phrase finit
   par « 2 times ». On balaie maintenant chaque libellé connu partout dans
   le texte.

`site/test_fiche.js` passe les 44 affixes à leurs 7 niveaux : **246 phrases,
0 mal comprise**, plus 10 valeurs contrôlées une par une et la courbe
vérifiée contre l'exemple du wiki.

`tools/completer_affixes.py` a comblé 15 libellés manquants sur 12 affixes
depuis le wiki, sans jamais écraser un texte venu du jeu. Cinq noms
diffèrent entre wiki et jeu et ont été reliés sur la DESCRIPTION, pas sur la
ressemblance. « Critical Damage » n'a **volontairement pas** été relié à
« Headshot Damage » : les descriptions diffèrent, ce sont deux choses.

### Le panaché ne se garde plus
Décoché à chaque lancement de l'outil, jamais restauré. Le retrouver coché
sans l'avoir demandé rend le résultat incompréhensible.

### Un seul mot, et une case qui dit ce qu'elle fait
Le même identifiant s'appelait « pseudo public » quand on le choisissait,
« pseudo exact de ton ami » quand on le tapait, et « code » dans les messages
d'erreur — restes du code ami supprimé. C'est **pseudonyme** partout, dans
les trois langues (nickname / никнейм). Les deux clés orphelines laissées par
le code ami sont retirées.

`perso.vin` perd sa parenthèse « (+2 sur 4 affixes) » : elle décrivait la
règle du jeu, pas l'effet de la case. L'explication passe en infobulle sur le
libellé. Surtout, décochée, la case laissait la colonne « Vin » cliquable et
la ligne de budget annonçait « vin réparti automatiquement (8/8) » alors que
le build n'en tenait aucun compte — la colonne s'éteint maintenant, et la
ligne dit « Victory Wine non compté ».

Mesuré : Aegis 6 + Blessing 6 + Block Energy Cost Reduction 6 donne
1 Damaged + 2 Common + 5 Rare vin compté, **8 Rare** sans. C'est exactement
ce que fait la case : les 8 points de Sigrid dispensent le stuff de fournir
autant, donc il descend en rareté.

Contrôle ajouté : les trois dictionnaires ont 187 clés chacun, aucun trou.

### Base Supabase en place
Migration `20260812010000_par_pseudo.sql` appliquée à la main dans SQL
Editor, l'intégration GitHub n'ayant jamais réagi. Vérifié par appel REST :
`builds.partage` répond 200, les trois fonctions `security definer` aussi,
`profiles.code` a disparu, et la lecture directe de `profiles` comme de
`builds` ne renvoie plus aucune ligne. `mailer_autoconfirm` vaut `true` :
la confirmation par e-mail est coupée, ce qui règle la boucle « trop
d'essais ».

La migration `20260812000000_code_ami.sql` a été supprimée : le code ami est
abandonné, elle n'a jamais tourné, elle aurait créé une colonne morte.

**Piège mesuré, à ne pas refaire.** Le premier `verifier.py` tenait pour
preuve qu'un `GET /profiles` échoue quand la table est fermée. C'est faux :
sous RLS, une table fermée répond **200 avec une liste vide**, exactement
comme une table ouverte mais vide. Les deux sont indiscernables tant
qu'aucun profil n'existe. La vraie preuve demande une ligne : la fonction
`joueur_existe` doit trouver le pseudo (elle traverse RLS) là où la lecture
directe ne renvoie rien — d'où l'argument optionnel du script.

### Un seul mot, et une case qui dit ce qu'elle fait
Le même identifiant s'appelait « pseudo public » quand on le choisissait,
« pseudo exact de ton ami » quand on le tapait, et « code » dans les messages
d'erreur — restes du code ami supprimé. C'est **pseudonyme** partout, dans
les trois langues (nickname / никнейм). Les deux clés orphelines laissées par
le code ami sont retirées.

`perso.vin` perd sa parenthèse « (+2 sur 4 affixes) » : elle décrivait la
règle du jeu, pas l'effet de la case. L'explication passe en infobulle sur le
libellé. Surtout, décochée, la case laissait la colonne « Vin » cliquable et
la ligne de budget annonçait « vin réparti automatiquement (8/8) » alors que
le build n'en tenait aucun compte — la colonne s'éteint maintenant, et la
ligne dit « Victory Wine non compté ».

Mesuré : Aegis 6 + Blessing 6 + Block Energy Cost Reduction 6 donne
1 Damaged + 2 Common + 5 Rare vin compté, **8 Rare** sans. C'est exactement
ce que fait la case : les 8 points de Sigrid dispensent le stuff de fournir
autant, donc il descend en rareté.

Contrôle ajouté : les trois dictionnaires ont 187 clés chacun, aucun trou.

### État réel de la base Supabase (mesuré, pas supposé)
Migrations 1 et 2 appliquées (`builds` avec `public`, `profiles.pseudo`).
Migration `20260812010000_par_pseudo.sql` **jamais appliquée** :
`builds.partage` répond 400 et les trois fonctions 404 (PGRST202).
`GET /profiles?select=pseudo` répond encore **200** — le trou d'énumération
est ouvert, et n'est inoffensif que parce que la table est vide.

La migration `20260812000000_code_ami.sql` est supprimée : le code ami a été
abandonné, elle n'a jamais tourné, et elle aurait créé une colonne morte. La
migration restante devient auto-suffisante et rejouable sans risque.

`supabase/verifier.py` répond en trois secondes si la base est dans l'état
attendu, avec la clé publique uniquement.

### Icône dragon, message vide retiré
L'icône de l'outil et l'en-tête du site prennent le dragon fourni par
l'utilisateur : la planche est découpée en trois pièces (icône encadrée,
dragon seul, logo), le fond noir est rendu transparent, et un `.ico`
multi-tailles est produit pour l'exécutable. Vérifié : les octets de la
deuxième image du `.ico` se retrouvent bien dans `Mistfall Helper.exe`.

Le message « Aucun ami pour l'instant. Demande son code à quelqu'un. »
disparaît : il n'apprenait rien de plus que le champ juste au-dessus.

Sa non-traduction a révélé une vraie cause, elle : `surChangementDeLangue`
ne redessinait ni la liste d'amis ni la galerie, dont les libellés
(« Charger », « Copier chez moi ») restaient donc en français sur la page
anglaise. Les deux sont maintenant redessinées, et la clé `ami.aucun` a été
retirée des trois dictionnaires.

### Pièces interchangeables + préférences
Lister les combinaisons était inutilisable (23 328 sur un cas réel) : on
liste donc les pièces interchangeables **par emplacement**, chacune posée et
vérifiée. Ajout d'un bouton de préférence à trois états par affixe pour
guider les suggestions sans alourdir le cas courant.

### Trois langues, don plus visible
Interface en français / anglais / russe, détectée au navigateur, forçable
par drapeaux. Le lien de don devient un vrai bouton. Les suggestions ne
changent plus la rareté et disent d'où vient chaque gain.

### Suggestions
Échanges d'une pièce qui gagnent sans rien perdre. Un troc n'est retenu que
s'il décroche un palier. Rien n'est appliqué sans clic.

### Minimum viable
Passe d'allègement : 8 Legendary → 2 Legendary + 5 Epic + 1 Excellent sur un
cas réel, mieux que le build fait à la main. 20 cas sur 20 allégés, 146 crans
économisés, 0 cible perdue.

### Builds rendus à l'identique
Un build garde son code d'import et est restitué tel quel. Les builds
enregistrés avant cette correction sont signalés dans la liste.

### Mise en ligne
Dépôt transféré vers l'organisation `Mistfall-Builder` pour retirer le nom
de l'auteur de l'adresse. Comptes Supabase branchés ; table `builds` créée
par migration versionnée, avec politique RLS.

### Codes d'import
Format décodé et vérifié en jeu dans les deux sens. Les 155 objets absents du
catalogue reconstitués par élimination (262/262 au contrôle).
