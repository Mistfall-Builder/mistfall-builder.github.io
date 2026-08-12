-- Ajouter quelqu'un par son PSEUDO, sans que la liste des pseudos soit
-- lisible par tout le monde.
--
-- LE PROBLÈME. Une politique « select using (true) » sur `profiles` autorise
-- la lecture ligne par ligne, mais aussi `GET /profiles?select=pseudo` sans
-- filtre : toute la liste, d'un coup. Filtrer côté site n'y change rien, la
-- requête part du navigateur et n'importe qui peut en écrire une autre.
--
-- LA SOLUTION. On ferme la lecture directe de la table, et on n'expose que
-- des FONCTIONS qui répondent à une question précise : « qui s'appelle
-- exactement comme ça ? ». Sans le pseudo exact, on n'obtient rien — et il
-- n'existe aucune requête qui les énumère.
--
-- CE FICHIER SE COLLE TEL QUEL dans SQL Editor si l'intégration GitHub
-- traîne : tout y est « if exists / if not exists / or replace », donc le
-- rejouer deux fois ne casse rien.

alter table public.builds
  add column if not exists partage boolean not null default false;

-- Le code ami a été abandonné au profit du pseudo. La colonne ne sert plus
-- à rien ; on la retire si une base l'a reçue.
alter table public.profiles
  drop column if exists code;

-- ------------------------------------------------------ on ferme les portes
-- Plus aucune lecture directe : ni des profils, ni des builds d'autrui.
-- Le propriétaire garde tout (politique « chacun ... », inchangée).
drop policy if exists "pseudos visibles" on public.profiles;
drop policy if exists "builds publics visibles" on public.builds;

-- --------------------------------------------- recherche EXACTE d'un joueur
-- `security definer` : la fonction s'exécute avec les droits de son
-- propriétaire, donc elle traverse RLS — c'est ce qui permet d'ouvrir une
-- porte étroite alors que la table reste fermée.
create or replace function public.joueur_existe(p text)
returns table (pseudo text)
language sql
security definer
set search_path = public
as $$
  select pr.pseudo
  from public.profiles pr
  where lower(pr.pseudo) = lower(btrim(p))
  limit 1;
$$;

-- Les builds qu'un joueur a marqués « ami » ou « public ».
create or replace function public.builds_de(p text)
returns table (nom text, etat jsonb, code text, maj timestamptz)
language sql
security definer
set search_path = public
as $$
  select b.nom, b.etat, b.code, b.maj
  from public.builds b
  join public.profiles pr on pr.user_id = b.user_id
  where lower(pr.pseudo) = lower(btrim(p))
    and (b.partage or b.public)
  order by b.maj desc;
$$;

-- La galerie : uniquement ce qui est explicitement publié, avec son auteur.
-- La limite est bornée ici aussi : un appelant ne doit pas pouvoir demander
-- la table entière en passant un grand nombre.
create or replace function public.galerie_publique(limite int default 60)
returns table (nom text, etat jsonb, code text, auteur text, maj timestamptz)
language sql
security definer
set search_path = public
as $$
  select b.nom, b.etat, b.code, pr.pseudo, b.maj
  from public.builds b
  join public.profiles pr on pr.user_id = b.user_id
  where b.public
  order by b.maj desc
  limit least(coalesce(limite, 60), 200);
$$;

revoke all on function public.joueur_existe(text) from public;
revoke all on function public.builds_de(text) from public;
revoke all on function public.galerie_publique(int) from public;
grant execute on function public.joueur_existe(text) to anon, authenticated;
grant execute on function public.builds_de(text) to anon, authenticated;
grant execute on function public.galerie_publique(int) to anon, authenticated;
