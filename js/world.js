'use strict';
// The four zones' backdrops: sky, a far and a middle parallax layer (painted once per screen size into tile
// canvases), the ground, roadside props and ambient bits. Everything is drawn in code.
const LOOKS = [
  { sky: ['#7cc6ff', '#bfe6ff', '#ffe9b8'], far: '#a59bb8', farD: '#8d83a3', mid: '#7b6a64', midD: '#5d4e4a', ground: '#7a5c45', groundT: '#9b7656', line: '#b48a63' },
  { sky: ['#ff9a6b', '#ffc27a', '#ffe2a8'], far: '#b07a7f', farD: '#8f5f69', mid: '#5f6677', midD: '#454b5a', ground: '#6e7480', groundT: '#8a909c', line: '#ffd23f' },
  { sky: ['#1b1440', '#4a2a78', '#c2477e'], far: '#2c2160', farD: '#231a4d', mid: '#1f1a3d', midD: '#16122c', ground: '#2c2a3c', groundT: '#3d3a52', line: '#f6f1ff' },
  { sky: ['#ff8a5c', '#ffb36b', '#ffd9a0'], far: '#3f7f8f', farD: '#2f6573', mid: '#c75b3a', midD: '#3a7ca5', ground: '#8d949e', groundT: '#a9b0ba', line: '#ffd23f' },   // Harbour Docks (v0.5)
  { sky: ['#2b2a6b', '#6a4a9e', '#e88aa8'], far: '#3b3570', farD: '#2c2756', mid: '#55507a', midD: '#3e3a5e', ground: '#3d3946', groundT: '#55505f', line: '#9aa5b5' },   // Rooftops (v0.5)
  { sky: ['#ffb5c9', '#ffd8a8', '#fff3c4'], far: '#9ad7d0', farD: '#7cc0b9', mid: '#f4f7fb', midD: '#c3ced9', ground: '#d8c08a', groundT: '#f0d9a0', line: '#ffffff' },
  { sky: ['#8fd3ff', '#c7ecff', '#f2ffd9'], far: '#7bc47f', farD: '#4f9a55', mid: '#5fb35f', midD: '#3f8a3a', ground: '#6b8f3e', groundT: '#8db35a', line: '#d6f5a0' },   // 6 Green Park (v0.6)
  { sky: ['#f7c873', '#fbe0a8', '#fff2d4'], far: '#c9a27a', farD: '#a37c55', mid: '#d9b46a', midD: '#8a6f5a', ground: '#a88a63', groundT: '#c4a57a', line: '#ffd23f' },   // 7 Construction Site
  { sky: ['#1e1c4f', '#5a3a8a', '#ff8a6b'], far: '#3d2f6b', farD: '#2a2150', mid: '#4b3a7a', midD: '#2f2556', ground: '#5a4a6e', groundT: '#73608a', line: '#ffd36e' },   // 8 Fun Fair
  { sky: ['#ff9b6b', '#ffc58a', '#ffe6b8'], far: '#c75b3a', farD: '#9a4128', mid: '#d97a4a', midD: '#7a4a3a', ground: '#b8653f', groundT: '#d1825a', line: '#ffffff' },   // 9 Rocket Base
];
// zones -> looks: each zone names its look (run.js ZONES[z].look); the drawing code below branches on these numbers
const LOOK_IDS = { yard: 0, works: 1, neon: 2, harbour: 3, roof: 4, vault: 5, park: 6, build: 7, fair: 8, rocket: 9 };
function lookId(z) { const l = ZONES[z] && LOOK_IDS[ZONES[z].look]; return l === undefined ? 0 : l; }
const TILE = { key: '', zones: new Map(), W: 0, H: 0, u: 0 };   // painted lazily per zone, at most 3 zones kept
function rnd32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Tiles are (tw x th) canvases that repeat sideways; one per zone and layer.
function paintLayer(z, layer, tw, th, u) {
  z = lookId(z);                                       // zone number -> look number (the branches below)
  const TS = Math.min(typeof DPR !== 'undefined' ? DPR : 1, 1.5);         // sharper on phones, capped for memory
  const cv = document.createElement('canvas'); cv.width = Math.ceil(tw * TS); cv.height = Math.ceil(th * TS); cv.cw = tw; cv.ch = th;
  const c = cv.getContext('2d'), L = LOOKS[z]; c.scale(TS, TS);
  const R = rnd32(z * 97 + (layer === 'far' ? 1 : 2));
  const base = th;                                    // layers sit on the bottom of the tile
  const lw = Math.max(1.5, u * 0.05);
  if (layer === 'far') {
    if (z === 0) {                                     // hazy junk mountains and a crane
      c.fillStyle = L.far; c.beginPath(); c.moveTo(0, base);
      for (let x = 0; x <= tw; x += tw / 12) c.lineTo(x, base - th * (0.35 + 0.3 * Math.abs(Math.sin(x / tw * Math.PI * 3 + 1))) - R() * th * 0.08);
      c.lineTo(tw, base); c.fill();
      c.fillStyle = L.farD;
      for (let i = 0; i < 2; i++) {
        const x = tw * (0.25 + i * 0.5), h = th * 0.85;
        c.fillRect(x, base - h, u * 0.5, h); c.fillRect(x - u * 3, base - h, u * 7, u * 0.45);
        c.fillRect(x + u * 3.4, base - h, u * 0.12, u * 2.5); c.fillRect(x + u * 2.6, base - h + u * 2.4, u * 1.7, u * 0.4);
      }
    } else if (z === 1) {                              // factory skyline with chimneys
      c.fillStyle = L.far;
      for (let x = 0; x < tw;) { const w = u * (3 + R() * 4), h = th * (0.3 + R() * 0.4); c.fillRect(x, base - h, w, h); if (R() < 0.6) c.fillRect(x + w * 0.3, base - h - th * 0.3, u * 0.7, th * 0.3); x += w + u * 0.4; }
      c.fillStyle = L.farD;
      for (let x = u * 2; x < tw; x += u * 9) { c.beginPath(); c.moveTo(x, base); for (let k = 0; k < 4; k++) c.lineTo(x + u * (k + 0.5) * 1.2, base - th * 0.25 - (k % 2) * u); c.lineTo(x + u * 5, base); c.fill(); }
    } else if (z === 2) {                              // night skyline with lit windows
      for (let x = 0; x < tw;) {
        const w = u * (2.5 + R() * 3.5), h = th * (0.35 + R() * 0.6);
        c.fillStyle = R() < 0.5 ? L.far : L.farD; c.fillRect(x, base - h, w, h);
        for (let wy = base - h + u * 0.6; wy < base - u * 0.4; wy += u * 0.8) for (let wx = x + u * 0.4; wx < x + w - u * 0.4; wx += u * 0.7)
          if (R() < 0.35) { c.fillStyle = R() < 0.7 ? '#ffd36e' : '#7ff3e8'; c.fillRect(wx, wy, u * 0.3, u * 0.38); }
        if (R() < 0.3) { c.fillStyle = '#ff5b8a'; c.fillRect(x + w / 2 - u * 0.05, base - h - u * 1.2, u * 0.1, u * 1.2); }
        x += w + u * 0.25;
      }
    } else if (z === 3) {                              // harbour: the sea, cranes and a cargo ship on the horizon
      c.fillStyle = L.farD; c.fillRect(0, base - th * 0.22, tw, th * 0.22);
      c.fillStyle = 'rgba(255,220,170,0.35)'; for (let x = 0; x < tw; x += u * 3) c.fillRect(x + R() * u, base - th * (0.05 + R() * 0.15), u * (1 + R() * 1.5), u * 0.12);
      c.fillStyle = L.far;
      for (let i = 0; i < 3; i++) {                    // cranes
        const x = tw * (0.12 + i * 0.33) + R() * u * 3, h = th * (0.7 + R() * 0.2);
        c.fillRect(x, base - h, u * 0.6, h - th * 0.2); c.fillRect(x - u * 4, base - h, u * 9, u * 0.6);
        c.fillRect(x + u * 3.5, base - h + u * 0.6, u * 0.1, u * 2.4); c.fillRect(x - u * 1.5, base - h - u * 1.5, u * 0.5, u * 1.5);
      }
      const sx = tw * 0.5 + R() * tw * 0.2, sw = u * 12;  // a cargo ship
      c.beginPath(); c.moveTo(sx, base - th * 0.22); c.lineTo(sx + sw, base - th * 0.22); c.lineTo(sx + sw - u, base - th * 0.32); c.lineTo(sx + u * 0.5, base - th * 0.32); c.fill();
      for (let k = 0; k < 6; k++) { c.fillStyle = ['#c75b3a', '#3a7ca5', '#d9b23c'][k % 3]; c.fillRect(sx + u * (1 + k * 1.6), base - th * 0.32 - u * 1.1, u * 1.5, u * 1.1); }
    } else if (z === 4) {                              // rooftops: skyline with water towers and antennas
      for (let x = 0; x < tw;) {
        const w = u * (3 + R() * 4), h = th * (0.3 + R() * 0.55);
        c.fillStyle = R() < 0.5 ? L.far : L.farD; c.fillRect(x, base - h, w, h);
        if (R() < 0.45) {                              // a water tower on legs
          const tx = x + w * 0.3, ty = base - h;
          c.fillRect(tx, ty - u * 1.2, u * 0.15, u * 1.2); c.fillRect(tx + u * 1.3, ty - u * 1.2, u * 0.15, u * 1.2);
          rrect(c, tx - u * 0.2, ty - u * 3, u * 1.9, u * 1.9, u * 0.3); c.fill();
          c.beginPath(); c.moveTo(tx - u * 0.3, ty - u * 3); c.lineTo(tx + u * 0.75, ty - u * 3.8); c.lineTo(tx + u * 1.8, ty - u * 3); c.fill();
        } else if (R() < 0.5) c.fillRect(x + w / 2, base - h - u * 2.2, u * 0.12, u * 2.2);
        for (let wy = base - h + u * 0.7; wy < base - u * 0.4; wy += u * 0.9) if (R() < 0.5) { c.fillStyle = '#ffd36e'; c.fillRect(x + u * 0.4 + R() * (w - u), wy, u * 0.3, u * 0.35); c.fillStyle = L.far; }
        x += w + u * 0.3;
      }
    } else if (z === 6) {                              // park: rolling green hills and round trees
      c.fillStyle = L.far; c.beginPath(); c.moveTo(0, base);
      for (let x = 0; x <= tw; x += tw / 10) c.lineTo(x, base - th * (0.3 + 0.18 * Math.sin(x / tw * Math.PI * 4 + 0.5)));
      c.lineTo(tw, base); c.fill();
      for (let x = u; x < tw; x += u * (2.5 + R() * 3)) { const h = th * (0.4 + R() * 0.2), r = u * (1.1 + R() * 0.8); c.fillStyle = L.farD; c.fillRect(x - u * 0.15, base - h, u * 0.3, h); ell(c, x, base - h, r, r); c.fill(); }
    } else if (z === 7) {                              // construction: tower cranes and half-built frames
      c.fillStyle = L.far;
      for (let x = 0; x < tw;) { const w = u * (4 + R() * 4), h = th * (0.3 + R() * 0.45); for (let fy = base - h; fy < base; fy += u * 1.4) c.fillRect(x, fy, w, u * 0.25); for (let fx = x; fx <= x + w; fx += u * 1.6) c.fillRect(fx, base - h, u * 0.25, h); x += w + u * (1 + R() * 2); }
      c.fillStyle = L.farD;
      for (let i = 0; i < 2; i++) { const x = tw * (0.3 + i * 0.45), h = th * 0.95; c.fillRect(x, base - h, u * 0.5, h); c.fillRect(x - u * 2, base - h, u * 10, u * 0.5); c.fillRect(x + u * 7, base - h + u * 0.5, u * 0.1, u * 3); rrect(c, x + u * 6.5, base - h + u * 3.4, u * 1.1, u * 0.8, u * 0.1); c.fill(); }
    } else if (z === 8) {                              // fun fair: a big wheel, a roller coaster
      const wx = tw * 0.3, wr = th * 0.42, wy = base - wr - th * 0.08;
      c.strokeStyle = L.far; c.lineWidth = u * 0.3; c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.stroke();
      for (let k = 0; k < 10; k++) { const a = k * TAU / 10; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); c.stroke(); c.fillStyle = ['#ff5b8a', '#ffd36e', '#7ff3e8'][k % 3]; ell(c, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr + u * 0.4, u * 0.55, u * 0.45); c.fill(); }
      c.fillStyle = L.far; c.beginPath(); c.moveTo(wx - wr * 0.5, base); c.lineTo(wx, wy); c.lineTo(wx + wr * 0.5, base); c.fill();
      const cy = (x) => base - th * (0.35 + 0.25 * Math.sin((x - tw * 0.55) / (tw * 0.45) * Math.PI * 2.5));
      c.strokeStyle = L.farD; c.lineWidth = u * 0.35; c.beginPath(); c.moveTo(tw * 0.55, cy(tw * 0.55));
      for (let x = tw * 0.55; x < tw; x += u) c.lineTo(x, cy(x));
      c.stroke(); c.fillStyle = L.farD;
      for (let x = tw * 0.57; x < tw; x += u * 2.4) c.fillRect(x, cy(x), u * 0.15, base - cy(x));
    } else if (z === 9) {                              // rocket base: red mesas, a launch gantry and a rocket
      c.fillStyle = L.far;
      for (let x = 0; x < tw;) { const w = u * (5 + R() * 6), h = th * (0.2 + R() * 0.35); c.beginPath(); c.moveTo(x, base); c.lineTo(x + u, base - h); c.lineTo(x + w - u, base - h); c.lineTo(x + w, base); c.fill(); x += w + u * R() * 3; }
      const gx = tw * 0.6, gh = th * 0.95;
      c.fillStyle = L.farD; c.fillRect(gx, base - gh, u * 0.6, gh); for (let fy = base - gh; fy < base; fy += u * 1.2) c.fillRect(gx, fy, u * 2.2, u * 0.2);
      rrect(c, gx + u * 2.4, base - gh * 0.9, u * 1.6, gh * 0.9, u * 0.8); fs(c, '#f4f7fb', u * 0.1);
      c.beginPath(); c.moveTo(gx + u * 2.4, base - gh * 0.9 + u * 0.8); c.lineTo(gx + u * 3.2, base - gh - u * 0.6); c.lineTo(gx + u * 4, base - gh * 0.9 + u * 0.8); fs(c, '#e53935', u * 0.1);
    } else {                                           // CleanCorp glass towers
      for (let x = 0; x < tw;) {
        const w = u * (3 + R() * 3), h = th * (0.4 + R() * 0.55);
        c.fillStyle = L.far; rrect(c, x, base - h, w, h + u, u * 1.2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + w * 0.15, base - h + u, w * 0.12, h - u);
        x += w + u * 0.6;
      }
    }
    return cv;
  }
  // mid layer
  if (z === 0) {                                       // junk piles: cars, fridges, tyres
    for (let x = -u * 2; x < tw;) {
      const w = u * (6 + R() * 5), h = th * (0.45 + R() * 0.45);
      c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + w * 0.5, base - h * 1.6, x + w, base); c.closePath(); fs(c, L.mid, lw);
      for (let k = 0; k < 5; k++) {
        const px = x + w * (0.2 + R() * 0.6), py = base - h * (0.15 + R() * 0.55), s = u * (0.7 + R() * 0.8);
        const kind = (R() * 4) | 0;
        if (kind === 0) { ell(c, px, py, s * 0.6, s * 0.6); fs(c, '#2e2c38', lw); ell(c, px, py, s * 0.25, s * 0.25); fs(c, L.midD); }
        else if (kind === 1) { rrect(c, px - s, py - s * 0.45, s * 2, s * 0.9, s * 0.3); fs(c, ['#c75b3a', '#3a7ca5', '#7fa650', '#d9b23c'][(R() * 4) | 0], lw); c.fillStyle = '#bfe6ff'; c.fillRect(px - s * 0.6, py - s * 0.35, s * 0.5, s * 0.3); }
        else if (kind === 2) { rrect(c, px - s * 0.45, py - s * 0.8, s * 0.9, s * 1.4, s * 0.15); fs(c, '#e8e4dc', lw); }
        else { c.save(); c.translate(px, py); c.rotate(R() - 0.5); rrect(c, -s * 0.6, -s * 0.5, s * 1.2, s, s * 0.1); fs(c, '#b58a52', lw); c.restore(); }
      }
      x += w * (0.8 + R() * 0.5);
    }
  } else if (z === 1) {                                // pipes, tanks, conveyor gantries
    c.fillStyle = L.midD; c.fillRect(0, base - th * 0.55, tw, u * 0.5);
    for (let x = u; x < tw; x += u * (7 + R() * 4)) {
      const h = th * (0.5 + R() * 0.4);
      rrect(c, x, base - h, u * 3.4, h + u, u * 1.4); fs(c, L.mid, lw);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x + u * 0.5, base - h + u, u * 0.5, h - u);
      tube(c, [x + u * 3.4, base - h * 0.6, x + u * 5.5, base - h * 0.6, x + u * 5.5, base], u * 0.6, '#8a909c', lw);
      c.fillStyle = '#ffd23f'; c.fillRect(x, base - h * 0.35, u * 3.4, u * 0.35);
    }
  } else if (z === 2) {                                // shops with neon signs and street lamps
    for (let x = 0; x < tw;) {
      const w = u * (5 + R() * 4), h = th * (0.45 + R() * 0.4);
      c.fillStyle = L.mid; c.fillRect(x, base - h, w, h); c.strokeStyle = OL; c.lineWidth = lw; c.strokeRect(x, base - h, w, h);
      c.fillStyle = '#2a2550'; c.fillRect(x + w * 0.15, base - h * 0.45, w * 0.7, h * 0.45);
      const neon = ['#ff5b8a', '#7ff3e8', '#ffd36e', '#b388ff'][(R() * 4) | 0];
      c.shadowColor = neon; c.shadowBlur = u * 0.8; c.strokeStyle = neon; c.lineWidth = u * 0.22;
      const sy = base - h * 0.72;
      if (R() < 0.5) { c.beginPath(); c.arc(x + w / 2, sy, u * 0.9, 0, TAU); c.stroke(); }
      else { rrect(c, x + w * 0.2, sy - u * 0.6, w * 0.6, u * 1.2, u * 0.5); c.stroke(); }
      c.shadowBlur = 0;
      x += w + u * 0.2;
    }
  } else if (z === 3) {                                // container stacks and bollards on the quay
    for (let x = 0; x < tw;) {
      const n = 1 + (R() * 3 | 0), w = u * (4.5 + R() * 2);
      for (let k = 0; k < n; k++) {
        const y = base - (k + 1) * u * 2.1;
        rrect(c, x, y, w, u * 2.1, u * 0.15); fs(c, ['#c75b3a', '#3a7ca5', '#2f9e8f', '#d9b23c'][(R() * 4) | 0], lw);
        c.fillStyle = 'rgba(0,0,0,0.18)'; for (let s = x + u * 0.5; s < x + w - u * 0.3; s += u * 0.6) c.fillRect(s, y + u * 0.25, u * 0.12, u * 1.6);
      }
      x += w + u * (0.5 + R() * 3);
    }
  } else if (z === 4) {                                // rooftop gear: AC boxes, chimneys, a billboard
    c.fillStyle = L.midD; c.fillRect(0, base - u * 0.8, tw, u * 0.8);
    for (let x = u; x < tw;) {
      const kind = (R() * 3) | 0;
      if (kind === 0) { rrect(c, x, base - u * 2.4, u * 3.2, u * 2.4, u * 0.25); fs(c, L.mid, lw); ell(c, x + u * 1.6, base - u * 1.2, u * 0.8, u * 0.8); fs(c, L.midD, lw); x += u * 5; }
      else if (kind === 1) { c.fillStyle = '#7a5c6a'; c.fillRect(x, base - u * 4, u * 1.4, u * 4); c.strokeStyle = OL; c.lineWidth = lw; c.strokeRect(x, base - u * 4, u * 1.4, u * 4); x += u * 3.5; }
      else { tube(c, [x + u * 1, base, x + u * 1, base - u * 4], u * 0.3, L.midD, lw); rrect(c, x - u * 1.5, base - u * 7, u * 6, u * 3.2, u * 0.3); fs(c, ['#ff5b8a', '#7ff3e8', '#ffd36e'][(R() * 3) | 0], lw); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x - u * 1, base - u * 6.4, u * 5, u * 0.5); x += u * 8; }
    }
  } else if (z === 6) {                                // park: bushes with flowers and fountains
    for (let x = 0; x < tw;) {
      const w = u * (3 + R() * 3);
      if (R() < 0.25) {
        rrect(c, x, base - u * 1.2, u * 4, u * 1.2, u * 0.5); fs(c, '#9aa5b5', lw);
        c.strokeStyle = 'rgba(140,210,255,0.85)'; c.lineWidth = u * 0.12;
        for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + u * 2, base - u * 1.4, u * (0.5 + k * 0.3), Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        x += u * 6; continue;
      }
      ell(c, x + w / 2, base - u * 0.9, w / 2, u * 1.4); fs(c, R() < 0.5 ? L.mid : L.midD, lw);
      if (R() < 0.4) { c.fillStyle = '#ff8fb1'; for (let k = 0; k < 4; k++) { ell(c, x + R() * w, base - u * (0.4 + R() * 1.6), u * 0.18, u * 0.18); c.fill(); } }
      x += w + u * (0.5 + R() * 2);
    }
  } else if (z === 7) {                                // construction: sand piles, stacked pipes, barriers
    for (let x = 0; x < tw;) {
      const kind = (R() * 3) | 0;
      if (kind === 0) { c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + u * 3, base - u * 4, x + u * 6, base); fs(c, '#d9b46a', lw); x += u * 7; }
      else if (kind === 1) {
        for (let k = 0; k < 3; k++) for (let j = 0; j <= k; j++) {
          const px = x + u * (2 - k) * 0.6 + j * u * 1.2 + u, py = base - u * 0.6 - (2 - k) * u * 1.05;
          ell(c, px, py, u * 0.6, u * 0.6); fs(c, '#8a909c', lw); ell(c, px, py, u * 0.3, u * 0.3); c.fillStyle = '#3d3a52'; c.fill();
        }
        x += u * 5;
      } else {
        for (let k = 0; k < 3; k++) { c.fillStyle = k % 2 ? '#ffffff' : '#f08a24'; c.fillRect(x + k * u * 1.2, base - u * 1.4, u * 1.2, u * 0.6); }
        c.fillStyle = L.midD; c.fillRect(x + u * 0.3, base - u * 0.8, u * 0.2, u * 0.8); c.fillRect(x + u * 3.1, base - u * 0.8, u * 0.2, u * 0.8); x += u * 5;
      }
    }
  } else if (z === 8) {                                // fun fair: striped tents with light bulbs
    for (let x = 0; x < tw;) {
      const w = u * (4 + R() * 3), h = u * (3 + R() * 2), col = ['#e53935', '#3a7ca5', '#9b59b6'][(R() * 3) | 0];
      for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ffffff' : col; c.beginPath(); c.moveTo(x + w * k / 4, base); c.lineTo(x + w / 2, base - h); c.lineTo(x + w * (k + 1) / 4, base); c.fill(); }
      c.strokeStyle = OL; c.lineWidth = lw; c.beginPath(); c.moveTo(x, base); c.lineTo(x + w / 2, base - h); c.lineTo(x + w, base); c.stroke();
      c.fillStyle = '#ffd36e'; for (let k = 1; k < 5; k++) { ell(c, x + w / 2 - w * k / 10, base - h + h * k / 5, u * 0.15, u * 0.15); c.fill(); ell(c, x + w / 2 + w * k / 10, base - h + h * k / 5, u * 0.15, u * 0.15); c.fill(); }
      x += w + u * (0.5 + R() * 2.5);
    }
  } else if (z === 9) {                                // rocket base: fuel tanks, radar dishes, blast pads
    for (let x = u; x < tw;) {
      const kind = (R() * 3) | 0;
      if (kind === 0) { rrect(c, x, base - u * 3, u * 2.4, u * 3, u * 1.1); fs(c, '#f4f7fb', lw); c.fillStyle = '#e53935'; c.fillRect(x, base - u * 1.8, u * 2.4, u * 0.4); x += u * 4; }
      else if (kind === 1) { tube(c, [x + u, base, x + u, base - u * 2.2], u * 0.25, L.midD, lw * 0.6); ell(c, x + u * 1.3, base - u * 3, u * 1.5, u * 0.9, -0.5); fs(c, '#e8edf3', lw); x += u * 4.5; }
      else { c.fillStyle = L.midD; c.fillRect(x, base - u * 0.5, u * 5, u * 0.5); c.fillStyle = '#ffd23f'; for (let k = 0; k < 5; k++) c.fillRect(x + k * u, base - u * 0.5, u * 0.5, u * 0.5); x += u * 6.5; }
    }
  } else {                                             // snack crates and gold scrap piles
    for (let x = 0; x < tw;) {
      const w = u * (5 + R() * 5), h = th * (0.35 + R() * 0.4);
      c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + w / 2, base - h * 1.5, x + w, base); fs(c, '#ffd447', lw);
      for (let k = 0; k < 6; k++) { const px = x + w * (0.15 + R() * 0.7), py = base - h * R() * 0.6; iconGear(c, px, py, u * (0.35 + R() * 0.3), R() < 0.5 ? '#ffe680' : '#f2b632'); }
      rrect(c, x + w * 0.6, base - u * 2.2, u * 2.2, u * 2.2, u * 0.2); fs(c, '#c98b4a', lw);
      c.fillStyle = '#ffffff'; c.fillRect(x + w * 0.6 + u * 0.3, base - u * 1.4, u * 1.6, u * 0.5);
      x += w * (0.9 + R() * 0.4);
    }
  }
  return cv;
}

