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
  if (power != null) { ride.power = Math.max(0, power); ride.t.power = now; }
  if (cadence != null) { ride.cadence = Math.max(0, Math.round(cadence)); ride.t.cadence = now; }
  if (speed != null) { ride.speed = Math.max(0, speed); ride.t.speed = now; }
  if (hr) { ride.hr = hr; ride.t.hr = now; }
}

function shift(up) {
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
      this.keepAlive = setInterval(() => this.zwiftReady && this.write(MSG.sim(Math.round(ride.grade * 100), false)), 5000);
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
  applyGear() { if (this.zwiftReady) this.write(MSG.gear(Math.round(GEARS[ride.gear] * 10000))); else this.sendSim(); }
  applyGrade() { if (this.zwiftReady) this.write(MSG.sim(Math.round(ride.grade * 100), false)); else this.sendSim(); }
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
function ping(ev) {
  if (EMBED || pinged.has(ev) || location.hostname === 'localhost') return; pinged.add(ev);
  fetch('https://abacus.jasoncameron.dev/hit/pedalcraft-online/' + ev, { mode: 'no-cors', keepalive: true }).catch(() => {});
}

// ---------- Demo ----------
let demoTimer = null;
function startDemo() {
  ride.demo = true; let t = 0;
  setChip('c-trainer', true, 'Demo trainer');
  demoTimer = setInterval(() => {
    t += 0.25;
    const base = 120 + ride.gear * 6 + ride.grade * 12;
    const surge = (Math.floor(t / 20) % 3 === 2) ? 90 : 0;
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

// ---------- Pro features (shown locked in the free version) ----------
const PRO = {
  workout: ['Workouts with ERG', 'Pick 20, 30, 45, 60 or 120 minutes: recovery, endurance, sweet spot, threshold, intervals or sprints. Your trainer holds the watts, you get cadence hints and 3-2-1 beeps.'],
  ftp: ['FTP ramp test', '10 minute warm-up, then +20 W every minute until you stop. Your FTP and all your training zones are set automatically.'],
  save: ['Save your rides', 'Every ride is saved with a summary image, your rating and an FTP suggestion when you got stronger. This ride would be: ' ],
  strava: ['Strava upload', 'Every saved ride goes to Strava automatically, with watts, heart rate and cadence.'],
  mini: ['Mini window', 'A small floating window with your numbers on top of Netflix or YouTube, even in full screen.'],
};
function showPro(f) {
  const [t, txt] = PRO[f];
  $('pro-title').textContent = t;
  let extra = '';
  if (f === 'save') extra = ride.elapsed > 0 ? `${Math.floor(ride.elapsed / 60)} min, ${(ride.dist / 1000).toFixed(1)} km, ${Math.round(ride.kj)} kJ.` : 'still empty, start pedalling.';
  $('pro-text').textContent = txt + extra;
  $('pro').classList.remove('hidden');
  ping('pro-' + f);
}
document.querySelectorAll('.lock').forEach(b => b.onclick = () => showPro(b.dataset.f));
$('pro-close').onclick = () => $('pro').classList.add('hidden');
$('pro-buy').onclick = () => ping('buy-click');
// Nach 10 und 30 Minuten echter Fahrt freundlich daran erinnern, dass die Fahrt nicht gespeichert wird
let nudged = new Set();
setInterval(() => {
  for (const m of [10, 30]) if (!ride.demo && ride.elapsed >= m * 60 && !nudged.has(m)) { nudged.add(m); toast(`${m} minutes in. This ride won't be saved here; the Mac app keeps every ride.`, 7000); }
}, 5000);

// ---------- Wire up ----------
$('up').onclick = () => shift(true); $('down').onclick = () => shift(false);
$('gplus').onclick = () => changeGrade(0.5); $('gminus').onclick = () => changeGrade(-0.5);
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
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
  $('nobt').classList.remove('hidden'); $('start').classList.add('hidden'); $('nobt-actions').classList.remove('hidden');
  $('sendlink').onclick = async () => {
    ping('send-link'); const url = 'https://pedalcraft.online/ride/';
    try { if (navigator.share) { await navigator.share({ title: 'PedalCraft', text: 'Ride my trainer in Chrome:', url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it into Chrome on your computer.', 4000); } catch (e) { toast(url, 8000); }
  };
  $('nobt-buy').onclick = () => ping('buy-click');
}
window.addEventListener('beforeunload', e => { if (ride.elapsed > 60 && !ride.demo) { e.preventDefault(); e.returnValue = ''; } });
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
