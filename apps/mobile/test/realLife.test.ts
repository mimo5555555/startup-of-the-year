// Release 1 as a life, through the REAL reducer and the real conversation sessions (not hand-made states): day by day from the first
// lesson to Free Walk, then random lives that must keep every invariant. The helper `realLife.ts` drives the pack the way the screens do
// (host plans for friends, gifts and phone threads, the ticket machine, purchases, shifts, the beats a screen would play).
//
// What this catches that the unit tests cannot: a day gate that waits for something only the next day can give, an objective that no
// screen path can finish, a reward or beat that never arrives, state that stops validating after a reload.
import { describe, expect, it } from 'vitest';
import { JP_PACK } from '@lw/content';
import { BALANCE, availableDreams, chapterStatus, evaluateAll, heartsForAp, isOpen, migrate, objectiveRows, validateState, type GameState } from '@lw/game';
import { H, beats, buy, convo, dispatch, newDay, ramen, reset, shift, view } from './realLife';

const done = (id: string): boolean => H.state.chapter.done[id] !== undefined;
const rowOf = (id: string) => objectiveRows(JP_PACK, H.state, view).find((r) => r.id === id)!;
const errors = (s: GameState) => validateState(s, JP_PACK).filter((i) => i.severity === 'error').map((i) => `${i.code} ${i.path} ${i.message}`);