function prepareTiles(W, H, u) {
  const key = W + 'x' + H + 'x' + (typeof DPR !== 'undefined' ? DPR : 1);
  if (TILE.key === key) return;
  TILE.key = key; TILE.zones.clear(); TILE.W = W; TILE.H = H; TILE.u = u;
}
function zoneTiles(z) {
  let t = TILE.zones.get(z);
  if (!t) {
    const W = TILE.W, H = TILE.H, u = TILE.u, tw = Math.max(1024, Math.ceil(W * 1.25));
    t = { far: paintLayer(z, 'far', tw, Math.ceil(Math.min(H * 0.38, u * 13)), u), mid: paintLayer(z, 'mid', tw, Math.ceil(Math.min(H * 0.3, u * 9)), u) };
    TILE.zones.set(z, t);
    if (TILE.zones.size > 3) for (const k of TILE.zones.keys()) { if (k !== z) { TILE.zones.delete(k); break; } }   // keep memory low on phones
  } else { TILE.zones.delete(z); TILE.zones.set(z, t); }      // most recently used last
  return t;
}

// cam: {x, y, ppm}; gy = screen y of the ground line when cam.y is 0; zw = [zone, weight] pairs to blend
function drawBackdrop(c, W, H, cam, gy, zw, t, base) {
  for (const [z, a] of zw) {
    if (a <= 0) continue;
    const L = LOOKS[lookId(z)];
    c.globalAlpha = a;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.sky[0]); g.addColorStop(0.55, L.sky[1]); g.addColorStop(1, L.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    skyBits(c, lookId(z), W, H, t, base);
    const lift = cam.y * base;                        // flying high slides the hills down
    const zt = zoneTiles(z);
    for (const [tile, f, k] of [[zt.far, 0.12, 0.25], [zt.mid, 0.4, 0.55]]) {
      const tw = tile.cw, th = tile.ch, off = ((cam.x * base * f) % tw + tw) % tw;
      const y = gy - th + lift * k + base * 0.2;
      if (y > H) continue;
      for (let x = -off; x < W; x += tw) c.drawImage(tile, Math.floor(x), Math.floor(y), tw, th);
    }
  }
  c.globalAlpha = 1;
}
function skyBits(c, z, W, H, t, u) {
  z = ({ 6: 0, 7: 1, 8: 2, 9: 3 })[z] !== undefined ? ({ 6: 0, 7: 1, 8: 2, 9: 3 })[z] : z;   // new looks reuse a sky: park clouds, site haze, fair night, rocket sun
  if (z === 0 || z === 5) {                            // drifting clouds
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.31 + t * 0.006 * (1 + i * 0.3)) % 1.2 - 0.1) * W, y = H * (0.08 + i * 0.07), s = u * (1.2 + (i % 2) * 0.6);
      for (const [dx, dy, r] of [[0, 0, 1], [1.1, 0.2, 0.75], [-1.0, 0.25, 0.7], [0.4, -0.45, 0.7]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill(); }
    }
    if (z === 0) { c.fillStyle = 'rgba(255,240,170,0.9)'; c.beginPath(); c.arc(W * 0.82, H * 0.12, u * 1.6, 0, TAU); c.fill(); }
  } else if (z === 1) {                                // smoke puffs
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.05 + i / 6) % 1, x = W * ((i * 0.37) % 1), y = H * (0.55 - k * 0.5);
      c.fillStyle = `rgba(90,70,80,${0.25 * (1 - k)})`; c.beginPath(); c.arc(x, y, u * (0.8 + k * 2), 0, TAU); c.fill();
    }
    c.fillStyle = 'rgba(255,230,160,0.9)'; c.beginPath(); c.arc(W * 0.25, H * 0.42, u * 2.4, 0, TAU); c.fill();
  } else if (z === 3) {                                // a big low sunset sun and gulls
    c.fillStyle = 'rgba(255,236,170,0.95)'; c.beginPath(); c.arc(W * 0.7, H * 0.42, u * 3.2, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(60,40,60,0.7)'; c.lineWidth = Math.max(1.5, u * 0.08);
    for (let i = 0; i < 4; i++) { const x = ((i * 0.27 + t * 0.01 * (1 + i * 0.2)) % 1.1) * W, y = H * (0.15 + (i % 3) * 0.06) + Math.sin(t * 3 + i) * u * 0.2, s = u * 0.5; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s * 0.5, y - s * 0.6, x, y); c.quadraticCurveTo(x + s * 0.5, y - s * 0.6, x + s, y); c.stroke(); }
  } else if (z === 2 || z === 4) {                     // stars and a moon
    for (let i = 0; i < 40; i++) {
      const x = (i * 0.618 % 1) * W, y = ((i * 0.377) % 0.55) * H, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      c.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.6})`; c.fillRect(x, y, Math.max(1, u * 0.08), Math.max(1, u * 0.08));
    }
    c.shadowColor = '#fff4d6'; c.shadowBlur = u; c.fillStyle = '#fff4d6'; c.beginPath(); c.arc(W * 0.78, H * 0.13, u * 1.5, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(200,190,170,0.5)'; for (const [dx, dy, r] of [[-0.5, -0.3, 0.3], [0.4, 0.2, 0.4], [-0.2, 0.6, 0.2]]) { c.beginPath(); c.arc(W * 0.78 + dx * u, H * 0.13 + dy * u, r * u, 0, TAU); c.fill(); }
  }
}

// ground: fill below the line, a lighter top band and markings that scroll with the world
function drawGround(c, W, H, cam, gy, zw, t) {
  const gl = gy + cam.y * cam.ppm;
  if (gl > H + 2) return gl;
  for (let [z, a] of zw) {
    if (a <= 0) continue;
    const lid = lookId(z), L = LOOKS[lid]; c.globalAlpha = a;
    z = ({ 6: 0, 7: 1, 8: 2, 9: 3 })[lid] !== undefined ? ({ 6: 0, 7: 1, 8: 2, 9: 3 })[lid] : lid;   // ground markings: new looks reuse one
    c.fillStyle = L.ground; c.fillRect(0, gl, W, H - gl + 2);
    c.fillStyle = L.groundT; c.fillRect(0, gl, W, Math.max(3, cam.ppm * 0.35));
    c.fillStyle = OL; c.fillRect(0, gl - 1, W, Math.max(2, cam.ppm * 0.06));
    const step = z === 1 ? 3 : z === 2 ? 4 : z === 3 ? 6 : z === 4 ? 1.5 : 2.5, m0 = Math.floor(cam.x / step) * step;
    c.fillStyle = L.line;
    for (let m = m0; (m - cam.x) * cam.ppm < W; m += step) {
      const x = (m - cam.x) * cam.ppm;
      if (z === 0) { c.globalAlpha = a * 0.35; c.fillRect(x, gl + cam.ppm * 0.7, cam.ppm * 1.2, cam.ppm * 0.12); c.fillRect(x + cam.ppm * 0.6, gl + cam.ppm * 1.3, cam.ppm * 0.9, cam.ppm * 0.12); }
      else if (z === 1) { c.globalAlpha = a; c.save(); c.translate(x, gl + cam.ppm * 0.5); c.transform(1, 0, -0.6, 1, 0, 0); c.fillStyle = (m / step) % 2 ? '#ffd23f' : '#2d2b3a'; c.fillRect(0, 0, step * cam.ppm * 0.5, cam.ppm * 0.4); c.restore(); }
      else if (z === 2) { c.globalAlpha = a * 0.8; c.fillRect(x, gl + cam.ppm * 1.0, cam.ppm * 2, cam.ppm * 0.16); }
      else if (z === 3) { c.globalAlpha = a; c.fillRect(x, gl + cam.ppm * 0.25, step * cam.ppm, cam.ppm * 0.18); c.globalAlpha = a * 0.6; c.fillStyle = '#5d636e'; ell(c, x + cam.ppm, gl + cam.ppm * 1.1, cam.ppm * 0.25, cam.ppm * 0.12); c.fill(); c.fillStyle = L.line; }
      else if (z === 4) { c.globalAlpha = a * 0.35; c.fillRect(x, gl + cam.ppm * 0.6, cam.ppm * 0.08, cam.ppm * 1.4); }
      else { c.globalAlpha = a * 0.5; c.fillRect(x, gl + cam.ppm * 0.8, cam.ppm * 0.4, cam.ppm * 0.4); }
    }
  }
  c.globalAlpha = 1;
  return gl;
}

// roadside props, one every few metres, chosen from the position so they never change
const PROPS = [['tyre', 'barrel', 'crate', 'tv'], ['pipe', 'barrel', 'crate', 'gear'], ['lamp', 'hydrant', 'bag', 'bench'], ['bollard', 'buoy', 'crate', 'rope'], ['vent', 'dish', 'antenna', 'vent'], ['crate', 'gold', 'gold', 'flag'],
  ['bench', 'lamp', 'bench', 'hydrant'], ['barrel', 'crate', 'pipe', 'tyre'], ['flag', 'lamp', 'crate', 'bench'], ['dish', 'antenna', 'barrel', 'crate']];
function drawProps(c, W, cam, gl, zone, t) {
  const m = cam.ppm, step = 7, i0 = Math.floor(cam.x / step) - 1;
  for (let i = i0; (i * step - cam.x) * m < W + m * 4; i++) {
    const h = ((i * 2654435761) >>> 0) / 4294967296;
    if (h < 0.35) continue;
    const wx = i * step + h * 3, z = lookId(zoneAt(wx));
    const x = (wx - cam.x) * m, kind = PROPS[z][(h * 97 | 0) % 4], lw = Math.max(1.5, m * 0.07);
    c.save(); c.translate(x, gl); c.globalAlpha = 0.95;
    if (kind === 'tyre') { ell(c, 0, -m * 0.45, m * 0.55, m * 0.45); fs(c, '#2e2c38', lw); ell(c, 0, -m * 0.45, m * 0.22, m * 0.18); fs(c, '#4a4758'); }
    else if (kind === 'barrel') { rrect(c, -m * 0.4, -m * 1.1, m * 0.8, m * 1.1, m * 0.12); fs(c, z === 1 ? '#3a7ca5' : '#c75b3a', lw); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-m * 0.4, -m * 0.75, m * 0.8, m * 0.1); c.fillRect(-m * 0.4, -m * 0.4, m * 0.8, m * 0.1); }
    else if (kind === 'crate') { rrect(c, -m * 0.55, -m * 1.0, m * 1.1, m * 1.0, m * 0.08); fs(c, z === 3 ? '#c98b4a' : '#b58a52', lw); tube(c, [-m * 0.45, -m * 0.9, m * 0.45, -m * 0.1], lw * 0.6, '#8a6534'); }
    else if (kind === 'tv') { rrect(c, -m * 0.6, -m * 0.95, m * 1.2, m * 0.9, m * 0.15); fs(c, '#6d6a7a', lw); rrect(c, -m * 0.45, -m * 0.82, m * 0.75, m * 0.62, m * 0.12); fs(c, '#a9d4c9'); }
    else if (kind === 'pipe') { tube(c, [-m * 1.2, -m * 0.35, m * 1.2, -m * 0.35], m * 0.6, '#8a909c', lw); }
    else if (kind === 'gear') { iconGear(c, 0, -m * 0.6, m * 0.6, '#9aa5b5'); }
    else if (kind === 'lamp') { tube(c, [0, 0, 0, -m * 4.2, m * 0.8, -m * 4.4], m * 0.18, '#3d3a52', lw * 0.6); c.shadowColor = '#ffd36e'; c.shadowBlur = m; ell(c, m * 0.85, -m * 4.25, m * 0.3, m * 0.15); c.fillStyle = '#ffe9a8'; c.fill(); c.shadowBlur = 0; }
    else if (kind === 'hydrant') { rrect(c, -m * 0.25, -m * 0.9, m * 0.5, m * 0.9, m * 0.2); fs(c, '#e8423f', lw); }
    else if (kind === 'bag') { ell(c, 0, -m * 0.45, m * 0.5, m * 0.45); fs(c, '#232030', lw); }
    else if (kind === 'bench') { c.fillStyle = '#7a5c45'; c.fillRect(-m * 0.9, -m * 0.6, m * 1.8, m * 0.15); c.fillRect(-m * 0.8, -m * 0.6, m * 0.12, m * 0.6); c.fillRect(m * 0.68, -m * 0.6, m * 0.12, m * 0.6); }
    else if (kind === 'gold') { iconGear(c, 0, -m * 0.4, m * 0.4, '#ffd447'); iconGear(c, m * 0.5, -m * 0.3, m * 0.3, '#f2b632'); }
    else if (kind === 'bollard') { rrect(c, -m * 0.3, -m * 0.8, m * 0.6, m * 0.8, m * 0.2); fs(c, '#3d3a52', lw); ell(c, 0, -m * 0.8, m * 0.42, m * 0.16); fs(c, '#55505f', lw); }
    else if (kind === 'buoy') { ell(c, 0, -m * 0.55, m * 0.55, m * 0.55); fs(c, '#ff5b3c', lw); ell(c, 0, -m * 0.55, m * 0.25, m * 0.25); c.fillStyle = "#fff"; c.fill(); c.fillStyle = '#fff'; c.fillRect(-m * 0.55, -m * 0.65, m * 1.1, m * 0.2); }
    else if (kind === 'rope') { ell(c, 0, -m * 0.25, m * 0.6, m * 0.25); fs(c, '#c9a46a', lw); ell(c, 0, -m * 0.3, m * 0.3, m * 0.1); fs(c, '#a8854f'); }
    else if (kind === 'vent') { rrect(c, -m * 0.5, -m * 1.1, m * 1.0, m * 1.1, m * 0.15); fs(c, '#8a909c', lw); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 3; k++) c.fillRect(-m * 0.35, -m * (0.9 - k * 0.3), m * 0.7, m * 0.1); }
    else if (kind === 'dish') { tube(c, [0, 0, 0, -m * 0.9], m * 0.12, '#55505f', lw * 0.5); ell(c, m * 0.1, -m * 1.2, m * 0.55, m * 0.35, -0.6); fs(c, '#e8edf3', lw); }
    else if (kind === 'antenna') { tube(c, [0, 0, 0, -m * 2.6], m * 0.08, '#55505f', lw * 0.5); for (let k = 0; k < 3; k++) tube(c, [-m * (0.6 - k * 0.15), -m * (1.4 + k * 0.4), m * (0.6 - k * 0.15), -m * (1.4 + k * 0.4)], m * 0.06, '#55505f'); c.fillStyle = '#ff3b3b'; ell(c, 0, -m * 2.7, m * 0.12, m * 0.12); c.fill(); }
    else if (kind === 'flag') { tube(c, [0, 0, 0, -m * 2.6], m * 0.1, '#5d4e4a', lw * 0.5); c.beginPath(); c.moveTo(0, -m * 2.6); c.lineTo(m * 1.1, -m * 2.3); c.lineTo(0, -m * 2.0); fs(c, '#ea4a3f', lw * 0.6); }
    c.restore();
  }
  c.globalAlpha = 1;
}
