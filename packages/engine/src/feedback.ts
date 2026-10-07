import { normJa } from '@lw/core';
import type { LanguagePlugin, Register } from '@lw/game';
import { LEXICON, plainText, resolveLine, tokenize, type Gloss, type ResolvedLine, type Scenario } from '@lw/content';
import type { ConversationSession, Turn } from './dialogue';
import { isReliableSpeech, type SpeechPolicy } from './speechScore';

export type CorrectionCategory = 'grammar' | 'vocabulary' | 'naturalness';

/** `register`: casual with staff / stiff with a friend (§11.4). Kept beside `category` ('naturalness') so a UI that only knows the three categories still renders it. */
export type CorrectionKind = 'register';

export interface Correction {
  turnId: number;
  /** character range in the learner's written text */
  span: [number, number];
  category: CorrectionCategory;
  severity: 1 | 2 | 3;
  original: string;
  better: string;
  explanation: Gloss;
  kind?: CorrectionKind;
  /** a note, not a mistake ("distant, not wrong"): shown but costs no accuracy */
  soft?: boolean;
}

/** What the register rules need beyond the session (§11.4); every field is optional and the defaults reproduce the pre-register behaviour. */
export interface FeedbackOptions {
  /** the register the character speaks in: `ScenarioMeta.register`, already overridden by the friend's `casual` flag. Default: casual for Mio, polite otherwise. */
  register?: Register;
  /** the character is a friend: plain ありがとう / ごめん and casual forms are not "casual with staff". Default: Mio. */
  friend?: boolean;
  /** the pack's `LanguagePlugin.registerMarkers`; without it only the two legacy wording rules run */
  markers?: LanguagePlugin['registerMarkers'];
  /** per-scenario casual forms (a mismatch with polite/keigo) and polite/stiff forms (a mismatch with a casual friend) */
  casualMarkers?: string[];
  politeMarkers?: string[];
  /** STT confidence by learner turn id; a speech turn below `BALANCE.speech.correctionConfidence` yields `maybe` notes, not corrections. Falls back to `turn.confidence` if the session records it. */
  speechConfidence?: Record<number, number>;
  /** `BALANCE.speech` when the caller has it (the engine cannot import it at runtime); defaults to the pinned copy */
  speechPolicy?: SpeechPolicy;
}

export interface FeedbackReport {
  scores: { goal: number; fluency: number; accuracy: number | null };
  corrections: Correction[];
  /** what the rules would have said about speech turns recognised below the correction confidence: "maybe" notes (§11.4), never scored */
  maybe?: Correction[];
  focusNext: Gloss[];
  praise: Gloss;
  /** lines the app wrote for the learner: not graded, offered for saving */
  phrasesLearned: ResolvedLine[];
  stats: { independent: number; assisted: number; fallbacks: number; hints: number; goalDone: number; goalTotal: number; durationSec: number };
  /** "rule" in this sample: a stand-in for the on-device feedback model */
  source: 'rule' | 'model';
}

interface RuleCtx {
  scenario: Scenario;
  text: string;
  register: Register;
  friend: boolean;
  markers: LanguagePlugin['registerMarkers'] | undefined;
  casualMarkers: string[];
  politeMarkers: string[];
}
type Rule = (turn: Turn, ctx: RuleCtx) => Correction[];

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

