-- Une galerie qui tient a l'echelle, et des guides de classe.
--
-- TROIS CORRECTIONS ET UN AJOUT.
--
-- 1. LA JOINTURE MANGEAIT LES BUILDS. `galerie_publique` joignait `profiles`
--    en INNER JOIN : un build coche « public » par quelqu'un qui n'a pas
--    encore choisi de pseudonyme n'avait aucune ligne de profil a joindre,
--    et disparaissait purement et simplement. C'etait invisible et sans
--    message. On passe en LEFT JOIN : le build s'affiche, l'auteur vaut
--    NULL, et le site ecrit « anonyme ».
--
-- 2. PAS DE TRI NI DE PAGE. La galerie renvoyait 60 lignes, les plus
--    recentes, point. A mille builds c'est inutilisable. Elle accepte
--    maintenant un tri, un decalage, un filtre de classe et une recherche,
--    et renvoie le TOTAL avec chaque ligne pour que l'interface sache
--    combien de pages afficher sans deuxieme appel.
--
-- 3. COMPTER SANS ENUMERER. `combien_de_builds_publics()` ne renvoie qu'un
--    nombre : aucune identite, aucun contenu. Il permet a la galerie de
--    distinguer « personne n'a rien publie » de « le filtre ne ramene
--    rien » -- deux vides que l'utilisateur ne doit pas confondre.
--
-- 4. LES GUIDES. Meme regle que les builds : rien n'est visible tant que
--    l'auteur ne coche pas, et la table reste fermee en lecture directe.

-- ---------------------------------------------------------------- galerie
-- La signature change (nouvelles colonnes de retour), donc on remplace.
drop function if exists public.galerie_publique(int);
drop function if exists public.galerie_publique(int, int, text, int, text);

create or replace function public.galerie_publique(
  p_limite     int  default 60,
  p_decalage   int  default 0,
  p_tri        text default 'recent',
  p_classe     int  default null,
  p_recherche  text default null)
returns table (nom text, etat jsonb, code text, auteur text,
               maj timestamptz, total bigint)
language sql
security definer
set search_path = public
as $$
  with vus as (
    select b.nom, b.etat, b.code, pr.pseudo as auteur, b.maj
    from public.builds b
    -- LEFT, pas INNER : un build publie par quelqu'un sans pseudonyme
    -- doit rester visible. C'est le bug qui le faisait disparaitre.
    left join public.profiles pr on pr.user_id = b.user_id
    where b.public
      and (p_classe is null or (b.etat->>'c')::int = p_classe)
      and (p_recherche is null or btrim(p_recherche) = '' or
           b.nom ilike '%' || btrim(p_recherche) || '%' or
           coalesce(pr.pseudo, '') ilike '%' || btrim(p_recherche) || '%')
  )
  select v.nom, v.etat, v.code, v.auteur, v.maj, count(*) over () as total
  from vus v
  order by
    case when p_tri = 'ancien'  then v.maj end asc,
    case when p_tri = 'nom'     then lower(v.nom) end asc,
    case when p_tri = 'auteur'  then lower(coalesce(v.auteur, 'zzz')) end asc,
    case when p_tri not in ('ancien', 'nom', 'auteur') then v.maj end desc
  limit least(coalesce(p_limite, 60), 200)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

-- Un simple compte, sans un seul nom : sert a distinguer « rien de publie »
-- de « rien qui corresponde au filtre ».
create or replace function public.combien_de_builds_publics()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from public.builds where public;
$$;

-- ----------------------------------------------------------------- guides
create table if not exists public.guides (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade
          default auth.uid(),
  titre   text not null check (length(btrim(titre)) between 3 and 120),
  classe  int,
  corps   text not null check (length(btrim(corps)) between 20 and 20000),
  public  boolean not null default false,
  maj     timestamptz not null default now()
);

create unique index if not exists guides_auteur_titre_idx
  on public.guides (user_id, lower(btrim(titre)));
create index if not exists guides_publics_idx
  on public.guides (maj desc) where public;

alter table public.guides enable row level security;

-- Chacun chez soi, et rien d'autre : la lecture publique passe par les
-- fonctions ci-dessous, jamais par la table.
drop policy if exists "chacun ses guides" on public.guides;
create policy "chacun ses guides" on public.guides
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- La liste : titres et auteurs, sans le corps. Un guide fait des milliers
-- de caracteres ; les envoyer tous pour afficher une liste serait absurde.
create or replace function public.guides_publics(
  p_limite    int  default 30,
  p_decalage  int  default 0,
  p_classe    int  default null,
  p_recherche text default null)
returns table (id uuid, titre text, classe int, auteur text,
               maj timestamptz, taille int, total bigint)
language sql
security definer
set search_path = public
as $$
  with vus as (
    select g.id, g.titre, g.classe, pr.pseudo as auteur, g.maj,
           length(g.corps) as taille
    from public.guides g
    left join public.profiles pr on pr.user_id = g.user_id
    where g.public
      and (p_classe is null or g.classe = p_classe)
      and (p_recherche is null or btrim(p_recherche) = '' or
           g.titre ilike '%' || btrim(p_recherche) || '%' or
           coalesce(pr.pseudo, '') ilike '%' || btrim(p_recherche) || '%')
  )
  select v.*, count(*) over () as total
  from vus v
  order by v.maj desc
  limit least(coalesce(p_limite, 30), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

-- Le corps, a la demande, pour un seul guide. Le parametre s'appelle `gid`
-- et non `g` : `g` est deja l'alias de la table, et PostgreSQL resoudrait
-- `g.id` sur le parametre au lieu de la colonne.
create or replace function public.guide_complet(gid uuid)
returns table (titre text, classe int, corps text, auteur text,
               maj timestamptz)
language sql
security definer
set search_path = public
as $$
  select g.titre, g.classe, g.corps, pr.pseudo, g.maj
  from public.guides g
  left join public.profiles pr on pr.user_id = g.user_id
  where g.id = gid and g.public
  limit 1;
$$;

revoke all on function public.galerie_publique(int, int, text, int, text) from public;
revoke all on function public.combien_de_builds_publics() from public;
revoke all on function public.guides_publics(int, int, int, text) from public;
revoke all on function public.guide_complet(uuid) from public;
grant execute on function public.galerie_publique(int, int, text, int, text)
  to anon, authenticated;
grant execute on function public.combien_de_builds_publics()
  to anon, authenticated;
grant execute on function public.guides_publics(int, int, int, text)
  to anon, authenticated;
grant execute on function public.guide_complet(uuid) to anon, authenticated;
