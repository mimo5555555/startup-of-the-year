// aiko_tea (agent A5, docs/GAME_DESIGN.md §6.3): every chip is understood at every node (with and without game hooks, enough cash and too little,
// the twist, in English and Arabic), the purchase is completable by tapping chips alone, the recommendation follows the friend's tastes, the
// short / leave branches work, the typed language works, and every pocket and phrasebook line of the module is language an intent accepts.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { AIKO_MOTORS_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-aiko-motors';
import { SHOP_AIKO_PHRASES } from '../../content/src/phrasebook/shop-aiko';
import { AIKO_RECOMMENDS } from '../../content/src/tokyo/scenarios-aiko';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};
const PRICES: Record<string, number> = { flower: 1500, wagashi: 1280, teaSet: 1500, tenugui: 1100 };

/** A counter with a purse: the price is the one of the chosen present (the bouquet before a choice). */
function counter(cash: number) {
  const log = { charges: [] as string[], refused: 0 };
  const idOf = (s: Record<string, string>) => s.giftItem ?? 'flower';
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
  const scenario = scenarioById('aiko_tea')!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** Picks every suggestion at every reachable node; Aiko must always understand it. The state key includes the friend (the recommendation differs). */
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
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}|${slots(s).giftFriend ?? ''}|${slots(s).giftItem ?? ''}`;
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
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i} "${sg.written}": Aiko's answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: Aiko's answer has a token without gloss`);
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
const WALK_TIMEOUT = 60000;

const modes: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: counter(500000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: counter(100).hooks, flags: { priced: true } })],
  ['with the twist', () => ({ game: counter(500000).hooks, flags: { priced: true, twist: true } })],
  ['with the twist and no hooks', () => ({ flags: { twist: true } })],
];

describe('aiko_tea: every chip is understood', () => {
  for (const [label, mk] of modes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const r = walk(l1, mk);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(10);
      }, WALK_TIMEOUT);
    }
  }

  it('the walk reaches every node of the scenario (and short with too little cash)', () => {
    const r = walk('en', () => ({ game: counter(500000).hooks, flags: { priced: true } }));
    const seen = new Set([...r.visited].map((k) => k.split('|')[0]));
    const all = Object.keys(scenarioById('aiko_tea')!.nodes);
    expect(all.filter((n) => !seen.has(n) && !['done', 'leave', 'short'].includes(n))).toEqual([]);
    const poor = walk('en', () => ({ game: counter(100).hooks, flags: { priced: true } }));
    expect([...poor.visited].some((k) => k.startsWith('short|'))).toBe(true);
  }, WALK_TIMEOUT);
});

const HAPPY = ['和菓子', 'ミオ', 'これで', '赤', '現金'];

