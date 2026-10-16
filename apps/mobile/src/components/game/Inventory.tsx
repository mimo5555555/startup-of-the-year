import { useEffect, useMemo, useState } from 'react';
import { CLOTHES_COLOURS, DENIM_COLOURS } from '@lw/content';
import { formatHours, ownedQty, priceDisplay, type GamePack, type GameState, type ItemDef, type NameGloss } from '@lw/game';
import { useT } from '../../hooks';
import type { StringKey } from '../../i18n';
import { dispatch } from '../../game/bridge';
import { WARDROBE_SLOTS, isWorn, pickedColours, pieceColour, pieceColours, toggledOutfit, wardrobeSlot, wearables } from '../../game/avatarFx';
import { useGameState } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { speakJa } from '../../services';
import { useStore } from '../../store';
import { beginOwn } from '../../game/ownStore';
import { comfortInfo, ownRoomOf, pieceRows, transitLine } from '../../game/ownLogic';
import { Icon, type IconName } from '../Icon';
import { Ltr } from './WalletPill';

// "What you own" (docs/GAME_DESIGN.md §7.5): a grid of the things the player has bought, a card for each, and the wardrobe for the pieces
// that can be worn (the helmet and Fuku-Fuku's clothes, grouped by what they cover, with a colour pick for the pieces that come in several;
// the section is absent while nothing wearable is owned). Everything shown is owned,
// so there is no locked or empty tile and no dead button.

/** One line of "what it does": a string key and its variables. */
export interface FxLine {
  key: StringKey;
  vars?: Record<string, string | number>;
}

/** One tile of the grid: an owned catalog item or a giftable present bought in a conversation. */
export interface OwnedRow {
  id: string;
  name: NameGloss;
  qty: number;
  icon: IconName;
  /** what the player paid or would pay in a shop */
  price: number;
  wearable: boolean;
  fx: FxLine[];
}

/** The icon of a thing, from its tags and category. */
export function iconFor(item: Pick<ItemDef, 'tags' | 'cat' | 'fx'>): IconName {
  if (item.tags.includes('phone')) return 'phone';
  if (item.tags.includes('car')) return 'car';
  if (item.tags.includes('bicycle')) return 'bike';
  if (item.fx.some((f) => f.t === 'avatar')) return 'shirt';
  if (item.fx.some((f) => f.t === 'card')) return 'card';
  if (item.cat === 'gift') return 'gift';
  return 'bag';
}

/** The perks a pack can give an item that are explained to the player here (traits this release has no text for are left out, not guessed). */
const TRAIT_FX: Partial<Record<string, StringKey>> = { points_rate: 'wallet.fx.points', tv_snippet: 'wallet.fx.listen' };

/** What an item does, as lines for the card; `wallet.fx.none` when it only exists to be owned or given. */
export function fxLines(item: ItemDef): FxLine[] {
  const out: FxLine[] = [];
  for (const fx of item.fx) {
    if (fx.t === 'feature') out.push({ key: fx.id === 'phone' ? 'wallet.fx.phone' : 'wallet.fx.ic' });
    else if (fx.t === 'ride') out.push({ key: 'wallet.fx.ride', vars: { n: fx.mul } });
    else if (fx.t === 'avatar') out.push({ key: 'wallet.fx.wear' });
    else if (fx.t === 'gift') out.push({ key: 'wallet.fx.gift' });
    else if (fx.t === 'trait' && TRAIT_FX[fx.id]) out.push({ key: TRAIT_FX[fx.id]! });
  }
  if (item.cat === 'gift' && !out.some((l) => l.key === 'wallet.fx.gift')) out.push({ key: 'wallet.fx.gift' });
  return out.length > 0 ? out : [{ key: 'wallet.fx.none' }];
}

/** Everything the player owns, in pack order: catalog items first, then giftable menu stock (presents from the konbini and the café). */
export function ownedRows(pack: GamePack, state: GameState): OwnedRow[] {
  const rows: OwnedRow[] = [];
  for (const i of pack.items) {
    const qty = ownedQty(state, i.id);
    if (qty > 0) rows.push({ id: i.id, name: i.name, qty, icon: iconFor(i), price: i.price, wearable: i.fx.some((f) => f.t === 'avatar'), fx: fxLines(i) });
  }
  for (const m of pack.menu) {
    const qty = ownedQty(state, m.id);
    if (qty > 0) rows.push({ id: m.id, name: m.name, qty, icon: 'gift', price: m.price, wearable: false, fx: [{ key: 'wallet.fx.gift' }] });
  }
  return rows;
}

