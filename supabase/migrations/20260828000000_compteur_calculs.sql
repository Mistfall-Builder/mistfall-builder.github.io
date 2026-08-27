-- Combien de fois "Calculer le build" a ete lance, tous visiteurs
-- confondus -- distinct du nombre de builds ENREGISTRES dans un compte
-- (table `builds`, qui ne voit qu'une fraction des calculs : la plupart
-- des visiteurs n'ont pas de compte, ou ne sauvegardent pas ce qu'ils
-- essaient). Meme anonymat que `visites` : une ligne par JOUR, un entier,
-- rien d'autre. Compte un clic reel sur "Calculer" (cibles non vides),
-- pas les tentatives internes de relance automatique d'un meme calcul.
create table if not exists public.calculs (
  jour date primary key,
  n    bigint not null default 0
);
alter table public.calculs enable row level security;
-- Aucune politique : fermee en lecture directe, comme `visites`.

create or replace function public.compter_calcul()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.calculs (jour, n) values (current_date, 1)
  on conflict (jour) do update set n = public.calculs.n + 1;
$$;

-- Le total tout court. Fonction a part plutot que d'agrandir stats_site() :
-- changer son type de retour casserait tout ce qui l'appelle deja.
create or replace function public.stats_calculs()
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(n), 0) from public.calculs;
$$;

revoke all on function public.compter_calcul() from public;
revoke all on function public.stats_calculs() from public;
grant execute on function public.compter_calcul() to anon, authenticated;
grant execute on function public.stats_calculs() to anon, authenticated;
