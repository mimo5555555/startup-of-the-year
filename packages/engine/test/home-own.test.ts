// The player's own room (Release 2 wave B2): fuku_home (second-hand furniture), aiko_viewing, aiko_contract, home_own_guest. Every chip is understood at every
// reachable node (with and without game hooks, in English and Arabic), each scenario is completable by tapping chips alone and by typing Japanese, romaji,
// English and Arabic, the contract's say_total check refuses wrong totals, running short of cash charges nothing, and the minor variant of the viewing never
// mentions renting. The content (lexicon, slots, items) is checked in packages/content/test/home-own.test.ts.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { HOME_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-home';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

const slots = (s: ConversationSession): Record<string, string> => (s as unknown as { slotIds: Record<string, string> }).slotIds;

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}, characterId?: string): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === (characterId ?? scenario.characterId))!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** Mirrors what the app does with whatever the learner types or says. */
function say(s: ConversationSession, text: string): SubmitResult {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

/** Taps the chip whose Japanese contains `part`, one part after the other. */
function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}

const lastLine = (s: ConversationSession) => s.turns[s.turns.length - 1].line.written;
const WALK_TIMEOUT = 90000;

/** Picks every suggestion at every reachable node; the character must always understand it and every line must resolve. */
function walk(id: string, l1: L1, mk: () => Partial<SessionOptions>, key: (s: ConversationSession) => string = () => '') {
  const problems: string[] = [];
  const visited = new Set<string>();
  const lines: string[] = [];
  const replay = (path: number[]) => {
    const s = open(id, l1, mk());
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const k = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}|${key(s)}`;
    if (visited.has(k) || s.ended) return;
    visited.add(k);
    const sugg = s.suggestions();
    if (sugg.length < 2) problems.push(`${s.nodeId}: fewer than 2 suggestions`);
    sugg.forEach((sg, i) => {
      lines.push(sg.written);
      if (sg.tokens.some((t) => t.s === '…' && !t.punct)) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const t = replay(path);
      const r = t.pickSuggestion(i);
      lines.push(lastLine(t));
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i} "${sg.written}": the answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: visited.size, visited, lines };
}

// ---------------------------------------------------------------------------------------------------------------
// fuku_home
// ---------------------------------------------------------------------------------------------------------------

const PRICES: Record<string, number> = { futon: 8000, desk: 6000, bookshelf: 4500, plant: 1200, kotatsu: 7000, riceCooker: 3500, lamp: 2000 };
const BIG = ['futon', 'desk', 'bookshelf', 'kotatsu'];
const FLAT_ONLY = ['kotatsu', 'riceCooker', 'lamp'];

/** A counter with a purse: the quote is the piece (+ the delivery fee of a big one), `flat` says whether the tenant's pieces are in stock. */
function furnitureShop(cash: number, flat = true) {
  const log = { charges: [] as Array<{ slots: Record<string, string>; total: number }>, refused: 0 };
  const piece = (s: Record<string, string>) => s.furniture ?? 'futon';
  const total = (s: Record<string, string>) => PRICES[piece(s)] + (BIG.includes(piece(s)) ? 2200 : 0);
  const hooks: SessionGameHooks = {
    vars: (s) => ({ price: money(PRICES[piece(s)]), total: money(total(s)) }),
    charge(s) {
      if (cash < total(s)) {
        log.refused++;
        return { ok: false };
      }
      cash -= total(s);
      log.charges.push({ slots: { ...s }, total: total(s) });
      return { ok: true };
    },
    intent: (kind, ctx) => (kind === 'in_stock' ? { ok: flat || !FLAT_ONLY.includes(ctx.slotIds.furniture ?? '') } : { ok: false }),
  };
  return { hooks, log };
}

const furnitureModes: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: furnitureShop(500000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: furnitureShop(100).hooks, flags: { priced: true } })],
  ['with hooks, no flat yet', () => ({ game: furnitureShop(500000, false).hooks, flags: { priced: true } })],
];

describe('fuku_home: every chip is understood', () => {
  for (const [label, mk] of furnitureModes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const r = walk('fuku_home', l1, mk, (s) => `${slots(s).furniture ?? ''}|${slots(s).deliveryDay ?? ''}`);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(10);
      }, WALK_TIMEOUT);
    }
  }

  it('the walk reaches every node of the scenario that chips can reach (short with too little cash; not_yet is reached by naming a flat-only piece, below)', () => {
    const r = walk('fuku_home', 'en', () => ({ game: furnitureShop(500000).hooks, flags: { priced: true } }), (s) => `${slots(s).furniture ?? ''}`);
    const seen = new Set([...r.visited].map((k) => k.split('|')[0]));
    const all = Object.keys(scenarioById('fuku_home')!.nodes);
    expect(all.filter((n) => !seen.has(n) && !['done', 'leave', 'short', 'not_yet'].includes(n))).toEqual([]);
    const poor = walk('fuku_home', 'en', () => ({ game: furnitureShop(100).hooks, flags: { priced: true } }), (s) => `${slots(s).furniture ?? ''}`);
    expect([...poor.visited].some((k) => k.startsWith('short|'))).toBe(true);
  }, WALK_TIMEOUT);
});

describe('fuku_home: the whole purchase', () => {
  it('a big piece by tapping chips: delivery on Saturday, charged once (the piece + 2,200), every goal step done', () => {
    const c = furnitureShop(30000);
    const s = open('fuku_home', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['布団', 'これ', '配送', '土曜日', 'カード']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['choose', 'day', 'pay', 'price', 'take']);
    expect(c.log.charges).toHaveLength(1);
    expect(c.log.charges[0].total).toBe(10200);
    expect(c.log.charges[0].slots).toMatchObject({ furniture: 'futon', delivery: 'deliver', deliveryDay: 'saturday', payMethod: 'card' });
    expect(lastLine(s)).toContain('土曜日');
  });

  it('every delivery day reaches the slot `deliveryDay` the purchase is booked with', () => {
    for (const [chip, id] of [['明日', 'tomorrow'], ['土曜日', 'saturday'], ['あさって', 'dayAfter']] as const) {
      const c = furnitureShop(30000);
      const s = open('fuku_home', 'en', { game: c.hooks, flags: { priced: true } });
      tap(s, ['布団', 'これ', '配送', chip, '現金']);
      expect(c.log.charges[0].slots.deliveryDay, chip).toBe(id);
    }
  });

  it('a small piece by tapping chips: carried home, charged once (the piece alone), the day step is skipped', () => {
    const c = furnitureShop(30000);
    const s = open('fuku_home', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['家具', '観葉植物', 'これ', '持ち帰り', '現金']);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['choose', 'day', 'pay', 'price', 'take']);
    expect(c.log.charges).toHaveLength(1);
    expect(c.log.charges[0].total).toBe(1200);
    expect(c.log.charges[0].slots.deliveryDay).toBeUndefined();
    expect(lastLine(s)).not.toContain('お届け');
  });

  it('the quote Rin reads is the quote that is charged: the piece and the delivery fee, or the piece alone', () => {
    const c = furnitureShop(30000);
    const big = open('fuku_home', 'en', { game: c.hooks, flags: { priced: true } });
    tap(big, ['布団', 'これ', '配送', '明日']);
    expect(big.nodeId).toBe('quote_big');
    expect(lastLine(big)).toContain(yenToJa(10200).markup.replace(/\|/g, ''));
    const small = open('fuku_home', 'en', { game: c.hooks, flags: { priced: true } });
    tap(small, ['家具', '観葉植物', 'これ', '持ち帰り']);
    expect(small.nodeId).toBe('quote_small');
    expect(lastLine(small)).toContain(yenToJa(1200).markup.replace(/\|/g, ''));
  });

  it('without hooks the fixed prices of the fallback variants are the catalog rows (delivery included for a big piece)', () => {
    const s = open('fuku_home', 'en');
    tap(s, ['布団', 'これ', '配送', '明日']);
    expect(lastLine(s)).toContain('一万二百円');
    const t = open('fuku_home', 'en');
    tap(t, ['家具', '観葉植物', 'これ', '持ち帰り']);
    expect(lastLine(t)).toContain('千二百円');
  });

  it('a big piece cannot be carried and a small one is not delivered: Rin says so and the node stays', () => {
    const big = open('fuku_home', 'en');
    tap(big, ['布団', 'これ']);
    say(big, '持ち帰りで お願いします');
    expect(big.nodeId).toBe('take_big');
    expect(lastLine(big)).toContain('配送');
    const small = open('fuku_home', 'en');
    tap(small, ['家具', '観葉植物', 'これ']);
    say(small, '配送で お願いします');
    expect(small.nodeId).toBe('take_small');
    expect(lastLine(small)).toContain('持ち帰り');
  });

  it('too little cash: the scripted short branch, nothing charged; a piece that is not in stock yet is not_yet', () => {
    const poor = furnitureShop(100);
    const s = open('fuku_home', 'en', { game: poor.hooks, flags: { priced: true } });
    tap(s, ['布団', 'これ', '配送', '明日', '現金']);
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(false);
    expect(poor.log.charges).toHaveLength(0);
    expect(poor.log.refused).toBe(1);
    const noFlat = open('fuku_home', 'en', { game: furnitureShop(500000, false).hooks, flags: { priced: true } });
    say(noFlat, 'こたつを ください');
    expect(noFlat.nodeId).toBe('not_yet');
    expect(lastLine(noFlat)).toContain('こたつ');
  });

  it('a polite refusal leaves the shop with nothing charged', () => {
    const c = furnitureShop(30000);
    const s = open('fuku_home', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['布団']);
    say(s, '考えます');
    expect(s.ended).toBe(true);
    expect(c.log.charges).toHaveLength(0);
  });

  it('typed Japanese, romaji, English and Arabic reach the same purchase', () => {
    const lines: Record<string, string[]> = {
      ja: ['家具を探しています', '布団をください', 'これをください', '配送でお願いします', '土曜日にお願いします', '現金でお願いします'],
      romaji: ['kagu o sagashite imasu', 'futon o kudasai', 'kore o kudasai', 'haisou de onegaishimasu', 'doyoubi ni onegaishimasu', 'genkin de onegaishimasu'],
      en: ['I am looking for furniture', 'a futon please', 'this one please', 'delivery please', 'Saturday please', 'cash please'],
      ar: ['أبحث عن أثاث', 'فوتون من فضلك', 'هذا من فضلك', 'التوصيل من فضلك', 'السبت من فضلك', 'نقدا من فضلك'],
    };
    for (const [lang, said] of Object.entries(lines)) {
      const c = furnitureShop(30000);
      const s = open('fuku_home', lang === 'ar' ? 'ar' : 'en', { game: c.hooks, flags: { priced: true } });
      for (const text of said) say(s, text);
      expect(s.ended, lang).toBe(true);
      expect(s.nodeId, lang).toBe('done');
      expect(c.log.charges, lang).toHaveLength(1);
      expect(c.log.charges[0].slots, lang).toMatchObject({ furniture: 'futon', deliveryDay: 'saturday' });
    }
  });

  it('all seven pieces can be picked by name and routed to the right price node', () => {
    for (const [id, name] of [['futon', '布団'], ['desk', '勉強机'], ['bookshelf', '本棚'], ['plant', '観葉植物'], ['kotatsu', 'こたつ'], ['riceCooker', '炊飯器'], ['lamp', 'ランプ']] as const) {
      const s = open('fuku_home', 'en', { game: furnitureShop(500000).hooks, flags: { priced: true } });
      say(s, `${name}を ください`);
      expect(s.nodeId, id).toBe(BIG.includes(id) ? 'price_big' : 'price_small');
      expect(slots(s).furniture, id).toBe(id);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// aiko_viewing
// ---------------------------------------------------------------------------------------------------------------

const RENT_WORDS = /家賃|敷金|契約|貸し|借り|賃|rent|deposit|contract/i;

describe('aiko_viewing: every chip is understood', () => {
  for (const minor of [false, true]) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${minor ? 'minor (tea room)' : 'adult (the flat)'}, ${l1}`, () => {
        const r = walk('aiko_viewing', l1, () => ({ flags: { minor } }));
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(8);
        if (minor) expect(r.lines.filter((l) => RENT_WORDS.test(l)), 'nobody mentions renting to a child').toEqual([]);
      }, WALK_TIMEOUT);
    }
  }
});

