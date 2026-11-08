'use strict';
// Rules: coaches and upgrades, walls, scrap, saves, the YouTube SDK lifecycle, ads, tutorial steps.
// The run itself (physics, robots) lives in run.js; drawing in view.js and ui.js.

const yt = (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) ? ytgame : null;

const CFG = {
  SAVE_KEY: "bandit-blast", SAVE_VERSION: 6,
  V0: 30,                       // launch speed off Nana's pad at level 0 (m/s); Slingshot Power adds 12% a level
  CRIT_MUL: 1.3, MISS_MUL: 0.7, SHOCK_MUL: 0.3,   // a CRIT, missing the coach, hitting Big Mo while he sparks
  CRIT_WIN: 0.42, CRIT_EASY: [1.9, 1.6, 1.3],      // seconds the tell lasts; wider in the first three launches
  HIT_DMG: 3, CRIT_DMG: 6,      // damage to the coach's stamina (Muscle adds 25% a level)
  VMAX0: 30, VMAX_STEP: 11,     // the speed limit (m/s) and what Top Speed adds a level (it's soft: you can go over)
  BOUNCE0: 0.45, BOUNCE_STEP: 0.03, KEEP0: 0.66, KEEP_STEP: 0.022,
  SLAM0: 2,                     // slams per launch at level 0 (owner 2026-11-07: easier start)
  SLAM_REFILL0: 10,             // smashes to refill one slam (Slam Refill takes 1 off per level)
  SCRAP_STEP: 0.3, WALL_STEP: 0.07,
  EARLY_PRICE: 0.4, LATE_FROM: 0.4, LATE_MUL: 1.15,   // v0.6.6 (owner: early quick, late really expensive): price shape (priceShape): early levels x EARLY_PRICE, x LATE_MUL per level past 40% of max
  SHOT_V: 30,                   // how fast you fly from the slingshot into the coach (m/s)
  AUTOSAVE_MS: 5000,
  AD_GAP_S: 150, ADS_FROM_RUN: 4,
  DOUBLE_FROM_RUN: 2,
};

// coach standing on the tyres; hit them during their tell for a CRIT (faster and higher, double damage).
// - each coach launches at their own speed: buying a later coach is the big launch upgrade
// - each has their own tell and twist (random timing, a hop, teleporting, sparks, flying)
// - stamina bar, KO = a big scrap bonus, then a random coach from your team steps up
// - 8 levels each (Big Mo 4, Dr. Hoot is a reward with no levels): more speed, more stamina, a bigger KO bonus
const COACHES = [
  { id: 'nana',   name: 'Nana Possum',    speed: 1.00, hp: 10, ko: 40,    price: 0,     max: 8, runs: 0, wall: 0, twist: 'steady',   line: 'Hit the pad, dearie!',   how: 'Lifts her pad every 2 seconds.' },
  { id: 'stinky', name: 'Coach Stinky',   speed: 1.15, hp: 14, ko: 300,   price: 300,   max: 8, runs: 1, wall: 0, twist: 'random',   line: 'Belly first! FEEL it!',  how: 'Lifts it whenever he feels like it.' },
  { id: 'pidge',  name: 'Pidge',          speed: 1.32, hp: 18, ko: 2500,  price: 3000,  max: 8, runs: 0, wall: 1, twist: 'hop',      line: 'Quick, quick, NOW!',     how: 'CRIT only at the top of his hop: aim high!' },
  { id: 'nutz',   name: 'Professor Nutz', speed: 1.50, hp: 24, ko: 12000, price: 20000, max: 8, runs: 0, wall: 3, twist: 'teleport', line: 'Calculating... NOW!',     how: 'Teleports around: aim where he is.' },
  { id: 'mo',     name: 'Big Mo',         speed: 1.70, hp: 32, ko: 50000, price: 120000, max: 4, runs: 0, wall: 5, twist: 'shock',    line: 'Hit me like a wall!',    how: 'Never hit him while he sparks!' },
  { id: 'hoot',   name: 'Dr. Hoot',       speed: 1.85, hp: 14, ko: 40000, price: 0,     max: 1, runs: 0, wall: 7, twist: 'fly',      line: 'Hoo! Science says NOW!', how: 'Flies around: any hit is a CRIT.', reward: true },
];
const COACH = Object.fromEntries(COACHES.map(c => [c.id, c]));

