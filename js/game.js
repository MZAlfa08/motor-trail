(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const GOAL = 9000, R = 17, L = 44, GRAV = 900, ACC = 420, MAXV = 620;
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

/* ---------- medan & rintangan ---------- */
const amp = x => Math.min(1.35, Math.max(0, (x - 300) / 1500));
const gy = x => 420 + (55 * Math.sin(x * .004) + 28 * Math.sin(x * .011 + 1) + 40 * Math.sin(x * .0023 + 3)) * amp(x);
const slopeAt = x => Math.atan2(gy(x + 4) - gy(x - 4), 8);
const spikes = [];
for (let i = 0; 1300 + i * 700 < GOAL - 400; i++) spikes.push(1300 + i * 700 + (i * 137) % 220);

/* ---------- state ---------- */
const K = { gas: 0, brake: 0, fwd: 0, back: 0 };
let b, state = 'menu', t0 = 0, time = 0, camX = 0, camY = 0, parts = [], endTimer = 0;
let best = 0;
try { best = +localStorage.getItem('motoBeachBest') || 0; } catch (e) {}

function newBike() { return { x: 120, y: gy(120) - R - 2, vx: 0, vy: 0, a: 0, av: 0, g: true, wr: 0 }; }
function start() {
  b = newBike(); parts = []; state = 'play'; t0 = performance.now(); time = 0;
  $('overlay').classList.remove('show'); Sfx.init();
}
b = newBike();

function crash() {
  if (state !== 'play') return;
  state = 'crash'; endTimer = .9; Sfx.crash(); Sfx.stopEngine();
  for (let i = 0; i < 20; i++) parts.push({ x: b.x, y: b.y - 20, vx: (Math.random() - .3) * 300 + b.vx * .4,
    vy: -Math.random() * 350, life: 1, c: ['#f0541e', '#2a2118', '#7ed321', '#f4efe6'][i % 4] });
}
function finish() {
  state = 'done'; Sfx.stopEngine(); Sfx.win();
  if (!best || time < best) { best = time; try { localStorage.setItem('motoBeachBest', best); } catch (e) {} }
  showOverlay('Selesai! 🏁', 'Waktu: ' + time.toFixed(1) + ' dtk', 'Main lagi');
}
function showOverlay(title, msg, btn) {
  $('msg').textContent = title + ' ' + msg;
  $('best').textContent = best ? 'Terbaik: ' + best.toFixed(1) + ' dtk' : '';
  $('play').textContent = btn; $('overlay').classList.add('show');
}

/* ---------- update ---------- */
function update(dt) {
  const dead = state === 'crash';
  const lean = dead ? 0 : (K.fwd ? 1 : 0) - (K.back ? 1 : 0);
  if (state === 'play') time = (performance.now() - t0) / 1000;

  b.vy += GRAV * dt;
  if (b.g) {
    const sl = slopeAt(b.x), tx = Math.cos(sl), ty = Math.sin(sl);
    let v = b.vx * tx + b.vy * ty;
    if (!dead && K.gas && v < MAXV) v += ACC * dt;
    if (!dead && K.brake) v = v > 0 ? Math.max(0, v - 800 * dt) : Math.max(-120, v - 300 * dt);
    v *= 1 - (dead ? 3 : .25) * dt;
    v = clamp(v, -150, 700);
    b.vx = v * tx; b.vy = v * ty; b.wr += v / R * dt;
  } else {
    b.av = clamp((b.av + lean * 13 * dt) * (1 - .6 * dt), -7, 7);
    b.a += b.av * dt; b.wr += b.vx / R * dt * .5;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < 60) { b.x = 60; b.vx = Math.max(0, b.vx); }

  const c = Math.cos(b.a), s = Math.sin(b.a), hl = L / 2;
  const rx = b.x - c * hl, ry = b.y - s * hl, fx = b.x + c * hl, fy = b.y + s * hl;
  const pen = Math.max(ry + R - gy(rx), fy + R - gy(fx));
  if (pen > 0) b.y -= pen;
  if (pen > -3) {
    const sl = Math.atan2(gy(fx) - gy(rx), fx - rx), tx = Math.cos(sl), ty = Math.sin(sl);
    const away = b.vx * ty - b.vy * tx;
    if (away <= 40) {
      if (pen <= 0) b.y -= pen;
      if (!b.g && !dead) {
        if (Math.abs(angDiff(b.a, sl)) > 1.05) crash(); else Sfx.land();
      }
      const v = b.vx * tx + b.vy * ty;
      b.vx = v * tx; b.vy = v * ty; b.g = true;
      if (dead) { b.av = b.vx * .02; b.a += b.av * dt; }
      else { b.a += angDiff(sl + lean * .35, b.a) * Math.min(1, 10 * dt); b.av = 0; }
    } else b.g = false;
  } else b.g = false;
  if (dead) b.a += b.av * dt;

  if (!dead && state === 'play') {
    const hx = b.x + 40 * s, hy = b.y - 40 * c;          // kepala pengendara
    if (hy + 8 > gy(hx)) crash();
    for (const sx of spikes) {
      if (Math.abs(sx - b.x) > 80) continue;
      for (const wx of [rx, fx]) {
        const wy = wx === rx ? ry : fy;
        if (Math.abs(wx - sx) < 34 && wy + R > gy(sx) - 18) crash();
      }
    }
    if (b.x >= GOAL) finish();
    Sfx.engine(Math.abs(b.vx) / MAXV, K.gas);
  }
  if (dead) { endTimer -= dt; if (endTimer <= 0) { state = 'over'; showOverlay('Jatuh!', 'Coba lagi, jaga posisi motor saat mendarat.', 'Ulangi'); } }

  parts.forEach(p => { p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * .8; });
  parts = parts.filter(p => p.life > 0);

  $('time').textContent = time.toFixed(1);
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
function wheel(x, y, rot) {
  ctx.fillStyle = '#2a2118'; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8d3a0'; ctx.beginPath(); ctx.arc(x, y, R - 5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { const a = rot + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (R - 5), y + Math.sin(a) * (R - 5)); ctx.stroke(); }
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
}
function drawBike() {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  const hl = L / 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  wheel(-hl, 0, b.wr); wheel(hl, 0, b.wr);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 4;                       // fork & swingarm
  ctx.beginPath(); ctx.moveTo(hl, 0); ctx.lineTo(hl - 8, -22); ctx.moveTo(-hl, 0); ctx.lineTo(-6, -8); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hl - 8, -22); ctx.lineTo(hl - 14, -28); ctx.stroke();
  ctx.fillStyle = '#f0541e'; ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 2; // badan
  ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(-10, -20); ctx.lineTo(12, -22); ctx.lineTo(20, -12); ctx.lineTo(10, -2); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.moveTo(-32, -13); ctx.lineTo(-16, -15); ctx.lineTo(-14, -9); ctx.lineTo(-30, -6); ctx.fill();
  ctx.fillStyle = '#2a2118'; ctx.fillRect(-20, -23, 22, 4);
  ctx.strokeStyle = '#f0541e'; ctx.lineWidth = 9;                    // torso
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-2, -36); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-2, -34); ctx.lineTo(hl - 14, -28); ctx.stroke(); // lengan
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(6, -6); ctx.stroke();          // kaki
  ctx.strokeStyle = '#7ed321'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(9, -2); ctx.stroke();
  ctx.fillStyle = '#f0541e'; ctx.beginPath(); ctx.arc(-1, -42, 9, 0, 7); ctx.fill(); // helm
  ctx.fillStyle = '#7ed321'; ctx.fillRect(-10, -46, 20, 3);
  ctx.fillStyle = '#3a7bd5'; ctx.fillRect(2, -44, 8, 6);
  ctx.restore();
}