describe('aiko_viewing: the whole viewing', () => {
  it('by tapping chips: shoes, three questions, thanks; every goal step done (adult and minor alike)', () => {
    for (const minor of [false, true]) {
      const s = open('aiko_viewing', 'en', { flags: { minor } });
      tap(s, ['脱ぎます', '何畳', '日当たり', '静か', 'いい']);
      expect(s.ended, String(minor)).toBe(true);
      expect(s.nodeId).toBe('end');
      expect([...s.stepsDone].sort()).toEqual(['ask1', 'ask2', 'ask3', 'shoes', 'thanks']);
    }
  });

  it('any three of the five questions count, in any order (the rent question typed by an adult is answered)', () => {
    const s = open('aiko_viewing', 'en');
    tap(s, ['脱ぎます']);
    say(s, '家賃は いくらですか');
    expect(lastLine(s)).toContain('家賃');
    expect(lastLine(s)).toContain('三万円');
    say(s, 'いつから ありますか');
    expect(lastLine(s)).toContain('二十年前');
    say(s, '何畳ですか');
    expect(lastLine(s)).toContain('六畳');
    say(s, 'ありがとうございました');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['ask1', 'ask2', 'ask3', 'shoes', 'thanks']);
  });

  it('a minor plays the visit to the tea room: the room next door, the tea, forty years, and a rent question typed anyway is deflected without a word of rent', () => {
    const s = open('aiko_viewing', 'en', { flags: { minor: true } });
    expect(lastLine(s)).toContain('茶室');
    expect(lastLine(s)).not.toContain('小野荘');
    tap(s, ['脱ぎます']);
    say(s, '家賃は いくらですか');
    expect(lastLine(s)).not.toMatch(RENT_WORDS);
    expect(lastLine(s)).toContain('ちょっと');
    say(s, 'いつから ありますか');
    expect(lastLine(s)).toContain('四十年前');
    say(s, '何畳ですか');
    say(s, 'ありがとうございました');
    expect(s.ended).toBe(true);
    expect(lastLine(s)).not.toMatch(RENT_WORDS);
    expect(s.stepsDone.has('thanks')).toBe(true);
  });

  it('typed Japanese, romaji, English and Arabic complete the viewing', () => {
    const lines: Record<string, string[]> = {
      ja: ['はい、脱ぎます', '何畳ですか', '日当たりはいいですか', '静かですか', 'ありがとうございました'],
      romaji: ['hai nugimasu', 'nanjou desu ka', 'hiatari wa ii desu ka', 'shizuka desu ka', 'arigatou gozaimashita'],
      en: ['OK I will take them off', 'how many tatami mats is it', 'does it get good sunlight', 'is it quiet', 'thank you for showing me'],
      ar: ['نعم سأخلعهما', 'كم حصيرة تاتامي مساحتها', 'هل الشمس جيدة هنا', 'هل المكان هادئ', 'شكرا لانك اريتني اياها'],
    };
    for (const [lang, said] of Object.entries(lines)) {
      for (const minor of [false, true]) {
        const s = open('aiko_viewing', lang === 'ar' ? 'ar' : 'en', { flags: { minor } });
        for (const text of said) say(s, text);
        expect(s.ended, `${lang} ${minor}`).toBe(true);
        expect([...s.stepsDone].sort(), `${lang} ${minor}`).toEqual(['ask1', 'ask2', 'ask3', 'shoes', 'thanks']);
      }
    }
  });

  it('the English and Arabic rent question reaches the rent answer for an adult', () => {
    for (const q of ['how much is the rent', 'كم الإيجار']) {
      const s = open('aiko_viewing', q.startsWith('how') ? 'en' : 'ar');
      tap(s, ['脱ぎます']);
      say(s, q);
      expect(lastLine(s), q).toContain('家賃');
    }
  });

  it('a polite refusal ends the viewing without the steps (nothing is lost)', () => {
    const s = open('aiko_viewing', 'en');
    tap(s, ['脱ぎます']);
    say(s, '考えます');
    expect(s.ended).toBe(true);
    expect(s.stepsDone.has('thanks')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// aiko_contract
// ---------------------------------------------------------------------------------------------------------------

/** Aiko's desk: the room costs 60,000 in cash; `say_total` accepts exactly that number; `stock` says whether the room can be rented. */
function landlady(cash: number, stock = true) {
  const log = { charges: [] as Array<Record<string, string>>, refused: 0, said: [] as Array<number | undefined> };
  const hooks: SessionGameHooks = {
    vars: () => ({ price: money(60000), total: money(60000) }),
    charge(s) {
      if (cash < 60000) {
        log.refused++;
        return { ok: false };
      }
      cash -= 60000;
      log.charges.push({ ...s });
      return { ok: true };
    },
    intent(kind, ctx) {
      if (kind === 'in_stock') return { ok: stock };
      if (kind === 'say_total') {
        log.said.push(ctx.number);
        return { ok: ctx.number === 60000 };
      }
      return { ok: false };
    },
  };
  return { hooks, log };
}

const contractModes: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: landlady(500000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: landlady(100).hooks, flags: { priced: true } })],
  ['with hooks, the room cannot be rented', () => ({ game: landlady(500000, false).hooks, flags: { priced: true } })],
];

describe('aiko_contract: every chip is understood', () => {
  for (const [label, mk] of contractModes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const r = walk('aiko_contract', l1, mk);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThanOrEqual(label.includes('cannot') ? 1 : 4);
      }, WALK_TIMEOUT);
    }
  }
});

