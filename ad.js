// Anonyme Messung für Google-Anzeigen: nur wenn die Adresse ?pc_kw=<keyword>&pc_dev=<gerät> enthält.
// Keine Cookies, keine persönlichen Daten: zählt pro Suchbegriff und Gerät, wie weit Besucher kommen.
(function () {
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9äöü]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x'; }
  function send(key) { fetch('https://pedalcraft-stats.pages.dev/hit/' + key, { mode: 'no-cors', keepalive: true }).catch(function () {}); }
  function hit(ev) {
    if (/bot|crawl|spider|headless|google-inspectiontool/i.test(navigator.userAgent)) return;
    try {
      var kw = sessionStorage.getItem('pc_kw'), dev = sessionStorage.getItem('pc_dev');
      if (!kw || location.hostname === 'localhost') return;
      if (sessionStorage.getItem('pc_ad_' + ev)) return;
      sessionStorage.setItem('pc_ad_' + ev, '1');
      send('ad-' + ev);                       // alle Anzeigen zusammen
      send('ad-' + dev + '-' + ev);           // pro Gerät (m, t, c)
      if (ev === 'land' || ev === 'ride' || ev === 'trainer' || ev === 'buy') send('adkw-' + kw + '-' + ev);  // pro Suchbegriff
    } catch (e) {}
  }
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('pc_kw') !== null) {
      sessionStorage.setItem('pc_kw', slug(q.get('pc_kw')));
      sessionStorage.setItem('pc_dev', /^[mtc]$/.test(q.get('pc_dev') || '') ? q.get('pc_dev') : 'x');
      hit('land');
      // Deutschsprachige Anzeigen-Besucher bekommen die deutsche Zielseite
      var de = /(^|-)(ohne|abo|abonnement|kündigen|kosten|schalten|rollentrainer)(-|$)/.test(sessionStorage.getItem('pc_kw')) || /^de/i.test(navigator.language || '');
      if (de && location.pathname === '/zwift-click-without-zwift/') location.replace('/de/zwift-click-ohne-abo/');
    }
  } catch (e) {}
  // Anonymer Besuchsverlauf: zufällige ID pro Tab (sessionStorage), keine Cookies, keine IP, nur die Abfolge der Schritte
  // Suchmaschinen-Bots (z. B. Googlebot rendert mit Chrome) nicht als Besucher zählen
  var BOT = /bot|crawl|spider|slurp|lighthouse|headless|google-inspectiontool|bingpreview|facebookexternalhit|preview/i.test(navigator.userAgent) || navigator.webdriver === true;
  var EMBED = BOT || /[?&]embed=1/.test(location.search), T0 = Date.now(), seen = {};
  function sid() {
    try {
      var s = sessionStorage.getItem('pc_sid');
      if (!s) { s = Math.random().toString(36).slice(2, 14).replace(/[^a-z0-9]/g, '') + 'x0000000'; s = s.slice(0, 12); sessionStorage.setItem('pc_sid', s); }
      return s;
    } catch (e) { return null; }
  }
  function j(ev, once) {
    if (EMBED || location.hostname === 'localhost') return;
    if (once) { if (seen[ev]) return; seen[ev] = 1; }
    var s = sid(); if (!s) return;
    fetch('https://pedalcraft-stats.pages.dev/j?s=' + s + '&e=' + encodeURIComponent(String(ev).toLowerCase().slice(0, 120)), { mode: 'no-cors', keepalive: true }).catch(function () {});
  }
  try {
    var page = location.pathname.replace(/index\.html$/, '') || '/';
    if (!EMBED && location.hostname !== 'localhost' && !sessionStorage.getItem('pc_jstart')) {
      sessionStorage.setItem('pc_jstart', '1');
      var ref = ''; try { ref = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
      var ua = navigator.userAgent;
      var os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(ua) ? 'android'
        : /Macintosh/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : /CrOS/.test(ua) ? 'chromeos' : 'other';
      var br = /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) ? 'safari' : 'other';
      j('start:' + os + ':' + br + ':' + (navigator.language || 'x').slice(0, 5) + ':w' + Math.round(innerWidth / 100) * 100);
      var SRC = (sessionStorage.getItem('pc_kw') ? 'ad:' + sessionStorage.getItem('pc_kw') : /[?&]pc=pin(&|$)/.test(location.search) ? 'pinterest' : /[?&]pc=tiktok(&|$)/.test(location.search) ? 'tiktok' : /[?&]pc=meta(&|$)/.test(location.search) ? 'meta' : /[?&]pc=redditad(&|$)/.test(location.search) ? 'redditad' : /musical_ly|BytedanceWebview|trill_/i.test(navigator.userAgent) ? 'tiktok' : ref || 'direct');
      try { sessionStorage.setItem('pc_src', SRC); } catch (e) {}
      j('from:' + SRC);
      var pn = /[?&]p=([a-z0-9-]{2,50})/.exec(location.search); if (pn && /[?&]pc=pin/.test(location.search)) j('pin:' + pn[1]);
      // Anzeigenvariante und Zielgruppe aus dem Link (?ad=b&grp=devices), gilt für alle Besucher dieser Anzeige gleich
      var aq = new URLSearchParams(location.search), CLEAN = /^[a-z0-9-]{1,24}$/;
      ['ad', 'grp'].forEach(function (k) { var v = (aq.get(k) || '').toLowerCase(); if (CLEAN.test(v)) j(k + ':' + v); });
      j('time:' + new Date().getDay() + ':h' + new Date().getHours());
      // Tägliche Nutzer: ein Zähler pro Tag (UTC) und Besuch, dazu wie viele die Fahrseite öffnen
      var day = new Date().toISOString().slice(0, 10);
      try { sessionStorage.setItem('pc_day', day); } catch (e) {}
      send('day-' + day);
      if (/^\/ride\//.test(location.pathname)) { send('day-' + day + '-ride'); try { sessionStorage.setItem('pc_dayride', '1'); } catch (e) {} }
    }
    j('page:' + page);
    try { if (/^\/ride\//.test(location.pathname) && !EMBED && sessionStorage.getItem('pc_day') && !sessionStorage.getItem('pc_dayride')) { sessionStorage.setItem('pc_dayride', '1'); send('day-' + sessionStorage.getItem('pc_day') + '-ride'); } } catch (e) {}
    var marks = [25, 50, 75, 100];
    addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - innerHeight; if (h < 200) return;
      var pct = (scrollY / h) * 100;
      marks.forEach(function (m) { if (pct >= m - 2) j('scroll:' + page + ':' + m, true); });
    }, { passive: true });
    // Echte Lesezeit (nur sichtbarer Tab) und welcher Abschnitt wie lange im Bild war
    var act = 0, AM = [10, 30, 60, 120, 300];
    setInterval(function () {
      if (document.hidden) return; act++;
      AM.forEach(function (m) { if (act === m) j('active:' + page + ':' + m + 's'); });
    }, 1000);
    if (window.IntersectionObserver && !/^\/ride\//.test(page)) addEventListener('load', function () {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          var el = x.target;
          if (x.isIntersecting) el._pcT = setTimeout(function () { j('read:' + el._pcN, true); io.unobserve(el); }, 2000);
          else clearTimeout(el._pcT);
        });
      }, { threshold: 0.6 });
      var n = 0;
      document.querySelectorAll('h2, a[href*="gumroad.com"]').forEach(function (el) {
        if (n++ > 25) return;
        el._pcN = (el.tagName === 'A' ? 'buybutton-' : '') + slug(el.id || el.textContent); io.observe(el);
      });
    });
    addEventListener('error', function (e) { if (e.message) j('err:' + slug(e.message), true); });
    addEventListener('pagehide', function () { j('leave:' + page + ':' + Math.round((Date.now() - T0) / 1000) + 's'); });
  } catch (e) {}
  window.pcAd = function (ev) { hit(ev); j('app:' + ev, true); };
  // ---- Kaufweg: Kanal an Gumroad weitergeben (nur Kategorie, nie die Besuchs-ID), Rückkehr messen, Abbruchfrage ----
  var buyT = 0, asked = false;
  function src() { try { return sessionStorage.getItem('pc_src') || 'direct'; } catch (e) { return 'direct'; } }
  function markBuy(l) {
    if (EMBED) return;
    try {
      var u = new URL(l.href); u.searchParams.set('utm_source', slug(src())); u.searchParams.set('utm_medium', slug(location.pathname) === 'x' ? 'home' : slug(location.pathname)); u.searchParams.set('utm_campaign', slug(l.id || 'link'));
      l.href = u.toString();
    } catch (e) {}
    buyT = Date.now();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !buyT) return;
    var s = Math.round((Date.now() - buyT) / 1000); buyT = 0;
    if (s < 4) return;
    j('buyback:' + (s < 15 ? '4-15s' : s < 60 ? '15-60s' : s < 300 ? '1-5m' : 'over-5m'));
    if (!asked) { asked = true; setTimeout(function () { ask('stop', DE ? 'Was hält dich ab?' : 'What is holding you back?', DE
      ? [['price', 'Preis'], ['unsure', 'Geht es mit meinem Gerät?'], ['pay', 'Bezahlung war mühsam'], ['trust', 'Kenne euch noch nicht'], ['later', 'Später'], ['bought', 'Habe gekauft']]
      : [['price', 'The price'], ['unsure', 'Will it work with my gear?'], ['pay', 'Checkout was a hassle'], ['trust', 'I do not know you yet'], ['later', 'Later'], ['bought', 'I bought it']]); }, 600); }
  });
  var DE = /^de/i.test(document.documentElement.lang || '');
  function ask(id, q, opts) {
    if (EMBED || document.getElementById('pc-ask')) return;
    var d = document.createElement('div'); d.id = 'pc-ask'; d.setAttribute('role', 'group'); d.setAttribute('aria-label', q);
    d.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:9999;max-width:min(320px,calc(100vw - 32px));box-sizing:border-box;background:#fff;color:#111;border-radius:14px;padding:14px;box-shadow:0 8px 32px rgba(0,0,0,.28);font:14px/1.4 system-ui,sans-serif';
    var h = document.createElement('div'); h.textContent = q; h.style.cssText = 'font-weight:700;margin:0 28px 10px 0'; d.appendChild(h);
    var x = document.createElement('span'); x.textContent = '×'; x.setAttribute('role', 'button'); x.tabIndex = 0; x.setAttribute('aria-label', DE ? 'Schliessen' : 'Close');
    x.style.cssText = 'position:absolute;right:6px;top:4px;font-size:22px;line-height:1;padding:6px;cursor:pointer;color:#555';
    x.onclick = function () { j('ask-' + id + ':closed'); d.remove(); }; x.onkeydown = function (e) { if (e.key === 'Enter') x.onclick(); }; d.appendChild(x);
    opts.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = o[1];
      b.style.cssText = 'margin:0 6px 6px 0;padding:8px 12px;border:1px solid #ccc;border-radius:99px;background:#f5f5f5;color:#111;font:inherit;cursor:pointer';
      b.onclick = function () {
        j('ask-' + id + ':' + o[0]); send('ask-' + id + '-' + o[0]);
        d.textContent = DE ? 'Danke, das hilft.' : 'Thanks, that helps.';
        setTimeout(function () { d.remove(); }, 1800);
      };
      d.appendChild(b);
    });
    document.body.appendChild(d); j('ask-' + id + ':shown');
  }
  // Auf den Ratgeberseiten nach 25 s Lesen: welches Gerät? Einmal pro Besuch, nie während der Fahrt
  setTimeout(function () {
    try {
      if (EMBED || /^\/ride\//.test(location.pathname) || document.hidden || sessionStorage.getItem('pc_gear')) return;
      sessionStorage.setItem('pc_gear', '1');
      ask('gear', DE ? 'Welchen Trainer fährst du?' : 'Which trainer do you ride?', [['kickr-core2', 'KICKR Core 2'], ['kickr', DE ? 'Anderer KICKR' : 'Other KICKR'], ['tacx', 'Tacx'], ['elite', 'Elite'], ['hub', 'Zwift Hub'], ['other', DE ? 'Anderer' : 'Other'], ['none', DE ? 'Keinen' : 'None']]);
    } catch (e) {}
  }, 25000);
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#pc-ask')) return;
    var l = e.target.closest && e.target.closest('a[href*="gumroad.com"]');
    if (l) { markBuy(l); hit('buy'); j('buy:' + (l.id || l.textContent.trim().slice(0, 30).replace(/[^a-z0-9]+/gi, '-'))); return; }
    var b = e.target.closest && e.target.closest('a,button');
    if (b) j('tap:' + (b.id || (b.getAttribute('href') || b.textContent || '').trim().slice(0, 40).replace(/[^a-z0-9\/._-]+/gi, '-')));
  }, true);
})();
