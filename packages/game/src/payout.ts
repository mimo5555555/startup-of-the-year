// Turn statistics, conversation pay, stars (agent 1C). All constants come from BALANCE.
import { BALANCE } from './balance';
import { emptyRun } from './defaults';
import { payForDay } from './integrity';
import { LEDGER_IDS, applyLedger, dayKey, ledgerHas } from './ledger';
import { scaleAmount, walletLimits } from './money';
import type {
  ConversationFacts,
  DerivedEvent,
  GamePack,
  GameState,
  GameView,
  InputEvent,
  LedgerKind,
  LoopSettlement,
  PayLine,
  PayState,
  PayoutFactor,
  ReduceCtx,
  ReduceResult,
  ScenarioMeta,
  SrsOp,
  TurnStats,
} from './types';

const scale = (pack: GamePack, base: number): number => scaleAmount(base, pack.economy, pack.currency);

/** Pay is rounded to `BALANCE.payRound` yen (scaled with the pack's income, never below its smallest currency step). */
const roundStep = (pack: GamePack): number => scale(pack, BALANCE.payRound);
const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

const metaOf = (pack: GamePack, scenarioId: string): ScenarioMeta | undefined => pack.scenarioMeta.find((m) => m.id === scenarioId);

/** r = sum(credit) / N over substantive matched turns, plus independence share and the distinct class-I intents (§3.2). */
export function turnStats(facts: ConversationFacts): TurnStats {
  const subs = facts.turns.filter((t) => t.substantive);
  const independent = subs.filter((t) => t.cls === 'I');
  const distinct: string[] = [];
  for (const t of independent) if (t.intentId && !distinct.includes(t.intentId)) distinct.push(t.intentId);
  const n = subs.length;
  const assisted = n - independent.length;
  return {
    n,
    r: n ? subs.reduce((sum, t) => sum + t.credit, 0) / n : 0,
    independent: independent.length,
    assisted,
    share: n ? independent.length / n : 0,
    distinct,
  };
}

/** Stars for one conversation (§3.4): 1 goal complete, 2 also r >= 0.60, 3 also r >= 0.80, accuracy >= 80, 0 hints, polite requests. */
export function starsFor(facts: ConversationFacts): 0 | 1 | 2 | 3 {
  if (facts.abandoned || facts.goalTotal <= 0 || facts.goalDone < facts.goalTotal) return 0;
  const { r } = turnStats(facts);
  const rule = BALANCE.starRule;
  if (r < rule.r2) return 1;
  const clean = r >= rule.r3 && facts.accuracy !== null && facts.accuracy >= rule.accuracy && facts.hintUses <= rule.maxHints && facts.requestsPolite;
  return clean ? 3 : 2;
}

/** F(r) = 0.25 + 0.75 r^2: the convex independence factor. */
export const independenceFactor = (r: number): number => BALANCE.indep.floor + BALANCE.indep.span * r * r;

/** clean = max(0.6, 1 - 0.08 min(fallbacks, 5) - 0.04 min(hintUses, 5)). */
export function cleanFactor(fallbacks: number, hintUses: number): number {
  const c = BALANCE.clean;
  return Math.max(c.floor, 1 - c.fb * Math.min(fallbacks, c.fbMax) - c.hint * Math.min(hintUses, c.hintMax));
}

/** All goal steps done = 1, some = 0.5 * done / total, none = 0. */
export function goalFactor(goalDone: number, goalTotal: number): number {
  if (goalDone >= goalTotal) return 1;
  return goalDone <= 0 ? 0 : (BALANCE.goalPartial * goalDone) / goalTotal;
}

/** The multiplier of the next paid completion of a scenario after `plays` today: [1, .35, .1, 0]. */
export const dayFactorFor = (plays: number): number => BALANCE.dayFactor[Math.min(Math.max(0, plays), BALANCE.dayFactor.length - 1)];

/** The pay counters that belong to today (a stale `pay.day` reads as empty). */
const todayOf = (state: GameState): PayState => payForDay(state.pay, dayKey(state.clock.dayIndex));

/** Language yen still payable at the full rate today (§3.3 soft cap). */
export function softCapRoom(state: GameState, pack: GamePack): number {
  return Math.max(0, scale(pack, BALANCE.softCap) - todayOf(state).langToday);
}

