import { useEffect, useRef, useState } from 'react';
import { AUDIO_CHECK_ID, AudioCheck, takeAudioCheckFocus } from '../components/AudioCheck';
import { Icon } from '../components/Icon';
import { useStore } from '../store';
import { useT } from '../hooks';
import type { UiLang } from '../i18n';

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
  const [confirm, setConfirm] = useState(false);
  const audioRef = useRef<HTMLElement>(null);

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
