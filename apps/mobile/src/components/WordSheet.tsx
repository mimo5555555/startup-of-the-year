import { JaText } from './JaText';
import { Icon } from './Icon';
import { useUi } from '../ui';
import { useStore } from '../store';
import { useT } from '../hooks';
import { speakJa, blip } from '../services';
import { exampleFor, meaningOf } from '../content';
import { romajiText } from '@lw/content';

/** Bottom card shown when a word is tapped: reading, meaning, audio and a save button. */
export function WordSheet() {
  const word = useUi((s) => s.word);
  const close = useUi((s) => s.closeWord);
  const { t, lang } = useT();
  const settings = useStore((s) => s.settings);
  const vocab = useStore((s) => s.vocab);
  const saveWord = useStore((s) => s.saveWord);
  const removeWord = useStore((s) => s.removeWord);
  const say = useStore((s) => s.say);
  if (!word) return null;

  const isPhrase = !!word.phrase;
  const key = isPhrase ? word.phrase!.written : word.token.s;
  const saved = vocab.find((v) => v.s === key);
  const gloss = word.token.gloss;
  const meaning = isPhrase ? { en: word.phrase!.en, ar: word.phrase!.ar } : gloss ? { en: gloss.en, ar: gloss.ar } : {};
  const example = word.example ?? (isPhrase ? undefined : exampleFor(word.token.s) ?? undefined);
  const canSave = isPhrase || (!!gloss && !word.token.grammar);

  return (
    <div className="scrim word-scrim" onClick={close}>
      <div className="word-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn ghost word-close" onClick={close} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <div className="word-main">
          <JaText tokens={isPhrase ? word.phrase!.tokens : [word.token]} furigana romaji size="xl" />
          <div className="word-meaning" dir="auto">
            {meaningOf(meaning, lang)}
          </div>
          {gloss && lang === 'ar' && <div className="word-alt" dir="ltr">{gloss.en}</div>}
          {gloss && lang === 'en' && <div className="word-alt" dir="rtl">{gloss.ar}</div>}
        </div>
        {example && (
          <div className="word-example">
            <JaText tokens={exampleTokens(example.ja)} furigana={settings.furigana} romaji={false} size="sm" />
            <div dir="auto">{lang === 'ar' ? example.ar : example.en}</div>
          </div>
        )}
        <div className="word-actions">
          <button className="btn soft" onClick={() => speakJa(isPhrase ? word.phrase!.written : word.token.s, { rate: 0.85 })}>
            <Icon name="volume" size={18} /> {t('common.listen')}
          </button>
          {canSave && (
            <button
              className={`btn ${saved ? 'soft' : 'primary'}`}
              onClick={() => {
                if (saved) {
                  removeWord(saved.id);
                  return;
                }
                saveWord({
                  kind: isPhrase ? 'phrase' : 'word',
                  s: key,
                  r: isPhrase ? undefined : word.token.r,
                  rom: isPhrase ? romajiText(word.phrase!.tokens) : word.token.rom,
                  meaning,
                  source: word.source,
                  example,
                });
                blip('good', settings.autoSpeak);
                say(t('common.saved'), 'good');
              }}
            >
              <Icon name={saved ? 'check' : 'bookmark'} size={18} /> {saved ? t('common.saved') : t('common.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { LEXICON, segmentFree } from '@lw/content';
function exampleTokens(ja: string) {
  return segmentFree(ja, LEXICON);
}