describe('aiko_tea: the whole purchase by tapping chips', () => {

  it('with enough cash: every goal step done, charged once, the present, the friend and the ribbon recorded', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, HAPPY);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    // the advice node sits between the friend and the wrapping: it is passed by "this one, please"
    expect([...s.stepsDone].sort()).toEqual(['greet', 'pay', 'pick', 'who', 'wrap']);
    expect(c.log.charges).toEqual(['wagashi']);
    expect(slots(s).giftItem).toBe('wagashi');
    expect(slots(s).giftFriend).toBe('mio');
    expect(slots(s).wrapColour).toBe('red');
    expect(slots(s).payMethod).toBe('cash');
    expect(s.summary().goalDone).toBe(5);
  });

  it('the same without game hooks (the fixed fallback prices), and in Arabic', () => {
    for (const l1 of ['en', 'ar'] as const) {
      const s = open(l1);
      tap(s, HAPPY);
      expect(s.nodeId).toBe('done');
      expect(s.summary().goalDone).toBe(5);
    }
  });

  it('every present can be bought, charged at its own price, by typing its name', () => {
    for (const [id, word] of [['flower', 'お花'], ['wagashi', '和菓子'], ['teaSet', 'お茶セット'], ['tenugui', '手ぬぐい']]) {
      const c = counter(500000);
      const s = open('en', { game: c.hooks, flags: { priced: true } });
      say(s, `${word}をください`);
      expect(slots(s).giftItem, id).toBe(id);
      expect(s.nodeId, id).toBe('who');
      tap(s, ['自分', 'ピンク', '現金']);
      expect(s.nodeId, id).toBe('done');
      expect(c.log.charges, id).toEqual([id]);
      expect(lastLine(s), id).toContain('楽しんで');
    }
  });

  it('the price is read from the hooks and never typed; without hooks the quote reads the fixed price of the present', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['和菓子', 'ミオ', 'これで', '赤']);
    expect(s.nodeId).toBe('quote');
    expect(lastLine(s)).toContain('千二百八十円');
    for (const [word, price] of [['お花', '千五百円'], ['手ぬぐい', '千百円'], ['お茶セット', '千五百円']]) {
      const t = open('en');
      say(t, `${word}をください`);
      tap(t, ['自分', 'ピンク']);
      expect(t.nodeId, word).toBe('quote');
      expect(lastLine(t), word).toContain(price);
    }
  });

  it('the browse branch: "I am looking for a present" lists the presents and a chip picks one', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['プレゼント']);
    expect(s.nodeId).toBe('browse');
    expect(lastLine(s)).toContain('手ぬぐい');
    tap(s, ['お花']);
    expect(s.nodeId).toBe('who');
    expect(slots(s).giftItem).toBe('flower');
  });

  it('wrapping is free and optional: no wrapping goes to the quote and still completes the wrap step', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    tap(s, ['和菓子', '自分']);
    expect(s.nodeId).toBe('wrap');
    expect(lastLine(s)).toContain('無料');
    tap(s, ['いりません', '現金']);
    expect(s.nodeId).toBe('done');
    expect(s.stepsDone.has('wrap')).toBe(true);
    expect(slots(s).wrapColour).toBeUndefined();
  });

  it('the stall takes cash only: the card is politely declined, then cash completes the sale', () => {
    const c = counter(30000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['和菓子', '自分', '赤', 'カード']);
    expect(s.nodeId).toBe('quote');
    expect(lastLine(s)).toContain('現金だけ');
    tap(s, ['現金']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual(['wagashi']);
  });

  it('the twist changes only the ribbon line', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true, twist: true } });
    tap(s, ['和菓子', 'ミオ', 'これで', '赤']);
    expect(s.nodeId).toBe('quote');
    const t = open('en', { game: counter(30000).hooks, flags: { priced: true, twist: true } });
    tap(t, ['和菓子', 'ミオ', 'これで']);
    expect(t.nodeId).toBe('wrap');
    expect(lastLine(t)).toContain('ごめんなさい');
  });
});

describe('aiko_tea: she recommends from the friend\'s tastes', () => {
  const NAMES: Record<string, string> = { mio: 'ミオ', yuki: 'ゆき', tanaka: '田中', sato: '佐藤', kenji: 'けんじ', hanako: '花子' };
  const ITEM_JA: Record<string, string> = { flower: 'お花', wagashi: '和菓子', teaSet: 'お茶セット', tenugui: '手ぬぐい' };

  it('for each friend, typed by name, the advice names the present that friend loves', () => {
    for (const [friend, name] of Object.entries(NAMES)) {
      const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
      say(s, 'お花をください');
      say(s, `${name}さんにあげます`);
      expect(s.nodeId, friend).toBe('advise');
      expect(slots(s).giftFriend, friend).toBe(friend);
      expect(lastLine(s), friend).toContain(ITEM_JA[AIKO_RECOMMENDS[friend]]);
      expect(lastLine(s), friend).toContain('おすすめ');
      expect(lastLine(s), friend).toContain(name);
    }
  });

  it('the advice can be kept (this one, please), taken (name the recommended present) or declined (see the others)', () => {
    const keep = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    say(keep, 'お花をください');
    tap(keep, ['ミオ', 'これで']);
    expect(keep.nodeId).toBe('wrap');
    expect(slots(keep).giftItem).toBe('flower');

    const take = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    say(take, 'お花をください');
    tap(take, ['ミオ']);
    say(take, '和菓子にします');
    expect(take.nodeId).toBe('wrap');
    expect(slots(take).giftItem).toBe('wagashi');

    const others = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    say(others, 'お花をください');
    tap(others, ['ミオ', 'ほか']);
    expect(others.nodeId).toBe('again');
    tap(others, ['手ぬぐい']);
    expect(others.nodeId).toBe('wrap');
    expect(slots(others).giftItem).toBe('tenugui');
    tap(others, ['赤', '現金']);
    expect(others.nodeId).toBe('done');
  });

  it('a present for oneself skips the advice', () => {
    const s = open('en', { game: counter(30000).hooks, flags: { priced: true } });
    say(s, 'お花をください');
    tap(s, ['自分']);
    expect(s.nodeId).toBe('wrap');
    expect(slots(s).giftFriend).toBe('me');
    expect(s.stepsDone.has('who')).toBe(true);
  });

  it('English and Arabic names work in assisted typing', () => {
    const s = open('en');
    say(s, '和菓子をください');
    say(s, 'ミオさんにあげます');
    expect(slots(s).giftFriend).toBe('mio');
  });
});