describe('aiko_contract: the whole contract', () => {
  it('by tapping chips: decide, say 六万円, sign, pay ¥60,000 in cash once, the key; every goal step done', () => {
    const c = landlady(70000);
    const s = open('aiko_contract', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['ここ', '六', 'レイラ', '現金', 'ありがとう']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('keys');
    expect([...s.stepsDone].sort()).toEqual(['decide', 'deposit', 'keys', 'pay', 'sign']);
    expect(c.log.charges).toHaveLength(1);
    expect(c.log.charges[0]).toMatchObject({ room: 'ono' });
    expect(lastLine(s)).toContain('鍵');
    expect(lastLine(s)).toContain('どうぞ');
  });

  it('says the total wrong, then right: a wrong total is told the parts and asked again, no step until the sum is right', () => {
    const c = landlady(70000);
    const s = open('aiko_contract', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['ここ']);
    for (const wrong of ['三万円です', '五万円です', '九万円です', '30000', '百万円です']) {
      say(s, wrong);
      expect(s.nodeId, wrong).toBe('wrong_total');
      expect(s.stepsDone.has('deposit'), wrong).toBe(false);
    }
    say(s, '六万円です');
    expect(s.nodeId).toBe('sign');
    expect(s.stepsDone.has('deposit')).toBe(true);
    expect(c.log.said.slice(0, 5)).toEqual([30000, 50000, 90000, 30000, 1000000]);
  });

  it('the total can be said in kanji, kana, digits, romaji, English and Arabic', () => {
    const said: Array<[string, L1]> = [['六万円です', 'en'], ['ろくまんえんです', 'en'], ['60000円です', 'en'], ['60000', 'en'], ['rokuman en desu', 'en'], ['sixty thousand yen', 'en'], ['60,000 yen', 'en'], ['ستون ألف ين', 'ar']];
    for (const [text, l1] of said) {
      const c = landlady(70000);
      const s = open('aiko_contract', l1, { game: c.hooks, flags: { priced: true } });
      tap(s, ['ここ']);
      say(s, text);
      expect(s.nodeId, text).toBe('sign');
    }
  });

  it('the signature is the chip 「{name}です」 or a name typed in any script', () => {
    for (const [text, l1] of [['レイラです', 'en'], ['Layla です', 'en'], ['I am Layla', 'en'], ['Reira desu', 'en'], ['اسمي ليلى', 'ar'], ['ليلى です', 'ar']] as Array<[string, L1]>) {
      const c = landlady(70000);
      const s = open('aiko_contract', l1, { game: c.hooks, flags: { priced: true } });
      tap(s, ['ここ', '六']);
      say(s, text);
      expect(s.nodeId, text).toBe('pay');
      expect(s.stepsDone.has('sign'), text).toBe(true);
    }
  });

  it('the stall takes cash only: a card is refused politely and the node stays', () => {
    const c = landlady(70000);
    const s = open('aiko_contract', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['ここ', '六', 'レイラ']);
    say(s, 'カードで お願いします');
    expect(s.nodeId).toBe('pay');
    expect(lastLine(s)).toContain('現金');
    expect(c.log.charges).toHaveLength(0);
  });

  it('too little cash: she says come back when you have the money, nothing is charged and the scenario ends politely', () => {
    const c = landlady(59999);
    const s = open('aiko_contract', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['ここ', '六', 'レイラ', '現金']);
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(true);
    expect(c.log.charges).toHaveLength(0);
    expect(c.log.refused).toBe(1);
    expect(lastLine(s)).toContain('来て');
    expect(s.stepsDone.has('keys')).toBe(false);
  });

  it('a room that cannot be rented (or is already yours) ends politely at the decision, nothing charged', () => {
    const c = landlady(500000, false);
    const s = open('aiko_contract', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['ここ']);
    expect(s.nodeId).toBe('not_yet');
    expect(s.ended).toBe(true);
    expect(c.log.charges).toHaveLength(0);
    const owned = landlady(100);
    const t = open('aiko_contract', 'en', { game: owned.hooks, flags: { priced: true, owned_already: true } });
    tap(t, ['ここ', '六', 'レイラ', '現金']);
    expect(t.nodeId).toBe('short');
    expect(lastLine(t)).toContain('あなた');
  });

  it('typed Japanese, romaji, English and Arabic complete the contract', () => {
    const lines: Record<string, string[]> = {
      ja: ['ここにします', '六万円です', 'レイラです', '現金でお願いします', 'ありがとうございます'],
      romaji: ['koko ni shimasu', 'rokuman en desu', 'Reira desu', 'genkin de onegaishimasu', 'arigatou gozaimasu'],
      en: ['I will take this one', 'sixty thousand yen', 'I am Layla', 'cash please', 'thank you very much'],
      ar: ['سآخذ هذه', 'ستون ألف ين', 'اسمي ليلى', 'نقدا من فضلك', 'شكرا جزيلا'],
    };
    for (const [lang, said] of Object.entries(lines)) {
      const c = landlady(70000);
      const s = open('aiko_contract', lang === 'ar' ? 'ar' : 'en', { game: c.hooks, flags: { priced: true } });
      for (const text of said) say(s, text);
      expect(s.ended, lang).toBe(true);
      expect(s.nodeId, lang).toBe('keys');
      expect(c.log.charges, lang).toHaveLength(1);
    }
  });

  it('runs on its own without hooks (the say_total check passes any yen amount, the charge is the app\'s)', () => {
    const s = open('aiko_contract', 'en');
    tap(s, ['ここ', '六', 'レイラ', '現金', 'ありがとう']);
    expect(s.nodeId).toBe('keys');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// home_own_guest
// ---------------------------------------------------------------------------------------------------------------

describe('home_own_guest: every chip is understood', () => {
  for (const [label, who, flags] of [['a polite guest (Aiko)', 'aiko', {}], ['a casual guest (Mio)', 'mio', { casual: true }]] as const) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const scenario = scenarioById('home_own_guest')!;
        const mk = () => ({ flags: { ...flags } });
        const r = (() => {
          const problems: string[] = [];
          const visited = new Set<string>();
          const replay = (path: number[]) => {
            const s = open(scenario.id, l1, mk(), who);
            for (const i of path) s.pickSuggestion(i);
            return s;
          };
          const visit = (path: number[]) => {
            const s = replay(path);
            if (visited.has(s.nodeId) || s.ended) return;
            visited.add(s.nodeId);
            s.suggestions().forEach((sg, i) => {
              const t = replay(path);
              const x = t.pickSuggestion(i);
              if (!x.learner.matched || x.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
              if (sg.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
              if (x.learner.matched && !x.ended) visit([...path, i]);
            });
          };
          visit([]);
          return { problems, visited };
        })();
        expect(r.problems).toEqual([]);
        expect(r.visited.size).toBeGreaterThanOrEqual(6);
      }, WALK_TIMEOUT);
    }
  }
});

describe('home_own_guest: the housewarming', () => {
  it('by tapping chips: welcome, slippers, the compliment, tea, goodbye; every goal step done', () => {
    for (const [who, flags] of [['aiko', {}], ['mio', { casual: true }], ['kenji', { casual: true }]] as const) {
      const s = open('home_own_guest', 'en', { flags: { ...flags } }, who);
      tap(s, ['上がって', 'スリッパ', 'ありがとう', 'お茶', 'よかった', 'こちら']);
      expect(s.ended, who).toBe(true);
      expect([...s.stepsDone].sort(), who).toEqual(['compliment', 'goodbye', 'slippers', 'tea', 'welcome']);
    }
  });

  it('the guest speaks plain form when casual and polite form otherwise', () => {
    const plain = open('home_own_guest', 'en', { flags: { casual: true } }, 'mio');
    const polite = open('home_own_guest', 'en', {}, 'aiko');
    expect(lastLine(plain)).not.toBe(lastLine(polite));
    tap(plain, ['上がって']);
    tap(polite, ['上がって']);
    expect(lastLine(plain)).toContain('いい？');
    expect(lastLine(polite)).toContain('ですか');
  });

  it('typed Japanese, romaji, English and Arabic complete it', () => {
    const lines: Record<string, string[]> = {
      ja: ['どうぞ、上がってください', 'スリッパをどうぞ', 'ありがとうございます', 'お茶はいかがですか', 'よかったです', 'こちらこそ。また来てくださいね'],
      romaji: ['douzo agatte kudasai', 'surippa o douzo', 'arigatou gozaimasu', 'ocha wa ikaga desu ka', 'yokatta desu', 'kochira koso mata kite kudasai ne'],
      en: ['welcome please come in', 'here are slippers', 'thank you very much', 'would you like some tea', 'I am glad', 'thank you too please come again'],
      ar: ['اهلا بك تفضل بالدخول', 'تفضل الخف', 'شكرا جزيلا', 'هل تريد بعض الشاي', 'يسعدني ذلك', 'شكرا لك ايضا تعال مجددا'],
    };
    for (const [lang, said] of Object.entries(lines)) {
      const s = open('home_own_guest', lang === 'ar' ? 'ar' : 'en', {}, 'aiko');
      for (const text of said) say(s, text);
      expect(s.ended, lang).toBe(true);
      expect([...s.stepsDone].sort(), lang).toEqual(['compliment', 'goodbye', 'slippers', 'tea', 'welcome']);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// pocket lines
// ---------------------------------------------------------------------------------------------------------------

describe('the pocket lines of the own-room module', () => {
  it('every line is language an intent of its scenario accepts, typed in Japanese', () => {
    const owner = (id: string) => id.replace(/^p_/, '').replace(/_\d$/, '');
    const failures: string[] = [];
    for (const [id, p] of Object.entries(HOME_POCKETS)) {
      const scenario = scenarioById(owner(id))!;
      expect(scenario, id).toBeTruthy();
      const text = p.line.ja.replace(/\|/g, '');
      let accepted = false;
      for (const nodeId of Object.keys(scenario.nodes)) {
        if (scenario.nodes[nodeId].end) continue;
        const s = open(scenario.id, 'en', { startNode: nodeId, flags: { priced: true }, game: scenario.id === 'aiko_contract' ? landlady(70000).hooks : scenario.id === 'fuku_home' ? furnitureShop(70000).hooks : undefined }, scenario.id === 'home_own_guest' ? 'aiko' : undefined);
        try {
          if (say(s, text).learner.matched) {
            accepted = true;
            break;
          }
        } catch {
          // a node the text does not fit
        }
      }
      if (!accepted) failures.push(`${id}: ${text}`);
    }
    expect(failures).toEqual([]);
  });
});
