'use strict';
// Sound effects and music, all synthesised with Web Audio (no audio files, nothing licensed).
// YouTube's mute and the game's pause both go through SFX.setAllowed; the music toggle only touches the music bus.
// The song is our own: a funky 8-bar junkyard loop (i-iv-VII-III in A minor feel, bass + clav + kit), one voicing per zone.
const SFX = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, echo = null, noise = null;
  let allowed = true, musicOn = true, nextT = 0, step = 0;
  const MUSIC_VOL = 0.26;
  function init() {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = musicOn ? MUSIC_VOL : 0; musicBus.connect(master);
      echo = ac.createDelay(1); echo.delayTime.value = 0.27;
      const fb = ac.createGain(), wet = ac.createGain(); fb.gain.value = 0.28; wet.gain.value = 0.35;
      echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musicBus);
      noise = ac.createBuffer(1, ac.sampleRate * 0.8, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    apply();
  }
  function apply() { if (!ac) return; if (allowed) ac.resume().catch(() => {}); else ac.suspend().catch(() => {}); }
  function setAllowed(on) { allowed = !!on; apply(); }
  function setMusic(on) {
    musicOn = !!on;
    if (ac && musicBus) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(musicOn ? MUSIC_VOL : 0, ac.currentTime, 0.15); }
  }
  function nudge() { if (ac && allowed && ac.state !== 'running') ac.resume().catch(() => {}); }   // fallback on input only
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function voice(type, freq, t0, dur, vol, dest, slideTo, attack) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.03);
    return g;
  }
  // filtered noise burst: crunches, whooshes, hats, booms
  function burst(t0, dur, vol, dest, type, f0, f1, q) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = type || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random() * 0.3); s.stop(t0 + dur + 0.02);
  }
  function ready() { return ac && allowed && ac.state === 'running'; }
  function tone(freq, dur, type, vol, slideTo, delay) { if (!ready()) return; voice(type || 'sine', freq, ac.currentTime + (delay || 0), dur, vol || 0.2, sfxBus, slideTo); }
  function nz(dur, vol, type, f0, f1, q, delay) { if (!ready()) return; burst(ac.currentTime + (delay || 0), dur, vol, sfxBus, type, f0, f1, q); }

  // ---------- the song ----------
  // 16 steps per bar (sixteenths), 8 bars. Bass riff + clav stabs + lead hook on bars 5-8.
  const ROOT = [45, 45, 50, 50, 43, 43, 48, 52];                       // A A D D G G C E
  const BASS = [0, 0, 12, 0, 0, 10, 0, 7, 0, 0, 12, 0, 10, 0, 7, 5];   // offsets, 0 at index 0 = root
  const BASS_ON = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1];
  const LEAD = [
    [69, 0, 0, 72, 0, 74, 0, 76, 0, 0, 74, 0, 72, 0, 69, 0], [67, 0, 69, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [74, 0, 0, 77, 0, 79, 0, 81, 0, 0, 79, 0, 77, 0, 74, 0], [72, 0, 74, 0, 0, 0, 76, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [79, 0, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74], [71, 0, 0, 0, 74, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [72, 0, 0, 76, 0, 79, 0, 84, 0, 0, 83, 0, 79, 0, 76, 0], [76, 0, 80, 0, 0, 0, 83, 0, 81, 0, 0, 0, 0, 0, 0, 0]];
  function musicTick(zone, fast) {
    if (!ready() || !musicOn) { nextT = 0; return; }
    const sd = 60 / (fast ? 128 : 112) / 4;                            // sixteenths
    if (nextT < ac.currentTime - 0.1) nextT = ac.currentTime + 0.05;   // after a stall, pick up from now
    while (nextT < ac.currentTime + 0.25) { playStep(step, nextT, sd, zone); nextT += sd; step = (step + 1) % 128; }
  }
  function playStep(i, t, sd, z) {
    const bar = i >> 4, s = i & 15, root = ROOT[bar];
    // bass
    if (BASS_ON[s]) {
      const n = root - 12 + BASS[s];
      voice(z >= 2 ? 'sawtooth' : 'square', hz(n), t, sd * 0.9, z >= 2 ? 0.07 : 0.06, musicBus);
      voice('sine', hz(n), t, sd * 1.1, 0.16, musicBus);
    }
    // clav stabs on the off-beats
    if (s === 2 || s === 6 || s === 10 || s === 14) {
      const tri = [root + 12, root + 15 + (bar === 6 || bar === 7 ? 1 : 0), root + 19];
      for (const n of tri) voice(z === 1 ? 'triangle' : 'square', hz(n), t, sd * 0.6, z === 1 ? 0.05 : 0.025, musicBus);
    }
    // lead hook (second half of the loop), echoed
    if (bar >= 0) {
      const m = LEAD[bar][s];
      if (m && (i >= 64 || z >= 1)) {
        const lv = z === 3 ? 0.07 : 0.09;
        voice(z === 3 ? 'sawtooth' : 'triangle', hz(m), t, sd * 2.4, lv, musicBus);
        voice('sine', hz(m), t, sd * 2.4, 0.05, echo);
      }
    }
    // kit
    if (s === 0 || s === 8 || (s === 11 && bar % 2)) voice('sine', 130, t, 0.14, 0.32, musicBus, 42);
    if (s === 4 || s === 12) burst(t, 0.12, 0.16, musicBus, 'bandpass', 1800, 900, 0.8);
    if (s % 2 === 0) burst(t, 0.03, s % 4 === 2 ? 0.06 : 0.035, musicBus, 'highpass', 8000);
    if (z >= 2 && s === 15) burst(t, 0.18, 0.05, musicBus, 'highpass', 6000);
  }

  return {
    init, setAllowed, setMusic, nudge, musicTick,
    get state() { return ac ? ac.state : 'none'; },
    click() { tone(880, 0.04, 'triangle', 0.06); },
    nope() { tone(180, 0.12, 'sawtooth', 0.05, 140); },
    stretch(p) { tone(180 + p * 320, 0.06, 'triangle', 0.03); },
    launch(perfect) {
      tone(140, 0.25, 'sawtooth', 0.09, 60);                    // the tyre twang
      nz(0.5, 0.25, 'bandpass', 600, 3500, 0.7);                // whoosh
      if (perfect) [784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, null, 0.05 + i * 0.05));
    },
    smash(k) {                                                  // crunchy metal: noise crunch + a clank, pitch up with the combo
      const p = 1 + Math.min(k || 0, 10) * 0.06;
      nz(0.12, 0.35, 'bandpass', 2200 * p, 700, 1.4);
      tone(520 * p, 0.09, 'square', 0.06, 260 * p);
      tone(1400 * p, 0.05, 'triangle', 0.05, null, 0.02);
    },
    slam() { tone(1200, 0.28, 'sine', 0.08, 300); nz(0.25, 0.18, 'bandpass', 900, 300, 1); },
    slamHit() { nz(0.3, 0.5, 'lowpass', 1600, 120, 0.7); tone(90, 0.3, 'sine', 0.4, 40); },
    bounce(v) { tone(150 + Math.min(v, 30) * 6, 0.12, 'sine', 0.12, 90); nz(0.08, 0.08, 'lowpass', 600, 200); },
    clang() { tone(620, 0.35, 'triangle', 0.12, 590); tone(931, 0.3, 'sine', 0.08, 900); nz(0.06, 0.2, 'highpass', 3000); },
    spring() { tone(220, 0.35, 'sine', 0.2, 880); tone(330, 0.3, 'triangle', 0.06, 1320, 0.03); },
    jet() { nz(0.9, 0.22, 'bandpass', 400, 1600, 0.6); tone(110, 0.9, 'sawtooth', 0.05, 220); },
    drone() { tone(240, 0.5, 'sawtooth', 0.04, 300); nz(0.5, 0.06, 'bandpass', 2500, 2500, 6); },
    boom() { nz(0.7, 0.55, 'lowpass', 2000, 80, 0.6); tone(70, 0.6, 'sine', 0.45, 30); },
    gold() { [988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(f, 0.14, 'triangle', 0.1, null, i * 0.05)); },
    scrap() { tone(1500, 0.04, 'square', 0.025); tone(2000, 0.06, 'sine', 0.04, null, 0.03); },
    land() { nz(0.15, 0.12, 'lowpass', 500, 120); },
    wall(broke) {
      nz(broke ? 1.0 : 0.5, broke ? 0.6 : 0.45, 'lowpass', 1800, 60, 0.5); tone(60, 0.6, 'sine', 0.5, 30);
      if (broke) { nz(0.8, 0.25, 'bandpass', 3000, 800, 0.8, 0.1); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'square', 0.05, null, 0.25 + i * 0.07)); }
    },
    tally() { tone(1300 + Math.random() * 300, 0.03, 'square', 0.02); },
    upgrade() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.05, null, i * 0.05)); },
    record() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, null, i * 0.08)); },
    cheer(big) { (big ? [523, 659, 784, 1047, 1319, 1568] : [784, 988, 1319]).forEach((f, i) => tone(f, 0.12, 'triangle', 0.12, null, i * 0.07)); },
    zap() { nz(0.35, 0.25, "highpass", 4000); [1200, 900, 1500, 700].forEach((f, i) => tone(f, 0.05, "square", 0.05, null, i * 0.05)); },
    meteor() { nz(1.2, 0.4, "bandpass", 300, 2500, 0.6); tone(220, 1.0, "sawtooth", 0.06, 60); },
    whistle() { tone(2100, 0.75, "sine", 0.07, 700); tone(2140, 0.75, "sine", 0.03, 720); },
    dizzy() { [880, 740, 880, 740].forEach((f, i) => tone(f, 0.08, 'sine', 0.05, null, i * 0.09)); },
  };
})();
