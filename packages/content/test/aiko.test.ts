// aiko_tea (agent A5, docs/GAME_DESIGN.md §6.3, §5.3, §8.5): the scenario graph, its slots, lexicon, phrasebook, pocket lines, ScenarioMeta, the
// four presents, the shop and the friends' tastes. The conversation itself is played in packages/engine/test/aiko.test.ts.
import { describe, expect, it } from 'vitest';
import { applyGift, BALANCE, emptyFriend, giftAp, giftCap, giftInfo, grantItem, heartsForAp, ownedQty, reactionFor } from '@lw/game';
import type { GameState } from '@lw/game';
import { ctxOf, makeState } from '../../game/test/fixtures-1e';
import type { IntentDef, Line, Scenario } from '../src';
import { CHARACTERS, JP_PACK, LEXICON, PHRASEBOOK, SLOTS, scenarioById, tokenize } from '../src';
import { SHOP_AIKO_LEXICON } from '../src/lexicon/shop-aiko';
import { SHOP_AIKO_PHRASES } from '../src/phrasebook/shop-aiko';
import { AIKO_MOTORS_META } from '../src/tokyo/game/meta/meta-aiko-motors';
import { AIKO_MOTORS_POCKETS } from '../src/tokyo/game/pockets/pockets-aiko-motors';
import { POCKETS } from '../src/tokyo/game/pockets';
import { SCENARIO_META } from '../src/tokyo/game/meta';
import { TASTES } from '../src/tokyo/game/gifts';
import { AIKO_PRICES, AIKO_RECOMMENDS } from '../src/tokyo/scenarios-aiko';

const sc = scenarioById('aiko_tea') as Scenario;
const meta = AIKO_MOTORS_META.find((m) => m.id === 'aiko_tea')!;
const AIKO_ITEMS = { flower: 'g_flower', wagashi: 'g_wagashi', teaSet: 'g_tea_set', tenugui: 'g_tenugui' };
const lines = (): Array<{ line: Line; where: string }> => {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${n.id}/say[${i}]` }));
    (n.suggestions ?? []).forEach((s, i) => out.push({ line: s, where: `${n.id}/chip[${i}]` }));
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${n.id}/${it.id}/ideal` });
    }
  }
  return out;
};

