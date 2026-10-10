/* Audio disintesis dengan WebAudio: tanpa file eksternal. */
const Sfx = (() => {
  let ac, master, eng, filt, engG, muted = false, step = 0, timer;
  const lead = [392, 440, 523, 440, 392, 330, 392, 294];
  const bass = [98, 98, 131, 131, 110, 110, 147, 147];

  function init() {
    if (ac) { ac.resume && ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : .6; master.connect(ac.destination);
    eng = ac.createOscillator(); eng.type = 'sawtooth';
    filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
    engG = ac.createGain(); engG.gain.value = 0;
    eng.connect(filt); filt.connect(engG); engG.connect(master); eng.start();
    timer = setInterval(music, 240);
  }
  function tone(f, d, type, vol, when = 0) {
    if (!ac) return;
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d);
  }
  function music() {
    if (!ac || muted) return;
    const i = step++ % 8;
    tone(lead[i], .22, 'square', .035);
    if (i % 2 === 0) tone(bass[i], .4, 'triangle', .09);
  }
  function engine(ratio, gas, nos) {
    if (!ac) return;
    const t = ac.currentTime;
    eng.frequency.setTargetAtTime(45 + ratio * 120 + (gas ? 25 : 0) + (nos ? 70 : 0), t, .08);
    filt.frequency.setTargetAtTime(300 + ratio * 800, t, .1);
    engG.gain.setTargetAtTime(gas || nos ? .13 : .06, t, .1);
  }
  function stopEngine() { if (ac) engG.gain.setTargetAtTime(0, ac.currentTime, .05); }
  function crash() {
    if (!ac) return;
    const n = ac.sampleRate * .5, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; g.gain.value = .5; s.connect(g); g.connect(master); s.start();
    tone(90, .4, 'sawtooth', .2);
  }
  function coin() { tone(880, .08, 'square', .06); tone(1320, .12, 'square', .06, .06); }
  function pick() { tone(660, .1, 'triangle', .08); tone(990, .16, 'triangle', .08, .08); }
  function land() { tone(120, .12, 'sine', .25); }
  function win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, 'square', .08, i * .13)); }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : .6;
    return muted;
  }
  return { init, pick, coin, engine, stopEngine, crash, land, win, toggleMute };
})();
