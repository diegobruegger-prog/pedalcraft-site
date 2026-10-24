#!/usr/bin/env python3
"""Auswertung der Google-Anzeigen: wie weit kommen Anzeigen-Besucher? (anonyme abacus-Zähler aus ad.js)
Aufruf: python3 tools/ads_report.py
Kosten und Klicks pro Suchbegriff kommen aus Google Ads selbst; hier steht, was danach auf der Seite passiert."""
import json, re, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://abacus.jasoncameron.dev/get/pedalcraft-online/"
EVENTS = ["land", "ride", "demo", "connect-tap", "nobt-ios", "nobt", "trainer", "click", "ride-10m", "ride-30m", "buy"]
DEVICES = {"c": "Computer", "m": "Handy", "t": "Tablet"}
KEYWORDS = """zwift click without zwift|zwift click without subscription|use zwift click without zwift|zwift click other apps|
zwift click mac|zwift click on mac|kickr core 2 without zwift|kickr core 2 without subscription|zwift cog without zwift|
zwift cog without subscription|virtual shifting without zwift|zwift hub without subscription|zwift play without zwift|
cancel zwift subscription virtual shifting|zwift click app|indoor cycling app mac|smart trainer app mac|erg mode app mac|
ftp test app mac|zwift click|zwift click v2|zwift cog|zwift hub|kickr core 2|wahoo kickr core 2|zwift subscription|
zwift subscription price|zwift cost|virtual shifting|zwift play controller|zwift mac|free indoor cycling app|zwift click mac app|
zwift click ohne abo|zwift click ohne zwift|zwift click schalten ohne abo|mit zwift click schalten|zwift click ohne abonnement|
zwift cog ohne abo|zwift cog ohne zwift|kickr core 2 ohne zwift|kickr core 2 ohne abo|zwift ohne abo|zwift abo kündigen|
zwift abo kosten|virtuelles schalten ohne zwift|zwift hub ohne abo|rollentrainer app mac"""


def slug(s):
    return (re.sub(r"[^a-z0-9äöü]+", "-", s.lower()).strip("-")[:40]) or "x"


def get(key, tries=4):
    import time
    for i in range(tries):
        try:
            with urllib.request.urlopen(BASE + urllib.parse.quote(key), timeout=10) as r:
                return json.load(r).get("value", 0)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 0          # Zähler existiert noch nicht
            time.sleep(1.2)       # 429: Dienst bremst, kurz warten
        except Exception:
            time.sleep(1.2)
    return "?"


import urllib.parse  # noqa: E402

import urllib.error  # noqa: E402
kws = sorted({k.strip() for k in KEYWORDS.replace("\n", "").split("|") if k.strip()})
keys = ["ad-" + e for e in EVENTS] + [f"ad-{d}-{e}" for d in DEVICES for e in EVENTS]
with ThreadPoolExecutor(2) as ex:
    val = dict(zip(keys, ex.map(get, keys)))
kwkeys = [f"adkw-{slug(k)}-{e}" for k in kws for e in ("land", "ride", "trainer", "buy")]
if val["ad-land"] not in (0, "?"):   # Suchbegriffe nur abfragen, wenn es Anzeigen-Besuche gibt
    with ThreadPoolExecutor(2) as ex:
        val.update(zip(kwkeys, ex.map(get, kwkeys)))
else:
    val.update({k: 0 for k in kwkeys})

print("Alle Anzeigen:  " + "  ".join(f"{e}={val['ad-' + e]}" for e in EVENTS))
for d, name in DEVICES.items():
    print(f"{name:9s}       " + "  ".join(f"{e}={val[f'ad-{d}-{e}']}" for e in EVENTS))
print("\nPro Suchbegriff (nur mit Besuchen):")
rows = [(k, *(val[f"adkw-{slug(k)}-{e}"] for e in ("land", "ride", "trainer", "buy"))) for k in kws]
for k, land, ride, tr, buy in sorted(rows, key=lambda r: -r[1]):
    if land:
        print(f"  {k:42s} land={land:3d} ride={ride:3d} trainer={tr:3d} buy={buy:3d}")
