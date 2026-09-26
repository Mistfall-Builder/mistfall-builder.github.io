-- Les NOMS des builds supprimés ou renommés, par compte.
--
-- Supprimer un build effaçait sa ligne, mais un autre appareil qui l'avait
-- encore en local la renvoyait à sa synchro suivante : le build revenait.
-- Avec cette table, la synchro sait qu'un nom a été enterré et l'écarte sur
-- tous les appareils. Réenregistrer ce nom plus tard lève la tombe.
--
-- Rien d'autre n'y est gardé : ni le contenu du build, ni l'heure.

create table if not exists public.builds_supprimes (
  user_id uuid not null references auth.users on delete cascade
          default auth.uid(),
  nom     text not null,
  primary key (user_id, nom)
);

alter table public.builds_supprimes enable row level security;

drop policy if exists "chacun ses tombes" on public.builds_supprimes;
create policy "chacun ses tombes" on public.builds_supprimes
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
