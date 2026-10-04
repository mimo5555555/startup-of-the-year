#!/usr/bin/env node
// Reference pace model for docs/GAME_DESIGN.md section 4.6 (v2, after adversarial review).
// Plain JS, no dependencies: `node docs/economy-ref-sim.mjs` prints the tables quoted in section 4.6.
// Agent 1F ports this to packages/game/test/sim.test.ts (driving the real reducer) and asserts the CI windows.
// It is a MODEL of personas, not of players: the numbers are design targets, not predictions.

export const BALANCE = {
  base: { A1: 1500, A2: 2200 },
  indepBonusPer: 30, distinctMax: 8,
  dayFactor: [1, 0.35, 0.1, 0],            // n = paid completions of THIS scenario today (gapFactor was removed)
  prepF: 1.1,
  stars: { 1: 200, 2: 400, 3: 600 },
  firstPhrase: { pay: 20, cap: 120 },
  echo: { pay: 20, perConv: 2, cap: 100 },
  softCap: 14000, softCapFactor: 0.25,
  goals: { each: 100, all: 150, streakPer: 15, streakMax: 150 },
  shift: { hours: 0.75, rankMult: [1, 1.08, 1.16, 1.24, 1.32], wage: { konbini: 1150, cafe: 1200, station: 1400 }, repeat: [1, 0.6, 0] },
  ap: { talk: 12, chat: 4, met: 20, thresholds: [30, 80, 150, 240, 350] },
};
const F = (r) => 0.25 + 0.75 * r * r;
const round5 = (x) => Math.round(x / 5) * 5;
const round10 = (x) => Math.round(x / 10) * 10;

// Chapters: sessions = number of objective conversations (Prepare + conversation + debrief), minDays, reward, and the non-session requirements.
export const CH = [
  { n: 1, minDays: 1, reward: 2500, sessions: 3 },
  { n: 2, minDays: 2, reward: 2500, sessions: 2, shifts: 1 },
  { n: 3, minDays: 4, reward: 3000, sessions: 2, friends2: 2 },
  { n: 4, minDays: 7, reward: 4000, sessions: 1, phone: true, chats: 4 },
  { n: 5, minDays: 10, reward: 5000, sessions: 3, shifts: 2 },
  { n: 6, minDays: 14, reward: 6000, sessions: 2, heart4: true, shiftsTotal: 5 },
  { n: 7, minDays: 19, reward: 8000, sessions: 3, friends2: 4 },
  { n: 8, minDays: 25, reward: 10000, sessions: 4 },
];
// An item is purchasable when chapter.n >= gate (chapter.n = 9 is Free Walk, i.e. Ch8 completed).
export const ITEMS = {
  phone: { price: 24800, gate: 4 }, bike: { price: 19800 + 600, gate: 5 }, helmet: { price: 2980, gate: 5 },
  room: { price: 60000, gate: 6 }, plant: { price: 1200, gate: 5 }, lamp: { price: 2000, gate: 6 }, cooker: { price: 3500, gate: 6 },
  car: { price: 198000, gate: 9 },
};
export const DREAMS = {
  Phone: ['phone'],
  'Phone + bike + helmet': ['phone', 'bike', 'helmet'],
  'fresh_start (phone, bike, room, 3 goods)': ['phone', 'bike', 'room', 'plant', 'lamp', 'cooker'],
  'Phone + kei car': ['phone', 'car'],
};

// min = minutes per active day; skip = days per week not played; talks = friend talks per day; shifts = shift cap per day
export const PERSONAS = {
  casual:      { min: 15, first: 30, skip: 0, shifts: 1, talks: 1, prep: 0.8, echo: 1, p0: 0.15, pMax: 0.87 },
  light:       { min: 10, first: 15, skip: 2, shifts: 1, talks: 1, prep: 0.5, echo: 0.5, p0: 0.15, pMax: 0.87 },
  serious:     { min: 30, first: 40, skip: 0, shifts: 1, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87 },
  grinder:     { min: 90, first: 90, skip: 0, shifts: 2, talks: 3, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87 },
  tapleaning:  { min: 15, first: 30, skip: 0, shifts: 1, talks: 1, prep: 0.8, echo: 0, p0: 0.10, pMax: 0.40, sessionMul: 1.3 },
  // adversarial personas for the CI ratios (same minutes as `serious`)
  // 60 min/day personas; after Chapter 8 they play like this for the rest of the run (steady state, days 31-60 are compared)
  diversified: { min: 60, first: 60, skip: 0, shifts: 1, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87, post: 'div' },
  repeater:    { min: 60, first: 60, skip: 0, shifts: 1, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87, post: 'repeat' },
  shiftonly:   { min: 60, first: 60, skip: 0, shifts: 2, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87, post: 'shift' },
};

