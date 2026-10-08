import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  createGameState,
  generateDaily,
  prerequisiteIssues,
  remainingCost,
  requires,
  validatePack,
  type ChapterDef,
  type GamePack,
  type GameView,
  type Pred,
  type ValidationIssue,
} from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, tokenize } from '../src';
import { CHAPTERS } from '../src/tokyo/game/chapters';
import { DREAMS } from '../src/tokyo/game/dreams';
import { DAILY } from '../src/tokyo/game/daily';
import { WORD_TAGS } from '../src/tokyo/game/wordTags';
import { CORE_BEATS } from '../src/tokyo/game/beats/beats-core';
// The synthetic catalog of the @lw/game quest tests: items, shops, friends, jobs and scenario metas with the gates of §4.5. Slices 3-4
// author the real ones; until then it stands in for them so the chapter graph can be proven end to end.
import { FRIENDS, ITEMS, JOBS, SCENARIOS, SHOPS, mkQuestPack } from '../../game/test/fixtures-quest';

const errors = (list: ValidationIssue[]) => list.filter((i) => i.severity === 'error');
const hasAr = (s: string) => /[؀-ۿ]/.test(s);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const walk = (p: Pred, fn: (q: Pred) => void): void => {
  fn(p);
  if (p.k === 'all' || p.k === 'any') p.of.forEach((q) => walk(q, fn));
};
const objectivePreds = (c: ChapterDef) => c.objectives.flatMap((o) => [o.pred, ...(o.easier ? [o.easier.pred] : [])]);

