'use strict';
// Every character and prop, drawn in code (no image files). Scraps the raccoon is drawn live each frame (one hero);
// robots are drawn once per size and mood into small canvases and reused; animated bits (flames, rotors) are live.
const OL = '#271d36';
const TAU = Math.PI * 2;
function rrect(c, x, y, w, h, r, add) {             // add = append to the current path (a cut-out), don't start a new one
  r = Math.min(r, w / 2, h / 2);
  if (!add) c.beginPath();
  if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }        // iOS 14-15 have no roundRect
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot || 0, 0, TAU); }
function fs(c, fill, lw) { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = OL; c.stroke(); } }
function tube(c, pts, w, fill, lw) {                // a thick rounded stroke with an outline (tails, arms, cords)
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  if (pts.length === 6) c.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  else for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (lw) { c.strokeStyle = OL; c.lineWidth = w + lw * 2; c.stroke(); }
  c.strokeStyle = fill; c.lineWidth = w; c.stroke();
}

// ---------- Scraps the raccoon ----------
const FUR = '#8e95a6', FUR_D = '#6b7184', FUR_L = '#e6e0d4', MASK = '#2c2939', RED = '#ea4a3f';
function rHead(c, r, mood, t, turn) {
  const lw = r * 0.09, fx = turn * r * 0.22;
  // ears
  for (const sx of [-1, 1]) {
    const ex = sx * r * 0.62 + fx * 0.3, ey = -r * 0.72;
    c.beginPath(); c.moveTo(ex - r * 0.3, ey + r * 0.2); c.quadraticCurveTo(ex + sx * r * 0.05, ey - r * 0.55, ex + r * 0.3, ey + r * 0.15); c.closePath();
    fs(c, FUR_D, lw);
    c.beginPath(); c.moveTo(ex - r * 0.16, ey + r * 0.12); c.quadraticCurveTo(ex + sx * r * 0.03, ey - r * 0.3, ex + r * 0.16, ey + r * 0.1); c.closePath();
    fs(c, '#f2ece2');
  }
  ell(c, 0, 0, r, r * 0.92); fs(c, FUR, lw);
  // white cheek tufts
  for (const sx of [-1, 1]) { ell(c, sx * r * 0.62 + fx * 0.4, r * 0.32, r * 0.36, r * 0.3); fs(c, FUR_L); }
  // white brows above the mask
  for (const sx of [-1, 1]) { ell(c, sx * r * 0.36 + fx, -r * 0.4, r * 0.24, r * 0.1, sx * -0.2); fs(c, '#f4efe6'); }
  // the bandit mask
  c.beginPath();
  c.moveTo(-r * 0.95 + fx, -r * 0.14);
  c.quadraticCurveTo(fx, -r * 0.34, r * 0.95 + fx, -r * 0.14);
  c.quadraticCurveTo(r * 0.92 + fx, r * 0.22, r * 0.66 + fx, r * 0.24);
  c.quadraticCurveTo(r * 0.2 + fx, r * 0.1, fx, r * 0.2);
  c.quadraticCurveTo(-r * 0.2 + fx, r * 0.1, -r * 0.66 + fx, r * 0.24);
  c.quadraticCurveTo(-r * 0.92 + fx, r * 0.22, -r * 0.95 + fx, -r * 0.14);
  fs(c, MASK);
  // eyes
  for (const sx of [-1, 1]) {
    const ex = sx * r * 0.36 + fx + (sx < 0 ? turn * r * 0.05 : 0), ey = -r * 0.02, er = r * 0.2 * (sx < 0 ? 1 - turn * 0.12 : 1);
    if (mood === 'dizzy') {
      c.save(); c.translate(ex, ey); c.rotate(t * 8 * sx); c.strokeStyle = '#fff'; c.lineWidth = r * 0.06; c.beginPath();
      for (let a = 0; a < 9; a += 0.4) { const rr2 = er * a / 9; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      c.stroke(); c.restore(); continue;
    }
    if (mood === 'happy') { c.beginPath(); c.arc(ex, ey + er * 0.3, er * 0.8, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = '#fff'; c.lineWidth = r * 0.08; c.lineCap = 'round'; c.stroke(); continue; }
    const big = mood === 'wow' ? 1.25 : 1;
    ell(c, ex, ey, er * big, er * 1.08 * big); fs(c, '#fff');
    const px = ex + er * 0.28 * (0.5 + turn * 0.5), py = ey + (mood === 'fierce' ? er * 0.1 : 0);
    ell(c, px, py, er * 0.55, er * 0.62); fs(c, '#1b1626');
    ell(c, px + er * 0.18, py - er * 0.25, er * 0.2, er * 0.2); fs(c, '#fff');
    if (mood === 'fierce') {                              // determined brows
      c.beginPath(); c.moveTo(ex - er * 1.1, ey - er * (sx > 0 ? 1.25 : 0.75)); c.lineTo(ex + er * 1.1, ey - er * (sx > 0 ? 0.75 : 1.25));
      c.strokeStyle = MASK; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.stroke();
    }
  }
  // muzzle, nose, mouth
  const mx = fx * 1.5;
  ell(c, mx, r * 0.42, r * 0.38, r * 0.27); fs(c, '#f4efe6', lw * 0.6);
  ell(c, mx + turn * r * 0.04, r * 0.3, r * 0.14, r * 0.1); fs(c, '#1b1626');
  ell(c, mx + turn * r * 0.04 - r * 0.04, r * 0.27, r * 0.04, r * 0.03); fs(c, '#fff');
  c.beginPath(); c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = r * 0.06;
  if (mood === 'wow' || mood === 'dizzy') { ell(c, mx, r * 0.55, r * 0.09, r * 0.11); fs(c, '#5a1f2e'); }
  else { c.moveTo(mx - r * 0.16, r * 0.47); c.quadraticCurveTo(mx, r * 0.62, mx + r * 0.18, r * 0.46); c.stroke(); }
  // goggles pushed up on the forehead
  c.beginPath(); c.moveTo(-r * 0.92, -r * 0.42); c.quadraticCurveTo(fx, -r * 0.75, r * 0.92, -r * 0.42);
  c.strokeStyle = '#6b3f22'; c.lineWidth = r * 0.14; c.stroke();
  for (const sx of [-1, 1]) {
    const gx = sx * r * 0.3 + fx * 1.1, gy = -r * 0.66;
    ell(c, gx, gy, r * 0.22, r * 0.2); fs(c, '#d9a441', lw * 0.8);
    ell(c, gx, gy, r * 0.15, r * 0.13); fs(c, '#7fe3ff');
    ell(c, gx - r * 0.05, gy - r * 0.04, r * 0.05, r * 0.04); fs(c, '#fff');
  }
}
function rTail(c, s, x0, y0, x1, y1, cx, cy) {
  tube(c, [x0, y0, cx, cy, x1, y1], s * 0.62, FUR, s * 0.09);
  c.save(); c.setLineDash([s * 0.2, s * 0.24]); c.lineDashOffset = -s * 0.1;
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.strokeStyle = MASK; c.lineWidth = s * 0.62; c.lineCap = 'butt'; c.stroke(); c.restore();
  ell(c, x1, y1, s * 0.3, s * 0.3); fs(c, MASK);
}
function bandana(c, s, x, y, t, flow) {
  c.beginPath(); c.moveTo(x - s * 0.4, y - s * 0.12); c.quadraticCurveTo(x, y + s * 0.2, x + s * 0.42, y - s * 0.1); c.lineTo(x + s * 0.05, y + s * 0.36); c.closePath();
  fs(c, RED, s * 0.07);
  const w = Math.sin(t * 22) * s * 0.12;
  c.beginPath(); c.moveTo(x - s * 0.35, y - s * 0.05);
  c.quadraticCurveTo(x - s * 0.8, y - s * 0.1 + w, x - s * (0.9 + flow * 0.5), y - s * 0.25 - w);
  c.lineTo(x - s * (0.85 + flow * 0.4), y + s * 0.05 + w); c.closePath(); fs(c, RED, s * 0.06);
  for (const [dx, dy] of [[0.05, 0.05], [-0.15, 0], [0.2, -0.02]]) { ell(c, x + dx * s, y + dy * s, s * 0.04, s * 0.04); fs(c, '#ffd9d2'); }
}
function paw(c, x, y, s) { ell(c, x, y, s * 0.2, s * 0.18); fs(c, '#3a3547', s * 0.06); }

// pose: 'fly' (stretched, facing the way it moves), 'ball' (curled spin), 'sit' (upright), 'dizzy'
function drawHeroCode(c, x, y, s, pose, ang, t, mood, squash) {
  c.save(); c.translate(x, y);
  if (pose === 'sit' || pose === 'dizzy') {
    c.rotate(ang || 0);
    const sq = squash || 0; c.scale(1 + sq * 0.15, 1 - sq * 0.15);
    rTail(c, s, -s * 0.5, s * 0.6, -s * 1.15, -s * 0.75 + Math.sin(t * 3) * s * 0.08, -s * 1.5, s * 0.4);
    for (const sx of [-1, 1]) { ell(c, sx * s * 0.42, s * 0.95, s * 0.3, s * 0.2); fs(c, '#3a3547', s * 0.06); }
    ell(c, 0, s * 0.25, s * 0.82, s * 0.85); fs(c, FUR, s * 0.08);
    ell(c, s * 0.05, s * 0.42, s * 0.5, s * 0.55); fs(c, FUR_L);
    if (pose === 'sit') { tube(c, [s * 0.55, s * 0.1, s * 0.9, -s * 0.15], s * 0.26, FUR_D, s * 0.06); paw(c, s * 0.92, -s * 0.18, s); tube(c, [-s * 0.55, s * 0.1, -s * 0.85, -s * 0.15], s * 0.26, FUR_D, s * 0.06); paw(c, -s * 0.88, -s * 0.18, s); }
    else { tube(c, [s * 0.5, s * 0.3, s * 0.75, s * 0.55], s * 0.26, FUR_D, s * 0.06); paw(c, s * 0.78, s * 0.58, s); }
    bandana(c, s, 0, -s * 0.38, t, 0.2);
    c.save(); c.translate(s * 0.05, -s * 0.85); rHead(c, s * 0.74, pose === 'dizzy' ? 'dizzy' : (mood || 'grin'), t, 0.35); c.restore();
    if (pose === 'dizzy') for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * TAU / 3; star(c, Math.cos(a) * s * 0.9, -s * 1.75 + Math.sin(a) * s * 0.25, s * 0.18, '#ffd447');
    }
    c.restore(); return;
  }
  if (pose === 'ball') {
    c.rotate(ang);
    ell(c, 0, 0, s * 1.0, s * 0.95); fs(c, FUR, s * 0.08);
    c.save(); c.setLineDash([s * 0.32, s * 0.3]); c.beginPath(); c.arc(0, 0, s * 0.82, Math.PI * 0.2, Math.PI * 1.3); c.strokeStyle = MASK; c.lineWidth = s * 0.3; c.stroke(); c.restore();
    ell(c, s * 0.1, s * 0.35, s * 0.55, s * 0.4); fs(c, FUR_L);
    paw(c, s * 0.62, s * 0.45, s); paw(c, -s * 0.1, s * 0.75, s);
    c.save(); c.translate(s * 0.28, -s * 0.18); rHead(c, s * 0.6, mood || 'grin', t, 0.6); c.restore();
    c.restore(); return;
  }
  // fly: facing +x, rotated to the direction of travel
  c.rotate(ang);
  const sq = squash || 0; c.scale(1 + sq * 0.25, 1 - sq * 0.25);
  const wag = Math.sin(t * 14) * s * 0.18;
  rTail(c, s, -s * 0.75, -s * 0.05, -s * 2.0, -s * 0.2 + wag, -s * 1.4, s * 0.45 - wag * 0.5);
  tube(c, [-s * 0.45, s * 0.45, -s * 1.0, s * 0.72], s * 0.3, FUR_D, s * 0.07); paw(c, -s * 1.05, s * 0.74, s);
  tube(c, [-s * 0.2, s * 0.55, -s * 0.7, s * 0.95], s * 0.3, FUR_D, s * 0.07); paw(c, -s * 0.74, s * 0.97, s);
  tube(c, [s * 0.3, s * 0.15, s * 1.15, s * 0.32], s * 0.27, FUR_D, s * 0.07); paw(c, s * 1.2, s * 0.32, s);       // far arm
  ell(c, 0, s * 0.1, s * 0.98, s * 0.7); fs(c, FUR, s * 0.08);
  ell(c, s * 0.15, s * 0.36, s * 0.62, s * 0.36); fs(c, FUR_L);
  bandana(c, s, s * 0.42, -s * 0.28, t, 1);
  c.save(); c.translate(s * 0.62, -s * 0.52); rHead(c, s * 0.7, mood || 'grin', t, 1); c.restore();
  tube(c, [s * 0.45, s * 0.2, s * 1.35, s * 0.05], s * 0.28, FUR, s * 0.07); paw(c, s * 1.4, s * 0.04, s);         // near arm
  c.restore();
}
function star(c, x, y, r, col) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); fs(c, col, r * 0.18);
}

