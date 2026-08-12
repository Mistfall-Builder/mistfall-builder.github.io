/* Trente-six builds, six par classe.
 *
 * Chacun a été calculé puis contrôlé : ses cibles sont atteintes et son code
 * d'import a été engendré par le codec du site.
 *
 * SIX INTENTIONS, DÉCRITES UNE FOIS. Le plan est le même d'une classe à
 * l'autre, seuls les affixes changent selon l'affinité — une classe magique
 * ne prend pas d'affixe de dégâts physiques. Décrire l'intention une seule
 * fois évite six paragraphes qui répètent la même chose.
 *
 * NE PAS ÉDITER À LA MAIN : les codes viennent du moteur.
 */
window.D_INTENTIONS = {
  offensif: {
    nom: { fr: 'Offensif', en: 'Offensive', ru: 'Атакующий' },
    d: {
      fr: "Trois affixes de dégâts à leur palier. Deux d'entre eux ajoutent de la pénétration de défense au passage : contre un monstre, tous à 50 % de réduction, chaque point de pénétration retire un point entier de mitigation.",
      en: 'Three damage affixes at their breakpoint. Two of them add defence penetration along the way: against a monster, all sitting at 50 % reduction, every point of penetration removes a whole point of mitigation.',
      ru: 'Три атакующих аффикса на пороге. Два попутно дают пробивание защиты: у монстров 50 % снижения, и каждая единица пробивания снимает целый процент.',
    },
  },
  defensif: {
    nom: { fr: 'Défensif', en: 'Defensive', ru: 'Защитный' },
    d: {
      fr: "Aegis, Tenacious et Stoic à 5, c'est-à-dire tous les trois au niveau où ils débloquent leur second effet : résistance physique, vie, et le filet de sécurité sous 50 % de vie.",
      en: 'Aegis, Tenacious and Stoic at 5 — all three at the level where they unlock their second effect: physical resistance, health, and the safety net below 50 % health.',
      ru: 'Aegis, Tenacious и Stoic на 5 — все три на уровне, где открывается второй эффект: физическое сопротивление, здоровье и страховка ниже 50 % HP.',
    },
  },
  equilibre: {
    nom: { fr: 'Équilibré', en: 'Balanced', ru: 'Сбалансированный' },
    d: {
      fr: "Un affixe de chaque famille, tous les trois à leur palier : de quoi frapper, de quoi encaisser, de quoi bouger. Le build qui ne brille nulle part et ne coince nulle part.",
      en: 'One affix from each family, all three at their breakpoint: something to hit with, something to soak with, something to move with. Shines nowhere, gets stuck nowhere.',
      ru: 'По одному аффиксу из каждой группы, все три на пороге: чем бить, чем держать, чем двигаться. Нигде не блещет, нигде не встаёт.',
    },
  },
  mobilite: {
    nom: { fr: 'Mobilité', en: 'Mobility', ru: 'Подвижность' },
    d: {
      fr: "Swift et Elusive à 5, plus un affixe de dégâts. On ne gagne pas en dégâts par coup, on gagne en coups placés et en fuites réussies — contre des joueurs, ça vaut souvent mieux qu'un affixe offensif de plus.",
      en: 'Swift and Elusive at 5, plus one damage affix. You do not gain damage per hit, you gain hits landed and escapes made — against players that often beats one more offensive affix.',
      ru: 'Swift и Elusive на 5 плюс один атакующий аффикс. Не урон за удар, а число попаданий и удачных отходов — против игроков это часто ценнее.',
    },
  },
  soutien: {
    nom: { fr: 'Soutien', en: 'Support', ru: 'Поддержка' },
    d: {
      fr: "Eloquence 5 pour ne pas se faire interrompre en incantation, Blessing 5 pour le soin, Aegis 5 pour rester debout pendant qu'on soigne les autres.",
      en: 'Eloquence 5 so chanting cannot be interrupted, Blessing 5 for healing, Aegis 5 to stay standing while you keep the others up.',
      ru: 'Eloquence 5 против прерывания каста, Blessing 5 — лечение, Aegis 5 — чтобы устоять, пока лечишь остальных.',
    },
  },
  paliers: {
    nom: { fr: 'Quatre paliers', en: 'Four breakpoints', ru: 'Четыре порога' },
    d: {
      fr: "Le plus large : quatre affixes, trois à leur palier. Il fait moins bien que les spécialisés sur leur terrain, mais il ne laisse aucun trou — et le quatrième ne coûte rien puisqu'il reste sous son seuil.",
      en: 'The widest: four affixes, three at their breakpoint. It loses to the specialists on their own ground, but leaves no hole — and the fourth costs nothing since it stays under its threshold.',
      ru: 'Самый широкий: четыре аффикса, три на пороге. Уступает специалистам на их поле, но не оставляет дыр — а четвёртый ничего не стоит, оставаясь ниже порога.',
    },
  },
};

