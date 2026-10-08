import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS } from '@lw/content';
import { type DerivedEvent, type LoopSettlement, type PayLine, type Quote } from '@lw/game';
import { DebriefPay, type DebriefData } from '../src/components/game/DebriefGame';
import { PriceChip } from '../src/components/game/PriceChip';
import { ReceiptSheet } from '../src/components/game/ReceiptSheet';
import { StarsRow } from '../src/components/game/StarsRow';
import { useGame } from '../src/game/gameStore';
import { resetBridgeForTests } from '../src/game/bridge';
import { useStore, type Profile } from '../src/store';
import { en as enDebrief, ar as arDebrief } from '../src/strings/debrief';

const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };
// React's server render reads a zustand store's initial state, so the language is set on both (as hud-render.test.ts does)
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const html = (el: ReactElement) => renderToStaticMarkup(el);

beforeEach(() => {
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  Object.assign(useGame.getInitialState(), useGame.getState());
  useStore.setState({ profile, ready: true });
  setLang('en');
});

const settlement = (lines: PayLine[], stars: 0 | 1 | 2 | 3 = 1): LoopSettlement =>
  ({
    stats: { n: 5, r: 0.5, assisted: 3, independent: 2 },
    stars,
    newStars: stars ? [{ star: 1, yen: 200 }] : [],
    total: lines.reduce((a, l) => a + l.yen, 0),
    lines,
    practiceOnly: false,
  }) as unknown as LoopSettlement;

const debrief = (s: LoopSettlement): DebriefData => ({
  forReport: {} as DebriefData['forReport'],
  facts: { sessionId: 's1', scenarioId: 'cafe', mode: 'guided', prepared: false } as unknown as DebriefData['facts'],
  derived: [{ t: 'loop_settled', settlement: s } as DerivedEvent],
  purchases: [],
  keep: [],
});

const LINES: PayLine[] = [
  { reason: 'lines', yen: 300 },
  { reason: 'steps', yen: 120 },
  { reason: 'star', yen: 200, vars: { stars: 1 } },
];

