// Dream goals: offers, defaults, derived progress (agent 1D). Progress is derived from state, so switching dreams loses nothing:
// `dream.steps` only remembers the first day a step held (step ids are unique across the pack's dreams).
import { BALANCE } from './balance';
import { dayKey } from './ledger';
import { evalPred, objectivesLeft, openChapter } from './objectives';
import type { EvalOut } from './objectives';
import type { DreamDef, DreamProgress, GamePack, GameState, GameView, ItemDef, ReduceCtx } from './types';

/** The pack's own onboarding-goal table is `DreamDef.defaultFor`; this is the §7.3 fallback for a pack that does not fill it. */
const DEFAULT_BY_GOAL: Record<string, string> = { travel: 'travel', work: 'phone_pal', relocation: 'flat', casual: 'festival' };

/** D28: a dream with `ageMin` is hidden below that age (compared with the age group's lowest age). */
function ageAllows(pack: GamePack, view: GameView, ageMin: number | undefined): boolean {
  if (ageMin === undefined) return true;
  const floor = pack.ageProfiles[view.profile.age]?.ageFloor;
  return floor !== undefined && floor >= ageMin;
}

/** Dreams the player may pick now: age rules (D28) and `openChapter` (the car opens at Free Walk). */
export function availableDreams(pack: GamePack, state: GameState, view: GameView): DreamDef[] {
  return pack.dreams.filter((d) => ageAllows(pack, view, d.ageMin) && state.chapter.n >= (d.openChapter ?? 1));
}

/** The silent default dream from the onboarding goal (travel -> travel, work -> phone_pal, relocation -> flat, casual -> festival), age-filtered. */
export function defaultDream(pack: GamePack, view: GameView): string | null {
  const offered = pack.dreams.filter((d) => ageAllows(pack, view, d.ageMin) && (d.openChapter ?? 1) <= 1);
  const goal = view.profile.goal;
  const byPack = offered.find((d) => d.defaultFor?.includes(goal));
  if (byPack) return byPack.id;
  const byTable = DEFAULT_BY_GOAL[goal];
  const table = offered.find((d) => d.id === byTable);
  if (table) return table.id;
  // a kid whose goal maps to an 18+ dream (relocation -> flat) gets the festival, else the first dream they may see
  return (offered.find((d) => d.id === DEFAULT_BY_GOAL.casual) ?? offered[0])?.id ?? null;
}

/** The dream picker is shown once Chapter 1's closing beat is done (`DerivedFlags.dreamUnlocked`). */
export function dreamPickerShown(pack: GamePack, state: GameState): boolean {
  const first = [...pack.chapters].sort((a, b) => a.n - b.n)[0];
  return !!first && state.beats.includes(first.beats.close);
}

/** The dream being tracked: the chosen one, or, until the picker has been shown, the silent default from the onboarding goal. */
export function effectiveDream(pack: GamePack, state: GameState, view: GameView): string | null {
  if (state.dream.id) return state.dream.id;
  return dreamPickerShown(pack, state) ? null : defaultDream(pack, view);
}

const owned = (state: GameState, id: string): boolean => (state.owned[id]?.qty ?? 0) > 0;

/** Small home goods: what an `item_placed` step is furnished with (bulky pieces arrive by delivery and cost more to count). */
const isSmallGood = (i: ItemDef): boolean => i.cat === 'home' && !i.bulky && i.price > 0;

/** Sum of the dream's unowned items plus bulky-item delivery and the cheapest small goods for an `item_placed` step (§7.3). */
export function remainingCost(pack: GamePack, state: GameState, dream: DreamDef): number {
  let total = 0;
  for (const id of dream.items) {
    const item = pack.items.find((i) => i.id === id);
    if (!item || owned(state, id)) continue;
    total += item.price;
    if (item.bulky) total += pack.rules.deliveryFee;
    // a bicycle is registered at the shop (防犯登録): the fee is part of owning one
    if (item.tags.includes('bicycle')) total += pack.rules.registrationFee ?? 0;
  }
  if (dream.furnish) {
    // goods already owned count toward the pieces to place, so only the shortfall is priced, from the cheapest unowned
    const small = pack.items.filter(isSmallGood);
    const have = small.filter((i) => owned(state, i.id)).length;
    const need = Math.max(0, dream.furnish - have);
    total += small
      .filter((i) => !owned(state, i.id))
      .map((i) => i.price)
      .sort((a, b) => a - b)
      .slice(0, need)
      .reduce((a, b) => a + b, 0);
  }
  return total;
}

/** The chapter in which the dream's next purchase opens (item gate and its shop), or null when nothing is left to buy. */
function nextPurchaseChapter(pack: GamePack, state: GameState, dream: DreamDef): number | null {
  for (const id of dream.items) {
    const item = pack.items.find((i) => i.id === id);
    if (!item || owned(state, id)) continue;
    return Math.max(openChapter(pack, 'item', id), openChapter(pack, 'shop', item.shop));
  }
  return null;
}

