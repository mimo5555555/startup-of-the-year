import type { DiaryEntry, GamePack, GameState, LetterSentence } from '@lw/game';
// Type-only imports from @lw/game: content adds no runtime dependency on it.
import type { Gloss, Line } from '../../types';
import { SLOTS } from '../../slots';
import { CHARACTERS } from '../character-registry';

// The Letter Home (docs/GAME_DESIGN.md §7.2 Chapter 8, `screen:'letter'`) and the one-line diary of every chapter's closing beat (Release 2 wave C2).
//
// The Letter is five sentence frames, each pre-filled from something the game remembers (the name, the home country, a friend, a place, a
// purchase or the dream). The learner writes each sentence: typed or spoken it is their own (independent); picked from the frame's three
// suggestions, or translated from English / Arabic, it is assisted. `letter_saved` stores only the written Japanese (no audio is ever recorded)
// and the game raises `letter_written` (c8_1) once 5 sentences hold and at least 3 are the learner's own (BALANCE.letter, @lw/game). A fact the
// game does not know yet falls back to a frame that needs none, so the Letter can always be written.
//
// The diary: every closing beat from Chapter 2 on asks for one line (`ask: 'diary'`): two taps (what happened + how it felt, `diaryLine`) or a
// typed sentence. Tapped lines are assisted, typed ones the learner's own; `diary_added` stores them and the Letter card replays them (`letterDiary`).
// Every token of every line here is in the lexicon (`lexicon/matsuri.ts` and the modules it names); the content tests check it.

/** What a frame is pre-filled from. */
export type LetterSource = 'name' | 'country' | 'friend' | 'place' | 'thing';

/** One remembered fact as the Letter writes it: Japanese markup (`|`-separated, lexicon words or a raw name) and its glosses; `known` = from the save, not a fallback. */
export interface LetterFact {
  ja: string;
  en: string;
  ar: string;
  known: boolean;
}

export type LetterFacts = Record<LetterSource, LetterFact>;

export interface LetterFrame {
  id: string;
  source: LetterSource;
  /** what this sentence is about (the frame's label) */
  prompt: Gloss;
  /** the frame pre-filled: the start the screen shows in the field (`{x}` is the fact) */
  starter: Line;
  /** three complete sentences to pick from (assisted); `{x}` is the fact */
  suggestions: [Line, Line, Line];
  /** when the fact is not known: a starter and three suggestions that need no fact, and the label when it differs from `prompt` */
  fallback: { prompt?: Gloss; starter: Line; suggestions: [Line, Line, Line] };
}

const L = (ja: string, en: string, ar: string): Line => ({ ja, en, ar });

/** The Letter's opening and signature (decoration on the card; not one of the five sentences). `{name}` is the player's name. */
export const LETTER_HEADER: Line = L('お父さん|、|お母さん|へ', 'Dear Dad and Mum,', 'أبي وأمي العزيزين،');
export const LETTER_SIGN: Line = L('{x}|より', 'From {x}', 'من {x}');
/** Hanako reads the finished Letter back (TTS) and says this (§7.2). */
export const LETTER_HANAKO: Line = L('これ|が|あなた|の|日本語|です|。|すばらしい|！', 'This is your Japanese. Wonderful!', 'هذه هي لغتك اليابانية. رائع!');
/** c8_1, the same numbers as BALANCE.letter in @lw/game (asserted in the tests): five sentences, three of them the learner's own. */
export const LETTER_RULE = { sentences: 5, minOwn: 3 } as const;