describe('aiko_tea: scenario', () => {
  it('is registered for Aiko at the tea house with the five steps of the design', () => {
    expect(sc).toBeTruthy();
    expect(sc.characterId).toBe('aiko');
    expect(sc.locationId).toBe('ono');
    expect(['A1', 'A2']).toContain(sc.level);
    expect(sc.steps.map((s) => s.id)).toEqual(['greet', 'pick', 'who', 'wrap', 'pay']);
    expect(CHARACTERS.find((c) => c.id === 'aiko')!.scenarioId).toBe('aiko_tea');
    expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar).toBeTruthy();
    for (const s of sc.steps) expect(s.text.en && s.text.ar).toBeTruthy();
    // the flat is not in this wave
    expect(scenarioById('aiko_viewing')).toBeUndefined();
    expect(scenarioById('aiko_contract')).toBeUndefined();
  });

  it('has a valid graph: start exists, every node is reachable, no dead intent target, ends exist, short and leave', () => {
    expect(sc.nodes[sc.start]).toBeTruthy();
    const seen = new Set<string>([sc.start]);
    const queue = [sc.start];
    while (queue.length) {
      const n = sc.nodes[queue.shift()!];
      const next = [...n.intents.flatMap((i: IntentDef) => [i.next, i.nextIfNo]), n.onShort].filter(Boolean) as string[];
      for (const t of next) {
        expect(sc.nodes[t], `${n.id} -> ${t}`).toBeTruthy();
        if (!seen.has(t)) {
          seen.add(t);
          queue.push(t);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(sc.nodes).sort());
    for (const id of ['done', 'leave']) expect(sc.nodes[id].end).toBe(true);
    expect(sc.nodes.done.econ).toBe('charge');
    expect(sc.nodes.done.onShort).toBe('short');
    expect(sc.nodes.done.step).toBe('pay');
    expect(sc.nodes.short).toBeTruthy();
  });

  it('every goal step is set by a node or an intent', () => {
    const steps = new Set<string>();
    for (const n of Object.values(sc.nodes)) {
      if (n.step) steps.add(n.step);
      for (const i of n.intents) if (i.step) steps.add(i.step);
    }
    for (const s of sc.steps) expect(steps.has(s.id), s.id).toBe(true);
  });

  it('every non-end node has at least 2 suggestions; every request intent carries an ideal line', () => {
    for (const n of Object.values(sc.nodes)) {
      if (!n.end) expect((n.suggestions ?? []).length, n.id).toBeGreaterThanOrEqual(2);
      for (const i of n.intents) if (i.request) expect(i.ideal, `${n.id}/${i.id}`).toBeTruthy();
    }
  });

  it('every line has Japanese, English and Arabic; the English has no contractions; the placeholders agree', () => {
    const errors: string[] = [];
    for (const { line, where } of lines()) {
      if (!line.ja || !line.en || !line.ar) errors.push(`${where}: missing language`);
      if (/\b\w+'(s|t|ll|re|ve|d|m)\b/.test(line.en) && !/^\w+'s\b/.test(line.en)) errors.push(`${where}: contraction in "${line.en}"`);
      const ph = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join();
      if (ph(line.ja) !== ph(line.en) || ph(line.ja) !== ph(line.ar)) errors.push(`${where}: placeholders differ`);
    }
    expect(errors).toEqual([]);
  });

  it('every Japanese token resolves in the lexicon (a gloss for every word piece)', () => {
    const errors: string[] = [];
    for (const { line, where } of lines()) {
      const r = tokenize(line.ja.replace(/\{\w+\}/g, ''), LEXICON);
      for (const m of r.missing) errors.push(`${where}: "${m}" is not in the lexicon`);
      for (const t of r.tokens) if (!t.punct && !t.raw && !t.gloss) errors.push(`${where}: "${t.s}" has no gloss`);
    }
    expect([...new Set(errors)]).toEqual([]);
  });

  it('never types a price into a live line: prices are Vars, the fixed ones sit only in the per-present no-hooks variants', () => {
    const errors: string[] = [];
    for (const n of Object.values(sc.nodes)) {
      for (const v of n.say) {
        const fixed = /円/.test(v.line.ja.replace(/\|/g, ''));
        const live = v.when && 'flag' in v.when && v.when.flag === 'priced';
        if (fixed && live) errors.push(`${n.id}: a fixed price in a live variant`);
        if (fixed && !(v.when && 'slot' in v.when)) errors.push(`${n.id}: a fixed price outside a per-item fallback`);
      }
      for (const i of n.intents) if (i.reply && /円/.test(i.reply.ja)) errors.push(`${n.id}/${i.id}: a price in a reply`);
      for (const s of n.suggestions ?? []) if (/円/.test(s.ja)) errors.push(`${n.id}: a price in a chip`);
    }
    expect(errors).toEqual([]);
  });

  it('the fixed fallback prices equal the catalog rows and are spelled right', () => {
    expect(AIKO_PRICES).toEqual({ flower: 1500, wagashi: 1280, teaSet: 1500, tenugui: 1100 });
    for (const [slotId, itemId] of Object.entries(AIKO_ITEMS)) expect(AIKO_PRICES[slotId], slotId).toBe(JP_PACK.items.find((i) => i.id === itemId)!.price);
    const quote = sc.nodes.quote.say.filter((v) => v.when && 'slot' in v.when);
    expect(quote).toHaveLength(4);
    const wagashi = quote.find((v) => v.when && 'slot' in v.when && v.when.in.includes('wagashi'))!;
    expect(wagashi.line.ja.replace(/\|/g, '')).toContain('千二百八十円');
    expect(wagashi.line.en).toContain('1,280 yen');
  });

  it('the twist, live-price and refused-sale flags have variants; wrapping is free in the line', () => {
    const flags = new Set<string>();
    for (const n of Object.values(sc.nodes)) for (const v of n.say) if (v.when && 'flag' in v.when) flags.add(v.when.flag);
    for (const f of ['twist', 'priced', 'owned_already', 'sold_out']) expect(flags.has(f), f).toBe(true);
    for (const v of sc.nodes.wrap.say) expect(v.line.ja.replace(/\|/g, '')).toContain('無料');
  });

  it('Aiko recommends a present the friend LOVES (the taste table), once per friend, at the advice node', () => {
    const rec = sc.nodes.advise.say.filter((v) => v.when && 'slot' in v.when);
    expect(rec.map((v) => (v.when as { in: string[] }).in[0]).sort()).toEqual(Object.keys(AIKO_RECOMMENDS).sort());
    for (const [friend, slotOpt] of Object.entries(AIKO_RECOMMENDS)) {
      const itemId = AIKO_ITEMS[slotOpt as keyof typeof AIKO_ITEMS];
      expect(TASTES[friend].loves, `${friend} loves ${itemId}`).toContain(itemId);
      expect(reactionFor(JP_PACK, friend, itemId), friend).toBe('loved');
    }
  });
});

describe('aiko_tea: slots', () => {
  it('giftFriend and wrapColour exist once, in this module, with keys in all three languages', () => {
    expect(SLOTS.giftFriend.map((o) => o.id)).toEqual(['mio', 'yuki', 'tanaka', 'sato', 'kenji', 'hanako', 'me']);
    expect(SLOTS.wrapColour.map((o) => o.id)).toEqual(['red', 'blue', 'white', 'pink']);
    for (const o of [...SLOTS.giftFriend, ...SLOTS.wrapColour]) {
      expect(o.keys.ja.length && o.keys.en.length && o.keys.ar.length, o.id).toBeTruthy();
      expect(o.gloss.en && o.gloss.ar, o.id).toBeTruthy();
      expect(LEXICON.get(o.ja), o.ja).toBeTruthy();
    }
    // the other modules' colour slots are untouched
    expect(SLOTS.colour.map((o) => o.id)).toEqual(['black', 'white', 'blue', 'red']);
    expect(SLOTS.clothesColour).toHaveLength(6);
  });

  it('the four presents are options of the shared giftItem slot', () => {
    for (const id of Object.keys(AIKO_ITEMS)) expect(SLOTS.giftItem.map((o) => o.id), id).toContain(id);
  });

  it('every slot the scenario names exists and its options are options of that slot', () => {
    for (const n of Object.values(sc.nodes))
      for (const i of n.intents) {
        if (!i.slot) continue;
        const ids = (SLOTS[i.slot] ?? []).map((o) => o.id);
        expect(ids.length, `${n.id}/${i.id}: slot ${i.slot}`).toBeGreaterThan(0);
        for (const o of i.slotOptions ?? []) expect(ids, `${n.id}/${i.id}: ${o}`).toContain(o);
      }
    for (const n of Object.values(sc.nodes)) for (const v of n.say) if (v.when && 'slot' in v.when) for (const o of v.when.in) expect((SLOTS[v.when.slot] ?? []).map((x) => x.id), `${n.id}: ${o}`).toContain(o);
  });

  it('the stall takes cash: the quote offers no card and no IC card as a way to pay', () => {
    for (const i of sc.nodes.quote.intents) if (i.slot === 'payMethod' && i.next) expect(i.slotOptions).toEqual(['cash']);
  });
});

describe('aiko_tea: lexicon and phrasebook', () => {
  it('has a kana reading for every kanji entry and the words of the design', () => {
    for (const e of SHOP_AIKO_LEXICON) {
      if (/[一-鿿]/.test(e.s)) expect(e.r, e.s).toBeTruthy();
      expect(e.en && e.ar, e.s).toBeTruthy();
    }
    for (const word of ['お花', '和菓子', 'お茶セット', '手ぬぐい', 'ラッピング', '無料', 'リボン', 'どなた', 'おすすめ']) expect(LEXICON.get(word), word).toBeTruthy();
  });

  it('the phrases are registered with unique ids and tokenize without unknown words', () => {
    const ids = PHRASEBOOK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SHOP_AIKO_PHRASES) {
      expect(ids.includes(p.id), p.id).toBe(true);
      expect(p.en.length && p.ar.length, p.id).toBeGreaterThan(0);
      const r = tokenize(p.ja, LEXICON);
      expect(r.missing, p.id).toEqual([]);
      expect(r.tokens.filter((t) => !t.punct && !t.raw && !t.gloss)).toEqual([]);
    }
  });
});

