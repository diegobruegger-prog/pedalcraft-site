// Anonyme Messung für Google-Anzeigen: nur wenn die Adresse ?pc_kw=<keyword>&pc_dev=<gerät> enthält.
// Keine Cookies, keine persönlichen Daten: zählt pro Suchbegriff und Gerät, wie weit Besucher kommen.
(function () {
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9äöü]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x'; }
  function send(key) { fetch('https://abacus.jasoncameron.dev/hit/pedalcraft-online/' + key, { mode: 'no-cors', keepalive: true }).catch(function () {}); }
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
  window.pcAd = hit;
  document.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('a[href*="gumroad.com"]');
    if (l) hit('buy');
  }, true);
})();
