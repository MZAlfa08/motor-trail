(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const R = 17, L = 62, GRAV = 900, ACC = 560, MAXV = 620, NOSACC = 900, NOSMAX = 880;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let W, H, S, dpr, GOAL = 9000;
function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; S = Math.min(H / 600, W / 720); }
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 150)); resize();
const clouds = []; let TEX = null;

/* ---------- tema & level (3 bintang) ---------- */
const THEMES = {
  beach: { sky: ['#2f86e0', '#6cb8ee', '#bfe3f6', '#f6efd6'], sun: '#fff6d0', soil: ['#d9b36b', '#9c6f36'], top: '#efd49a', mid: '#e0b868', rim: '#fbeec6', blades: ['#c9c36a', '#a9a84a', '#d9d27e'], tex: ['#b88d4a', '#f3dca4', '#8c6a35'], cloud: 0, hz: '#8fb7d0',
    mt: [{ par: .04, seed: 1, h: 70, c0: '#8fb0c8', c1: '#cfe0ea' }] },
  green: { sky: ['#2a7fe0', '#5fb2f0', '#b4e0f7', '#e6f4f2'], sun: '#fffbe0', soil: ['#7a4e2b', '#3f2411'], top: '#80df2c', mid: '#47b012', rim: '#ddff55', blades: ['#2f9a0e', '#58c11b', '#8fe03a', '#3b8a12'], tex: ['#5b3820', '#8a5d36', '#2c1a0c'], cloud: 0, hz: '#5f9a4e',
    mt: [{ par: .035, seed: 2, h: 300, c0: '#8a9fc4', c1: '#d9e3f0', snow: 190 }, { par: .07, seed: 5, h: 170, c0: '#6f93b5', c1: '#a9c6d6' }, { par: .12, seed: 8, h: 100, c0: '#4f8a5a', c1: '#86b97a' }] },
  snow: { sky: ['#5f86bf', '#9fbbdc', '#d7e5f2', '#f1f6fb'], sun: '#ffffff', soil: ['#a9bdd4', '#6b829f'], top: '#fbfdff', mid: '#dbe9f5', rim: '#ffffff', blades: [], tex: ['#8fa6bf', '#ffffff', '#6b829f'], cloud: 1, snow: 1, hz: '#c4d4e6',
    mt: [{ par: .03, seed: 3, h: 360, c0: '#7f94b6', c1: '#dfe9f4', snow: 230 }, { par: .06, seed: 6, h: 270, c0: '#6c82a6', c1: '#c9d8ea', snow: 150 }, { par: .1, seed: 9, h: 190, c0: '#566f94', c1: '#b5c8de', snow: 90 }] }
};
const LEVELS = [
  { name: 'Pantai', tag: 'Mudah', goal: 46000, amp: .75, ph: 0, d: [1, 3.2], th: 'beach', drag: .25 },
  { name: 'Padang Hijau', tag: 'Agak susah', goal: 52000, amp: 1.0, ph: 3, d: [3, 6.2], th: 'green', drag: .25 },
  { name: 'Gunung Salju', tag: 'Sangat susah', goal: 58000, amp: 1.2, ph: 5, d: [5.5, 9.5], th: 'snow', drag: .1, brake: 450 }
];

/* ---------- medan: dasar bukit + zona rintangan ---------- */
let lv, th, level = 0, zones = [], mines = [], items = [], gt = 0, bload = 0, bx = 0;
const amp = x => Math.min(lv.amp, Math.max(0, (x - 300) / 1500));
const base = x => 420 + (55 * Math.sin(x * .004 + lv.ph) + 28 * Math.sin(x * .011 + 1 + lv.ph) + 40 * Math.sin(x * .0023 + 3 + lv.ph)) * amp(x);
function zoneAt(x) { let lo = 0, hi = zones.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1, z = zones[m]; if (x < z.x0) hi = m - 1; else if (x > z.x1) lo = m + 1; else return z; } return null; }
function deck(z, x) {
  const u = (x - z.x0) / (z.x1 - z.x0), e = Math.sin(Math.PI * u);
  return z.yA + (z.yB - z.yA) * u + z.sag * e + z.sw * Math.sin(gt * 2.1 + u * 7) * e + bload * Math.exp(-(((x - bx) / 90) ** 2)) * e;
}
function g0(x) {
  const y = base(x), z = zoneAt(x); if (!z) return y;
  switch (z.t) {
    case 'mound': return y - z.h * Math.exp(-(((x - z.c) / z.s) ** 2));
    case 'mud': return y + 9 * smooth(z.x0, z.x0 + 50, x) * smooth(z.x1, z.x1 - 50, x);
    case 'saw': { const e = smooth(z.x0, z.x0 + 70, x) * smooth(z.x1, z.x1 - 70, x), p = ((x - z.x0) / 64) % 1; return y - e * z.amp * Math.sin(Math.PI * p) ** 1.5; }
    case 'rocks': { let h = 0; for (const r of z.r) { const d = x - r.x; if (d > -r.r && d < r.r) h = Math.max(h, r.r * .36 * Math.cos(Math.PI * d / (2 * r.r)) ** 2); } return y - h; }
    case 'bridge': return deck(z, x);
    case 'loop': { const w = smooth(z.x0, z.x0 + 100, x) * smooth(z.x1, z.x1 - 100, x); return y + (z.y0 - y) * w; }
  }
  return y;
}
const gy = x => { const z = zoneAt(x); if (z && z.t === 'bridge') for (const g of z.gaps) if (x > g[0] && x < g[1]) return deck(z, x) + 260; return g0(x); };
function gf(x) {   // profil untuk gambar tanah (lembah di bawah jembatan)
  const z = zoneAt(x);
  if (z && z.t === 'bridge') { const e = smooth(z.x0, z.x0 + 150, x) * smooth(z.x1, z.x1 - 150, x); return (x < (z.x0 + z.x1) / 2 ? z.yA : z.yB) + 150 * e; }
  return g0(x);
}
const slopeAt = x => Math.atan2(g0(x + 4) - g0(x - 4), 8);
function lowerBound(arr, x) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x < x) lo = m + 1; else hi = m; } return lo; }

