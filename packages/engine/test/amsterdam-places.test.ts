// Amsterdam's places of Chapters 4-6 (Dutch step 4) through the real engine: the drogist (say what hurts, the remedy, its price), the
// brown café ’t Hoekje (a drink, beer only for an adult, bitterballen, Proost, the bill, cards only), the gemeente (registering for a
// BSN: appointment, papers, address). Every chip at every node, EN and AR, with and without the game's hooks; typed routes.
import { describe, expect, it } from 'vitest';
import { DROGIST_PRICES, KROEG_PRICES, amsterdamCharacterById, amsterdamScenarioById, type L1, type Vars } from '@lw/content';
import { euroTextNl } from '@lw/core';
import { ConversationSession, NL, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const PRICES: Record<string, Record<string, number>> = { klacht: DROGIST_PRICES, kroeg: KROEG_PRICES, kroegSnack: KROEG_PRICES };
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
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroTextNl(bill(slots ?? {})).written, raw: true } } : {}),
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
  const scenario = amsterdamScenarioById(id)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: amsterdamCharacterById(scenario.characterId)!, l1, profileName: 'Sam', topics: ['food'], now: () => (t += 4000), language: NL, ...extra });
  s.start();
  return s;
}
const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, NL);
  if (input.kind !== 'ja') throw new Error(`Not Dutch: ${text}`);
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
  return { problems };
}

describe('every chip at every node', () => {
  const cases: Array<[string, () => Partial<SessionOptions>]> = [
    ['no hooks, an adult', () => ({ flags: { adult: true } })],
    ['no hooks, a younger player', () => ({ flags: { minor: true } })],
    ['hooks, cards only, an adult', () => ({ game: till(5000).hooks, flags: { priced: true, pinOnly: true, adult: true } })],
    ['hooks, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, minor: true } })],
    ['a regular, small talk on', () => ({ flags: { regular: true, talk_winter: true, adult: true } })],
  ];
  for (const id of ['ams_drogist', 'ams_kroeg', 'ams_gemeente']) {
    for (const [name, mk] of cases) {
      it(`${id}, ${name}: understood, EN and AR`, () => {
        for (const l1 of ['en', 'ar'] as const) expect(walk(() => open(id, l1, mk())).problems, `${id} ${name} ${l1}`).toEqual([]);
      });
    }
  }
});

describe('the drogist', () => {
  it('a sore throat: the throat sweets, by card, € 3,95; 「Beterschap!」', () => {
    const c = till(5000);
    const s = open('ams_drogist', 'en', { game: c.hooks, flags: { priced: true } });
    expect(last(s)).toBe('Goedemiddag! Kan ik u ergens mee helpen?');
    say(s, 'Ik heb een zere keel.');
    expect(last(s)).toBe('Wat vervelend. Ik raad keelpastilles aan. Wilt u die?');
    say(s, 'Hoe vaak moet ik die nemen?');
    expect(last(s)).toBe('Drie keer per dag. Het staat ook op de verpakking.');
    say(s, 'Ja, graag.');
    expect(last(s)).toBe('Dat is dan € 3,95. Pinnen of contant?');
    say(s, 'Pinnen, graag.');
    expect(last(s)).toBe('Alstublieft. Beterschap!');
    expect(c.log.charges).toEqual([395]);
  });

  it('a headache is paracetamol, a cough the syrup; 「Nee, dank u」 leaves without buying', () => {
    const s = open('ams_drogist');
    say(s, 'Ik heb hoofdpijn.');
    expect(last(s)).toContain('paracetamol');
    const h = open('ams_drogist');
    say(h, 'Ik moet steeds hoesten.');
    expect(last(h)).toContain('hoestsiroop');
    expect(say(h, 'Nee, dank u.').ended).toBe(true);
    expect(last(h)).toBe('Geen probleem. Drink veel thee! Beterschap!');
  });
});

describe('the brown café', () => {
  it('an adult: a beer and bitterballen, Proost, the bill, by card: € 10,00', () => {
    const c = till(5000);
    const s = open('ams_kroeg', 'en', { game: c.hooks, flags: { priced: true, pinOnly: true, adult: true } });
    expect(s.suggestions()[0]!.written).toBe('Een biertje, graag.');
    say(s, 'Een biertje, graag.');
    say(s, 'Wat zijn bitterballen?');
    expect(last(s)).toBe('Bitterballen zijn kleine, krokante balletjes met ragout. Met mosterd!');
    say(s, 'Ja, graag, bitterballen!');
    expect(last(s)).toBe('Alstublieft! Proost!');
    say(s, 'Proost!');
    say(s, 'Mag ik afrekenen?');
    expect(last(s)).toBe('Dat is dan € 10,00. Hier kunt u alleen pinnen.');
    // cash at a card-only café: refused kindly, still at the bill
    say(s, 'Contant, graag.');
    expect(last(s)).toBe('Sorry, we accepteren alleen pin.');
    say(s, 'Pinnen, graag.');
    expect(c.log.charges).toEqual([1000]);
    expect(s.ended).toBe(true);
  });

  it('a younger player: no beer chip, a typed beer gets a kind no; a spa rood it is', () => {
    const s = open('ams_kroeg', 'en', { flags: { minor: true } });
    expect(s.suggestions().map((x) => x.written)).not.toContain('Een biertje, graag.');
    expect(say(s, 'Een biertje, graag.').learner.intentId).toBe('beer_minor');
    expect(last(s)).toBe('Bier is alleen voor volwassenen. Wilt u een spa rood?');
    expect(say(s, 'Oké, een spa rood, graag.').learner.intentId).toBe('order');
  });

  it('asking what spa rood is does not order it', () => {
    const s = open('ams_kroeg', 'en', { flags: { adult: true } });
    expect(say(s, 'Wat is spa rood?').learner.intentId).toBe('what_spa');
    expect(s.nodeId).toBe('start');
  });
});

describe('the gemeente', () => {
  it('registering: appointment, purpose, papers (why the contract?), address, floor, the BSN by post', () => {
    const s = open('ams_gemeente');
    expect(last(s)).toBe('Goedemorgen. Heeft u een afspraak?');
    say(s, 'Ja, ik heb een afspraak om tien uur.');
    say(s, 'Ik wil me inschrijven.');
    expect(last(s)).toBe('Mag ik uw paspoort en uw huurcontract?');
    say(s, 'Waarom het huurcontract?');
    expect(last(s)).toBe('Daarmee ziet de gemeente dat u daar echt woont.');
    say(s, 'Alstublieft.');
    say(s, 'Mijn adres is Ruysdaelkade twaalf.');
    say(s, 'Driehoog.');
    expect(last(s)).toBe('Prima. U bent ingeschreven. Uw BSN krijgt u per post. Welkom in Amsterdam, Sam!');
    expect(say(s, 'Dank u wel!').ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['adres', 'afspraak', 'doel', 'papieren']);
  });

  it('without an appointment: lucky, a slot is free', () => {
    const s = open('ams_gemeente', 'ar');
    say(s, 'Nee, ik heb geen afspraak.');
    expect(last(s)).toContain('u heeft geluk');
    expect(say(s, 'Ik ben net verhuisd en wil me inschrijven.').learner.intentId).toBe('inschrijven');
  });
});
