// Nakamura Motors (agent 3D-lite, docs/GAME_DESIGN.md §6.3, §4.4 rule 3): every chip is understood at every node (with and without game hooks, enough
// cash and too little, the stock flags), each scenario is completable by tapping chips alone (and the short / leave branches), the haggle is bounded
// by the pack's rule whatever is typed, the bicycle can never be haggled, and every pocket and phrasebook line is language an intent accepts.
import { beforeAll, describe, expect, it } from 'vitest';
import { haggleLimit, type GamePack } from '@lw/game';
import { CHARACTERS, JP_PACK, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, setNumberParser, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { parseNumbers } from '../../content/src/tokyo/game/jp-language';
import { AIKO_MOTORS_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-aiko-motors';
import { SHOP_MOTORS_PHRASES } from '../../content/src/phrasebook/shop-motors';

beforeAll(() => setNumberParser(parseNumbers));

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

// ---- the shop's side of the game seam, shaped like the real one (prices from the pack numbers, haggle bounded by `haggleLimit`) ----
const BIKE_PRICE: Record<string, number> = { mamachari: 19800, helmet: 2980, ebike: 89000 };
const REGISTRATION = JP_PACK.rules.registrationFee as number;
const CAR_BODY = 148000;
const CAR_FEES = 50000;
const GIFT_PRICE = 500;
const HAGGLE_CAP = haggleLimit(JP_PACK as GamePack, 'motors', CAR_BODY, false);
const HAGGLE_CAP_ASSISTED = haggleLimit(JP_PACK as GamePack, 'motors', CAR_BODY, true);

function bikeCounter(cash: number, locked: string[] = []) {
  const log = { charges: [] as Array<{ item: string; yen: number }>, refused: 0, intents: [] as string[] };
  const totalOf = (s: Record<string, string>) => {
    if (s.giftItem) return GIFT_PRICE;
    const m = s.bikeModel ?? 'mamachari';
    return BIKE_PRICE[m] + (m === 'helmet' ? 0 : REGISTRATION);
  };
  const hooks: SessionGameHooks = {
    vars: (s) => ({ price: money(BIKE_PRICE[s.bikeModel ?? 'mamachari']), total: money(totalOf(s)) }),
    charge(s) {
      const yen = totalOf(s);
      if (cash < yen || (s.bikeModel && locked.includes(s.bikeModel))) {
        log.refused++;
        return { ok: false };
      }
      cash -= yen;
      log.charges.push({ item: s.giftItem ?? s.bikeModel ?? 'mamachari', yen });
      return { ok: true };
    },
    intent(kind) {
      log.intents.push(kind);
      return { ok: true };
    },
  };
  return { hooks, log };
}

/** The dealer: list price 198,000 (body 148,000 + fees 50,000); ONE haggle per conversation, bounded by the pack rule; say_total must match the live total. */
function carCounter(cash: number, locked: string[] = []) {
  const log = { charges: [] as number[], refused: 0, haggles: [] as Array<{ assisted: boolean; asked?: number; granted: number }>, totals: [] as Array<{ said?: number; ok: boolean }> };
  let granted = 0;
  let tried = false;
  const total = () => CAR_BODY + CAR_FEES - granted;
  const hooks: SessionGameHooks = {
    vars: () => ({ body: money(CAR_BODY), price: money(CAR_BODY), total: money(total()) }),
    charge(s) {
      if (cash < total() || (s.carModel && locked.includes(s.carModel))) {
        log.refused++;
        return { ok: false };
      }
      cash -= total();
      log.charges.push(total());
      return { ok: true };
    },
    intent(kind, ctx) {
      if (kind === 'haggle') {
        const cap = haggleLimit(JP_PACK as GamePack, 'motors', CAR_BODY, ctx.assisted);
        // a price the learner names asks for the difference; a plain polite request asks for the most it can get
        const asked = ctx.number === undefined ? cap : Math.max(0, total() - ctx.number);
        const take = tried ? 0 : Math.max(0, Math.min(asked, cap));
        tried = true;
        granted += take;
        log.haggles.push({ assisted: ctx.assisted, asked: ctx.number, granted: take });
        return { ok: take > 0, vars: { total: money(total()) } };
      }
      if (kind === 'say_total') {
        const ok = ctx.number === total();
        log.totals.push({ said: ctx.number, ok });
        return { ok };
      }
      return { ok: true, vars: { total: money(total()) } };
    },
  };
  return { hooks, log, granted: () => granted };
}

const slots = (s: ConversationSession): Record<string, string> => (s as unknown as { slotIds: Record<string, string> }).slotIds;

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** Picks every suggestion at every reachable node; Nakamura-san must always understand it. */
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
    if (sugg.length < 2) problems.push(`${s.nodeId}: fewer than 2 suggestions`);
    sugg.forEach((sg, i) => {
      if (sg.tokens.some((t) => t.s === '…' && !t.punct)) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const t = replay(path);
      const r = t.pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i}: the answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
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

/** Taps the chip whose Japanese contains each part, in turn. */
function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}
const lastLine = (s: ConversationSession) => s.turns[s.turns.length - 1].line.written;

/** the walks replay the conversation for every chip at every node: slow under software rendering of the whole suite */
const WALK_MS = 120000;
const BIKE_HAPPY = ['自転車', '通学', 'ママチャリ', 'これ', 'レイラ', '住所', 'カード', 'はい'];
/** start -> models -> the used car -> body price -> drive-away price */
const CAR_TO_TOTAL = ['軽自動車を見たい', '中古の軽自動車', '値段', '乗り出し'];
const CAR_AFTER_TOTAL = ['レイラ', 'カード'];

const BIKE_MODES: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: bikeCounter(500000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: bikeCounter(100).hooks, flags: { priced: true } })],
  ['with the twist', () => ({ game: bikeCounter(500000).hooks, flags: { priced: true, twist: true } })],
  ['with the e-bike out of stock', () => ({ game: bikeCounter(500000, ['ebike']).hooks, flags: { priced: true, ebike_locked: true } })],
];
const CAR_MODES: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: carCounter(900000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: carCounter(100).hooks, flags: { priced: true } })],
  ['with the twist', () => ({ game: carCounter(900000).hooks, flags: { priced: true, twist: true } })],
  ['with the low-mileage car out of stock', () => ({ game: carCounter(900000, ['good']).hooks, flags: { priced: true, good_locked: true } })],
];

