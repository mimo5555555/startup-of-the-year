// The shrine's catalog (docs/GOEN.md "Stage-1 catalog"): one card per thing Goen buys, with a small picture, its name in Japanese and the
// player's language, the price, exactly what it gives (no paid randomness) and its state: yours, make a wish, how much more Goen is needed and
// how to earn it, the most charms you can hold, or a season that is not on. Every card that cannot be bought says why: no dead button.
import { goenCatalog, type GoenCatalogRow, type GoenItemDef } from '@lw/game';
import { useT } from '../../hooks';
import { useGameState, useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { goenIcon } from '../../game/goenLogic';
import { Icon } from '../Icon';
import { Ltr } from './WalletPill';

export type GoenCardState = 'owned' | 'wish' | 'short' | 'full' | 'closed';

export interface GoenCardRow {
  item: GoenItemDef;
  state: GoenCardState;
  /** short: the Goen still missing; full / a charm: how many are held */
  n: number;
}

/** The catalog rows as the cards show them (pure over the selector's rows). */
export function goenCards(rows: readonly GoenCatalogRow[]): GoenCardRow[] {
  return rows.map((r) => {
    if (r.owned) return { item: r.item, state: 'owned', n: 0 };
    if (r.canBuy) return { item: r.item, state: 'wish', n: r.held };
    if (r.reason === 'max') return { item: r.item, state: 'full', n: r.held };
    if (r.reason === 'funds') return { item: r.item, state: 'short', n: r.short };
    return { item: r.item, state: 'closed', n: 0 };
  });
}

export const CHARMS_MAX = 2;

export function GoenCatalog({ onWish }: { onWish: (itemId: string) => void }) {
  const { t, lang } = useT();
  const state = useGameState();
  const view = useGameView();
  const cards = goenCards(goenCatalog(PACK, state, view, Date.now()));
  return (
    <ul className="gn-cards" data-goen-catalog>
      {cards.map(({ item, state: st, n }) => (
        <li key={item.id} className={`gn-card card ${st}`} data-goen-item={item.id} data-state={st}>
          <span className={`gn-pic gn-pic-${item.id}`} aria-hidden="true">
            <Icon name={goenIcon(item.kind, item.id)} size={26} />
          </span>
          <div className="gn-card-body">
            <small className="gn-kind">{t(`gn.kind.${item.kind}` as const)}</small>
            <strong dir="auto">{item.name[lang]}</strong>
            <span className="gn-ja" lang="ja" dir="ltr">
              {item.name.reading && item.name.reading !== item.name.ja ? `${item.name.ja} · ${item.name.reading}` : item.name.ja}
            </span>
            <p className="gn-gives" dir="auto">
              {item.gives[lang]}
            </p>
            {item.kind === 'charm' && st !== 'full' && n > 0 && (
              <small className="gn-held" dir="auto">
                <Ltr text={t('gn.item.held', { n, max: CHARMS_MAX })} />
              </small>
            )}
          </div>
          <div className="gn-card-foot">
            <span className="gn-price" dir="ltr">
              <Icon name="torii" size={14} /> {item.price}
            </span>
            {st === 'owned' && (
              <span className="gn-owned">
                <Icon name="check" size={16} /> {t('gn.item.owned')}
              </span>
            )}
            {st === 'wish' && (
              <button type="button" className="btn primary gn-wish-btn" data-wish={item.id} onClick={() => onWish(item.id)}>
                {t('gn.item.wish')}
              </button>
            )}
          </div>
          {st === 'short' && (
            <p className="gn-why" dir="auto" data-why="funds">
              <strong>
                <Ltr text={t('gn.item.short', { n })} />
              </strong>{' '}
              {t('gn.shrine.how')}
            </p>
          )}
          {st === 'full' && (
            <p className="gn-why" dir="auto" data-why="max">
              <Ltr text={t('gn.item.full', { n })} />
            </p>
          )}
          {st === 'closed' && (
            <p className="gn-why" dir="auto" data-why="closed">
              {t('gn.item.closed')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
