import { BALANCE } from '@lw/game';
import { useT } from '../../hooks';
import { Icon } from '../Icon';

const PCT = (x: number) => Math.round(x * 100);

/**
 * The stars of one conversation (§3.4) with what each one needed. `fresh` are the stars this conversation earned for the first
 * time (they pulse); stars already earned before stay lit.
 */
export function StarsRow({ stars, fresh = 0 }: { stars: 0 | 1 | 2 | 3; fresh?: number }) {
  const { t } = useT();
  const need = [t('debrief.star1'), t('debrief.star2', { pct: PCT(BALANCE.starRule.r2) }), t('debrief.star3', { pct: PCT(BALANCE.starRule.r3) })];
  return (
    <ol className="dbf-stars" aria-label={t('debrief.stars')}>
      {need.map((text, i) => {
        const on = i < stars;
        return (
          <li key={i} className={`${on ? 'on' : ''} ${on && i >= stars - fresh ? 'fresh' : ''}`}>
            <Icon name={on ? 'starFilled' : 'star'} size={30} />
            <small dir="auto">{text}</small>
          </li>
        );
      })}
    </ol>
  );
}
