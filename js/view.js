'use strict';
// The street: camera, world drawing, juice (sparks, flying scrap, shake, slow motion, pop-up words).
let canvas = null, ctx = null, W = 0, H = 0, DPR = 1;
const CAM = { x: 0, y: 0, z: 1, ppm: 30, base: 30, shake: 0, sx: 0, sy: 0 };
const FX = { parts: [], texts: [], flyers: [], flash: 0, banner: null, bump: 0 };

function baseScale() { return Math.min(W, H) / 12.5; }
function groundY0() { return Math.round(H - Math.max(H * 0.15, CAM.base * 2.2)); }
function anchorX() { return W * (W > H ? 0.28 : 0.24); }
function wx2s(x) { return (x - CAM.x) * CAM.ppm + CAM.sx; }
function wy2s(y) { return groundY0() - (y - CAM.y) * CAM.ppm + CAM.sy; }
function resetCamera() {
  CAM.base = baseScale(); CAM.z = 1; CAM.ppm = CAM.base; CAM.y = 0; CAM.shake = 0;
  CAM.x = -anchorX() / CAM.ppm - 0.4;
  FX.parts.length = 0; FX.texts.length = 0; FX.flyers.length = 0; FX.banner = null;
}
function heroDrawPos() {
  const R = S.run;
  if (!R) return { x: 0, y: 2 };
  if (S.shot) return { x: S.shot.x, y: S.shot.y };                     // flying into the coach
  if (R.phase === "aim") return heroAimPos(aimPull(), S.pull ? S.pull.a : 0.2);   // in the slingshot (pulled back to aim)
  const a = S.interp || 1;
  return { x: R.px + (R.x - R.px) * a, y: R.py + (R.y - R.py) * a };
}
function updateCamera(dt) {
  const R = S.run;
  CAM.base = baseScale();
  if (!R || R.phase === 'aim') {
    CAM.z += (1 - CAM.z) * Math.min(1, dt * 3); CAM.ppm = CAM.base * CAM.z;
    CAM.x += ((-anchorX() / CAM.ppm - 0.4) - CAM.x) * Math.min(1, dt * 4); CAM.y += (0 - CAM.y) * Math.min(1, dt * 4);
  } else {
    const p = heroDrawPos(), sp = Math.hypot(R.vx, R.vy);
    // zoom out with speed, and enough to keep the ground in view when flying high (short landscape screens)
    const fit = (groundY0() - H * 0.2) / ((p.y + 1.5) * CAM.base);
    const zt = Math.max(0.42, Math.min(1, fit, Math.max(0.55, 1 - Math.max(0, sp - 16) / 95 - Math.max(0, p.y - 8) / 80)));
    CAM.z += (zt - CAM.z) * Math.min(1, dt * 1.5); CAM.ppm = CAM.base * CAM.z;
    CAM.x = p.x - anchorX() / CAM.ppm;
    const topRoom = (groundY0() - H * 0.24) / CAM.ppm;
    const ty = Math.max(0, p.y + 1 - topRoom);
    CAM.y += (ty - CAM.y) * Math.min(1, dt * 6);
  }
  if (R && R.phase === "fly" && R.vx > speedLimit(R) * 1.12) shake(Math.min(0.45, (R.vx / speedLimit(R) - 1.12) * 1.5));   // way over the limit: the screen shakes
  CAM.shake = Math.max(0, CAM.shake - dt * 2.2);
  const s = CAM.shake * CAM.shake * CAM.base * 0.5;
  CAM.sx = (Math.random() - 0.5) * s; CAM.sy = (Math.random() - 0.5) * s;
}
function shake(k) { CAM.shake = Math.min(1.2, Math.max(CAM.shake, k)); }

// ---------- particles ----------
function part(o) { if (FX.parts.length < 360) FX.parts.push(Object.assign({ life: 0.6, t: 0, rot: 0, vr: 0, g: 18, size: 0.15 }, o)); }
function burstAt(x, y, n, kind, col, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (spd || 8) * (0.4 + Math.random() * 0.8);
    part({ x, y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + 2, kind, col, life: 0.4 + Math.random() * 0.5, size: 0.08 + Math.random() * 0.14, vr: (Math.random() - 0.5) * 20, rot: Math.random() * 6 });
  }
}
function puff(x, y, n, col, size) { for (let i = 0; i < n; i++) part({ x: x + (Math.random() - 0.5) * 0.8, y: y + Math.random() * 0.3, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 1.5, kind: 'puff', col: col || 'rgba(230,220,200,0.8)', life: 0.5 + Math.random() * 0.4, size: (size || 0.35) * (0.7 + Math.random() * 0.6), g: -1 }); }
function popText(text, x, y, col, size, life) { FX.texts.push({ text, x, y, col: col || '#fff', size: size || 1, t: 0, life: life || 0.9 }); if (FX.texts.length > 24) FX.texts.shift(); }
function scrapFlyers(x, y, n) { for (let i = 0; i < Math.min(n, 7); i++) FX.flyers.push({ x: wx2s(x), y: wy2s(y), vx: (Math.random() - 0.4) * CAM.base * 6, vy: -CAM.base * (4 + Math.random() * 4), t: 0, d: 0.05 * i }); }