describe('motors: every chip is understood', () => {
  for (const l1 of ['en', 'ar'] as const) {
    it(`motors_visit, ${l1}`, () => {
      for (const mk of [() => ({}), () => ({ game: bikeCounter(5000).hooks, flags: { priced: true } })]) {
        const r = walk('motors_visit', l1, mk);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(2);
      }
    }, WALK_MS);
    for (const [label, mk] of BIKE_MODES)
      it(`motors_bike ${label}, ${l1}`, () => {
        const r = walk('motors_bike', l1, mk);
        expect(r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(10);
      }, WALK_MS);
    for (const [label, mk] of CAR_MODES)
      it(`motors_car ${label}, ${l1}`, () => {
        const r = walk('motors_car', l1, mk);
        // without game hooks nobody can read the total back: the say-the-total chip has no number to show (the app always has the hooks)
        const noTotal = /^(confirm|wrong_total)\/#\d+: unresolved variable$/;
        expect(label === 'without hooks' ? r.problems.filter((p) => !noTotal.test(p)) : r.problems).toEqual([]);
        expect(r.nodes).toBeGreaterThan(10);
      }, WALK_MS);
  }

  it('the chip walk reaches every node a chip can reach (the stock gates and the typed-only answers are the rest)', () => {
    const typedOnly: Record<string, string[]> = {
      // 'leave', 'done' and 'short' are end nodes or need an empty purse: their own tests below walk them
      motors_visit: ['leave'],
      motors_bike: ['ebike_offer', 'leave', 'done', 'short'],
      motors_car: ['haggle_no', 'wrong_total', 'leave', 'done', 'short'],
    };
    for (const [id, mk] of [
      ['motors_visit', () => ({})],
      ['motors_bike', () => ({ game: bikeCounter(500000).hooks, flags: { priced: true } })],
      ['motors_car', () => ({ game: carCounter(900000).hooks, flags: { priced: true } })],
    ] as Array<[string, () => Partial<SessionOptions>]>) {
      const seen = new Set([...walk(id, 'en', mk).visited].map((k) => k.split('|')[0]));
      const missing = Object.keys(scenarioById(id)!.nodes).filter((n) => !seen.has(n) && !typedOnly[id].includes(n));
      expect(missing, id).toEqual([]);
    }
  });
});

describe('motors_visit: browse and decline politely (no purchase)', () => {
  it('greet, ask the price of a bicycle, say you will think about it: all three steps, nothing charged', () => {
    const c = bikeCounter(100000);
    const s = open('motors_visit', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['こんにちは', '自転車', 'ちょっと']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('leave');
    expect([...s.stepsDone].sort()).toEqual(['decline', 'greet', 'price']);
    expect(c.log.charges).toEqual([]);
    expect(s.summary().goalDone).toBe(3);
  });

  it('「考えます」 at the browse node and straight away also leave politely; the price is read from the hooks', () => {
    const s = open('motors_visit', 'en', { game: bikeCounter(0).hooks, flags: { priced: true } });
    tap(s, ['こんにちは', '自転車']);
    expect(lastLine(s)).toContain('一万九千八百円');
    tap(s, ['考えます']);
    expect(s.nodeId).toBe('leave');
    const t = open('motors_visit');
    expect(say(t, '考えます').learner.matched).toBe(true);
    expect(t.ended).toBe(true);
  });

  it('without game hooks no number is spoken', () => {
    const s = open('motors_visit');
    tap(s, ['自転車']);
    expect(s.nodeId).toBe('bike_price');
    expect(lastLine(s)).not.toMatch(/円/);
  });
});

describe('motors_bike: the whole purchase by tapping chips', () => {
  it('with enough cash: every goal step done, charged once with the registration fee in the total', () => {
    const c = bikeCounter(50000);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, BIKE_HAPPY);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['model', 'pay', 'price', 'purpose', 'register']);
    expect(c.log.charges).toEqual([{ item: 'mamachari', yen: 19800 + REGISTRATION }]);
    expect(slots(s).bikeModel).toBe('mamachari');
    expect(slots(s).purpose).toBe('school');
    expect(slots(s).payMethod).toBe('card');
    expect(s.summary().goalDone).toBe(5);
  });

  it('the quote reads the total aloud (registration included) from the hooks', () => {
    const s = open('motors_bike', 'en', { game: bikeCounter(50000).hooks, flags: { priced: true } });
    tap(s, ['自転車', '通学', 'ママチャリ']);
    expect(s.nodeId).toBe('quote_bike');
    expect(lastLine(s)).toContain('防犯登録');
    expect(lastLine(s)).toContain('二万四百円');
  });

  it('the helmet is suggested at the model node, and buying only the helmet costs no registration', () => {
    const c = bikeCounter(50000);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['自転車', '買い物']);
    expect(s.nodeId).toBe('model');
    expect(lastLine(s)).toContain('ヘルメット');
    tap(s, ['ヘルメット', 'これ', 'レイラ', '住所', 'カード', 'はい']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual([{ item: 'helmet', yen: 2980 }]);
  });

  it('with too little cash it ends at short with no purchase and no pay step; short -> cheaper -> the helmet is then bought', () => {
    const c = bikeCounter(3000);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, BIKE_HAPPY);
    expect(s.nodeId).toBe('short');
    expect(c.log.charges).toEqual([]);
    expect(s.stepsDone.has('pay')).toBe(false);
    tap(s, ['安い']);
    expect(s.nodeId).toBe('model');
    tap(s, ['ヘルメット', 'これ', 'レイラ', '住所', 'カード', 'はい']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual([{ item: 'helmet', yen: 2980 }]);
  });

  it('short -> 「また来ます」 leaves without buying', () => {
    const c = bikeCounter(100);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, BIKE_HAPPY);
    tap(s, ['また']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('leave');
    expect(s.stepsDone.has('pay')).toBe(false);
  });

  it('think about it at the quote, and declining at the confirmation, both leave with nothing charged', () => {
    const c = bikeCounter(50000);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['自転車', '通学', 'ママチャリ', '考えます']);
    expect(s.nodeId).toBe('leave');
    const t = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(t, [...BIKE_HAPPY.slice(0, -1), 'いいえ']);
    expect(t.nodeId).toBe('leave');
    expect(c.log.charges).toEqual([]);
  });

  it('the power-assist bicycle is refused while it is out of stock (ends at short), offered while it is not', () => {
    const c = bikeCounter(500000, ['ebike']);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true, ebike_locked: true } });
    tap(s, ['自転車', '通学']);
    expect(lastLine(s)).not.toContain('電動アシスト自転車');
    say(s, '電動アシスト自転車をください');
    expect(s.nodeId).toBe('ebike_offer');
    expect(lastLine(s)).toContain('まだ');
    tap(s, ['ヘルメット']);
    expect(s.nodeId).toBe('quote_helmet');
    const open1 = open('motors_bike', 'en', { game: bikeCounter(500000).hooks, flags: { priced: true } });
    tap(open1, ['自転車', '通学']);
    expect(lastLine(open1)).toContain('電動アシスト自転車');
  });

  it('the present branch: a car air freshener is bought with the shared giftItem slot', () => {
    const c = bikeCounter(5000);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['プレゼント', '車の芳香剤', 'カード']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual([{ item: 'carFresh', yen: GIFT_PRICE }]);
    expect(slots(s).giftItem).toBe('carFresh');
  });

  it('typed language: the bicycle named at the start, a name in any script, an address, helmet and price questions', () => {
    for (const name of ['レイラです。', 'Layla です', '雷拉です']) {
      const s = open('motors_bike', 'en', { game: bikeCounter(50000).hooks, flags: { priced: true } });
      expect(say(s, '自転車がほしいのですが').learner.matched).toBe(true);
      expect(s.nodeId).toBe('purpose');
      say(s, '散歩に使います');
      expect(slots(s).purpose).toBe('ride');
      say(s, 'ママチャリはいくらですか');
      expect(s.nodeId).toBe('quote_bike');
      say(s, 'これをください');
      expect(s.nodeId).toBe('register_name');
      say(s, name);
      expect(s.nodeId, name).toBe('register_addr');
      say(s, '桜町に住んでいます');
      expect(s.nodeId).toBe('pay');
      expect(s.stepsDone.has('register')).toBe(true);
    }
  });
});

