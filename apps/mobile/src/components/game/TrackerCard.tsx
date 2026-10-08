import type { NextGoal } from '@lw/game';
import { useT } from '../../hooks';
import { useChapter, useDream } from '../../game/hooks';
import { characterById, displayName } from '../../content';
import { Icon } from '../Icon';
import { Portrait } from '../Portrait';
import { Ltr } from './WalletPill';

/**
 * The tracker card (§7.5, §11.7): same look as the old "Next up" card (portrait, title, walk button), showing the next best goal. The
 * target stays on the goal chosen until it is done or the day changes (`useTracker` locks it). A purchase goal shows both constraints:
 * the yen still missing and the language gate (the chapter that opens it, with a padlock while it is shut).
 */
export function TrackerCard({ goal, onGo }: { goal: NextGoal; onGo: () => void }) {
  const { t, lang } = useT();
  const dream = useDream();
  const { def: chapter } = useChapter();
  const who = goal.pin?.friend ? characterById(goal.pin.friend) : undefined;
  const showDream = goal.kind === 'dream' && !!dream;
  const missing = dream ? Math.max(0, dream.remainingCost - dream.cash) : 0;
  const gateCh = dream?.languageGate.chapter ?? 0;
  const locked = !!dream && gateCh > (chapter?.n ?? 9);

  return (
    <button className="next-up glass-card hud-track" onClick={onGo} data-goal={goal.kind}>
      {who ? (
        <Portrait spec={who.avatar} size={40} />
      ) : (
        <span className="hud-track-icon" aria-hidden="true">
          <Icon name="target" size={22} />
        </span>
      )}
      <span className="next-text">
        <small>{t('hud.nextUp')}</small>
        <strong dir="auto">{goal.text[lang]}</strong>
        {who && goal.kind !== 'objective' && <em dir="auto">{displayName(who, lang)}</em>}
        {showDream && dream && (
          <span className="hud-cons">
            <span className="hud-con" data-con="yen">
              <Icon name="coin" size={14} />
              <span>
                <Ltr text={missing > 0 ? t('hud.moreYen', { n: missing.toLocaleString('en-US') }) : t('hud.enoughYen')} />
              </span>
              <span className="hud-bar" aria-hidden="true">
                <i style={{ width: `${Math.round(dream.yenBar * 100)}%` }} />
              </span>
            </span>
            <span className="hud-con" data-con="language">
              <Icon name={locked ? 'lock' : 'check'} size={14} />
              <span>
                <Ltr
                  text={
                    locked
                      ? `${t('dream.locked', { n: gateCh })}${dream.languageGate.objectivesLeft > 0 ? ` · ${t('hud.goalsFirst', { n: dream.languageGate.objectivesLeft })}` : ''}`
                      : t('hud.unlocked')
                  }
                />
              </span>
            </span>
            {dream.etaDays !== null && (
              <span className="hud-con pace">
                <Ltr text={dream.etaDays === 'many' ? t('hud.paceMany') : t('hud.pace', { n: dream.etaDays })} />
              </span>
            )}
          </span>
        )}
      </span>
      <span className="next-go">
        <Icon name="walk" size={18} />
      </span>
    </button>
  );
}
