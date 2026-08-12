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

  /* Le code ami est engendré une seule fois, à la création du profil, et ne
     change plus : sinon les amis à qui on l'a donné le perdraient. */
  async function definirPseudo(pseudo) {
    const s = connecte();
    const actuel = await monProfilComplet();
    const ligne = { user_id: s.user.id, pseudo };
    if (!actuel || !actuel.code) ligne.code = engendrerCode();
    await avecReprise(() => appeler('/rest/v1/profiles?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(ligne),
    }, true));
    return ligne.code || (actuel && actuel.code) || null;
  }

  /* Le code ami : court, lisible à voix haute, sans caractères ambigus.
     Il sert à TROUVER quelqu'un, pas à garder un secret. */
  const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function engendrerCode() {
    let s = '';
    const tirage = new Uint32Array(8);
    (window.crypto || window.msCrypto).getRandomValues(tirage);
    for (let i = 0; i < 8; i += 1) {
      s += ALPHABET_CODE[tirage[i] % ALPHABET_CODE.length];
    }
    return s;
  }

  function formater(code) {
    return code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';
  }

  function nettoyer(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /* LA COLONNE `code` PEUT NE PAS ENCORE EXISTER. La migration est appliquée
     par l'intégration GitHub de Supabase, qui n'est pas instantanée : entre
     la mise en ligne du site et celle de la base, demander une colonne
     absente ferait échouer tout le bloc compte. On retombe donc sur le seul
     pseudo, et le code ami apparaîtra tout seul une fois la base à jour. */
  let _sansColonneCode = false;
  let _sansColonnePartage = false;

  async function monProfilComplet() {
    const s = connecte();
    if (!s) return null;
    if (!_sansColonneCode) {
      try {
        const r = await avecReprise(() => appeler(
          `/rest/v1/profiles?select=pseudo,code&user_id=eq.${s.user.id}`, {}, true));
        return (r && r[0]) || null;
      } catch (e) {
        if (!/column|42703|does not exist/i.test(e.message)) throw e;
        _sansColonneCode = true;
      }
    }
    const r = await avecReprise(() => appeler(
      `/rest/v1/profiles?select=pseudo&user_id=eq.${s.user.id}`, {}, true));
    return (r && r[0]) || null;
  }

  /* Les builds d'UN joueur, retrouvé par son code. Rien n'est listé sans
     code : il n'y a plus d'annuaire de tous les joueurs. */
  async function parCode(code) {
    const propre = nettoyer(code);
    if (propre.length !== 8) throw new Error(lisible('code invalide'));
    const profs = await appeler(
      `/rest/v1/profiles?select=user_id,pseudo,code&code=eq.${propre}`);
    if (!profs || !profs.length) return null;
    const p = profs[0];
    const builds = await appeler(
      `/rest/v1/builds?select=nom,etat,code&user_id=eq.${p.user_id}`
      + '&or=(partage.is.true,public.is.true)&order=maj.desc');
    return { pseudo: p.pseudo, code: p.code,
             builds: (builds || []).map((b) => ({
               nom: b.nom, etat: b.etat, code: b.code || '' })) };
  }

  /* La galerie : uniquement ce qui est explicitement publié. */
  async function galerie(limite) {
    const builds = await appeler(
      '/rest/v1/builds?select=nom,etat,code,user_id,maj&public=is.true'
      + `&order=maj.desc&limit=${Number(limite) || 60}`);
    if (!builds || !builds.length) return [];
    const ids = [...new Set(builds.map((b) => b.user_id))];
    const profs = await appeler(
      `/rest/v1/profiles?select=user_id,pseudo&user_id=in.(${ids.join(',')})`);
    const nomDe = new Map((profs || []).map((p) => [p.user_id, p.pseudo]));
    return builds.map((b) => ({
      nom: b.nom, etat: b.etat, code: b.code || '',
      auteur: nomDe.get(b.user_id) || '?', maj: b.maj,
    }));
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
    monProfil, monProfilComplet, definirPseudo,
    parCode, galerie, formater, nettoyer,
  };
}());