describe('motors_bike: the bicycle can never be haggled', () => {
  const ASKS = ['もう少し安くなりませんか', 'まけてください', '15000円にしてください', 'ねびきしてください', '安くしてください', '1円になりませんか'];

  it('no haggle ever reaches the game hook, at any node, and nothing is discounted', () => {
    const nodes = Object.keys(scenarioById('motors_bike')!.nodes);
    expect(nodes.length).toBeGreaterThan(8);
    const paths: string[][] = [[], ['自転車'], ['自転車', '通学'], ['自転車', '通学', 'ママチャリ'], ['自転車', '通学', 'ママチャリ', 'これ'], [...BIKE_HAPPY.slice(0, 5)]];
    for (const path of paths)
      for (const ask of ASKS) {
        const c = bikeCounter(500000);
        const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
        tap(s, path);
        say(s, ask);
        expect(c.log.intents.includes('haggle'), `${s.nodeId} ${ask}`).toBe(false);
        expect(lastLine(s)).not.toMatch(/円/);
      }
    // the whole purchase after asking at the quote still costs the list price plus the registration
    const c = bikeCounter(500000);
    const s = open('motors_bike', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['自転車', '通学', 'ママチャリ']);
    say(s, 'もう少し安くなりませんか');
    expect(s.nodeId).toBe('quote_bike');
    tap(s, ['これ', 'レイラ', '住所', 'カード', 'はい']);
    expect(c.log.charges).toEqual([{ item: 'mamachari', yen: 19800 + REGISTRATION }]);
  });

  it('「高いです」 gets the fixed-price answer (定価), a culture lesson', () => {
    const s = open('motors_bike', 'en', { game: bikeCounter(500000).hooks, flags: { priced: true } });
    tap(s, ['自転車', '通学', 'ママチャリ', '少し']);
    expect(lastLine(s)).toContain('定価');
    expect(s.nodeId).toBe('quote_bike');
  });
});

