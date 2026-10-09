import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS, JP_PACK, LEXICON, tokenize } from '@lw/content';
import { scoreShift, shiftPay, type ShiftScore } from '@lw/game';
import { STRINGS } from '../src/i18n';
import { BAND_LINES, RANK_JA, RANK_UP, REFUSE, RETRY } from '../src/components/game/shift/shiftLines';
import { IntroGate, JobCard, QuitSheet, RefuseCard, ResultCard } from '../src/components/game/shift/ShiftCards';
import { Steps, Verdict } from '../src/components/game/shift/ShiftParts';
import {
  HELP_CAP,
  amountDistractors,
  amountSaid,
  buildResult,
  cartTotal,
  changeOf,
  changePhrase,
  inputFor,
  lowerInput,
  menuFor,
  nearAmounts,
  newTrack,
  orderCorrect,
  piecesOf,
  seeded,
  thanksSaid,
  tilePool,
  tilesCorrect,
  totalPhrase,
  voiceOff,
  wantedOf,
  wordsFromShift,
  yenLtr,
  type Track,
} from '../src/components/game/shift/shiftLogic';
import { useGame } from '../src/game/gameStore';
import { resetBridgeForTests } from '../src/game/bridge';
import { useStore, type Profile } from '../src/store';

const job = JP_PACK.jobs[0]!;
const menu = menuFor(JP_PACK, job);
const arch = (id: string) => job.archetypes.find((a) => a.id === id)!;
const customer = (id: string) => {
  const a = arch(id);
  const total = a.task.kind === 'order' ? a.task.items.reduce((s, i) => s + menu.find((m) => m.option === i.menu.replace('konbini:', ''))!.price * i.qty, 0) : 0;
  return { templateId: a.id, line: a.line, task: a.task, thanks: a.thanks, tiles: a.tiles, change: a.change, total };
};

describe('shiftLogic: the order', () => {
  it('the item grid is the konbini menu with its real prices', () => {
    expect(menu.map((m) => m.option).sort()).toEqual(['bento', 'cake', 'coffee', 'greenTea', 'juice', 'milk', 'onigiri', 'sandwich', 'water']);
    expect(menu.find((m) => m.option === 'onigiri')!.price).toBe(160);
  });

  it('accepts exactly the wanted items, counts and flags, and nothing else', () => {
    const c = customer('k_two');
    const want = wantedOf(c, menu);
    expect(want.cart).toEqual({ 'konbini:greenTea': 1, 'konbini:sandwich': 3 });
    expect(orderCorrect(c, menu, want.cart, want.flags)).toBe(true);
    expect(orderCorrect(c, menu, { ...want.cart, 'konbini:sandwich': 2 }, want.flags)).toBe(false);
    expect(orderCorrect(c, menu, { ...want.cart, 'konbini:milk': 1 }, want.flags)).toBe(false);
    expect(orderCorrect(c, menu, want.cart, { heat: true, nobag: false })).toBe(false);
    const h = customer('k_heat');
    expect(orderCorrect(h, menu, { 'konbini:bento': 1 }, { heat: true, nobag: true })).toBe(true);
    expect(orderCorrect(h, menu, { 'konbini:bento': 1 }, { heat: true, nobag: false })).toBe(false);
    expect(orderCorrect(h, menu, { 'konbini:bento': 1 }, { heat: false, nobag: true })).toBe(false);
  });

  it('the total of a cart is the sum of the prices, and the change is the note minus the total', () => {
    expect(cartTotal(menu, { 'konbini:onigiri': 2 })).toBe(320);
    expect(cartTotal(menu, wantedOf(customer('k_two'), menu).cart)).toBe(1120);
    expect(changeOf(customer('k_change'))).toBe(520);
    expect(changeOf(customer('k_basic'))).toBeUndefined();
  });
});

