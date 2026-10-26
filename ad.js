// Anonyme Messung für Google-Anzeigen: nur wenn die Adresse ?pc_kw=<keyword>&pc_dev=<gerät> enthält.
// Keine Cookies, keine persönlichen Daten: zählt pro Suchbegriff und Gerät, wie weit Besucher kommen.
(function () {
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9äöü]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x'; }
  function send(key) { fetch('https://pedalcraft-stats.pages.dev/hit/' + key, { mode: 'no-cors', keepalive: true }).catch(function () {}); }
  function hit(ev) {
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
  var EMBED = /[?&]embed=1/.test(location.search), T0 = Date.now(), seen = {};
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
    if (!sessionStorage.getItem('pc_jstart')) {
      sessionStorage.setItem('pc_jstart', '1');
      var ref = ''; try { ref = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
      var ua = navigator.userAgent;
      var os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(ua) ? 'android'
        : /Macintosh/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : /CrOS/.test(ua) ? 'chromeos' : 'other';
      var br = /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) ? 'safari' : 'other';
      j('start:' + os + ':' + br + ':' + (navigator.language || 'x').slice(0, 5) + ':w' + Math.round(innerWidth / 100) * 100);
      j('from:' + (sessionStorage.getItem('pc_kw') ? 'ad:' + sessionStorage.getItem('pc_kw') : ref || 'direct'));
    }
    j('page:' + page);
    var marks = [25, 50, 75, 100];
    addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - innerHeight; if (h < 200) return;
      var pct = (scrollY / h) * 100;
      marks.forEach(function (m) { if (pct >= m - 2) j('scroll:' + page + ':' + m, true); });
    }, { passive: true });
    addEventListener('pagehide', function () { j('leave:' + page + ':' + Math.round((Date.now() - T0) / 1000) + 's'); });
  } catch (e) {}
  window.pcAd = function (ev) { hit(ev); j('app:' + ev, true); };
  document.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('a[href*="gumroad.com"]');
    if (l) { hit('buy'); j('buy:' + (l.id || l.textContent.trim().slice(0, 30).replace(/[^a-z0-9]+/gi, '-'))); return; }
    var b = e.target.closest && e.target.closest('a,button');
    if (b) j('tap:' + (b.id || (b.getAttribute('href') || b.textContent || '').trim().slice(0, 40).replace(/[^a-z0-9\/._-]+/gi, '-')));
  }, true);
})();
