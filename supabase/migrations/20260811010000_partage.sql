-- Partage de builds : un pseudo public, et des builds qu'on choisit de
-- montrer ou non.
--
-- Principe : rien n'est public par défaut. Un build ne sort de chez son
-- auteur que s'il coche explicitement la case, et seul le pseudo est
-- exposé — jamais l'adresse e-mail, qui reste dans auth.users.

-- ------------------------------------------------------------- profils --
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade
          default auth.uid(),
  pseudo  text not null unique
          check (length(pseudo) between 2 and 24),
  maj     timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Le pseudo est fait pour être vu : c'est ce qui permet de retrouver les
-- builds de quelqu'un. Rien d'autre de la table n'est exposé.
drop policy if exists "pseudos visibles" on public.profiles;
create policy "pseudos visibles" on public.profiles
  for select using (true);

drop policy if exists "chacun son profil" on public.profiles;
create policy "chacun son profil" on public.profiles
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------- builds publics ou non --
alter table public.builds
  add column if not exists public boolean not null default false;

-- Une politique SELECT SUPPLÉMENTAIRE : les politiques d'une même commande
-- se cumulent en OU. Celle-ci n'ouvre donc QUE les builds marqués publics,
-- sans rien retirer à « chacun ses builds ».
drop policy if exists "builds publics visibles" on public.builds;
create policy "builds publics visibles" on public.builds
  for select using (public = true);

-- Retrouver les builds publics d'un auteur doit rester rapide quand la
-- table grossit.
create index if not exists builds_publics_idx
  on public.builds (user_id) where public;
