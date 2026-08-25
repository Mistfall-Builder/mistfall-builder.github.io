/* VERROU D'ENTREE -- mot de passe partage, verifie cote serveur.
 *
 * Le mot de passe ne transite jamais en clair vers un tiers ni ne vit dans
 * ce fichier : le client envoie l'ESSAI a verifier_mdp_site() (Supabase),
 * qui compare un hash bcrypt cote base et ne renvoie qu'un booleen. Rien
 * a lire en inspectant ce fichier, contrairement a un mot de passe pose
 * directement dans le JS.
 *
 * Ce que ca protege VRAIMENT : l'usage du site (personne sans le mot de
 * passe ne charge le Builder). Ce que ca NE protege PAS : les fichiers de
 * donnees eux-memes (donnees.json, builds_reference.js...) restent
 * recuperables par qui en connait l'URL exacte -- une limite du site
 * statique lui-meme, pas de ce verrou.
 *
 * INERTE SANS SUPABASE CONFIGURE (comptes.js suit la meme regle) : un
 * clone du depot sans config.js rempli reste ouvert plutot que bloque
 * sans porte de sortie.
 */
(function () {
  const CLE_VERROU = 'mistfall.verrou.v1';
  const CFG = window.MISTFALL_CONFIG || {};
  if (!CFG.verrouActif || !CFG.supabaseUrl || !CFG.supabaseAnonKey) return;

  function deverrouille() {
    try { return localStorage.getItem(CLE_VERROU) === '1'; } catch (e) { return false; }
  }
  if (deverrouille()) return;

  const URL_BASE = CFG.supabaseUrl.replace(/\/+$/, '');

  async function verifier(motDePasse) {
    const reponse = await fetch(`${URL_BASE}/rest/v1/rpc/verifier_mdp_site`, {
      method: 'POST',
      headers: {
        apikey: CFG.supabaseAnonKey,
        Authorization: 'Bearer ' + CFG.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ essai: motDePasse }),
    });
    if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
    return reponse.json();
  }

  const tr = (cle) => (window.t ? window.t(cle) : cle);

  function pret() {
    const forme = document.getElementById('verrouForme');
    const champ = document.getElementById('verrouChamp');
    const erreur = document.getElementById('verrouErreur');
    const bouton = document.getElementById('verrouBouton');
    if (!forme) return;

    // demarrer() n'a jamais tourne pendant le verrouillage (c'est fait
    // exprès, voir app.js) -- donc I18N.appliquer() non plus. Sans cet
    // appel, l'ecran de verrou resterait fige sur le repli francais du
    // markup, meme pour un visiteur en anglais ou en russe.
    if (window.I18N) window.I18N.appliquer();

    forme.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const saisi = champ.value;
      if (!saisi || bouton.disabled) return;
      bouton.disabled = true;
      erreur.hidden = true;
      verifier(saisi).then((ok) => {
        if (ok === true) {
          try { localStorage.setItem(CLE_VERROU, '1'); } catch (e) {}
          // Un rechargement plutot qu'un retrait de classe a la main :
          // l'appli entiere (demarrer(), les fetch de donnees...) n'a
          // jamais tourne pendant le verrouillage -- autant repartir
          // d'une page neuve que de rattraper un demarrage a moitie fait.
          location.reload();
          return;
        }
        bouton.disabled = false;
        erreur.textContent = tr('verrou.erreur');
        erreur.hidden = false;
        champ.value = '';
        champ.focus();
      }).catch(() => {
        bouton.disabled = false;
        erreur.textContent = tr('verrou.injoignable');
        erreur.hidden = false;
      });
    });
    champ.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pret);
  } else {
    pret();
  }
})();
