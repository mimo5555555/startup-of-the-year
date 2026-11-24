// Jobs in Berlin and Amsterdam: Murat's Späti and Femke's café. Every customer's cart is the shop's own goods, every total and change is
// said and heard back the way the language says it (digits or words), the thanks are matched any way they are typed, the tiles build the
// phrase, the answer box's example is never anyone's answer, every word is in the dictionary, and Chapter 2 opens the job.
import { describe, expect, it } from 'vitest';
import { generateShift, type CustomerTemplate, type GamePack, type JobDef, type MenuItem } from '@lw/game';
import { euroText, euroTextNl } from '@lw/core';
import {
  yenToJa,
  AMSTERDAM_PACK,
  AMSTERDAM_SCENARIOS,
  BERLIN_PACK,
  BERLIN_SCENARIOS,
  DE_LEXICON,
  DE_SHIFT_TALK,
  JA_SHIFT_TALK,
  NL_LEXICON,
  NL_SHIFT_TALK,
  customerVoice,
  latinPieces,
  nearAmounts,
  tokenize,
  type Lexicon,
  type ShiftTalk,
} from '../src';

interface City {
  name: string;
  pack: GamePack;
  talk: ShiftTalk;
  lex: Lexicon;
  words: (cents: number) => string;
  jobId: string;
  boss: string;
  intro: string;
  scenarios: typeof BERLIN_SCENARIOS;
}

const CITIES: City[] = [
  { name: 'Berlin', pack: BERLIN_PACK, talk: DE_SHIFT_TALK, lex: DE_LEXICON, words: (c) => euroText(c).words, jobId: 'job_spaeti', boss: 'murat', intro: 'jobintro_spaeti', scenarios: BERLIN_SCENARIOS },
  { name: 'Amsterdam', pack: AMSTERDAM_PACK, talk: NL_SHIFT_TALK, lex: NL_LEXICON, words: (c) => euroTextNl(c).words, jobId: 'job_ams_cafe', boss: 'femke', intro: 'jobintro_ams_cafe', scenarios: AMSTERDAM_SCENARIOS },
];

const menuOf = (pack: GamePack, job: JobDef): MenuItem[] => {
  const shops = new Set(pack.shops.filter((s) => s.placeId === job.place || s.id === job.place).map((s) => s.id));
  return pack.menu.filter((m) => shops.has(m.shop));
};
const total = (menu: MenuItem[], a: CustomerTemplate): number =>
  a.task.kind === 'order' ? a.task.items.reduce((s, i) => s + (menu.find((m) => m.id === i.menu)?.price ?? NaN) * i.qty, 0) : NaN;
/** every amount a customer is owed: the total, the change, and the two bills of a split order */
function owed(menu: MenuItem[], a: CustomerTemplate): number[] {
  const t = total(menu, a);
  const out = [t];
  if (a.change) out.push(a.change.paid - t);
  if (a.task.kind === 'order' && (a.task.toggles ?? []).includes('split')) {
    const [first, ...rest] = a.task.items;
    const price = (i: { menu: string; qty: number }) => (menu.find((m) => m.id === i.menu)?.price ?? 0) * i.qty;
    out.push(price(first!), rest.reduce((s, i) => s + price(i), 0));
  }
  return out;
}

