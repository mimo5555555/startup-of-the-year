// 銭湯「桜の湯」: in the bath. Opens on the street after paying Genzō at the bandai (the bridge sees the bath bought). A painted Mount Fuji over
// the tiled bath, steam, and the bath manners to put in order: the four steps (SENTO_STEPS) are shown shuffled; tapping the next right one
// places it (its Japanese is spoken and its tip shown), a wrong one shakes and says that something comes first. All four placed: さっぱり！ and
// the button that starts the talk after the bath with Genzō (いいお湯でした, the after-bath milk). Escape or ✕ closes it.
import { useEffect, useState } from 'react';
import { SENTO_STEPS } from '@lw/content';
import { lineTokens } from '../../content';
import { startConversation } from '../../game/bridge';
import { useSento } from '../../game/sentoStore';
import { useT } from '../../hooks';
import { blip, tts } from '../../services';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { JaText } from '../JaText';

/** the order the steps are shown in: a fixed shuffle that is never the right order */
export const BATH_SHUFFLE = [2, 0, 3, 1];

export function SentoBath() {
  const { t, lang } = useT();
  const open = useSento((s) => s.open);
  const settings = useStore((s) => s.settings);
  const [placed, setPlaced] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const close = () => useSento.getState().setOpen(false);
  // a fresh bath each time it opens
  useEffect(() => {
    if (!open) return;
    setPlaced(0);
    setWrong(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  const done = placed >= SENTO_STEPS.length;
  const tap = (k: number) => {
    if (k < placed) return;
    if (k !== placed) {
      setWrong(k);
      blip('bad', settings.autoSpeak);
      return;
    }
    setWrong(null);
    setPlaced(k + 1);
    blip(k + 1 === SENTO_STEPS.length ? 'level' : 'good', settings.autoSpeak);
    if (settings.autoSpeak) void tts.speak(SENTO_STEPS[k]!.line.ja.replace(/\|/g, ''), {}).catch(() => {});
  };
  const after = () => {
    close();
    startConversation({ scenarioId: 'sento_after', characterId: 'genzo' });
  };
  return (
    <div className="scrim hud-scrim" onClick={close}>
      <div className="word-sheet hud-sheet sb-sheet" role="dialog" aria-modal="true" aria-label={t('sb.title')} onClick={(e) => e.stopPropagation()} data-sento-bath data-placed={placed}>
        <button className="icon-btn ghost word-close" onClick={close} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <header className="hud-sheet-head">
          <div>
            <h2 dir="auto">{t('sb.title')}</h2>
            <p lang="ja">桜の湯・お風呂の作法</p>
          </div>
        </header>
        <div className={`sb-mural${done ? ' done' : ''}`} aria-hidden="true">
          <span className="sb-fuji" />
          <span className="sb-snow" />
          <span className="sb-water" />
          <span className="sb-steam s1" />
          <span className="sb-steam s2" />
          <span className="sb-steam s3" />
          {done && <span className="sb-sappari" lang="ja">さっぱり！</span>}
        </div>
        {!done && (
          <p className="hud-choose" dir="auto">
            {wrong !== null ? t('sb.wrong') : t('sb.intro')}
          </p>
        )}
        <ol className="sb-steps">
          {/* the placed steps move to the top in their order; the rest stay shuffled below */}
          {[...SENTO_STEPS.keys()].filter((k) => k < placed).concat(BATH_SHUFFLE.filter((k) => k >= placed)).map((k) => {
            const step = SENTO_STEPS[k]!;
            const isPlaced = k < placed;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`card sb-step${isPlaced ? ' placed' : ''}${wrong === k ? ' wrong' : ''}`}
                  onClick={() => tap(k)}
                  aria-pressed={isPlaced}
                  data-sb-step={step.id}
                  data-placed={isPlaced ? 1 : 0}
                >
                  <span className="sb-num" dir="ltr">
                    {isPlaced ? k + 1 : '?'}
                  </span>
                  <span className="sb-text">
                    <JaText tokens={lineTokens(step.line.ja)} furigana={settings.furigana} romaji={settings.romaji} size="sm" />
                    <small dir="auto">{lang === 'ar' ? step.line.ar : step.line.en}</small>
                    {isPlaced && (
                      <small className="sb-tip" dir="auto">
                        {step.tip[lang === 'ar' ? 'ar' : 'en']}
                      </small>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {done && (
          <div className="sb-done">
            <p dir="auto">{t('sb.done')}</p>
            <button type="button" className="btn primary wide" onClick={after} data-sb-after>
              {t('sb.after')}
            </button>
            <button type="button" className="btn soft wide" onClick={close} data-sb-later>
              {t('sb.later')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
