// PedalCraft Ride · free browser version. Live only, nothing is stored.
// Bluetooth protocols ported from the PedalCraft Mac app (Zwift messages after TrainerHUD, MIT; see THIRD_PARTY.md).

// ---------- Protobuf helpers ----------
function pbVarint(n) { const out = []; let v = BigInt(n); do { let b = Number(v & 0x7Fn); v >>= 7n; if (v) b |= 0x80; out.push(b); } while (v); return out; }
function pbField(field, value) { return [...pbVarint(field << 3), ...pbVarint(Math.max(0, Math.round(value)))]; }
function pbSint(field, value) { const zz = (value << 1) ^ (value >> 31); return [...pbVarint(field << 3), ...pbVarint(zz >>> 0)]; }
function pbMessage(field, bytes) { return [...pbVarint((field << 3) | 2), ...pbVarint(bytes.length), ...bytes]; }
function pbDecode(bytes) {
  const out = []; let i = 0;
  const rv = () => { let r = 0n, s = 0n; while (i < bytes.length) { const b = bytes[i++]; r |= BigInt(b & 0x7F) << s; if (!(b & 0x80)) return r; s += 7n; } return null; };
  while (i < bytes.length) {
    const key = rv(); if (key === null) break;
    const num = Number(key >> 3n), wt = Number(key & 7n);
    if (wt === 0) { const v = rv(); if (v === null) break; out.push({ num, wt, v: Number(v) }); }
    else if (wt === 2) { const len = rv(); if (len === null) break; const l = Number(len); out.push({ num, wt, bytes: bytes.slice(i, i + l) }); i += l; }
    else if (wt === 1) i += 8; else if (wt === 5) i += 4; else break;
  }
  return out;
}
const unzig = v => (v >>> 1) ^ -(v & 1);

// ---------- Zwift protocol ----------
const ZW = {
  svc: '00000001-19ca-4651-86e5-fa29dcdd09d1',
  svcFC82: 0xFC82,
  async: '00000002-19ca-4651-86e5-fa29dcdd09d1',
  rx: '00000003-19ca-4651-86e5-fa29dcdd09d1',
  tx: '00000004-19ca-4651-86e5-fa29dcdd09d1',
  rideOn: [0x52, 0x69, 0x64, 0x65, 0x4F, 0x6E],
};
const MSG = {
  rideOnTrainer: [...ZW.rideOn, 0x02, 0x01],
  unknown41: [0x41, 0x08, 0x05],
  clickV2Unlock: [0xFF, 0x04, 0x00],
  reset: [0x18],
  getDeviceInfo: [0x00, 0x08, 0x00],
  gear: (ratioX10000, bikeKg, riderKg) => {
    let inner = pbField(2, ratioX10000);
    if (bikeKg) inner = [...inner, ...pbField(4, bikeKg * 100), ...pbField(5, riderKg * 100)];
    return [0x04, ...pbMessage(5, inner)];
  },
  sim: (inclineX100, full) => {
    let inner = [];
    if (full) inner = [...inner, ...pbSint(1, 0)];
    inner = [...inner, ...pbSint(2, inclineX100)];
    if (full) inner = [...inner, ...pbField(3, 5100), ...pbField(4, 400)];
    return [0x04, ...pbMessage(4, inner)];
  },
};
const isRideOn = d => d.length >= 6 && ZW.rideOn.every((b, i) => d[i] === b);
const RIDE_BITS = [[0x1, 'left'], [0x2, 'up'], [0x4, 'right'], [0x8, 'down'], [0x10, 'a'], [0x20, 'b'], [0x40, 'y'], [0x80, 'z'],
  [0x100, 'shiftUpLeft'], [0x200, 'shiftDownLeft'], [0x400, 'powerUpLeft'], [0x800, 'onOffLeft'],
  [0x1000, 'shiftUpRight'], [0x2000, 'shiftDownRight'], [0x4000, 'powerUpRight'], [0x8000, 'onOffRight']];
const SHIFT_UP = new Set(['shiftUpRight', 'clickPlus', 'paddleRight', 'shiftDownLeft']);
const SHIFT_DOWN = new Set(['shiftUpLeft', 'clickMinus', 'paddleLeft', 'shiftDownRight', 'b']);

function parseButtons(op, p) {
  const s = new Set();
  if (op === 0x23) { // Ride / Click v2: bitmap, pressed = 0
    let bitmap = 0xFFFFFFFF; const analog = {};
    const readAnalog = b => { let id, v; for (const f of pbDecode(b)) { if (f.num === 1 && f.wt === 0) id = f.v; if (f.num === 2 && f.wt === 0) v = unzig(f.v); } if (id !== undefined && v !== undefined) analog[id] = v; };
    for (const f of pbDecode(p)) {
      if (f.num === 1 && f.wt === 0) bitmap = f.v >>> 0;
      else if (f.num === 2 && f.wt === 2) for (const g of pbDecode(f.bytes)) if (g.wt === 2) readAnalog(g.bytes);
      else if (f.num === 3 && f.wt === 2) readAnalog(f.bytes);
    }
    for (const [mask, name] of RIDE_BITS) if (((~bitmap) & mask) !== 0) s.add(name);
    if (Math.abs(analog[0] || 0) >= 25) s.add('paddleLeft');
    if (Math.abs(analog[1] || 0) >= 25) s.add('paddleRight');
  } else if (op === 0x37) { // Click v1
    for (const f of pbDecode(p)) { if (f.wt !== 0) continue; if (f.num === 1 && f.v === 0) s.add('clickPlus'); if (f.num === 2 && f.v === 0) s.add('clickMinus'); }
  } else if (op === 0x07) { // Play
    let left = false; const raw = {};
    for (const f of pbDecode(p)) { if (f.wt !== 0) continue; if (f.num === 1) left = f.v === 1; else raw[f.num] = f.v; }
    if (raw[6] === 0) s.add(left ? 'shiftUpLeft' : 'shiftUpRight');
    if (!left && raw[5] === 0) s.add('b');
  }
  return s;
}
function findProductId(bytes, depth = 0) {
  if (depth > 4) return null;
  for (const f of pbDecode(bytes)) {
    if (f.wt === 0 && f.num === 10) return f.v;
    if (f.wt === 2) { const r = findProductId(f.bytes, depth + 1); if (r !== null) return r; }
  }
  return null;
}

// ---------- Ride state ----------
const GEARS = [0.75, 0.87, 0.99, 1.11, 1.23, 1.38, 1.53, 1.68, 1.86, 2.04, 2.22, 2.40, 2.61, 2.82, 3.03, 3.24, 3.49, 3.74, 3.99, 4.24, 4.54, 4.84, 5.14, 5.49];
const NEUTRAL = 11;
const ZONES = [[55, '#A9ABB7', 'Recovery'], [75, '#7DB3E0', 'Endurance'], [90, '#8CC084', 'Tempo'], [105, '#F2C14E', 'Threshold'], [120, '#F08A4B', 'VO2max'], [150, '#E0566B', 'Anaerobic'], [9999, '#9B6BD6', 'Sprint']];
const ride = {
  power: 0, cadence: 0, speed: 0, hr: null, gear: NEUTRAL, grade: 0,
  elapsed: 0, dist: 0, sum: 0, n: 0, kj: 0, ftp: 200,
  t: { power: 0, cadence: 0, speed: 0, hr: 0 }, demo: false,
};
let trainer = null;

function report({ power, cadence, speed, hr }) {
  const now = performance.now();
  // Einmal pro Sitzung melden, ob überhaupt Daten vom Trainer kommen (unterscheidet «nicht gefahren» von «keine Daten»)
  if (!ride.demo) { if (power != null || cadence != null) ping('data'); if (power > 0) ping('data-power'); if (cadence > 0) ping('data-cadence'); }
  if (power != null) { ride.power = Math.max(0, power); ride.t.power = now; }
  if (cadence != null) { ride.cadence = Math.max(0, Math.round(cadence)); ride.t.cadence = now; }
  if (speed != null) { ride.speed = Math.max(0, speed); ride.t.speed = now; }
  if (hr) { ride.hr = hr; ride.t.hr = now; }
}