const shortThanks: Rule = (turn, { friend, register, text }) => {
  if (friend || register === 'casual') return [];
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

const casualSorry: Rule = (turn, { friend, register, text }) => {
  if (friend || register === 'casual' || !text.includes('ごめん')) return [];
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

// ---------- register (§11.4) ----------

const HIRAGANA = /[\u3041-\u3096]/;
const SHORT_MARKER = 3;

/**
 * The earliest marker in `text`. A short marker (くれ, うん, だよ) only counts when no hiragana continues the word, so くれました,
 * うんと and ただよう are not hits; a following ね / よ / か is a sentence particle and does count. Rules are conservative: unsure means no hit.
 */
function findMarker(text: string, markers: readonly string[]): { marker: string; index: number } | null {
  let best: { marker: string; index: number } | null = null;
  for (const marker of markers) {
    if (!marker) continue;
    for (let i = text.indexOf(marker); i >= 0; i = text.indexOf(marker, i + 1)) {
      const next = text[i + marker.length];
      if (marker.length > SHORT_MARKER || next === undefined || !HIRAGANA.test(next) || 'ねよか'.includes(next)) {
        if (!best || i < best.index) best = { marker, index: i };
        break;
      }
    }
  }
  return best;
}

/** plain -> polite for the forms the shared markers list; unknown forms keep the ideal line (or the text) as `better` */
const TO_POLITE: Array<[string, string]> = [['だよ', 'ですよ'], ['だね', 'ですね'], ['じゃん', 'ですよね'], ['だぜ', 'ですよ'], ['ちょうだい', 'ください'], ['くれ', 'ください'], ['ごめん', 'すみません'], ['うん', 'はい'], ['いいよ', 'いいですよ']];
/** formal -> plain, longest first; a form with no entry (させていただ...) has no automatic rewrite */
const TO_PLAIN: Array<[string, string]> = [['でございます', 'だ'], ['ございます', ''], ['いたします', 'する'], ['おります', 'いる'], ['いらっしゃいます', 'いる']];

const rewrite = (text: string, hit: { marker: string; index: number }, table: Array<[string, string]>): string | null => {
  const to = table.find(([from]) => from === hit.marker)?.[1];
  return to === undefined ? null : text.slice(0, hit.index) + to + text.slice(hit.index + hit.marker.length);
};

/** casual forms with staff: a naturalness correction; unsure (a friend, a casual register, no marker list) says nothing */
const casualWithStaff: Rule = (turn, { text, register, friend, markers, casualMarkers }) => {
  if (friend || register === 'casual') return [];
  const hit = findMarker(text, [...(markers?.[register].bad ?? []), ...casualMarkers]);
  if (!hit) return [];
  return [
    {
      turnId: turn.id,
      span: [hit.index, hit.index + hit.marker.length],
      category: 'naturalness',
      kind: 'register',
      severity: 1,
      original: text,
      better: rewrite(text, hit, TO_POLITE) ?? turn.ideal?.written ?? text,
      explanation:
        register === 'keigo'
          ? {
              en: `「${hit.marker}」 is casual speech. In a formal setting like this, use the polite form (です／ます／ください).`,
              ar: `«${hit.marker}» أسلوب عامّي. في موقف رسمي كهذا استخدم الصيغة المهذبة (です／ます／ください).`,
            }
          : {
              en: `「${hit.marker}」 is casual speech. With staff, use the polite form (です／ます／ください).`,
              ar: `«${hit.marker}» أسلوب عامّي. مع الموظفين استخدم الصيغة المهذبة (です／ます／ください).`,
            },
    },
  ];
};

/** keigo with a friend who has switched to plain speech: "distant, not wrong" (a soft note) */
const stiffWithFriend: Rule = (turn, { text, register, markers, politeMarkers }) => {
  if (register !== 'casual') return [];
  const hit = findMarker(text, [...(markers?.casual.bad ?? []), ...politeMarkers]);
  if (!hit) return [];
  return [
    {
      turnId: turn.id,
      span: [hit.index, hit.index + hit.marker.length],
      category: 'naturalness',
      kind: 'register',
      soft: true,
      severity: 1,
      original: text,
      better: rewrite(text, hit, TO_PLAIN) ?? text,
      explanation: {
        en: `「${hit.marker}」 is very formal. Your friend has switched to casual speech, so it sounds a little distant. It is not wrong.`,
        ar: `«${hit.marker}» رسمية جدًا. صديقك انتقل إلى الكلام العادي، فتبدو بعيدة قليلًا. وهي ليست خطأ.`,
      },
    },
  ];
};

const RULES: Rule[] = [wrongParticle, englishWord, bluntWant, bareRequest, missingDesu, shortThanks, casualSorry, casualWithStaff, stiffWithFriend];

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export function evaluateSession(session: ConversationSession, opts: FeedbackOptions = {}): FeedbackReport {
  const { scenario } = session;
  const isMio = scenario.characterId === 'mio'; // the legacy stand-in for "a friend"; callers with pack data pass register and friend
  const ctxBase = {
    scenario,
    register: opts.register ?? (isMio ? 'casual' : 'polite'),
    friend: opts.friend ?? isMio,
    markers: opts.markers,
    casualMarkers: opts.casualMarkers ?? [],
    politeMarkers: opts.politeMarkers ?? [],
  } satisfies Omit<RuleCtx, 'text'>;
  const sum = session.summary();
  const learnerTurns = session.turns.filter((t) => t.speaker === 'learner');
  const independent = learnerTurns.filter((t) => !t.assisted);

  const corrections: Correction[] = [];
  const maybe: Correction[] = [];
  for (const turn of independent) {
    if (!turn.matched && !turn.line.written) continue;
    const text = turn.line.written;
    const found = RULES.flatMap((r) => r(turn, { ...ctxBase, text }));
    // one correction per turn is enough to learn from; keep the most severe
    found.sort((a, b) => b.severity - a.severity);
    // a speech turn the recogniser was unsure of may just be mis-heard: its findings are "maybe" notes (§11.4)
    const conf = opts.speechConfidence?.[turn.id] ?? (turn as Turn & { confidence?: number }).confidence;
    const unsure = turn.mode === 'speech_ja' && conf !== undefined && !isReliableSpeech(conf, opts.speechPolicy);
    const seen = new Set<string>();
    for (const c of found) {
      const key = `${c.turnId}:${c.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        (unsure ? maybe : corrections).push(c);
      }
    }
  }
  corrections.sort((a, b) => b.severity - a.severity || Number(!!a.soft) - Number(!!b.soft)); // a soft note never outranks a mistake
  const top = corrections.slice(0, 5);
  const mistakes = top.filter((c) => !c.soft);

  const goal = clamp((sum.goalDone / Math.max(1, sum.goalTotal)) * 100);
  const total = sum.independentTurns + sum.assistedTurns;
  const ratio = total ? sum.independentTurns / total : 0;
  const fluency = clamp(35 + 55 * ratio + Math.min(10, total) - 7 * sum.fallbacks - 2 * sum.hintsUsed, 10, 100);
  const penalty = mistakes.reduce((n, c) => n + c.severity * 8, 0) + sum.fallbacks * 6;
  const accuracy = sum.independentTurns ? clamp(100 - penalty, 20, 100) : null;

  const focusNext: Gloss[] = [];
  const top1 = mistakes[0];
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
  if (goal === 100 && !mistakes.length && sum.independentTurns >= 2) {
    praise = { en: 'You finished every goal and your own sentences had no mistakes.', ar: 'أكملت جميع الأهداف وكانت جملك خالية من الأخطاء.' };
  } else if (goal === 100) {
    praise = { en: 'You finished every goal in this conversation.', ar: 'أكملت جميع أهداف هذه المحادثة.' };
  } else if (sum.independentTurns >= 1 && !mistakes.length) {
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
    maybe,
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