// COACHES. Each tab is a grid with a row per kind; rows open after a few launches or a wall broken for the first time.
// v0.6 progression (owner 2026-11-08: "its easy to max out the speed meter need more upgrades/upgrade tiers"): up to
// 15 levels (Top Speed 20, specials 10), each a solid step, prices x2.4-2.6 a level, and a new Pro row.
const ROWS = [
  { id: 'launch', tab: 'up', name: 'Launch', runs: 0, wall: 0 },
  { id: 'slam',   tab: 'up', name: 'Slam',   runs: 0, wall: 0 },
  { id: 'bounce', tab: 'up', name: 'Bounce', runs: 2, wall: 0 },
  { id: 'scrap',  tab: 'up', name: 'Scrap',  runs: 3, wall: 0 },
  { id: 'demo',   tab: 'up', name: 'Walls',  runs: 0, wall: 1 },
  { id: 'pro',    tab: 'up', name: 'Pro',    runs: 0, wall: 4 },
  { id: 'boom',   tab: 'sp', name: 'Boom',   runs: 2, wall: 0 },
  { id: 'gold',   tab: 'sp', name: 'Gold',   runs: 3, wall: 0 },
  { id: 'rides',  tab: 'sp', name: 'Rides',  runs: 0, wall: 2 },
  { id: 'tricks', tab: 'sp', name: 'Tricks', runs: 0, wall: 3 },
];
const TABS = [['up', 'UPGRADES'], ['sp', 'SPECIALS'], ['coach', 'COACHES']];
const pct = (x) => Math.round(x * 100) + '%';
const kmh = (v) => Math.round(v * 3.6) + ' km/h';
const UPGRADES = [
  { id: 'sling',  row: 'launch', name: 'Slingshot Power', desc: 'Launch faster',                               base: 15,  mul: 2.2, max: 15, fx: L => '+' + pct(0.12 * L) + ' launch speed' },
  { id: 'muscle', row: 'launch', name: 'Muscle',          desc: 'Hit coaches harder: KO them sooner',         base: 40,  mul: 2.3, max: 12, fx: L => 'x' + (1 + 0.3 * L).toFixed(1) + ' damage' },
  { id: 'topspeed',row:'launch', name: 'Top Speed',       desc: 'Raise your speed limit',                      base: 20,  mul: 2.2, max: 20, fx: L => kmh(CFG.VMAX0 + CFG.VMAX_STEP * L) + ' limit' },
  { id: 'slam',   row: 'slam',   name: 'Belly Slam',      desc: '+1 slam every launch',                        base: 100, mul: 4,   max: 5,  fx: L => (CFG.SLAM0 + L) + ' slams' },
  { id: 'refill', row: 'slam',   name: 'Slam Refill',     desc: 'Fewer smashes to earn a slam back',           base: 120, mul: 4,   max: 5,  fx: L => 'every ' + (CFG.SLAM_REFILL0 - L) + ' smashes' },
  { id: 'quake',  row: 'slam',   name: 'Slam Quake',      desc: 'Bigger slam shockwave',                       base: 90,  mul: 3,   max: 8,  fx: L => (PHYS.SLAM_R * (1 + 0.12 * L)).toFixed(1) + ' m wide' },
  { id: 'bounce', row: 'bounce', name: 'Bouncy Suit',     desc: 'Bounce higher off robots and the street',     base: 20,  mul: 2.2, max: 12, fx: L => '+' + Math.round(L * 6) + '% bounce' },
  { id: 'slick',  row: 'bounce', name: 'Slick Fur',       desc: 'Lose less speed on the street',               base: 20,  mul: 2.2, max: 12, fx: L => 'keep ' + pct(CFG.KEEP0 + CFG.KEEP_STEP * L) + ' on the street' },
  { id: 'wind',   row: 'bounce', name: 'Second Wind',     desc: 'Stopped or stuck in a wall? One last boost',  base: 800, mul: 5,   max: 3,  fx: L => L ? L + (L > 1 ? ' boosts' : ' boost') + ' per launch' : 'none yet' },
  { id: 'scrap',  row: 'scrap',  name: 'Scrap Finder',    desc: 'More scrap from robots',                      base: 45,  mul: 2.25, max: 15, fx: L => '+' + pct(CFG.SCRAP_STEP * L) + ' scrap' },
  { id: 'distpay',row: 'scrap',  name: 'Distance Pay',    desc: 'More scrap for every metre',                  base: 50,  mul: 2.25, max: 15, fx: L => '+' + pct(0.4 * L) + ' distance scrap' },
  { id: 'luck',   row: 'scrap',  name: 'Lucky Charm',     desc: 'More special robots of every kind',           base: 200, mul: 2.6, max: 12, fx: L => '+' + pct(0.08 * L) + ' specials' },
  { id: 'wall',   row: 'demo',   name: 'Wall Wrecker',    desc: 'Plough through walls more easily',            base: 100, mul: 2.25, max: 15, fx: L => '-' + pct(1 - 1 / (1 + CFG.WALL_STEP * L)) + ' wall drag' },
  { id: 'fur',    row: 'demo',   name: 'Riot Padding',    desc: 'Security Bot claws take less speed',          base: 200, mul: 2.6, max: 12, fx: L => 'keep ' + pct(0.5 + 0.03 * L) + ' speed' },
  { id: 'blast',  row: 'demo',   name: 'Wall Blast',      desc: 'Tap inside a wall: blow through it (1 slam)', base: 600, mul: 3,   max: 8,  fx: L => L ? (1.5 + 0.6 * L).toFixed(1) + ' m, +' + kmh(5 + 3 * L) : 'not yet' },
  { id: 'critpow',row: 'pro',    name: 'Crit Power',      desc: 'CRIT launches hit even harder',              base: 2000, mul: 2.6, max: 10, fx: L => 'CRIT x' + (CFG.CRIT_MUL + 0.05 * L).toFixed(2) },
  { id: 'overdrive',row:'pro',   name: 'Overdrive',       desc: 'Stay over your speed limit for longer',      base: 2500, mul: 2.6, max: 10, fx: L => '-' + pct(0.06 * L) + ' slow-down over the limit' },
  { id: 'meteor', row: 'pro',    name: 'Meteor Core',     desc: 'Meteors from the clouds hit harder',         base: 3000, mul: 2.6, max: 10, fx: L => '+' + kmh(PHYS.METEOR_V + 3 * L) + ', x' + (1 + 0.4 * L).toFixed(1) + ' scrap' },
  // SPECIALS tab: one card per special robot (10 levels): more of them, and stronger
  { id: 'bomb',   row: 'boom',   name: 'Boombot',         desc: 'More Boombots, bigger booms',                 base: 250, mul: 2.6, max: 10, fx: L => '+' + pct(0.12 * L) + ' Boombots, +' + kmh(PHYS.BOMB_PUSH * (1 + 0.08 * L)) + ' boom' },
  { id: 'flare',  row: 'boom',   name: 'Firework Bot',    desc: 'More Firework Bots, higher and faster',      base: 350, mul: 2.6, max: 10, fx: L => '+' + pct(0.12 * L) + ' Firework Bots, ' + Math.round(Math.pow(28 + 1.5 * L, 2) / 48) + ' m high' },
  { id: 'fan',    row: 'boom',   name: 'Fanbot',          desc: 'More Fanbots: each gives a slam',            base: 400, mul: 2.6, max: 10, fx: L => '+' + pct(0.12 * L) + ' Fanbots' },
  { id: 'goldbot',row: 'gold',   name: 'Goldbot',         desc: 'More Goldbots, more scrap in each',          base: 300, mul: 2.6, max: 10, fx: L => '+' + pct(0.15 * L) + ' Goldbots, x' + (1 + 0.3 * L).toFixed(1) + ' scrap' },
  { id: 'jet',    row: 'rides',  name: 'Jetbot',          desc: 'Jetbots show up: ride them! Hold to climb',  base: 400, mul: 2.6, max: 10, fx: L => L ? 'Jetbots x' + (1 + 0.25 * (L - 1)).toFixed(1) + ', ' + (1.8 + 0.2 * L).toFixed(1) + ' s ride' : 'no Jetbots yet' },
  { id: 'drone',  row: 'rides',  name: 'Copter',          desc: 'Copters show up: free lifts',                base: 500, mul: 2.6, max: 10, fx: L => L ? 'Copters x' + (1 + 0.25 * (L - 1)).toFixed(1) : 'no Copters yet' },
  { id: 'spring', row: 'rides',  name: 'Boingbot',        desc: 'Boingbots show up: huge bounces',            base: 600, mul: 2.6, max: 10, fx: L => L ? 'Boingbots x' + (1 + 0.25 * (L - 1)).toFixed(1) : 'no Boingbots yet' },
  { id: 'pogo',   row: 'tricks', name: 'Pogobot',         desc: 'Ride it: tap just before you land to punch',  base: 700, mul: 2.6, max: 10, fx: L => L ? 'Pogobots x' + (1 + 0.25 * (L - 1)).toFixed(1) + ', boom +' + kmh(PHYS.POGO_BOOM * (1 + 0.15 * L)) : 'no Pogobots yet' },
  { id: 'cannon', row: 'tricks', name: 'Cannonbot',       desc: 'Aim at the next cannon, then fire',          base: 900, mul: 2.6, max: 10, fx: L => L ? 'Cannonbots x' + (1 + 0.25 * (L - 1)).toFixed(1) + ', +' + kmh(PHYS.CANNON_BOOM * (1 + 0.15 * L)) + ' blast' : 'no Cannonbots yet' },
  { id: 'roll',   row: 'tricks', name: 'Rollbot',         desc: 'Become a junk ball and flatten the street',  base: 1100,mul: 2.6, max: 10, fx: L => L ? 'Rollbots x' + (1 + 0.25 * (L - 1)).toFixed(1) + ', ' + (PHYS.ROLL_S * (1 + 0.1 * L)).toFixed(1) + ' s roll' : 'no Rollbots yet' },
];
const UP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// Tutorial: each step is finished by doing it.
const TUT = { LAUNCH: 0, SLAM: 1, SHOP: 2, BUY: 3, AGAIN: 4, DONE: 5 };
// first-meet cards: the game pauses the first time each of these shows up
const MEET = {
  cop:    { title: 'Security Bot', text: 'Its claw grabs you and steals speed. SLAM it to smash through, or slam right after to break free!' },
  flare:  { title: 'Firework Bot', text: 'Hit it to rocket sky-high. Touch the clouds and you come down as a METEOR!' },
  fan:    { title: 'Fanbot', text: 'Your biggest fan! Smash it for an extra slam.' },
  jet:    { title: 'Jetbot', text: 'Ride it! Hold to fly up, let go to dive.' },
  drone:  { title: 'Copter', text: 'Grab it for a free lift and a push.' },
  spring: { title: 'Boingbot', text: 'Land on it for a huge bounce!' },
  bomb:   { title: 'Boombot', text: 'BOOM! A big push forward. Slam it if it is far below you.' },
  gold:   { title: 'Goldbot', text: 'Rare and full of scrap.' },
  pogo:   { title: 'Pogobot', text: 'Ride it! TAP to punch down: each punch bounces you higher. Three punches = BOOM!' },
  cannon: { title: 'Cannonbot', text: 'It loads you up! TAP to fire into the next cannon. The gold one blasts you away!' },
  roll:   { title: 'Rollbot', text: 'Turns you into a junk ball that flattens everything, then BURSTS for speed!' },
  claw:   { title: 'Security claw', text: 'A Security Bot grabbed you and stole speed! SLAM before it lets go to get it back.' },
  cone:   { title: 'Wet Floor', text: 'Slippery! Fly over it or lose speed.' },
  wall:   { title: 'A wall!', text: 'It is thick! Hit it FAST and plough all the way through in one launch.' },
};