/** The five frames, in the order of the Letter (§7.2: name, home country, a friend, a place, the dream or a purchase). */
export const LETTER_FRAMES: LetterFrame[] = [
  {
    id: 'lf_name',
    source: 'name',
    prompt: { en: 'Say hello and who is writing', ar: 'سلّم وقل من يكتب' },
    starter: L('{x}|です|。', 'It is {x}.', 'أنا {x}.'),
    suggestions: [
      L('{x}|です|。|お元気|です|か|。', 'It is {x}. How are you?', 'أنا {x}. كيف حالكم؟'),
      L('{x}|です|。|わたし|は|元気|です|。', 'It is {x}. I am well.', 'أنا {x}. أنا بخير.'),
      L('{x}|です|。|日本|から|手紙|を|書きます|。', 'It is {x}. I am writing a letter from Japan.', 'أنا {x}. أكتب رسالة من اليابان.'),
    ],
    fallback: {
      starter: L('お元気|です|か|。', 'How are you?', 'كيف حالكم؟'),
      suggestions: [
        L('お元気|です|か|。', 'How are you?', 'كيف حالكم؟'),
        L('わたし|は|元気|です|。', 'I am well.', 'أنا بخير.'),
        L('日本|から|手紙|を|書きます|。', 'I am writing a letter from Japan.', 'أكتب رسالة من اليابان.'),
      ],
    },
  },
  {
    id: 'lf_country',
    source: 'country',
    prompt: { en: 'Your home country', ar: 'بلدك' },
    starter: L('{x}|の|皆さん|、', 'Everyone in {x},', 'يا أهل {x}،'),
    suggestions: [
      L('{x}|の|皆さん|、|お元気|です|か|。', 'Everyone in {x}, how are you?', 'يا أهل {x}، كيف حالكم؟'),
      L('{x}|が|なつかしい|です|。', 'I miss {x}.', 'أفتقد {x}.'),
      L('{x}|の|みんな|に|会いたい|です|。', 'I want to see everyone in {x}.', 'أريد أن أرى الجميع في {x}.'),
    ],
    fallback: {
      prompt: { en: 'Your family back home', ar: 'أسرتك في بلدك' },
      starter: L('家族|の|みんな|、', 'Everyone in my family,', 'يا أفراد أسرتي،'),
      suggestions: [
        L('家族|の|みんな|、|お元気|です|か|。', 'Everyone in my family, how are you?', 'يا أفراد أسرتي، كيف حالكم؟'),
        L('家族|に|会いたい|です|。', 'I want to see my family.', 'أريد أن أرى أسرتي.'),
        L('家族|が|大好き|です|。', 'I love my family.', 'أحب أسرتي كثيرًا.'),
      ],
    },
  },
  {
    id: 'lf_friend',
    source: 'friend',
    prompt: { en: 'A friend in Sakura-chō', ar: 'صديق في ساكورا-تشو' },
    starter: L('友だち|の|{x}|さん|は|、', 'My friend {x}...', 'صديقي {x}...'),
    suggestions: [
      L('友だち|の|{x}|さん|は|とても|やさしい|です|。', 'My friend {x} is very kind.', 'صديقي {x} لطيف جدًا.'),
      L('{x}|さん|と|よく|話します|。', 'I often talk with {x}.', 'أتحدث كثيرًا مع {x}.'),
      L('{x}|さん|と|友だち|に|なりました|。', '{x} and I became friends.', 'أصبحت أنا و{x} صديقين.'),
    ],
    fallback: {
      starter: L('桜町|に|友だち|が|います|。', 'I have friends in Sakura-chō.', 'لديّ أصدقاء في ساكورا-تشو.'),
      suggestions: [
        L('桜町|に|友だち|が|います|。', 'I have friends in Sakura-chō.', 'لديّ أصدقاء في ساكورا-تشو.'),
        L('友だち|と|よく|話します|。', 'I often talk with friends.', 'أتحدث كثيرًا مع الأصدقاء.'),
        L('先生|は|とても|やさしい|です|。', 'My teacher is very kind.', 'معلّمتي لطيفة جدًا.'),
      ],
    },
  },
  {
    id: 'lf_place',
    source: 'place',
    prompt: { en: 'A place you like', ar: 'مكان تحبه' },
    starter: L('{x}|に|よく|行きます|。', 'I often go to {x}.', 'أذهب كثيرًا إلى {x}.'),
    suggestions: [
      L('{x}|に|よく|行きます|。', 'I often go to {x}.', 'أذهب كثيرًا إلى {x}.'),
      L('{x}|が|大好き|です|。', 'I love {x}.', 'أحب {x} كثيرًا.'),
      L('毎日|、|{x}|に|行きます|。', 'I go to {x} every day.', 'أذهب إلى {x} كل يوم.'),
    ],
    fallback: {
      starter: L('桜町|は|とても|いい|町|です|。', 'Sakura-chō is a very nice town.', 'ساكورا-تشو مدينة جميلة جدًا.'),
      suggestions: [
        L('桜町|は|とても|いい|町|です|。', 'Sakura-chō is a very nice town.', 'ساكورا-تشو مدينة جميلة جدًا.'),
        L('今|、|桜町|に|住んで|います|。', 'I live in Sakura-chō now.', 'أعيش الآن في ساكورا-تشو.'),
        L('日本|は|とても|楽しい|です|。', 'Japan is a lot of fun.', 'اليابان ممتعة جدًا.'),
      ],
    },
  },
  {
    id: 'lf_thing',
    source: 'thing',
    prompt: { en: 'Something you bought, or your dream', ar: 'شيء اشتريته أو حلمك' },
    starter: L('{x}|を|買いました|。', 'I bought {x}.', 'اشتريت {x}.'),
    suggestions: [
      L('{x}|を|買いました|。', 'I bought {x}.', 'اشتريت {x}.'),
      L('{x}|を|買いました|。|うれしい|です|。', 'I bought {x}. I am happy.', 'اشتريت {x}. أنا سعيد.'),
      L('{x}|が|大好き|です|。', 'I love my {x}.', 'أحب {x} كثيرًا.'),
    ],
    fallback: {
      prompt: { en: 'What you did here', ar: 'ما فعلته هنا' },
      starter: L('日本語|を|たくさん|勉強|しました|。', 'I studied a lot of Japanese.', 'درست اليابانية كثيرًا.'),
      suggestions: [
        L('日本語|を|たくさん|勉強|しました|。', 'I studied a lot of Japanese.', 'درست اليابانية كثيرًا.'),
        L('毎日|、|日本語|で|話して|います|。', 'I speak Japanese every day.', 'أتحدث اليابانية كل يوم.'),
        L('また|手紙|を|書きます|。', 'I will write again.', 'سأكتب مرة أخرى.'),
      ],
    },
  },
];