export function simulate(persona, days = 120, seed = 1) {
  const P = PERSONAS[persona];
  let st = seed >>> 0;
  const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const S = { ch: 1, cash: 3000, minutes: 0, act: 0, active: 0, shifts: 0, ap: [0, 0, 0, 0, 0], chats: {}, phoneDay: null, owned: new Set(), done: new Set(), stars: {}, streak: 0,
    chDay: [], comp: { conv: 0, mastery: 0, shift: 0, goals: 0, chapter: 0 }, income: [], conv: 0, lang3160: 0, lastComplete: -1 };
  const queues = Object.fromEntries(Object.keys(DREAMS).map((k) => [k, { cash: 3000, idx: 0, done: null }]));
  const pAt = (m) => Math.min(P.pMax, P.p0 + 0.72 * (1 - Math.exp(-m / 300)));
  const heart = (ap) => BALANCE.ap.thresholds.filter((t) => ap >= t).length;
  const gap = [30, 50, 70, 90, 110];

  for (let d = 1; d <= days; d++) {
    let income = 0, spent = 0, langToday = 0, fpToday = 0, echoToday = 0, shiftsToday = 0, talksToday = 0;
    const plays = {}; const chatToday = new Set();
    const add = (a, kind) => { S.cash += a; income += a; if (d <= 30) S.comp[kind] += a; };
    const lang = (a, kind) => { const v = langToday > BALANCE.softCap ? a * BALANCE.softCapFactor : a; langToday += a; add(v, kind); if (d >= 31 && d <= 60) S.lang3160 += v; };
    const spend = (a) => { S.cash -= a; spent += a; };
    let minutes = d === 1 ? P.first : P.min;
    if (P.skip && (d % 7 === 0 || (P.skip > 1 && d % 7 === 3))) minutes = 0;
    if (minutes > 0) { S.active++; S.streak++; } else S.streak = 0;
    let budget = Math.max(0, minutes - 2); // 2 min of review
    S.minutes += minutes;

    const need = () => CH[Math.min(S.ch, 8) - 1];
    const heartsNeeded = () => { const c = need(); if (S.ch > 8) return false; return (c.friends2 && S.ap.filter((a) => a >= 80).length < c.friends2) || (c.heart4 && !S.ap.some((a) => a >= 240)); };
    const chatsOk = () => Object.keys(S.chats).length >= 2 && Object.values(S.chats).reduce((a, b) => a + b, 0) >= 4;
    const complete = () => {
      if (S.ch > 8 || S.lastComplete === d) return;
      const c = need();
      if (S.act < Math.ceil(c.sessions * (P.sessionMul || 1))) return;
      if (S.active < c.minDays) return;
      if (c.shifts && S.shifts < c.shifts) return;
      if (c.shiftsTotal && S.shifts < c.shiftsTotal) return;
      if (heartsNeeded()) return;
      if (c.phone && !S.owned.has('phone')) return;
      if (c.chats && !chatsOk()) return;
      add(c.reward, 'chapter'); S.chDay.push(d); S.ch++; S.act = 0; S.lastComplete = d;
    };
    const buyPhone = () => { if (!S.owned.has('phone') && S.ch >= 4 && S.cash >= ITEMS.phone.price) { S.cash -= ITEMS.phone.price; S.owned.add('phone'); S.phoneDay = d; } };

    const conv = (objective) => {
      const p = pAt(S.minutes), r = p + 0.35 * (1 - p), band = S.ch >= 4 ? 'A2' : 'A1';
      const id = objective ? `o${S.ch}_${S.act}` : (P.post === 'repeat' && S.ch > 8) ? 'rep' : `f${(S.conv = (S.conv + 1)) % (4 + 3 * Math.min(S.ch, 8))}`;
      const n = plays[id] || 0; plays[id] = n + 1;
      const fresh = !S.done.has(id); S.done.add(id);
      const distinct = Math.min(BALANCE.distinctMax, Math.round(8 * p));
      const prepared = rnd() < P.prep;
      lang(round5((BALANCE.base[band] * F(r) + BALANCE.indepBonusPer * distinct) * 0.95 * BALANCE.dayFactor[Math.min(n, 3)] * (prepared ? BALANCE.prepF : 1)), 'conv');
      const have = S.stars[id] || 0, want = r >= 0.8 && p >= 0.75 ? 3 : r >= 0.6 ? 2 : 1;
      let sp = 0; for (let s = have + 1; s <= want; s++) sp += BALANCE.stars[s];
      S.stars[id] = Math.max(have, want); if (sp) lang(sp, 'mastery');
      if (fresh) { const fp = Math.min(BALANCE.firstPhrase.cap - fpToday, BALANCE.firstPhrase.pay * Math.round(5 * p)); if (fp > 0) { fpToday += fp; lang(fp, 'mastery'); } }
      if (P.echo && echoToday < BALANCE.echo.cap) { const e = Math.min(BALANCE.echo.cap - echoToday, BALANCE.echo.pay * BALANCE.echo.perConv * P.echo); echoToday += e; lang(e, 'mastery'); }
      if (rnd() < 0.5) spend(450); // practice spending
      if (objective) S.act++;
    };
    const shift = () => {
      const p = pAt(S.minutes), job = S.ch >= 5 && S.shifts % 3 === 2 ? 'station' : S.ch >= 3 && S.shifts % 2 === 1 ? 'cafe' : 'konbini';
      const rank = S.shifts >= 15 ? 4 : S.shifts >= 10 ? 3 : S.shifts >= 6 ? 2 : S.shifts >= 3 ? 1 : 0;
      const ticks = 0.7 + 0.3 * p, rr = p + (1 - p) * 0.4, perf = Math.min(1, ticks * F(rr));
      lang(round10(BALANCE.shift.wage[job] * BALANCE.shift.hours * BALANCE.shift.rankMult[rank] * perf * BALANCE.shift.repeat[Math.min(shiftsToday, 2)]), 'shift');
      shiftsToday++; if (ticks >= 0.6) S.shifts++;
    };
    const talk = () => {
      const f = [0, 1, 2, 3, 4].find((i) => S.ap[i] < 80) ?? (S.ap[0] < 240 ? 0 : 1);
      const first = S.ap[f] === 0 ? BALANCE.ap.met : 0;
      const g = S.cash > 600 ? Math.min(30, Math.round(0.4 * gap[Math.min(4, heart(S.ap[f]))])) : 0;
      if (g) spend(300);
      S.ap[f] += BALANCE.ap.talk + first + g; talksToday++;
    };
    const chat = () => {
      const el = S.ap.map((a, i) => (a >= 80 && !chatToday.has(i) ? i : -1)).filter((i) => i >= 0);
      if (!el.length) return false;
      const i = el[0]; chatToday.add(i); S.chats[i] = (S.chats[i] || 0) + 1; S.ap[i] += BALANCE.ap.chat; return true;
    };

    complete();
    let guard = 0;
    const talkCap = persona === 'light' ? (rnd() < 0.5 ? 1 : 0) : P.talks;
    while (budget >= 1.5 && guard++ < 60) {
      buyPhone(); complete();
      const c = need(), objLeft = S.ch <= 8 && S.act < Math.ceil(c.sessions * (P.sessionMul || 1));
      const convCost = S.ch >= 4 ? 8 : 6;
      const wantShift = S.ch >= 2 && shiftsToday < P.shifts;
      const canTalk = S.ch >= 3 && talksToday < talkCap && budget >= 3;
      const canChat = S.owned.has('phone') && budget >= 1.5 && S.ap.some((a, i) => a >= 80 && !chatToday.has(i));
      const order = heartsNeeded() ? ['talk', 'chat', 'obj', 'shift', 'free'] : S.ch > 8 ? ['free', 'talk', 'chat', 'shift'] : ['obj', 'chat', 'talk', 'shift', 'free'];
      let did = false;
      for (const t of order) {
        if (t === 'talk' && canTalk) { talk(); budget -= 3; did = true; }
        else if (t === 'chat' && canChat && chat()) { budget -= 1.5; did = true; }
        else if (t === 'obj' && objLeft && budget >= convCost) { conv(true); budget -= convCost; did = true; }
        else if (t === 'shift' && wantShift && budget >= 4) { shift(); budget -= 4; did = true; }
        else if (t === 'free' && !(P.post === 'shift' && S.ch > 8) && budget >= convCost) { conv(false); budget -= convCost; did = true; }
        if (did) break;
      }
      if (!did) break;
    }
        if (minutes > 0) add((BALANCE.goals.each * 3 + BALANCE.goals.all) + Math.min(BALANCE.goals.streakMax, BALANCE.goals.streakPer * Math.min(S.streak, 10)), 'goals');
    buyPhone(); complete();
    // each dream is evaluated on a shadow wallet that buys only that dream's items (net of practice spending)
    for (const [k, w] of Object.entries(queues)) {
      w.cash += income - spent;
      const items = DREAMS[k];
      while (w.idx < items.length) { const def = ITEMS[items[w.idx]]; if (S.ch < def.gate || w.cash < def.price) break; w.cash -= def.price; w.idx++; }
      if (w.idx >= items.length && !w.done) w.done = d;
    }
    S.income.push(income); if (d === 1) S.day1 = { income, cash: S.cash };
  }
  const t30 = S.income.slice(0, 30).reduce((a, b) => a + b, 0);
  return { day1: S.day1, chDay: S.chDay, total30: t30, comp: S.comp, lang3160: S.lang3160, phoneDay: S.phoneDay, dreams: Object.fromEntries(Object.entries(queues).map(([k, q]) => [k, q.done])) };
}