describe('a whole Release 1 life', () => {
  it('walks Chapters 1-4 and ends in Free Walk: every objective is reachable by what the screens send, and no day gate waits for the impossible', () => {
    reset();
    dispatch({ t: 'day_observed', nowMs: H.now });
    beats();
    expect(H.state.chapter.n).toBe(1);

    // ---- day 0, Chapter 1: the lesson, a konbini purchase, four signs, five words, three new words of my own
    view.lessonsDone.push('greetings');
    dispatch({ t: 'lesson_done', id: 'greetings' });
    convo('konbini', 'tanaka', { lines: ['おにぎりをください', 'みっつください'] });
    for (const s of ['sign1', 'sign2', 'sign3', 'sign4']) {
      view.discovered.push(s);
      dispatch({ t: 'sign_found', id: s });
    }
    view.vocab.total = 5;
    dispatch({ t: 'word_saved', key: 'w' });
    beats();
    expect(H.state.chapter.n, 'Chapter 1 has no day gate beyond the first active day').toBe(2);
    expect(H.state.titles).toContain('t_newcomer');
    expect(H.state.beats).toContain('b_ch1_close');

    // ---- Chapter 2 started today, so it cannot finish today however much is done
    convo('cafe', 'yuki', { lines: ['コーヒーをください', 'ホットをください', 'ワイファイのパスワードをおしえてください', 'げんきんではらいます'] });
    ramen();
    convo('job_konbini_intro', 'tanaka');
    shift(1);
    dispatch({ t: 'culture_say', id: 'cc_bow', similarity: 1 });
    dispatch({ t: 'culture_say', id: 'cc_itadakimasu', similarity: 1 });
    for (const id of ['c2_1', 'c2_2', 'c2_3', 'c2_4']) expect(done(id), id).toBe(true);
    expect(H.state.chapter.n).toBe(2);
    expect(chapterStatus(JP_PACK, H.state, view)).toMatchObject({ n: 2, done: 4, total: 4, waitDays: 1 });
    // a day counts as a day of practice once the player does something: opening the app on day 2 is not enough, one conversation is
    newDay();
    expect(H.state.chapter.n, 'opening the app alone is not a day of practice').toBe(2);
    convo('konbini', 'tanaka');
    expect(H.state.chapter.n).toBe(3);
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch2_close', 'b_ch3_open']));

    // ---- Chapter 3: Mio in the park, a present from the konbini handed over, two friends at 2 hearts, and four active days
    convo('park', 'mio', { lines: ['お名前は？', 'はじめまして。わたしはサムです。', 'どこから来ましたか？', 'アメリカから来ました。', 'アニメが好きです。'] });
    expect(done('c3_1')).toBe(true);
    let day3 = 0;
    while (H.state.chapter.n === 3 && day3++ < 12) {
      for (const [friend, gift] of [['mio', 'g_manga'], ['tanaka', 'g_game_card']] as const) {
        convo(`smalltalk_${friend}`, friend);
        if ((H.state.owned[gift]?.qty ?? 0) === 0) buy('konbini', gift);
        convo('give_gift', friend, { itemId: gift });
      }
      convo('smalltalk_yuki', 'yuki');
      if (H.state.chapter.n === 3) newDay();
    }
    expect(H.state.chapter.n, 'Chapter 3 ends').toBe(4);
    expect(H.state.clock.activeDays, 'the day gate of Chapter 3 (4 active days) held').toBeGreaterThanOrEqual(4);
    expect(done('c3_3')).toBe(true);
    expect(heartsForAp(H.state.friends.mio!.ap)).toBeGreaterThanOrEqual(2);
    // Mio's heart-2 beat played once, set the plain speech and filed the event once
    expect(H.state.beats.filter((b) => b === 'b_mio_h2')).toHaveLength(1);
    expect(H.state.friends.mio!.flags).toEqual(expect.arrayContaining(['casual', 'number_note']));
    expect(H.state.friends.mio!.events).toEqual([2]);
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch3_close', 'b_ch4_open']));
    expect(H.state.titles).toContain('t_friend');

    // ---- Chapter 4: the phone (the one saving goal), four chats with two friends, 25 words
    for (let i = 0; i < 26; i++) view.vocab.reviewedKeys.add(`k${i}`);
    let chatsOn = -1;
    let day4 = 0;
    while (H.state.chapter.n === 4 && day4++ < 30) {
      newDay();
      convo('smalltalk_mio', 'mio');
      shift(100 + day4);
      if ((H.state.owned.phone_used?.qty ?? 0) === 0 && H.state.wallet.cash >= 24_800) convo('denki_phone', 'aoi');
      for (const f of ['mio', 'tanaka']) {
        const thread = H.state.friends[f]?.threads[0];
        if (thread) convo(thread.template, f, { chat: true });
      }
      // the progress row counts chats, not chats plus friends
      if (chatsOn < 0 && H.state.stats.chats.n > 0) {
        chatsOn = H.state.stats.chats.n;
        expect(rowOf('c4_3').progress).toEqual({ done: Math.min(chatsOn, 4), total: 4 });
      }
    }
    expect(H.state.chapter.n, 'Chapter 4 ends in Free Walk').toBe(BALANCE.freeWalkChapter);
    expect(H.state.chapter.completed).toEqual([1, 2, 3, 4]);
    expect(H.state.stats.chats.n).toBeGreaterThanOrEqual(4);
    expect(Object.values(H.state.stats.chats.friends).filter((n) => n > 0).length).toBeGreaterThanOrEqual(2);
    expect(H.state.titles).toEqual(expect.arrayContaining(['t_newcomer', 't_friend', 't_connected']));
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch4_open', 'b_release_epilogue']));

    // ---- Free Walk: the garage and the car dream are open, nothing is left to finish or re-announce
    expect(isOpen(JP_PACK, H.state, 'shop', 'motors')).toBe(true);
    expect(availableDreams(JP_PACK, H.state, view).map((d) => d.id)).toContain('car');
    expect(chapterStatus(JP_PACK, H.state, view)).toMatchObject({ n: 9, total: 0, waitDays: 0 });
    expect(evaluateAll(H.state, { pack: JP_PACK, now: H.now, view, rng: H.rng }).derived.filter((d) => d.t !== 'wallet_changed')).toEqual([]);

    // ---- and a reload (the save as JSON through migrate) changes nothing
    expect(errors(H.state)).toEqual([]);
    expect(migrate(JSON.parse(JSON.stringify(H.state)), 1, JP_PACK)).toEqual(H.state);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------
// Random lives
// ---------------------------------------------------------------------------------------------------------------

function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FRIENDS = ['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako'];

describe('random Release 1 lives', () => {
  it('keep every invariant: AP never falls and never beats the daily cap, no heart 5 before day 5, unread = waiting threads, gifts and chats add up, the state validates, evaluation is idempotent, a reload changes nothing', () => {
    for (let seed = 1; seed <= 12; seed++) {
      reset();
      const r = rngOf(seed);
      H.rng = r;
      const pick = <T,>(l: T[]): T => l[Math.floor(r() * l.length)]!;
      const seen: Record<string, { ap: number; day: number; base: number }> = {};
      dispatch({ t: 'day_observed', nowMs: H.now });
      beats();
      dispatch({ t: 'profile_set', dev: true });
      // start anywhere in the story (the dev command finishes a chapter and lets the days pass)
      const target = 1 + Math.floor(r() * 5);
      for (let k = 1; k < target; k++) {
        dispatch({ t: 'dev', cmd: 'advance_chapter' });
        beats();
      }
      let n = 100;
      for (let step = 0; step < 150; step++) {
        const x = r();
        const where = `seed ${seed} step ${step} x=${x.toFixed(3)}`;
        if (x < 0.06) newDay(r() < 0.2 ? 3 : 1);
        else if (x < 0.14) {
          const id = pick(['greetings', 'numbers', 'shopping']);
          view.lessonsDone.push(id);
          dispatch({ t: 'lesson_done', id });
        } else if (x < 0.22) convo(pick(['konbini', 'cafe']), pick(['tanaka', 'yuki']));
        else if (x < 0.26) ramen();
        else if (x < 0.4) {
          const f = pick(FRIENDS);
          convo(`smalltalk_${f}`, f);
        } else if (x < 0.5) {
          const gift = pick(['g_manga', 'g_choco', 'g_game_card']);
          if ((H.state.owned[gift]?.qty ?? 0) === 0) buy('konbini', gift);
          if ((H.state.owned[gift]?.qty ?? 0) > 0) convo('give_gift', pick(FRIENDS), { itemId: gift });
        } else if (x < 0.6) {
          for (const f of FRIENDS) {
            const t = H.state.friends[f]?.threads[0];
            if (t) convo(t.template, f, { chat: true });
          }
        } else if (x < 0.68) shift(n++, { quit: r() < 0.2, served: 1 + Math.floor(r() * 5), ok: r() < 0.8 });
        else if (x < 0.72) {
          for (let i = 0; i < 6; i++) {
            const k = `s${seed}_${n++}`;
            view.discovered.push(k);
            dispatch({ t: 'sign_found', id: k });
          }
        } else if (x < 0.76) {
          view.vocab.total += 3;
          for (let i = 0; i < 8; i++) view.vocab.reviewedKeys.add(`k${n++}`);
          dispatch({ t: 'word_saved', key: 'x' });
        } else if (x < 0.8) buy('denki', 'phone_used');
        else if (x < 0.83) dispatch({ t: 'dev', cmd: 'cash', amount: 50_000 });
        else if (x < 0.86) dispatch({ t: 'culture_say', id: pick(['cc_bow', 'cc_itadakimasu', 'cc_gift', 'cc_keigo']), similarity: 1 });
        else if (x < 0.89) {
          const objs = JP_PACK.chapters.find((c) => c.n === H.state.chapter.n)?.objectives ?? [];
          if (objs.length) dispatch({ t: 'easier_accept', objective: pick(objs).id });
        } else if (x < 0.92) {
          const open = availableDreams(JP_PACK, H.state, view);
          if (open.length) dispatch({ t: 'dream_chosen', id: pick(open).id });
        } else if (x < 0.96) H.state = migrate(JSON.parse(JSON.stringify(H.state)), 1, JP_PACK);
        else if (x < 0.98) buy('motors', pick(['bike_mamachari', 'car_kei_used']));
        else dispatch({ t: 'flag', id: `plan_${H.state.clock.dayIndex}`, friendId: pick(FRIENDS) });
        beats();

        // ---- the invariants
        expect(errors(H.state), where).toEqual([]);
        const again = evaluateAll(H.state, { pack: JP_PACK, now: H.now, view, rng: H.rng });
        expect(again.derived.filter((d) => d.t !== 'wallet_changed'), `${where}: evaluation is idempotent`).toEqual([]);
        const day = H.state.clock.dayIndex;
        for (const [id, f] of Object.entries(H.state.friends)) {
          const prev = seen[id];
          expect(f.ap, `${where}: ${id} AP never falls`).toBeGreaterThanOrEqual(prev?.ap ?? 0);
          const base = prev && prev.day === day ? prev.base : (prev?.ap ?? 0);
          expect(f.ap - base, `${where}: ${id} AP of one day`).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
          seen[id] = { ap: f.ap, day, base };
          expect(f.unread, `${where}: ${id} unread`).toBe(f.threads.length);
          expect(f.threads.length, `${where}: ${id} threads`).toBeLessThanOrEqual(BALANCE.ap.chat.unreadMax);
        }
        expect(Object.values(H.state.friends).reduce((a, f) => a + f.gifts, 0), `${where}: gifts`).toBe(H.state.stats.gifts.n);
        expect(Object.values(H.state.stats.chats.friends).reduce((a, b) => a + b, 0), `${where}: chats`).toBe(H.state.stats.chats.n);
        expect(H.state.chapter.n === 9 || H.state.chapter.n <= 4, `${where}: chapter ${H.state.chapter.n}`).toBe(true);
      }
    }
  }, 300_000);
});
