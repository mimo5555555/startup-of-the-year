// Nakamura Motors (agent 3D-lite, docs/GAME_DESIGN.md §6.3, §4.4 rule 3, §6.8): the three scenario graphs, slots, lexicon, phrasebook, pocket lines and
// ScenarioMeta. The conversations themselves are played in packages/engine/test/motors.test.ts.
import { describe, expect, it } from 'vitest';
import type { IntentDef, Line, Scenario } from '../src';
import { CHARACTERS, LEXICON, PHRASEBOOK, SLOTS, scenarioById, tokenize } from '../src';
import { SHOP_MOTORS_LEXICON } from '../src/lexicon/shop-motors';
import { SHOP_MOTORS_PHRASES } from '../src/phrasebook/shop-motors';
import { AIKO_MOTORS_META } from '../src/tokyo/game/meta/meta-aiko-motors';
import { AIKO_MOTORS_POCKETS } from '../src/tokyo/game/pockets/pockets-aiko-motors';
import { POCKETS } from '../src/tokyo/game/pockets';
import { SCENARIO_META } from '../src/tokyo/game/meta';
import { JP_RULES } from '../src/tokyo/game/economy';

const IDS = ['motors_visit', 'motors_bike', 'motors_car'] as const;
const scenarios = IDS.map((id) => scenarioById(id) as Scenario);
const metaOf = (id: string) => AIKO_MOTORS_META.find((m) => m.id === id)!;

