'use strict';
// One launch, as pure state: physics, robot spawns, smashes, rides, walls. No drawing, no sound, no saves.
// The game layer reads R.events after each step (sounds, sparks, numbers); the pacing simulator runs this same file.
// Units: metres and seconds. x = forward from the slingshot, y = up from the ground.

// - the speed limit is soft: you can go over it (bombs, rides, the meteor) and the extra drains off over a second
// - robot bounces cost very little and robots stand close together, so you bounce almost all the time;
//   the street is what costs speed (a share plus a fixed bit, so slow runs end and fast ones fly on)
// - every special robot except the Goldbot gives speed; the cloud layer turns you into a meteor
// v0.5 (owner 2026-11-08): every smashed robot fills the slam gauge (slams and big drops too), a slam breaks a
// Security Bot's claw and gives the speed back, rides smash through robots and trigger specials, three new
// interactive specials (Pogobot, Cannonbot, Rollbot), six zones and five walls.
const PHYS = {
  G: 24,                 // gravity
  HR: 0.72,              // hero radius
  ANGLE_HIT: 0.61, ANGLE_CRIT: 0.79,   // launch angle off the coach's pad: a plain hit 35 degrees, a CRIT 45 (higher)
  LAUNCH_VY_MAX: 27,     // a launch never throws you higher than this (straight up, m/s), however strong
  AIR_DRAG: 0.004,       // per second, on forward speed (tiny: the street and the cops are what slow you)
  SOFT_K: 1.6,           // over the speed limit: this share of the extra drains off per second
  BOT_KEEP: 0.97, BOT_LOSS: 0.4,       // a robot bounce keeps 97% of your forward speed minus 0.4 m/s
  GROUND_LOSS: 3,        // the street: you keep stats.keep of your speed (Slick Fur) and lose this much more
  FRICTION: 7.5,         // sliding on the ground, m/s per second
  STOP_V: 0.5,           // slide slower than this and the run ends
  SETTLE_VY: 2.6,        // bounces weaker than this become a slide
  UP_MIN: 10, UP_MAX: 15, // a robot bounce, before the robot type multiplier
  SLAM_BOUNCE: 17,       // a slammed robot throws you this high (fixed, so slams can.t snowball)
  SLAM_V: 34,            // straight-down speed of a belly slam (forward speed is kept)
  SLAM_V_MIN: 16, SLAM_V_MAX: 70,   // the aim help may make the dive this shallow or this steep
  BOMB_PUSH: 6,          // a Boombot's push forward (m/s); its upgrade adds 12% a level
  FLARE_PUSH: 3, SPRING_PUSH: 2, DRONE_PUSH: 2,   // forward speed from a Firework Bot, a Boingbot and a Copter
  SLAM_R: 4.2,           // a slam's shockwave smashes every robot this close (metres), Slam Quake adds more
  AUTO_SLAM_VY: 22,      // landing faster than this (a fall from ~10 m) counts as a slam, free
  GROUND_SLAM_UP: 14,    // a slam that lands on the street bounces you up this fast, with no speed lost
  CLAW_S: 2.5,           // a Security Bot's claw holds on this long: slam before it lets go to get your speed back
  JET_V: 27, JET_UP: 10, JET_DOWN: -5, JET_MAX_Y: 24,
  DRONE_S: 0.9, DRONE_UP: 7,
  // Pogobot (v0.6, like the original): 3 chances; tap just before the spring hits the street (POGO_WIN s before impact)
  // to PUNCH (higher, faster); too early wastes that hop; 3 punches out of 3 = POGO BOOM
  POGO_H: 1.1, POGO_HOP: 9, POGO_PUNCH: [16, 20, 24], POGO_PUSH: 3, POGO_BOOM: 12, POGO_WIN: 0.3,
  // Cannonbot (v0.6): the barrel swings; fire when it points at the next cannon (CANNON_TOL rad) or you misfire out of
  // the chain; the third (gold) cannon blasts you out, hardest when aimed at CANNON_BEST rad (about 30 degrees up)
  CANNON_GAP: 16, CANNON_HOLD: 2.6, CANNON_FLY: 0.3, CANNON_BOOM: 14, CANNON_TOL: 0.22, CANNON_SWING: 0.85, CANNON_SPEED: 2.0, CANNON_BEST: 0.5,
  ROLL_V: 24, ROLL_S: 2.2, ROLL_BURST: 7,                                                          // Rollbot junk ball
  CLOUD_Y: 30,           // the cloud layer: touch it and you come down as a METEOR
  METEOR_V: 8, METEOR_DIVE: 42, METEOR_SLAMS: 1, METEOR_R: 1.7,   // +speed, dive speed, slams back, wider shockwave
  RUN_MAX_S: 360,        // (top speed comes from the Top Speed upgrade: stats.vMax)
  WALL_STALL: 1.6,       // slower than this inside a wall and you are stuck (the run ends, the wall resets)
  WALL_EXIT: 1,          // share of your speed you keep coming out of a wall (after the ploughing cost)
  FRESH_EXIT: 6,         // smashing a wall for the FIRST time leaves you this slow (m/s), so that launch ends there
                         // (v0.6.5: 0 walls first broken in the same launch in 16 sim playthroughs, was 10 in 8; length unchanged; 0 = off)
  DEPTH_GAP: 1.6, DEPTH_COP: 14,   // towards a zone's wall: crowds up to 1 + DEPTH_GAP times sparser, + DEPTH_COP cop weight
  ZONE_DRAG: 0.01,       // a plain robot bounce keeps BOT_KEEP - ZONE_DRAG x zone number (0 in the Scrapyard, grows past 30 km)
  METEOR_FADE: 0.5,      // the n-th meteor of a launch pushes METEOR_V x METEOR_FADE^(n-1)
  METEOR_SLAM_N: 99,     // only the first METEOR_SLAM_N meteors of a launch give a slam back
  END_SPAN: 3000,        // past the last wall, every END_SPAN metres counts as one more zone for ZONE_DRAG
  WALL_CAP: 1.2,         // > 0: you hit a wall with at most WALL_CAP x your speed limit (so walls test the build, not one lucky burst)
  END_FADE: 12000, END_MIN: 0.15,   // past the last wall the speed limit falls to END_MIN over END_FADE metres (0 = off)
};
// the speed limit now: Top Speed's limit, shrinking past the last wall (END_FADE metres to fall to END_MIN of it), so a
// launch in the endless Snack Vault ends a minute or so after the gate instead of cruising to the time cap
function speedLimit(R) {
  const last = WALLS[WALLS.length - 1], P = PHYS;
  return R.x > last.x && P.END_FADE > 0 ? R.st.vMax * Math.max(P.END_MIN, 1 - (R.x - last.x) / P.END_FADE) : R.st.vMax;
}
// zone number for the heavier-robots rule: 0..9 by zone, then growing by one every END_SPAN metres past the last wall
function deepZone(x) { const last = WALLS[WALLS.length - 1]; return x > last.x ? ZONES.length - 1 + (x - last.x) / PHYS.END_SPAN : zoneAt(x); }

