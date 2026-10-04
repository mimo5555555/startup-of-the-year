import { normJa } from '@lw/core';
import { LEXICON, plainText, resolveLine, tokenize, type Gloss, type ResolvedLine, type Scenario } from '@lw/content';
import type { ConversationSession, Turn } from './dialogue';

export type CorrectionCategory = 'grammar' | 'vocabulary' | 'naturalness';

export interface Correction {
  turnId: number;
  /** character range in the learner's written text */
  span: [number, number];
  category: CorrectionCategory;
  severity: 1 | 2 | 3;
  original: string;
  better: string;
  explanation: Gloss;
}

export interface FeedbackReport {
  scores: { goal: number; fluency: number; accuracy: number | null };
  corrections: Correction[];
  focusNext: Gloss[];
  praise: Gloss;
  /** lines the app wrote for the learner: not graded, offered for saving */
  phrasesLearned: ResolvedLine[];
  stats: { independent: number; assisted: number; fallbacks: number; hints: number; goalDone: number; goalTotal: number; durationSec: number };
  /** "rule" in this sample: a stand-in for the on-device feedback model */
  source: 'rule' | 'model';
}

type Rule = (turn: Turn, ctx: { scenario: Scenario; text: string }) => Correction[];

const POLITE = ['ください', 'おねがい', 'お願い', 'いただ', 'です', 'ます'];

function span(text: string, needle: string): [number, number] {
  const i = text.indexOf(needle);
  return i >= 0 ? [i, i + needle.length] : [0, text.length];
}

const wrongParticle: Rule = (turn, { text }) => {
  const m = /(が|は)(ください)/.exec(text);
  if (!m) return [];
  const better = text.replace(/(が|は)(ください)/, 'を$2');
  return [
    {
      turnId: turn.id,
      span: [m.index, m.index + 2],
      category: 'grammar',
      severity: 2,
      original: text,
      better,
      explanation: {
        en: 'What you ask for takes を: ～をください ("please give me ～").',
        ar: 'الشيء الذي تطلبه تتبعه أداة を: ～をください («من فضلك أعطني ～»).',
      },
    },
  ];
};

const englishWord: Rule = (turn, { text }) => {
  const out: Correction[] = [];
  const re = /[A-Za-z][A-Za-z'-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const word = m[0].toLowerCase();
    if (LEXICON.has(m[0])) continue; // e.g. Wi-Fi is written that way in Japanese too
    const entry = LEXICON.all().find((e) => !e.g && e.en.toLowerCase().replace(/ \(.*\)$/, '') === word);
    if (!entry) continue;
    out.push({
      turnId: turn.id,
      span: [m.index, m.index + m[0].length],
      category: 'vocabulary',
      severity: 2,
      original: text,
      better: text.slice(0, m.index) + entry.s + text.slice(m.index + m[0].length),
      explanation: {
        en: `"${m[0]}" in Japanese is ${entry.s}${entry.r ? ` (${entry.r})` : ''}.`,
        ar: `«${m[0]}» باليابانية هي ${entry.s}${entry.r ? ` (${entry.r})` : ''}.`,
      },
    });
  }
  return out;
};

const bareRequest: Rule = (turn, { text }) => {
  if (!turn.request || !turn.ideal) return [];
  if (POLITE.some((p) => text.includes(p))) return [];
  return [
    {
      turnId: turn.id,
      span: [0, text.length],
      category: 'naturalness',
      severity: 1,
      original: text,
      better: turn.ideal.written,
      explanation: {
        en: 'A bare word sounds abrupt. Add ください or お願いします to make it a polite request.',
        ar: 'الكلمة وحدها تبدو حادّة. أضف ください أو お願いします لتصبح طلبًا مهذبًا.',
      },
    },
  ];
};

