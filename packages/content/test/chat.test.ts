// Phone chat templates (agent 4B-b, docs/GAME_DESIGN.md §8.7): the five P0 text threads. Every chip is understood at every node, every
// thread is completable by tapping chips alone (in every register and for every friend), typed Japanese, romaji, English and Arabic
// work, every line is displayable and has EN + AR, and the ScenarioMeta is wired.
import { describe, expect, it } from 'vitest';
import type { IntentDef, L1, Line, Scenario } from '../src';
import { CHARACTERS, JP_PACK, LEXICON, PHRASEBOOK, SCENARIOS, SLOTS, scenarioById, tokenize } from '../src';
import { ConversationSession, classifyInput, type SessionOptions, type SubmitResult } from '../../engine/src';
import { CHAT_SCENARIOS } from '../src/tokyo/scenarios-chat';
import { CHAT_META } from '../src/tokyo/game/meta/meta-chat';
import { SOCIAL_CHAT_LEXICON } from '../src/lexicon/social-chat';
import { SOCIAL_CHAT_PHRASES } from '../src/phrasebook/social-chat';

const IDS = ['chat_first', 'chat_greet', 'chat_plan', 'chat_food', 'chat_miss'];
const FRIENDS = ['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako'];

const linesOf = (sc: Scenario): Array<{ line: Line; where: string }> => {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${sc.id}/${n.id}/say[${i}]` }));
    (n.suggestions ?? []).forEach((s, i) => out.push({ line: s, where: `${sc.id}/${n.id}/chip[${i}]` }));
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${sc.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${sc.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
};

/** the flags the host sets for a thread with `friend` (see scenarios-chat.ts) */
const flagsFor = (friend: string | null, plain: boolean): Record<string, boolean> => {
  if (!friend) return plain ? { casual: true } : {};
  return { [`f_${friend}`]: true, ...(plain ? { casual: true, [`fc_${friend}`]: true } : {}) };
};
const REGISTERS: Array<[string, Record<string, boolean>]> = [
  ['no flags (polite)', {}],
  ['casual, no friend', flagsFor(null, true)],
  ...FRIENDS.map((f): [string, Record<string, boolean>] => [`${f}, polite`, flagsFor(f, false)]),
  ...['mio', 'yuki', 'kenji'].map((f): [string, Record<string, boolean>] => [`${f}, plain`, flagsFor(f, true)]),
];

function open(id: string, l1: L1, flags: Record<string, boolean>, extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === 'mio')!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], flags: { ...flags }, now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

function say(s: ConversationSession, text: string): SubmitResult {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

/** Picks every suggestion at every reachable node; the friend must always understand it and answer with a displayable line. */
function walk(id: string, l1: L1, flags: Record<string, boolean>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const ended = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(id, l1, flags);
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    s.suggestions().forEach((sg, i) => {
      if (sg.tokens.some((t) => t.s === '…' && !t.punct)) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i}: the friend's answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the friend's answer has a token without gloss`);
      if (r.ended) ended.add(`${s.nodeId}/#${i}`);
      else if (r.learner.matched) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, visited, ended };
}

describe('chat templates: registration', () => {
  it('registers the five P0 templates with unique ids and the pack lists them as chat scenarios', () => {
    expect(CHAT_SCENARIOS.map((s) => s.id)).toEqual(IDS);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    for (const id of IDS) expect(scenarioById(id), id).toBeTruthy();
    const kinds = JP_PACK.scenarioMeta.filter((m) => m.kind === 'chat').map((m) => m.id);
    for (const id of IDS) expect(kinds).toContain(id);
  });

  it('wires ScenarioMeta: kind chat, pay none, band A1/A2, goal-step and culture ids that exist', () => {
    expect(CHAT_META.map((m) => m.id)).toEqual(IDS);
    for (const m of CHAT_META) {
      const sc = scenarioById(m.id)!;
      expect(m.kind).toBe('chat');
      expect(m.pay).toBe('none');
      expect(['A1', 'A2']).toContain(m.band);
      expect(m.band).toBe(sc.level);
      expect(m.shop).toBeUndefined();
      for (const c of m.culture ?? []) expect(JP_PACK.culture.some((x) => x.id === c), `${m.id}: culture ${c}`).toBe(true);
    }
  });
});

