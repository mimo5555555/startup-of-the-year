// fuku_clothes (agent A2, docs/GAME_DESIGN.md §6.3, §6.8): the scenario graph, its slots, lexicon, phrasebook, pocket lines and
// ScenarioMeta. The conversation itself is played in packages/engine/test/fuku.test.ts.
import { describe, expect, it } from 'vitest';
import type { IntentDef, Line, Scenario } from '../src';
import { CHARACTERS, LEXICON, PHRASEBOOK, SLOTS, scenarioById, tokenize } from '../src';
import { SHOP_FUKU_LEXICON } from '../src/lexicon/shop-fuku';
import { SHOP_FUKU_PHRASES } from '../src/phrasebook/shop-fuku';
import { DENKI_FUKU_META } from '../src/tokyo/game/meta/meta-denki-fuku';
import { DENKI_FUKU_POCKETS } from '../src/tokyo/game/pockets/pockets-denki-fuku';
import { POCKETS } from '../src/tokyo/game/pockets';
import { SCENARIO_META } from '../src/tokyo/game/meta';
import { FUKU_PRICES } from '../src/tokyo/scenarios-fuku';

const sc = scenarioById('fuku_clothes') as Scenario;
const meta = DENKI_FUKU_META.find((m) => m.id === 'fuku_clothes')!;
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

