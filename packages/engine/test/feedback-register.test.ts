import { describe, expect, it } from 'vitest';
import { BALANCE, type LanguagePlugin, type Register } from '@lw/game';
import { CHARACTERS, SCENARIOS, scenarioById, type L1 } from '@lw/content';
import { JP_LANGUAGE } from '../../content/src/tokyo/game/jp-language';
import { ConversationSession, evaluateSession, type Correction, type FeedbackOptions } from '../src';

const MARKERS: LanguagePlugin['registerMarkers'] = JP_LANGUAGE.registerMarkers;

function open(id: string, l1: L1 = 'en'): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'Layla', topics: [], now: () => (t += 4000) });
  s.start();
  return s;
}

/** a session where the learner typed `texts` (independent turns) */
function typed(id: string, texts: string[], mode: 'typed_ja' | 'speech_ja' = 'typed_ja'): ConversationSession {
  const s = open(id);
  for (const text of texts) s.submit({ text, mode });
  return s;
}

const register = (cs: Correction[]) => cs.filter((c) => c.kind === 'register');
const staff: FeedbackOptions = { register: 'polite', friend: false, markers: MARKERS };
const friend: FeedbackOptions = { register: 'casual', friend: true, markers: MARKERS };
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

describe('casualWithStaff', () => {
  it('flags a casual ending with staff as a register correction, EN + AR, with the polite rewrite', () => {
    // 'だいじょうぶだよ' at the "anything else?" node: not a request, so only the register rule speaks
    const s = typed('cafe', ['コーヒーをください', 'ホットをください', 'だいじょうぶだよ']);
    const f = evaluateSession(s, staff);
    const c = register(f.corrections)[0];
    expect(c).toBeDefined();
    expect(c.category).toBe('naturalness');
    expect(c.kind).toBe('register');
    expect(c.severity).toBe(1);
    expect(c.soft).toBeUndefined();
    expect(c.original).toBe('だいじょうぶだよ');
    expect(c.span).toEqual([6, 8]);
    expect(c.original.slice(...c.span)).toBe('だよ');
    expect(c.better).toBe('だいじょうぶですよ');
    expect(c.explanation.en).toContain('だよ');
    expect(c.explanation.en).toContain('polite');
    expect(hasArabic(c.explanation.ar)).toBe(true);
    expect(c.explanation.ar).toContain('だよ');
  });

  it('costs accuracy like any other correction, and shows up in focusNext', () => {
    const clean = evaluateSession(typed('cafe', ['コーヒーをください', 'ホットをください', 'だいじょうぶです']), staff);
    const plain = evaluateSession(typed('cafe', ['コーヒーをください', 'ホットをください', 'だいじょうぶだよ']), staff);
    expect(register(clean.corrections)).toEqual([]);
    expect(plain.scores.accuracy!).toBeLessThan(clean.scores.accuracy!);
    expect(plain.focusNext[0].en).toContain('Sounding natural');
  });

  it('keigo settings explain it as a formal setting', () => {
    const f = evaluateSession(typed('cafe', ['コーヒーをください', 'ホットをください', 'だいじょうぶだよ']), { ...staff, register: 'keigo' });
    const c = register(f.corrections)[0];
    expect(c.explanation.en).toContain('formal');
    expect(hasArabic(c.explanation.ar)).toBe(true);
  });

  it('a plain request (ちょうだい) stays the bare-request correction: requests without ください keep today\'s flag', () => {
    const f = evaluateSession(typed('cafe', ['コーヒーちょうだい']), staff);
    expect(f.corrections).toHaveLength(1);
    expect(f.corrections[0].better).toBe('コーヒーをください。');
    expect(f.corrections[0].kind).toBeUndefined();
  });

  it('with a friend, or a casual register, plain speech is correct: nothing', () => {
    for (const o of [friend, { ...staff, friend: true }, { ...staff, register: 'casual' as Register }]) {
      const f = evaluateSession(typed('cafe', ['だいじょうぶだよ', 'いいよ', 'うん、ありがとう']), o);
      expect(register(f.corrections), JSON.stringify(o)).toEqual([]);
    }
  });

  it('is conservative: a short marker inside a longer polite word is not a hit', () => {
    // くれ in くれました, うん in うんてん (keigo marker list), だよ in ただよう
    for (const text of ['友達がくれました', 'うんてんします', 'ただようにおいですね']) {
      for (const r of ['polite', 'keigo'] as const) {
        const f = evaluateSession(typed('cafe', [text]), { ...staff, register: r });
        expect(register(f.corrections), `${r} ${text}`).toEqual([]);
      }
    }
  });

  it('a following sentence particle still counts: いいよね is casual', () => {
    const f = evaluateSession(typed('cafe', ['いいよね']), { ...staff, register: 'keigo' });
    expect(register(f.corrections)).toHaveLength(1);
  });

  it('polite lines with polite markers raise nothing', () => {
    for (const text of ['ありがとうございます', 'カードでお願いします', 'すみません、これをください', 'かしこまりました']) {
      for (const r of ['polite', 'keigo'] as const) {
        expect(register(evaluateSession(typed('cafe', [text]), { ...staff, register: r }).corrections), `${r} ${text}`).toEqual([]);
      }
    }
  });

  it('per-scenario casual markers add to the pack list', () => {
    const none = evaluateSession(typed('cafe', ['それはいいわよ']), staff);
    const some = evaluateSession(typed('cafe', ['それはいいわよ']), { ...staff, casualMarkers: ['わよ'] });
    expect(register(none.corrections)).toEqual([]);
    expect(register(some.corrections)).toHaveLength(1);
  });
});

