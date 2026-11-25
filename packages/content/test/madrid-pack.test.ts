// The Madrid game pack (Spanish step 2): it validates at the strictest level against Madrid's own content (scenarios, intents, slots,
// characters), its Spanish is all in the Spanish dictionary, its menu is what the conversations sell, and its money is euro and cents
// written the Spanish way.
import { describe, expect, it } from 'vitest';
import { createGameState, haggleLimit, priceDisplay, quote, validatePack, type ContentIndex, type GameView } from '@lw/game';
import { AMSTERDAM_PACK, BERLIN_PACK, ES_LANGUAGE, ES_LEXICON, ES_SLOTS, JP_PACK, MADRID_CHARACTERS, MADRID_PACK, MADRID_SCENARIOS, tokenize } from '../src';

const index = (): ContentIndex => ({
  scenarios: Object.fromEntries(
    MADRID_SCENARIOS.map((s) => [
      s.id,
      { steps: s.steps.map((x) => x.id), intents: Object.values(s.nodes).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId },
    ]),
  ),
  lexiconSurfaces: new Set(ES_LEXICON.all().map((e) => e.s)),
  slots: Object.fromEntries(Object.entries(ES_SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
  characters: MADRID_CHARACTERS.map((c) => c.id),
  unknownWords: (ja) => tokenize(ja, ES_LEXICON, { name: { ja: 'Leila', raw: true } }).missing,
});

const missing = (ja: string) => tokenize(ja, ES_LEXICON, { name: { ja: 'Leila', raw: true } }).missing;

describe('the Madrid pack', () => {
  it('validates at level 5 with no error and no warning', () => {
    const issues = validatePack(MADRID_PACK, { level: 5, index: index() });
    expect(issues.map((i) => `${i.severity} ${i.code} ${i.path}: ${i.message}`)).toEqual([]);
  });

  it('is its own pack: euro and cents, Spanish, Madrid; nothing of Tokyo’s, Berlin’s or Amsterdam’s', () => {
    expect(MADRID_PACK).toMatchObject({ id: 'es', language: 'es', district: 'madrid', currency: { code: 'EUR', minorPerMajor: 100, symbolPlacement: 'suffix' } });
    expect(MADRID_PACK.release).toEqual({ lastChapter: 6, epilogue: 'b_ec6_close' });
    const others = new Set([...JP_PACK.scenarioMeta, ...BERLIN_PACK.scenarioMeta, ...AMSTERDAM_PACK.scenarioMeta].map((m) => m.id));
    // give_gift is the one id every language shares: the app starts the hand-over by it
    for (const m of MADRID_PACK.scenarioMeta) if (m.id !== 'give_gift') expect(others.has(m.id), m.id).toBe(false);
    expect(MADRID_PACK.scenarioMeta.map((m) => m.id).sort()).toEqual(MADRID_SCENARIOS.map((s) => s.id).sort());
  });

  it('every Spanish line of the pack is in the Spanish dictionary: beats, friends’ facts, culture phrases, names of things', () => {
    const lines: Array<[string, string]> = [];
    for (const b of Object.values(MADRID_PACK.beats)) for (const l of b.lines) lines.push([b.id, l.line.ja]);
    for (const f of MADRID_PACK.friends) for (const [k, l] of Object.entries(f.factLines ?? {})) lines.push([`${f.id}.${k}`, l.ja]);
    for (const c of MADRID_PACK.culture) lines.push([c.id, c.phrase.ja]);
    for (const m of MADRID_PACK.menu) lines.push([m.id, m.name.ja]);
    for (const i of MADRID_PACK.items) lines.push([i.id, i.name.ja]);
    for (const c of MADRID_PACK.chapters) lines.push([`c${c.n}`, c.title.ja]);
    for (const t of MADRID_PACK.titles) lines.push([t.id, t.name.ja]);
    for (const d of MADRID_PACK.dreams) lines.push([d.id, d.name.ja]);
    expect(lines.flatMap(([where, ja]) => missing(ja).map((w) => `${where}: ${w}`))).toEqual([]);
    for (const [tag, words] of Object.entries(MADRID_PACK.wordTags)) for (const w of words) expect(ES_LEXICON.get(w), `${tag}: ${w}`).toBeDefined();
  });

  it('every option of every item slot of a shop is on the menu (or the catalog); the bar and the churrería say tú', () => {
    for (const m of MADRID_PACK.scenarioMeta) {
      if (!m.shop) continue;
      for (const slot of [m.shop.itemSlot!, ...(m.shop.extraSlots ?? [])]) for (const o of ES_SLOTS[slot]!) expect(m.shop.itemMap[o.id], `${m.id}: ${slot}.${o.id}`).toBeDefined();
    }
    expect(MADRID_PACK.items.find((i) => i.id === 'mad_aceite')?.price).toBe(850);
    const register = Object.fromEntries(MADRID_PACK.scenarioMeta.map((m) => [m.id, m.register]));
    expect(register).toMatchObject({ mad_bar: 'casual', mad_churreria: 'casual', mad_panaderia: 'polite', mad_mercado: 'polite', mad_metro: 'polite' });
  });

  it('reads and writes money the Spanish way, in cents', () => {
    expect(ES_LANGUAGE.priceMarkup(250, MADRID_PACK.currency)).toEqual({ markup: '2,50 €', reading: 'dos euros con cincuenta', gloss: { en: '€2.50', ar: '2.50 يورو' } });
    expect(missing(ES_LANGUAGE.priceMarkup(123456, MADRID_PACK.currency).markup)).toEqual([]);
    expect(ES_LANGUAGE.parseNumbers('Son quince euros.').numbers).toEqual([1500]);
    expect(ES_LANGUAGE.parseNumbers('tres con cincuenta').numbers).toEqual([350]);
    expect(ES_LANGUAGE.parseNumbers('2,50 €').numbers).toEqual([250]);
    expect(ES_LANGUAGE.readNumber(35)).toBe('treinta y cinco');
    expect(ES_LANGUAGE.speechNormalize('¡Un café, por favor!')).toBe(ES_LANGUAGE.speechNormalize('un cafe por favor'));
  });

  it('the game prices it in cents: a start of €30, fruit by the half kilo, the Metro only from Chapter 2, prices shown the Spanish way', () => {
    const view: GameView = {
      vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
      discovered: [],
      lessonsDone: [],
      streakDays: 0,
      profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
    };
    const state = createGameState(MADRID_PACK, new Date(2030, 0, 15, 12).getTime());
    expect(state.wallet.cash).toBe(3000);
    expect(state.packId).toBe('es');
    expect(quote(MADRID_PACK, state, view, { shopId: 'bar', itemId: 'bar:cafe', qty: 2 }).total).toBe(360);
    expect(quote(MADRID_PACK, state, view, { shopId: 'metro', itemId: 'metro:diez' }).total).toBe(0);
    const ch3 = { ...state, chapter: { ...state.chapter, n: 3 } };
    expect(quote(MADRID_PACK, ch3, view, { shopId: 'metro', itemId: 'metro:diez' }).total).toBe(1220);
    expect(quote(MADRID_PACK, ch3, view, { shopId: 'mercado', itemId: 'mercado:fresas', qty: 2 }).total).toBe(350);
    expect(haggleLimit(MADRID_PACK, 'mercado', 850, false)).toBe(0);
    expect(priceDisplay(250, MADRID_PACK.currency, MADRID_PACK.economy).text).toBe('2,50 €');
  });
});