let shiftCount = 0;
function shift(up) {
  if (wo) { setIntensity(wo.intensity + (up ? 5 : -5)); return; }
  if (!ride.demo) { shiftCount++; for (const n of [1, 10, 50]) if (shiftCount === n) ping('shifts-' + n); }
  const next = ride.gear + (up ? 1 : -1);
  if (next < 0 || next >= GEARS.length) { beep(220, 0.08); return; }
  ride.gear = next;
  beep(up ? 1100 : 760, 0.05);
  trainer?.applyGear();
  render();
}
function changeGrade(d) {
  ride.grade = Math.max(-10, Math.min(20, Math.round((ride.grade + d) * 2) / 2));
  trainer?.applyGrade();
  render();
}

let audio;
function beep(hz, dur) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = hz; g.gain.value = 0.05;
    o.connect(g).connect(audio.destination);
    g.gain.setTargetAtTime(0, audio.currentTime + dur * 0.6, dur / 3);
    o.start(); o.stop(audio.currentTime + dur + 0.05);
  } catch (e) {}
}

function toast(msg, ms = 3200) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- Bluetooth: trainer ----------
const FTMS = 0x1826, IBD = 0x2AD2, FTMS_CP = 0x2AD9;

class Trainer {
  constructor(device) { this.device = device; this.zwiftReady = false; this.ftms = null; this.rx = null; this.ftmsGranted = false; this.queue = Promise.resolve(); }
  async connect() {
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());
    const server = await this.device.gatt.connect();
    setChip('c-trainer', true, this.device.name || 'Trainer');
    const services = await server.getPrimaryServices();
    let async = null, tx = null;
    for (const s of services) {
      let chars = [];
      try { chars = await s.getCharacteristics(); } catch (e) { continue; }
      for (const c of chars) {
        const u = c.uuid;
        if (u === BluetoothUUID.getCharacteristic(IBD)) { c.addEventListener('characteristicvaluechanged', e => this.onIBD(e.target.value)); await c.startNotifications(); }
        else if (u === BluetoothUUID.getCharacteristic(FTMS_CP)) { this.ftms = c; c.addEventListener('characteristicvaluechanged', e => this.onCP(e.target.value)); await c.startNotifications().catch(() => {}); }
        else if (u === ZW.async) async = c;
        else if (u === ZW.tx) tx = c;
        else if (u === ZW.rx) this.rx = c;
      }
    }
    if (async && tx && this.rx) {
      async.addEventListener('characteristicvaluechanged', e => this.onZwiftAsync(bytesOf(e.target.value)));
      tx.addEventListener('characteristicvaluechanged', e => this.onZwiftSync(bytesOf(e.target.value)));
      await async.startNotifications(); await tx.startNotifications();
      for (let i = 0; i < 3 && !this.zwiftReady; i++) { await this.write(MSG.rideOnTrainer); await sleep(2500); }
    }
    if (!this.zwiftReady) this.useFTMS();
  }
  write(bytes) {
    this.queue = this.queue.then(() => this.rx.writeValueWithResponse(new Uint8Array(bytes)).catch(() => this.rx.writeValueWithoutResponse(new Uint8Array(bytes)))).catch(() => {});
    return this.queue;
  }
  writeFTMS(bytes) {
    if (!this.ftms) return;
    this.queue = this.queue.then(async () => {
      if (!this.ftmsGranted) await this.ftms.writeValueWithResponse(new Uint8Array([0x00])).catch(() => {});
      await this.ftms.writeValueWithResponse(new Uint8Array(bytes));
    }).catch(() => {});
  }
  onZwiftSync(d) {
    if (isRideOn(d) && !this.zwiftReady) {
      this.zwiftReady = true;
      setChip('c-trainer', true, (this.device.name || 'Trainer') + ' · virtual shifting');
      const ratio = Math.round(GEARS[ride.gear] * 10000);
      [MSG.unknown41, MSG.gear(ratio, 9, 75), MSG.getDeviceInfo, MSG.sim(Math.round(ride.grade * 100), true), MSG.gear(ratio)].forEach(m => this.write(m));
      this.keepAlive = setInterval(() => this.zwiftReady && this.write(this.erg != null ? [0x04, ...pbField(3, this.erg)] : MSG.sim(Math.round(ride.grade * 100), false)), 5000);
      if (this.erg != null) this.setTarget(this.erg);
    }
  }
  onZwiftAsync(d) {
    if (d[0] !== 0x03) return;
    const t = {};
    for (const f of pbDecode(d.slice(1))) if (f.wt === 0) t[f.num] = f.v;
    report({ power: t[1], cadence: t[2], speed: t[3] != null ? t[3] / 100 * 3.6 : null, hr: t[4] });
  }
  onIBD(v) {
    const flags = v.getUint16(0, true); let i = 2; const r = {};
    if (!(flags & 0x1)) { r.speed = v.getUint16(i, true) / 100; i += 2; }
    if (flags & 0x2) i += 2;
    if (flags & 0x4) { r.cadence = v.getUint16(i, true) / 2; i += 2; }
    if (flags & 0x8) i += 2;
    if (flags & 0x10) i += 3;
    if (flags & 0x20) i += 2;
    if (flags & 0x40) { r.power = v.getInt16(i, true); i += 2; }
    if (flags & 0x80) i += 2;
    if (flags & 0x100) i += 5;
    if (flags & 0x200) { r.hr = v.getUint8(i); i += 1; }
    report(r);
  }
  onCP(v) { if (v.byteLength >= 3 && v.getUint8(0) === 0x80 && v.getUint8(1) === 0x00) this.ftmsGranted = v.getUint8(2) === 1; }
  useFTMS() {
    if (!this.ftms) { setChip('c-trainer', true, (this.device.name || 'Trainer') + ' · read only'); return; }
    setChip('c-trainer', true, (this.device.name || 'Trainer') + ' · FTMS gears');
    this.sendSim();
  }
  sendSim() {
    const grade = ride.grade + (ride.gear - NEUTRAL) * 1.0;
    const g = Math.round(grade * 100);
    this.writeFTMS([0x11, 0, 0, g & 0xFF, (g >> 8) & 0xFF, 40, 51]);
  }
  applyGear() { if (this.erg) return; if (this.zwiftReady) this.write(MSG.gear(Math.round(GEARS[ride.gear] * 10000))); else this.sendSim(); }
  applyGrade() { if (this.erg) return; if (this.zwiftReady) this.write(MSG.sim(Math.round(ride.grade * 100), false)); else this.sendSim(); }
  // ERG: der Trainer hält die Watt (Zwift-Protokoll Feld 3, sonst FTMS 0x05). null = zurück zum Schalten.
  setTarget(w) {
    this.erg = w;
    if (w != null) {
      if (this.zwiftReady) this.write([0x04, ...pbField(3, w)]); else this.writeFTMS([0x05, w & 0xFF, (w >> 8) & 0xFF]);
    } else if (this.zwiftReady) {
      this.write(MSG.sim(Math.round(ride.grade * 100), true)); this.write(MSG.gear(Math.round(GEARS[ride.gear] * 10000)));
    } else this.sendSim();
  }
  async onDisconnect() {
    this.zwiftReady = false; clearInterval(this.keepAlive);
    setChip('c-trainer', false, 'Trainer reconnecting …');
    for (let i = 0; i < 20; i++) { try { await sleep(2000); await this.connect(); return; } catch (e) {} }
    setChip('c-trainer', false, 'Connect trainer');
  }
}