// ---------- CleanCorp robots ----------
const SHELL = '#f3f6f9', SHELL_D = '#c3ced9', TEAL = '#16b3a3', VISOR = '#20304a', LED = '#6ff3ff';
function visor(c, x, y, w, h, mood, col) {
  rrect(c, x - w / 2, y - h / 2, w, h, h * 0.45); fs(c, VISOR, h * 0.12);
  c.fillStyle = col || LED; c.strokeStyle = col || LED; c.lineCap = 'round';
  const ex = w * 0.22, er = h * 0.2;
  for (const sx of [-1, 1]) {
    const cx = x + sx * ex;
    if (mood === 'panic') { c.lineWidth = h * 0.09; c.beginPath(); c.arc(cx, y, er * 1.25, 0, TAU); c.stroke(); ell(c, cx, y, er * 0.35, er * 0.35); c.fill(); }
    else if (mood === 'angry') { c.beginPath(); c.moveTo(cx - er * 1.3, y - er * (sx > 0 ? 0.2 : 1.1)); c.lineTo(cx + er * 1.3, y - er * (sx > 0 ? 1.1 : 0.2)); c.lineTo(cx + er * 1.1, y + er * 0.8); c.lineTo(cx - er * 1.1, y + er * 0.8); c.closePath(); c.fill(); }
    else { rrect(c, cx - er * 0.9, y - er * 1.1, er * 1.8, er * 2.2, er * 0.8); c.fill(); }
  }
}
function wheel(c, x, y, r) { ell(c, x, y, r, r); fs(c, '#2d2b3a', r * 0.25); ell(c, x, y, r * 0.4, r * 0.4); fs(c, '#8b93a3'); }
const BOT_CACHE = new Map();
// u = the robot's radius in px; the sprite's feet sit on (0,0), body centred at (0,-u)
function botSprite(type, u, mood) {
  // drawn at device resolution (sharp on phones); sizes snap to 7% steps so a zooming camera reuses sprites
  u = Math.max(4, Math.round(Math.pow(1.07, Math.round(Math.log(u) / Math.log(1.07)))));
  const key = type + '|' + u + '|' + mood;
  let cv = BOT_CACHE.get(key);
  if (cv) return cv;
  if (BOT_CACHE.size > 400) BOT_CACHE.clear();
  const W = Math.ceil(u * 4.6), H = Math.ceil(u * 4.6);
  cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); c.translate(W / 2, H * 0.84);
  paintBot(c, type, u, mood);
  cv.ox = W / 2; cv.oy = H * 0.84;
  BOT_CACHE.set(key, cv);
  return cv;
}
function sheen(c, x, y, rx, ry) { ell(c, x, y, rx, ry, -0.5); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill(); }
function paintBot(c, type, u, mood) {
  const lw = Math.max(1.5, u * 0.1);
  if (type === 'sweep' || type === 'gold' || type === 'jet') {
    const gold = type === 'gold';
    const body = gold ? '#ffd447' : SHELL, band = gold ? '#e89a1c' : TEAL;
    if (type === 'jet') {                                         // the rocket pack behind
      rrect(c, -u * 1.25, -u * 1.75, u * 0.6, u * 1.35, u * 0.28); fs(c, '#f05a3c', lw);
      c.beginPath(); c.moveTo(-u * 1.3, -u * 0.55); c.lineTo(-u * 1.55, -u * 0.2); c.lineTo(-u * 1.15, -u * 0.5); fs(c, '#ffb03b', lw * 0.7);
      ell(c, -u * 0.95, -u * 1.7, u * 0.3, u * 0.14); fs(c, '#ffd447', lw * 0.7);
    }
    wheel(c, -u * 0.55, -u * 0.18, u * 0.2); wheel(c, u * 0.55, -u * 0.18, u * 0.2);
    rrect(c, -u * 1.05, -u * 0.55, u * 2.1, u * 0.35, u * 0.15); fs(c, band, lw);
    c.beginPath(); c.moveTo(-u * 1.0, -u * 0.5); c.bezierCurveTo(-u * 1.0, -u * 1.75, u * 1.0, -u * 1.75, u * 1.0, -u * 0.5); c.closePath();
    fs(c, body, lw);
    if (gold) { sheen(c, -u * 0.45, -u * 1.15, u * 0.22, u * 0.1); }
    else { c.save(); c.clip(); ell(c, u * 0.3, -u * 0.4, u * 1.1, u * 0.45); c.fillStyle = SHELL_D; c.fill(); c.restore(); sheen(c, -u * 0.45, -u * 1.15, u * 0.2, u * 0.09); }
    visor(c, u * 0.25, -u * 1.0, u * 1.0, u * 0.42, mood, gold ? '#fff7c2' : LED);
    tube(c, [-u * 0.2, -u * 1.42, -u * 0.35, -u * 1.95], u * 0.07, '#5b6475', lw * 0.4);
    ell(c, -u * 0.35, -u * 2.0, u * 0.13, u * 0.13); fs(c, gold ? '#fff' : '#ff5a5a', lw * 0.5);
    if (type === 'sweep') { for (let i = 0; i < 5; i++) tube(c, [u * (0.75 + i * 0.07), -u * 0.2, u * (0.85 + i * 0.12), u * 0.0], u * 0.05, '#c79a5b'); }
    if (gold) { star(c, u * 0.9, -u * 1.6, u * 0.18, '#fff'); }
    return;
  }
  if (type === 'mop') {
    rrect(c, -u * 0.95, -u * 0.42, u * 1.9, u * 0.42, u * 0.2); fs(c, '#2d2b3a', lw);
    for (let i = -2; i <= 2; i++) { ell(c, i * u * 0.36, -u * 0.21, u * 0.1, u * 0.1); fs(c, '#8b93a3'); }
    rrect(c, -u * 0.8, -u * 2.05, u * 1.6, u * 1.7, u * 0.45); fs(c, SHELL, lw);
    c.save(); rrect(c, -u * 0.8, -u * 2.05, u * 1.6, u * 1.7, u * 0.45); c.clip(); c.fillStyle = SHELL_D; c.fillRect(u * 0.35, -u * 2.1, u * 0.6, u * 1.8); c.restore();
    rrect(c, -u * 0.8, -u * 0.95, u * 1.6, u * 0.25, u * 0.1); fs(c, TEAL, lw * 0.7);
    visor(c, u * 0.12, -u * 1.55, u * 1.25, u * 0.5, mood === 'calm' ? 'angry' : mood);
    tube(c, [u * 0.75, -u * 1.15, u * 1.3, -u * 1.4], u * 0.22, SHELL_D, lw * 0.6);   // arm
    tube(c, [u * 1.2, -u * 2.3, u * 1.45, u * 0.05], u * 0.12, '#b07a43', lw * 0.6);  // mop handle
    for (let i = 0; i < 6; i++) tube(c, [u * 1.42, -u * 0.05, u * (1.15 + i * 0.12), u * 0.0 + (i % 2) * u * 0.05], u * 0.14, '#9fb0c2', lw * 0.35);
    sheen(c, -u * 0.45, -u * 1.75, u * 0.2, u * 0.08);
    return;
  }
  if (type === 'bin') {
    wheel(c, -u * 0.5, -u * 0.16, u * 0.18); wheel(c, u * 0.5, -u * 0.16, u * 0.18);
    c.beginPath(); c.moveTo(-u * 0.75, -u * 1.75); c.lineTo(u * 0.75, -u * 1.75); c.lineTo(u * 0.62, -u * 0.25); c.lineTo(-u * 0.62, -u * 0.25); c.closePath();
    fs(c, '#4f7a62', lw);
    for (let i = -2; i <= 2; i++) tube(c, [i * u * 0.24, -u * 1.6, i * u * 0.21, -u * 0.4], u * 0.06, '#3d604c');
    rrect(c, -u * 0.85, -u * 1.95, u * 1.7, u * 0.25, u * 0.1); fs(c, '#3d604c', lw);
    visor(c, 0, -u * 1.35, u * 1.0, u * 0.4, 'angry', '#ff6b6b');
    ell(c, 0, -u * 2.1, u * 0.2, u * 0.16); fs(c, '#ff4d4d', lw * 0.6);             // siren
    // the lid, held up as a shield
    ell(c, u * 0.95, -u * 1.05, u * 0.32, u * 0.95); fs(c, '#aab6c3', lw);
    ell(c, u * 1.0, -u * 1.05, u * 0.16, u * 0.62); fs(c, '#d6dee6');
    ell(c, u * 1.18, -u * 1.05, u * 0.08, u * 0.22); fs(c, '#6d7888', lw * 0.5);
    return;
  }
  if (type === 'drone') {
    rrect(c, -u * 0.8, -u * 1.45, u * 1.6, u * 0.95, u * 0.4); fs(c, SHELL, lw);
    rrect(c, -u * 0.8, -u * 0.75, u * 1.6, u * 0.25, u * 0.12); fs(c, TEAL, lw * 0.7);
    visor(c, u * 0.15, -u * 1.05, u * 0.95, u * 0.36, mood);
    tube(c, [0, -u * 1.45, 0, -u * 1.85], u * 0.12, '#5b6475', lw * 0.5);
    // grabber claw
    tube(c, [-u * 0.3, -u * 0.5, -u * 0.45, -u * 0.05], u * 0.1, '#5b6475', lw * 0.5);
    tube(c, [u * 0.3, -u * 0.5, u * 0.45, -u * 0.05], u * 0.1, '#5b6475', lw * 0.5);
    sheen(c, -u * 0.45, -u * 1.25, u * 0.18, u * 0.07);
    return;
  }
  if (type === 'spring') {
    // coil (drawn compressed; the game stretches the sprite for the boing)
    for (let i = 0; i < 5; i++) { ell(c, 0, -u * (0.15 + i * 0.17), u * 0.55, u * 0.1); c.strokeStyle = OL; c.lineWidth = lw * 1.8; c.stroke(); c.strokeStyle = '#c9ced6'; c.lineWidth = lw; c.stroke(); }
    rrect(c, -u * 0.7, -u * 0.12, u * 1.4, u * 0.14, u * 0.06); fs(c, '#2d2b3a', lw * 0.6);
    ell(c, 0, -u * 1.45, u * 0.85, u * 0.6); fs(c, '#ffb347', lw);
    ell(c, u * 0.25, -u * 1.25, u * 0.6, u * 0.32); fs(c, '#f28f2c');
    visor(c, u * 0.2, -u * 1.5, u * 0.95, u * 0.38, mood === 'calm' ? 'calm' : mood);
    sheen(c, -u * 0.4, -u * 1.75, u * 0.18, u * 0.07);
    return;
  }
  if (type === 'bomb') {
    for (const sx of [-1, 1]) { ell(c, sx * u * 0.45, -u * 0.12, u * 0.26, u * 0.14); fs(c, '#2d2b3a', lw * 0.6); }
    ell(c, 0, -u * 0.95, u * 0.92, u * 0.88); fs(c, '#3b3650', lw);
    ell(c, -u * 0.35, -u * 1.3, u * 0.25, u * 0.15, -0.6); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
    visor(c, u * 0.18, -u * 0.95, u * 1.0, u * 0.4, 'angry', '#ff6b6b');
    rrect(c, -u * 0.2, -u * 1.95, u * 0.4, u * 0.18, u * 0.06); fs(c, '#8b93a3', lw * 0.6);
    tube(c, [0, -u * 1.95, u * 0.1, -u * 2.2, u * 0.35, -u * 2.25], u * 0.08, '#c79a5b', lw * 0.4);
    return;
  }
  if (type === 'cone') {                                          // wet floor sign (a hazard, not a robot)
    c.beginPath(); c.moveTo(-u * 0.75, 0); c.lineTo(-u * 0.25, -u * 2.0); c.lineTo(u * 0.25, -u * 2.0); c.lineTo(u * 0.75, 0); c.closePath(); fs(c, '#ffd23f', lw);
    rrect(c, -u * 0.3, -u * 1.55, u * 0.6, u * 0.6, u * 0.08); fs(c, '#1d1d28');
    ell(c, u * 0.02, -u * 1.42, u * 0.07, u * 0.07); c.fillStyle = '#ffd23f'; c.fill();
    tube(c, [0, -u * 1.33, -u * 0.08, -u * 1.15, u * 0.12, -u * 1.02], u * 0.06, '#ffd23f');
    tube(c, [-u * 0.2, -u * 1.0, u * 0.2, -u * 1.0], u * 0.04, '#ffd23f');
    return;
  }
}
// live layers over the cached sprite (flames, rotors, fuse sparks)
const CODE_LOOK = { cop: 'bin', flare: 'spring', fan: 'sweep', pogo: 'spring', cannon: 'drone', roll: 'sweep' };   // code-drawn stand-ins until the pictures load
function drawBotCode(c, b, sx, sy, ppm, t, mood) {
  const u = BOTS[b.type].r * ppm;
  if (b.type === 'jet') {
    const fl = u * (0.55 + Math.sin(t * 40 + b.x) * 0.15);
    c.beginPath(); c.moveTo(sx - u * 1.1, sy - u * 0.42); c.lineTo(sx - u * 0.75, sy - u * 0.42); c.lineTo(sx - u * 0.93, sy - u * 0.42 + fl); c.closePath();
    c.fillStyle = '#ffb03b'; c.fill();
  }
  const dpr = typeof DPR !== 'undefined' ? DPR : 1;
  let spr = botSprite(CODE_LOOK[b.type] || b.type, u * dpr, mood), scaleY = 1;
  if (b.type === 'spring') scaleY = 1 + Math.max(0, Math.sin(b.t * 6)) * 0.12;
  const bob = b.type === 'sweep' || b.type === 'gold' ? Math.abs(Math.sin(b.t * 9)) * u * 0.06 : 0;
  // Bin Guards always face the incoming hero (shield to the left); the others face where they walk
  const flip = b.type === 'cop' || (b.dir < 0 && b.type !== 'cone' && !b.panic);
  c.save(); c.translate(sx, sy - bob); c.scale(flip ? -1 : 1, scaleY);
  c.drawImage(spr, -spr.ox / dpr, -spr.oy / dpr, spr.width / dpr, spr.height / dpr);
  c.restore();
  if (b.type === 'drone') {
    const w = u * 1.5 * Math.abs(Math.cos(t * 30 + b.x));
    ell(c, sx, sy - u * 1.9, u * 1.4, u * 0.14); c.fillStyle = 'rgba(200,215,230,0.45)'; c.fill();
    c.fillStyle = '#5b6475'; c.fillRect(sx - w, sy - u * 1.95, w * 2, u * 0.1);
  }
  if (b.type === 'bomb') { const k = (t * 12 + b.x) % 1; star(c, sx + u * 0.35, sy - u * 2.25, u * (0.14 + k * 0.08), k > 0.5 ? '#ffd447' : '#ff7a2f'); }
  if (b.panic > 0.4 && b.type !== 'drone') { ell(c, sx + u * 0.9, sy - u * 1.6, u * 0.1, u * 0.15); c.fillStyle = '#8fe1ff'; c.fill(); }
}

