import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById } from '@lw/content';
import { BALANCE, createGameState, reduce, type GameState, type GameView, type InputEvent, type ReduceResult } from '@lw/game';
import { ConversationSession } from '@lw/engine';
import { createConvoGame, leaveAction, mergeQuotes, twistFor, yenVar } from '../src/game/convoHooks';

const NOW = new Date(2030, 0, 15, 12).getTime();

const VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
};

/** The conversation screen's hooks over a real reducer, with no screen: state lives in a closure the way the game store holds it. */
function rig(scenarioId: string, patch: (s: GameState) => GameState = (s) => s, opts: { startNode?: string; view?: GameView; sessionId?: string } = {}) {
  let state = patch(createGameState(JP_PACK, NOW));
  const events: InputEvent[] = [];
  const view = opts.view ?? VIEW;
  const game = createConvoGame({
    pack: JP_PACK,
    scenarioId,
    sessionId: opts.sessionId ?? 's_test',
    state: () => state,
    view: () => view,
    commit: (ev): ReduceResult => {
      events.push(ev);
      const r = reduce(state, ev, { pack: JP_PACK, now: NOW, view, rng: () => 0.5 });
      state = r.state;
      return r;
    },
  });
  const scenario = scenarioById(scenarioId)!;
  const session = new ConversationSession({
    scenario,
    character: CHARACTERS.find((c) => c.id === scenario.characterId)!,
    l1: 'en',
    profileName: 'Sam',
    topics: [],
    sessionId: opts.sessionId ?? 's_test',
    game: game.hooks,
    flags: game.flags,
    startNode: opts.startNode,
    recalled: game.recalled,
    policy: BALANCE,
  });
  return { game, session, get state() { return state; }, events };
}

/** Taps the first chip until the conversation ends. */
function tapThrough(session: ConversationSession) {
  session.start();
  let guard = 0;
  while (!session.ended && guard++ < 30) session.pickSuggestion(0);
}

describe('twist flag (§6.2)', () => {
  it('never on the first play, deterministic after, and about a third of the plays', () => {
    expect(twistFor(3, 'cafe', 0)).toBe(false);
    expect(twistFor(3, 'cafe', 4)).toBe(twistFor(3, 'cafe', 4));
    const hits = Array.from({ length: 300 }, (_, i) => twistFor(i, 'konbini', 1 + (i % 7))).filter(Boolean).length;
    expect(hits).toBeGreaterThan(60);
    expect(hits).toBeLessThan(140);
  });
});

describe('leaving a conversation (review)', () => {
  it('a finished conversation is settled by the X, because its purchase was already charged at the end node; an open one asks first', () => {
    const r = rig('cafe');
    r.session.start();
    expect(leaveAction(r.session.ended)).toBe('confirm');
    tapThrough(r.session);
    // the drink is paid for, and nothing but `conversation_done` pays the conversation
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(1);
    expect(r.session.ended).toBe(true);
    expect(leaveAction(r.session.ended)).toBe('settle');
  });
});

describe('yenVar', () => {
  it('prices are yenToJa markup with a gloss, and a free basket reads zero yen', () => {
    expect(yenVar(450).ja).toBe('四|百|五|十|円');
    expect(yenVar(450).gloss).toEqual({ en: '450 yen', ar: '450 ين' });
    expect(yenVar(0).gloss?.en).toBe('0 yen');
  });
});

