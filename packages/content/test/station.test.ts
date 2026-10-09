// The station part of the game pack (agent 2G, docs/GAME_DESIGN.md §5.4, §6.3, §6.5): fares, the IC card, the machines' shops, the two
// scenarios' wiring and the lexicon words of §15.10. The conversations themselves are played in engine/test/station.test.ts.
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  createGameState,
  fareFor,
  reduce,
  refundPlan,
  topUpPlan,
  validatePack,
  walletLimits,
  type ContentIndex,
  type FriendDef,
  type GamePack,
  type GameState,
  type GameView,
} from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, SCENARIOS, SLOTS, scenarioById } from '../src';
import { FARES, STATION_SHOPS } from '../src/tokyo/game/fares';
import { ITEMS } from '../src/tokyo/game/items';
import { STATION_META } from '../src/tokyo/game/meta/meta-station';

/** The pack as it stands when the machines' shops are in `shops` (3E spreads STATION_SHOPS into SHOPS; until then this adds them). */
const pack: GamePack = { ...JP_PACK, shops: [...JP_PACK.shops, ...STATION_SHOPS.filter((s) => !JP_PACK.shops.some((x) => x.id === s.id))] };
const view: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '' },
};
const fresh = (over: (s: GameState) => GameState = (s) => s): GameState => over(createGameState(pack, 0));
const run = (s: GameState, ev: Parameters<typeof reduce>[1]) => reduce(s, ev, { pack, now: 1000, view, rng: () => 0.5 }).state;

describe('fares (§5.4)', () => {
  it('are the table of the design, from Sakura-chō station, in whole yen', () => {
    expect(FARES).toEqual({ shibuya: 170, shinjuku: 190, tokyoStation: 210, akihabara: 210, ueno: 230, asakusa: 260, airport: 520, hikarigaoka: 170 });
    expect(JP_PACK.fares).toBe(FARES);
    for (const [place, fare] of Object.entries(FARES)) expect(Number.isInteger(fare) && fare >= 1, place).toBe(true);
  });

  it('every destination is an option of the place slot, and the slot keeps its names (Haneda for the airport, Hikarigaoka new)', () => {
    const options = new Map(SLOTS.place.map((o) => [o.id, o]));
    for (const place of Object.keys(FARES)) expect(options.has(place), place).toBe(true);
    expect(options.get('airport')!.ja).toBe('羽田空港');
    expect(options.get('airport')!.gloss.en).toBe('Haneda Airport');
    expect(options.get('airport')!.keys.ja).toContain('空港');
    expect(options.get('hikarigaoka')!.ja).toBe('光が丘');
    expect(options.get('hikarigaoka')!.gloss.en).toBe('Hikarigaoka');
    expect(LEXICON.get('光が丘')!.r).toBe('ひかりがおか');
  });

  it('a paper ticket costs BALANCE.fares.paperExtra (¥10) more than the IC fare, everywhere', () => {
    expect(BALANCE.fares.paperExtra).toBe(10);
    const s = fresh();
    for (const [place, fare] of Object.entries(FARES)) {
      expect(fareFor(pack, s, place, 'ic'), place).toBe(fare);
      expect(fareFor(pack, s, place, 'cash'), place).toBe(fare);
      expect(fareFor(pack, s, place, 'paper'), place).toBe(fare + 10);
    }
  });

  it('an unknown place has no fare', () => {
    expect(fareFor(pack, fresh(), 'narnia', 'ic')).toBe(0);
  });

  it("Sato's friend perk (hearts 4) takes 10% off, rounded, never below the floor", () => {
    const sato: FriendDef = {
      id: 'sato',
      tier: 'A',
      register: 'polite',
      casualAt: 99,
      unlockChapter: 1,
      loves: [],
      likes: [],
      dislikes: [],
      facts: ['a', 'b', 'c'],
      perks: [{ id: 'perk_sato_fare', heart: 4, text: { en: 'fares -10%', ar: 'الأجرة -10%' }, fx: { t: 'shop_pct', shopId: 'station', pct: 0.1 } }],
    };
    const withPerk = { ...pack, friends: [sato] };
    const hearts = (ap: number) => fresh((s) => ({ ...s, friends: { sato: { ...(s.friends.sato ?? ({} as never)), ap } as never } }));
    expect(fareFor(withPerk, hearts(0), 'shibuya', 'ic')).toBe(170);
    expect(fareFor(withPerk, hearts(BALANCE.ap.thresholds[3]), 'shibuya', 'ic')).toBe(153);
    expect(fareFor(withPerk, hearts(BALANCE.ap.thresholds[3]), 'shibuya', 'paper')).toBe(162);
    expect(fareFor(withPerk, hearts(BALANCE.ap.thresholds[3]), 'airport', 'ic')).toBe(468);
    for (const fare of Object.values(FARES)) expect(Math.round(fare * 0.9)).toBeGreaterThanOrEqual(BALANCE.fares.perkFloor);
  });

  it('a trip charges both ways up front: 2 × the fare (§5.4), from the pocket the player names', () => {
    expect(BALANCE.fares.tripLegs).toBe(2);
    const s = run(fresh(), { t: 'fare', id: 'trip1', place: 'hikarigaoka', method: 'paper', legs: 2 });
    expect(s.wallet.cash).toBe(3000 - 2 * 180);
    // the same event again is the same trip: nothing more is taken
    expect(run(s, { t: 'fare', id: 'trip1', place: 'hikarigaoka', method: 'paper', legs: 2 }).wallet.cash).toBe(s.wallet.cash);
  });

  it('a one-way fare is taken once, a place without a fare takes nothing, and the wallet never goes negative', () => {
    expect(run(fresh(), { t: 'fare', id: 'f1', place: 'ueno', method: 'paper' }).wallet.cash).toBe(3000 - 240);
    expect(run(fresh(), { t: 'fare', id: 'f2', place: 'narnia', method: 'paper' }).wallet.cash).toBe(3000);
    const poor = fresh((s) => ({ ...s, wallet: { ...s.wallet, cash: 100 } }));
    expect(run(poor, { t: 'fare', id: 'f3', place: 'airport', method: 'paper' }).wallet.cash).toBe(100);
  });
});

