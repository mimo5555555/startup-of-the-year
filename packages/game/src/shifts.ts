// Shifts: generation, accuracy, pay, ranks (agent 1E).
import { BALANCE } from './balance';
import { emptyJob } from './defaults';
import { payForDay } from './integrity';
import { grantItem } from './inventory';
import { applyLedger, dayKey, LEDGER_IDS } from './ledger';
import { scaleAmount, walletLimits } from './money';
import type {
  CustomerTemplate,
  DerivedEvent,
  GamePack,
  GameState,
  JobDef,
  MenuItem,
  ReduceCtx,
  ReduceResult,
  ShiftCustomer,
  ShiftInput,
  ShiftPlan,
  ShiftResult,
  ShiftScore,
} from './types';

/** float slack for comparing sums of 0.7 / 0.5 weights against the pass marks */
const EPS = 1e-9;

/**
 * Relative odds of an archetype whose cart or line carries a word due for review, or a job vocabulary tag (§9.1 "weighted toward the
 * words that are due"). BALANCE has no key for these two; a plain archetype weighs 1.
 */
const WEIGHT = { due: 4, tag: 2 } as const;

/** AudioMode values that mean no Japanese voice (§12.3): the assist factors never apply. */
const SILENT_MODES = ['read-and-type', 'type-only'];

/** mulberry32: a small seeded generator, so a plan is a pure function of its seed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Line markup without the token bars and the kana readings: what the learner reads. */
const plain = (ja: string): string => ja.replace(/\([^)]*\)/g, '').replace(/\|/g, '');

/** A job's menu, by id then by bare option within the job's place. */
function menuOf(pack: GamePack, job: JobDef, ref: string): MenuItem | undefined {
  const shops = new Set(pack.shops.filter((s) => s.placeId === job.place || s.id === job.place).map((s) => s.id));
  return pack.menu.find((m) => m.id === ref) ?? pack.menu.find((m) => m.option === ref && shops.has(m.shop));
}

/** The correct total of an order in minor units (take-out prices, tax included). */
function orderTotal(pack: GamePack, job: JobDef, t: CustomerTemplate): number | undefined {
  if (t.task.kind !== 'order') return undefined;
  return t.task.items.reduce((sum, i) => sum + (menuOf(pack, job, i.menu)?.price ?? 0) * i.qty, 0);
}

/** The archetypes a shift may draw: tier <= rank + 1 at a rank the player has, topped up with the lowest remaining tiers up to `archetypesMin` so a rank-0 shift is not five identical customers. */
function poolFor(job: JobDef, rank: number): CustomerTemplate[] {
  const V = BALANCE.shift.variety;
  const open = job.archetypes.filter((a) => a.minRank <= rank);
  const pool = open.filter((a) => a.tier <= rank + V.tierAboveRank);
  if (pool.length >= V.archetypesMin) return pool;
  const rest = open.filter((a) => !pool.includes(a)).sort((a, b) => a.tier - b.tier);
  return [...pool, ...rest.slice(0, V.archetypesMin - pool.length)];
}

/**
 * Five customers drawn without replacement from the job's archetypes (tier <= rank + 1), carts weighted toward `dueWords`,
 * never repeating an order in `recent` (§9.1). Deterministic in `seed`.
 * Lines and carts are authored together per archetype, so the weighting picks WHICH archetypes come, not a free cart from the menu;
 * a pool smaller than the shift draws a second round (never the same customer twice in a row while another exists), and when every
 * remaining archetype is in `recent` the one used longest ago wins. An unknown job gives an empty plan.
 */
export function generateShift(pack: GamePack, jobId: string, o: { rank: number; seed: number; dueWords: string[]; recent: string[] }): ShiftPlan {
  const job = pack.jobs.find((j) => j.id === jobId);
  const rank = Math.max(0, Math.min(BALANCE.shift.rankMult.length - 1, Math.trunc(o.rank) || 0));
  const plan: ShiftPlan = { jobId, seed: o.seed, rank, customers: [] };
  if (!job) return plan;
  const rng = seeded(o.seed);
  const pool = poolFor(job, rank);
  if (!pool.length) return plan;

  const due = o.dueWords.filter((w) => w.length >= 2);
  const tagged = job.vocabTags.flatMap((t) => pack.wordTags[t] ?? []).filter((w) => w.length >= 2);
  const weight = (a: CustomerTemplate): number => {
    const names = a.task.kind === 'order' ? a.task.items.map((i) => menuOf(pack, job, i.menu)?.name.ja ?? '') : [];
    const text = [plain(a.line.ja), ...names.map(plain)].join(' ');
    return 1 + WEIGHT.due * due.filter((w) => text.includes(w)).length + WEIGHT.tag * tagged.filter((w) => text.includes(w)).length;
  };

  let used = new Set<string>();
  for (let n = 0; n < BALANCE.shift.customers; n++) {
    let cand = pool.filter((a) => !used.has(a.id));
    if (!cand.length) {
      used = new Set();
      cand = [...pool];
    }
    const prev = plan.customers[plan.customers.length - 1]?.templateId;
    if (cand.length > 1) cand = cand.filter((a) => a.id !== prev);
    // an order not seen in the last shifts; failing that, the one seen longest ago
    const unseen = cand.filter((a) => !o.recent.includes(a.id));
    if (unseen.length) cand = unseen;
    else {
      const oldest = Math.min(...cand.map((a) => o.recent.lastIndexOf(a.id)));
      cand = cand.filter((a) => o.recent.lastIndexOf(a.id) === oldest);
    }
    const ws = cand.map(weight);
    let r = rng() * ws.reduce((s, w) => s + w, 0);
    let k = 0;
    while (k < cand.length - 1 && r >= ws[k]!) r -= ws[k++]!;
    const a = cand[k]!;
    used.add(a.id);
    const total = orderTotal(pack, job, a);
    plan.customers.push({
      templateId: a.id,
      line: a.line,
      task: a.task,
      thanks: a.thanks,
      ...(a.tiles ? { tiles: a.tiles } : {}),
      ...(a.change ? { change: a.change } : {}),
      ...(total !== undefined ? { total } : {}),
    } satisfies ShiftCustomer);
  }
  return plan;
}