// ---------- Bluetooth: Zwift Click / Play / Ride ----------
class Controller {
  constructor(device) { this.device = device; this.pressed = new Set(); this.ready = false; this.label = device.name || 'Controller'; }
  async connect() {
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());
    const server = await this.device.gatt.connect();
    let svc = null;
    for (const u of [ZW.svc, ZW.svcFC82]) { try { svc = await server.getPrimaryService(u); break; } catch (e) {} }
    if (!svc) throw new Error('No Zwift service on this device');
    this.rx = await svc.getCharacteristic(ZW.rx);
    const async = await svc.getCharacteristic(ZW.async), tx = await svc.getCharacteristic(ZW.tx);
    async.addEventListener('characteristicvaluechanged', e => this.onAsync(bytesOf(e.target.value)));
    tx.addEventListener('characteristicvaluechanged', e => this.onSync(bytesOf(e.target.value)));
    await async.startNotifications(); await tx.startNotifications();
    for (let i = 0; i < 3 && !this.ready; i++) { await this.write(ZW.rideOn); await sleep(2000); }
    if (!this.ready) toast(this.label + ': no answer. Press a button and try again.');
    updateCtrlChip();
  }
  write(b) { return (this.rx.properties.writeWithoutResponse ? this.rx.writeValueWithoutResponse(new Uint8Array(b)) : this.rx.writeValueWithResponse(new Uint8Array(b))).catch(() => {}); }
  onSync(d) {
    if (isRideOn(d) && !this.ready) {
      this.ready = true; updateCtrlChip();
      if (d.length > 8) toast(this.label + ' needs a firmware update (Zwift Companion app).', 6000);
      setTimeout(() => this.write(MSG.getDeviceInfo), 300);
      this.keep = setInterval(() => this.ready && this.write(MSG.getDeviceInfo), 20000);
      return;
    }
    if (d[0] === 0x3C) {
      const pid = findProductId(d.slice(1));
      if (pid === 0x0B && !this.isLeftV2) { // Click v2 left puck: Zwift locks it, restart every 50 s
        this.isLeftV2 = true; this.label = 'Click −'; updateCtrlChip();
        this.write(MSG.clickV2Unlock);
        this.restart = setTimeout(() => this.ready && this.write(MSG.reset), 50000);
      } else if (pid === 0x0A) { this.label = 'Click +'; updateCtrlChip(); }
    }
  }
  onAsync(d) {
    const op = d[0];
    if (op === 0x23 || op === 0x37 || op === 0x07) {
      const now = parseButtons(op, d.slice(1));
      for (const b of now) if (!this.pressed.has(b)) { if (SHIFT_UP.has(b)) shift(true); else if (SHIFT_DOWN.has(b)) shift(false); }
      this.pressed = now;
    } else if (op === 0xFE) toast('Another app took over the controller. Quit Zwift.');
  }
  async onDisconnect() {
    this.ready = false; clearInterval(this.keep); clearTimeout(this.restart); updateCtrlChip();
    for (let i = 0; i < 30; i++) { try { await sleep(1500); await this.connect(); return; } catch (e) {} }
  }
}
const controllers = [];
function updateCtrlChip() {
  const ready = controllers.filter(c => c.ready);
  setChip('c-ctrl', ready.length > 0, ready.length ? ready.map(c => c.label).join(' · ') + '  (+ add)' : (controllers.length ? 'Click connecting …' : 'Connect Click'));
}

// ---------- Bluetooth: heart rate ----------
async function connectHR() {
  const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
  const run = async () => {
    const s = await dev.gatt.connect();
    const c = await (await s.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    c.addEventListener('characteristicvaluechanged', e => { const v = e.target.value; const f = v.getUint8(0); report({ hr: f & 1 ? v.getUint16(1, true) : v.getUint8(1) }); });
    await c.startNotifications();
    setChip('c-hr', true, dev.name || 'Heart rate');
  };
  dev.addEventListener('gattserverdisconnected', async () => { setChip('c-hr', false, 'HR reconnecting …'); for (let i = 0; i < 20; i++) { try { await sleep(2000); await run(); return; } catch (e) {} } });
  await run();
}

async function connectTrainer() {
  const dev = await navigator.bluetooth.requestDevice({
    filters: [{ services: [FTMS] }, { services: [ZW.svcFC82] }, { namePrefix: 'KICKR' }],
    optionalServices: [FTMS, ZW.svc, ZW.svcFC82, 'cycling_power', 'device_information'],
  });
  stopDemo();
  trainer = new Trainer(dev);
  setChip('c-trainer', false, 'Connecting …');
  await trainer.connect();
  ping('trainer');
}
async function connectController() {
  const dev = await navigator.bluetooth.requestDevice({
    filters: [{ manufacturerData: [{ companyIdentifier: 0x094A }] }, { namePrefix: 'Zwift' }],
    optionalServices: [ZW.svc, ZW.svcFC82, 'battery_service'],
  });
  const c = new Controller(dev);
  controllers.push(c); updateCtrlChip();
  await c.connect();
  ping('click');
}

// ---------- Helpers ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bytesOf = v => Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
function setChip(id, on, text) { const el = document.getElementById(id); el.classList.toggle('on', on); el.querySelector('span').textContent = text; }
function safe(fn) { return async () => { try { await fn(); } catch (e) { ping(e && e.name === 'NotFoundError' ? 'bt-cancel' : 'bt-error'); if (e && e.name !== 'NotFoundError') toast(e.message || String(e), 5000); } }; }

// Anonymous usage counter (no personal data, no cookies): one ping per event type and session.
const pinged = new Set();
const EMBED = new URLSearchParams(location.search).has('embed'); // live demo on the home page
const BOT = /bot|crawl|spider|slurp|lighthouse|headless|google-inspectiontool|bingpreview/i.test(navigator.userAgent) || navigator.webdriver === true;
function ping(ev) {
  if (EMBED || BOT) return;
  if (window.pcAd && ev !== 'buy-click') window.pcAd(ev === 'visit' ? 'ride' : ev);
  if (pinged.has(ev) || location.hostname === 'localhost') return; pinged.add(ev);
  fetch('https://pedalcraft-stats.pages.dev/hit/' + ev, { mode: 'no-cors', keepalive: true }).catch(() => {});
  // Wichtige Schritte zusätzlich nach Herkunft und System zählen (anonym, nur Kategorien)
  if (SEG_EVENTS && SEG && SEG_EVENTS.has(ev)) for (const k of ['src-' + SEG.src, 'os-' + SEG.os])
    fetch('https://pedalcraft-stats.pages.dev/hit/' + k + '-' + ev, { mode: 'no-cors', keepalive: true }).catch(() => {});
}
var SEG_EVENTS = new Set(['visit', 'demo', 'connect-tap', 'nobt', 'trainer', 'click', 'ride-1m', 'ride-10m', 'buy-click']);
var SEG = (() => {
  let ref = '';
  try { ref = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch {}
  let src = sessionStorage.getItem('pc_src');
  if (!src) {
    const ad = /pc_kw=/.test(location.search) || sessionStorage.getItem('pc_kw');
    src = ad ? 'ads' : !ref ? 'direct' : ref === location.hostname ? 'site'
      : /google\./.test(ref) ? 'google' : /bing\.|duckduckgo|ecosia|yahoo/.test(ref) ? 'search'
      : /reddit/.test(ref) ? 'reddit' : /gumroad/.test(ref) ? 'gumroad' : /youtube|youtu\.be/.test(ref) ? 'youtube'
      : /chatgpt|openai|perplexity|claude|gemini|copilot/.test(ref) ? 'ai' : /facebook|instagram|t\.co|x\.com|threads|bsky/.test(ref) ? 'social' : 'other';
    try { sessionStorage.setItem('pc_src', src); } catch {}
  }
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
    : /Android/.test(ua) ? 'android' : /Macintosh/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : /CrOS/.test(ua) ? 'chromeos' : 'other';
  return { src, os };
})();

// ---------- Demo ----------
let demoTimer = null;
function startDemo() {
  ride.demo = true; let t = 0;
  setChip('c-trainer', true, 'Demo trainer');
  demoTimer = setInterval(() => {
    t += 0.25;
    const base = wo && wo.target ? wo.target - 4 : 120 + ride.gear * 6 + ride.grade * 12;
    const surge = !wo && (Math.floor(t / 20) % 3 === 2) ? 90 : 0;
    report({ power: Math.round(base + surge + Math.sin(t) * 8), cadence: 86 + Math.sin(t / 3) * 6 + (surge ? 8 : 0), speed: 22 + ride.gear * 0.6 - ride.grade * 0.9 + Math.sin(t / 5), hr: Math.round(118 + ride.gear + surge / 3) });
  }, 250);
  ping('demo');
}
function stopDemo() { if (demoTimer) { clearInterval(demoTimer); demoTimer = null; ride.demo = false; } }

// ---------- Tick (1 s): totals, auto-pause, staleness ----------
setInterval(() => {
  const now = performance.now();
  if (now - ride.t.power > 3000) ride.power = 0;
  if (now - ride.t.cadence > 3000) ride.cadence = 0;
  if (now - ride.t.speed > 3000) ride.speed = 0;
  if (now - ride.t.hr > 5000) ride.hr = null;
  if (ride.power > 0 || ride.cadence > 0) {
    ride.elapsed += 1; ride.dist += ride.speed / 3.6; ride.sum += ride.power; ride.n += 1; ride.kj += ride.power / 1000;
    if (!ride.demo) samples.push([Math.round(ride.power), ride.cadence, ride.hr || 0, Math.round(ride.speed * 10), Math.round(ride.dist)]);
    if (wo) workoutTick();
  }
  render();
}, 1000);

// ---------- Render numbers ----------
const $ = id => document.getElementById(id);
const dots = $('dots'); GEARS.forEach((_, i) => { const d = document.createElement('i'); d.style.height = (6 + i * 0.6) + 'px'; dots.appendChild(d); });
const zonesEl = $('zones'); ZONES.forEach(z => { const d = document.createElement('i'); d.style.background = z[1]; zonesEl.appendChild(d); });
const zoneLabel = document.createElement('span'); zonesEl.appendChild(zoneLabel);
function zoneOf(w) { const pct = w / ride.ftp * 100; return ZONES.findIndex(z => pct < z[0] + 1); }
function render() {
  $('power').textContent = ride.power; $('cad').textContent = ride.cadence; $('speed').textContent = ride.speed.toFixed(1);
  $('hr').textContent = ride.hr ?? '–'; $('grade').textContent = ride.grade.toFixed(1); $('gear').textContent = ride.gear + 1;
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i <= ride.gear));
  const zi = zoneOf(ride.power);
  [...zonesEl.querySelectorAll('i')].forEach((d, i) => d.classList.toggle('on', ride.power > 0 && i <= zi));
  zoneLabel.textContent = ride.power > 0 ? `Z${zi + 1} ${ZONES[zi][2]}` : ''; zoneLabel.style.color = ZONES[Math.max(zi, 0)][1];
  const s = ride.elapsed; $('time').textContent = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('dist').textContent = (ride.dist / 1000).toFixed(2); $('avg').textContent = ride.n ? Math.round(ride.sum / ride.n) : 0; $('kj').textContent = Math.round(ride.kj);
}

