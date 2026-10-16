// Review fixes for wave B2 (own room): regression tests at the engine level. One describe per bug.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, type L1 } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks } from '../src';

function contract(l1: L1 = 'en') {
  const said: Array<number[] | undefined> = [];
  const game: SessionGameHooks = {
    vars: () => ({}),
    charge: () => ({ ok: true }),
    intent(kind, ctx) {
      if (kind === 'in_stock') return { ok: true };
      if (kind === 'say_total') {
        said.push(ctx.numbers);
        // the app's rule: any number the learner said may be the total
        return { ok: (ctx.numbers ?? (ctx.number !== undefined ? [ctx.number] : [])).includes(60000) };
      }
      return { ok: false };
    },
  };
  const scenario = scenarioById('aiko_contract')!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: CHARACTERS.find((c) => c.id === 'aiko')!, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), game, flags: { priced: true } });
  s.start();
  s.pickSuggestion(s.suggestions().findIndex((x) => x.written.includes('ここ')));
  return { s, said };
}
function say(s: ConversationSession, text: string) {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

describe('the total said after its parts is the total (「三万円と三万円で六万円です」)', () => {
  for (const text of ['三万円と三万円で六万円です', '三万円足す三万円は六万円です', '三万円と三万円で、全部で六万円です']) {
    it(text, () => {
      const { s, said } = contract();
      say(s, text);
      expect(s.nodeId).toBe('sign');
      expect(said[0]).toEqual([30000, 30000, 60000]);
    });
  }
  it('the parts alone, or a wrong sum after them, are still wrong', () => {
    for (const text of ['三万円と三万円です', '三万円と三万円で五万円です', '三万円と三万円で九万円です']) {
      const { s } = contract();
      say(s, text);
      expect(s.nodeId, text).toBe('wrong_total');
    }
  });
});

describe('Arabic: the total in the spellings an Arabic keyboard gives', () => {
  for (const text of ['ستين ألف ين', 'المجموع ستين ألف ين', '٦٠٠٠٠ ين', '٦٠٬٠٠٠ ين', '60,000 ين']) {
    it(text, () => {
      const { s } = contract('ar');
      say(s, text);
      expect(s.nodeId).toBe('sign');
    });
  }
});