function draw() {
  const vw = W / S, vh = H / S;
  camX = b.x - vw * .3;
  camY += (b.y - vh * .62 - camY) * .12;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6fbdee'); g.addColorStop(.6, '#cfe9f5');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(W * .1, H * .08, 60 * S + 20, 0, 7); ctx.fill();
  const hy = (330 - camY * .5) * S;                                   // laut
  ctx.fillStyle = '#2f9fd8'; ctx.fillRect(0, hy, W, H - hy);
  ctx.fillStyle = '#5fc4e8'; ctx.fillRect(0, hy + 40 * S, W, 18 * S);
  const sx = ((W * .6 - camX * .03 * S) % (W + 400 * S) + W + 400 * S) % (W + 400 * S) - 200 * S; // kapal
  ctx.save(); ctx.translate(sx, hy); ctx.scale(S, S);
  ctx.fillStyle = '#e9edf0'; ctx.fillRect(-90, -26, 180, 26); ctx.fillRect(-60, -42, 110, 16);
  ctx.fillStyle = '#3a7bd5'; for (let i = -84; i < 84; i += 10) ctx.fillRect(i, -18, 5, 4);
  ctx.fillStyle = '#d63a2f'; ctx.fillRect(-12, -58, 16, 16); ctx.restore();

  ctx.setTransform(dpr * S, 0, 0, dpr * S, -camX * dpr * S, -camY * dpr * S);
  const x0 = camX - 20, x1 = camX + vw + 20, bot = camY + vh + 20;
  ctx.fillStyle = '#e8b866'; ctx.beginPath(); ctx.moveTo(x0, bot);
  for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, gy(x));
  ctx.lineTo(x1, bot); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d49a46'; ctx.lineWidth = 10; ctx.beginPath();
  for (let x = x0; x <= x1; x += 8) ctx[x === x0 ? 'moveTo' : 'lineTo'](x, gy(x) + 16);
  ctx.stroke();
  ctx.strokeStyle = '#c98a36'; ctx.lineWidth = 4; ctx.beginPath();
  for (let x = x0; x <= x1; x += 8) ctx[x === x0 ? 'moveTo' : 'lineTo'](x, gy(x));
  ctx.stroke();

  for (let i = Math.floor((x0 - 100) / 520); i <= Math.ceil(x1 / 520); i++) {
    const px = 250 + i * 520 + ((i * 97) % 160 + 160) % 160;
    if (px > 150 && px < GOAL + 200) { palm(px, gy(px) + 4, .9 + (i % 3) * .1, i % 2 ? 1 : -1);
      umbrella(px + 260, gy(px + 260) + 2, i % 2 ? '#ffc800' : '#2f9fd8'); }
  }
  for (const sp of spikes) {                                          // duri
    if (sp < x0 - 60 || sp > x1 + 60) continue;
    ctx.fillStyle = '#3d6b2a'; ctx.beginPath(); ctx.ellipse(sp, gy(sp) - 4, 40, 9, 0, 0, 7); ctx.fill();
    for (let dx = -34; dx <= 34; dx += 9) { const yy = gy(sp + dx);
      ctx.fillStyle = '#2d4f1f'; ctx.beginPath(); ctx.moveTo(sp + dx - 5, yy); ctx.lineTo(sp + dx, yy - 24); ctx.lineTo(sp + dx + 5, yy); ctx.fill(); }
  }
  ctx.fillStyle = '#2a2118'; ctx.fillRect(GOAL - 3, gy(GOAL) - 110, 6, 110); // garis finis
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#2a2118' : '#f4efe6'; ctx.fillRect(GOAL + 3 + j * 12, gy(GOAL) - 110 + i * 12, 12, 12); }

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
const map = { ArrowUp: 'gas', w: 'gas', ArrowDown: 'brake', s: 'brake', ArrowLeft: 'back', a: 'back', ArrowRight: 'fwd', d: 'fwd' };
addEventListener('keydown', e => {
  const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k) { K[k] = 1; e.preventDefault(); }
  if ((e.key === 'r' || e.key === 'R') && state !== 'menu') start();
  if ((e.key === 'Enter' || e.key === ' ') && $('overlay').classList.contains('show')) { e.preventDefault(); start(); }
});
addEventListener('keyup', e => { const k = map[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) K[k] = 0; });
document.querySelectorAll('#touch button').forEach(el => {
  const k = el.dataset.k, on = v => e => { e.preventDefault(); K[k] = v; el.classList.toggle('on', !!v); };
  el.addEventListener('pointerdown', on(1)); el.addEventListener('pointerup', on(0));
  el.addEventListener('pointercancel', on(0)); el.addEventListener('pointerleave', on(0));
  el.addEventListener('contextmenu', e => e.preventDefault());
});
$('play').addEventListener('click', start);
$('mute').addEventListener('click', () => { $('mute').textContent = Sfx.toggleMute() ? '🔇' : '🔊'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) Sfx.stopEngine(); });
})();