describe.each(CITIES)('the job in $name', (c) => {
  const job = c.pack.jobs.find((j) => j.id === c.jobId)!;
  const menu = menuOf(c.pack, job);

  it('is the pack’s job, with its boss, its intro and the minimum wage', () => {
    expect(job).toBeDefined();
    expect(job.boss).toBe(c.boss);
    expect(job.wage).toBe(c.pack.economy.refWage);
    expect(c.scenarios.find((s) => s.id === c.intro)?.characterId).toBe(c.boss);
    expect(c.pack.scenarioMeta.find((m) => m.id === c.intro)?.kind).toBe('jobintro');
    expect(c.pack.interactions[c.boss]?.some((it) => it.kind === 'shift' && it.jobId === c.jobId)).toBe(true);
    expect(c.pack.menu.some((m) => m.id === job.bonus.itemId)).toBe(true);
  });

  it('opens in Chapter 2, which asks for a first shift', () => {
    const ch2 = c.pack.chapters.find((x) => x.n === 2)!;
    expect(ch2.opens).toContainEqual({ kind: 'job', id: c.jobId });
    expect(ch2.opens).toContainEqual({ kind: 'interaction', id: `${c.boss}_shift` });
    expect(ch2.objectives.some((o) => o.pred.k === 'shift' && o.pred.job === c.jobId)).toBe(true);
    expect(c.pack.daily.some((d) => d.id === 'g_shift')).toBe(true);
  });

  it('every customer orders the shop’s own goods: carts, tables, splits and notes make sense', () => {
    expect(job.archetypes.length).toBeGreaterThanOrEqual(12);
    for (const a of job.archetypes) {
      expect(a.task.kind, a.id).toBe('order');
      if (a.task.kind !== 'order') continue;
      for (const i of a.task.items) expect(menu.some((m) => m.id === i.menu), `${a.id}: ${i.menu}`).toBe(true);
      expect(total(menu, a), a.id).toBeGreaterThan(0);
      for (const t of a.task.toggles ?? []) expect(/^(table:[1-6]|split)$/.test(t), `${a.id}: ${t}`).toBe(true);
      if ((a.task.toggles ?? []).includes('split')) expect(a.task.items.length, a.id).toBeGreaterThanOrEqual(2);
      if (a.change) expect(a.change.paid, a.id).toBeGreaterThan(total(menu, a));
      expect(a.thanks.length, a.id).toBeGreaterThan(1);
      expect(a.tiles?.length, a.id).toBe(2);
    }
    // the higher tiers come with rank: a note or a split from rank 2
    for (const a of job.archetypes.filter((x) => x.change || (x.task.kind === 'order' && x.task.toggles?.includes('split')))) expect(a.minRank, a.id).toBe(2);
  });

  it('a shift is five customers at every rank, its totals the shop’s prices', () => {
    for (let rank = 0; rank <= 4; rank++) {
      const plan = generateShift(c.pack, c.jobId, { rank, seed: 1234 + rank, dueWords: [], recent: [] });
      expect(plan.customers).toHaveLength(5);
      for (const cu of plan.customers) expect(cu.total, cu.templateId).toBe(total(menu, job.archetypes.find((a) => a.id === cu.templateId)!));
    }
  });

  it('every amount owed is heard back in digits, in words and as the staff’s own sentence; a near amount is not', () => {
    for (const a of job.archetypes) {
      for (const n of owed(menu, a)) {
        const digits = c.talk.amount(n);
        expect(c.talk.amountSaid(digits, n), `${a.id}: ${digits}`).toBe(true);
        expect(c.talk.amountSaid(c.words(n), n), `${a.id}: ${c.words(n)}`).toBe(true);
        expect(c.talk.amountSaid(c.talk.total(n), n), `${a.id}: ${c.talk.total(n)}`).toBe(true);
        expect(c.talk.amountSaid(c.talk.change(n), n), `${a.id}: ${c.talk.change(n)}`).toBe(true);
        expect(c.talk.amountSaid(`${c.words(n)} ${c.words(n + 100)}`, n), 'two amounts never pass').toBe(false);
        for (const wrong of nearAmounts(n)) expect(c.talk.amountSaid(c.talk.amount(wrong), n)).toBe(false);
      }
    }
  });

  it('the answer box’s example is nobody’s answer', () => {
    const ex = c.talk.example!;
    expect(ex).toBeTruthy();
    for (const a of job.archetypes) for (const n of owed(menu, a)) for (const x of [ex.digits, ex.words]) expect(c.talk.amountSaid(x, n), `${a.id}: ${x}`).toBe(false);
  });

  it('the tiles of a total are its words and the amount whole; the wrong tiles are near amounts', () => {
    for (const a of job.archetypes) {
      const n = total(menu, a);
      const pieces = c.talk.pieces(c.talk.total(n));
      expect(pieces).toContain(c.talk.amount(n));
      const wrong = c.talk.amountDistractors(n);
      expect(wrong).toHaveLength(2);
      for (const w of wrong) expect(pieces, `${a.id}: ${w}`).not.toContain(w);
    }
  });

  it('thanks: each accepted phrase passes typed any way; the wrong chips and the tiles’ wrong words do not', () => {
    for (const a of job.archetypes) {
      for (const t of a.thanks) {
        expect(c.talk.thanksSaid(t, a.thanks), `${a.id}: ${t}`).toBe(true);
        expect(c.talk.thanksSaid(t.toLowerCase().replace(/[!.,]/g, ''), a.thanks), `${a.id}: ${t} (lower case, no marks)`).toBe(true);
      }
      // the tiles teach the first phrase: its pieces in order, the two wrong words not among them
      const pieces = c.talk.pieces(a.thanks[0]!);
      for (const w of a.tiles ?? []) expect(pieces, a.id).not.toContain(w);
      expect(c.talk.thanksSaid(pieces.join(' '), a.thanks), a.id).toBe(true);
      for (const w of c.talk.thanksWrong) expect(c.talk.thanksSaid(w, a.thanks), `${a.id}: ${w}`).toBe(false);
    }
    // umlauts typed without a German keyboard
    if (c.talk.id === 'de') expect(c.talk.thanksSaid('danke schoen, schoenen abend noch', ['Danke schön! Schönen Abend noch!'])).toBe(true);
  });

  it('every word of the job is in the dictionary', () => {
    const lines: string[] = [c.talk.welcome, c.talk.helping, c.talk.placeholderThanks!, c.talk.changeWord, ...c.talk.thanksWrong, ...c.talk.ranks.map((r) => r.ja)];
    for (const l of [c.talk.refuse, c.talk.retry, ...Object.values(c.talk.bands), ...c.talk.rankUp]) if (l) lines.push(l.ja);
    for (const a of job.archetypes) {
      lines.push(a.line.ja, ...a.thanks, ...(a.tiles ?? []));
      for (const n of owed(menu, a)) lines.push(c.talk.total(n), c.talk.change(n));
    }
    const missing = new Set<string>();
    for (const l of lines) for (const m of tokenize(l, c.lex).missing) missing.add(`${m} (${l})`);
    expect([...missing]).toEqual([]);
  });

  it('customers speak in a woman’s and a man’s voice, each always the same one', () => {
    const voices = job.archetypes.map((a) => customerVoice(c.talk.id, a.id));
    expect(new Set(voices)).toEqual(new Set(['customer', 'customer_m']));
    for (const a of job.archetypes) expect(customerVoice(c.talk.id, a.id)).toBe(customerVoice(c.talk.id, a.id));
  });
});

