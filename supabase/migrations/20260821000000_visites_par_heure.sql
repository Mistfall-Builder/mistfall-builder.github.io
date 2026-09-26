-- Meme granularite d'anonymat que `visites`, une case en plus : le jour ET
-- l'heure, toujours un simple entier compteur. Ni adresse IP, ni cookie, ni
-- page consultee -- juste "il y a eu une visite a telle heure ce jour-la",
-- ce qui ne permet pas plus de reconstituer un visiteur precis qu'un total
-- par jour ne le permettait deja.
--
-- Table SEPAREE plutot que d'ajouter une colonne a `visites` : le code du
-- site appelle deja `compter_visite()` sans rien savoir de plus, et
-- `stats_jours` continue de lire `visites` sans qu'aucune requete existante
-- n'ait a changer. Seule `compter_visite()` est touchee, pour ecrire aux
-- deux endroits d'un coup.

create table if not exists public.visites_heure (
  jour  date not null,
  heure smallint not null check (heure between 0 and 23),
  vues  bigint not null default 0,
  primary key (jour, heure)
);

alter table public.visites_heure enable row level security;
-- Meme regle que `visites` : aucune politique, fermee en lecture directe.

create or replace function public.compter_visite()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visites (jour, vues) values (current_date, 1)
  on conflict (jour) do update set vues = public.visites.vues + 1;

  insert into public.visites_heure (jour, heure, vues)
  values (current_date, extract(hour from now())::smallint, 1)
  on conflict (jour, heure) do update set vues = public.visites_heure.vues + 1;
$$;

-- ------------------------------------------- aujourd'hui heure par heure, vs hier
-- Compare chaque heure du jour a la MEME heure hier -- pas a une moyenne,
-- pas au total de la veille : "a 18h j'ai 200 vues, hier a 18h j'en avais
-- combien" demande exactement cette borne-la.
create or replace function public.stats_heures_aujourdhui()
returns table (heure smallint, vues_aujourdhui bigint, vues_hier bigint)
language sql
security definer
set search_path = public
as $$
  select h.heure,
         coalesce(a.vues, 0),
         coalesce(v.vues, 0)
  from generate_series(0, 23) as h(heure)
  left join public.visites_heure a
    on a.jour = current_date and a.heure = h.heure
  left join public.visites_heure v
    on v.jour = current_date - 1 and v.heure = h.heure
  order by h.heure;
$$;

-- ------------------------------------------------- repartition par heure, periode
-- A quelle heure de la journee le site recoit-il du monde, en general --
-- somme sur la fenetre demandee, tous jours confondus. Sert a savoir QUAND
-- publier une annonce ou surveiller le site, pas a comparer un jour precis.
create or replace function public.stats_repartition_heures(p_jours int default 30)
returns table (heure smallint, vues bigint)
language sql
security definer
set search_path = public
as $$
  select h.heure, coalesce(sum(vh.vues), 0)
  from generate_series(0, 23) as h(heure)
  left join public.visites_heure vh
    on vh.heure = h.heure
   and vh.jour >= current_date - (least(greatest(coalesce(p_jours, 30), 1), 365) - 1)
  group by h.heure
  order by h.heure;
$$;

revoke all on function public.stats_heures_aujourdhui() from public;
revoke all on function public.stats_repartition_heures(int) from public;
grant execute on function public.stats_heures_aujourdhui() to anon, authenticated;
grant execute on function public.stats_repartition_heures(int) to anon, authenticated;
