#!/usr/bin/env python3
"""Baut die SEO-Ratgeberseiten von pedalcraft.online aus einer Vorlage.
Jede Seite: eigener Ordner mit index.html, Titel/Description, FAQ als JSON-LD, Links zur Gratis-Version.
Aufruf: python3 tools/build_guides.py  (aus dem Repo-Ordner)"""
import json, os, html

BUY = "https://pedalcraftapp.gumroad.com/l/pedalcraft-mac"
SITE = "https://pedalcraft.online"

GUIDES = [
    {
        "slug": "zwift-click-without-zwift",
        "title": "How to use the Zwift Click without Zwift",
        "desc": "Use your Zwift Click shifters without a Zwift subscription: connect them in your browser and shift your smart trainer for free. No install, no account.",
        "h1": "Use your Zwift Click without Zwift",
        "lead": "Your Zwift Click talks plain Bluetooth. You don't need the Zwift app to use it: PedalCraft connects it right in your browser and shifts your trainer. Free, no install, no account.",
        "sections": [
            ("What you need", "<ul><li>A Zwift Click (v1 or v2), Zwift Play or Zwift Ride</li><li>A Bluetooth smart trainer, for example a Wahoo KICKR CORE 2</li><li>Chrome or Edge on a Mac, Windows PC or Android device</li></ul>"),
            ("How to connect it", "<ol><li>Quit Zwift on every device, including your phone. Only one app can control the trainer.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> and click <b>Connect trainer</b>.</li><li>Press a button on each Click so it wakes up, then click <b>Connect Click</b> and pick it from the list.</li><li>Start pedalling. The <b>+</b> button shifts harder, <b>−</b> shifts easier.</li></ol>"),
            ("How shifting works without Zwift", "<p>On trainers with Zwift virtual shifting (Zwift Cog trainers such as the KICKR CORE 2 or Zwift Hub), PedalCraft sends the selected gear to the trainer and the trainer firmware changes the resistance, the same way Zwift does it. On other Bluetooth FTMS trainers, each gear changes the simulated grade instead.</p>"),
            ("The Click v2 «−» button stops after a minute", "<p>Zwift locks the left Click v2 puck about a minute after it connects, unless you rode in the Zwift app recently. PedalCraft restarts that puck every 50 seconds, so «easier» may ignore a press for a second now and then. The right puck is never locked.</p>"),
        ],
        "faq": [
            ("Do I need a Zwift subscription to use the Zwift Click?", "No. The Click is a Bluetooth controller. PedalCraft connects to it directly in Chrome or Edge, without the Zwift app or an account."),
            ("Does it work on iPhone?", "Not in the browser: Safari and iPhone don't support Web Bluetooth. Use Chrome or Edge on a computer or Android device."),
            ("Is it free?", "The browser version is free. A Mac app with workouts, an FTP test, a ride log and Strava upload costs $30 once."),
        ],
    },
    {
        "slug": "kickr-core-2-without-zwift",
        "title": "Ride a Wahoo KICKR CORE 2 without a Zwift subscription",
        "desc": "Keep virtual shifting on your KICKR CORE 2 with Zwift Cog and Click, without paying for Zwift. Ride free in your browser with PedalCraft.",
        "h1": "KICKR CORE 2 without Zwift",
        "lead": "The KICKR CORE 2 with Zwift Cog and Click is built around Zwift's virtual shifting. If you cancel Zwift, you don't have to give that up: PedalCraft talks to the trainer and the Click directly, in your browser.",
        "sections": [
            ("What still works without Zwift", "<ul><li>Virtual shifting with the Zwift Click, done by the trainer firmware</li><li>Live power, cadence, speed and your power zones</li><li>Grade changes with the arrow keys</li><li>Heart rate from a strap or a watch that broadcasts heart rate</li></ul>"),
            ("Start in two minutes", "<ol><li>Quit Zwift on all devices.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge.</li><li>Connect the trainer, then the Click.</li><li>Pedal and shift.</li></ol>"),
            ("Want structured training?", f"<p>The browser version shows your ride live and saves nothing. The <a href=\"{BUY}\">PedalCraft Mac app</a> adds an FTP ramp test, ERG workouts from 20 minutes to 2 hours, a ride log and Strava upload, for $30 once.</p>"),
        ],
        "faq": [
            ("Can I use the KICKR CORE 2 virtual shifting without Zwift?", "Yes. PedalCraft sends the gear to the trainer the same way Zwift does, so the trainer firmware shifts."),
            ("Do I need the Wahoo app?", "No. PedalCraft connects to the trainer directly over Bluetooth."),
            ("Will my rides be saved?", "Not in the free browser version. The Mac app saves every ride and can upload it to Strava."),
        ],
    },
    {
        "slug": "free-zwift-alternative",
        "title": "A free Zwift alternative that runs in your browser",
        "desc": "Looking for a free alternative to Zwift? PedalCraft runs in Chrome or Edge: connect your smart trainer, shift with your Zwift Click, see your watts live. No subscription.",
        "h1": "A free alternative to Zwift, in your browser",
        "lead": "Not everyone needs a virtual world. If you want to ride your smart trainer, shift and see your numbers, PedalCraft does that in your browser for free, with no install and no account.",
        "sections": [
            ("What you get for free", "<ul><li>Smart trainer and heart rate connection via Web Bluetooth</li><li>Virtual shifting with Zwift Click, Play or Ride</li><li>Live watts, power zones, cadence, speed, grade</li><li>A demo mode if you want to look first</li></ul>"),
            ("What it is not", "<p>PedalCraft has no 3D world, no group rides and no races. It is a focused tool for riding and training. If that is what you want, you save the subscription.</p>"),
            ("When you want more", f"<p>The <a href=\"{BUY}\">Mac app</a> ($30 once) adds an FTP ramp test, a workout library with ERG, a ride log with summary images and Strava upload.</p>"),
        ],
        "faq": [
            ("Is PedalCraft really free?", "The browser version is free with no time limit. Only the Mac app with workouts and the ride log is paid, once."),
            ("Which trainers work?", "It is built for the Wahoo KICKR CORE 2 and works with most Bluetooth FTMS smart trainers."),
            ("Is it affiliated with Zwift?", "No. PedalCraft is independent and uses Bluetooth protocols documented in the open by the indoor-cycling community."),
        ],
    },
    {
        "slug": "web-bluetooth-smart-trainer",
        "title": "Ride your smart trainer in the browser with Web Bluetooth",
        "desc": "How to connect a smart trainer, Zwift Click and heart rate strap to your browser with Web Bluetooth. Which browsers work, and how PedalCraft does it.",
        "h1": "Ride your smart trainer in the browser",
        "lead": "Modern Chrome and Edge can talk to Bluetooth devices directly. That is enough to control a smart trainer, read your power and heart rate, and shift with a Zwift Click, without installing anything.",
        "sections": [
            ("Which browsers work", "<ul><li><b>Chrome</b> and <b>Edge</b> on macOS, Windows and Android: yes</li><li><b>Safari</b>, <b>Firefox</b> and all browsers on <b>iPhone</b>: no, they don't support Web Bluetooth</li></ul>"),
            ("What the browser talks to", "<ul><li><b>FTMS</b>, the standard Bluetooth fitness machine profile: power, cadence, speed and resistance</li><li><b>Zwift's virtual shifting protocol</b> on Zwift Cog trainers, so the trainer firmware shifts</li><li><b>Zwift Click, Play and Ride</b> controllers for the shift buttons</li><li>The standard <b>heart rate</b> profile</li></ul>"),
            ("Privacy", "<p>Everything happens in your browser tab. PedalCraft has no account and no server for your data; the free version keeps nothing once you close the tab.</p>"),
            ("Try it", "<p>Open <a href=\"/ride/\">pedalcraft.online/ride</a>, connect your trainer, or start the demo.</p>"),
        ],
        "faq": [
            ("Why does Chrome ask me to pick each device?", "Web Bluetooth only connects to devices you choose yourself, one at a time. That is a privacy feature of the browser."),
            ("Does it work offline?", "The page needs to load once; after that the Bluetooth connection is local between your browser and the trainer."),
        ],
    },
]

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · PedalCraft</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{site}/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script type="application/ld+json">{faqld}</script>
<style>
  :root {{ --bg:#17181B; --card:#212226; --line:rgba(255,255,255,.07); --ink:#E8EAEE; --soft:rgba(232,234,238,.62); --accent:#3D8BFF; }}
  * {{ box-sizing: border-box; }} html,body {{ margin:0; background:var(--bg); color:var(--ink); }}
  body {{ font-family:"Inter",system-ui,-apple-system,sans-serif; line-height:1.65; font-size:17px; }}
  a {{ color:var(--accent); }} .wrap {{ max-width:760px; margin:0 auto; padding:0 20px; }}
  nav {{ display:flex; justify-content:space-between; align-items:center; padding:18px 0; }}
  nav a.brand {{ display:flex; gap:10px; align-items:center; font-weight:800; color:var(--ink); text-decoration:none; font-size:19px; }}
  nav img {{ width:32px; height:32px; }}
  .pill {{ display:inline-block; border-radius:999px; padding:11px 20px; font-weight:700; text-decoration:none; background:var(--accent); color:#fff; }}
  .pill.ghost {{ background:var(--card); color:var(--ink); border:1px solid var(--line); }}
  h1 {{ font-size:clamp(32px,6vw,48px); line-height:1.1; letter-spacing:-1px; margin:24px 0 12px; }}
  h2 {{ font-size:24px; margin:36px 0 8px; }} .lead {{ color:var(--soft); font-size:19px; }}
  .cta {{ display:flex; gap:10px; flex-wrap:wrap; margin:22px 0 8px; }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px 22px; margin-top:28px; }}
  details {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 18px; margin-bottom:10px; }}
  summary {{ font-weight:700; cursor:pointer; }} details p {{ color:var(--soft); margin:8px 0 0; }}
  li {{ margin:4px 0; }} footer {{ color:var(--soft); font-size:14px; padding:48px 0 60px; }}
  footer a {{ margin-right:14px; }}
</style>
</head>
<body><div class="wrap">
<nav><a class="brand" href="/"><img src="/img/icon.png" alt="">PedalCraft</a><a class="pill" href="/ride/">Ride free</a></nav>
<main>
<h1>{h1}</h1>
<p class="lead">{lead}</p>
<div class="cta"><a class="pill" href="/ride/">▶ Open PedalCraft in your browser</a><a class="pill ghost" href="/ride/?demo=1">Try the demo</a></div>
{sections}
<div class="card"><b>PedalCraft for Mac</b>: FTP ramp test, ERG workouts from 20 minutes to 2 hours, ride log, Strava upload. <a href="{buy}">$30 once, no subscription</a>.</div>
<h2>FAQ</h2>
{faq}
</main>
<footer>
<div>{links}</div>
<p>PedalCraft is not affiliated with Zwift, Wahoo or Strava. Compatibility is based on Bluetooth protocols documented in the open by the indoor-cycling community.</p>
</footer>
</div>
<script>fetch('https://abacus.jasoncameron.dev/hit/pedalcraft-online/guide-{slug}',{{mode:'no-cors',keepalive:true}}).catch(function(){{}});</script>
</body></html>
"""

def main():
    links = " ".join(f'<a href="/{g["slug"]}/">{html.escape(g["h1"])}</a>' for g in GUIDES)
    for g in GUIDES:
        url = f'{SITE}/{g["slug"]}/'
        sections = "\n".join(f"<h2>{html.escape(h)}</h2>\n{body}" for h, body in g["sections"])
        faq = "\n".join(f"<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>" for q, a in g["faq"])
        faqld = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in g["faq"]]})
        out = PAGE.format(title=html.escape(g["title"]), desc=html.escape(g["desc"]), url=url, site=SITE, faqld=faqld,
                          h1=html.escape(g["h1"]), lead=html.escape(g["lead"]), sections=sections, faq=faq, buy=BUY,
                          links=links, slug=g["slug"])
        os.makedirs(g["slug"], exist_ok=True)
        open(os.path.join(g["slug"], "index.html"), "w").write(out)
    # Sitemap
    urls = [f"{SITE}/", f"{SITE}/ride/"] + [f'{SITE}/{g["slug"]}/' for g in GUIDES]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + \
         "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n"
    open("sitemap.xml", "w").write(sm)
    print("\n".join(urls))

if __name__ == "__main__":
    main()
