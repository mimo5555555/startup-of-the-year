// The omikuji (おみくじ, docs/GOEN.md): a free fortune slip once a day at the shrine. It teaches one word due for review; 大吉 / 吉 / 小吉 decide
// only the wording (nothing random is ever an item or currency). The app hands the reducer the due words (`omikuji_drawn`), the reducer picks.
import { LEXICON, entryToToken, tokenize } from '@lw/content';
import { omikujiOpen } from '@lw/game';
import { useT } from '../../hooks';
import { dispatch } from '../../game/bridge';
import { useGameState } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { omikujiWords } from '../../game/goenLogic';
import { speakJa, blip } from '../../services';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { JaText } from '../JaText';

const FORTUNE_JA: Record<string, string> = { daikichi: '大吉', kichi: '吉', shokichi: '小吉' };

/** The word on the slip, as the player's own card shows it (else the lexicon's). */
export function omikujiWord(key: string | null, vocab: ReadonlyArray<{ key?: string; s: string; r?: string; rom?: string; meaning: { en?: string; ar?: string } }>) {
  if (!key) return null;
  const v = vocab.find((x) => x.key === key || x.s === key);
  if (v) return { s: v.s, r: v.r, rom: v.rom, en: v.meaning.en ?? '', ar: v.meaning.ar ?? v.meaning.en ?? '' };
  const e = LEXICON.get(key);
  if (!e) return null;
  const tk = entryToToken(e);
  return { s: tk.s, r: tk.r, rom: tk.rom, en: e.en, ar: e.ar };
}

export function Omikuji() {
  const { t, lang } = useT();
  const state = useGameState();
  const vocab = useStore((s) => s.vocab);
  const settings = useStore((s) => s.settings);
  const today = state.goen?.omikuji && state.goen.omikuji.day === state.clock.dayIndex ? state.goen.omikuji : null;
  const open = omikujiOpen(state);
  const fortune = today ? PACK.goen?.omikuji.find((f) => f.id === today.fortune) : undefined;
  const word = today ? omikujiWord(today.word, vocab) : null;

  const draw = () => {
    blip('good', settings.autoSpeak);
    dispatch({ t: 'omikuji_drawn', words: omikujiWords(vocab, Date.now()) });
  };

  return (
    <section className="gn-omikuji card" data-omikuji={today ? today.fortune : open ? 'open' : 'none'} aria-label={t('gn.omikuji.title')}>
      <header>
        <span className="gn-slip-ic" aria-hidden="true">
          <i />
        </span>
        <div>
          <strong>{t('gn.omikuji.title')}</strong>
          <small dir="auto">{t('gn.omikuji.sub')}</small>
        </div>
      </header>
      {!today && open && (
        <button type="button" className="btn primary wide" data-omikuji-draw onClick={draw}>
          {t('gn.omikuji.draw')}
        </button>
      )}
      {today && (
        <div className="gn-slip" data-slip={today.fortune}>
          <span className="gn-fortune" lang="ja">
            {FORTUNE_JA[today.fortune] ?? fortune?.name.ja}
          </span>
          <small dir="auto">{fortune ? fortune.name[lang] : t(`gn.omikuji.${today.fortune}` as 'gn.omikuji.kichi')}</small>
          {fortune && (
            <p className="gn-slip-line" dir="auto">
              <span lang="ja" dir="ltr">
                <JaText tokens={tokenize(fortune.line.ja.replaceAll('{word}', word?.s ?? ''), LEXICON).tokens} furigana={settings.furigana} romaji={false} size="md" />
              </span>
              <span>{(lang === 'ar' ? fortune.line.ar : fortune.line.en).replaceAll('{word}', word ? word[lang] : '')}</span>
            </p>
          )}
          {word && (
            <div className="gn-slip-word" data-omikuji-word={today.word ?? ''}>
              <small>{t('gn.omikuji.word')}</small>
              <button type="button" className="gn-word" onClick={() => speakJa(word.r ?? word.s, { rate: 0.8 })}>
                <Icon name="volume" size={16} />
                <bdi lang="ja" dir="ltr">
                  {word.s}
                  {word.r && word.r !== word.s ? ` · ${word.r}` : ''}
                </bdi>
                <span dir="auto">{word[lang]}</span>
              </button>
              <small className="muted" dir="auto">
                {t('gn.omikuji.line')}
              </small>
            </div>
          )}
          <small className="muted" dir="auto">
            {t('gn.omikuji.tomorrow')}
          </small>
        </div>
      )}
      {!today && !open && (
        <p className="muted small" dir="auto">
          {t('gn.omikuji.tomorrow')}
        </p>
      )}
    </section>
  );
}