function build(kind, x, d, r) {
  switch (kind) {
    case 'mine': { const n = 1 + (d > 4.2) + (d > 7), s = 76 + d * 2, h = 66 + d * 3.5, c = x + 3.2 * s, first = c + 130 + d * 6, xs = [];
      for (let i = 0; i < n; i++) xs.push(first + i * (88 + d));
      const x1 = xs[n - 1] + 90; zones.push({ t: 'mound', x0: x, x1, c, h, s, nm: n }); xs.forEach(mx => mines.push({ x: mx })); return x1; }
    case 'mud': { const w = 240 + d * 28; zones.push({ t: 'mud', x0: x, x1: x + w }); return x + w; }
    case 'rocks': { const w = 300 + d * 22, n = 5 + Math.floor(d), rs = [];
      for (let i = 0; i < n; i++) rs.push({ x: x + 50 + (w - 100) * (i + .2 + r() * .6) / n, r: 14 + r() * (10 + d * 1.2) });
      zones.push({ t: 'rocks', x0: x, x1: x + w, r: rs }); return x + w; }
    case 'saw': { const w = 380 + d * 40; zones.push({ t: 'saw', x0: x, x1: x + w, amp: clamp(5 + d * .55, 6, 10) }); return x + w; }
    case 'bridge': { const w = 480 + d * 35, x1 = x + w, gaps = [];
      if (d > 5.5) gaps.push([x + w * .4, x + w * .4 + 62 + d * 2]); if (d > 7.8) gaps.push([x + w * .68, x + w * .68 + 70 + d * 2]);
      zones.push({ t: 'bridge', x0: x, x1, yA: base(x), yB: base(x1), sag: 12 + d * 3, sw: 4 + d * 1.5, gaps }); return x1; }
    case 'loop': { const ex = x + 130, x1 = ex + 46 + 130; zones.push({ t: 'loop', x0: x, x1, ex, r: 84 + d * 2, y0: base(ex), vmin: 320 + d * 13 }); return x1; }
    case 'combo': { const ks = ['mud', 'rocks', 'saw', 'mine']; let e = build(ks[Math.floor(r() * 4)], x, d, r); return build(ks[Math.floor(r() * 4)], e + 240, d, r); }
  }
  return x;
}
function loadLevel(n) {
  level = n; lv = LEVELS[n]; th = THEMES[lv.th]; GOAL = lv.goal; zones = []; mines = []; items = []; TEX = null; clouds.length = 0;
  const r = rng(n * 7919 + 13); let x = 1100;
  while (x < GOAL - 1700) {   // urutan rintangan: dari mudah ke sangat susah
    const d = lv.d[0] + (lv.d[1] - lv.d[0]) * (x - 1100) / (GOAL - 2800), pool = ['mine', 'mud', 'rocks', 'saw', 'bridge'];
    if (d > 2.4) pool.push('loop', 'mine'); if (d > 4.5) pool.push('combo', 'combo', 'loop'); if (d > 6.5) pool.push('combo', 'bridge', 'mine');
    x = build(pool[Math.floor(r() * pool.length)], x, d, r) + clamp(620 - d * 40, 300, 620) + r() * 140;
  }
  const put = (t, px, py) => items.push({ t, x: px, y: py, got: 0 });
  for (const z of zones) {
    if (z.t === 'mound') { mines.filter(m => m.x > z.c && m.x <= z.x1).forEach(m => put('big', m.x, g0(m.x) - 108));
      for (let i = 0; i < 5; i++) { const cx = z.c - 90 + i * 45; put('c', cx, g0(cx) - 36 - 28 * Math.sin(Math.PI * i / 4)); } }
    else if (z.t === 'loop') for (let i = 1; i < 8; i++) { const th2 = i * Math.PI / 4; put('c', z.ex + z.r * Math.sin(th2) + 46 * th2 / (2 * Math.PI), z.y0 - R - z.r * (1 - Math.cos(th2))); }
    else for (let i = 0; i < 5; i++) { const cx = (z.x0 + z.x1) / 2 - 90 + i * 45; put('c', cx, g0(cx) - 62 - 20 * Math.sin(Math.PI * i / 4)); }
  }
  for (let cx = 500; cx < GOAL - 300; cx += 420 + r() * 160) { if (zoneAt(cx) || zoneAt(cx + 200) || zoneAt(cx - 60)) continue; for (let i = 0; i < 5; i++) put('c', cx + i * 40, g0(cx + i * 40) - 34); }
  const clear = (px, t, step) => { while (zoneAt(px) || zoneAt(px + 80) || zoneAt(px - 80)) px += 60; put(t, px, g0(px) - 40); };
  for (let nx = 2600; nx < GOAL - 600; nx += 3000) clear(nx, 'nos');
  for (let hx = 6000; hx < GOAL - 600; hx += 7800) clear(hx, 'life');
  items.sort((p, q) => p.x - q.x);
}
loadLevel(0);