function onRunEvent(ev) {
  const R = S.run, p = heroDrawPos();
  switch (ev.k) {
    case 'launch': {                                   // you hit the coach (or missed them)
      const hit = S.coachHit || { kind: ev.perfect ? 'crit' : 'hit' }, hx = R.x, hy = R.y;
      SFX.launch(ev.perfect); shake(ev.perfect ? 0.7 : hit.kind === 'miss' ? 0.15 : 0.4);
      if (hit.kind === 'miss') { popText('MISS!', hx + 0.5, hy + 1.8, '#c9d3e6', 1.3, 1.0); SFX.nope(); break; }
      if (hit.kind === 'shock') { SFX.zap(); FX.flash = 0.25; burstAt(hx + 0.3, hy, 18, 'spark', '#7ff3ff', 12); popText('ZAP! Slow start', hx + 0.5, hy + 2, '#7ff3ff', 1.3, 1.2); break; }
      SFX.clang();
      burstAt(hx + 0.3, hy, ev.perfect ? 22 : 10, 'spark', ev.perfect ? '#ffd447' : '#ffffff', ev.perfect ? 14 : 8);
      if (ev.perfect) { popText('CRIT!', hx + 0.5, hy + 2.2, '#ffd447', 1.8, 1.2); FX.flash = 0.3; S.slow = 0.3; S.slowT = 0.25; }
      else popText('HIT', hx + 0.5, hy + 1.8, '#ffffff', 1.1, 0.8);
      if (hit.dmg) popText('-' + hit.dmg, hx + 1.4, hy + 0.6, '#ff6b6b', 0.9, 0.9);
      if (hit.ko) { popText('KO! +' + fmt(hit.bonus), hx + 1.5, hy + 3.6, '#ff7a2f', 1.7, 1.8); SFX.gold(); scrapFlyers(hx, hy, 7); S.slow = 0.35; S.slowT = 0.5; }
      break;
    }
    case 'breakfree': SFX.clang(); SFX.cheer(false); popText('BROKE FREE! +' + Math.round(ev.v * 3.6) + ' km/h', ev.x + 1, ev.y + 2.4, '#7ff3e8', 1.2, 1.1); burstAt(ev.x, ev.y, 14, 'bolt', '#ffd447', 9); break;
    case 'pogotap': if (ev.good) SFX.slam(); else { SFX.nope(); popText('TOO EARLY!', ev.x + 3, ev.y + 2, '#c9d3e6', 1.0, 0.8); } break;
    case 'pogomiss': SFX.bounce(9); popText(ev.early ? 'WASTED' : 'MISSED', ev.x + 3, ev.y + 1.5, '#c9d3e6', 0.9, 0.7); break;
    case 'pogopunch': SFX.spring(); shake(0.4); popText('PUNCH ' + ev.n + '!', ev.x + 3, ev.y + 2, '#ffd447', 1.2 + ev.n * 0.15, 0.9); burstAt(ev.x, 0.3, 10, 'spark', '#ffffff', 9); break;
    case 'pogoboom': SFX.boom(); shake(1.0); FX.flash = 0.35; popText('POGO BOOM! +' + Math.round(ev.v * 3.6) + ' km/h', ev.x + 1, ev.y + 3, '#ff7a2f', 1.5, 1.3); burstAt(ev.x, ev.y, 24, 'spark', '#ff7a2f', 16); break;
    case 'cannon': SFX.boom(); shake(0.5); popText(ev.hit ? 'NEXT CANNON!' : (ev.tap ? 'MISFIRE!' : 'TOO SLOW! MISFIRE'), p.x + 2.5, p.y + 2, ev.hit ? '#3cff9e' : '#ff6b6b', 1.1, 0.9); puff(p.x + 1, p.y, 8, 'rgba(90,80,90,0.7)', 0.6); break;
    case 'cannonboom': SFX.boom(); SFX.gold(); shake(1.0); FX.flash = 0.35; S.slow = 0.4; S.slowT = 0.3; popText((ev.perfect ? 'PERFECT GOLDEN BLAST! +' : 'BLAST +') + Math.round(ev.v * 3.6) + ' km/h', ev.x + 2, ev.y + 2.5, '#ffd447', 1.5, 1.3); burstAt(ev.x, ev.y, 26, 'spark', '#ffd447', 16); break;
    case 'rollburst': SFX.boom(); shake(0.9); FX.flash = 0.3; popText('BURST! ' + ev.n + ' flattened, +' + Math.round(ev.v * 3.6) + ' km/h', ev.x + 1, ev.y + 3, '#ffb03b', 1.3, 1.3); burstAt(ev.x, ev.y, 30, 'bolt', '#9aa5b5', 14); break;
    case 'meteor':                                     // touched the clouds: down you come as a meteor
      SFX.meteor(); FX.flash = 0.35; shake(0.6);
      popText('METEOR!', ev.x + 2, ev.y - 2, '#ff9b3d', 1.8, 1.3); if (ev.scrap) popText('+' + fmt(ev.scrap), ev.x + 2, ev.y - 4, '#ffe680', 1.0);
      burstAt(ev.x, ev.y, 24, 'spark', '#ffd447', 14);
      break;
    case 'wallblast':
      SFX.boom(); shake(1.0); FX.flash = 0.3; popText('WALL BLAST!', ev.x + 1, ev.y + 2.5, '#ff7a2f', 1.5, 1.1);
      burstAt(ev.x + 0.5, ev.y, 24, 'spark', '#ff7a2f', 16); puff(ev.x, ev.y, 8, 'rgba(70,60,80,0.8)', 0.7);
      break;
    case 'wind': SFX.launch(true); popText('SECOND WIND!', p.x + 1.5, p.y + 2.6, '#7ff3e8', 1.3, 1.1); break;
    case 'smash': {
      const B = BOTS[ev.type];
      if (ev.wave) {                                   // caught in a slam's shockwave: lighter effects, one sound for the wave
        burstAt(ev.x, ev.y, 8, 'spark', '#ffd447', 9); burstAt(ev.x, ev.y, 3, 'bolt', '#9aa5b5', 6);
        if (ev.scrap > 0) { popText('+' + fmt(ev.scrap), ev.x, ev.y + 1.6, '#ffe680', 0.7); scrapFlyers(ev.x, ev.y, Math.ceil(Math.log2(1 + ev.scrap) / 2)); }
        if (ev.boom) { SFX.boom(); burstAt(ev.x, ev.y, 14, 'spark', '#ff7a2f', 14); popText('BOOM!', ev.x, ev.y + 3, '#ff5b3c', 1.4); }

        break;
      }
      SFX.smash(ev.combo);
      burstAt(ev.x, ev.y, ev.slam ? 18 : 10, 'spark', '#ffd447', ev.slam ? 13 : 9);
      burstAt(ev.x, ev.y, 5, 'bolt', '#9aa5b5', 7);
      if (ev.scrap > 0) { popText('+' + fmt(ev.scrap), ev.x, ev.y + 1.6, '#ffe680', 0.8); scrapFlyers(ev.x, ev.y, Math.ceil(Math.log2(1 + ev.scrap))); }
      if (ev.slam) { SFX.slamHit(); shake(0.6); popText('SLAM!', ev.x + 1, ev.y + 3.2, '#ff7a2f', 1.6, 1.0); }
      else shake(0.2);
      if (ev.combo >= 3 && !ev.plow) popText('x' + ev.combo + ' COMBO', p.x + 1.5, p.y + 2.4, '#7ff3e8', 0.9 + Math.min(ev.combo, 10) * 0.04);
      if (ev.ride === 'jet') { SFX.jet(); popText('JETBOT RIDE!', p.x + 2, p.y + 3, '#ff9b3d', 1.2); }
      if (ev.ride === 'pogo') { SFX.spring(); popText('POGO! Tap to punch', p.x + 2, p.y + 3, '#ffd447', 1.1); }
      if (ev.ride === 'cannon') { SFX.clang(); popText('LOADED!', p.x + 2, p.y + 3, '#ffd447', 1.2); }
      if (ev.ride === 'roll') { SFX.jet(); popText('ROLL OUT!', p.x + 2, p.y + 3, '#ffb03b', 1.2); }
      if (ev.swap) popText('SWAP!', p.x + 1, p.y + 4, '#7ff3e8', 0.9);
      if (ev.ride === 'drone') { SFX.drone(); popText('LIFT!', p.x + 1.5, p.y + 2.5, '#bfe6ff', 1.1); }
      if (ev.type === 'spring') { SFX.spring(); popText('BOING!', ev.x, ev.y + 2.5, '#ffb347', 1.3); }
      if (B.boom) { SFX.boom(); shake(0.9); FX.flash = 0.35; burstAt(ev.x, ev.y, 20, 'spark', '#ff7a2f', 16); puff(ev.x, ev.y, 10, 'rgba(70,60,80,0.8)', 0.8); popText('BOOM!', ev.x, ev.y + 3, '#ff5b3c', 1.7); }
      if (ev.type === 'gold') { SFX.gold(); burstAt(ev.x, ev.y, 16, 'spark', '#fff3a0', 12); popText('JACKPOT!', ev.x, ev.y + 3.2, '#ffd447', 1.5, 1.2); }
      if (ev.flare) { SFX.launch(true); shake(0.7); burstAt(ev.x, ev.y, 20, 'spark', '#ff5b3c', 15); burstAt(ev.x, ev.y, 12, 'spark', '#ffd447', 12); popText('WHOOOSH!', ev.x + 1, ev.y + 3, '#ffb03b', 1.5, 1.1); }
      if (ev.fan) { SFX.cheer(false); popText('+1 SLAM!', ev.x + 0.5, ev.y + 2.8, '#7ff3e8', 1.3, 1.1); }
      break;
    }
    case 'clang': SFX.clang(); shake(0.5); burstAt(ev.x - 0.4, ev.y, 10, 'spark', '#ffffff', 8); popText('GRABBED!', ev.x, ev.y + 2.4, '#ff6b6b', 1.3); break;
    case 'skid': SFX.bounce(6); for (let i = 0; i < 10; i++) part({ x: ev.x, y: 0.2, vx: (Math.random() - 0.3) * 6, vy: 2 + Math.random() * 4, kind: 'drop', col: '#8fe1ff', life: 0.6 }); popText('SLIP!', ev.x, ev.y + 2, '#8fe1ff', 1.1); break;
    case 'bounce': SFX.bounce(ev.v); puff(p.x, 0.15, 4 + Math.min(6, ev.v / 4 | 0)); if (ev.v > 14) shake(0.18); break;
    case 'thud': SFX.slamHit(); shake(0.5); puff(p.x, 0.15, 12, null, 0.5); popText(ev.auto ? 'BIG DROP!' : 'SLAM!', p.x + 1, 3.2, '#ff7a2f', 1.4, 0.9); break;
    case 'wave':                                       // the shockwave ring, as wide as it reaches
      FX.parts.push({ kind: 'ring', x: ev.x, y: 0.1, t: 0, life: ev.meteor ? 0.8 : 0.5, size: ev.r * 2 });
      if (ev.meteor) { SFX.boom(); shake(1.2); FX.flash = 0.4; S.slow = 0.3; S.slowT = 0.8; popText('METEOR STRIKE!', ev.x + 1, 6, '#ff9b3d', 1.6, 1.4); puff(ev.x, 0.3, 16, 'rgba(90,70,60,0.8)', 0.9); }
      else if (ev.n >= 2) { SFX.smash(ev.n + 3); popText(ev.n + ' SMASHED!', ev.x, 4.6, '#7ff3e8', 1.1 + Math.min(ev.n, 8) * 0.05, 1.1); shake(0.8); }
      break;
    case 'bigfall': popText('BIG DROP!', ev.x + 1, 5, '#ff7a2f', 1.2, 0.9); break;
    case 'wallin':
      SFX.wall(false); shake(1.1); FX.flash = 0.25;
      for (let i = 0; i < 16; i++) part({ x: ev.x, y: p.y + (Math.random() - 0.5) * 2, vx: -2 + Math.random() * 8, vy: Math.random() * 8, kind: 'chunk', col: WALL_LOOK[wallArt(Math.max(0, WALLS.findIndex(w => w.name === ev.name)))].body, life: 1.1, size: 0.25 + Math.random() * 0.35, vr: (Math.random() - 0.5) * 12 });
      break;
    case 'wallchunk': {
      SFX.clang(); shake(0.45);
      const col = WALL_LOOK[wallArt(Math.max(0, WALLS.findIndex(w => w.name === ev.name)))];
      for (let i = 0; i < 8; i++) part({ x: ev.x, y: ev.y + (Math.random() - 0.5) * 2.5, vx: 2 + Math.random() * 7, vy: 1 + Math.random() * 7, kind: 'chunk', col: i % 3 ? col.body : col.trim, life: 1.0, size: 0.2 + Math.random() * 0.35, vr: (Math.random() - 0.5) * 14 });
      break;
    }
    case 'slam': SFX.slam(); break;
    case 'unride': puff(p.x, p.y, 4, 'rgba(255,255,255,0.7)'); break;
    case 'wall': {
      shake(1.1); FX.flash = 0.3; SFX.wall(ev.broke);
      for (let i = 0; i < (ev.broke ? 40 : 18); i++) part({ x: ev.x + Math.random() * 0.5, y: 1 + Math.random() * 8, vx: (ev.broke ? 6 : -3) + (Math.random() - 0.5) * 10, vy: Math.random() * 9, kind: 'chunk', col: WALL_LOOK[wallArt(Math.max(0, WALLS.findIndex(w => w.name === ev.name)))].body, life: 1.2, size: 0.25 + Math.random() * 0.4, vr: (Math.random() - 0.5) * 12 });
      if (ev.broke) {
        popText(ev.fresh ? 'FIRST BREAK!' : 'SMASHED THROUGH!', p.x + 3, p.y + 3, '#ffd447', 1.6, 1.6); S.slow = 0.3; S.slowT = 0.7;
        if (ev.fresh) popText('It took everything you had!', p.x + 3, p.y + 1.6, '#fff', 0.8, 2.2);   // why this launch stops here
        else if (ev.name === WALLS[WALLS.length - 1].name && PHYS.END_FADE > 0) popText('Past the gate your limit drops!', p.x + 3, p.y + 1.6, '#fff', 0.8, 2.4);   // the endless stretch
      }
      else popText(Math.round(ev.depth / ev.len * 100) + '% THROUGH', ev.x + 1, p.y + 3, '#ff6b6b', 1.4, 1.5);
      break;
    }
    case 'zone': FX.banner = { text: ZONES[ev.z].name.toUpperCase(), t: 0 }; break;
    case 'stop': SFX.dizzy(); break;
  }
}

