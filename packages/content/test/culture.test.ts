// The 23 culture cards (docs/GAME_DESIGN.md §10): ids, EN+AR, say-it phrases that tokenise, triggers the reducer understands, and every
// card named by a chapter reward or a scenario's meta.
import { describe, expect, it } from 'vitest';
import { JP_PACK, LEXICON, scenarioById, tokenize } from '../src';
import type { CultureOn } from '@lw/game';

const KINDS: CultureOn[] = ['shop_start', 'talk_start', 'scenario_done', 'payment', 'served', 'machine', 'purchase', 'intent', 'gift_given', 'casual_switch', 'visit', 'ride', 'festival', 'perfect_shift'];
const IDS = [
  'cc_irasshaimase', 'cc_bow', 'cc_konbini', 'cc_notip', 'cc_itadakimasu', 'cc_vending', 'cc_name', 'cc_gift', 'cc_hanami', 'cc_keigo', 'cc_points', 'cc_tax',
  'cc_taxfree', 'cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse', 'cc_bikereg', 'cc_shoesoff', 'cc_rent', 'cc_shaken', 'cc_matsuri', 'cc_trash',
];
const SAY = ['cc_bow', 'cc_itadakimasu', 'cc_gift', 'cc_keigo', 'cc_ic', 'cc_trainmanner', 'cc_refuse', 'cc_shoesoff'];
const hasAr = (s: string) => /[؀-ۿ]/.test(s);
const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const parts = (ja: string) => ja.split(/\s+[/／]\s+/);
const cards = JP_PACK.culture;

describe('culture cards', () => {
  it('are the 23 of §10, once each', () => {
    expect(cards.map((c) => c.id).sort()).toEqual([...IDS].sort());
  });

  it('have English and Arabic for the phrase and the text, with the same placeholders', () => {
    for (const c of cards) {
      for (const g of [c.phrase.en, c.text.en]) expect(g.trim(), c.id).not.toBe('');
      for (const g of [c.phrase.ar, c.text.ar]) expect(hasAr(g), `${c.id}: ${g}`).toBe(true);
      expect(slots(c.phrase.ar), c.id).toBe(slots(c.phrase.en));
      expect(slots(c.text.ar), c.id).toBe(slots(c.text.en));
    }
  });

  it('mark exactly the eight say-it cards, and only cc_rent is adult-only', () => {
    expect(cards.filter((c) => c.say).map((c) => c.id).sort()).toEqual([...SAY].sort());
    expect(cards.filter((c) => c.adultOnly).map((c) => c.id)).toEqual(['cc_rent']);
  });

  it('write every phrase in lexicon words, and every part of a say-it phrase is long enough for the reducer to match', () => {
    for (const c of cards) {
      for (const p of parts(c.phrase.ja)) {
        const { missing } = tokenize(p, LEXICON, { name: { ja: 'ミオ', raw: true } });
        expect(missing, `${c.id}: ${p}`).toEqual([]);
        if (c.say) expect(p.replace(/[|…。、！？]/g, '').length, c.id).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('use only triggers the reducer raises, with a count only where it can be counted', () => {
    for (const c of cards) {
      for (const t of [c.trigger, ...(c.also ?? [])]) {
        expect(KINDS, c.id).toContain(t.on);
        if (t.n !== undefined) expect(['purchase', 'perfect_shift'], c.id).toContain(t.on);
      }
    }
  });

  it('point scenario triggers at scenarios (and intents) that exist', () => {
    const deferred = new Set(['cc_rent', 'cc_shoesoff', 'cc_trash', 'cc_matsuri']);
    for (const c of cards.filter((x) => !deferred.has(x.id))) {
      for (const t of [c.trigger, ...(c.also ?? [])]) {
        for (const id of t.ids ?? []) {
          if (t.on === 'scenario_done' || t.on === 'served') expect(scenarioById(id), `${c.id}: ${id}`).toBeTruthy();
          if (t.on === 'intent') {
            const [sid, iid] = id.split(':');
            const sc = scenarioById(sid);
            expect(sc, `${c.id}: ${id}`).toBeTruthy();
            expect(JSON.stringify(sc), `${c.id}: ${id}`).toContain(`"id":"${iid}"`);
          }
        }
      }
    }
  });

  it('include every card the chapters 1-4 reward and every card a scenario meta names', () => {
    const have = new Set(cards.map((c) => c.id));
    for (const ch of JP_PACK.chapters) for (const id of ch.rewardCulture ?? []) expect(have.has(id), `chapter ${ch.n}: ${id}`).toBe(true);
    for (const m of JP_PACK.scenarioMeta) for (const id of m.culture ?? []) expect(have.has(id), `${m.id}: ${id}`).toBe(true);
    const early = JP_PACK.chapters.filter((c) => c.n <= 2).flatMap((c) => c.rewardCulture ?? []);
    expect(early).toEqual(expect.arrayContaining(['cc_bow', 'cc_itadakimasu']));
  });

  it('give c2_4 (two phrases said) two say-it cards that unlock in Chapter 1-2 content', () => {
    const early = cards.filter((c) => c.say && (c.id === 'cc_bow' || c.id === 'cc_itadakimasu'));
    expect(early).toHaveLength(2);
    expect(early.map((c) => c.trigger.on)).toEqual(['talk_start', 'served']);
  });
});
