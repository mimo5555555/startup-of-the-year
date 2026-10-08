import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import { useT } from '../../hooks';
import { CoinTray } from './CoinTray';
import { yen, type PanelPay as Pay, type PayBlock } from './panelLogic';

export interface PanelPayProps {
  /** what the chosen thing costs; 0 while nothing is chosen */
  total: number;
  /** something is chosen (a drink, a bowl, a stop) */
  ready: boolean;
  cash: number;
  ic: number;
  /** the card is in the wallet, so the IC option shows */
  hasIc: boolean;
  pay: Pay;
  onPay(p: Pay): void;
  inserted: number;
  onInsert(value: number): void;
  onReturn(): void;
  onExact(): void;
  /** why paying is not possible right now (null when it is) */
  block: PayBlock | null;
  /** the other pocket would cover it: the gentle suggestion offered when this one is short */
  other: Pay | null;
  busy?: boolean;
  /** the label of the main button ("Buy", "Get my ticket") */
  buyLabel: string;
  onBuy(): void;
}

/**
 * How a machine is paid (docs/GAME_DESIGN.md §6.5): coins from the wallet through the coin tray, or the IC card with one tap. The
 * short-of-cash state is a plain sentence with a way forward (the other pocket, the IC top-up, earning more), never an error; the
 * panel's Close button is always there, so nobody is stuck at a machine.
 */
export function PanelPay(p: PanelPayProps) {
  const { t } = useT();
  const short = p.block === 'funds';
  const enough = p.pay === 'coins' ? p.inserted >= p.total : p.ic >= p.total;
  const canBuy = p.ready && !p.busy && p.block === null && enough;
  // a choice made higher up the sheet brings the way to pay into view (the sheet scrolls on a small phone)
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [p.total, p.pay]);
  return (
    <section className="pn-pay" aria-label={p.buyLabel} ref={ref}>
      {p.hasIc && (
        <div className="pn-seg" role="radiogroup">
          <button type="button" role="radio" aria-checked={p.pay === 'coins'} className={p.pay === 'coins' ? 'on' : ''} onClick={() => p.onPay('coins')}>
            <Icon name="coin" size={18} /> {t('panel.pay.coins')}
            <small className="pn-num" dir="ltr">
              {yen(p.cash)}
            </small>
          </button>
          <button type="button" role="radio" aria-checked={p.pay === 'ic'} className={p.pay === 'ic' ? 'on' : ''} onClick={() => p.onPay('ic')}>
            <Icon name="card" size={18} /> {t('hud.ic')}
            <small className="pn-num" dir="ltr">
              {yen(p.ic)}
            </small>
          </button>
        </div>
      )}

      {p.block === 'closed' && <p className="pn-note">{t('panel.closed')}</p>}

      {short && (
        <div className="pn-short" role="status">
          <strong>{t('shop.notEnough')}</strong>
          {p.other ? (
            <button type="button" className="btn soft sm" onClick={() => p.onPay(p.other!)}>
              {p.other === 'ic' ? t('panel.hint.useIc') : t('panel.hint.useCoins')}
            </button>
          ) : (
            <span>{p.pay === 'ic' ? t('panel.hint.topUp') : t('panel.hint.earn')}</span>
          )}
        </div>
      )}

      {p.pay === 'coins' && p.block !== 'closed' && (
        <CoinTray total={p.total} cash={p.cash} inserted={p.inserted} onInsert={p.onInsert} onReturn={p.onReturn} onExact={p.onExact} disabled={!p.ready || short || p.busy} />
      )}
      {p.pay === 'ic' && p.block !== 'closed' && (
        <div className="pn-ic">
          <Icon name="card" size={28} />
          <div>
            <span className="pn-tray-label">{t('panel.icLeft')}</span>
            <strong className="pn-num" dir="ltr">
              {yen(p.ic)}
            </strong>
          </div>
        </div>
      )}

      <button type="button" className="btn primary pn-buy" disabled={!canBuy} onClick={p.onBuy}>
        <Icon name={p.pay === 'ic' ? 'card' : 'coin'} size={20} /> {p.pay === 'ic' ? t('panel.pay.tapIc') : p.buyLabel}
      </button>
    </section>
  );
}
