// Conversation pay, stars, one-time pools, soft cap and echo (agent 1C; docs/GAME_DESIGN.md §3.3-§3.5, §15.9).
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { applyEcho, applySettlement, echoPassMark, estimatePay, payoutFactor, settleLoop, softCapRoom, starsFor, turnStats } from '../src/payout';
import { reconcile } from '../src/ledger';
import type { ConversationFacts, GamePack, GameState, ReduceCtx, ScenarioMeta, TurnClass, TurnFacts } from '../src/types';
import { ECON, mkPack, mkState, mkView, rng } from './fixtures-money';

const META: ScenarioMeta[] = [
  { id: 'sc', kind: 'shop', band: 'A1', register: 'polite', pay: 'full' },
  { id: 'sc2', kind: 'shop', band: 'A2', register: 'polite', pay: 'full' },
  { id: 'chat', kind: 'friend', band: 'A1', register: 'casual', pay: 'none' },
];
const pack = (over: Partial<GamePack> = {}): GamePack =>
  mkPack({
    scenarioMeta: META,
    pockets: { p1: { id: 'p1', line: { ja: 'おにぎりをください。', en: 'A rice ball, please.', ar: 'كرة أرز من فضلك.' } } },
    ageProfiles: { kids: { echoThreshold: 0.55 }, teens: { echoThreshold: 0.6 }, adults: { echoThreshold: 0.7 }, seniors: { echoThreshold: 0.6 } } as unknown as GamePack['ageProfiles'],
    ...over,
  });
const P = pack();

/** mkState has only the money slices; payout also writes words and stats.sayNew. */
function stateFor(over: Parameters<typeof mkState>[0] = {}): GameState {
  const s = mkState(over);
  return { ...s, words: { said: [] }, stats: { ...s.stats, sayNew: 0 } } as GameState;
}
const ctxFor = (p: GamePack = P, level: 'A1' | 'A2' = 'A2', age: 'adults' | 'kids' = 'adults'): ReduceCtx => ({
  pack: p,
  now: 1_000,
  view: { ...mkView(age), profile: { ...mkView(age).profile, level } },
  rng: rng(1),
});

let sid = 0;
/** Facts from a turn mix such as 'IIIISS': every I carries its own intent id, every turn is substantive, the goal has 4 steps. */
function facts(mix: string, over: Partial<ConversationFacts> = {}, scenarioId = 'sc'): ConversationFacts {
  const credit = (c: TurnClass) => BALANCE.credit[c];
  const turns: TurnFacts[] = [...mix].map((c, i) => ({
    id: i + 1,
    cls: c as TurnClass,
    credit: credit(c as TurnClass),
    substantive: true,
    contentTokens: 2,
    intentId: `i${i}`,
    stepIds: [],
    norm: `t${i}`,
    newWords: c === 'I' ? [`w${i}`] : [],
  }));
  return {
    sessionId: `s${++sid}`,
    scenarioId,
    characterId: 'x',
    mode: 'guided',
    abandoned: false,
    durationSec: 60,
    goalDone: 4,
    goalTotal: 4,
    turns,
    fallbacks: 0,
    hintUses: 0,
    accuracy: 100,
    requestsPolite: true,
    prepared: false,
    remembered: {},
    ...over,
  };
}

const loopPay = (f: ConversationFacts, st: GameState = stateFor(), p: GamePack = P) => settleLoop(f, st, p).loopPay;

/** Settles and applies a conversation; returns the new state and the settlement. */
function play(st: GameState, f: ConversationFacts, p: GamePack = P) {
  const settlement = settleLoop(f, st, p);
  const r = applySettlement(st, f, settlement, ctxFor(p));
  return { state: r.state, settlement, derived: r.derived };
}

