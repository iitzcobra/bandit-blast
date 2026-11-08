'use strict';
// Input (touch, mouse, keyboard), the game loop and the boot order YouTube's certification expects.
canvas = document.getElementById('c');
ctx = canvas.getContext('2d');

const STEP = 1 / 60;                                // physics runs in fixed steps (same as the pacing simulator)
let acc = 0;

function toggleMusic() { S.save.music = S.save.music ? 0 : 1; SFX.setMusic(!!S.save.music); S.dirty = true; saveNow(); }
function onBought(u) { FX.bump = 0.3; toast(u.name + ' is now level ' + lvl(u.id) + '!', 1.6); }
// a tap that can.t slam says why (no slams left), at most once a second
let lastHintT = -9;
function noSlamHint() {
  const R = S.run;
  if (S.tutGate) { SFX.nope(); return; }
  if (!R || R.phase !== 'fly' || R.ride || R.slamming || R.slams > 0 || S.t - lastHintT < 1) return;
  lastHintT = S.t; SFX.nope();
  const p = heroDrawPos(); popText('NO SLAMS', p.x + 1.5, p.y + 2, '#c9d3e6', 0.8, 0.7);
}

// ---------- per frame ----------
function tick(dt) {
  S.t += dt;
  if (!S.save) return;
  S.save.playS += dt;
  const R = S.run;
  if (S.view === "aim" && !S.modal) { S.aimT += dt; if (S.shot) stepShot(dt); }
  if (S.view === 'run' && R && !S.modal) {
    if (S.slowT > 0) { S.slowT -= dt; if (S.slowT <= 0) S.slow = 1; }
    const teachSlam = S.save.tut === TUT.SLAM && slamTarget(R);
    if (teachSlam) S.slow = 0.12; else if (S.slowT <= 0) S.slow = 1;
    acc += dt * S.slow;
    let n = 0;
    while (acc >= STEP && n++ < 8) {
      R.px = R.x; R.py = R.y;
      stepRun(R, STEP, { hold: S.hold });
      for (const ev of R.events) onRunEvent(ev);
      R.events.length = 0;
      acc -= STEP;
    }
    S.interp = Math.min(1, acc / STEP);
    checkMeets(R);
    const drop = R.phase === "fly" && R.vy < 0 && bigDropAhead(R);   // the BIG DROP whistle, once per fall
    if (drop && !S.dropOn) SFX.whistle();
    S.dropOn = !!drop;
    if (R.phase === 'done' && !S.modal) finishRun();
  }
  updateCamera(dt);
  updateFX(dt * (S.slow < 1 ? 0.6 : 1));
  S.saveTimer += dt * 1000;
  if (S.saveTimer >= CFG.AUTOSAVE_MS) { S.saveTimer = 0; saveNow(); }
  SFX.musicTick(Math.min(3, zoneAt(Math.max(0, R ? R.x : 0))), !!(R && R.ride));
}
// first time a new robot (or a wall) shows up: freeze and explain it
function checkMeets(R) {
  if (S.modal || S.save.tut < TUT.SLAM) return;
  const right = CAM.x + W / CAM.ppm - 1;
  for (const b of R.bots) {
    if (!b.alive || b.x > right || b.x < CAM.x || !MEET[b.type] || seen(b.type)) continue;
    markSeen(b.type); S.hold = false; openModal({ type: 'meet', what: b.type }); SFX.click(); return;
  }
  const w = R.walls[0];
  if (w && w.x < right && !seen('wall')) { markSeen('wall'); S.hold = false; openModal({ type: 'meet', what: 'wall' }); return; }
  if (R.claw && !seen('claw')) { markSeen('claw'); S.hold = false; openModal({ type: 'meet', what: 'claw' }); }
}