describe('the IC card (§4.1, §5.4)', () => {
  const card = ITEMS.find((i) => i.id === 'ic_card')!;

  it('is the station item of Chapter 1: ¥500 deposit, single ownership, switches the ic feature on', () => {
    expect(card).toBeTruthy();
    expect(card.price).toBe(500);
    expect(card.shop).toBe('station');
    expect(card.gate.ch).toBe(1);
    expect(card.once).toBe(true);
    expect(card.fx).toContainEqual({ t: 'feature', id: 'ic' });
    expect(card.name.ja).toBe('ICカード');
    expect(card.name.en && card.name.ar).toBeTruthy();
  });

  it('is sold at the counter in cash: the card pocket is cash, and the purchase gives the feature', () => {
    const buy = (s: GameState) => run(s, { t: 'purchase', sessionId: 'c1', n: 1, shopId: 'station', itemId: 'ic_card', qty: 1, total: 500, method: 'cash', lines: [] });
    const s = buy(fresh());
    expect(s.wallet.cash).toBe(2500);
    expect(s.owned.ic_card?.qty).toBe(1);
    // single ownership: a second purchase is refused and takes nothing
    expect(run(s, { t: 'purchase', sessionId: 'c2', n: 1, shopId: 'station', itemId: 'ic_card', qty: 1, total: 500, method: 'cash', lines: [] }).wallet.cash).toBe(2500);
  });

  it('is loaded in steps of ¥1,000; the cap is ¥3,000 until Chapter 5 and ¥20,000 after; a top-up is a transfer, not spending', () => {
    expect(walletLimits(fresh(), pack).ic).toBe(3000);
    expect(walletLimits(fresh((s) => ({ ...s, chapter: { ...s.chapter, n: BALANCE.icCap.lateFrom } })), pack).ic).toBe(20000);
    expect(topUpPlan(fresh(), pack, 3000)).toEqual({ ok: true, amount: 3000 });
    expect(topUpPlan(fresh(), pack, 3001)).toEqual({ ok: false, reason: 'capped' });
    const s = run(fresh(), { t: 'topup', id: 't1', amount: 2000 });
    expect(s.wallet).toMatchObject({ cash: 1000, ic: 2000 });
    expect(s.totals.spent).toBe(0);
    expect(s.totals.earned).toBe(0);
    expect(SLOTS.chargeAmount.map((o) => Number(o.id))).toEqual([1000, 2000, 3000, 5000]);
  });

  it('is refunded to cash less ¥220 (needs a balance above the fee); the card stays yours', () => {
    expect(BALANCE.icRefundFee).toBe(220);
    const loaded = fresh((s) => ({ ...s, wallet: { ...s.wallet, cash: 1000, ic: 1500 }, owned: { ic_card: { qty: 1, day: 'd0' } } }));
    expect(refundPlan(loaded, pack)).toEqual({ ok: true, balance: 1500, fee: 220, net: 1280 });
    const s = run(loaded, { t: 'refund', id: 'r1' });
    expect(s.wallet).toMatchObject({ cash: 2280, ic: 0 });
    expect(s.owned.ic_card?.qty).toBe(1);
    const tiny = fresh((x) => ({ ...x, wallet: { ...x.wallet, ic: 220 } }));
    expect(refundPlan(tiny, pack)).toMatchObject({ ok: false });
    expect(run(tiny, { t: 'refund', id: 'r2' }).wallet.ic).toBe(220);
  });
});