describe('§3.5 worked examples, to the yen', () => {
  // A1 scenario, 4 goal steps, 6 substantive turns, first play today, base 1,500
  const table: Array<[string, string, Partial<ConversationFacts>, number, number]> = [
    ['all typed or spoken', 'IIIIII', {}, 1, 1680],
    ['mostly own words', 'IIIISS', {}, 0.71, 1185],
    ['half and half', 'IIISSS', {}, 0.59, 980],
    ['mostly tapping', 'IISSSS', {}, 0.49, 795],
    ['all tapped suggestions', 'SSSSSS', {}, 0.34, 515],
    ['all translated', 'TTTTTT', {}, 0.3, 445],
    ['typed, prepared, Real mode', 'IIIIII', { prepared: true, mode: 'real' }, 1, 2310],
    ['2 fallbacks + 2 hints', 'IIIIII', { fallbacks: 2, hintUses: 2 }, 1, 1275],
    ['goal 2 of 4 steps', 'IIIIII', { goalDone: 2 }, 1, 420],
  ];
  for (const [name, mix, over, F, pay] of table) {
    it(`${name}: ${mix} pays ¥${pay}`, () => {
      const s = settleLoop(facts(mix, over), stateFor(), P);
      expect(s.loopPay).toBe(pay);
      expect(s.raw).toBe(pay);
      expect(Math.round(s.F * 100) / 100).toBe(F);
    });
  }

  it('the percentages of the all-independent row are 100 / 71 / 58 / 47 / 31 / 26', () => {
    const full = loopPay(facts('IIIIII'));
    const pct = ['IIIIII', 'IIIISS', 'IIISSS', 'IISSSS', 'SSSSSS', 'TTTTTT'].map((m) => Math.round((100 * loopPay(facts(m))) / full));
    expect(pct).toEqual([100, 71, 58, 47, 31, 26]);
  });

  it('the same scenario four times in one day pays 1,185, 415, 120, 0 = 1,720, not 4 x 1,185', () => {
    let st = stateFor();
    const paid: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = play(st, facts('IIIISS'));
      paid.push(r.settlement.loopPay);
      st = r.state;
    }
    expect(paid).toEqual([1185, 415, 120, 0]);
    expect(paid.reduce((a, b) => a + b, 0)).toBe(1720);
    // the fourth play pays nothing, so it is not a paid completion
    expect(st.pay.scenarioToday.sc).toBe(3);
  });

  it('a different scenario starts at the full rate, and a new day resets the repeats', () => {
    let st = stateFor();
    st = play(st, facts('IIIISS')).state;
    expect(loopPay(facts('IIIISS', {}, 'sc2'), st)).toBe(Math.round((2200 * (0.25 + 0.75 * (4.7 / 6) ** 2) + 120) / 5) * 5);
    const tomorrow = { ...st, clock: { ...st.clock, dayIndex: 1 } };
    expect(loopPay(facts('IIIISS'), tomorrow)).toBe(1185);
  });

  it('every pay line adds up to the total the wallet receives', () => {
    const r = play(stateFor(), facts('IIIIII'));
    expect(r.settlement.lines.reduce((a, l) => a + l.yen, 0)).toBe(r.settlement.total);
    expect(r.state.wallet.cash - ECON.startCash).toBe(r.settlement.total);
    expect(reconcile(r.state, ECON.startCash).ok).toBe(true);
  });
});

