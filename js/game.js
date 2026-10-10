(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let GOAL = 9000;
const R = 17, L = 62, GRAV = 900, ACC = 560, MAXV = 620, NOSACC = 900, NOSMAX = 880;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/* ---------- ukuran layar (responsif) ---------- */
let W, H, S, dpr;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  S = Math.min(H / 600, W / 720); // skala dunia -> layar
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 150));
resize();

/* ---------- level & medan ---------- */
const LEVELS = [
  { name: 'Pantai', goal: 7000, amp: 1.0, ph: 0, gap: 700, obs: ['bush'], drag: .25, deco: 'palm', far: 'sea',
    sky: ['#6fbdee', '#cfe9f5'], sun: '#ffd35c', farC: ['#2f9fd8', '#5fc4e8'], sand: ['#e8b866', '#d49a46', '#c98a36'], pit: '#2f9fd8',
    g3d: { rim: '#fff3c4', top: '#f4cf85', mid: '#e2a955', soil: ['#d99a4a', '#a8692a'] } },
  { name: 'Gurun', goal: 8000, amp: 1.1, ph: 2, gap: 650, obs: ['cactus', 'rock', 'cactus', 'cactus', 'rock'], drag: .25, deco: 'cactus', far: 'dune',
    sky: ['#f6a95c', '#fde3b0'], sun: '#fff1c2', farC: ['#e6a766', '#d98f4e'], sand: ['#e9a24e', '#cf8638', '#b86f2c'], pit: '#8a4b1f',
    g3d: { rim: '#ffe0a0', top: '#f0b45c', mid: '#d98a3a', soil: ['#c97a32', '#8a4b1f'] } },
  { name: 'Salju', goal: 8500, amp: 1.15, ph: 4, gap: 650, obs: ['ice', 'hole', 'ice', 'hole'], drag: .06, brake: 450, deco: 'pine', far: 'peak', snow: 1,
    sky: ['#9db7d6', '#e8f1fa'], sun: '#ffffff', farC: ['#cfe0f0', '#8fa6c4'], sand: ['#f2f7fb', '#c7dcee', '#a9c6e0'], pit: '#2b4a73',
    g3d: { rim: '#ffffff', top: '#eaf4fb', mid: '#c4dcee', soil: ['#8fb0cf', '#5f7fa6'] } },
  { name: 'Gunung Api', goal: 9500, amp: 1.3, ph: 1, gap: 600, obs: ['ember', 'hole', 'rock', 'hole', 'ember'], drag: .25, deco: 'dead', far: 'peak', ash: 1,
    sky: ['#3a1c1c', '#d0552b'], sun: '#ffb347', farC: ['#c2411c', '#2a1414'], sand: ['#5a3a32', '#3e2622', '#2a1816'], pit: '#ff5a1f',
    g3d: { rim: '#ff9a4a', top: '#7a4b3c', mid: '#4a2e28', soil: ['#3a2220', '#1d0f0e'] } },
  { name: 'Bukit Hijau', goal: 9000, amp: 1.2, ph: 3, gap: 620, obs: ['bush', 'rock', 'hole', 'bush'], drag: .25, deco: 'none', far: 'peak',
    sky: ['#4fd3f7', '#c8f7ff'], sun: '#fffbd0', farC: ['#aeeaf7', '#c9f4fb'], sand: ['#6fd62a', '#3fb30e', '#2a8a08'], pit: '#3a2a1a',
    g3d: { rim: '#d9ff4a', top: '#7be31b', mid: '#46b80f', soil: ['#7a4a2a', '#4a2a14'] } }
];
const OB = { bush: { hw: 34, ch: 18 }, cactus: { hw: 24, ch: 26 }, rock: { hw: 30, ch: 30 }, ice: { hw: 34, ch: 22 }, ember: { hw: 34, ch: 20 }, hole: { hw: 55, ch: 0 } };
let lv, level = 0, obs = [], holes = [], coins = [];
const amp = x => Math.min(lv.amp, Math.max(0, (x - 300) / 1500));
// Rampa lompat: naik 100 unit lalu terputus, tepat sebelum tiap rintangan
const ramp = x => { for (const o of obs) { const e = o.x - o.hw - 16, a = e - 320; if (x > a && x < e) { const t = (x - a) / (e - a); return 100 * t * t; } } return 0; };
const g0 = x => 420 + (55 * Math.sin(x * .004 + lv.ph) + 28 * Math.sin(x * .011 + 1 + lv.ph) + 40 * Math.sin(x * .0023 + 3 + lv.ph)) * amp(x) - ramp(x);
const gy = x => { for (const o of holes) if (x > o.x0 && x < o.x1) return o.dy; return g0(x); };
const inHole = x => holes.some(o => x > o.x0 - 30 && x < o.x1 + 30);
const slopeAt = x => Math.atan2(g0(x + 4) - g0(x - 4), 8);
function loadLevel(n) {
  level = n; lv = LEVELS[n]; GOAL = lv.goal; obs = []; holes = [];
  for (let i = 0; 1300 + i * lv.gap < GOAL - 400; i++) { const t = lv.obs[i % lv.obs.length]; obs.push(Object.assign({ t, x: 1300 + i * lv.gap + (i * 137) % 160 }, OB[t])); }
  holes = obs.filter(o => o.t === 'hole'); holes.forEach(o => { o.x0 = o.x - o.hw; o.x1 = o.x + o.hw; o.dy = g0(o.x0) + 240; });
  coins = obs.flatMap(o => [0, 1, 2, 3, 4].map(i => ({ x: o.x + (o.t === 'hole' ? -60 : -30) + i * 30, y: g0(o.x) - 120 - 30 * Math.sin(Math.PI * i / 4), got: 0 })));
}
loadLevel(0);

