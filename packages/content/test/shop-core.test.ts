// The price refit of cafe, konbini, ramen and station (agent 2D, docs/GAME_DESIGN.md §6.6, §6.8): menu prices, ScenarioMeta wiring,
// price discipline in the lines, the short / leave branch and the shop slots. Playing the scenarios with game hooks is in
// packages/engine/test/session.test.ts.
import { describe, expect, it } from 'vitest';
import { validatePack, type ContentIndex, type MenuItem } from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, SCENARIOS, SLOTS, scenarioById, type Scenario } from '../src';
import { CORE_META } from '../src/tokyo/game/meta/meta-core';
import { MENU } from '../src/tokyo/game/menu';

const SHOPS = ['cafe', 'konbini', 'ramen'] as const;
const meta = (id: string) => CORE_META.find((m) => m.id === id)!;
const optionIds = (slot: string) => (SLOTS[slot] ?? []).map((o) => o.id);
const menuOf = (shop: string) => MENU.filter((m) => m.shop === shop);
const allNodes = (sc: Scenario) => Object.values(sc.nodes);

describe('menu (docs/GAME_DESIGN.md §5.1)', () => {
  const price = (shop: string) => Object.fromEntries(menuOf(shop).map((m) => [m.option, m.price]));

  it('prices are the §5.1 table', () => {
    expect(price('konbini')).toEqual({ onigiri: 160, water: 110, sandwich: 320, bento: 580, juice: 160, milk: 150, greenTea: 160, cake: 330, coffee: 130 });
    expect(price('cafe')).toEqual({ coffee: 450, blackTea: 420, greenTea: 400, latte: 520, juice: 480, cake: 480 });
    expect(price('ramen')).toEqual({ shoyu: 900, miso: 950, tonkotsu: 1050, ajitama: 150, oomori: 100, kaedama: 120, gyoza: 380 });
    expect(price('vending')).toEqual({ v_tea: 150, v_coffee: 150, v_water: 130, v_juice: 150 });
  });

  it('every row is a well-formed MenuItem: id = shop:option, whole yen, a known tax class, names in all languages', () => {
    const errors: string[] = [];
    for (const m of MENU) {
      if (m.id !== `${m.shop}:${m.option}`) errors.push(`${m.id}: id must be shop:option`);
      if (!Number.isInteger(m.price) || m.price < 1) errors.push(`${m.id}: price`);
      if (!(m.taxClass in JP_PACK.tax.rates)) errors.push(`${m.id}: tax class ${m.taxClass}`);
      if (!m.name.ja || !m.name.en || !m.name.ar) errors.push(`${m.id}: name`);
      if (!m.tags.length) errors.push(`${m.id}: no tags`);
    }
    expect(errors).toEqual([]);
    expect(new Set(MENU.map((m) => m.id)).size).toBe(MENU.length);
  });

  it('the option of a conversation slot is an option the scenarios offer (the EXISTING item / flavor ids)', () => {
    const errors: string[] = [];
    for (const m of MENU) {
      if (m.shop === 'vending') continue; // panel only: no conversation slot
      if (!optionIds(m.slot).includes(m.option)) errors.push(`${m.id}: slot ${m.slot} has no option ${m.option}`);
    }
    expect(errors).toEqual([]);
  });

  it('take-out food is the reduced class and only the café and the konbini add the eat-in surcharge', () => {
    for (const m of [...menuOf('konbini'), ...menuOf('cafe'), ...menuOf('vending')]) expect(m.taxClass, m.id).toBe('food');
    for (const m of menuOf('ramen')) expect(m.taxClass, m.id).toBe('standard');
    const eatIn = (m: MenuItem) => m.eatInCapable === true;
    expect(menuOf('konbini').every(eatIn) && menuOf('cafe').every(eatIn)).toBe(true);
    expect([...menuOf('ramen'), ...menuOf('vending')].some(eatIn)).toBe(false);
  });

  it('vending drinks are not gifts (a panel purchase is not a conversation, §5.3)', () => {
    expect(menuOf('vending').some((m) => m.giftable)).toBe(false);
  });
});