/**
 * The dream, when nothing was bought: the frame `lf_thing` says it as a sentence of its own for each dream (review: 「わたしの夢は「ICカードでたび」です。」
 * quoted the dream's title and read like a form). `wish` while the dream is still ahead, `done` once it came true; a dream without lines here
 * (none in this release) leaves the frame on its fallback.
 */
export const LETTER_DREAMS: Record<string, { wish: Line; done: Line }> = {
  phone_pal: {
    wish: L('自分|の|スマホ|で|、|友だち|と|たくさん|話したい|です|。', 'I want to talk a lot with my friends on my own phone.', 'أريد أن أتحدث كثيرًا مع أصدقائي بهاتفي الخاص.'),
    done: L('自分|の|スマホ|で|、|友だち|と|よく|話します|。', 'I often talk with my friends on my own phone.', 'أتحدث كثيرًا مع أصدقائي بهاتفي الخاص.'),
  },
  bike: {
    wish: L('自転車|で|町|を|たんけん|したい|です|。', 'I want to explore the town by bike.', 'أريد أن أستكشف المدينة بالدراجة.'),
    done: L('自転車|で|町|を|たんけん|しました|。', 'I explored the town by bike.', 'استكشفت المدينة بالدراجة.'),
  },
  flat: {
    wish: L('自分|の|部屋|に|住みたい|です|。', 'I want to live in a room of my own.', 'أريد أن أعيش في غرفة خاصة بي.'),
    done: L('今|、|自分|の|部屋|に|住んで|います|。', 'I live in my own room now.', 'أعيش الآن في غرفتي الخاصة.'),
  },
  festival: {
    wish: L('ミオ|さん|と|お祭り|に|行きたい|です|。', 'I want to go to the festival with Mio.', 'أريد أن أذهب إلى المهرجان مع ميو.'),
    done: L('ミオ|さん|と|お祭り|に|行きました|。', 'I went to the festival with Mio.', 'ذهبت إلى المهرجان مع ميو.'),
  },
  travel: {
    wish: L('電車|で|旅行|したい|です|。', 'I want to travel by train.', 'أريد أن أسافر بالقطار.'),
    done: L('ICカード|で|光が丘|に|行きました|。', 'I went to Hikarigaoka with my IC card.', 'ذهبت إلى هيكاريغاؤكا ببطاقة IC.'),
  },
  fresh_start: {
    wish: L('日本|で|新しい|生活|を|始めたい|です|。', 'I want to start a new life in Japan.', 'أريد أن أبدأ حياة جديدة في اليابان.'),
    done: L('日本|で|新しい|生活|を|始めました|。', 'I started a new life in Japan.', 'بدأت حياة جديدة في اليابان.'),
  },
  car: {
    wish: L('いつか|自分|の|車|で|ドライブ|したい|です|。', 'Someday I want to go for a drive in my own car.', 'أريد يومًا ما أن أقود سيارتي الخاصة في جولة.'),
    done: L('自分|の|車|で|ドライブ|しました|。', 'I went for a drive in my own car.', 'قمت بجولة بسيارتي الخاصة.'),
  },
};