const S = {
  phase: 'boot', t: 0, paused: false, audioOn: true, canSave: false, dirty: false, save: null,
  run: null, view: 'aim',             // aim | run | results (a card on top of the street)
  modal: null, queue: [], toast: null,
  saveTimer: 0, lastAdT: -1e9, sentBest: 0, seed: 1,
  hold: false, slow: 1, slowT: 0, meet: null,
  tutGate: null, tutT: 0, cheer: null, last: null,
  pull: null, shot: null,
};

// ---------- numbers ----------
function lvl(id) { return S.save.up[id] || 0; }
// prices: early levels cost EARLY_PRICE x (quick start), each level past LATE_FROM x max costs LATE_MUL x more (slow end)
function priceShape(L, max) { const from = Math.ceil(max * CFG.LATE_FROM); return (L < from ? CFG.EARLY_PRICE : 1) * Math.pow(CFG.LATE_MUL, Math.max(0, L - from)); }
function upCost(u) { const L = lvl(u.id); return Math.ceil(u.base * Math.pow(u.mul, L) * priceShape(L, u.max)); }
function wallsBroken() { let n = 0; for (const h of S.save.walls) if (h === 0) n++; return n; }
function rowOpen(r) { return S.save.runs >= r.runs && wallsBroken() >= r.wall; }
function rowOf(u) { return ROWS.find(r => r.id === u.row); }
function tabOf(u) { return rowOf(u).tab; }
function canBuy(u) { return rowOpen(rowOf(u)) && lvl(u.id) < u.max && upCost(u) <= S.save.scrap; }
function tabOpen(id) { return id === 'coach' ? S.save.runs >= 1 : ROWS.some(r => r.tab === id && rowOpen(r)); }
function runStats() {
  const L = (id) => lvl(id), sp = (id) => L(id) ? 1.0 + 0.25 * (L(id) - 1) : 0;
  return {
    v0: CFG.V0 * (1 + 0.12 * L('sling')),
    dmg: 1 + 0.3 * L('muscle'), critMul: CFG.CRIT_MUL + 0.05 * L('critpow'),
    vMax: CFG.VMAX0 + CFG.VMAX_STEP * L('topspeed'), softK: PHYS.SOFT_K * (1 - 0.06 * L('overdrive')),
    bounce: CFG.BOUNCE0 + CFG.BOUNCE_STEP * L('bounce'), botBounce: 1 + 0.02 * L('bounce'),
    keep: CFG.KEEP0 + CFG.KEEP_STEP * L('slick'),
    slamMax: CFG.SLAM0 + L('slam'), slamRefill: CFG.SLAM_REFILL0 - L('refill'), slamR: PHYS.SLAM_R * (1 + 0.12 * L('quake')),
    scrapMult: 1 + CFG.SCRAP_STEP * L('scrap'), distMult: 1 + 0.4 * L('distpay'),
    luck: 1 + 0.08 * L('luck'),
    wallMult: 1 + CFG.WALL_STEP * L('wall'),
    shieldKeep: 0.5 + 0.03 * L('fur'), coneKeep: 0.72,
    blast: L('blast'), blastM: 1.5 + 0.6 * L('blast'), blastV: 5 + 3 * L('blast'),
    meteorV: PHYS.METEOR_V + 3 * L('meteor'), meteorPay: 1 + 0.4 * L('meteor'),
    bombMul: 1 + 0.12 * L('bomb'), bombBoost: 1 + 0.08 * L('bomb'),
    flareMul: 1 + 0.12 * L('flare'), flareUp: 28 + 1.5 * L('flare'), flarePush: 1 + 0.15 * L('flare'),
    fanMul: 1 + 0.12 * L('fan'),
    goldMul: 1 + 0.15 * L('goldbot'), goldVal: 1 + 0.3 * L('goldbot'),
    jetS: 1.8 + 0.2 * L('jet'), jetV: PHYS.JET_V + 2 * L('jet'),
    droneMul: 1 + 0.1 * L('drone'), dronePush: 1 + 0.15 * L('drone'), springPush: 1 + 0.2 * L('spring'),
    pogoBoost: 1 + 0.15 * L('pogo'), cannonBoost: 1 + 0.15 * L('cannon'), rollMul: 1 + 0.1 * L('roll'), rollBoost: 1 + 0.1 * L('roll'),
    wind: L('wind'), windV: 12 + 3 * L('wind'),
    crowd: 1,
    spawn: Object.fromEntries(RIDES.map(k => [k, sp(k)])),
  };
}
// ---------- coaches ----------
function coachLvl(id) { return (S.save.coach && S.save.coach[id]) || 0; }
function coachOpen(c) { return S.save.runs >= c.runs && wallsBroken() >= c.wall; }
function coachCost(c) { const L = coachLvl(c.id); return L === 0 ? c.price : Math.ceil(Math.max(100, c.price * 0.6) * Math.pow(3.5, L - 1) * priceShape(L, c.max)); }
function canTrain(c) { return coachOpen(c) && !c.reward && coachLvl(c.id) < c.max && coachCost(c) <= S.save.scrap; }
function coachSpeed(c, L) { L = L || Math.max(1, coachLvl(c.id)); return c.speed * (1 + 0.05 * (L - 1)); }
function coachHpMax(c, L) { L = L || Math.max(1, coachLvl(c.id)); return Math.round(c.hp * (1 + 0.15 * (L - 1))); }
function coachKo(c, L) { L = L || Math.max(1, coachLvl(c.id)); return Math.round(c.ko * (1 + 0.6 * (L - 1))); }
function curCoach() { const c = COACH[S.save.coachCur]; return c && coachLvl(c.id) > 0 ? c : COACH.nana; }
function critWindow() { const r = S.save.runs; return CFG.CRIT_WIN * (r < CFG.CRIT_EASY.length ? CFG.CRIT_EASY[r] : 1); }
const COACH_X = 6.0, COACH_H = 3.7, TYRES_H = 0.9;   // where the coach stands (on a tyre stack), body height (m)
function hash01(i) { let a = (i * 2654435761) >>> 0; a ^= a >>> 15; a = Math.imul(a, 0x2c1b3c6d) >>> 0; a ^= a >>> 12; return (a >>> 0) / 4294967296; }
// Where the coach is at aim time t and what they're doing: x, feet height, body height h,
// up = the tell (hit now = CRIT), windup = about to tell, spark = electrified (hit now = a weak launch), any = any hit is a CRIT
function coachState(t, c) {
  c = c || curCoach();
  const win = critWindow(), s = { x: COACH_X, feet: TYRES_H, h: COACH_H, up: false, windup: false, spark: false, any: false, poof: 0, hop: 0 };
  if (c.twist === 'steady') {
    const per = 2.0, ph = t % per, u0 = per - win - 0.05;
    s.up = ph >= u0 && ph < u0 + win; s.windup = ph >= u0 - 0.3 && ph < u0;
  } else if (c.twist === 'random') {                 // random gaps between lifts (1.1 to 2.7 s)
    let t0 = 0;
    for (let i = 0; i < 2000; i++) {
      const gap = 1.1 + 1.6 * hash01(i + 7);
      if (t < t0 + gap + win) { const ph = t - t0; s.up = ph >= gap; s.windup = ph >= gap - 0.25 && ph < gap; break; }
      t0 += gap + win;
    }
  } else if (c.twist === 'hop') {                    // hops up off the tyres; the tell is the top of the hop
    const per = 2.3, hopT = 1.0, ph = t % per, k = (ph - (per - hopT)) / hopT;
    if (k > 0) { s.hop = Math.sin(Math.PI * k); s.feet = TYRES_H + 3.4 * s.hop; s.up = Math.abs(k - 0.5) < win / hopT / 2 + 0.03; }
    else s.windup = ph > per - hopT - 0.3;
  } else if (c.twist === 'teleport') {               // pops between three spots; tells just before he jumps again
    const per = 2.4, i = Math.floor(t / per), ph = t - i * per, spot = [0, -1.5, 1.4][i % 3];
    s.x = COACH_X + spot; s.feet = spot === 0 ? TYRES_H : 0;
    s.up = ph >= per - win - 0.15 && ph < per - 0.15; s.windup = ph >= per - win - 0.45 && ph < per - win - 0.15;
    s.poof = ph < 0.25 ? 1 - ph / 0.25 : 0;
  } else if (c.twist === 'shock') {                  // sparks for a while (don't hit!), then lifts the pad
    const per = 2.8, ph = t % per, u0 = 1.85;
    s.spark = ph >= 0.8 && ph < 1.65; s.up = ph >= u0 && ph < u0 + win; s.windup = ph >= u0 - 0.2 && ph < u0;
  } else if (c.twist === 'fly') {                    // small, flies about and pauses; any hit is a CRIT
    s.h = COACH_H * 0.55; s.any = true; s.up = true;
    const w = t - 0.6 * Math.sin(t * 0.7);           // erratic: speeds up and stalls
    s.x = COACH_X + 0.9 * Math.sin(w * 1.3) + 0.4 * Math.sin(w * 3.7);
    s.feet = 1.4 + 1.8 * (0.5 + 0.5 * Math.sin(w * 0.9 + 1)) + 0.5 * Math.sin(w * 2.9);
  }
  return s;
}
// what flying into the coach at height y does: 'miss', 'shock', 'hit' or 'crit'
function shotResult(s, y) {
  if (y < s.feet - 0.55 || y > s.feet + s.h + 0.55) return 'miss';
  if (s.spark) return 'shock';
  return s.up || s.any ? 'crit' : 'hit';
}
function buyCoach(c) {
  if (!coachOpen(c) || c.reward || coachLvl(c.id) >= c.max) return false;
  const cost = coachCost(c);
  if (S.save.scrap < cost) { SFX.nope(); return false; }
  const first = coachLvl(c.id) === 0;
  S.save.scrap -= cost; S.save.coach[c.id] = coachLvl(c.id) + 1; S.dirty = true;
  S.save.coachHp[c.id] = coachHpMax(c);
  if (first) S.save.coachCur = c.id;                 // a new coach steps up straight away
  SFX.upgrade(); toast(c.name + (first ? ' joined the team!' : ' is now level ' + coachLvl(c.id) + '!'), 1.8); FX.bump = 0.3;
  saveNow();
  return true;
}
// walls are whole at the start of every launch; only "broken for good" (0) is saved
function standingWalls() { return WALLS.map((w, i) => ({ x: w.x, len: w.len, need: w.need, name: w.name, i, hp: 1, fresh: S.save.walls[i] !== 0 })); }   // v0.6: every wall, every launch (fresh = never broken yet)
function zoneUnlocked() { let z = 0; for (let i = 0; i < WALLS.length; i++) if (S.save.walls[i] === 0) z = i + 1; return z; }
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  const u = ['K', 'M', 'B', 'T', 'Qa'];
  let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1') + u[i];
}

