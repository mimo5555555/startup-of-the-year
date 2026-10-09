// denki_phone (agent 3C-lite, docs/GAME_DESIGN.md §6.3, §6.7): every chip is understood at every node (with and without game hooks, enough
// cash and too little, the stock flags), the purchase is completable by tapping chips alone (and the short / leave branches), the typed
// language works, and every pocket and phrasebook line of the module is language an intent accepts.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, yenToJa, type L1, type Scenario, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { DENKI_FUKU_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-denki-fuku';
import { SHOP_DENKI_PHRASES } from '../../content/src/phrasebook/shop-denki';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};
const PRICES: Record<string, number> = { used: 24800, pro: 128000, case: 1980, tv: 24800, musicCd: 3300 };

/** A counter with a purse: the price is the one of the chosen item (the refurbished phone before a choice). */
function counter(cash: number) {
  const log = { charges: [] as string[], refused: 0 };
  const priceOf = (s: Record<string, string>) => (s.giftItem ? PRICES.musicCd : PRICES[s.denkiItem ?? 'used']);
  const hooks: SessionGameHooks = {
    vars: (slots) => ({ price: money(priceOf(slots)), total: money(priceOf(slots)) }),
    charge(slots) {
      if (cash < priceOf(slots)) {
        log.refused++;
        return { ok: false };
      }
      log.charges.push(slots.giftItem ?? slots.denkiItem ?? 'used');
      cash -= priceOf(slots);
      return { ok: true };
    },
  };
  return { hooks, log };
}

const slots = (s: ConversationSession): Record<string, string> => (s as unknown as { slotIds: Record<string, string> }).slotIds;

function open(l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById('denki_phone')!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** Picks every suggestion at every reachable node; Aoi must always understand it. */
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
    const sugg = s.suggestions();
    if (sugg.length < 2) problems.push(`${s.nodeId}: fewer than 2 suggestions`);
    sugg.forEach((sg, i) => {
      if (sg.tokens.some((t) => t.s === '…' && !t.punct)) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const t = replay(path);
      const r = t.pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i}: Aoi's answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: Aoi's answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: visited.size, visited };
}

/** Mirrors what the app does with whatever the learner types or says. */
function say(s: ConversationSession, text: string): SubmitResult {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

/** Taps the chip whose Japanese contains `part` (or the first chip) until the conversation ends. */
function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}

const modes: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: counter(500000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: counter(100).hooks, flags: { priced: true } })],
  ['with the twist', () => ({ game: counter(500000).hooks, flags: { priced: true, twist: true } })],
  ['with the latest phone and the TV out of stock', () => ({ game: counter(500000).hooks, flags: { priced: true, pro_locked: true, tv_locked: true } })],
  ['with only the latest phone out of stock', () => ({ game: counter(500000).hooks, flags: { priced: true, pro_locked: true } })],
];

describe('denki_phone: every chip is understood', () => {
  for (const [label, mk] of modes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const r = walk(l1, mk);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(8);
      });
    }
  }

  it('the walk reaches every node of the scenario that a chip can reach (the stock gates are typed-only)', () => {
    const r = walk('en', () => ({ game: counter(500000).hooks, flags: { priced: true } }));
    const seen = new Set([...r.visited].map((k) => k.split('|')[0]));
    const all = Object.keys(scenarioById('denki_phone')!.nodes);
    const typedOnly = ['pro_offer', 'tv_offer', 'quote_tv', 'done', 'short', 'leave'];
    expect(all.filter((n) => !seen.has(n) && !typedOnly.includes(n))).toEqual([]);
  });
});

describe('denki_phone: the whole purchase by tapping chips', () => {
  const HAPPY = ['スマホ', '中古スマホ', '黒', 'これ', 'カード', 'です', 'はい'];

  it('with enough cash: every goal step done, charged once, the phone named', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, HAPPY);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['choose', 'name', 'pay', 'price', 'want']);
    expect(c.log.charges).toEqual(['used']);
    expect(slots(s).denkiItem).toBe('used');
    expect(slots(s).colour).toBe('black');
    expect(slots(s).payMethod).toBe('card');
    expect(s.summary().goalDone).toBe(5);
  });

  it('the price is read aloud from the hooks, never typed into a line', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['スマホ', '中古スマホ']);
    expect(s.turns[s.turns.length - 1].line.written).toContain('二万四千八百円');
    tap(s, ['黒']);
    expect(s.nodeId).toBe('quote');
    expect(s.turns[s.turns.length - 1].line.written).toContain('二万四千八百円');
    expect(s.turns[s.turns.length - 1].line.written).toContain('黒');
  });

  it('with too little cash it ends at short with no purchase and no goal step pay; then leave without buying', () => {
    const c = counter(100);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, HAPPY);
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(false);
    expect(c.log.charges).toEqual([]);
    expect(s.stepsDone.has('pay')).toBe(false);
    tap(s, ['また']);
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect(s.stepsDone.has('pay')).toBe(false);
  });

  it('short -> cheaper goes back to the models; a cheaper item (the case) is then bought', () => {
    const c = counter(5000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, HAPPY);
    expect(s.nodeId).toBe('short');
    tap(s, ['安い']);
    expect(s.nodeId).toBe('models');
    tap(s, ['スマホケース', '黒', 'これ', 'カード', 'です', 'はい']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual(['case']);
  });

  it('think about it at the quote: a polite leave, nothing charged, pay never done', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['スマホ', '中古スマホ', '黒', '考えます']);
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([]);
    expect(s.stepsDone.has('pay')).toBe(false);
  });

  it('declining at the confirmation leaves without a purchase', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['スマホ', '中古スマホ', '黒', 'これ', '現金', 'です', 'いいえ']);
    expect(s.nodeId).toBe('leave');
    expect(c.log.charges).toEqual([]);
  });

  it('the present branch: a music CD is bought with the shared giftItem slot', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['プレゼント', '音楽CD', 'カード']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual(['musicCd']);
    expect(slots(s).giftItem).toBe('musicCd');
  });
});

