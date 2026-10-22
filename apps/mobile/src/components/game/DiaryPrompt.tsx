// The one-line diary of a chapter's closing beat (docs/GAME_DESIGN.md §7.2, Release 2 wave C2): two taps (what happened, then how it felt:
// `diaryLine`, assisted) or a sentence typed in Japanese (kana, kanji or romaji: the learner's own). Skipping never blocks the story. The
// entry goes to `diary_added`; the Letter Home replays the lines (`letterDiary`).
import { useMemo, useState } from 'react';
import { DIARY_FEELINGS, LEXICON, diaryLine, diaryPrompt, tokenize, type Line } from '@lw/content';
import type { DiaryEntry } from '@lw/game';
import { JaText } from '../JaText';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { meaningOf } from '../../content';
import { typedJapanese } from '../../game/letterLogic';

export interface DiaryPromptProps {
  /** the chapter whose closing beat asks (not the current one: the chapter is already over when its closing plays) */
  chapter: number;
  /** the entry, or null when skipped */
  onDone: (entry: DiaryEntry | null) => void;
}

export function DiaryPrompt({ chapter, onDone }: DiaryPromptProps) {
  const { t, lang } = useT();
  const prompt = diaryPrompt(chapter);
  const [what, setWhat] = useState<number | null>(null);
  const [feel, setFeel] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState(false);
  const tapped = what !== null && feel !== null ? diaryLine(chapter, what, feel) : null;

  const saveTyped = () => {
    const ja = typedJapanese(typed);
    if (!ja) {
      setMsg(true);
      return;
    }
    onDone({ chapter, ja, assisted: false });
  };

  return (
    <form
      className="qst-beat-card ask dia"
      data-step="diary"
      data-chapter={chapter}
      onSubmit={(e) => {
        e.preventDefault();
        if (typed.trim()) saveTyped();
        else if (tapped) onDone({ chapter: tapped.chapter, ja: tapped.ja, assisted: true });
      }}
    >
      <span className="qst-ask">
        <span className="label" dir="auto">
          {prompt.prompt[lang]}
        </span>
        <small className="muted" dir="auto">
          {t('story.diaryTwoTaps')}
        </small>
        <ChipRow label={t('story.diaryWhat')} lines={prompt.what} picked={what} attr="data-what" onPick={setWhat} />
        <ChipRow label={t('story.diaryFeel')} lines={DIARY_FEELINGS} picked={feel} attr="data-feel" onPick={setFeel} />
        <label className="label dia-or" htmlFor="qst-diary">
          {t('letter.diaryOr')}
        </label>
        <span className="qst-ask-row">
          <input
            id="qst-diary"
            className="field"
            lang="ja"
            dir="auto"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={120}
            value={typed}
            placeholder={t('letter.typePh')}
            onChange={(e) => {
              setTyped(e.target.value);
              setMsg(false);
            }}
          />
        </span>
        {msg && (
          <small className="muted" role="status" dir="auto">
            {t('letter.needJa')}
          </small>
        )}
        <span className="qst-ask-actions">
          <button type="button" className="btn soft" data-skip="1" onClick={() => onDone(null)}>
            {t('quests.skip')}
          </button>
          <button type="submit" className="btn primary" data-save="1" disabled={!typed.trim() && !tapped}>
            {t('common.save')}
          </button>
        </span>
        {tapped && !typed.trim() && (
          <small className="dia-preview" data-preview="1" dir="auto">
            <span lang="ja" dir="ltr">
              {tapped.ja}
            </span>{' '}
            · {meaningOf(tapped.line, lang)}
          </small>
        )}
      </span>
    </form>
  );
}

/** Three Japanese lines to tap (one picked at a time), each with its gloss. */
function ChipRow({ label, lines, picked, attr, onPick }: { label: string; lines: readonly Line[]; picked: number | null; attr: string; onPick: (i: number) => void }) {
  const { lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const tokens = useMemo(() => lines.map((l) => tokenize(l.ja, LEXICON).tokens), [lines]);
  return (
    <span className="dia-group" role="radiogroup" aria-label={label}>
      <small className="label">{label}</small>
      <span className="dia-chips">
        {lines.map((l, i) => (
          <button key={i} type="button" role="radio" aria-checked={picked === i} className={`dia-chip${picked === i ? ' on' : ''}`} {...{ [attr]: i }} onClick={() => onPick(i)}>
            <JaText tokens={tokens[i]!} furigana={furigana} romaji={false} size="sm" />
            <small dir="auto">{meaningOf(l, lang)}</small>
          </button>
        ))}
      </span>
    </span>
  );
}