describe('StarsRow', () => {
  it('lights the earned stars, pulses the new ones and says what each one needed (percent from BALANCE)', () => {
    const out = html(createElement(StarsRow, { stars: 2, fresh: 1 }));
    expect(out.match(/<li class="on/g)).toHaveLength(2);
    expect(out.match(/fresh/g)).toHaveLength(1);
    expect(out).toContain('60%+');
    expect(out).toContain('80%+');
  });

  it('shows three empty stars at zero', () => {
    expect(html(createElement(StarsRow, { stars: 0 })).match(/<li class="on/g)).toBeNull();
  });
});

describe('PriceChip', () => {
  it('shows the yen in digits with the tax note, Latin digits and left-to-right in Arabic too', () => {
    expect(html(createElement(PriceChip, { amount: 450 }))).toMatch(/¥450/);
    setLang('ar');
    const ar = html(createElement(PriceChip, { amount: 1200 }));
    expect(ar).toMatch(/<b dir="ltr">¥1,200<\/b>/);
    expect(ar).toContain('data-price="1200"');
  });

  it('a fare has no "tax included" note and a big price carries the work-hours chip', () => {
    expect(html(createElement(PriceChip, { amount: 190, fare: true }))).not.toContain('<small>');
    expect(html(createElement(PriceChip, { amount: 24800 }))).toContain('dbf-hours');
    expect(html(createElement(PriceChip, { amount: 160 }))).not.toContain('dbf-hours');
  });
});

describe('ReceiptSheet', () => {
  const receipt = {
    shopId: 'cafe',
    lines: [{ label: { en: 'Coffee', ar: 'قهوة' }, qty: 2, unit: 400, amount: 800 }],
    subtotal: 741,
    tax: 59,
    total: 800,
    paid: 1000,
    change: 200,
  } as unknown as Quote & { paid?: number; change?: number };

  it('prints the rows, subtotal, tax, total and, for cash, what was handed over and the change', () => {
    const out = html(createElement(ReceiptSheet, { receipt }));
    expect(out).toContain('Coffee');
    for (const n of ['¥741', '¥59', '¥800', '¥1,000', '¥200']) expect(out).toContain(n);
    expect(out).toContain('2 × ¥400');
  });

  it('a card payment has no handed-over or change rows', () => {
    const { paid: _p, change: _c, ...card } = receipt;
    const out = html(createElement(ReceiptSheet, { receipt: card as typeof receipt }));
    expect(out).not.toContain('¥1,000');
  });

  it('Arabic: amounts stay left-to-right and the sheet is right-to-left', () => {
    setLang('ar');
    const out = html(createElement(ReceiptSheet, { receipt }));
    expect(out).toContain('dir="rtl"');
    expect(out).toMatch(/<b dir="ltr"[^>]*>¥800<\/b>/);
  });
});

describe('DebriefPay (§2.5 compact vs full)', () => {
  it('the first conversations get one pay line with its plain reasons and no ledger rows', () => {
    const out = html(createElement(DebriefPay, { data: debrief(settlement(LINES)) }));
    expect(out).toContain('dbf-payline');
    expect(out).toContain('+¥620');
    expect(out).toContain('Your lines');
    expect(out).not.toContain('dbf-rows');
  });

  it('from the 4th conversation (or Chapter 2) the ledger rows show, each with its own amount, and add up to the total', () => {
    const g = useGame.getState();
    useGame.setState({ runs: { cafe: { ...(g.runs.cafe ?? {}), count: 4 } as never } });
    Object.assign(useGame.getInitialState(), useGame.getState());
    const out = html(createElement(DebriefPay, { data: debrief(settlement(LINES)) }));
    expect(out).toContain('dbf-rows');
    expect(out).not.toContain('dbf-payline');
    for (const n of ['+¥300', '+¥120', '+¥200', '+¥620']) expect(out).toContain(n);
  });

  it('a conversation that pays nothing says so kindly instead of showing a blank', () => {
    const s = { ...settlement([{ reason: 'practiceOnly', yen: 0 }], 0), total: 0, practiceOnly: true };
    const out = html(createElement(DebriefPay, { data: debrief(s) }));
    expect(out).toContain('Practice only');
    expect(out).toContain('Finish every goal to earn a star.');
  });

  it('a replay that pays nothing because it was played already today says so, not "practice only" (compact line)', () => {
    const s = { ...settlement([{ reason: 'lines', yen: 1180 }, { reason: 'repeat', yen: -1180 }], 1), total: 0, newStars: [] };
    const out = html(createElement(DebriefPay, { data: debrief(s) }));
    expect(out).toContain('dbf-payline');
    expect(out).toContain('Played already today');
    expect(out).not.toContain('Practice only');
  });

  it('Arabic: the yen is a left-to-right span inside the right-to-left line', () => {
    setLang('ar');
    const out = html(createElement(DebriefPay, { data: debrief(settlement(LINES)) }));
    expect(out).toMatch(/<strong dir="ltr"[^>]*>\+¥620<\/strong>/);
  });

  it('Arabic full ledger: amounts inside sentences are isolated too, sign included', () => {
    setLang('ar');
    const g = useGame.getState();
    useGame.setState({ runs: { cafe: { ...(g.runs.cafe ?? {}), count: 4 } as never } });
    Object.assign(useGame.getInitialState(), useGame.getState());
    const out = html(createElement(DebriefPay, { data: debrief(settlement(LINES)) }));
    expect(out).toContain('<bdi dir="ltr">¥3,000</bdi>');
    expect(out).toMatch(/<bdi dir="ltr">\+¥\d+<\/bdi>/);
  });

  it('no settlement event, no block (a conversation that failed to settle still shows the report)', () => {
    expect(html(createElement(DebriefPay, { data: { ...debrief(settlement(LINES)), derived: [] } }))).toBe('');
  });
});

describe('debrief strings', () => {
  it('every key has an Arabic string with the same {placeholders}', () => {
    const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(enDebrief) as Array<keyof typeof enDebrief>) expect(holders(arDebrief[k]), k).toBe(holders(enDebrief[k]));
  });
});