function updateFX(dt) {
  for (const p of FX.parts) {
    p.t += dt;
    if (p.kind === 'ring') continue;
    p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.y < 0.05 && p.kind !== 'puff') { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.6; }
  }
  FX.parts = FX.parts.filter(p => p.t < p.life);
  for (const t of FX.texts) t.t += dt;
  FX.texts = FX.texts.filter(t => t.t < t.life);
  const tx = LAYOUT ? LAYOUT.scrapX : W - 60, ty = LAYOUT ? LAYOUT.scrapY : 40;
  for (const f of FX.flyers) {
    f.t += dt; if (f.t < f.d) continue;
    const k = f.t - f.d;
    if (k < 0.25) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += CAM.base * 30 * dt; }
    else { const a = Math.min(1, dt * 9 * (1 + (k - 0.25) * 6)); f.x += (tx - f.x) * a; f.y += (ty - f.y) * a; }
    if (k > 0.25 && Math.abs(f.x - tx) + Math.abs(f.y - ty) < CAM.base * 0.5) { f.done = true; FX.bump = 0.25; SFX.scrap(); }
  }
  FX.flyers = FX.flyers.filter(f => !f.done && f.t < 2.5);
  FX.flash = Math.max(0, FX.flash - dt);
  FX.bump = Math.max(0, FX.bump - dt);
  if (FX.banner) { FX.banner.t += dt; if (FX.banner.t > 2.4) FX.banner = null; }
}

