-- Un vote par compte et par build, et un tri par popularite.
--
-- UN SEUL VOTE, GARANTI PAR LA CLE PRIMAIRE. Ce n'est pas une regle
-- appliquee dans le navigateur -- celle-la se contourne en dix secondes --
-- mais la structure meme de la table : (build, votant) est la cle, donc un
-- second vote ECRASE le premier au lieu de s'ajouter. Personne ne peut
-- gonfler un compte, meme en s'y employant.
--
-- LE VOTANT N'EST JAMAIS EXPOSE. Les fonctions ne rendent que des COMPTES,
-- plus un booleen « et toi, tu as vote ? » calcule pour l'appelant. On ne
-- peut pas savoir qui a vote quoi.

create table if not exists public.votes (
  build_id uuid not null references public.builds(id) on delete cascade,
  votant   uuid not null references auth.users on delete cascade
           default auth.uid(),
  le       timestamptz not null default now(),
  primary key (build_id, votant)
);

create index if not exists votes_par_build on public.votes (build_id);

alter table public.votes enable row level security;

-- Chacun gere SES votes, et rien d'autre. Le decompte passe par les
-- fonctions ci-dessous, jamais par une lecture directe de la table.
drop policy if exists "chacun ses votes" on public.votes;
create policy "chacun ses votes" on public.votes
  for all
  using      (auth.uid() = votant)
  with check (auth.uid() = votant);

-- Basculer son vote : on vote, on revote, on retire. Renvoie le nouveau
-- total, pour que l'interface n'ait pas a redemander.
create or replace function public.basculer_vote(p_build uuid)
returns table (total bigint, jai_vote boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
  existait boolean;
begin
  if moi is null then
    raise exception 'connexion requise';
  end if;
  -- On ne vote que sur un build PUBLIC : voter sur le brouillon de
  -- quelqu'un reviendrait a prouver son existence.
  if not exists (select 1 from public.builds b
                 where b.id = p_build and b.public) then
    raise exception 'build introuvable ou non public';
  end if;

  select true into existait from public.votes v
   where v.build_id = p_build and v.votant = moi;

  if existait then
    delete from public.votes v where v.build_id = p_build and v.votant = moi;
  else
    insert into public.votes (build_id, votant) values (p_build, moi)
      on conflict do nothing;
  end if;

  return query
    select (select count(*) from public.votes v where v.build_id = p_build),
           not coalesce(existait, false);
end;
$$;

-- La galerie rend maintenant l'identifiant, le nombre de votes, et si
-- l'appelant a vote. Le tri « populaire » s'ajoute aux autres.
drop function if exists public.galerie_publique(int, int, text, int, text);

create or replace function public.galerie_publique(
  p_limite     int  default 24,
  p_decalage   int  default 0,
  p_tri        text default 'recent',
  p_classe     int  default null,
  p_recherche  text default null)
returns table (id uuid, nom text, etat jsonb, code text, auteur text,
               maj timestamptz, votes bigint, jai_vote boolean, total bigint)
language sql
security definer
set search_path = public
as $$
  with vus as (
    select b.id, b.nom, b.etat, b.code, pr.pseudo as auteur, b.maj,
           (select count(*) from public.votes v where v.build_id = b.id) as votes,
           exists (select 1 from public.votes v
                   where v.build_id = b.id and v.votant = auth.uid()) as jai_vote
    from public.builds b
    left join public.profiles pr on pr.user_id = b.user_id
    where b.public
      and (p_classe is null or (b.etat->>'c')::int = p_classe)
      and (p_recherche is null or btrim(p_recherche) = '' or
           b.nom ilike '%' || btrim(p_recherche) || '%' or
           coalesce(pr.pseudo, '') ilike '%' || btrim(p_recherche) || '%')
  )
  select v.id, v.nom, v.etat, v.code, v.auteur, v.maj, v.votes, v.jai_vote,
         count(*) over () as total
  from vus v
  order by
    case when p_tri = 'populaire' then v.votes end desc,
    case when p_tri = 'ancien'    then v.maj end asc,
    case when p_tri = 'nom'       then lower(v.nom) end asc,
    case when p_tri = 'auteur'    then lower(coalesce(v.auteur, 'zzz')) end asc,
    case when p_tri not in ('ancien', 'nom', 'auteur') then v.maj end desc
  limit least(coalesce(p_limite, 24), 200)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

revoke all on function public.basculer_vote(uuid) from public;
revoke all on function public.galerie_publique(int, int, text, int, text) from public;
grant execute on function public.basculer_vote(uuid) to authenticated;
grant execute on function public.galerie_publique(int, int, text, int, text)
  to anon, authenticated;