const join = (a: Line, b: Line): Line => L(`${a.ja}|${b.ja}`, `${a.en} ${b.en}`, `${a.ar} ${b.ar}`);

/** The frame `lf_thing` for a dream: its sentence as the starter, then it alone, with 「それがわたしの夢です。」 or 「がんばります。」 (done: 「夢がかないました。」, 「うれしいです。」). */
export function letterDream(dreamId: string, done: boolean): { starter: Line; suggestions: [Line, Line, Line] } | null {
  const d = LETTER_DREAMS[dreamId];
  if (!d) return null;
  const s = done ? d.done : d.wish;
  const more: [Line, Line] = done
    ? [L('夢|が|かないました|。', 'My dream came true.', 'تحقّق حلمي.'), L('うれしい|です|。', 'I am happy.', 'أنا سعيد.')]
    : [L('それ|が|わたし|の|夢|です|。', 'That is my dream.', 'هذا حلمي.'), L('がんばります|。', "I'll do my best.", 'سأبذل جهدي.')];
  return { starter: s, suggestions: [s, join(s, more[0]), join(s, more[1])] };
}

// ---------------------------------------------------------------------------------------------------------------
// Remembered facts
// ---------------------------------------------------------------------------------------------------------------

const JA_TEXT = /[぀-ヿ㐀-鿿]/;
const bare = (ja: string): string => ja.replace(/\|/g, '');

/** A slot value remembered by a conversation (an option id, the captured text or an option's Japanese) as the option of `slot`, if it is one. */
function optionOf(slot: string, value: string) {
  const v = value.trim().toLowerCase();
  return (SLOTS[slot] ?? []).find((o) => o.id.toLowerCase() === v || bare(o.ja) === value.trim() || o.keys.ja.includes(value.trim()) || o.keys.en.includes(v) || o.keys.ar.includes(value.trim()));
}