// ---------- the junk slingshot ----------
function drawSlingshotCode(c, x, gy, ppm, pull, t, front) {
  const m = ppm, lw = Math.max(2, m * 0.08);
  const fx = x + 0.6 * m, bx = x - 0.9 * m, top = gy - 4.6 * m;
  const pouchX = x - pull * 2.2 * m, pouchY = gy - 3.0 * m + pull * 0.7 * m;
  if (!front) {
    // back post + back cord
    tube(c, [bx, gy, bx, top + 0.4 * m], m * 0.38, '#7d8796', lw);
    tube(c, [bx, top + 0.6 * m, pouchX - 0.2 * m, pouchY], m * 0.13, '#d7402f', lw * 0.6);
    // tyre stack base
    for (let i = 0; i < 3; i++) { ell(c, x - 0.15 * m, gy - (0.3 + i * 0.5) * m, 1.35 * m, 0.32 * m); fs(c, '#2e2c38', lw); ell(c, x - 0.15 * m, gy - (0.3 + i * 0.5) * m, 0.7 * m, 0.14 * m); fs(c, '#4a4758'); }
    return;
  }
  tube(c, [fx, gy - 1.2 * m, fx, top], m * 0.42, '#97a2b2', lw);
  for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#ffd23f' : '#2d2b3a'; c.fillRect(fx - 0.21 * m, top + (0.3 + i * 0.3) * m, 0.42 * m, 0.3 * m); }
  tube(c, [fx, top + 0.6 * m, pouchX + 0.3 * m, pouchY], m * 0.13, '#ea4a3f', lw * 0.6);
  ell(c, pouchX + 0.1 * m, pouchY + 0.15 * m, 0.55 * m, 0.3 * m); fs(c, '#6b3f22', lw);
}

