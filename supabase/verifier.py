# -*- coding: utf-8 -*-
"""Dit en trois lignes si la base est dans l'etat attendu par le site.

    python supabase/verifier.py                 # controles generaux
    python supabase/verifier.py MonPseudo       # + la preuve decisive

POURQUOI UN PSEUDO EN ARGUMENT. Sous RLS, une table FERMEE ne renvoie pas
une erreur : elle renvoie 200 avec une liste VIDE. Une table fermee et une
table ouverte-mais-vide se ressemblent donc trait pour trait vues du
dehors. Tant qu'aucun profil n'existe, aucun test ne peut les distinguer —
c'est une limite du protocole, pas du script.

Des qu'UN profil existe, la preuve devient nette : la fonction
`joueur_existe` doit le trouver (elle est `security definer`, elle traverse
RLS) alors que la lecture directe de la table ne doit rien renvoyer. Si les
deux repondent, la porte est grande ouverte.

N'utilise que la cle publique, celle qui est deja dans config.js et que
n'importe quel visiteur peut lire : ce script ne teste donc rien de plus
que ce que le premier venu peut faire.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = open(os.path.join(RACINE, "config.js"), encoding="utf-8").read()
URL = re.search(r"supabaseUrl:\s*'([^']+)'", CONF).group(1)
CLE = re.search(r"supabaseAnonKey:\s*'([^']+)'", CONF).group(1)
ENTETES = {"apikey": CLE, "Authorization": "Bearer " + CLE,
           "Content-Type": "application/json"}


def appeler(chemin, corps=None):
    """Renvoie (code HTTP, corps decode). N'echoue jamais : c'est un test."""
    req = urllib.request.Request(
        URL + chemin, headers=ENTETES,
        data=json.dumps(corps).encode() if corps is not None else None,
        method="POST" if corps is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:160]
    except Exception as e:                      # reseau coupe, DNS, timeout
        return 0, str(e)[:160]


def existe_colonne(table, colonne):
    return appeler("/rest/v1/%s?select=%s&limit=1" % (table, colonne))[0] == 200


def fonction_repond(nom, corps):
    return appeler("/rest/v1/rpc/" + nom, corps)[0] == 200


CONTROLES = [
    ("colonne builds.partage", lambda: existe_colonne("builds", "partage")),
    ("fonction joueur_existe",
     lambda: fonction_repond("joueur_existe", {"p": "___inexistant___"})),
    ("fonction builds_de",
     lambda: fonction_repond("builds_de", {"p": "___inexistant___"})),
    ("fonction galerie_publique",
     lambda: fonction_repond("galerie_publique",
                             {"p_limite": 5, "p_decalage": 0, "p_tri": "recent"})),
    ("fonction combien_de_builds_publics",
     lambda: fonction_repond("combien_de_builds_publics", {})),
    ("fonction guides_publics",
     lambda: fonction_repond("guides_publics", {"p_limite": 5})),
    ("fonction guide_complet",
     lambda: fonction_repond(
         "guide_complet", {"gid": "00000000-0000-0000-0000-000000000000"})),
    ("lecture directe de guides : aucune ligne",
     lambda: appeler("/rest/v1/guides?select=titre")[1] == []),
    # La colonne du code ami doit avoir disparu.
    ("colonne morte profiles.code retiree",
     lambda: not existe_colonne("profiles", "code")),
    # Lecture directe : elle doit ne RIEN renvoyer. 200 + liste vide est le
    # comportement normal d'une table fermee -- voir l'en-tete du fichier.
    ("lecture directe de profiles : aucune ligne",
     lambda: appeler("/rest/v1/profiles?select=pseudo")[1] == []),
    ("lecture directe de builds : aucune ligne",
     lambda: appeler("/rest/v1/builds?select=nom")[1] == []),
]

echecs = 0
for nom, test in CONTROLES:
    try:
        ok = test()
    except Exception:
        ok = False
    print(("  OK   " if ok else "  RATE ") + nom)
    echecs += 0 if ok else 1

# ------------------------------------------------- la preuve, si on l'a ---
pseudo = sys.argv[1] if len(sys.argv) > 1 else None
print()
if not pseudo:
    print("Preuve decisive non faite : relance avec ton pseudonyme en argument")
    print("  python supabase/verifier.py MonPseudo")
    print("une fois qu'il est enregistre sur le site.")
else:
    _, trouve = appeler("/rest/v1/rpc/joueur_existe", {"p": pseudo})
    _, table = appeler("/rest/v1/profiles?select=pseudo")
    connu = isinstance(trouve, list) and len(trouve) > 0
    liste = table if isinstance(table, list) else []
    if not connu:
        print("« %s » est introuvable : pseudonyme inconnu, ou pas encore" % pseudo)
        print("enregistre sur le site. La preuve n'a pas pu etre faite.")
        echecs += 1
    elif liste:
        print("TROU OUVERT : la lecture directe renvoie %d pseudo(s)." % len(liste))
        print("N'importe qui peut lister tous les joueurs.")
        echecs += 1
    else:
        print("PROUVE : la fonction trouve « %s », la lecture directe ne" % pseudo)
        print("renvoie rien. La recherche exacte marche, l'enumeration non.")

print()
print("Tout est en place." if not echecs
      else "%d controle(s) en echec." % echecs)
sys.exit(1 if echecs else 0)