/** The first friend fact `key` any friend remembers (Mio first: she heard the introduction in the park). */
function friendFact(state: Pick<GameState, 'friends'>, key: string): string | undefined {
  const ids = Object.keys(state.friends).sort((a, b) => (a === 'mio' ? -1 : b === 'mio' ? 1 : 0));
  for (const id of ids) {
    const v = state.friends[id]?.facts?.[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** The places the Letter can name, by the scenario's place id (Japanese all in the lexicon). */
const PLACE_JA: Record<string, { ja: string; en: string; ar: string }> = {
  park: { ja: '公園', en: 'the park', ar: 'الحديقة' },
  konbini: { ja: 'コンビニ', en: 'the konbini', ar: 'المتجر الصغير' },
  cafe: { ja: 'カフェ', en: 'the café', ar: 'المقهى' },
  ramen: { ja: 'ラーメン屋', en: 'the ramen shop', ar: 'مطعم الرامن' },
  station: { ja: '駅', en: 'the station', ar: 'المحطة' },
  hikarigaoka: { ja: '光が丘', en: 'Hikarigaoka', ar: 'هيكاريغاؤكا' },
  school: { ja: '学校', en: 'the school', ar: 'المدرسة' },
};

const NONE: LetterFact = { ja: '', en: '', ar: '', known: false };

/**
 * The facts the Letter (and the speech rehearsal) is pre-filled from, read from the save: the name (the katakana name of Chapter 1's beat, else
 * the profile name as typed, else the name a friend remembers), the home country and the hobby (what Mio remembers from the park), the friend
 * with the most friendship points, the place of the conversation played most, and the dearest thing bought (else the tracked dream). A missing
 * fact is `known: false` (with empty text): the frame then uses its fallback.
 */
export function letterFacts(
  pack: Pick<GamePack, 'items' | 'dreams' | 'scenarioMeta' | 'friends'>,
  state: GameState,
  profileName = '',
): LetterFacts & { hobby: LetterFact; dream: LetterFact & { id?: string; done?: boolean } } {
  // name
  const nameRaw = state.me?.nameKana?.trim() || profileName.trim() || friendFact(state, 'name') || '';
  // the Japanese is the katakana name; the English and Arabic glosses say the name as the learner wrote it in the profile
  const shown = profileName.trim() || nameRaw;
  const name: LetterFact = nameRaw ? { ja: nameRaw, en: shown, ar: shown, known: true } : NONE;
  // country
  const cRaw = friendFact(state, 'country');
  const cOpt = cRaw ? optionOf('country', cRaw) : undefined;
  const country: LetterFact = cOpt
    ? { ja: cOpt.ja, en: cOpt.gloss.en, ar: cOpt.gloss.ar, known: true }
    : cRaw && JA_TEXT.test(cRaw)
      ? { ja: cRaw, en: cRaw, ar: cRaw, known: true }
      : NONE;
  // hobby (the speech's third line)
  const hRaw = friendFact(state, 'hobby');
  const hOpt = hRaw ? optionOf('hobby', hRaw) : undefined;
  const hobby: LetterFact = hOpt ? { ja: hOpt.ja, en: hOpt.gloss.en, ar: hOpt.gloss.ar, known: true } : NONE;
  // the friend: most friendship points among the pack's friends who were met
  const friendIds = pack.friends.map((f) => f.id);
  const best = friendIds
    .map((id) => ({ id, ap: state.friends[id]?.met ? (state.friends[id]?.ap ?? 0) : -1 }))
    .filter((f) => f.ap > 0)
    .sort((a, b) => b.ap - a.ap)[0];
  const ch = best ? CHARACTERS.find((c) => c.id === best.id) : undefined;
  const friend: LetterFact = ch ? { ja: ch.name.ja, en: ch.name.en, ar: ch.name.ar, known: true } : NONE;
  // the place: the place of the scenario played most (count), among the places the Letter can name
  const runs = Object.entries(state.runs ?? {})
    .map(([id, r]) => ({ place: pack.scenarioMeta.find((m) => m.id === id)?.place, n: r?.count ?? 0 }))
    .filter((r): r is { place: string; n: number } => !!r.place && !!PLACE_JA[r.place] && r.n > 0);
  const byPlace = new Map<string, number>();
  for (const r of runs) byPlace.set(r.place, (byPlace.get(r.place) ?? 0) + r.n);
  const topPlace = [...byPlace.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const place: LetterFact = topPlace ? { ...PLACE_JA[topPlace]!, known: true } : NONE;
  // the thing: the dearest catalog item owned (not a present, not the IC card); else the dream below
  const owned = pack.items
    .filter((it) => (state.owned?.[it.id]?.qty ?? 0) > 0 && it.cat !== 'gift' && it.id !== 'ic_card')
    .sort((a, b) => b.price - a.price)[0];
  const thing: LetterFact = owned ? { ja: owned.name.ja, en: owned.name.en, ar: owned.name.ar, known: true } : NONE;
  const d = state.dream?.id ? pack.dreams.find((x) => x.id === state.dream.id) : undefined;
  const dream: LetterFact & { id?: string; done?: boolean } = d ? { ja: d.name.ja, en: d.name.en, ar: d.name.ar, known: true, id: d.id, done: !!state.dream.done } : NONE;
  return { name, country, friend, place, thing, hobby, dream };
}

const fill = (line: Line, fact: LetterFact): Line => ({
  ja: line.ja.replaceAll('{x}', fact.ja),
  en: line.en.replaceAll('{x}', fact.en),
  ar: line.ar.replaceAll('{x}', fact.ar),
});

/** One frame as the Letter screen shows it: the pre-filled starter and the three suggestions, from the facts (or the fallback when the fact is unknown). */
export function letterFrame(frame: LetterFrame, facts: ReturnType<typeof letterFacts>): { id: string; prompt: Gloss; starter: Line; suggestions: Line[]; fromFact: boolean } {
  const fact = facts[frame.source];
  if (fact.known) return { id: frame.id, prompt: frame.prompt, starter: fill(frame.starter, fact), suggestions: frame.suggestions.map((s) => fill(s, fact)), fromFact: true };
  // nothing bought: the dream, when one is tracked (its own sentence, `LETTER_DREAMS`)
  const dream = frame.source === 'thing' && facts.dream.known && facts.dream.id ? letterDream(facts.dream.id, !!facts.dream.done) : null;
  if (dream) return { id: frame.id, prompt: frame.prompt, starter: dream.starter, suggestions: [...dream.suggestions], fromFact: true };
  return { id: frame.id, prompt: frame.fallback.prompt ?? frame.prompt, starter: frame.fallback.starter, suggestions: [...frame.fallback.suggestions], fromFact: false };
}

/** All five frames for a save. */
export const letterFrames = (pack: Parameters<typeof letterFacts>[0], state: GameState, profileName = '') => {
  const facts = letterFacts(pack, state, profileName);
  return LETTER_FRAMES.map((f) => letterFrame(f, facts));
};

/** Normalises a sentence for comparison (spaces, `|`, final punctuation). */
const normJa = (ja: string): string => bare(ja).replace(/[\s。．.!！?？、,]/g, '');

/** A written line the Letter (or the diary) accepts: some Japanese, at most 120 characters. */
export const letterLineOk = (ja: string): boolean => {
  const t = ja.trim();
  return t.length > 0 && t.length <= 120 && JA_TEXT.test(t);
};

/**
 * Whether a Letter sentence is assisted (§7.2): picked from the suggestions or translated, or typed / spoken as a copy of a suggestion that was on
 * screen (shown text, §3.2). Anything else typed or spoken is the learner's own.
 */
export function letterAssisted(ja: string, how: { picked?: boolean; translated?: boolean; shown?: readonly string[] }): boolean {
  if (how.picked || how.translated) return true;
  const n = normJa(ja);
  return (how.shown ?? []).some((s) => normJa(s) === n);
}

/** Whether a set of sentences is the Letter c8_1 asks for (the same rule as the game's `letter_saved`). */
export const letterComplete = (sentences: readonly LetterSentence[]): boolean =>
  sentences.filter((s) => letterLineOk(s.ja)).length >= LETTER_RULE.sentences && sentences.filter((s) => letterLineOk(s.ja) && !s.assisted).length >= LETTER_RULE.minOwn;

/** The diary lines the Letter card replays under the five sentences, oldest chapter first. */
export const letterDiary = (state: Pick<GameState, 'diary'>): DiaryEntry[] => [...(state.diary ?? [])].sort((a, b) => a.chapter - b.chapter);

// ---------------------------------------------------------------------------------------------------------------
// The diary (every closing beat from Chapter 2 on, `ask: 'diary'`): two taps, what happened + how it felt
// ---------------------------------------------------------------------------------------------------------------

export interface DiaryPrompt {
  chapter: number;
  /** what the diary step asks */
  prompt: Gloss;
  /** first tap: what happened in this chapter */
  what: [Line, Line, Line];
}

/** Second tap: how it felt (any chapter). */
export const DIARY_FEELINGS: [Line, Line, Line] = [
  L('今日|は|楽しかった|です|。', 'Today was fun.', 'كان اليوم ممتعًا.'),
  L('つかれました|。', 'I got tired.', 'تعبت.'),
  L('また|がんばります|。', "I'll do my best again.", 'سأبذل جهدي مرة أخرى.'),
];

const ASK: Gloss = { en: 'One line for your diary: what happened, and how was it?', ar: 'سطر واحد ليومياتك: ماذا حدث، وكيف كان؟' };

export const DIARY_PROMPTS: Record<number, DiaryPrompt> = {
  2: { chapter: 2, prompt: ASK, what: [L('アルバイト|を|しました|。', 'I did a part-time job.', 'عملت بدوام جزئي.'), L('ラーメン|を|食べました|。', 'I ate ramen.', 'أكلت الرامن.'), L('友だち|と|話しました|。', 'I talked with a friend.', 'تحدثت مع صديق.')] },
  3: { chapter: 3, prompt: ASK, what: [L('ミオ|さん|と|友だち|に|なりました|。', 'Mio and I became friends.', 'أصبحت أنا وميو صديقين.'), L('公園|に|行きました|。', 'I went to the park.', 'ذهبت إلى الحديقة.'), L('プレゼント|を|あげました|。', 'I gave a present.', 'قدّمت هدية.')] },
  4: { chapter: 4, prompt: ASK, what: [L('スマホ|を|買いました|。', 'I bought a phone.', 'اشتريت هاتفًا.'), L('友だち|に|メッセージ|を|送りました|。', 'I sent a friend a message.', 'أرسلت رسالة إلى صديق.'), L('新しい|言葉|を|覚えました|。', 'I learned new words.', 'تعلّمت كلمات جديدة.')] },
  5: { chapter: 5, prompt: ASK, what: [L('電車|に|乗りました|。', 'I rode the train.', 'ركبت القطار.'), L('光が丘|に|行きました|。', 'I went to Hikarigaoka.', 'ذهبت إلى هيكاريغاؤكا.'), L('駅|で|働きました|。', 'I worked at the station.', 'عملت في المحطة.')] },
  6: { chapter: 6, prompt: ASK, what: [L('友だち|の|家|に|行きました|。', "I went to a friend's home.", 'ذهبت إلى بيت صديق.'), L('お茶|を|飲みました|。', 'I drank tea.', 'شربت الشاي.'), L('部屋|を|見ました|。', 'I looked at a room.', 'شاهدت غرفة.')] },
  7: { chapter: 7, prompt: ASK, what: [L('お祭り|に|行きました|。', 'I went to the festival.', 'ذهبت إلى المهرجان.'), L('たこ焼き|を|食べました|。', 'I ate takoyaki.', 'أكلت التاكوياكي.'), L('自己紹介|を|しました|。', 'I gave my self-introduction.', 'قدّمت نفسي.')] },
};

/** The prompt of a chapter's diary step (a chapter without its own lines borrows the nearest earlier one). */
export const diaryPrompt = (chapter: number): DiaryPrompt => DIARY_PROMPTS[chapter] ?? DIARY_PROMPTS[Math.max(2, Math.min(7, chapter))]!;

/** The two-tap diary line: what happened + how it felt. Tapped, so assisted. Pass the result to `diary_added` with `chapter`. */
export function diaryLine(chapter: number, what: number, feel: number): DiaryEntry & { line: Line } {
  const w = diaryPrompt(chapter).what[what] ?? diaryPrompt(chapter).what[0];
  const f = DIARY_FEELINGS[feel] ?? DIARY_FEELINGS[0];
  const line = L(`${w.ja}|${f.ja}`, `${w.en} ${f.en}`, `${w.ar} ${f.ar}`);
  return { chapter, ja: bare(line.ja), assisted: true, line };
}
