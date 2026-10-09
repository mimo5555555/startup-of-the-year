import { useState } from 'react';
import { Inventory } from '../components/game/Inventory';
import { Receipts } from '../components/game/Receipts';
import { Ltr, yen } from '../components/game/WalletPill';
import { Icon } from '../components/Icon';
import { useDerivedFlags, useGameState, useWallet } from '../game/hooks';
import { useT } from '../hooks';
import { useStore } from '../store';

type Tab = 'things' | 'receipts';
const TABS: Tab[] = ['things', 'receipts'];

/**
 * The Wallet screen (§7.5): cash, the IC card and the Sakura Points once they exist, then two tabs: what you own (with the wardrobe) and the
 * recent receipts. The wallet pill in the HUD opens it. Numbers stay Latin and left-to-right in Arabic.
 */
export function Wallet() {
  const { t, dir } = useT();
  const go = useStore((s) => s.go);
  const wallet = useWallet();
  const flags = useDerivedFlags();
  const totals = useGameState().totals;
  const [tab, setTab] = useState<Tab>('things');
  return (
    <div className="panel wlt" dir={dir} data-screen="wallet" data-tab={tab}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('hud.wallet')}</h1>
        <span />
      </header>
      <div className="panel-body wlt-body">
        <section className="wlt-money card" data-wallet aria-label={t('wallet.money')}>
          <div className="wlt-pocket" data-pocket="cash">
            <Icon name="coin" size={22} />
            <span>{t('panel.cash')}</span>
            <strong dir="ltr">{yen(wallet.cash)}</strong>
          </div>
          {flags.hasIc && (
            <div className="wlt-pocket" data-pocket="ic">
              <Icon name="card" size={22} />
              <span>{t('hud.ic')}</span>
              <strong dir="ltr">{yen(wallet.ic)}</strong>
            </div>
          )}
          {wallet.points > 0 && (
            <div className="wlt-pocket" data-pocket="points">
              <Icon name="star" size={22} />
              <span>{t('hud.points')}</span>
              <strong dir="ltr">{wallet.points.toLocaleString('en-US')}</strong>
            </div>
          )}
          <small className="wlt-totals" dir="auto">
            <Ltr text={t('wallet.totals', { earned: yen(totals.earned), spent: yen(totals.spent) })} />
          </small>
        </section>
        <nav className="qst-tabs wlt-tabs" role="tablist" aria-label={t('hud.wallet')}>
          {TABS.map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} data-tab={id} onClick={() => setTab(id)}>
              {t(`wallet.tab.${id}` as const)}
            </button>
          ))}
        </nav>
        {tab === 'things' ? <Inventory /> : <Receipts />}
      </div>
    </div>
  );
}
