// The Goen balance (docs/GOEN.md), in the Wallet and on the Shrine panel: never on the street HUD (its budget is four elements). The Wallet
// version also says what was earned last and why. Numbers stay Latin and left-to-right in Arabic.
import { useT } from '../../hooks';
import { dispatch } from '../../game/bridge';
import { useGameState } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { RIDE_PAINT, goenReason, ridePaintColours, ridePaintOn } from '../../game/goenLogic';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { CHARMS_MAX } from './GoenCatalog';
import { Ltr } from './WalletPill';

export interface GoenPillProps {
  /** show the last earning under the balance (the Wallet) */
  last?: boolean;
  /** makes the pill a button (the Wallet opens the Shrine) */
  onOpen?: () => void;
}

export function GoenPill({ last = false, onOpen }: GoenPillProps) {
  const { t } = useT();
  const goen = useGameState().goen;
  const balance = goen?.balance ?? 0;
  const earn = last ? [...(goen?.ledger ?? [])].reverse().find((e) => e.delta > 0) : undefined;
  const body = (
    <>
      <span className="gn-pill-ic" aria-hidden="true">
        <Icon name="torii" size={18} />
      </span>
      <span className="gn-pill-text">
        <strong>
          <bdi dir="ltr">{balance.toLocaleString('en-US')}</bdi> <span>{t('gn.name')}</span>
        </strong>
        {earn && (
          <small dir="auto" data-goen-last>
            <Ltr text={t('gn.last', { n: earn.delta, reason: goenReason(t, earn.kind, earn.ref ?? earn.id) })} />
          </small>
        )}
      </span>
    </>
  );
  const label = t('gn.pill', { n: balance });
  return onOpen ? (
    <button type="button" className="gn-pill" data-goen-pill data-goen={balance} aria-label={label} onClick={onOpen}>
      {body}
      <Icon name="chevR" size={18} className="gn-pill-go" />
    </button>
  ) : (
    <div className="gn-pill" data-goen-pill data-goen={balance} role="status" aria-label={label}>
      {body}
    </div>
  );
}

/**
 * The Wallet's Goen card: the balance (a tap opens the Shrine) with the last earning, the streak charms held, and the sakura paint switch of
 * the bicycle when it is owned (the "ride card"). Goen is shown apart from the yen: it never adds to or comes out of the wallet.
 */
export function GoenWalletCard() {
  const { t, lang } = useT();
  const state = useGameState();
  const go = useStore((s) => s.go);
  const charms = state.goen?.charms ?? 0;
  const paint = (state.owned[RIDE_PAINT]?.qty ?? 0) > 0;
  const on = ridePaintOn(state);
  const bike = Object.entries(state.owned).some(([id, o]) => (o?.qty ?? 0) > 0 && !!PACK.items.find((i) => i.id === id)?.tags.includes('bicycle'));
  return (
    <section className="wlt-goen card" data-goen-card aria-label={t('gn.wallet.title')}>
      <header>
        <Icon name="torii" size={20} />
        <div>
          <strong>{t('gn.wallet.title')}</strong>
          <small dir="auto">{t('gn.wallet.sub')}</small>
        </div>
      </header>
      <GoenPill last onOpen={() => go('shrine')} />
      {charms > 0 && (
        <p className="wlt-charm" data-charms={charms} dir="auto">
          <Icon name="heart" size={16} /> <strong>{t('gn.charm.title')}</strong>{' '}
          <Ltr text={t('gn.charm.count', { n: charms, max: CHARMS_MAX })} />
        </p>
      )}
      {paint && (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          className={`wlt-wear wlt-paint${on ? ' on' : ''}`}
          data-ride-paint={on ? 'on' : 'off'}
          onClick={() => dispatch({ t: 'outfit_changed', equipped: state.outfit.equipped, colours: ridePaintColours(state, !on) })}
        >
          <Icon name="bike" size={20} />
          <span dir="auto">
            {PACK.items.find((i) => i.id === RIDE_PAINT)?.name[lang] ?? RIDE_PAINT}
            {!bike && <small className="muted"> · {t('gn.paint.noBike')}</small>}
          </span>
          <em dir="auto">{on ? t('gn.paint.on') : t('gn.paint.off')}</em>
        </button>
      )}
      <button type="button" className="btn soft wide" data-open="shrine" onClick={() => go('shrine')}>
        <Icon name="torii" size={18} /> {t('gn.wallet.shrine')}
      </button>
    </section>
  );
}
