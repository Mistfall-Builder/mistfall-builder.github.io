# -*- coding: utf-8 -*-
"""Dit en trois lignes si la base est dans l'etat attendu par le site.

A lancer apres avoir colle la migration dans SQL Editor :

    python supabase/verifier.py

N'utilise que la cle publique, celle qui est deja dans config.js et que
n'importe quel visiteur peut lire : ce script ne teste donc rien de plus que
ce que le site lui-meme peut faire.
"""
import json
import re
import urllib.error
import urllib.request
import os
import sys

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
        return e.code, e.read().decode()[:120]
    except Exception as e:                      # reseau coupe, DNS, timeout
        return 0, str(e)[:120]


CONTROLES = [
    ("colonne builds.partage",
     lambda: appeler("/rest/v1/builds?select=partage&limit=1")[0] == 200),
    ("fonction joueur_existe",
     lambda: appeler("/rest/v1/rpc/joueur_existe", {"p": "___inexistant___"})[0] == 200),
    ("fonction builds_de",
     lambda: appeler("/rest/v1/rpc/builds_de", {"p": "___inexistant___"})[0] == 200),
    ("fonction galerie_publique",
     lambda: appeler("/rest/v1/rpc/galerie_publique", {"limite": 5})[0] == 200),
    # Celui-la doit ECHOUER : si la table repond encore, la liste de tous les
    # pseudos est lisible par n'importe qui, ce qu'on veut precisement eviter.
    ("table profiles fermee (doit refuser)",
     lambda: appeler("/rest/v1/profiles?select=pseudo")[0] != 200),
]

echecs = 0
for nom, test in CONTROLES:
    try:
        ok = test()
    except Exception:
        ok = False
    print(("  OK   " if ok else "  RATE ") + nom)
    echecs += 0 if ok else 1

print()
if echecs:
    print("%d controle(s) en echec : la migration n'est pas passee." % echecs)
    print("Colle supabase/migrations/20260812010000_par_pseudo.sql dans")
    print("  https://supabase.com/dashboard/project/%s/sql/new"
          % URL.split("//")[1].split(".")[0])
else:
    print("Tout est en place.")
sys.exit(1 if echecs else 0)