// ---------- saves ----------
function freshSave() {
  return { v: CFG.SAVE_VERSION, scrap: 0, up: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), walls: WALLS.map(w => w.hp), wallBest: WALLS.map(() => 0),
           best: 0, runs: 0, perfects: 0, smashed: 0, tut: 0, seen: '', met: 'launch,slam', music: 1, playS: 0, ended: 0, lastSeen: Date.now(),
           coach: Object.fromEntries(COACHES.map(c => [c.id, c.id === 'nana' ? 1 : 0])), coachHp: { nana: COACH.nana.hp }, coachCur: 'nana', kos: 0 };
}
function migrate(raw) {
  let s = null;
  try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
  const out = freshSave();
  if (!s || typeof s !== 'object') return out;
  const num = (x, hi) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.min(x, hi) : 0);
  out.scrap = num(s.scrap, 1e15); out.best = num(s.best, 1e7); out.runs = Math.floor(num(s.runs, 1e7));
  out.perfects = Math.floor(num(s.perfects, 1e7)); out.smashed = Math.floor(num(s.smashed, 1e9)); out.playS = num(s.playS, 1e9);
  out.tut = Math.min(Math.floor(num(s.tut, TUT.DONE)), TUT.DONE);
  out.music = s.music === 0 ? 0 : 1; out.ended = s.ended ? 1 : 0;
  out.seen = typeof s.seen === 'string' ? s.seen.slice(0, 200) : '';
  const OLD_ROW = { nana: 'launch', stinky: 'slam', pidge: 'scrap', nutz: 'hacks', mo: 'demo', hoot: 'flight' };   // v0.2 saved coaches, v0.3 saves rows
  out.met = typeof s.met === 'string' ? s.met.slice(0, 200).split(',').map(k => OLD_ROW[k] || k).join(',') : 'launch,slam';
  out.lastSeen = num(s.lastSeen, 1e15) || Date.now();
  const refund = (base, mul, from, to) => { for (let k = from; k < to; k++) out.scrap += Math.ceil(base * Math.pow(mul, k)); };
  const old = (typeof s.v === 'number' ? s.v : 1) < 4;                   // a save from v0.3 or older
  if (s.up && typeof s.up === 'object') {
    if (s.up.gold && !s.up.luck) s.up.luck = s.up.gold;                 // v0.2 Lucky Gold became Lucky Charm
    for (const u of UPGRADES) out.up[u.id] = Math.min(Math.floor(num(s.up[u.id], u.max)), u.max);
    if (old) {
      // upgrades that are gone get refunded at the price that was paid: Jet Fuel, Glide Wings (v0.2),
      // Crit Timing and Smash Power (v0.3)
      const GONE = { fuel: [110, 2], glide: [4000, 2], perfect: [30, 2.1], smash: [18, 1.85] };
      for (const id in GONE) refund(GONE[id][0], GONE[id][1], 0, Math.min(Math.floor(num(s.up[id], 12)), 12));
      // v0.3 levels above the new maximum (8 for upgrades, 7 for specials): refunded too
      const OLDP = { sling: [10, 1.85], topspeed: [25, 1.9], bounce: [14, 1.85], scrap: [45, 1.9], wall: [120, 1.9], jet: [200, 1.9], drone: [250, 1.9], spring: [400, 1.9] };
      for (const id in OLDP) refund(OLDP[id][0], OLDP[id][1], UP[id].max, Math.min(Math.floor(num(s.up[id], 12)), 12));
    }
  }
  // coaches: levels 0..max (Nana is always on the team), stamina left, who steps up next
  if (s.coach && typeof s.coach === 'object') for (const c of COACHES) {
    const n = Math.min(Math.floor(num(s.coach[c.id], 8)), old ? 5 : 8);   // v0.3 coaches went up to level 5
    out.coach[c.id] = Math.min(n, c.max);
    const OLD_PRICE = { nana: 0, stinky: 60, pidge: 500, nutz: 2000, mo: 3000, hoot: 12000 }, ob = Math.max(40, OLD_PRICE[c.id] * 0.8);
    if (old && c.id === "hoot" && n > 0) { refund(12000, 1, 0, 1); refund(ob, 2.3, 0, n - 1); }   // v0.3 sold Dr. Hoot; now he is a reward
    else if (old && n > c.max) refund(ob, 2.3, c.max - 1, n - 1);                              // v0.3 training above the new max
  }
  out.coach.nana = Math.max(1, out.coach.nana);
  for (const c of COACHES) if (out.coach[c.id] > 0) {
    const hpMax = coachHpMax(c, out.coach[c.id]), v = s.coachHp && s.coachHp[c.id];
    out.coachHp[c.id] = !old && typeof v === 'number' && v > 0 && v <= hpMax ? Math.ceil(v) : hpMax;
  }
  out.coachCur = typeof s.coachCur === 'string' && out.coach[s.coachCur] > 0 ? s.coachCur : 'nana';
  out.kos = Math.floor(num(s.kos, 1e7));
  out.seen = out.seen.replace(/\bbin\b/, 'cop');                        // the Bin Guard became the Security Bot
  // walls: 0 = broken at least once (every wall is back each launch since v0.6). Older layouts had walls elsewhere:
  // the farthest one they broke counts for every new wall up to that distance.
  const ver = typeof s.v === "number" ? s.v : 1;
  const OLD_X = ver >= 6 ? WALLS.map(w => w.x) : ver === 5 ? [300, 1000, 2000, 3200, 4800] : [300, 1000, 2000];
  if (Array.isArray(s.walls)) {
    let far = -1;
    for (let i = 0; i < OLD_X.length; i++) { if (s.walls[i] === 0) far = OLD_X[i]; else break; }   // only an unbroken run of walls counts
    for (let i = 0; i < WALLS.length; i++) out.walls[i] = WALLS[i].x <= far ? 0 : WALLS[i].hp;
  }
  if (ver >= 6 && Array.isArray(s.wallBest)) for (let i = 0; i < WALLS.length; i++) out.wallBest[i] = Math.min(1, num(s.wallBest[i], 1));
  for (let i = 0; i < WALLS.length; i++) if (out.walls[i] === 0) out.wallBest[i] = 1;
  if (out.walls[WALLS.length - 1] !== 0) out.ended = 0;          // new walls after the old final one: not finished yet
  for (const c of COACHES) if (c.reward && out.walls[c.wall - 1] === 0) { out.coach[c.id] = 1; out.coachHp[c.id] = coachHpMax(c, 1); }
  out.v = CFG.SAVE_VERSION;
  return out;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function loadSave() {
  if (!yt) { try { return localStorage.getItem(CFG.SAVE_KEY) || ''; } catch (e) { return ''; } }   // web demo / dev only
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const d = await withTimeout(yt.game.loadData(), 2000); S.canSave = true; return d; }       // 2 x 2 s keeps boot under 5 s
    catch (e) { try { yt.health.logWarning(); } catch (e2) {} await new Promise(r => setTimeout(r, 300)); }
  }
  try { yt.health.logError(); } catch (e) {}       // play on, but never save over a cloud save we couldn't read
  return '';
}
function saveNow(force) {
  if (!S.save || (!S.dirty && !force)) return;
  S.save.lastSeen = Date.now();
  const data = JSON.stringify(S.save);
  S.dirty = false;
  if (!yt) { try { localStorage.setItem(CFG.SAVE_KEY, data); } catch (e) {} return; }
  if (!S.canSave) return;
  yt.game.saveData(data).catch(() => { S.dirty = true; try { yt.health.logWarning(); } catch (e) {} });
}
function sendBest() {
  const b = Math.floor(S.save.best);
  if (!yt || b <= S.sentBest) return;
  S.sentBest = b;
  yt.engagement.sendScore({ value: b }).catch(() => {});   // one integer: best distance in metres
}
// Restart this launch (owner 2026-11-08: "restart run button only for the specific run not the whole game"): back to
// the slingshot, this launch.s scrap is lost, everything else stays. At the slingshot the same button starts the WHOLE
// game over (owner 2026-11-08: "the intended action of restarting the whole game while in slingshot mode"), after a
// confirm card that says it wipes everything. Shown on YouTube too.
function canRestart() { return S.phase === "play" && !!S.run && ((S.view === "run" && (S.run.phase === "fly" || S.run.phase === "end")) || (S.view === "aim" && !S.shot)); }
function restartLaunch() { S.modal = null; S.queue = []; S.slow = 1; S.hold = false; S.pull = null; newAim(); toast("Back to the slingshot!", 1.4); }
function restartPressed(whole) { if (whole) resetGame(); else restartLaunch(); }   // the confirm card.s RESTART / START OVER
// start the whole game over: a fresh save (scrap, upgrades, coaches, walls, tutorial), saved at once
function resetGame() {
  S.save = freshSave(); S.dirty = true; saveNow(true);
  S.modal = null; S.queue = []; S.cheer = null; S.meet = null; S.slow = 1; S.hold = false; S.pull = null; S.shot = null; S.last = null;
  UI.tab = "up"; UI.sel = "sling"; UI.coachSel = "nana";
  newAim(); toast("New game! Everything starts over.", 2);
}

