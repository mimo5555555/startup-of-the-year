import { useState } from 'react';
import { yenFormat, type Quote } from '@lw/game';
import { useT } from '../../hooks';
import { PACK } from '../../game/pack';
import { Icon } from '../Icon';

export interface ReceiptSheetProps {
  /** the quote the purchase was committed from (lines, subtotal, tax, total) plus what was handed over when paid in cash */
  receipt: Quote & { paid?: number; change?: number };
  /** the parent unmounts the sheet; without it the sheet only hides itself */
  onClose?: () => void;
}

const yen = (n: number) => yenFormat(n, PACK.currency);

/** The paper receipt of a purchase (§6.2): the rows, 小計 / 消費税 / 合計 and, for cash, お預かり / お釣り. */
export function ReceiptSheet({ receipt, onClose }: ReceiptSheetProps) {
  const { t, lang, dir } = useT();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const shop = PACK.shops.find((s) => s.id === receipt.shopId);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <div className="scrim dbf-scrim" onClick={close}>
      <div className="dbf-receipt" role="dialog" aria-modal="true" aria-label={t('debrief.receipt')} dir={dir} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn ghost dbf-receipt-x" onClick={close} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <header>
          <Icon name="receipt" size={22} />
          <strong dir="auto">{shop ? shop.name[lang] : t('debrief.receipt')}</strong>
        </header>
        <ul className="dbf-rows">
          {receipt.lines.map((l, i) => (
            <li key={i}>
              <span dir="auto">
                {l.label[lang]}
                {l.qty && l.qty > 1 && l.unit !== undefined && (
                  <small dir="ltr">
                    {l.qty} × {yen(l.unit)}
                  </small>
                )}
              </span>
              <b dir="ltr" className={l.amount < 0 ? 'dbf-neg' : ''}>
                {yen(l.amount)}
              </b>
            </li>
          ))}
        </ul>
        <dl className="dbf-sums">
          <div>
            <dt>{t('receipt.subtotal')}</dt>
            <dd dir="ltr">{yen(receipt.subtotal)}</dd>
          </div>
          <div>
            <dt>{t('receipt.tax')}</dt>
            <dd dir="ltr">{yen(receipt.tax)}</dd>
          </div>
          <div className="total">
            <dt>{t('receipt.total')}</dt>
            <dd dir="ltr">{yen(receipt.total)}</dd>
          </div>
          {receipt.paid !== undefined && (
            <>
              <div>
                <dt>{t('receipt.paid')}</dt>
                <dd dir="ltr">{yen(receipt.paid)}</dd>
              </div>
              <div>
                <dt>{t('receipt.change')}</dt>
                <dd dir="ltr">{yen(receipt.change ?? 0)}</dd>
              </div>
            </>
          )}
        </dl>
        <p className="dbf-thanks" lang="ja">
          {t('debrief.receiptThanks')}
        </p>
      </div>
    </div>
  );
}
