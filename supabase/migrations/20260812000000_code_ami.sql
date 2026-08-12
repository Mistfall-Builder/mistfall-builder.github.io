-- Partage repensé : un code ami, et une galerie publique séparée.
--
-- POURQUOI. La première version listait TOUS les joueurs dans un menu
-- déroulant. À dix joueurs c'est curieux, à mille c'est inutilisable, et
-- personne n'a envie d'apparaître dans un annuaire pour avoir montré un
-- build à un ami. On sépare donc les deux usages :
--
--   code ami  -> « voici mes builds », donné de la main à la main
--   public    -> « je publie », visible dans la galerie
--
-- Un build peut être l'un, l'autre, ou les deux.

-- Le code ami : court, lisible à voix haute, sans caractères ambigus
-- (ni 0/O ni 1/I/L). Il sert à TROUVER un joueur, pas à protéger un secret :
-- les builds partagés restent lisibles par qui connaît le code, et c'est
-- exactement ce qu'on veut d'un code qu'on donne à ses amis.
alter table public.profiles
  add column if not exists code text unique;

create index if not exists profiles_code_idx on public.profiles (code);

-- Partagé avec les amis, distinct de « publié dans la galerie ».
alter table public.builds
  add column if not exists partage boolean not null default false;

-- La politique de lecture s'élargit aux builds partagés. Elle s'ajoute à
-- « chacun ses builds » : les politiques d'une même commande se cumulent en
-- OU, donc rien n'est retiré au propriétaire.
drop policy if exists "builds publics visibles" on public.builds;
create policy "builds publics visibles" on public.builds
  for select using (public = true or partage = true);

create index if not exists builds_partages_idx
  on public.builds (user_id) where partage;