/* ---------- state ---------- */
const K = { gas: 0, brake: 0, fwd: 0, back: 0, nos: 0 };
let b, state = 'menu', time = 0, camX = 0, camY = 0, parts = [], endTimer = 0, paused = false;
let runScore = 0, nextN = 0, done = [false, false, false], bestScore = 0, bonus = 0, nitro = 100, rech = false, airRot = 0, wheelT = 0, maxX = 120, zi = 0, lives = 3, invul = 0, cpX = 120, lp = null;
try { bestScore = +localStorage.getItem('motoBeachScore') || 0; done = JSON.parse(localStorage.getItem('motoBeachDone') || '[false,false,false]'); } catch (e) {}
if (!Array.isArray(done) || done.length !== 3) done = [false, false, false];
nextN = Math.max(0, done.indexOf(false)); if (done.indexOf(false) < 0) nextN = 0;
let susp = 0, suspV = 0, crouch = .12, trick = 0, trickT = 0, airT = 0, rLean = 0, prevSl = null, rag = null;
let style = '3d';
try { style = localStorage.getItem('motoStyle') || '3d'; } catch (e) {}
const total = () => Math.floor(Math.max(0, maxX - 120) / 10) + bonus;
function saveBest() { const t = runScore + total(); if (t > bestScore) { bestScore = t; try { localStorage.setItem('motoBeachScore', t); } catch (e) {} } }
function pop(t) { const d = document.createElement('div'); d.textContent = t; $('pop').appendChild(d); setTimeout(() => d.remove(), 1100); }
function newBike(x) { return { x, y: g0(x) - R - 2, vx: x > 150 ? 240 : 0, vy: 0, a: 0, av: 0, g: true, wr: 0 }; }
b = newBike(120);
function hud() {
  $('time').textContent = time.toFixed(1); $('score').textContent = runScore + total();
  $('nosbar').style.width = nitro + '%'; $('nos').classList.toggle('rech', rech);
  $('lives').textContent = '\u2764'.repeat(Math.max(0, lives)); $('prog').style.width = clamp((b.x - 120) / (GOAL - 120) * 100, 0, 100) + '%';
}
const STAR = f => '<svg viewBox="0 0 24 24" width="46" height="46"><polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" fill="' + (f ? '#ffc800' : 'none') + '" stroke="' + (f ? '#8a5a00' : '#f4efe6') + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
function renderLevels() {
  const box = $('levels'); box.innerHTML = '';
  LEVELS.forEach((l, i) => {
    const open = i === 0 || done[i - 1], bt = document.createElement('button'); bt.className = 'star' + (open ? '' : ' lock');
    bt.innerHTML = STAR(done[i]) + '<span>' + (i + 1) + '. ' + l.name + '</span><em>' + l.tag + '</em>';
    bt.disabled = !open; bt.onclick = () => { runScore = 0; start(i); }; box.appendChild(bt);
  });
}
function showOverlay(title, msg, btn) {
  $('msg').textContent = title + ' ' + msg; $('best').textContent = bestScore ? 'Skor terbaik: ' + bestScore : '';
  $('play').textContent = btn; renderLevels(); $('overlay').classList.add('show');
}
function setPause(v) { if (v === paused || state === 'menu' || state === 'over' || state === 'done') return; paused = v; $('pausebox').classList.toggle('show', v); if (v) Sfx.stopEngine(); }
function start(n) {
  loadLevel(n); lives = 3; cpX = 120; invul = 0; b = newBike(120); parts = []; state = 'play'; time = 0; paused = false; rag = null; lp = null;
  susp = 0; suspV = 0; trick = 0; trickT = 0; airT = 0; prevSl = null; bonus = 0; nitro = 100; rech = false; airRot = 0; wheelT = 0; maxX = 120; zi = 0;
  $('overlay').classList.remove('show'); $('pausebox').classList.remove('show'); Sfx.init();
  $('lvname').textContent = 'Level ' + (n + 1) + ' \u00b7 ' + lv.name; pop('LEVEL ' + (n + 1) + ' \u00b7 ' + lv.name.toUpperCase()); hud();
}
function crash() {
  if (state !== 'play' || invul > 0) return;
  lives--; state = 'crash'; endTimer = style === '3d' ? 1.6 : .9; Sfx.crash(); Sfx.stopEngine();
  for (let i = 0; i < 20; i++) parts.push({ x: b.x, y: b.y - 20, vx: (Math.random() - .3) * 300 + b.vx * .4, vy: -Math.random() * 350, life: 1, c: ['#f0541e', '#2a2118', '#7ed321', '#f4efe6'][i % 4] });
  if (style === '3d') {
    const k = R / 172, v0 = [868 - MX, 436 - MY], cs = Math.cos(-TH), sn = Math.sin(-TH), c = Math.cos(b.a), s = Math.sin(b.a);
    const lx = (v0[0] * cs - v0[1] * sn) * k, ly = (v0[0] * sn + v0[1] * cs) * k;
    rag = { x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c, vx: b.vx * 1.05 + 90, vy: Math.min(b.vy, 0) - 260, a: b.a * .3, av: (Math.random() < .5 ? -1 : 1) * (4 + Math.random() * 4), rest: false };
  }
  hud();
}
function respawn() {
  b = newBike(cpX); parts = []; rag = null; state = 'play'; invul = 2.2; susp = 0; suspV = 0; trick = 0; trickT = 0; airT = 0; prevSl = null; lp = null; airRot = 0;
  zi = 0; while (zi < zones.length && zones[zi].x1 + 40 < cpX) zi++;
  pop('SISA NYAWA ' + lives); hud();
}
function finish() {
  state = 'done'; Sfx.stopEngine(); Sfx.win();
  const tb = Math.max(0, Math.round((130 - time) * 10)); bonus += tb; saveBest(); runScore += total(); bonus = 0; maxX = 120;
  done[level] = true; try { localStorage.setItem('motoBeachDone', JSON.stringify(done)); } catch (e) {}
  if (level < LEVELS.length - 1) { nextN = level + 1; showOverlay('Level ' + (level + 1) + ' selesai! \u2B50', 'Skor ' + runScore + ' (bonus waktu +' + tb + ')', 'Level berikutnya \u25B6'); }
  else { nextN = 0; const fin = runScore; runScore = 0; showOverlay('TAMAT! \uD83C\uDFC6', 'Semua bintang didapat. Total skor ' + fin, 'Main dari awal'); }
}
function stepLoop(dt) {
  const z = lp.z, T2 = 2 * Math.PI; lp.v = Math.max(lp.v - 25 * dt, 220); lp.th += lp.v / z.r * dt;
  const t = Math.min(lp.th, T2);
  b.x = z.ex + z.r * Math.sin(t) + 46 * t / T2; b.y = z.y0 - R - z.r * (1 - Math.cos(t)); b.a = -t; b.wr += lp.v / R * dt; b.vx = lp.v; b.vy = 0;
  if (lp.th >= T2) { b.x = z.ex + 46; b.y = z.y0 - R; b.a = 0; b.vx = lp.v; b.g = true; b.av = 0; airRot = 0; lp = null; bonus += 300; pop('LOOP!  +300'); Sfx.land(); }
}

