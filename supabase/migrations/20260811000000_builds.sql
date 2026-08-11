-- Les builds enregistrés par les comptes du site.
--
-- Un build = ses CONSIGNES (classe, arme, rareté, affixes visés, vin,
-- planchers) et non son résultat : en les rejouant on retrouve le même
-- stuff, et un build ancien profite des corrections futures du moteur.
-- `code` n'est là que pour le relire sans tout recalculer.

create table if not exists public.builds (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade
          default auth.uid(),
  nom     text not null,
  etat    jsonb not null,
  code    text default '',
  maj     timestamptz not null default now(),

  -- Enregistrer deux fois le même nom REMPLACE au lieu d'empiler : c'est
  -- ce que fait déjà l'interface, et l'upsert du site s'appuie sur cette
  -- contrainte (on_conflict=user_id,nom).
  unique (user_id, nom)
);

-- SANS CETTE PARTIE, LA TABLE SERAIT LISIBLE PAR TOUT LE MONDE.
-- La clé publishable est publique par construction : elle est dans le code
-- source du site. C'est uniquement la politique ci-dessous qui empêche
-- n'importe quel visiteur de lire — ou d'effacer — les builds des autres.
alter table public.builds enable row level security;

drop policy if exists "chacun ses builds" on public.builds;
create policy "chacun ses builds" on public.builds
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- `maj` sert à départager deux versions d'un même build lors de la synchro.
create or replace function public.touch_builds()
returns trigger
language plpgsql
as $$
begin
  new.maj = now();
  return new;
end;
$$;

drop trigger if exists builds_touch on public.builds;
create trigger builds_touch
  before update on public.builds
  for each row execute function public.touch_builds();