describe('shiftLogic: saying the total and the thanks', () => {
  it('accepts digits, yen signs, kanji, kana and romaji for the same amount, and nothing else', () => {
    for (const say of ['320', '¥320', '320円', '320えん', '三百二十円', '三百二十円です', 'さんびゃくにじゅうえん', 'sanbyaku nijuu en', '３２０']) {
      expect(amountSaid(say, 320), say).toBe(true);
    }
    for (const say of ['32', '3200', '230', '160', '', 'ありがとう', '320 160']) expect(amountSaid(say, 320), say).toBe(false);
    expect(amountSaid('千円', 1000)).toBe(true);
    expect(amountSaid('千二十円', 1020)).toBe(true);
  });

  it('accepts any of the staff phrases, in any script, inside a longer sentence', () => {
    const accepted = arch('k_basic').thanks;
    for (const say of ['ありがとうございました', 'ありがとうございました。', 'arigatou gozaimashita', 'ありがとうございました、またどうぞ', 'お待たせしました', 'かしこまりました'])
      expect(thanksSaid(say, accepted), say).toBe(true);
    for (const say of ['いらっしゃいませ', 'すみません', '', 'ありがとう']) expect(thanksSaid(say, accepted), say).toBe(false);
  });

  it('writes the total and the change as phrases the lexicon can show', () => {
    expect(piecesOf(totalPhrase(320))).toEqual(['三百', '二', '十', '円', 'です']);
    expect(piecesOf(changePhrase(520))).toEqual(['お釣り', 'は', '五', '百', '二', '十', '円', 'です']);
    for (const n of [110, 160, 320, 580, 740, 1120, 520]) {
      for (const markup of [totalPhrase(n), changePhrase(n)]) expect(tokenize(markup, LEXICON).missing ?? []).toEqual([]);
    }
  });
});

describe('shiftLogic: tiles, choices and credit', () => {
  it('the tile pool is the phrase plus two distractors, shuffled the same way every time; the right order builds the phrase', () => {
    const target = totalPhrase(320);
    const pool = tilePool(target, amountDistractors(320), seeded(7));
    expect(pool).toHaveLength(piecesOf(target).length + 2);
    expect(pool).toEqual(tilePool(target, amountDistractors(320), seeded(7)));
    for (const p of piecesOf(target)) expect(pool).toContain(p);
    expect(tilesCorrect(piecesOf(target), target)).toBe(true);
    expect(tilesCorrect([...piecesOf(target)].reverse(), target)).toBe(false);
    for (const n of [110, 330, 580, 1120]) {
      const d = amountDistractors(n);
      expect(d).toHaveLength(2);
      for (const x of d) expect(piecesOf(totalPhrase(n))).not.toContain(x);
    }
  });

  it('two near amounts are wrong, positive and different', () => {
    for (const n of [10, 110, 580, 1120]) {
      const [a, b] = nearAmounts(n);
      expect(new Set([n, a, b]).size).toBe(3);
      expect(a).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(0);
    }
  });

  it('opening a help caps the credit even when the player then types (the tiles and chips show the answer)', () => {
    expect(inputFor('type', false, null)).toBe('typed');
    expect(inputFor('type', true, null)).toBe('spoken');
    expect(inputFor('tiles', false, null)).toBe('tiles');
    expect(inputFor('pick', false, null)).toBe('pick');
    expect(inputFor('type', false, HELP_CAP.tiles)).toBe('tiles');
    expect(inputFor('type', true, HELP_CAP.pick)).toBe('pick');
    expect(inputFor('tiles', false, HELP_CAP.pick)).toBe('pick');
    expect(lowerInput('typed', 'tiles')).toBe('tiles');
    expect(lowerInput('pick', 'spoken')).toBe('pick');
  });

  it('no voice: auto-speak off, listening off, or a read-and-type / type-only audio mode', () => {
    expect(voiceOff({}, true)).toBe(false);
    expect(voiceOff({ listenPref: 'on', lastMode: 'full' }, true)).toBe(false);
    expect(voiceOff({}, false)).toBe(true);
    expect(voiceOff({ listenPref: 'off' }, true)).toBe(true);
    expect(voiceOff({ lastMode: 'read-and-type' }, true)).toBe(true);
    expect(voiceOff({ lastMode: 'type-only' }, true)).toBe(true);
  });

  it('yenLtr isolates the amount so an Arabic sentence keeps ¥1,070 left to right', () => {
    expect(yenLtr(1070)).toBe('⁦¥1,070⁩');
  });
});

