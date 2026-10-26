#!/usr/bin/env python3
"""Meldet alle URLs aus sitemap.xml per IndexNow (Bing, Yandex, Seznam …). Kein Konto nötig.
Aufruf: python3 tools/indexnow.py  (nach jedem Deploy neuer Seiten)"""
import json, re, urllib.request

KEY = "57febb4e50b9cc3262f57c86fc3f1bf7"
urls = re.findall(r"<loc>(.*?)</loc>", open("sitemap.xml").read())
body = json.dumps({"host": "pedalcraft.online", "key": KEY, "keyLocation": f"https://pedalcraft.online/{KEY}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
r = urllib.request.urlopen(req, timeout=20)
print(r.status, len(urls), "URLs gemeldet")
