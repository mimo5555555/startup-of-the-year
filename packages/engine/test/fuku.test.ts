// fuku_clothes (agent A2, docs/GAME_DESIGN.md §6.3): every chip is understood at every node (with and without game hooks, enough cash and
// too little, the twist), the purchase is completable by tapping chips alone (and the short / leave branches), the fit and size variations
// work, the typed language works, and every pocket and phrasebook line of the module is language an intent accepts.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { DENKI_FUKU_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-denki-fuku';
import { SHOP_FUKU_PHRASES } from '../../content/src/phrasebook/shop-fuku';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};
const PRICES: Record<string, number> = { tee: 1990, cap: 2490, hoodie: 4990, jeans: 5990, sneakers: 7990, jacket: 12900, glasses: 9900, backpack: 6900, suit: 19800, plush: 800, guitarPick: 300 };

/** A counter with a purse: the price is the one of the chosen piece (the T-shirt before a choice). */
function counter(cash: number) {
  const log = { charges: [] as string[], refused: 0 };
  const idOf = (s: Record<string, string>) => s.giftItem ?? s.clothes ?? 'tee';
  const hooks: SessionGameHooks = {
    vars: (slots) => ({ price: money(PRICES[idOf(slots)]), total: money(PRICES[idOf(slots)]) }),
    charge(slots) {
      if (cash < PRICES[idOf(slots)]) {
        log.refused++;
        return { ok: false };
      }
      log.charges.push(idOf(slots));
      cash -= PRICES[idOf(slots)];
      return { ok: true };
    },
  };
  return { hooks, log };
}

const slots = (s: ConversationSession): Record<string, string> => (s as unknown as { slotIds: Record<string, string> }).slotIds;

function open(l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById('fuku_clothes')!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** The pieces whose lines differ: the colour choice, the one-size line and the one-colour line (the rest repeat them). */
const variantOf = (clothes?: string) => (['tee', 'hoodie', 'sneakers'].includes(clothes ?? '') ? 'colours' : ['cap', 'glasses', 'backpack'].includes(clothes ?? '') ? 'free' : 'single');

/** Picks every suggestion at every reachable node; Rin must always understand it. */
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
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}|${variantOf(slots(s).clothes)}`;
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
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i} "${sg.written}": Rin's answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: Rin's answer has a token without gloss`);
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

/** Taps the chip whose Japanese contains `part` until all parts are done. */
function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}

const lastLine = (s: ConversationSession) => s.turns[s.turns.length - 1].line.written;

/** The walk replays every path from the start, so it is slow on purpose (it covers every piece). */
const WALK_TIMEOUT = 60000;

const modes: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: counter(500000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: counter(100).hooks, flags: { priced: true } })],
  ['with the twist', () => ({ game: counter(500000).hooks, flags: { priced: true, twist: true } })],
  ['with the twist and no hooks', () => ({ flags: { twist: true } })],
];

describe('fuku_clothes: every chip is understood', () => {
  for (const [label, mk] of modes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const r = walk(l1, mk);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(10);
      }, WALK_TIMEOUT);
    }
  }

  it('the walk reaches every node of the scenario (every one is reachable by chips)', () => {
    const r = walk('en', () => ({ game: counter(500000).hooks, flags: { priced: true } }));
    const seen = new Set([...r.visited].map((k) => k.split('|')[0]));
    const all = Object.keys(scenarioById('fuku_clothes')!.nodes);
    // `done` and `leave` are end nodes (the walk stops there); `short` needs too little cash
    expect(all.filter((n) => !seen.has(n) && !['done', 'leave', 'short'].includes(n))).toEqual([]);
    const poor = walk('en', () => ({ game: counter(100).hooks, flags: { priced: true } }));
    expect([...poor.visited].some((k) => k.startsWith('short|'))).toBe(true);
  }, WALK_TIMEOUT);
});