/** Production credit of one answer: typed or spoken 1.00, tiles 0.50, a picked chip 0.35 (an answer with no recorded input counts as a pick). */
function creditOf(input: ShiftInput | undefined): number {
  if (input === 'typed' || input === 'spoken') return BALANCE.credit.I;
  return input === 'tiles' ? BALANCE.shift.tile : BALANCE.shift.chip;
}

/** F(r) = floor + span x r^2 (§3.3), the same independence curve conversations use. */
const indepFactor = (r: number): number => BALANCE.indep.floor + BALANCE.indep.span * r * r;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * ticks, r, perf = ticks x F(r), good / perfect / trial, `quit` and the feedback band (§9.2). Assist factors apply unless `assistWaived`.
 * `ticks` sums per customer: an order task is worth its assist factor (text shown 0.7, translation 0.5), total and thanks 1 each, a
 * greeting adds 10% (a customer never exceeds its 3 units); an unserved customer scores nothing. `perfect` means every scored task
 * was right (the optional greeting is not scored).
 */
export function scoreShift(result: ShiftResult): ShiftScore {
  const S = BALANCE.shift;
  let units = 0;
  let served = 0;
  let prod = 0;
  let prodN = 0;
  let allRight = true;
  for (const c of result.customers) {
    if (!c.served) {
      allRight = false;
      continue;
    }
    served++;
    const factor = result.assistWaived ? 1 : c.assist === 'text' ? S.assistText : c.assist === 'translation' ? S.assistTranslation : 1;
    let u = 0;
    let greeted = false;
    for (const t of c.tasks) {
      if (t.kind === 'greet') {
        greeted ||= t.ok;
      } else if (!t.ok) {
        allRight = false;
      } else if (t.kind === 'order') {
        u += factor;
      } else {
        u += 1;
        prod += creditOf(t.input);
        prodN++;
      }
    }
    if (greeted) u *= 1 + S.greetBonus;
    units += Math.min(S.tasksPerCustomer, u);
  }
  const ticks = clamp01(units / S.units);
  const r = prodN ? prod / prodN : 0;
  const perf = clamp01(ticks * indepFactor(r));
  const quit = result.quit;
  const good = !quit && served >= S.customers && ticks + EPS >= S.accuracy;
  return {
    served,
    ticks,
    r,
    perf,
    good,
    perfect: good && allRight,
    trial: !quit && served >= S.trialMinServed && ticks + EPS < S.accuracy,
    quit,
    band: ticks + EPS >= S.bands.perfect ? 'perfect' : ticks + EPS >= S.bands.nice ? 'nice' : ticks + EPS >= S.bands.almost ? 'almost' : 'retry',
  };
}

const roundPay = (x: number): number => Math.round(x / BALANCE.shift.payRound) * BALANCE.shift.payRound;

/**
 * round10(wage x hours x rankMult[rank] x perf x repeatMult); the trial wage for a trial shift; 0 when quit (or cut short) with < 2
 * served, x0.6 when quit (§9.2). 0 when the day's repeat multiplier is 0. `pack` scales the trial wage with the pack's income (the
 * wage itself is pack data and is not scaled); without it the trial wage is the reference amount.
 */
export function shiftPay(job: JobDef, score: ShiftScore, rank: number, repeatMult: number, pack: GamePack | undefined = undefined): number {
  const S = BALANCE.shift;
  if (!(repeatMult > 0) || score.served < S.quitMinServed) return 0;
  if (score.trial) return roundPay(pack ? scaleAmount(S.trial, pack.economy, pack.currency) : S.trial);
  const mult = S.rankMult[Math.max(0, Math.min(S.rankMult.length - 1, Math.trunc(rank) || 0))]!;
  const full = job.wage * job.hours * mult * score.perf * repeatMult;
  return roundPay(score.quit ? full * S.quitMult : full);
}