// Robot types: r = body radius, up = bounce, scrap = x the zone value. special = a power when smashed;
// ride = you ride it (jet, drone, pogo, cannon, roll); shield = a Security Bot (its claw slows you unless you slam it).
const BOTS = {
  sweep:  { r: 0.55, up: 1.0,  scrap: 1,  name: 'Sweepbot' },
  mop:    { r: 0.85, up: 1.45, scrap: 2,  name: 'Mop Brute' },
  cop:    { r: 0.75, up: 1.1,  scrap: 3,  name: 'Security Bot', shield: true },
  jet:    { r: 0.6,  up: 1.0,  scrap: 2,  name: 'Jetbot', ride: 'jet', special: true },
  drone:  { r: 0.6,  up: 1.0,  scrap: 2,  name: 'Copter', ride: 'drone', air: true, special: true },
  spring: { r: 0.6,  up: 2.3,  scrap: 2,  name: 'Boingbot', special: true },
  bomb:   { r: 0.62, up: 1.9,  scrap: 3,  name: 'Boombot', boom: true, special: true },
  flare:  { r: 0.55, up: 0,    scrap: 3,  name: 'Firework Bot', flare: true, special: true },
  fan:    { r: 0.5,  up: 1.1,  scrap: 2,  name: 'Fanbot', fan: true, special: true },
  gold:   { r: 0.6,  up: 1.2,  scrap: 25, name: 'Goldbot', special: true },
  pogo:   { r: 0.6,  up: 1.0,  scrap: 3,  name: 'Pogobot', ride: 'pogo', special: true },
  cannon: { r: 0.7,  up: 1.0,  scrap: 3,  name: 'Cannonbot', ride: 'cannon', special: true, float: true },
  roll:   { r: 0.65, up: 1.0,  scrap: 3,  name: 'Rollbot', ride: 'roll', special: true },
  cone:   { r: 0.45, up: 0,    scrap: 0,  name: 'Wet Floor', hazard: true },
};
const RIDES = ['jet', 'drone', 'spring', 'pogo', 'cannon', 'roll'];   // specials that only show up once bought

// Zones: where they start, what they pay per robot, their look (world.js) and which robots live there.
// v0.6 (owner 2026-11-08): ten distinct zones, each closed by a wall: 250, 600, 1,000, 2,000, 3,500, 6,000, 9,000,
// 14,000, 21,000 and 30,000 m. Crowds are dense (a robot every ~4 m, in gangs) so you bounce almost all the time.
const MIX = (cop, bomb, flare, fan, gold) => ({ sweep: 60 - cop, mop: 16, cop, bomb, flare, fan, gold });
const ZONES = [
  { name: 'Scrapyard',         look: 'yard',    from: 0,     value: 1,   gap: [2.4, 7], mix: MIX(5,  3,   1.5, 1.5, 0.8) },
  { name: 'Robot Works',       look: 'works',   from: 250,   value: 2,   gap: [2.4, 7], mix: MIX(7,  3,   2,   1.5, 1.0) },
  { name: 'Neon Avenue',       look: "neon",    from: 600,   value: 4,   gap: [2.4, 7], mix: MIX(9,  3.5, 2,   2,   1.2) },
  { name: 'Green Park',        look: "park",    from: 1000,  value: 7,   gap: [2.4, 7], mix: MIX(9,  3,   2.5, 2.5, 1.2) },
  { name: 'Harbour Docks',     look: "harbour", from: 2000,  value: 12,  gap: [2.4, 7], mix: MIX(11, 4,   2.5, 2,   1.4) },
  { name: 'Construction Site', look: "build",   from: 3500,  value: 20,  gap: [2.4, 7], mix: MIX(12, 4.5, 2.5, 2,   1.4) },
  { name: 'Rooftops',          look: "roof",    from: 6000,  value: 34,  gap: [2.4, 7], mix: MIX(13, 4,   3,   2,   1.6) },
  { name: 'Fun Fair',          look: "fair",    from: 9000,  value: 60,  gap: [2.4, 7], mix: MIX(13, 4,   3,   2.5, 2.0) },
  { name: 'Rocket Base',       look: "rocket",  from: 14000, value: 100, gap: [2.4, 7], mix: MIX(14, 4.5, 3.5, 2,   2.0) },
  { name: 'Snack Vault',       look: "vault",   from: 21000, value: 170, gap: [2.4, 7], mix: MIX(14, 4,   3,   2,   3.0) },
];
// The wall at the end of each zone. Walls are long: you plough through and lose speed every metre (need = about the
// speed it takes with no Wall Wrecker). v0.6 (owner: "the walls dont respawn every run"): EVERY wall is back for every
// launch, so a launch is a race through all of them; breaking one for the first time opens what's behind it in the
// shop, and every break pays a bonus. art = which wall picture (wall-<art>.png).
const WALLS = [
  { x: 250,   len: 8,  need: 26,  hp: 1, art: 0, name: 'Scrap Wall' },
  { x: 600,   len: 10, need: 34,  hp: 1, art: 1, name: 'Blast Door' },
  { x: 1000,  len: 12, need: 48,  hp: 1, art: 4, name: 'Laser Shutter' },
  { x: 2000,  len: 14, need: 70,  hp: 1, art: 5, name: 'Hedge Wall' },
  // v0.6.7 (owner: "you should only be able to beat the game when maxxed or close to it"): the last walls are longer
  // (Wall Blast can't skip them) and much tougher. Sim: the fast bot breaks the CleanCorp Gate with 84-93% of every
  // upgrade and coach level bought, the casual one with 95-100% (DESIGN.md v0.6.7). v0.6.6 was 70-71% / 84-86%.
  { x: 3500,  len: 16, need: 100, hp: 1, art: 3, name: 'Container Wall' },
  { x: 6000,  len: 18, need: 150, hp: 1, art: 6, name: 'Girder Wall' },
  { x: 9000,  len: 20, need: 210, hp: 1, art: 7, name: 'Billboard Wall' },
  { x: 14000, len: 30, need: 330, hp: 1, art: 8, name: 'Fun Fair Gate' },
  { x: 21000, len: 45, need: 600, hp: 1, art: 9, name: 'Blast Shield' },
  { x: 30000, len: 60, need: 1000, hp: 1, art: 2, name: 'CleanCorp Gate' },
];
function zoneAt(x) { let z = 0; for (let i = 0; i < ZONES.length; i++) if (x >= ZONES[i].from) z = i; return z; }
// how deep into its zone x is (0 at the start, 1 at its wall; past the last wall it keeps growing): like the
// original, the further you get the harder it is to keep going, so the walls stay a real goal and launches end
function zoneDepth(x) { const z = zoneAt(x), a = ZONES[z].from, b = z + 1 < ZONES.length ? ZONES[z + 1].from : WALLS[WALLS.length - 1].x; const d = Math.max(0, (x - a) / (b - a)); return x > WALLS[WALLS.length - 1].x ? d : Math.min(1, d); }