describe('shiftLogic: from play to the result the reducer pays', () => {
  const served = (id: string, o: Partial<Track> = {}): Track => ({ ...newTrack(id), order: true, total: { ok: true, input: 'typed' }, thanks: { ok: true, input: 'typed' }, ...o });

  it('five typed, perfect customers score 1.0 and pay ¥860 at rank 0; the greeting never lifts a customer above 3 units', () => {
    const tracks = ['k_basic', 'k_water', 'k_bento', 'k_three', 'k_basic'].map((id) => served(id, { greeted: true }));
    const r = buildResult({ id: 'x', jobId: job.id, tracks, quit: false, startedAt: 0, now: 200_000, assistWaived: true });
    expect(r.durationSec).toBe(200);
    expect(r.customers.every((c) => c.served && c.tasks.filter((t) => t.kind !== 'greet').length === 3)).toBe(true);
    const score = scoreShift(r);
    expect(score.ticks).toBe(1);
    expect(score.perfect).toBe(true);
    expect(shiftPay(job, score, 0, 1, JP_PACK)).toBe(860);
  });

  it('a wrong order costs one unit; the assist factors apply unless waived', () => {
    const tracks = [served('k_basic', { order: false }), ...['k_water', 'k_bento', 'k_three', 'k_basic'].map((id) => served(id))];
    const r = buildResult({ id: 'x', jobId: job.id, tracks, quit: false, startedAt: 0, now: 1000, assistWaived: true });
    expect(scoreShift(r).ticks).toBeCloseTo(14 / 15);
    expect(scoreShift(r).perfect).toBe(false);
    const helped = ['k_basic', 'k_water', 'k_bento', 'k_three', 'k_basic'].map((id) => served(id, { assistText: true }));
    const waived = scoreShift(buildResult({ id: 'x', jobId: job.id, tracks: helped, quit: false, startedAt: 0, now: 1, assistWaived: true }));
    const charged = scoreShift(buildResult({ id: 'x', jobId: job.id, tracks: helped, quit: false, startedAt: 0, now: 1, assistWaived: false }));
    expect(waived.ticks).toBe(1);
    expect(charged.ticks).toBeCloseTo((5 * 2.7) / 15);
  });

  it('a customer who has not said thanks is not served; a left shift is a quit', () => {
    const half: Track = { ...newTrack('k_basic'), order: true, total: { ok: true, input: 'typed' } };
    const r = buildResult({ id: 'x', jobId: job.id, tracks: [served('k_water'), served('k_bento'), half], quit: true, startedAt: 0, now: 1, assistWaived: true });
    const score: ShiftScore = scoreShift(r);
    expect(score.served).toBe(2);
    expect(score.quit).toBe(true);
    expect(score.good).toBe(false);
    expect(shiftPay(job, score, 0, 1, JP_PACK)).toBe(Math.round((1150 * 0.75 * score.perf * 0.6) / 10) * 10);
  });

  it('the words to keep come from the customers that went wrong first, skip the saved ones and the grammar words', () => {
    const plan = ['k_basic', 'k_water', 'k_bento'].map(customer);
    const tracks = [served('k_basic'), served('k_water', { total: { ok: false, input: 'typed' } }), served('k_bento')];
    const words = wordsFromShift(plan, tracks, menu, () => false, 3);
    expect(words.length).toBeGreaterThan(0);
    expect(words.length).toBeLessThanOrEqual(3);
    expect(words[0]!.s).toBe('水');
    expect(words.every((w) => !!w.gloss && !w.punct)).toBe(true);
    expect(wordsFromShift(plan, tracks, menu, (s) => s === '水', 3).map((w) => w.s)).not.toContain('水');
    expect(wordsFromShift(plan, tracks, menu, () => true, 3)).toEqual([]);
  });
});

