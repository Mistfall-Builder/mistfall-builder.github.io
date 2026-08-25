/* Branchement des comptes (facultatif).
 *
 * Tant que ces deux valeurs sont vides, le site marche exactement comme
 * avant : les builds restent dans le navigateur, et le bloc « Compte »
 * n'apparaît même pas. Rien ne dépend d'internet.
 *
 * Les deux valeurs viennent de Project Settings → API :
 *   supabaseUrl  = Project URL
 *   supabaseAnonKey = clé « Publishable » (sb_publishable_…)
 *
 * Cette clé est FAITE pour être publique — c'est la politique RLS de la
 * table (voir README) qui décide qui lit quoi, pas elle. N'y mets JAMAIS
 * la clé « Secret » (sb_secret_…) : elle contourne toutes les protections,
 * et tout le monde peut lire ce fichier une fois le site en ligne.
 */
window.MISTFALL_CONFIG = {
  supabaseUrl: 'https://grnndksniashncksyzvv.supabase.co',
  supabaseAnonKey: 'sb_publishable_o-6QtPqCK624RcH96KsFxA_qHHdbgRx',

  /* COMPTEUR DE VISITES — ALLUMÉ.
   *
   * Le titre disait « éteint » au-dessus d'un `true` : la contradiction est
   * levée dans le sens de ce que le site fait réellement.
   *
   * Ce qu'il enregistre : une ligne par JOUR, un entier, rien d'autre. Ni
   * cookie, ni identifiant de navigateur, ni page consultée — la table ne
   * permet pas de reconstituer un visiteur, même en le voulant.
   *
   * Ce qu'il faut savoir quand même : la requête qui incrémente ce compteur
   * porte l'adresse IP du visiteur, et Supabase la journalise de son côté.
   * C'est vrai de n'importe quelle requête vers n'importe quel serveur, mais
   * autant l'écrire que laisser croire à un anonymat de bout en bout. */
  compterVisites: true,

  /* VERROU D'ENTREE — ETEINT.
   *
   * Le code du verrou (verrou.js, l'ecran de mot de passe, la fonction
   * Supabase) reste en place tel quel : il suffit de repasser ce
   * drapeau a `true` pour rouvrir le site sur le mot de passe partage,
   * sans rien reecrire. Coupe pour l'instant — trop de monde demandait
   * le mot de passe, ce n'etait pas le tri escompte. */
  verrouActif: false,
};
