#!/usr/bin/env python3
"""Auswertung der Google-Anzeigen: wie weit kommen Anzeigen-Besucher? (anonyme abacus-Zähler aus ad.js)
Aufruf: python3 tools/ads_report.py
Kosten und Klicks pro Suchbegriff kommen aus Google Ads selbst; hier steht, was danach auf der Seite passiert."""
import json, re, urllib.request

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
zwift abo kosten|virtuelles schalten ohne zwift|zwift hub ohne abo|rollentrainer app mac|
kickr core 2 app|zwift subscription alternative|virtual shifting app|smart trainer app|indoor cycling app"""


def slug(s):
    return (re.sub(r"[^a-z0-9äöü]+", "-", s.lower()).strip("-")[:40]) or "x"


ALL = json.load(urllib.request.urlopen(urllib.request.Request("https://pedalcraft-stats.pages.dev/all", headers={"User-Agent": "Mozilla/5.0 pedalcraft-report"}), timeout=15))  # eine Anfrage für alles


def get(key):
    return ALL.get(key, 0)


kws = sorted({k.strip() for k in KEYWORDS.replace("\n", "").split("|") if k.strip()})
keys = ["ad-" + e for e in EVENTS] + [f"ad-{d}-{e}" for d in DEVICES for e in EVENTS]
keys += [f"adkw-{slug(k)}-{e}" for k in kws for e in ("land", "ride", "trainer", "buy")]
val = {k: get(k) for k in keys}

print("Alle Anzeigen:  " + "  ".join(f"{e}={val['ad-' + e]}" for e in EVENTS))
for d, name in DEVICES.items():
    print(f"{name:9s}       " + "  ".join(f"{e}={val[f'ad-{d}-{e}']}" for e in EVENTS))
print("\nPro Suchbegriff (nur mit Besuchen):")
rows = [(k, *(val[f"adkw-{slug(k)}-{e}"] for e in ("land", "ride", "trainer", "buy"))) for k in kws]
for k, land, ride, tr, buy in sorted(rows, key=lambda r: -r[1]):
    if land:
        print(f"  {k:42s} land={land:3d} ride={ride:3d} trainer={tr:3d} buy={buy:3d}")

print("\nGesamt (alle Besucher):")
for k in ["home", "visit", "demo", "connect-tap", "nobt", "nobt-ios", "bt-cancel", "trainer", "click", "shifts-1", "shifts-10", "shifts-50", "ride-1m", "ride-3m",
          "ride-5m", "ride-10m", "ride-20m", "ride-30m", "ride-60m", "offer-ride10", "buy-ride10", "subscribe-ride", "subscribe-home", "subscribe-guide", "buy-click"]:
    print(f"  {k:14s} {ALL.get(k, 0)}")

print("\nWer kommt wie weit? (ab 25.10. 14:15, nach Herkunft / System / Land)")
SEG_EV = ["visit", "demo", "connect-tap", "nobt", "trainer", "click", "ride-1m", "ride-10m", "buy-click"]
for pre in ("src", "os", "cc"):
    groups = sorted({k[len(pre) + 1:].rsplit("-", 1)[0] for k in ALL if k.startswith(pre + "-") and any(k.endswith("-" + e) for e in SEG_EV)})
    for g in groups:
        cells = [f"{e}={ALL.get(f'{pre}-{g}-{e}', 0)}" for e in SEG_EV if ALL.get(f"{pre}-{g}-{e}", 0)]
        print(f"  {pre}:{g:10s} " + "  ".join(cells))
