import { useEffect, useRef, useState } from 'react';
import { AUDIO_CHECK_ID, AudioCheck, takeAudioCheckFocus } from '../components/AudioCheck';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { useT } from '../hooks';
import type { UiLang } from '../i18n';
import { dispatch, observeDay } from '../game/bridge';
import { useDevMode } from '../game/hooks';
import pkg from '../../package.json';

/** Taps on the version line that switch the QA tools on or off (docs/GAME_DESIGN.md §15.1 rule 8). */
const DEV_TAPS = 7;
const DEV_TAP_WINDOW_MS = 2000;

type DevCmd = 'cash' | 'complete_objective' | 'advance_chapter' | 'advance_day';
// QA only, never shown by default and never translated: they are not part of the player's game
const DEV_TOOLS: Array<{ cmd: DevCmd; label: string }> = [
  { cmd: 'cash', label: '+¥10,000' },
  { cmd: 'complete_objective', label: 'Complete current objective' },
  { cmd: 'advance_chapter', label: 'Advance chapter' },
  { cmd: 'advance_day', label: 'Advance day' },
];

function Switch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button className="row-switch" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>
        <strong>{label}</strong>
        {sub && <small>{sub}</small>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`}>
        <i />
      </span>
    </button>
  );
}

export function Settings() {
  const { t, lang, dir } = useT();
  const go = useStore((s) => s.go);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const profile = useStore((s) => s.profile);
  const setUiLang = useStore((s) => s.setUiLang);
  const setLevel = useStore((s) => s.setLevel);
  const reset = useStore((s) => s.reset);
  const resetGameProgress = useStore((s) => s.resetGameProgress);
  const dev = useDevMode();
  const [confirm, setConfirm] = useState(false);
  const [confirmGame, setConfirmGame] = useState(false);
  const audioRef = useRef<HTMLElement>(null);
  const taps = useRef({ n: 0, at: 0 });

  const tapVersion = () => {
    const now = Date.now();
    const t7 = taps.current;
    t7.n = now - t7.at > DEV_TAP_WINDOW_MS ? 1 : t7.n + 1;
    t7.at = now;
    if (t7.n >= DEV_TAPS) {
      t7.n = 0;
      dispatch({ t: 'profile_set', dev: !dev });
    }
  };

  // arriving from 'Check audio' elsewhere: bring the check into view
  useEffect(() => {
    if (takeAudioCheckFocus()) audioRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <div className="panel" dir={dir}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.close')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('st.title')}</h1>
        <span />
      </header>
      <div className="panel-body">
        <section className="group">
          <h2 className="h2">{t('st.language')}</h2>
          <div className="seg-row">
            {(['en', 'ar'] as UiLang[]).map((l) => (
              <button key={l} className={`choice ${lang === l ? 'on' : ''}`} onClick={() => setUiLang(l)} lang={l}>
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
        </section>

        {profile && (
          <section className="group">
            <h2 className="h2">{t('st.level')}</h2>
            <div className="seg-row">
              {(['A1', 'A2'] as const).map((l) => (
                <button key={l} className={`choice ${profile.level === l ? 'on' : ''}`} onClick={() => setLevel(l)}>
                  {l} · {t(l === 'A1' ? 'ob.level.a1' : 'ob.level.a2')}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="group">
          <h2 className="h2">{t('st.reading')}</h2>
          <Switch on={settings.furigana} onChange={(v) => update({ furigana: v })} label={t('st.furigana')} sub={t('st.furigana.sub')} />
          <Switch on={settings.romaji} onChange={(v) => update({ romaji: v })} label={t('st.romaji')} sub={t('st.romaji.sub')} />
          <Switch on={settings.autoTranslate} onChange={(v) => update({ autoTranslate: v })} label={t('st.autoTranslate')} />
        </section>

        <section className="group" id={AUDIO_CHECK_ID} ref={audioRef}>
          <h2 className="h2">{t('st.speech')}</h2>
          <Switch on={settings.autoSpeak} onChange={(v) => update({ autoSpeak: v })} label={t('st.autoSpeak')} />
          <AudioCheck />
        </section>

        <section className="group">
          <h2 className="h2">{t('st.graphics')}</h2>
          <div className="seg-row">
            {(['auto', 'high', 'low'] as const).map((g) => (
              <button key={g} className={`choice ${settings.graphics === g ? 'on' : ''}`} onClick={() => update({ graphics: g })}>
                {t(`st.graphics.${g}` as 'st.graphics.auto')}
              </button>
            ))}
          </div>
        </section>

        <section className="group about">
          <h2 className="h2">{t('st.about')}</h2>
          <p dir="auto">{t('st.about1')}</p>
          <p dir="auto">{t('st.about2')}</p>
          <p dir="auto">{t('st.about3')}</p>
          <p className="version" dir="ltr" onClick={tapVersion} style={{ minHeight: 44, display: 'flex', alignItems: 'center', opacity: 0.6, fontSize: 13 }}>
            v{pkg.version}
          </p>
        </section>

        {dev && (
          <section className="group" aria-label="Developer tools" dir="ltr">
            <h2 className="h2">Developer tools</h2>
            <div className="seg-row" style={{ flexWrap: 'wrap' }}>
              {DEV_TOOLS.map((d) => (
                <button key={d.cmd} className="btn soft" data-dev={d.cmd} onClick={() => dispatch({ t: 'dev', cmd: d.cmd, amount: d.cmd === 'cash' ? 10_000 : undefined })}>
                  {d.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="group">
          {!confirmGame ? (
            <button className="btn soft danger-text" onClick={() => setConfirmGame(true)}>
              <Icon name="trash" size={18} /> {t('st.resetGame')}
            </button>
          ) : (
            <div className="card warn">
              <p dir="auto">{t('st.resetGameAsk')}</p>
              <div className="row">
                <button className="btn soft" onClick={() => setConfirmGame(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    resetGameProgress();
                    setConfirmGame(false);
                    // a fresh game starts with the opening beat, as after onboarding
                    observeDay();
                  }}
                >
                  {t('st.resetGameDo')}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="group">
          {!confirm ? (
            <button className="btn soft danger-text" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} /> {t('st.reset')}
            </button>
          ) : (
            <div className="card warn">
              <p dir="auto">{t('st.resetAsk')}</p>
              <div className="row">
                <button className="btn soft" onClick={() => setConfirm(false)}>
                  {t('common.cancel')}
                </button>
                <button className="btn danger" onClick={() => reset()}>
                  {t('st.resetDo')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
