/* LES CARTES, EN COORDONNÉES RÉELLES.
 *
 * Ce ne sont pas des positions inventées : ce sont les points relevés dans
 * l'atlas du jeu, exprimés dans SON système 0–10 000. On les redessine ; on
 * ne recopie aucune image.
 *
 * CE QU'ON SAIT : où se trouve chaque point, et à quelle région il
 * appartient. CE QU'ON NE SAIT PAS : la forme des régions — on n'a que des
 * nuages de points. Le rendu place donc chaque région au barycentre de ses
 * points, avec une étendue tirée de leur dispersion. La carte est juste dans
 * ses positions relatives et honnête sur son imprécision : elle dit où
 * aller, pas où poser le pied.
 *
 * LES MODES NE SONT PAS DISTINGUÉS. Le jeu propose deux terrains, chacun en
 * plusieurs modes. Ces relevés ne disent pas lequel : tant que ce n'est pas
 * vérifié, on ne le prétend pas, et la légende le dit.
 *
 * Types de points : sortie (extraction fixe), faille (rift), marchand
 * (Richie), passage (traversal), ferry (soul ferry, Hallowgrove seulement).
 *
 * Source : https://mistfallhunter.app/maps/brandrgarde/
 *          https://mistfallhunter.app/maps/hallowgrove/
 */
