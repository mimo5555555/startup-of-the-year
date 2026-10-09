import { useMemo, useState } from 'react';
import { formatHours, priceDisplay, type GamePack, type GameState, type Gloss, type LedgerEntry, type LedgerKind, type NameGloss, type Pocket } from '@lw/game';
import { useT } from '../../hooks';
import type { StringKey, UiLang } from '../../i18n';
import { useGameState } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { Icon, type IconName } from '../Icon';
import { Ltr, yen } from './WalletPill';

// "Receipts" (docs/GAME_DESIGN.md §7.5): the recent ledger of the wallet as paper slips, newest first, grouped by day. Every purchase can be
// opened to its slip (shop, total, how it was paid) and shows the work-hours chip above BALANCE.workHoursChipMin. The ledger is a ring of
// the last BALANCE.ledger.entries entries, so "older" is as far as the game remembers.

/** Rows shown before "Show older receipts". */
export const RECEIPTS_SHOWN = 12;

export type ReceiptKind = LedgerKind | 'fee';

export interface ReceiptRow {
  id: string;
  at: number;
  /** position in the ledger, to keep the order of entries of the same instant */
  order: number;
  kind: ReceiptKind;
  /** signed yen of the pocket */
  delta: number;
  pocket: Pocket;
  /** the thing bought, for a purchase */
  name: NameGloss | null;
  /** the shop of a purchase */
  shopName: Gloss | null;
  /** the work-hours of a purchase above the chip threshold */
  hours: number | null;
}

/** Whether a ledger entry is its own receipt: points are shown on the balance, and a transfer is listed once (the card side of a top-up, the cash side of a refund). */
function listed(e: LedgerEntry): boolean {
  if (e.pocket === 'points') return false;
  if (e.kind === 'topup') return e.pocket === 'ic';
  if (e.kind === 'refund') return e.pocket === 'cash';
  return e.delta !== 0;
}

/** The receipts of a game state, newest first. Pure. */
export function receiptRows(pack: GamePack, state: GameState): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  state.ledger.forEach((e, order) => {
    if (!listed(e)) return;
    const item = e.kind === 'purchase' && e.ref ? (pack.items.find((i) => i.id === e.ref) ?? pack.menu.find((m) => m.id === e.ref)) : undefined;
    const shop = item ? pack.shops.find((s) => s.id === item.shop) : undefined;
    const chip = e.kind === 'purchase' && e.delta < 0 ? priceDisplay(-e.delta, pack.currency, pack.economy).hours : null;
    rows.push({
      id: e.id,
      at: e.at,
      order,
      kind: e.kind === 'fare' && e.note ? 'fee' : e.kind,
      delta: e.delta,
      pocket: e.pocket,
      name: item?.name ?? null,
      shopName: shop?.name ?? null,
      hours: chip,
    });
  });
  return rows.sort((a, b) => b.at - a.at || b.order - a.order);
}

const KIND_ICON: Record<ReceiptKind, IconName> = {
  loop: 'message',
  shift: 'briefcase',
  goal: 'target',
  streak: 'flame',
  chapter: 'trophy',
  star: 'star',
  phrase: 'sparkle',
  echo: 'replay',
  purchase: 'receipt',
  fare: 'train',
  fee: 'card',
  topup: 'card',
  refund: 'card',
  gift: 'gift',
  perk: 'heart',
};

/** The icon of a receipt row. */
export const receiptIcon = (r: Pick<ReceiptRow, 'kind'>): IconName => KIND_ICON[r.kind];

export type DayLabel = { t: 'today' } | { t: 'yesterday' } | { t: 'date'; text: string };

const startOfDay = (ms: number): number => new Date(ms).setHours(0, 0, 0, 0);

/** "Today", "Yesterday" or the date, with Latin digits in both languages (§4.1). */
export function dayLabel(at: number, now: number, lang: UiLang): DayLabel {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days <= 0) return { t: 'today' };
  if (days === 1) return { t: 'yesterday' };
  return { t: 'date', text: new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { month: 'short', day: 'numeric' }).format(at) };
}

const PAID: Record<Pocket, StringKey> = { cash: 'wallet.paidCash', ic: 'wallet.paidIc', points: 'wallet.paidPoints' };

function Row({ r, open, onToggle }: { r: ReceiptRow; open: boolean; onToggle: () => void }) {
  const { t, lang } = useT();
  const label = r.name ? r.name[lang] : t(`wallet.kind.${r.kind}` as StringKey);
  const body = (
    <>
      <span className="wlt-row-ic">
        <Icon name={receiptIcon(r)} size={18} />
      </span>
      <span className="wlt-row-main">
        <span className="wlt-row-name" dir="auto">
          {label}
        </span>
        {r.hours !== null && (
          <small className="wlt-hours" dir="auto">
            <Ltr text={t('hud.workHours', { n: formatHours(r.hours) })} />
          </small>
        )}
        {r.pocket === 'ic' && r.kind !== 'topup' && (
          <small className="wlt-row-pocket">
            <Icon name="card" size={12} /> {t('hud.ic')}
          </small>
        )}
      </span>
      <b className={`wlt-amount ${r.delta > 0 ? 'up' : 'down'}`} dir="ltr">
        {r.delta > 0 ? '+' : '-'}
        {yen(Math.abs(r.delta))}
      </b>
    </>
  );
  if (r.kind !== 'purchase') return <div className="wlt-row">{body}</div>;
  return (
    <>
      <button type="button" className="wlt-row wlt-row-btn" aria-expanded={open} data-receipt={r.id} onClick={onToggle}>
        {body}
      </button>
      {open && (
        <div className="wlt-slip" data-slip>
          <strong dir="auto">{r.shopName ? r.shopName[lang] : t('wallet.slip')}</strong>
          <dl>
            <div>
              <dt dir="auto">{label}</dt>
              <dd dir="ltr">{yen(Math.abs(r.delta))}</dd>
            </div>
            <div className="total">
              <dt>{t('receipt.total')}</dt>
              <dd dir="ltr">{yen(Math.abs(r.delta))}</dd>
            </div>
          </dl>
          <small dir="auto">{t(PAID[r.pocket])}</small>
        </div>
      )}
    </>
  );
}

/** The recent receipts list. */
export function Receipts({ now = Date.now() }: { now?: number }) {
  const { t, lang } = useT();
  const state = useGameState();
  const rows = useMemo(() => receiptRows(PACK, state), [state]);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0)
    return (
      <p className="muted center wlt-empty" data-pane="receipts" dir="auto">
        {t('wallet.emptyReceipts')}
      </p>
    );
  const shown = all ? rows : rows.slice(0, RECEIPTS_SHOWN);
  let last = '';
  return (
    <div className="wlt-receipts" data-pane="receipts">
      <ul className="wlt-list card">
        {shown.map((r) => {
          const day = dayLabel(r.at, now, lang);
          const dayKey = day.t === 'date' ? day.text : day.t;
          const head = dayKey !== last;
          last = dayKey;
          return (
            <li key={r.id}>
              {head && (
                <h3 className="wlt-day" dir="auto">
                  {day.t === 'today' ? t('wallet.today') : day.t === 'yesterday' ? t('wallet.yesterday') : <bdi dir="ltr">{day.text}</bdi>}
                </h3>
              )}
              <Row r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
            </li>
          );
        })}
      </ul>
      {!all && rows.length > RECEIPTS_SHOWN && (
        <button className="btn soft wide" onClick={() => setAll(true)}>
          {t('wallet.more')}
        </button>
      )}
    </div>
  );
}