/** The tracker view of a dream: steps, ring, yen bar (cash only), language gate and the pace estimate. Derived from state, nothing stored. */
export function dreamProgress(state: GameState, ctx: Pick<ReduceCtx, 'pack' | 'view'>, dreamId: string): DreamProgress {
  const { pack, view } = ctx;
  const def = pack.dreams.find((d) => d.id === dreamId);
  const cash = state.wallet.cash;
  if (!def) {
    return { dream: dreamId, steps: [], doneCount: 0, total: 0, nextStep: null, remainingCost: 0, cash, yenBar: 1, languageGate: { chapter: state.chapter.n, objectivesLeft: 0 }, etaDays: null };
  }
  const steps = def.steps.map((s) => {
    const visible = s.gate <= state.chapter.n;
    // recorded once seen done; otherwise it counts only when it is visible and holds right now
    const done = state.dream.steps[s.id] !== undefined || (visible && evalPred(s.pred, state, ctx));
    return { id: s.id, done, visible };
  });
  const remaining = remainingCost(pack, state, def);
  const yenBar = remaining <= 0 ? 1 : Math.min(1, cash / remaining);

  // the language gate: the purchase opens when chapter `ch` becomes current, i.e. after the objectives of the chapters before it
  const buyCh = nextPurchaseChapter(pack, state, def);
  const next = steps.find((s) => s.visible && !s.done);
  // nothing left to buy: the gate is the chapter of the first unfinished step
  const stepCh = def.steps.find((s) => !steps.find((x) => x.id === s.id)?.done)?.gate;
  const gateCh = buyCh ?? stepCh ?? state.chapter.n;
  const languageGate = {
    chapter: gateCh,
    objectivesLeft: gateCh > state.chapter.n ? objectivesLeft(pack, state, view, state.chapter.n, gateCh - 1) : 0,
  };

  // pace: mean net cash of the days on record; hidden until a few days exist
  const recent = state.income.slice(-BALANCE.dream.etaWindowDays);
  let etaDays: DreamProgress['etaDays'] = null;
  if (recent.length >= BALANCE.dream.etaMinDays) {
    const avg = recent.reduce((a, d) => a + d.net, 0) / recent.length;
    const days = Math.ceil(Math.max(0, remaining - cash) / Math.max(1, avg));
    etaDays = days > BALANCE.dream.etaMaxDays ? 'many' : days;
  }
  return {
    dream: def.id,
    steps,
    doneCount: steps.filter((s) => s.done).length,
    total: steps.length,
    nextStep: next?.id ?? null,
    remainingCost: remaining,
    cash,
    yenBar,
    languageGate,
    etaDays,
  };
}

/**
 * Records the tracked dream's steps that hold (they only become visible from their gate chapter), grants the step-2 sticker and
 * milestone beat, and on the last step the finale: title, keepsake and beat, never yen (D20). Only a chosen dream finishes; the
 * silent default tracks steps but waits to be picked.
 */
export function evaluateDream(state: GameState, ctx: ReduceCtx, out: EvalOut): GameState {
  const id = effectiveDream(ctx.pack, state, ctx.view);
  const def = id ? ctx.pack.dreams.find((d) => d.id === id) : undefined;
  if (!def || state.chapter.n < (def.openChapter ?? 1)) return state;

  let s = state;
  let steps = s.dream.steps;
  def.steps.forEach((step, i) => {
    if (steps[step.id] !== undefined || step.gate > s.chapter.n || !evalPred(step.pred, s, ctx)) return;
    steps = { ...steps, [step.id]: dayKey(s.clock.dayIndex) };
    out.derived.push({ t: 'dream_step_done', dream: def.id, step: step.id });
    out.effects.push({ t: 'toast', key: 'dream.stepDone', vars: { dream: def.id, step: step.id } });
    // the milestone: step number `milestoneStep` of any dream pays a cosmetic sticker and a one-line beat
    if (i + 1 === BALANCE.dream.milestoneStep && !s.stickers.includes(def.sticker)) {
      s = { ...s, stickers: [...s.stickers, def.sticker] };
      out.derived.push({ t: 'sticker_earned', id: def.sticker });
      out.effects.push({ t: 'beat', id: 'b_dream_step' });
    }
  });
  if (steps !== s.dream.steps) s = { ...s, dream: { ...s.dream, steps } };

  if (s.dream.id === def.id && !s.dream.done && def.steps.length > 0 && def.steps.every((st) => s.dream.steps[st.id] !== undefined)) {
    s = { ...s, dream: { ...s.dream, done: true } };
    out.derived.push({ t: 'dream_done', dream: def.id });
    out.effects.push({ t: 'toast', key: 'dream.done' }, { t: 'fanfare', kind: 'dream' });
    if (!s.titles.includes(def.title)) {
      s = { ...s, titles: [...s.titles, def.title] };
      out.derived.push({ t: 'title_earned', id: def.title });
    }
    if (def.keepsake && !s.keepsakes.includes(def.keepsake)) s = { ...s, keepsakes: [...s.keepsakes, def.keepsake] };
    if (!s.beats.includes(def.beat)) out.effects.push({ t: 'beat', id: def.beat });
  }
  return s;
}
