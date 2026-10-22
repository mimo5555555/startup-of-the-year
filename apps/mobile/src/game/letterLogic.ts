// The Letter Home's app logic (docs/GAME_DESIGN.md §7.2 Chapter 8, Release 2 wave C2): the five drafts and how each was written, the sentences
// `letter_saved` stores (only the written Japanese: no audio is ever recorded, the microphone is used for recognition only), the card's lines and
// glosses, the TTS read-back text and the card as a PNG drawn on a canvas and handed to the browser as a local download (no network).
// The frames, facts and the own/assisted rule are the content's (`@lw/content` letter.ts); this module only keeps the drafts.
import { hasJapanese, romajiToHiragana } from '@lw/core';
import { DIARY_FEELINGS, DIARY_PROMPTS, LEXICON, LETTER_HEADER, LETTER_RULE, LETTER_SIGN, diaryLine, letterAssisted, letterComplete, letterLineOk, romajiText, segmentFree, tokenize, type Line, type Token } from '@lw/content';
import type { DiaryEntry, GamePack, LetterSentence } from '@lw/game';

type Lang = 'en' | 'ar';

/** How a draft was written: typed or spoken is the learner's own (unless it copies text that was on screen), picked or translated is assisted. */
export type LetterHow = 'typed' | 'spoken' | 'picked' | 'translated';

export interface LetterDraft {
  frameId: string;
  /** the written Japanese (plain text, no markup) */
  ja: string;
  how: LetterHow;
  /** the sentence's meaning when the game knows it (a picked suggestion, the learner's own words for a translation) */
  gloss?: { en: string; ar: string };
  /** Japanese text that was on screen for this frame when it was written (the pre-filled start, the ideas once shown) */
  shown: string[];
}

/** The written form of a markup line (`|` removed). */
export const bareJa = (ja: string): string => ja.replace(/\|/g, '');

/**
 * What the learner typed, as Japanese: kana or kanji as typed, romaji read as hiragana; null when it is not Japanese (the Letter keeps only
 * Japanese, `letterLineOk`).
 */
export function typedJapanese(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (hasJapanese(t)) return letterLineOk(t) ? t : null;
  const r = romajiToHiragana(t.replace(/[.!?]+$/, ''));
  if (!r.ok || !r.kana) return null;
  const ja = `${r.kana.replace(/\s+/g, '')}。`;
  return letterLineOk(ja) ? ja : null;
}

/** A draft as the game stores it: the Japanese and whether it was assisted (§7.2: picked, translated, or a copy of shown text). */
export const sentenceOf = (d: LetterDraft): LetterSentence => ({
  ja: d.ja,
  assisted: letterAssisted(d.ja, { picked: d.how === 'picked', translated: d.how === 'translated', shown: d.shown }),
});

export interface LetterTally {
  /** frames written */
  written: number;
  /** of them, the learner's own */
  own: number;
  need: number;
  total: number;
  /** five written, three of them own: the Letter can be finished (the game's `letter_written` rule) */
  complete: boolean;
}

export function tallyOf(drafts: ReadonlyArray<LetterDraft | null>, total: number = LETTER_RULE.sentences): LetterTally {
  const ss = drafts.filter((d): d is LetterDraft => !!d).map(sentenceOf);
  return { written: ss.length, own: ss.filter((s) => !s.assisted).length, need: LETTER_RULE.minOwn, total, complete: ss.length >= total && letterComplete(ss) };
}

/** What `letter_saved` stores: the five sentences in frame order, then the diary lines the learner added (kept with their own assisted flag). */
export function letterSentences(drafts: ReadonlyArray<LetterDraft | null>, extras: readonly DiaryEntry[] = []): LetterSentence[] {
  return [...drafts.filter((d): d is LetterDraft => !!d).map(sentenceOf), ...extras.map((e) => ({ ja: e.ja, assisted: e.assisted }))];
}

/** The drafts a saved Letter reopens with (Edit): the frames in order; how each was written is not stored, so own lines come back as typed. */
export function draftsFromSaved(frameIds: readonly string[], saved: readonly LetterSentence[]): Array<LetterDraft | null> {
  return frameIds.map((frameId, i) => {
    const s = saved[i];
    return s ? { frameId, ja: s.ja, how: s.assisted ? 'picked' : 'typed', shown: [] } : null;
  });
}

/** The meaning of a two-tap diary line (any chapter's what x how it felt); a typed line has none (the card then glosses it word by word). */
export function diaryGloss(ja: string): { en: string; ar: string } | undefined {
  for (const ch of Object.keys(DIARY_PROMPTS).map(Number))
    for (let w = 0; w < 3; w++)
      for (let f = 0; f < DIARY_FEELINGS.length; f++) {
        const d = diaryLine(ch, w, f);
        if (d.ja === ja) return { en: d.line.en, ar: d.line.ar };
      }
  return undefined;
}

/** The chapter a closing beat closes (either of a chapter's two designed closings, `beats.closeIf`): the diary line is that chapter's. */
export const closingChapterOf = (pack: Pick<GamePack, 'chapters'>, beatId: string): number | undefined =>
  pack.chapters.find((c) => c.beats.close === beatId || c.beats.closeIf?.id === beatId)?.n;

// ---------------------------------------------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------------------------------------------

export interface CardLine {
  ja: string;
  tokens: Token[];
  romaji: string;
  /** the meaning in the UI language: the sentence's own gloss, else word by word from the dictionary */
  gloss: string;
  assisted: boolean;
  diary?: boolean;
}