describe('the boss lines and strings', () => {
  const noGap = (ja: string) => {
    const t = tokenize(ja, LEXICON);
    expect(t.missing ?? [], ja).toEqual([]);
    expect(t.tokens.filter((x) => !x.punct && !x.raw && !x.gloss), ja).toEqual([]);
  };
  it('every boss line is Japanese the lexicon shows, with English and Arabic', () => {
    for (const l of [REFUSE, RETRY, ...Object.values(BAND_LINES), ...RANK_UP.filter((x) => x !== null)]) {
      noGap(l!.ja);
      expect(l!.en.trim() && l!.ar.trim()).toBeTruthy();
    }
    for (const r of RANK_JA) noGap(r.ja);
    expect(RANK_UP).toHaveLength(5);
  });

  it('all jobs.* strings exist in English and Arabic with the same placeholders', () => {
    const en = STRINGS.en as Record<string, string>;
    const ar = STRINGS.ar as Record<string, string>;
    const keys = Object.keys(en).filter((k) => k.startsWith('jobs.'));
    expect(keys.length).toBeGreaterThan(60);
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const k of keys) {
      expect(ar[k]?.trim(), `ar ${k}`).toBeTruthy();
      expect(ph(ar[k]!), k).toBe(ph(en[k]!));
      if (!/placeholder/.test(k)) expect(ar[k], `ar ${k}`).toMatch(/[؀-ۿ]|^[\d\s×{}¥.]+$/);
    }
  });
});

// ---- the cards rendered in both directions -----------------------------------------------------------------------
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0]!.avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const html = (el: ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

describe('the cards render in English and Arabic', () => {
  beforeEach(() => {
    useStore.getState().reset();
    resetBridgeForTests();
    useGame.getState().resetGame();
    useStore.setState({ profile, ready: true });
  });
  const score = (o: Partial<ShiftScore> = {}): ShiftScore => ({ served: 5, ticks: 1, r: 1, perf: 1, good: true, perfect: true, trial: false, quit: false, band: 'perfect', ...o });

  for (const lang of ['en', 'ar'] as const) {
    it(`job card, intro gate, refusal, leave sheet, steps, verdict and result card in ${lang}`, () => {
      setLang(lang);
      const card = html(createElement(JobCard, { jobName: 'x', helping: true, rank: 1, good: 3, mult: 0.5, waivedShifts: true, wage: 1150, onStart: noop, onBack: noop }));
      expect(card).toContain('data-act="start-shift"');
      expect(card).toContain('data-helping');
      expect(card).toContain('data-mult="0.5"');
      expect(html(createElement(IntroGate, { onTalk: noop, onBack: noop }))).toContain('data-act="talk-boss"');
      expect(html(createElement(RefuseCard, { onBack: noop }))).not.toContain('start-shift');
      const quit = html(createElement(QuitSheet, { served: 3, pay: 210, onKeep: noop, onLeave: noop }));
      expect(quit).toContain('data-act="leave-shift"');
      expect(quit).toContain('¥210');
      expect(html(createElement(QuitSheet, { served: 1, pay: 0, onKeep: noop, onLeave: noop }))).toContain('data-sheet="quit"');
      expect(html(createElement(Steps, { states: [{ id: 'order', label: 'a', state: 'ok' }, { id: 'total', label: 'b', state: 'now' }] }))).toContain('aria-current="step"');
      expect(html(createElement(Verdict, { label: 'x', markup: totalPhrase(320), gloss: '¥320', onContinue: noop, cta: 'go' }))).toContain('data-act="continue"');
      const words = tokenize('お弁当|を', LEXICON).tokens.filter((t) => !t.punct);
      const res = html(
        createElement(ResultCard, {
          data: { score: score(), pay: 860, rankBefore: 0, rankAfter: 1, quit: false, assisted: 1, bonusItem: true, words, savedWords: false, canAgain: true, againMult: 0.5 },
          onSaveWords: noop,
          onAgain: noop,
          onBack: noop,
        }),
      );
      expect(res).toContain('data-pay="860"');
      expect(res).toContain('data-rankup="1"');
      expect(res).toContain('data-bonus');
      expect(res).toContain('data-act="save-words"');
      expect(res).toContain('¥860');
      const bad = html(
        createElement(ResultCard, {
          data: { score: score({ ticks: 0.4, good: false, perfect: false, band: 'retry' }), pay: 0, rankBefore: 0, rankAfter: 0, quit: false, assisted: 0, bonusItem: false, words: [], savedWords: false, canAgain: false, againMult: 0 },
          onSaveWords: noop,
          onAgain: noop,
          onBack: noop,
        }),
      );
      expect(bad).toContain('data-pay="0"');
      expect(bad).not.toContain('data-act="again"');
      expect(bad).not.toContain('data-rankup');
    });
  }
});