const lines = (sc: Scenario): Array<{ line: Line; where: string }> => {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${sc.id}/${n.id}/say[${i}]` }));
    (n.suggestions ?? []).forEach((s, i) => out.push({ line: s, where: `${sc.id}/${n.id}/chip[${i}]` }));
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${sc.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${sc.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
};

describe('motors: scenarios', () => {
  it('are registered for Nakamura at the Motors place, with the steps of the design', () => {
    expect(scenarios.every(Boolean)).toBe(true);
    for (const sc of scenarios) {
      expect(sc.characterId).toBe('nakamura');
      expect(sc.locationId).toBe('motors');
      expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar, sc.id).toBeTruthy();
      for (const s of sc.steps) expect(s.text.en && s.text.ar, `${sc.id}/${s.id}`).toBeTruthy();
    }
    expect(scenarioById('motors_visit')!.level).toBe('A2');
    expect(scenarioById('motors_bike')!.level).toBe('A2');
    expect(scenarioById('motors_car')!.level).toBe('B1');
    expect(scenarioById('motors_visit')!.steps.map((s) => s.id)).toEqual(['greet', 'price', 'decline']);
    expect(scenarioById('motors_bike')!.steps.map((s) => s.id)).toEqual(['purpose', 'model', 'price', 'register', 'pay']);
    expect(scenarioById('motors_car')!.steps.map((s) => s.id)).toEqual(['look', 'ask_total', 'haggle', 'confirm', 'sign', 'pay']);
    const mine = CHARACTERS.find((c) => c.id === 'nakamura')!;
    expect(IDS as readonly string[]).toContain(mine.scenarioId);
  });

  it('have a valid graph: start exists, every node is reachable, no dead intent target, ends exist, shop ones reach short and leave', () => {
    for (const sc of scenarios) {
      expect(sc.nodes[sc.start], sc.id).toBeTruthy();
      const seen = new Set<string>([sc.start]);
      const queue = [sc.start];
      while (queue.length) {
        const n = sc.nodes[queue.shift()!];
        const next = [...n.intents.flatMap((i: IntentDef) => [i.next, i.nextIfNo]), n.onShort].filter(Boolean) as string[];
        for (const t of next) {
          expect(sc.nodes[t], `${sc.id}: ${n.id} -> ${t}`).toBeTruthy();
          if (!seen.has(t)) {
            seen.add(t);
            queue.push(t);
          }
        }
      }
      expect([...seen].sort(), sc.id).toEqual(Object.keys(sc.nodes).sort());
      expect(sc.nodes.leave.end, sc.id).toBe(true);
      if (sc.id !== 'motors_visit') {
        expect(sc.nodes.done.end).toBe(true);
        expect(sc.nodes.done.econ).toBe('charge');
        expect(sc.nodes.done.onShort).toBe('short');
        expect(sc.nodes.done.step).toBe('pay');
        expect(sc.nodes.short).toBeTruthy();
      }
    }
  });

  it('every goal step is set by a node or an intent', () => {
    for (const sc of scenarios) {
      const steps = new Set<string>();
      for (const n of Object.values(sc.nodes)) {
        if (n.step) steps.add(n.step);
        for (const i of n.intents) if (i.step) steps.add(i.step);
      }
      for (const s of sc.steps) expect(steps.has(s.id), `${sc.id}/${s.id}`).toBe(true);
    }
  });

  it('every non-end node has at least 2 suggestions; every request intent carries an ideal line', () => {
    for (const sc of scenarios)
      for (const n of Object.values(sc.nodes)) {
        if (!n.end) expect((n.suggestions ?? []).length, `${sc.id}/${n.id}`).toBeGreaterThanOrEqual(2);
        for (const i of n.intents) if (i.request) expect(i.ideal, `${sc.id}/${n.id}/${i.id}`).toBeTruthy();
      }
  });

  it('every line has Japanese, English and Arabic; the English has no contractions; placeholders match', () => {
    const errors: string[] = [];
    for (const sc of scenarios)
      for (const { line, where } of lines(sc)) {
        if (!line.ja || !line.en || !line.ar) errors.push(`${where}: missing language`);
        if (/\b\w+'(s|t|ll|re|ve|d|m)\b/.test(line.en)) errors.push(`${where}: contraction in "${line.en}"`);
        const ph = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join();
        if (ph(line.ja) !== ph(line.en) || ph(line.ja) !== ph(line.ar)) errors.push(`${where}: placeholders differ`);
      }
    expect(errors).toEqual([]);
  });

  it('every Japanese token resolves in the lexicon (a gloss for every word piece)', () => {
    const errors: string[] = [];
    for (const sc of scenarios)
      for (const { line, where } of lines(sc)) {
        const r = tokenize(line.ja.replace(/\{\w+\}/g, 'レイラ'), LEXICON);
        for (const m of r.missing) if (m !== 'レイラ') errors.push(`${where}: "${m}" is not in the lexicon`);
      }
    expect([...new Set(errors)]).toEqual([]);
  });

  it('never types a price into a live line: prices are Vars, fixed ones sit only in the no-hooks variants', () => {
    const errors: string[] = [];
    for (const sc of scenarios)
      for (const n of Object.values(sc.nodes)) {
        for (const v of n.say) {
          const fixed = /[千万]円|百円|五百/.test(v.line.ja.replace(/\|/g, ''));
          const live = v.when && 'flag' in v.when && v.when.flag === 'priced';
          if (fixed && live) errors.push(`${sc.id}/${n.id}: a fixed price in a live variant`);
        }
        for (const i of n.intents) if (i.reply && /[千万]円/.test(i.reply.ja)) errors.push(`${sc.id}/${n.id}/${i.id}: a price in a reply`);
        for (const s of n.suggestions ?? []) if (/[千万]円/.test(s.ja)) errors.push(`${sc.id}/${n.id}: a price in a chip`);
      }
    expect(errors).toEqual([]);
  });

  it('the stock flags, the twist and the live prices have variants', () => {
    const flags = new Set<string>();
    for (const sc of scenarios) for (const n of Object.values(sc.nodes)) for (const v of n.say) if (v.when && 'flag' in v.when) flags.add(v.when.flag);
    for (const f of ['ebike_locked', 'good_locked', 'twist', 'priced']) expect(flags.has(f), f).toBe(true);
  });
});

describe('motors: the one haggle of the game (§4.4 rule 3)', () => {
  const econOf = (sc: Scenario, kind: string) =>
    Object.values(sc.nodes).flatMap((n) => n.intents.filter((i) => i.econ === kind).map((i) => `${n.id}/${i.id}`));

  it('only motors_car has haggle intents, and every one has a refusal branch and sits on the drive-away quote', () => {
    expect(econOf(scenarioById('motors_visit')!, 'haggle')).toEqual([]);
    expect(econOf(scenarioById('motors_bike')!, 'haggle')).toEqual([]);
    const car = scenarioById('motors_car')!;
    const found = econOf(car, 'haggle');
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) expect(f.startsWith('total_quote/')).toBe(true);
    for (const n of Object.values(car.nodes))
      for (const i of n.intents.filter((x) => x.econ === 'haggle')) {
        expect(i.nextIfNo, `${n.id}/${i.id}`).toBeTruthy();
        expect(i.request && i.ideal).toBeTruthy();
      }
  });

  it('the bike scenario answers a request for a lower price with a fixed-price reply (定価), never a discount', () => {
    const bike = scenarioById('motors_bike')!;
    const dear = Object.values(bike.nodes).flatMap((n) => n.intents.filter((i) => i.id === 'too_dear'));
    expect(dear.length).toBeGreaterThan(0);
    for (const i of dear) expect(i.reply!.ja).toContain('定価');
  });

  it('the trap: the body price node has no way forward but asking for the drive-away price (or leaving)', () => {
    const body = scenarioById('motors_car')!.nodes.body_quote;
    const forward = body.intents.filter((i) => !i.stay && i.next !== 'leave' && i.next !== body.id).map((i) => `${i.id}->${i.next}`);
    expect(forward).toEqual(['ask_total->total_quote']);
    expect(body.intents.find((i) => i.id === 'buy_body')!.stay).toBe(true);
  });

  it('the learner says the total (say_total) with a retry branch, and signs before paying', () => {
    const car = scenarioById('motors_car')!;
    expect(car.nodes.confirm.intents.find((i) => i.econ === 'say_total')!.nextIfNo).toBe('wrong_total');
    expect(car.nodes.wrong_total.intents.find((i) => i.econ === 'say_total')!.nextIfNo).toBe('wrong_total');
    expect(car.nodes.sign.intents.find((i) => i.capture === 'name')!.next).toBe('pay');
  });
});

describe('motors: slots', () => {
  it('bikeModel, purpose and carModel exist once, with the item ids of the design and keys in all three languages', () => {
    expect(SLOTS.bikeModel.map((o) => o.id)).toEqual(['mamachari', 'helmet', 'ebike']);
    expect(SLOTS.carModel.map((o) => o.id)).toEqual(['used', 'good']);
    expect(SLOTS.purpose.map((o) => o.id)).toEqual(['school', 'shopping', 'ride']);
    for (const o of [...SLOTS.bikeModel, ...SLOTS.carModel, ...SLOTS.purpose]) {
      expect(o.keys.ja.length && o.keys.en.length && o.keys.ar.length, o.id).toBeTruthy();
      expect(o.gloss.en && o.gloss.ar, o.id).toBeTruthy();
      expect(LEXICON.get(o.ja), o.ja).toBeTruthy();
    }
  });

  it('every slot the scenarios name exists and its options are options of that slot', () => {
    for (const sc of scenarios)
      for (const n of Object.values(sc.nodes))
        for (const i of n.intents) {
          if (!i.slot) continue;
          const ids = (SLOTS[i.slot] ?? []).map((o) => o.id);
          expect(ids.length, `${sc.id}/${n.id}/${i.id}: slot ${i.slot}`).toBeGreaterThan(0);
          for (const o of i.slotOptions ?? []) expect(ids, `${sc.id}/${n.id}/${i.id}: ${o}`).toContain(o);
        }
  });

  it('the Motors payment slot offers no IC card (cash and card only)', () => {
    for (const sc of scenarios)
      for (const n of Object.values(sc.nodes)) for (const i of n.intents) if (i.slot === 'payMethod') expect(i.slotOptions).not.toContain('ic');
  });
});

describe('motors: lexicon and phrasebook', () => {
  it('has a kana reading for every kanji entry and the §15.10 words', () => {
    for (const e of SHOP_MOTORS_LEXICON) {
      if (/[一-鿿]/.test(e.s)) expect(e.r, e.s).toBeTruthy();
      expect(e.en && e.ar, e.s).toBeTruthy();
    }
    for (const word of ['自転車', 'ママチャリ', 'ヘルメット', '防犯登録', '住所', '通学', '散歩', '軽自動車', '本体価格', '乗り出し価格', '走行距離', '年式', '考えます'])
      expect(LEXICON.get(word), word).toBeTruthy();
  });

  it('the phrases are registered with unique ids and tokenize without unknown words', () => {
    const ids = new Set(PHRASEBOOK.map((p) => p.id));
    for (const p of SHOP_MOTORS_PHRASES) {
      expect(ids.has(p.id), p.id).toBe(true);
      expect(p.en.length && p.ar.length, p.id).toBeGreaterThan(0);
      expect(tokenize(p.ja, LEXICON).missing, p.id).toEqual([]);
    }
    expect(new Set(SHOP_MOTORS_PHRASES.map((p) => p.id)).size).toBe(SHOP_MOTORS_PHRASES.length);
    expect(PHRASEBOOK.filter((p) => SHOP_MOTORS_PHRASES.some((q) => q.id === p.id)).length).toBe(SHOP_MOTORS_PHRASES.length);
  });
});

describe('motors: ScenarioMeta and pockets', () => {
  it('has one row per scenario in the registry, with the item ids of docs/GAME_DESIGN.md §5.2 exactly', () => {
    for (const id of IDS) expect(SCENARIO_META.filter((m) => m.id === id), id).toHaveLength(1);
    const bike = metaOf('motors_bike');
    expect(bike.kind).toBe('shop');
    expect(bike.shop!.shopId).toBe('motors');
    expect(bike.shop!.itemSlot).toBe('bikeModel');
    expect(bike.shop!.payStep).toBe('pay');
    expect(bike.shop!.itemMap).toMatchObject({ mamachari: 'bike_mamachari', helmet: 'bike_helmet', ebike: 'ebike', carFresh: 'g_carfresh' });
    for (const o of SLOTS.bikeModel) expect(bike.shop!.itemMap[o.id], o.id).toBeTruthy();
    expect(bike.shop!.extraSlots).toEqual(['giftItem']);
    const car = metaOf('motors_car');
    expect(car.shop!.itemSlot).toBe('carModel');
    expect(car.shop!.itemMap).toEqual({ used: 'car_kei_used', good: 'car_kei_good' });
    for (const o of SLOTS.carModel) expect(car.shop!.itemMap[o.id], o.id).toBeTruthy();
    expect(car.register).toBe('keigo');
    expect(car.band).toBe('B1');
    expect(car.ageMin).toBe(18);
    expect(metaOf('motors_visit').shop).toBeUndefined();
    for (const m of AIKO_MOTORS_META) expect(m.pay).toBe('full');
  });

  it('the bicycle registration is a fee line of the bike row (the rules amount), none on the car', () => {
    expect(metaOf('motors_bike').shop!.fees).toEqual([expect.objectContaining({ id: 'registration', amount: JP_RULES.registrationFee })]);
    expect(metaOf('motors_car').shop!.fees).toBeUndefined();
  });

  it('every pay step and required intent exists in its scenario', () => {
    for (const m of AIKO_MOTORS_META) {
      const sc = scenarioById(m.id)!;
      if (m.shop) expect(sc.steps.some((s) => s.id === m.shop!.payStep)).toBe(true);
      for (const r of m.requiredIntents ?? []) {
        const [sid, iid] = r.split(':');
        expect(Object.values(scenarioById(sid)!.nodes).some((n) => n.intents.some((i) => i.id === iid)), r).toBe(true);
      }
    }
  });

  it('pocket lines p_motors_1..3 exist, are registered, have EN + AR, and at most 2 key lines per scenario', () => {
    const mine = Object.values(AIKO_MOTORS_POCKETS).filter((p) => p.id.startsWith('p_motors_'));
    expect(mine.map((p) => p.id).sort()).toEqual(['p_motors_1', 'p_motors_2', 'p_motors_3']);
    for (const p of mine) {
      expect(POCKETS[p.id], p.id).toBeTruthy();
      expect(p.line.en && p.line.ar, p.id).toBeTruthy();
      expect(tokenize(p.line.ja, LEXICON).missing, p.id).toEqual([]);
    }
    for (const m of AIKO_MOTORS_META) {
      for (const id of m.pocket ?? []) expect(POCKETS[id], `${m.id}/${id}`).toBeTruthy();
      expect((m.pocket ?? []).filter((id) => POCKETS[id].key).length, m.id).toBeLessThanOrEqual(2);
    }
  });
});