describe('motors_car: body price, drive-away price, the one haggle', () => {
  it('by chips: look, body price, drive-away price, haggle, say the total, sign, pay: all six steps, the haggled total charged', () => {
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, CAR_TO_TOTAL);
    expect(s.nodeId).toBe('total_quote');
    expect(lastLine(s)).toContain('十九万八千円');
    tap(s, ['もう少し']);
    expect(s.nodeId).toBe('haggle_ok');
    // every chip is assisted: 40% of the cap
    expect(c.log.haggles).toEqual([{ assisted: true, asked: undefined, granted: HAGGLE_CAP_ASSISTED }]);
    tap(s, ['これ', '円です', ...CAR_AFTER_TOTAL, 'はい'].filter((x) => x !== 'はい'));
    expect(s.nodeId).toBe('done');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['ask_total', 'confirm', 'haggle', 'look', 'pay', 'sign']);
    expect(c.log.charges).toEqual([CAR_BODY + CAR_FEES - HAGGLE_CAP_ASSISTED]);
    expect(c.log.totals).toEqual([{ said: CAR_BODY + CAR_FEES - HAGGLE_CAP_ASSISTED, ok: true }]);
    expect(s.summary().goalDone).toBe(6);
  });

  it('typed on your own (independent), the haggle takes the full cap: min(6% of the body price, 8,880)', () => {
    expect(HAGGLE_CAP).toBe(8880);
    expect(HAGGLE_CAP_ASSISTED).toBe(3552);
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, '軽自動車を見たいです').learner.matched).toBe(true);
    say(s, '中古の軽自動車を見たいです');
    expect(s.nodeId).toBe('look');
    say(s, '値段はいくらですか');
    expect(s.nodeId).toBe('body_quote');
    expect(lastLine(s)).toContain('十四万八千円');
    say(s, '乗り出し価格はいくらですか');
    expect(s.nodeId).toBe('total_quote');
    say(s, 'もう少し安くなりませんか');
    expect(s.nodeId).toBe('haggle_ok');
    expect(c.log.haggles[0].assisted).toBe(false);
    expect(c.granted()).toBe(HAGGLE_CAP);
    expect(lastLine(s)).toContain('十八万九千百二十円');
  });

  it('the trap: at the body price 「これをください」 does not buy, and asking 「乗り出し価格は？」 (or 「全部でいくら」) moves on', () => {
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['軽自動車を見たい', '中古の軽自動車', '値段']);
    expect(s.nodeId).toBe('body_quote');
    say(s, 'これをください');
    expect(s.nodeId).toBe('body_quote');
    expect(lastLine(s)).toContain('乗り出し価格');
    expect(c.log.charges).toEqual([]);
    say(s, '全部でいくらですか');
    expect(s.nodeId).toBe('total_quote');
    expect(s.stepsDone.has('ask_total')).toBe(true);
  });

  it('a refused haggle (nothing to take off) goes to haggle_no and the list price is paid', () => {
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, CAR_TO_TOTAL);
    say(s, '198000円にしてください');
    expect(s.nodeId).toBe('haggle_no');
    expect(s.stepsDone.has('haggle')).toBe(true);
    tap(s, ['これ', '円です', ...CAR_AFTER_TOTAL]);
    expect(c.log.charges).toEqual([CAR_BODY + CAR_FEES]);
  });

  it('say_total: a wrong amount (typed digits) is corrected once and retried, the right one in digits is accepted', () => {
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, [...CAR_TO_TOTAL, 'これ']);
    expect(s.nodeId).toBe('haggle_no_buy');
    tap(s, ['はい']);
    expect(s.nodeId).toBe('confirm');
    say(s, '100000円です');
    expect(s.nodeId).toBe('wrong_total');
    expect(s.stepsDone.has('confirm')).toBe(false);
    say(s, '198000円です');
    expect(s.nodeId).toBe('sign');
    expect(s.stepsDone.has('confirm')).toBe(true);
    expect(c.log.totals).toEqual([{ said: 100000, ok: false }, { said: 198000, ok: true }]);
  });

  it('declining the haggle (buying at the quote) skips only the haggle step; the pay step still completes', () => {
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, [...CAR_TO_TOTAL, 'これ', 'はい', '円です', ...CAR_AFTER_TOTAL]);
    expect(s.nodeId).toBe('done');
    expect(s.stepsDone.has('haggle')).toBe(false);
    expect(s.stepsDone.has('pay')).toBe(true);
    expect(c.log.charges).toEqual([CAR_BODY + CAR_FEES]);
  });

  it('with too little cash it ends at short with no purchase and no pay step; then 「また来ます」 leaves', () => {
    const c = carCounter(100000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, [...CAR_TO_TOTAL, 'もう少し', 'これ', '円です', ...CAR_AFTER_TOTAL]);
    expect(s.nodeId).toBe('short');
    expect(c.log.charges).toEqual([]);
    expect(s.stepsDone.has('pay')).toBe(false);
    tap(s, ['また']);
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect(s.stepsDone.has('pay')).toBe(false);
  });

  it('「考えます」 at the body price, at the drive-away price and after the haggle each leave politely; nothing is charged', () => {
    for (const upTo of [3, 4, 5]) {
      const c = carCounter(900000);
      const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
      tap(s, [...CAR_TO_TOTAL, 'もう少し'].slice(0, upTo));
      tap(s, ['考えます']);
      expect(s.nodeId, `after ${upTo}`).toBe('leave');
      expect(s.ended).toBe(true);
      expect(c.log.charges).toEqual([]);
      expect(s.stepsDone.has('pay')).toBe(false);
    }
  });

  it('the low-mileage car is described while in stock, and is "not available yet" (with the used car offered) while locked', () => {
    const s = open('motors_car', 'en', { game: carCounter(900000).hooks, flags: { priced: true } });
    tap(s, ['軽自動車を見たい']);
    expect(lastLine(s)).toContain('低走行');
    say(s, '低走行の軽自動車を見たいです');
    expect(s.nodeId).toBe('good_offer');
    expect(lastLine(s)).toContain('青');
    const t = open('motors_car', 'en', { game: carCounter(900000, ['good']).hooks, flags: { priced: true, good_locked: true } });
    tap(t, ['軽自動車を見たい']);
    expect(lastLine(t)).toContain('まだ');
    say(t, '低走行の軽自動車を見たいです');
    expect(t.nodeId).toBe('good_offer');
    expect(lastLine(t)).toContain('まだ');
    tap(t, ['中古の軽自動車']);
    expect(t.nodeId).toBe('look');
    expect(lastLine(t)).toContain('白');
  });

  it('the car details (colour, year, mileage) are answered without leaving the look node', () => {
    const s = open('motors_car', 'en', { game: carCounter(900000).hooks, flags: { priced: true } });
    tap(s, ['軽自動車を見たい', '中古の軽自動車']);
    for (const q of ['年式は？', '色は何色ですか', '走行距離は？']) {
      expect(say(s, q).learner.matched, q).toBe(true);
      expect(s.nodeId, q).toBe('look');
    }
  });
});