// ---------- walls ----------
const WALL_LOOK = [
  { body: '#8a6f5a', dark: '#5c4637', trim: '#ffd23f' },
  { body: '#7f8a99', dark: '#4e5868', trim: '#ffd23f' },
  { body: '#f4f7fb', dark: '#b9c6d6', trim: '#16b3a3' },
  { body: '#c75b3a', dark: '#3a7ca5', trim: '#d9d9e0' },   // Container Wall (v0.5)
  { body: '#e8edf3', dark: '#16b3a3', trim: '#ff3b3b' },   // Laser Shutter (v0.5)
  { body: '#3f8a3a', dark: '#2b5e28', trim: '#ffffff' },   // Hedge Wall (v0.6)
  { body: '#f08a24', dark: '#b85c12', trim: '#ffd23f' },   // Girder Wall
  { body: '#ff5b8a', dark: '#3d3a52', trim: '#7ff3e8' },   // Billboard Wall
  { body: '#e53935', dark: '#fff3e0', trim: '#ffd447' },   // Fun Fair Gate
  { body: '#f4f7fb', dark: '#f08a24', trim: '#2d2b3a' },   // Blast Shield
];
function wallArt(i) { return WALLS[i] ? WALLS[i].art : i; }   // WALL_LOOK and the wall pictures are by art number
function crackSeed(i) { let a = i * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }
function drawWallCode(c, idx, x, gy, ppm, hpFrac, t, topY) {
  const m = ppm, L = WALL_LOOK[idx], w = 3.2 * m, lw = Math.max(2, m * 0.09);
  const top = Math.min(topY, gy - 16 * m);
  c.fillStyle = L.dark; c.fillRect(x, top, w, gy - top);
  c.fillStyle = L.body; c.fillRect(x + 0.35 * m, top, w - 0.7 * m, gy - top);
  c.strokeStyle = OL; c.lineWidth = lw; c.strokeRect(x, top - lw, w, gy - top + lw);
  const rnd = crackSeed(idx + 3);
  if (idx === 0) {                                     // junk: doors, tyres, crates
    for (let yy = gy - 1.2 * m, k = 0; yy > top - m; yy -= 1.3 * m, k++) {
      const kind = (k * 7 + 3) % 3;
      if (kind === 0) { rrect(c, x + 0.25 * m, yy - 1.1 * m, w - 0.5 * m, 1.1 * m, 0.15 * m); fs(c, ['#c75b3a', '#3a7ca5', '#7fa650'][k % 3], lw * 0.7); ell(c, x + w * 0.7, yy - 0.55 * m, 0.12 * m, 0.08 * m); fs(c, '#ddd'); }
      else if (kind === 1) { for (const dx of [0.9, 2.2]) { ell(c, x + dx * m, yy - 0.55 * m, 0.6 * m, 0.55 * m); fs(c, '#2e2c38', lw * 0.6); ell(c, x + dx * m, yy - 0.55 * m, 0.25 * m, 0.22 * m); fs(c, '#4a4758'); } }
      else { rrect(c, x + 0.3 * m, yy - 1.15 * m, w - 0.6 * m, 1.15 * m, 0.08 * m); fs(c, '#b58a52', lw * 0.7); tube(c, [x + 0.4 * m, yy - 1.1 * m, x + w - 0.4 * m, yy - 0.05 * m], lw * 0.5, '#8a6534'); }
    }
  } else if (idx === 1) {                              // blast door
    for (let yy = gy - 0.6 * m; yy > top; yy -= 1.6 * m) for (const dx of [0.6, 2.6]) { ell(c, x + dx * m, yy, 0.09 * m, 0.09 * m); fs(c, '#c6cfda', lw * 0.4); }
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? L.trim : '#2d2b3a'; c.fillRect(x + 0.35 * m, gy - (2.2 + i * 0.32) * m, w - 0.7 * m, 0.32 * m); }
    rrect(c, x + 0.9 * m, gy - 8 * m, w - 1.8 * m, 2.4 * m, 0.3 * m); fs(c, '#5d6878', lw * 0.6);
  } else {                                             // CleanCorp gate with the boss's big face
    for (let i = 0; i < 5; i++) { c.fillStyle = TEAL; c.fillRect(x + 0.35 * m, gy - (1.5 + i * 2.6) * m, w - 0.7 * m, 0.3 * m); }
    const fy = gy - 9.5 * m;
    ell(c, x + w * 0.5, fy, 2.6 * m, 2.1 * m); fs(c, SHELL, lw);
    visor(c, x + w * 0.5, fy, 3.6 * m, 1.3 * m, hpFrac < 0.35 ? 'panic' : 'angry', '#ff5b8a');
    star(c, x + w * 0.5, gy - 5.2 * m, 0.9 * m, '#7ff3e8');
  }
  // cracks grow as the wall loses health
  const n = Math.floor((1 - hpFrac) * 14);
  c.strokeStyle = 'rgba(30,20,40,0.85)'; c.lineWidth = Math.max(1.5, m * 0.07); c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let cx = x + (0.2 + rnd() * 0.6) * w, cy = gy - (0.5 + rnd() * 8) * m;
    c.beginPath(); c.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * m * 1.4; cy += (rnd() - 0.4) * m * 1.2; c.lineTo(cx, cy); }
    c.stroke();
  }
}