// ---------- runs ----------
function rowShown(id) { return S.save.met.split(',').includes(id); }          // shop rows already announced
function showRow(id) { if (!rowShown(id)) { S.save.met = S.save.met ? S.save.met + ',' + id : id; S.dirty = true; } }
function seen(k) { return S.save.seen.split(',').includes(k); }
function markSeen(k) { if (!seen(k)) { S.save.seen = S.save.seen ? S.save.seen + ',' + k : k; S.dirty = true; } }
function newAim() {
  S.seed = (S.seed * 1103515245 + 12345 + Date.now()) >>> 0;
  S.run = newRun(runStats(), standingWalls(), S.seed);
  S.view = 'aim'; S.aimT = 0; S.last = null; S.slow = 1; S.coachHit = null;
  resetCamera();
}
// Where you hit decides it: during the coach's tell = CRIT (faster, higher, double damage), otherwise a HIT;
// sail past them = a weak MISS launch; hit Big Mo while he sparks = a very weak launch. Stamina 0 = KO: a big
// scrap bonus, then a random coach from your team steps up for the next launch.
function hitCoach(R, kind, aim) {
  const c = curCoach(), sv = S.save, P = PHYS;
  const hit = { id: c.id, kind, crit: kind === 'crit', ko: false, bonus: 0, dmg: 0, t0: S.t };
  let mul = coachSpeed(c), angle = P.ANGLE_HIT;
  if (kind === 'miss') { mul = CFG.MISS_MUL; angle = Math.max(0.2, Math.min(1.1, aim || P.ANGLE_HIT)); }
  else if (kind === 'shock') { mul *= CFG.SHOCK_MUL; angle = 0.45; }
  else {
    if (kind === 'crit') { mul *= R.st.critMul; angle = P.ANGLE_CRIT; }
    hit.dmg = Math.round((kind === 'crit' ? CFG.CRIT_DMG : CFG.HIT_DMG) * R.st.dmg);
    sv.coachHp[c.id] = Math.max(0, (sv.coachHp[c.id] || coachHpMax(c)) - hit.dmg);
    hit.ko = sv.coachHp[c.id] <= 0;
  }
  if (hit.ko) {
    hit.bonus = coachKo(c); R.scrap += hit.bonus; R.koBonus = hit.bonus; sv.kos++;
    const team = COACHES.filter(o => coachLvl(o.id) > 0 && o.id !== c.id);
    const next = team.length ? team[Math.floor(Math.random() * team.length)] : c;
    sv.coachCur = next.id; sv.coachHp[next.id] = coachHpMax(next);
  }
  S.coachHit = hit;
  return { mul, angle };
}
// the slingshot's pouch: rest spot, and where the hero sits when pulled back by q (0..1) to aim at angle a
const POUCH = { x: 0, y: 3.0, pull: 2.2 };
function aimPull() { return S.pull ? S.pull.q : 0.55 + 0.06 * Math.sin(S.aimT * 4); }
function aimAngle() { return S.pull ? S.pull.a : autoAim(); }
function heroAimPos(q, a) { return { x: POUCH.x - q * POUCH.pull * Math.cos(a) + 0.1, y: POUCH.y - q * POUCH.pull * Math.sin(a) + 0.6 }; }
// tap / keyboard launch: aim at the middle of the coach where they are now
function autoAim() {
  const s = coachState(S.aimT), p = heroAimPos(0.85, 0.2);
  return Math.atan2(s.feet + s.h * 0.55 - p.y, s.x - p.x);
}
function fireShot(a) {
  if (S.view !== 'aim' || S.modal || S.shot) return;
  const q = S.pull ? Math.max(0.5, S.pull.q) : 0.85, p = heroAimPos(q, a);
  S.pull = null;
  S.shot = { t: 0, x: p.x, y: p.y, x0: p.x, y0: p.y, a };
  SFX.launch(false);
}
function doLaunch() { fireShot(autoAim()); }
// the hero flies from the slingshot into the coach (called every frame while S.shot is set)
function stepShot(dt) {
  const sh = S.shot; sh.t += dt;
  sh.x = sh.x0 + Math.cos(sh.a) * CFG.SHOT_V * sh.t; sh.y = sh.y0 + Math.sin(sh.a) * CFG.SHOT_V * sh.t;
  const s = coachState(S.aimT);
  if (sh.x < s.x - 0.55 && sh.t < 0.8 && sh.y > -0.5) return;
  launchFrom(shotResult(s, sh.y), sh.x, sh.y, sh.a);
}
function launchFrom(kind, x, y, a) {
  const pos = coachState(S.aimT);                    // where the coach was when you hit them (before a KO swaps coaches)
  const res = hitCoach(S.run, kind, a);
  S.coachHit.pos = pos;
  launchRun(S.run, kind === 'crit', res.mul, res.angle, x, Math.max(PHYS.HR + 0.3, y));
  S.shot = null; S.view = 'run'; S.save.runs++; S.dirty = true;
  if (kind === 'crit') S.save.perfects++;
  if (S.save.tut === TUT.LAUNCH) tutNext(TUT.LAUNCH);
}
function trySlam() {
  if (S.view !== 'run' || !S.run || S.run.phase !== 'fly') return false;
  if (S.tutGate && !S.tutGate.what.includes('slam')) return false;
  const ok = requestSlam(S.run);
  if (ok && S.save.tut === TUT.SLAM) { S.slow = 1; tutNext(TUT.SLAM); }
  return ok;
}
// will a slam from here land on a robot? (used by the tutorial and the pacing bot)
function slamTarget(R) {
  if (R.phase !== 'fly' || R.ride || R.slamming || R.slams <= 0 || R.vy > 2 || R.y < 3) return null;
  const tt = (R.y - PHYS.HR) / PHYS.SLAM_V, lx = R.x + R.vx * tt;
  for (const b of R.bots) if (b.alive && !BOTS[b.type].hazard && !BOTS[b.type].air && Math.abs(b.x + b.dir * (b.sp || 0) * tt - lx) < b.r + 0.35) return b;
  return null;
}
function finishRun() {
  const R = S.run, sv = S.save;
  const dist = Math.max(0, R.x), mult = runStats().distMult;
  const distScrap = Math.floor(distanceScrap(dist, mult));
  const koBonus = Math.floor(R.koBonus || 0), wallScrap0 = Math.floor(R.wallScrap || 0), robotScrap = Math.floor(R.scrap) - koBonus - wallScrap0;
  const record = dist > sv.best + 0.5;
  const prevBest = sv.best;
  if (record) sv.best = dist;
  sv.smashed += R.smashed;
  S.firstBreaks = [];
  for (const name of R.broke) { const i = WALLS.findIndex(w => w.name === name); if (i >= 0) { if (sv.walls[i] !== 0) S.firstBreaks.push(i); sv.walls[i] = 0; sv.wallBest[i] = 1; } }
  for (const c of COACHES) if (c.reward && !coachLvl(c.id) && wallsBroken() >= c.wall) { sv.coach[c.id] = 1; sv.coachHp[c.id] = coachHpMax(c); }   // Dr. Hoot joins after the Blast Door
  if (R.wallHit) { const i = WALLS.findIndex(w => w.name === R.wallHit.name); if (i >= 0) sv.wallBest[i] = Math.max(sv.wallBest[i], Math.round(R.wallHit.frac * 100) / 100); }
  const wallScrap = wallScrap0;
  const total = robotScrap + distScrap + koBonus + wallScrap;
  sv.scrap += total; S.dirty = true;
  S.last = { dist, record: record && prevBest > 0, robotScrap, distScrap, koBonus, ko: S.coachHit && S.coachHit.ko ? S.coachHit.id : null, total, smashed: R.smashed, combo: R.bestCombo, slamHits: R.slamHits,
             wall: R.wallHit ? { name: R.wallHit.name, frac: R.wallHit.frac, depth: R.wallHit.depth, len: R.wallHit.len } : null,
             broke: R.broke.slice(), wallScrap, doubled: false, perfect: R.perfect };
  S.view = 'results';
  for (const i of S.firstBreaks || []) {            // celebrate walls broken for the first time, then the results
    if (i === WALLS.length - 1) { if (!sv.ended) { sv.ended = 1; openModal({ type: "ending" }); } }
    else openModal({ type: "zone", z: i + 1 });
  }
  for (const r of ROWS) if (rowOpen(r) && !rowShown(r.id)) { showRow(r.id); if (r.runs || r.wall) openModal({ type: 'row', id: r.id }); }
  openModal({ type: 'results' });
  if (record) SFX.record();
  saveNow(true); sendBest();
}

