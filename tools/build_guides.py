#!/usr/bin/env python3
"""Baut die SEO-Ratgeberseiten von pedalcraft.online aus einer Vorlage.
Jede Seite: eigener Ordner mit index.html, Titel/Description, FAQ als JSON-LD, Links zur Gratis-Version.
Aufruf: python3 tools/build_guides.py  (aus dem Repo-Ordner)"""
import json, os, html

BUY = "https://pedalcraftapp.gumroad.com/l/pedalcraft-mac/LAUNCH"
SITE = "https://pedalcraft.online"

GUIDES = [
    {
        "slug": "zwift-click-left-button-not-working",
        "title": "Zwift Click v2 left button stops working: why and what to do",
        "desc": "The left (minus) Zwift Click v2 puck goes silent about a minute after connecting outside Zwift. Here is why it happens and how PedalCraft works around it.",
        "h1": "The left Zwift Click stops after a minute",
        "lead": "You connect your Zwift Click v2 outside the Zwift app, both buttons work, and after about a minute the left «−» puck goes quiet. It's not broken. Here's what's going on.",
        "sections": [
            ("Why it happens", "<p>The Click v2 left puck is locked by its firmware unless the Zwift app unlocked it recently. Outside Zwift it answers for about a minute after connecting, then stops sending button presses. The right «+» puck is never locked.</p>"),
            ("What PedalCraft does", "<p>PedalCraft restarts the left puck every 50 seconds, so it keeps working. Now and then a press during the restart can be missed for about a second. Riding in the Zwift app once in a while also unlocks it for a longer time.</p>"),
            ("Other things to check", "<ul><li>Update the Click firmware in the Zwift Companion app.</li><li>Quit Zwift and Zwift Companion on every device, so they don't grab the Click.</li><li>Press a button on each puck right before you connect, so it wakes up.</li><li>Replace the coin cell if the LED is weak.</li></ul>"),
        ],
        "faq": [
            ("Is my Zwift Click v2 broken if the left button stops?", "Probably not. The left puck is locked by firmware outside Zwift after about a minute."),
            ("Can I use the left button without Zwift?", "Yes, PedalCraft restarts the left puck every 50 seconds to keep it working."),
            ("Does the right button have the same problem?", "No, only the left puck is locked."),
        ],
    },
    {
        "slug": "zwift-click-not-connecting",
        "title": "Zwift Click not connecting? A quick checklist",
        "desc": "Zwift Click won't pair or connect? Wake it, free it from other apps, check the battery and browser. A short checklist that fixes most cases.",
        "h1": "Zwift Click not connecting",
        "lead": "Most Zwift Click connection problems come down to three things: the Click is asleep, another app holds it, or the browser can't use Bluetooth. Work through this list.",
        "sections": [
            ("Checklist", "<ol><li><b>Wake it up:</b> press a button on each Click right before connecting. The LED should blink.</li><li><b>Free it:</b> quit Zwift and Zwift Companion on every device, including your phone. A Click talks to one app at a time.</li><li><b>Battery:</b> a weak coin cell causes drop-outs. Replace it (CR2032).</li><li><b>Browser:</b> use Chrome or Edge. Safari, Firefox and iPhone can't do Web Bluetooth.</li><li><b>Bluetooth on:</b> on Windows check Settings → Bluetooth, on Android allow Bluetooth and location.</li><li><b>Firmware:</b> update the Click in the Zwift Companion app once.</li></ol>"),
            ("Test it in two minutes", "<p>Open <a href=\"/ride/\">pedalcraft.online/ride</a>, click <b>Connect Click</b> and press a button. If it shows up and the gear number changes, the Click is fine.</p>"),
        ],
        "faq": [
            ("Why doesn't my Zwift Click show up?", "It's usually asleep or still connected to another app. Press a button on it and quit Zwift on all devices."),
            ("Can I connect two Clicks?", "Yes. Connect them one after the other; PedalCraft shows both."),
            ("Does the Zwift Click work on iPhone browsers?", "No, iPhone browsers can't use Web Bluetooth. Use Chrome on a computer or Android."),
        ],
    },
    {
        "slug": "zwift-play-without-zwift",
        "title": "Use Zwift Play controllers without Zwift",
        "desc": "Shift your smart trainer with Zwift Play controllers without the Zwift app or a subscription. Free in Chrome or Edge on Windows, Mac or Android.",
        "h1": "Zwift Play, without Zwift",
        "lead": "Zwift Play controllers are Bluetooth devices. PedalCraft connects them in your browser and turns the shift paddles into gear changes on your trainer. No Zwift app, no account.",
        "sections": [
            ("What works", "<ul><li>Shift paddles: harder and easier</li><li>Both controllers at the same time</li><li>Any Zwift Cog trainer (real virtual shifting) or Bluetooth FTMS trainer (grade per gear)</li></ul>"),
            ("Connect", "<ol><li>Quit Zwift on all devices.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge.</li><li>Connect your trainer, then press a button on each Play controller and click Connect Click.</li></ol>"),
        ],
        "faq": [
            ("Do Zwift Play controllers need a subscription?", "Not with PedalCraft. They connect over Bluetooth directly in the browser."),
            ("Does steering work?", "No. PedalCraft has no virtual world, only riding, shifting and training."),
            ("Is it free?", "Yes, riding and shifting is free. Pro adds ERG workouts, an FTP test and a ride log for $39 once."),
        ],
    },
    {
        "slug": "zwift-hub-without-zwift",
        "title": "Ride a Zwift Hub without a Zwift subscription",
        "desc": "Keep virtual shifting on your Zwift Hub One with the Zwift Click, without paying for Zwift. Free in Chrome or Edge on Windows, Mac or Android.",
        "h1": "Zwift Hub without Zwift",
        "lead": "The Zwift Hub One shifts in its firmware, the Click only tells it which gear. PedalCraft sends those gears the same way Zwift does, so you keep virtual shifting after you cancel. Free, in your browser.",
        "sections": [
            ("What you keep", "<ul><li>Virtual shifting with the Zwift Click</li><li>Live power, cadence, speed and zones</li><li>Grade changes with the arrow keys</li><li>ERG workouts and an FTP test with PedalCraft Pro</li></ul>"),
            ("Connect", "<ol><li>Quit Zwift on every device.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge.</li><li>Connect trainer, then the Click.</li></ol>"),
        ],
        "faq": [
            ("Does the Zwift Hub work without Zwift?", "Yes. It's a Bluetooth smart trainer. PedalCraft connects directly and uses the same virtual shifting messages as Zwift."),
            ("Do I need the Zwift Companion app?", "Only for firmware updates. To ride, PedalCraft connects directly."),
            ("Windows or Mac?", "Both, plus Android and Chromebook, in Chrome or Edge."),
        ],
    },
    {
        "slug": "free-indoor-cycling-app-windows",
        "title": "Free indoor cycling app for Windows (no subscription)",
        "desc": "Ride your Bluetooth smart trainer on a Windows PC for free: live watts, cadence, gears and shifting with Zwift Click, in Chrome or Edge. No install, no account.",
        "h1": "Free indoor cycling on Windows",
        "lead": "Open a browser tab, connect your smart trainer and ride. PedalCraft shows your watts, cadence, speed and zones, and lets you shift with a Zwift Click or the keyboard. Free, no install, no account, no subscription.",
        "sections": [
            ("What you get for free", "<ul><li>Live power, cadence, speed, heart rate and power zones</li><li>Virtual gears: Zwift Click, Play or Ride, or the arrow keys</li><li>Grade changes</li><li>A rider that pedals at your cadence</li></ul>"),
            ("What you need", "<ul><li>Windows 10 or 11 with Bluetooth</li><li>Chrome or Edge</li><li>A Bluetooth smart trainer (FTMS or Zwift Cog)</li></ul>"),
            ("Not a Zwift replacement", "<p>No virtual world, no racing, no group rides. Just your trainer, your numbers and your gears, without a monthly fee.</p>"),
        ],
        "faq": [
            ("Is there a free indoor cycling app for Windows?", "Yes. PedalCraft runs free in Chrome or Edge on Windows and connects your smart trainer over Bluetooth."),
            ("Can I do structured workouts?", "With PedalCraft Pro: ERG workouts from 20 minutes to 2 hours and an FTP test, $39 once."),
            ("Are rides saved?", "In the free version, no. Pro saves rides in your browser and exports them for Strava."),
        ],
    },
    {
        "slug": "de/zwift-click-jeder-trainer",
        "lang": "de",
        "title": "Zwift Click mit jedem Smart-Trainer (Tacx, Elite, Wahoo)",
        "desc": "Mit dem Zwift Click einen Tacx, Elite, Wahoo oder Saris schalten, gratis in Chrome oder Edge auf Windows, Mac oder Android. Ohne Zwift-Abo.",
        "h1": "Zwift Click. Jeder Smart-Trainer.",
        "lead": "Tacx, Elite, Wahoo, Saris: Wenn dein Trainer Bluetooth FTMS spricht, kann dein Zwift Click ihn schalten. Gratis im Browser, auf Windows, Mac oder Android. Ohne Zwift-Abo, ohne Konto.",
        "sections": [
            ("Welche Trainer gehen", "<ul><li><b>Zwift-Cog-Trainer</b> (Wahoo KICKR CORE 2, Zwift Hub One): echtes virtuelles Schalten in der Trainer-Firmware, wie in Zwift.</li><li><b>Bluetooth-FTMS-Trainer</b>, also die meisten Smart-Trainer seit etwa 2020 (zum Beispiel Tacx Neo 2T und Flux S mit aktueller Firmware, Elite Direto, Suito und Justo, Wahoo KICKR, Saris H3): Jeder Gang ändert die simulierte Steigung, das fährt sich wie Schalten.</li><li>Ältere Trainer, die nur ANT+ oder Tacx FE-C können, gehen noch nicht.</li></ul><p>Unsicher? <a href=\"/ride/\">Gratis-Version öffnen</a> und auf Connect trainer klicken. Erscheint dein Trainer in der Liste, geht es.</p>"),
            ("So verbindest du", "<ol><li>Zwift und andere Trainer-Apps auf allen Geräten beenden.</li><li><a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome oder Edge öffnen.</li><li>Connect trainer, dann Connect Click.</li><li>Losfahren: + schwerer, − leichter.</li></ol>"),
        ],
        "faq": [
            ("Kann ich den Zwift Click mit einem Tacx oder Elite benutzen?", "Ja, wenn der Trainer Bluetooth FTMS kann, und das können die meisten aktuellen Modelle. Jeder Druck auf den Click ändert die simulierte Steigung."),
            ("Geht das auf Windows?", "Ja, in Chrome oder Edge auf Windows 10 oder 11 mit Bluetooth."),
            ("Was kostet es?", "Fahren und Schalten ist gratis. PedalCraft Pro mit ERG-Workouts, FTP-Test und Fahrtenbuch kostet einmal $39."),
        ],
    },
    {
        "slug": "zwift-click-any-trainer",
        "title": "Use the Zwift Click with any smart trainer",
        "desc": "Shift Tacx, Elite, Wahoo, Saris and other Bluetooth smart trainers with your Zwift Click, free in Chrome or Edge on Windows, Mac or Android. No Zwift subscription.",
        "h1": "Your Zwift Click. Any smart trainer.",
        "lead": "Tacx, Elite, Wahoo, Saris, JetBlack, Van Rysel: if your trainer speaks Bluetooth FTMS, your Zwift Click can shift it. Free in your browser, on Windows, Mac or Android. No Zwift subscription, no account.",
        "sections": [
            ("Which trainers work", "<ul><li><b>Zwift Cog trainers</b> (Wahoo KICKR CORE 2, Zwift Hub One): real virtual shifting in the trainer firmware, like in Zwift.</li><li><b>Bluetooth FTMS trainers</b>, which is most smart trainers sold since about 2020 (for example Tacx Neo 2T and Flux S with current firmware, Elite Direto, Suito and Justo, Wahoo KICKR, Saris H3): every gear changes the simulated grade, so it rides like shifting.</li><li>Older trainers that only speak ANT+ or Tacx FE-C over Bluetooth don't connect yet.</li></ul><p>Not sure? <a href=\"/ride/\">Open the free version</a> and click Connect trainer. If your trainer shows up in the list, it works.</p>"),
            ("How to connect", "<ol><li>Quit Zwift and other trainer apps on every device. Only one app can control the trainer.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge.</li><li>Click <b>Connect trainer</b> and pick yours.</li><li>Press a button on each Click, then <b>Connect Click</b>.</li><li>Ride. <b>+</b> is harder, <b>−</b> is easier.</li></ol>"),
            ("Windows, Mac, Android", "<p>It runs in Chrome or Edge on Windows 10 and 11, macOS, Android and Chromebook. Your computer needs Bluetooth (built in, or a small USB Bluetooth adapter). iPhone and Safari can't do Web Bluetooth.</p>"),
            ("Not a Zwift replacement", "<p>There's no virtual world and no racing. PedalCraft is a simple tool to ride, shift and train without a monthly fee.</p>"),
        ],
        "faq": [
            ("Can I use the Zwift Click with a Tacx or Elite trainer?", "Yes, if the trainer supports Bluetooth FTMS, which most current models do. Each Click press changes the simulated grade, so it feels like shifting gears."),
            ("Does it work on Windows?", "Yes, in Chrome or Edge on Windows 10 or 11 with Bluetooth."),
            ("Is it free?", "Riding and shifting is free. PedalCraft Pro adds ERG workouts, an FTP test and a ride log for $39 once."),
        ],
    },
    {
        "slug": "zwift-click-tacx",
        "title": "Zwift Click with a Tacx trainer (Neo, Flux, Flow)",
        "desc": "Shift your Tacx Neo, Flux or Flow with a Zwift Click, without Zwift. Free in Chrome or Edge on Windows, Mac or Android.",
        "h1": "Zwift Click on a Tacx trainer",
        "lead": "Got a Tacx Neo, Flux or Flow and a Zwift Click? PedalCraft connects both in your browser and turns every Click into a gear change on the Tacx. Free, no subscription.",
        "sections": [
            ("Which Tacx models", "<p>Tacx trainers with current firmware support Bluetooth FTMS, the standard PedalCraft uses: Neo 2T, Neo 3M, Flux S and 2, Flow Smart and others. Update the firmware in the Tacx Training app first. The very first Neo and Flux and the Vortex only speak Tacx FE-C and don't connect yet.</p>"),
            ("How shifting feels", "<p>Each gear changes the simulated grade by one percent. Shift up and the Tacx gets heavier, shift down and it gets lighter, the way it does on a road.</p>"),
            ("Connect in a minute", "<ol><li>Close Zwift and the Tacx app.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge.</li><li>Connect trainer, pick your Tacx, then connect the Click.</li></ol>"),
        ],
        "faq": [
            ("Does the Tacx Neo work with the Zwift Click without Zwift?", "Yes, with current firmware the Neo speaks Bluetooth FTMS and PedalCraft shifts it with the Click."),
            ("Do I need the Tacx app?", "Only once to update the firmware. To ride, PedalCraft connects directly."),
            ("Does ERG mode work on Tacx?", "Yes. PedalCraft Pro sends the target watts over FTMS and the Tacx holds them."),
        ],
    },
    {
        "slug": "zwift-click-elite",
        "title": "Zwift Click with an Elite trainer (Direto, Suito, Justo)",
        "desc": "Use a Zwift Click to shift an Elite Direto, Suito or Justo smart trainer, free in Chrome or Edge. No Zwift subscription.",
        "h1": "Zwift Click on an Elite trainer",
        "lead": "Elite Direto, Suito, Justo or Avanti: PedalCraft connects your Elite and your Zwift Click in the browser, and every press of the Click shifts a gear. Free, no account.",
        "sections": [
            ("Which Elite models", "<p>Elite smart trainers with Bluetooth FTMS work, which covers the current Direto, Suito, Justo and Avanti models. Update the firmware in Elite's myETraining app if the trainer doesn't show up.</p>"),
            ("How to connect", "<ol><li>Quit Zwift on every device.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge.</li><li>Connect trainer, pick your Elite, then connect the Click.</li></ol>"),
            ("What you get", "<p>Live watts, cadence, speed and zones, shifting with the Click, and grade changes with the arrow keys. PedalCraft Pro adds ERG workouts, an FTP test and a ride log.</p>"),
        ],
        "faq": [
            ("Can the Zwift Click shift an Elite Suito?", "Yes. PedalCraft turns each Click press into a grade change on the Suito over Bluetooth FTMS."),
            ("Does it need Zwift?", "No. It runs in your browser without the Zwift app or an account."),
            ("Windows or Mac?", "Both, plus Android and Chromebook, in Chrome or Edge."),
        ],
    },
    {
        "slug": "zwift-click-windows",
        "title": "Use the Zwift Click on Windows without Zwift",
        "desc": "Connect a Zwift Click and your smart trainer on a Windows PC in Chrome or Edge, and shift without a Zwift subscription. Free, no install.",
        "h1": "Zwift Click on Windows. No Zwift.",
        "lead": "Your Windows PC can talk to the Zwift Click and your trainer straight from Chrome or Edge. Nothing to install, no account, no subscription.",
        "sections": [
            ("What you need", "<ul><li>Windows 10 or 11 with Bluetooth (built in or a USB adapter)</li><li>Chrome or Edge</li><li>A Zwift Click, Play or Ride and a Bluetooth smart trainer</li></ul>"),
            ("Connect", "<ol><li>Close Zwift.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a>.</li><li>Connect trainer, then the Click. Ride and shift.</li></ol>"),
            ("If the trainer doesn't show up", "<p>Make sure no other app or phone is connected to the trainer, and that Windows Bluetooth is on. Desktop PCs without Bluetooth need a small USB Bluetooth adapter.</p>"),
        ],
        "faq": [
            ("Do I need to install anything on Windows?", "No. PedalCraft runs in Chrome or Edge using Web Bluetooth."),
            ("Does ERG work on Windows?", "Yes, with PedalCraft Pro: ERG workouts, FTP test and a ride log, $39 once."),
            ("Does Firefox work?", "No, Firefox doesn't support Web Bluetooth. Use Chrome or Edge."),
        ],
    },
    {
        "slug": "zwift-click-android",
        "title": "Use the Zwift Click on Android without Zwift",
        "desc": "Ride your smart trainer and shift with a Zwift Click from an Android phone or tablet in Chrome. Free, no app, no Zwift subscription.",
        "h1": "Zwift Click on Android. No app.",
        "lead": "An Android phone or tablet is enough: open PedalCraft in Chrome, connect your trainer and Click, and ride. No app to install, no subscription.",
        "sections": [
            ("Connect", "<ol><li>Close Zwift and the Zwift Companion app.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome.</li><li>Allow Bluetooth and location if Android asks (Android needs it to scan).</li><li>Connect trainer, then the Click.</li></ol>"),
            ("Tablet on the bars", "<p>A tablet on the handlebars makes a great display: big watts, cadence, gear and time.</p>"),
        ],
        "faq": [
            ("Is there an app to install?", "No. It runs in Chrome on Android."),
            ("Does it work on iPhone?", "No, iPhone browsers can't use Web Bluetooth. Use Android, or Chrome on a computer."),
            ("Can I save rides on Android?", "Yes, with PedalCraft Pro: rides are saved in the browser and you can download them for Strava."),
        ],
    },
    {
        "slug": "de/zwift-click-ohne-abo",
        "lang": "de",
        "title": "Mit dem Zwift Click schalten, ohne Zwift-Abo",
        "desc": "So schaltest du mit dem Zwift Click ohne Zwift-Abo: Trainer und Click in Chrome verbinden und gratis fahren. Kein Konto, keine Installation. Mac-App mit ERG und FTP-Test.",
        "h1": "Mit dem Zwift Click schalten. Ohne Abo.",
        "lead": "Dein Zwift Click funktioniert auch ohne Zwift. PedalCraft verbindet Trainer und Click direkt im Browser und übernimmt das virtuelle Schalten. Gratis, ohne Konto, ohne Installation.",
        "sections": [
            ("Was du brauchst", "<ul><li>Einen Zwift Click (v1 oder v2), Zwift Play oder Zwift Ride</li><li>Einen Bluetooth-Smart-Trainer, zum Beispiel den Wahoo KICKR CORE 2</li><li>Chrome oder Edge auf Mac, Windows oder Android</li></ul>"),
            ("So verbindest du ihn", "<ol><li>Zwift auf allen Geräten beenden, auch auf dem Handy. Nur eine App kann den Trainer steuern.</li><li><a href=\"/ride/\">pedalcraft.online/ride</a> öffnen und auf <b>Connect trainer</b> klicken.</li><li>Auf jedem Click einmal drücken, damit er aufwacht, dann <b>Connect Click</b> wählen.</li><li>Losfahren. <b>+</b> schaltet schwerer, <b>−</b> leichter.</li></ol>"),
            ("Wie das Schalten ohne Zwift funktioniert", "<p>Auf Trainern mit Zwift-Cog (zum Beispiel KICKR CORE 2 oder Zwift Hub) schickt PedalCraft den Gang an den Trainer, und die Trainer-Firmware ändert den Widerstand, genau wie in Zwift. Andere Bluetooth-FTMS-Trainer bekommen pro Gang eine simulierte Steigung.</p>"),
            ("Kein Zwift-Ersatz", "<p>PedalCraft hat keine virtuelle Welt, keine Rennen und keine Gruppenfahrten. Es ist ein einfaches Werkzeug zum Fahren, Schalten und Trainieren, ohne monatliche Kosten.</p>"),
            ("Wenn du trainieren willst", f"<p>Die <a href=\"{BUY}\">Mac-App</a> bringt ERG-Workouts von 20 Minuten bis 2 Stunden, einen FTP-Rampentest, ein Fahrtenbuch und Strava-Upload. Einmal $39, zum Start $29, alle Updates inklusive. Läuft auf Apple Silicon und Intel ab macOS 14. Funktioniert sie mit deinem Trainer nicht, gibt es das Geld zurück.</p>"),
        ],
        "faq": [
            ("Brauche ich ein Zwift-Abo, um mit dem Click zu schalten?", "Nein. PedalCraft verbindet den Click direkt über Bluetooth, ohne Zwift-App und ohne Konto."),
            ("Geht das auf dem iPhone?", "Im Browser nicht: Safari und iPhone können kein Web Bluetooth. Nimm Chrome oder Edge auf einem Computer oder Android-Gerät."),
            ("Was kostet es?", "Die Browser-Version ist gratis. Die Mac-App kostet einmal $39, zum Start $29."),
        ],
    },
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
            ("Is it free?", "The browser version is free. A Mac app with workouts, an FTP test, a ride log and Strava upload costs $39 once."),
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
            ("Want structured training?", f"<p>The browser version shows your ride live and saves nothing. The <a href=\"{BUY}\">PedalCraft Mac app</a> adds an FTP ramp test, ERG workouts from 20 minutes to 2 hours, a ride log and Strava upload, for $39 once.</p>"),
        ],
        "faq": [
            ("Can I use the KICKR CORE 2 virtual shifting without Zwift?", "Yes. PedalCraft sends the gear to the trainer the same way Zwift does, so the trainer firmware shifts."),
            ("Do I need the Wahoo app?", "No. PedalCraft connects to the trainer directly over Bluetooth."),
            ("Will my rides be saved?", "Not in the free browser version. The Mac app saves every ride and can upload it to Strava."),
        ],
    },
    {
        "slug": "free-zwift-alternative",
        "title": "Looking for a free Zwift alternative? What PedalCraft is, and isn't",
        "desc": "PedalCraft is not a Zwift replacement: no virtual world, no group rides. It lets you ride your smart trainer and shift with your Zwift Click in Chrome or Edge for free, without a subscription.",
        "h1": "Not a Zwift replacement. Just your trainer, for free.",
        "lead": "If you want a virtual world, races and group rides, Zwift or MyWhoosh are the right choice. If you just want to ride your smart trainer, shift with your Click and see your numbers without a subscription, PedalCraft does that in your browser for free.",
        "sections": [
            ("What you get for free", "<ul><li>Smart trainer and heart rate connection via Web Bluetooth</li><li>Virtual shifting with Zwift Click, Play or Ride</li><li>Live watts, power zones, cadence, speed, grade</li><li>A demo mode if you want to look first</li></ul>"),
            ("What it is not", "<p>PedalCraft has no 3D world, no group rides and no races. It is a focused tool for riding and training. If that is what you want, you save the subscription.</p>"),
            ("When you want more", f"<p>The <a href=\"{BUY}\">Mac app</a> ($39 once) adds an FTP ramp test, a workout library with ERG, a ride log with summary images and Strava upload.</p>"),
        ],
        "faq": [
            ("Is PedalCraft a Zwift replacement?", "No. It has no virtual world, no group rides and no races. It is a simple tool to ride, shift and train with your trainer and Click without a subscription."),
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
    {
        "slug": "zwift-click-mac",
        "title": "Use the Zwift Click on a Mac without Zwift",
        "desc": "Shift your smart trainer with a Zwift Click on your Mac, no Zwift subscription. Free in Chrome, or as a native Mac app with ERG workouts and an FTP test for $39 once.",
        "h1": "Zwift Click on your Mac, without Zwift",
        "lead": "On a Mac you have two ways to ride with your Zwift Click and no subscription: the free browser version in Chrome, or the PedalCraft Mac app with workouts, an FTP test and a ride log.",
        "sections": [
            ("Free: in Chrome or Edge", "<ol><li>Quit Zwift on all devices.</li><li>Open <a href=\"/ride/\">pedalcraft.online/ride</a> in Chrome or Edge. Safari does not support Web Bluetooth.</li><li>Connect your trainer, then your Click, and shift.</li></ol>"),
            ("The Mac app", f"<p>The <a href=\"{BUY}\">PedalCraft Mac app</a> runs natively on macOS 14 or later, Apple Silicon and Intel. It keeps the Click connected in the background, holds your watts in ERG workouts from 20 minutes to 2 hours, runs an FTP ramp test, saves every ride and uploads it to Strava. A mini window shows your numbers on top of Netflix or YouTube, even in full screen. $39 once, all updates included.</p>"),
            ("Which Click works", "<p>Zwift Click v1 and v2, Zwift Play and Zwift Ride. On Zwift Cog trainers such as the Wahoo KICKR CORE 2 or Zwift Hub, the trainer firmware shifts, just like in Zwift.</p>"),
        ],
        "faq": [
            ("Does the Zwift Click work on a Mac without the Zwift app?", "Yes. PedalCraft connects the Click over Bluetooth, in Chrome or in the native Mac app, without Zwift or an account."),
            ("Does it work in Safari?", "No. Safari has no Web Bluetooth. Use Chrome or Edge, or the Mac app."),
            ("Is the Mac app a subscription?", "No. It costs $39 once and includes all future updates."),
        ],
    },
    {
        "slug": "indoor-cycling-app-mac",
        "title": "An indoor cycling app for Mac without a subscription",
        "desc": "PedalCraft is a native Mac app for smart trainers: ERG workouts, FTP ramp test, ride log, Strava upload and Zwift Click shifting. $39 once instead of a monthly subscription.",
        "h1": "An indoor cycling app for your Mac. No subscription.",
        "lead": "Most training apps cost $18 to $22 every month. PedalCraft for Mac costs $39 once and does the essentials well: ride, shift, train with ERG, test your FTP, keep a log.",
        "sections": [
            ("What it does", "<ul><li>Connects your smart trainer, Zwift Click and heart rate over Bluetooth</li><li>ERG workouts from 20 minutes to 2 hours, recovery to VO2max, with cadence hints and 3-2-1 beeps</li><li>FTP ramp test: 10 minute warm-up, +20 W per minute, zones set for you</li><li>Ride log with summary images, ride rating and FTP suggestions</li><li>Strava upload and a mini window over Netflix or YouTube</li></ul>"),
            ("What it costs compared to the others", "<p>Three years on an annual plan cost about $630 for TrainerRoad, $600 for Zwift and $540 for Rouvy or Wahoo SYSTM (US list prices, October 2026). Those apps offer more, such as virtual worlds and adaptive plans. PedalCraft costs $39, once.</p>"),
            ("Try before you buy", "<p>The <a href=\"/ride/\">browser version</a> is free and uses the same trainer and Click connection. If it works with your setup, the Mac app will too.</p>"),
        ],
        "faq": [
            ("Which Macs are supported?", "macOS 14 or later, on Apple Silicon and Intel."),
            ("Which trainers work?", "It is built for the Wahoo KICKR CORE 2 and works with most Bluetooth FTMS smart trainers."),
            ("Can I get a refund?", "Yes. If it doesn't work with your trainer, write within 30 days of buying and you get your money back."),
        ],
    },
    {
        "slug": "zwift-price",
        "title": "How much does Zwift cost in 2026, and the cheaper options",
        "desc": "Zwift costs $19.99 a month or $199.99 a year in 2026. What TrainerRoad, Rouvy and Wahoo SYSTM cost, and how to ride your trainer for free or for $39 once.",
        "h1": "What Zwift costs in 2026",
        "lead": "Zwift costs $19.99 a month or $199.99 a year in the US. Here is what the other big apps charge, and how to keep riding your smart trainer if you don't want another subscription.",
        "sections": [
            ("Prices in 2026", "<ul><li><b>Zwift</b>: $19.99 a month or $199.99 a year</li><li><b>TrainerRoad</b>: $21.99 a month or $209.99 a year</li><li><b>Rouvy</b>: $19.99 a month or $179.99 a year</li><li><b>Wahoo SYSTM</b> (Pro): $17.99 a month or $179.99 a year</li></ul><p>US list prices, checked October 2026. Prices differ by country and change; check each app before you subscribe.</p>"),
            ("Over three years", "<p>On annual plans, three winters cost about $600 for Zwift, $630 for TrainerRoad and $540 for Rouvy or Wahoo SYSTM.</p>"),
            ("The no-subscription way", f"<p>If you mainly want to ride, shift with your Zwift Click and see your watts, the <a href=\"/ride/\">PedalCraft browser version</a> is free. The <a href=\"{BUY}\">Mac app</a> adds ERG workouts, an FTP test, a ride log and Strava upload for $39 once. It has no virtual world and no group rides.</p>"),
        ],
        "faq": [
            ("How much is Zwift per month in 2026?", "$19.99 a month in the US, or $199.99 a year on the annual plan."),
            ("Can I use my Zwift Click without paying for Zwift?", "Yes. PedalCraft connects the Click and your trainer in Chrome or Edge for free."),
            ("Is there a free Zwift alternative?", "MyWhoosh is free with a virtual world. PedalCraft is free in the browser without one, and focuses on riding, shifting and training."),
        ],
    },
]

PAGE = """<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · PedalCraft</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{site}/img/og.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">{faqld}</script>
<script src="/ad.js?v=7"></script>
<style>
  :root {{ --bg:#0A0A0B; --card:#141416; --line:rgba(255,255,255,.08); --ink:#F5F5F7; --soft:#8E8E93; --accent:#3D8BFF; }}
  * {{ box-sizing: border-box; }} html,body {{ margin:0; background:var(--bg); color:var(--ink); }}
  body {{ font-family:"Inter",system-ui,-apple-system,sans-serif; line-height:1.65; font-size:18px; -webkit-font-smoothing:antialiased; }}
  a {{ color:var(--accent); }} .wrap {{ max-width:760px; margin:0 auto; padding:0 20px; }}
  nav {{ display:flex; justify-content:space-between; align-items:center; padding:18px 0; }}
  nav a.brand {{ display:flex; gap:10px; align-items:center; font-weight:600; color:var(--ink); text-decoration:none; font-size:17px; }}
  nav img {{ width:26px; height:26px; }}
  .pill {{ display:inline-block; border-radius:999px; padding:13px 24px; font-weight:600; text-decoration:none; background:var(--ink); color:#000; }}
  .pill.ghost {{ background:none; color:var(--accent); padding:13px 8px; }} nav .pill {{ background:none; color:var(--soft); padding:0; font-weight:500; font-size:15px; }}
  h1 {{ font-size:clamp(38px,7vw,64px); line-height:1.02; letter-spacing:-.04em; font-weight:700; margin:64px 0 18px; }}
  h2 {{ font-size:28px; letter-spacing:-.03em; margin:56px 0 10px; }} .lead {{ color:var(--soft); font-size:19px; }}
  .cta {{ display:flex; gap:10px; flex-wrap:wrap; margin:22px 0 8px; }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px 22px; margin-top:28px; }}
  .sub {{ display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 6px; }} .sub input {{ flex:1 1 200px; min-width:0; height:44px; padding:0 14px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:#0A0A0B; color:#F5F5F7; font:inherit; font-size:16px; }} .sub button {{ height:44px; padding:0 18px; border-radius:999px; border:0; background:#F5F5F7; color:#000; font:inherit; font-weight:600; cursor:pointer; }} .subnote {{ font-size:13px; color:#8E8E93; margin:0; }}
  .promo {{ width:100%; border-radius:14px; border:1px solid rgba(255,255,255,.08); margin:18px 0 6px; display:block; background:#141416; }}
  details {{ border-top:1px solid var(--line); padding:18px 0; }}
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
<video class="promo" src="/media/pedalcraft-16x9.mp4" poster="/media/pedalcraft-poster.jpg" autoplay muted loop playsinline preload="metadata"></video>
<div class="cta"><a class="pill" href="/ride/">{cta1}</a><a class="pill ghost" href="/ride/?demo=1">{cta2}</a></div>
{sections}
<div class="card">{maccard}</div>
<div class="card"><b>{subhead}</b><form class="sub" action="https://app.gumroad.com/follow_from_embed_form" method="post" target="_blank" onsubmit="try{{fetch('https://pedalcraft-stats.pages.dev/hit/subscribe-'+(this.dataset.src||'x'),{{mode:'no-cors',keepalive:true}})}}catch(e){{}}" data-src="guide">
  <input type="hidden" name="seller_id" value="7781126287159">
  <input type="email" name="email" required placeholder="you@example.com" aria-label="Email">
  <button type="submit">Email me the link</button>
</form>
<p class="subnote">We send you the link and the $29 launch code. Unsubscribe anytime.</p></div>
<h2>FAQ</h2>
{faq}
</main>
<footer>
<div>{links}</div>
<p>PedalCraft is not affiliated with Zwift, Wahoo or Strava. Compatibility is based on Bluetooth protocols documented in the open by the indoor-cycling community.</p>
</footer>
</div>
<script>fetch('https://pedalcraft-stats.pages.dev/hit/guide-{slug}',{{mode:'no-cors',keepalive:true}}).catch(function(){{}});</script>
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
                          links=links, slug=g["slug"].replace("/", "-"), lang=g.get("lang", "en"),
                          subhead="Nicht am Computer? Link per Mail:" if g.get("lang") == "de" else "Not at your computer? Get the link by email:",
                          cta1="Jetzt gratis fahren" if g.get("lang") == "de" else "Start riding",
                          cta2="Demo ansehen ›" if g.get("lang") == "de" else "Try the demo ›",
                          maccard=(f'<b>PedalCraft Pro</b>: FTP-Rampentest, ERG-Workouts von 20 Minuten bis 2 Stunden, Fahrtenbuch. Im Browser auf Windows, Mac und Android, dazu die Mac-App. <a href="{BUY}">Einmal $39, zum Start $29, kein Abo</a>.' if g.get("lang") == "de" else f'<b>PedalCraft Pro</b>: FTP ramp test, ERG workouts from 20 minutes to 2 hours, ride log. In the browser on Windows, Mac and Android, plus a native Mac app. <a href="{BUY}">$39 once, $29 at launch, no subscription</a>.'))
        if g.get("lang") == "de":
            out = out.replace("Email me the link", "Link per Mail senden").replace("We send you the link and the $29 launch code. Unsubscribe anytime.", "Wir schicken dir den Link und den $29-Launch-Code. Abmeldung jederzeit.")
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