// ---------- coaches (shop portraits) ----------
function drawCoachCode(c, id, x, y, r, t) {
  c.save(); c.translate(x, y);
  const lw = r * 0.06, bob = Math.sin(t * 2 + r) * r * 0.02;
  c.translate(0, bob);
  if (id === 'nana') {                                  // Nana Possum, mechanic
    ell(c, 0, r * 0.75, r * 0.8, r * 0.45); fs(c, '#4f7bb5', lw);                       // overalls
    for (const sx of [-1, 1]) { ell(c, sx * r * 0.55, -r * 0.5, r * 0.22, r * 0.22); fs(c, '#2e2b38', lw); ell(c, sx * r * 0.55, -r * 0.5, r * 0.11, r * 0.11); fs(c, '#f2a7b5'); }
    ell(c, 0, -r * 0.05, r * 0.62, r * 0.58); fs(c, '#f1ede6', lw);
    c.beginPath(); c.moveTo(-r * 0.3, r * 0.1); c.quadraticCurveTo(0, r * 0.75, r * 0.3, r * 0.1); fs(c, '#f1ede6', lw);
    ell(c, 0, r * 0.52, r * 0.1, r * 0.08); fs(c, '#f28da0');
    for (const sx of [-1, 1]) { ell(c, sx * r * 0.24, -r * 0.08, r * 0.17, r * 0.17); fs(c, 'rgba(180,220,255,0.5)', lw * 0.8); ell(c, sx * r * 0.24, -r * 0.08, r * 0.07, r * 0.07); fs(c, '#1b1626'); }
    tube(c, [-r * 0.07, -r * 0.08, r * 0.07, -r * 0.08], lw, OL);
    ell(c, 0, -r * 0.6, r * 0.28, r * 0.2); fs(c, '#d9d9e2', lw);                         // grey bun
    tube(c, [r * 0.55, r * 0.75, r * 0.95, r * 0.15], r * 0.12, '#9aa5b5', lw * 0.6);   // wrench
    ell(c, r * 0.98, r * 0.1, r * 0.16, r * 0.12); fs(c, '#9aa5b5', lw * 0.6);
  } else if (id === 'stinky') {                         // Coach Stinky, skunk with a whistle
    c.beginPath(); c.moveTo(r * 0.3, r * 0.8); c.bezierCurveTo(r * 1.35, r * 0.5, r * 1.3, -r * 1.0, r * 0.55, -r * 0.85); c.quadraticCurveTo(r * 0.8, r * 0.05, r * 0.1, r * 0.6); fs(c, '#23202c', lw);
    c.beginPath(); c.moveTo(r * 0.45, r * 0.6); c.bezierCurveTo(r * 1.05, r * 0.35, r * 1.05, -r * 0.6, r * 0.62, -r * 0.72); c.strokeStyle = '#f4f4f4'; c.lineWidth = r * 0.16; c.lineCap = 'round'; c.stroke();
    ell(c, 0, r * 0.78, r * 0.85, r * 0.45); fs(c, '#d93c3c', lw);                       // track jacket
    tube(c, [-r * 0.1, r * 0.4, r * 0.25, r * 0.75], lw * 0.8, '#f4f4f4');
    for (const sx of [-1, 1]) { ell(c, sx * r * 0.45, -r * 0.55, r * 0.2, r * 0.22); fs(c, '#23202c', lw); }
    ell(c, 0, -r * 0.02, r * 0.62, r * 0.58); fs(c, '#23202c', lw);
    c.beginPath(); c.moveTo(-r * 0.12, -r * 0.6); c.quadraticCurveTo(0, -r * 0.1, r * 0.12, -r * 0.6); c.lineTo(r * 0.06, r * 0.15); c.lineTo(-r * 0.06, r * 0.15); fs(c, '#f4f4f4');
    rrect(c, -r * 0.62, -r * 0.42, r * 1.24, r * 0.14, r * 0.05); fs(c, '#ffd23f', lw * 0.6);   // headband
    for (const sx of [-1, 1]) { ell(c, sx * r * 0.26, -r * 0.05, r * 0.13, r * 0.15); fs(c, '#fff'); ell(c, sx * r * 0.24, -r * 0.03, r * 0.07, r * 0.08); fs(c, '#1b1626'); }
    ell(c, 0, r * 0.25, r * 0.08, r * 0.06); fs(c, '#f28da0');
    ell(c, r * 0.2, r * 0.42, r * 0.13, r * 0.08); fs(c, '#c0c7d2', lw * 0.6);               // whistle
  } else if (id === 'pidge') {                          // Pidge, scrap-dealing pigeon
    ell(c, 0, r * 0.75, r * 0.75, r * 0.45); fs(c, '#7f8aa0', lw);
    ell(c, 0, r * 0.38, r * 0.45, r * 0.22); fs(c, '#4fb39a');
    ell(c, 0, r * 0.45, r * 0.38, r * 0.14); fs(c, '#8e6bbf');
    ell(c, r * 0.05, -r * 0.12, r * 0.42, r * 0.46); fs(c, '#9aa4b8', lw);                 // side-on pigeon head
    ell(c, r * 0.12, -r * 0.18, r * 0.09, r * 0.09); fs(c, '#ff9b3d', lw * 0.5); ell(c, r * 0.14, -r * 0.18, r * 0.04, r * 0.04); fs(c, '#1b1626');
    c.beginPath(); c.moveTo(r * 0.38, -r * 0.1); c.lineTo(r * 0.72, r * 0.0); c.lineTo(r * 0.38, r * 0.06); fs(c, '#3b3547', lw * 0.6);
    ell(c, r * 0.42, -r * 0.08, r * 0.07, r * 0.05); fs(c, '#f1ede6');
    rrect(c, -r * 0.48, -r * 0.62, r * 0.96, r * 0.2, r * 0.08); fs(c, '#3a7ca5', lw * 0.6);   // flat cap
    ell(c, r * 0.1, -r * 0.62, r * 0.5, r * 0.18); fs(c, '#3a7ca5', lw * 0.6);
  } else {                                              // Professor Nutz, squirrel inventor
    c.beginPath(); c.moveTo(-r * 0.4, r * 0.8); c.bezierCurveTo(-r * 1.3, r * 0.4, -r * 1.2, -r * 0.9, -r * 0.5, -r * 0.7); c.quadraticCurveTo(-r * 0.75, r * 0.1, -r * 0.2, r * 0.6); fs(c, '#d9822b', lw);
    ell(c, 0, r * 0.78, r * 0.75, r * 0.45); fs(c, '#f4f4f4', lw);                       // lab coat
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.3, -r * 0.45); c.lineTo(sx * r * 0.5, -r * 0.85); c.lineTo(sx * r * 0.58, -r * 0.35); fs(c, '#d9822b', lw); }
    ell(c, 0, -r * 0.05, r * 0.55, r * 0.52); fs(c, '#e6913a', lw);
    ell(c, 0, r * 0.2, r * 0.32, r * 0.22); fs(c, '#f8dfc0');
    for (const sx of [-1, 1]) { ell(c, sx * r * 0.22, -r * 0.1, r * 0.12, r * 0.14); fs(c, '#fff'); ell(c, sx * r * 0.2, -r * 0.08, r * 0.07, r * 0.08); fs(c, '#1b1626'); }
    ell(c, 0, r * 0.12, r * 0.08, r * 0.06); fs(c, '#3b2a20');
    rrect(c, -r * 0.08, r * 0.24, r * 0.16, r * 0.14, r * 0.03); fs(c, '#fff', lw * 0.5);   // buck teeth
    ell(c, 0, -r * 0.5, r * 0.5, r * 0.22); fs(c, '#ffd23f', lw);                          // hard hat
    ell(c, 0, -r * 0.6, r * 0.12, r * 0.09); fs(c, '#fff8c2', lw * 0.5);
  }
  c.restore();
}