self.D_CARTES = {
  src: ['https://mistfallhunter.app/maps/brandrgarde/',
        'https://mistfallhunter.app/maps/hallowgrove/'],
  echelle: 10000,
  cartes: {
    Brandrgarde: [
      ['sortie', 'Mining Quarter', 5928, 3921], ['sortie', 'Main Hall', 4450, 6004],
      ['faille', 'Witchery Woods', 8176, 5580], ['faille', 'Drill Yard', 7975, 4438],
      ['faille', 'Drill Yard', 6491, 3588], ['faille', 'Drill Yard', 7078, 4066],
      ['faille', 'Drill Yard', 7762, 3813], ['faille', 'Drill Yard', 7958, 2316],
      ['faille', 'Drill Yard', 6802, 2805], ['faille', 'Mining Quarter', 5427, 2313],
      ['faille', 'Mining Quarter', 4166, 1583], ['faille', 'Abyssal Reach', 3369, 2401],
      ['faille', 'Abyssal Reach', 1919, 1814], ['faille', 'Abyssal Reach', 1746, 2973],
      ['faille', 'Witchery Woods', 7568, 5646], ['faille', 'Abyssal Reach', 1573, 3618],
      ['faille', 'Main Hall', 5242, 6110], ['faille', 'Main Hall', 3896, 5779],
      ['faille', 'Prison', 1976, 5225], ['faille', 'Witchery Woods', 6825, 5822],
      ['faille', 'Drill Yard', 6959, 4608], ['faille', 'Witchery Woods', 8241, 7736],
      ['faille', 'Witchery Woods', 7509, 8407], ['faille', 'Oath Bridge', 6263, 8482],
      ['faille', 'Witchery Woods', 6419, 7421], ['faille', 'Main Hall', 4728, 4518],
      ['faille', 'Witchery Woods', 6266, 6144], ['faille', 'Main Hall', 5525, 6491],
      ['faille', 'Witchery Woods', 7781, 6347], ['faille', 'Prison', 2713, 6366],
      ['faille', 'Oath Bridge', 5444, 8276], ['faille', 'Oath Bridge', 3867, 6856],
      ['faille', 'Oath Bridge', 4061, 7849], ['faille', 'Sacred Chamber', 2764, 7713],
      ['faille', 'Sacred Chamber', 2703, 6765], ['faille', 'Sacred Chamber', 2095, 6669],
      ['faille', 'Prison', 3658, 4284], ['faille', 'Abyssal Reach', 3336, 3415],
      ['faille', 'Mining Quarter', 4554, 3519], ['faille', 'Mining Quarter', 5530, 4227],
      ['marchand', 'Sacred Chamber', 1440, 7003], ['marchand', 'Witchery Woods', 7093, 7952],
      ['marchand', 'Main Hall', 3945, 5853], ['marchand', 'Witchery Woods', 7141, 4877],
      ['marchand', 'Mining Quarter', 4442, 591], ['marchand', 'Drill Yard', 8689, 1419],
      ['marchand', 'Main Hall', 6043, 5006], ['marchand', 'Prison', 2636, 6352],
      ['marchand', 'Drill Yard', 8178, 2276], ['marchand', 'Main Hall', 5466, 6502],
      ['marchand', 'Mining Quarter', 5900, 1669], ['marchand', 'Abyssal Reach', 1519, 2385],
      ['marchand', 'Abyssal Reach', 3156, 2151],
      ['passage', 'Prison', 1522, 5800], ['passage', 'Abyssal Reach', 1864, 3860],
      ['passage', 'Abyssal Reach', 2939, 2223], ['passage', 'Abyssal Reach', 3030, 641],
      ['passage', 'Prison', 3475, 5199], ['passage', 'Prison', 3881, 4228],
      ['passage', 'Main Hall', 4961, 5088], ['passage', 'Main Hall', 5513, 4645],
      ['passage', 'Mining Quarter', 5578, 3635], ['passage', 'Mining Quarter', 5748, 3103],
      ['passage', 'Drill Yard', 7126, 3353],
    ],
    Hallowgrove: [
      ['sortie', 'Village', 2550, 6573], ['sortie', 'East Residential', 7611, 7159],
      ['sortie', 'Outskirts', 3760, 2323], ['sortie', 'Village', 3673, 7043],
      ['sortie', 'Giant Highland', 4871, 2626], ['sortie', 'Storage', 2366, 4742],
      ['sortie', 'Graveyard', 5694, 6908], ['sortie', 'Mountain', 6819, 4413],
      ['sortie', 'East Residential', 6944, 6379], ['sortie', 'Giant Highland', 5163, 3508],
      ['sortie', 'Mountain', 6972, 4269],
      ['ferry', 'Outskirts', 3053, 1550], ['ferry', 'Outskirts', 1961, 3223],
      ['ferry', 'Outskirts', 4021, 2722], ['ferry', 'Center', 5085, 5490],
      ['ferry', 'Graveyard', 6089, 7973],
      ['faille', 'Giant Highland', 6725, 1593], ['faille', 'East Residential', 7567, 8114],
      ['faille', 'Storage', 2053, 3625], ['faille', 'Village', 3359, 8525],
      ['faille', 'Storage', 2082, 3641], ['faille', 'Giant Highland', 6888, 2083],
      ['marchand', 'Village', 2752, 8514], ['marchand', 'Giant Highland', 7067, 2851],
      ['marchand', 'Outskirts', 2166, 2075], ['marchand', 'Village', 1942, 6349],
      ['marchand', 'Center', 5015, 4456], ['marchand', 'Center', 4529, 5723],
      ['marchand', 'Mountain', 8204, 6124], ['marchand', 'Giant Highland', 5661, 3212],
      ['marchand', 'Storage', 2536, 3797], ['marchand', 'Graveyard', 6120, 6485],
      ['passage', 'Outskirts', 2779, 2578], ['passage', 'Outskirts', 2827, 3182],
      ['passage', 'Storage', 2887, 4234], ['passage', 'Storage', 3428, 5098],
      ['passage', 'Storage', 3674, 4850], ['passage', 'Village', 3775, 7323],
      ['passage', 'Center', 3980, 5186], ['passage', 'Center', 4098, 4887],
      ['passage', 'Center', 5202, 4658], ['passage', 'Giant Highland', 5359, 3217],
      ['passage', 'Mountain', 7085, 4727], ['passage', 'East Residential', 7186, 7401],
      ['passage', 'Mountain', 7298, 4016], ['passage', 'Mountain', 7642, 5556],
    ],
  },
};