describe('aiko_tea: ScenarioMeta, pockets, items, shop', () => {
  it('is wired as a polite shop at Ono Tea House with the catalog item ids; the lantern fund is not sold', () => {
    expect(SCENARIO_META.filter((m) => m.id === 'aiko_tea')).toHaveLength(1);
    expect(meta).toMatchObject({ kind: 'shop', register: 'polite', pay: 'full', place: 'ono', twist: true });
    expect(meta.shop).toMatchObject({ shopId: 'aiko', itemSlot: 'giftItem', payStep: 'pay' });
    expect(meta.shop!.itemMap).toEqual(AIKO_ITEMS);
    expect(Object.keys(meta.shop!.itemMap)).not.toContain('lantern');
    expect(sc.steps.some((s) => s.id === meta.shop!.payStep)).toBe(true);
  });

  it('pocket lines p_aiko_1.. exist, are registered, have at most 2 key lines and EN + AR', () => {
    const mine = Object.values(AIKO_MOTORS_POCKETS).filter((p) => p.id.startsWith('p_aiko_'));
    expect(mine.map((p) => p.id).sort()).toEqual([...meta.pocket!].sort());
    for (const id of meta.pocket!) {
      expect(POCKETS[id], id).toBeTruthy();
      expect(POCKETS[id].line.en && POCKETS[id].line.ar, id).toBeTruthy();
    }
    expect(mine.filter((p) => p.key).length).toBeLessThanOrEqual(2);
  });

  it('the four presents are catalog gifts of the aiko shop with the §5.3 prices, tags and a gift effect', () => {
    const want: Record<string, [number, string[]]> = { g_flower: [1500, ['flower', 'nature']], g_wagashi: [1280, ['sweet', 'tradition']], g_tea_set: [1500, ['tea', 'tradition']], g_tenugui: [1100, ['craft', 'tradition']] };
    for (const [id, [price, tags]] of Object.entries(want)) {
      const it = JP_PACK.items.find((i) => i.id === id)!;
      expect(it, id).toBeTruthy();
      expect([it.price, it.shop, it.cat, it.gate.ch, it.tags]).toEqual([price, 'aiko', 'gift', 2, tags]);
      expect(it.fx).toEqual([{ t: 'gift', tags }]);
    }
  });

  it('the shop opens with Chapter 2, takes cash, sells exactly the four presents; Chapter 2 opens it', () => {
    const shop = JP_PACK.shops.find((s) => s.id === 'aiko')!;
    expect(shop).toMatchObject({ placeId: 'ono', openChapter: 2, surface: 'world', register: 'polite', pay: ['cash'] });
    expect(shop.sells.sort()).toEqual(['g_flower', 'g_tea_set', 'g_tenugui', 'g_wagashi']);
    expect(JP_PACK.chapters.find((c) => c.n === 2)!.opens).toContainEqual({ kind: 'shop', id: 'aiko' });
  });

  it('the Aiko row of the interaction table is the tea house from Chapter 2; the flat rows wait for their scenarios', () => {
    const rows = JP_PACK.interactions.aiko;
    expect(rows[0]).toMatchObject({ id: 'aiko_shop', kind: 'scenario', scenarioId: 'aiko_tea', ch: 2 });
    for (const id of ['aiko_viewing', 'aiko_contract']) expect(scenarioById(rows.find((r) => r.id === id)!.scenarioId!), id).toBeUndefined();
  });
});