/* ---------- update ---------- */
function update(dt) {
  const dead = state === 'crash';
  const lean = dead ? 0 : (K.fwd ? 1 : 0) - (K.back ? 1 : 0);
  if (state === 'play') time += dt;
  if (invul > 0) invul -= dt;
  if (nitro <= 0) rech = true;
  const nosOn = !dead && K.nos && nitro > 0 && (!rech || nitro >= 40);
  if (nosOn) nitro = Math.max(0, nitro - 35 * dt);
  else if (rech && !dead) { nitro = Math.min(100, nitro + 4 * dt); if (nitro >= 100) rech = false; }   // isi ulang otomatis, lambat
  const zc = zoneAt(b.x);
  bx = b.x; bload += ((zc && zc.t === 'bridge' && b.g && !dead ? 14 : 0) - bload) * Math.min(1, 5 * dt);
  if (lp) { stepLoop(dt); hud(); return; }
  const px = b.x;
  b.vy += GRAV * dt;
  if (b.g) {
    const sl = slopeAt(b.x), tx = Math.cos(sl), ty = Math.sin(sl);
    let v = b.vx * tx + b.vy * ty;
    if (!dead && v < (nosOn ? NOSMAX : MAXV)) v += ((K.gas ? ACC : 0) + (nosOn ? NOSACC : 0)) * dt;
    if (!dead && K.brake) v = v > 0 ? Math.max(0, v - (lv.brake || 800) * dt) : Math.max(-120, v - 300 * dt);
    const mud = zc && zc.t === 'mud' && !dead;
    v *= 1 - (dead ? 3 : lv.drag + (mud ? 2.4 : 0)) * dt; v = clamp(v, -150, NOSMAX);
    b.vx = v * tx; b.vy = v * ty; b.wr += v / R * dt;
    if (mud && Math.abs(v) > 40 && Math.random() < .6) parts.push({ x: b.x - 10 + Math.random() * 20, y: b.y + R - 4, vx: -v * .2 + (Math.random() - .5) * 90, vy: -120 - Math.random() * 160, life: .7, c: '#4a3220' });
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
        else {
          Sfx.land(); suspV += clamp(-away / 55, 0, 16);
          if (trickT > .3 && style === '3d') { bonus += 150; pop('FREESTYLE  +150'); }
          const fl = Math.floor(Math.abs(airRot) / 5.9); if (fl) { bonus += 300 * fl; pop('SALTO x' + fl + '  +' + 300 * fl); }
        }
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

  // --- animasi hidup: suspensi elastis, kuda-kuda pengendara, freestyle ---
  const air = Math.max(0, g0(b.x) - b.y); let F = 0;
  if (b.g && !dead) { const s2 = slopeAt(b.x); if (prevSl !== null) F = clamp(-(s2 - prevSl) / Math.max(dt, .001) * Math.hypot(b.vx, b.vy) * .09, -60, 90); prevSl = s2; } else prevSl = null;
  suspV += (-180 * susp - 11 * suspV + F) * dt; susp = clamp(susp + suspV * dt, -.5, 1.3);
  airT = b.g ? 0 : airT + dt;
  trick += ((!dead && !b.g && airT > .3 && air > 85 ? 1 : 0) - trick) * Math.min(1, 8 * dt);
  if (trick > .7) trickT += dt; else if (b.g) trickT = 0;
  crouch += ((b.g ? .12 + Math.max(0, susp) * .8 : .25) - crouch) * Math.min(1, 12 * dt);
  rLean += (lean - rLean) * Math.min(1, 10 * dt);
  if (rag && !rag.rest) {
    rag.vy += GRAV * dt; rag.x += rag.vx * dt; rag.y += rag.vy * dt; rag.a += rag.av * dt; let hit = false;
    for (const ly of [0, -40, -64]) { const wx = rag.x - ly * Math.sin(rag.a), wy = rag.y + ly * Math.cos(rag.a), pn = wy + 4 - gy(wx); if (pn > 0) { rag.y -= pn; hit = true; if (rag.vy > 0) rag.vy *= -.3; } }
    if (hit) { rag.vx *= 1 - 1.5 * dt; rag.av *= 1 - 3 * dt; rag.a += ((rag.vx >= 0 ? 1 : -1) * 1.5 - rag.a) * Math.min(1, 5 * dt);
      if (Math.abs(rag.vx) < 25 && Math.abs(rag.vy) < 40) { rag.rest = true; rag.vx = rag.vy = rag.av = 0; } }
  }

  if (!dead && state === 'play') {
    const hxL = style === '3d' ? -4 : 8, hyL = style === '3d' ? -66 : -58;
    const hx = b.x + hxL * c - hyL * s, hy = b.y + hxL * s + hyL * c;
    if (hy + 9 > gy(hx)) crash();
    if (nosOn) for (let k = 0; k < 2; k++) parts.push({ x: rx - 6 * c, y: ry - 6 * s - 6, vx: -260 * c + b.vx * .3 + (Math.random() - .5) * 60, vy: -260 * s + (Math.random() - .5) * 60, life: .5, c: k ? '#ffd35c' : '#f0541e', f: 1 });
    maxX = Math.max(maxX, b.x);
    const zn = zoneAt(b.x);
    if (zn && zn.t === 'loop' && !lp && b.g && px < zn.ex && b.x >= zn.ex) { if (b.vx >= zn.vmin) lp = { z: zn, th: 0, v: b.vx }; else { pop('KURANG CEPAT!'); crash(); } }
    if (zn && zn.t === 'bridge' && zn.gaps.some(g => b.x > g[0] + 6 && b.x < g[1] - 6) && b.y > deck(zn, b.x) + 45) crash();
    for (let i = lowerBound(mines, b.x - 70); i < mines.length && mines[i].x < b.x + 70; i++) {
      for (const wx of [rx, fx]) { const wy = wx === rx ? ry : fy; if (Math.abs(wx - mines[i].x) < 26 && wy + R > gy(mines[i].x) - 24) crash(); }
    }
    while (zi < zones.length && b.x > zones[zi].x1 + 40) {
      const z = zones[zi++], bn = z.t === 'mound' ? 200 * z.nm : { mud: 150, rocks: 150, saw: 150, bridge: 300 }[z.t] || 0;
      if (bn) { bonus += bn; pop('LEWAT!  +' + bn); }
      if (zi < zones.length) cpX = Math.max(z.x1 + 60, zones[zi].x0 - 350);
    }
    for (let i = lowerBound(items, b.x - 50); i < items.length && items[i].x < b.x + 50; i++) {
      const it = items[i]; if (it.got || Math.hypot(it.x - b.x, it.y - b.y) > (it.t === 'c' ? 30 : 42)) continue;
      it.got = 1;
      if (it.t === 'c') { bonus += 10; Sfx.coin(); }
      else if (it.t === 'big') { bonus += 100; Sfx.coin(); pop('KOIN BESAR  +100'); }
      else if (it.t === 'nos') { nitro = Math.min(100, nitro + 35); if (nitro >= 100) rech = false; Sfx.pick(); pop('NOS  +35'); }
      else { lives = Math.min(5, lives + 1); Sfx.pick(); pop('NYAWA  +1'); }
    }
    if (b.x >= GOAL) finish();
    Sfx.engine(Math.abs(b.vx) / MAXV, K.gas, nosOn);
  }
  if (dead) {
    endTimer -= dt;
    if (endTimer <= 0) { if (lives > 0) respawn(); else { state = 'over'; nextN = level; saveBest(); showOverlay('Game over!', 'Nyawa habis. Skor ' + (runScore + total()), 'Ulangi level'); } }
  }
  parts.forEach(p => { if (!p.f) p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * (p.f ? 2.2 : .8); });
  parts = parts.filter(p => p.life > 0);
  hud();
}

/* ---------- motor & pengendara (gaya 3D + kartun) ---------- */
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
const U = [.805, -.593], NN = [.593, .805];            // arah depan & bawah bingkai motor (koordinat gambar)
const H0 = [868, 436], S0 = [835, 214], C0 = [808, 102], A0 = [1105, 578], G0 = [1118, 247];
const BOOT = [[1085, 592], [1135, 562], [1190, 610], [1256, 616], [1250, 652], [1196, 692], [1150, 690], [1100, 652]].map(p => [p[0] - A0[0], p[1] - A0[1]]);
const CUFF = [[1085, 586], [1138, 560], [1162, 598], [1108, 626]].map(p => [p[0] - A0[0], p[1] - A0[1]]);
function ik(p0, p1, l1, l2, flip) {                      // sendi 2 ruas (lutut / siku)
  let dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy) || 1; const m = l1 + l2 - .5;
  const e = d > m ? [p0[0] + dx / d * m, p0[1] + dy / d * m] : p1; d = Math.min(d, m); dx = e[0] - p0[0]; dy = e[1] - p0[1];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
  return [[p0[0] + ux * a - uy * h * flip, p0[1] + uy * a + ux * h * flip], e];
}
function riderArt(H, A, G, phi, fa) {
  const B = '#2f4fbf', W = '#eaf1ff', N = 'rgba(0,0,0,0)', hl = 'rgba(255,255,255,.16)';
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const sv = rot([S0[0] - H0[0], S0[1] - H0[1]], phi), S = [H[0] + sv[0], H[1] + sv[1]];
  const hv = rot([C0[0] - S0[0], C0[1] - S0[1]], phi * 1.3), C = [S[0] + hv[0], S[1] + hv[1]];
  const kk = ik(H, A, 134, 146, -1), kn = kk[0], an = kk[1];
  tube([H, kn], B, 92, hl); tube([kn, an], B, 62, hl);                                  // kaki elastis
  tube([[H[0] + 4, H[1] - 2], [kn[0] - 6, kn[1] - 4]], W, 20, N);
  ctx.save(); ctx.translate(an[0], an[1]); ctx.rotate(fa);                              // sepatu
  shade(BOOT, '#ffffff', '#cfd5e2'); shade(CUFF, '#2a2a36', '#14141c'); tube([[55, 62], [130, 62]], '#14141c', 10, N); ctx.restore();
  ctx.save(); ctx.translate(H[0], H[1]); ctx.rotate(phi); ctx.translate(-H0[0], -H0[1]);   // badan
  const tg = ctx.createLinearGradient(770, 0, 930, 0); tg.addColorStop(0, '#2a46b8'); tg.addColorStop(1, '#3d62d4');
  ctx.beginPath(); ctx.moveTo(772, 235); ctx.bezierCurveTo(768, 320, 790, 400, 850, 452); ctx.lineTo(910, 432);
  ctx.bezierCurveTo(928, 360, 892, 300, 926, 228); ctx.bezierCurveTo(905, 188, 840, 172, 790, 196); ctx.closePath();
  ctx.fillStyle = tg; ctx.fill(); tube([[798, 228], [832, 322], [884, 392]], W, 44, N); ctx.restore();
  const aa = ik(S, G, 150, 140, 1), el = aa[0], ge = aa[1];                              // lengan elastis
  tube([S, el], B, 44, hl); tube([el, ge], B, 40, hl);
  const dx = ge[0] - el[0], dy = ge[1] - el[1], dl = Math.hypot(dx, dy) || 1, cm = [el[0] + dx * .35, el[1] + dy * .35];
  tube([[cm[0] + dy / dl * 10, cm[1] - dx / dl * 10], [cm[0] - dy / dl * 10, cm[1] + dx / dl * 10]], W, 18, N);
  ctx.beginPath(); ctx.arc(ge[0], ge[1], 26, 0, 7); ctx.fillStyle = '#14141c'; ctx.fill();   // sarung tangan
  ctx.save(); ctx.translate(C[0], C[1]); ctx.rotate(phi * 1.3); ctx.translate(-C0[0], -C0[1]);   // kepala
  shade([[782, 160], [828, 160], [830, 190], [784, 188]], '#2a2a36', '#14141c');
  const g = ctx.createLinearGradient(0, 30, 0, 180); g.addColorStop(0, '#46c8f8'); g.addColorStop(1, '#3a62d0');
  ctx.beginPath(); ctx.ellipse(808, 102, 88, 76, -.15, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  tube([[700, 140], [900, 112]], '#14182e', 22, N);
  ctx.beginPath(); ctx.ellipse(872, 98, 27, 27, -.3, 0, 7); ctx.fillStyle = '#1a1f3a'; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(856, 86, 14, 9, -.5, 0, 7); ctx.fillStyle = '#ffb13a'; ctx.fill();
  shade([[868, 122], [898, 118], [902, 152], [872, 162]], '#4a6fd0', '#2a3a78');
  const pg = ctx.createLinearGradient(0, 20, 0, 100); pg.addColorStop(0, '#2f3042'); pg.addColorStop(1, '#0f0f16');   // lidah helm trail (peak)
  ctx.beginPath(); ctx.moveTo(768, 88); ctx.quadraticCurveTo(830, 40, 990, 30); ctx.lineTo(1000, 50); ctx.quadraticCurveTo(900, 74, 846, 104); ctx.closePath();
  ctx.fillStyle = pg; ctx.fill(); tube([[800, 66], [950, 38]], '#5b8cf0', 5, N);
  ctx.restore();
}
function bikeArt(noRider) {
  const O = '#ff7a14', P = '#b76fd1', N = 'rgba(0,0,0,0)';
  const c = clamp(susp, -.4, 1.2) * 70, ox = c * NN[0], oy = c * NN[1], o = (x, y) => [x + ox, y + oy];
  wheelRef(RW, b.wr); wheelRef(FW, b.wr);
  tube([[1350, 368], [1500, 448]], O, 54);                                              // garpu bawah (ikut roda)
  const sw = o(1135, 668), hub = [995, 800];
  tube([sw, hub], P, 46);                                                               // swing arm berayun
  const pa = [hub[0] + (sw[0] - hub[0]) * .55, hub[1] + (sw[1] - hub[1]) * .55], pb = o(1018, 626);   // pegas peredam belakang
  const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1, dx = (pb[0] - pa[0]) / len, dy = (pb[1] - pa[1]) / len, pts = [pa];
  for (let i = 1; i < 14; i++) { const t = i / 14, sd = (i % 2 ? 1 : -1) * 24; pts.push([pa[0] + dx * len * t - dy * sd, pa[1] + dy * len * t + dx * sd]); }
  pts.push(pb); tube(pts, '#ffb21e', 9, 'rgba(255,255,255,.3)');
  tube([o(1255, 312), [1350, 362]], '#4a4d59', 10, N);                                  // batang garpu (teleskop)
  ctx.save(); ctx.translate(ox, oy);
  tube([[660, 655], [920, 582]], '#15151c', 5, N);
  tube([[885, 624], [1125, 652]], P, 54);
  shade([[1195, 400], [1245, 382], [1262, 420], [1292, 560], [1268, 622], [1210, 640], [1150, 610], [1170, 520]], '#5a5e6c', '#3a3d49');
  tube([[1262, 480], [1188, 598]], P, 14, N);
  shade([[915, 580], [1072, 548], [1150, 665], [990, 640]], '#ff8f2c', '#f2640c');
  tube([[1215, 312], [1124, 540]], O, 48);
  shade([[1180, 288], [1236, 268], [1258, 306], [1206, 328]], '#ff9a2a', '#f0600a');
  tube([[1160, 264], [1200, 252]], '#8d93a3', 14); tube([[1160, 262], [1188, 254]], '#8d93a3', 12, N);
  ctx.restore();
  if (noRider) return;
  const tr = trick, cr = crouch, bob = Math.sin(performance.now() / 1000 * 11) * Math.min(1, Math.abs(b.vx) / 500) * (b.g ? 1 : 0);
  const H = [H0[0] + ox + cr * (NN[0] * 55 - U[0] * 14) + tr * (U[0] * 35 - NN[0] * 25), H0[1] + oy + cr * (NN[1] * 55 - U[1] * 14) + tr * (U[1] * 35 - NN[1] * 25) + bob * 6];
  const A = [A0[0] + ox + tr * (-U[0] * 220 - NN[0] * 110), A0[1] + oy + tr * (-U[1] * 220 - NN[1] * 110)];   // freestyle: kaki terjulur ke belakang
  riderArt(H, A, [G0[0] + ox, G0[1] + oy], rLean * .18 + cr * .3 + tr * .35 + bob * .02, -tr * .9);
}
function drawRag() {                                     // pengendara terlempar (ragdoll sederhana)
  const r = rag, k = R / 172, t = performance.now() / 1000, f = r.rest ? 0 : 1;
  ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a); ctx.scale(k, k); ctx.translate(-H0[0], -H0[1]);
  riderArt(H0, [H0[0] + 90 + 120 * f * Math.sin(t * 8), H0[1] + 230 - 40 * f * Math.abs(Math.sin(t * 9))],
    [S0[0] + 60 + 130 * f * Math.sin(t * 7), S0[1] + 170 - 90 * f * Math.abs(Math.cos(t * 6))], .3 * f * Math.sin(t * 5), f * Math.sin(t * 6));
  ctx.restore();
}
function drawBike3D() {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); const k = R / 172; ctx.scale(k, k); ctx.rotate(-TH); ctx.translate(-MX, -MY);
  bikeArt(!!rag); ctx.restore();
}
function drawBike() { if (style === '3d') drawBike3D(); else drawBikeCartoon(); }