// ---------- Scene (canvas) ----------
const cv = $('scene'), ctx = cv.getContext('2d');
let worldX = 0, crank = 0, last = performance.now();
const hash = (i, salt = 0) => { const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return v - Math.floor(v); };
function effortLevel() { if (!ride.power && !ride.cadence) return 0; const r = ride.power / ride.ftp; return r < 0.76 ? 0 : r < 0.91 ? 1 : r < 1.06 ? 2 : 3; }
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  worldX += ride.speed / 3.6 * 22 * dt; crank += ride.cadence / 60 * 2 * Math.PI * dt;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawLandscape(w, h); drawRider(w, h);
  requestAnimationFrame(frame);
}
function drawLandscape(w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1C2129'); g.addColorStop(1, '#2B3038');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  const cx0 = worldX * 0.1, gap = 320, first = Math.floor(cx0 / gap) - 1;
  for (let i = first; i <= first + Math.ceil(w / gap) + 2; i++) {
    const cx = i * gap - cx0 + hash(i) * 120, cy = 30 + hash(i, 1) * 60;
    ctx.beginPath(); ctx.ellipse(cx + 30, cy + 13, 30, 13, 0, 0, 7); ctx.ellipse(cx + 46, cy + 4, 24, 18, 0, 0, 7); ctx.ellipse(cx + 77, cy + 12, 25, 12, 0, 0, 7); ctx.fill();
  }
  const ground = h - 22;
  const hills = (speed, base, amp, freq, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
    for (let px = 0; px <= w + 8; px += 8) { const wx = px + worldX * speed; ctx.lineTo(px, base - amp * (0.55 + 0.3 * Math.sin(wx * freq) + 0.15 * Math.sin(wx * freq * 2.7 + 1.3))); }
    ctx.lineTo(w, h); ctx.fill();
  };
  hills(0.25, ground - 30, 90, 0.006, '#333840'); hills(0.5, ground + 2, 55, 0.011, '#3D424B');
  const tgap = 210, tf = Math.floor(worldX / tgap) - 1;
  for (let i = tf; i <= tf + Math.ceil(w / tgap) + 2; i++) {
    if (hash(i, 3) <= 0.4) continue;
    const tx = i * tgap - worldX + hash(i, 4) * 70, th = 30 + hash(i, 5) * 26, r = 16 + hash(i, 6) * 10;
    ctx.fillStyle = '#4D525C'; ctx.fillRect(tx - 3, ground - th, 6, th);
    ctx.fillStyle = '#4F5961'; ctx.beginPath(); ctx.arc(tx, ground - th - r * 0.5, r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#212429'; ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  for (let dx = -(worldX % 80); dx < w; dx += 80) ctx.fillRect(dx, ground + 9, 40, 3);
}
function knee(hip, foot, a, b) {
  const dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.min(Math.max(Math.hypot(dx, dy), 1), a + b - 0.01);
  const along = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(a * a - along * along, 0)), ux = dx / d, uy = dy / d;
  return { x: hip.x + ux * along + uy * hh, y: hip.y + uy * along - ux * hh };
}
function drawRider(w, h) {
  const s = Math.min(w / 300, h / 250) * 0.82, ox = (w - 300 * s) / 2, oy = h - 245 * s;
  const p = (x, y) => ({ x: ox + x * s, y: oy + y * s });
  const moving = ride.cadence > 0 || ride.speed > 1;
  const bob = moving ? Math.sin(crank * 2) * 1.5 : 0;
  const rear = p(70, 200), front = p(230, 200), bb = p(140, 195), seat = p(118, 133), bar = p(205, 125);
  const cl = 20 * s;
  const pA = { x: bb.x + cl * Math.cos(crank), y: bb.y + cl * Math.sin(crank) }, pB = { x: bb.x - cl * Math.cos(crank), y: bb.y - cl * Math.sin(crank) };
  const hip = { x: seat.x + 2 * s, y: seat.y - 6 * s + bob * s }, sh = { x: hip.x + 46 * s, y: hip.y - 40 * s };
  const line = (pts, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); };
  const metal = '#CCD0D8', accent = '#3D8BFF', body = '#9EA5B1';
  line([hip, knee(hip, pB, 46 * s, 46 * s), pB], '#5C616D', 9 * s);
  for (const c of [rear, front]) { ctx.strokeStyle = metal; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(c.x, c.y, 38 * s, 0, 7); ctx.stroke(); ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(c.x, c.y, 4 * s, 0, 7); ctx.fill(); }
  line([rear, bb, seat, rear], accent, 6 * s); line([bb, p(196, 137), seat], accent, 6 * s); line([p(196, 137), front], accent, 6 * s);
  line([p(196, 137), bar, p(214, 129)], metal, 5 * s); line([p(104, 131), p(130, 131)], metal, 6 * s);
  line([hip, sh], body, 16 * s);
  line([sh, { x: (sh.x + bar.x) / 2 + 4 * s, y: sh.y + 18 * s }, bar], body, 8 * s);
  line([pA, pB], metal, 4 * s);
  line([hip, knee(hip, pA, 46 * s, 46 * s), pA], '#808796', 10 * s);
  const lvl = effortLevel(), size = 92 * s;
  const wob = moving ? Math.sin(performance.now() / 1000 * (3 + lvl * 3)) * (1.5 + lvl * 2) : 0;
  ctx.save(); ctx.translate(sh.x + 10 * s, sh.y - size * 0.4); ctx.rotate(wob * Math.PI / 180);
  drawFace(lvl, size); ctx.restore();
}
function drawFace(level, size) {
  const s = size, c = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, 7); ctx.fill(); };
  const ink = '#1C1E22';
  c(0, 0.02, 0.47, '#3D4047'); c(0, 0.04, 0.41, '#DBDDE1');
  ctx.fillStyle = '#33373E'; ctx.beginPath();
  ctx.arc(0, 0.02 * s, 0.44 * s, Math.PI * 190 / 180, Math.PI * 350 / 180); ctx.quadraticCurveTo(0, -0.16 * s, -0.43 * s, -0.06 * s); ctx.fill();
  ctx.strokeStyle = '#3D8BFF'; ctx.lineWidth = 0.05 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0.02 * s, 0.36 * s, Math.PI * 225 / 180, Math.PI * 315 / 180); ctx.stroke();
  const st = w => { ctx.strokeStyle = ink; ctx.lineWidth = w * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  if (level === 0) { c(-0.14, 0, 0.035, ink); c(0.14, 0, 0.035, ink); st(0.03); ctx.beginPath(); ctx.moveTo(-0.1 * s, 0.15 * s); ctx.quadraticCurveTo(0, 0.24 * s, 0.1 * s, 0.15 * s); ctx.stroke(); }
  if (level === 1) { st(0.03); for (const x of [-0.14, 0.14]) { ctx.beginPath(); ctx.moveTo((x - 0.06) * s, 0.02 * s); ctx.quadraticCurveTo(x * s, -0.07 * s, (x + 0.06) * s, 0.02 * s); ctx.stroke(); }
    ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(-0.14 * s, 0.13 * s); ctx.quadraticCurveTo(0, 0.33 * s, 0.14 * s, 0.13 * s); ctx.closePath(); ctx.fill(); }
  if (level === 2) { c(-0.14, -0.01, 0.05, ink); c(0.14, -0.01, 0.05, ink); st(0.025); for (const x of [-0.14, 0.14]) { ctx.beginPath(); ctx.moveTo((x - 0.07) * s, -0.13 * s); ctx.lineTo((x + 0.07) * s, -0.15 * s); ctx.stroke(); }
    ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(0, 0.215 * s, 0.08 * s, 0.095 * s, 0, 0, 7); ctx.fill(); }
  if (level === 3) { st(0.03); ctx.beginPath(); ctx.moveTo(-0.2 * s, -0.04 * s); ctx.lineTo(-0.09 * s, 0); ctx.lineTo(-0.2 * s, 0.04 * s); ctx.moveTo(0.2 * s, -0.04 * s); ctx.lineTo(0.09 * s, 0); ctx.lineTo(0.2 * s, 0.04 * s); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-0.14 * s, 0.13 * s, 0.28 * s, 0.1 * s); st(0.02); ctx.strokeRect(-0.14 * s, 0.13 * s, 0.28 * s, 0.1 * s);
    ctx.lineWidth = 0.012 * s; ctx.beginPath(); ctx.moveTo(-0.14 * s, 0.18 * s); ctx.lineTo(0.14 * s, 0.18 * s); for (const x of [-0.07, 0, 0.07]) { ctx.moveTo(x * s, 0.13 * s); ctx.lineTo(x * s, 0.23 * s); } ctx.stroke(); }
  if (level >= 2) { ctx.fillStyle = '#8CBFFF'; for (const [x, y] of level === 3 ? [[0.36, -0.1], [-0.38, -0.02]] : [[0.36, -0.1]]) { ctx.beginPath(); ctx.moveTo(x * s, (y - 0.07) * s); ctx.quadraticCurveTo((x + 0.07) * s, (y + 0.03) * s, x * s, (y + 0.05) * s); ctx.quadraticCurveTo((x - 0.07) * s, (y + 0.03) * s, x * s, (y - 0.07) * s); ctx.fill(); } }
}

