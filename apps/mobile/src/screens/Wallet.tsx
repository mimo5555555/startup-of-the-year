import { StubPanel } from '../components/game/StubPanel';
import { yen } from '../components/game/WalletPill';
import { useDerivedFlags, useWallet } from '../game/hooks';
import { useT } from '../hooks';

// Placeholder route (2A): the owner of this screen (3F) replaces the body, the route and the back button stay. Until then the wallet
// pill must not lead to a blank page: it shows what the pill shows, cash and the card.
export function Wallet() {
  const { t } = useT();
  const wallet = useWallet();
  const flags = useDerivedFlags();
  const row = (label: string, amount: number) => (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
      <span>{label}</span>
      <strong>
        <bdi dir="ltr">{yen(amount)}</bdi>
      </strong>
    </div>
  );
  return (
    <StubPanel title={t('hud.wallet')}>
      <div className="card" data-wallet>
        {row(t('panel.cash'), wallet.cash)}
        {flags.hasIc && row(t('panel.icLeft'), wallet.ic)}
      </div>
    </StubPanel>
  );
}