/** Puts a worn piece on or takes it off through the game (`outfit_changed`); the world follows on the next sync. */
export function wearToggle(state: GameState, itemId: string): void {
  dispatch({ t: 'outfit_changed', equipped: toggledOutfit(state, itemId, PACK), colours: state.outfit.colours });
}

/** Picks the colour of an owned piece; the piece keeps it (worn or not) and the avatar follows when it is on. */
export function colourPick(state: GameState, itemId: string, colour: string): void {
  dispatch({ t: 'outfit_changed', equipped: state.outfit.equipped, colours: pickedColours(state, itemId, colour) });
}

/** The Wardrobe label of a colour: the six clothes colours and the denim washes (a hex outside both has no name and no swatch). */
export function colourName(hex: string): string | null {
  const find = (table: Readonly<Record<string, string>>) => Object.entries(table).find(([, h]) => h.toLowerCase() === hex.toLowerCase())?.[0];
  return find(CLOTHES_COLOURS) ?? find(DENIM_COLOURS) ?? null;
}

/** The colours of one piece as a radio group of swatches (44 px targets); nothing for a piece with one look. */
export function Swatches({ state, item }: { state: GameState; item: ItemDef }) {
  const { t, lang } = useT();
  const choices = pieceColours(item).filter((h) => colourName(h) !== null);
  if (choices.length < 2) return null;
  const now = pieceColour(state, item);
  return (
    <div className="wlt-swatches" role="radiogroup" aria-label={t('wallet.colourOf', { name: item.name[lang] })} data-colours={item.id}>
      {choices.map((hex) => {
        const name = t(`wallet.colour.${colourName(hex)}` as StringKey);
        const on = now?.toLowerCase() === hex.toLowerCase();
        return (
          <button key={hex} type="button" role="radio" aria-checked={on} aria-label={name} title={name} className={`wlt-swatch${on ? ' on' : ''}`} data-colour={hex} onClick={() => colourPick(state, item.id, hex)}>
            <i style={{ background: hex }} />
          </button>
        );
      })}
    </div>
  );
}