// ---------- Pro: Freischaltung per Gumroad-Lizenzschlüssel ----------
const BUY = 'https://pedalcraftapp.gumroad.com/l/pedalcraft-mac/LAUNCH';
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
let pro = store.get('pc_pro', null);
ride.ftp = store.get('pc_ftp', 200);
const isPro = () => !!(pro && pro.key);
async function checkKey(key) {
  const r = await fetch('https://pedalcraft-stats.pages.dev/license?key=' + encodeURIComponent(key.trim()));
  return (await r.json()).ok === true;
}
// Beim Start still nachprüfen; nur ein klares Nein sperrt (offline bleibt Pro an)
if (isPro() && location.hostname !== 'localhost') checkKey(pro.key).then(ok => { if (!ok) { pro = null; store.set('pc_pro', null); renderPro(); toast('Your PedalCraft Pro key is no longer valid.', 6000); } }).catch(() => {});

function showUnlock() {
  $('pro-title').textContent = 'Unlock PedalCraft Pro';
  $('pro-text').innerHTML = 'Paste the license key from your Gumroad receipt. It works in Chrome and Edge on Windows, Mac, Android and Chromebook.';
  $('pro-key').classList.remove('hidden'); $('pro-buy').classList.remove('hidden'); $('pro-buy').href = BUY; $('pro-buy').textContent = 'Get a key · $29 launch price'; offerOpen = false;
  $('pro').classList.remove('hidden'); setTimeout(() => $('pro-key-in').focus(), 50);
  ping('unlock-open');
}
$('pro-key-go').onclick = async () => {
  const key = $('pro-key-in').value.trim();
  if (!key) return;
  $('pro-key-go').disabled = true; $('pro-key-go').textContent = 'Checking …';
  try {
    if (await checkKey(key)) {
      pro = { key, t: Date.now() }; store.set('pc_pro', pro); ping('unlock-ok');
      $('pro').classList.add('hidden'); renderPro(); toast('PedalCraft Pro is unlocked. Have a good ride!', 5000);
    } else { ping('unlock-bad'); toast('That key did not work. Copy it again from your Gumroad receipt.', 6000); }
  } catch (e) { toast('Could not check the key. Are you online?', 5000); }
  $('pro-key-go').disabled = false; $('pro-key-go').textContent = 'Unlock';
};

// ---------- Pro: Trainings (wie in der Mac-App) ----------
const seg = (min, pct, text, rpm) => ({ s: Math.round(min * 60), a: pct, b: pct, text, rpm });
const ramp = (min, a, b, text) => ({ s: Math.round(min * 60), a, b, text });
const rep = (n, segs) => Array.from({ length: n }, () => segs).flat();
const WARM = [ramp(6, 45, 65, 'Warm-up'), seg(2, 70, 'Warm-up'), seg(1, 85, 'Wake up the legs'), seg(1, 55, 'Easy')];
const cool = (min = 5) => ramp(min, 55, 40, 'Cool-down');
const CAT_INFO = { Recovery: 'Spin easy. Perfect after a hard day.', Endurance: 'Zone 2 endurance with gentle waves.', 'Sweet Spot': 'Just below threshold: lots of benefit per minute.',
  Threshold: 'Right at FTP. Hard, but doable.', Intervals: 'Short, hard efforts above threshold.', Sprints: 'Short all-out sprints, easy in between.' };
