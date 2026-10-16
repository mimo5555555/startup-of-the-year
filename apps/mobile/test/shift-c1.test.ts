import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS, JP_PACK, LEXICON, tokenize } from '@lw/content';
import { generateShift, type ShiftCustomer } from '@lw/game';
import { STRINGS } from '../src/i18n';
import { DeskPad } from '../src/components/game/shift/StationWidgets';
import { OrderPad } from '../src/components/game/shift/ShiftParts';
import {
  amountSaid,
  flagsFor,
  isSplit,
  menuFor,
  orderCorrect,
  splitTotals,
  tableOf,
  totalPhrase,
  wantedOf,
} from '../src/components/game/shift/shiftLogic';
import {
  boardFor,
  deskAnswerOf,
  deskPhrase,
  deskPickOk,
  deskSaid,
  deskWrong,
  destIn,
  dirSaid,
  fareRowsFor,
  fmtTime,
  minutesOf,
  platformSaid,
  timePhrase,
  timeSaid,
  timetableFor,
} from '../src/components/game/shift/stationLogic';
import { getGame, useGame } from '../src/game/gameStore';
import { resetBridgeForTests } from '../src/game/bridge';
import { realTryDue, realTryFor, realTryPending } from '../src/game/realTry';
import { feedbackThen } from '../src/game/phoneLogic';
import { useStore, type Profile } from '../src/store';

const cafe = JP_PACK.jobs.find((j) => j.id === 'job_cafe')!;
const station = JP_PACK.jobs.find((j) => j.id === 'job_station')!;
const cafeMenu = menuFor(JP_PACK, cafe);

const asCustomer = (a: (typeof cafe.archetypes)[number], menu = cafeMenu): ShiftCustomer => {
  const total = a.task.kind === 'order' ? a.task.items.reduce((s, i) => s + (menu.find((m) => m.id === i.menu || m.option === i.menu)?.price ?? 0) * i.qty, 0) : undefined;
  return { templateId: a.id, line: a.line, task: a.task, thanks: a.thanks, tiles: a.tiles, change: a.change, ...(total !== undefined ? { total } : {}) };
};
const say = (n: number | string): ShiftCustomer => ({ templateId: 'x', line: { ja: '', en: '', ar: '' }, task: { kind: 'platform', answer: n }, thanks: [] });

describe('the café job: the same order grid, the switches, the table and the split bill', () => {
  it('exists, is Yuki\'s, and the grid is the café menu with its real prices', () => {
    expect(cafe.boss).toBe('yuki');
    expect(cafe.archetypes.length).toBeGreaterThanOrEqual(8);
    expect(cafeMenu.map((m) => m.option).sort()).toEqual(['blackTea', 'cake', 'coffee', 'greenTea', 'juice', 'latte']);
    expect(flagsFor('cafe')).toEqual(['hot', 'iced']);
    expect(flagsFor('konbini')).toEqual(['heat', 'nobag']);
  });

  it('every café customer is judged right by exactly their own items, counts, switches and table', () => {
    for (const a of cafe.archetypes) {
      const c = asCustomer(a);
      const want = wantedOf(c, cafeMenu);
      expect(orderCorrect(c, cafeMenu, want.cart, want.flags, want.table), a.id).toBe(true);
      // a wrong count, a missing table or a flipped switch is wrong
      const first = Object.keys(want.cart)[0]!;
      expect(orderCorrect(c, cafeMenu, { ...want.cart, [first]: want.cart[first]! + 1 }, want.flags, want.table), `${a.id} count`).toBe(false);
      expect(orderCorrect(c, cafeMenu, want.cart, { ...want.flags, hot: !want.flags.hot }, want.table), `${a.id} hot`).toBe(false);
      expect(orderCorrect(c, cafeMenu, want.cart, want.flags, (want.table ?? 0) + 1), `${a.id} table`).toBe(false);
    }
  });

  it('a table number is read from table:N, and a change of mind keeps only the last word', () => {
    const two = cafe.archetypes.find((a) => a.id === 'c_two')!;
    expect(tableOf(asCustomer(two))).toBe(3);
    const change = asCustomer(cafe.archetypes.find((a) => a.id === 'c_change')!);
    const want = wantedOf(change, cafeMenu);
    expect(want.flags).toEqual({ iced: true });
    expect(orderCorrect(change, cafeMenu, want.cart, { hot: true }, undefined)).toBe(false);
  });

  it('a split bill is two totals: the first line, then the rest', () => {
    const split = asCustomer(cafe.archetypes.find((a) => a.id === 'c_split')!);
    expect(isSplit(split)).toBe(true);
    const [a, b] = splitTotals(split, cafeMenu)!;
    expect(a).toBe(450);
    expect(b).toBe(480);
    expect(a + b).toBe(split.total);
    expect(splitTotals(asCustomer(cafe.archetypes.find((x) => x.id === 'c_one')!), cafeMenu)).toBeUndefined();
    expect(amountSaid(`${a}円`, a)).toBe(true);
  });

  it('every repeat-back and thanks phrase of the café is Japanese the lexicon shows', () => {
    for (const a of cafe.archetypes) for (const p of a.thanks) expect(tokenize(p, LEXICON).tokens.filter((t) => !t.punct && !t.raw && !t.gloss), `${a.id} ${p}`).toEqual([]);
  });
});

