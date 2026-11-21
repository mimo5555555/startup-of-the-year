// Berlin's places of Chapters 4-6 (German step 5) through the real engine: the Apotheke (say what hurts, the remedy, its price), the
// Kneipe 「Zum Eck」 (a drink, beer only for an adult, a Bulette, Prost, the bill, cash only), the Bürgeramt (the Anmeldung: appointment,
// papers, address). Every chip at every node, EN and AR, with and without the game's hooks; typed routes in your own words.
import { describe, expect, it } from 'vitest';
import { APOTHEKE_PRICES, KNEIPE_PRICES, berlinCharacterById, berlinScenarioById, type L1, type Vars } from '@lw/content';
import { euroText } from '@lw/core';
import { ConversationSession, DE, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const PRICES: Record<string, Record<string, number>> = { beschwerde: APOTHEKE_PRICES, kneipe: KNEIPE_PRICES, kneipeSnack: KNEIPE_PRICES };
const QTY: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

function till(cents: number) {
  const log = { charges: [] as number[] };
  const bill = (slots: Record<string, string>) => {
    let sum = 0;
    let first = true;
    for (const [slot, table] of Object.entries(PRICES)) {
      const p = slots[slot] ? table[slots[slot]!] : undefined;
      if (p === undefined) continue;
      sum += p * (first ? (QTY[slots.qty ?? 'one'] ?? 1) : 1);
      first = false;
    }
    return sum;
  };
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroText(bill(slots ?? {})).written, raw: true } } : {}),
    charge(slots) {
      const c = bill(slots);
      if (!c || cents < c) return { ok: false };
      log.charges.push(c);
      cents -= c;
      return { ok: true };
    },
  };
  return { hooks, log };
}

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = berlinScenarioById(id)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: berlinCharacterById(scenario.characterId)!, l1, profileName: 'Sam', topics: ['food'], now: () => (t += 4000), language: DE, ...extra });
  s.start();
  return s;
}
const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, DE);
  if (input.kind !== 'ja') throw new Error(`Not German: ${text}`);
  return s.submit({ text: input.text, mode: 'typed_ja' });
};
const last = (s: ConversationSession) => s.turns.at(-1)!.line.written;