window.D_BUILDS = [
{"k":"10-offensif","c":10,"a":"Sword and Shield","i":"offensif","t":[["Valor",5],["Fervor",5],["Wrath",5]],"code":"Gtf32jMSCIaIQqljKVOdb9KE03OaiW0MjAWLbs","r":"8 × Excellent"},
{"k":"10-defensif","c":10,"a":"Hammer","i":"defensif","t":[["Aegis",5],["Tenacious",5],["Stoic",5]],"code":"Gtf38QtLbz7Mem2Zx24xSHUxvlKEnPwfNeZfZQ","r":"8 × Excellent"},
{"k":"10-equilibre","c":10,"a":"Sword and Shield","i":"equilibre","t":[["Valor",5],["Aegis",5],["Swift",5]],"code":"Gtf32jMSVdhn4fdv4HzmdXkcrssuEfweNyRZlA","r":"8 × Excellent"},
{"k":"10-mobilite","c":10,"a":"Hammer","i":"mobilite","t":[["Swift",5],["Elusive",5],["Valor",5]],"code":"Gtf32jMSVdhn4hj7iq69NTpJpGGygiGc7uXj96","r":"8 × Excellent"},
{"k":"10-soutien","c":10,"a":"Sword and Shield","i":"soutien","t":[["Eloquence",5],["Blessing",5],["Aegis",5]],"code":"Gtf35a8zDAbbLraHewEJItyxsLAgJfDHHlWeBc","r":"8 × Excellent"},
{"k":"10-paliers","c":10,"a":"Hammer","i":"paliers","t":[["Valor",5],["Fervor",5],["Aegis",5],["Swift",3]],"code":"17lpUl3AaT7jXbXdOtDJAmbRUHTEf7ws6I2YaJUm","r":"8 × Excellent"},
{"k":"11-offensif","c":11,"a":"Staff","i":"offensif","t":[["Valor",5],["Fervor",5],["Strife",5]],"code":"Gtf32uOzIa7huzAn3irECngyXbMHHRsGJ0zJvk","r":"8 × Excellent"},
{"k":"11-defensif","c":11,"a":"Staff","i":"defensif","t":[["Aegis",5],["Tenacious",5],["Stoic",5]],"code":"Gtf32uPcfUPVaPP8hLAoshjmfqcHUjtPFIBXJw","r":"8 × Excellent"},
{"k":"11-equilibre","c":11,"a":"Staff","i":"equilibre","t":[["Valor",5],["Aegis",5],["Swift",5]],"code":"Gtf32uOzIZD9JYjXXmgvJrYQyawknIGZRCdWdc","r":"8 × Excellent"},
{"k":"11-mobilite","c":11,"a":"Staff","i":"mobilite","t":[["Swift",5],["Elusive",5],["Valor",5]],"code":"Gtf32uPddRjqdumheOooVqK0MvqftJE7X0J5ai","r":"8 × Excellent"},
{"k":"11-soutien","c":11,"a":"Staff","i":"soutien","t":[["Eloquence",5],["Blessing",5],["Aegis",5]],"code":"Gtf32uQJR0vr2XQXtAEYnu0kytFBDyNbfojIQK","r":"8 × Excellent"},
{"k":"11-paliers","c":11,"a":"Staff","i":"paliers","t":[["Valor",5],["Fervor",5],["Aegis",5],["Swift",3]],"code":"Gtf32uOzIZD9JYjXXmgvJrYU5sSeM4fqa0C15c","r":"8 × Excellent"},
{"k":"12-offensif","c":12,"a":"Bow","i":"offensif","t":[["Valor",5],["Fervor",5],["Wrath",5]],"code":"Gtf335SPUM5kYjIojF4wDVwILDYM3AFUf6QlO4","r":"8 × Excellent"},
{"k":"12-defensif","c":12,"a":"Bow","i":"defensif","t":[["Aegis",5],["Tenacious",5],["Stoic",5]],"code":"Gtf335SOgRy1qxxAx7I5lzPp6g4yRaLp8UgMWO","r":"8 × Excellent"},
{"k":"12-equilibre","c":12,"a":"Bow","i":"equilibre","t":[["Valor",5],["Aegis",5],["Swift",5]],"code":"Gtf335SPoZwr5mkgxJinfxcuUb1Wy3jxrsmVGa","r":"8 × Excellent"},
{"k":"12-mobilite","c":12,"a":"Bow","i":"mobilite","t":[["Swift",5],["Elusive",5],["Valor",5]],"code":"Gtf335SPoS2hxWCPnFDNOgYrMfFKrumJjppDbU","r":"8 × Excellent"},
{"k":"12-soutien","c":12,"a":"Bow","i":"soutien","t":[["Eloquence",5],["Blessing",5],["Aegis",5]],"code":"Gtf38mzvTCWKdy5O5BlemkD38kVCCs9L3QxQQa","r":"8 × Excellent"},
{"k":"12-paliers","c":12,"a":"Bow","i":"paliers","t":[["Valor",5],["Fervor",5],["Aegis",5],["Swift",3]],"code":"17lpUakXJFtkLOjhonfzMYocQEovk1IGxUbSKeBs","r":"8 × Excellent"},
{"k":"13-offensif","c":13,"a":"Dagger","i":"offensif","t":[["Valor",5],["Fervor",5],["Wrath",5]],"code":"17lpUbU7lxnJXCJOB0RuNC6CIzfao7KCvykixUSO","r":"8 × Excellent"},
{"k":"13-defensif","c":13,"a":"Dual Blades","i":"defensif","t":[["Aegis",5],["Tenacious",5],["Stoic",5]],"code":"Gtf38y2FSdtPB9dTdiCgC2r8s099pWRvWviyfo","r":"8 × Excellent"},
{"k":"13-equilibre","c":13,"a":"Dagger","i":"equilibre","t":[["Valor",5],["Aegis",5],["Swift",5]],"code":"Gtf367GdSlr9j3hIHEqvcxff3tjqks1PJIQ3DU","r":"8 × Excellent"},
{"k":"13-mobilite","c":13,"a":"Dual Blades","i":"mobilite","t":[["Swift",5],["Elusive",5],["Valor",5]],"code":"Gtf33GVawHRFbJftipnA99v5TJnE14fNLT1MHY","r":"8 × Excellent"},
{"k":"13-soutien","c":13,"a":"Dagger","i":"soutien","t":[["Eloquence",5],["Blessing",5],["Aegis",5]],"code":"Gtf367Gb1w0EKgtfqdN7VhII8VhueZsIARI2VM","r":"8 × Excellent"},
{"k":"13-paliers","c":13,"a":"Dual Blades","i":"paliers","t":[["Valor",5],["Fervor",5],["Aegis",5],["Swift",3]],"code":"17lpUnG0gw1tL9nUbULqIiUa0rwZ20O2NELVnd2W","r":"8 × Excellent"},
{"k":"14-offensif","c":14,"a":"Catalyst","i":"offensif","t":[["Valor",5],["Fervor",5],["Strife",5]],"code":"Gtf33RYaOtoHLr1EZwpkxFMLZGN3HotA4Mhvpw","r":"8 × Excellent"},
{"k":"14-defensif","c":14,"a":"Mace","i":"defensif","t":[["Aegis",5],["Tenacious",5],["Stoic",5]],"code":"Gtf33RXvFnXsmIiNekfWFXIimfkS4KizZvK7Ci","r":"8 × Excellent"},
{"k":"14-equilibre","c":14,"a":"Catalyst","i":"equilibre","t":[["Valor",5],["Aegis",5],["Swift",5]],"code":"Gtf33RXvFeGtjwdIhvOUnSbDLLeLqUsknUh9zk","r":"8 × Excellent"},
{"k":"14-mobilite","c":14,"a":"Mace","i":"mobilite","t":[["Swift",5],["Elusive",5],["Valor",5]],"code":"Gtf33RYZagNQyQAb9hJ6kBI49h6nNVI6DXgsy0","r":"8 × Excellent"},
{"k":"14-soutien","c":14,"a":"Catalyst","i":"soutien","t":[["Eloquence",5],["Blessing",5],["Aegis",5]],"code":"Gtf33RYZuko82DnmJnDPf8dHcEe5GK0lShyyvo","r":"8 × Excellent"},
{"k":"14-paliers","c":14,"a":"Mace","i":"paliers","t":[["Valor",5],["Fervor",5],["Aegis",5],["Swift",3]],"code":"Gtf33RYaiyY7XoVjzSJ7zlZDgA21AShs1cUTc8","r":"8 × Excellent"},
{"k":"15-offensif","c":15,"a":"Greatsword","i":"offensif","t":[["Valor",5],["Fervor",5],["Wrath",5]],"code":"Gtf39K8FBzWlhhMCRLzKKCb4UR9ygRidGysXmC","r":"8 × Excellent"},
{"k":"15-defensif","c":15,"a":"Polearm and Shield","i":"defensif","t":[["Aegis",5],["Tenacious",5],["Stoic",5]],"code":"Gtf36TNBhWZ9uDmHDgFhwXM6wlb5AIyQMMF9DE","r":"8 × Excellent"},
{"k":"15-equilibre","c":15,"a":"Greatsword","i":"equilibre","t":[["Valor",5],["Aegis",5],["Swift",5]],"code":"Gtf36TMYKvtUceiZrRs6WTsETsZdlySHnoO120","r":"8 × Excellent"},
{"k":"15-mobilite","c":15,"a":"Polearm and Shield","i":"mobilite","t":[["Swift",5],["Elusive",5],["Valor",5]],"code":"Gtf33catu3D4OqiRwficKdJNJcYr0knekjQBs0","r":"8 × Excellent"},
{"k":"15-soutien","c":15,"a":"Greatsword","i":"soutien","t":[["Eloquence",5],["Blessing",5],["Aegis",5]],"code":"17lpUojHpfQpNEfW27hbLRW7BHwOLB6r0lXT22q0","r":"8 × Excellent"},
{"k":"15-paliers","c":15,"a":"Polearm and Shield","i":"paliers","t":[["Valor",5],["Fervor",5],["Aegis",5],["Swift",3]],"code":"Gtf36TMYKl5wGjIajT7Yci5rFGGO6QXTEGgNvc","r":"8 × Excellent"}
];