/* ---------- state ---------- */
const K = { gas: 0, brake: 0, fwd: 0, back: 0, nos: 0 };
let b, state = 'menu', t0 = 0, time = 0, camX = 0, camY = 0, parts = [], endTimer = 0;
let nextBtn = '', runScore = 0, nextN = 0, unlocked = 0, bestScore = 0, bonus = 0, nitro = 60, airRot = 0, wheelT = 0, maxX = 120, passed = [];
try { bestScore = +localStorage.getItem('motoBeachScore') || 0; unlocked = Math.min(LEVELS.length - 1, +localStorage.getItem('motoBeachUnlock') || 0); } catch (e) {}
const total = () => Math.floor(Math.max(0, maxX - 120) / 10) + bonus;
function saveBest() { const t = runScore + total(); if (t > bestScore) { bestScore = t; try { localStorage.setItem('motoBeachScore', t); } catch (e) {} } }
function pop(t) { const d = document.createElement('div'); d.textContent = t; $('pop').appendChild(d); setTimeout(() => d.remove(), 1100); }

function newBike() { return { x: 120, y: gy(120) - R - 2, vx: 0, vy: 0, a: 0, av: 0, g: true, wr: 0 }; }
function start(n) {
  loadLevel(n); b = newBike(); parts = []; state = 'play'; t0 = performance.now(); time = 0;
  bonus = 0; nitro = 60; airRot = 0; wheelT = 0; maxX = 120; passed = []; coins.forEach(c => c.got = 0);
  $('overlay').classList.remove('show'); Sfx.init();
  $('lvname').textContent = 'Level ' + (n + 1) + ' · ' + lv.name; pop('LEVEL ' + (n + 1) + ' · ' + lv.name.toUpperCase());
}
b = newBike();

function crash() {
  if (state !== 'play') return;
  state = 'crash'; endTimer = .9; Sfx.crash(); Sfx.stopEngine(); saveBest();
  for (let i = 0; i < 20; i++) parts.push({ x: b.x, y: b.y - 20, vx: (Math.random() - .3) * 300 + b.vx * .4,
    vy: -Math.random() * 350, life: 1, c: ['#f0541e', '#2a2118', '#7ed321', '#f4efe6'][i % 4] });
}
function finish() {
  state = 'done'; Sfx.stopEngine(); Sfx.win();
  const tb = Math.max(0, Math.round((120 - time) * 10)); bonus += tb; saveBest();
  runScore += total(); bonus = 0; maxX = 120;
  if (level < LEVELS.length - 1) {
    unlocked = Math.max(unlocked, level + 1); try { localStorage.setItem('motoBeachUnlock', unlocked); } catch (e) {}
    nextN = level + 1;
    showOverlay('Level ' + (level + 1) + ' selesai! 🏁', 'Skor ' + runScore + ' (bonus waktu +' + tb + ')', 'Level berikutnya ▶');
  } else {
    nextN = 0; const fin = runScore; runScore = 0;
    showOverlay('TAMAT! 🏆', 'Semua level selesai. Total skor ' + fin, 'Main dari awal');
  }
}
function renderLevels() {
  const box = $('levels'); box.innerHTML = '';
  LEVELS.forEach((l, i) => {
    const bt = document.createElement('button'); bt.textContent = i <= unlocked ? (i + 1) + '. ' + l.name : '🔒 ' + (i + 1);
    bt.disabled = i > unlocked; bt.onclick = () => { runScore = 0; start(i); }; box.appendChild(bt);
  });
}
function showOverlay(title, msg, btn) {
  $('msg').textContent = title + ' ' + msg;
  $('best').textContent = bestScore ? 'Skor terbaik: ' + bestScore : '';
  $('play').textContent = btn; nextBtn = btn; renderLevels(); $('overlay').classList.add('show');
}

let style = '3d';
try { style = localStorage.getItem('motoStyle') || '3d'; } catch (e) {}