function rngOf(seed) {                             // mulberry32: same seed, same street
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// stats come from upgrades (game.js runStats); walls = [{x, hp, max}] still standing, nearest first
function newRun(stats, walls, seed) {
  const R = {
    phase: 'aim', t: 0, st: stats, rng: rngOf(seed || 1),
    x: 0, y: PHYS.HR + 2.2, px: 0, py: PHYS.HR + 2.2, vx: 0, vy: 0, rot: 0, spin: 0, squash: 0,
    slams: stats.slamMax, slamPart: 0, slamming: false, slamTgt: null, ride: null, slide: false, hold: false, claw: null,
    bots: [], nextX: 14, scrap: 0, smashed: 0, combo: 0, bestCombo: 0, slamHits: 0, maxV: 0, maxY: 0,
    walls: walls.map(w => ({ ...w })), wallHit: null, inWall: null, wallDepth: 0, wallBlock: 0, broke: [], endT: 0, ended: false, events: [], lastZone: 0,
    airT: 0, perfect: false, winds: stats.wind, meteor: false, meteors: 0,
  };
  fillBots(R, 60);
  return R;
}

function pickType(R, z) {
  const mix = Object.assign({}, ZONES[z].mix), sp = R.st.spawn;
  for (const k of RIDES) mix[k] = sp[k] || 0;
  mix.bomb *= R.st.bombMul; mix.flare *= R.st.flareMul; mix.fan *= R.st.fanMul; mix.gold *= R.st.goldMul;
  for (const k of ['bomb', 'flare', 'fan', 'gold'].concat(RIDES)) mix[k] *= R.st.luck;   // Lucky Charm: more specials
  mix.cop += PHYS.DEPTH_COP * Math.min(1.2, zoneDepth(R.nextX));  // deeper into a zone: more cops (the last zone tops out, never a wall of them)
  if (R.nextX < 45) return R.rng() < 0.8 ? 'sweep' : 'mop';     // the first few metres stay simple (the slam lesson)
  let sum = 0; for (const k in mix) sum += mix[k];
  let r = R.rng() * sum;
  for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
  return 'sweep';
}
function addBot(R, type, x) {
  const b = BOTS[type];
  const float = (type === 'bomb' && R.rng() < 0.35) || !!b.float;   // some Boombots float on balloons; Cannonbots fly
  const bot = { type, x, y: b.air ? 4 + R.rng() * 7 : type === 'cannon' ? 2.5 + R.rng() * 3.5 : float ? 3 + R.rng() * 4 : 0, r: b.r, alive: true, t: R.rng() * 10, dir: R.rng() < 0.5 ? -1 : 1, float,
    sp: type === 'sweep' ? 0.5 + R.rng() * 0.8 : type === 'mop' ? 0.3 + R.rng() * 0.3 : type === 'drone' || float ? 0.8 : type === 'fan' || type === 'roll' ? 0.4 : 0, panic: 0, hit: 0 };
  bot.baseY = bot.y;
  R.bots.push(bot);
}
function fillBots(R, ahead) {
  const limit = R.x + ahead;
  while (R.nextX < limit) {
    const z = zoneAt(R.nextX), Z = ZONES[z];
    const wall = R.walls[0];
    if (wall && R.nextX > wall.x - 6) break;                     // nothing spawns past a standing wall
    const type = pickType(R, z);
    if (type === 'sweep' && R.rng() < 0.35) {                    // little gangs of sweepers
      const n = 2 + (R.rng() * 2 | 0);
      for (let i = 0; i < n; i++) addBot(R, 'sweep', R.nextX + i * (1.25 + R.rng() * 0.6));
      R.nextX += n * 1.4;
    } else addBot(R, type, R.nextX);
    const easy = R.nextX < 120 ? 0.8 : 1;                        // a friendlier start: more robots in the first 120 m
    R.nextX += (Z.gap[0] + R.rng() * (Z.gap[1] - Z.gap[0])) * easy * R.st.crowd * (1 + PHYS.DEPTH_GAP * zoneDepth(R.nextX));   // and thinner crowds
  }
}

// The launch: the slingshot flings you into the coach and the coach's pad sends you off (game.js decides the hit).
// crit = you hit the pad at the coach's tell (faster and higher). mul = launch power (the coach's speed, the hit).
// angle = launch angle (radians); x, y = where you hit the coach. A launch can go over the speed limit.
function launchRun(R, crit, mul, angle, x, y) {
  const v = R.st.v0 * mul, a = angle === undefined ? (crit ? PHYS.ANGLE_CRIT : PHYS.ANGLE_HIT) : angle;
  R.vx = v * Math.cos(a); R.vy = Math.min(v * Math.sin(a), PHYS.LAUNCH_VY_MAX);
  if (x !== undefined) { R.x = R.px = x; R.y = R.py = y; }
  R.phase = 'fly'; R.perfect = crit; R.spin = 6;
  R.events.push({ k: 'launch', perfect: crit });
}

// a slam (or a big drop) breaks a Security Bot's claw: the speed it took comes back
function breakClaw(R) {
  if (!R.claw) return;
  R.vx += R.claw.lost; R.events.push({ k: 'breakfree', x: R.x, y: R.y, v: R.claw.lost }); R.claw = null;
}
// a tap in the air: a belly slam, or the ride's own move (Pogobot punch, Cannonbot fire), or a Wall Blast in a wall
function requestSlam(R) {
  if (R.phase !== 'fly') return false;
  if (R.ride && R.ride.k === "pogo") return pogoTap(R);
  if (R.ride && R.ride.k === 'cannon') { if (R.ride.fly) return false; fireCannon(R, true); return true; }
  if (R.ride || R.slamming || R.slams <= 0) return false;
  if (R.inWall) {                                     // Wall Blast: a slam inside a wall blows a chunk out and adds speed
    if (!R.st.blast) return false;
    R.slams--; R.x += R.st.blastM; R.vx += R.st.blastV;
    R.events.push({ k: 'wallblast', x: R.x, y: R.y });
    return true;
  }
  if (R.y < PHYS.HR + 1.0) return false;
  R.slams--; R.slamming = true; R.vy = Math.min(R.vy, -PHYS.SLAM_V);
  breakClaw(R);
  // aim help: the dive bends onto the best robot ahead (specials first) by changing only how steeply you drop,
  // so your forward speed is never touched; anything in the way of a special gets smashed on the way down
  const aim = slamAim(R);
  R.slamTgt = aim && BOTS[aim.b.type].special ? aim.b : null;
  if (aim) {
    const drop = R.y - aim.y, v = drop / aim.t - 0.5 * PHYS.G * aim.t;        // gravity still pulls during the dive
    R.vy = -Math.min(PHYS.SLAM_V_MAX, Math.max(PHYS.SLAM_V_MIN, v));
  }
  R.events.push({ k: 'slam', aim: aim ? aim.b.type : null });
  return true;
}
// where a robot will be in t seconds (they wander and run away from you)
function botXAt(b, t) { return b.x + (b.sp ? b.dir * (b.sp + b.panic * 2.2) * t : b.float || b.type === 'drone' ? -0.6 * t : 0); }
// the robot a slam from here would home onto: specials beat plain robots, nearest to the natural landing spot wins.
// Returns { b, t, y }: the robot, the time to reach it and the height the hero's centre aims for.
function slamAim(R) {
  const P = PHYS, vx = Math.max(1, R.vx);
  const xNat = R.x + vx * (R.y - P.HR) / P.SLAM_V;
  let best = null, bestS = Infinity;
  for (const b of R.bots) {
    if (!b.alive || BOTS[b.type].hazard || BOTS[b.type].air) continue;
    const ty = b.y + b.r + P.HR * 0.5, drop = R.y - ty;
    if (drop < 0.8) continue;
    let t = (b.x - R.x) / vx; if (t <= 0.02) continue;
    t = (botXAt(b, t) - R.x) / vx; if (t <= 0.02) continue;
    const v = drop / t - 0.5 * P.G * t;
    if (v < P.SLAM_V_MIN * 0.8 || v > P.SLAM_V_MAX * 1.1) continue;   // can't be reached by bending the dive
    const s = Math.abs(botXAt(b, t) - xNat) - (BOTS[b.type].special ? 8 : 0) - (BOTS[b.type].shield ? 3 : 0);
    if (s < bestS) { bestS = s; best = { b, t, y: ty }; }
  }
  return best;
}

// a robot is smashed: scrap (x2 for a slam's direct hit), combo, and the slam gauge fills (owner 2026-11-08: smashing
// with slams and big drops must give slams back too): 1 for a direct hit or a ride, half for a shockwave victim.
function payBot(R, bot, slam, wave, plow) {
  const B = BOTS[bot.type], st = R.st, z = zoneAt(bot.x);
  const ev = { k: 'smash', type: bot.type, x: bot.x, y: bot.y + bot.r, slam, wave: !!wave, plow: !!plow, combo: 0, scrap: 0 };
  bot.alive = false;
  if (B.hazard) return ev;                           // a slammed wet-floor sign just breaks
  R.combo++; R.bestCombo = Math.max(R.bestCombo, R.combo); R.smashed++;
  if (slam && !wave) R.slamHits++;
  const comboMul = 1 + 0.05 * Math.min(R.combo - 1, 20);   // up to x2 for a long combo
  const scrap = ZONES[z].value * B.scrap * st.scrapMult * (bot.type === 'gold' ? st.goldVal : 1) * (slam && !wave ? 2 : 1) * comboMul;
  R.scrap += scrap; ev.scrap = scrap; ev.combo = R.combo;
  if (R.slams < st.slamMax) { R.slamPart += (wave ? 0.5 : 1) / st.slamRefill; if (R.slamPart >= 1) { R.slamPart -= 1; R.slams++; ev.refill = true; } }
  return ev;
}
// a slam's shockwave: every robot near the impact is smashed too (shields and wet floors included).
// Specials caught in it give part of their power (a third of the push; Fanbots still give a slam).
function slamWave(R, x, skip) {
  const big = R.meteor, r = R.st.slamR * (big ? PHYS.METEOR_R : 1); let n = 0;
  for (const b of R.bots) {
    if (!b.alive || b === skip || Math.abs(b.x - x) > r || b.y > r) continue;
    const ev = payBot(R, b, true, true); n++;
    specialPower(R, b, ev, 0.35, true);
    R.events.push(ev);
  }
  R.events.push({ k: 'wave', x, r, n, meteor: !!big });
  if (big) R.meteor = false;                        // the meteor has landed
  R.slamTgt = null;
}
// what a special robot does for you when you smash it (k = share of the push; wave = caught in a shockwave).
// Returns true if it set your bounce (or started a ride).
function specialPower(R, b, ev, k, wave) {
  const B = BOTS[b.type], st = R.st, P = PHYS;
  k = (k || 1) * (R.vx > speedLimit(R) ? 0.5 : 1);   // pushes are halved in a shockwave and over the speed limit
  if (B.boom) { R.vx += P.BOMB_PUSH * st.bombBoost * k; ev.boom = true; return false; }
  if (B.fan) { R.slams = Math.min(R.slams + 1, st.slamMax + 1); ev.fan = true; return false; }
  if (wave) { if (B.flare) { R.vx += P.FLARE_PUSH * st.flarePush * k; ev.flare = true; } else if (b.type === 'spring') R.vx += P.SPRING_PUSH * st.springPush * k; return false; }
  if (B.flare) { endRide(R, true); R.slamming = false; R.vy = Math.max(R.vy, st.flareUp); R.vx += P.FLARE_PUSH * st.flarePush * k; R.squash = 1; R.spin = 14; ev.flare = true; return true; }
  if (b.type === 'spring') { endRide(R, true); R.vy = Math.max(R.vy, P.SLAM_BOUNCE * B.up * 0.85); R.vx += P.SPRING_PUSH * st.springPush * k; ev.spring = true; return true; }
  if (B.ride) { startRide(R, b, ev); return true; }
  return false;
}
// rides: jet (hold to climb), drone (a lift), pogo (tap to punch down), cannon (tap to fire), roll (a junk ball)
function startRide(R, b, ev) {
  const st = R.st, P = PHYS;
  endRide(R, true);
  R.slamming = false; R.slamTgt = null; ev.ride = b.type;
  if (b.type === 'jet') { R.ride = { k: 'jet', t: 0, dur: st.jetS }; R.vx = Math.max(R.vx, st.jetV); R.vy = Math.max(R.vy, 3); }
  else if (b.type === 'drone') { R.ride = { k: 'drone', t: 0, dur: P.DRONE_S * st.droneMul, bot: b }; R.vx += P.DRONE_PUSH * st.dronePush; R.vy = P.DRONE_UP; }
  else if (b.type === "pogo") { R.ride = { k: "pogo", t: 0, hits: 0, chances: 0, armed: false, early: false }; R.vy = Math.max(R.vy, P.POGO_HOP); }
  else if (b.type === 'cannon') {                   // loaded into the cannon; two more wait ahead, the last one gold
    const nx = [1, 2].map(i => ({ x: b.x + P.CANNON_GAP * i, y: 3 + R.rng() * 4 }));
    R.ride = { k: "cannon", t: 0, stage: 0, cx: b.x, cy: b.y + b.r, next: nx, fly: null, keep: Math.max(R.vx, 18) };
    R.x = b.x; R.y = b.y + b.r; R.vy = 0; aimCannon(R);
  } else if (b.type === 'roll') { R.ride = { k: 'roll', t: 0, dur: P.ROLL_S * st.rollMul, n: 0 }; R.vx = Math.max(R.vx, P.ROLL_V); }
}
// a ride ends; swap = another special takes over (no end bonus)
function endRide(R, swap) {
  const rd = R.ride; if (!rd) return;
  R.ride = null;
  if (swap) return;
  const P = PHYS, st = R.st;
  if (rd.k === 'roll') { const add = Math.min(14, P.ROLL_BURST + rd.n * 0.5) * st.rollBoost; R.vx += add; R.vy = 16; R.events.push({ k: 'rollburst', x: R.x, y: R.y, n: rd.n, v: add }); }
  else if (rd.k === 'pogo') R.vy = Math.max(R.vy, 6);
  else R.vy = Math.max(R.vy, 5);
  R.events.push({ k: 'unride', ride: rd.k });
}
// Cannonbot (v0.6, like the original's barrel cannons): the barrel swings up and down; fire (tap) when it points at
// the next cannon and you fly into it; fire at the wrong angle and you MISFIRE out of the chain in that direction.
// The third cannon is gold: it blasts you out, hardest when aimed about 30 degrees up. The fuse fires it anyway.
function aimCannon(R) {                             // a new cannon: where its target is and how the barrel swings
  const rd = R.ride, P = PHYS;
  rd.tgt = rd.stage < 2 ? Math.atan2(rd.next[rd.stage].y - rd.cy, rd.next[rd.stage].x - rd.cx) : P.CANNON_BEST;
  rd.c = rd.tgt + (R.rng() - 0.5) * 0.7; rd.ph = R.rng() * 6.28;
}
function cannonAim(rd) { return rd.c + PHYS.CANNON_SWING * Math.sin(PHYS.CANNON_SPEED * rd.t + rd.ph); }
function fireCannon(R, tap) {
  const rd = R.ride, P = PHYS, a = cannonAim(rd);
  if (rd.stage < 2) {
    if (Math.abs(a - rd.tgt) <= P.CANNON_TOL) {      // on target: into the next cannon
      const to = rd.next[rd.stage];
      rd.fly = { x0: R.x, y0: R.y, x1: to.x, y1: to.y, t: 0 }; rd.stage++; rd.t = 0;
      R.events.push({ k: 'cannon', stage: rd.stage, hit: true, tap });
    } else {                                         // misfire: out of the chain, the way the barrel pointed
      const v = rd.keep * 0.85; R.ride = null;
      R.vx = Math.max(6, v * Math.cos(a)); R.vy = Math.max(-10, Math.min(22, v * Math.sin(a))); R.spin = 14;
      R.events.push({ k: 'cannon', stage: rd.stage, hit: false, tap, x: R.x, y: R.y });
    }
  } else {
    const q = Math.max(0, 1 - Math.abs(a - P.CANNON_BEST) / 0.7), add = P.CANNON_BOOM * R.st.cannonBoost * (0.3 + 0.7 * q);
    R.ride = null; R.vx = rd.keep + add; R.vy = 8 + 10 * q; R.spin = 16;
    R.events.push({ k: 'cannonboom', x: R.x, y: R.y, v: add, perfect: q > 0.75, tap });
  }
}
function smash(R, bot) {
  const B = BOTS[bot.type], st = R.st;
  let slam = R.slamming;
  // falling hard onto a robot is a slam too (no charge used), except onto ride robots
  if (!slam && !B.ride && -R.vy >= PHYS.AUTO_SLAM_VY) { slam = true; R.events.push({ k: 'bigfall', x: bot.x }); }
  if (slam) breakClaw(R);
  const ev0 = { k: 'smash', type: bot.type, x: bot.x, y: bot.y + bot.r, slam, combo: 0, scrap: 0 };
  if (B.hazard && !slam) {                           // wet floor sign: you skid
    bot.alive = false; R.vx *= st.coneKeep; R.vy = Math.max(R.vy, 4); ev0.k = 'skid'; R.events.push(ev0); return;
  }
  if (B.shield && !slam) {                           // a Security Bot's claw grabs you: speed lost until you slam
    const v0 = R.vx;
    bot.hit = 0.9; R.vx *= st.shieldKeep; R.vy = R.vx < 3 ? Math.min(R.vy, 1) : Math.max(Math.abs(R.vy) * 0.35, 7); R.combo = 0;   // nearly stopped: no rebound (no endless clangs)
    if (R.vx >= 3) R.claw = { lost: (R.claw ? R.claw.lost : 0) + v0 - R.vx, t: PHYS.CLAW_S };
    ev0.k = 'clang'; R.events.push(ev0); return;
  }
  const ev = payBot(R, bot, slam, false);
  if (B.hazard) {                                    // slammed sign: no skid, the shockwave still goes off
    R.slamming = false; R.vy = PHYS.GROUND_SLAM_UP; R.events.push(ev); slamWave(R, bot.x, bot); return;
  }
  if (B.ride || B.flare) {                           // rides and Firework Bots set your path themselves
    specialPower(R, bot, ev); R.events.push(ev); if (slam) slamWave(R, bot.x, bot); return;
  }
  let up = Math.min(PHYS.UP_MAX, Math.max(PHYS.UP_MIN, Math.abs(R.vy) * 0.82)) * B.up * st.botBounce;
  if (slam) { up = PHYS.SLAM_BOUNCE * Math.max(1, B.up * 0.85); R.slamming = false; }
  R.vy = up;
  // slams keep your speed; a plain bounce costs a tiny bit; specials give speed (bombs, Boingbots), Fanbots a slam
  // deeper zones have heavier robots: a plain bounce costs more there (and keeps growing past the last wall), so late
  // launches live on lucky chains of specials, like the original
  if (!slam && !B.special) R.vx = Math.max(0, R.vx * (PHYS.BOT_KEEP - PHYS.ZONE_DRAG * deepZone(R.x)) - PHYS.BOT_LOSS);
  specialPower(R, bot, ev);
  R.y = Math.max(R.y, bot.y + bot.r + PHYS.HR * 0.6);
  R.squash = 1; R.spin = 10;
  R.events.push(ev);
  if (slam) slamWave(R, bot.x, bot);
}
// while riding, robots you touch are smashed (they fill the slam gauge); specials give their power, another ride
// robot swaps you onto it
function plow(R, b) {
  const B = BOTS[b.type], ev = payBot(R, b, false, false, true);
  if (R.ride && R.ride.k === "roll") R.ride.n++;    // the junk ball grows, and its burst gets bigger
  if (B.special) { const k = R.ride ? R.ride.k : null; specialPower(R, b, ev); if (R.ride && R.ride.k !== k) ev.swap = true; }
  R.events.push(ev);
}

// Walls: you plough in and lose speed every metre (less with Wall Wrecker). Out the far side = broken for good.
function enterWall(R, w) {
  endRide(R, true); R.inWall = w; R.slamming = false; R.meteor = false; R.wallDepth = 0; R.wallBlock = 0;
  R.vx = Math.max(R.vx, Math.hypot(R.vx, R.vy) * 0.85);   // you hit it with all you've got...
  if (PHYS.WALL_CAP > 0) R.vx = Math.min(R.vx, speedLimit(R) * PHYS.WALL_CAP);   // ...but a wall soaks up bursts far over your speed limit
  R.events.push({ k: 'wallin', name: w.name, x: w.x, v: R.vx });
}
function pushWall(R, h) {
  const w = R.inWall, P = PHYS;
  const tough = (w.need - P.WALL_STALL) / w.len / R.st.wallMult;   // speed lost per metre: about 1 s of ploughing
  R.vy = 0; R.spin = 12;
  const dx = R.vx * h;
  R.x += dx;
  R.vx -= tough * dx;
  R.wallDepth = R.x - w.x;
  const blk = Math.floor(R.wallDepth / 1.5);
  if (blk > R.wallBlock) { R.wallBlock = blk; R.events.push({ k: 'wallchunk', x: R.x + P.HR, y: R.y, name: w.name }); }
  if (R.wallDepth >= w.len) {                          // through!
    R.inWall = null; R.walls.shift(); R.broke.push(w.name); R.vx *= P.WALL_EXIT;
    // a never-broken wall takes all you've got: you tumble out slowly onto an empty street and slide to a stop,
    // so every new wall gets its own launch (lucky launches used to sail through the next zone's wall too)
    const fresh = w.fresh && P.FRESH_EXIT > 0;
    if (fresh) { R.vx = Math.min(R.vx, P.FRESH_EXIT); R.freshBreak = w.name; R.nextX = Math.max(R.nextX, w.x + w.len + 45); }
    const bonus = ZONES[zoneAt(w.x + w.len + 1)].value * 40 * R.st.scrapMult; R.scrap += bonus; R.wallScrap = (R.wallScrap || 0) + bonus;   // every break pays
    R.vy = Math.max(R.vy, 6); R.nextX = Math.max(R.nextX, w.x + w.len + 10);
    R.events.push({ k: "wall", name: w.name, x: w.x + w.len, broke: true, depth: w.len, len: w.len, scrap: bonus, fresh });
    if (!fresh) fillBots(R, 60);
  } else if (R.vx < P.WALL_STALL && R.winds > 0) {     // Second Wind: one last boost instead of getting stuck
    R.winds--; R.vx = R.st.windV * 1.6; R.events.push({ k: 'wind' });
  } else if (R.vx < P.WALL_STALL) {                    // stuck: popped back out, the wall will be whole next launch
    R.inWall = null;
    R.wallHit = { name: w.name, depth: R.wallDepth, len: w.len, frac: R.wallDepth / w.len };
    R.x = w.x - P.HR - 0.05; R.vx = -4; R.vy = 8; R.spin = -14;
    R.events.push({ k: 'wall', name: w.name, x: w.x, broke: false, depth: R.wallDepth, len: w.len });
  }
}

// Will this fall end in a free BIG DROP (an automatic slam)? Returns { x, t, v } for the landing, or null.
// The game shows it while you fall (owner 2026-11-08: "no indicator you're gonna fall with a slam").
function bigDropAhead(R) {
  if (R.phase !== 'fly' || R.ride || R.slamming || R.inWall || R.wallHit || R.slide) return null;
  const P = PHYS, h = R.y - P.HR;
  if (h <= 0) return null;
  const v = Math.sqrt(R.vy * R.vy + 2 * P.G * h);                 // speed when you reach the street
  if (v < P.AUTO_SLAM_VY) return null;
  const t = (R.vy + v) / P.G;
  return { x: R.x + R.vx * t, t, v };
}

// one step; ctl.hold = finger/mouse/key held (steers a Jetbot ride)
function stepRun(R, dt, ctl) {
  if (R.phase === 'aim') { R.t += dt; return; }
  if (R.phase === 'done') return;
  R.t += dt;
  R.hold = !!(ctl && ctl.hold);
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(R.vx), Math.abs(R.vy)) * dt / 0.22));   // sub-steps: no tunnelling at speed
  const h = dt / n;
  for (let i = 0; i < n && R.phase === 'fly'; i++) sub(R, h);
  if (R.phase === 'end') { R.endT += dt; R.spin *= Math.exp(-3 * dt); if (R.endT > 0.9) R.phase = 'done'; }
  if (R.claw) { R.claw.t -= dt; if (R.claw.t <= 0) R.claw = null; }   // the claw lets go: the lost speed stays lost
  // robots wander and panic
  for (const b of R.bots) {
    if (!b.alive) continue;
    b.t += dt; if (b.hit > 0) b.hit -= dt;
    if (b.type === 'drone' || b.float) { b.y = b.baseY + Math.sin(b.t * 2.2) * 0.5; b.x -= 0.6 * dt; continue; }
    if (!b.sp) continue;
    const ahead = b.x - R.x;
    if (ahead > 0 && ahead < 9 && R.vx > 3) { b.panic = Math.min(1, b.panic + dt * 3); b.dir = 1; }
    else { b.panic = Math.max(0, b.panic - dt); if (R.rng() < dt * 0.4) b.dir = -b.dir; }
    b.x += b.dir * (b.sp + b.panic * 2.2) * dt;
  }
  if (R.bots.length > 80 || (R.bots.length && R.bots[0].x < R.x - 30)) R.bots = R.bots.filter(b => b.x > R.x - 30 && (b.alive || b.x > R.x - 8));
  fillBots(R, Math.max(60, R.vx * 1.6));          // robots ahead: farther at high speed
  R.maxV = Math.max(R.maxV, R.vx); R.maxY = Math.max(R.maxY, R.y);
  if (R.t > PHYS.RUN_MAX_S && R.phase === 'fly') endRun(R);
  const z = zoneAt(R.x); if (z !== R.lastZone) { R.lastZone = z; R.events.push({ k: 'zone', z }); }
}
function endRun(R) { if (R.phase !== 'fly') return; R.phase = 'end'; R.endT = 0; R.ride = null; R.slamming = false; R.inWall = null; R.claw = null; R.events.push({ k: 'stop' }); }