// ---------- input ----------
function canvasXY(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
function findHit(x, y) {
  let catchAll = null;
  for (let i = UI.hits.length - 1; i >= 0; i--) {
    const h = UI.hits[i];
    if (!inside(h.b, x, y)) continue;
    if (h.b.w >= W && h.b.h >= H) { catchAll = catchAll || h; continue; }   // full-screen catch-alls lose to real buttons
    return h;
  }
  return catchAll;
}
let downHit = null;
function onDown(e) {
  SFX.nudge();
  if (S.paused || S.phase !== 'play') return;
  const [x, y] = canvasXY(e);
  const h = findHit(x, y);
  if (S.view === 'run' && !S.modal && (!h || (h.name !== 'music' && h.name !== 'reset'))) {   // in flight: tap = slam, hold = steer a Jetbot
    S.hold = true;
    if (!trySlam()) noSlamHint();
    return;
  }
  if (!h) { if (S.modal && S.modal.type === 'meet') closeModal(); return; }
  if (!tutAllows(h.name)) { SFX.nope(); return; }
  if (h.name === "launch" && S.view === "aim") {                  // press: start pulling the slingshot back (aim)
    if (!S.shot) S.pull = { x0: x, y0: y, x, y, q: 0.55, a: autoAim(), moved: false };
    return;
  }
  downHit = h; UI.press = h.name;
}
function onMove(e) {
  const P = S.pull; if (!P || S.paused) return;
  const [x, y] = canvasXY(e), dx = x - P.x0, dy = y - P.y0, len = Math.hypot(dx, dy);
  P.x = x; P.y = y;
  if (len > 10) P.moved = true;
  if (!P.moved) return;
  P.q = clamp(0.55 + len / (LAYOUT.U * 9), 0.55, 1);                // drag back further = pulled back further
  P.a = clamp(Math.atan2(dy, Math.max(-dx, 4)), -0.6, 1.35);          // drag down-left to aim up-right (like a slingshot)
  if (S.save && S.save.tut === TUT.LAUNCH) P.a = autoAim();          // the very first launch always flies at Nana (a natural pull went over her head)
}
function onUp(e) {
  S.hold = false;
  if (S.pull) { const P = S.pull; if (P.moved) fireShot(P.a); else { S.pull = null; doLaunch(); } S.pull = null; return; }   // let go: launch (a tap aims for you)
  const h = downHit; downHit = null; UI.press = null;
  if (!h || S.paused) return;
  const [x, y] = canvasXY(e);
  if (inside(h.b, x, y)) { SFX.click(); h.fn(); }
}
function onKey(e, up) {
  if (S.phase !== 'play' || S.paused) return;
  const k = e.key;
  if (up) { if (k === ' ' || k === 'Enter' || k === 'ArrowUp') S.hold = false; return; }
  if (e.repeat && k !== 'ArrowUp') return;
  const m = S.modal;
  if (k === 'Escape') { if (m && m.type !== 'results') closeModal(); return; }     // never preventDefault on Esc
  if (k === 'm' || k === 'M') { toggleMusic(); return; }
  if ((k === 'r' || k === 'R') && canRestart() && !m) { openModal({ type: 'reset', whole: S.view === 'aim' }); return; }
  const go = (name, fn) => { if (tutAllows(name)) { SFX.click(); fn(); } else SFX.nope(); };
  if (m) {
    if (m.type === 'shop') {
      // Tab switches UPGRADES / SPECIALS / COACHES; on COACHES, keys 1-6 hire or train that coach
      if (k === "Tab") { e.preventDefault(); const ids = TABS.map(t => t[0]).filter(tabOpen), nx = ids[(ids.indexOf(UI.tab) + 1) % ids.length]; go("tab:" + nx, () => setTab(nx)); return; }
      if (UI.tab === 'coach') {
        const c = COACHES[parseInt(k, 10) - 1];
        if (c) go('coach:' + c.id, () => { UI.coachSel = c.id; buyCoach(c); });
        else if (k === 'Backspace' || k === 'x' || k === 'X') go('close', closeModal);
        return;
      }
      // arrows move around the grid (rows of 3 upgrades); Enter/Space buys the picked one
      const open = UPGRADES.filter(u => tabOf(u) === UI.tab && rowOpen(rowOf(u))), i = Math.max(0, open.findIndex(u => u.id === UI.sel));
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[k];
      if (step) { const n = open[Math.min(open.length - 1, Math.max(0, i + step))]; if (n && tutAllows('cell:' + n.id)) { UI.sel = n.id; SFX.click(); } else SFX.nope(); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); const u = UP[UI.sel]; if (u) go('buy:' + u.id, () => buyUpgrade(u)); }
      else if (k === 'Backspace' || k === 'x' || k === 'X') go('close', closeModal);
      return;
    }
    if (m.type === 'results') {
      if (k === ' ' || k === 'Enter') go('launch', launchAgain);
      else if (k === 'c' || k === 'C') go('coaches', () => { S.modal = null; openShop(); });
      else if ((k === 'v' || k === 'V') && doubleReady()) watchDouble();
      return;
    }
    if (m.type === 'reset') { if (k === 'Enter') restartPressed(!!m.whole); return; }
    if (k === ' ' || k === 'Enter') closeModal();
    return;
  }
  if (S.view === 'aim') {
    if (k === ' ' || k === 'Enter') { e.preventDefault(); go('launch', doLaunch); }
    else if (k === 'c' || k === 'C') go('coaches', openShop);
    return;
  }
  if (S.view === 'run' && (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 'ArrowUp')) {
    e.preventDefault();
    S.hold = true;
    if (k !== 'ArrowUp' && !trySlam()) noSlamHint();
  }
}

// ---------- loop ----------
let raf = 0, lastFrame = 0;
function startLoop() { if (raf) return; lastFrame = performance.now(); raf = requestAnimationFrame(frame); }
function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1); lastFrame = now;
  if (window.innerWidth !== W || window.innerHeight !== H) resize();   // safety net if a resize event was missed
  tick(dt);
  draw();
  raf = requestAnimationFrame(frame);
}

// ---------- boot: the order the certification checks expect ----------
async function boot() {
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointercancel", () => { S.hold = false; S.pull = null; downHit = null; UI.press = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => onKey(e, false));
  window.addEventListener('keyup', (e) => onKey(e, true));
  if (yt) {
    S.audioOn = yt.system.isAudioEnabled();
    yt.system.onAudioEnabledChange((on) => { S.audioOn = on; SFX.setAllowed(on && !S.paused); });
    yt.system.onPause(pause);
    yt.system.onResume(resume);
  }
  SFX.init(); SFX.setAllowed(S.audioOn && !S.paused);
  resize();
  draw();                                            // the loading screen is up...
  if (yt) yt.game.firstFrameReady();                 // ...so tell YouTube (required, before gameReady)
  const artP = loadArt(ART_FIRST, 3000);             // the first screen's ChatGPT sprites load alongside the save (drawn art if late)
  S.save = migrate(await loadSave());                // MUST finish before any saveData
  await artP;
  SFX.setMusic(!!S.save.music);
  if (!LAYOUT) resize();
  S.phase = 'play';
  newAim();
  if (!S.paused) startLoop();
  draw();
  if (yt) yt.game.gameReady();                       // only now is the game interactive
  loadArt(ART_LATER);                                // the other pictures load after gameReady (not in the initial download)
}
boot();
