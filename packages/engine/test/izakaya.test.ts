// 居酒屋「なごみ」: Misaki's evening. Every chip is understood at every node (with and without the game's hooks, as an adult and as a
// minor, EN and AR); the typed route works; the drinks are two when you say 二つ; the お通し rides on every order; 「割り勘で」 charges one
// share and 「一緒で」 the whole bill, exactly once; a minor is never sold a beer (「お酒は二十歳からです」); the prices are the menu's.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { IZAKAYA_PRICES } from '../../content/src/tokyo/scenarios-izakaya';

const QTY: Record<string, number> = { one: 1, two: 2, three: 3 };
const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

/** The till with a purse: the drinks (qty), the dish, two お通し, halved for 割り勘 (the player's share rounds up). */
function till(cash: number) {
  const log = { charges: [] as Array<{ yen: number; slots: Record<string, string> }> };
  const bill = (slots: Record<string, string>) => {
    if (!slots.izaDrink && !slots.izaFood) return 0;
    const all = (slots.izaDrink ? IZAKAYA_PRICES[slots.izaDrink]! * (QTY[slots.qty ?? 'one'] ?? 1) : 0) + (slots.izaFood ? IZAKAYA_PRICES[slots.izaFood]! : 0) + 2 * IZAKAYA_PRICES.otoshi!;
    return slots.billSplit === 'half' ? Math.ceil(all / 2) : all;
  };
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: money(bill(slots ?? {})) } : {}),
    charge(slots) {
      const yen = bill(slots);
      if (!yen || cash < yen) return { ok: false };
      log.charges.push({ yen, slots: { ...slots } });
      cash -= yen;
      return { ok: true };
    },
  };
  return { hooks, log, cash: () => cash };
}

function open(l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById('izakaya_dinner')!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
};

/** Picks every suggestion at every reachable node; the character must always understand it and answer with displayable Japanese. */
function walk(l1: L1, mk: () => Partial<SessionOptions>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(l1, mk());
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    s.suggestions().forEach((sg, i) => {
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i} "${sg.written}": the answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: new Set([...visited].map((k) => k.split('|')[0])) };
}

describe('izakaya_dinner: every chip is understood', () => {
  const modes: Array<[string, () => Partial<SessionOptions>]> = [
    ['without hooks, an adult', () => ({ flags: { adult: true } })],
    ['with hooks, an adult, plenty of cash', () => ({ game: till(50000).hooks, flags: { priced: true, adult: true } })],
    ['with hooks, a minor, almost no cash', () => ({ game: till(500).hooks, flags: { priced: true, minor: true } })],
  ];
  for (const [label, mk] of modes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const { problems, nodes } = walk(l1, mk);
        expect(problems).toEqual([]);
        for (const n of ['start', 'drinks', 'otoshi', 'served', 'enjoy', 'bill', 'split', 'pay']) expect(nodes.has(n), n).toBe(true);
      }, 60000);
    }
  }
});