describe('the shift’s language', () => {
  it('a German or Dutch price is one tile, the punctuation dropped', () => {
    expect(latinPieces('Das macht 3,50 €.')).toEqual(['Das', 'macht', '3,50 €']);
    expect(latinPieces('Dat is dan € 12,05.')).toEqual(['Dat', 'is', 'dan', '€ 12,05']);
    expect(latinPieces('Sie bekommen 1.234,50 € zurück.')).toEqual(['Sie', 'bekommen', '1.234,50 €', 'zurück']);
    expect(latinPieces('Danke schön! Schönen Abend noch!')).toEqual(['Danke', 'schön', 'Schönen', 'Abend', 'noch']);
  });

  it('Japanese is the konbini’s as it always was', () => {
    expect(JA_SHIFT_TALK.total(320)).toBe(`${yenToJa(320).markup}|です|。`);
    expect(JA_SHIFT_TALK.change(310)).toBe(`お釣り|は|${yenToJa(310).markup}|です|。`);
    expect(JA_SHIFT_TALK.pieces('ありがとうございました|。|また|どうぞ|。')).toEqual(['ありがとうございました', 'また', 'どうぞ']);
    expect(JA_SHIFT_TALK.amountSaid('sanbyakunijuuen', 320)).toBe(true);
    expect(JA_SHIFT_TALK.thanksSaid('arigatougozaimashita', ['ありがとうございました|。'])).toBe(true);
    expect(customerVoice('ja', 'k_basic')).toBe('customer');
  });

  it('German and Dutch say the total and the change the way a cashier does', () => {
    expect(DE_SHIFT_TALK.total(380)).toBe('Das macht 3,80 €.');
    expect(DE_SHIFT_TALK.change(120)).toBe('Sie bekommen 1,20 € zurück.');
    expect(NL_SHIFT_TALK.total(750)).toBe('Dat is dan € 7,50.');
    expect(NL_SHIFT_TALK.change(270)).toBe('U krijgt € 2,70 terug.');
    // 「einen Euro zwanzig」, the way the change is said back
    expect(DE_SHIFT_TALK.amountSaid('Sie bekommen einen Euro zwanzig zurück', 120)).toBe(true);
    expect(NL_SHIFT_TALK.amountSaid('een euro zeventig', 170)).toBe(true);
  });
});
