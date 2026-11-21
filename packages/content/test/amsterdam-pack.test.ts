// The Amsterdam game pack (Dutch step 2): it validates at the strictest level against Amsterdam's own content (scenarios, intents, slots,
// characters), its Dutch is all in the Dutch dictionary, its menu is what the conversations sell, and its money is euro and cents.
import { describe, expect, it } from 'vitest';
import { createGameState, haggleLimit, priceDisplay, quote, validatePack, type ContentIndex, type GameView } from '@lw/game';
import { AMSTERDAM_CHARACTERS, AMSTERDAM_PACK, AMSTERDAM_SCENARIOS, BERLIN_PACK, NL_LANGUAGE, NL_LEXICON, NL_SLOTS, JP_PACK, tokenize } from '../src';

const index = (): ContentIndex => ({
  scenarios: Object.fromEntries(
    AMSTERDAM_SCENARIOS.map((s) => [
      s.id,
      { steps: s.steps.map((x) => x.id), intents: Object.values(s.nodes).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId },
    ]),
  ),
  lexiconSurfaces: new Set(NL_LEXICON.all().map((e) => e.s)),
  slots: Object.fromEntries(Object.entries(NL_SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
  characters: AMSTERDAM_CHARACTERS.map((c) => c.id),
  unknownWords: (ja) => tokenize(ja, NL_LEXICON, { name: { ja: 'Leila', raw: true } }).missing,
});

const missing = (ja: string) => tokenize(ja, NL_LEXICON, { name: { ja: 'Leila', raw: true } }).missing;

describe('the Amsterdam pack', () => {
  it('validates at level 5 with no error and no warning', () => {
    const issues = validatePack(AMSTERDAM_PACK, { level: 5, index: index() });
    expect(issues.map((i) => `${i.severity} ${i.code} ${i.path}: ${i.message}`)).toEqual([]);
  });

  it('is its own pack: euro and cents, Dutch, Amsterdam; nothing of Tokyo’s or Berlin’s', () => {
    expect(AMSTERDAM_PACK).toMatchObject({ id: 'nl', language: 'nl', district: 'amsterdam', currency: { code: 'EUR', minorPerMajor: 100, symbolPlacement: 'prefix' } });
    expect(AMSTERDAM_PACK.release).toEqual({ lastChapter: 6, epilogue: 'b_nc6_close' });
    const others = new Set([...JP_PACK.scenarioMeta, ...BERLIN_PACK.scenarioMeta].map((m) => m.id));
    // give_gift is the one id every language shares: the app starts the hand-over by it
    for (const m of AMSTERDAM_PACK.scenarioMeta) if (m.id !== 'give_gift') expect(others.has(m.id), m.id).toBe(false);
    expect(AMSTERDAM_PACK.scenarioMeta.map((m) => m.id).sort()).toEqual(AMSTERDAM_SCENARIOS.map((s) => s.id).sort());
  });

  it('every Dutch line of the pack is in the Dutch dictionary: beats, friends’ facts, culture phrases, names of things', () => {
    const lines: Array<[string, string]> = [];
    for (const b of Object.values(AMSTERDAM_PACK.beats)) for (const l of b.lines) lines.push([b.id, l.line.ja]);
    for (const f of AMSTERDAM_PACK.friends) for (const [k, l] of Object.entries(f.factLines ?? {})) lines.push([`${f.id}.${k}`, l.ja]);
    for (const c of AMSTERDAM_PACK.culture) lines.push([c.id, c.phrase.ja]);
    for (const m of AMSTERDAM_PACK.menu) lines.push([m.id, m.name.ja]);
    for (const i of AMSTERDAM_PACK.items) lines.push([i.id, i.name.ja]);
    for (const c of AMSTERDAM_PACK.chapters) lines.push([`c${c.n}`, c.title.ja]);
    for (const t of AMSTERDAM_PACK.titles) lines.push([t.id, t.name.ja]);
    for (const d of AMSTERDAM_PACK.dreams) lines.push([d.id, d.name.ja]);
    expect(lines.flatMap(([where, ja]) => missing(ja).map((w) => `${where}: ${w}`))).toEqual([]);
    for (const [tag, words] of Object.entries(AMSTERDAM_PACK.wordTags)) for (const w of words) expect(NL_LEXICON.get(w), `${tag}: ${w}`).toBeDefined();
  });

  it('every option of every item slot of a shop is on the menu (or the catalog); the tram takes cards only', () => {
    for (const m of AMSTERDAM_PACK.scenarioMeta) {
      if (!m.shop) continue;
      for (const slot of [m.shop.itemSlot!, ...(m.shop.extraSlots ?? [])]) for (const o of NL_SLOTS[slot]!) expect(m.shop.itemMap[o.id], `${m.id}: ${slot}.${o.id}`).toBeDefined();
    }
    expect(AMSTERDAM_PACK.items.find((i) => i.id === 'ams_wafel_blik')?.price).toBe(795);
    expect(AMSTERDAM_PACK.shops.find((s) => s.id === 'gvb')?.pay).toEqual(['card']);
  });

  it('reads and writes money the Dutch way, in cents', () => {
    expect(NL_LANGUAGE.priceMarkup(250, AMSTERDAM_PACK.currency)).toEqual({ markup: '€ 2,50', reading: 'twee euro vijftig', gloss: { en: '€2.50', ar: '2.50 يورو' } });
    expect(missing(NL_LANGUAGE.priceMarkup(123456, AMSTERDAM_PACK.currency).markup)).toEqual([]);
    expect(NL_LANGUAGE.parseNumbers('Dat is dan vijftien euro.').numbers).toEqual([1500]);
    expect(NL_LANGUAGE.parseNumbers('€ 2,50').numbers).toEqual([250]);
    expect(NL_LANGUAGE.readNumber(22)).toBe('tweeëntwintig');
    expect(NL_LANGUAGE.speechNormalize('Eén café, graag!')).toBe(NL_LANGUAGE.speechNormalize('een cafe graag'));
  });

  it('the game prices it in cents: a start of €30, a cheese by the pound, the tram only from Chapter 2, prices shown the Dutch way', () => {
    const view: GameView = {
      vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
      discovered: [],
      lessonsDone: [],
      streakDays: 0,
      profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
    };
    const state = createGameState(AMSTERDAM_PACK, new Date(2030, 0, 15, 12).getTime());
    expect(state.wallet.cash).toBe(3000);
    expect(state.packId).toBe('nl');
    expect(quote(AMSTERDAM_PACK, state, view, { shopId: 'cafe', itemId: 'cafe:verkeerd', qty: 2 }).total).toBe(760);
    expect(quote(AMSTERDAM_PACK, state, view, { shopId: 'gvb', itemId: 'gvb:dag' }).total).toBe(0);
    const ch3 = { ...state, chapter: { ...state.chapter, n: 3 } };
    expect(quote(AMSTERDAM_PACK, ch3, view, { shopId: 'gvb', itemId: 'gvb:dag' }).total).toBe(950);
    expect(quote(AMSTERDAM_PACK, ch3, view, { shopId: 'kaas', itemId: 'kaas:oud', qty: 2 }).total).toBe(1300);
    expect(haggleLimit(AMSTERDAM_PACK, 'markt', 795, false)).toBe(0);
    expect(priceDisplay(250, AMSTERDAM_PACK.currency, AMSTERDAM_PACK.economy).text).toBe('€ 2,50');
  });
});
