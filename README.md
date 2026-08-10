# Mistfall Builder

Composeur de stuff pour *Mistfall Hunter*. Tu choisis tes affixes et leur
niveau, il te sort l'équipement, les gemmes et le **code d'import** à coller
dans le jeu (*Prepare → Manage/Import*). Aucun prix, aucun marché.

Le site est **entièrement statique** : tout le calcul se fait dans ton
navigateur, il n'y a aucun serveur derrière. Il fonctionne aussi hors ligne —
double-cliquer sur `index.html` suffit.

## Mettre en ligne

Le dossier est prêt tel quel, il n'y a rien à compiler.

### GitHub Pages

1. Crée un dépôt **vide** sur GitHub (sans README, sans .gitignore).
2. Dans ce dossier :

   ```
   git remote add origin https://github.com/TON-COMPTE/TON-DEPOT.git
   git push -u origin main
   ```

3. Dépôt → *Settings* → *Pages* → *Source: Deploy from a branch*, branche
   `main`, dossier `/ (root)`.

L'adresse sera `https://TON-COMPTE.github.io/TON-DEPOT/`.

### Netlify ou Cloudflare Pages

Une fois le dépôt sur GitHub : *Add new site* → *Import an existing project*
→ choisir le dépôt. Laisse la commande de build **vide** et le dossier de
publication à `.` (`netlify.toml` le dit déjà). Ces deux-là acceptent aussi
un simple glisser-déposer du dossier, sans passer par git.

## Ce que contient le dossier

| Fichier | Rôle |
|---|---|
| `index.html` | la page |
| `app.js` | le moteur de build et l'interface |
| `donnees.js` | les données du jeu, chargées par balise `<script>` |
| `icones/` | les icônes d'objets et de gemmes |
| `fond/` | l'illustration de fond |

`donnees.json` est la même chose que `donnees.js` au format JSON, gardée en
local pour les tests hors navigateur et volontairement exclue du dépôt.

## Mes builds

Les builds enregistrés vivent dans le **stockage local du navigateur** : ils
restent sur la machine et ne partent nulle part. Trois façons de les
déplacer :

- **Lien de partage** — tout le build tient dans l'adresse. Le lien marche
  chez qui le reçoit, sans rien installer.
- **Exporter / Importer** — un fichier `.json` avec toute la bibliothèque.
  L'import fusionne au lieu d'écraser.
- **Le code d'import du jeu** — pour rejouer le stuff en jeu directement.

## Régénérer les données

Depuis la racine du projet :

```
python tools/generer_site.py
```

Il relit les données du jeu, retrouve les identifiants manquants, recopie les
icônes réellement utilisées et réécrit `donnees.js` et `donnees.json`.
