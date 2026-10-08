import { useState } from 'react';
import { availableDreams, defaultDream, remainingCost, type DreamDef, type DreamProgress } from '@lw/game';
import { useT } from '../../hooks';
import { useGameState, useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import type { StringKey } from '../../i18n';
import { Icon, type IconName } from '../Icon';
import { Ltr } from './WalletPill';

/** One icon per dream (the Icon set has no festival or fresh-start glyph, so those borrow the lantern and the key). */
const DREAM_ICON: Record<string, IconName> = { phone_pal: 'phone', bike: 'bike', flat: 'flat', festival: 'lantern', travel: 'train', fresh_start: 'key', car: 'car' };
const iconOf = (id: string): IconName => DREAM_ICON[id] ?? 'sparkle';

/** D28: the dream is hidden below its `ageMin` (compared with the age group's lowest age). */
const ageAllows = (ageFloor: number | undefined, d: DreamDef) => d.ageMin === undefined || (ageFloor ?? 0) >= d.ageMin;

/**
 * The Dream picker (§7.3): 7 cards, the one that matches the onboarding goal suggested, "Decide later" allowed. Choosing is two taps (select,
 * confirm) so a stray tap never commits. The dreams a child may not see are not drawn; the car shows as "opens when the story is finished".
 */
export function DreamPicker({ current, onChoose, onLater }: { current?: string | null; onChoose: (id: string) => void; onLater?: () => void }) {
  const { t, lang } = useT();
  const game = useGameState();
  const view = useGameView();
  const open = availableDreams(PACK, game, view);
  const floor = PACK.ageProfiles[view.profile.age]?.ageFloor;
  const shown = PACK.dreams.filter((d) => ageAllows(floor, d));
  const suggested = defaultDream(PACK, view);
  const [picked, setPicked] = useState<string | null>(current ?? suggested);

  return (
    <div className="qst-picker stack" data-picker="1">
      <div className="qst-picker-head">
        <h2>{t('dream.pick')}</h2>
        <p className="muted small">{t('dream.switchFree')}</p>
      </div>
      <ul className="qst-dreams" role="list">
        {shown.map((d) => {
          const isOpen = open.some((o) => o.id === d.id);
          const cost = remainingCost(PACK, game, d);
          const on = picked === d.id;
          return (
            <li key={d.id}>
              <button
                type="button"
                className={`qst-dream${on ? ' on' : ''}${isOpen ? '' : ' shut'}`}
                data-dream={d.id}
                aria-pressed={on}
                disabled={!isOpen}
                onClick={() => setPicked(d.id)}
              >
                <span className="qst-dream-icon" aria-hidden="true">
                  <Icon name={iconOf(d.id)} size={26} />
                </span>
                <span className="qst-dream-text">
                  <strong lang="ja">{d.name.ja}</strong>
                  <span dir="auto">{d.name[lang]}</span>
                  <small className="muted">
                    {isOpen ? (
                      <>
                        {t(`dream.horizon.${d.horizon}` as StringKey)}
                        {cost > 0 && (
                          <>
                            {' · '}
                            <Ltr text={t('dream.cost', { n: cost.toLocaleString('en-US') })} />
                          </>
                        )}
                      </>
                    ) : (
                      t('dream.freeWalk')
                    )}
                  </small>
                  {d.id === suggested && <span className="pill qst-suggested">{t('dream.suggested')}</span>}
                </span>
                {!isOpen && <Icon name="lock" size={18} />}
                {on && isOpen && <Icon name="check" size={20} />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="qst-picker-actions">
        <button className="btn primary wide" data-choose="1" disabled={!picked} onClick={() => picked && onChoose(picked)}>
          {t('dream.pickThis')}
        </button>
        {onLater && (
          <button className="btn soft" data-later="1" onClick={onLater}>
            {t('dream.later')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The Dream tab body (§7.3, §7.5): the tracked dream's step ladder, the yen bar and the language gate (both constraints always show, so
 * speaking is visibly the lever), the pace estimate, the stickers earned and a way to change the dream.
 */
export function DreamPanel({ progress, stickers, onChange }: { progress: DreamProgress; stickers: string[]; onChange: () => void }) {
  const { t, lang } = useT();
  const def = PACK.dreams.find((d) => d.id === progress.dream);
  if (!def) return null;
  const finished = progress.total > 0 && progress.doneCount >= progress.total;
  const missing = Math.max(0, progress.remainingCost - progress.cash);
  const gateShut = progress.languageGate.objectivesLeft > 0;
  const earned = PACK.dreams.filter((d) => stickers.includes(d.sticker));

  return (
    <div className="qst-dream-panel stack" data-dream-panel={def.id}>
      <section className="card qst-dream-head">
        <span className="qst-dream-icon big" aria-hidden="true">
          <Icon name={iconOf(def.id)} size={32} />
        </span>
        <div>
          <small className="label">{t('dream.title')}</small>
          <h2 lang="ja" className="qst-dream-ja">
            {def.name.ja}
          </h2>
          <p dir="auto">{def.name[lang]}</p>
        </div>
      </section>

      {finished ? (
        <section className="card qst-finale" data-finale="1">
          <Icon name="trophy" size={28} />
          <strong>{t('dream.done')}</strong>
          <span className="muted">{t('dream.finale')}</span>
        </section>
      ) : (
        <section className="card qst-cons">
          <div className="qst-con" data-con="yen">
            <Icon name="coin" size={16} />
            <span className="qst-con-label">{t('dream.yenLabel')}</span>
            <span className="qst-bar" aria-hidden="true">
              <i style={{ width: `${Math.round(progress.yenBar * 100)}%` }} />
            </span>
            <span className="qst-con-text">
              <Ltr text={progress.remainingCost <= 0 ? t('dream.nothingToBuy') : missing > 0 ? t('hud.moreYen', { n: missing.toLocaleString('en-US') }) : t('hud.enoughYen')} />
            </span>
          </div>
          <div className="qst-con" data-con="language">
            <Icon name={gateShut ? 'lock' : 'check'} size={16} />
            <span className="qst-con-label">{t('dream.langLabel')}</span>
            <span className="qst-con-text">
              <Ltr
                text={
                  gateShut
                    ? `${t('dream.locked', { n: progress.languageGate.chapter })} · ${t('hud.goalsFirst', { n: progress.languageGate.objectivesLeft })}`
                    : t('hud.unlocked')
                }
              />
            </span>
          </div>
          {progress.etaDays !== null && missing > 0 && (
            <p className="muted small">
              <Ltr text={progress.etaDays === 'many' ? t('hud.paceMany') : t('hud.pace', { n: progress.etaDays })} />
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="h2">
          {t('dream.step')} <small className="muted"><Ltr text={t('hud.steps', { n: progress.doneCount, total: progress.total })} /></small>
        </h3>
        <ul className="qst-list">
          {def.steps.map((s) => {
            const st = progress.steps.find((x) => x.id === s.id);
            const done = !!st?.done;
            const visible = !!st?.visible;
            return (
              <li key={s.id} className={`qst-obj${done ? ' done' : ''}${visible ? '' : ' shut'}`} data-step={s.id} data-done={done ? '1' : '0'}>
                <span className="qst-tick" aria-hidden="true">
                  {done ? <Icon name="check" size={16} /> : !visible ? <Icon name="lock" size={12} /> : null}
                </span>
                <div className="qst-obj-body">
                  <strong dir="auto">{s.text[lang]}</strong>
                  {!visible && (
                    <small className="muted">
                      <Ltr text={s.gate > 8 ? t('dream.freeWalk') : t('dream.locked', { n: s.gate })} />
                    </small>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {earned.length > 0 && (
        <section className="card" data-stickers={earned.length}>
          <h3 className="h2">{t('dream.stickers')}</h3>
          <div className="chips">
            {earned.map((d) => (
              <span key={d.sticker} className="chip on qst-sticker" title={t('dream.sticker')}>
                <Icon name={iconOf(d.id)} size={16} />
                <span dir="auto">{d.name[lang]}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <button className="btn soft" data-change-dream="1" onClick={onChange}>
        {t('dream.change')}
      </button>
    </div>
  );
}