/** The wardrobe: pieces grouped by what they cover, one switch per owned wearable and a colour pick where there is one. Not rendered while the player owns none. */
export function Wardrobe({ state }: { state: GameState }) {
  const { t, lang } = useT();
  const pieces = wearables(PACK, state);
  if (pieces.length === 0) return null;
  return (
    <section className="wlt-wardrobe card" data-wardrobe aria-label={t('wallet.wardrobe')}>
      <header>
        <Icon name="shirt" size={20} />
        <div>
          <strong>{t('wallet.wardrobe')}</strong>
          <small dir="auto">{t('wallet.wardrobeHint')}</small>
        </div>
      </header>
      {WARDROBE_SLOTS.map((slot) => {
        const group = pieces.filter((p) => wardrobeSlot(p) === slot);
        if (group.length === 0) return null;
        return (
          <div key={slot} className="wlt-wear-group" data-slot={slot}>
            <h3 dir="auto">{t(`wallet.slot.${slot}` as StringKey)}</h3>
            <div className="wlt-wear-list">
              {group.map((p) => {
                const on = isWorn(state, p.id);
                return (
                  <div key={p.id} className="wlt-piece">
                    <button type="button" role="switch" aria-checked={on} className={`wlt-wear${on ? ' on' : ''}`} data-wear={p.id} onClick={() => wearToggle(state, p.id)}>
                      <Icon name={iconFor(p)} size={20} />
                      <span dir="auto">{p.name[lang]}</span>
                      <em dir="auto">{on ? t('wallet.takeOff') : t('wallet.wear')}</em>
                    </button>
                    <Swatches state={state} item={p} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** The card of one thing: names with reading and a speaker, the price with the work-hours chip, what it does, and wear/take off. */
export function ItemCard({ row, state, onClose }: { row: OwnedRow; state: GameState; onClose: () => void }) {
  const { t, lang } = useT();
  const p = priceDisplay(row.price, PACK.currency, PACK.economy);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const worn = isWorn(state, row.id);
  return (
    <div className="scrim hud-scrim" onClick={onClose}>
      <div className="word-sheet hud-sheet wlt-card" role="dialog" aria-modal="true" aria-label={row.name[lang]} data-item={row.id} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn ghost word-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <header className="hud-sheet-head">
          <span className="hud-opt-ic big">
            <Icon name={row.icon} size={26} />
          </span>
          <div>
            <h2 dir="auto">{row.name[lang]}</h2>
            <p className="wlt-ja">
              <bdi lang="ja" dir="ltr">
                {row.name.reading && row.name.reading !== row.name.ja ? `${row.name.ja} · ${row.name.reading}` : row.name.ja}
              </bdi>
            </p>
          </div>
        </header>
        <button className="btn soft wlt-say" onClick={() => speakJa(row.name.reading ?? row.name.ja, { rate: 0.8 })}>
          <Icon name="volume" size={18} /> {t('panel.listen')}
        </button>
        <dl className="wlt-facts">
          <div>
            <dt>{t('wallet.price')}</dt>
            <dd>
              <bdi dir="ltr">{p.text}</bdi>
              {p.hours !== null && (
                <small className="wlt-hours">
                  <Ltr text={t('hud.workHours', { n: formatHours(p.hours) })} />
                </small>
              )}
            </dd>
          </div>
          <div>
            <dt>{t('wallet.itemFx')}</dt>
            <dd>
              <ul className="wlt-fx">
                {row.fx.map((l) => (
                  <li key={l.key} dir="auto">
                    <Ltr text={t(l.key, l.vars)} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
        {row.wearable && (
          <button className={`btn ${worn ? 'soft' : 'primary'} wide`} data-wear={row.id} onClick={() => wearToggle(state, row.id)}>
            {worn ? t('wallet.takeOff') : t('wallet.wear')}
          </button>
        )}
        <button className="btn soft wide" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

/**
 * "Your room" (Release 2 wave B2): the room the player lives in, its comfort, the furniture on its way and the way in. The way in is the same
 * room the door in the street leads to (the dorm until the flat is rented); it shows from the first day, since everyone has a room.
 */
export function RoomCard({ state }: { state: GameState }) {
  const { t, lang } = useT();
  const go = useStore((s) => s.go);
  const c = comfortInfo(PACK, state);
  const coming = pieceRows(PACK, state).filter((p) => p.state === 'transit');
  return (
    <section className="wlt-room card" data-room-card aria-label={t('ho.wallet.title')}>
      <header>
        <Icon name="home" size={20} />
        <div>
          <strong>{t(`ho.room.${ownRoomOf(state).stage}` as StringKey)}</strong>
          <small dir="auto">{t('ho.comfort', { n: c.value, max: c.max })}</small>
        </div>
      </header>
      <button
        type="button"
        className="btn soft wlt-room-go"
        data-room-go
        onClick={() => {
          go('world');
          beginOwn();
        }}
      >
        {t('ho.wallet.go')}
      </button>
      {coming.length > 0 && (
        <ul className="wlt-coming" data-deliveries aria-label={t('ho.wallet.onTheWay')}>
          {coming.map((p) => (
            <li key={p.id} data-delivery={p.id}>
              <Icon name="bag" size={16} />
              <span dir="auto">
                {p.name[lang]} · {transitLine(t, p.due!, lang)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "What you own": the wardrobe (when something wearable is owned) over the grid of tiles; a tile opens its card. */
export function Inventory() {
  const { t, lang } = useT();
  const state = useGameState();
  const rows = useMemo(() => ownedRows(PACK, state), [state]);
  const [open, setOpen] = useState<string | null>(null);
  const shown = rows.find((r) => r.id === open) ?? null;
  return (
    <div className="wlt-things" data-pane="things">
      <RoomCard state={state} />
      <Wardrobe state={state} />
      {rows.length === 0 ? (
        <p className="muted center wlt-empty" dir="auto">
          {t('wallet.emptyThings')}
        </p>
      ) : (
        <ul className="wlt-grid">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" className="wlt-tile" data-owned={r.id} onClick={() => setOpen(r.id)}>
                <span className="wlt-tile-ic">
                  <Icon name={r.icon} size={26} />
                </span>
                <span className="wlt-tile-name" dir="auto">
                  {r.name[lang]}
                </span>
                <span className="wlt-tile-ja" lang="ja" dir="ltr">
                  {r.name.ja}
                </span>
                {r.qty > 1 && (
                  <span className="wlt-qty" aria-label={`× ${r.qty}`}>
                    <Ltr text={t('wallet.qty', { n: r.qty })} />
                  </span>
                )}
                {isWorn(state, r.id) && <span className="wlt-worn">{t('wallet.worn')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown && <ItemCard row={shown} state={state} onClose={() => setOpen(null)} />}
    </div>
  );
}