describe('aiko_tea: friends and gifts', () => {
  const six = ['mio', 'yuki', 'tanaka', 'sato', 'kenji', 'hanako'];

  it('every friend loves at least one present sold at Aiko, and no item is both loved and disliked', () => {
    for (const f of six) {
      const loved = Object.values(AIKO_ITEMS).filter((id) => reactionFor(JP_PACK, f, id) === 'loved');
      expect(loved.length, `${f} loves nothing at Aiko's`).toBeGreaterThan(0);
      for (const x of TASTES[f].loves) expect(TASTES[f].dislikes, `${f} ${x}`).not.toContain(x);
    }
    expect(reactionFor(JP_PACK, 'kenji', 'g_flower')).toBe('disliked');
  });

  it('gift AP caps and the one-gift-a-day rule still hold with the new items (the real pack)', () => {
    const ctx = ctxOf(JP_PACK);
    const ids = Object.values(AIKO_ITEMS);
    const setup = (friend: string, ap: number, item: string, stock = 1): GameState => {
      const s = makeState(10);
      return grantItem({ ...s, friends: { [friend]: { ...emptyFriend(10), met: true, ap, talkDay: 10 } } }, JP_PACK, item, stock, 'd1');
    };
    const give = (s: GameState, friend: string, item: string) => applyGift(s, { t: 'gift_given', friendId: friend, itemId: item, sessionId: 'g1', assistedHandover: false }, ctx);
    for (const item of ids) {
      expect(giftInfo(JP_PACK, item)?.giftable, item).toBe(true);
      for (const friend of six) {
        for (const heart of [0, 1, 2, 3, 4]) {
          const ap = heart === 0 ? 0 : BALANCE.ap.thresholds[heart - 1]!;
          const state = setup(friend, ap, item);
          const want = giftAp(JP_PACK, state, friend, item, false);
          // never above the cap of the heart, and a dislike is 0
          expect(want, `${friend} ${item} h${heart}`).toBeLessThanOrEqual(giftCap(heartsForAp(ap)));
          if (reactionFor(JP_PACK, friend, item) === 'disliked') expect(want).toBe(0);
          const r = give(state, friend, item);
          expect(r.ap, `${friend} ${item} h${heart}`).toBe(want);
        }
      }
    }
    // one gift a day: the second present to the same friend the same day changes nothing and keeps the item
    const s0 = setup('mio', 0, 'g_wagashi', 2);
    const first = give(s0, 'mio', 'g_wagashi');
    expect(first.ap).toBeGreaterThan(0);
    expect(ownedQty(first.state, 'g_wagashi')).toBe(1);
    const second = give(first.state, 'mio', 'g_wagashi');
    expect(second.ap).toBe(0);
    expect(second.state).toBe(first.state);
    expect(giftAp(JP_PACK, first.state, 'mio', 'g_wagashi', false)).toBe(0);
    // tiers by price: the 1,500-yen tea set never gives less than the 1,100-yen tenugui to the same friend
    const ap = (item: string) => giftAp(JP_PACK, setup('hanako', 1000, item), 'hanako', item, false);
    expect(ap('g_tea_set')).toBeGreaterThanOrEqual(ap('g_tenugui'));
  });
});