describe('stiffWithFriend', () => {
  it('keigo with a friend who switched to plain speech is a soft note: "distant, not wrong"', () => {
    const f = evaluateSession(typed('park', ['ありがとうございます']), friend);
    const c = register(f.corrections)[0];
    expect(c).toBeDefined();
    expect(c.soft).toBe(true);
    expect(c.better).toBe('ありがとう');
    expect(c.explanation.en).toContain('not wrong');
    expect(c.explanation.en).toContain('distant');
    expect(hasArabic(c.explanation.ar)).toBe(true);
  });

  it('costs no accuracy and does not spoil the praise, since it is not a mistake', () => {
    const stiff = evaluateSession(typed('park', ['はじめまして、ありがとうございます']), friend);
    const plain = evaluateSession(typed('park', ['はじめまして、ありがとう']), friend);
    expect(register(stiff.corrections)).toHaveLength(1);
    expect(stiff.scores.accuracy).toBe(plain.scores.accuracy);
    expect(stiff.focusNext.some((x) => x.en.includes('distant'))).toBe(false);
  });

  it('a real mistake outranks a soft note when only some fit', () => {
    const f = evaluateSession(typed('park', ['ありがとうございます', 'これがください']), friend);
    expect(f.corrections[0].soft).toBeUndefined();
    expect(f.corrections.some((c) => c.soft)).toBe(true);
  });

  it('polite (です/ます) with a friend is not flagged: only the keigo forms are', () => {
    const f = evaluateSession(typed('park', ['はい、そうです', 'すきです', 'ありがとうございます']), friend);
    expect(register(f.corrections)).toHaveLength(1);
    expect(register(f.corrections)[0].original).toBe('ありがとうございます');
  });

  it('per-scenario polite markers add to the pack list', () => {
    const f = evaluateSession(typed('park', ['そうでしょうか']), { ...friend, politeMarkers: ['でしょうか'] });
    expect(register(f.corrections)).toHaveLength(1);
    expect(register(f.corrections)[0].soft).toBe(true);
  });

  it('the friend register overrides the scenario: the same line is fine to staff', () => {
    const line = 'ありがとうございます';
    expect(register(evaluateSession(typed('cafe', [line]), staff).corrections)).toEqual([]);
    expect(register(evaluateSession(typed('cafe', [line]), { ...staff, register: 'casual', friend: true }).corrections)).toHaveLength(1);
  });
});

