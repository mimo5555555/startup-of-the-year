// The real reducer over JP_PACK, driven the way the screens drive it (a helper for realLife.test.ts, not a test): a day clock, the story
// beats a screen would play, conversations through the real ConversationSession with the host's plans (friends, gifts, phone threads),
// purchases, the ramen ticket, shifts. `convo` settles exactly like Conversation.tsx's `finish` (gift first, then the talk, then the plan).
import { CHARACTERS, JP_PACK, scenarioById } from '@lw/content';
import { ConversationSession } from '@lw/engine';
import {
  BALANCE,
  chapterStatus,
  createGameState,
  heartsForAp,
  objectiveRows,
  quote,
  reduce,
  type ConversationFacts,
  type GameState,
  type GameView,
  type InputEvent,
  type ReduceResult,
  type UiEffect,
} from '@lw/game';
import { createConvoGame } from '../src/game/convoHooks';
import { completeFriendFacts, giftEventOf, heartEventOfBeat, planFriendConvo } from '../src/game/friendsLogic';
import { cultureSaidIn } from '../src/game/cultureLogic';
import { planAccepted, planChat, planFlagEvent } from '../src/game/phoneLogic';
import { ramenEvents, ramenPrice } from '../src/components/game/panelLogic';

export const BASE = new Date(2030, 0, 15, 12).getTime();
export const DAY = 86_400_000;
export const view: GameView = { vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() }, discovered: [], lessonsDone: [], streakDays: 0, profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' } };

export const H = { now: BASE, state: createGameState(JP_PACK, BASE) as GameState, rng: () => 0.5 };
export const queue: string[] = [];
export const log: string[] = [];
let sid = 0;

export function reset(): void {
  H.now = BASE;
  H.state = createGameState(JP_PACK, BASE);
  queue.length = 0;
  log.length = 0;
  view.lessonsDone.length = 0;
  view.discovered.length = 0;
  view.vocab.total = 0;
  view.vocab.reviewedKeys.clear();
  sid = 0;
}

export function dispatch(ev: InputEvent): ReduceResult {
  const r = reduce(H.state, ev, { pack: JP_PACK, now: H.now, view, rng: H.rng });
  H.state = r.state;
  for (const e of r.effects as UiEffect[]) if (e.t === 'beat' && JP_PACK.beats[e.id] && !queue.includes(e.id)) queue.push(e.id);
  for (const d of r.derived) {
    if (d.t === 'heart_event_ready') {
      const b = JP_PACK.friends.find((f) => f.id === d.friendId)?.events?.find((e) => e.heart === d.level)?.beat;
      if (b && JP_PACK.beats[b] && !queue.includes(b)) queue.push(b);
    }
    if (d.t === 'chapter_done' || d.t === 'chapter_started' || d.t === 'objective_done' || d.t === 'dream_step_done') log.push(`  ${d.t} ${JSON.stringify(d)}`);
  }
  return r;
}

export function beats(): void {
  while (queue.length) {
    const id = queue.shift()!;
    dispatch({ t: 'beat_done', id });
    const h = heartEventOfBeat(JP_PACK, id);
    if (h) dispatch({ t: 'heart_event_done', friendId: h.friendId, level: h.level });
    if (id === 'b_ch1_close') dispatch({ t: 'dream_chosen', id: 'phone_pal' });
  }
}

export function newDay(skip = 1): void {
  H.now += DAY * skip;
  dispatch({ t: 'day_observed', nowMs: H.now });
  beats();
}