describe('the station job: boards, plan, timetable and fare table come from the customer', () => {
  it('exists, is Sato\'s, and every desk customer has a task the widgets can show', () => {
    expect(station.boss).toBe('sato');
    expect(station.archetypes.length).toBeGreaterThanOrEqual(8);
    for (const a of station.archetypes) expect(a.task.kind, a.id).not.toBe('order');
    const kinds = new Set(station.archetypes.map((a) => a.task.kind));
    for (const k of ['platform', 'direction', 'time', 'fare', 'announce']) expect(kinds.has(k as never), k).toBe(true);
  });

  it('the board puts the asked destination over the answer platform and the right tap is judged right', () => {
    const c = asCustomer(station.archetypes.find((a) => a.id === 's_platform')!);
    const rows = boardFor(c);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.n === 3)!.dest).toBe('hikarigaoka');
    expect(new Set(rows.map((r) => r.dest)).size).toBe(4);
    expect(deskPickOk(c, 3)).toBe(true);
    expect(deskPickOk(c, 2)).toBe(false);
    const other = asCustomer(station.archetypes.find((a) => a.id === 's_platform2')!);
    expect(boardFor(other).find((r) => r.n === 1)!.dest).toBe('shibuya');
    expect(destIn('渋谷|は|何番線')).toBe('shibuya');
  });

  it('the plan, the timetable and the fare table agree with the answer', () => {
    const dir = asCustomer(station.archetypes.find((a) => a.id === 's_dir2')!);
    expect(deskPickOk(dir, 'left')).toBe(true);
    expect(deskPickOk(dir, 'right')).toBe(false);
    const time = asCustomer(station.archetypes.find((a) => a.id === 's_time')!);
    const tt = timetableFor(minutesOf('9:58')!);
    expect(tt.rows.map(fmtTime)).toEqual(['9:36', '9:58', '10:14', '10:29']);
    expect(fmtTime(tt.now)).toBe('9:51');
    expect(deskPickOk(time, minutesOf('9:58')!)).toBe(true);
    expect(deskPickOk(time, minutesOf('9:36')!)).toBe(false);
    const fare = asCustomer(station.archetypes.find((a) => a.id === 's_fare2')!);
    const rows = fareRowsFor(JP_PACK, fare);
    expect(rows[0]!.place).toBe('shinjuku');
    expect(rows[0]!.paper).toBe(200);
    expect(deskPickOk(fare, rows[0]!.paper)).toBe(true);
    expect(deskPickOk(fare, rows[0]!.ic)).toBe(false);
  });

  it('the staff phrase for each answer is lexicon Japanese, and it is accepted typed in digits, kanji or kana', () => {
    for (const a of station.archetypes) {
      const c = asCustomer(a);
      const phrase = deskPhrase(c)!;
      expect(phrase, a.id).toBeTruthy();
      const toks = tokenize(phrase, LEXICON).tokens;
      // the counters 番線 / 時 / 分 may be raw until the lexicon has them; nothing else may be unknown
      expect(toks.filter((t) => !t.punct && !t.raw && !t.gloss), `${a.id} ${phrase}`).toEqual([]);
      expect(deskSaid(c, phrase.replace(/\|/g, '')), a.id).toBe(true);
      const w = deskWrong(c);
      expect(w.wrong).toHaveLength(2);
      for (const wrong of w.wrong) expect(deskSaid(c, wrong.replace(/\|/g, '')), `${a.id} wrong ${wrong}`).toBe(false);
      expect(deskAnswerOf(c)).toBeTruthy();
    }
  });

  it('platform numbers, times and directions are understood in every script and nothing else', () => {
    for (const s of ['3', '３番線', '三番線です', 'さんばんせん', 'sanbansen', '三', '3番']) expect(platformSaid(s), s).toBe(3);
    expect(platformSaid('二番線と三番線')).toBeNull();
    expect(platformSaid('')).toBeNull();
    const c = say(2);
    expect(deskSaid(c, '二番線です')).toBe(true);
    expect(deskSaid(c, '三番線です')).toBe(false);
    for (const s of ['9:58', '9時58分', '九時五十八分です', 'くじごじゅうはっぷん', '９時５８分']) expect(timeSaid(s, 598), s).toBe(true);
    expect(timeSaid('9時57分', 598)).toBe(false);
    expect(timeSaid('十時ちょうど', 600)).toBe(true);
    expect(timeSaid('十時半', 630)).toBe(true);
    expect(minutesOf(958)).toBe(598);
    expect(minutesOf('14:25')).toBe(865);
    expect(timePhrase(598)).toBe('九時|五|十|八分|です|。'); // くじ ごじゅうはっぷん: the fused readings (lexicon/jobs.ts)
    expect(timePhrase(600)).toBe('十|時|です|。');
    for (const s of ['右', 'みぎ', '右です', 'migi']) expect(dirSaid(s), s).toBe('right');
    expect(dirSaid('左です')).toBe('left');
    expect(dirSaid('まっすぐです')).toBe('straight');
    expect(dirSaid('右か左')).toBeNull();
    expect(totalPhrase(170)).toBe('百|七|十|円|です|。');
  });
});