describe('denki_phone: typed language', () => {
  it('a typed name in any script is accepted, with the katakana chip as the default', () => {
    for (const name of ['レイラです。', 'Layla です', '雷拉です']) {
      const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
      tap(s, ['スマホ', '中古スマホ', '黒', 'これ', 'カード']);
      expect(s.nodeId).toBe('pay'.length ? 'name' : '');
      say(s, name);
      expect(s.nodeId, name).toBe('confirm');
      expect(s.stepsDone.has('name')).toBe(true);
    }
  });

  it('the name chip carries the learner name', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['スマホ', '中古スマホ', '黒', 'これ', 'カード']);
    expect(s.suggestions()[0].written).toBe('レイラです。');
  });

  it('natural variants: price questions, the cheaper one, the item at the start, the latest phone, the TV', () => {
    const s = open('en', { game: counter(500000).hooks, flags: { priced: true } });
    expect(say(s, 'スマホがほしいのですが').learner.matched).toBe(true);
    expect(s.nodeId).toBe('models');
    expect(say(s, 'どちらが安いですか？').character.line.written).toContain('中古スマホ');
    expect(s.nodeId).toBe('models');
    expect(say(s, '最新スマホはいくらですか').character.line.written).toContain('十二万八千円');
    expect(s.nodeId).toBe('pro_offer');
    say(s, '青をお願いします');
    expect(s.nodeId).toBe('quote');
    expect(s.turns[s.turns.length - 1].line.written).toContain('十二万八千円');
    say(s, '免税できますか');
    expect(s.nodeId).toBe('quote');
    say(s, '高いです');
    expect(s.turns[s.turns.length - 1].line.written).toContain('定価');
    const t = open('en', { game: counter(500000).hooks, flags: { priced: true } });
    say(t, 'テレビをください');
    expect(t.nodeId).toBe('tv_offer');
    say(t, 'これをください');
    expect(t.nodeId).toBe('quote_tv');
    expect(t.turns[t.turns.length - 1].line.written).not.toContain('の');
  });

  it('the stock flags change the lines: pro_locked says it is not in stock yet', () => {
    const s = open('en', { game: counter(500000).hooks, flags: { priced: true, pro_locked: true } });
    say(s, 'スマホがほしいのですが');
    expect(s.turns[s.turns.length - 1].line.written).toContain('まだ入荷');
    say(s, '最新スマホをください');
    expect(s.nodeId).toBe('pro_offer');
    expect(s.turns[s.turns.length - 1].line.written).toContain('まだ入荷');
  });
});

describe('denki_phone: pockets and phrasebook', () => {
  it('every pocket line is understood by the scenario at a node on the happy path', () => {
    const lines = Object.values(DENKI_FUKU_POCKETS).filter((p) => p.id.startsWith('p_denki_'));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const stages: Array<[string[], string]> = [
      [[], 'start'],
      [['スマホ'], 'models'],
      [['スマホ', '中古スマホ', '黒'], 'quote'],
      [['スマホ', '中古スマホ', '黒', 'これ'], 'pay'],
    ];
    for (const p of lines) {
      const text = p.line.ja.replace(/\|/g, '').replace('{name}', 'レイラ');
      const ok = stages.some(([taps, node]) => {
        const s = open('en', { game: counter(500000).hooks, flags: { priced: true } });
        tap(s, taps);
        if (s.nodeId !== node) return false;
        const r = s.submit({ text, mode: 'typed_ja' });
        return r.learner.matched && r.character.kind !== 'fallback';
      });
      expect(ok, `${p.id} ${text}`).toBe(true);
    }
  });

  it('every phrasebook line of the module is language the scenario accepts at some node', () => {
    const stages: Array<[string[], string]> = [
      [[], 'start'],
      [['スマホ'], 'models'],
      [['スマホ', '中古スマホ'], 'colour'],
      [['スマホ', '中古スマホ', '黒'], 'quote'],
      [['スマホ', '中古スマホ', '黒', 'これ'], 'pay'],
      [['スマホ', '中古スマホ', '黒', 'これ', 'カード'], 'name'],
      [['プレゼント'], 'goods'],
    ];
    for (const p of SHOP_DENKI_PHRASES) {
      const text = p.ja.replace(/\|/g, '').replace('{name}', 'レイラ');
      const ok = stages.some(([taps, node]) => {
        const s = open('en', { game: counter(500000).hooks, flags: { priced: true } });
        tap(s, taps);
        if (s.nodeId !== node) return false;
        const r = s.submit({ text, mode: 'typed_ja' });
        return r.learner.matched && r.character.kind !== 'fallback';
      });
      expect(ok, `${p.id} ${text}`).toBe(true);
    }
  });
});

export type { Scenario };