describe('chapters (§7.2, §4.5)', () => {
  it('are the 8 chapters with the table of §4.5', () => {
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CHAPTERS.map((c) => c.minDays)).toEqual([1, 2, 4, 7, 10, 14, 19, 25]);
    expect(CHAPTERS.map((c) => c.reward)).toEqual([2500, 2500, 3000, 4000, 5000, 6000, 8000, 10000]);
    expect(CHAPTERS.reduce((a, c) => a + c.reward, 0)).toBe(41_000);
    expect(CHAPTERS.map((c) => c.rewardTitle)).toEqual(['t_newcomer', undefined, 't_friend', 't_connected', 't_traveller', 't_guest', 't_resident', 't_lives_in_ja']);
  });

  it('has the objectives and predicates of §7.2, in order', () => {
    const ids = CHAPTERS.map((c) => c.objectives.filter((o) => !o.dream).map((o) => o.id));
    expect(ids).toEqual([
      ['c1_1', 'c1_2', 'c1_3', 'c1_4', 'c1_5'],
      ['c2_1', 'c2_2', 'c2_3', 'c2_4'],
      ['c3_1', 'c3_2', 'c3_3', 'c3_4'],
      ['c4_1', 'c4_2', 'c4_3', 'c4_4'],
      ['c5_1', 'c5_2', 'c5_3', 'c5_4'],
      ['c6_1', 'c6_2', 'c6_3', 'c6_4'],
      ['c7_1', 'c7_2', 'c7_3', 'c7_4'],
      ['c8_1', 'c8_2', 'c8_3', 'c8_4'],
    ]);
    const pred = (id: string) => CHAPTERS.flatMap((c) => c.objectives).find((o) => o.id === id)!.pred;
    expect(pred('c1_1')).toEqual({ k: 'lesson', id: 'greetings' });
    expect(pred('c1_2')).toEqual({ k: 'scenario', id: 'konbini', complete: true });
    expect(pred('c2_3')).toEqual({ k: 'shift', job: 'job_konbini', n: 1, minAcc: 0.6 });
    expect(pred('c4_3')).toEqual({ k: 'phone_chat', n: 4, friends: 2 });
    expect(pred('c7_3')).toEqual({ k: 'scenario', id: 'matsuri_speech', minIndependent: 5 });
    expect(pred('c8_3')).toEqual({ k: 'stars', atLeast: 2, n: 12 });
  });

  it('gives every own-words objective the easier alternative of D40, never at zero', () => {
    const easier = Object.fromEntries(CHAPTERS.flatMap((c) => c.objectives).filter((o) => o.easier).map((o) => [o.id, o]));
    expect(Object.keys(easier).sort()).toEqual(['c1_5', 'c2_1', 'c3_1', 'c5_2', 'c7_2', 'c7_3', 'c8_3']);
    const n = (p: Pred): number => (p.k === 'say_new' || p.k === 'stars' ? p.n : p.k === 'scenario' ? (p.minIndependent ?? 0) : -1);
    for (const o of Object.values(easier)) {
      expect(o.easier!.afterTries, o.id).toBe(3);
      expect(n(o.easier!.pred), o.id).toBeGreaterThan(0);
      expect(n(o.easier!.pred), o.id).toBeLessThan(n(o.pred));
    }
    expect(n(easier.c1_5.easier!.pred)).toBe(2);
    expect(n(easier.c8_3.easier!.pred)).toBe(8);
  });

  it('keeps the start gate of Chapter 6, the catch-up of Chapter 4 and the dream slots', () => {
    expect(CHAPTERS.find((c) => c.n === 6)!.startGate).toEqual({ k: 'hearts_count', atLeast: 3, n: 1 });
    expect(CHAPTERS.filter((c) => c.startGate).map((c) => c.n)).toEqual([6]);
    // content never imports @lw/game at runtime, so the literals are checked against BALANCE here
    expect(CHAPTERS.find((c) => c.n === 4)!.catchUp).toEqual({ afterActiveDays: BALANCE.catchUp.afterActiveDays, item: 'phone_used', maxYen: BALANCE.catchUp.max });
    expect(CHAPTERS.filter((c) => c.catchUp).map((c) => c.n)).toEqual([4]);
    expect(CHAPTERS.filter((c) => c.objectives.some((o) => o.dream)).map((c) => c.n)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('has EN and AR on every title, objective and hint, with identical placeholders', () => {
    for (const c of CHAPTERS) {
      expect(c.title.en && c.title.ar && c.title.ja, `chapter ${c.n}`).toBeTruthy();
      expect(hasAr(c.title.ar)).toBe(true);
      for (const o of c.objectives) {
        for (const g of [o.text, o.hint].filter(Boolean)) {
          expect(g!.en.trim(), o.id).toBeTruthy();
          expect(hasAr(g!.ar), `${o.id} ar`).toBe(true);
          expect(placeholders(g!.en), o.id).toBe(placeholders(g!.ar));
        }
      }
    }
  });

  it('has unique objective ids and gates within 1..9', () => {
    const ids = CHAPTERS.flatMap((c) => c.objectives.map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DREAMS) for (const s of d.steps) expect(s.gate, s.id).toBeGreaterThanOrEqual(1);
    for (const d of DREAMS) for (const s of d.steps) expect(s.gate, s.id).toBeLessThanOrEqual(BALANCE.freeWalkChapter);
    for (const i of Object.values(JP_PACK.interactions).flat()) expect(i.ch ?? 1, i.id).toBeLessThanOrEqual(BALANCE.freeWalkChapter);
  });

  it('uses only predicate kinds the objective engine knows', () => {
    const KINDS = new Set(['lesson', 'scenario', 'stars', 'own', 'purchases', 'hearts', 'hearts_count', 'gift', 'phone_chat', 'hangout', 'visit', 'shift', 'earn_total', 'wallet', 'words_saved', 'words_known', 'say_new', 'discover', 'culture', 'culture_said', 'said', 'srs_reviews', 'item_placed', 'flag', 'all', 'any']);
    const preds = [...CHAPTERS.flatMap((c) => [...objectivePreds(c), ...(c.startGate ? [c.startGate] : [])]), ...DREAMS.flatMap((d) => d.steps.map((s) => s.pred))];
    for (const p of preds) walk(p, (q) => expect(KINDS.has(q.k), q.k).toBe(true));
  });
});

describe('dreams (§7.3)', () => {
  it('are the 7 dreams with 5 steps (6 for the fresh start)', () => {
    expect(DREAMS.map((d) => d.id)).toEqual(['phone_pal', 'bike', 'flat', 'festival', 'travel', 'fresh_start', 'car']);
    expect(Object.fromEntries(DREAMS.map((d) => [d.id, d.steps.length]))).toEqual({ phone_pal: 5, bike: 5, flat: 5, festival: 5, travel: 5, fresh_start: 6, car: 5 });
  });

  it('keeps the age rule of D28 and the Free Walk car', () => {
    expect(DREAMS.filter((d) => d.ageMin === 18).map((d) => d.id)).toEqual(['flat', 'fresh_start', 'car']);
    expect(DREAMS.find((d) => d.id === 'car')!.openChapter).toBe(BALANCE.freeWalkChapter);
    expect(DREAMS.filter((d) => d.openChapter).map((d) => d.id)).toEqual(['car']);
  });

  it('maps every onboarding goal to one dream a child may see', () => {
    for (const goal of ['travel', 'work', 'relocation', 'casual']) expect(DREAMS.filter((d) => d.defaultFor?.includes(goal)), goal).toHaveLength(1);
    expect(DREAMS.find((d) => d.defaultFor?.includes('casual'))!.id).toBe('festival');
  });

  it('has unique step ids, ids per §14.9, and EN + AR on every text', () => {
    const steps = DREAMS.flatMap((d) => d.steps.map((s) => s.id));
    expect(new Set(steps).size).toBe(steps.length);
    for (const d of DREAMS) {
      expect(d.title).toBe(`t_dream_${d.id}`);
      expect(d.beat).toBe(`b_dream_${d.id}`);
      expect(d.sticker).toBe(`st_${d.id}`);
      expect(d.name.ja && d.name.reading && hasAr(d.name.ar) && d.name.en, d.id).toBeTruthy();
      for (const s of d.steps) expect(s.text.en.trim() && hasAr(s.text.ar), s.id).toBeTruthy();
      expect(d.steps.map((s) => s.gate), d.id).toEqual([...d.steps.map((s) => s.gate)].sort((a, b) => a - b));
    }
  });

  it('prices the fresh start at the ¥111,900 of §7.3 on the catalog prices', () => {
    // the catalog is slice 3: the fixture catalog carries the §5 prices (phone, bike + registration, flat, three small goods)
    const pack = mkQuestPack({ dreams: DREAMS });
    const state = createGameState(pack, 0);
    expect(remainingCost(pack, state, DREAMS.find((d) => d.id === 'fresh_start')!)).toBe(111_900);
  });
});

describe('daily goals (§7.4)', () => {
  it('are the 10 templates with one counter each', () => {
    expect(DAILY.map((d) => d.id)).toEqual(['g_conv2', 'g_indep6', 'g_newphrase2', 'g_buy', 'g_shift', 'g_friend', 'g_place', 'g_review8', 'g_lesson', 'g_culture']);
    expect(new Set(DAILY.map((d) => d.counter)).size).toBe(10);
    expect(Object.fromEntries(DAILY.map((d) => [d.id, d.target]))).toEqual({ g_conv2: 2, g_indep6: 6, g_newphrase2: 2, g_buy: 1, g_shift: 1, g_friend: 1, g_place: 2, g_review8: 8, g_lesson: 1, g_culture: 1 });
    for (const slot of ['speak', 'do', 'review'] as const) expect(DAILY.filter((d) => d.slot === slot).length, slot).toBeGreaterThanOrEqual(3);
    for (const d of DAILY) expect(d.text.en.trim() && hasAr(d.text.ar), d.id).toBeTruthy();
  });

  const view = (age: GameView['profile']['age'], over: { due?: number; reviewed?: string[] } = {}): GameView => ({
    vocab: { total: 6, known: new Set(), dueCount: over.due ?? 0, reviewedKeys: new Set(over.reviewed ?? []), reviewedSurfaces: new Set() },
    discovered: [],
    lessonsDone: [],
    streakDays: 0,
    profile: { age, goal: 'casual', level: 'A1', createdAt: '2026-10-04' },
  });

  it('gives kids 2 goals and everyone else 3, on the real pack, at every chapter', () => {
    for (let ch = 1; ch <= 9; ch++) {
      for (let day = 0; day < 20; day++) {
        const state = { ...createGameState(JP_PACK, 0), chapter: { ...createGameState(JP_PACK, 0).chapter, n: ch }, clock: { ...createGameState(JP_PACK, 0).clock, dayIndex: day } };
        expect(generateDaily(JP_PACK, state, view('kids')), `kids ch${ch} d${day}`).toHaveLength(2);
        expect(generateDaily(JP_PACK, state, view('adults')), `adults ch${ch} d${day}`).toHaveLength(3);
      }
    }
  });

  it('never offers a template whose content is still locked', () => {
    // the fixture pack has the jobs, friends and culture cards that make g_shift, g_friend and g_culture eligible
    const pack = mkQuestPack({ daily: DAILY, chapters: CHAPTERS });
    const bad: string[] = [];
    for (let ch = 1; ch <= 9; ch++) {
      for (let day = 0; day < 30; day++) {
        const base = createGameState(pack, 0);
        const state = { ...base, chapter: { ...base.chapter, n: ch }, clock: { ...base.clock, dayIndex: day } };
        for (const age of ['kids', 'adults'] as const) {
          for (const g of generateDaily(pack, state, view(age, { due: day % 3 === 0 ? 12 : 0, reviewed: day % 2 ? ['a'] : [] }))) {
            const rq = DAILY.find((d) => d.id === g.id)!.requires;
            if (rq?.chapter !== undefined && ch < rq.chapter) bad.push(`${g.id} at chapter ${ch}`);
            if (rq?.friends && !pack.friends.some((f) => f.unlockChapter <= ch)) bad.push(`${g.id} has no friend at chapter ${ch}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
    // the earliest chapters never see the friend or shift goals
    for (let day = 0; day < 40; day++) {
      const base = createGameState(pack, 0);
      const early = { ...base, clock: { ...base.clock, dayIndex: day } };
      expect(generateDaily(pack, early, view('adults')).map((g) => g.id)).not.toContain('g_friend');
    }
  });
});

describe('word tags (D33)', () => {
  it('lists 8-14 unique surfaces per tag, and covers the six tags of §15.10', () => {
    expect(Object.keys(WORD_TAGS).sort()).toEqual(['cafe', 'car', 'direction', 'home', 'numbers', 'transport']);
    for (const [tag, list] of Object.entries(WORD_TAGS)) {
      expect(new Set(list).size, tag).toBe(list.length);
      expect(list.length, tag).toBeGreaterThanOrEqual(8);
      expect(list.length, tag).toBeLessThanOrEqual(14);
    }
  });

  it('is always enough for the steps that ask for it, and resolves in the lexicon', () => {
    // surfaces the shop-aiko / shop-motors modules (slice 3) define: unresolved until they land, never anything else
    const LATER = new Set(['玄関', '畳', '日当たり', '家賃', '敷金', '前家賃', '鍵', '契約', '隣', 'スリッパ', '靴', '脱ぐ', '軽自動車', '本体価格', '乗り出し価格', '走行距離', '年式', '車検', '車庫証明']);
    const unresolved = Object.values(WORD_TAGS).flat().filter((s) => !LEXICON.has(s));
    expect(unresolved.filter((s) => !LATER.has(s))).toEqual([]);
    const asked = DREAMS.flatMap((d) => d.steps.map((s) => s.pred)).filter((p): p is Extract<Pred, { k: 'words_known' }> => p.k === 'words_known' && !!p.tag);
    expect(asked.map((p) => p.tag).sort()).toEqual(['car', 'direction', 'home', 'numbers', 'transport']);
    for (const p of asked) expect(WORD_TAGS[p.tag!].length, p.tag).toBeGreaterThan(p.n);
    // tags whose words already exist must be reachable on today's lexicon
    for (const p of asked.filter((x) => ['numbers', 'direction', 'transport'].includes(x.tag!))) expect(WORD_TAGS[p.tag!].filter((s) => LEXICON.has(s)).length, p.tag).toBeGreaterThanOrEqual(p.n);
  });
});

describe('story beats of 2F', () => {
  const beats = Object.values(CORE_BEATS);
  const known = new Set(CHARACTERS.map((c) => c.id));

  it('define every beat id the engine, the chapters and the dreams name for slice 2', () => {
    for (const id of ['b_ch1_open', 'b_ch1_close', 'b_ch2_open', 'b_ch2_close', 'b_welcome_back', 'b_dream_step', 'b_phone_fund', 'b_phone_bought', ...DREAMS.map((d) => d.beat)]) {
      expect(JP_PACK.beats[id], id).toBeDefined();
    }
    for (const b of beats) expect(JP_PACK.beats[b.id]).toBe(b);
    expect(Object.keys(CORE_BEATS).length).toBe(beats.length);
  });

  it('opens Chapter 1 with the katakana step and closes it with the Dream picker', () => {
    expect(CORE_BEATS.b_ch1_open.ask).toBe('nameKana');
    expect(CORE_BEATS.b_ch1_open.lines).toHaveLength(4);
    expect(CORE_BEATS.b_ch1_open.lines.every((l) => l.who === 'hanako')).toBe(true);
    expect(CORE_BEATS.b_ch1_close.ask).toBe('dream');
    expect(CORE_BEATS.b_ch1_close.lines.at(-1)!.line.ja).toContain('夢');
  });

  it('writes every line with EN and AR, known speakers and words the lexicon has', () => {
    const bad: string[] = [];
    for (const b of beats) {
      expect(b.lines.length, b.id).toBeGreaterThan(0);
      b.lines.forEach((l, i) => {
        const where = `${b.id}[${i}]`;
        if (!known.has(l.who)) bad.push(`${where}: speaker ${l.who}`);
        if (!l.line.en.trim() || !hasAr(l.line.ar)) bad.push(`${where}: missing EN/AR`);
        if (placeholders(l.line.ja) !== placeholders(l.line.en) || placeholders(l.line.en) !== placeholders(l.line.ar)) bad.push(`${where}: placeholders differ`);
        const { missing } = tokenize(l.line.ja, LEXICON, { name: { ja: 'ミオ', raw: true } });
        if (missing.length) bad.push(`${where}: not in the lexicon: ${missing.join(' ')}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('reads 何ですか with its own reading (bare 何 is なに)', () => {
    const q = CORE_BEATS.b_ch1_close.lines.at(-1)!.line.ja;
    const tokens = tokenize(q, LEXICON, { name: { ja: 'ミオ', raw: true } }).tokens;
    expect(tokens.find((t) => t.s === '何ですか')?.r).toBe('なんですか');
  });

  it('uses the lines of the spec for the opening and closing beats', () => {
    const text = (id: string) => CORE_BEATS[id].lines.map((l) => tokenize(l.line.ja, LEXICON, { name: { ja: '{name}', raw: true } }).tokens.map((t) => t.s).join(''));
    expect(text('b_ch1_open')).toEqual(['ようこそ、桜町へ。わたしは花子です。先生です。', 'これは最初のお金です。三千円です。', '一年後、日本語で家族に手紙を書きます。', 'まず、あいさつのレッスンをしましょう。']);
    expect(text('b_ch1_close')[0]).toBe('よくできました。これからですね。');
    expect(text('b_phone_fund')).toEqual(['学校から少しだけ。がんばっていますね。']);
    expect(text('b_dream_step')).toEqual(['いい調子ですね。もうすこしです。']);
  });
});

describe('the pack as a whole', () => {
  it('passes validatePack at level 2', () => {
    // `rules.negotiation.motors.items` names car ids that only slice 3's catalog defines; since 2G seeded `items` with the IC card the
    // level-1 rule "negotiable ids are items of that shop" is live. That is 3E's table, not this file's: everything else must be clean.
    const mine = errors(validatePack(JP_PACK, { level: 2 })).filter((i) => !i.path.startsWith('rules.negotiation.'));
    expect(mine).toEqual([]);
  });

  it('names no title, culture card, item or beat that could never exist (level 5 stays tolerated until slices 3-5)', () => {
    // what the later slices must still author, so a typo in an id here shows up as a new name in this list
    const issues = errors(validatePack(JP_PACK, { level: 5 }));
    const missing = (code: string, re: RegExp) => [...new Set(issues.filter((i) => i.code === code).map((i) => re.exec(i.message)?.[1]))].sort();
    expect(missing('beat_missing', /beat "(.+?)"/)).toEqual(
      ['b_ch3_open', 'b_ch3_close', 'b_ch4_open', 'b_ch4_close', 'b_ch5_open', 'b_ch5_close', 'b_ch6_open', 'b_ch6_close', 'b_ch7_open', 'b_ch7_close', 'b_ch8_open', 'b_ch8_close', 'b_rankup']
        .filter((id) => !JP_PACK.beats[id])
        .sort(),
    );
    expect(missing('title_missing', /title "(.+?)"/).every((id) => /^t_(newcomer|friend|connected|traveller|guest|resident|lives_in_ja|dream_[a-z_]+)$/.test(id as string))).toBe(true);
  });
});

/**
 * The fixture pack: the real chapters, dreams, daily goals, tags, beats and interactions over the synthetic catalog of the @lw/game
 * tests (items, shops, friends, jobs, scenarios with the gates of §4.5). It stands in for slices 3-4 so the whole quest graph can be proven.
 */
function fixturePack(): GamePack {
  const meta = (id: string) => ({ id, kind: 'story' as const, band: 'A2' as const, register: 'polite' as const, pay: 'full' as const });
  const base = mkQuestPack();
  const friend = (id: string, unlockChapter: number, home = false) => ({ ...FRIENDS[0], id, unlockChapter, ...(home ? { home: { stage: id, door: id } } : {}) });
  return {
    ...base,
    items: [...ITEMS, { ...ITEMS[0], id: 'g_wagashi', price: 480, cat: 'gift' as const, shop: 'aiko', gate: { ch: 2 }, tags: [], fx: [] }, { ...ITEMS[0], id: 'ic_card', price: 500, shop: 'konbini', gate: { ch: 1 }, tags: [], fx: [{ t: 'feature' as const, id: 'ic' as const }] }],
    shops: [...SHOPS, { ...SHOPS[0], id: 'fukufuku', openChapter: 2 }],
    friends: [...FRIENDS, friend('sato', 1), friend('kenji', 1, true), friend('yuki', 1), friend('hanako', 1)].filter((f, i, all) => all.findIndex((x) => x.id === f.id) === i),
    jobs: [...JOBS, { ...JOBS[0], id: 'job_cafe', boss: 'yuki' }, { ...JOBS[0], id: 'job_station', boss: 'sato' }],
    scenarioMeta: [...SCENARIOS, ...['matsuri_stalls', 'matsuri_speech', 'station', 'station_ic', 'denki_phone', 'fuku_clothes', 'aiko_tea', 'motors_bike'].map(meta)],
    chapters: CHAPTERS,
    dreams: DREAMS,
    daily: DAILY,
    wordTags: WORD_TAGS,
    beats: JP_PACK.beats,
    interactions: JP_PACK.interactions,
    // six cards with a phrase to say (culture_said n:6 must be reachable before Chapter 7 completes)
    culture: Array.from({ length: 6 }, (_, i) => ({ id: `cc_say${i}`, trigger: { on: 'shop_start' as const }, phrase: { ja: 'a', en: 'a', ar: 'a' }, text: { en: 'a', ar: 'a' }, say: true as const })),
  };
}

describe('the quest graph (§7.1 prerequisite validation)', () => {
  it('opens everything the real pack knows about no later than the chapter that asks for it', () => {
    const issues = prerequisiteIssues(JP_PACK);
    // nothing that exists is ever locked behind a later chapter...
    expect(issues.filter((i) => i.code === 'prereq_locked')).toEqual([]);
    // ...and what is still unknown is only what slices 3-5 author. A typo in an id of chapters.ts or dreams.ts shows up as a new name here.
    // (Until those land the level-4 bot also stops at Chapter 2: the konbini job and the key phrases of the culture cards are 4D and 4F's.)
    const LATER = new Set([
      'friend:*', 'friend:mio', 'friend:tanaka', 'friend:aiko', 'friend:nakamura', 'friend:sato', 'friend:kenji', 'friend:yuki',
      'item:bike_helmet', 'item:home_room_ono', 'item:yukata', 'item:category:phone', 'item:category:bicycle', 'item:category:car', 'item:feature:phone',
      'scenario:aiko_viewing', 'scenario:matsuri_stalls', 'scenario:matsuri_speech', 'scenario:motors_visit', 'scenario:park', 'scenario:sato_directions',
      'job:job_konbini', 'job:job_cafe', 'job:job_station', 'shop:station', 'shop:denki', 'shop:motors', 'shop:aiko', 'shop:fukufuku',
    ]);
    const unknown = issues.filter((i) => i.code === 'prereq_unknown').map((i) => /needs (\w+) "(.+?)"/.exec(i.message)!.slice(1, 3).join(':'));
    expect(unknown.filter((u) => !LATER.has(u))).toEqual([]);
  });

  it('proves every objective, easier alternative, start gate and dream step satisfiable at its chapter start', () => {
    const pack = fixturePack();
    expect(prerequisiteIssues(pack)).toEqual([]);
    // the same walk, spelled out: every requirement of every story predicate opens at or before its chapter
    for (const c of pack.chapters) {
      for (const o of c.objectives.filter((x) => !x.dream)) {
        for (const p of [o.pred, ...(o.easier ? [o.easier.pred] : [])]) {
          for (const r of requires(p, pack)) {
            expect(r.ch, `${o.id} needs ${r.kind} ${r.id}`).toBeGreaterThan(0);
            expect(r.ch, `${o.id} needs ${r.kind} ${r.id}`).toBeLessThanOrEqual(c.n);
          }
        }
      }
    }
    for (const d of pack.dreams) for (const s of d.steps) for (const r of requires(s.pred, pack)) expect(r.ch, `${s.id} needs ${r.kind} ${r.id}`).toBeLessThanOrEqual(s.gate);
  });

  it('is finished by the level-4 bot on the fixture catalog, with at most one heart for Aiko', () => {
    const level4 = errors(validatePack(fixturePack(), { level: 4 })).filter((i) => i.level === 4);
    expect(level4).toEqual([]);
  });

  it('catches a chapter that needs what only its own reward opens (the D36 deadlock)', () => {
    const pack = fixturePack();
    const late: GamePack = { ...pack, chapters: pack.chapters.map((c) => (c.n === 2 ? { ...c, opens: c.opens.filter((o) => o.id !== 'job_konbini') } : c)) };
    // job_konbini now opens with nothing: Chapter 2's shift objective is reported
    expect(prerequisiteIssues(late).some((i) => /c2_3/.test(i.message))).toBe(true);
  });

  it('is acyclic: chapters only ever wait for earlier chapters', () => {
    const pack = fixturePack();
    for (const c of pack.chapters) {
      if (c.startGate) for (const r of requires(c.startGate, pack)) expect(r.ch, `start gate of chapter ${c.n}`).toBeLessThan(c.n);
    }
  });
});
