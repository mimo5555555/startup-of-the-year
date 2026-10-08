// The hidden-line "Say it" (docs/GAME_DESIGN.md §11.1 recall, §11.3 echo): the meaning is shown and the Japanese is hidden. The learner
// says it (mic), types it (kana, kanji or romaji) or builds it from tiles; Peek shows the line instead. Prepare's recall check and the
// debrief's echo button are both this component with a different pass mark. Everything is retryable at once; there is no failure state.
import { useMemo, useState } from 'react';
import { LEXICON, tokenize } from '@lw/content';
import { explainSttError } from '@lw/engine';
import type { PocketLine } from '@lw/game';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { blip, speakJa, stt } from '../../services';
import { plainOf, recallScore, recallScoreSpoken, tileDeck, tilePieces, tilesCorrect } from '../../game/prepareLogic';
import type { StringKey } from '../../i18n';

export interface SayItProps {
  /** the line as markup (hidden until it is passed or peeked) */
  ja: string;
  meaning: { en: string; ar: string };
  /** the similarity that passes */
  mark: number;
  /** the pocket line and its neighbours: when given, "build it from the pieces" is offered */
  tiles?: { line: PocketLine; others: PocketLine[] };
  /** a pass; `similarity` is >= mark (1 for tiles in order) */
  onPass(similarity: number): void;
  /** Peek was used: the line is shown and this attempt can no longer pass */
  onPeek(): void;
  /** the label of the Peek button (Prepare and the debrief word the cost differently) */
  peekLabel?: string;
}

type Result = { kind: 'pass' } | { kind: 'peek' } | { kind: 'near'; sim: number } | null;