function walk(mk: () => ConversationSession) {
  const problems: string[] = [];
  const seen = new Set<string>();
  const replay = (path: number[]) => {
    const s = mk();
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (seen.has(key) || s.ended) return;
    seen.add(key);
    s.suggestions().forEach((sg, i) => {
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…')) problems.push(`${s.nodeId}/#${i}: unresolved variable in "${r.character.line.written}"`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: a word without gloss in "${r.character.line.written}"`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: new Set([...seen].map((k) => k.split('|')[0])) };
}

describe('every chip at every node', () => {
  const cases: Array<[string, () => Partial<SessionOptions>]> = [
    ['no hooks, an adult', () => ({ flags: { adult: true } })],
    ['no hooks, a younger player', () => ({ flags: { minor: true } })],
    ['hooks, cash only, an adult', () => ({ game: till(5000).hooks, flags: { priced: true, cashOnly: true, adult: true } })],
    ['hooks, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, minor: true } })],
    ['a regular, small talk on', () => ({ flags: { regular: true, talk_winter: true, adult: true } })],
  ];
  for (const id of ['berlin_apotheke', 'berlin_kneipe', 'berlin_buergeramt']) {
    for (const [name, mk] of cases) {
      it(`${id}, ${name}: understood, EN and AR`, () => {
        for (const l1 of ['en', 'ar'] as const) expect(walk(() => open(id, l1, mk())).problems, `${id} ${name} ${l1}`).toEqual([]);
      });
    }
  }
});

describe('the Apotheke', () => {
  it('a sore throat: the lozenges, by card, € 6,95; 「Gute Besserung!」', () => {
    const c = till(5000);
    const s = open('berlin_apotheke', 'en', { game: c.hooks, flags: { priced: true } });
    expect(last(s)).toBe('Guten Tag! Was kann ich für Sie tun?');
    say(s, 'Ich habe Halsweh.');
    expect(last(s)).toBe('Oh, das tut mir leid. Ich empfehle Halstabletten. Möchten Sie die?');
    say(s, 'Wie oft soll ich die nehmen?');
    expect(last(s)).toBe('Dreimal am Tag, nach dem Essen. Das steht auch auf der Packung.');
    expect(last(say(s, 'Ja, bitte.') && s)).toBe('Das macht 6,95 €. Bar oder mit Karte?');
    say(s, 'Mit Karte, bitte.');
    expect(last(s)).toBe('Bitte schön. Gute Besserung!');
    expect(c.log.charges).toEqual([695]);
    expect(s.ended).toBe(true);
  });

  it('a cough is the syrup, a cold the spray; 「Nein, danke」 leaves without buying', () => {
    const c = till(5000);
    const s = open('berlin_apotheke', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, 'Ich huste die ganze Zeit.');
    expect(last(s)).toContain('Hustensaft');
    const n = open('berlin_apotheke');
    say(n, 'Ich bin erkältet.');
    expect(last(n)).toContain('Nasenspray');
    expect(say(n, 'Nein, danke.').ended).toBe(true);
    expect(last(n)).toBe('Kein Problem. Trinken Sie viel Tee! Gute Besserung!');
  });
});

describe('the Kneipe', () => {
  it('an adult: a beer and a Bulette, Prost, the bill, cash: € 7,30', () => {
    const c = till(5000);
    const s = open('berlin_kneipe', 'en', { game: c.hooks, flags: { priced: true, cashOnly: true, adult: true } });
    expect(s.suggestions()[0]!.written).toBe('Ein Bier, bitte.');
    say(s, 'Ein Bier, bitte.');
    say(s, 'Was ist eine Bulette?');
    expect(last(s)).toBe('Eine Bulette ist eine Frikadelle. So sagt man in Berlin.');
    say(s, 'Ja, eine Bulette, bitte.');
    expect(last(s)).toBe('Bitte schön! Prost!');
    say(s, 'Prost!');
    say(s, 'Zahlen, bitte!');
    expect(last(s)).toBe('Das macht 7,30 €. Bei uns nur bar, bitte.');
    // a card at a cash-only bar: refused kindly, still at the bill
    say(s, 'Mit Karte, bitte.');
    expect(last(s)).toBe('Tut mir leid, wir nehmen nur Bargeld.');
    say(s, 'Hier, bitte. Stimmt so!');
    expect(c.log.charges).toEqual([730]);
    expect(s.ended).toBe(true);
  });

  it('a younger player: no beer chip, and a typed beer gets a kind no; a Spezi it is', () => {
    const s = open('berlin_kneipe', 'en', { flags: { minor: true } });
    expect(s.suggestions().map((x) => x.written)).not.toContain('Ein Bier, bitte.');
    const r = say(s, 'Ein Bier, bitte.');
    expect(r.learner.intentId).toBe('beer_minor');
    expect(last(s)).toBe('Bier gibt es nur für Erwachsene. Wie wäre es mit einer Spezi?');
    expect(say(s, 'Okay, eine Spezi, bitte.').learner.intentId).toBe('order');
  });

  it('asking what Spezi is does not order it', () => {
    const s = open('berlin_kneipe', 'en', { flags: { adult: true } });
    expect(say(s, 'Was ist Spezi?').learner.intentId).toBe('what_spezi');
    expect(s.nodeId).toBe('start');
  });
});

describe('the Bürgeramt', () => {
  it('the Anmeldung: appointment, purpose, papers (what is that form?), address, floor, the certificate', () => {
    const s = open('berlin_buergeramt');
    expect(last(s)).toBe('Guten Tag. Haben Sie einen Termin?');
    say(s, 'Ja, ich habe einen Termin um zehn.');
    say(s, 'Ich möchte mich anmelden.');
    expect(last(s)).toBe('Ihren Pass und die Wohnungsgeberbestätigung, bitte.');
    say(s, 'Was ist eine Wohnungsgeberbestätigung?');
    expect(last(s)).toContain('Formular von Ihrem Vermieter');
    say(s, 'Hier, bitte.');
    say(s, 'Meine Adresse ist Oranienstraße zwölf.');
    say(s, 'Im dritten Stock.');
    expect(last(s)).toBe('Alles klar. Hier ist Ihre Meldebescheinigung. Willkommen in Berlin, Sam!');
    expect(say(s, 'Vielen Dank!').ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['adresse', 'anliegen', 'papiere', 'termin']);
  });

  it('without an appointment: lucky, a slot is free', () => {
    const s = open('berlin_buergeramt', 'ar');
    say(s, 'Nein, ich habe keinen Termin.');
    expect(last(s)).toContain('Sie haben Glück');
    expect(say(s, 'Ich bin umgezogen und möchte mich anmelden.').learner.intentId).toBe('anmelden');
  });
});