// ---------- small icons ----------
function iconGear(c, x, y, r, col) {
  c.save(); c.translate(x, y); c.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr2 = i % 2 ? r * 0.78 : r; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  c.closePath(); fs(c, col || '#ffc93c', r * 0.16);
  ell(c, 0, 0, r * 0.32, r * 0.32); fs(c, '#7a5a12');
  c.restore();
}
function iconMusic(c, x, y, r, on) {
  c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = r * 0.16; c.lineCap = 'round';
  ell(c, x - r * 0.35, y + r * 0.45, r * 0.28, r * 0.22, -0.3); c.fill(); ell(c, x + r * 0.45, y + r * 0.3, r * 0.28, r * 0.22, -0.3); c.fill();
  c.beginPath(); c.moveTo(x - r * 0.1, y + r * 0.45); c.lineTo(x - r * 0.1, y - r * 0.55); c.lineTo(x + r * 0.7, y - r * 0.7); c.lineTo(x + r * 0.7, y + r * 0.3); c.stroke();
  if (!on) { c.strokeStyle = '#ff6b6b'; c.lineWidth = r * 0.2; c.beginPath(); c.moveTo(x - r * 0.8, y - r * 0.8); c.lineTo(x + r * 0.8, y + r * 0.8); c.stroke(); }
}
function iconReset(c, x, y, r) {
  c.strokeStyle = '#fff'; c.lineWidth = r * 0.2; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r * 0.6, -Math.PI * 0.35, Math.PI * 1.35); c.stroke();
  const a = -Math.PI * 0.35, ax = x + Math.cos(a) * r * 0.6, ay = y + Math.sin(a) * r * 0.6;
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(ax + r * 0.38, ay - r * 0.05); c.lineTo(ax - r * 0.12, ay - r * 0.38); c.lineTo(ax - r * 0.02, ay + r * 0.3); c.closePath(); c.fill();
}
function iconSlam(c, x, y, r, full) {
  c.save(); c.translate(x, y);
  c.beginPath(); c.moveTo(0, r); c.lineTo(-r * 0.75, -r * 0.1); c.lineTo(-r * 0.3, -r * 0.1); c.lineTo(-r * 0.3, -r); c.lineTo(r * 0.3, -r); c.lineTo(r * 0.3, -r * 0.1); c.lineTo(r * 0.75, -r * 0.1); c.closePath();
  fs(c, full ? '#ff7a2f' : 'rgba(255,255,255,0.18)', r * 0.16);
  c.restore();
}
function iconVideo(c, x, y, r) {
  rrect(c, x - r, y - r * 0.7, r * 2, r * 1.4, r * 0.35); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.moveTo(x - r * 0.3, y - r * 0.4); c.lineTo(x + r * 0.45, y); c.lineTo(x - r * 0.3, y + r * 0.4); c.closePath(); c.fillStyle = '#e8423f'; c.fill();
}

