import { useT } from '../../hooks';
import { openScreen } from '../../game/bridge';
import { useDream } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { Icon } from '../Icon';

const R = 12;
const CIRC = 2 * Math.PI * R;

/** The Dream chip (§7.5): a ring of the dream's steps and the next step's text. Shown after Chapter 1's closing beat; tapping opens the Dream tab. */
export function DreamChip() {
  const { t, lang } = useT();
  const dream = useDream();
  const def = dream ? PACK.dreams.find((d) => d.id === dream.dream) : null;
  const next = dream?.nextStep ? def?.steps.find((s) => s.id === dream.nextStep) : null;
  const finished = !!dream && dream.total > 0 && dream.doneCount >= dream.total;
  const fraction = dream && dream.total > 0 ? dream.doneCount / dream.total : 0;
  const open = () => openScreen('quests', { tab: 'dream' });

  return (
    <button
      className="chip glass hud-dream"
      onClick={open}
      aria-label={`${t('dream.title')}${dream ? `: ${t('hud.steps', { n: dream.doneCount, total: dream.total })}` : ''}`}
    >
      <svg className="hud-ring" viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
        <circle cx="15" cy="15" r={R} className="trk" />
        <circle cx="15" cy="15" r={R} className="val" strokeDasharray={`${CIRC * fraction} ${CIRC}`} transform="rotate(-90 15 15)" />
      </svg>
      <span className="hud-dream-text">
        <small dir="auto">{def ? def.name[lang] : t('dream.title')}</small>
        <strong dir="auto">{finished ? t('dream.done') : next ? next.text[lang] : t('dream.step')}</strong>
      </span>
      {finished && <Icon name="trophy" size={16} />}
    </button>
  );
}