/** One payment through the soft cap: up to `room` at the full rate, the rest at x0.25, rounded. */
function capPay(amount: number, room: number, step: number): { paid: number; room: number } {
  if (amount <= room) return { paid: amount, room: room - amount };
  return { paid: room + roundTo((amount - room) * BALANCE.softCapFactor, step), room: 0 };
}

/** The first independent uses of intents in this conversation that the player has not made before (keys `scenarioId:intentId`). */
function firstUses(facts: ConversationFacts, state: GameState): string[] {
  const seen = new Set(state.pay.seenIntents);
  const out: string[] = [];
  for (const t of facts.turns) {
    // a copy of shown text (a recalled chip line included) is class I for credit but not an independent first use
    if (!t.substantive || t.cls !== 'I' || t.copied || !t.intentId) continue;
    const key = `${facts.scenarioId}:${t.intentId}`;
    if (!seen.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

/** The ledger id of the j-th first-phrase payment of a settlement: `seenIntents` only grows, so the index never repeats. */
const phraseId = (state: GameState, j: number): string => LEDGER_IDS.phrase(dayKey(state.clock.dayIndex), state.pay.seenIntents.length + j);

/**
 * The full settlement of a finished conversation (§3.3): F(r), clean, goalFactor, indepBonus, dayFactor, prepF, realF, the
 * soft cap, stars, first-phrase pay. Pure on (facts, state, pack); the reducer turns the result into ledger entries.
 * Must reproduce the §3.5 worked-example table exactly.
 *
 * The soft cap is applied to each payment in turn (loop, stars, first phrases), so `loopPay`, `newStars[].yen` and
 * `firstPhrases[].yen` are what reaches the wallet; `raw` is the loop pay before the cap. `lines` shows the nominal rows plus
 * one `softCap` row, so the rows add up to `total`. `firstPhrases` lists every first independent use (yen 0 when nothing pays:
 * a pay-none scenario, the day's ¥120 pool spent, ...), because daily goals and objectives count the use, not the yen.
 */
export function settleLoop(facts: ConversationFacts, state: GameState, pack: GamePack): LoopSettlement {
  const meta = metaOf(pack, facts.scenarioId);
  const paysYen = meta?.pay === 'full';
  const step = roundStep(pack);
  const today = todayOf(state);
  const stats = turnStats(facts);

  const F = independenceFactor(stats.r);
  const clean = cleanFactor(facts.fallbacks, facts.hintUses);
  const goal = goalFactor(facts.goalDone, facts.goalTotal);
  const distinct = Math.min(BALANCE.distinctMax, stats.distinct.length);
  const indepBonus = scale(pack, BALANCE.indepBonusPer) * distinct;
  const dayFactor = dayFactorFor(today.scenarioToday[facts.scenarioId] ?? 0);
  const prepF = facts.prepared ? BALANCE.prepF : 1;
  const realF = facts.mode === 'real' ? BALANCE.realF : 1;
  const base = paysYen && meta ? scale(pack, BALANCE.base[meta.band]) : 0;

  // fewer substantive turns than goal steps: practice only (shown honestly), as is a conversation left half way
  const practiceOnly = paysYen && (facts.abandoned || stats.n < facts.goalTotal);
  const earns = paysYen && !practiceOnly;

  // each row is the difference of two consecutive rounded stages, so the rows telescope to `raw` exactly
  const P = base * F + indepBonus;
  const stage = (m: number): number => (earns ? roundTo(P * m, step) : 0);
  const sLines = stage(clean);
  const sSteps = stage(clean * goal);
  const sPrep = stage(clean * goal * prepF);
  const sReal = stage(clean * goal * prepF * realF);
  const raw = stage(clean * goal * prepF * realF * dayFactor);
  const sRepeat = raw;

  let room = Math.max(0, scale(pack, BALANCE.softCap) - today.langToday);
  const loop = capPay(raw, room, step);
  room = loop.room;

  const stars = starsFor(facts);
  const best = state.runs[facts.scenarioId]?.stars ?? 0;
  const newStars: LoopSettlement['newStars'] = [];
  const nominalStars: number[] = [];
  for (let n = best + 1; n <= stars; n++) {
    const nominal = paysYen ? scale(pack, BALANCE.stars[n as 1 | 2 | 3]) : 0;
    const c = capPay(nominal, room, step);
    room = c.room;
    nominalStars.push(nominal);
    newStars.push({ star: n as 1 | 2 | 3, yen: c.paid });
  }

  const firstPhrases: LoopSettlement['firstPhrases'] = [];
  const nominalPhrases: number[] = [];
  const unit = scale(pack, BALANCE.firstPhrase.pay);
  let pool = Math.max(0, scale(pack, BALANCE.firstPhrase.cap) - today.firstPhraseToday);
  for (const key of firstUses(facts, state)) {
    const nominal = paysYen && !facts.abandoned ? Math.min(unit, pool) : 0;
    pool -= nominal;
    const c = capPay(nominal, room, step);
    room = c.room;
    nominalPhrases.push(nominal);
    firstPhrases.push({ key, yen: c.paid });
  }

  const nominalTotal = raw + nominalStars.reduce((a, b) => a + b, 0) + nominalPhrases.reduce((a, b) => a + b, 0);
  const total = loop.paid + newStars.reduce((a, s) => a + s.yen, 0) + firstPhrases.reduce((a, p) => a + p.yen, 0);

  const loopId = LEDGER_IDS.loop(facts.sessionId);
  const lines: PayLine[] = [];
  const row = (reason: PayLine['reason'], yen: number, extra: Partial<PayLine> = {}) => {
    if (yen !== 0) lines.push({ reason, yen, ...extra });
  };
  row('lines', sLines, { ledgerId: loopId });
  row('steps', sSteps - sLines, { ledgerId: loopId });
  row('prepared', sPrep - sSteps, { ledgerId: loopId });
  row('real', sReal - sPrep, { ledgerId: loopId });
  row('repeat', sRepeat - sReal, { ledgerId: loopId });
  if (practiceOnly) lines.push({ reason: 'practiceOnly', yen: 0 });
  newStars.forEach((s, i) => row('star', nominalStars[i], { ledgerId: LEDGER_IDS.star(facts.scenarioId, s.star), vars: { stars: s.star } }));
  let j = 0;
  firstPhrases.forEach((p, i) => {
    if (nominalPhrases[i] > 0) row('firstPhrase', nominalPhrases[i], { ledgerId: phraseId(state, j++), vars: { key: p.key } });
  });
  row('softCap', total - nominalTotal);

  return {
    stats,
    F,
    clean,
    goalFactor: goal,
    indepBonus,
    dayFactor,
    prepF,
    realF,
    base,
    raw,
    loopPay: loop.paid,
    practiceOnly,
    softCapped: total < nominalTotal,
    stars,
    newStars,
    firstPhrases,
    total,
    lines,
  };
}

const union = (a: string[], b: string[]): string[] => [...a, ...b.filter((x, i) => !a.includes(x) && b.indexOf(x) === i)];

/**
 * Writes a settlement into state, the one place that does: ledger entries `loop:<sessionId>`, `star:<scenarioId>:<n>` and
 * `phrase:<day>:<k>` through `applyLedger`; `runs[scenarioId]` best-of (count, complete, stars, bestIndependent / bestShare / bestR,
 * steps); `pay` counters (langToday, firstPhraseToday, scenarioToday, lastPaid, seenIntents); `stats.sayNew` and `words.said`.
 * Idempotent on `loop:<sessionId>`: the id is recorded even when the loop pay is 0, so a replay changes nothing. The reducer calls
 * it for `conversation_done` after `dedupe`.
 *
 * A conversation that was left (`abandoned`) pays nothing (E10) but keeps its progress: steps, best-of, first uses, words said.
 */
export function applySettlement(state: GameState, facts: ConversationFacts, settlement: LoopSettlement, ctx: ReduceCtx): ReduceResult {
  const loopId = LEDGER_IDS.loop(facts.sessionId);
  if (ledgerHas(state, loopId)) return { state, derived: [], effects: [] };
  const { pack } = ctx;
  const limits = walletLimits(state, pack);
  const day = dayKey(state.clock.dayIndex);
  let s: GameState = { ...state, pay: todayOf(state) };
  const derived: DerivedEvent[] = [];
  let paidTotal = 0;
  let paidPhrases = 0;

  const pay = (id: string, kind: LedgerKind, delta: number, ref: string): number => {
    // a zero delta is still recorded (as seen), so a replay cannot pay it late
    const before = s.wallet.cash;
    const r = applyLedger(s, { id, at: ctx.now, kind, delta, pocket: 'cash', ref }, limits);
    s = r.state;
    const paid = s.wallet.cash - before;
    if (paid > 0) derived.push({ t: 'wallet_changed', delta: paid, balance: s.wallet.cash, kind });
    return paid;
  };

  const settled = !facts.abandoned;
  paidTotal += pay(loopId, 'loop', settled ? settlement.loopPay : 0, facts.scenarioId);
  if (settled) {
    for (const st of settlement.newStars) if (st.yen > 0) paidTotal += pay(LEDGER_IDS.star(facts.scenarioId, st.star), 'star', st.yen, facts.scenarioId);
    let j = 0;
    for (const p of settlement.firstPhrases) {
      if (p.yen <= 0) continue;
      const paid = pay(phraseId(state, j++), 'phrase', p.yen, p.key);
      paidTotal += paid;
      paidPhrases += paid;
    }
  }

  const run = s.runs[facts.scenarioId] ?? emptyRun();
  const stats = settlement.stats;
  const stars = settled ? (Math.max(run.stars, settlement.stars) as 0 | 1 | 2 | 3) : run.stars;
  const nextRun = {
    count: run.count + (settled ? 1 : 0),
    complete: run.complete || (settled && facts.goalTotal > 0 && facts.goalDone >= facts.goalTotal),
    stars,
    bestIndependent: Math.max(run.bestIndependent, stats.independent),
    bestShare: Math.max(run.bestShare, stats.share),
    bestR: Math.max(run.bestR, stats.r),
    steps: union(run.steps, facts.turns.flatMap((t) => t.stepIds)),
  };

  // words the learner produced herself, new to the lifetime set (class-I substantive turns only: the engine leaves newWords empty for the rest)
  const said = [...s.words.said];
  let added = 0;
  for (const t of facts.turns) {
    if (!t.substantive || t.cls !== 'I') continue;
    for (const w of t.newWords) {
      if (!said.includes(w)) {
        said.push(w);
        added++;
      }
    }
  }

  const keys = settlement.firstPhrases.map((p) => p.key).filter((k) => !s.pay.seenIntents.includes(k));
  const paid = settled && settlement.loopPay > 0;
  s = {
    ...s,
    runs: { ...s.runs, [facts.scenarioId]: nextRun },
    stats: { ...s.stats, sayNew: s.stats.sayNew + added },
    words: { ...s.words, said },
    pay: {
      ...s.pay,
      langToday: s.pay.langToday + paidTotal,
      firstPhraseToday: s.pay.firstPhraseToday + paidPhrases,
      seenIntents: [...s.pay.seenIntents, ...keys],
      scenarioToday: paid ? { ...s.pay.scenarioToday, [facts.scenarioId]: (s.pay.scenarioToday[facts.scenarioId] ?? 0) + 1 } : s.pay.scenarioToday,
      lastPaid: paid ? { ...s.pay.lastPaid, [facts.scenarioId]: day } : s.pay.lastPaid,
    },
  };

  if (stars > run.stars) derived.push({ t: 'stars_changed', scenarioId: facts.scenarioId, from: run.stars, to: stars });
  derived.push({ t: 'loop_settled', sessionId: facts.sessionId, scenarioId: facts.scenarioId, settlement });
  return { state: s, derived, effects: [] };
}

/**
 * The yen threshold of a hidden-line echo: the age profile's `echoThreshold`, and no higher than the beginner mark for an A1 learner
 * (§11.3, §11.9). The debrief shows it ("say it at 60% or better").
 */
export function echoPassMark(pack: GamePack, view: GameView): number {
  const profile = pack.ageProfiles[view.profile.age];
  const mark = profile?.echoThreshold ?? BALANCE.echo.similarity;
  return view.profile.level === 'A1' ? Math.min(mark, BALANCE.echo.similarityBeginner) : mark;
}

/**
 * The `echo` event: BALANCE.echo pay for a hidden-line recall (similarity >= the pass mark), per-conversation and daily caps, ledger
 * `echo:<sessionId>:<lineId>`, counters in `pay`. A pass or a Peek makes the SRS phrase card; only a pass that was not peeked at pays.
 */
export function applyEcho(state: GameState, ev: Extract<InputEvent, { t: 'echo' }>, ctx: ReduceCtx): ReduceResult {
  const none: ReduceResult = { state, derived: [], effects: [] };
  const { pack } = ctx;
  const id = LEDGER_IDS.echo(ev.sessionId, ev.lineId);
  if (ledgerHas(state, id)) return none;
  const passed = ev.similarity >= echoPassMark(pack, ctx.view);
  if (!passed && !ev.peeked) return none;

  const effects: ReduceResult['effects'] = [];
  const line = ev.line ?? pack.pockets[ev.lineId]?.line;
  if (line) {
    const op: SrsOp = { op: 'add', key: ev.lineId, kind: 'phrase', line, source: 'conversation', dueInMin: BALANCE.srs.echoDueMin };
    effects.push({ t: 'srsOps', ops: [op] });
  }
  if (!passed || ev.peeked) return { state, derived: [], effects };

  const today = todayOf(state);
  const n = today.echoSession?.sessionId === ev.sessionId ? today.echoSession.n : 0;
  const step = roundStep(pack);
  const nominal = Math.min(scale(pack, BALANCE.echo.pay), Math.max(0, scale(pack, BALANCE.echo.cap) - today.echoToday));
  if (n >= BALANCE.echo.perConv || nominal <= 0) return { state, derived: [], effects };

  const want = capPay(nominal, Math.max(0, scale(pack, BALANCE.softCap) - today.langToday), step).paid;
  const before = state.wallet.cash;
  const r = applyLedger({ ...state, pay: today }, { id, at: ctx.now, kind: 'echo', delta: want, pocket: 'cash', ref: ev.lineId }, walletLimits(state, pack));
  const paid = r.state.wallet.cash - before;
  const next: GameState = {
    ...r.state,
    pay: { ...r.state.pay, echoToday: r.state.pay.echoToday + paid, langToday: r.state.pay.langToday + paid, echoSession: { sessionId: ev.sessionId, n: n + 1 } },
  };
  const derived: DerivedEvent[] = paid > 0 ? [{ t: 'wallet_changed', delta: paid, balance: next.wallet.cash, kind: 'echo' }] : [];
  return { state: next, derived, effects };
}

/**
 * The pay multipliers that apply to the next completion of a scenario today (derived, never stored). `softCapLeft` is in reference
 * yen (BALANCE.softCap, the JP pack's own amount); a pack with another `incomeScale` reads `softCapRoom(state, pack)` instead.
 */
export function payoutFactor(state: GameState, scenarioId: string): PayoutFactor {
  const today = todayOf(state);
  const plays = today.scenarioToday[scenarioId] ?? 0;
  return { plays, dayFactor: dayFactorFor(plays), softCapLeft: Math.max(0, BALANCE.softCap - today.langToday) };
}

/**
 * Yen this scenario would pay now at a given r: feeds the debrief nudge "Try the next one without a chip: about +¥n" (§11.3).
 * The goal is assumed complete and the conversation clean; `distinct` (class-I intents) defaults to 0 so the nudge never promises
 * the independence bonus it cannot know, and `prepared` defaults to false. Today's repeat factor and the soft cap are applied.
 */
export function estimatePay(pack: GamePack, state: GameState, scenarioId: string, r: number, real = false, extra: { distinct?: number; prepared?: boolean } = {}): number {
  const meta = metaOf(pack, scenarioId);
  if (meta?.pay !== 'full') return 0;
  const step = roundStep(pack);
  const distinct = Math.min(BALANCE.distinctMax, Math.max(0, extra.distinct ?? 0));
  const P = scale(pack, BALANCE.base[meta.band]) * independenceFactor(r) + scale(pack, BALANCE.indepBonusPer) * distinct;
  const day = dayFactorFor(todayOf(state).scenarioToday[scenarioId] ?? 0);
  const pay = roundTo(P * (extra.prepared ? BALANCE.prepF : 1) * (real ? BALANCE.realF : 1) * day, step);
  return capPay(pay, softCapRoom(state, pack), step).paid;
}