export function convo(scenarioId: string, characterId: string, o: { lines?: string[]; itemId?: string; chat?: boolean; startNode?: string } = {}): { facts: ConversationFacts; ended: boolean } {
  const sc = scenarioById(scenarioId)!;
  const character = CHARACTERS.find((c) => c.id === characterId)!;
  const sessionId = `s${++sid}`;
  const friend = o.chat
    ? planChat(JP_PACK, H.state, characterId)
    : planFriendConvo(JP_PACK, H.state, { scenarioId, characterId, startNode: o.startNode, itemId: o.itemId }, { nodeIds: Object.keys(sc.nodes), interests: character.interests, rng: () => 0.3 });
  const g = createConvoGame({ pack: JP_PACK, scenarioId, sessionId, state: () => H.state, view: () => view, commit: dispatch, friend });
  const session = new ConversationSession({ scenario: sc, character, l1: 'en', profileName: 'Sam', topics: [], sessionId, game: g.hooks, flags: g.flags, startNode: o.startNode ?? friend?.startNode, recalled: g.recalled, policy: BALANCE });
  session.start();
  for (const l of o.lines ?? []) if (!session.ended) session.submit({ text: l, mode: 'typed_ja' });
  let guard = 0;
  while (!session.ended && guard++ < 40) session.pickSuggestion(0);
  const facts0 = session.facts({ mode: 'guided', prepared: false });
  const facts1 = g.friend ? completeFriendFacts(g.friend, facts0, session.stepsDone) : facts0;
  const facts = { ...facts1, cultureSaid: cultureSaidIn(JP_PACK, facts1) };
  const gift = g.friend ? giftEventOf(g.friend, facts) : null;
  if (gift) dispatch(gift);
  dispatch({ t: 'conversation_done', facts });
  if (o.chat && planAccepted(scenarioId, session.stepsDone)) dispatch(planFlagEvent(characterId, H.state.clock.dayIndex));
  beats();
  return { facts, ended: session.ended };
}

export function status(label: string): void {
  const st = chapterStatus(JP_PACK, H.state, view);
  const rows = objectiveRows(JP_PACK, H.state, view).map((r) => `${r.id}${r.done ? '✓' : `${r.progress.done}/${r.progress.total}`}`).join(' ');
  const fr = Object.entries(H.state.friends).map(([id, f]) => `${id}:${f.ap}(${heartsForAp(f.ap)})`).join(' ');
  console.log(`[${label}] day${H.state.clock.dayIndex} act${H.state.clock.activeDays} ch${H.state.chapter.n} ${JSON.stringify(st)} cash${H.state.wallet.cash} | ${rows} | ${fr}`);
  if (log.length) console.log(log.splice(0).join('\n'));
}

export function buy(shopId: string, itemId: string): boolean {
  const q = quote(JP_PACK, H.state, view, { shopId, itemId, qty: 1, method: 'cash' });
  if (q.block) return false;
  dispatch({ t: 'purchase', sessionId: `b${++sid}`, n: 1, shopId, itemId, qty: 1, total: q.total, method: 'cash', lines: [{ kind: 'item', ref: itemId, label: { en: itemId, ar: itemId }, qty: 1, unit: q.total, amount: q.total }] });
  return true;
}

export function shift(n: number, o: { quit?: boolean; served?: number; ok?: boolean; jobId?: string } = {}): void {
  const job = (o.jobId ? JP_PACK.jobs.find((j) => j.id === o.jobId) : undefined) ?? JP_PACK.jobs[0]!;
  const ok = o.ok ?? true;
  const customers = job.archetypes.slice(0, o.served ?? 5).map((a) => ({ templateId: a.id, served: true, assist: 'none' as const, tasks: [{ kind: 'order' as const, ok }, { kind: 'total' as const, ok, input: 'typed' as const }, { kind: 'thanks' as const, ok, input: 'typed' as const }] }));
  dispatch({ t: 'shift_done', jobId: job.id, result: { id: `shift${n}`, jobId: job.id, customers, quit: o.quit ?? false, durationSec: 100, assistWaived: true } });
}

export function ramen(): void {
  const order = { flavor: 'shoyu', extras: [] as string[] };
  const price = ramenPrice(JP_PACK, H.state, view, order, 'coins');
  for (const e of ramenEvents(`r${++sid}`, order, price, 'coins')) dispatch(e);
  convo('ramen', 'kenji', { startNode: 'start_ticket', lines: ['いただきます', 'ごちそうさまでした'] });
}