// the Cannonbot ride: held in a cannon (tap fires), or flying to the next one
function subCannon(R, h) {
  const rd = R.ride, P = PHYS;
  rd.t += h;
  if (rd.fly) {
    const f = rd.fly; f.t += h; const k = Math.min(1, f.t / P.CANNON_FLY);
    R.x = f.x0 + (f.x1 - f.x0) * k; R.y = f.y0 + (f.y1 - f.y0) * k + Math.sin(Math.PI * k) * 2.5; R.spin = 20;
    if (k >= 1) { rd.fly = null; rd.cx = f.x1; rd.cy = f.y1; rd.t = 0; aimCannon(R); }
  } else if (rd.t >= P.CANNON_HOLD) { fireCannon(R, false); if (!R.ride) return; }   // the fuse ran out: it fires wherever it points
  R.vx = rd.keep; R.vy = 0; R.airT += h;
}
function sub(R, h) {
  const P = PHYS;
  if (R.inWall) { pushWall(R, h); R.airT += h; return; }
  if (R.ride && R.ride.k === 'cannon') { subCannon(R, h); return; }
  if (R.ride) {
    const rd = R.ride; rd.t += h;
    if (rd.k === 'jet') {
      R.vx = Math.max(R.vx, R.st.jetV);
      const want = R.hold ? P.JET_UP : P.JET_DOWN;
      R.vy += (want - R.vy) * Math.min(1, h * 5);
      if (R.y > P.JET_MAX_Y) R.vy = Math.min(R.vy, 0);
      if (R.y < P.HR + 0.6) { R.y = P.HR + 0.6; R.vy = Math.max(R.vy, 0); }
    } else if (rd.k === 'drone') {
      R.vy += (P.DRONE_UP - R.vy) * Math.min(1, h * 4);
    } else if (rd.k === 'roll') {                    // a junk ball rolling along the street
      R.vx = Math.max(R.vx, P.ROLL_V); R.vy -= P.G * h;
      if (R.y < P.HR + 0.5) { R.y = P.HR + 0.5; R.vy = 0; }
      R.spin = R.vx / 1.2;
    } else R.vy -= P.G * h;                          // pogo: normal gravity, bounces on its spring below
    if (rd.dur && rd.t >= rd.dur) endRide(R, false);
  } else {
    R.vy -= P.G * h;
  }
  if (!R.slamming) R.vx -= R.vx * P.AIR_DRAG * h;    // a slam dive keeps all its speed
  const lim = speedLimit(R);
  if (R.vx > lim) R.vx -= (R.vx - lim) * (R.st.softK || P.SOFT_K) * h;   // the soft speed limit (Top Speed raises it)
  R.x += R.vx * h; R.y += R.vy * h;
  // the cloud layer: come down as a METEOR (more speed, a slam back, a huge free slam where you land)
  if (R.y >= P.CLOUD_Y && !R.meteor) {
    endRide(R, true);
    R.meteor = true; R.slamming = true; R.slamTgt = null; R.y = P.CLOUD_Y;
    R.vx += (R.st.meteorV || P.METEOR_V) * Math.pow(P.METEOR_FADE, R.meteors || 0);   // each meteor in a launch pushes less
    R.vy = -P.METEOR_DIVE;
    if ((R.meteors || 0) < P.METEOR_SLAM_N) R.slams = Math.min(R.slams + P.METEOR_SLAMS, R.st.slamMax + P.METEOR_SLAMS);   // a slam back (the first few meteors)
    const sc = ZONES[zoneAt(R.x)].value * 20 * R.st.scrapMult * (R.st.meteorPay || 1); R.scrap += sc; R.meteors = (R.meteors || 0) + 1;
    R.events.push({ k: 'meteor', x: R.x, y: R.y, scrap: sc });
  }
  R.rot += (R.slide ? R.vx / P.HR : R.spin) * h;
  R.squash = Math.max(0, R.squash - h * 5);
  if (!R.slide && !(R.ride && R.ride.k === 'roll')) R.spin *= Math.exp(-2.5 * h);   // looks only: the curled-up spin fades
  R.airT += h;

  // the wall
  const w = R.walls[0];
  if (w && R.x + P.HR >= w.x && R.vx > 0 && !R.wallHit) { enterWall(R, w); return; }

  // robots
  const tgt = R.slamming && R.slamTgt && R.slamTgt.alive ? R.slamTgt : null;
  for (const b of R.bots) {
    if (!b.alive || b.hit > 0 || Math.abs(b.x - R.x) > 3.5) continue;
    const cy = b.y + b.r, dx = b.x - R.x, dy = cy - R.y, rr = b.r * 0.92 + P.HR + (R.ride && R.ride.k === 'roll' ? 0.5 : 0);
    if (dx * dx + dy * dy < rr * rr) {
      if (R.ride && R.ride.k !== 'drone') { plow(R, b); if (R.ride && R.ride.k === 'cannon') return; continue; }   // rides smash through everything
      if (R.ride) continue;                          // the Copter carries you over them
      if (tgt && b !== tgt) {                        // a slam aimed at a special smashes through whatever is in the way
        const ev = payBot(R, b, true, true); specialPower(R, b, ev, 0.35, true); R.events.push(ev); continue;
      }
      smash(R, b);
      if (R.phase !== 'fly') return;
    }
  }

  // the ground
  const floor = R.ride && R.ride.k === 'pogo' ? P.HR + P.POGO_H : P.HR;
  if (R.y <= floor) {
    R.y = floor;
    if (R.ride && R.ride.k === 'pogo') { pogoLand(R); return; }
    if (R.vy < 0) {
      const hit = -R.vy;
      if (!R.wallHit && !R.freshBreak && (R.slamming || hit >= P.AUTO_SLAM_VY)) {
        // a slam (or a hard landing) on the street: shockwave, bounce back up, no speed lost
        R.events.push({ k: 'thud', v: hit, auto: !R.slamming });
        breakClaw(R);
        R.slamming = false; R.vy = P.GROUND_SLAM_UP; R.squash = 1; R.slide = false; R.spin = 8;
        slamWave(R, R.x, null);
        return;
      }
      R.combo = 0;
      if (R.wallHit || R.freshBreak) { R.vy = 0; R.vx *= 0.5; R.slide = true; }
      else if (hit * R.st.bounce < P.SETTLE_VY || R.vx < 1) { R.vy = 0; R.slide = true; }
      else { R.vy = hit * R.st.bounce; R.vx = Math.max(0, R.vx * R.st.keep - P.GROUND_LOSS); R.squash = Math.min(1, hit / 20); R.events.push({ k: 'bounce', v: hit }); R.slide = false; }
      R.claw = null;                                   // landed on the street: the claw's speed is gone for good
    }
    if (R.slide) {
      const s = Math.sign(R.vx), a = Math.abs(R.vx) - P.FRICTION * h;
      R.vx = a > 0 ? s * a : 0;
      if (Math.abs(R.vx) < P.STOP_V) {
        if (R.winds > 0 && !R.wallHit && !R.freshBreak) {   // Second Wind: one last big hop instead of stopping
          R.winds--; R.slide = false; R.vy = 13; R.vx = R.st.windV; R.y = P.HR + 0.05; R.spin = 8;
          R.events.push({ k: 'wind' });
        } else endRun(R);
      }
    }
  } else if (R.y > P.HR + 0.3) R.slide = false;
}
// Pogobot (v0.6, like the original's puncher): three chances. Tap just before the spring hits the street (within
// POGO_WIN s of impact) to PUNCH: you bounce higher and faster. Tap too early and that hop is wasted. Three punches
// out of three = POGO BOOM (a big push); fewer and the pogo just breaks after the third landing.
function pogoWindow(R) {                            // time until the spring hits the street (Infinity going up)
  if (R.vy >= 0) return Infinity;
  const h = R.y - (PHYS.HR + PHYS.POGO_H), v = -R.vy;
  return (-v + Math.sqrt(v * v + 2 * PHYS.G * Math.max(0, h))) / PHYS.G;
}
function pogoTap(R) {
  const rd = R.ride;
  if (rd.armed || rd.early) return false;
  if (pogoWindow(R) <= PHYS.POGO_WIN) { rd.armed = true; R.events.push({ k: 'pogotap', good: true }); }
  else { rd.early = true; R.events.push({ k: 'pogotap', good: false, x: R.x, y: R.y }); }
  return true;
}
function pogoLand(R) {
  const rd = R.ride, P = PHYS, st = R.st;
  rd.chances++;
  if (rd.armed) { rd.hits++; R.vy = P.POGO_PUNCH[rd.hits - 1]; R.vx += P.POGO_PUSH * st.pogoBoost; R.events.push({ k: 'pogopunch', n: rd.hits, x: R.x, y: R.y }); }
  else { R.vy = P.POGO_HOP; R.events.push({ k: 'pogomiss', x: R.x, y: R.y, early: rd.early }); }
  rd.armed = false; rd.early = false;
  if (rd.chances < 3) return;
  R.ride = null;
  if (rd.hits >= 3) {
    const add = P.POGO_BOOM * st.pogoBoost; R.vx += add; R.vy = 22; R.spin = 14;
    R.events.push({ k: 'pogoboom', x: R.x, y: R.y, v: add }); slamWave(R, R.x, null);
  } else { R.vy = Math.max(R.vy, 8); R.events.push({ k: 'unride', ride: 'pogo', hits: rd.hits }); }
}

// Scrap for the distance flown: each metre pays a little, more in later zones.
function distanceScrap(x, mult) {
  let s = 0;
  for (let i = 0; i < ZONES.length; i++) {
    const a = ZONES[i].from, b = i + 1 < ZONES.length ? ZONES[i + 1].from : Infinity;
    if (x > a) s += (Math.min(x, b) - a) * 0.1 * ZONES[i].value;
  }
  return s * mult;
}