describe('one-time mastery pools', () => {
  it('stars pay 200 / 400 / 600 once, ever', () => {
    const f = facts('IIIIII');
    const first = play(stateFor(), f);
    expect(first.settlement.stars).toBe(3);
    expect(first.settlement.newStars).toEqual([
      { star: 1, yen: 200 },
      { star: 2, yen: 400 },
      { star: 3, yen: 600 },
    ]);
    expect(first.state.runs.sc.stars).toBe(3);
    const again = settleLoop(facts('IIIIII'), first.state, P);
    expect(again.newStars).toEqual([]);
  });

  it('a better run pays only the new stars', () => {
    const one = play(stateFor(), facts('SSSSSS'));
    expect(one.settlement.stars).toBe(1);
    expect(one.settlement.newStars).toEqual([{ star: 1, yen: 200 }]);
    const better = settleLoop(facts('IIIIII'), one.state, P);
    expect(better.newStars.map((s) => s.star)).toEqual([2, 3]);
  });

  it('first independent use of an intent pays 20, 120 a day, and is listed even when nothing pays', () => {
    const f = facts('IIIIIIII', { goalDone: 4 });
    const r = play(stateFor(), f);
    expect(r.settlement.firstPhrases).toHaveLength(8);
    expect(r.settlement.firstPhrases.map((p) => p.yen)).toEqual([20, 20, 20, 20, 20, 20, 0, 0]);
    expect(r.state.pay.seenIntents).toHaveLength(8);
    expect(r.state.pay.firstPhraseToday).toBe(120);
    // the same intents again pay nothing
    const again = settleLoop(facts('IIIIIIII'), r.state, P);
    expect(again.firstPhrases).toEqual([]);
  });

  it('a copy of shown text, even a recalled line, is class I for credit but not a first use', () => {
    const f = facts('IIII');
    f.turns[0].copied = true;
    f.turns[0].recalled = true;
    const s = settleLoop(f, stateFor(), P);
    expect(s.stats.independent).toBe(4);
    expect(s.firstPhrases.map((p) => p.key)).toEqual(['sc:i1', 'sc:i2', 'sc:i3']);
  });

  it('sayNew and words.said take the new words of class-I turns only, once', () => {
    const f = facts('IISS');
    f.turns[0].newWords = ['水', 'コーヒー'];
    f.turns[2].newWords = ['ignored'];
    const r = play(stateFor(), f);
    expect(r.state.words.said).toEqual(['水', 'コーヒー', 'w1']);
    expect(r.state.stats.sayNew).toBe(3);
    // the second conversation brings one word the lifetime set has not seen (w0); w1 is known
    const again = play(r.state, facts('IISS'));
    expect(again.state.words.said).toEqual(['水', 'コーヒー', 'w1', 'w0']);
    expect(again.state.stats.sayNew).toBe(4);
  });
});

describe('soft cap, practice only, pay none, abandoned', () => {
  it('beyond 14,000 language yen today pays x0.25; the part under the cap pays in full', () => {
    const over = stateFor();
    over.pay.langToday = BALANCE.softCap;
    const a = settleLoop(facts('IIIIII'), over, P);
    expect(a.raw).toBe(1680);
    expect(a.loopPay).toBe(420);
    expect(a.softCapped).toBe(true);
    const near = stateFor();
    near.pay.langToday = BALANCE.softCap - 1000;
    const b = settleLoop(facts('IIIIII'), near, P);
    expect(b.loopPay).toBe(1000 + 170);
    expect(b.lines.at(-1)?.reason).toBe('softCap');
    expect(b.lines.reduce((x, l) => x + l.yen, 0)).toBe(b.total);
    expect(softCapRoom(near, P)).toBe(1000);
  });

  it('fewer substantive turns than goal steps is practice only', () => {
    const f = facts('II', { goalDone: 4, goalTotal: 4 });
    const s = settleLoop(f, stateFor(), P);
    expect(s.practiceOnly).toBe(true);
    expect(s.loopPay).toBe(0);
    expect(s.lines.some((l) => l.reason === 'practiceOnly')).toBe(true);
  });

  it('pay:none scenarios pay no yen but still record first uses, stars and runs', () => {
    const r = play(stateFor(), facts('IIII', {}, 'chat'));
    expect(r.settlement.total).toBe(0);
    expect(r.settlement.practiceOnly).toBe(false);
    expect(r.settlement.firstPhrases).toHaveLength(4);
    expect(r.state.pay.seenIntents).toContain('chat:i0');
    expect(r.state.runs.chat.complete).toBe(true);
    expect(r.state.wallet.cash).toBe(ECON.startCash);
  });

  it('leaving pays nothing but keeps what was done', () => {
    const f = facts('IIS', { abandoned: true, goalDone: 2 });
    f.turns[0].stepIds = ['find'];
    f.turns[1].stepIds = ['price'];
    const r = play(stateFor(), f);
    expect(r.settlement.total).toBe(0);
    expect(r.state.wallet.cash).toBe(ECON.startCash);
    expect(r.state.runs.sc).toMatchObject({ count: 0, complete: false, stars: 0, steps: ['find', 'price'] });
    expect(r.state.pay.scenarioToday.sc).toBeUndefined();
    expect(r.state.pay.seenIntents).toEqual(['sc:i0', 'sc:i1']);
  });

  it('applying the same conversation twice changes nothing the second time (E10)', () => {
    const f = facts('IIIIII');
    const once = play(stateFor(), f);
    const twice = applySettlement(once.state, f, once.settlement, ctxFor());
    expect(twice.state).toBe(once.state);
    expect(twice.derived).toEqual([]);
  });

  it('even a zero-pay loop is remembered, so a replay cannot pay it late', () => {
    const f = facts('II', { goalDone: 4 });
    const once = play(stateFor(), f);
    expect(once.state.seen).toContain(`loop:${f.sessionId}`);
    expect(applySettlement(once.state, f, once.settlement, ctxFor()).state).toBe(once.state);
  });

  it('a scaled pack scales every yen amount (incomeScale 2)', () => {
    const rich = pack({ economy: { ...ECON, incomeScale: 2 } });
    const s = settleLoop(facts('IIIIII'), stateFor(), rich);
    expect(s.base).toBe(3000);
    expect(s.loopPay).toBe(3360);
    expect(s.newStars.map((x) => x.yen)).toEqual([400, 800, 1200]);
  });
});