describe('the evening', () => {
  it('typed, split: two oolong teas, the otoshi explained, yakitori, 乾杯, the bill, 割り勘, cash: one charge of one share', () => {
    const c = till(50000);
    const s = open('en', { game: c.hooks, flags: { priced: true, adult: true } });
    for (const line of ['二人です。', 'ウーロン茶を二つください。', 'お通しって何ですか？', '焼き鳥をください。', '乾杯！', 'すみません！お会計お願いします。', '割り勘でお願いします。', '現金でお願いします。']) {
      const r = say(s, line);
      expect(r.learner.matched, `${s.nodeId}: ${line}`).toBe(true);
    }
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['bill', 'drinks', 'food', 'kanpai', 'pay', 'people', 'split']);
    // (350 x 2 + 680 + 300 x 2) / 2 = 990
    expect(c.log.charges.map((x) => x.yen)).toEqual([990]);
    expect(c.log.charges[0]!.slots).toMatchObject({ izaDrink: 'oolong', qty: 'two', izaFood: 'yakitori', billSplit: 'half' });
  });

  it('together: the whole bill, with the total said before and the share never asked', () => {
    const c = till(50000);
    const s = open('ar', { game: c.hooks, flags: { priced: true, adult: true } });
    for (const line of ['二人です。', 'オレンジジュースを二つください。', '枝豆をください。', 'いただきます！', 'お会計お願いします。']) say(s, line);
    expect(s.nodeId).toBe('bill');
    say(s, '一緒でお願いします。');
    expect(s.nodeId).toBe('pay');
    say(s, 'カードでお願いします。');
    expect(s.ended).toBe(true);
    expect(c.log.charges.map((x) => x.yen)).toEqual([350 * 2 + 380 + 600]);
  });

  it('「別々に払えますか？」 is a split too; short of the whole bill, splitting pays', () => {
    const c = till(1000);
    const s = open('en', { game: c.hooks, flags: { priced: true, adult: true } });
    for (const line of ['二人です。', 'ウーロン茶を二つください。', '唐揚げをください。', '乾杯！', 'お会計お願いします。', '一緒でお願いします。', '現金でお願いします。']) say(s, line);
    expect(s.nodeId).toBe('short');
    expect(c.log.charges).toEqual([]);
    say(s, '別々に払えますか？');
    expect(s.nodeId).toBe('split');
    say(s, 'はい、どうぞ。');
    expect(s.ended).toBe(true);
    // (700 + 580 + 600) / 2 = 940
    expect(c.log.charges.map((x) => x.yen)).toEqual([940]);
  });

  it('beer: an adult may order it after the age check (二十歳以上); a minor is told it is from twenty and offered a soft drink', () => {
    const adult = open('en', { flags: { adult: true } });
    say(adult, '二人です。');
    expect(adult.suggestions().map((x) => x.written)).toContain('生ビールを二つください。');
    expect(say(adult, '生ビールを二つください。').learner.intentId).toBe('pick_beer');
    expect(adult.nodeId).toBe('age_check');
    expect(adult.turns.at(-1)!.line.written.replace(/\s/g, '')).toBe('失礼ですが、二十歳以上ですか？');
    expect(say(adult, 'はい、二十歳以上です。').learner.intentId).toBe('age_ok');
    expect(adult.nodeId).toBe('otoshi');
    expect(adult.turns.at(-1)!.line.written).toContain('生ビール');

    const minor = open('en', { flags: { minor: true } });
    say(minor, '二人です。');
    expect(minor.suggestions().map((x) => x.written)).not.toContain('生ビールを二つください。');
    const r = say(minor, '生ビールを二つください。');
    expect(r.learner.intentId).toBe('beer_no');
    expect(r.character.line.written.replace(/\s/g, '')).toContain('お酒は二十歳からです');
    expect(minor.nodeId).toBe('drinks');
    expect(say(minor, 'じゃあ、ウーロン茶を二つください。').learner.intentId).toBe('pick_drink');
  });
});

describe('the age check (年齢確認)', () => {
  it('「未成年です」: no beer, a soft drink instead, charged at its price', () => {
    const c = till(50000);
    const s = open('ar', { game: c.hooks, flags: { priced: true, adult: true } });
    for (const line of ['二人です。', '生ビールを二つください。']) say(s, line);
    expect(say(s, 'いいえ、未成年です。').learner.intentId).toBe('age_no');
    expect(s.nodeId).toBe('soft');
    expect(s.suggestions().map((x) => x.written)).not.toContain('生ビールを二つください。');
    say(s, 'オレンジジュースを二つください。');
    expect(s.nodeId).toBe('otoshi');
    for (const line of ['枝豆をください。', '乾杯！', 'お会計お願いします。', '一緒でお願いします。', '現金でお願いします。']) say(s, line);
    expect(s.ended).toBe(true);
    expect(c.log.charges.map((x) => x.yen)).toEqual([350 * 2 + 380 + 600]);
    expect(c.log.charges[0]!.slots.izaDrink).toBe('orange');
  });

  it('a change of mind at the check is a soft drink too; 「はい」 alone is a yes', () => {
    const s = open('en', { flags: { adult: true } });
    for (const line of ['二人です。', '生ビールを二つください。']) say(s, line);
    expect(say(s, 'じゃあ、ウーロン茶を二つください。').learner.intentId).toBe('pick_drink');
    expect(s.nodeId).toBe('otoshi');
    const t = open('en', { flags: { adult: true } });
    for (const line of ['二人です。', '生ビールを二つください。']) say(t, line);
    expect(say(t, 'はい。').learner.intentId).toBe('age_ok');
  });
});

describe('the menu', () => {
  it('the prices are the menu prices; the お通し is the cover of every order, two of them; cash and card', () => {
    const meta = JP_PACK.scenarioMeta.find((m) => m.id === 'izakaya_dinner')!;
    for (const [opt, id] of Object.entries(meta.shop!.itemMap)) expect(JP_PACK.menu.find((x) => x.id === id)?.price, id).toBe(IZAKAYA_PRICES[opt]);
    expect(meta.shop!.cover).toEqual({ itemId: 'izakaya:otoshi', qty: 2 });
    expect(JP_PACK.menu.find((x) => x.id === 'izakaya:otoshi')?.price).toBe(IZAKAYA_PRICES.otoshi);
    const shop = JP_PACK.shops.find((s) => s.id === 'izakaya')!;
    expect(shop.openChapter).toBe(6);
    expect(shop.pay).toEqual(['cash', 'card']);
  });
});
