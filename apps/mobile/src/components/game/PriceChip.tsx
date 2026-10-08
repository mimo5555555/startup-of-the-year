import { formatHours, priceDisplay } from '@lw/game';
import { useT } from '../../hooks';
import { PACK } from '../../game/pack';

/**
 * The price a clerk just said, in digits (§4.1): the yen, "tax included" for shop prices and the work-hours chip above
 * BALANCE.workHoursChipMin. Sits under the clerk's bubble so a listener can check the number they heard. Numerals stay Latin
 * in Arabic, wrapped in dir="ltr".
 */
export function PriceChip({ amount, fare = false }: { amount: number; fare?: boolean }) {
  const { t } = useT();
  const p = priceDisplay(amount, PACK.currency, PACK.economy);
  return (
    <span className="dbf-price" data-price={amount}>
      <b dir="ltr">{p.text}</b>
      {!fare && <small>{t('shop.taxIncluded')}</small>}
      {p.hours !== null && (
        <small className="dbf-hours" dir="auto">
          {t('hud.workHours', { n: formatHours(p.hours) })}
        </small>
      )}
    </span>
  );
}
