#!/usr/bin/env python3
"""Adds entries to tools/art.json: add-art.py name.webp URL [w] [h] [fit]"""
import json, sys
p = 'tools/art.json'
d = json.load(open(p))
a = sys.argv[1:]
for i in range(0, len(a)):
    pass
name, url = a[0], a[1]
e = {'url': url}
if len(a) > 2 and a[2] != '-': e['w'] = int(a[2])
if len(a) > 3 and a[3] != '-': e['h'] = int(a[3])
if len(a) > 4: e['fit'] = a[4]
d[name] = e
json.dump(dict(sorted(d.items())), open(p, 'w'), indent=1)
open(p, 'a').write('\n')
