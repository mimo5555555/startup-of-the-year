import { Fragment, useEffect, useRef, useState } from 'react';
import { yenFormat } from '@lw/game';
import { useT } from '../../hooks';
import { useDerivedFlags, useWallet } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { useStore } from '../../store';
import { Icon } from '../Icon';

/** Numbers and amounts stay left-to-right Latin digits inside Arabic text (§4.1): wraps each in a `dir="ltr"` span. */
export function Ltr({ text }: { text: string }) {
  return (
    <>
      {text.split(/(¥?\d(?:[\d,.]*\d)?)/g).map((part, i) =>
        i % 2 ? (
          <bdi key={i} dir="ltr">
            {part}
          </bdi>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export const yen = (n: number): string => yenFormat(n, PACK.currency);

/** How long the "+¥160" flash stays beside the pill. */
const FLASH_MS = 2200;

/** The wallet pill (§7.5): cash, and the IC balance once the card is owned. A change flashes beside it; tapping opens the Wallet screen. */
export function WalletPill() {
  const { t } = useT();
  const wallet = useWallet();
  const flags = useDerivedFlags();
  const go = useStore((s) => s.go);
  const last = useRef(wallet.cash);
  const [flash, setFlash] = useState<{ n: number; k: number } | null>(null);

  useEffect(() => {
    const diff = wallet.cash - last.current;
    last.current = wallet.cash;
    if (diff === 0) return;
    setFlash((f) => ({ n: diff, k: (f?.k ?? 0) + 1 }));
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [wallet.cash]);

  return (
    <div className="hud-wallet-wrap">
      <button className="chip glass hud-wallet" onClick={() => go('wallet')} aria-label={`${t('hud.wallet')}: ${yen(wallet.cash)}`}>
        <Icon name="coin" size={18} />
        <bdi dir="ltr" className="hud-amount">
          {yen(wallet.cash)}
        </bdi>
        {flags.hasIc && (
          <span className="hud-ic" title={t('hud.ic')}>
            <Icon name="card" size={15} />
            <bdi dir="ltr">{yen(wallet.ic)}</bdi>
          </span>
        )}
      </button>
      {flash && (
        <span key={flash.k} className={`hud-flash ${flash.n > 0 ? 'up' : 'down'}`} aria-hidden="true">
          <bdi dir="ltr">{flash.n > 0 ? '+' : '-'}{yen(Math.abs(flash.n))}</bdi>
        </span>
      )}
    </div>
  );
}
