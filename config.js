/* Branchement des comptes (facultatif).
 *
 * Tant que ces deux valeurs sont vides, le site marche exactement comme
 * avant : les builds restent dans le navigateur, et le bloc « Compte »
 * n'apparaît même pas. Rien ne dépend d'internet.
 *
 * Pour activer les comptes, crée un projet sur https://supabase.com
 * (gratuit), puis recopie ici :
 *   Project Settings → API → Project URL
 *   Project Settings → API → Project API keys → « anon public »
 *
 * La clé « anon » est FAITE pour être publique : elle ne donne accès à rien
 * toute seule, c'est la politique RLS de la base (voir README) qui décide
 * qui lit quoi. N'y mets JAMAIS la clé « service_role », elle contourne
 * toutes les protections.
 */
window.MISTFALL_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