const bluntWant: Rule = (turn, { text }) => {
  const m = /ほしい(?!です)/.exec(text);
  if (!m || /です|ます/.test(text.slice(m.index + 3))) return [];
  return [
    {
      turnId: turn.id,
      span: [m.index, m.index + 3],
      category: 'naturalness',
      severity: 2,
      original: text,
      better: turn.ideal?.written ?? text.replace('ほしい', 'ください'),
      explanation: {
        en: 'ほしい on its own is blunt with staff. ～をください or ～がほしいです is more polite.',
        ar: 'كلمة ほしい وحدها فظّة مع الموظفين. ～をください أو ～がほしいです أكثر تهذيبًا.',
      },
    },
  ];
};

const missingDesu: Rule = (turn, { text }) => {
  const m = /^(?:わたし|私|ぼく|僕)は([^、。\s]+?)[。.!！]*$/.exec(text);
  if (!m || /です|ます|でした|から|ました/.test(text)) return [];
  const better = text.replace(/[。.!！]*$/, '') + 'です。';
  return [
    {
      turnId: turn.id,
      span: [text.length - 1, text.length],
      category: 'grammar',
      severity: 2,
      original: text,
      better,
      explanation: {
        en: 'Finish a polite sentence with です: わたしは〜です.',
        ar: 'أنهِ الجملة المهذبة بـ です: わたしは〜です.',
      },
    },
  ];
};

const shortThanks: Rule = (turn, { scenario, text }) => {
  if (scenario.characterId === 'mio') return [];
  if (normJa(text) !== 'ありがとう') return [];
  return [
    {
      turnId: turn.id,
      span: span(text, 'ありがとう'),
      category: 'naturalness',
      severity: 1,
      original: text,
      better: 'ありがとうございます。',
      explanation: {
        en: 'ありがとう is for friends. With staff, use ありがとうございます.',
        ar: 'ありがとう للأصدقاء. مع الموظفين استخدم ありがとうございます.',
      },
    },
  ];
};

const casualSorry: Rule = (turn, { scenario, text }) => {
  if (scenario.characterId === 'mio' || !text.includes('ごめん')) return [];
  return [
    {
      turnId: turn.id,
      span: span(text, 'ごめん'),
      category: 'naturalness',
      severity: 1,
      original: text,
      better: text.replace(/ごめん(なさい)?/, 'すみません'),
      explanation: {
        en: 'ごめん is casual. With someone you do not know, say すみません.',
        ar: 'ごめん عامية. مع شخص لا تعرفه قل すみません.',
      },
    },
  ];
};