describe('stars (§3.4)', () => {
  const full = (over: Partial<ConversationFacts> = {}, mix = 'IIIIII') => starsFor(facts(mix, over));
  it('one for the goal, two at r >= 0.60, three at r >= 0.80 with accuracy >= 80, no hints and polite requests', () => {
    expect(full({ goalDone: 3 })).toBe(0);
    expect(full({}, 'TTTTTT')).toBe(1);
    expect(full({}, 'IISSSS')).toBe(1); // r 0.57
    expect(full({}, 'IIISSS')).toBe(2); // r 0.675
    expect(full({})).toBe(3);
    expect(full({ hintUses: 1 })).toBe(2);
    expect(full({ accuracy: 79 })).toBe(2);
    expect(full({ accuracy: null })).toBe(2);
    expect(full({ requestsPolite: false })).toBe(2);
    expect(full({ abandoned: true })).toBe(0);
  });
  it('is monotone: a turn of higher credit never lowers the stars', () => {
    const r = rng(7);
    const order: TurnClass[] = ['T', 'S', 'I'];
    for (let n = 0; n < 200; n++) {
      const len = 4 + Math.floor(r() * 6);
      const mix = Array.from({ length: len }, () => order[Math.floor(r() * 3)]);
      const at = Math.floor(r() * len);
      const better = mix.slice();
      better[at] = order[Math.min(2, order.indexOf(mix[at]) + 1 + Math.floor(r() * 2))];
      expect(starsFor(facts(better.join('')))).toBeGreaterThanOrEqual(starsFor(facts(mix.join(''))));
    }
  });
});

