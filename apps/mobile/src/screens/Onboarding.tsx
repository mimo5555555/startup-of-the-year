import { useState } from 'react';
import type { AvatarSpec } from '@lw/content';
import { AGE_GROUPS, CHARACTERS, GOALS, TOPICS } from '@lw/content';
import { Portrait } from '../components/Portrait';
import { Icon } from '../components/Icon';
import { useStore, type Profile } from '../store';
import { useT } from '../hooks';
import type { UiLang } from '../i18n';
import { HAIRS, JACKETS, SKINS } from '../content';
import { blip } from '../services';

const STEPS = 5;

export function Onboarding() {
  const { t, lang } = useT();
  const setUiLang = useStore((s) => s.setUiLang);
  const complete = useStore((s) => s.completeOnboarding);
  const updateSettings = useStore((s) => s.updateSettings);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [skin, setSkin] = useState(SKINS[1]);
  const [hair, setHair] = useState(0);
  const [jacket, setJacket] = useState(JACKETS[0]);
  const [level, setLevel] = useState<'A1' | 'A2'>('A1');
  const [goal, setGoal] = useState<Profile['goal']>('travel');
  const [age, setAge] = useState<Profile['age']>('adults');
  const [topics, setTopics] = useState<string[]>([]);

  const spec: AvatarSpec = {
    skin,
    hair: { style: HAIRS[hair].id, color: HAIRS[hair].color },
    top: jacket,
    bottom: '#343b55',
    shoes: '#f5f5f5',
    accent: '#ffd166',
    accessories: ['backpack'],
  };

  const valid = [true, name.trim().length > 0, true, true, topics.length >= 3][step];
  const next = () => {
    blip('tap');
    if (step < STEPS - 1) return setStep(step + 1);
    const profile: Profile = { name: name.trim().slice(0, 18), l1: lang, level, goal, age, topics, avatar: spec, createdAt: new Date().toISOString() };
    updateSettings({ autoTranslate: level === 'A1', romaji: level === 'A1' });
    complete(profile);
  };

  const pickLang = (l: UiLang) => {
    setUiLang(l);
    blip('tap');
  };

  const cast = ['yuki', 'kenji', 'mio'].map((id) => CHARACTERS.find((c) => c.id === id)!);

  return (
    <div className="onb">
      <header className="onb-top">
        <div className="onb-dots" aria-label={`${step + 1} / ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={i === step ? 'on' : i < step ? 'past' : ''} />
          ))}
        </div>
      </header>

      <main className="onb-body" key={step}>
        {step === 0 && (
          <>
            <div className="hero-cast" aria-hidden="true">
              {cast.map((c, i) => (
                <div className={`hero-face hero-${i}`} key={c.id}>
                  <Portrait spec={c.avatar} size={i === 1 ? 118 : 96} />
                </div>
              ))}
            </div>
            <h1 className="hero-title">{t('app.name')}</h1>
            <p className="hero-sub">{t('app.tagline')}</p>
            <h2 className="onb-h">{t('ob.lang.title')}</h2>
            <p className="muted">{t('ob.lang.sub')}</p>
            <div className="choice-row">
              <button className={`choice big ${lang === 'en' ? 'on' : ''}`} onClick={() => pickLang('en')} lang="en">
                English
              </button>
              <button className={`choice big ${lang === 'ar' ? 'on' : ''}`} onClick={() => pickLang('ar')} lang="ar">
                العربية
              </button>
            </div>
            <div className="soon">
              {['Español', 'Deutsch', 'Nederlands', 'Русский', '日本語'].map((l) => (
                <span key={l} className="chip dim">
                  {l}
                </span>
              ))}
            </div>
            <p className="muted small">{t('ob.lang.soon')}</p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="onb-h">{t('ob.you.title')}</h2>
            <div className="you-card">
              <div className="you-portrait">
                <Portrait spec={spec} size={104} />
              </div>
              <div className="you-fields">
                <label htmlFor="name" className="label">
                  {t('ob.you.name')}
                </label>
                <input id="name" className="field" value={name} maxLength={18} autoComplete="given-name" onChange={(e) => setName(e.target.value)} placeholder={lang === 'ar' ? 'Layla' : 'Sam'} />
                <p className="muted small">{t('ob.you.hint')}</p>
              </div>
            </div>
            <div className="look-group">
              <span className="label">{t('ob.you.hair')}</span>
              <div className="swatches">
                {HAIRS.map((h, i) => (
                  <button key={h.id} className={`swatch ${hair === i ? 'on' : ''}`} onClick={() => setHair(i)} aria-label={h.id}>
                    <Portrait spec={{ ...spec, hair: { style: h.id, color: h.color } }} size={44} />
                  </button>
                ))}
              </div>
            </div>
            <div className="look-group">
              <span className="label">{t('ob.you.skin')}</span>
              <div className="swatches">
                {SKINS.map((c) => (
                  <button key={c} className={`dot ${skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setSkin(c)} aria-label={c} />
                ))}
              </div>
            </div>
            <div className="look-group">
              <span className="label">{t('ob.you.jacket')}</span>
              <div className="swatches">
                {JACKETS.map((c) => (
                  <button key={c} className={`dot ${jacket === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setJacket(c)} aria-label={c} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="onb-h">{t('ob.level.title')}</h2>
            <div className="stack">
              {(['A1', 'A2'] as const).map((l) => (
                <button key={l} className={`choice card-choice ${level === l ? 'on' : ''}`} onClick={() => setLevel(l)}>
                  <span className="lvl-badge">{l}</span>
                  <span>
                    <strong>{t(l === 'A1' ? 'ob.level.a1' : 'ob.level.a2')}</strong>
                    <small>{t(l === 'A1' ? 'ob.level.a1.sub' : 'ob.level.a2.sub')}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="muted small note">
              <Icon name="lock" size={14} /> {t('ob.level.placement')}
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="onb-h">{t('ob.goal.title')}</h2>
            <div className="stack">
              {GOALS.map((g) => (
                <button key={g.id} className={`choice card-choice ${goal === g.id ? 'on' : ''}`} onClick={() => setGoal(g.id)}>
                  <span>
                    <strong>{g.name[lang]}</strong>
                    <small>{g.blurb[lang]}</small>
                  </span>
                </button>
              ))}
            </div>
            <h2 className="onb-h sub">{t('ob.age.title')}</h2>
            <div className="chips">
              {AGE_GROUPS.map((a) => (
                <button key={a.id} className={`chip ${age === a.id ? 'on' : ''}`} onClick={() => setAge(a.id)}>
                  {a.name[lang]} <small dir="ltr">{a.range}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="onb-h">{t('ob.topics.title')}</h2>
            <p className="muted">{t('ob.topics.sub')}</p>
            <div className="chips wrap">
              {TOPICS.filter((x) => !x.adult || age === 'adults' || age === 'seniors').map((tp) => {
                const on = topics.includes(tp.id);
                return (
                  <button key={tp.id} className={`chip ${on ? 'on' : ''}`} onClick={() => setTopics(on ? topics.filter((x) => x !== tp.id) : [...topics, tp.id])}>
                    {on && <Icon name="check" size={14} stroke={3} />} {tp.name[lang]}
                  </button>
                );
              })}
            </div>
            <p className="muted small">{t('ob.topics.count', { n: topics.length })}</p>
          </>
        )}
      </main>

      <footer className="onb-foot">
        {step > 0 ? (
          <button className="btn soft" onClick={() => setStep(step - 1)}>
            <Icon name={lang === 'ar' ? 'chevR' : 'chevL'} size={18} /> {t('common.back')}
          </button>
        ) : (
          <span />
        )}
        <button className="btn primary wide" disabled={!valid} onClick={next}>
          {step === STEPS - 1 ? t('ob.start') : t('common.next')} <Icon name={lang === 'ar' ? 'chevL' : 'chevR'} size={18} />
        </button>
      </footer>
    </div>
  );
}