describe('speech turns below the correction confidence (§11.4)', () => {
  const text = 'いいよ、だいじょうぶだよ';
  const speech = (conf?: number, extra: Partial<FeedbackOptions> = {}) => {
    const s = typed('cafe', ['コーヒーをください', 'ホットをください', text], 'speech_ja');
    const turn = s.turns.filter((t) => t.speaker === 'learner')[2];
    return { s, f: evaluateSession(s, { ...staff, ...(conf === undefined ? {} : { speechConfidence: { [turn.id]: conf } }), ...extra }), turn };
  };

  it('the 0.8 threshold is BALANCE.speech.correctionConfidence', () => {
    expect(BALANCE.speech.correctionConfidence).toBe(0.8);
  });

  it('below 0.8: no correction, the finding is a "maybe" note instead', () => {
    for (const conf of [0.79, 0.5, 0.45, 0]) {
      const { f } = speech(conf);
      expect(f.corrections, String(conf)).toEqual([]);
      expect(f.maybe).toHaveLength(1);
      expect(f.maybe![0].kind).toBe('register');
      expect(f.maybe![0].explanation.en.length).toBeGreaterThan(0);
    }
  });

  it('at 0.8 and above: a normal correction, no maybe', () => {
    for (const conf of [0.8, 0.95, 1]) {
      const { f } = speech(conf);
      expect(register(f.corrections), String(conf)).toHaveLength(1);
      expect(f.maybe).toEqual([]);
    }
  });

  it('a maybe note costs no accuracy: the same turn at 0.5 scores like a clean run', () => {
    const clean = evaluateSession(typed('cafe', ['コーヒーをください', 'ホットをください', 'だいじょうぶです'], 'speech_ja'), staff);
    expect(speech(0.5).f.scores.accuracy).toBe(clean.scores.accuracy);
    expect(speech(0.95).f.scores.accuracy!).toBeLessThan(clean.scores.accuracy!);
  });

  it('applies to every rule, not just register: a bare request heard at 0.5 is a maybe', () => {
    const s = typed('cafe', ['コーヒー'], 'speech_ja');
    const turn = s.turns.filter((t) => t.speaker === 'learner')[0];
    const low = evaluateSession(s, { speechConfidence: { [turn.id]: 0.5 } });
    expect(low.corrections).toEqual([]);
    expect(low.maybe).toHaveLength(1);
    expect(low.maybe![0].better).toBe('コーヒーをください。');
    expect(evaluateSession(s, { speechConfidence: { [turn.id]: 0.9 } }).corrections).toHaveLength(1);
  });

  it('honours a stricter policy from the caller (BALANCE.speech injected)', () => {
    const { f } = speech(0.85, { speechPolicy: { ...BALANCE.speech, correctionConfidence: 0.9 } });
    expect(f.corrections).toEqual([]);
    expect(f.maybe).toHaveLength(1);
  });

  it('typed turns ignore the confidence map', () => {
    const s = typed('cafe', ['コーヒー']);
    const turn = s.turns.filter((t) => t.speaker === 'learner')[0];
    expect(evaluateSession(s, { speechConfidence: { [turn.id]: 0.1 } }).corrections).toHaveLength(1);
  });

  it('a speech turn with no known confidence is not penalised for it (the pre-register behaviour)', () => {
    const f = speech(undefined).f;
    expect(register(f.corrections)).toHaveLength(1);
    expect(f.maybe).toEqual([]);
  });

  it('reads Turn.confidence when the session records it', () => {
    const { s, f: before } = speech(undefined);
    expect(register(before.corrections)).toHaveLength(1);
    const turn = s.turns.filter((t) => t.speaker === 'learner')[2] as typeof s.turns[number] & { confidence?: number };
    turn.confidence = 0.6;
    const f = evaluateSession(s, staff);
    expect(f.corrections.filter((c) => c.turnId === turn.id)).toEqual([]);
    expect(f.maybe).toHaveLength(1);
  });
});

