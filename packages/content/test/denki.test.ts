// denki_phone (agent 3C-lite, docs/GAME_DESIGN.md §6.3, §6.7, §6.8): the scenario graph, its slots, lexicon, phrasebook, pocket lines and
// ScenarioMeta. The conversation itself is played in packages/engine/test/denki.test.ts.
import { describe, expect, it } from 'vitest';
import type { IntentDef, Line, Scenario } from '../src';
import { CHARACTERS, LEXICON, PHRASEBOOK, SLOTS, scenarioById, tokenize } from '../src';
import { SHOP_DENKI_LEXICON } from '../src/lexicon/shop-denki';
import { SHOP_DENKI_PHRASES } from '../src/phrasebook/shop-denki';
import { DENKI_FUKU_META } from '../src/tokyo/game/meta/meta-denki-fuku';
import { DENKI_FUKU_POCKETS } from '../src/tokyo/game/pockets/pockets-denki-fuku';
import { POCKETS } from '../src/tokyo/game/pockets';
import { SCENARIO_META } from '../src/tokyo/game/meta';

const sc = scenarioById('denki_phone') as Scenario;
const meta = DENKI_FUKU_META.find((m) => m.id === 'denki_phone')!;
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

describe('denki_phone: scenario', () => {
  it('is registered for Aoi at Hikari Denki, A2, with the five steps of the design', () => {
    expect(sc).toBeTruthy();
    expect(sc.characterId).toBe('aoi');
    expect(sc.locationId).toBe('denki');
    expect(sc.level).toBe('A2');
    expect(sc.steps.map((s) => s.id)).toEqual(['want', 'choose', 'price', 'name', 'pay']);
    expect(CHARACTERS.find((c) => c.id === 'aoi')!.scenarioId).toBe('denki_phone');
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

  it('every line has Japanese, English and Arabic; the English has no contractions', () => {
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
      const piece = line.ja.replace(/\{\w+\}/g, 'レイラ');
      for (const t of tokenize(piece, LEXICON).tokens) if (!t.punct && !t.raw && !t.gloss) errors.push(`${where}: "${t.s}" has no gloss`);
    }
    expect([...new Set(errors)]).toEqual([]);
  });

  it('never types a price into a live line: prices are Vars, the fixed ones sit only in the no-hooks variants', () => {
    const errors: string[] = [];
    for (const n of Object.values(sc.nodes)) {
      for (const v of n.say) {
        const fixed = /[千万]円|百円/.test(v.line.ja.replace(/\|/g, ''));
        const live = v.when && 'flag' in v.when && v.when.flag === 'priced';
        if (fixed && live) errors.push(`${n.id}: a fixed price in a live variant`);
      }
      for (const i of n.intents) if (i.reply && /[千万]円/.test(i.reply.ja)) errors.push(`${n.id}/${i.id}: a price in a reply`);
      for (const s of n.suggestions ?? []) if (/[千万]円/.test(s.ja)) errors.push(`${n.id}: a price in a chip`);
    }
    expect(errors).toEqual([]);
  });

  it('the stock flags and the twist have variants (pro_locked, tv_locked, twist)', () => {
    const flags = new Set<string>();
    for (const n of Object.values(sc.nodes)) for (const v of n.say) if (v.when && 'flag' in v.when) flags.add(v.when.flag);
    for (const f of ['pro_locked', 'tv_locked', 'twist', 'priced']) expect(flags.has(f), f).toBe(true);
  });
});

describe('denki_phone: slots', () => {
  it('denkiItem and colour exist once, in this module, with keys in all three languages', () => {
    expect(SLOTS.denkiItem.map((o) => o.id)).toEqual(['used', 'pro', 'case', 'tv']);
    expect(SLOTS.colour.map((o) => o.id)).toEqual(['black', 'white', 'blue', 'red']);
    for (const o of [...SLOTS.denkiItem, ...SLOTS.colour]) {
      expect(o.keys.ja.length && o.keys.en.length && o.keys.ar.length, o.id).toBeTruthy();
      expect(o.gloss.en && o.gloss.ar, o.id).toBeTruthy();
      expect(LEXICON.get(o.ja), o.ja).toBeTruthy();
    }
  });

  it('every slot the scenario names exists and its options are options of that slot', () => {
    for (const n of Object.values(sc.nodes))
      for (const i of n.intents) {
        if (!i.slot) continue;
        const ids = (SLOTS[i.slot] ?? []).map((o) => o.id);
        expect(ids.length, `${n.id}/${i.id}: slot ${i.slot}`).toBeGreaterThan(0);
        for (const o of i.slotOptions ?? []) expect(ids, `${n.id}/${i.id}: ${o}`).toContain(o);
      }
  });

  it('the payment slot offers no IC card at the Denki (cash and card only)', () => {
    for (const n of Object.values(sc.nodes))
      for (const i of n.intents) if (i.slot === 'payMethod') expect(i.slotOptions).not.toContain('ic');
  });
});

describe('denki_phone: lexicon and phrasebook', () => {
  it('has a kana reading for every kanji entry and the §15.10 words', () => {
    for (const e of SHOP_DENKI_LEXICON) {
      if (/[一-鿿]/.test(e.s)) expect(e.r, e.s).toBeTruthy();
      expect(e.en && e.ar, e.s).toBeTruthy();
    }
    for (const word of ['中古', '最新', '色', '黒', '白', '青', '赤', '画面', '電池', '充電', '保証', 'ケース', 'お名前', '入荷', '免税'])
      expect(LEXICON.get(word), word).toBeTruthy();
  });

  it('the phrases are registered with unique ids and tokenize without unknown words', () => {
    const ids = new Set(PHRASEBOOK.map((p) => p.id));
    for (const p of SHOP_DENKI_PHRASES) {
      expect(ids.has(p.id), p.id).toBe(true);
      expect(p.en.length && p.ar.length, p.id).toBeGreaterThan(0);
      expect(tokenize(p.ja.replace('{name}', 'レイラ'), LEXICON).tokens.filter((t) => !t.punct && !t.raw && !t.gloss)).toEqual([]);
    }
    expect(PHRASEBOOK.filter((p) => SHOP_DENKI_PHRASES.some((q) => q.id === p.id)).length).toBe(SHOP_DENKI_PHRASES.length);
  });
});

describe('denki_phone: ScenarioMeta and pockets', () => {
  it('is wired as a polite A2 shop with full pay, the Denki shop and the item ids of the catalog', () => {
    expect(SCENARIO_META.filter((m) => m.id === 'denki_phone')).toHaveLength(1);
    expect(meta.kind).toBe('shop');
    expect(meta.band).toBe('A2');
    expect(meta.register).toBe('polite');
    expect(meta.pay).toBe('full');
    expect(meta.shop!.shopId).toBe('denki');
    expect(meta.shop!.itemSlot).toBe('denkiItem');
    expect(meta.shop!.payStep).toBe('pay');
    expect(meta.shop!.itemMap).toEqual({ used: 'phone_used', pro: 'phone_pro', case: 'phone_case', tv: 'tv_small', musicCd: 'g_music_cd' });
    for (const o of SLOTS.denkiItem) expect(meta.shop!.itemMap[o.id], o.id).toBeTruthy();
    expect(meta.shop!.payStep && sc.steps.some((s) => s.id === meta.shop!.payStep)).toBe(true);
    expect(meta.twist).toBe(true);
  });

  it('pocket lines p_denki_1.. exist, are registered, have at most 2 key lines and EN + AR', () => {
    const mine = Object.values(DENKI_FUKU_POCKETS).filter((p) => p.id.startsWith('p_denki_'));
    expect(meta.pocket!.length).toBeGreaterThanOrEqual(3);
    expect(mine.map((p) => p.id).sort()).toEqual([...meta.pocket!].sort());
    for (const id of meta.pocket!) {
      expect(POCKETS[id], id).toBeTruthy();
      expect(POCKETS[id].line.en && POCKETS[id].line.ar, id).toBeTruthy();
    }
    expect(mine.filter((p) => p.key).length).toBeLessThanOrEqual(2);
  });
});
