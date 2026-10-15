// Wave B1 adversarial review: regression tests for the content bugs the review found.
import { describe, expect, it } from 'vitest';
import { JP_PACK, LEXICON, tokenize } from '../src';
import { PHRASEBOOK } from '../src';
import { FRIENDS_SCENARIOS } from '../src/tokyo/scenarios-friends';
import { FRIENDS_POCKETS } from '../src/tokyo/game/pockets/pockets-friends';

/** every Japanese string of the hang-outs and visits: lines, chips, ideals, pocket lines */
function allJa(): string[] {
  const out: string[] = [];
  for (const sc of FRIENDS_SCENARIOS) {
    for (const n of Object.values(sc.nodes)) {
      n.say.forEach((v) => out.push(v.line.ja));
      [...(n.suggestions ?? []), ...Object.values(n.suggestionsByL1 ?? {}).flat()].forEach((s) => out.push(s.ja));
      for (const it of n.intents) {
        if (it.reply) out.push(it.reply.ja);
        if (it.ideal) out.push(it.ideal.ja);
      }
    }
  }
  for (const p of Object.values(FRIENDS_POCKETS)) out.push(p.line.ja);
  return out;
}

describe('counters whose reading changes are one token, so the furigana is right', () => {
  // 一曲 is いっきょく (not いちきょく); 一歳 いっさい, 八歳 はっさい, 十歳 じゅっさい, 十八歳 じゅうはっさい (not じゅうはちさい)
  const WRONG = [/(^|\|)一\|曲/, /(^|\|)[一八十]\|歳/, /十\|八\|歳/];
  it('no line, chip, ideal or pocket line splits an irregular counter into numeral tokens', () => {
    const bad = allJa().filter((ja) => WRONG.some((re) => re.test(ja)));
    expect(bad).toEqual([]);
  });
  it('no phrasebook key splits one either', () => {
    expect(PHRASEBOOK.some((e) => e.ja.includes('一曲')), 'the song request is in the phrasebook').toBe(true);
    expect(PHRASEBOOK.some((e) => e.ja.includes('十八歳')), 'the age answer is in the phrasebook').toBe(true);
    const bad = PHRASEBOOK.filter((e) => WRONG.some((re) => re.test(e.ja))).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('the compounds read as spoken', () => {
    const r = (s: string) => tokenize(s, LEXICON).tokens.map((t) => t.r ?? t.s).join('');
    expect(r('もう|一曲|お願いします。')).toContain('いっきょく');
    expect(r('十八歳|です。')).toContain('じゅうはっさい');
    expect(JP_PACK.id).toBe('jp');
  });
});

describe('hang_kenji_cook: the learner may say the step in the past', () => {
  it.each(['ねぎを切りました', 'スープに入れました'])('%s moves on to the tasting', async (text) => {
    const { ConversationSession, classifyInput } = await import('../../engine/src');
    const { CHARACTERS, scenarioById } = await import('../src');
    const scenario = scenarioById('hang_kenji_cook')!;
    let t = 0;
    const s = new ConversationSession({ scenario, character: CHARACTERS.find((c) => c.id === 'kenji')!, l1: 'en', profileName: 'レイラ', topics: [], flags: {}, now: () => (t += 4000) });
    s.start();
    for (const ing of [0, 0, 0]) s.pickSuggestion(ing);
    expect(s.nodeId).toBe('steps');
    const input = classifyInput(text);
    if (input.kind !== 'ja') throw new Error('expected Japanese');
    const r = s.submit({ text: input.text, mode: 'typed_ja' });
    expect(r.learner.matched).toBe(true);
    expect(s.nodeId).toBe('taste');
    expect(s.stepsDone.has('steps')).toBe(true);
  });
});