describe('ScenarioMeta of the five existing scenarios', () => {
  it('has one row for each, with the kind, band and pay the spec asks for', () => {
    expect(CORE_META.map((m) => m.id).sort()).toEqual(['cafe', 'konbini', 'park', 'ramen', 'station']);
    for (const id of SHOPS) expect(meta(id).kind, id).toBe('shop');
    expect(meta('station').kind).toBe('talk');
    expect(meta('station').shop).toBeUndefined();
    for (const m of CORE_META) {
      expect(m.pay, m.id).toBe('full');
      expect(scenarioById(m.id), m.id).toBeTruthy();
    }
  });

  it('pocket lines are 3 or 4 per scenario, p_<scenario>_<n>', () => {
    for (const m of CORE_META) {
      expect(m.pocket!.length, m.id).toBeGreaterThanOrEqual(3);
      expect(m.pocket!.length, m.id).toBeLessThanOrEqual(4);
      m.pocket!.forEach((id, i) => expect(id, m.id).toBe(`p_${m.id}_${i + 1}`));
    }
  });

  for (const id of SHOPS) {
    describe(id, () => {
      const m = meta(id);
      const sc = scenarioById(id)!;
      const shop = m.shop!;

      it('pays at a goal step that exists, and the charge node completes it', () => {
        expect(sc.steps.map((s) => s.id)).toContain(shop.payStep);
        const charge = allNodes(sc).filter((n) => n.econ === 'charge');
        expect(charge).toHaveLength(1);
        expect(charge[0].step).toBe(shop.payStep);
        expect(charge[0].end).toBe(true);
      });

      it('the itemMap names an option of the item slot or of an extra slot, and a menu or gift id', () => {
        const slots = [shop.itemSlot!, ...(shop.extraSlots ?? [])];
        const menu = new Set(MENU.map((x) => x.id));
        for (const [option, target] of Object.entries(shop.itemMap)) {
          expect(slots.some((s) => optionIds(s).includes(option)), `${id}/${option}`).toBe(true);
          expect(menu.has(target) || /^g_/.test(target), `${id}/${target}`).toBe(true);
          if (menu.has(target)) expect(target.startsWith(`${shop.shopId}:`), target).toBe(true);
        }
      });

      it('every menu id of the shop has a sale route (§5.6)', () => {
        const routed = new Set(Object.values(shop.itemMap));
        for (const x of menuOf(shop.shopId)) expect(routed.has(x.id), x.id).toBe(true);
      });

      it('everything the scenario lets the learner pick is for sale', () => {
        const slots = new Set([shop.itemSlot!, ...(shop.extraSlots ?? [])]);
        const errors: string[] = [];
        for (const n of allNodes(sc)) {
          for (const it of n.intents) {
            if (!it.slot || !slots.has(it.slot)) continue;
            for (const o of it.slotOptions ?? optionIds(it.slot)) if (!(o in shop.itemMap)) errors.push(`${n.id}/${it.id}: ${o} is offered but not sold`);
          }
        }
        expect(errors).toEqual([]);
      });
    });
  }

  it('the konbini sells its nine foods, three presents and takes a count', () => {
    const shop = meta('konbini').shop!;
    expect(Object.keys(shop.itemMap)).toHaveLength(9 + 3);
    expect(shop.extraSlots).toEqual(['giftItem']);
    expect(shop.qtySlot).toBe('qty');
    expect(shop.itemMap.choco).toBe('g_choco');
    expect(shop.itemMap.manga).toBe('g_manga');
    expect(shop.itemMap.gameCard).toBe('g_game_card');
  });

  it('the ramen shop prices the bowl (flavor) plus extras, and has a ticket entry node', () => {
    const m = meta('ramen');
    expect(m.shop!.itemSlot).toBe('flavor');
    expect(m.shop!.extraSlots).toEqual(['ramenExtra']);
    expect(m.startNode).toBe('start_ticket');
    expect(scenarioById('ramen')!.nodes.start_ticket).toBeTruthy();
    // the ticket route takes no money: no charge node is reachable from it
    const sc = scenarioById('ramen')!;
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const it of sc.nodes[id].intents) if (it.next) walk(it.next);
    };
    walk('start_ticket');
    expect([...seen].filter((id) => sc.nodes[id].econ === 'charge')).toEqual([]);
  });

  it('requiredIntents are intents of the scenario (c2_4: いただきます, ごちそうさま)', () => {
    expect(meta('ramen').requiredIntents).toEqual(['ramen:itadakimasu', 'ramen:gochisosama']);
    for (const m of CORE_META) {
      for (const r of m.requiredIntents ?? []) {
        const [sid, intent] = r.split(':');
        const ids = allNodes(scenarioById(sid)!).flatMap((n) => n.intents.map((i) => i.id));
        expect(ids, r).toContain(intent);
      }
    }
  });

  it('the twist flag is declared exactly for the scenarios that author a twist variant', () => {
    for (const sc of SCENARIOS.filter((s) => CORE_META.some((m) => m.id === s.id))) {
      const hasTwist = allNodes(sc).some((n) => n.say.some((v) => v.when && 'flag' in v.when && v.when.flag === 'twist'));
      expect(meta(sc.id).twist === true, sc.id).toBe(hasTwist);
    }
  });

  it('game-pack validation finds nothing wrong in this part (what is left belongs to shops, items and friends: 3E, 4A)', () => {
    const index: ContentIndex = {
      scenarios: Object.fromEntries(
        SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: allNodes(s).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }]),
      ),
      lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
      slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
      characters: CHARACTERS.map((c) => c.id),
    };
    const mine = validatePack(JP_PACK, { level: 5, index }).filter((i) => /^(menu\[|scenarioMeta\[[0-4]\])/.test(i.path));
    // not yet defined by their owners; each disappears when the owner lands
    const pending = (i: { code: string; message: string }) =>
      ['item_shop', 'meta_shop', 'no_sale_route', 'meta_friend', 'not_sold'].includes(i.code) || (i.code === 'itemmap_unknown' && /"g_/.test(i.message));
    expect(mine.filter((i) => !pending(i)).map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
    // the vending drinks are a panel's: only an unknown shop (3E) may be reported for them
    expect(mine.filter((i) => i.code === 'no_sale_route').every((i) => i.message.includes('vending:'))).toBe(true);
  });
});