describe('fuku_clothes: the whole purchase by tapping chips', () => {
  const HAPPY = ['Tシャツ', 'エムサイズ', '黒', '試着', 'ちょうどいい', 'これ', 'カード'];

  it('with enough cash: every goal step done, charged once, the piece, size, colour and fit recorded', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, HAPPY);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['colour', 'fit', 'look', 'pay', 'size', 'try']);
    expect(c.log.charges).toEqual(['tee']);
    expect(slots(s).clothes).toBe('tee');
    expect(slots(s).size).toBe('m');
    expect(slots(s).clothesColour).toBe('black');
    expect(slots(s).fit).toBe('just');
    expect(slots(s).payMethod).toBe('card');
    expect(s.summary().goalDone).toBe(6);
  });

  it('the same without game hooks (the fixed fallback prices)', () => {
    const s = open('en');
    tap(s, HAPPY);
    expect(s.nodeId).toBe('done');
    expect(s.summary().goalDone).toBe(6);
  });

  it('the fitting-room beat is a node of its own, entered after the learner asks to try it on; the compliment follows', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['Tシャツ', 'エムサイズ', '黒']);
    expect(s.nodeId).toBe('offer');
    tap(s, ['試着']);
    expect(s.nodeId).toBe('fitting');
    expect(lastLine(s)).toContain('試着できますよ');
    expect(slots(s).clothes).toBe('tee');
    expect(slots(s).clothesColour).toBe('black');
    tap(s, ['ちょうどいい']);
    expect(s.nodeId).toBe('suits');
    expect(lastLine(s)).toContain('似合います');
  });

  it('every piece can be bought: the sized ones with a colour or the colour-less line, the one-size ones with the one-size line', () => {
    for (const [id, word] of [['tee', 'Tシャツ'], ['hoodie', 'パーカー'], ['jeans', 'ジーンズ'], ['sneakers', 'スニーカー'], ['cap', '帽子'], ['jacket', 'ダウンジャケット'], ['glasses', 'メガネ'], ['backpack', 'リュック'], ['suit', 'スーツ']]) {
      const c = counter(500000);
      const s = open('en', { game: c.hooks, flags: { priced: true } });
      say(s, `${word}をください`);
      expect(slots(s).clothes, id).toBe(id);
      expect(s.nodeId, id).toBe('size');
      if (['cap', 'glasses', 'backpack'].includes(id)) expect(lastLine(s), id).toContain('フリーサイズ');
      else expect(lastLine(s), id).toContain('エムサイズ');
      tap(s, ['はい']);
      expect(s.nodeId, id).toBe('colour');
      if (['tee', 'hoodie', 'sneakers'].includes(id)) expect(lastLine(s), id).toContain('黄色');
      else expect(lastLine(s), id).toContain('この色だけ');
      tap(s, ['はい']);
      tap(s, ['試着', 'ちょうどいい', 'これ', '現金']);
      expect(s.nodeId, id).toBe('done');
      expect(c.log.charges, id).toEqual([id]);
      expect([...s.stepsDone].sort(), id).toEqual(['colour', 'fit', 'look', 'pay', 'size', 'try']);
    }
  });

  it('the price is read from the hooks and never typed: at the size (sized pieces), at the offer and at the quote', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['Tシャツ']);
    expect(lastLine(s)).toContain('千九百九十円');
    tap(s, ['エムサイズ', '黒']);
    expect(lastLine(s)).toContain('千九百九十円');
    tap(s, ['試着', 'ちょうどいい', 'これ']);
    expect(s.nodeId).toBe('quote');
    expect(lastLine(s)).toContain('千九百九十円');
  });

  it('without hooks the quote reads the fixed price of the chosen piece', () => {
    for (const [word, price] of [['Tシャツ', '千九百九十円'], ['ジーンズ', '五千九百九十円'], ['ダウンジャケット', '一万二千九百円'], ['スーツ', '一万九千八百円']]) {
      const s = open('en');
      say(s, `${word}をください`);
      tap(s, ['エムサイズ']);
      tap(s, ['はい']);
      tap(s, ['試着', 'ちょうどいい', 'これ']);
      expect(s.nodeId, word).toBe('quote');
      expect(lastLine(s), word).toContain(price);
    }
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

  it('short -> cheaper goes back to the shelves; a cheaper piece (the T-shirt) is then bought', () => {
    const c = counter(5000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    say(s, 'ダウンジャケットをください');
    tap(s, ['エムサイズ', 'はい', '試着', 'ちょうどいい', 'これ', 'カード']);
    expect(s.nodeId).toBe('short');
    tap(s, ['安い']);
    expect(s.nodeId).toBe('shelves');
    tap(s, ['Tシャツ', 'エムサイズ', '黒', '試着', 'ちょうどいい', 'これ', 'カード']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual(['tee']);
  });

  it('the owned and the sold-out flags change the short line', () => {
    for (const [flag, text] of [['owned_already', 'もう'], ['sold_out', '品切れ']] as const) {
      const s = open('en', { game: counter(100).hooks, flags: { priced: true, [flag]: true } });
      tap(s, HAPPY);
      expect(s.nodeId).toBe('short');
      expect(lastLine(s)).toContain(text);
    }
  });

  it('think about it at the quote or at the offer: a polite leave, nothing charged, pay never done', () => {
    for (const taps of [['Tシャツ', 'エムサイズ', '黒', '考えます'], ['Tシャツ', 'エムサイズ', '黒', '試着', 'ちょうどいい', '考えます']]) {
      const c = counter(30000);
      const s = open('en', { game: c.hooks, flags: { priced: true } });
      tap(s, taps);
      expect(s.nodeId).toBe('leave');
      expect(s.ended).toBe(true);
      expect(c.log.charges).toEqual([]);
      expect(s.stepsDone.has('pay')).toBe(false);
    }
  });

  it('the present branch: a plush toy and a guitar pick are bought with the shared giftItem slot', () => {
    for (const [word, id] of [['ぬいぐるみ', 'plush'], ['ギターピック', 'guitarPick']]) {
      const c = counter(30000);
      const s = open('en', { game: c.hooks, flags: { priced: true } });
      tap(s, ['プレゼント', word, 'カード']);
      expect(s.nodeId).toBe('done');
      expect(c.log.charges).toEqual([id]);
      expect(slots(s).giftItem).toBe(id);
    }
  });

  it('the browse branch: the shelves list the pieces and a chip picks one', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    say(s, '何がありますか');
    expect(s.nodeId).toBe('shelves');
    expect(lastLine(s)).toContain('パーカー');
    tap(s, ['パーカー']);
    expect(s.nodeId).toBe('size');
    expect(slots(s).clothes).toBe('hoodie');
  });
});

describe('fuku_clothes: size and fit variations', () => {
  const toFitting = (opts: Partial<SessionOptions> = {}) => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true }, ...opts });
    tap(s, ['Tシャツ', 'エムサイズ', '黒', '試着']);
    return s;
  };

  it('too big: Rin offers a smaller size, the learner picks one, and the fitting room is entered again', () => {
    const s = toFitting();
    tap(s, ['大きい']);
    expect(s.nodeId).toBe('resize');
    expect(lastLine(s)).toContain('小さいサイズ');
    expect(slots(s).fit).toBe('big');
    tap(s, ['エスサイズ']);
    expect(s.nodeId).toBe('fitting');
    expect(slots(s).size).toBe('s');
    tap(s, ['ちょうどいい']);
    expect(s.nodeId).toBe('suits');
    expect(slots(s).fit).toBe('just');
  });

  it('too small: Rin offers a bigger size, and the new size is the one that is kept', () => {
    const s = toFitting();
    tap(s, ['小さい']);
    expect(s.nodeId).toBe('resize');
    expect(lastLine(s)).toContain('大きいサイズ');
    tap(s, ['エルサイズ']);
    expect(s.nodeId).toBe('fitting');
    expect(slots(s).size).toBe('l');
  });

  it('the fit can go around the fitting room more than once, and the sale still completes with all six steps', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['Tシャツ', 'エムサイズ', '黒', '試着', '大きい', 'エスサイズ', '小さい', 'エムサイズ', 'ちょうどいい', 'これ', 'カード']);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['colour', 'fit', 'look', 'pay', 'size', 'try']);
    expect(c.log.charges).toEqual(['tee']);
  });

  it('typed size and fit words: letters, katakana, 大きすぎます, きつい, ぴったり', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    say(s, 'Tシャツを探しています');
    expect(s.nodeId).toBe('size');
    say(s, 'Lサイズをお願いします');
    expect(slots(s).size).toBe('l');
    expect(s.nodeId).toBe('colour');
    say(s, '赤がいいです');
    expect(slots(s).clothesColour).toBe('red');
    say(s, '試着してもいいですか');
    expect(s.nodeId).toBe('fitting');
    say(s, '大きすぎます');
    expect(s.nodeId).toBe('resize');
    say(s, 'エムでお願いします');
    expect(slots(s).size).toBe('m');
    expect(s.nodeId).toBe('fitting');
    say(s, 'きついです');
    expect(s.nodeId).toBe('resize');
    say(s, 'Mサイズ');
    say(s, 'ぴったりです');
    expect(s.nodeId).toBe('suits');
    say(s, 'これをください');
    expect(s.nodeId).toBe('quote');
  });

  it('the twist changes the fitting-room line only (Rin asks you to wait a moment); nothing is charged for it', () => {
    const c = counter(30000);
    const s = toFitting({ game: c.hooks, flags: { priced: true, twist: true } });
    expect(s.nodeId).toBe('fitting');
    expect(lastLine(s)).toContain('待って');
    expect(c.log.charges).toEqual([]);
    const plain = toFitting();
    expect(lastLine(plain)).not.toContain('待って');
  });
});

