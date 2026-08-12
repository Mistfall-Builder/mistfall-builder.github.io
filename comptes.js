/* Comptes et synchronisation des builds, via Supabase.
 *
 * POURQUOI EN FETCH BRUT et non avec la bibliothèque officielle : le site
 * doit rester ouvrable depuis le disque et sans dépendance externe. Charger
 * supabase-js depuis un CDN ajouterait un point de panne (CDN bloqué, hors
 * ligne) pour trois appels REST qui tiennent en trente lignes.
 *
 * Ce qui est stocké : l'adresse e-mail (c'est Supabase qui la garde, pas
 * nous) et les builds. Le mot de passe n'est jamais écrit nulle part ici —
 * il part directement à Supabase et seul le jeton revient.
 *
 * Sans configuration, TOUT ce fichier reste inerte : `actif()` rend false et
 * l'interface ne montre pas le bloc « Compte ».
 */
(function () {
  const CFG = window.MISTFALL_CONFIG || {};
  const URL_BASE = (CFG.supabaseUrl || '').replace(/\/+$/, '');
  const CLE = CFG.supabaseAnonKey || '';
  const CLE_SESSION = 'mistfall.session.v1';

  function actif() {
    return Boolean(URL_BASE && CLE);
  }

  function session() {
    try {
      return JSON.parse(localStorage.getItem(CLE_SESSION) || 'null');
    } catch (e) {
      return null;
    }
  }

  function poserSession(s) {
    if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s));
    else localStorage.removeItem(CLE_SESSION);
  }

  function connecte() {
    const s = session();
    return s && s.access_token ? s : null;
  }

  function courriel() {
    const s = connecte();
    return s && s.user && s.user.email ? s.user.email : null;
  }

  /* Un message lisible plutôt que le JSON brut de l'API : « Invalid login
     credentials » ne dit rien à qui vient de se tromper de mot de passe. */
  const TRADUCTIONS = [
    [/invalid login credentials/i, 'Adresse ou mot de passe incorrect.'],
    [/email not confirmed/i,
     "Adresse pas encore confirmée — ouvre le lien reçu par e-mail."],
    [/user already registered/i,
     'Cette adresse a déjà un compte. Utilise « Se connecter ».'],
    [/password should be at least (\d+)/i,
     'Mot de passe trop court (6 caractères minimum).'],
    [/rate limit|too many requests/i,
     'Trop de tentatives — attends une minute.'],
    [/failed to fetch|networkerror/i,
     'Serveur injoignable. Vérifie ta connexion.'],
  ];

  function lisible(message) {
    for (const [motif, texte] of TRADUCTIONS) {
      if (motif.test(message || '')) return texte;
    }
    return message || 'Erreur inconnue.';
  }

  async function appeler(chemin, options, avecJeton) {
    const entetes = Object.assign(
      { apikey: CLE, 'Content-Type': 'application/json' },
      (options && options.headers) || {});
    if (avecJeton) {
      const s = connecte();
      if (!s) throw new Error('Pas connecté.');
      entetes.Authorization = `Bearer ${s.access_token}`;
    }
    let reponse;
    try {
      reponse = await fetch(URL_BASE + chemin,
                            Object.assign({}, options, { headers: entetes }));
    } catch (e) {
      throw new Error(lisible(e.message));
    }
    const texte = await reponse.text();
    const corps = texte ? JSON.parse(texte) : null;
    if (!reponse.ok) {
      const m = (corps && (corps.msg || corps.message || corps.error_description
                           || corps.error || corps.hint)) || `HTTP ${reponse.status}`;
      throw new Error(lisible(m));
    }
    return corps;
  }

  /* Le jeton d'accès expire (une heure par défaut). Plutôt que de renvoyer
     l'utilisateur au formulaire, on rejoue le refresh_token une fois. */
  async function rafraichir() {
    const s = session();
    if (!s || !s.refresh_token) return false;
    try {
      const neuf = await appeler('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      poserSession(neuf);
      return true;
    } catch (e) {
      poserSession(null);
      return false;
    }
  }

  async function avecReprise(action) {
    try {
      return await action();
    } catch (e) {
      if (!/HTTP 401|jwt|expired/i.test(e.message)) throw e;
      if (!(await rafraichir())) throw new Error('Session expirée, reconnecte-toi.');
      return action();
    }
  }

  async function inscrire(email, motDePasse) {
    const r = await appeler('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: motDePasse }),
    });
    // Si la confirmation par e-mail est exigée, il n'y a pas encore de
    // jeton : on le dit, au lieu de laisser croire à une connexion.
    if (r && r.access_token) {
      poserSession(r);
      return { connecte: true };
    }
    return { connecte: false, message:
      "Compte créé. Ouvre le lien de confirmation reçu par e-mail, puis connecte-toi." };
  }

  async function connecter(email, motDePasse) {
    const r = await appeler('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password: motDePasse }),
    });
    poserSession(r);
    return r;
  }

  async function deconnecter() {
    try {
      await appeler('/auth/v1/logout', { method: 'POST' }, true);
    } catch (e) {
      // Un jeton déjà mort n'empêche pas de se déconnecter localement.
    }
    poserSession(null);
  }

  // ------------------------------------------------------------ builds ----
  async function listerBuilds() {
    return avecReprise(() => appeler(
      '/rest/v1/builds?select=nom,etat,code,public,maj&order=maj.desc', {}, true));
  }

  // ------------------------------------------------------- partage --------
  /* Le pseudo est la SEULE chose qu'on expose : l'adresse e-mail ne sort
     jamais de auth.users. Sans pseudo, on n'apparaît nulle part. */
  async function monProfil() {
    const s = connecte();
    if (!s) return null;
    const r = await avecReprise(() => appeler(
      `/rest/v1/profiles?select=pseudo&user_id=eq.${s.user.id}`, {}, true));
    return (r && r[0]) ? r[0].pseudo : null;
  }

  async function definirPseudo(pseudo) {
    const s = connecte();
    await avecReprise(() => appeler('/rest/v1/profiles?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: s.user.id, pseudo }),
    }, true));
    return pseudo;
  }

  let _sansColonnePartage = false;

  async function monProfilComplet() {
    const s = connecte();
    if (!s) return null;
    const r = await avecReprise(() => appeler(
      `/rest/v1/profiles?select=pseudo&user_id=eq.${s.user.id}`, {}, true));
    return (r && r[0]) || null;
  }

  /* ON PASSE PAR DES FONCTIONS, PAS PAR LA TABLE.
   *
   * Lire `profiles` directement permettrait `?select=pseudo` sans filtre,
   * c'est-à-dire la liste de tous les joueurs. La table est donc fermée, et
   * ces trois fonctions sont les seules portes : elles répondent à une
   * question précise et ne rendent jamais d'inventaire. Sans le pseudo
   * exact, on n'obtient rien. */
  function rpc(nom, corps) {
    return appeler(`/rest/v1/rpc/${nom}`, {
      method: 'POST', body: JSON.stringify(corps || {}),
    });
  }

  /* Les builds d'UN joueur, retrouvé par son pseudo exact. */
  async function parPseudo(pseudo) {
    const propre = String(pseudo || '').trim();
    if (propre.length < 2) return null;
    const qui = await rpc('joueur_existe', { p: propre });
    if (!qui || !qui.length) return null;
    const builds = await rpc('builds_de', { p: propre });
    return {
      pseudo: qui[0].pseudo,
      builds: (builds || []).map((b) => ({
        nom: b.nom, etat: b.etat, code: b.code || '' })),
    };
  }

  /* La galerie : uniquement ce qui est explicitement publié.
   *
   * Le TOTAL revient avec chaque ligne, calculé côté base sur l'ensemble
   * filtré. Sans lui, l'interface ne saurait pas s'il existe une page
   * suivante sans redemander, et à mille builds cela ferait deux requêtes
   * pour chaque clic. */
  async function galerie(opt) {
    const o = opt || {};
    const r = await rpc('galerie_publique', {
      p_limite: Number(o.limite) || 24,
      p_decalage: Number(o.decalage) || 0,
      p_tri: o.tri || 'recent',
      p_classe: (o.classe === 0 || o.classe) ? Number(o.classe) : null,
      p_recherche: o.recherche || null,
    });
    const lignes = (r || []).map((b) => ({
      nom: b.nom, etat: b.etat, code: b.code || '',
      auteur: b.auteur || null, maj: b.maj,
    }));
    return { lignes, total: (r && r[0] && Number(r[0].total)) || 0 };
  }

  /* Un simple compte, sans une seule identité. Il sert à distinguer deux
   * vides que rien ne différencie autrement : « personne n'a publié » et
   * « ton filtre ne ramène rien ». */
  async function combienDeBuildsPublics() {
    const r = await rpc('combien_de_builds_publics', {});
    return typeof r === 'number' ? r : Number(r) || 0;
  }

  /* ------------------------------------------------------------ guides --
   * Mêmes règles que les builds : la table est fermée, on publie en
   * cochant, et la liste ne transporte jamais le corps des guides — il fait
   * des milliers de caractères et n'a rien à faire dans un index. */
  async function mesGuides() {
    const s = connecte();
    if (!s) return [];
    return (await avecReprise(() => appeler(
      '/rest/v1/guides?select=id,titre,classe,corps,public,maj&order=maj.desc',
      {}, true))) || [];
  }

  async function enregistrerGuide(g) {
    const s = connecte();
    const ligne = {
      user_id: s.user.id, titre: g.titre, classe: g.classe ?? null,
      corps: g.corps, public: !!g.public,
      maj: new Date().toISOString(),
    };
    if (g.id) ligne.id = g.id;
    return avecReprise(() => appeler(
      '/rest/v1/guides?on_conflict=user_id,titre', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([ligne]),
      }, true));
  }

  async function supprimerGuide(id) {
    return avecReprise(() => appeler(
      `/rest/v1/guides?id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, true));
  }

  async function guidesPublics(opt) {
    const o = opt || {};
    const r = await rpc('guides_publics', {
      p_limite: Number(o.limite) || 20,
      p_decalage: Number(o.decalage) || 0,
      p_classe: (o.classe === 0 || o.classe) ? Number(o.classe) : null,
      p_recherche: o.recherche || null,
    });
    const lignes = (r || []).map((g) => ({
      id: g.id, titre: g.titre, classe: g.classe,
      auteur: g.auteur || null, maj: g.maj, taille: g.taille,
    }));
    return { lignes, total: (r && r[0] && Number(r[0].total)) || 0 };
  }

  async function guideComplet(id) {
    const r = await rpc('guide_complet', { gid: id });
    return (r && r[0]) || null;
  }

  async function envoyerBuilds(liste) {
    if (!liste.length) return [];
    const s = connecte();
    const lignes = liste.map((b) => {
      const l = { user_id: s.user.id, nom: b.nom, etat: b.etat,
                  code: b.code || '', public: !!b.pub };
      // Même prudence que pour `profiles.code` : tant que la migration n'est
      // pas passée, envoyer `partage` ferait échouer TOUT l'enregistrement.
      if (!_sansColonnePartage) l.partage = !!b.ami;
      return l;
    });
    const envoyer = () => avecReprise(() => appeler(
      '/rest/v1/builds?on_conflict=user_id,nom', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(lignes),
      }, true));
    try {
      return await envoyer();
    } catch (e) {
      if (!/partage|column|42703|does not exist/i.test(e.message)) throw e;
      _sansColonnePartage = true;
      for (const l of lignes) delete l.partage;
      return envoyer();
    }
  }

  async function supprimerBuild(nom) {
    return avecReprise(() => appeler(
      `/rest/v1/builds?nom=eq.${encodeURIComponent(nom)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, true));
  }

  /* LE RETOUR DU LIEN DE CONFIRMATION.
   *
   * Après avoir validé une adresse, Supabase renvoie vers le site avec les
   * jetons dans le FRAGMENT (#access_token=…&refresh_token=…), ou avec
   * #error=… si le lien a expiré. Sans ce traitement, l'utilisateur qui
   * clique dans son e-mail atterrit sur le site... toujours déconnecté, et
   * sans la moindre explication. */
  function lireFragmentAuth() {
    const brut = (location.hash || '').replace(/^#/, '');
    if (!brut || brut.startsWith('b=')) return null;
    const p = new URLSearchParams(brut);
    const nettoyer = () => history.replaceState(
      null, '', location.pathname + location.search);

    if (p.get('error') || p.get('error_description')) {
      nettoyer();
      const brutMsg = (p.get('error_description') || p.get('error') || '')
        .replace(/\+/g, ' ');
      return { erreur: /expired|invalid/i.test(brutMsg)
        ? "Le lien de confirmation a expiré ou a déjà servi. "
          + "Refais une demande de connexion."
        : lisible(brutMsg) };
    }

    const acces = p.get('access_token');
    if (!acces) return null;
    poserSession({
      access_token: acces,
      refresh_token: p.get('refresh_token') || '',
      expires_in: Number(p.get('expires_in') || 3600),
      token_type: p.get('token_type') || 'bearer',
      // L'identifiant tient dans le jeton lui-même : le lire ici évite un
      // aller-retour réseau juste pour savoir qui vient d'arriver.
      user: lireJeton(acces),
    });
    nettoyer();
    return { connecte: true, type: p.get('type') || '' };
  }

  /* Le corps d'un JWT, décodé sans rien vérifier — la vérification, c'est le
     serveur qui la fait à chaque appel. On n'y lit que l'id et l'e-mail. */
  function lireJeton(jeton) {
    try {
      const corps = jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const o = JSON.parse(decodeURIComponent(escape(atob(corps))));
      return { id: o.sub, email: o.email };
    } catch (e) {
      return null;
    }
  }

  window.Comptes = {
    actif, connecte, courriel, inscrire, connecter, deconnecter,
    listerBuilds, envoyerBuilds, supprimerBuild, lireFragmentAuth,
    monProfil, monProfilComplet, definirPseudo, parPseudo, galerie,
  };
}());
