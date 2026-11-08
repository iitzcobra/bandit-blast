'use strict';
// Layout for any screen shape (9:32 to 32:9), HUD, power gauge, cards, the coaches' shop and the tutorial overlay.
// Sizes are CSS pixels; the canvas is scaled by devicePixelRatio (capped at 3) so text stays crisp.
let LAYOUT = null;
const UI = { hits: [], sel: 'sling', press: null, tab: 'up', coachSel: 'nana' };
const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BTN = {
  go:    ['#ffb35c', '#f0661f', '#b5420c', '#5e1d00'],
  coach: ['#7fe0d4', '#17a596', '#0d7266', '#043a33'],
  buy:   ['#9dff7a', '#2fb44a', '#1f8035', '#0e4a1c'],
  video: ['#c09cff', '#7445ea', '#5029b3', '#29125f'],
  plain: ['#97a3c0', '#5b6886', '#3c4560', '#1c2133'],
  off:   ['#a9afbd', '#767e8d', '#555b69', '#2a2e37'],
  red:   ['#ff8a80', '#e53935', '#a32020', '#4f0b0b'],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w <= 0 || h <= 0) return;                    // Android first loads in a hidden 0x0 view: wait for a real size
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = w; H = h;
  canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  LAYOUT = computeLayout();
  draw();
}
function computeLayout() {
  const portrait = H >= W;
  const U = clamp(Math.min(W, H) / 22, 13, 34), pad = Math.round(U * 0.7);
  const plateH = Math.max(40, Math.round(U * 2.3)), sq = Math.max(48, Math.round(U * 2.6));
  const L = { portrait, U, pad, plateH, sq };
  L.music = { x: W - pad - sq, y: pad, w: sq, h: sq };
  L.reset = { x: L.music.x - pad * 0.6 - sq, y: pad, w: sq, h: sq };
  L.scrap = { x: pad, y: pad, w: Math.round(U * 7.6), h: plateH };
  L.scrapX = L.scrap.x + plateH * 0.5; L.scrapY = L.scrap.y + plateH * 0.5;
  L.best = { x: pad, y: pad + plateH + pad * 0.5, w: Math.round(U * 7.6), h: Math.round(plateH * 0.8) };
  const bh = Math.max(56, Math.round(U * 3.2));
  L.coaches = { x: pad, y: H - pad - bh, w: Math.min(W * 0.46, U * 11), h: bh };
  L.speed = { x: pad, y: H - pad - plateH, w: Math.min(W - pad * 2, Math.round(U * 9)), h: plateH };   // the speed meter (bottom left)
  // the launch text: above the coach on tall screens, high up and to the right on square and wide ones
  L.gauge = H / W > 1.3 ? { x: W / 2, y: Math.max(H * 0.33, L.pad + U * 10), r: Math.min(W * 0.3, H * 0.15) } : { x: W * 0.6, y: L.pad + U * 5.6, r: Math.min(W * 0.16, H * 0.2) };
  return L;
}

