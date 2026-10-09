import { BALANCE } from '@lw/game';
import { useT } from '../../hooks';
import { Icon } from '../Icon';
import { Ltr } from './WalletPill';

/** The hearts a friend can have (BALANCE.ap.thresholds has five). */
const SLOTS = BALANCE.ap.thresholds.map((_, i) => i + 1);

/**
 * Five hearts, filled for the hearts the friend has, and (unless `compact`) a meter to the next heart with the affinity as a number
 * (§8.3). The numbers are Latin digits in a left-to-right span in every language; the meter fills from the reading start edge.
 */
export function HeartBar({ hearts, ap, floor, next, compact = false }: { hearts: number; ap: number; floor: number; next: number | null; compact?: boolean }) {
  const { t } = useT();
  const pct = next === null ? 100 : Math.max(0, Math.min(100, Math.round(((ap - floor) / Math.max(1, next - floor)) * 100)));
  return (
    <div className={`frd-hb${compact ? ' compact' : ''}`} data-hearts={hearts}>
      <span className="frd-hearts" role="img" aria-label={t('social.heartsOf', { n: hearts })}>
        {SLOTS.map((n) => (
          <Icon key={n} name={n <= hearts ? 'heartFilled' : 'heart'} size={compact ? 16 : 22} className={n <= hearts ? 'on' : ''} />
        ))}
      </span>
      {!compact && (
        <>
          <span className="frd-meter" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </span>
          <small className="muted">
            <Ltr text={next === null ? t('social.apMax', { n: ap }) : t('social.ap', { n: ap, max: next })} />
          </small>
        </>
      )}
    </div>
  );
}