describe('properties', () => {
  it('replacing a class with a higher credit never lowers the pay', () => {
    const r = rng(11);
    const order: TurnClass[] = ['T', 'S', 'I'];
    for (let n = 0; n < 300; n++) {
      const len = 4 + Math.floor(r() * 6);
      const mix = Array.from({ length: len }, () => order[Math.floor(r() * 3)]);
      const at = Math.floor(r() * len);
      const better = mix.slice();
      better[at] = order[Math.min(2, order.indexOf(mix[at]) + 1)];
      const over = { fallbacks: Math.floor(r() * 4), hintUses: Math.floor(r() * 4), prepared: r() < 0.5 };
      expect(loopPay(facts(better.join(''), over))).toBeGreaterThanOrEqual(loopPay(facts(mix.join(''), over)));
    }
  });

  it('all-T never beats all-S never beats all-I, for every length', () => {
    for (let n = 1; n <= 14; n++) {
      const p = (c: string) => loopPay(facts(c.repeat(n), { goalDone: 4, goalTotal: Math.min(4, n) }));
      expect(p('T')).toBeLessThanOrEqual(p('S'));
      expect(p('S')).toBeLessThanOrEqual(p('I'));
    }
  });

  it('pay is non-increasing in the number of repeats, and the factor stays in [0, 1]', () => {
    let st = stateFor();
    let last = Infinity;
    for (let i = 0; i < 8; i++) {
      const f = payoutFactor(st, 'sc');
      expect(f.dayFactor).toBeGreaterThanOrEqual(0);
      expect(f.dayFactor).toBeLessThanOrEqual(1);
      const r = play(st, facts('IIIIII'));
      expect(r.settlement.loopPay).toBeLessThanOrEqual(last);
      last = r.settlement.loopPay;
      st = r.state;
    }
    expect(last).toBe(0);
  });

  it('pay is round to 5 yen and never negative, and the lines always add up', () => {
    const r = rng(3);
    const order: TurnClass[] = ['T', 'S', 'I'];
    let st = stateFor();
    for (let n = 0; n < 150; n++) {
      const len = 3 + Math.floor(r() * 8);
      const mix = Array.from({ length: len }, () => order[Math.floor(r() * 3)]).join('');
      const f = facts(mix, { fallbacks: Math.floor(r() * 7), hintUses: Math.floor(r() * 7), goalDone: Math.floor(r() * 5), mode: r() < 0.3 ? 'real' : 'guided', prepared: r() < 0.5 }, r() < 0.5 ? 'sc' : 'sc2');
      st.pay.langToday = Math.floor(r() * 20) * 1000;
      const s = settleLoop(f, st, P);
      expect(s.loopPay).toBeGreaterThanOrEqual(0);
      expect(s.raw % 5).toBe(0);
      expect(s.loopPay % 5).toBe(0);
      expect(s.lines.reduce((a, l) => a + l.yen, 0)).toBe(s.total);
      if (n % 10 === 0) st = play(st, f).state;
    }
  });

  it('the wallet reconciles after any run of conversations, echoes included', () => {
    const r = rng(5);
    let st = stateFor();
    for (let n = 0; n < 40; n++) {
      st = play(st, facts(['IIIIII', 'SSSSSS', 'IIISSS'][Math.floor(r() * 3)], {}, ['sc', 'sc2', 'chat'][Math.floor(r() * 3)])).state;
      st = applyEcho(st, { t: 'echo', sessionId: `e${n}`, lineId: 'p1', similarity: 0.9 }, ctxFor()).state;
    }
    expect(reconcile(st, ECON.startCash).ok).toBe(true);
    expect(st.wallet.cash).toBeGreaterThan(ECON.startCash);
  });
});

describe('turnStats', () => {
  it('counts substantive turns only; distinct intents come from class-I turns', () => {
    const f = facts('IISSTI');
    f.turns[1].intentId = 'i0';
    f.turns[5].substantive = false;
    const s = turnStats(f);
    expect(s.n).toBe(5);
    expect(s.independent).toBe(2);
    expect(s.assisted).toBe(3);
    expect(s.share).toBeCloseTo(0.4);
    expect(s.distinct).toEqual(['i0']);
    expect(s.r).toBeCloseTo((1 + 1 + 0.35 + 0.35 + 0.25) / 5);
  });
  it('is zero for a conversation with no substantive turn', () => {
    expect(turnStats(facts(''))).toMatchObject({ n: 0, r: 0, share: 0, distinct: [] });
  });
});

describe('payoutFactor and estimatePay', () => {
  it('reads today only', () => {
    let st = stateFor();
    expect(payoutFactor(st, 'sc')).toEqual({ plays: 0, dayFactor: 1, softCapLeft: BALANCE.softCap });
    st = play(st, facts('IIIIII')).state;
    expect(payoutFactor(st, 'sc')).toMatchObject({ plays: 1, dayFactor: 0.35 });
    expect(payoutFactor(st, 'sc').softCapLeft).toBeLessThan(BALANCE.softCap);
    expect(payoutFactor({ ...st, clock: { ...st.clock, dayIndex: 1 } }, 'sc')).toMatchObject({ plays: 0, dayFactor: 1, softCapLeft: BALANCE.softCap });
  });

  it('estimates the nudge without promising the independence bonus', () => {
    const st = stateFor();
    expect(estimatePay(P, st, 'sc', 1)).toBe(1500);
    expect(estimatePay(P, st, 'sc', 0.35)).toBe(515);
    expect(estimatePay(P, st, 'sc', 1, true)).toBe(1875);
    expect(estimatePay(P, st, 'sc', 1, false, { distinct: 6, prepared: true })).toBe(1850);
    expect(estimatePay(P, st, 'chat', 1)).toBe(0);
    expect(estimatePay(P, st, 'nope', 1)).toBe(0);
    let last = -1;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const e = estimatePay(P, st, 'sc', r);
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
  });
});