function zoneWeights() {
  const cx = CAM.x + W / CAM.ppm * 0.5, z = zoneAt(cx), from = ZONES[z].from;
  const k = z > 0 ? Math.min(1, (cx - from) / 25) : 1;
  return k < 1 ? [[z - 1, 1], [z, k]] : [[z, 1]];
}

function drawWorld(t) {
  const c = ctx, R = S.run, m = CAM.ppm;
  prepareTiles(W, H, CAM.base);
  const zw = zoneWeights();
  drawBackdrop(c, W, H, CAM, groundY0() + CAM.sy, zw, t, CAM.base);
  const gl = drawGround(c, W, H, CAM, groundY0() + CAM.sy, zw, t) ;
  const vx0 = CAM.x - 2, vx1 = CAM.x + W / m + 2;
  // distance markers and the best-distance flag
  c.font = `800 ${Math.round(m * 0.45)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let d = Math.ceil(vx0 / 50) * 50; d < vx1; d += 50) {
    if (d <= 0) continue;
    const x = wx2s(d);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - m * 0.05, gl - m * 1.6, m * 0.1, m * 1.6);
    rrect(c, x - m * 0.75, gl - m * 2.3, m * 1.5, m * 0.75, m * 0.15); fs(c, '#fff8e6', Math.max(1, m * 0.05));
    c.fillStyle = '#3b2f4a'; c.fillText(d + 'm', x, gl - m * 1.92);
  }
  if (S.save.best > 5 && S.save.best > vx0 && S.save.best < vx1) {
    const x = wx2s(S.save.best);
    tube(c, [x, gl, x, gl - m * 3.4], m * 0.12, '#3b2f4a', Math.max(1, m * 0.04));
    c.beginPath(); c.moveTo(x, gl - m * 3.4); c.lineTo(x + m * 1.6, gl - m * 3.0); c.lineTo(x, gl - m * 2.6); fs(c, '#ffd447', Math.max(1, m * 0.05));
    c.fillStyle = '#3b2f4a'; c.font = `900 ${Math.round(m * 0.36)}px system-ui, sans-serif`; c.fillText('BEST', x + m * 0.65, gl - m * 3.0);
  }
  drawProps(c, W, CAM, gl, 0, t);
  // walls
  for (let i = 0; i < WALLS.length; i++) {
    const w = WALLS[i]; if (w.x + w.len < vx0 - 4 || w.x > vx1) continue;
    const live = R && R.walls.find(v => v.i === i);
    if (live) {                                          // still standing this launch: ploughed part = rubble
      const front = R.inWall === live ? R.wallDepth : R.wallHit && R.wallHit.name === w.name ? R.wallHit.depth : 0;
      drawLongWall(c, i, wx2s(w.x), gl, m, w.len, front, t, -10);
    } else drawLongWall(c, i, wx2s(w.x), gl, m, w.len, w.len, t, -10);   // broken for good: a trail of rubble
  }
  // slingshot + hero
  const p = heroDrawPos();
  const aiming = R && R.phase === 'aim' && !S.shot;
  const pull = aiming ? { dx: p.x - 0.1 - POUCH.x, dy: p.y - 0.6 - POUCH.y, q: aimPull() } : 0;   // the pouch sits under the hero
  if (vx0 < 3) drawSlingshot(c, wx2s(0), gl, m, pull, t, false);
  if (vx0 < COACH_X + 4) drawLaunchCoach(c, gl, m, t);
  if (aiming && S.pull && !S.modal) drawAimGuide(c, p, m, t);
  drawClouds(c, m, t, vx0, vx1);
  // robots
  if (R) for (const b of R.bots) {
    if (!b.alive || b.x < vx0 || b.x > vx1) continue;
    const mood = b.panic > 0.4 ? 'panic' : 'calm';
    drawBot(c, b, wx2s(b.x), wy2s(b.y), m, t, mood);
  }
  drawHeroNow(c, p, t, m);
  if (R && R.claw && R.phase === "fly") drawClaw(c, p, m, t);
  if (vx0 < 3) drawSlingshot(c, wx2s(0), gl, m, pull, t, true);
  // particles
  for (const q of FX.parts) {
    const x = wx2s(q.x), y = wy2s(q.y), a = 1 - q.t / q.life;
    if (q.kind === 'ring') { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = m * 0.25 * a; ell(c, x, y, q.size * m * (q.t / q.life), q.size * m * 0.3 * (q.t / q.life)); c.stroke(); continue; }
    c.globalAlpha = Math.min(1, a * 1.5);
    if (q.kind === 'puff') { c.fillStyle = q.col; ell(c, x, y, q.size * m * (1 + q.t * 2), q.size * m * (1 + q.t * 2)); c.fill(); }
    else if (q.kind === 'spark') { c.strokeStyle = q.col; c.lineWidth = Math.max(1.5, m * 0.08); c.beginPath(); c.moveTo(x, y); c.lineTo(x - q.vx * m * 0.025, y + q.vy * m * 0.025); c.stroke(); }
    else if (q.kind === 'bolt') { c.save(); c.translate(x, y); c.rotate(q.rot); c.fillStyle = q.col; c.fillRect(-q.size * m, -q.size * m * 0.4, q.size * m * 2, q.size * m * 0.8); c.restore(); }
    else if (q.kind === 'chunk') { c.save(); c.translate(x, y); c.rotate(q.rot); rrect(c, -q.size * m, -q.size * m * 0.7, q.size * m * 2, q.size * m * 1.4, q.size * m * 0.2); fs(c, q.col, Math.max(1, m * 0.04)); c.restore(); }
    else if (q.kind === 'drop' || q.kind === 'flame') { c.fillStyle = q.col; ell(c, x, y, q.size * m, q.size * m); c.fill(); }
    else if (q.kind === 'confetti') { c.save(); c.translate(x, y); c.rotate(q.rot); c.fillStyle = q.col; c.fillRect(-q.size * m, -q.size * m * 0.5, q.size * m * 2, q.size * m); c.restore(); }
  }
  c.globalAlpha = 1;
  for (const tx of FX.texts) {
    const k = tx.t / tx.life, x = wx2s(tx.x), y = wy2s(tx.y + k * 1.2);
    const sc = (k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15))) * tx.size;
    c.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    drawWord(c, tx.text, x, y, CAM.base * 0.62 * sc, tx.col);
  }
  WORDS.length = 0;
  c.globalAlpha = 1;
  // speed lines
  if (R && R.phase === 'fly') {
    const sp = Math.hypot(R.vx, R.vy);
    if (sp > 26) {
      const n = Math.min(14, (sp - 26) / 3 | 0) + 2;
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = Math.max(1.5, CAM.base * 0.05);
      for (let i = 0; i < n; i++) { const y = ((i * 0.618 + t * 0.7) % 1) * H, x = ((i * 0.37 + t * sp * 0.05) % 1) * W; c.beginPath(); c.moveTo(x, y); c.lineTo(x - CAM.base * (1 + sp / 20), y); c.stroke(); }
    }
  }
  if (FX.flash > 0) { c.fillStyle = `rgba(255,255,255,${FX.flash})`; c.fillRect(0, 0, W, H); }
}
// The coach stands on a tyre stack in front of the slingshot (coachState in game.js says where they are and what
// they're doing). Before the launch: ready pose, a crouch before the tell, then the tell (pad up: hit now = CRIT)
// with a glow and a "!" bubble; Pidge hops, Professor Nutz pops between spots, Big Mo sparks, Dr. Hoot flies.
// After the hit: knocked back, or spun over with dizzy stars on a KO.
function drawLaunchCoach(c, gl, m, t) {
  const hit = S.coachHit, lw = Math.max(1, m * 0.05), tx = wx2s(COACH_X);
  // tyre stack
  for (let i = 0; i < 2; i++) { const ty = gl - m * (0.25 + i * 0.42); ell(c, tx, ty, m * 0.8, m * 0.24); fs(c, '#2d2b3a', lw); ell(c, tx, ty, m * 0.42, m * 0.11); c.fillStyle = '#4a4757'; c.fill(); }
  if (hit && hit.pos && hit.kind !== 'miss') {         // after the hit
    const s = hit.pos, x = wx2s(s.x), feet = wy2s(s.feet), k = Math.min(1, (S.t - hit.t0) / 0.35);
    if (hit.ko) {
      c.save(); c.translate(x + k * m * 0.8, feet); c.rotate(k * 1.45); drawCoachBody(c, hit.id, 0, 0, m * s.h, 'ready', t); c.restore();
      for (let i = 0; i < 3; i++) { const a = S.t * 4 + i * 2.1; star(c, x + m * 1.6 + Math.cos(a) * m * 0.7, feet - m * 0.9 + Math.sin(a) * m * 0.25, m * 0.16, '#ffd447'); }
    } else {
      const back = Math.sin(k * Math.PI) * (hit.crit ? 0.5 : 0.25);
      c.save(); c.translate(x + back * m, feet); c.rotate(back * 0.6); drawCoachBody(c, hit.id, 0, 0, m * s.h, 'ready', t); c.restore();
    }
    return;
  }
  const co = hit ? COACH[hit.id] : curCoach(), s = hit ? hit.pos : coachState(S.aimT, co);
  const x = wx2s(s.x), feet = wy2s(s.feet), live = S.view === 'aim' && !S.modal && !hit;
  const up = s.up && live && !s.any, sy = s.windup && live ? 0.93 : 1, bob = up || s.any ? 0 : Math.sin(t * 3) * m * 0.03;
  if (s.feet > TYRES_H + 0.2 || co.twist === 'fly') {  // off the ground: a shadow under them
    c.fillStyle = 'rgba(0,0,0,0.18)'; ell(c, x, gl - (Math.abs(s.x - COACH_X) < 0.5 ? m * TYRES_H : 0), m * 0.7, m * 0.15); c.fill();
  }
  if (up) {                                            // the CRIT moment: glow behind the coach
    const cy = feet - m * s.h * 0.55, gr = c.createRadialGradient(x, cy, 0, x, cy, m * 2.4);
    gr.addColorStop(0, 'rgba(255,230,90,0.75)'); gr.addColorStop(1, 'rgba(255,230,90,0)');
    c.fillStyle = gr; c.fillRect(x - m * 2.6, cy - m * 2.6, m * 5.2, m * 5.2);
  }
  if (s.poof > 0) for (let i = 0; i < 6; i++) {        // Professor Nutz just popped in
    const a = i * 1.05 + t, r = m * (0.6 + (1 - s.poof) * 1.2);
    c.fillStyle = `rgba(235,225,255,${s.poof * 0.8})`; ell(c, x + Math.cos(a) * r, feet - m * s.h * 0.5 + Math.sin(a) * r * 0.7, m * 0.5 * s.poof + m * 0.2, m * 0.45 * s.poof + m * 0.2); c.fill();
  }
  const flyTilt = co.twist === 'fly' ? Math.sin(t * 9) * 0.12 : 0;
  c.save(); c.translate(x, feet + bob); c.scale(1, sy); drawCoachBody(c, co.id, 0, 0, m * s.h, up ? 'tell' : 'ready', t, flyTilt); c.restore();
  if (co.twist === 'fly') {                            // flapping wings
    for (const d of [-1, 1]) { c.save(); c.translate(x + d * m * s.h * 0.28, feet - m * s.h * 0.6); c.rotate(d * (0.5 + Math.sin(t * 22) * 0.5)); ell(c, d * m * 0.45, 0, m * 0.55, m * 0.2); fs(c, '#a98b6a', lw); c.restore(); }
  }
  if (s.spark && live) {                               // Big Mo is electrified: don't hit him now!
    c.strokeStyle = '#7ff3ff'; c.lineWidth = Math.max(2, m * 0.08); c.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + Math.floor(t * 20) * 0.7, r0 = m * s.h * 0.35;
      let px = x + Math.cos(a) * r0, py = feet - m * s.h * 0.5 + Math.sin(a) * r0 * 1.2;
      c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += Math.cos(a) * m * 0.35 + (Math.random() - 0.5) * m * 0.4; py += Math.sin(a) * m * 0.35 + (Math.random() - 0.5) * m * 0.4; c.lineTo(px, py); }
      c.stroke();
    }
    const bx = x + m * 1.25, by = feet - m * (s.h * 1.05), r = m * 0.42;
    ell(c, bx, by, r, r); fs(c, '#e53935', lw * 1.4); outlined(c, '!', bx, by + r * 0.05, r * 1.5, '#fff');
  }
  if (up) {                                            // "!" bubble
    const bx = x + m * 1.25, by = feet - m * (s.h * 1.05), r = m * 0.42;
    ell(c, bx, by, r, r); fs(c, '#fff', lw * 1.4); outlined(c, '!', bx, by + r * 0.05, r * 1.5, '#f0661f');
  }
}
// While you pull back: a dotted line from the hero towards the coach. Yellow = you'll hit them, white = a miss.
function drawAimGuide(c, p, m, t) {
  const a = S.pull.a, s = coachState(S.aimT), dx = Math.max(0.5, s.x - 0.55 - p.x), yAt = p.y + Math.tan(a) * dx;
  const res = Math.abs(a) < 1.45 ? shotResult(s, yAt) : 'miss', col = res === 'miss' ? 'rgba(255,255,255,0.75)' : res === 'shock' ? '#7ff3ff' : '#ffd447';
  const len = Math.hypot(dx, yAt - p.y) + 1.2, n = Math.floor(len / 0.55);
  c.fillStyle = col;
  for (let i = 1; i <= n; i++) {
    const d = i * 0.55 - ((t * 2) % 0.55), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    ell(c, wx2s(x), wy2s(y), m * 0.09, m * 0.09); c.fill();
  }
  if (res !== 'miss') { const x = wx2s(p.x + dx), y = wy2s(yAt); c.strokeStyle = col; c.lineWidth = Math.max(2, m * 0.08); ell(c, x, y, m * 0.45, m * 0.45); c.stroke(); }
}
// The cloud layer high above the street: touch it and you come down as a meteor
function drawClouds(c, m, t, vx0, vx1) {
  const y0 = wy2s(PHYS.CLOUD_Y);
  if (y0 < -m * 3 || y0 > H + m) return;
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (let x = Math.floor(vx0 / 3.2) * 3.2; x < vx1 + 3; x += 3.2) {
    const k = Math.sin(x * 1.7) * 0.5 + 0.5, sx = wx2s(x), r = m * (1.1 + k * 0.7);
    ell(c, sx, y0 - r * 0.3, r * 1.3, r); c.fill(); ell(c, sx + r, y0, r, r * 0.8); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(0, Math.min(y0, H) - m * 1.6 - H, W, H);   // the cloud deck above
}
// the BIG DROP target: a pulsing ring on the street where you will land, with a down arrow that grows as you get close
function drawDropTarget(c, bd, t, m) {
  const gl = wy2s(0), k = clamp(1 - bd.t / 1.4, 0, 1), pulse = 1 + Math.sin(t * 14) * 0.08;
  let x = wx2s(bd.x);
  if (x > W - m * 1.2) {                               // landing off the right of the screen: an arrow on the edge
    x = W - m * 1.2; const y = gl - m * 1.2, a = m * (0.7 + k * 0.4) * pulse;
    c.beginPath(); c.moveTo(x + a, y); c.lineTo(x - a * 0.4, y - a * 0.8); c.lineTo(x - a * 0.4, y + a * 0.8); c.closePath();
    c.fillStyle = '#ff7a2f'; c.fill(); c.strokeStyle = OL; c.lineWidth = Math.max(1.5, m * 0.06); c.stroke();
    return;
  }
  const rx = m * (2.2 - k * 0.8) * pulse, ry = rx * 0.28;
  c.lineWidth = Math.max(2, m * 0.14);
  c.strokeStyle = `rgba(255,122,47,${0.45 + 0.5 * k})`; ell(c, x, gl, rx, ry); c.stroke();
  c.strokeStyle = `rgba(255,212,71,${0.35 + 0.5 * k})`; ell(c, x, gl, rx * 0.55, ry * 0.55); c.stroke();
  const ah = m * (0.9 + k * 0.6), ay = gl - m * (1.6 + Math.sin(t * 10) * 0.15) - ah;
  c.beginPath(); c.moveTo(x, ay + ah); c.lineTo(x - ah * 0.6, ay + ah * 0.35); c.lineTo(x - ah * 0.22, ay + ah * 0.35); c.lineTo(x - ah * 0.22, ay);
  c.lineTo(x + ah * 0.22, ay); c.lineTo(x + ah * 0.22, ay + ah * 0.35); c.lineTo(x + ah * 0.6, ay + ah * 0.35); c.closePath();
  c.fillStyle = '#ff7a2f'; c.fill(); c.strokeStyle = OL; c.lineWidth = Math.max(1.5, m * 0.06); c.stroke();
}
// x for a centred word that stays on screen and clear of the slam gauge on the left edge ("SMASHED THROUGH!" was cut)
function onScreenX(c, text, x, size) {
  c.font = `900 ${Math.round(size)}px system-ui, "Segoe UI", sans-serif`;
  const L = LAYOUT, hw = c.measureText(text).width / 2 + size * 0.15, left = L.pad + Math.max(18, L.U * 1.15) + 6, right = W - L.pad;
  return right - left < hw * 2 ? (left + right) / 2 : Math.min(right - hw, Math.max(left + hw, x));
}
// words drawn this frame (the claw label, then the pop-ups): a later word that would overlap one takes the nearest free slot
const WORDS = [];
function placeWord(c, text, x, y, size) {
  const L0 = LAYOUT, room = (W - L0.pad) - (L0.pad + Math.max(18, L0.U * 1.15) + 6);
  c.font = `900 ${Math.round(size)}px system-ui, "Segoe UI", sans-serif`;
  const w0 = c.measureText(text).width * 1.1;        // too wide for the screen ("FIRST TIME THROUGH!" on a phone): shrink it
  if (w0 > room) size *= room / w0;
  x = onScreenX(c, text, x, size);                   // also sets c.font for the measure below
  const L = LAYOUT, hw = c.measureText(text).width / 2 + size * 0.1, hh = size * 0.62;
  const roof = L.pad + (L.portrait ? L.plateH + L.pad : 0) + L.U * 4.4;   // under the distance bar (short landscape screens)
  const hits = (yy) => WORDS.some(p => Math.abs(p.x - x) < p.hw + hw && Math.abs(p.y - yy) < p.hh + hh);
  if (hits(y)) {                                     // nearest free slot just above or below a word already there
    const slots = [];
    for (const p of WORDS) slots.push(p.y - p.hh - hh - 2, p.y + p.hh + hh + 2);   // +2 px: an exact touch rounds to an overlap
    const best = slots.filter(yy => yy - hh >= roof && yy + hh <= H && !hits(yy)).sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
    if (best !== undefined) y = best;
  }
  WORDS.push({ x, y, hw, hh });
  return { x, y, size };
}
function drawWord(c, text, x, y, size, col) { const q = placeWord(c, text, x, y, size); outlined(c, text, q.x, q.y, q.size, col); }
function outlined(c, text, x, y, size, col) {
  c.font = `900 ${Math.round(size)}px system-ui, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.strokeStyle = OL; c.lineWidth = size * 0.22; c.strokeText(text, x, y);
  c.fillStyle = col; c.fillText(text, x, y);
}