/* ---------- update ---------- */
function update(dt) {
  const dead = state === 'crash';
  const lean = dead ? 0 : (K.fwd ? 1 : 0) - (K.back ? 1 : 0);
  if (state === 'play') time = (performance.now() - t0) / 1000;
  const nosOn = !dead && K.nos && nitro > 0;
  if (nosOn) nitro = Math.max(0, nitro - 35 * dt); else if (!dead) nitro = Math.min(100, nitro + 4 * dt);

  b.vy += GRAV * dt;
  if (b.g) {
    const sl = slopeAt(b.x), tx = Math.cos(sl), ty = Math.sin(sl);
    let v = b.vx * tx + b.vy * ty;
    if (!dead && v < (nosOn ? NOSMAX : MAXV)) v += ((K.gas ? ACC : 0) + (nosOn ? NOSACC : 0)) * dt;
    if (!dead && K.brake) v = v > 0 ? Math.max(0, v - (lv.brake || 800) * dt) : Math.max(-120, v - 300 * dt);
    v *= 1 - (dead ? 3 : lv.drag) * dt;
    v = clamp(v, -150, NOSMAX);
    b.vx = v * tx; b.vy = v * ty; b.wr += v / R * dt;
  } else {
    if (nosOn) { b.vx += 400 * dt * Math.cos(b.a); b.vy += 400 * dt * Math.sin(b.a); }
    b.av = clamp((b.av + lean * 13 * dt) * (1 - .6 * dt), -7, 7);
    b.a += b.av * dt; airRot += b.av * dt; b.wr += b.vx / R * dt * .5;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < 60) { b.x = 60; b.vx = Math.max(0, b.vx); }

  const c = Math.cos(b.a), s = Math.sin(b.a), hl = L / 2;
  const rx = b.x - c * hl, ry = b.y - s * hl, fx = b.x + c * hl, fy = b.y + s * hl;
  const pen = Math.max(ry + R - gy(rx), fy + R - gy(fx));
  if (pen > 0) b.y -= pen;
  if (pen > -3) {
    const sl = Math.atan2(g0(fx) - g0(rx), fx - rx), tx = Math.cos(sl), ty = Math.sin(sl);
    const away = b.vx * ty - b.vy * tx;
    if (away <= 40) {
      if (pen <= 0) b.y -= pen;
      if (!b.g && !dead) {
        if (Math.abs(angDiff(b.a, sl)) > 1.05) crash();
        else { Sfx.land(); const fl = Math.floor(Math.abs(airRot) / 5.9);
          if (fl) { bonus += 300 * fl; nitro = Math.min(100, nitro + 20 * fl); pop('SALTO x' + fl + '  +' + 300 * fl); } }
      }
      const v = b.vx * tx + b.vy * ty;
      b.vx = v * tx; b.vy = v * ty; b.g = true;
      if (dead) { b.av = b.vx * .02; b.a += b.av * dt; }
      else {
        b.a += angDiff(sl + lean * .35, b.a) * Math.min(1, 10 * dt); b.av = 0; airRot = 0;
        if (lean < 0 && v > 150) { wheelT += dt; if (wheelT >= 1) { wheelT = 0; bonus += 100; pop('WHEELIE  +100'); } } else wheelT = 0;
      }
    } else b.g = false;
  } else b.g = false;
  if (dead) b.a += b.av * dt;

  if (!dead && state === 'play') {
    const hxL = style === '3d' ? -4 : 8, hyL = style === '3d' ? -66 : -58;   // posisi helm di bingkai motor
    const hx = b.x + hxL * c - hyL * s, hy = b.y + hxL * s + hyL * c;
    if (hy + 9 > gy(hx)) crash();
    if (nosOn) for (let k = 0; k < 2; k++) parts.push({ x: rx - 6 * c, y: ry - 6 * s - 6, vx: -260 * c + b.vx * .3 + (Math.random() - .5) * 60,
      vy: -260 * s + (Math.random() - .5) * 60, life: .5, c: k ? '#ffd35c' : '#f0541e', f: 1 });
    maxX = Math.max(maxX, b.x);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (!passed[i] && b.x > o.x + 80) { passed[i] = 1; bonus += 500; nitro = Math.min(100, nitro + 25); pop('LEWAT RINTANGAN!  +500'); }
      if (Math.abs(o.x - b.x) > 130) continue;
      if (o.t === 'hole') { if (b.x > o.x0 - 6 && b.x < o.x1 + 6 && b.y > o.dy - 210) crash(); continue; }
      for (const wx of [rx, fx]) {
        const wy = wx === rx ? ry : fy;
        if (Math.abs(wx - o.x) < o.hw && wy + R > gy(o.x) - o.ch) crash();
      }
    }
    for (const k of coins) {
      if (k.got || Math.abs(k.x - b.x) > 40) continue;
      if (Math.hypot(k.x - b.x, k.y - b.y) < 34) { k.got = 1; bonus += 100; nitro = Math.min(100, nitro + 15); Sfx.coin(); }
    }
    if (b.x >= GOAL) finish();
    Sfx.engine(Math.abs(b.vx) / MAXV, K.gas, nosOn);
  }
  if (dead) { endTimer -= dt; if (endTimer <= 0) { state = 'over'; nextN = level; showOverlay('Jatuh!', 'Skor ' + (runScore + total()) + '. Coba lagi, jaga posisi motor saat mendarat.', 'Ulangi'); } }

  parts.forEach(p => { if (!p.f) p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * (p.f ? 2.2 : .8); });
  parts = parts.filter(p => p.life > 0);

  $('time').textContent = time.toFixed(1);
  $('score').textContent = runScore + total(); $('nosbar').style.width = nitro + '%';
  $('prog').style.width = clamp((b.x - 120) / (GOAL - 120) * 100, 0, 100) + '%';
}