describe('echo', () => {
  const echo = (st: GameState, n: number, sessionId = 'c1', similarity = 0.9, extra: { peeked?: boolean; lineId?: string } = {}, level: 'A1' | 'A2' = 'A2') =>
    applyEcho(st, { t: 'echo', sessionId, lineId: extra.lineId ?? `l${n}`, similarity, peeked: extra.peeked }, ctxFor(P, level));

  it('pays 20 per hidden-line recall, at most 2 per conversation', () => {
    let st = stateFor();
    for (let i = 0; i < 4; i++) st = echo(st, i).state;
    expect(st.wallet.cash - ECON.startCash).toBe(40);
    expect(st.pay.echoSession).toEqual({ sessionId: 'c1', n: 2 });
    // another conversation pays again
    st = echo(st, 9, 'c2').state;
    expect(st.wallet.cash - ECON.startCash).toBe(60);
  });

  it('is capped at 100 a day', () => {
    let st = stateFor();
    for (let i = 0; i < 12; i++) st = echo(st, i, `c${i}`).state;
    expect(st.wallet.cash - ECON.startCash).toBe(100);
    expect(st.pay.echoToday).toBe(100);
  });

  it('pays nothing below the pass mark and still teaches nothing then; a Peek keeps the card but forfeits the yen', () => {
    const st = stateFor();
    const low = echo(st, 1, 'c1', 0.3);
    expect(low.state).toBe(st);
    expect(low.effects).toEqual([]);
    const peek = echo(st, 1, 'c1', 0.9, { peeked: true, lineId: 'p1' });
    expect(peek.state.wallet.cash).toBe(st.wallet.cash);
    expect(peek.effects).toEqual([{ t: 'srsOps', ops: [expect.objectContaining({ op: 'add', key: 'p1', kind: 'phrase', source: 'conversation', dueInMin: BALANCE.srs.echoDueMin })] }]);
    const paid = echo(st, 1, 'c1', 0.9, { lineId: 'p1' });
    expect(paid.effects).toHaveLength(1);
    expect(paid.derived).toEqual([{ t: 'wallet_changed', delta: 20, balance: st.wallet.cash + 20, kind: 'echo' }]);
  });

  it('the same line in the same conversation pays once (idempotent id)', () => {
    const a = echo(stateFor(), 1, 'c1', 0.9, { lineId: 'p1' });
    const b = echo(a.state, 1, 'c1', 0.95, { lineId: 'p1' });
    expect(b.state).toBe(a.state);
  });

  it('the pass mark follows the age profile, and a beginner gets 0.50 at most', () => {
    const view = (age: 'adults' | 'kids', level: 'A1' | 'A2') => ({ ...mkView(age), profile: { ...mkView(age).profile, level } });
    expect(echoPassMark(P, view('adults', 'A2'))).toBe(0.7);
    expect(echoPassMark(P, view('adults', 'A1'))).toBe(0.5);
    expect(echoPassMark(P, view('kids', 'A2'))).toBe(0.55);
    expect(echo(stateFor(), 1, 'c1', 0.65).state.wallet.cash).toBe(ECON.startCash);
    expect(echo(stateFor(), 1, 'c1', 0.65, {}, 'A1').state.wallet.cash).toBe(ECON.startCash + 20);
  });

  it('counts toward the soft cap', () => {
    const st = stateFor();
    st.pay.langToday = BALANCE.softCap;
    expect(echo(st, 1).state.wallet.cash - ECON.startCash).toBe(5);
  });
});