// ---------- drawing helpers ----------
function rrPath(g, x, y, w, h, r) { rrect(g, x, y, w, h, r); }
function font(size, weight) { return `${weight || 800} ${Math.round(size)}px ${FONT}`; }
function fitSize(s, size, maxW, weight) { ctx.font = font(size, weight); const w = ctx.measureText(s).width; return w > maxW ? Math.max(8, size * maxW / w) : size; }
function txt(s, x, y, size, fill, stroke, align, weight) {
  ctx.font = font(size, weight); ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(2.5, size * 0.2); ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill || '#fff'; ctx.fillText(s, x, y);
}
function fitTxt(s, x, y, size, maxW, fill, stroke, align, weight) { txt(s, x, y, fitSize(s, size, maxW, weight), fill, stroke, align, weight); }
function wrapLines(s, size, maxW, weight) {
  ctx.font = font(size, weight); const words = s.split(' '), lines = []; let line = '';
  for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function wrapTxt(s, x, y, size, maxW, fill, stroke, weight, align) {
  const lines = wrapLines(s, size, maxW, weight), lh = size * 1.22;
  lines.forEach((l, i) => txt(l, x, y + (i - (lines.length - 1) / 2) * lh, size, fill, stroke, align || 'center', weight));
  return lines.length * lh;
}
function plate(x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrPath(ctx, x, y + 2.5, w, h, h / 2); ctx.fill();
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(44,32,70,0.9)'); gr.addColorStop(1, 'rgba(20,14,38,0.92)');
  ctx.fillStyle = gr; rrPath(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; rrPath(ctx, x + 1, y + 1, w - 2, h - 2, h / 2 - 1); ctx.stroke();
}
function hit(b, name, fn) { UI.hits.push({ b, name, fn }); }
// chunky game button: dark outline, side lip, gradient face, gloss; pressed buttons sink; ready ones shine
function button(b, label, sub, style, enabled, opts) {
  opts = opts || {};
  const c = BTN[enabled ? style : 'off'], down = UI.press === opts.name && enabled;
  const lip = Math.max(4, Math.round(b.h * 0.085)), h = b.h - lip, sink = down ? lip * 0.75 : 0, y = b.y + sink;
  const r = Math.min(h * 0.32, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrPath(ctx, b.x + 2, b.y + lip + 4, b.w, h, r); ctx.fill();
  ctx.fillStyle = c[3]; rrPath(ctx, b.x - 2, y - 2, b.w + 4, h + lip - sink + 4, r + 2); ctx.fill();
  ctx.fillStyle = c[2]; rrPath(ctx, b.x, y + lip - sink, b.w, h, r); ctx.fill();
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
  ctx.fillStyle = gr; rrPath(ctx, b.x, y, b.w, h, r); ctx.fill();
  ctx.save(); rrPath(ctx, b.x, y, b.w, h, r); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, y - h * 0.18, b.w * 0.7, h * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  if (enabled && opts.shine) {
    const k = ((S.t * 0.55 + (opts.seed || 0)) % 2.4);
    if (k < 1) { const sx = b.x - b.w * 0.3 + b.w * 1.6 * k; ctx.fillStyle = 'rgba(255,255,255,0.33)'; ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + h * 0.45, y); ctx.lineTo(sx + h * 0.05, y + h); ctx.lineTo(sx - h * 0.4, y + h); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
  let tx = b.x + b.w / 2, maxW = b.w - 16;
  if (opts.icon) {
    const is = Math.min(h * 0.62, 44), ix = b.x + Math.max(10, h * 0.18) + is / 2, iy = y + h / 2;
    opts.icon(ix, iy, is);
    const used = (ix - b.x) + is * 0.55 + 6; tx = b.x + used + (b.w - used) / 2; maxW = b.w - used - 10;
  }
  const tc = enabled ? '#fff' : '#eef0f4';
  if (sub) {
    fitTxt(label, tx, y + h * 0.37, Math.max(14, h * 0.32), maxW, tc, c[3], 'center', 900);
    if (opts.gear) {
      const ss = Math.max(12, h * 0.25), sw = fitSize(sub, ss, maxW - ss * 1.6, 900); ctx.font = font(sw, 900);
      const tw = ctx.measureText(sub).width, x0 = tx - (tw + ss * 1.3) / 2;
      iconGear(ctx, x0 + ss * 0.45, y + h * 0.73, ss * 0.48);
      txt(sub, x0 + ss * 1.3, y + h * 0.73, sw, enabled ? '#fff8c2' : '#eef0f4', c[3], 'left', 900);
    } else fitTxt(sub, tx, y + h * 0.73, Math.max(12, h * 0.24), maxW, '#fff8d6', c[3], 'center', 800);
  } else fitTxt(label, tx, y + h / 2, Math.max(15, h * 0.4), maxW, tc, c[3], 'center', 900);
}
function roundBtn(b, name, drawIcon, enabled) {
  const down = UI.press === name, y = b.y + (down ? 3 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrPath(ctx, b.x, b.y + 4, b.w, b.h, b.w * 0.3); ctx.fill();
  ctx.fillStyle = enabled === false ? 'rgba(60,60,80,0.8)' : 'rgba(40,30,66,0.9)'; rrPath(ctx, b.x, y, b.w, b.h, b.w * 0.3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; rrPath(ctx, b.x + 1, y + 1, b.w - 2, b.h - 2, b.w * 0.3); ctx.stroke();
  drawIcon(b.x + b.w / 2, y + b.h / 2, b.w * 0.36);
}

// ---------- frame ----------
function draw() {
  if (!ctx || !W) return;
  UI.hits = [];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (S.phase !== 'play' || !S.save) { drawLoading(); return; }
  drawWorld(S.t);
  tutStep();
  drawHud();
  if (FX.banner) drawBanner();
  if (S.modal) drawModal();
  drawTutorial();
  drawCheer();
  drawFlyers();
  if (S.toast && S.t < S.toast.until) drawToast(S.toast.text);
  if (S.paused) { ctx.fillStyle = 'rgba(10,8,25,0.55)'; ctx.fillRect(0, 0, W, H); txt('Paused', W / 2, H / 2, LAYOUT.U * 2.4, '#fff', OL); }
}
function drawLoading() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7cc6ff'); g.addColorStop(1, '#ffe9b8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const U = clamp(Math.min(W, H) / 22, 13, 34);
  drawHero(ctx, W / 2, H * 0.45, U * 2.6, 'sit', 0, performance.now() / 1000, 'grin');
  txt('Loading...', W / 2, H * 0.62, U * 1.4, '#fff', OL);
}
function drawFlyers() { for (const f of FX.flyers) if (f.t >= f.d) iconGear(ctx, f.x, f.y, LAYOUT.U * 0.55); }

function drawHud() {
  const L = LAYOUT, U = L.U, R = S.run, inRun = S.view === 'run';
  // scrap: the run's haul during a launch, the bank otherwise
  plate(L.scrap.x, L.scrap.y, L.scrap.w, L.scrap.h);
  const bump = 1 + FX.bump * 0.8;
  iconGear(ctx, L.scrapX, L.scrapY, L.plateH * 0.33 * bump);
  const val = inRun ? '+' + fmt(R.scrap) : fmt(S.save.scrap);
  fitTxt(val, L.scrap.x + L.plateH * 0.95, L.scrapY + 1, L.plateH * 0.46 * (1 + FX.bump * 0.3), L.scrap.w - L.plateH * 1.15, inRun ? '#ffe680' : '#fff', null, 'left', 900);
  roundBtn(L.music, 'music', (x, y, r) => iconMusic(ctx, x, y, r, !!S.save.music));
  hit(L.music, 'music', toggleMusic);
  if (canRestart() && !S.modal) {                  // restart this launch (labelled so it can't be missed)
    roundBtn(L.reset, 'reset', (x, y, r) => iconReset(ctx, x, y, r)); hit(L.reset, 'reset', () => openModal({ type: 'reset', whole: S.view === 'aim' }));
    txt('RESTART', L.reset.x + L.reset.w / 2, L.reset.y + L.reset.h + U * 0.5, Math.max(10, U * 0.5), '#fff', OL, 'center', 900);
  }
  if (!inRun) {
    plate(L.best.x, L.best.y, L.best.w, L.best.h);
    fitTxt('BEST ' + fmt(S.save.best) + ' m', L.best.x + L.best.w / 2, L.best.y + L.best.h / 2 + 1, L.best.h * 0.5, L.best.w - 16, '#ffd447', null, 'center', 900);
  }
  if (S.view === 'aim' && !S.modal) drawAim();
  if (inRun) drawRunHud();
}
// the wall that matters now: in a launch, the next wall still standing ahead (every wall is back each launch);
// before a launch, the first wall never broken (the goal)
function nextWallInfo() {
  const R = S.run, inRun = R && R.phase !== "aim";
  for (let i = 0; i < WALLS.length; i++) if (inRun ? R.walls.some(w => w.i === i) : S.save.walls[i] > 0) {
    const live = R && R.walls.find(w => w.i === i);
    const depth = live && R.inWall === live ? R.wallDepth : R && R.wallHit && R.wallHit.name === WALLS[i].name ? R.wallHit.depth : 0;
    return { i, w: WALLS[i], best: S.save.wallBest[i] || 0, depth, from: i ? WALLS[i - 1].x + WALLS[i - 1].len : 0 };
  }
  return null;
}
function drawRunHud() {
  const L = LAYOUT, U = L.U, R = S.run;
  // distance + progress to the next wall
  const cx = W / 2, top = L.pad + (L.portrait ? L.plateH + L.pad : 0);
  txt(fmt(Math.max(0, R.x)) + ' m', cx, top + U * 1.2, U * 2.3, '#fff', OL, 'center', 900);
  const nw = nextWallInfo();
  const bw = Math.min(W * (L.portrait ? 0.7 : 0.36), U * 16), bx = cx - bw / 2, by = top + U * 2.6, bh = Math.max(10, U * 0.6);
  ctx.fillStyle = 'rgba(20,14,38,0.75)'; rrPath(ctx, bx - 3, by - 3, bw + 6, bh + 6, bh); ctx.fill();
  if (nw) {
    const k = clamp((R.x - nw.from) / (nw.w.x - nw.from), 0, 1);
    ctx.fillStyle = '#ffd447'; rrPath(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2); ctx.fill();
    const bk = clamp((S.save.best - nw.from) / (nw.w.x - nw.from), 0, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * bk - 1, by - 3, 3, bh + 6);
    txt(nw.depth > 0 ? nw.w.name + ': ' + Math.round(nw.depth / nw.w.len * 100) + '% through' : 'Next: ' + nw.w.name, cx, by + bh + U * 0.9, U * 0.85, '#fff', OL, 'center', 800);
  } else txt('Smash on! Best ' + fmt(S.save.best) + ' m', cx, by + bh + U * 0.9, U * 0.85, '#fff', OL, 'center', 800);
  // the slam gauge: a segmented bar up the left edge that fills from the bottom (one segment per slam)
  const sp = L.speed, gTop = L.scrap.y + L.plateH + L.pad + U * 1.6, gBot = sp.y - L.pad * 0.8, gw = Math.max(18, U * 1.15);
  const segs = Math.max(R.st.slamMax, R.slams), sh = Math.min(U * 2.2, (gBot - gTop) / segs), gx = L.pad;
  iconSlam(ctx, gx + gw / 2, gBot - segs * sh - U * 0.9, U * 0.75, R.slams > 0);
  for (let i = 0; i < segs; i++) {
    const y = gBot - (i + 1) * sh, full = i < R.slams, extra = i >= R.st.slamMax;
    ctx.fillStyle = 'rgba(20,14,38,0.75)'; rrPath(ctx, gx - 2, y - 1, gw + 4, sh, gw * 0.3); ctx.fill();
    if (full) { ctx.fillStyle = extra ? '#7ff3e8' : '#ff9b3d'; rrPath(ctx, gx + 2, y + 2, gw - 4, sh - 5, gw * 0.25); ctx.fill(); }
    else if (i === R.slams && R.slamPart > 0) { const f = (sh - 5) * R.slamPart; ctx.fillStyle = 'rgba(255,155,61,0.55)'; rrPath(ctx, gx + 2, y + 2 + (sh - 5) - f, gw - 4, f, gw * 0.2); ctx.fill(); }
  }
  drawSpeedo(sp, R);
  if (R.ride && R.ride.k === 'jet') {
    const k = 1 - R.ride.t / R.ride.dur;
    txt(S.hold ? 'FLYING UP!' : 'HOLD to fly up', W / 2, H * 0.78, U * 1.3, '#ffb03b', OL, 'center', 900);
    ctx.fillStyle = 'rgba(20,14,38,0.7)'; rrPath(ctx, W / 2 - U * 4, H * 0.78 + U * 1.1, U * 8, U * 0.5, U * 0.25); ctx.fill();
    ctx.fillStyle = '#ffb03b'; rrPath(ctx, W / 2 - U * 4, H * 0.78 + U * 1.1, U * 8 * k, U * 0.5, U * 0.25); ctx.fill();
  }
}

// the speed turns red; the limit is soft (Top Speed raises it) and far over it the screen shakes.
function drawSpeedo(b, R) {
  const U = LAYOUT.U, v = Math.max(0, R.vx), vmax = speedLimit(R), over = v >= vmax - 0.05;   // shows the limit shrinking past the last wall
  plate(b.x, b.y, b.w, b.h);
  const ir = b.h * 0.42, ix = b.x + b.h * 0.5, iy = b.y + b.h / 2, img = artImg('icon-perfect');
  if (img) ctx.drawImage(img, ix - ir, iy - ir, ir * 2, ir * 2);
  else { ctx.strokeStyle = '#ffd447'; ctx.lineWidth = ir * 0.25; ctx.beginPath(); ctx.arc(ix, iy + ir * 0.2, ir * 0.8, Math.PI, 0); ctx.stroke(); }
  const cur = String(Math.round(v * 3.6)), lim = '/' + Math.round(vmax * 3.6), size = b.h * 0.5, x0 = b.x + b.h * 1.0;
  const s1 = fitSize(cur + lim + ' km/h', size, b.w - b.h * 1.2, 900); ctx.font = font(s1, 900);
  const w1 = ctx.measureText(cur).width, w2 = ctx.measureText(lim).width;
  const shakeX = over && v > vmax * 1.12 ? Math.sin(S.t * 50) * 1.5 : 0;
  txt(cur, x0 + shakeX, iy + 1, s1, over ? '#ff5b3c' : '#fff', null, 'left', 900);
  txt(lim, x0 + w1, iy + 1, s1, '#c9d3e6', null, 'left', 900);
  txt('km/h', x0 + w1 + w2 + s1 * 0.25, iy + s1 * 0.15, s1 * 0.5, '#c9d3e6', null, 'left', 800);
}

// Before the launch: the coach waits on the tyres; tap when the pad goes up for a CRIT
function drawAim() {
  const L = LAYOUT, U = L.U, g = L.gauge;
  const c = curCoach(), s = coachState(S.aimT), pulse = 1 + Math.sin(S.t * 6) * 0.05, live = !S.shot;
  drawVersus(c, g.x, g.y - U * 4.2);
  const say = !live ? '' : s.spark ? 'NOT NOW!' : s.up && !s.any ? 'NOW!' : S.pull ? 'Let go to launch!' : L.portrait ? 'Pull back to aim, let go!' : 'Pull back to aim (or SPACE), let go!';
  fitTxt(say, g.x, g.y, U * 1.45 * (s.up ? 1.15 : pulse), W - L.pad * 2, s.spark ? '#7ff3ff' : s.up ? '#ffd447' : '#fff', OL, 'center', 900);
  fitTxt(c.how + ' Tell = CRIT.', g.x, g.y + U * 1.5, U * 0.75, W - L.pad * 2, '#fff8d6', OL, 'center', 800);
  const nw = nextWallInfo();
  if (nw && S.save.runs > 0) fitTxt('Goal: the ' + nw.w.name + ' at ' + fmt(nw.w.x) + ' m  (' + wallsBroken() + '/' + WALLS.length + ' walls broken)', g.x, g.y + U * 2.8, U * 0.8, W - L.pad * 2, '#fff8d6', OL, 'center', 800);
  // coaches button
  const cb = L.coaches, affordable = UPGRADES.some(canBuy) || COACHES.some(canTrain);
  button(cb, 'UPGRADES', affordable ? 'Ready to buy!' : 'Spend your scrap', 'coach', true, { name: 'coaches', shine: affordable, icon: (x, y, s) => iconFor(UP.sling, x, y, s * 0.5) });
  hit(cb, 'coaches', () => openShop());
  hit({ x: 0, y: 0, w: W, h: H }, 'launch', doLaunch);           // anywhere else: drag to aim (a plain tap aims for you)
}
// fighting-game header before each launch: SCRAPS vs the coach, with the coach's stamina bar and level
function drawVersus(c, cx, y) {
  const U = LAYOUT.U, w = Math.min(W - LAYOUT.pad * 2, U * 21), h = U * 2.5, x = cx - w / 2;
  plate(x, y, w, h);
  const vs = U * 1.15;
  fitTxt('SCRAPS', x + w * 0.2, y + h / 2 + 1, U * 0.95, w * 0.32, '#ffd447', null, 'center', 900);
  ell(ctx, cx - w * 0.06, y + h / 2, vs, vs); fs(ctx, '#e53935', 3); txt('VS', cx - w * 0.06, y + h / 2 + 1, vs * 0.9, '#fff', OL, 'center', 900);
  const rx = cx + w * 0.05, rw = w * 0.42, max = coachHpMax(c), hp = clamp(S.save.coachHp[c.id] || max, 0, max);
  fitTxt(c.name.toUpperCase() + (c.reward ? '' : '  Lv ' + coachLvl(c.id)), rx, y + h * 0.32, U * 0.72, rw, '#fff', null, 'left', 900);
  const by = y + h * 0.58, bh = h * 0.24;
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrPath(ctx, rx, by, rw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = hp / max > 0.35 ? '#ff5b5b' : '#ffb347'; rrPath(ctx, rx, by, Math.max(bh, rw * hp / max), bh, bh / 2); ctx.fill();
  fitTxt(hp + '/' + max, rx + rw / 2, by + bh / 2 + 1, bh * 0.9, rw, '#fff', OL, 'center', 900);
}

// ---------- cards ----------
function cardBox(wU, hU) {
  const U = LAYOUT.U, w = Math.min(W - LAYOUT.pad * 2, U * wU), h = Math.min(H - LAYOUT.pad * 2, U * hU);
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function drawCard(b, accent, title, appear) {
  const k = appear === undefined ? 1 : appear, s = 0.85 + 0.15 * k;
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(s, s); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrPath(ctx, b.x + 4, b.y + 8, b.w, b.h, 22); ctx.fill();
  ctx.fillStyle = OL; rrPath(ctx, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 25); ctx.fill();
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#fff8e8'); g.addColorStop(1, '#ffe2b8');
  ctx.fillStyle = g; rrPath(ctx, b.x, b.y, b.w, b.h, 22); ctx.fill();
  if (title) {
    const U = LAYOUT.U, rh = U * 2.4;
    ctx.fillStyle = accent; rrPath(ctx, b.x + U * 0.8, b.y - rh * 0.45, b.w - U * 1.6, rh, rh * 0.4); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
    fitTxt(title, b.x + b.w / 2, b.y - rh * 0.45 + rh / 2 + 1, U * 1.25, b.w - U * 3, '#fff', OL, 'center', 900);
  }
  return () => ctx.restore();
}
function drawModal() {
  const m = S.modal, U = LAYOUT.U, ap = Math.min(1, (S.t - m.t0) * 6);
  ctx.fillStyle = `rgba(14,10,30,${0.5 * ap})`; ctx.fillRect(0, 0, W, H);
  UI.hits = UI.hits.filter(h => h.name === 'music' || h.name === 'reset');   // the card owns the input now
  if (m.type === 'results') return drawResults(m, ap);
  if (m.type === 'shop') return drawShop(m, ap);
  if (m.type === 'zone' || m.type === 'ending') return drawZoneCard(m, ap);
  if (m.type === 'meet') return drawMeet(m, ap);
  if (m.type === 'reset') return drawReset(m, ap);
  if (m.type === 'row') return drawRowCard(m, ap);
}
function statRow(label, value, x, y, w, size, col) {
  txt(label, x, y, size, '#5b4a6b', null, 'left', 800);
  txt(value, x + w, y, size, col || '#2b2140', null, 'right', 900);
}
function drawResults(m, ap) {
  const L = LAYOUT, U = L.U, Ls = S.last;
  const tall = U * ((Ls.wall ? 25 : 22.5) + (Ls.koBonus ? 1.35 : 0) + (Ls.wallScrap ? 1.35 : 0)), wide = H - L.pad * 2 < tall;      // short screens: stats left, buttons right
  const b = wide ? { w: Math.min(W - L.pad * 2, U * 38), h: Math.min(H - L.pad * 2 - U, U * 20) } : cardBox(20, tall / U);
  if (wide) { b.x = (W - b.w) / 2; b.y = (H - b.h) / 2 + U * 0.5; }
  const done = drawCard(b, Ls.record ? '#f0661f' : '#6a4fc9', Ls.record ? 'NEW RECORD!' : 'RUN OVER', ap);
  const ix = b.x + U * 1.2, iw = wide ? (b.w - U * 3.6) / 2 : b.w - U * 2.4, cx = ix + iw / 2;
  const k = wide ? Math.min(1, (b.h - U * 2) / (U * 17)) : 1;            // squeeze rows on very short screens
  let y = b.y + U * (wide ? 3.4 : 3.2) * k;
  txt(fmt(Ls.dist) + ' m', cx, y, U * 3 * k, Ls.record ? '#f0661f' : '#2b2140', null, 'center', 900); y += U * 2.3 * k;
  const rs = U * 0.95 * Math.max(0.8, k), step = U * 1.35 * k;
  statRow('Robots smashed', String(Ls.smashed), ix, y, iw, rs); y += step;
  statRow('Best combo', 'x' + Ls.combo, ix, y, iw, rs); y += step;
  statRow('Scrap from robots', '+' + fmt(Ls.robotScrap), ix, y, iw, rs, '#1f8035'); y += step;
  statRow('Distance bonus', '+' + fmt(Ls.distScrap), ix, y, iw, rs, '#1f8035'); y += Ls.koBonus || Ls.wallScrap ? step : U * 1.2 * k;
  if (Ls.wallScrap) { statRow('Walls smashed x' + Ls.broke.length, '+' + fmt(Ls.wallScrap), ix, y, iw, rs, '#1f8035'); y += Ls.koBonus ? step : U * 1.2 * k; }
  if (Ls.koBonus) { statRow('KO! ' + COACH[Ls.ko].name, '+' + fmt(Ls.koBonus), ix, y, iw, rs, '#f0661f'); y += U * 1.2 * k; }
  if (Ls.wall) {
    y += U * 0.3 * k;
    fitTxt(Ls.wall.name + ': ' + Math.round(Ls.wall.frac * 100) + '% through. Faster next time!', cx, y, U * 0.9 * Math.max(0.8, k), iw, '#b5420c', null, 'center', 900); y += U * 0.9 * k;
    const bh = U * 0.7;
    ctx.fillStyle = '#d9c7a8'; rrPath(ctx, ix, y, iw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#f0661f'; rrPath(ctx, ix, y, Math.max(bh, iw * Ls.wall.frac), bh, bh / 2); ctx.fill();
    y += bh + U * 0.6 * k;
  }
  // total and buttons: under the stats (portrait) or in the right column (wide)
  const ax = wide ? b.x + b.w / 2 + U * 0.6 : ix, aw = iw, acx = ax + aw / 2;
  const ty = wide ? b.y + U * 1.9 : y;
  ctx.fillStyle = 'rgba(43,33,64,0.08)'; rrPath(ctx, ax, ty, aw, U * 2.2, U * 0.6); ctx.fill();
  iconGear(ctx, acx - U * 3.2, ty + U * 1.1, U * 0.7);
  fitTxt('+' + fmt(Ls.total * (Ls.doubled ? 2 : 1)) + (Ls.doubled ? '  (x2!)' : ''), acx + U * 0.6, ty + U * 1.1, U * 1.4, aw - U * 3, '#2b2140', null, 'center', 900);
  const bh = Math.max(52, U * 3), gap = U * 0.6, by = b.y + b.h - bh - U * 1.0, half = (aw - gap) / 2;
  const coaches = { x: ax, y: by, w: half, h: bh }, go = { x: ax + half + gap, y: by, w: half, h: bh };
  const affordable = UPGRADES.some(canBuy) || COACHES.some(canTrain);
  button(coaches, 'UPGRADES', affordable ? 'Ready to buy!' : null, 'coach', true, { name: 'coaches', shine: affordable });
  button(go, 'LAUNCH!', null, 'go', true, { name: 'launch', shine: !affordable });
  hit(coaches, 'coaches', () => { S.modal = null; openShop(); });
  hit(go, 'launch', launchAgain);
  if (doubleReady()) {
    const vh = Math.max(48, bh * 0.85), vb = { x: ax, y: by - vh - gap, w: aw, h: vh };
    button(vb, 'x2 SCRAP', 'Watch a video', 'video', !S.adBusy, { name: 'double', icon: (x, y, s) => iconVideo(ctx, x, y, s * 0.4) });
    hit(vb, 'double', watchDouble);
  }
  done();
  m.box = b; m.btn = { coaches, launch: go };
  m.slot = wide ? { x: ax, y: ty + U * 2.6, w: aw, h: by - gap - ty - U * 2.6 } : null;   // free space for a tutorial tip
}
function drawZoneCard(m, ap) {
  const U = LAYOUT.U, b = cardBox(20, 21), end = m.type === 'ending';
  const done = drawCard(b, end ? '#e53935' : '#1f8035', end ? 'YOU DID IT!' : 'WALL SMASHED!', ap);
  const cx = b.x + b.w / 2;
  for (let i = 0; i < 3; i++) { const a = S.t * 0.6 + i * 2.1; ctx.fillStyle = 'rgba(255,212,71,0.25)'; ctx.beginPath(); ctx.moveTo(cx, b.y + U * 6.5); ctx.arc(cx, b.y + U * 6.5, U * 6, a, a + 0.5); ctx.fill(); }
  drawHero(ctx, cx, b.y + U * 6.5, U * 2.2, 'sit', 0, S.t, 'happy');
  if (end) {
    txt('CleanCorp Gate smashed!', cx, b.y + U * 11, U * 1.2, '#2b2140', null, 'center', 900);
    wrapTxt('The junkyard is free and the snack stash is back. Keep launching through the Snack Vault to beat your best distance!', cx, b.y + U * 13.6, U * 0.9, b.w - U * 2.4, '#5b4a6b', null, 800);
  } else {
    const Z = ZONES[m.z];
    txt('Welcome to ' + Z.name + '!', cx, b.y + U * 11, U * 1.25, '#2b2140', null, 'center', 900);
    // the coaches this wall opens (zone m.z starts after wall m.z), read from COACHES so the card can't go stale
    const news = COACHES.filter(c => c.wall === m.z).map(c => c.reward ? ' ' + c.name + ' joined your coaches!' : ' ' + c.name + ' can be hired now!').join('');
    const last = m.z === WALLS.length - 1 ? ' The CleanCorp Gate ahead only falls to a nearly maxed team!' : '';   // the final wall needs ~90%+ of everything
    wrapTxt('Robots here pay ' + Math.round(Z.value / ZONES[m.z - 1].value) + 'x more scrap.' + (news || (last ? '' : ' New robots ahead!')) + last, cx, b.y + U * 13.2, U * 0.95, b.w - U * 2.4, '#5b4a6b', null, 800);
  }
  const bb = { x: b.x + U * 1.2, y: b.y + b.h - U * 4.2, w: b.w - U * 2.4, h: Math.max(52, U * 3) };
  button(bb, 'AWESOME!', null, 'go', true, { name: 'ok' }); hit(bb, 'ok', closeModal);
  done();
}
function drawMeet(m, ap) {
  const U = LAYOUT.U, info = MEET[m.what], tw = Math.min(W - LAYOUT.pad * 2, U * 18) - U * 2.4;
  // the card grows with the text (4 lines ran under GOT IT!); on a screen too short for that, the text shrinks
  let size = U, lines = wrapLines(info.text, size, tw, 800);
  const b = cardBox(18, Math.max(15.5, 13.2 + lines.length * 1.22));
  while (lines.length * size * 1.22 > b.h - U * 13.2 && size > U * 0.7) { size *= 0.92; lines = wrapLines(info.text, size, tw, 800); }
  const done = drawCard(b, '#6a4fc9', 'NEW: ' + info.title.toUpperCase(), ap);
  const cx = b.x + b.w / 2;
  if (m.what === 'wall') { const nw = nextWallInfo(); drawWall(ctx, nw ? nw.i : 0, cx - U * 1.4, b.y + U * 7.6, U * 0.9, 1, S.t, b.y + U * 2.2); }
  else if (m.what === 'claw') { const im = artImg('claw'); if (im) sprite(ctx, im, cx, b.y + U * 5.4, U * 4, 0, false); }
  else drawBot(ctx, { type: m.what, x: 0, t: S.t, dir: 1, panic: 0 }, cx, b.y + U * 7.2, U * 2.4, S.t, 'calm');
  wrapTxt(info.text, cx, b.y + U * 8.4 + lines.length * size * 0.61, size, tw, '#2b2140', null, 800);
  const bb = { x: b.x + U * 1.2, y: b.y + b.h - U * 4, w: b.w - U * 2.4, h: Math.max(52, U * 2.8) };
  button(bb, 'GOT IT!', null, 'go', true, { name: 'ok' }); hit(bb, 'ok', closeModal);
  done();
}
function drawReset(m, ap) {
  const U = LAYOUT.U, b = cardBox(18, 13);
  const whole = !!m.whole, done = drawCard(b, '#e53935', whole ? 'START OVER?' : 'RESTART LAUNCH?', ap);
  wrapTxt(whole ? 'Restart the WHOLE game: all your scrap, upgrades, coaches and broken walls are wiped and the tutorial starts again. This cannot be undone.' : 'Back to the slingshot for a new launch. The scrap from this launch is lost; your upgrades and coaches stay.', b.x + b.w / 2, b.y + U * 5, U * 0.9, b.w - U * 2.4, '#2b2140', null, 800);
  const bh = Math.max(52, U * 2.8), gap = U * 0.6, w = (b.w - U * 2.4 - gap) / 2, y = b.y + b.h - bh - U;
  const no = { x: b.x + U * 1.2, y, w, h: bh }, yes = { x: b.x + U * 1.2 + w + gap, y, w, h: bh };
  button(no, 'CANCEL', null, 'plain', true, { name: 'cancel' }); hit(no, 'cancel', () => { S.modal = null; });
  button(yes, whole ? 'START OVER' : 'RESTART', null, 'red', true, { name: 'restart' }); hit(yes, 'restart', () => restartPressed(whole));
  done();
}

function openShop() {
  if (S.save.tut === TUT.BUY || S.save.tut === TUT.SHOP) { UI.sel = 'sling'; UI.tab = 'up'; }
  if (!UP[UI.sel] || !rowOpen(rowOf(UP[UI.sel]))) UI.sel = (UPGRADES.find(canBuy) || UP.sling).id;
  if (!tabOpen(UI.tab)) UI.tab = 'up';
  if (UI.tab !== 'coach' && tabOf(UP[UI.sel]) !== UI.tab) UI.sel = (UPGRADES.find(u => tabOf(u) === UI.tab && rowOpen(rowOf(u))) || UP.sling).id;
  openModal({ type: 'shop' });
}
function iconFor(u, x, y, r) {                      // a ChatGPT icon when loaded, otherwise a drawn badge with the initial
  const img = artImg('icon-' + u.id);
  if (img) { ctx.drawImage(img, x - r, y - r, r * 2, r * 2); return; }
  ctx.fillStyle = '#17a596'; ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OL; ctx.lineWidth = Math.max(2, r * 0.1); ctx.stroke();
  txt(u.name[0], x, y + 1, r * 0.95, '#fff', OL, 'center', 900);
}
function drawShop(m, ap) {
  const L = LAYOUT, U = L.U;
  const pw = Math.min(W - L.pad * 2, L.portrait ? U * 27 : U * 52), ph = H - L.pad * 2;
  const b = { x: (W - pw) / 2, y: L.pad, w: pw, h: ph };
  const done = drawCard(b, '#17a596', null, ap);
  // header: title, bank, close
  const hh = Math.max(52, U * 2.8);
  const close = { x: b.x + b.w - hh - U * 0.4, y: b.y + U * 0.4, w: hh, h: hh };
  roundBtn(close, 'close', (x, y, r) => { ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); });
  hit(close, 'close', closeModal);
  const sw = U * 6.5, sx = close.x - sw - U * 0.5, sy = b.y + U * 0.6, sh = hh - U * 0.4;
  plate(sx, sy, sw, sh); iconGear(ctx, sx + U * 1.1, sy + sh / 2, U * 0.6);
  fitTxt(fmt(S.save.scrap), sx + U * 2, sy + sh / 2 + 1, U * 1.05, sw - U * 2.4, '#fff', null, 'left', 900);
  const tw = Math.min((sx - b.x - U * 1.6) / 3, U * 7), th = hh - U * 0.3;
  TABS.map(([id, label]) => [id, label, id === "coach" ? COACHES.some(canTrain) : UPGRADES.some(u => tabOf(u) === id && canBuy(u))]).forEach(([id, label, can], i) => {
    const tb = { x: b.x + U * 0.7 + i * (tw + U * 0.3), y: b.y + U * 0.55, w: tw, h: th }, on = UI.tab === id, open = tabOpen(id);
    m["tab_" + id] = tb;
    if (!open) { ctx.fillStyle = "rgba(43,33,64,0.08)"; rrPath(ctx, tb.x, tb.y, tb.w, tb.h, th * 0.35); ctx.fill(); fitTxt(label, tb.x + (tb.w - U * 1.1) / 2, tb.y + tb.h / 2 + 1, U * 0.8, tb.w - U * 1.5, "#a59cb0", null, "center", 900); drawLock(tb.x + tb.w - U * 0.6, tb.y + tb.h / 2, U * 0.5); return; }   // the label sits left of the padlock (it hid "SPECIALS")
    ctx.fillStyle = on ? '#17a596' : 'rgba(43,33,64,0.12)'; rrPath(ctx, tb.x, tb.y, tb.w, tb.h, th * 0.35); ctx.fill();
    if (on) { ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.stroke(); }
    fitTxt(label, tb.x + tb.w / 2, tb.y + tb.h / 2 + 1, U * 0.9, tb.w - U * 0.8, on ? '#fff' : '#5b4a6b', on ? OL : null, 'center', 900);
    if (can && !on) { ctx.fillStyle = '#2fb44a'; ctx.beginPath(); ctx.arc(tb.x + tb.w - U * 0.3, tb.y + U * 0.3, U * 0.38, 0, Math.PI * 2); ctx.fill(); txt('!', tb.x + tb.w - U * 0.3, tb.y + U * 0.32, U * 0.55, '#fff', null, 'center', 900); }
    hit(tb, "tab:" + id, () => setTab(id));
  });
  const bx = b.x + U * 0.8, by = b.y + hh + U * 0.6, bw = b.w - U * 1.6, bh = b.y + b.h - U * 0.8 - by;
  if (UI.tab === 'coach') { drawCoachTab({ x: bx, y: by, w: bw, h: bh }); done(); m.close = close; return; }
  // body: grid + detail, side by side on wide screens, stacked on tall ones
  const wide = bw > bh * 1.15;
  const grid = wide ? { x: bx, y: by, w: bw * 0.56, h: bh } : { x: bx, y: by, w: bw, h: Math.min(bh * 0.62, bw * 1.45) };
  const det = wide ? { x: bx + bw * 0.56 + U * 0.6, y: by, w: bw * 0.44 - U * 0.6, h: bh } : { x: bx, y: grid.y + grid.h + U * 0.5, w: bw, h: by + bh - (grid.y + grid.h + U * 0.5) };
  const rowsT = ROWS.filter(r => r.tab === UI.tab), rows = Math.max(3, rowsT.length), rh = grid.h / rows, cw = Math.min(grid.w / 4, rh * 1.25), cr = Math.min(cw, rh) * 0.4;
  const gx0 = grid.x + (grid.w - cw * 4) / 2;
  rowsT.forEach((row, ri) => {
    const open = rowOpen(row), ry = grid.y + ri * rh, cy = ry + rh / 2;
    ctx.fillStyle = open ? 'rgba(23,165,150,0.10)' : 'rgba(43,33,64,0.08)'; rrPath(ctx, gx0, ry + rh * 0.06, cw * 4, rh * 0.88, rh * 0.3); ctx.fill();
    // row label: what kind of upgrades this row holds (no sellers)
    const fx = gx0 + cw * 0.5;
    fitTxt(row.name.toUpperCase(), fx, cy, Math.min(U * 0.78, rh * 0.24), cw * 0.95, open ? '#0d7266' : '#8a7f95', null, 'center', 900);
    if (!open) {
      drawLock(fx, cy - rh * 0.27, cr * 0.32);
      const why = row.wall ? 'Opens after the ' + WALLS[row.wall - 1].name : 'Opens after launch ' + row.runs;
      ctx.fillStyle = 'rgba(255,248,232,0.85)'; rrPath(ctx, gx0 + cw * 1.05, ry + rh * 0.2, cw * 2.85, rh * 0.6, rh * 0.25); ctx.fill();
      fitTxt(why, gx0 + cw * 2.5, cy, Math.min(U * 0.8, rh * 0.26), cw * 2.7, '#5b4a6b', null, 'center', 800);
      return;
    }
    UPGRADES.filter(u => u.row === row.id).forEach((u, k) => {
      const x = gx0 + cw * (1.5 + k), lv = lvl(u.id), maxed = lv >= u.max, sel = UI.sel === u.id, can = canBuy(u);
      const r = cr * (sel ? 1.08 + Math.sin(S.t * 6) * 0.03 : 1);
      if (sel) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, cy, r * 1.16, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f0661f'; ctx.lineWidth = Math.max(3, r * 0.12); ctx.stroke(); }
      iconFor(u, x, cy, r);
      if (maxed) { ctx.strokeStyle = '#ffd447'; ctx.lineWidth = Math.max(3, r * 0.12); ctx.beginPath(); ctx.arc(x, cy, r * 1.0, 0, Math.PI * 2); ctx.stroke(); }
      // level pill
      const pl = maxed ? 'MAX' : lv + '/' + u.max, ps = Math.max(10, r * 0.42);
      ctx.font = font(ps, 900); const pwid = ctx.measureText(pl).width + ps * 0.8;
      ctx.fillStyle = maxed ? '#b57600' : OL; rrPath(ctx, x - pwid / 2, cy + r * 0.62, pwid, ps * 1.25, ps * 0.6); ctx.fill();
      txt(pl, x, cy + r * 0.62 + ps * 0.66, ps, '#fff', null, 'center', 900);
      if (can) { ctx.fillStyle = '#2fb44a'; ctx.beginPath(); ctx.arc(x + r * 0.78, cy - r * 0.72, Math.max(7, r * 0.26), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); txt('!', x + r * 0.78, cy - r * 0.72 + 1, Math.max(10, r * 0.36), '#fff', null, 'center', 900); }
      const hb = { x: x - cw / 2, y: ry, w: cw, h: rh };
      hit(hb, 'cell:' + u.id, () => { UI.sel = u.id; SFX.click(); });
      u._cell = hb;
    });
  });
  drawShopDetail(det, UP[UI.sel] || UP.sling);
  done();
  m.close = close;
}
// pick a coach (portrait, name, level pips) and a big detail panel for the picked one: launch speed, stamina and KO
// bonus now and after the next level, their trick, and HIRE / TRAIN.
function drawCoachTab(d) {
  const U = LAYOUT.U, wide = d.w > d.h * 1.15;
  const grid = wide ? { x: d.x, y: d.y, w: d.w * 0.5, h: d.h } : { x: d.x, y: d.y, w: d.w, h: d.h * 0.46 };
  const det = wide ? { x: d.x + d.w * 0.5 + U * 0.5, y: d.y, w: d.w * 0.5 - U * 0.5, h: d.h } : { x: d.x, y: grid.y + grid.h + U * 0.4, w: d.w, h: d.h - grid.h - U * 0.4 };
  if (!COACH[UI.coachSel]) UI.coachSel = curCoach().id;
  const cols = 3, rows = 2, gap = U * 0.4, cw = (grid.w - gap * (cols - 1)) / cols, ch = (grid.h - gap * (rows - 1)) / rows;
  COACHES.forEach((c, i) => {
    const cx = grid.x + (i % cols) * (cw + gap), cy = grid.y + Math.floor(i / cols) * (ch + gap);
    const lv = coachLvl(c.id), open = coachOpen(c) || lv > 0, sel = UI.coachSel === c.id, next = S.save.coachCur === c.id && lv > 0;
    ctx.fillStyle = sel ? '#fff' : lv ? '#fffbe6' : 'rgba(43,33,64,0.08)'; rrPath(ctx, cx, cy, cw, ch, U * 0.6); ctx.fill();
    ctx.strokeStyle = sel ? '#f0661f' : 'rgba(43,33,64,0.25)'; ctx.lineWidth = sel ? 4 : 2; ctx.stroke();
    const pr = Math.min(cw * 0.36, ch * 0.3), px = cx + cw / 2, py = cy + U * 0.35 + pr;
    ctx.fillStyle = open ? '#ffe2b8' : '#d9d0c4'; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip(); if (!open) ctx.globalAlpha = 0.35; drawCoach(ctx, c.id, px, py + pr * 0.12, pr * 0.95, S.t); ctx.restore(); ctx.globalAlpha = 1;
    if (!open) drawLock(px + pr * 0.7, py + pr * 0.6, U * 0.45);
    if (next) { const tw = Math.min(cw * 0.9, U * 3.4); ctx.fillStyle = '#f0661f'; rrPath(ctx, px - tw / 2, cy + U * 0.1, tw, U * 0.75, U * 0.3); ctx.fill(); fitTxt('UP NEXT', px, cy + U * 0.48, U * 0.5, tw - 4, '#fff', null, 'center', 900); }
    const ny = py + pr + Math.min(U * 0.85, (cy + ch - py - pr) * 0.35);
    fitTxt(c.name.split(' ').slice(-1)[0], px, ny, U * 0.8, cw - U * 0.4, '#2b2140', null, 'center', 900);
    if (!c.reward && c.max > 1) {                     // level pips
      const pw = Math.min(U * 0.55, (cw - U * 0.6) / c.max - 2), x0 = px - (c.max * (pw + 2) - 2) / 2, y = Math.min(cy + ch - U * 0.55, ny + U * 0.7);
      for (let j = 0; j < c.max; j++) { ctx.fillStyle = j < lv ? '#f0661f' : 'rgba(43,33,64,0.18)'; rrPath(ctx, x0 + j * (pw + 2), y, pw, U * 0.3, U * 0.12); ctx.fill(); }
    } else if (lv && canTrain(c) === false && c.reward) fitTxt('TEAM', px, Math.min(cy + ch - U * 0.4, ny + U * 0.85), U * 0.55, cw - 6, '#1f8035', null, 'center', 900);
    if (canTrain(c)) { ctx.fillStyle = '#2fb44a'; ctx.beginPath(); ctx.arc(cx + cw - U * 0.45, cy + U * 0.45, U * 0.36, 0, Math.PI * 2); ctx.fill(); txt('!', cx + cw - U * 0.45, cy + U * 0.47, U * 0.5, '#fff', null, 'center', 900); }
    const hb = { x: cx, y: cy, w: cw, h: ch };
    hit(hb, 'pick:' + c.id, () => { UI.coachSel = c.id; SFX.click(); });
    c._cell = hb;
  });
  drawCoachDetail(det, COACH[UI.coachSel]);
}
function drawCoachDetail(d, c) {
  const U = LAYOUT.U, lv = coachLvl(c.id), open = coachOpen(c) || lv > 0, maxed = lv >= c.max, L0 = Math.max(1, lv), L1 = lv ? lv + 1 : 1;
  ctx.fillStyle = '#fffdf6'; rrPath(ctx, d.x, d.y, d.w, d.h, U * 0.8); ctx.fill(); ctx.strokeStyle = 'rgba(43,33,64,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  const pad = U * 0.7, ix = d.x + pad, iw = d.w - pad * 2;
  const bh = Math.max(52, Math.min(U * 3, d.h * 0.22)), btn = { x: ix, y: d.y + d.h - bh - pad, w: iw, h: bh };
  const avail = btn.y - d.y - pad, k = clamp(avail / (U * 11), 0.62, 1), size = U * 0.95 * k;   // text never smaller than ~60%
  let y = d.y + pad + U * 0.6 * k;
  fitTxt(c.name, ix, y, U * 1.3 * k, iw, '#2b2140', null, 'left', 900);
  if (!c.reward && lv) txt('Lv ' + lv + '/' + c.max, ix + iw, y, U * 0.85 * k, '#b5420c', null, 'right', 900);
  y += U * 1.25 * k;
  y += wrapTxt(c.how, ix + iw / 2, y + U * 0.35 * k, U * 0.78 * k, iw, '#5b4a6b', null, 800) + U * 0.2 * k;
  // the stats, now -> after the next level (bold green)
  const rows = [['Launch speed', 'x' + coachSpeed(c, L0).toFixed(2), 'x' + coachSpeed(c, L1).toFixed(2)],
    ['Stamina', String(coachHpMax(c, L0)), String(coachHpMax(c, L1))],
    ['KO bonus', fmt(coachKo(c, L0)), fmt(coachKo(c, L1))]];
  const showNext = lv > 0 && !maxed && !c.reward;
  for (const [label, now, nx] of rows) {
    y += U * 1.15 * k;
    txt(label, ix, y, size, '#5b4a6b', null, 'left', 800);
    if (showNext) { fitTxt(now + '  >  ' + nx, ix + iw, y, size, iw * 0.5, '#1f8035', null, 'right', 900); }
    else txt(now, ix + iw, y, size, '#2b2140', null, 'right', 900);
  }
  if (c.reward) fitTxt(lv ? 'On your team! (no levels)' : 'Reward: break the ' + WALLS[c.wall - 1].name, ix + iw / 2, btn.y + bh / 2, U * 0.95 * k, iw, lv ? '#1f8035' : '#b5420c', null, 'center', 900);
  else if (!open) { drawLock(ix + U * 0.6, btn.y + bh / 2, U * 0.55); fitTxt('Opens ' + (c.wall ? 'after the ' + WALLS[c.wall - 1].name : 'after launch ' + c.runs), ix + iw / 2 + U * 0.6, btn.y + bh / 2, U * 0.9 * k, iw - U * 1.6, '#5b4a6b', null, 'center', 900); }
  else if (maxed) button(btn, 'MAXED', null, 'plain', false, { name: 'coach:' + c.id });
  else { button(btn, lv ? 'TRAIN' : 'HIRE', fmt(coachCost(c)), 'buy', canTrain(c), { name: 'coach:' + c.id, gear: true, shine: canTrain(c) }); hit(btn, 'coach:' + c.id, () => buyCoach(c)); }
  c._btn = btn;
}
// switch shop tab; the picked upgrade moves into the new tab
function setTab(id) {
  if (!tabOpen(id)) { SFX.nope(); return; }
  UI.tab = id; SFX.click();
  if (id !== 'coach' && (!UP[UI.sel] || tabOf(UP[UI.sel]) !== id)) { const first = UPGRADES.find(u => tabOf(u) === id && rowOpen(rowOf(u))); if (first) UI.sel = first.id; }
}
function drawShopDetail(d, u) {
  const U = LAYOUT.U, row = rowOf(u), lv = lvl(u.id), maxed = lv >= u.max, cost = upCost(u), can = canBuy(u);
  ctx.fillStyle = '#fffdf6'; rrPath(ctx, d.x, d.y, d.w, d.h, U * 0.8); ctx.fill(); ctx.strokeStyle = 'rgba(43,33,64,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  const pad = U * 0.7, ix = d.x + pad, iw = d.w - pad * 2;
  const bh = Math.max(52, Math.min(U * 3, d.h * 0.24));
  const buy = { x: ix, y: d.y + d.h - bh - pad, w: iw, h: bh };
  const avail = buy.y - d.y - pad;                    // room above the button
  const k = Math.min(1, avail / (U * 8));             // squeeze text on short panels
  fitTxt(row.name.toUpperCase(), ix, d.y + pad + U * 0.45 * k, U * 0.7 * k + 4, iw, '#0d7266', null, 'left', 900);
  // the upgrade
  let y = d.y + pad + U * 1.9 * k + 6;
  const ir = Math.min(U * 1.7, avail * 0.17);
  iconFor(u, ix + ir, y + ir * 0.2, ir);
  fitTxt(u.name, ix + ir * 2 + U * 0.5, y, U * 1.1 * k + 5, iw - ir * 2 - U * 0.5, '#2b2140', null, 'left', 900);
  fitTxt(u.desc, ix + ir * 2 + U * 0.5, y + U * 1.0 * k + 6, U * 0.72 * k + 4, iw - ir * 2 - U * 0.5, '#5b4a6b', null, 'left', 700);
  y += ir * 1.5 + U * 0.9 * k;
  fitTxt('Now: ' + u.fx(lv), ix, y, U * 0.8 * k + 4, iw, '#2b2140', null, 'left', 800);
  if (!maxed) fitTxt('Next: ' + u.fx(lv + 1), ix, y + U * 1.05 * k + 4, U * 0.8 * k + 4, iw, '#1f8035', null, 'left', 900);
  y += U * 2.1 * k + 8;
  const pipW = Math.min(U * 1.1, iw / u.max - 4);
  for (let i = 0; i < u.max; i++) { ctx.fillStyle = i < lv ? '#17a596' : 'rgba(43,33,64,0.15)'; rrPath(ctx, ix + i * (pipW + 4), y, pipW, U * 0.45, U * 0.2); ctx.fill(); }
  if (maxed) button(buy, 'MAXED OUT', null, 'plain', false, { name: 'buy:' + u.id });
  else button(buy, 'BUY', fmt(cost), 'buy', can, { name: 'buy:' + u.id, gear: true, shine: can });
  hit(buy, 'buy:' + u.id, () => buyUpgrade(u));
  u._btn = buy;
}
function drawLock(x, y, r) {
  ctx.strokeStyle = OL; ctx.lineWidth = r * 0.35; ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.55, Math.PI, 0); ctx.stroke();
  rrPath(ctx, x - r * 0.85, y - r * 0.35, r * 1.7, r * 1.3, r * 0.25); ctx.fillStyle = '#ffd447'; ctx.fill(); ctx.lineWidth = r * 0.18; ctx.stroke();
}
function drawRowCard(m, ap) {                       // a new row of the shop opens: three new upgrades
  const U = LAYOUT.U, row = ROWS.find(r => r.id === m.id), b = cardBox(20, 18);
  const done = drawCard(b, '#17a596', 'NEW UPGRADES!', ap);
  const cx = b.x + b.w / 2, cy = b.y + U * 5.2;
  for (let i = 0; i < 3; i++) { const a = S.t * 0.6 + i * 2.1; ctx.fillStyle = 'rgba(23,165,150,0.18)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, U * 5.5, a, a + 0.5); ctx.fill(); }
  const ups = UPGRADES.filter(u => u.row === row.id);
  ups.forEach((u, i) => iconFor(u, cx + (i - 1) * U * 4.2, cy, U * 1.7));
  txt(row.name, cx, b.y + U * 9.2, U * 1.5, '#2b2140', null, 'center', 900);
  wrapTxt(ups.map(u => u.name).join(', ') + ' are in the shop now.', cx, b.y + U * 11.2, U * 0.85, b.w - U * 2.4, '#5b4a6b', null, 700);
  const bb = { x: b.x + U * 1.2, y: b.y + b.h - U * 3.9, w: b.w - U * 2.4, h: Math.max(52, U * 2.8) };
  button(bb, 'AWESOME!', null, 'go', true, { name: 'ok' }); hit(bb, 'ok', closeModal);
  done();
}

// ---------- tutorial ----------
function tutStep() {
  S.tutGate = null; S.tutUI = null;
  const sv = S.save; if (!sv || sv.tut >= TUT.DONE || S.t < (S.tutT || 0)) return;
  const L = LAYOUT, m = S.modal;
  if (sv.tut === TUT.LAUNCH && S.view === 'aim' && !m) {
    S.tutGate = { what: ['launch'] };
    S.tutUI = { coach: 'nana', title: 'Launch!', text: 'Pull back to aim at Nana, let go when she lifts her pad: CRIT! (A tap aims for you.)', target: { x: wx2s(2.4), y: wy2s(2.6), r: CAM.ppm * 4.8 }, tap: true };
  } else if (sv.tut === TUT.SLAM && S.view === 'run' && S.run && slamTarget(S.run) && !m) {
    const p = heroDrawPos();
    S.tutGate = { what: ['slam'] };
    S.tutUI = { coach: 'stinky', title: 'Belly Slam!', text: 'TAP to slam down onto that robot!', target: { x: wx2s(p.x), y: wy2s(p.y), r: CAM.ppm * 2 }, tap: true, arrowTo: slamTarget(S.run) };
  // the lock (tutGate) applies from the first frame of a card; the pointer appears once its button has been laid out
  } else if (sv.tut === TUT.SHOP && m && m.type === 'results') {
    S.tutGate = { what: ['coaches'] };
    if (m.btn) S.tutUI = { coach: 'nana', title: 'Get stronger', text: 'Spend your scrap on upgrades.', target: box2t(m.btn.coaches), tap: true, slot: m.slot };
  } else if (sv.tut === TUT.BUY && m && m.type === 'shop') {
    S.tutGate = { what: ['buy:sling', 'cell:sling'] };
    if (UP.sling._btn) S.tutUI = { coach: 'nana', title: 'Upgrade', text: 'Buy Slingshot Power: every launch goes faster.' + (S.tutGift ? ' (Here is a little scrap to help!)' : ''), target: box2t(UP.sling._btn), tap: true, low: false };
  } else if (sv.tut === TUT.AGAIN && m && (m.type === 'shop' || m.type === 'results')) {
    const tb = m.type === 'shop' ? m.close : m.btn && m.btn.launch;
    S.tutGate = { what: m.type === 'shop' ? ['close'] : ['launch'] };
    if (tb) S.tutUI = { coach: 'stinky', title: 'Go again!', text: 'Now launch again and smash further. Break the Scrap Wall!', target: box2t(tb), tap: true, slot: m.type === 'results' ? m.slot : null };
  }
}
function box2t(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) * 0.62, box: b }; }
function tutAllows(name) {
  const g = S.tutGate; if (!g) return true;
  if (name === 'music' || name === 'reset' || name === 'cancel' || name === 'restart') return true;
  return g.what.includes(name);
}
function drawTutorial() {
  const T = S.tutUI; if (!T) return;
  const U = LAYOUT.U, tg = T.target;
  // dim everything except the target
  ctx.save(); ctx.fillStyle = 'rgba(10,8,25,0.5)'; ctx.beginPath(); ctx.rect(0, 0, W, H);
  if (tg.box) { const p = U * 0.4; rrect(ctx, tg.box.x - p, tg.box.y - p, tg.box.w + p * 2, tg.box.h + p * 2, U, true); }   // appended: rrPath's beginPath dimmed the button instead
  else { ctx.moveTo(tg.x + tg.r, tg.y); ctx.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2, true); }
  ctx.fill('evenodd'); ctx.restore();
  if (T.arrowTo) {
    const b = T.arrowTo, x = wx2s(b.x), y = wy2s(b.y + b.r * 2.4);
    const bob = Math.sin(S.t * 8) * U * 0.3;
    ctx.fillStyle = '#ffd447'; ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x, y + bob); ctx.lineTo(x - U * 0.9, y - U * 1.2 + bob); ctx.lineTo(x - U * 0.35, y - U * 1.2 + bob); ctx.lineTo(x - U * 0.35, y - U * 2.6 + bob); ctx.lineTo(x + U * 0.35, y - U * 2.6 + bob); ctx.lineTo(x + U * 0.35, y - U * 1.2 + bob); ctx.lineTo(x + U * 0.9, y - U * 1.2 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (T.tap) drawGlove(tg.x + (tg.box ? tg.box.w * 0.15 : tg.r * 0.2), tg.y + (tg.box ? tg.box.h * 0.3 : tg.r * 0.25), U * 1.6);
  // coach card
  const ch = U * 5.2;
  // a button target: go under it when there is room (on the results card, above would hide what the launch earned);
  // on short landscape screens the results card offers an empty slot (its right column, above the buttons) instead
  const under = tg.box && H - (tg.box.y + tg.box.h + U * 1.8) - LAYOUT.pad >= ch;
  const slot = !under && T.slot && T.slot.h >= ch && T.slot.w >= U * 12 ? T.slot : null;
  const cw = slot ? slot.w : Math.min(W - LAYOUT.pad * 2, U * 22);
  const below = tg.y < H * 0.55, cy = slot ? slot.y + (slot.h - ch) / 2 : under ? tg.box.y + tg.box.h + U * 1.8 : below ? Math.min(H - ch - LAYOUT.pad, tg.y + tg.r + U * 1.5) : Math.max(LAYOUT.pad, tg.y - tg.r - ch - U * 1.5);
  const cx = slot ? slot.x : (W - cw) / 2;
  ctx.fillStyle = OL; rrPath(ctx, cx - 3, cy - 3, cw + 6, ch + 6, U * 1.1); ctx.fill();
  ctx.fillStyle = '#fff8e8'; rrPath(ctx, cx, cy, cw, ch, U); ctx.fill();
  ctx.fillStyle = '#ffe2b8'; ctx.beginPath(); ctx.arc(cx + U * 2.6, cy + ch / 2, U * 1.9, 0, Math.PI * 2); ctx.fill();
  drawCoach(ctx, T.coach, cx + U * 2.6, cy + ch / 2 + U * 0.1, U * 1.7, S.t);
  const tx = cx + U * 5.1, tw = cw - U * 5.7;
  txt(T.title, tx, cy + U * 1.15, U * 1.1, '#f0661f', null, 'left', 900);
  const lines = wrapLines(T.text, U * 0.85, tw, 800);
  lines.slice(0, 3).forEach((l, i) => txt(l, tx, cy + U * 2.4 + i * U * 1.05, U * 0.85, '#2b2140', null, 'left', 800));
  for (let i = 0; i < TUT.DONE; i++) { ctx.fillStyle = i < S.save.tut ? '#17a596' : i === S.save.tut ? '#f0661f' : 'rgba(43,33,64,0.2)'; ctx.beginPath(); ctx.arc(cx + cw - U * 0.8 - (TUT.DONE - 1 - i) * U * 0.75, cy + U * 0.9, U * 0.25, 0, Math.PI * 2); ctx.fill(); }
}
function drawGlove(x, y, s) {                       // a white cartoon glove, fingertip at (x, y), tapping
  const k = (S.t * 1.6) % 1, press = k < 0.25 ? k / 0.25 : k < 0.45 ? 1 - (k - 0.25) / 0.2 : 0;
  ctx.save(); ctx.translate(x + s * 0.25, y + s * 0.35 - press * s * 0.15); ctx.rotate(-0.45);
  if (press > 0.6) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-s * 0.05, -s * 0.85, s * 0.35 * press, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(2, s * 0.07);
  rrPath(ctx, -s * 0.16, -s * 0.85, s * 0.32, s * 0.75, s * 0.16); ctx.fill(); ctx.stroke();
  rrPath(ctx, -s * 0.42, -s * 0.25, s * 0.85, s * 0.7, s * 0.25); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8e2f2'; ctx.fillRect(-s * 0.3, s * 0.35, s * 0.6, s * 0.18);
  ctx.restore();
}
function drawCheer() {
  const ch = S.cheer; if (!ch) return;
  const k = (S.t - ch.t0) / (ch.big ? 2.2 : 1.1); if (k >= 1) { S.cheer = null; return; }
  const U = LAYOUT.U, s = (k < 0.2 ? 0.5 + k * 2.5 : 1) * (ch.big ? 1.6 : 1.3);
  ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
  fitTxt(ch.text, W / 2, H * 0.42, U * 2 * s, W - LAYOUT.pad * 2, '#ffd447', OL, 'center', 900);
  ctx.globalAlpha = 1;
}
function drawBanner() {
  const bn = FX.banner, U = LAYOUT.U, k = bn.t / 2.4;
  const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(20,14,38,0.75)'; ctx.fillRect(0, H * 0.68 - U * 1.6, W, U * 3.2);
  txt(bn.text, W / 2, H * 0.68, U * 1.9, '#ffd447', OL, 'center', 900);
  ctx.globalAlpha = 1;
}
function drawToast(s) {
  const U = LAYOUT.U, size = U * 0.9, w = Math.min(W - LAYOUT.pad * 2, fitSize(s, size, W, 800) && ctx.measureText(s).width + U * 2.4);
  const y = H - LAYOUT.pad - U * 6.2;
  plate((W - w) / 2, y, w, U * 2.2);
  fitTxt(s, W / 2, y + U * 1.1, size, w - U * 1.6, '#fff', null, 'center', 800);
}