// ---------- ChatGPT sprites (art/*.png) ----------
// Pictures made with ChatGPT image generation (the owner's Codex app) from our own reference sheet, cut into
// sprites by art-src/cut-sheet.ps1. Until a picture has loaded (or if it fails), the code drawings above are used.
// BUILD tags every file address (scripts in index.html too) so a new version never runs on old cached files
// (owner 2026-11-08 saw v0.4's whole-game reset button at the slingshot after v0.6 went live)
const BUILD = '0.6.7';
const ART = { img: {} };
const ICON_IDS = ['sling', 'muscle', 'topspeed', 'slam', 'refill', 'quake', 'bounce', 'slick', 'wind', 'scrap', 'distpay', 'luck',
  'wall', 'fur', 'blast', 'critpow', 'overdrive', 'meteor', 'bomb', 'flare', 'fan', 'goldbot', 'jet', 'drone', 'spring', 'pogo', 'cannon', 'roll'];
const COACH_IDS = ['nana', 'stinky', 'pidge', 'nutz', 'mo', 'hoot'];
// what the first screen needs loads before gameReady (counts toward YouTube's initial download); the rest after it
const ART_FIRST = [
  'hero-fly', 'hero-ball', 'hero-dive', 'hero-sit', 'hero-dizzy', 'hero-cheer',
  'bot-sweep', 'bot-mop', 'bot-sweep-panic', 'bot-cop', 'bot-bomb', 'bot-bomb-air', 'bot-flare', 'bot-fan', 'bot-cone', 'bot-goldbag',
  'coach-nana', 'coach-stinky', 'coach-nana-ready', 'coach-nana-tell', 'wall-0', 'slingshot',
];
const ART_LATER = [
  'bot-jet', 'bot-drone', 'bot-spring', 'bot-cop-hit', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'wall-5', 'wall-6', 'wall-7', 'wall-8', 'wall-9',
  'bot-pogo', 'bot-cannon', 'bot-cannon-gold', 'bot-roll', 'junkball', 'claw',
].concat(COACH_IDS.filter(id => id !== 'nana' && id !== 'stinky').map(id => 'coach-' + id),
  COACH_IDS.filter(id => id !== 'nana').map(id => 'coach-' + id + '-ready'), COACH_IDS.filter(id => id !== 'nana').map(id => 'coach-' + id + '-tell'),
  ICON_IDS.map(id => 'icon-' + id), ['icon-perfect']);   // icon-perfect is the speed meter's dial
const ART_NAMES = ART_FIRST.concat(ART_LATER);
function loadArt(names, timeoutMs) {
  const data = (typeof window !== 'undefined' && window.ART_DATA) || null;     // the one-file build inlines the PNGs
  const one = (n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { ART.img[n] = im; res(true); };
    im.onerror = () => { if (im.src.indexOf('?v=') > 0) im.src = im.src.split('?v=')[0]; else res(false); };   // a host that refuses the tag: plain name
    im.src = data && data[n] ? data[n] : ((typeof window !== 'undefined' && window.ART_BASE) || 'art/') + n + '.png?v=' + BUILD;
  });
  const all = Promise.all(names.map(one));
  return timeoutMs ? Promise.race([all, new Promise(r => setTimeout(r, timeoutMs))]) : all;
}
function artImg(n) { const im = ART.img[n]; return im && im.naturalWidth ? im : null; }
// draw a sprite centred at (x, y) with a given height in px; flip mirrors it; anchor 'feet' puts its bottom on y
function sprite(c, im, x, y, h, ang, flip, anchor, sx, sy) {
  const w = h * im.naturalWidth / im.naturalHeight;
  c.save(); c.translate(x, y); if (ang) c.rotate(ang); c.scale((flip ? -1 : 1) * (sx || 1), sy || 1);
  if (anchor === 'feet') c.drawImage(im, -w / 2, -h, w, h); else c.drawImage(im, -w / 2, -h / 2, w, h);
  c.restore();
}

// Scraps: s = hero radius in px. Picture name and height (in hero radii) per pose.
const HERO_SPR = { fly: ['hero-fly', 3.0], ball: ['hero-ball', 2.3], dive: ['hero-dive', 3.6], sit: ['hero-sit', 3.1], dizzy: ['hero-dizzy', 3.3], cheer: ['hero-cheer', 3.4] };
function drawHero(c, x, y, s, pose, ang, t, mood, squash) {
  let key = pose;
  if (pose === 'sit' && mood === 'happy') key = 'cheer';
  const d = HERO_SPR[key], im = d && artImg(d[0]);
  if (!im) { drawHeroCode(c, x, y, s, pose === 'dive' ? 'fly' : pose, pose === 'dive' ? (ang || 0) + Math.PI / 2 : ang, t, mood, squash); return; }
  const sq = squash || 0, bob = key === 'sit' || key === 'cheer' ? Math.sin(t * 3) * s * 0.03 : 0;
  const upright = key === 'sit' || key === 'dizzy' || key === 'cheer';
  sprite(c, im, x, y + bob, s * d[1], upright ? (ang || 0) * 0.5 : ang, false, null, 1 + sq * 0.22, 1 - sq * 0.22);
}

// robots: picture height in robot radii (feet on the ground line)
const BOT_H = { sweep: 2.25, mop: 2.9, cop: 2.9, jet: 2.5, drone: 2.6, spring: 3.1, bomb: 2.7, gold: 2.6, cone: 2.3, flare: 3.6, fan: 2.6, pogo: 4.0, cannon: 2.2, roll: 2.3 };
const BOT_PIC = { gold: 'bot-goldbag', pogo: 'bot-pogo', cannon: 'bot-cannon', roll: 'bot-roll' };
function drawBot(c, b, sx, sy, ppm, t, mood) {
  const name = b.type === 'sweep' && mood === 'panic' ? 'bot-sweep-panic' : b.float && b.type === 'bomb' ? 'bot-bomb-air' : BOT_PIC[b.type] || 'bot-' + b.type;
  const im = artImg(name) || (name === 'bot-sweep-panic' ? artImg('bot-sweep') : null);
  if (!im) { drawBotCode(c, b, sx, sy, ppm, t, mood); return; }
  const u = BOTS[b.type].r * ppm, h = (BOT_H[b.type] || 2.4) * u * (b.float && b.type === 'bomb' ? 2.1 : 1);
  const flip = b.type === 'cop' || (b.dir < 0 && b.type !== 'cone' && !b.panic && !b.float);   // cops keep the shield towards the hero
  if (b.float) { sprite(c, im, sx, sy + u * 0.15, h, Math.sin(t * 2 + b.x) * 0.06, false, 'feet'); return; }
  let scy = 1, scx = 1, yy = sy;
  if (b.type === 'spring') { const k = Math.max(0, Math.sin(b.t * 6)); scy = 1 + k * 0.1; scx = 1 - k * 0.04; }
  if (b.type === 'sweep' || b.type === 'gold') yy -= Math.abs(Math.sin(b.t * 9)) * u * 0.06;
  if (b.type === 'drone') yy += Math.sin(t * 5 + b.x) * u * 0.08;
  if (b.panic > 0.4) scx *= 1 + Math.sin(t * 40 + b.x) * 0.03;
  if (b.type === 'jet') {                                     // rocket flame behind the pack
    const fl = u * (0.55 + Math.sin(t * 40 + b.x) * 0.15), fx = sx + (flip ? 1 : -1) * u * 1.0;
    c.beginPath(); c.moveTo(fx, yy - u * 1.05); c.lineTo(fx + (flip ? 1 : -1) * fl, yy - u * 0.85); c.lineTo(fx, yy - u * 0.65); c.closePath(); c.fillStyle = '#ffb03b'; c.fill();
  }
  sprite(c, im, sx, yy, h, 0, flip, 'feet', scx, scy);
  if (b.type === 'bomb') { const k = (t * 12 + b.x) % 1; star(c, sx + u * 0.3 * (flip ? -1 : 1), yy - h * 0.98, u * (0.12 + k * 0.08), k > 0.5 ? '#ffd447' : '#ff7a2f'); }
}

