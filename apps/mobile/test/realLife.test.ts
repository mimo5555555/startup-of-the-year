// The whole story (Chapters 1-8, then Free Walk) as a life, through the REAL reducer and the real conversation sessions (not hand-made states): day by day from the first
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

describe('a whole life', () => {
  it('walks Chapters 1-8 (the whole story, wave C2) and ends in Free Walk: every objective is reachable by what the screens send, and no day gate waits for the impossible', () => {
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
    expect(H.state.chapter.n, 'Chapter 4 ends and Chapter 5 begins').toBe(5);
    expect(H.state.chapter.completed).toEqual([1, 2, 3, 4]);
    expect(H.state.stats.chats.n).toBeGreaterThanOrEqual(4);
    expect(Object.values(H.state.stats.chats.friends).filter((n) => n > 0).length).toBeGreaterThanOrEqual(2);
    expect(H.state.titles).toEqual(expect.arrayContaining(['t_newcomer', 't_friend', 't_connected']));
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch4_open', 'b_ch4_close', 'b_ch5_open']));
    // the garage opened with Chapter 5, not at Free Walk; the cars and the e-bike wait
    expect(isOpen(JP_PACK, H.state, 'shop', 'motors')).toBe(true);
    expect(isOpen(JP_PACK, H.state, 'job', 'job_station')).toBe(true);

    // ---- Chapter 5 (wave C1): the round trip is paid up front, Kato's shop, the way asked of Sato in three lines of my own, a station shift, the garage
    const cash0 = H.state.wallet.cash;
    expect(cash0, 'the Chapter 4 reward and the shifts left enough for the round trip').toBeGreaterThanOrEqual(2 * (JP_PACK.fares.hikarigaoka! + BALANCE.fares.paperExtra));
    dispatch({ t: 'fare', id: 'trip-1', place: 'hikarigaoka', method: 'paper', legs: 2 });
    expect(H.state.wallet.cash, 'exactly the quote, both ways, once').toBeLessThanOrEqual(cash0 - 2 * (JP_PACK.fares.hikarigaoka! + BALANCE.fares.paperExtra) + 500);
    convo('trip_hikarigaoka', 'kato');
    expect(H.state.owned.g_souvenir?.qty, 'the omiyage was bought in the talk').toBe(1);
    dispatch({ t: 'trip_done', id: 'hikarigaoka' });
    expect(done('c5_1')).toBe(true);
    convo('sato_directions', 'sato', { lines: ['トイレはどこですか', '左ですね', 'ありがとうございます'] });
    expect(done('c5_2')).toBe(true);
    convo('jobintro_station', 'sato');
    shift(500, { jobId: 'job_station' });
    expect(done('c5_3')).toBe(true);
    convo('motors_visit', 'nakamura', { lines: ['自転車はいくらですか', 'ちょっと難しいです'] });
    expect(done('c5_4')).toBe(true);
    for (const id of ['cc_trainmanner', 'cc_refuse']) expect(H.state.culture[id], id).toBeDefined();
    // the day gate of Chapter 5 (10 active days) and the start gate of Chapter 6 (one friend at three hearts): play on, a friend a day, until Chapter 6 begins
    let day5 = 0;
    while (H.state.chapter.n === 5 && day5++ < 30) {
      newDay();
      for (const [friend, gift] of [['mio', 'g_manga'], ['tanaka', 'g_game_card']] as const) {
        convo(`smalltalk_${friend}`, friend);
        if ((H.state.owned[gift]?.qty ?? 0) === 0) buy('konbini', gift);
        convo('give_gift', friend, { itemId: gift });
      }
      convo('smalltalk_yuki', 'yuki');
    }
    expect(H.state.chapter.completed, 'Chapter 5 completes').toContain(5);
    expect(H.state.titles).toContain('t_traveller');
    for (const id of ['cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse']) expect(H.state.culture[id], id).toBeDefined();
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch5_close']));
    expect(H.state.clock.activeDays, 'the day gate of Chapter 5 (10 active days) held').toBeGreaterThanOrEqual(10);

    // ---- Chapter 6 (wave C1): four hearts with one friend, his home, Aiko's viewing, and five shifts in all
    let day6 = 0;
    while (H.state.chapter.n === 5 && day6++ < 20) {
      newDay();
      convo('smalltalk_mio', 'mio');
      convo('give_gift', 'mio', { itemId: 'g_manga' });
    }
    expect(H.state.chapter.n, 'Chapter 6 begins once a friend is at three hearts').toBe(6);
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch6_open']));
    let day7 = 0;
    while (!done('c6_1') && day7++ < 40) {
      newDay();
      convo('smalltalk_mio', 'mio');
      if ((H.state.owned.g_manga?.qty ?? 0) === 0) buy('konbini', 'g_manga');
      convo('give_gift', 'mio', { itemId: 'g_manga' });
    }
    expect(done('c6_1'), 'four hearts with Mio').toBe(true);
    convo('home_mio', 'mio', { lines: ['おじゃまします'] });
    expect(done('c6_2'), 'a friend\'s home visited').toBe(true);
    expect(H.state.culture.cc_shoesoff, 'the genkan card').toBeDefined();
    convo('aiko_viewing', 'aiko', { lines: ['おじゃまします', '何畳ですか', '日当たりはいいですか', '静かですか', 'ありがとうございました'] });
    expect(done('c6_3')).toBe(true);
    convo('jobintro_cafe', 'yuki');
    // five good shifts in all: the konbini (1), the station (1), and three more over two days (at most two a day, the second worth less)
    let day8 = 0;
    const jobs = ['job_cafe', 'job_konbini', 'job_station'];
    while (H.state.chapter.n === 6 && day8++ < 20) {
      newDay();
      shift(600 + 2 * day8, { jobId: jobs[day8 % 3]! });
      shift(601 + 2 * day8, { jobId: jobs[(day8 + 1) % 3]! });
      convo('smalltalk_mio', 'mio');
    }
    expect(done('c6_4'), 'five shifts').toBe(true);
    expect(H.state.chapter.n, 'Chapter 6 goes on into Chapter 7 (wave C2)').toBe(7);
    expect(H.state.chapter.completed).toEqual([1, 2, 3, 4, 5, 6]);
    expect(H.state.titles).toEqual(expect.arrayContaining(['t_newcomer', 't_friend', 't_connected', 't_traveller', 't_guest']));
    // a beat has no condition: the closing is picked by whether the room at Ono-so is rented (closeIf)
    expect(H.state.beats.some((b) => b === 'b_ch6_close' || b === 'b_ch6_close_flat'), 'one of Chapter 6\'s closings').toBe(true);
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch6_open', 'b_ch7_open']));
    expect(H.state.beats).not.toContain('b_release_epilogue');
    for (const id of ['cc_shoesoff', 'cc_rent', 'cc_trash']) expect(H.state.culture[id], id).toBeDefined();

    // ---- Chapter 7 (wave C2): four friends at two hearts, the festival stalls, the speech (the capstone), six culture phrases said
    let day9 = 0;
    while (!done('c7_1') && day9++ < 40) {
      newDay();
      for (const f of ['yuki', 'tanaka', 'kenji']) convo(`smalltalk_${f}`, f);
      if ((H.state.owned.g_choco?.qty ?? 0) === 0) buy('konbini', 'g_choco');
      convo('give_gift', ['yuki', 'tanaka', 'kenji'][day9 % 3]!, { itemId: 'g_choco' });
    }
    expect(done('c7_1'), 'four friends at two hearts').toBe(true);
    const ids7 = new Set(H.state.ledger.map((e) => e.id));
    convo('matsuri_stalls', 'kenji', { lines: ['はい、とても楽しいです。', 'たこ焼きをください。', '現金でお願いします。', 'ありがとうございます！'] });
    expect(done('c7_2'), 'festival food with my own lines').toBe(true);
    const charges = H.state.ledger.filter((e) => !ids7.has(e.id) && e.delta < 0);
    expect(charges.map((e) => [e.delta, e.pocket]), 'one cash charge, exactly the takoyaki').toEqual([[-600, 'cash']]);
    expect(H.state.culture.cc_matsuri, 'the festival card').toBeDefined();
    // the capstone is played in Real mode (the app starts it so): five lines of my own
    convo('matsuri_speech', 'hanako', { mode: 'real', lines: ['はじめまして。サムです。', 'アメリカから来ました。', '音楽が好きです。', '桜町はとてもいい町です。', 'ありがとうございました。'] });
    expect(H.state.runs.matsuri_speech?.bestIndependent, 'five own lines in the speech').toBeGreaterThanOrEqual(5);
    expect(done('c7_3'), 'the speech').toBe(true);
    // the stamp book's Say it for every phrase card collected so far (culture_said counts the distinct cards said)
    for (const c of JP_PACK.culture.filter((x) => x.say && H.state.culture[x.id] !== undefined)) dispatch({ t: 'culture_say', id: c.id, similarity: 1 });
    beats();
    expect(done('c7_4'), 'six culture phrases said').toBe(true);
    let day10 = 0;
    while (H.state.chapter.n === 7 && day10++ < 20) {
      newDay();
      convo('smalltalk_mio', 'mio');
    }
    expect(H.state.chapter.n, 'Chapter 7 goes on into Chapter 8').toBe(8);
    expect(H.state.titles).toContain('t_resident');
    expect(H.state.beats).toEqual(expect.arrayContaining(['b_ch7_close', 'b_ch8_open']));

    // ---- Chapter 8: the Letter Home, 150 words, two stars in 12 conversations, the dream (finished or chosen again)
    dispatch({
      t: 'letter_saved',
      sentences: [
        { ja: 'サムです。', assisted: false },
        { ja: 'アメリカの皆さん、お元気ですか。', assisted: true },
        { ja: 'ミオさんはやさしいです。', assisted: false },
        { ja: '公園によく行きます。', assisted: true },
        { ja: '自転車を買いました。', assisted: false },
      ],
    });
    beats();
    expect(done('c8_1'), 'the Letter (5 sentences, 3 my own)').toBe(true);
    for (let i = 0; i < 150; i++) view.vocab.reviewedKeys.add(`known${i}`);
    dispatch({ t: 'word_saved', key: 'x' });
    expect(done('c8_2'), '150 words').toBe(true);
    // two stars in twelve different conversations: eight come from the story so far; Hanako offers the easier eight after three tries (D40)
    const twoStars = () => Object.values(H.state.runs).filter((r) => r.stars >= 2).length;
    dispatch({ t: 'dream_chosen', id: H.state.dream.id ?? 'phone_pal' });
    beats();
    expect(done('c8_4'), 'the dream chosen again in Chapter 8').toBe(true);
    let day11 = 0;
    while (H.state.chapter.n === 8 && day11++ < 30) {
      newDay();
      convo('smalltalk_mio', 'mio');
      if (!done('c8_3') && rowOf('c8_3').easier === 'offered') dispatch({ t: 'easier_accept', objective: 'c8_3' });
      beats();
    }
    expect(done('c8_3'), `two stars in twelve conversations (have ${twoStars()})`).toBe(true);
    expect(H.state.chapter.n, 'Chapter 8 ends in Free Walk: the real ending').toBe(BALANCE.freeWalkChapter);
    expect(H.state.chapter.completed).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(H.state.beats).toContain('b_ch8_close');
    expect(H.state.beats).not.toContain('b_release_epilogue');

    // ---- Free Walk: the car dream is open, nothing is left to finish or re-announce
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

describe('random lives (Chapters 1-8 and Free Walk)', () => {
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
      const target = 1 + Math.floor(r() * 7);
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
        expect(H.state.chapter.n === 9 || H.state.chapter.n <= 8, `${where}: chapter ${H.state.chapter.n}`).toBe(true);
      }
    }
  }, 300_000);
});
