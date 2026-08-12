# -*- coding: utf-8 -*-
"""Incremente la version des scripts ET version.txt, d'un seul geste.

Les deux doivent rester d'accord : c'est leur ecart qui declenche le
bandeau « nouvelle version ». Les separer, c'est garantir qu'un jour l'un
avance sans l'autre et que tout le monde voit le bandeau en boucle.
"""
import io
import re

s = io.open('index.html', encoding='utf-8').read()
n = max(int(x) for x in re.findall(r'\?v=(\d+)', s)) + 1
io.open('index.html', 'w', encoding='utf-8', newline='\n').write(
    re.sub(r'\?v=\d+', '?v=%d' % n, s))
io.open('version.txt', 'w', encoding='utf-8', newline='\n').write(str(n) + '\n')
print('version', n)
