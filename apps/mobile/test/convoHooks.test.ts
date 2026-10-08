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
function rig(scenarioId: string, patch: (s: GameState) => GameState = (s) => s, opts: { startNode?: string; view?: GameView } = {}) {
  let state = patch(createGameState(JP_PACK, NOW));
  const events: InputEvent[] = [];
  const view = opts.view ?? VIEW;
  const game = createConvoGame({
    pack: JP_PACK,
    scenarioId,
    sessionId: 's_test',
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
    sessionId: 's_test',
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
        const r = rig(meta.id);
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
    // the catalog (3E) prices the gift; until it does the basket is unpriced rather than wrong
    expect(later.game.amounts().total).toBeUndefined();
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
      const r = rig(meta.id, (s) => ({ ...s, wallet: { ...s.wallet, cash: 5000 } }));
      tapThrough(r.session);
      expect(r.session.stepsDone.has(meta.shop!.payStep), meta.id).toBe(true);
      expect(r.game.purchases.length).toBeGreaterThan(0);
    });
    it(`${meta.id}: without money the conversation ends and nothing is bought`, () => {
      const r = rig(meta.id, (s) => ({ ...s, wallet: { ...s.wallet, cash: 0 } }));
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