/** Word-by-word meaning of free Japanese (the learner's own sentence has no stored translation). */
export function wordGloss(tokens: readonly Token[], lang: Lang): string {
  return tokens
    .filter((t) => !t.punct && t.gloss && !t.grammar)
    .map((t) => t.gloss![lang])
    .filter(Boolean)
    .join(' · ');
}

const fill = (line: Line, name: string): Line => ({ ja: line.ja.replaceAll('{x}', name), en: line.en.replaceAll('{x}', name), ar: line.ar.replaceAll('{x}', name) });

/**
 * Everything the card shows: the header, the sentences (with glosses), the diary lines added, the signature. `name` is the Japanese name (the
 * katakana of Chapter 1); `shownName` is how the signature's gloss says it (the profile name as typed), the Japanese name when absent.
 */
export function cardOf(sentences: readonly LetterSentence[], glosses: ReadonlyArray<{ en: string; ar: string } | undefined>, name: string, lang: Lang, diaryCount = 0, shownName = '') {
  const lineOf = (ja: string, assisted: boolean, gloss: { en: string; ar: string } | undefined, diary: boolean): CardLine => {
    const tokens = segmentFree(ja, LEXICON);
    return { ja, tokens, romaji: romajiText(tokens), gloss: gloss?.[lang] || wordGloss(tokens, lang), assisted, ...(diary ? { diary } : {}) };
  };
  const body = sentences.map((s, i) => lineOf(s.ja, s.assisted, glosses[i], i >= sentences.length - diaryCount));
  const head = LETTER_HEADER;
  const sign = fill(LETTER_SIGN, name || '…');
  return {
    header: { ja: bareJa(head.ja), tokens: tokenize(head.ja, LEXICON).tokens, gloss: head[lang] },
    lines: body,
    sign: { ja: bareJa(sign.ja), tokens: tokenize(sign.ja, LEXICON, { x: { ja: name, raw: true } }).tokens, gloss: fill(LETTER_SIGN, shownName.trim() || name || '…')[lang] },
  };
}

export type LetterCardData = ReturnType<typeof cardOf>;

/** What Hanako reads back (TTS): the header, every sentence, the signature. */
export const readBackText = (card: LetterCardData): string => [card.header.ja, ...card.lines.map((l) => l.ja), card.sign.ja].join('\n');

// ---------------------------------------------------------------------------------------------------------------
// The card as an image: a 2D canvas, saved with a local download (an object URL; nothing leaves the device)
// ---------------------------------------------------------------------------------------------------------------

const W = 1080;
const PAD = 84;
const JA_FONT = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif';
const GLOSS_FONT = '"Noto Sans Arabic", system-ui, sans-serif';

/** Breaks text into lines that fit `max` px: Japanese by character, other scripts by word. */
export function wrapText(measure: (s: string) => number, text: string, max: number): string[] {
  const units = hasJapanese(text) ? Array.from(text) : text.split(/(\s+)/);
  const out: string[] = [];
  let cur = '';
  for (const u of units) {
    const next = cur + u;
    if (cur && measure(next) > max) {
      out.push(cur.trim());
      cur = u.trimStart();
    } else cur = next;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Draws the card (furigana are left to the screen; the image carries the Japanese, the romaji when asked for, and the gloss). Returns the height used. */
export function drawCard(ctx: CanvasRenderingContext2D, card: LetterCardData, opts: { lang: Lang; romaji: boolean; title: string; height?: number }): number {
  const rtl = opts.lang === 'ar';
  const max = W - PAD * 2;
  let y = PAD;
  const paint = opts.height !== undefined;
  if (paint) {
    ctx.fillStyle = '#fffaf2';
    ctx.fillRect(0, 0, W, opts.height!);
    ctx.strokeStyle = '#e8b4a0';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, W - 48, opts.height! - 48);
  }
  const text = (s: string, font: string, color: string, size: number, align: 'start' | 'gloss' = 'start') => {
    ctx.font = `${align === 'gloss' ? 500 : 700} ${size}px ${align === 'gloss' ? GLOSS_FONT : JA_FONT}`;
    const isRtl = align === 'gloss' && rtl;
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';
    for (const row of wrapText((x) => ctx.measureText(x).width, s, max)) {
      y += size * 1.35;
      if (paint) {
        ctx.fillStyle = color;
        ctx.fillText(row, isRtl ? W - PAD : PAD, y);
      }
    }
  };
  text(opts.title, '', '#b4553a', 34, 'gloss');
  y += 18;
  text(card.header.ja, '', '#2a2440', 52);
  text(card.header.gloss, '', '#6b6580', 30, 'gloss');
  y += 22;
  for (const l of card.lines) {
    text(l.ja, '', '#2a2440', 48);
    if (opts.romaji && l.romaji) text(l.romaji, '', '#6b6580', 28, 'gloss');
    if (l.gloss) text(l.gloss, '', '#6b6580', 30, 'gloss');
    y += 20;
  }
  y += 10;
  text(card.sign.ja, '', '#2a2440', 48);
  text(card.sign.gloss, '', '#6b6580', 30, 'gloss');
  return y + PAD;
}

/** Renders the card on a fresh canvas and downloads it as a PNG (an object URL clicked through a download link). */
export async function saveCardImage(card: LetterCardData, opts: { lang: Lang; romaji: boolean; title: string; filename?: string }): Promise<boolean> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  canvas.width = W;
  canvas.height = 10;
  const height = Math.ceil(drawCard(ctx, card, opts));
  canvas.height = height;
  drawCard(ctx, card, { ...opts, height });
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename ?? 'letter-home.png';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