/* ---------- lingkungan realistis: langit, awan, laut, gunung, tanah, pohon ---------- */
function makeCloud(w, h, seed, gray) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 30; i++) {
    const x = w * .14 + r() * w * .72, y = h * .58 - Math.sin(x / w * Math.PI) * h * .22 + (r() - .5) * h * .22, rad = h * (.16 + r() * .24);
    const gr = g.createRadialGradient(x - rad * .25, y - rad * .35, rad * .08, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.96)'); gr.addColorStop(.55, gray ? 'rgba(222,230,242,.8)' : 'rgba(240,246,253,.8)'); gr.addColorStop(1, gray ? 'rgba(150,165,190,0)' : 'rgba(175,200,235,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'source-atop'; const gb = g.createLinearGradient(0, h * .45, 0, h * .95);
  gb.addColorStop(0, 'rgba(110,130,170,0)'); gb.addColorStop(1, 'rgba(110,130,170,.4)'); g.fillStyle = gb; g.fillRect(0, 0, w, h);
  return c;
}
function makeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), r = rng(5);
  for (let i = 0; i < 420; i++) { g.fillStyle = th.tex[Math.floor(r() * 3)]; g.globalAlpha = .12 + r() * .25; const s = 1 + r() * 4; g.beginPath(); g.ellipse(r() * 160, r() * 160, s, s * (.5 + r() * .5), r() * 3, 0, 7); g.fill(); }
  return ctx.createPattern(c, 'repeat');
}
const ridge = (sd, x) => .5 + .27 * Math.sin(x * .0021 + sd) + .17 * Math.sin(x * .0057 + sd * 2.3) + .1 * Math.sin(x * .013 + sd * 4.1) + .05 * Math.sin(x * .031 + sd * 1.7);
function mountains(hy) {
  for (const m of th.mt) {
    const pts = []; for (let sx = 0; sx <= W + 12; sx += 10) { const u = (sx + camX * S * m.par) / S; pts.push([sx, hy - m.h * S * ridge(m.seed, u) + 20 * S, u]); }
    const g = ctx.createLinearGradient(0, hy - m.h * S, 0, hy); g.addColorStop(0, m.c0); g.addColorStop(1, m.c1);
    ctx.beginPath(); ctx.moveTo(0, hy + 2); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(W, hy + 2); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    if (m.snow) {   // puncak bersalju (dipotong mengikuti bentuk gunung)
      ctx.save(); ctx.clip(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; ctx.lineTo(p[0], hy - m.snow * S + 14 * S * Math.abs(Math.sin(p[2] * .09)) + 8 * S * Math.sin(p[2] * .23)); }
      ctx.closePath(); const sg = ctx.createLinearGradient(0, hy - m.h * S, 0, hy - m.snow * S); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#dbe7f5');
      ctx.fillStyle = sg; ctx.fill(); ctx.restore();
    }
  }
}
function sea(hy, sunX) {
  const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, '#8fd0ec'); g.addColorStop(.12, '#3aa3d8'); g.addColorStop(.5, '#1f7fb8'); g.addColorStop(1, '#14608f');
  ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, S);
  for (let i = 0; i < 46; i++) {
    const f = i / 46, y = hy + 6 * S + f * f * 260 * S, len = (30 + f * 110) * S, x = ((i * 137.5 + gt * (10 + f * 30) - camX * S * .05) % (W + len) + W + len) % (W + len) - len / 2;
    ctx.globalAlpha = .12 + f * .3; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 3 * S, x + len, y); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,248,210,.5)';   // pantulan matahari
  for (let i = 0; i < 26; i++) { const f = i / 26, w = (6 + f * 40) * S * (.6 + .4 * Math.sin(gt * 3 + i * 1.7)); ctx.fillRect(sunX - w / 2 + Math.sin(gt + i) * 6 * S, hy + 4 * S + f * 150 * S, w, 1.6 * S); }
}
function backdrop() {
  const g = ctx.createLinearGradient(0, 0, 0, H * .75); th.sky.forEach((c, i) => g.addColorStop(i / 3, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sx = W * .16, sy = H * .13, rr = 190 * S + 40, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
  sg.addColorStop(0, th.sun); sg.addColorStop(.12, th.sun); sg.addColorStop(.13, 'rgba(255,248,215,.5)'); sg.addColorStop(1, 'rgba(255,248,215,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.fill();
  if (!clouds.length) for (let i = 0; i < 5; i++) clouds.push(makeCloud(440, 180, i * 11 + 3, th.cloud));
  for (let i = 0; i < 7; i++) {
    const c = clouds[i % 5], sc = (.6 + (i * 37 % 10) / 14) * S, cw = c.width * sc, span = W + cw;
    const x = (((i * 520 - camX * S * (.03 + (i % 3) * .015)) % span) + span) % span - cw, y = (28 + (i * 61 % 150)) * S;
    ctx.globalAlpha = .75 + (i % 3) * .08; ctx.drawImage(c, x, y, cw, c.height * sc);
  }
  ctx.globalAlpha = 1;
  const hy = (330 - camY * .5) * S;
  if (lv.th === 'beach') sea(hy, sx); else { ctx.fillStyle = th.hz; ctx.fillRect(0, hy, W, H - hy); }
  mountains(hy);
}
function snowfall() {
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 90; i++) { const sz = 1 + (i % 4) * .8, sp = 30 + (i % 5) * 18, x = (i * 97.3 + Math.sin(gt * .7 + i) * 24 + gt * 14) % (W + 20), y = (i * 53.1 + gt * sp) % (H + 10);
    ctx.beginPath(); ctx.arc(x, y, sz * S + .5, 0, 7); ctx.fill(); }
}
function palm(x, y, k, f, sd) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k * f, k); const tr = rng(sd), lean = 26 + tr() * 18; ctx.lineCap = 'round';
  const pt = t => [lean * t * t * 1.6 + 4 * t, -150 * t];
  for (let j = 0; j < 14; j++) { const a = pt(j / 14), c2 = pt((j + 1) / 14); ctx.strokeStyle = j % 2 ? '#8a6a4c' : '#7a5b40'; ctx.lineWidth = 15 - 6 * j / 14; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke(); }
  ctx.translate(lean * 1.6 + 4, -150);
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI * 1.05 + i * (Math.PI * 1.1 / 8) + (tr() - .5) * .2, len = 78 + tr() * 22, dr = .5 + tr() * .3;
    ctx.save(); ctx.rotate(ang); ctx.strokeStyle = '#4b7a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -len * .12, len, len * dr * .4); ctx.stroke();
    for (let j = 1; j < 17; j++) { const t = j / 17, px = len * t, py = -len * .24 * t * (1 - t) + len * dr * .4 * t * t, ll = 26 * (1 - t * .55);
      ctx.strokeStyle = (i + j) % 2 ? '#2f7d2a' : '#3f9a35'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + ll * .3, py + ll); ctx.moveTo(px, py); ctx.lineTo(px + ll * .3, py - ll * .8); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = '#5a3d22'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-6 + i * 7, 8, 5.5, 0, 7); ctx.fill(); }
  ctx.restore();
}
function oak(x, y, k, sd) {
  const r = rng(sd); ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = '#5b3d24'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-6, -50, -4, -90); ctx.lineTo(6, -90); ctx.quadraticCurveTo(8, -50, 12, 0); ctx.fill();
  for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = r() * 52, cx = Math.cos(a) * d, cy = -120 + Math.sin(a) * d * .7, rad = 26 + r() * 16;
    const g = ctx.createRadialGradient(cx - rad * .35, cy - rad * .4, rad * .1, cx, cy, rad); g.addColorStop(0, '#9be04a'); g.addColorStop(.6, '#3f9a22'); g.addColorStop(1, '#1f6a14');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill(); }
  ctx.restore();
}
function pine(x, y, k, snowy) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = '#5b3d24'; ctx.fillRect(-6, -30, 12, 32);
  for (let i = 0; i < 5; i++) {
    const w = 58 - i * 9, yy = -26 - i * 34, g = ctx.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, '#1d5a35'); g.addColorStop(.5, '#2f8247'); g.addColorStop(1, '#194a2c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 58); ctx.lineTo(w, yy); ctx.quadraticCurveTo(0, yy + 14, -w, yy); ctx.fill();
    if (snowy) { ctx.fillStyle = '#f6fbff'; ctx.beginPath(); ctx.moveTo(-w * .62, yy - 22); ctx.lineTo(0, yy - 58); ctx.lineTo(w * .62, yy - 22); ctx.quadraticCurveTo(w * .2, yy - 12, 0, yy - 18); ctx.quadraticCurveTo(-w * .2, yy - 10, -w * .62, yy - 22); ctx.fill(); }
  }
  ctx.restore();
}
function umbrella(x, y, col) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(10, 2, 46, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8553a'; ctx.fillRect(34, -3, 56, 4); ctx.fillStyle = '#f6f2e8'; ctx.fillRect(34, -3, 56, 1.5);   // handuk
  ctx.strokeStyle = '#8c8c92'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -112); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const t0 = i * Math.PI / 6, t1 = t0 + Math.PI / 6, tm = (t0 + t1) / 2, p = t => [-56 * Math.cos(t), -86 + 8 * Math.sin(t)];
    const a = p(t0), c = p(t1), m = p(tm); ctx.fillStyle = i % 2 ? '#f6f2e8' : col; ctx.beginPath(); ctx.moveTo(0, -118); ctx.lineTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1] + 5, c[0], c[1]); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function decor(px, i) {
  const y = gy(px) + 4, k = .85 + (i % 3) * .12;
  if (lv.th === 'beach') { palm(px, y, k, i % 2 ? 1 : -1, i + 3); if (i % 2) umbrella(px + 230, gy(px + 230) + 2, ['#e8453a', '#2f8fe0', '#f2b21a'][i % 3]); }
  else if (lv.th === 'green') { if (i % 2) oak(px, y, k, i); else pine(px, y, k, 0); if (i % 3 === 0) pine(px + 160, gy(px + 160) + 3, .7, 0); }
  else { pine(px, y, k * 1.1, 1); pine(px + 120, gy(px + 120) + 3, .75, 1); }
}
const surf = (z, off, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let x = z.x0; x <= z.x1; x += 6) ctx[x === z.x0 ? 'moveTo' : 'lineTo'](x, g0(x) + off); ctx.stroke(); };
function mudArt(z) {
  surf(z, 6, '#3a2413', 24); surf(z, 1, '#5d3b22', 14); ctx.setLineDash([14, 20]); surf(z, -2, 'rgba(255,230,190,.35)', 3); ctx.setLineDash([]);
  for (let i = 0; i < 6; i++) { const bx2 = z.x0 + (i * 53 + gt * 12) % (z.x1 - z.x0); ctx.fillStyle = 'rgba(120,80,45,.7)'; ctx.beginPath(); ctx.arc(bx2, g0(bx2) - 1, 3 + i % 3, 0, 7); ctx.fill(); }
}
function rocksArt(z) {
  for (const r of z.r) { const y = g0(r.x) + r.r * .2, g = ctx.createRadialGradient(r.x - r.r * .3, y - r.r * .6, r.r * .1, r.x, y - r.r * .3, r.r * 1.1);
    g.addColorStop(0, '#b8babf'); g.addColorStop(.6, '#7d8088'); g.addColorStop(1, '#4a4c54'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(r.x, y, r.r * 1.1, r.r * .56, 0, Math.PI, 0); ctx.lineTo(r.x + r.r * 1.1, y + 3); ctx.lineTo(r.x - r.r * 1.1, y + 3); ctx.closePath(); ctx.fill(); }
}
function bridgeArt(z) {
  const st = 12, pts = []; for (let x = z.x0; x <= z.x1; x += st) pts.push([x, deck(z, x)]);
  for (const x of [z.x0 + 6, z.x1 - 6]) { const y = deck(z, x); ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 6, y - 80, 12, 84); }
  ctx.strokeStyle = '#d9c9a0'; ctx.lineWidth = 3; for (const hh of [46, 72]) { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1] - hh)); ctx.stroke(); }
  ctx.strokeStyle = '#bfae86'; ctx.lineWidth = 2; for (let i = 0; i < pts.length; i += 4) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i][0], pts[i][1] - 72); ctx.stroke(); }
  for (let i = 0; i < pts.length - 1; i++) {
    if (z.gaps.some(g => pts[i][0] + st > g[0] && pts[i][0] < g[1])) continue;
    ctx.fillStyle = i % 2 ? '#8d6238' : '#a6763f'; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1] - 3); ctx.lineTo(pts[i + 1][0], pts[i + 1][1] - 3); ctx.lineTo(pts[i + 1][0], pts[i + 1][1] + 9); ctx.lineTo(pts[i][0], pts[i][1] + 9); ctx.closePath(); ctx.fill();
  }
}
function loopArt(z) {
  const cx = z.ex + 23, cy = z.y0 - R - z.r, rad = z.r + R + 6; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#2d3138'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#59606b'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
  ctx.setLineDash([16, 16]); ctx.strokeStyle = '#ffd13a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#3a3f48'; ctx.lineWidth = 8;
  for (const a of [2.2, .94]) { const sx = cx + Math.cos(a) * rad, sy = cy + Math.sin(a) * rad; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (a > 1.5 ? -28 : 28), z.y0 + 2); ctx.stroke(); }
}
function mineArt(m) {
  const y = gy(m.x), on = Math.sin(gt * 6 + m.x) > 0;
  ctx.fillStyle = '#34363c'; ctx.beginPath(); ctx.ellipse(m.x, y - 2, 26, 8, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(m.x - 8, y - 22, 2, m.x, y - 10, 28); g.addColorStop(0, '#8a8f99'); g.addColorStop(1, '#3a3d45'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, y - 4, 22, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#2a2c32'; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(m.x + i * 8, y - 14); ctx.lineTo(m.x + i * 11, y - 28 + Math.abs(i) * 3); ctx.stroke(); }
  ctx.fillStyle = on ? '#ff3b2f' : '#7a1d18'; ctx.beginPath(); ctx.arc(m.x, y - 24, 4, 0, 7); ctx.fill();
}
function itemArt(it) {
  if (it.got) return; const x = it.x, y = it.y + Math.sin(gt * 3 + x * .02) * 3;
  ctx.save(); ctx.translate(x, y);
  if (it.t === 'c' || it.t === 'big') {
    const rr = it.t === 'big' ? 20 : 10; ctx.scale(Math.max(.25, Math.abs(Math.cos(gt * 3 + x * .05))), 1);
    const g = ctx.createRadialGradient(-rr * .3, -rr * .3, 1, 0, 0, rr); g.addColorStop(0, '#fff3a8'); g.addColorStop(.6, '#ffc300'); g.addColorStop(1, '#c78a00');
    ctx.fillStyle = g; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); ctx.stroke();
    if (it.t === 'big') { ctx.fillStyle = '#8a5a00'; ctx.font = 'bold 15px Impact,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('100', 0, 5); }
  } else if (it.t === 'nos') {
    ctx.fillStyle = '#2f8fe0'; ctx.strokeStyle = '#123a66'; ctx.lineWidth = 2; ctx.fillRect(-10, -16, 20, 32); ctx.strokeRect(-10, -16, 20, 32); ctx.fillStyle = '#9fd4ff'; ctx.fillRect(-5, -20, 10, 5);
    ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-5, 2); ctx.lineTo(0, 2); ctx.lineTo(-2, 12); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#e8283c'; ctx.strokeStyle = '#7a0c1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-24, -4, -12, -22, 0, -8); ctx.bezierCurveTo(12, -22, 24, -4, 0, 12); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function terrain(x0, x1, bot) {
  const pts = []; for (let x = Math.floor(x0 / 8) * 8; x <= x1 + 8; x += 8) pts.push([x, gf(x)]);
  const fg = ctx.createLinearGradient(0, camY, 0, bot); fg.addColorStop(0, th.soil[0]); fg.addColorStop(1, th.soil[1]);
  ctx.beginPath(); ctx.moveTo(pts[0][0], bot); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length - 1][0], bot); ctx.closePath();
  ctx.fillStyle = fg; ctx.fill(); TEX = TEX || makeTex(); ctx.globalAlpha = .55; ctx.fillStyle = TEX; ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';
  const edge = (off, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, n) => ctx[n ? 'lineTo' : 'moveTo'](p[0], p[1] + off)); ctx.stroke(); };
  ctx.save(); ctx.clip(); edge(24, th.mid, 50); edge(11, th.top, 24); ctx.setLineDash([7, 9]); edge(50, th.mid, 7); ctx.setLineDash([]); ctx.restore();
  if (lv.th === 'beach') edge(-2, 'rgba(255,255,255,.75)', 3);
  edge(2, th.rim, 5);
  if (th.blades.length) for (let x = Math.floor(x0 / 6) * 6; x < x1; x += 6) {   // rumput
    const hs = Math.abs(Math.sin(x * 12.9898) * 43758.5453) % 1; if (lv.th === 'beach' && hs < .6) continue;
    const y = gf(x), hh = (7 + hs * 15) * (lv.th === 'beach' ? .6 : 1), sw = Math.sin(gt * 1.6 + x * .06) * 2.5;
    ctx.fillStyle = th.blades[Math.floor(hs * 997) % th.blades.length]; ctx.beginPath(); ctx.moveTo(x - 2.4, y + 3); ctx.lineTo(x + sw, y - hh); ctx.lineTo(x + 2.4, y + 3); ctx.fill();
  }
}