describe('existing outputs are unchanged', () => {
  const strip = (r: ReturnType<typeof evaluateSession>) => ({ ...r, maybe: undefined });

  it('the legacy wording rules behave as before with and without options (ありがとう / ごめん with staff and with Mio)', () => {
    for (const [id, texts] of [
      ['cafe', ['ありがとう']],
      ['cafe', ['ごめん']],
      ['cafe', ['ごめんなさい']],
      ['konbini', ['ありがとう', 'ごめん']],
      ['park', ['ありがとう', 'ごめん']],
    ] as const) {
      const base = evaluateSession(typed(id, [...texts]));
      expect(strip(evaluateSession(typed(id, [...texts]), {}))).toEqual(strip(base));
      const defaults = id === 'park' ? friend : staff;
      expect(strip(evaluateSession(typed(id, [...texts]), defaults)), `${id} ${texts}`).toEqual(strip(base));
    }
    expect(evaluateSession(typed('cafe', ['ありがとう'])).corrections[0].better).toBe('ありがとうございます。');
    expect(evaluateSession(typed('park', ['ありがとう'])).corrections).toEqual([]);
  });

  it('with no options the default register is polite, Mio casual: markers cannot fire without a marker list', () => {
    expect(register(evaluateSession(typed('cafe', ['だいじょうぶだよ'])).corrections)).toEqual([]);
    expect(register(evaluateSession(typed('park', ['ありがとうございます'])).corrections)).toEqual([]);
  });

  it('property: a learner who follows the scenario suggestions earns no register correction, in any of the five scenarios', () => {
    const problems: string[] = [];
    for (const sc of SCENARIOS.filter((x) => ['cafe', 'konbini', 'station', 'ramen', 'park'].includes(x.id))) {
      const isFriend = sc.characterId === 'mio';
      const o: FeedbackOptions = isFriend ? friend : staff;
      for (const pick of [0, 1, 2]) {
        const s = open(sc.id);
        const texts: string[] = [];
        for (let guard = 0; !s.ended && guard < 20; guard++) {
          const sug = s.suggestions();
          const chosen = sug[Math.min(pick, sug.length - 1)];
          if (!chosen) break;
          texts.push(chosen.written);
          s.submit({ text: chosen.written, mode: 'typed_ja' });
        }
        const f = evaluateSession(s, o);
        for (const c of [...f.corrections, ...(f.maybe ?? [])]) if (c.kind === 'register') problems.push(`${sc.id}#${pick}: ${c.original} (${c.span})`);
        // and the flagged set is identical to a run without options
        const plain = evaluateSession(s);
        expect(f.corrections.map((c) => c.original + c.category), `${sc.id}#${pick}`).toEqual(plain.corrections.map((c) => c.original + c.category));
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('the shipped marker lists (JP_LANGUAGE.registerMarkers) are consistent with the rules', () => {
  const registers: Register[] = ['casual', 'polite', 'keigo'];

  it('no register\'s own good marker is flagged as bad in that register', () => {
    for (const r of registers) {
      for (const g of MARKERS[r].good) {
        const o: FeedbackOptions = { register: r, friend: false, markers: MARKERS };
        // typed as a one-word turn: a hit would be a register correction
        const f = evaluateSession(typed('cafe', [g]), o);
        expect(register(f.corrections), `${r} good marker ${g}`).toEqual([]);
      }
    }
  });

  it('every bad marker of a staff register is caught when used on its own (so the lists are live, not decoration)', () => {
    for (const r of ['polite', 'keigo'] as const) {
      for (const b of MARKERS[r].bad) {
        const f = evaluateSession(typed('cafe', [`それは${b}`]), { register: r, friend: false, markers: MARKERS });
        // ごめん is also the legacy casualSorry wording rule, which owns that turn's one naturalness slot
        expect(f.corrections.length, `${r} bad marker ${b}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every bad marker of the casual register is a soft note for a friend', () => {
    for (const b of MARKERS.casual.bad) {
      const f = evaluateSession(typed('park', [`それは${b}`]), friend);
      expect(register(f.corrections).length, b).toBe(1);
      expect(register(f.corrections)[0].soft, b).toBe(true);
    }
  });

  it('is deterministic', () => {
    const s = typed('cafe', ['いいよ、だいじょうぶだよ']);
    const run = () => ({ ...evaluateSession(s, staff), stats: undefined }); // durationSec reads the session's (test) clock
    expect(run()).toEqual(run());
  });
});
