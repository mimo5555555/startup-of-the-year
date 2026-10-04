import { describe, expect, it } from 'vitest';
import { hasKanji, kanaToRomaji } from '@lw/core';
import {
  CHARACTERS,
  LEXICON,
  LEXICON_ENTRIES,
  PHRASEBOOK,
  SCENARIOS,
  SIGNS,
  SLOTS,
  GREETINGS,
  REACTIONS,
  tokenize,
  type Line,
  type Scenario,
} from '../src';

const VAR = /\{(\w+)\}/g;

function markupVars(markup: string): string[] {
  return [...markup.matchAll(VAR)].map((m) => m[1]);
}

function checkMarkup(markup: string, where: string, errors: string[]) {
  // variables are resolved at run time; check the static tokens
  const stripped = markup
    .split('|')
    .filter((p) => !/^\{\w+\}$/.test(p))
    .join('|');
  const { missing } = tokenize(stripped, LEXICON);
  for (const m of missing) errors.push(`${where}: "${m}" is not in the lexicon`);
}

function allLines(sc: Scenario): Array<{ line: Line; where: string }> {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${sc.id}/${n.id}/say[${i}]` }));
    [...(n.suggestions ?? []), ...Object.values(n.suggestionsByL1 ?? {}).flat()].forEach((s, i) =>
      out.push({ line: s, where: `${sc.id}/${n.id}/suggestion[${i}]` }),
    );
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${sc.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${sc.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
}

describe('lexicon', () => {
  it('has a reading for every entry that contains kanji, and none that do not need one', () => {
    const bad = LEXICON_ENTRIES.filter((e) => hasKanji(e.s) && !e.r).map((e) => e.s);
    expect(bad).toEqual([]);
  });
  it('has English and Arabic glosses everywhere', () => {
    const bad = LEXICON_ENTRIES.filter((e) => !e.en.trim() || !e.ar.trim()).map((e) => e.s);
    expect(bad).toEqual([]);
  });
  it('gives sensible romaji for key words', () => {
    const rom = (s: string) => tokenize(s, LEXICON).tokens[0].rom;
    expect(rom('こんにちは')).toBe('konnichiwa');
    expect(rom('コーヒー')).toBe('kōhī');
    expect(rom('渋谷')).toBe('shibuya');
    expect(rom('は')).toBe('wa');
    expect(rom('を')).toBe('o');
    expect(kanaToRomaji('ありがとうございます')).toBe('arigatōgozaimasu');
  });
});

describe('scenarios', () => {
  it('only use dictionary words', () => {
    const errors: string[] = [];
    for (const sc of SCENARIOS) for (const { line, where } of allLines(sc)) checkMarkup(line.ja, where, errors);
    expect(errors).toEqual([]);
  });

  it('have complete English and Arabic for every line', () => {
    const errors: string[] = [];
    for (const sc of SCENARIOS) {
      for (const { line, where } of allLines(sc)) {
        if (!line.en.trim()) errors.push(`${where}: missing English`);
        if (!line.ar.trim()) errors.push(`${where}: missing Arabic`);
        if (/\p{Script=Han}|\p{Script=Hiragana}/u.test(line.en)) errors.push(`${where}: Japanese leaked into English`);
        // every {var} used in the Japanese must also be in the translations
        for (const v of markupVars(line.ja)) {
          if (!line.en.includes(`{${v}}`)) errors.push(`${where}: {${v}} missing from English`);
          if (!line.ar.includes(`{${v}}`)) errors.push(`${where}: {${v}} missing from Arabic`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('form a valid graph: nodes exist, start exists, end nodes are reachable', () => {
    const errors: string[] = [];
    for (const sc of SCENARIOS) {
      if (!sc.nodes[sc.start]) errors.push(`${sc.id}: start node missing`);
      const stepIds = new Set(sc.steps.map((s) => s.id));
      const reachable = new Set<string>([sc.start]);
      const queue = [sc.start];
      while (queue.length) {
        const n = sc.nodes[queue.pop()!];
        if (n.step && !stepIds.has(n.step)) errors.push(`${sc.id}/${n.id}: unknown step ${n.step}`);
        for (const it of n.intents) {
          if (it.step && !stepIds.has(it.step)) errors.push(`${sc.id}/${n.id}/${it.id}: unknown step ${it.step}`);
          if (it.next) {
            if (!sc.nodes[it.next]) errors.push(`${sc.id}/${n.id}/${it.id}: unknown next ${it.next}`);
            else if (!reachable.has(it.next)) {
              reachable.add(it.next);
              queue.push(it.next);
            }
          } else if (!it.stay) errors.push(`${sc.id}/${n.id}/${it.id}: intent has neither next nor stay`);
          if (it.stay && !it.reply) errors.push(`${sc.id}/${n.id}/${it.id}: stay intent without reply`);
          if (it.slot && !SLOTS[it.slot]) errors.push(`${sc.id}/${n.id}/${it.id}: unknown slot ${it.slot}`);
          for (const o of it.slotOptions ?? []) {
            if (!SLOTS[it.slot ?? '']?.some((x) => x.id === o)) errors.push(`${sc.id}/${n.id}/${it.id}: unknown slot option ${o}`);
          }
        }
      }
      for (const id of Object.keys(sc.nodes)) if (!reachable.has(id)) errors.push(`${sc.id}: node ${id} is unreachable`);
      const ends = Object.values(sc.nodes).filter((n) => n.end);
      if (!ends.length) errors.push(`${sc.id}: no end node`);
      for (const n of Object.values(sc.nodes)) {
        if (!n.end && n.intents.length === 0) errors.push(`${sc.id}/${n.id}: dead end (no intents, not an end node)`);
        if (!n.end && !(n.suggestions?.length || n.suggestionsByL1)) errors.push(`${sc.id}/${n.id}: no suggestions for a node that waits for the learner`);
      }
      // every goal step is achievable
      for (const st of sc.steps) {
        const used = Object.values(sc.nodes).some((n) => n.step === st.id || n.intents.some((i) => i.step === st.id));
        if (!used) errors.push(`${sc.id}: step ${st.id} can never be completed`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('use characters and locations that exist', () => {
    for (const sc of SCENARIOS) {
      const c = CHARACTERS.find((x) => x.id === sc.characterId);
      expect(c, sc.id).toBeTruthy();
      expect(c!.scenarioId).toBe(sc.id);
    }
  });
});

describe('phrasebook', () => {
  it('only produces Japanese the lexicon can display', () => {
    const errors: string[] = [];
    for (const p of PHRASEBOOK) checkMarkup(p.ja, `phrase ${p.id}`, errors);
    expect(errors).toEqual([]);
  });
  it('declares a slot whenever the Japanese or the patterns use one', () => {
    const errors: string[] = [];
    for (const p of PHRASEBOOK) {
      const jaVars = markupVars(p.ja);
      const enVars = new Set(p.en.flatMap(markupVars));
      const arVars = new Set(p.ar.flatMap(markupVars));
      if (jaVars.length > 1) errors.push(`${p.id}: more than one variable`);
      if (jaVars.length === 1) {
        if (p.slot !== jaVars[0]) errors.push(`${p.id}: slot should be ${jaVars[0]}`);
        if (p.en.some((s) => !s.includes(`{${jaVars[0]}}`))) errors.push(`${p.id}: an English pattern lacks the slot`);
        if (p.ar.some((s) => !s.includes(`{${jaVars[0]}}`))) errors.push(`${p.id}: an Arabic pattern lacks the slot`);
      } else if (enVars.size || arVars.size) errors.push(`${p.id}: patterns use a slot the Japanese does not`);
      if (p.slot && p.slot !== 'name' && !SLOTS[p.slot]) errors.push(`${p.id}: unknown slot ${p.slot}`);
      if (new Set(p.en).size !== p.en.length) errors.push(`${p.id}: duplicate English pattern`);
    }
    expect(errors).toEqual([]);
  });
  it('has unique ids', () => {
    const ids = PHRASEBOOK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('slots, signs and lesson', () => {
  it('slot options have keys in all three scripts', () => {
    for (const [name, opts] of Object.entries(SLOTS)) {
      for (const o of opts) {
        expect(o.keys.ja.length, `${name}/${o.id}`).toBeGreaterThan(0);
        expect(o.keys.en.length, `${name}/${o.id}`).toBeGreaterThan(0);
        expect(o.keys.ar.length, `${name}/${o.id}`).toBeGreaterThan(0);
      }
      expect(new Set(opts.map((o) => o.id)).size).toBe(opts.length);
    }
  });
  it('signs exist in the lexicon', () => {
    for (const s of SIGNS) expect(LEXICON.has(s.lex), s.id).toBe(true);
  });
  it('lesson cards and reactions are displayable', () => {
    const errors: string[] = [];
    for (const [i, c] of GREETINGS.cards.entries()) checkMarkup(c.ja, `lesson card ${i}`, errors);
    for (const [k, l] of Object.entries(REACTIONS)) checkMarkup(l.ja, `reaction ${k}`, errors);
    expect(errors).toEqual([]);
  });
  it('characters are complete', () => {
    expect(CHARACTERS).toHaveLength(6);
    for (const c of CHARACTERS) {
      expect(c.name.en && c.name.ar && c.name.ja).toBeTruthy();
      expect(c.interests.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('resolved lines', () => {
  it('capitalise a translation that starts with a filled-in word', async () => {
    const { resolveLine } = await import('../src');
    const l = resolveLine({ ja: '{item}|です|ね。', en: '{item}, got it.', ar: '{item}، حسنًا.' }, LEXICON, {
      item: { ja: 'コーヒー', gloss: { en: 'coffee', ar: 'قهوة' } },
    });
    expect(l.en).toBe('Coffee, got it.');
    expect(l.ar).toBe('قهوة، حسنًا.');
    expect(l.written).toBe('コーヒーですね。');
  });
});
