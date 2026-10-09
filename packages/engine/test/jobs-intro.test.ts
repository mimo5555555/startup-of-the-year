// job_konbini_intro (agent 4D, docs/GAME_DESIGN.md §9.1): Tanaka offers the konbini job. Every chip is understood at every node, the whole
// intro is completable by tapping chips alone (the polite way out too), typed Japanese in the other scripts works, and every pocket and
// phrasebook line of the module is language an intent accepts.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, type L1 } from '@lw/content';
import { ConversationSession, classifyInput, type SessionOptions, type SubmitResult } from '../src';
import { JOBS_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-jobs';
import { JOBS_PHRASES } from '../../content/src/phrasebook/jobs';

function open(l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById('job_konbini_intro')!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
};

function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}

describe('job_konbini_intro: every chip is understood', () => {
  for (const l1 of ['en', 'ar'] as const) {
    it(`at every reachable node, ${l1}`, () => {
      const problems: string[] = [];
      const visited = new Set<string>();
      const replay = (path: number[]) => {
        const s = open(l1);
        for (const i of path) s.pickSuggestion(i);
        return s;
      };
      const visit = (path: number[]) => {
        const s = replay(path);
        const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
        if (visited.has(key) || s.ended) return;
        visited.add(key);
        const sugg = s.suggestions();
        if (sugg.length < 2) problems.push(`${s.nodeId}: fewer than 2 suggestions`);
        sugg.forEach((sg, i) => {
          if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
          const r = replay(path).pickSuggestion(i);
          if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
          else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
          if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: Tanaka's answer has a token without gloss`);
          if (r.learner.matched && !r.ended) visit([...path, i]);
        });
      };
      visit([]);
      expect(problems).toEqual([]);
      const seen = new Set([...visited].map((k) => k.split('|')[0]));
      for (const n of ['start', 'explain', 'accept', 'thanks']) expect(seen.has(n), n).toBe(true);
    });
  }
});

describe('job_konbini_intro: by tapping chips alone', () => {
  it('accept straight away, greet, thank: every goal step done and the conversation ends well', () => {
    const s = open();
    tap(s, ['やります', 'いらっしゃいませ', 'ありがとうございました']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['accept', 'greet', 'thanks']);
    expect(s.summary().goalDone).toBe(3);
  });

  it('ask what the work is first, then accept', () => {
    const s = open();
    tap(s, ['どんな']);
    expect(s.nodeId).toBe('explain');
    tap(s, ['やります', 'いらっしゃいませ', 'ありがとうございました']);
    expect(s.nodeId).toBe('done');
    expect(s.summary().goalDone).toBe(3);
  });

  it('the polite way out (また来ます / 考えます) ends at leave with no step done', () => {
    const a = open();
    tap(a, ['また']);
    expect(a.nodeId).toBe('leave');
    expect(a.ended).toBe(true);
    expect(a.stepsDone.size).toBe(0);
    const b = open();
    tap(b, ['どんな', '考えます']);
    expect(b.nodeId).toBe('leave');
    expect(b.stepsDone.size).toBe(0);
  });

  it('declining midway keeps the steps already done, so a replay counts them', () => {
    const s = open();
    tap(s, ['やります']);
    say(s, 'また来ます');
    expect(s.nodeId).toBe('leave');
    expect(s.stepsDone.has('accept')).toBe(true);
    expect(s.stepsDone.has('thanks')).toBe(false);
  });
});

describe('job_konbini_intro: typed language', () => {
  it('hiragana, kanji-free and romaji answers are accepted; so are English sentences the phrasebook knows', () => {
    const s = open();
    expect(say(s, 'はい、やります').learner.matched).toBe(true);
    expect(s.nodeId).toBe('accept');
    expect(say(s, 'irasshaimase').learner.matched).toBe(true);
    expect(s.nodeId).toBe('thanks');
    expect(say(s, 'arigatou gozaimashita').learner.matched).toBe(true);
    expect(s.nodeId).toBe('done');
    const t = open();
    expect(say(t, 'yes i will do it').learner.matched).toBe(true);
    expect(t.nodeId).toBe('accept');
    expect(say(t, 'welcome').learner.matched).toBe(true);
    expect(t.nodeId).toBe('thanks');
    expect(say(t, 'thank you very much').learner.matched).toBe(true);
    expect(t.nodeId).toBe('done');
  });

  it('an unrelated sentence gets a gentle fallback, never an error, and the chips stay', () => {
    const s = open();
    const r = say(s, '天気がいいです');
    expect(r.character.line.written.length).toBeGreaterThan(0);
    expect(s.ended).toBe(false);
    expect(s.suggestions().length).toBeGreaterThanOrEqual(2);
  });
});

describe('job_konbini_intro: pockets and phrasebook', () => {
  const stages: Array<[string[], string]> = [
    [[], 'start'],
    [['やります'], 'accept'],
    [['やります', 'いらっしゃいませ'], 'thanks'],
  ];
  const accepted = (text: string): boolean =>
    stages.some(([taps, node]) => {
      const s = open();
      tap(s, taps);
      if (s.nodeId !== node) return false;
      const r = s.submit({ text, mode: 'typed_ja' });
      return r.learner.matched && r.character.kind !== 'fallback';
    });

  it('every pocket line is language an intent accepts at some node', () => {
    for (const p of Object.values(JOBS_POCKETS)) expect(accepted(p.line.ja.replace(/\|/g, '')), p.id).toBe(true);
  });

  it('every phrasebook line of the module is language the scenario accepts at some node', () => {
    for (const p of JOBS_PHRASES) expect(accepted(p.ja.replace(/\|/g, '')), p.id).toBe(true);
  });
});