describe('price discipline in the refitted scenarios (§6.8 rule 8)', () => {
  const PRICE_VAR = /\{(price|total|fare)\}/;
  const hasYen = (ja: string) => ja.includes('円');

  for (const id of ['cafe', 'konbini', 'ramen', 'station']) {
    const sc = scenarioById(id)!;

    it(`${id}: a line with a price variable is the "priced" variant, and its fixed-price twin is the last variant of the same node`, () => {
      const errors: string[] = [];
      for (const n of allNodes(sc)) {
        n.say.forEach((v, i) => {
          if (!PRICE_VAR.test(v.line.ja)) return;
          const w = v.when;
          if (!w || !('flag' in w) || w.flag !== 'priced') errors.push(`${n.id}/say[${i}]: a price variable outside the priced variant`);
          if (n.say.length < 2 || !hasYen(n.say[n.say.length - 1].line.ja)) errors.push(`${n.id}: no fixed-price line for a session without hooks`);
        });
      }
      expect(errors).toEqual([]);
    });

    it(`${id}: a price written in yen appears only as the fallback of a priced line, never in a chip, a reply or an ideal`, () => {
      const errors: string[] = [];
      for (const n of allNodes(sc)) {
        n.say.forEach((v, i) => {
          if (!hasYen(v.line.ja)) return;
          const pricedBefore = n.say.slice(0, i).some((p) => p.when && 'flag' in p.when && p.when.flag === 'priced');
          if (!pricedBefore || i !== n.say.length - 1) errors.push(`${n.id}/say[${i}]: ${v.line.ja}`);
        });
        for (const s of [...(n.suggestions ?? []), ...Object.values(n.suggestionsByL1 ?? {}).flat()]) if (hasYen(s.ja)) errors.push(`${n.id}: chip ${s.ja}`);
        for (const it of n.intents) {
          if (it.reply && hasYen(it.reply.ja)) errors.push(`${n.id}/${it.id}: reply`);
          if (it.ideal && hasYen(it.ideal.ja)) errors.push(`${n.id}/${it.id}: ideal`);
        }
      }
      expect(errors).toEqual([]);
    });
  }

  it('the old fixed-price words stay in the lexicon (§6.6.1: harmless)', () => {
    for (const w of ['四百五十円', '三百二十円', '百九十円', '九百円']) expect(LEXICON.has(w), w).toBe(true);
  });
});

describe('short and leave (§6.2, §4.4 rule 6)', () => {
  for (const id of SHOPS) {
    const sc = scenarioById(id)!;
    const charge = allNodes(sc).find((n) => n.econ === 'charge')!;

    it(`${id}: the charge node falls back to a short node that is not the end, and a polite leave follows`, () => {
      expect(charge.onShort).toBeTruthy();
      const short = sc.nodes[charge.onShort!];
      expect(short.end).toBeFalsy();
      expect(short.suggestions!.length).toBeGreaterThanOrEqual(2);
      const out = short.intents.find((i) => i.next === 'leave');
      expect(out, 'a way out of short').toBeTruthy();
      const leave = sc.nodes.leave;
      expect(leave.end).toBe(true);
      // leaving earns no goal step: it must not complete `pay` (§6.2: `complete` needs `pay`)
      expect(leave.step).toBeUndefined();
      expect(leave.econ).toBeUndefined();
    });

    it(`${id}: the short node's first chip is the polite refusal (taught, cc_refuse)`, () => {
      const short = sc.nodes[charge.onShort!];
      expect(short.suggestions![0].ja.replace(/\|/g, '')).toBe('また来ます。');
    });
  }

  it('the station has no money in it: no charge node', () => {
    expect(allNodes(scenarioById('station')!).some((n) => n.econ)).toBe(false);
  });
});

describe('shop slots (slots/shop.ts)', () => {
  it('payMethod: cash, card, ic, each with keys in all three scripts', () => {
    expect(optionIds('payMethod')).toEqual(['cash', 'card', 'ic']);
  });
  it('qty: one, two, three (at most three of a thing, §4.4 rule 4)', () => {
    expect(optionIds('qty')).toEqual(['one', 'two', 'three']);
  });
  it('chargeAmount ids are the amounts themselves, in 1,000 yen steps (§5.4)', () => {
    expect(optionIds('chargeAmount')).toEqual(['1000', '2000', '3000', '5000']);
  });
  it('giftItem holds every present of §5.6 and ramenExtra the four extras of §5.1', () => {
    expect(optionIds('giftItem')).toEqual(expect.arrayContaining(['choco', 'manga', 'gameCard', 'musicCd', 'plush', 'guitarPick', 'flower', 'wagashi', 'teaSet', 'tenugui', 'lantern', 'carFresh', 'souvenir']));
    expect(optionIds('ramenExtra')).toEqual(['ajitama', 'oomori', 'kaedama', 'gyoza']);
    expect(optionIds('firmness')).toEqual(['katame', 'futsu', 'yawarakame']);
  });
});