/* ---------- gambar ---------- */
function palm(x, y, sc, f) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * f, sc);
  ctx.strokeStyle = '#8a6a55'; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(22, -60, 10, -130); ctx.stroke();
  ctx.translate(10, -130);
  for (let k = 0; k < 7; k++) {
    ctx.save(); ctx.rotate(-Math.PI + k * (Math.PI / 6) - .15);
    ctx.fillStyle = k % 2 ? '#2f8f3a' : '#3fae48';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40, -34, 88, 18); ctx.quadraticCurveTo(44, -4, 0, 0); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function umbrella(x, y, col) {
  ctx.strokeStyle = '#6b5a4a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 52); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 52, 30, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.arc(x, y - 52, 30, Math.PI * 1.35, Math.PI * 1.65); ctx.lineTo(x, y - 52); ctx.fill();
}
function part(fn, fill, w) {   // bentuk bergaya kartun: garis putih tebal + garis tipis gelap
  ctx.beginPath(); fn(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = w || 5; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = '#3a1d10'; ctx.lineWidth = 1.2; ctx.stroke();
}
const poly = (pts, fill, w) => part(() => { pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); }, fill, w);
function limb(pts, col, w) {
  ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = w + 5; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function wheel(x, y, rot) {
  const r = 17;
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = '#1e1b19'; ctx.fill();
  ctx.setLineDash([4, 3]); ctx.lineDashOffset = -rot * r; ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 3.5;   // ban bergerigi tebal
  ctx.beginPath(); ctx.arc(x, y, r - 1.8, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, r - 6.5, 0, 7); ctx.fillStyle = '#f6efd6'; ctx.fill(); ctx.strokeStyle = '#7d7358'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 6.5), y + Math.sin(a) * (r - 6.5)); }
  ctx.strokeStyle = '#a89c78'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 7.5, 0, 7); ctx.strokeStyle = '#b9bec4'; ctx.lineWidth = 1.6; ctx.stroke();    // cakram rem
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = '#8f959b'; ctx.fill();
}
function drawBikeCartoon() {
  const K = R / 17, hl = L / 2, O = '#f0541e', O2 = '#c93a10', G = '#7ed321', D = '#2a2118', S1 = '#c9ced3';
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(K, K);
  wheel(-hl, 0, b.wr); wheel(hl, 0, b.wr);
  ctx.beginPath(); ctx.arc(hl, 0, 22, -2.5, -.55); ctx.lineCap = 'round';                                  // spakbor depan
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = O; ctx.lineWidth = 5.5; ctx.stroke();
  limb([[-hl, 0], [-4, -8]], '#55504a', 5);                           // swing arm
  limb([[-18, -4], [-10, -22]], O2, 5);                               // peredam belakang
  limb([[-4, -9], [-36, -13]], S1, 4);                                // knalpot
  poly([[-12, -18], [8, -18], [10, -4], [-12, -2]], '#b8bec5');        // mesin
  part(() => ctx.arc(-1, -10, 4, 0, 7), '#8f959b', 3);
  poly([[-40, -22], [-26, -27], [-6, -27], [-3, -15], [-22, -13], [-34, -14]], O);   // ekor
  limb([[-30, -26], [-8, -29]], D, 5);                                // jok
  poly([[-8, -26], [12, -32], [24, -24], [18, -12], [4, -14]], O);     // tangki
  limb([[hl, 0], [14, -30]], S1, 6);                                  // garpu tebal
  limb([[14, -30], [6, -37], [1, -37]], D, 4);                        // stang
  poly([[22, -41], [31, -38], [31, -30], [23, -32]], '#fff');          // pelat nomor
  limb([[-10, -26], [8, -22], [3, -6]], O, 9);                        // kaki
  part(() => ctx.ellipse(8, -22, 5, 4, 0, 0, 7), G, 3);               // lutut
  poly([[-4, -11], [10, -11], [13, 0], [-4, 0]], G, 5);                // sepatu besar
  limb([[-10, -26], [3, -46]], O, 14);                                // badan condong ke depan
  limb([[1, -47], [14, -41], [5, -35]], O, 7);                        // lengan
  part(() => ctx.arc(5, -35, 5, 0, 7), G, 3);                         // sarung tangan
  part(() => ctx.arc(8, -58, 14, 0, 7), O, 5);                        // helm besar
  ctx.beginPath(); ctx.arc(8, -58, 11, -2.8, -1.3); ctx.strokeStyle = G; ctx.lineWidth = 3.5; ctx.stroke();
  part(() => ctx.ellipse(16, -56, 9, 7, 0, 0, 7), '#2f8fe0', 3);      // visor besar
  ctx.beginPath(); ctx.ellipse(19, -58, 3, 1.8, 0, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  ctx.restore();
}
function tube(pts, col, w, hi) {
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  path(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  ctx.save(); ctx.translate(-w * .14, -w * .14); path(); ctx.strokeStyle = hi || 'rgba(255,255,255,.35)'; ctx.lineWidth = w * .4; ctx.stroke(); ctx.restore();
}
function shade(pts, c0, c1) {
  const ys = pts.map(p => p[1]), g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys)); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); ctx.lineJoin = 'round'; ctx.fillStyle = g; ctx.fill();
}
/* Motor + pengendara gaya 3D berbayang. Digambar langsung dalam koordinat gambar referensi (1920x1080),
   lalu ditransformasi ke bingkai motor: roda belakang/depan = RW/FW. */