export function SayIt({ ja, meaning, mark, tiles, onPass, onPeek, peekLabel }: SayItProps) {
  const { t, lang, dir } = useT();
  const settings = useStore((s) => s.settings);
  const plain = useMemo(() => plainOf(ja), [ja]);
  const jaTokens = useMemo(() => tokenize(ja, LEXICON).tokens, [ja]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result>(null);
  const [listening, setListening] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'type' | 'build'>('type');
  const deck = useMemo(() => (tiles ? tileDeck(tiles.line, tiles.others) : []), [tiles]);
  const [built, setBuilt] = useState<number[]>([]);
  const locked = result?.kind === 'pass' || result?.kind === 'peek';

  const pass = (sim: number) => {
    setResult({ kind: 'pass' });
    blip('good', settings.autoSpeak);
    // the line is shown now: say it back at normal speed
    speakJa(plain, { rate: 1 });
    onPass(sim);
  };
  const judge = (sim: number) => {
    if (sim >= mark) pass(sim);
    else {
      setResult({ kind: 'near', sim });
      blip('bad', settings.autoSpeak);
    }
  };

  const submit = () => {
    if (locked || !text.trim()) return;
    judge(recallScore(text, plain));
  };

  const listen = () => {
    if (locked || listening) return;
    if (!stt.available()) {
      setMicMsg(t('audio.mic.err.unsupported'));
      return;
    }
    setMicMsg(null);
    setListening(true);
    stt
      .listen('ja-JP', (interim) => setText(interim))
      .result.then((r) => {
        setText(r.text);
        judge(recallScoreSpoken(r, plain));
      })
      .catch((e: unknown) => {
        const id = explainSttError(e);
        setText('');
        if (id !== 'cancelled') setMicMsg(t(`audio.mic.err.${id}` as StringKey));
      })
      .finally(() => setListening(false));
  };

  const peek = () => {
    if (locked) return;
    setResult({ kind: 'peek' });
    speakJa(plain, { rate: 0.9 });
    onPeek();
  };

  const tapTile = (id: number) => {
    if (locked || built.includes(id)) return;
    const next = [...built, id];
    setBuilt(next);
    if (next.length === tilePieces(ja).length) {
      const pieces = next.map((i) => deck.find((d) => d.id === i)!.s);
      if (tilesCorrect(pieces, ja)) pass(1);
      else {
        setResult({ kind: 'near', sim: 0 });
        blip('bad', settings.autoSpeak);
      }
    }
  };

  const meaningText = lang === 'ar' ? meaning.ar : meaning.en;
  const showLine = locked;

  return (
    <div className="prep-say">
      <p className="prep-meaning" dir="auto">
        {meaningText}
      </p>
      <div className="prep-line-slot" aria-live="polite">
        {showLine ? (
          <JaText tokens={jaTokens} furigana={settings.furigana} romaji={settings.romaji} size="xl" />
        ) : (
          <span className="prep-hidden" aria-label={t('prep.hidden')}>
            <i /> <i /> <i />
          </span>
        )}
      </div>
      <div className="prep-row">
        <button type="button" className="btn soft prep-btn" onClick={() => speakJa(plain, { rate: 0.9 })}>
          <Icon name="volume" size={18} /> {t('prep.replay')}
        </button>
        {!locked && (
          <button type="button" className="btn soft prep-btn" onClick={peek}>
            <Icon name="eye" size={18} /> {peekLabel ?? t('prep.peek')}
          </button>
        )}
      </div>

      {!locked && mode === 'type' && (
        <form
          className="prep-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {stt.available() && (
            <button type="button" className={`mic ${listening ? 'rec' : ''}`} onClick={listen} aria-label={t('prep.recall')}>
              <Icon name="mic" size={22} />
            </button>
          )}
          <input
            className="say prep-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (result?.kind === 'near') setResult(null);
            }}
            placeholder={t('prep.type.placeholder')}
            aria-label={t('prep.type.placeholder')}
            dir="ltr"
            lang="ja"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="send" type="submit" disabled={!text.trim()} aria-label={t('prep.check')}>
            <Icon name="check" size={20} />
          </button>
        </form>
      )}

      {!locked && mode === 'build' && (
        <div className="prep-build">
          <p className="muted small" dir="auto">
            {t('prep.build.hint')}
          </p>
          <div className="prep-built" dir="ltr" aria-label={t('prep.build.hint')}>
            {built.map((id) => (
              <button key={id} type="button" className="prep-tile on" onClick={() => {
                  setBuilt(built.filter((b) => b !== id));
                  setResult(null);
                }}
                lang="ja">
                {deck.find((d) => d.id === id)!.s}
              </button>
            ))}
            {built.length === 0 && <span className="prep-built-empty">…</span>}
          </div>
          <div className="prep-tiles" dir="ltr">
            {deck
              .filter((d) => !built.includes(d.id))
              .map((d) => (
                <button key={d.id} type="button" className="prep-tile" onClick={() => tapTile(d.id)} lang="ja">
                  {d.s}
                </button>
              ))}
          </div>
          {built.length > 0 && (
            <button
              type="button"
              className="btn soft prep-btn"
              onClick={() => {
                setBuilt([]);
                setResult(null);
              }}
            >
              {t('prep.reset')}
            </button>
          )}
        </div>
      )}

      {!locked && micMsg && (
        <small className="muted" dir="auto" role="status">
          {micMsg}
        </small>
      )}
      {!locked && result?.kind === 'near' && (
        <p className="prep-verdict near" dir="auto" role="status">
          {mode === 'build' ? t('prep.build.wrong') : t('prep.almost')}
        </p>
      )}
      {result?.kind === 'pass' && (
        <p className="prep-verdict ok" dir={dir} role="status">
          <Icon name="check" size={18} stroke={3} /> {t('prep.right')}
        </p>
      )}
      {result?.kind === 'peek' && (
        <p className="prep-verdict peek" dir="auto" role="status">
          {t('prep.peeked')}
        </p>
      )}

      {!locked && tiles && (
        <button
          type="button"
          className="prep-link"
          onClick={() => {
            setMode(mode === 'type' ? 'build' : 'type');
            setResult(null);
            setBuilt([]);
          }}
        >
          {mode === 'type' ? t('prep.build') : t('prep.type.instead')}
        </button>
      )}
    </div>
  );
}