/** Today's repeat multiplier for starting a shift at this job: 1, then 0.6 (another job) or 0.5 (same job), then 0 = unavailable. */
export function shiftRepeatMult(state: GameState, jobId: string): number {
  const S = BALANCE.shift;
  const sh = payForDay(state.pay, dayKey(state.clock.dayIndex)).shiftsToday;
  const total = Object.values(sh).reduce((a, b) => a + b, 0);
  if (total >= S.dailyMax) return 0;
  const table = (sh[jobId] ?? 0) > 0 ? S.sameJobRepeat : S.repeat;
  return table[Math.min(total, table.length - 1)] ?? 0;
}

/** Rank 0-4 from the count of good shifts (BALANCE.shift.promoteAt). */
export function rankFor(good: number): number {
  return BALANCE.shift.promoteAt.filter((n) => good >= n).length;
}

/** Whether the assist factors are waived for the next shift at a job: its first shifts, or no Japanese voice (`listenPref` off, a read-and-type / type-only audio mode). Fills `ShiftResult.assistWaived`. */
export function shiftAssistWaived(state: GameState, jobId: string): boolean {
  return (state.jobs[jobId]?.shifts ?? 0) < BALANCE.shift.assistWaivedShifts || state.audio.listenPref === 'off' || SILENT_MODES.includes(state.audio.lastMode ?? '');
}

/**
 * The `shift_done` event: scores the result, pays `shiftPay` through the ledger (`shift:<day>:<job>:<n>`), updates `jobs[jobId]`
 * (shifts, good, perfect, rank, lastDay, recent order signatures), `pay.shiftsToday` and `pay.langToday`, grants the perfect-shift
 * bonus item, and emits `unlocked` / rank-up derived events. A refused third shift (repeat multiplier 0) changes nothing; neither
 * does a shift that pays nothing (quit before 2 customers), so it neither uses a daily slot nor counts. A result is applied once
 * (its `id` is remembered in the `seen` ring). The language yen of the day are soft-capped like a conversation's (BALANCE.softCap).
 */
export function applyShift(state: GameState, jobId: string, result: ShiftResult, ctx: ReduceCtx): ReduceResult {
  const { pack } = ctx;
  const none: ReduceResult = { state, derived: [], effects: [] };
  const job = pack.jobs.find((j) => j.id === jobId);
  const mark = `shift_ev:${result.id}`;
  if (!job || state.seen.includes(mark)) return none;
  const repeat = shiftRepeatMult(state, jobId);
  if (repeat <= 0) return none;

  const day = dayKey(state.clock.dayIndex);
  const js = state.jobs[jobId] ?? emptyJob();
  const score = scoreShift({ ...result, jobId });
  const rankBefore = js.rank;
  let pay = shiftPay(job, score, rankBefore, repeat, pack);
  if (pay <= 0) return none;

  const today = payForDay(state.pay, day);
  const room = Math.max(0, scaleAmount(BALANCE.softCap, pack.economy, pack.currency) - today.langToday);
  if (pay > room) pay = roundPay(room + (pay - room) * BALANCE.softCapFactor);

  const n = (today.shiftsToday[jobId] ?? 0) + 1;
  const r = applyLedger(state, { id: LEDGER_IDS.shift(day, jobId, n), at: ctx.now, kind: 'shift', delta: pay, pocket: 'cash', ref: result.id }, walletLimits(state, pack));
  if (r.reason === 'duplicate') return none;
  const paid = r.state.wallet.cash - state.wallet.cash;

  const good = js.good + (score.good ? 1 : 0);
  const rankAfter = Math.max(rankBefore, rankFor(good));
  const keep = BALANCE.shift.variety.noRepeatShifts * BALANCE.shift.customers;
  let next: GameState = {
    ...r.state,
    seen: [...r.state.seen, mark].slice(-BALANCE.ledger.seen),
    jobs: {
      ...r.state.jobs,
      [jobId]: {
        ...js,
        shifts: js.shifts + 1,
        good,
        perfect: js.perfect + (score.perfect ? 1 : 0),
        rank: rankAfter,
        lastDay: day,
        recent: [...js.recent, ...result.customers.map((c) => c.templateId)].slice(-keep),
      },
    },
    pay: { ...today, shiftsToday: { ...today.shiftsToday, [jobId]: n }, langToday: today.langToday + paid },
  };

  const derived: DerivedEvent[] = [];
  if (paid > 0) derived.push({ t: 'wallet_changed', delta: paid, balance: next.wallet.cash, kind: 'shift' });
  if (score.perfect) {
    next = grantItem(next, pack, job.bonus.itemId, 1, day);
    derived.push({ t: 'unlocked', what: 'item', id: job.bonus.itemId });
  }
  derived.push({ t: 'shift_settled', jobId, score, pay: paid, rankBefore, rankAfter });
  return { state: next, derived, effects: [] };
}