const RW = [990, 800], FW = [1492, 430], MX = 1241, MY = 615, TH = Math.atan2(-370, 502);
function wheelRef(c, rot) {
  const x = c[0], y = c[1];
  const g = ctx.createRadialGradient(x, y, 110, x, y, 172); g.addColorStop(0, '#5a5d68'); g.addColorStop(1, '#383b44');
  ctx.beginPath(); ctx.arc(x, y, 172, 0, 7); ctx.moveTo(x + 112, y); ctx.arc(x, y, 112, 0, 7, true); ctx.fillStyle = g; ctx.fill('evenodd');   // ban (tengah tembus)
  ctx.setLineDash([24, 17]); ctx.lineDashOffset = -rot * 172; ctx.beginPath(); ctx.arc(x, y, 164, 0, 7);
  ctx.strokeStyle = 'rgba(20,21,27,.3)'; ctx.lineWidth = 16; ctx.stroke(); ctx.setLineDash([]);                                          // gerigi
  ctx.beginPath(); ctx.arc(x, y, 111, 0, 7); ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 8; ctx.stroke();                                   // pelek oranye
  ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = rot + i * Math.PI / 6;
    ctx.moveTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50); ctx.lineTo(x + Math.cos(a + .08) * 84, y + Math.sin(a + .08) * 84);
    ctx.lineTo(x + Math.cos(a - .04) * 108, y + Math.sin(a - .04) * 108); ctx.moveTo(x + Math.cos(a + .08) * 84, y + Math.sin(a + .08) * 84);
    ctx.lineTo(x + Math.cos(a + .22) * 108, y + Math.sin(a + .22) * 108); }
  ctx.lineCap = 'round'; ctx.strokeStyle = '#16161e'; ctx.lineWidth = 7; ctx.stroke();
  const h = ctx.createRadialGradient(x - 12, y - 12, 4, x, y, 50); h.addColorStop(0, '#cf94ee'); h.addColorStop(1, '#8a45b8');
  ctx.beginPath(); ctx.arc(x, y, 48, 0, 7); ctx.fillStyle = h; ctx.fill();
}
function bikeArt() {
  const O = '#ff7a14', P = '#b76fd1', B = '#2f4fbf', W = '#eaf1ff', N = 'rgba(0,0,0,0)';
  wheelRef(RW, b.wr); wheelRef(FW, b.wr);
  tube([[660, 655], [920, 582]], '#15151c', 5, N);                                                        // ekor tipis
  tube([[1135, 668], [995, 800]], P, 46);                                                                 // swing arm ungu
  tube([[885, 624], [1125, 652]], P, 54);                                                                 // dudukan ungu
  shade([[1195, 400], [1245, 382], [1262, 420], [1292, 560], [1268, 622], [1210, 640], [1150, 610], [1170, 520]], '#5a5e6c', '#3a3d49'); // panel gelap
  tube([[1262, 480], [1188, 598]], P, 14, N);
  shade([[915, 580], [1072, 548], [1150, 665], [990, 640]], '#ff8f2c', '#f2640c');                         // baji oranye
  tube([[1215, 312], [1124, 540]], O, 48);                                                                // tabung rangka
  tube([[1255, 312], [1350, 360]], '#4a4d59', 10, N);                                                     // batang garpu
  tube([[1350, 368], [1500, 448]], O, 54);                                                                // garpu oranye
  shade([[1180, 288], [1236, 268], [1258, 306], [1206, 328]], '#ff9a2a', '#f0600a');                      // klem
  tube([[1160, 264], [1200, 252]], '#8d93a3', 14);                                                        // stang
  tube([[868, 432], [990, 488]], B, 92, 'rgba(255,255,255,.16)'); tube([[990, 488], [1105, 578]], B, 62, 'rgba(255,255,255,.16)');                         // kaki biru
  tube([[872, 428], [1040, 497]], W, 22, N);                                                              // garis putih paha
  shade([[1085, 592], [1135, 562], [1190, 610], [1256, 616], [1250, 652], [1196, 692], [1150, 690], [1100, 652]], '#ffffff', '#cfd5e2'); // sepatu
  shade([[1085, 586], [1138, 560], [1162, 598], [1108, 626]], '#2a2a36', '#14141c');
  tube([[1160, 640], [1235, 640]], '#14141c', 10, N);
  const tg = ctx.createLinearGradient(770, 0, 930, 0); tg.addColorStop(0, '#2a46b8'); tg.addColorStop(1, '#3d62d4');
  ctx.beginPath(); ctx.moveTo(772, 235); ctx.bezierCurveTo(768, 320, 790, 400, 850, 452); ctx.lineTo(910, 432);
  ctx.bezierCurveTo(928, 360, 892, 300, 926, 228); ctx.bezierCurveTo(905, 188, 840, 172, 790, 196); ctx.closePath();
  ctx.fillStyle = tg; ctx.fill();                                                                                  // badan
  tube([[798, 228], [832, 322], [884, 392]], W, 44, N);                                                   // garis putih badan
  tube([[838, 214], [1118, 247]], B, 42, 'rgba(255,255,255,.16)');                                                                 // lengan
  tube([[945, 222], [956, 264]], W, 20, N);                                                               // manset
  ctx.beginPath(); ctx.arc(1132, 246, 26, 0, 7); ctx.fillStyle = '#14141c'; ctx.fill();                   // sarung tangan
  tube([[1160, 262], [1188, 254]], '#8d93a3', 12, N);
  shade([[782, 160], [828, 160], [830, 190], [784, 188]], '#2a2a36', '#14141c');                          // leher
  const g = ctx.createLinearGradient(0, 30, 0, 180); g.addColorStop(0, '#46c8f8'); g.addColorStop(1, '#3a62d0');
  ctx.beginPath(); ctx.ellipse(808, 102, 88, 76, -.15, 0, 7); ctx.fillStyle = g; ctx.fill();                      // helm
  ctx.save(); ctx.clip();
  tube([[700, 140], [900, 112]], '#14182e', 22, N);                                                               // pita visor
  ctx.beginPath(); ctx.ellipse(872, 98, 27, 27, -.3, 0, 7); ctx.fillStyle = '#1a1f3a'; ctx.fill();                  // kaca wajah
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(856, 86, 14, 9, -.5, 0, 7); ctx.fillStyle = '#ffb13a'; ctx.fill();                  // kilau goggle
  shade([[868, 122], [898, 118], [902, 152], [872, 162]], '#4a6fd0', '#2a3a78');                                   // dagu helm
  shade([[786, 82], [842, 10], [834, 98]], '#2a2a36', '#0f0f16');                                                  // sirip helm
}
function drawBike3D() {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); const k = R / 172; ctx.scale(k, k); ctx.rotate(-TH); ctx.translate(-MX, -MY);
  bikeArt(); ctx.restore();
}
function drawBike() { if (style === '3d') drawBike3D(); else drawBikeCartoon(); }
function cactus(x, y, k) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.strokeStyle = '#3f8f45'; ctx.lineCap = 'round'; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -80); ctx.stroke(); ctx.lineWidth = 10; ctx.beginPath();
  ctx.moveTo(0, -30); ctx.lineTo(-22, -30); ctx.lineTo(-22, -55); ctx.moveTo(0, -45); ctx.lineTo(22, -45); ctx.lineTo(22, -68); ctx.stroke(); ctx.restore(); }
