import { useT } from '../../hooks';
import { DENOMINATIONS, canInsert, yen } from './panelLogic';

export interface CoinTrayProps {
  /** what the thing costs */
  total: number;
  /** the yen in the wallet: no more than this can go in */
  cash: number;
  /** the yen already in the machine */
  inserted: number;
  onInsert(value: number): void;
  /** takes everything back out */
  onReturn(): void;
  /** puts in exactly `total` (the fewest coins), the one-tap way */
  onExact(): void;
  disabled?: boolean;
}

/** A coin or a note by its value; the 1,000 yen note is a wider, flat shape so it reads as paper. */
const kind = (value: number) => (value >= 1000 ? 'note' : value >= 500 ? 'gold' : value >= 100 ? 'silver' : value >= 50 ? 'nickel' : 'copper');

/**
 * The coin slot of a machine (docs/GAME_DESIGN.md §6.5): five buttons for the 10, 50, 100, 500 yen coins and the 1,000 yen note, what is
 * inside so far and what is still missing, and two shortcuts (put in exactly the price; take everything back). Everything is a plain
 * button, so tapping is the only skill needed; the numbers are Latin digits and stay left-to-right inside an Arabic layout.
 */
export function CoinTray({ total, cash, inserted, onInsert, onReturn, onExact, disabled }: CoinTrayProps) {
  const { t } = useT();
  const missing = Math.max(0, total - inserted);
  const exactOk = cash >= total && !disabled;
  return (
    <div className="pn-tray">
      <div className="pn-tray-slot" aria-live="polite">
        <span className="pn-tray-label">{t('panel.pay.inserted')}</span>
        <strong className="pn-num" dir="ltr">
          {yen(inserted)}
        </strong>
        <span className={`pn-tray-need${missing === 0 ? ' ok' : ''}`}>{missing === 0 ? t('panel.pay.enough') : t('panel.pay.needMore', { n: yen(missing).slice(1) })}</span>
      </div>
      <div className="pn-coins" role="group" aria-label={t('panel.pay.insert')}>
        {[...DENOMINATIONS].reverse().map((value) => (
          <button
            key={value}
            type="button"
            className={`pn-coin ${kind(value)}`}
            disabled={disabled || !canInsert(cash, inserted, value)}
            onClick={() => onInsert(value)}
            aria-label={`${value >= 1000 ? t('panel.pay.note') : t('panel.pay.coin')} ${yen(value)}`}
          >
            <span dir="ltr">{value}</span>
          </button>
        ))}
      </div>
      <div className="pn-tray-actions">
        <button type="button" className="btn soft sm" disabled={!exactOk} onClick={onExact}>
          {t('panel.pay.exact')}
        </button>
        <button type="button" className="btn soft sm" disabled={disabled || inserted === 0} onClick={onReturn}>
          {t('panel.pay.return')}
        </button>
      </div>
    </div>
  );
}