/* ---------- gambar ---------- */
let zoom = 1;
function draw() {
  const air = Math.max(0, g0(b.x) - b.y);
  zoom += (clamp(1 - Math.max(0, air - 60) / 450, .6, 1) - zoom) * .08;
  const SS = S * zoom, vw = W / SS, vh = H / SS;
  camX = b.x - vw * .3;
  const f = (g0(b.x) + g0(b.x + 160) + g0(b.x + 320)) / 3 * .6 + b.y * .4;
  camY += (f - vh * .58 - camY) * .12;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop();
  ctx.setTransform(dpr * SS, 0, 0, dpr * SS, -camX * dpr * SS, -camY * dpr * SS);
  const x0 = camX - 20, x1 = camX + vw + 20, bot = camY + vh + 20;
  terrain(x0, x1, bot);
  for (let i = Math.floor((x0 - 150) / 520); i <= Math.ceil(x1 / 520); i++) {
    const px = 250 + i * 520 + ((i * 97) % 160 + 160) % 160;
    if (px > 150 && px < GOAL + 200 && !zoneAt(px) && !zoneAt(px + 230) && !zoneAt(px - 60)) decor(px, i);
  }
  for (const z of zones) {
    if (z.x1 < x0 - 60 || z.x0 > x1 + 60) continue;
    if (z.t === 'mud') mudArt(z); else if (z.t === 'saw') { surf(z, 0, '#4b5058', 8); surf(z, -3, '#a5adba', 2.5); }
    else if (z.t === 'rocks') rocksArt(z); else if (z.t === 'bridge') bridgeArt(z); else if (z.t === 'loop') loopArt(z);
  }
  mines.forEach(m => { if (m.x > x0 - 40 && m.x < x1 + 40) mineArt(m); });
  for (let i = lowerBound(items, x0 - 30); i < items.length && items[i].x < x1 + 30; i++) itemArt(items[i]);
  ctx.fillStyle = '#2a2118'; ctx.fillRect(GOAL - 3, gy(GOAL) - 110, 6, 110);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#2a2118' : '#f4efe6'; ctx.fillRect(GOAL + 3 + j * 12, gy(GOAL) - 110 + i * 12, 12, 12); }
  if ((style === '3d' || !b.g) && state !== 'menu' && !lp) {
    const gg = gy(b.x), hg = gg - b.y; ctx.fillStyle = 'rgba(0,0,0,' + clamp(.35 - hg / 900, .1, .35) + ')'; ctx.beginPath(); ctx.ellipse(b.x, gg + 1, 42, 7, 0, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = invul > 0 && Math.floor(invul * 10) % 2 ? .35 : 1; drawBike(); ctx.globalAlpha = 1;
  if (rag && style === '3d') drawRag();
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 7, 7); }); ctx.globalAlpha = 1;
  if (th.snow) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); snowfall(); }
}