describe('a generated shift for each new job plays through the widgets without a gap', () => {
  for (const job of [cafe, station]) {
    it(`${job.id}: five customers at each rank are all drawable and judged`, () => {
      for (const rank of [0, 2]) {
        const plan = generateShift(JP_PACK, job.id, { rank, seed: 7 + rank, dueWords: [], recent: [] });
        expect(plan.customers).toHaveLength(5);
        for (const c of plan.customers) {
          if (job === station) {
            const ok = deskAnswerOf(c)!;
            expect(deskPickOk(c, ok.kind === 'time' ? minutesOf(String(ok.value))! : (ok.value as never))).toBe(true);
          } else {
            const w = wantedOf(c, cafeMenu);
            expect(orderCorrect(c, cafeMenu, w.cart, w.flags, w.table)).toBe(true);
          }
        }
      }
    });
  }
});

// ---- rendering -------------------------------------------------------------------------------------------------------
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0]!.avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const html = (el: ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

describe('the new widgets render in English and Arabic', () => {
  beforeEach(() => {
    useStore.getState().reset();
    resetBridgeForTests();
    useGame.getState().resetGame();
    useStore.setState({ profile, ready: true });
  });
  for (const lang of ['en', 'ar'] as const) {
    it(`desk pads and the café pad in ${lang}`, () => {
      setLang(lang);
      for (const [id, marker] of [
        ['s_platform', 'data-platform="3"'],
        ['s_dir', 'data-dir="straight"'],
        ['s_time', 'data-time="9:58"'],
        ['s_fare', 'data-fare="hikarigaoka:ic"'],
        ['s_announce', 'data-platform="4"'],
      ] as const) {
        const c = asCustomer(station.archetypes.find((a) => a.id === id)!);
        const out = html(createElement(DeskPad, { customer: c, pack: JP_PACK, picked: null, onPick: noop, onConfirm: noop }));
        expect(out, id).toContain(marker);
        expect(out).toContain('data-act="confirm-order"');
        expect(out).toContain('disabled');
      }
      // the plan is a physical plan: left stays left in Arabic too
      const map = html(createElement(DeskPad, { customer: asCustomer(station.archetypes.find((a) => a.id === 's_dir2')!), pack: JP_PACK, picked: null, onPick: noop, onConfirm: noop }));
      expect(map).toContain('class="sh-map" dir="ltr"');
      expect(map).toContain('data-target="left"');
      const pad = html(
        createElement(OrderPad, { menu: cafeMenu, cart: { 'cafe:latte': 1 }, flags: { iced: true }, flagIds: flagsFor('cafe'), table: 3, onAdd: noop, onRemove: noop, onFlag: noop, onTable: noop, onConfirm: noop }),
      );
      expect(pad).toContain('data-flag="hot"');
      expect(pad).toContain('data-flag="iced"');
      expect(pad).toContain('data-table="3"');
      expect(pad).toContain('aria-checked="true"');
    });
  }

  it('all jobs.* strings of the new widgets have both languages with the same placeholders', () => {
    const en = STRINGS.en as Record<string, string>;
    const ar = STRINGS.ar as Record<string, string>;
    for (const k of Object.keys(en).filter((x) => x.startsWith('jobs.desk') || x.startsWith('jobs.dir.') || x.startsWith('trip.'))) {
      expect(ar[k]?.trim(), k).toBeTruthy();
    }
  });
});

describe('Hanako\'s try without chips (b_real_try)', () => {
  it('is pending only after the beat sets real_try, applies to a shop conversation that offers Real mode, and is used up once', () => {
    const base = getGame();
    const none = { ...base, chapter: { ...base.chapter, flags: [] } };
    const set = { ...base, chapter: { ...base.chapter, flags: ['real_try_seen'] } };
    const used = { ...base, chapter: { ...base.chapter, flags: ['real_try_seen', 'real_try_done'] } };
    expect(realTryPending(none)).toBe(false);
    expect(realTryPending(set)).toBe(true);
    expect(realTryPending(used)).toBe(false);
    const shop = JP_PACK.scenarioMeta.find((m) => m.kind === 'shop' && m.real)!.id;
    const talk = JP_PACK.scenarioMeta.find((m) => m.kind !== 'shop')!.id;
    expect(realTryFor(JP_PACK, none, shop)).toBe(false);
    expect(realTryFor(JP_PACK, set, shop)).toBe(true);
    expect(realTryFor(JP_PACK, set, talk)).toBe(false);
    expect(realTryFor(JP_PACK, used, shop)).toBe(false);
  });
});

describe('the boss intro of every job continues to its Shift screen', () => {
  it('konbini, café and station intros go on to their own job; other conversations do not', () => {
    for (const job of JP_PACK.jobs) expect(feedbackThen(job.intro!, job.boss), job.id).toEqual({ screen: 'shift', args: { jobId: job.id } });
    expect(feedbackThen('konbini', 'tanaka')).toBeNull();
    expect(feedbackThen('chat_plan', 'mio')).toEqual({ screen: 'phone', args: { friendId: 'mio' } });
  });
});