describe('the shops of the counter and the vending machines', () => {
  it('station is a world shop that takes cash and sells the card; vending is a panel shop that takes cash or IC and sells the four drinks', () => {
    const station = STATION_SHOPS.find((s) => s.id === 'station')!;
    const vending = STATION_SHOPS.find((s) => s.id === 'vending')!;
    expect(station).toMatchObject({ surface: 'world', pay: ['cash'], sells: ['ic_card'], openChapter: 1 });
    expect(vending).toMatchObject({ surface: 'panel', pay: ['cash', 'ic'], openChapter: 1 });
    expect(vending.points).toBeUndefined();
    expect(vending.sells.sort()).toEqual(JP_PACK.menu.filter((m) => m.shop === 'vending').map((m) => m.option).sort());
  });

  it('every vending drink is a sale the machine can make with the shop in the pack, cash or card, at its list price', () => {
    for (const m of JP_PACK.menu.filter((x) => x.shop === 'vending')) {
      for (const method of ['cash', 'ic'] as const) {
        const s = fresh((x) => ({ ...x, wallet: { ...x.wallet, ic: 1000 } }));
        const after = run(s, { t: 'purchase', sessionId: `v-${m.option}`, n: 1, shopId: 'vending', itemId: m.id, qty: 1, total: m.price, method, lines: [] });
        const pocket = method === 'ic' ? 'ic' : 'cash';
        expect(after.wallet[pocket], `${m.id} ${method}`).toBe(s.wallet[pocket] - m.price);
      }
    }
  });
});

