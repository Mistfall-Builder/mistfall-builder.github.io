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
    return avecReprise(() => appeler('/rest/v1/profiles?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: s.user.id, pseudo }),
    }, true));
  }

  /* Les builds partagés par tout le monde, groupés par auteur. Deux
     requêtes plutôt qu'une jointure : la RLS n'ouvre que les lignes
     publiques, et on recolle les pseudos ici. */
  async function partages() {
    const [profils, builds] = await Promise.all([
      appeler('/rest/v1/profiles?select=user_id,pseudo'),
      appeler('/rest/v1/builds?select=nom,etat,code,user_id&public=is.true'
              + '&order=maj.desc'),
    ]);
    const nomDe = new Map((profils || []).map((p) => [p.user_id, p.pseudo]));
    const par = new Map();
    for (const b of builds || []) {
      const pseudo = nomDe.get(b.user_id);
      if (!pseudo) continue;   // un build public sans pseudo n'est signable
      if (!par.has(pseudo)) par.set(pseudo, []);
      par.get(pseudo).push({ nom: b.nom, etat: b.etat, code: b.code || '' });
    }
    return [...par.entries()]
      .map(([pseudo, liste]) => ({ pseudo, builds: liste }))
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo));
  }

  async function envoyerBuilds(liste) {
    if (!liste.length) return [];
    const s = connecte();
    const lignes = liste.map((b) => ({
      user_id: s.user.id, nom: b.nom, etat: b.etat, code: b.code || '',
      public: !!b.pub,
    }));
    return avecReprise(() => appeler(
      '/rest/v1/builds?on_conflict=user_id,nom', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(lignes),
      }, true));
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
    monProfil, definirPseudo, partages,
  };
}());
