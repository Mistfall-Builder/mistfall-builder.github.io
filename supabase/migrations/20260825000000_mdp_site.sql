-- Un mot de passe partage pour fermer le site aux inconnus, sans compte a
-- creer pour chaque ami -- juste un mot a leur donner. La difference avec
-- un mot de passe pose dans le JS du site : il n'est JAMAIS transmis au
-- navigateur. Le client envoie l'ESSAI, cette fonction le compare cote
-- serveur (hache, avec pgcrypto/bcrypt) et ne renvoie qu'un booleen --
-- personne ne peut le lire en inspectant le code source ou le reseau.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mdp_site (
  id   smallint primary key default 1,
  hash text not null,
  constraint mdp_site_singleton check (id = 1)
);
alter table public.mdp_site enable row level security;
-- Aucune politique : ferme en lecture directe, comme `visites`. Seule la
-- fonction ci-dessous (security definer) peut la lire.

create or replace function public.verifier_mdp_site(essai text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.mdp_site
    where id = 1 and hash = crypt(essai, hash)
  );
$$;

-- Le mot de passe de depart. A changer directement ici (SQL Editor) si
-- besoin -- jamais dans le code du site, qui ne le voit jamais.
insert into public.mdp_site (id, hash)
values (1, crypt('deadgame', gen_salt('bf')))
on conflict (id) do update set hash = excluded.hash;