describe('motors_car: the haggle never exceeds the cap, even with adversarial inputs', () => {
  const TOTAL = CAR_BODY + CAR_FEES;
  // polite requests, a price named (too low, absurd, zero, negative-looking, huge, in kana), repeats, and mixed tries
  const ATTEMPTS = [
    'もう少し安くなりませんか',
    'まけてください',
    'ねびきしてください',
    '1円にしてください',
    '0円になりませんか',
    '-5000円にしてください',
    '100円までさげてください',
    '十万円にしてください',
    '九千九百九十九億円にしてください',
    '99999999999999円にしてください',
    '百九十万円にしてください',
    '188000円にしてください',
    '197999円にしてください',
    '二十万円にしてください',
    'もうすこしやすく もう少し安く まけて まけて',
  ];

  it('one try, any wording, any number: the discount is never above the cap and the total never below list - cap', () => {
    for (const a of ATTEMPTS)
      for (const mode of ['typed', 'assisted'] as const) {
        const c = carCounter(900000);
        const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
        tap(s, CAR_TO_TOTAL);
        if (mode === 'typed') say(s, a);
        else tap(s, ['もう少し']);
        const cap = mode === 'typed' ? HAGGLE_CAP : HAGGLE_CAP_ASSISTED;
        expect(c.granted(), `${mode} ${a}`).toBeLessThanOrEqual(cap);
        expect(c.granted()).toBeGreaterThanOrEqual(0);
        // the engine pays whatever the conversation produced: the charge is never below the floor
        tap(s, ['これ']);
        const floor = TOTAL - cap;
        for (const n of c.log.charges) expect(n).toBeGreaterThanOrEqual(floor);
        expect(TOTAL - c.granted()).toBeGreaterThanOrEqual(floor);
      }
  });

  it('asking again and again (any node, any order) takes at most one cap in total', () => {
    const c = carCounter(900000);
    const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, CAR_TO_TOTAL);
    for (let i = 0; i < 6; i++) {
      for (const a of ATTEMPTS) {
        if (s.ended) break;
        try {
          say(s, a);
        } catch {
          /* a wording the translator does not cover */
        }
      }
    }
    expect(c.granted()).toBeLessThanOrEqual(HAGGLE_CAP);
    expect(c.log.haggles.filter((h) => h.granted > 0).length).toBeLessThanOrEqual(1);
    // and finishing the purchase charges at least list - cap
    if (!s.ended) {
      const guard = ['これ', 'はい', '円です', 'レイラ', 'カード'];
      for (const g of guard) {
        const i = s.suggestions().findIndex((x) => x.written.includes(g));
        if (i >= 0 && !s.ended) s.pickSuggestion(i);
      }
    }
    for (const n of c.log.charges) expect(n).toBeGreaterThanOrEqual(TOTAL - HAGGLE_CAP);
  });

  it('haggle is reachable only from the drive-away quote (never from the body price, the look node or the start)', () => {
    for (const path of [[], ['軽自動車を見たい'], ['軽自動車を見たい', '中古の軽自動車'], ['軽自動車を見たい', '中古の軽自動車', '値段']]) {
      const c = carCounter(900000);
      const s = open('motors_car', 'en', { game: c.hooks, flags: { priced: true } });
      tap(s, path);
      say(s, 'もう少し安くなりませんか');
      expect(c.log.haggles, `${s.nodeId}`).toEqual([]);
    }
  });
});