const med = (arr) => { const a = arr.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
export function runMany(persona, n = 41, days = 160) {
  const runs = Array.from({ length: n }, (_, i) => simulate(persona, days, i + 1));
  const comp = {}; for (const k of Object.keys(runs[0].comp)) comp[k] = Math.round(runs.reduce((a, r) => a + r.comp[k], 0) / n);
  return { persona, chDay: Array.from({ length: 8 }, (_, i) => med(runs.map((r) => r.chDay[i]))), phoneDay: med(runs.map((r) => r.phoneDay)),
    dreams: Object.fromEntries(Object.keys(DREAMS).map((k) => [k, med(runs.map((r) => r.dreams[k]))])), perDay30: Math.round(runs.reduce((a, r) => a + r.total30, 0) / n / 30),
    lang3160: Math.round(runs.reduce((a, r) => a + r.lang3160, 0) / n), total30: Math.round(runs.reduce((a, r) => a + r.total30, 0) / n), comp };
}

if (process.argv[1] && process.argv[1].endsWith('economy-ref-sim.mjs')) {
  for (const n of ['casual', 'light', 'serious', 'grinder', 'tapleaning']) console.log(JSON.stringify(runMany(n)));
  const div = runMany('diversified'), rep = runMany('repeater'), sh = runMany('shiftonly');
  console.log(`language yen d31-60 (after Ch8): diversified ${div.lang3160}, repeater ${rep.lang3160} (${(rep.lang3160 / div.lang3160).toFixed(2)}), shift-only ${sh.lang3160} (${(sh.lang3160 / div.lang3160).toFixed(2)})`);
  const c = runMany('casual'), tot = Object.values(c.comp).reduce((a, b) => a + b, 0);
  console.log('casual share of d1-30 income %', Object.fromEntries(Object.entries(c.comp).map(([k, v]) => [k, Math.round((100 * v) / tot)])));
}