// ---------- shop ----------
function buyUpgrade(u) {
  if (lvl(u.id) >= u.max) return false;
  const c = upCost(u);
  if (S.save.scrap < c) { SFX.nope(); return false; }
  S.save.scrap -= c; S.save.up[u.id]++; S.dirty = true;
  SFX.upgrade(); onBought(u);
  if (S.save.tut === TUT.BUY) tutNext(TUT.BUY);
  saveNow();
  return true;
}

// ---------- tutorial ----------
const CHEERS = ['Nice!', 'Great!', 'Awesome!', 'Wicked!'];
function tutNext(from) {
  if (S.save.tut !== from) return;
  S.save.tut++; S.dirty = true;
  S.cheer = { text: S.save.tut >= TUT.DONE ? 'You got this! Smash to the end!' : CHEERS[from % CHEERS.length], t0: S.t, big: S.save.tut >= TUT.DONE };
  SFX.cheer(S.save.tut >= TUT.DONE);
  if (S.save.tut === TUT.BUY) {                       // make sure the first upgrade can be bought
    const need = upCost(UP.sling) - S.save.scrap;
    if (need > 0) { S.save.scrap += need; S.tutGift = need; }
  }
  saveNow();
}

// ---------- ads (YouTube only, all optional) ----------
function doubleReady() { return !!yt && S.save.tut >= TUT.DONE && S.save.runs >= CFG.DOUBLE_FROM_RUN && S.last && !S.last.doubled && S.last.total > 0; }
async function watchDouble() {
  if (!doubleReady() || S.adBusy) return;
  S.adBusy = true;
  let ok = false;
  try { ok = await yt.ads.requestRewardedAd('double_scrap'); } catch (e) { ok = false; }
  S.adBusy = false;
  if (ok && S.last && !S.last.doubled) { S.last.doubled = true; S.save.scrap += S.last.total; S.dirty = true; SFX.record(); saveNow(); }
  else toast('No video right now. Try again later.');
}
function naturalBreak() {
  // interstitials only between two screens (results -> next launch), never in the first runs, at most every 150 s
  if (!yt || S.save.tut < TUT.DONE || S.save.runs < CFG.ADS_FROM_RUN || S.t - S.lastAdT < CFG.AD_GAP_S) return;
  S.lastAdT = S.t;
  yt.ads.requestInterstitialAd().catch(() => {});
}