/* ---------- loop & input ---------- */
let last = 0;
function frame(ts) {
  const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts; gt = ts / 1000;
  if (!paused && (state === 'play' || state === 'crash')) update(dt);
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const map = { ArrowUp: 'gas', w: 'gas', ArrowDown: 'brake', s: 'brake', ArrowLeft: 'back', a: 'back', ArrowRight: 'fwd', d: 'fwd', ' ': 'nos', Shift: 'nos', n: 'nos' };
addEventListener('keydown', e => {
  const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k) { K[k] = 1; e.preventDefault(); }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { setPause(!paused); return; }
  if ((e.key === 'r' || e.key === 'R') && state !== 'menu') start(level);
  if ((e.key === 'Enter' || e.key === ' ') && $('overlay').classList.contains('show')) { e.preventDefault(); start(nextN); }
});
addEventListener('keyup', e => { const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) K[k] = 0; });
document.querySelectorAll('#touch button').forEach(el => {
  const k = el.dataset.k, on = v => e => { e.preventDefault(); K[k] = v; el.classList.toggle('on', !!v); };
  el.addEventListener('pointerdown', on(1)); el.addEventListener('pointerup', on(0)); el.addEventListener('pointercancel', on(0)); el.addEventListener('pointerleave', on(0));
  el.addEventListener('contextmenu', e => e.preventDefault());
});
$('play').addEventListener('click', () => start(nextN));
$('pause').addEventListener('click', () => setPause(true));
$('resume').addEventListener('click', () => setPause(false));
$('restart').addEventListener('click', () => start(level));
$('mute').addEventListener('click', () => { $('mute').textContent = Sfx.toggleMute() ? '\uD83D\uDD07' : '\uD83D\uDD0A'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { Sfx.stopEngine(); setPause(true); } });
const sb = $('style'), setStyle = () => { sb.textContent = 'Tampilan: ' + (style === '3d' ? '3D' : 'Kartun'); };
setStyle();
sb.addEventListener('click', () => { style = style === '3d' ? 'cartoon' : '3d'; try { localStorage.setItem('motoStyle', style); } catch (e) {} setStyle(); });
renderLevels(); hud();
})();
