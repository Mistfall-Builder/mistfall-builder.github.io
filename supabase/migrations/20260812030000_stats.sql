-- Des chiffres sur le site, sans exposer une seule identite.
--
-- CE QU'ON COMPTE, ET CE QU'ON NE COMPTE PAS. Uniquement des AGREGATS :
-- combien de builds, combien de guides, combien de joueurs, la repartition
-- par classe, l'activite par jour. Jamais un nom, jamais un contenu, jamais
-- « qui a fait quoi ». Les tables restent fermees en lecture directe ; ces
-- fonctions sont des portes etroites de plus, comme la galerie.
--
-- POURQUOI `cree_le`. La colonne `maj` change a chaque enregistrement : une
-- courbe basee dessus montre l'ACTIVITE, pas les creations. On ajoute donc
-- une date de creation. Les lignes existantes la recoivent egale a `maj` --
-- c'est la meilleure approximation disponible, et elle est fausse pour un
-- build cree puis modifie plus tard. Autant le savoir.

alter table public.builds
  add column if not exists cree_le timestamptz;
update public.builds set cree_le = maj where cree_le is null;
alter table public.builds
  alter column cree_le set default now(),
  alter column cree_le set not null;

alter table public.guides
  add column if not exists cree_le timestamptz;
update public.guides set cree_le = maj where cree_le is null;
alter table public.guides
  alter column cree_le set default now(),
  alter column cree_le set not null;

-- ------------------------------------------------------- compteur de vues
-- ANONYME PAR CONSTRUCTION : une ligne par JOUR, un entier. Ni adresse IP,
-- ni cookie, ni identifiant de navigateur, ni page consultee. On ne peut
-- pas reconstituer un visiteur a partir de ca, meme en le voulant -- c'est
-- le seul compteur compatible avec « pas de pistage ».
--
-- Le site ne l'appelle que si `compterVisites` est activee dans config.js,
-- et cette bascule est a false par defaut.
create table if not exists public.visites (
  jour date primary key,
  vues bigint not null default 0
);

alter table public.visites enable row level security;
-- Aucune politique : la table n'est lisible ni ecrivable en direct. Tout
-- passe par les deux fonctions ci-dessous.

create or replace function public.compter_visite()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visites (jour, vues) values (current_date, 1)
  on conflict (jour) do update set vues = public.visites.vues + 1;
$$;

-- ------------------------------------------------------------- les chiffres
create or replace function public.stats_site()
returns table (
  builds_total    bigint,
  builds_publics  bigint,
  builds_partages bigint,
  joueurs         bigint,
  pseudonymes     bigint,
  guides_total    bigint,
  guides_publics  bigint,
  premier_build   timestamptz,
  dernier_build   timestamptz,
  vues_total      bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.builds),
    (select count(*) from public.builds where public),
    (select count(*) from public.builds where partage),
    (select count(distinct user_id) from public.builds),
    (select count(*) from public.profiles),
    (select count(*) from public.guides),
    (select count(*) from public.guides where public),
    (select min(cree_le) from public.builds),
    (select max(maj) from public.builds),
    (select coalesce(sum(vues), 0) from public.visites);
$$;

-- L'activite jour par jour, sur une fenetre glissante.
create or replace function public.stats_jours(p_jours int default 30)
returns table (jour date, builds bigint, guides bigint, vues bigint)
language sql
security definer
set search_path = public
as $$
  with bornes as (
    select generate_series(
      current_date - (least(greatest(coalesce(p_jours, 30), 1), 365) - 1),
      current_date, interval '1 day')::date as jour
  )
  select b.jour,
         (select count(*) from public.builds x where x.cree_le::date = b.jour),
         (select count(*) from public.guides g where g.cree_le::date = b.jour),
         coalesce((select v.vues from public.visites v where v.jour = b.jour), 0)
  from bornes b
  order by b.jour;
$$;

-- La repartition par classe, lue dans l'etat du build. Le champ `c` est
-- l'identifiant de classe du jeu ; le site sait le traduire en nom.
create or replace function public.stats_classes()
returns table (classe int, n bigint)
language sql
security definer
set search_path = public
as $$
  select (etat->>'c')::int as classe, count(*)
  from public.builds
  where etat ? 'c'
  group by 1
  order by 2 desc;
$$;

-- Les affixes les plus demandes, tous builds confondus. `etat->'t'` est la
-- liste [[nom, niveau], ...] des cibles.
create or replace function public.stats_affixes(p_limite int default 20)
returns table (affixe text, n bigint, niveau_moyen numeric)
language sql
security definer
set search_path = public
as $$
  select cible->>0 as affixe,
         count(*) as n,
         round(avg((cible->>1)::numeric), 2) as niveau_moyen
  from public.builds b,
       lateral jsonb_array_elements(coalesce(b.etat->'t', '[]'::jsonb)) as cible
  where jsonb_typeof(b.etat->'t') = 'array'
  group by 1
  order by 2 desc
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;

revoke all on function public.compter_visite() from public;
revoke all on function public.stats_site() from public;
revoke all on function public.stats_jours(int) from public;
revoke all on function public.stats_classes() from public;
revoke all on function public.stats_affixes(int) from public;
grant execute on function public.compter_visite() to anon, authenticated;
grant execute on function public.stats_site() to anon, authenticated;
grant execute on function public.stats_jours(int) to anon, authenticated;
grant execute on function public.stats_classes() to anon, authenticated;
grant execute on function public.stats_affixes(int) to anon, authenticated;