const RULES: Rule[] = [wrongParticle, englishWord, bluntWant, bareRequest, missingDesu, shortThanks, casualSorry];

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export function evaluateSession(session: ConversationSession): FeedbackReport {
  const { scenario } = session;
  const sum = session.summary();
  const learnerTurns = session.turns.filter((t) => t.speaker === 'learner');
  const independent = learnerTurns.filter((t) => !t.assisted);

  const corrections: Correction[] = [];
  for (const turn of independent) {
    if (!turn.matched && !turn.line.written) continue;
    const text = turn.line.written;
    const found = RULES.flatMap((r) => r(turn, { scenario, text }));
    // one correction per turn is enough to learn from; keep the most severe
    found.sort((a, b) => b.severity - a.severity);
    const seen = new Set<string>();
    for (const c of found) {
      const key = `${c.turnId}:${c.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        corrections.push(c);
      }
    }
  }
  corrections.sort((a, b) => b.severity - a.severity);
  const top = corrections.slice(0, 5);

  const goal = clamp((sum.goalDone / Math.max(1, sum.goalTotal)) * 100);
  const total = sum.independentTurns + sum.assistedTurns;
  const ratio = total ? sum.independentTurns / total : 0;
  const fluency = clamp(35 + 55 * ratio + Math.min(10, total) - 7 * sum.fallbacks - 2 * sum.hintsUsed, 10, 100);
  const penalty = top.reduce((n, c) => n + c.severity * 8, 0) + sum.fallbacks * 6;
  const accuracy = sum.independentTurns ? clamp(100 - penalty, 20, 100) : null;

  const focusNext: Gloss[] = [];
  const top1 = top[0];
  if (top1) {
    const label: Record<CorrectionCategory, Gloss> = {
      grammar: { en: 'Grammar: ', ar: 'القواعد: ' },
      vocabulary: { en: 'Vocabulary: ', ar: 'المفردات: ' },
      naturalness: { en: 'Sounding natural: ', ar: 'الطبيعية: ' },
    };
    focusNext.push({ en: label[top1.category].en + top1.explanation.en, ar: label[top1.category].ar + top1.explanation.ar });
  }
  if (total >= 2 && ratio < 0.5) {
    focusNext.push({
      en: 'Try answering one line without a suggestion or translation next time.',
      ar: 'جرّب في المرة القادمة أن تجيب عن سطر واحد دون اقتراح أو ترجمة.',
    });
  }
  if (goal < 100 && focusNext.length < 2) {
    const missing = scenario.steps.find((s) => !session.stepsDone.has(s.id));
    if (missing) focusNext.push({ en: `Finish the goal: ${missing.text.en.toLowerCase()}.`, ar: `أكمل الهدف: ${missing.text.ar}.` });
  }
  if (sum.fallbacks >= 2 && focusNext.length < 2) {
    focusNext.push({
      en: 'When you miss something, say もう一度お願いします. It is always polite.',
      ar: 'عندما يفوتك شيء قل もう一度お願いします. إنها دائمًا مهذبة.',
    });
  }
  if (!focusNext.length) {
    focusNext.push({
      en: 'Next, try a conversation at a new place to meet more vocabulary.',
      ar: 'بعد ذلك جرّب محادثة في مكان جديد لتتعرف على مفردات أكثر.',
    });
  }

  let praise: Gloss;
  if (goal === 100 && !top.length && sum.independentTurns >= 2) {
    praise = { en: 'You finished every goal and your own sentences had no mistakes.', ar: 'أكملت جميع الأهداف وكانت جملك خالية من الأخطاء.' };
  } else if (goal === 100) {
    praise = { en: 'You finished every goal in this conversation.', ar: 'أكملت جميع أهداف هذه المحادثة.' };
  } else if (sum.independentTurns >= 1 && !top.length) {
    praise = { en: 'The sentences you wrote yourself were correct.', ar: 'الجمل التي كتبتها بنفسك كانت صحيحة.' };
  } else if (total >= 1) {
    praise = { en: `You completed ${sum.goalDone} of ${sum.goalTotal} goals. Every conversation adds words you can reuse.`, ar: `أكملت ${sum.goalDone} من ${sum.goalTotal} أهداف. كل محادثة تضيف كلمات يمكنك إعادة استخدامها.` };
  } else {
    praise = { en: 'You showed up. Next time, say something and see what happens.', ar: 'لقد حضرت. في المرة القادمة قل شيئًا وشاهد ما يحدث.' };
  }

  const seen = new Set<string>();
  const phrasesLearned: ResolvedLine[] = [];
  for (const t of learnerTurns.filter((x) => x.assisted && x.matched)) {
    if (!seen.has(t.line.written)) {
      seen.add(t.line.written);
      phrasesLearned.push(t.line);
    }
  }

  return {
    scores: { goal, fluency, accuracy },
    corrections: top,
    focusNext: focusNext.slice(0, 2),
    praise,
    phrasesLearned,
    stats: {
      independent: sum.independentTurns,
      assisted: sum.assistedTurns,
      fallbacks: sum.fallbacks,
      hints: sum.hintsUsed,
      goalDone: sum.goalDone,
      goalTotal: sum.goalTotal,
      durationSec: sum.durationSec,
    },
    source: 'rule',
  };
}

export { resolveLine, plainText, tokenize };