describe('chat templates: content', () => {
  it('uses only dictionary words and has EN and AR for every line, with matching {variables}', () => {
    const errors: string[] = [];
    for (const sc of CHAT_SCENARIOS) {
      expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar, sc.id).toBeTruthy();
      for (const st of sc.steps) if (!st.text.en || !st.text.ar) errors.push(`${sc.id}/${st.id}: step text`);
      for (const { line, where } of linesOf(sc)) {
        const { missing } = tokenize(line.ja, LEXICON, Object.fromEntries([...line.ja.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], { ja: 'x', raw: true }])));
        if (missing.length) errors.push(`${where}: not in the lexicon: ${missing.join(' ')}`);
        if (!line.en.trim() || !line.ar.trim()) errors.push(`${where}: missing EN/AR`);
        if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(line.en)) errors.push(`${where}: Japanese in English`);
        for (const v of line.ja.matchAll(/\{(\w+)\}/g)) {
          if (!line.en.includes(`{${v[1]}}`) || !line.ar.includes(`{${v[1]}}`)) errors.push(`${where}: {${v[1]}} missing in a translation`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('has a valid graph: every node reachable, every target exists, steps are achievable, ends exist, every waiting node has 2+ chips', () => {
    for (const sc of CHAT_SCENARIOS) {
      expect(sc.nodes[sc.start], sc.id).toBeTruthy();
      expect(sc.level === 'A1' || sc.level === 'A2').toBe(true);
      const steps = new Set(sc.steps.map((s) => s.id));
      const seen = new Set([sc.start]);
      const queue = [sc.start];
      while (queue.length) {
        const n = sc.nodes[queue.shift()!];
        if (n.step) expect(steps.has(n.step), `${sc.id}/${n.id} step`).toBe(true);
        if (n.end) expect(n.intents, `${sc.id}/${n.id}`).toEqual([]);
        else {
          expect(n.intents.length, `${sc.id}/${n.id} intents`).toBeGreaterThan(0);
          expect(n.suggestions?.length ?? 0, `${sc.id}/${n.id} chips`).toBeGreaterThanOrEqual(2);
        }
        for (const it of n.intents as IntentDef[]) {
          if (it.step) expect(steps.has(it.step), `${sc.id}/${n.id}/${it.id} step`).toBe(true);
          if (!it.next) throw new Error(`${sc.id}/${n.id}/${it.id}: no next`);
          expect(sc.nodes[it.next], `${sc.id}/${n.id}/${it.id} -> ${it.next}`).toBeTruthy();
          if (it.slot) {
            expect(SLOTS[it.slot], `${sc.id}: slot ${it.slot}`).toBeTruthy();
            for (const o of it.slotOptions ?? []) expect(SLOTS[it.slot].some((x) => x.id === o)).toBe(true);
          }
          if (!seen.has(it.next)) {
            seen.add(it.next);
            queue.push(it.next);
          }
        }
      }
      expect([...seen].sort(), sc.id).toEqual(Object.keys(sc.nodes).sort());
      expect(Object.values(sc.nodes).some((n) => n.end), sc.id).toBe(true);
      for (const st of sc.steps) {
        expect(Object.values(sc.nodes).some((n) => n.step === st.id || n.intents.some((i) => i.step === st.id)), `${sc.id}: step ${st.id}`).toBe(true);
      }
    }
  });

  it('keeps its lexicon, phrases and slots well-formed (readings for kanji, glosses, unique ids, displayable Japanese)', () => {
    for (const e of SOCIAL_CHAT_LEXICON) {
      expect(!!e.r, `${e.s} reading`).toBe(/\p{Script=Han}/u.test(e.s));
      expect(e.en && e.ar, e.s).toBeTruthy();
    }
    const ids = SOCIAL_CHAT_PHRASES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SOCIAL_CHAT_PHRASES) {
      expect(p.id.startsWith('chat_'), p.id).toBe(true);
      expect(PHRASEBOOK.some((x) => x.id === p.id), p.id).toBe(true);
      const vars = Object.fromEntries([...p.ja.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], { ja: 'x', raw: true }]));
      expect(tokenize(p.ja, LEXICON, vars).missing, p.id).toEqual([]);
      expect(p.en.length && p.ar.length, p.id).toBeTruthy();
    }
  });
});