describe('shop hooks over the real pack', () => {
  it('every menu option of a shop scenario has a price that equals the menu (the clerk says the real price)', () => {
    for (const meta of JP_PACK.scenarioMeta.filter((m) => m.shop)) {
      const shop = meta.shop!;
      for (const [option, itemId] of Object.entries(shop.itemMap)) {
        const menu = JP_PACK.menu.find((m) => m.id === itemId);
        if (!menu) continue; // gifts come with the catalog (3E)
        // priced where the shop is open (the festival stalls open with Chapter 7)
        const open = JP_PACK.shops.find((x) => x.id === shop.shopId)?.openChapter ?? 1;
        const r = rig(meta.id, (st) => ({ ...st, chapter: { ...st.chapter, n: Math.max(st.chapter.n, open) } }));
        const vars = r.game.hooks.vars({ [shop.itemSlot!]: option }, {});
        expect(r.game.amounts().price, `${meta.id}/${option}`).toBe(menu.price);
        expect(vars.total).toBeDefined();
      }
    }
  });

  it('station: the fare comes from the place slot', () => {
    const r = rig('station');
    r.game.hooks.vars({ place: 'shinjuku' }, {});
    expect(r.game.amounts().fare).toBe(JP_PACK.fares.shinjuku);
  });

  it('flags: priced always, twist only from the second play', () => {
    expect(rig('cafe').game.flags).toEqual({ priced: true });
    let any = false;
    for (let day = 0; day < 30 && !any; day++) {
      const r = rig('cafe', (s) => ({ ...s, clock: { ...s.clock, dayIndex: day }, runs: { ...s.runs, cafe: { count: 2, complete: true, stars: 1, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [] } } }));
      any = r.game.flags.twist === true;
    }
    expect(any).toBe(true);
  });

  it('cafe: tapping every chip buys the drink once, at the end node, for exactly the menu price', () => {
    const r = rig('cafe');
    const cash = r.state.wallet.cash;
    tapThrough(r.session);
    const price = JP_PACK.menu.find((m) => m.id === 'cafe:coffee')!.price;
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(1);
    expect(r.state.wallet.cash).toBe(cash - price);
    expect(r.game.purchases).toHaveLength(1);
    const p = r.game.purchases[0];
    expect(p.receipt.total).toBe(price);
    // the first chip at the counter is the card, which has no cash handed over
    expect(p.method).toBe('card');
    expect(p.receipt.paid).toBeUndefined();
    expect(r.session.endedBy).toBe('end');
  });

  it('cash: the receipt shows a note handed over and the change (display only, never more than the wallet held)', () => {
    const r = rig('cafe');
    r.session.start();
    for (const text of ['コーヒーをください', 'ホット', 'だいじょうぶです', '現金でお願いします']) r.session.submit({ text, mode: 'typed_ja' });
    const price = JP_PACK.menu.find((m) => m.id === 'cafe:coffee')!.price;
    const p = r.game.purchases[0];
    expect(p.method).toBe('cash');
    expect(p.receipt.paid).toBe(1000);
    expect(p.receipt.change).toBe(1000 - price);
    expect(r.state.wallet.cash).toBe(3000 - price);
    const poor = rig('cafe', (s) => ({ ...s, wallet: { ...s.wallet, cash: 600 } }));
    poor.session.start();
    for (const text of ['コーヒーをください', 'ホット', 'だいじょうぶです', '現金でお願いします']) poor.session.submit({ text, mode: 'typed_ja' });
    expect(poor.game.purchases[0].receipt.paid).toBe(600);
  });

  it('the ledger id is the session and the running number, so a second settle cannot double-charge', () => {
    const r = rig('cafe');
    tapThrough(r.session);
    const ev = r.events.find((e) => e.t === 'purchase')!;
    expect(ev).toMatchObject({ sessionId: 's_test', n: 1 });
    const again = reduce(r.state, ev, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    expect(again.state.wallet.cash).toBe(r.state.wallet.cash);
  });

  it('too little cash: the learner is told, nothing is bought, the conversation can still end politely', () => {
    const r = rig('cafe', (s) => ({ ...s, wallet: { ...s.wallet, cash: 100 } }));
    tapThrough(r.session);
    expect(r.events).toHaveLength(0);
    expect(r.game.purchases).toHaveLength(0);
    expect(r.state.wallet.cash).toBe(100);
    expect(r.session.ended).toBe(true);
    // the short branch is not the goal `pay`
    expect(r.session.stepsDone.has('pay')).toBe(false);
  });

  it('IC pays from the IC pocket and never touches cash', () => {
    const r = rig('konbini', (s) => ({ ...s, wallet: { ...s.wallet, cash: 0, ic: 2000 } }));
    r.session.start();
    for (const text of ['おにぎりをください', 'だいじょうぶです', 'ICカードで']) {
      if (r.session.ended) break;
      r.session.submit({ text, mode: 'typed_ja' });
    }
    expect(r.state.wallet.cash).toBe(0);
    expect(r.state.wallet.ic).toBe(2000 - JP_PACK.menu.find((m) => m.id === 'konbini:onigiri')!.price);
    expect(r.game.purchases[0].method).toBe('ic');
    expect(r.game.purchases[0].receipt.paid).toBeUndefined();
  });

  it('a quantity multiplies the main item only', () => {
    const r = rig('konbini');
    r.game.hooks.vars({ item: 'onigiri', qty: 'two' }, {});
    expect(r.game.amounts().total).toBe(160 * 2);
    expect(r.game.amounts().price).toBe(160);
  });

  it('ramen: the bowl and its extra are two purchases checked once, and an egg you cannot afford buys nothing', () => {
    const bowl = JP_PACK.menu.find((m) => m.id === 'ramen:shoyu')!.price;
    const egg = JP_PACK.menu.find((m) => m.id === 'ramen:ajitama')!.price;
    const r = rig('ramen', (s) => ({ ...s, wallet: { ...s.wallet, cash: bowl + egg } }));
    expect(r.game.hooks.charge({ flavor: 'shoyu', ramenExtra: 'ajitama' }).ok).toBe(true);
    expect(r.events.map((e) => e.t === 'purchase' && e.itemId)).toEqual(['ramen:shoyu', 'ramen:ajitama']);
    expect(r.state.wallet.cash).toBe(0);
    expect(r.game.purchases[0].receipt.total).toBe(bowl + egg);
    expect(r.game.purchases[0].receipt.lines.filter((l) => l.kind === 'item')).toHaveLength(2);

    const poor = rig('ramen', (s) => ({ ...s, wallet: { ...s.wallet, cash: bowl } }));
    expect(poor.game.hooks.charge({ flavor: 'shoyu', ramenExtra: 'ajitama' }).ok).toBe(false);
    expect(poor.events).toHaveLength(0);
    expect(poor.state.wallet.cash).toBe(bowl);
  });

  it('a present replaces the main item when it was picked later, and is dropped when it was picked earlier', () => {
    const later = rig('konbini');
    later.game.hooks.vars({ item: 'onigiri' }, {});
    later.game.hooks.vars({ item: 'onigiri', giftItem: 'choco' }, {});
    // the catalog (3E) prices the gift: the chocolate replaces the onigiri
    expect(later.game.amounts().total).toBe(JP_PACK.items.find((i) => i.id === 'g_choco')!.price);
    const earlier = rig('konbini');
    earlier.game.hooks.vars({ giftItem: 'choco' }, {});
    earlier.game.hooks.vars({ giftItem: 'choco', item: 'water' }, {});
    expect(earlier.game.amounts().total).toBe(JP_PACK.menu.find((m) => m.id === 'konbini:water')!.price);
  });

  it('a shop that does not take the named method takes cash', () => {
    const r = rig('ramen');
    expect(r.game.hooks.charge({ flavor: 'shoyu', payMethod: 'ic' }).ok).toBe(true);
    expect(r.events[0]).toMatchObject({ t: 'purchase', method: 'cash' });
  });

  it('economy intents: asking for the total always works, saying it needs the right number, the rest is refused', () => {
    const r = rig('konbini');
    r.game.hooks.vars({ item: 'onigiri' }, {});
    const ctx = (number?: number) => ({ slotIds: { item: 'onigiri' }, assisted: false, number });
    expect(r.game.hooks.intent!('ask_total', ctx()).ok).toBe(true);
    expect(r.game.hooks.intent!('say_total', ctx(160)).ok).toBe(true);
    expect(r.game.hooks.intent!('say_total', ctx(161)).ok).toBe(false);
    expect(r.game.hooks.intent!('haggle', ctx(100)).ok).toBe(false);
    expect(r.game.hooks.intent!('ask_taxfree', ctx()).ok).toBe(false);
  });
});

describe('what the session is told about the pocket', () => {
  it('a ready pocket line is a recalled line and makes the pocket prepared', () => {
    const r = rig('konbini', (s) => ({
      ...s,
      prep: Object.fromEntries((JP_PACK.scenarioMeta.find((m) => m.id === 'konbini')!.pocket ?? []).map((id) => [id, { s: 'ready' as const, at: s.clock.dayIndex }])),
    }));
    const pocket = JP_PACK.scenarioMeta.find((m) => m.id === 'konbini')!.pocket ?? [];
    if (pocket.length === 0 || !JP_PACK.pockets[pocket[0]]) return; // pocket data is 2E's; nothing to assert before it lands
    expect(r.game.prepared).toBe(true);
    expect(r.game.recalled.length).toBeGreaterThan(0);
  });

  it('with nothing prepared there is nothing recalled', () => {
    const r = rig('konbini');
    expect(r.game.prepared).toBe(false);
    expect(r.game.recalled).toEqual([]);
  });
});

describe('mergeQuotes', () => {
  it('sums a bowl and its extra into one receipt', () => {
    const r = rig('ramen');
    const q = (itemId: string) => ({ shopId: 'ramen', itemId, qty: 1, lines: [{ kind: 'item' as const, label: { en: itemId, ar: itemId }, amount: 100 }], subtotal: 90, tax: 10, total: 100, bulky: false, confirm: false, hours: null, canPay: true });
    const m = mergeQuotes([q('a'), q('b')]);
    expect([m.total, m.tax, m.subtotal, m.lines.length]).toEqual([200, 20, 180, 2]);
    void r;
  });
});

describe('the shops are completable by tapping suggestions', () => {
  // station_ic has its own counter hooks and tests (2G); here the basket shops
  for (const meta of JP_PACK.scenarioMeta.filter((m) => m.shop && Object.keys(m.shop.itemMap).length > 0)) {
    it(`${meta.id}: with cash the payment step is done and one purchase was made`, () => {
      // Free Walk (chapter 9): Hikari Denki and Nakamura Motors are open (docs/RELEASE_1.md)
      const r = rig(meta.id, (s) => ({ ...s, chapter: { ...s.chapter, n: 9 }, wallet: { ...s.wallet, cash: 300000 } }));
      tapThrough(r.session);
      expect(r.session.stepsDone.has(meta.shop!.payStep), meta.id).toBe(true);
      expect(r.game.purchases.length).toBeGreaterThan(0);
    });
    it(`${meta.id}: without money the conversation ends and nothing is bought`, () => {
      const r = rig(meta.id, (s) => ({ ...s, chapter: { ...s.chapter, n: 9 }, wallet: { ...s.wallet, cash: 0 } }));
      tapThrough(r.session);
      expect(r.session.ended).toBe(true);
      expect(r.game.purchases).toHaveLength(0);
      expect(r.state.wallet.cash).toBe(0);
    });
  }
});

describe('the debrief rows are the ledger', () => {
  /** What Conversation.finish() does after the last line: the facts, `conversation_done`, the derived settlement. */
  function settle(r: ReturnType<typeof rig>, mode: 'guided' | 'real' = 'guided') {
    const facts = r.session.facts({ mode, prepared: r.game.prepared, feedback: { register: 'polite', markers: JP_PACK.lang.registerMarkers, speechPolicy: BALANCE.speech } });
    const before = r.state.wallet.cash;
    const res = reduce(r.state, { t: 'conversation_done', facts }, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    const settled = res.derived.find((e) => e.t === 'loop_settled');
    return { res, before, settlement: settled && settled.t === 'loop_settled' ? settled.settlement : null };
  }

  it('the rows add up to the total, and the total is what reached the wallet', () => {
    const r = rig('cafe');
    tapThrough(r.session);
    const { res, before, settlement } = settle(r);
    expect(settlement).not.toBeNull();
    const s = settlement!;
    expect(s.lines.reduce((a, l) => a + l.yen, 0)).toBe(s.total);
    expect(res.state.wallet.cash - before).toBe(s.total);
    // every row has a reason the debrief can name
    for (const l of s.lines) expect(['lines', 'steps', 'prepared', 'real', 'firstPhrase', 'star', 'repeat', 'softCap', 'practiceOnly']).toContain(l.reason);
  });

  it('typing your own lines pays more than tapping every chip (§3.2, the unit version of the assist-vs-solo e2e)', () => {
    // the same four goals both ways: coffee, hot, the Wi-Fi password, pay in cash
    const tapped = rig('cafe');
    tapped.session.start();
    for (const pick of [0, 0, 1, 0, 1]) if (!tapped.session.ended) tapped.session.pickSuggestion(pick);
    const typed = rig('cafe');
    typed.session.start();
    for (const text of ['コーヒーをひとつください', 'ホットでお願いします', 'ワイファイのパスワードを教えてください', 'ありがとうございます', '現金で払います']) {
      if (!typed.session.ended) typed.session.submit({ text, mode: 'typed_ja' });
    }
    expect([...tapped.session.stepsDone].sort()).toEqual(['order', 'pay', 'temp', 'wifi']);
    expect([...typed.session.stepsDone].sort()).toEqual(['order', 'pay', 'temp', 'wifi']);
    expect(settle(typed).settlement!.total).toBeGreaterThan(settle(tapped).settlement!.total);
  });
});

describe('the one haggle of the game (Nakamura Motors, §4.4 rule 3)', () => {
  const car = (s: GameState): GameState => ({ ...s, chapter: { ...s.chapter, n: 9 }, wallet: { ...s.wallet, cash: 400_000 } });
  const slots = { carModel: 'used', payMethod: 'cash' };
  const ctx = (assisted: boolean, number?: number) => ({ slotIds: slots, assisted, number });

  it('an independent polite request takes the capped yen off the drive-away total, shown by the next line and charged exactly', () => {
    const r = rig('motors_car', car);
    expect(r.game.hooks.vars(slots, {}).total?.gloss.en).toBe('198,000 yen');
    expect(r.game.hooks.intent!('haggle', ctx(false)).ok).toBe(true);
    // min(6% of the 148,000 body price, 8,880) off the 198,000 drive-away price
    expect(r.game.hooks.vars(slots, {}).total?.gloss.en).toBe('189,120 yen');
    expect(r.game.hooks.charge!(slots).ok).toBe(true);
    const bought = r.events.find((e) => e.t === 'purchase' && e.itemId === 'car_kei_used');
    expect(bought).toMatchObject({ haggle: 8880 });
    expect(r.state.wallet.cash).toBe(400_000 - 189_120);
    expect(r.state.owned.car_kei_used?.qty).toBe(1);
  });

  it('an assisted request gets 40% of the cap, a named price is granted up to the cap, and the attempt is one per conversation', () => {
    const a = rig('motors_car', car);
    expect(a.game.hooks.intent!('haggle', ctx(true)).ok).toBe(true);
    expect(a.game.hooks.vars(slots, {}).total?.gloss.en).toBe('194,448 yen');
    expect(a.game.hooks.intent!('haggle', ctx(false)).ok).toBe(false);
    expect(a.game.hooks.vars(slots, {}).total?.gloss.en).toBe('194,448 yen');

    const named = rig('motors_car', car);
    expect(named.game.hooks.intent!('haggle', ctx(false, 195_000)).ok).toBe(true);
    expect(named.game.hooks.vars(slots, {}).total?.gloss.en).toBe('195,000 yen');
    const greedy = rig('motors_car', car);
    expect(greedy.game.hooks.intent!('haggle', ctx(false, 150_000)).ok).toBe(true);
    expect(greedy.game.hooks.vars(slots, {}).total?.gloss.en).toBe('189,120 yen');
  });

  it('a second conversation the same day finds the haggle used, and a shop that does not negotiate refuses it', () => {
    const first = rig('motors_car', car);
    expect(first.game.hooks.intent!('haggle', ctx(false)).ok).toBe(true);
    first.game.hooks.charge!(slots);
    // the same item the same day: the quote takes no second haggle
    const again = rig('motors_car', () => first.state);
    expect(again.game.hooks.intent!('haggle', ctx(false)).ok).toBe(false);
    const konbini = rig('konbini');
    expect(konbini.game.hooks.intent!('haggle', { slotIds: { item: 'onigiri' }, assisted: false, number: 100 }).ok).toBe(false);
  });
});

describe('the haggle reaches the clerk\'s next line and its price chip', () => {
  it('after a granted haggle the line quotes the new total, in a real conversation', () => {
    const r = rig('motors_car', (s) => ({ ...s, chapter: { ...s.chapter, n: 9 }, wallet: { ...s.wallet, cash: 400_000 } }));
    r.session.start();
    const say = (i: number) => r.session.pickSuggestion(i);
    // look at the used car, ask the drive-away price, then the haggle chip
    const pick = (re: RegExp) => {
      const idx = r.session.suggestions().findIndex((x) => re.test(x.written.replace(/\s+/g, '')));
      expect(idx, `a chip for ${re}`).toBeGreaterThanOrEqual(0);
      return say(idx);
    };
    pick(/軽自動車.*見たい/);
    pick(/中古.*見たい/);
    pick(/いくら/);
    pick(/乗り出し価格/);
    expect(r.game.amounts().total).toBe(198_000);
    const turn = pick(/安く/);
    expect(turn.character.line.en).toContain('194,448');
    expect(r.game.amounts().total).toBe(194_448);
  });
});

describe('stock the player cannot buy yet is "not in stock", never a price that is not there (review: Release 1 shopping)', () => {
  const say = (r: ReturnType<typeof rig>, texts: string[]) => texts.map((text) => r.session.submit({ text, mode: 'typed_ja' }));
  const rich = (n: number, extra: Partial<GameState> = {}) => (s: GameState): GameState => ({ ...s, ...extra, chapter: { ...s.chapter, n }, wallet: { ...s.wallet, cash: 700_000 } });

  it('the session flags follow what the shop can sell now: pro/tv before Free Walk, ebike without the helmet, good car without the stars', () => {
    expect(rig('denki_phone', rich(4)).game.flags).toMatchObject({ pro_locked: true, tv_locked: true });
    const fw = rig('denki_phone', rich(9)).game.flags;
    expect(fw.pro_locked).toBeUndefined();
    expect(fw.tv_locked).toBeUndefined();
    const helmet = { bike_helmet: { qty: 1, day: 'd' } } as unknown as GameState['owned'];
    expect(rig('motors_bike', rich(9)).game.flags.ebike_locked).toBe(true);
    expect(rig('motors_bike', (s) => rich(9, { owned: helmet })(s)).game.flags.ebike_locked).toBeUndefined();
    expect(rig('motors_car', rich(9)).game.flags.good_locked).toBe(true);
    // owning an item does not make it "not in stock"
    expect(rig('denki_phone', (s) => rich(4, { owned: { phone_used: { qty: 1, day: 'd' } } as unknown as GameState['owned'] })(s)).game.flags.used_locked).toBeUndefined();
  });

  it('asking for the latest phone before Free Walk: Aoi says it is not in stock, a colour or "I will take it" gets the stock answer again (no bill, no name, no till), and nothing is charged', () => {
    const r = rig('denki_phone', rich(4));
    r.session.start();
    const out = say(r, ['スマホがほしいのですが', '最新スマホをください']);
    expect(out[1].character?.line.en).toBe('The latest phone is not in stock yet. How about the refurbished phone?');
    const colour = say(r, ['黒をお願いします'])[0];
    expect(colour.character?.line.en).toContain('not in stock yet');
    expect(colour.stepsDone).not.toContain('choose');
    // the TV the same way
    const tv = say(r, ['テレビをください', 'これをください'])[1];
    expect(tv.character?.line.en).toContain('not in stock yet');
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(0);
    expect(r.state.wallet.cash).toBe(700_000);
  });

  it('the till of a refused sale still ends honestly if a locked item is forced through to it', () => {
    const r = rig('denki_phone', rich(4));
    r.session.start();
    const out = say(r, ['スマホがほしいのですが', '中古スマホをください', '黒をお願いします', 'これをください', '現金でお願いします', 'サムです']);
    expect(out[5].character?.line.en).toBe('Is this all right?');
    // the learner changes their mind at the last node by naming the latest phone: it cannot be charged, and the line says why
    expect(r.game.hooks.charge({ denkiItem: 'pro', payMethod: 'cash' }).ok).toBe(false);
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(0);
    expect(r.game.flags.sold_out).toBe(true);
  });

  it('the dealer quotes the BODY price first (¥148,000), then the drive-away price on request: the trap of the car lesson has its number', () => {
    const r = rig('motors_car', rich(9));
    r.session.start();
    const out = say(r, ['軽自動車を見たいです', '中古の軽自動車を見たいです', '値段はいくらですか', '乗り出し価格はいくらですか']);
    expect(out[2].character?.line.en).toBe('The body price is 148,000 yen.');
    expect(r.game.amounts().body).toBe(148_000);
    expect(out[3].character?.line.en).toContain('198,000 yen');
  });

  it('the low-mileage car before it can be sold: every price question gets the offer line, never an empty price', () => {
    const r = rig('motors_car', rich(9));
    r.session.start();
    const out = say(r, ['軽自動車を見たいです', '低走行の軽自動車を見たいです', '値段はいくらですか', '乗り出し価格はいくらですか']);
    for (const t of out.slice(2)) expect(t.character?.line.en).toBe('The low-mileage kei car is not available yet. How about the used kei car?');
  });

  it('"I will take it" for the e-bike without the helmet is answered by the offer line, not by a registration form', () => {
    const r = rig('motors_bike', rich(9));
    r.session.start();
    const out = say(r, ['自転車がほしいです', '散歩に使います', '電動アシスト自転車をください', 'これをください']);
    expect(out[2].character?.line.en).toContain('needs a helmet');
    expect(out[3].character?.line.en).toContain('needs a helmet');
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(0);
  });

  it('a one-time item the player already owns ends at "You already have that one", not at "a little short", and is never charged twice', () => {
    const r = rig('denki_phone', rich(4, { owned: { phone_used: { qty: 1, day: 'd' } } as unknown as GameState['owned'] }));
    r.session.start();
    const out = say(r, ['スマホがほしいのですが', '中古スマホをください', '黒をお願いします', 'これをください', '現金でお願いします', 'サムです', 'はい']);
    expect(out[2].character?.line.en, 'the quote still names the price').not.toContain('…');
    expect(out[2].character?.line.en).toMatch(/yen in total/);
    expect(out[6].character?.line.en).toBe('You already have that one.');
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(0);
    expect(r.state.wallet.cash).toBe(700_000);
  });

  it('really being short of money is still "a little short" (the flags are reset at every charge)', () => {
    const r = rig('denki_phone', (s) => ({ ...rich(4)(s), wallet: { ...s.wallet, cash: 100 } }));
    r.session.start();
    const out = say(r, ['スマホがほしいのですが', '中古スマホをください', '黒をお願いします', 'これをください', '現金でお願いします', 'サムです', 'はい']);
    expect(out[6].character?.line.en).toBe('I am sorry, it is a little short.');
    expect(r.state.wallet.cash).toBe(100);
  });

  it('the power-assist bicycle without the helmet cannot be bought, with it the helmet comes first and then the e-bike is charged with its registration', () => {
    const r = rig('motors_bike', rich(9));
    expect(r.game.hooks.charge({ bikeModel: 'ebike', payMethod: 'cash' }).ok).toBe(false);
    expect(r.events).toHaveLength(0);
    expect(r.game.hooks.charge({ bikeModel: 'helmet', payMethod: 'cash' }).ok).toBe(true);
    const again = rig('motors_bike', () => r.state, { sessionId: 's_second' });
    expect(again.game.hooks.charge({ bikeModel: 'ebike', payMethod: 'cash' }).ok).toBe(true);
    expect(again.state.ledger.find((e) => e.id === 'purchase:s_second:1')?.delta).toBe(-89_600);
  });
});

describe('the haggle ceiling holds against whatever reaches the reducer (review: Release 1 shopping)', () => {
  const buy = (itemId: string, haggle: unknown) => {
    const s0 = createGameState(JP_PACK, NOW);
    const s = { ...s0, chapter: { ...s0.chapter, n: 9 }, wallet: { ...s0.wallet, cash: 900_000 }, owned: { bike_helmet: { qty: 1, day: 'd' } } } as unknown as GameState;
    const r = reduce(s, { t: 'purchase', sessionId: 'x', n: 1, shopId: 'motors', itemId, qty: 1, total: 1, method: 'cash', lines: [], haggle } as unknown as InputEvent, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    // the ledger line of the purchase itself (a daily goal may pay a few yen into the same wallet)
    return -(r.state.ledger.find((e) => e.id === 'purchase:x:1')?.delta ?? 0);
  };

  it('a car never loses more than min(6% of the body price, ¥8,880), for any number, and a bicycle never loses anything', () => {
    for (const h of [8880, 8881, 1e9, Infinity, NaN, -5, '9000', null]) {
      const paid = buy('car_kei_used', h);
      expect(198_000 - paid, String(h)).toBeLessThanOrEqual(8880);
      expect(paid).toBeLessThanOrEqual(198_000);
      expect(buy('bike_mamachari', h), String(h)).toBe(20_400);
      expect(buy('ebike', h), String(h)).toBe(89_600);
    }
    expect(buy('car_kei_used', 1e9)).toBe(189_120);
  });
});
