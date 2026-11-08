// 銭湯「桜の湯」 (the public bath): Genzō's two conversations. Every chip is understood at every node (with and without the game's hooks, EN
// and AR); typed Japanese works for the whole route; the bath is cash only (asking for the card is answered, never charged); the towel is
// part of the same payment; one purchase charges exactly once, running short charges nothing; the prices are the menu's.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { SENTO_PRICES } from '../../content/src/tokyo/scenarios-sento';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

/** The bandai with a purse: the basket is the bath, the rental towel when asked for, or the bottle of milk. */
function bandai(cash: number) {
  const log = { charges: [] as string[][], refused: 0 };
  const basket = (slots: Record<string, string>) => [slots.bath, slots.towel, slots.milk].filter((x): x is string => !!x);
  const yen = (slots: Record<string, string>) => basket(slots).reduce((a, k) => a + (SENTO_PRICES[k] ?? 0), 0);
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (yen(slots ?? {}) > 0 ? { total: money(yen(slots ?? {})) } : {}),
    charge(slots) {
      const total = yen(slots);
      if (!total || cash < total) {
        log.refused++;
        return { ok: false };
      }
      log.charges.push(basket(slots));
      cash -= total;
      return { ok: true };
    },
  };
  return { hooks, log, cash: () => cash };
}

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
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

function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}

/** Picks every suggestion at every reachable node; the character must always understand it and answer with displayable Japanese. */
function walk(id: string, l1: L1, mk: () => Partial<SessionOptions>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(id, l1, mk());
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    const sugg = s.suggestions();
    if (sugg.length < 1) problems.push(`${s.nodeId}: no suggestions`);
    sugg.forEach((sg, i) => {
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
  return { problems, visited };
}

const WALK_TIMEOUT = 60000;

describe('the public bath: every chip is understood', () => {
  const modes: Array<[string, () => Partial<SessionOptions>]> = [
    ['without hooks', () => ({})],
    ['with hooks, plenty of cash', () => ({ game: bandai(50000).hooks, flags: { priced: true } })],
    ['with hooks, almost no cash', () => ({ game: bandai(100).hooks, flags: { priced: true } })],
  ];
  for (const id of ['sento_desk', 'sento_after']) {
    for (const [label, mk] of modes) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${id}, ${label}, ${l1}`, () => {
          const { problems, visited } = walk(id, l1, mk);
          expect(problems).toEqual([]);
          const nodes = new Set([...visited].map((k) => k.split('|')[0]));
          const want = id === 'sento_desk' ? ['start', 'price', 'towel', 'manners', 'pay'] : ['start', 'milk', 'quote'];
          for (const n of want) expect(nodes.has(n), n).toBe(true);
        });
      }
    }
  }
}, WALK_TIMEOUT);

describe('the bandai (sento_desk)', () => {
  it('typed: one adult, a rental towel, the manners, cash: every step, one charge of the bath and the towel', () => {
    const c = bandai(50000);
    const s = open('sento_desk', 'en', { game: c.hooks, flags: { priced: true } });
    for (const line of ['大人一人お願いします。', 'タオルを借りたいです。', 'かけ湯って何ですか？', 'はい、わかりました。', '現金でお願いします。']) {
      const r = say(s, line);
      expect(r.learner.matched, `${s.nodeId}: ${line}`).toBe(true);
    }
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['manners', 'pay', 'ticket', 'towel']);
    expect(c.log.charges).toEqual([['adult', 'rent']]);
    expect(c.cash()).toBe(50000 - 650);
  });

  it('with your own towel the bath alone is charged; "I have no towel" is offered the rental instead', () => {
    const c = bandai(50000);
    const s = open('sento_desk', 'ar', { game: c.hooks, flags: { priced: true } });
    say(s, 'はい、一人です。');
    expect(s.nodeId).toBe('towel');
    say(s, 'タオルを持っていません。');
    expect(s.nodeId).toBe('towel');
    say(s, '持っています。');
    expect(s.nodeId).toBe('manners');
    tap(s, ['わかりました', 'どうぞ']);
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([['adult']]);
    expect(c.cash()).toBe(50000 - 550);
  });

  it('cash only: asking for the card is answered at the till and charges nothing; cash then pays once', () => {
    const c = bandai(50000);
    const s = open('sento_desk', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['大人', '持って', 'わかりました']);
    expect(s.nodeId).toBe('pay');
    tap(s, ['カード']);
    expect(s.nodeId).toBe('pay');
    say(s, 'カードでお願いします。');
    expect(s.nodeId).toBe('pay');
    expect(c.log.charges).toEqual([]);
    tap(s, ['現金']);
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([['adult']]);
  });

  it('running short charges nothing', () => {
    const c = bandai(300);
    const s = open('sento_desk', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['大人', '持って', 'わかりました', 'どうぞ']);
    expect(s.nodeId).toBe('short');
    expect(c.log.charges).toEqual([]);
    expect(c.cash()).toBe(300);
  });
});

describe('after the bath (sento_after)', () => {
  it('いいお湯でした, coffee milk, cash: every step, one charge of ¥150', () => {
    const c = bandai(50000);
    const s = open('sento_after', 'en', { game: c.hooks, flags: { priced: true } });
    for (const line of ['いいお湯でした！', 'コーヒー牛乳をください。', 'はい、どうぞ。']) expect(say(s, line).learner.matched, line).toBe(true);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['bath', 'milk', 'pay']);
    expect(c.log.charges).toEqual([['coffee']]);
    expect(c.cash()).toBe(50000 - 150);
  });

  it('「フルーツ牛乳はありますか？」 orders fruit milk; 「コーヒー牛乳」 is never plain milk', () => {
    const c = bandai(50000);
    const s = open('sento_after', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, '気持ちよかったです。');
    say(s, 'フルーツ牛乳はありますか？');
    expect(s.nodeId).toBe('quote');
    tap(s, ['どうぞ']);
    expect(c.log.charges).toEqual([['fruit']]);
  });

  it('a no-thanks ends kindly with nothing charged', () => {
    const c = bandai(50000);
    const s = open('sento_after', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['いいお湯', '今日は']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('bye');
    expect(c.log.charges).toEqual([]);
  });
});

describe('the menu', () => {
  it('the prices are the menu prices, and the shop sells exactly what the two conversations map to', () => {
    const metas = JP_PACK.scenarioMeta.filter((m) => m.shop?.shopId === 'sento');
    expect(metas.map((m) => m.id).sort()).toEqual(['sento_after', 'sento_desk']);
    const mapped = metas.flatMap((m) => Object.entries(m.shop!.itemMap));
    for (const [opt, id] of mapped) expect(JP_PACK.menu.find((x) => x.id === id)?.price, id).toBe(SENTO_PRICES[opt]);
    expect([...JP_PACK.shops.find((s) => s.id === 'sento')!.sells].sort()).toEqual(mapped.map(([, id]) => id).sort());
    expect(JP_PACK.shops.find((s) => s.id === 'sento')!.pay).toEqual(['cash']);
  });
});