describe('chat templates: every chip is understood, in every register and both languages', () => {
  for (const id of IDS) {
    for (const [label, flags] of REGISTERS) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${id}, ${label}, ${l1}`, () => {
          const r = walk(id, l1, flags);
          expect(r.problems).toEqual([]);
          expect(r.ended.size).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe('chat templates: completable by tapping suggestions only', () => {
  /** Taps the first chip at every node until the thread ends; returns the goal steps done and the node trail. */
  const tapFirst = (id: string, flags: Record<string, boolean>, pick: (node: string, n: number) => number = () => 0) => {
    const s = open(id, 'en', flags);
    const trail = [s.nodeId];
    for (let guard = 0; guard < 12 && !s.ended; guard++) {
      s.pickSuggestion(pick(s.nodeId, s.suggestions().length));
      trail.push(s.nodeId);
    }
    return { s, trail };
  };

  for (const id of IDS) {
    it(`${id}: first chips reach an end with at least one goal step`, () => {
      for (const [, flags] of REGISTERS) {
        const { s } = tapFirst(id, flags);
        expect(s.ended, id).toBe(true);
        expect(s.stepsDone.size, id).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it('chat_first: yes then a colour completes both steps', () => {
    const { s } = tapFirst('chat_first', {});
    expect([...s.stepsDone].sort()).toEqual(['colour', 'reply']);
    expect(s.remembered['purchase:phone']).toBe('phone');
  });

  it('chat_first: naming the colour at once also completes both steps', () => {
    const s = open('chat_first', 'en', {});
    s.pickSuggestion(1);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['colour', 'reply']);
    s.pickSuggestion(1);
    expect(s.ended).toBe(true);
  });

  it('chat_greet: plan, "and you?", the friend names their place, goodbye', () => {
    for (const f of FRIENDS) {
      const s = open('chat_greet', 'en', flagsFor(f, ['mio', 'yuki', 'kenji'].includes(f)));
      s.pickSuggestion(0);
      s.pickSuggestion(1);
      expect(s.nodeId).toBe('mine');
      const place = { mio: '公園', yuki: 'カフェ', tanaka: 'コンビニ', kenji: 'ラーメン屋', sato: '駅', hanako: '学校' }[f]!;
      expect(s.turns.at(-1)!.line.written, f).toContain(place);
      s.pickSuggestion(0);
      expect(s.ended).toBe(true);
      expect([...s.stepsDone].sort()).toEqual(['plan', 'react']);
    }
  });

  it('chat_plan: yes, a time, done (each friend names their own place; plain forms switch with the casual flag)', () => {
    for (const f of FRIENDS) {
      const plain = ['mio', 'yuki', 'kenji'].includes(f);
      const s = open('chat_plan', 'en', flagsFor(f, plain));
      const first = s.turns[0].line.written;
      expect(first, f).toContain({ mio: '公園', yuki: 'カフェ', tanaka: 'コンビニ', kenji: 'ラーメン屋', sato: '駅', hanako: '学校' }[f]!);
      expect(first.includes('ませんか'), f).toBe(!plain);
      expect(first.includes('わない'), f).toBe(plain);
      s.pickSuggestion(0);
      expect(s.nodeId).toBe('time');
      s.pickSuggestion(0);
      expect(s.ended).toBe(true);
      expect([...s.stepsDone].sort()).toEqual(['reply', 'time']);
    }
  });

  it('chat_plan: asking the time works, and a polite refusal is a goal step', () => {
    const a = open('chat_plan', 'en', {});
    a.pickSuggestion(2);
    expect(a.nodeId).toBe('time');
    const b = open('chat_plan', 'en', {});
    b.pickSuggestion(1);
    expect(b.nodeId).toBe('decline_ok');
    expect(b.stepsDone.has('reply')).toBe(true);
    b.pickSuggestion(0);
    expect(b.ended).toBe(true);
  });

  it('chat_food: a food is remembered as favFood; the answer finishes the thread', () => {
    for (const [i, id] of ['ramen', 'onigiri', 'sandwich'].entries()) {
      const s = open('chat_food', 'en', {});
      s.pickSuggestion(i);
      expect(s.remembered.favFood).toBe(id);
      expect(s.turns.at(-1)!.line.written).toContain(SLOTS.chatfood.find((o) => o.id === id)!.ja);
      s.pickSuggestion(0);
      expect([...s.stepsDone].sort()).toEqual(['food', 'react']);
      s.pickSuggestion(1);
      expect(s.ended).toBe(true);
    }
  });

  it('chat_miss: any friendly reply ends the thread with the goal step', () => {
    for (let i = 0; i < 3; i++) {
      const s = open('chat_miss', 'ar', {});
      s.pickSuggestion(i);
      expect(s.stepsDone.has('reply')).toBe(true);
      s.pickSuggestion(1);
      expect(s.ended).toBe(true);
    }
  });
});

describe('chat templates: typed Japanese, romaji, English and Arabic', () => {
  const run = (id: string, flags: Record<string, boolean>, texts: string[]) => {
    const s = open(id, 'en', flags);
    for (const t of texts) {
      const r = say(s, t);
      expect(r.learner.matched, `${id}: "${t}" at ${s.nodeId}`).toBe(true);
    }
    return s;
  };

  it('chat_first', () => {
    expect(run('chat_first', {}, ['はい、買いました！', '黒いスマホです', 'こちらこそ']).ended).toBe(true);
    expect(run('chat_first', {}, ['hai kaimashita', 'shiroi sumaho desu', 'arigatou']).ended).toBe(true);
    expect(run('chat_first', {}, ['yes i bought one', 'it is a blue phone', 'thank you']).ended).toBe(true);
  });
  it('chat_plan', () => {
    expect(run('chat_plan', { casual: true }, ['いいよ！', '三時に行きます']).ended).toBe(true);
    expect(run('chat_plan', {}, ['nanji desu ka', 'wakarimashita']).ended).toBe(true);
    expect(run('chat_plan', {}, ['sorry today is a bit difficult', 'thank you']).ended).toBe(true);
    expect(run('chat_plan', {}, ['what time']).nodeId).toBe('time');
  });
  it('chat_food', () => {
    expect(run('chat_food', {}, ['ラーメンを食べました', 'おいしかったです', 'またね']).ended).toBe(true);
    expect(run('chat_food', {}, ['i ate sushi', 'it was very good', 'see you']).ended).toBe(true);
    expect(run('chat_food', {}, ['ra-men o tabemashita', 'hai', 'arigatou']).ended).toBe(true);
  });
  it('chat_greet and chat_miss', () => {
    expect(run('chat_greet', {}, ['学校に行きます', 'ありがとう']).ended).toBe(true);
    expect(run('chat_greet', {}, ['i will go shopping', 'and you']).nodeId).toBe('mine');
    expect(run('chat_miss', {}, ['genki desu', 'mata ne']).ended).toBe(true);
    expect(run('chat_miss', {}, ['元気です。あなたは？', 'ありがとう']).ended).toBe(true);
    expect(run('chat_miss', {}, ['ちょっと疲れています', 'ありがとう']).ended).toBe(true);
  });

  it('every chip can also be typed in English and in Arabic', () => {
    const errors: string[] = [];
    for (const id of IDS) {
      for (const l1 of ['en', 'ar'] as const) {
        const seen = new Set<string>();
        const visit = (path: number[]) => {
          const s = open(id, l1, {});
          for (const i of path) s.pickSuggestion(i);
          if (s.ended || seen.has(s.nodeId)) return;
          seen.add(s.nodeId);
          s.suggestions().forEach((sg, i) => {
            const t = open(id, l1, {});
            for (const p of path) t.pickSuggestion(p);
            const text = l1 === 'ar' ? sg.ar : sg.en;
            let r: SubmitResult | null = null;
            try {
              r = say(t, text);
            } catch {
              errors.push(`${id}/${s.nodeId} ${l1}: "${text}" is not covered by the phrasebook`);
            }
            if (r && !r.learner.matched) errors.push(`${id}/${s.nodeId} ${l1}: "${text}" was not understood`);
            visit([...path, i]);
          });
        };
        visit([]);
      }
    }
    expect(errors).toEqual([]);
  });
});