function pine(x, y, k) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = '#6b4a32'; ctx.fillRect(-5, -20, 10, 22);
  for (let i = 0; i < 3; i++) { const w = 44 - i * 10, yy = -20 - i * 34;
    ctx.fillStyle = '#2f6b4a'; ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 52); ctx.lineTo(w, yy); ctx.fill();
    ctx.fillStyle = '#f4f9fd'; ctx.beginPath(); ctx.moveTo(-w * .5, yy - 26); ctx.lineTo(0, yy - 52); ctx.lineTo(w * .5, yy - 26); ctx.fill(); } ctx.restore(); }
function deadTree(x, y, k) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.strokeStyle = '#1c0f0f'; ctx.lineCap = 'round'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -70); ctx.moveTo(4, -45); ctx.lineTo(30, -75); ctx.moveTo(2, -58); ctx.lineTo(-24, -90); ctx.stroke(); ctx.restore(); }
function decor(px, i) {
  if (lv.deco === 'none') return;
  const k = .9 + (i % 3) * .1, y = gy(px) + 4, y2 = gy(px + 260) + 2;
  if (lv.deco === 'palm') { palm(px, y, k, i % 2 ? 1 : -1); umbrella(px + 260, y2, i % 2 ? '#ffc800' : '#2f9fd8'); }
  else if (lv.deco === 'cactus') { cactus(px, y, k); cactus(px + 260, y2, .6); }
  else if (lv.deco === 'pine') { pine(px, y, k); pine(px + 260, y2, .7); }
  else { deadTree(px, y, k); deadTree(px + 260, y2, .7); }
}
function drawObs(o) {
  const y = gy(o.x);
  if (o.t === 'hole') { ctx.fillStyle = lv.pit; ctx.fillRect(o.x0, o.dy - 26, o.x1 - o.x0, 60); return; }
  if (o.t === 'cactus') { cactus(o.x - 12, y + 2, .5); cactus(o.x + 12, y + 2, .42); return; }
  if (o.t === 'rock') { ctx.fillStyle = '#7a6a5a'; ctx.beginPath(); ctx.moveTo(o.x - 34, y + 4); ctx.lineTo(o.x - 22, y - 26); ctx.lineTo(o.x + 4, y - 38);
    ctx.lineTo(o.x + 30, y - 24); ctx.lineTo(o.x + 36, y + 4); ctx.fill(); ctx.fillStyle = '#9a8a78'; ctx.beginPath(); ctx.moveTo(o.x - 22, y - 26);
    ctx.lineTo(o.x + 4, y - 38); ctx.lineTo(o.x - 2, y - 12); ctx.fill(); return; }
  const c = { bush: ['#3d6b2a', '#2d4f1f'], ice: ['#9fd4f0', '#e8f7ff'], ember: ['#2a1816', '#ff5a1f'] }[o.t], h = o.t === 'ice' ? 30 : 24;
  ctx.fillStyle = c[0]; ctx.beginPath(); ctx.ellipse(o.x, y - 4, 40, 9, 0, 0, 7); ctx.fill();
  for (let dx = -34; dx <= 34; dx += 9) { const yy = gy(o.x + dx); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(o.x + dx - 5, yy); ctx.lineTo(o.x + dx, yy - h); ctx.lineTo(o.x + dx + 5, yy); ctx.fill(); }
}
function backdrop() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, lv.sky[0]); g.addColorStop(.6, lv.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = lv.sun; ctx.beginPath(); ctx.arc(W * .1, H * .08, 60 * S + 20, 0, 7); ctx.fill();
  if (style === '3d') {   // awan lembut berparalaks
    ctx.fillStyle = 'rgba(255,255,255,.35)'; const cs = 380 * S, co = (camX * .05 * S) % cs;
    for (let x = -cs - co; x < W + cs; x += cs) { const k = Math.round((x + co) / cs), y = (60 + ((k * 71) % 90 + 90) % 90) * S;
      [[0, 0, 38], [36, -10, 30], [70, 2, 34], [30, 12, 30]].forEach(c => { ctx.beginPath(); ctx.arc(x + c[0] * S, y + c[1] * S, c[2] * S, 0, 7); ctx.fill(); }); }
  }
  const hy = (330 - camY * .5) * S;
  ctx.fillStyle = lv.farC[0]; ctx.fillRect(0, hy, W, H - hy);
  if (lv.far === 'sea') {
    ctx.fillStyle = lv.farC[1]; ctx.fillRect(0, hy + 40 * S, W, 18 * S);
    const sx = ((W * .6 - camX * .03 * S) % (W + 400 * S) + W + 400 * S) % (W + 400 * S) - 200 * S;
    ctx.save(); ctx.translate(sx, hy); ctx.scale(S, S);
    ctx.fillStyle = '#e9edf0'; ctx.fillRect(-90, -26, 180, 26); ctx.fillRect(-60, -42, 110, 16);
    ctx.fillStyle = '#3a7bd5'; for (let i = -84; i < 84; i += 10) ctx.fillRect(i, -18, 5, 4);
    ctx.fillStyle = '#d63a2f'; ctx.fillRect(-12, -58, 16, 16); ctx.restore();
  } else {
    const st = (lv.far === 'dune' ? 320 : 240) * S, off = (camX * .08 * S) % st;
    ctx.fillStyle = lv.farC[1];
    for (let x = -st - off; x < W + st; x += st) {
      const k = Math.round((x + off) / st), h = (60 + (((k * 53) % 40) + 40) % 40 * 2) * S; ctx.beginPath(); ctx.moveTo(x, hy);
      if (lv.far === 'dune') ctx.quadraticCurveTo(x + st / 2, hy - h, x + st, hy); else { ctx.lineTo(x + st / 2, hy - h * 1.8); ctx.lineTo(x + st, hy); }
      ctx.fill();
    }
  }
  if (lv.snow || lv.ash) {
    const tt = performance.now() / 1000; ctx.fillStyle = lv.snow ? '#ffffff' : '#ffb347';
    for (let i = 0; i < 40; i++) { const x = (i * 137.5 + tt * (lv.snow ? 20 : 10)) % W, y = lv.snow ? (i * 61 + tt * 60) % H : H - (i * 61 + tt * 40) % H;
      ctx.fillRect(x, y, 2 + i % 3, 2 + i % 3); }
  }
}
let zoom = 1;
function draw() {
  // Kamera pintar: zoom-out saat motor tinggi, dan fokus ke tanah di depan agar area pendaratan selalu terlihat
  const air = Math.max(0, g0(b.x) - b.y);
  zoom += (clamp(1 - Math.max(0, air - 60) / 450, .6, 1) - zoom) * .08;
  const SS = S * zoom, vw = W / SS, vh = H / SS;
  camX = b.x - vw * .3;
  const f = (g0(b.x) + g0(b.x + 160) + g0(b.x + 320)) / 3 * .6 + b.y * .4;
  camY += (f - vh * .58 - camY) * .12;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  backdrop();

  ctx.setTransform(dpr * SS, 0, 0, dpr * SS, -camX * dpr * SS, -camY * dpr * SS);
  const x0 = camX - 20, x1 = camX + vw + 20, bot = camY + vh + 20;
  const pts = [], xs = [];
  for (let x = Math.floor(x0 / 8) * 8; x <= x1 + 8; x += 8) pts.push([x, gy(x)]);
  obs.forEach(o => { xs.push(o.x - o.hw - 16); if (o.t === 'hole') xs.push(o.x0, o.x1); });
  xs.forEach(e => { if (e > x0 - 10 && e < x1 + 10) pts.push([e - .01, gy(e - .01)], [e + .01, gy(e + .01)]); });
  pts.sort((p, q) => p[0] - q[0]);
  const d3 = style === '3d', q = lv.g3d;
  let fillS = lv.sand[0];
  if (d3) { fillS = ctx.createLinearGradient(0, camY, 0, bot); fillS.addColorStop(0, q.soil[0]); fillS.addColorStop(1, q.soil[1]); }
  ctx.fillStyle = fillS; ctx.beginPath(); ctx.moveTo(pts[0][0], bot);
  pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length - 1][0], bot); ctx.closePath(); ctx.fill();
  ctx.lineJoin = 'round';
  const edge = (off, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, n) => ctx[n ? 'lineTo' : 'moveTo'](p[0], p[1] + off)); ctx.stroke(); };
  if (d3) {   // lapisan rumput/permukaan berundak + tepi bercahaya
    ctx.save(); ctx.clip();
    edge(24, q.mid, 50); edge(11, q.top, 24);
    ctx.setLineDash([7, 9]); edge(50, q.mid, 7); ctx.setLineDash([]);
    ctx.restore(); edge(2, q.rim, 5);
  } else { edge(16, lv.sand[1], 10); edge(0, lv.sand[2], 4); }

  for (let i = Math.floor((x0 - 100) / 520); i <= Math.ceil(x1 / 520); i++) {
    const px = 250 + i * 520 + ((i * 97) % 160 + 160) % 160;
    if (px > 150 && px < GOAL + 200 && !inHole(px) && !inHole(px + 260)) decor(px, i);
  }
  obs.forEach(o => { if (o.x > x0 - 80 && o.x < x1 + 80) drawObs(o); });
  ctx.fillStyle = '#2a2118'; ctx.fillRect(GOAL - 3, gy(GOAL) - 110, 6, 110); // garis finis
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#2a2118' : '#f4efe6'; ctx.fillRect(GOAL + 3 + j * 12, gy(GOAL) - 110 + i * 12, 12, 12); }

  for (const k of coins) {
    if (k.got || k.x < x0 - 20 || k.x > x1 + 20) continue;
    ctx.fillStyle = '#ffc800'; ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(k.x, k.y, 9, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(k.x - 1.5, k.y - 5, 3, 10);
  }
  if ((style === '3d' || !b.g) && state !== 'menu') {   // bayangan di tanah: penanda titik pendaratan
    const gg = gy(b.x), hg = gg - b.y;
    ctx.fillStyle = 'rgba(0,0,0,' + clamp(.35 - hg / 900, .1, .35) + ')'; ctx.beginPath(); ctx.ellipse(b.x, gg + 1, 42, 7, 0, 0, 7); ctx.fill();
  }
  drawBike();
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 7, 7); });
  ctx.globalAlpha = 1;
}