describe('fuku_clothes: scenario', () => {
  it('is registered for Rin at Fuku-Fuku with the six steps of the design', () => {
    expect(sc).toBeTruthy();
    expect(sc.characterId).toBe('rin');
    expect(sc.locationId).toBe('fukufuku');
    expect(['A1', 'A2']).toContain(sc.level);
    expect(sc.steps.map((s) => s.id)).toEqual(['look', 'size', 'colour', 'try', 'fit', 'pay']);
    expect(CHARACTERS.find((c) => c.id === 'rin')!.scenarioId).toBe('fuku_clothes');
    expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar).toBeTruthy();
    for (const s of sc.steps) expect(s.text.en && s.text.ar).toBeTruthy();
  });

  it('has a valid graph: start exists, every node is reachable, no dead intent target, ends exist', () => {
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

  it('has the fitting-room node, the compliment node and the goods node', () => {
    expect(sc.nodes.fitting).toBeTruthy();
    expect(sc.nodes.suits.say[0].line.ja.replace(/\|/g, '')).toContain('似合います');
    expect(sc.nodes.goods).toBeTruthy();
    // the fit answers: just right goes on to the compliment, big and small go to another size and back into the fitting room
    const byId = Object.fromEntries(sc.nodes.fitting.intents.map((i) => [i.id, i]));
    expect(byId.fit_ok.next).toBe('suits');
    expect(byId.fit_big.next).toBe('resize');
    expect(byId.fit_small.next).toBe('resize');
    expect(sc.nodes.resize.intents.find((i) => i.id === 'size_pick')!.next).toBe('fitting');
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
      const piece = line.ja.replace(/\{\w+\}/g, '');
      const r = tokenize(piece, LEXICON);
      for (const m of r.missing) errors.push(`${where}: "${m}" is not in the lexicon`);
      for (const t of r.tokens) if (!t.punct && !t.raw && !t.gloss) errors.push(`${where}: "${t.s}" has no gloss`);
    }
    expect([...new Set(errors)]).toEqual([]);
  });

  it('never types a price into a live line: prices are Vars, the fixed ones sit only in the no-hooks variants', () => {
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

  it('the fixed fallback prices cover every item and equal the catalog rows of the design', () => {
    expect(FUKU_PRICES).toEqual({ tee: 1990, cap: 2490, hoodie: 4990, jeans: 5990, sneakers: 7990, jacket: 12900, glasses: 9900, backpack: 6900, suit: 19800, plush: 800, guitarPick: 300 });
    for (const o of SLOTS.clothes) expect(FUKU_PRICES[o.id], o.id).toBeGreaterThan(0);
    for (const id of ['plush', 'guitarPick']) expect(FUKU_PRICES[id]).toBeGreaterThan(0);
    // one fixed variant per item at the quote
    const quote = sc.nodes.quote.say.filter((v) => v.when && 'slot' in v.when);
    expect(quote).toHaveLength(SLOTS.clothes.length);
    // the fixed text spells the price: 12,900 yen is 一万二千九百円
    const jacket = quote.find((v) => v.when && 'slot' in v.when && v.when.in.includes('jacket'))!;
    expect(jacket.line.ja.replace(/\|/g, '')).toContain('一万二千九百円');
    expect(jacket.line.en).toContain('12,900 yen');
    const tee = quote.find((v) => v.when && 'slot' in v.when && v.when.in.includes('tee'))!;
    expect(tee.line.ja.replace(/\|/g, '')).toContain('千九百九十円');
  });

  it('never names a variable that may be unfilled ({size}, {clothesColour} only in ideal lines of the intents that fill them)', () => {
    for (const n of Object.values(sc.nodes)) {
      for (const v of n.say) expect(v.line.ja, n.id).not.toMatch(/\{(size|clothesColour|fit)\}/);
      for (const s of n.suggestions ?? []) expect(s.ja, n.id).not.toMatch(/\{(size|clothesColour|fit)\}/);
    }
  });

  it('the twist and the live-price flags have variants', () => {
    const flags = new Set<string>();
    for (const n of Object.values(sc.nodes)) for (const v of n.say) if (v.when && 'flag' in v.when) flags.add(v.when.flag);
    for (const f of ['twist', 'priced', 'owned_already', 'sold_out']) expect(flags.has(f), f).toBe(true);
  });
});

describe('fuku_clothes: slots', () => {
  it('clothes, size, clothesColour and fit exist once, in this module, with keys in all three languages', () => {
    expect(SLOTS.clothes.map((o) => o.id)).toEqual(['tee', 'hoodie', 'jeans', 'sneakers', 'cap', 'jacket', 'glasses', 'backpack', 'suit']);
    expect(SLOTS.size.map((o) => o.id)).toEqual(['s', 'm', 'l']);
    expect(SLOTS.clothesColour.map((o) => o.id)).toEqual(['black', 'white', 'red', 'blue', 'green', 'yellow']);
    expect(SLOTS.fit.map((o) => o.id)).toEqual(['just', 'big', 'small']);
    for (const o of [...SLOTS.clothes, ...SLOTS.size, ...SLOTS.clothesColour, ...SLOTS.fit]) {
      expect(o.keys.ja.length && o.keys.en.length && o.keys.ar.length, o.id).toBeTruthy();
      expect(o.gloss.en && o.gloss.ar, o.id).toBeTruthy();
      expect(LEXICON.get(o.ja), o.ja).toBeTruthy();
    }
  });

  it('the Denki colour slot is untouched (the clothes colour has its own name)', () => {
    expect(SLOTS.colour.map((o) => o.id)).toEqual(['black', 'white', 'blue', 'red']);
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

  it('the payment slot offers no IC card at Fuku-Fuku (cash and card only)', () => {
    for (const n of Object.values(sc.nodes))
      for (const i of n.intents) if (i.slot === 'payMethod') expect(i.slotOptions).not.toContain('ic');
  });
});

describe('fuku_clothes: lexicon and phrasebook', () => {
  it('has a kana reading for every kanji entry and the §15.10 words', () => {
    for (const e of SHOP_FUKU_LEXICON) {
      if (/[一-鿿]/.test(e.s)) expect(e.r, e.s).toBeTruthy();
      expect(e.en && e.ar, e.s).toBeTruthy();
    }
    for (const word of ['服', '帽子', 'メガネ', 'サイズ', '試着', '大きい', '小さい', 'ちょうどいい', 'Tシャツ', 'パーカー', 'ジーンズ', 'スニーカー', 'リュック', 'スーツ', 'ぬいぐるみ', 'ギターピック'])
      expect(LEXICON.get(word), word).toBeTruthy();
    expect(LEXICON.get('似合います')).toBeTruthy();
  });

  it('the phrases are registered with unique ids and tokenize without unknown words', () => {
    const ids = PHRASEBOOK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SHOP_FUKU_PHRASES) {
      expect(ids.includes(p.id), p.id).toBe(true);
      expect(p.en.length && p.ar.length, p.id).toBeGreaterThan(0);
      const r = tokenize(p.ja.replace('{name}', 'レイラ'), LEXICON);
      expect(r.missing, p.id).toEqual([]);
      expect(r.tokens.filter((t) => !t.punct && !t.raw && !t.gloss)).toEqual([]);
    }
  });
});

describe('fuku_clothes: ScenarioMeta and pockets', () => {
  it('is wired as a polite shop with full pay, the Fuku-Fuku shop and the item ids of the catalog', () => {
    expect(SCENARIO_META.filter((m) => m.id === 'fuku_clothes')).toHaveLength(1);
    expect(meta.kind).toBe('shop');
    expect(meta.register).toBe('polite');
    expect(meta.pay).toBe('full');
    expect(meta.place).toBe('fukufuku');
    expect(meta.shop!.shopId).toBe('fukufuku');
    expect(meta.shop!.itemSlot).toBe('clothes');
    expect(meta.shop!.extraSlots).toEqual(['giftItem']);
    expect(meta.shop!.payStep).toBe('pay');
    expect(meta.shop!.itemMap).toEqual({
      tee: 'tee_basic',
      cap: 'cap',
      hoodie: 'hoodie',
      jeans: 'jeans',
      sneakers: 'sneakers',
      jacket: 'jacket_winter',
      glasses: 'glasses_round',
      backpack: 'backpack',
      suit: 'suit_set',
      plush: 'g_plush',
      guitarPick: 'g_guitar_pick',
    });
    for (const o of SLOTS.clothes) expect(meta.shop!.itemMap[o.id], o.id).toBeTruthy();
    for (const id of ['plush', 'guitarPick']) expect(SLOTS.giftItem.map((o) => o.id)).toContain(id);
    expect(sc.steps.some((s) => s.id === meta.shop!.payStep)).toBe(true);
    expect(meta.twist).toBe(true);
    // no furniture and no yukata in the clothes conversation (the furniture is fuku_home, wave B2)
    expect(Object.keys(meta.shop!.itemMap)).not.toContain('yukata');
    expect(Object.keys(meta.shop!.itemMap)).not.toContain('kotatsu');
    expect(SCENARIO_META.some((m) => m.id === 'fuku_home')).toBe(true);
  });

  it('pocket lines p_fuku_1.. exist, are registered, have at most 2 key lines and EN + AR', () => {
    const mine = Object.values(DENKI_FUKU_POCKETS).filter((p) => p.id.startsWith('p_fuku_'));
    expect(meta.pocket!.length).toBeGreaterThanOrEqual(3);
    expect(mine.map((p) => p.id).sort()).toEqual([...meta.pocket!].sort());
    for (const id of meta.pocket!) {
      expect(POCKETS[id], id).toBeTruthy();
      expect(POCKETS[id].line.en && POCKETS[id].line.ar, id).toBeTruthy();
    }
    expect(mine.filter((p) => p.key).length).toBeLessThanOrEqual(2);
  });
});