describe('fuku_clothes: typed language', () => {
  it('natural variants: the piece at the start, price questions, a colour question, the compliment, the fixed price', () => {
    const s = open('en', { game: counter(500000).hooks, flags: { priced: true } });
    expect(say(s, 'こんにちは').learner.matched).toBe(true);
    expect(s.nodeId).toBe('start');
    expect(say(s, 'パーカーはいくらですか').learner.matched).toBe(true);
    expect(s.nodeId).toBe('size');
    expect(lastLine(s)).toContain('四千九百九十円');
    say(s, 'いくらですか');
    expect(s.nodeId).toBe('size');
    say(s, 'エムサイズです');
    say(s, '青がいいです');
    expect(s.nodeId).toBe('offer');
    say(s, '試着してもいいですか');
    say(s, 'ちょうどいいです');
    expect(lastLine(s)).toContain('似合います');
    say(s, 'ありがとうございます');
    expect(s.nodeId).toBe('quote');
    say(s, '高いです');
    expect(lastLine(s)).toContain('定価');
    expect(s.nodeId).toBe('quote');
    say(s, 'カードでお願いします');
    expect(s.nodeId).toBe('done');
  });

  it('asking the price at the colour node gets an answer and stays', () => {
    const s = open('en', { game: counter(500000).hooks, flags: { priced: true } });
    tap(s, ['Tシャツ', 'エムサイズ']);
    expect(s.nodeId).toBe('colour');
    expect(say(s, 'いくらですか').learner.matched).toBe(true);
    expect(s.nodeId).toBe('colour');
  });

  it('the Arabic helper sentences (assist mode) are covered for the main steps', () => {
    const s = open('ar', { game: counter(500000).hooks, flags: { priced: true } });
    expect(say(s, 'ابحث عن قميص تي شيرت').learner.matched).toBe(true);
    expect(s.nodeId).toBe('size');
    expect(say(s, 'مقاس M من فضلك').learner.matched).toBe(true);
    expect(s.nodeId).toBe('colour');
  });
});

