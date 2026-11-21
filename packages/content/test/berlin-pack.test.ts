// The Berlin game pack (German step 2): it validates at the strictest level against Berlin's own content (scenarios, intents, slots,
// characters), its German is all in the German dictionary, its menu is what the conversations sell, and its money is euro and cents.
import { describe, expect, it } from 'vitest';
import { createGameState, haggleLimit, priceDisplay, quote, validatePack, type ContentIndex, type GameView } from '@lw/game';
import { BERLIN_CHARACTERS, BERLIN_PACK, BERLIN_SCENARIOS, DE_LANGUAGE, DE_LEXICON, DE_SLOTS, JP_PACK, tokenize } from '../src';

const index = (): ContentIndex => ({
  scenarios: Object.fromEntries(
    BERLIN_SCENARIOS.map((s) => [
      s.id,
      { steps: s.steps.map((x) => x.id), intents: Object.values(s.nodes).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId },
    ]),
  ),
  lexiconSurfaces: new Set(DE_LEXICON.all().map((e) => e.s)),
  slots: Object.fromEntries(Object.entries(DE_SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
  characters: BERLIN_CHARACTERS.map((c) => c.id),
  unknownWords: (ja) => tokenize(ja, DE_LEXICON, { name: { ja: 'Leila', raw: true } }).missing,
});

const missing = (ja: string) => tokenize(ja, DE_LEXICON, { name: { ja: 'Leila', raw: true } }).missing;

describe('the Berlin pack', () => {
  it('validates at level 5 with no error and no warning', () => {
    const issues = validatePack(BERLIN_PACK, { level: 5, index: index() });
    expect(issues.map((i) => `${i.severity} ${i.code} ${i.path}: ${i.message}`)).toEqual([]);
  });

  it('is its own pack: euro and cents, German, Berlin; nothing of Tokyo’s', () => {
    expect(BERLIN_PACK).toMatchObject({ id: 'de', language: 'de', district: 'berlin', currency: { code: 'EUR', minorPerMajor: 100 } });
    expect(BERLIN_PACK.release).toEqual({ lastChapter: 6, epilogue: 'b_bc6_close' });
    const jpScenarios = new Set(JP_PACK.scenarioMeta.map((m) => m.id));
    // give_gift is the one id every language shares: the app starts the hand-over by it
    for (const m of BERLIN_PACK.scenarioMeta) if (m.id !== 'give_gift') expect(jpScenarios.has(m.id), m.id).toBe(false);
    expect(BERLIN_PACK.scenarioMeta.map((m) => m.id).sort()).toEqual(BERLIN_SCENARIOS.map((s) => s.id).sort());
  });

  it('every German line of the pack is in the German dictionary: beats, friends’ facts, culture phrases, names of things', () => {
    const lines: Array<[string, string]> = [];
    for (const b of Object.values(BERLIN_PACK.beats)) for (const l of b.lines) lines.push([b.id, l.line.ja]);
    for (const f of BERLIN_PACK.friends) for (const [k, l] of Object.entries(f.factLines ?? {})) lines.push([`${f.id}.${k}`, l.ja]);
    for (const c of BERLIN_PACK.culture) lines.push([c.id, c.phrase.ja]);
    for (const m of BERLIN_PACK.menu) lines.push([m.id, m.name.ja]);
    for (const i of BERLIN_PACK.items) lines.push([i.id, i.name.ja]);
    for (const c of BERLIN_PACK.chapters) lines.push([`c${c.n}`, c.title.ja]);
    for (const t of BERLIN_PACK.titles) lines.push([t.id, t.name.ja]);
    for (const d of BERLIN_PACK.dreams) lines.push([d.id, d.name.ja]);
    const bad = lines.flatMap(([where, ja]) => missing(ja).map((w) => `${where}: ${w}`));
    expect(bad).toEqual([]);
    for (const [tag, words] of Object.entries(BERLIN_PACK.wordTags)) for (const w of words) expect(DE_LEXICON.get(w), `${tag}: ${w}`).toBeDefined();
  });

  it('every option of every item slot of a shop is on the menu (or the catalog), at the price its conversation charges', () => {
    for (const m of BERLIN_PACK.scenarioMeta) {
      if (!m.shop) continue;
      for (const slot of [m.shop.itemSlot!, ...(m.shop.extraSlots ?? [])]) {
        for (const o of DE_SLOTS[slot]!) expect(m.shop.itemMap[o.id], `${m.id}: ${slot}.${o.id}`).toBeDefined();
      }
    }
    expect(BERLIN_PACK.items.find((i) => i.id === 'bike_used')?.price).toBe(6500);
    expect(BERLIN_PACK.shops.find((s) => s.id === 'flohmarkt')?.pay).toEqual(['cash']);
  });

  it('reads and writes money the German way, in cents', () => {
    expect(DE_LANGUAGE.priceMarkup(250, BERLIN_PACK.currency)).toEqual({ markup: '2,50 €', reading: 'zwei Euro fünfzig', gloss: { en: '€2.50', ar: '2.50 يورو' } });
    expect(missing(DE_LANGUAGE.priceMarkup(123456, BERLIN_PACK.currency).markup)).toEqual([]);
    expect(DE_LANGUAGE.parseNumbers('Geht es auch für fünfzehn Euro?').numbers).toEqual([1500]);
    expect(DE_LANGUAGE.parseNumbers('2,50 €').numbers).toEqual([250]);
    expect(DE_LANGUAGE.readNumber(21)).toBe('einundzwanzig');
    expect(DE_LANGUAGE.speechNormalize('Zwei Brötchen, bitte!')).toBe(DE_LANGUAGE.speechNormalize('zwei broetchen bitte'));
  });

  it('the game prices it in cents: a start of €30, two rolls 90 cents, a bike haggled by at most 15 %, prices shown as German writes them', () => {
    const view: GameView = {
      vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
      discovered: [],
      lessonsDone: [],
      streakDays: 0,
      profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
    };
    const state = createGameState(BERLIN_PACK, new Date(2030, 0, 15, 12).getTime());
    expect(state.wallet.cash).toBe(3000);
    expect(state.packId).toBe('de');
    expect(quote(BERLIN_PACK, state, view, { shopId: 'bakery', itemId: 'bakery:broetchen', qty: 2 }).total).toBe(90);
    // the U-Bahn counter opens with Chapter 2
    expect(quote(BERLIN_PACK, state, view, { shopId: 'ubahn', itemId: 'ubahn:tageskarte' }).total).toBe(0);
    const ch2 = { ...state, chapter: { ...state.chapter, n: 2 } };
    expect(quote(BERLIN_PACK, ch2, view, { shopId: 'ubahn', itemId: 'ubahn:tageskarte' }).total).toBe(1060);
    expect(haggleLimit(BERLIN_PACK, 'flohmarkt', 6500, false)).toBe(975);
    expect(haggleLimit(BERLIN_PACK, 'flohmarkt', 6500, true)).toBe(487);
    expect(haggleLimit(BERLIN_PACK, 'bakery', 450, false)).toBe(0);
    expect(priceDisplay(250, BERLIN_PACK.currency, BERLIN_PACK.economy).text).toBe('2,50 €');
  });
});
