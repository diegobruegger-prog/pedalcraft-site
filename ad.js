// Anonyme Messung für Google-Anzeigen: nur wenn die Adresse ?pc_ad=<anzeigengruppe>-<gerät> enthält.
// Keine Cookies, keine persönlichen Daten: zählt pro Anzeigengruppe/Gerät, wie weit Besucher kommen.
(function () {
  var K = 'pc_ad';
  function hit(ev) {
    try {
      var a = sessionStorage.getItem(K);
      if (!a || location.hostname === 'localhost') return;
      var s = 'pc_ad_' + ev;
      if (sessionStorage.getItem(s)) return;
      sessionStorage.setItem(s, '1');
      fetch('https://abacus.jasoncameron.dev/hit/pedalcraft-online/ad-' + a + '-' + ev, { mode: 'no-cors', keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  try {
    var q = new URLSearchParams(location.search), a = q.get('pc_ad');
    if (a && /^[0-9a-z-]{1,40}$/.test(a)) { sessionStorage.setItem(K, a); hit('land'); }
  } catch (e) {}
  window.pcAd = hit;
  document.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('a[href*="gumroad.com"]');
    if (l) hit('buy');
  }, true);
})();