function drawHeroNow(c, p, t, m) {
  const R = S.run, s = PHYS.HR * m;
  const x = wx2s(p.x), y = wy2s(p.y);
  if (S.shot) { drawHero(c, x, y, s, 'ball', S.t * 18, t, 'fierce'); return; }          // flying into the coach
  if (!R || R.phase === 'aim') { drawHero(c, x, y - s * 0.2, s * 0.95, 'sit', S.pull ? -S.pull.a * 0.6 : 0, t, S.view === 'aim' && (S.pull || coachState(S.aimT).up) ? 'fierce' : 'grin'); return; }
  // shadow
  const gl = wy2s(0), h = Math.max(0, p.y - PHYS.HR);
  c.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.28 - h * 0.012)})`; ell(c, x, gl, s * (1.1 - Math.min(0.6, h * 0.03)), s * 0.22); c.fill();
  if (R.ride && R.ride.k === 'jet') {
    const tilt = -Math.atan2(R.vy, R.vx) * 0.6;
    c.save(); c.translate(x, y + s * 0.9); c.rotate(tilt);
    const fl = s * (1.2 + Math.random() * 0.6);
    c.beginPath(); c.moveTo(-s * 1.3, -s * 0.15); c.lineTo(-s * 1.3 - fl, 0); c.lineTo(-s * 1.3, s * 0.15); c.fillStyle = '#ffb03b'; c.fill();
    rrect(c, -s * 1.35, -s * 0.32, s * 2.4, s * 0.64, s * 0.3); fs(c, '#f05a3c', s * 0.1);
    c.beginPath(); c.moveTo(s * 1.05, -s * 0.32); c.lineTo(s * 1.6, 0); c.lineTo(s * 1.05, s * 0.32); fs(c, SHELL, s * 0.08);
    c.restore();
    if (Math.random() < 0.6) part({ x: p.x - 1.3, y: p.y - 0.9, vx: -R.vx * 0.3, vy: (Math.random() - 0.5) * 2, kind: 'flame', col: Math.random() < 0.5 ? '#ffd447' : '#ff7a2f', life: 0.25, size: 0.18, g: 0 });
    drawHero(c, x, y - s * 0.1, s * 0.85, 'sit', tilt, t, 'fierce'); return;
  }
  if (R.ride && R.ride.k === 'drone') {
    drawBot(c, { type: 'drone', x: 0, t, dir: 1, panic: 0 }, x, y - s * 0.6, m, t, 'panic');
    drawHero(c, x, y + s * 0.3, s, 'fly', -0.25, t, 'wow'); return;
  }
  if (R.ride && R.ride.k === 'pogo') {                 // on the Pogobot: tap just before the spring hits the street
    const rd = R.ride, im = artImg('bot-pogo'), ph = PHYS.POGO_H * m * 1.9, win = pogoWindow(R), now = win <= PHYS.POGO_WIN && !rd.armed && !rd.early;
    const gx = x + R.vx * Math.min(win, 2) * m, gl = wy2s(0);  // the landing spot, glowing green while it's time to tap
    c.strokeStyle = now ? '#3cff9e' : rd.armed ? '#ffd447' : 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(2, m * (now ? 0.2 : 0.1));
    if (win < 3) { ell(c, gx, gl, m * 1.2, m * 0.32); c.stroke(); }
    if (im) sprite(c, im, x, y + PHYS.POGO_H * m + s * 0.2, ph, 0, false, 'feet');
    else { tube(c, [x, y, x, y + PHYS.POGO_H * m], s * 0.25, '#e8423f', s * 0.08); }
    drawHero(c, x, y - s * 0.3, s * 0.9, rd.armed ? 'dive' : 'sit', 0, t, 'fierce');
    for (let i = 0; i < 3; i++) {                      // the three chances: punched (orange), missed (grey), to come
      const col = i < rd.hits ? '#ff7a2f' : i < rd.chances ? '#7a7f8c' : 'rgba(255,255,255,0.75)';
      ell(c, x - s * 1.1 + i * s * 1.1, y - s * 2.1, s * 0.3, s * 0.3); fs(c, col, s * 0.06);
    }
    const say = rd.armed ? 'PUNCH!' : rd.early ? 'TOO EARLY' : now ? 'NOW!' : 'Tap just before you land';
    drawWord(c, say, x + s * 2.6, y - s * 1.4, CAM.base * (now || rd.armed ? 0.75 : 0.45), now ? '#3cff9e' : rd.armed ? '#ffd447' : rd.early ? '#c9d3e6' : '#fff');
    return;
  }
  if (R.ride && R.ride.k === 'cannon') {               // in a Cannonbot: the barrel swings, fire when it points at the next one
    const rd = R.ride, ch = 1.6 * m;
    rd.next.forEach((n, i) => { if (i >= rd.stage) { const im = artImg(i === 1 ? 'bot-cannon-gold' : 'bot-cannon'); if (im) sprite(c, im, wx2s(n.x), wy2s(n.y), ch, 0, false); else { ell(c, wx2s(n.x), wy2s(n.y), m * 0.8, m * 0.6); fs(c, i === 1 ? '#ffd447' : '#9aa5b5', s * 0.08); } } });
    if (rd.fly) { drawHero(c, x, y, s, 'ball', S.t * 20, t, 'fierce'); return; }
    const a = cannonAim(rd), on = Math.abs(a - rd.tgt) <= PHYS.CANNON_TOL, gold = rd.stage === 2;
    // the aim: a dotted line along the barrel; the target (next cannon, or the best blast angle) lights up when lined up
    c.fillStyle = on ? '#3cff9e' : 'rgba(255,255,255,0.8)';
    for (let d = 1.2; d < (gold ? 9 : PHYS.CANNON_GAP); d += 0.8) { ell(c, x + Math.cos(a) * d * m, y - Math.sin(a) * d * m, m * 0.1, m * 0.1); c.fill(); }
    if (!gold) { const n = rd.next[rd.stage]; c.strokeStyle = on ? '#3cff9e' : '#ffd447'; c.lineWidth = Math.max(2, m * 0.14); ell(c, wx2s(n.x), wy2s(n.y), m * 1.3, m * 1.3); c.stroke(); }
    else { c.strokeStyle = on ? '#3cff9e' : 'rgba(255,212,71,0.8)'; c.lineWidth = Math.max(2, m * 0.16); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(rd.tgt) * 8 * m, y - Math.sin(rd.tgt) * 8 * m); c.stroke(); }
    const im = artImg(gold ? 'bot-cannon-gold' : 'bot-cannon'), shake = Math.sin(S.t * 40) * s * 0.04 * Math.min(1, rd.t / PHYS.CANNON_HOLD);
    drawHero(c, x - Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.75, 'sit', -a, t, 'fierce');
    if (im) sprite(c, im, x + shake, y, ch, -a, false); else { ell(c, x, y, m * 0.8, m * 0.6); fs(c, '#9aa5b5', s * 0.08); }
    const k = 1 - rd.t / PHYS.CANNON_HOLD;           // the fuse: fire before it burns down
    c.fillStyle = 'rgba(20,14,38,0.7)'; rrect(c, x - s * 1.4, y - s * 2.6, s * 2.8, s * 0.35, s * 0.15); c.fill();
    c.fillStyle = '#ff7a2f'; rrect(c, x - s * 1.4, y - s * 2.6, s * 2.8 * Math.max(0, k), s * 0.35, s * 0.15); c.fill();
    drawWord(c, on ? 'FIRE!' : gold ? 'Aim up the arrow...' : 'Aim at the next cannon...', x, y - s * 3.3, CAM.base * (on ? 0.8 : 0.5), on ? '#3cff9e' : '#ffd447');
    return;
  }
  if (R.ride && R.ride.k === 'roll') {                 // a junk ball rolling along, growing with every robot
    const im = artImg('junkball'), r = s * (1.5 + Math.min(1, R.ride.n * 0.08));
    if (im) { c.save(); c.translate(x, y + s * 0.6 - r * 0.6); c.rotate(R.rot); c.drawImage(im, -r, -r, r * 2, r * 2); c.restore(); }
    else { ell(c, x, y, r, r); fs(c, '#8a7f75', s * 0.1); }
    if (Math.random() < 0.5) part({ x: p.x - 1, y: 0.3, vx: -R.vx * 0.2, vy: 2 + Math.random() * 3, kind: 'puff', col: 'rgba(200,190,170,0.7)', life: 0.4, size: 0.3, g: -1 });
    return;
  }
  if (R.phase === 'end' || R.phase === 'done') { drawHero(c, x, y - s * 0.15, s * 0.95, 'dizzy', 0, t); return; }
  if (R.slide) { drawHero(c, x, y + s * 0.15, s, 'fly', 0, t, 'wow', 0); return; }
  // a fall high enough for a free BIG DROP: a target on the street where you'll land, and you curl into a fiery dive
  if (R.meteor) {                                      // a METEOR: a ball of fire with a long tail
    const ang = Math.atan2(-R.vy, R.vx), tl = s * 5;
    const gr = c.createLinearGradient(x, y, x - Math.cos(ang) * tl, y + Math.sin(ang) * tl);
    gr.addColorStop(0, 'rgba(255,200,60,0.9)'); gr.addColorStop(1, 'rgba(255,80,30,0)');
    c.strokeStyle = gr; c.lineWidth = s * 1.8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(ang) * tl, y + Math.sin(ang) * tl); c.stroke();
    for (let i = 0; i < 2; i++) part({ x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + (Math.random() - 0.5) * 0.6, vx: -R.vx * 0.2, vy: -R.vy * 0.2, kind: 'flame', col: Math.random() < 0.5 ? '#ffd447' : '#ff5b3c', life: 0.35, size: 0.3, g: 0 });
    const bdm = bigDropAhead(R) || { x: R.x + R.vx * (R.y / -R.vy), t: R.y / -R.vy };
    drawDropTarget(c, bdm, t, m);
    drawHero(c, x, y, s * 1.1, 'dive', 0.12, t, 'fierce', 0); return;
  }
  const bd = R.vy < 0 ? bigDropAhead(R) : null;
  if (bd) {
    drawDropTarget(c, bd, t, m);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = Math.max(1.5, s * 0.12); c.lineCap = 'round';   // wind streaks: faster fall, more streaks
    for (let i = 0; i < Math.min(7, 2 + (bd.v - PHYS.AUTO_SLAM_VY) / 4); i++) {
      const sx = x + (((i * 0.37 + 0.1) % 1) - 0.5) * s * 3.4, k = (t * 3 + i * 0.29) % 1, sy = y - s * (1.2 + k * 3);
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - s * (1 + bd.v / 25)); c.stroke();
    }
    const gr = c.createRadialGradient(x, y, s * 0.3, x, y, s * 2.1);
    gr.addColorStop(0, 'rgba(255,190,60,0.65)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
    c.fillStyle = gr; c.fillRect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
    if (Math.random() < 0.8) part({ x: p.x + (Math.random() - 0.5) * 0.8, y: p.y + 0.5, vx: -R.vx * 0.15, vy: 3 + Math.random() * 3, kind: 'flame', col: Math.random() < 0.5 ? '#ffd447' : '#ff7a2f', life: 0.3, size: 0.2, g: 0 });
    drawHero(c, x, y, s, 'dive', 0.12, t, 'fierce', 0);
    if (bd.t < 0.9) drawWord(c, 'BIG DROP!', x + s * 1.2, y - s * 2.4 - Math.sin(t * 18) * s * 0.1, CAM.base * 0.7, '#ff7a2f');
    return;
  }
  if (R.slamming) { drawHero(c, x, y, s, 'dive', 0.12, t, 'fierce', 0); return; }
  if (R.spin > 5) { drawHero(c, x, y, s, 'ball', R.rot, t, 'grin'); return; }
  const ang = -Math.atan2(R.vy, Math.max(1, R.vx));
  drawHero(c, x, y, s, 'fly', ang, t, R.vy < -12 ? 'wow' : 'grin', R.squash);
}
// A Security Bot's claw clamped on the hero: slam before it lets go (the bar) to get the stolen speed back
function drawClaw(c, p, m, t) {
  const R = S.run, x = wx2s(p.x), y = wy2s(p.y), s = PHYS.HR * m, im = artImg('claw'), k = R.claw.t / PHYS.CLAW_S;
  if (im) sprite(c, im, x + s * 0.2, y + s * 0.5, s * 1.6, Math.sin(t * 30) * 0.08, true);
  else { c.strokeStyle = '#ffd447'; c.lineWidth = s * 0.3; c.beginPath(); c.arc(x, y + s * 0.5, s * 0.7, 0.3, Math.PI - 0.3); c.stroke(); }
  c.fillStyle = 'rgba(20,14,38,0.7)'; rrect(c, x - s * 1.4, y - s * 2.2, s * 2.8, s * 0.32, s * 0.15); c.fill();
  c.fillStyle = '#ff5b5b'; rrect(c, x - s * 1.4, y - s * 2.2, s * 2.8 * Math.max(0, k), s * 0.32, s * 0.15); c.fill();
  const say = 'SLAM to break free! -' + Math.round(R.claw.lost * 3.6) + ' km/h';
  drawWord(c, say, x, y - s * 2.9, CAM.base * 0.5, '#ff6b6b');
}
