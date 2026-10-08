import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS, LEXICON } from '@lw/content';
import { validateState, migrate, type InputEvent } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { applySrsOps, completeBeat, dispatch, init, observeDay, resetBridgeForTests } from '../src/game/bridge';
import { flushGameNow, getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { flushNow, useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

const DAY = 86_400_000;
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };

function rng(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length)]!;

async function reload() { flushNow(); flushGameNow(); resetBridgeForTests(); useStore.setState({ ready: false }); await init(); }

beforeEach(async () => {
  wipeSaved(); useStore.getState().reset(); useUi.getState().clearRequests(); resetBridgeForTests(); useGame.getState().resetGame(); wipeSaved();
  await init(); useStore.getState().completeOnboarding(profile);
});

// Adversarial review (slices 1+2): random streams of v1-store actions and game events through the REAL bridge and stores. After every step the
// state must validate and survive a save/load (`migrate`) unchanged.
describe('app-level fuzz', () => {
  it('random app-level streams keep the state valid', async () => {
    const words = LEXICON.all().filter((e) => !e.g).slice(0, 60);
    const beats = Object.keys(PACK.beats);
    const scen = PACK.scenarioMeta.map((m) => m.id);
    const pockets = Object.keys(PACK.pockets);
    const objs = PACK.chapters.flatMap((c) => c.objectives.map((o) => o.id));
    const items = PACK.items.map((i) => i.id);
    const shops = PACK.shops.map((s) => s.id);
    const fr = PACK.friends.map((f) => f.id);
    for (let seed = 1; seed <= 8; seed++) {
      const r = rng(seed * 7919);
      useStore.getState().reset(); useUi.getState().clearRequests(); wipeSaved(); resetBridgeForTests(); useGame.getState().resetGame(); await init(); useStore.getState().completeOnboarding(profile);
      dispatch({ t: 'profile_set', dev: true });
      let now = Date.now();
      for (let i = 0; i < 160; i++) {
        const k = Math.floor(r() * 30);
        const where = `seed ${seed} step ${i} k ${k}`;
        try {
          const st = useStore.getState();
          switch (k) {
            case 0: st.completeLesson(pick(r, ['greetings', 'x']), 25); break;
            case 1: st.discover(`sign${Math.floor(r() * 8)}`); break;
            case 2: { const w = pick(r, words); st.saveWord({ kind: 'word', s: w.s, rom: w.s, meaning: { en: w.en, ar: w.ar }, source: pick(r, ['sign', 'conversation', 'lesson', 'goal', 'prepare'] as const) }, r() < 0.5 ? { dueInMin: 1440 } : undefined); break; }
            case 3: if (st.vocab.length) st.removeWord(pick(r, st.vocab).id); break;
            case 4: if (st.vocab.length) st.reviewWord(pick(r, st.vocab).id, pick(r, ['again', 'good', 'easy'] as const)); break;
            case 5: dispatch({ t: 'day_observed', nowMs: (now += Math.floor((r() - 0.3) * 3 * DAY)) }); break;
            case 6: observeDay(now += Math.floor(r() * 2 * DAY)); break;
            case 7: dispatch({ t: 'beat_done', id: pick(r, beats) }); break;
            case 8: dispatch({ t: 'flag', id: pick(r, ['letter_written', 'dream_epilogue', 'plan_mio', 'zzz']), friendId: r() < 0.3 ? pick(r, [...fr, 'ghost']) : undefined }); break;
            case 9: dispatch({ t: 'dream_chosen', id: r() < 0.2 ? null : pick(r, [...PACK.dreams.map((d) => d.id), 'x']) }); break;
            case 10: dispatch({ t: 'dev', cmd: pick(r, ['cash', 'complete_objective', 'advance_chapter', 'advance_day'] as const), amount: Math.floor((r() - 0.5) * 50000) }); break;
            case 11: dispatch({ t: 'easier_accept', objective: pick(r, [...objs, 'x']) }); break;
            case 12: dispatch({ t: 'prepare_done', scenarioId: pick(r, scen), ready: [pick(r, pockets)], seen: [pick(r, pockets), pick(r, pockets)] }); break;
            case 13: dispatch({ t: 'purchase', sessionId: `p${i}${seed}`, n: 1, shopId: pick(r, shops), itemId: pick(r, items), qty: 1 + Math.floor(r() * 3), total: 100, method: pick(r, ['cash', 'ic'] as const), lines: [] }); break;
            case 14: dispatch({ t: 'topup', id: `t${i}${seed}`, amount: Math.floor(r() * 5000) }); break;
            case 15: dispatch({ t: 'refund', id: `rf${i}${seed}` }); break;
            case 16: dispatch({ t: 'fare', id: `f${i}${seed}`, place: pick(r, ['hikarigaoka', 'x']), method: pick(r, ['cash', 'ic', 'paper'] as const), legs: pick(r, [1, 2] as const) }); break;
            case 17: dispatch({ t: 'visit', place: pick(r, ['festival', 'home:mio', 'x']) }); break;
            case 18: dispatch({ t: 'srs_review', keys: [pick(r, words).s], due: Math.floor(r() * 3) }); break;
            case 19: dispatch({ t: 'diary_added', entry: { chapter: 1 + Math.floor(r() * 9), ja: pick(r, ['きょう', 'あした', '']), assisted: false } }); break;
            case 20: dispatch({ t: 'daily_swap', goalId: pick(r, getGame().daily.goals.map((g) => g.id).concat('x')) }); break;
            case 21: applySrsOps([{ op: 'add', key: pick(r, words).s, kind: 'word', source: 'goal', dueInMin: 1440 }, { op: 'review', key: pick(r, words).s, grade: 'good' }]); break;
            case 22: dispatch({ t: 'conversation_done', facts: { sessionId: `s${i}${seed}`, scenarioId: pick(r, scen), characterId: pick(r, fr), mode: 'guided', abandoned: r() < 0.2, durationSec: 100, goalDone: 2, goalTotal: 3, turns: [{ id: 0, cls: 'I', credit: 1, substantive: true, contentTokens: 3, stepIds: [], norm: 'a' + i, newWords: [pick(r, words).s] }], fallbacks: 0, hintUses: 0, accuracy: 80, requestsPolite: true, prepared: false, remembered: {} } }); break;
            case 23: if (useUi.getState().beats.length) completeBeat(useUi.getState().beats[0]!); break;
            case 24: dispatch({ t: 'letter_saved', sentences: [{ ja: 'こんにちは', assisted: false }] }); break;
            case 25: dispatch({ t: 'coach_choice', card: pick(r, ['real', 'help', 'dismiss'] as const), scenarioId: pick(r, scen) }); break;
            case 26: dispatch({ t: 'echo', sessionId: `e${i}${seed}`, lineId: pick(r, pockets), similarity: r() }); break;
            case 27: dispatch({ t: 'culture_seen', id: 'cc_x' }); break;
            case 28: dispatch({ t: 'heart_event_done', friendId: pick(r, fr), level: 1 + Math.floor(r() * 5) }); break;
            case 29: if (r() < 0.2) { flushNow(); flushGameNow(); await reload(); } break;
          }
        } catch (e) { throw new Error(`${where}: ${(e as Error).stack}`); }
        const errs = validateState(getGame(), PACK);
        if (errs.length) throw new Error(`${where}: ${JSON.stringify(errs).slice(0, 600)}`);
        const g = getGame();
        const m = migrate(JSON.parse(JSON.stringify(g)), 1, PACK);
        const a = JSON.parse(JSON.stringify(g));
        const b = JSON.parse(JSON.stringify(m));
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          const diff = Object.keys(a).filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
          throw new Error(`${where}: migrate changed a live state: ${diff.join(',')} :: ${diff.map((d) => JSON.stringify(a[d]).slice(0, 300) + ' => ' + JSON.stringify(b[d]).slice(0, 300)).join('\n')}`);
        }
      }
    }
    expect(true).toBe(true);
  }, 120_000);
});