/* ---------- loop ---------- */
let last = 0;
function frame(ts) {
  const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts;
  if (state === 'play' || state === 'crash') update(dt);
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- input ---------- */
const map = { ArrowUp: 'gas', w: 'gas', ' ': 'nos', Shift: 'nos', n: 'nos', ArrowDown: 'brake', s: 'brake', ArrowLeft: 'back', a: 'back', ArrowRight: 'fwd', d: 'fwd' };
addEventListener('keydown', e => {
  const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k) { K[k] = 1; e.preventDefault(); }
  if ((e.key === 'r' || e.key === 'R') && state !== 'menu') start(level);
  if ((e.key === 'Enter' || e.key === ' ') && $('overlay').classList.contains('show')) { e.preventDefault(); start(nextN); }
});
addEventListener('keyup', e => { const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) K[k] = 0; });
document.querySelectorAll('#touch button').forEach(el => {
  const k = el.dataset.k, on = v => e => { e.preventDefault(); K[k] = v; el.classList.toggle('on', !!v); };
  el.addEventListener('pointerdown', on(1)); el.addEventListener('pointerup', on(0));
  el.addEventListener('pointercancel', on(0)); el.addEventListener('pointerleave', on(0));
  el.addEventListener('contextmenu', e => e.preventDefault());
});
$('play').addEventListener('click', () => start(nextN));
const sb = $('style'), setStyle = () => { sb.textContent = 'Tampilan: ' + (style === '3d' ? '3D' : 'Kartun'); };
setStyle();
sb.addEventListener('click', () => { style = style === '3d' ? 'cartoon' : '3d'; try { localStorage.setItem('motoStyle', style); } catch (e) {} setStyle(); });
renderLevels();
$('mute').addEventListener('click', () => { $('mute').textContent = Sfx.toggleMute() ? '🔇' : '🔊'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) Sfx.stopEngine(); });
})();