describe('ScenarioMeta of station_ic and sato_directions (§6.3)', () => {
  const ic = STATION_META.find((m) => m.id === 'station_ic')!;
  const dir = STATION_META.find((m) => m.id === 'sato_directions')!;

  it('has one row each, registered in the pack', () => {
    expect(STATION_META.map((m) => m.id)).toEqual(['station_ic', 'sato_directions']);
    for (const m of STATION_META) expect(JP_PACK.scenarioMeta.includes(m), m.id).toBe(true);
    expect(ic).toMatchObject({ kind: 'shop', band: 'A1', pay: 'full', place: 'station', culture: ['cc_ic'] });
    expect(dir).toMatchObject({ kind: 'talk', pay: 'full', place: 'station' });
  });

  it('station_ic sells the card through `fixedItem`, loads it with the chargeAmount slot and pays at the step `pay`', () => {
    const sc = scenarioById('station_ic')!;
    expect(ic.shop).toMatchObject({ shopId: 'station', itemSlot: 'chargeAmount', fixedItem: 'ic_card', payStep: 'pay' });
    expect(sc.steps.map((s) => s.id)).toEqual(['want', 'amount', 'pay']);
    const charge = Object.values(sc.nodes).filter((n) => n.econ === 'charge');
    // the purchase node and the refund node: only the purchase completes a goal step
    expect(charge.map((n) => n.id).sort()).toEqual(['done', 'refund_done']);
    expect(charge.find((n) => n.id === 'done')).toMatchObject({ step: 'pay', end: true, onShort: 'short' });
    expect(charge.find((n) => n.id === 'refund_done')!.step).toBeUndefined();
    expect(sc.nodes.leave.step).toBeUndefined();
    expect(sc.nodes.leave.econ).toBeUndefined();
  });

  it('pocket lines are named p_<scenario>_<n>, three each', () => {
    for (const m of STATION_META) {
      expect(m.pocket!.length).toBe(3);
      m.pocket!.forEach((id, i) => expect(id).toBe(`p_${m.id}_${i + 1}`));
    }
  });

  it('sato_directions has the three steps of the design and the spot and direction slots', () => {
    const sc = scenarioById('sato_directions')!;
    expect(sc.steps.map((s) => s.id)).toEqual(['ask', 'repeat', 'thanks']);
    expect(sc.characterId).toBe('sato');
    expect(CHARACTERS.find((c) => c.id === 'sato')).toBeTruthy();
    expect(SLOTS.stationSpot.map((o) => o.id)).toEqual(['exit', 'toilet', 'platform', 'gate', 'ticketMachine']);
  });

  it('both are Sato\'s, registered, and neither stands in the way of the info scenario `station`', () => {
    for (const id of ['station', 'station_ic', 'sato_directions']) expect(scenarioById(id)?.characterId, id).toBe('sato');
    // (his small talk, smalltalk_sato, is the heart engine and is not a station scenario)
    expect(SCENARIOS.filter((s) => s.characterId === 'sato' && !s.id.startsWith('smalltalk_')).length).toBe(3);
  });

  it('game-pack validation finds nothing wrong with the card, the shops and these two rows', () => {
    const index: ContentIndex = {
      scenarios: Object.fromEntries(
        SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: Object.values(s.nodes).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }]),
      ),
      lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
      slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
      characters: CHARACTERS.map((c) => c.id),
    };
    const mine = validatePack(pack, { level: 5, index }).filter((i) => /ic_card|station_ic|sato_directions|"station"|\bvending\b/.test(`${i.message} ${i.path}`));
    // a pocket line another agent has not authored yet is theirs to report, not this part's
    const pending = (i: { code: string }) => i.code === 'meta_pocket';
    expect(mine.filter((i) => !pending(i)).map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });
});

describe('the station lexicon (§15.10)', () => {
  it('has every word of the list, with a reading where it has kanji and both glosses', () => {
    const words = ['チャージ', '払い戻し', '残高', '入金', '改札', '券売機', '乗り換え', '右', '左', 'まっすぐ', '曲がる', '近い', '遠い', '次の電車', '時刻表'];
    for (const w of words) {
      const e = LEXICON.get(w);
      expect(e, w).toBeTruthy();
      expect(e!.en.trim() && e!.ar.trim(), w).toBeTruthy();
      if (/[一-龥]/.test(w)) expect(e!.r, w).toBeTruthy();
    }
  });
});