function makeWorkout(cat, minutes) {
  const short = minutes <= 20;
  const wu = short ? [ramp(4, 45, 65, 'Warm-up'), seg(1, 75, 'Warm-up')] : WARM;
  const coolMin = short ? 3 : 5, main = minutes - (short ? 5 : 10) - coolMin;
  const intervals = (work, pct, label, rest, maxReps, rpm) => {
    const reps = Math.max(1, Math.min(maxReps, Math.floor((main + rest) / (work + rest))));
    const segs = [];
    for (let k = 0; k < reps; k++) { segs.push(seg(work, pct, label, rpm)); if (k < reps - 1) segs.push(seg(rest, 55, 'Recover')); }
    const rest2 = main - (reps * work + (reps - 1) * rest);
    if (rest2 >= 1) { segs.push(seg(Math.min(3, rest2), 55, 'Recover')); if (rest2 > 3) segs.push(seg(rest2 - 3, 66, 'Endurance')); }
    return [segs, `${reps} × ${work < 1 ? Math.round(work * 60) + ' s' : work + ' min'}`];
  };
  let body = [], title = '';
  if (cat === 'Recovery') body = [seg(main, 52, 'Spin easy')];
  else if (cat === 'Endurance') { const n = Math.floor(main / 10); body = rep(n, [seg(8, 68, 'Endurance'), seg(2, 75, 'Small wave, spin faster', [95, 105])]); if (main - n * 10 >= 1) body.push(seg(main - n * 10, 68, 'Endurance')); }
  else if (cat === 'Sweet Spot') { const w = main >= 50 ? 15 : main >= 25 ? 8 : 4; [body, title] = intervals(w, 90, 'Sweet Spot', w >= 15 ? 5 : w >= 8 ? 3 : 2, w >= 15 ? 3 : 5); }
  else if (cat === 'Threshold') { const w = main >= 40 ? 8 : main >= 25 ? 6 : 3; [body, title] = intervals(w, 98, 'Threshold', w >= 8 ? 4 : w >= 6 ? 3 : 2, 5); }
  else if (cat === 'Intervals') [body, title] = intervals(3, 115, 'Hard!', 3, 6);
  else [body, title] = intervals(0.25, 170, 'SPRINT!', 2.75, 10, [100, 125]);
  return { name: `${cat} ${minutes}`, info: (title ? title + '. ' : '') + CAT_INFO[cat], segs: [...wu, ...body, cool(coolMin)] };
}
const SPECIALS = [
  { name: 'Pyramid', info: '1-2-3-4-3-2-1 minutes hard, equal rest.', segs: [...WARM, ...[1, 2, 3, 4, 3, 2, 1].flatMap(m => [seg(m, 105, 'Hard'), seg(m, 55, 'Recover')]), cool()] },
  { name: '30/30', info: '30 seconds hard, 30 seconds easy. Two sets.', segs: [...WARM, ...rep(8, [seg(0.5, 125, 'Hard'), seg(0.5, 50, 'Easy')]), seg(5, 55, 'Break'), ...rep(8, [seg(0.5, 125, 'Hard'), seg(0.5, 50, 'Easy')]), cool()] },
  { name: 'Over-unders', info: 'Alternating just below and just above threshold.', segs: [...WARM, ...rep(3, [...rep(3, [seg(2, 95, 'Under'), seg(1, 108, 'Over')]), seg(4, 55, 'Recover')]), cool()] },
  { name: 'Mountain pass', info: 'Like a long climb with steep ramps every 5 minutes.', segs: [...WARM, ...rep(4, [ramp(4, 82, 92, 'Climbing'), seg(1, 110, 'Steep ramp')]), seg(5, 60, 'Summit, enjoy'), cool()] },
  { name: 'Coffee ride', info: 'Easy with a few short, fast spins.', segs: [ramp(8, 45, 60, 'Warm-up'), ...rep(3, [seg(6, 60, 'Cruise'), seg(1, 70, 'Spin fast', [100, 115])]), seg(5, 58, 'Easy'), cool(3)] },
];
// FTP-Test: 10 min Aufwärmen, ab 100 W jede Minute +20 W, danach 8 min Ausrollen (absolute Watt)
const FTP_TEST = (() => {
  const warm = [ramp(5, 70, 100, 'Warm-up'), seg(3, 110, 'Warm-up'), seg(1, 140, 'Wake up the legs', [90, 100]), seg(1, 90, 'Easy, here we go soon')];
  const steps = Array.from({ length: 22 }, (_, i) => seg(1, 100 + 20 * i, `Step ${i + 1}`));
  const warmEnd = warm.reduce((a, x) => a + x.s, 0);
  return { name: 'FTP test', info: '10 min warm-up, then +20 W every minute until you can’t go on. Then 8 min cool-down.', test: true, abs: true,
    segs: [...warm, ...steps, ramp(8, 100, 60, 'Cool down, well done!')], rampFrom: warmEnd, rampTo: warmEnd + 22 * 60 };
})();
const total = w => w.segs.reduce((a, x) => a + x.s, 0);
function at(w, t) {
  let start = 0;
  for (let i = 0; i < w.segs.length; i++) { const x = w.segs[i]; if (t < start + x.s) return { i, start, v: x.a + (x.b - x.a) * (t - start) / Math.max(x.s, 1) }; start += x.s; }
  const l = w.segs.length - 1; return { i: l, start: total(w) - w.segs[l].s, v: w.segs[l].b };
}
const wattsAt = (w, t, intensity) => { const v = at(w, t).v; return Math.round(w.abs ? v : v / 100 * ride.ftp * intensity / 100); };
function cadenceAt(w, t) {
  const a = at(w, t), x = w.segs[a.i]; if (x.rpm) return x.rpm;
  const pct = w.abs ? a.v / ride.ftp * 100 : a.v;
  return pct <= 75 ? [80, 95] : pct <= 105 ? [85, 95] : pct <= 150 ? [90, 105] : [95, 120];
}
const zoneColor = pct => ZONES[Math.max(0, ZONES.findIndex(z => pct < z[0] + 1))][1];
function drawProfile(canvas, w, t) {
  const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const T = total(w), pct = v => w.abs ? v / ride.ftp * 100 : v;
  const top = Math.max(120, ...w.segs.map(x => pct(Math.max(x.a, x.b))));
  let x = 0;
  for (const sg of w.segs) {
    const ww = sg.s / T * W, h1 = pct(sg.a) / top * H, h2 = pct(sg.b) / top * H;
    c.fillStyle = zoneColor((pct(sg.a) + pct(sg.b)) / 2);
    c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - h1); c.lineTo(x + ww, H - h2); c.lineTo(x + ww, H); c.fill(); x += ww;
  }
  if (t != null) { const px = t / T * W; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, 0, px, H); c.fillStyle = '#fff'; c.fillRect(px - 1.5, 0, 3, H); }
}
const mmss = s => { s = Math.max(0, Math.round(s)); return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

let wo = null, pickMin = 30;
function showPicker() {
  $('pick').classList.remove('hidden');
  const tabs = $('pick-tabs'); tabs.innerHTML = '';
  for (const m of [20, 30, 45, 60, 120]) {
    const b = document.createElement('button'); b.className = 'btn' + (m === pickMin ? ' primary' : ''); b.textContent = m + ' min';
    b.onclick = () => { pickMin = m; showPicker(); }; tabs.appendChild(b);
  }
  const list = $('pick-list'); list.innerHTML = '';
  const items = [...['Recovery', 'Endurance', 'Sweet Spot', 'Threshold', 'Intervals', 'Sprints'].map(c => makeWorkout(c, pickMin)), ...SPECIALS.filter(w => Math.abs(total(w) / 60 - pickMin) <= 8)];
  for (const w of items) {
    const card = document.createElement('button'); card.className = 'wcard';
    card.innerHTML = `<b></b><span class="wmeta"></span><canvas></canvas><span class="winfo"></span>`;
    card.querySelector('b').textContent = w.name; card.querySelector('.wmeta').textContent = mmss(total(w)) + ' · FTP ' + ride.ftp + ' W'; card.querySelector('.winfo').textContent = w.info;
    card.onclick = () => { $('pick').classList.add('hidden'); startWorkout(w); };
    list.appendChild(card); requestAnimationFrame(() => drawProfile(card.querySelector('canvas'), w));
  }
}
function startWorkout(w) {
  if (!trainer && !ride.demo) { toast('Connect your trainer first, then start the workout.', 5000); return; }
  wo = { w, t: 0, intensity: 100, target: null, best60: 0, win: [], low: 0 };
  $('wbar').classList.remove('hidden'); $('wbar-end').textContent = w.test ? 'I’m done' : 'Stop';
  ping(w.test ? 'ftp-start' : 'workout-start');
  workoutTick(true);
}
function setIntensity(v) { if (!wo || wo.w.abs) return; wo.intensity = Math.max(50, Math.min(150, v)); beep(wo.intensity > 100 ? 1100 : 760, 0.05); workoutTick(true); }
function workoutTick(noAdvance) {
  const w = wo.w;
  if (!noAdvance) wo.t += 1;
  if (wo.t >= total(w)) { finishWorkout(); return; }
  const target = wattsAt(w, wo.t, wo.intensity);
  if (target !== wo.target) { wo.target = target; trainer?.setTarget(target); }
  // 3-2-1 vor jedem Wechsel
  const a = at(w, wo.t), left = a.start + w.segs[a.i].s - wo.t;
  if (left <= 3 && left >= 1 && a.i < w.segs.length - 1 && Math.abs(w.segs[a.i + 1].a - w.segs[a.i].b) >= 3) beep(left === 1 ? 1320 : 880, left === 1 ? 0.25 : 0.1);
  if (w.test && !noAdvance && wo.t >= w.rampFrom && wo.t < w.rampTo) {
    wo.win.push(ride.power); if (wo.win.length > 60) wo.win.shift();
    if (wo.win.length === 60) wo.best60 = Math.max(wo.best60, Math.round(wo.win.reduce((x, y) => x + y, 0) / 60));
    wo.low = ride.cadence < 40 ? wo.low + 1 : 0;
    if (wo.low >= 10) endRamp();
  }
  const rpm = cadenceAt(w, wo.t), x = w.segs[a.i];
  $('wbar-name').textContent = w.name + (wo.intensity !== 100 ? ` · ${wo.intensity}%` : '');
  $('wbar-step').textContent = (x.text || '') + ' · ' + mmss(left) + ' left';
  $('wbar-target').textContent = target; $('wbar-rpm').textContent = `${rpm[0]}–${rpm[1]} rpm`;
  $('wbar-time').textContent = mmss(total(w) - wo.t);
  drawProfile($('wbar-profile'), w, wo.t);
}
function endRamp() {
  const w = wo.w; if (!w.test || wo.t >= w.rampTo) { stopWorkout(); return; }
  wo.done = true; const ftp = Math.round(wo.best60 * 0.75);
  wo.t = w.rampTo; wo.target = null; workoutTick(true); $('wbar-end').textContent = 'Stop';
  if (ftp >= 60) {
    ping('ftp-done');
    $('pro-title').textContent = 'Your FTP: ' + ftp + ' W';
    $('pro-text').textContent = `Best minute: ${wo.best60} W. FTP is 75% of that. Your zones and workouts now use ${ftp} W. Now cool down for 8 minutes.`;
    ride.ftp = ftp; store.set('pc_ftp', ftp); renderPro();
    $('pro-key').classList.add('hidden'); $('pro-buy').classList.add('hidden'); $('pro').classList.remove('hidden');
  }
}
function finishWorkout() { toast(wo.w.name + ' done. Well ridden!', 5000); ping('workout-done'); stopWorkout(); }
function stopWorkout() { wo = null; trainer?.setTarget(null); $('wbar').classList.add('hidden'); }
$('wbar-end').onclick = () => { if (wo && wo.w.test && !wo.done) endRamp(); else stopWorkout(); };
$('wbar-minus').onclick = () => setIntensity(wo.intensity - 5);
$('wbar-plus').onclick = () => setIntensity(wo.intensity + 5);
$('pick-close').onclick = () => $('pick').classList.add('hidden');

// ---------- Pro: Fahrten speichern (IndexedDB) und als .tcx für Strava laden ----------
const samples = [];
const T_START = new Date();
function db() {
  return new Promise((res, rej) => { const r = indexedDB.open('pedalcraft', 1); r.onupgradeneeded = () => r.result.createObjectStore('rides', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbAll() { const d = await db(); return new Promise(res => { const q = d.transaction('rides').objectStore('rides').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => b.id - a.id)); q.onerror = () => res([]); }); }
async function dbPut(r) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('rides', 'readwrite'); tx.objectStore('rides').put(r); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function dbDel(id) { const d = await db(); return new Promise(res => { const tx = d.transaction('rides', 'readwrite'); tx.objectStore('rides').delete(id); tx.oncomplete = res; }); }
async function saveRide() {
  if (samples.length < 60) { toast('Ride at least a minute, then save.', 4000); return; }
  const best = n => { let s = 0, b = 0; for (let i = 0; i < samples.length; i++) { s += samples[i][0]; if (i >= n) s -= samples[i - n][0]; if (i >= n - 1) b = Math.max(b, s / n); } return Math.round(b); };
  const r = { id: Date.now(), start: T_START.getTime(), secs: samples.length, dist: Math.round(ride.dist), avg: ride.n ? Math.round(ride.sum / ride.n) : 0, kj: Math.round(ride.kj),
    max: Math.max(...samples.map(x => x[0])), name: wo ? wo.w.name : 'Free ride', samples: samples.slice() };
  try { await dbPut(r); } catch (e) { toast('Could not save: ' + (e.message || e), 6000); return; }
  saved = true; ping('ride-saved');
  const b20 = samples.length >= 1200 ? best(1200) : 0, sug = Math.round(b20 * 0.95);
  toast(`Saved: ${mmss(r.secs)}, ${(r.dist / 1000).toFixed(1)} km, ${r.avg} W avg.`, 5000);
  if (sug >= ride.ftp * 1.03) { if (confirm(`Strong ride! Your best 20 minutes suggest an FTP of ${sug} W (now ${ride.ftp} W). Use it?`)) { ride.ftp = sug; store.set('pc_ftp', sug); renderPro(); } }
  showRides();
}
let saved = false;
function tcx(r) {
  const t0 = r.start, iso = s => new Date(t0 + s * 1000).toISOString();
  const pts = r.samples.map(([p, c, hr, sp, d], i) => `<Trackpoint><Time>${iso(i)}</Time><DistanceMeters>${d}</DistanceMeters>${hr ? `<HeartRateBpm><Value>${hr}</Value></HeartRateBpm>` : ''}<Cadence>${c}</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Speed>${(sp / 36).toFixed(2)}</Speed><Watts>${p}</Watts></TPX></Extensions></Trackpoint>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>${iso(0)}</Id><Lap StartTime="${iso(0)}"><TotalTimeSeconds>${r.secs}</TotalTimeSeconds><DistanceMeters>${r.dist}</DistanceMeters><Calories>${Math.round(r.kj)}</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${pts}</Track></Lap><Notes>${r.name} · PedalCraft</Notes></Activity></Activities></TrainingCenterDatabase>`;
}
function download(r) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tcx(r)], { type: 'application/vnd.garmin.tcx+xml' }));
  a.download = `PedalCraft ${new Date(r.start).toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')}.tcx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  ping('tcx-download');
}
async function showRides() {
  $('rides').classList.remove('hidden');
  const list = $('rides-list'); list.innerHTML = '<p class="note">Loading …</p>';
  const rows = await dbAll(); list.innerHTML = '';
  if (!rows.length) { list.innerHTML = '<p class="note">No saved rides yet. Ride, then press “Save this ride”.</p>'; return; }
  for (const r of rows) {
    const el = document.createElement('div'); el.className = 'rrow';
    el.innerHTML = `<div><b></b><span class="note"></span></div><button class="btn">.tcx for Strava</button><button class="btn rdel" aria-label="Delete">✕</button>`;
    el.querySelector('b').textContent = new Date(r.start).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + r.name;
    el.querySelector('.note').textContent = `${mmss(r.secs)} · ${(r.dist / 1000).toFixed(1)} km · ${r.avg} W avg · ${r.max} W max · ${r.kj} kJ`;
    el.querySelectorAll('button')[0].onclick = () => download(r);
    el.querySelector('.rdel').onclick = async () => { if (confirm('Delete this ride?')) { await dbDel(r.id); showRides(); } };
    list.appendChild(el);
  }
}
$('rides-close').onclick = () => $('rides').classList.add('hidden');

// ---------- Pro: Seitenleiste je nach Status ----------
const PRO = {
  workout: ['Workouts with ERG', 'Pick 20, 30, 45, 60 or 120 minutes: recovery, endurance, sweet spot, threshold, intervals or sprints. Your trainer holds the watts, you get cadence hints and 3-2-1 beeps.'],
  ftp: ['FTP ramp test', '10 minute warm-up, then +20 W every minute until you stop. Your FTP and all your training zones are set automatically.'],
  save: ['Save your rides', 'Keep every ride in your browser and download it for Strava (.tcx). This ride would be: '],
  rides: ['Your ride log', 'All saved rides with time, distance, watts and work, ready for Strava.'],
};
function showPro(f) {
  if (isPro()) {
    if (f === 'workout') return showPicker();
    if (f === 'ftp') { if (confirm('FTP test: about 25 to 35 minutes. Your trainer sets the watts, you just keep pedalling until you can’t. Start now?')) startWorkout(FTP_TEST); return; }
    if (f === 'save') return saveRide();
    if (f === 'rides') return showRides();
    if (f === 'ftpset') { const v = prompt('Your FTP in watts:', ride.ftp); const n = parseInt(v, 10); if (n >= 60 && n <= 600) { ride.ftp = n; store.set('pc_ftp', n); renderPro(); } return; }
  }
  if (f === 'unlock') return showUnlock();
  const [t, txt] = PRO[f] || PRO.workout;
  $('pro-title').textContent = t;
  let extra = '';
  if (f === 'save') extra = ride.elapsed > 0 ? `${Math.floor(ride.elapsed / 60)} min, ${(ride.dist / 1000).toFixed(1)} km, ${Math.round(ride.kj)} kJ.` : 'still empty, start pedalling.';
  $('pro-text').textContent = txt + extra;
  $('pro-key').classList.add('hidden'); $('pro-buy').classList.remove('hidden');
  $('pro-buy').href = BUY; $('pro-buy').textContent = 'Get PedalCraft Pro · $29 launch price'; offerOpen = false;
  $('pro').classList.remove('hidden');
  ping('pro-' + f);
}
function renderPro() {
  const on = isPro();
  $('upsell-title').textContent = on ? 'PedalCraft Pro' : 'PedalCraft Pro';
  document.querySelectorAll('.lock .ic').forEach(i => i.textContent = on ? '›' : '🔒');
  document.querySelectorAll('.lock .pro').forEach(i => i.textContent = on ? '' : 'PRO');
  $('lock-ftpset').classList.toggle('hidden', !on); $('lock-ftpset').querySelector('.t').textContent = 'FTP: ' + ride.ftp + ' W (change)';
  $('upsell-buy').classList.toggle('hidden', on); $('upsell-unlock').classList.toggle('hidden', on); $('head-buy').classList.toggle('hidden', on);
  $('upsell-note').textContent = on ? 'Rides are saved in this browser only. Download them as .tcx and upload at strava.com/upload.' : 'This free version shows your ride live. Nothing is saved, nothing leaves your browser.';
}
// Angebot nach 10 Minuten echter Fahrt: Trainer und Click funktionieren nachweislich, bester Moment fürs Angebot
let offerOpen = false;
function showRideOffer() {
  $('pro-title').textContent = 'It works with your trainer.';
  $('pro-text').textContent = "You've ridden 10 minutes. Keep every ride, train with ERG workouts and track your FTP with PedalCraft Pro: $24 with code RIDE10 instead of $39. One-time, no subscription, Mac app included.";
  $('pro-key').classList.add('hidden'); $('pro-buy').classList.remove('hidden');
  $('pro-buy').href = 'https://pedalcraftapp.gumroad.com/l/pedalcraft-mac/RIDE10'; $('pro-buy').textContent = 'Get it for $24';
  offerOpen = true;
  $('pro').classList.remove('hidden');
  ping('offer-ride10');
}
document.querySelectorAll('.lock').forEach(b => b.onclick = () => showPro(b.dataset.f));
$('pro-close').onclick = () => $('pro').classList.add('hidden');
$('pro-buy').onclick = () => { ping('buy-click'); if (offerOpen) ping('buy-ride10'); };
$('upsell-unlock').onclick = showUnlock;
// Weitersagen: teilen oder Link kopieren (zählt nur, dass geteilt wurde)
$('share').onclick = async () => {
  ping('share'); const url = 'https://pedalcraft.online/?ref=share';
  const text = 'Ride your smart trainer and shift with a Zwift Click, free in the browser, no Zwift subscription:';
  try { if (navigator.share) { await navigator.share({ title: 'PedalCraft', text, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copied. Paste it wherever your riding friends are.', 4000); } catch (e) { toast(url, 8000); }
};
$('pro-key-in').onkeydown = e => { if (e.key === 'Enter') $('pro-key-go').click(); };
renderPro();
if (location.hostname === 'localhost') window.__pc = { samples, saveRide, tcx, dbAll, ride, startWorkout, FTP_TEST, get wo() { return wo; } };   // nur zum Testen
// Nach 10 und 30 Minuten echter Fahrt freundlich daran erinnern, dass die Fahrt nicht gespeichert wird
let nudged = new Set();
setInterval(() => {
  // Anonyme Fahrdauer-Stufen (nur echte Fahrten): zeigt, wie lange Leute wirklich trainieren
  for (const m of [1, 3, 5, 10, 20, 30, 60]) if (!ride.demo && ride.elapsed >= m * 60) ping('ride-' + m + 'm');
  if (!ride.demo && !EMBED && !isPro() && ride.elapsed >= 600 && !nudged.has(10)) { nudged.add(10); showRideOffer(); }
  if (!ride.demo && !isPro() && ride.elapsed >= 1800 && !nudged.has(30)) { nudged.add(30); toast("30 minutes in. This ride won't be saved here; code RIDE10 gets you the Mac app for $24.", 8000); }
}, 5000);

// ---------- Wire up ----------
$('up').onclick = () => shift(true); $('down').onclick = () => shift(false);
$('gplus').onclick = () => changeGrade(0.5); $('gminus').onclick = () => changeGrade(-0.5);
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter' && document.activeElement === $('pro-key-in')) return;
  if (e.key === 'ArrowUp') { shift(true); e.preventDefault(); } else if (e.key === 'ArrowDown') { shift(false); e.preventDefault(); }
  else if (e.key === 'ArrowRight') changeGrade(0.5); else if (e.key === 'ArrowLeft') changeGrade(-0.5);
});
const hasBT = !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
const needBT = fn => safe(async () => { ping('connect-tap'); if (!hasBT) { $('welcome').classList.remove('hidden'); return; } await fn(); });
$('c-trainer').onclick = needBT(connectTrainer);
$('c-ctrl').onclick = needBT(connectController);
$('c-hr').onclick = needBT(connectHR);
const closeWelcome = () => $('welcome').classList.add('hidden');
$('start').onclick = needBT(async () => { closeWelcome(); await connectTrainer(); });
$('demo').onclick = () => { closeWelcome(); startDemo(); };
$('close').onclick = closeWelcome;
if (!hasBT) {
  $('nobt').classList.remove('hidden'); $('start').classList.add('hidden'); $('nobt-actions').classList.remove('hidden'); $('nobt-sub').classList.remove('hidden');
  $('sendlink').onclick = async () => {
    ping('send-link'); const url = 'https://pedalcraft.online/ride/';
    try { if (navigator.share) { await navigator.share({ title: 'PedalCraft', text: 'Ride my trainer in Chrome:', url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it into Chrome on your computer.', 4000); } catch (e) { toast(url, 8000); }
  };
  $('nobt-buy').onclick = () => ping('buy-click');
  // iPhone/iPad: Web Bluetooth gibt es dort nur in Browser-Apps wie Bluefy
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) {
    $('ios-bluefy').classList.remove('hidden'); $('nobt').classList.add('hidden');
    $('sendlink').classList.remove('primary');
    $('bluefy-get').onclick = () => ping('bluefy-get');
    $('bluefy-copy').onclick = async () => { ping('bluefy-copy'); try { await navigator.clipboard.writeText('https://pedalcraft.online/ride/'); toast('Copied. Open Bluefy and paste it into the address bar.', 5000); } catch (e) { toast('pedalcraft.online/ride', 8000); } };
  }
}
if (/Bluefy/i.test(navigator.userAgent)) ping('bluefy-open');
window.addEventListener('beforeunload', e => { if (ride.elapsed > 60 && !ride.demo && !saved) { e.preventDefault(); e.returnValue = ''; } });
ping('visit');
if (!hasBT) ping(/iPhone|iPad/.test(navigator.userAgent) ? 'nobt-ios' : 'nobt');
if (EMBED) {
  // Embedded on the home page: links and connect buttons open the real app in the main window.
  document.body.classList.add('embed');
  document.querySelectorAll('a[href]').forEach(a => a.target = '_top');
  for (const id of ['c-trainer', 'c-ctrl', 'c-hr']) $(id).onclick = () => { window.top.location.href = '/ride/'; };
  window.addEventListener('message', e => { if (e.origin === location.origin && e.data && 'shift' in e.data) shift(e.data.shift > 0); });
  closeWelcome(); startDemo();
} else if (new URLSearchParams(location.search).has('demo')) { closeWelcome(); startDemo(); }
render();
requestAnimationFrame(frame);