// a coach standing at the launch: full body, feet on (x, gy), h = height in px; pose 'ready' or 'tell' (pad up);
// faces left towards the slingshot. Falls back to the portrait if the pictures haven't loaded.
function drawCoachBody(c, id, x, gy, h, pose, t, tilt) {
  const im = artImg('coach-' + id + '-' + pose) || artImg('coach-' + id + '-ready');
  if (!im) { drawCoach(c, id, x, gy - h * 0.45, h * 0.45, t); return; }
  sprite(c, im, x, gy, h * (pose === 'tell' ? 1.12 : 1), tilt || 0, false, 'feet');
}
// coaches: portrait sitting in a circle of radius r (callers clip to the circle)
function drawCoach(c, id, x, y, r, t) {
  const im = artImg('coach-' + id);
  if (!im) { drawCoachCode(c, id, x, y, r, t); return; }
  const bob = Math.sin((t || 0) * 2 + r) * r * 0.02;
  sprite(c, im, x, y + r * 0.98 + bob, r * 2.1, 0, false, 'feet');
}

// the slingshot: the picture is the frame; bands and pouch are drawn live (they stretch with the pull)
function drawSlingshot(c, x, gy, ppm, pull, t, front) {
  const im = artImg('slingshot');
  if (!im) { drawSlingshotCode(c, x, gy, ppm, typeof pull === "object" ? pull.q : pull, t, front); return; }
  const m = ppm, h = 5.0 * m, w = h * im.naturalWidth / im.naturalHeight;
  const lx = x - w * SLING_TIPS[0], rx = x + w * SLING_TIPS[1], ty = gy - h * SLING_TIPS[2];
  const pd = typeof pull === "object" ? pull : { dx: -pull * 2.2, dy: -pull * 0.7 };   // pouch offset (m) from its rest spot
  const pouchX = x + pd.dx * m, pouchY = gy - (3.0 + pd.dy) * m, lw = Math.max(2, m * 0.08);
  if (!front) {
    tube(c, [lx, ty, pouchX - 0.2 * m, pouchY], m * 0.14, '#d7402f', lw * 0.6);
    c.drawImage(im, x - w / 2, gy - h, w, h);
    return;
  }
  tube(c, [rx, ty, pouchX + 0.3 * m, pouchY], m * 0.14, '#ea4a3f', lw * 0.6);
  ell(c, pouchX + 0.1 * m, pouchY + 0.15 * m, 0.55 * m, 0.3 * m); fs(c, '#6b3f22', lw);
}
const SLING_TIPS = [0.37, 0.37, 0.93];                 // left/right prong tip from the centre (fraction of width), tip height (fraction of height)

// a long wall: panels side by side from x (screen px of the wall's start) for lenM metres. frontM metres are already
// ploughed through this launch: those panels are rubble, the front panel is cut where the hero is and cracks up.
function drawLongWall(c, idx, x, gy, ppm, lenM, frontM, t, topY) {
  const m = ppm, colM = 3.0, n = Math.ceil(lenM / colM), front = x + frontM * m;
  const look = WALL_LOOK[wallArt(idx)];
  // rubble on the street where panels were smashed
  if (frontM > 0.3) {
    const rnd = crackSeed(idx + 11);
    for (let k = 0; k < Math.min(40, frontM * 2.2); k++) {
      const rx = x + rnd() * frontM * m, rw = m * (0.5 + rnd() * 0.7);
      rrect(c, rx, gy - m * (0.25 + rnd() * 0.35), rw, m * (0.35 + rnd() * 0.3), m * 0.1); fs(c, k % 3 ? look.body : look.trim, Math.max(1, m * 0.04));
    }
  }
  c.save(); c.beginPath(); c.rect(front, -1e4, 2e4, 2e4); c.clip();       // nothing left of the front
  for (let k = n - 1; k >= 0; k--) {
    const cx = x + k * colM * m, cw = Math.min(colM, lenM - k * colM);
    if (cx + cw * m <= front) continue;
    const isFront = front > cx && front < cx + cw * m;
    drawWall(c, idx, cx, gy, m * cw / 3.6, isFront ? 0.15 : 1, t, topY, true);
    if (k > 0) { c.fillStyle = 'rgba(20,14,38,0.35)'; c.fillRect(cx - m * 0.06, Math.min(topY, gy - 16 * m), m * 0.12, gy - Math.min(topY, gy - 16 * m)); }
  }
  c.restore();
  // a jagged broken edge on the front
  if (frontM > 0.05 && frontM < lenM) {
    const rnd = crackSeed(Math.floor(frontM * 3) + idx);
    c.beginPath(); c.moveTo(front, Math.min(topY, gy - 16 * m));
    for (let y = Math.min(topY, gy - 16 * m); y < gy; y += m * 0.9) c.lineTo(front + rnd() * m * 0.5, y);
    c.lineTo(front, gy); c.strokeStyle = OL; c.lineWidth = Math.max(2, m * 0.12); c.stroke();
  }
}
// walls: the picture stacked up to the top of the screen (every other copy mirrored), cracks drawn on top
function drawWall(c, idx, x, gy, ppm, hpFrac, t, topY, noShift) {
  const im = artImg('wall-' + wallArt(idx));
  if (!im) { drawWallCode(c, wallArt(idx), x, gy, ppm * 3.6 / 3.2, hpFrac, t, topY); return; }
  const m = ppm, w = 3.6 * m, h = w * im.naturalHeight / im.naturalWidth, x0 = noShift ? x : x - 0.2 * m;
  const top = Math.min(topY, gy - 20 * m);
  for (let y = gy, k = 0; y > top; y -= h * 0.98, k++) {
    if (k === 0) c.drawImage(im, x0, y - h, w, h);
    else { c.save(); c.translate(x0 + w, y - h); c.scale(-1, 1); c.drawImage(im, 0, 0, w, h); c.restore(); }
  }
  const rnd = crackSeed(idx + 3), n = Math.floor((1 - hpFrac) * 16);
  c.strokeStyle = 'rgba(30,20,40,0.85)'; c.lineWidth = Math.max(1.5, m * 0.08); c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let cx = x0 + (0.2 + rnd() * 0.6) * w, cy = gy - (0.5 + rnd() * 8) * m;
    c.beginPath(); c.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * m * 1.4; cy += (rnd() - 0.4) * m * 1.2; c.lineTo(cx, cy); }
    c.stroke();
  }
}
