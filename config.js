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

  /* COMPTEUR DE VISITES — ÉTEINT.
   *
   * Passé à true, le site incrémente un compteur quotidien : une ligne par
   * JOUR, un entier, rien d'autre. Ni adresse IP, ni cookie, ni identifiant
   * de navigateur, ni page consultée — on ne peut pas reconstituer un
   * visiteur à partir de ça, même en le voulant.
   *
   * Il reste éteint tant que personne ne l'allume : le site a été annoncé
   * « sans pistage », et ce n'est pas à un fichier de configuration de
   * revenir là-dessus tout seul. */
  compterVisites: false,
};