// ---------- cards ----------
function openModal(m) {
  if (S.modal) { S.queue.push(m); return; }
  S.modal = m; m.t0 = S.t;
  if (m.type === 'shop' && S.save.tut === TUT.SHOP) tutNext(TUT.SHOP);
}
function closeModal() {
  const m = S.modal; S.modal = null;
  if (m && m.type === 'meet') S.meet = null;
  if (S.queue.length) { openModal(S.queue.shift()); return; }
  if (!m) return;
  if (m.type === 'shop' && S.view === 'results') { openModal({ type: 'results' }); return; }   // back to the run's results
  if (m.type === 'results') launchAgain();                                                      // Esc on results = go again
}
function launchAgain() {                            // from the results card
  S.modal = null; S.queue = [];
  if (S.save.tut === TUT.AGAIN) tutNext(TUT.AGAIN);
  naturalBreak();
  newAim();
}
function toast(text, secs) { S.toast = { text, until: S.t + (secs || 2.2) }; }

// ---------- pause / resume: only from the SDK ----------
function pause() {
  if (S.paused) return;
  S.paused = true; S.hold = false;
  stopLoop();
  SFX.setAllowed(false);
  saveNow(true);                                    // resume is not guaranteed
  draw();
}
function resume() {
  if (!S.paused) return;
  S.paused = false;
  SFX.setAllowed(S.audioOn);
  if (S.phase === 'play') startLoop();
}