describe('fuku_clothes: pockets and phrasebook', () => {
  const stages: Array<[string[], string]> = [
    [[], 'start'],
    [['Tシャツ'], 'size'],
    [['Tシャツ', 'エムサイズ'], 'colour'],
    [['Tシャツ', 'エムサイズ', '黒'], 'offer'],
    [['Tシャツ', 'エムサイズ', '黒', '試着'], 'fitting'],
    [['Tシャツ', 'エムサイズ', '黒', '試着', '大きい'], 'resize'],
    [['Tシャツ', 'エムサイズ', '黒', '試着', 'ちょうどいい'], 'suits'],
    [['Tシャツ', 'エムサイズ', '黒', '試着', 'ちょうどいい', 'これ'], 'quote'],
    [['プレゼント'], 'goods'],
  ];
  const accepted = (text: string) =>
    stages.some(([taps, node]) => {
      const s = open('en', { game: counter(500000).hooks, flags: { priced: true } });
      tap(s, taps);
      if (s.nodeId !== node) return false;
      const r = s.submit({ text, mode: 'typed_ja' });
      return r.learner.matched && r.character.kind !== 'fallback';
    });

  it('every pocket line is understood by the scenario at a node on the happy path', () => {
    const lines = Object.values(DENKI_FUKU_POCKETS).filter((p) => p.id.startsWith('p_fuku_'));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const p of lines) {
      const text = p.line.ja.replace(/\|/g, '').replace('{name}', 'レイラ');
      expect(accepted(text), `${p.id} ${text}`).toBe(true);
    }
  });

  it('every phrasebook line of the module is language the scenario accepts at some node', () => {
    for (const p of SHOP_FUKU_PHRASES) {
      const text = p.ja.replace(/\|/g, '').replace('{name}', 'レイラ');
      expect(accepted(text), `${p.id} ${text}`).toBe(true);
    }
  });
});