describe('motors: pockets and phrasebook', () => {
  const STAGES: Record<string, Array<[string[], string]>> = {
    motors_bike: [
      [[], 'start'],
      [['自転車'], 'purpose'],
      [['自転車', '通学'], 'model'],
      [['自転車', '通学', 'ママチャリ'], 'quote_bike'],
      [['プレゼント'], 'goods'],
    ],
    motors_visit: [
      [[], 'start'],
      [['こんにちは'], 'browse'],
      [['こんにちは', '自転車'], 'bike_price'],
    ],
    motors_car: [
      [[], 'start'],
      [['軽自動車を見たい'], 'models'],
      [['軽自動車を見たい', '中古の軽自動車'], 'look'],
      [['軽自動車を見たい', '中古の軽自動車', '値段'], 'body_quote'],
      [CAR_TO_TOTAL, 'total_quote'],
    ],
  };
  const accepted = (text: string): boolean =>
    Object.entries(STAGES).some(([id, stages]) =>
      stages.some(([taps, node]) => {
        const s = open(id, 'en', { game: id === 'motors_car' ? carCounter(900000).hooks : bikeCounter(500000).hooks, flags: { priced: true } });
        tap(s, taps);
        if (s.nodeId !== node) return false;
        const r = s.submit({ text, mode: 'typed_ja' });
        return r.learner.matched && r.character.kind !== 'fallback';
      }),
    );

  it('every pocket line is language an intent of a Motors scenario accepts', () => {
    const lines = Object.values(AIKO_MOTORS_POCKETS).filter((p) => p.id.startsWith('p_motors_'));
    expect(lines.length).toBe(3);
    for (const p of lines) {
      const text = p.line.ja.replace(/\|/g, '');
      expect(accepted(text), `${p.id} ${text}`).toBe(true);
    }
  });

  it('every phrasebook line of the module is language a Motors scenario accepts at some node', () => {
    for (const p of SHOP_MOTORS_PHRASES) {
      const text = p.ja.replace(/\|/g, '');
      expect(accepted(text), `${p.id} ${text}`).toBe(true);
    }
  });
});