describe('aiko_tea: short of cash and leaving', () => {
  it('with too little cash it ends at short with no purchase and no pay step; then leave without buying', () => {
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
  });

  it('short -> cheaper goes back to the shelves; a cheaper present (the tenugui) is then bought with the cash that is left', () => {
    const c = counter(1200);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    say(s, 'お花をください');
    tap(s, ['自分', '赤', '現金']);
    expect(s.nodeId).toBe('short');
    tap(s, ['安い']);
    expect(s.nodeId).toBe('again');
    tap(s, ['手ぬぐい', '赤', '現金']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual(['tenugui']);
  });

  it('the owned and the sold-out flags change the short line', () => {
    for (const [flag, text] of [['owned_already', 'もう'], ['sold_out', '品切れ']] as const) {
      const s = open('en', { game: counter(100).hooks, flags: { priced: true, [flag]: true } });
      tap(s, ['和菓子', '自分', '赤', '現金']);
      expect(s.nodeId).toBe('short');
      expect(lastLine(s)).toContain(text);
    }
  });

  it('think about it at the advice or the quote: a polite leave, nothing charged, pay never done', () => {
    for (const taps of [['和菓子', 'ミオ', '考えます'], ['和菓子', '自分', '赤', '考えます']]) {
      const c = counter(30000);
      const s = open('en', { game: c.hooks, flags: { priced: true } });
      tap(s, taps);
      expect(s.nodeId).toBe('leave');
      expect(s.ended).toBe(true);
      expect(c.log.charges).toEqual([]);
      expect(s.stepsDone.has('pay')).toBe(false);
    }
  });

  it('just looking and asking the price early are answered without leaving the node', () => {
    const s = open('en');
    say(s, '見ているだけです');
    expect(s.nodeId).toBe('start');
    tap(s, ['プレゼント']);
    say(s, 'いくらですか');
    expect(s.nodeId).toBe('browse');
  });
});

describe('aiko_tea: pocket and phrasebook lines are understood', () => {
  it('every pocket line, said at the node where it belongs, is matched', () => {
    const at: Record<string, string[]> = { p_aiko_1: [], p_aiko_2: ['和菓子'], p_aiko_3: ['和菓子', '自分'] };
    for (const [id, pre] of Object.entries(at)) {
      const s = open('en');
      tap(s, pre);
      const r = say(s, AIKO_MOTORS_POCKETS[id].line.ja.replace(/\|/g, ''));
      expect(r.learner.matched, id).toBe(true);
      expect(r.character.kind, id).not.toBe('fallback');
    }
  });

  it('every phrase, assisted in English and Arabic, is translated to a line that is understood where it fits', () => {
    const at: Record<string, string[]> = {
      aiko_wagashi: [], aiko_flower: [], aiko_tea_set: [], aiko_tenugui: [],
      aiko_for_mio: ['和菓子'], aiko_for_me: ['和菓子'],
      aiko_ribbon_pink: ['和菓子', '自分'], aiko_no_wrap: ['和菓子', '自分'], aiko_see_others: ['和菓子', 'ミオ'],
    };
    for (const p of SHOP_AIKO_PHRASES) {
      expect(at[p.id], `${p.id} has a node`).toBeTruthy();
      for (const text of [p.en[0], p.ar[0]]) {
        const s = open(text === p.en[0] ? 'en' : 'ar');
        tap(s, at[p.id]);
        const r = say(s, text);
        expect(r.learner.matched, `${p.id}: ${text}`).toBe(true);
        expect(r.character.kind, `${p.id}: ${text}`).not.toBe('fallback');
      }
    }
  });
});
