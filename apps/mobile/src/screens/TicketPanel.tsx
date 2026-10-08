import { useMemo, useState, type ReactNode } from 'react';
import { LEXICON, tokenize } from '@lw/content';
import { Icon } from '../components/Icon';
import { FareMap, placeLabel } from '../components/game/FareMap';
import { JaLabel, PanelShell, SpeakButton, Tile, WalletStrip } from '../components/game/PanelParts';
import { PanelPay } from '../components/game/PanelPay';
import {
  balanceFor,
  changeFor,
  commitAll,
  exactCoins,
  fareStops,
  hasIc,
  icUsable,
  labelTokens,
  otherPay,
  panelSession,
  payBlock,
  ramenEvents,
  ramenMenu,
  ramenPrice,
  stationEvents,
  yen,
  type PanelPay as Pay,
  type RamenOrder,
} from '../components/game/panelLogic';
import { dispatch } from '../game/bridge';
import { useGameState, useGameView } from '../game/hooks';
import { PACK } from '../game/pack';
import { useT } from '../hooks';
import { speakJa } from '../services';
import { useStore } from '../store';

export interface TicketPanelProps {
  kind: 'ramen' | 'station';
  /** closes the panel and returns to the world */
  onClose: () => void;
  /** the way on once a ramen ticket is in hand (the world offers the counter); the button shows only when given */
  onTalk?: () => void;
}

/** What the ticket card shows after a purchase. */
interface Issued {
  kind: 'ramen' | 'station';
  /** the bowl or the destination (menu option or place id) */
  what: string;
  extras: string[];
  total: number;
  paid: number;
  change: number;
  pay: Pay;
  left: number;
}

const EMPTY: RamenOrder = { flavor: null, extras: [] };

/**
 * The two ticket machines (docs/GAME_DESIGN.md §6.5). `ramen`: pick a bowl and extras by their Japanese buttons, pay, and the machine
 * prints a meal ticket (`tickets.ramen`) to hand to the staff. `station`: pick a destination on the fare map, pay (a paper ticket costs
 * a little more than the IC fare) or tap the IC card in, and the machine prints a paper ticket (`tickets.station`). Only one ticket of
 * each kind is held at a time. Tapping is the only skill needed; speakers read the Japanese aloud.
 */
export function TicketPanel({ kind, onClose, onTalk }: TicketPanelProps) {
  const { t, lang } = useT();
  const game = useGameState();
  const view = useGameView();
  const settings = useStore((s) => s.settings);
  const card = hasIc(PACK, game);
  // the ramen machine sells for the shop `ramen`, whose table says whether the card works there; the station machine takes it
  const canIc = kind === 'ramen' ? icUsable(PACK, game, 'ramen') : card;
  const [chosenPay, setPay] = useState<Pay>('coins');
  const [inserted, setInserted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [order, setOrder] = useState<RamenOrder>(EMPTY);
  const [place, setPlace] = useState<string | null>(null);

  const pay: Pay = canIc ? chosenPay : 'coins';
  const ramen = useMemo(() => ramenMenu(PACK), []);
  const stops = useMemo(() => fareStops(PACK, game), [game]);
  const stop = stops.find((s) => s.place === place) ?? null;

  // ---- what is being bought and what it costs ----
  const rp = kind === 'ramen' && order.flavor ? ramenPrice(PACK, game, view, order, pay) : null;
  const fare = stop ? (pay === 'ic' ? stop.ic : stop.paper) : 0;
  const total = kind === 'ramen' ? (rp?.total ?? 0) : fare;
  const ready = kind === 'ramen' ? rp !== null : stop !== null;
  const block = ready ? payBlock(game, total, pay, kind === 'ramen' ? rp?.blocked : undefined) : null;

  const speak = (ja: string) => speakJa(ja, { rate: 0.85 });

  const reset = () => {
    setInserted(0);
    setFailed(false);
  };
  const exact = () => setInserted(exactCoins(total).reduce((a, b) => a + b, 0));

  const buy = () => {
    if (!ready || busy) return;
    setBusy(true);
    const paid = pay === 'coins' ? inserted : total;
    const events =
      kind === 'ramen' && rp ? ramenEvents(panelSession('ramen'), order, rp, pay) : stop ? stationEvents(panelSession('fare'), stop.place, pay) : [];
    const ok = events.length > 0 && commitAll(events, dispatch);
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setIssued({
      kind,
      what: kind === 'ramen' ? (order.flavor ?? '') : (stop?.place ?? ''),
      extras: order.extras,
      total,
      paid,
      change: changeFor(total, paid),
      pay,
      left: balanceFor(game, pay) - total,
    });
    setInserted(0);
  };

  const toggleExtra = (option: string) => {
    reset();
    setOrder((o) => ({ ...o, extras: o.extras.includes(option) ? o.extras.filter((x) => x !== option) : [...o.extras, option] }));
  };

  // ---- the ticket in hand (just printed, or kept from before) ----
  const ticket = (() => {
    if (issued) return { place: issued.kind === 'station' ? issued.what : null, flavor: issued.kind === 'ramen' ? issued.what : null, fresh: true };
    if (kind === 'ramen' && game.tickets.ramen) return { place: null, flavor: game.tickets.ramen.flavor, fresh: false };
    if (kind === 'station' && game.tickets.station) return { place: game.tickets.station.place, flavor: null, fresh: false };
    return null;
  })();

  const title = t('panel.ticket.title');
  const shell = (body: ReactNode) => (
    <PanelShell kind={`ticket-${kind}`} ja={tokenize(kind === 'ramen' ? '食券' : '券売機', LEXICON).tokens} title={title} onClose={onClose}>
      <WalletStrip cash={game.wallet.cash} ic={game.wallet.ic} hasIc={card} />
      {body}
    </PanelShell>
  );

  if (ticket) {
    const flavor = ticket.flavor ? ramen.flavors.find((m) => m.option === ticket.flavor) : null;
    const tokens = flavor ? labelTokens(flavor.name) : placeLabel(ticket.place ?? '', lang).tokens;
    const name = flavor ? flavor.name[lang] : placeLabel(ticket.place ?? '', lang).name;
    const paidByCard = issued?.pay === 'ic';
    return shell(
      <div className="pn-done" role="status">
        <div className="pn-ticket" data-ticket={kind}>
          <Icon name="ticket" size={26} />
          <JaLabel tokens={tokens} size="lg" />
          {issued && issued.extras.length > 0 && (
            <div className="pn-extras-on">
              {issued.extras
                .map((o) => ramen.extras.find((m) => m.option === o))
                .filter((m) => !!m)
                .map((m) => (
                  <span key={m!.id} className="pn-chip on">
                    <JaLabel tokens={labelTokens(m!.name)} size="sm" />
                  </span>
                ))}
            </div>
          )}
          <span className="pn-gloss">{name}</span>
        </div>
        <h3>
          {ticket.fresh
            ? kind === 'ramen'
              ? t('panel.ticket.ramenGot')
              : paidByCard
                ? t('panel.ticket.icTapped', { name })
                : t('panel.ticket.stationGot', { name })
            : kind === 'ramen'
              ? t('panel.ticket.ramenHave')
              : t('panel.ticket.stationHave', { name })}
        </h3>
        <p className="pn-note">{kind === 'ramen' ? t('panel.ticket.ramenHand') : t('panel.ticket.stationKeep')}</p>
        {issued && (
          <dl className="pn-receipt">
            <div>
              <dt>{t('receipt.total')}</dt>
              <dd className="pn-num" dir="ltr">
                {yen(issued.total)}
              </dd>
            </div>
            {issued.pay === 'coins' ? (
              <>
                <div>
                  <dt>{t('receipt.paid')}</dt>
                  <dd className="pn-num" dir="ltr">
                    {yen(issued.paid)}
                  </dd>
                </div>
                <div>
                  <dt>{t('receipt.change')}</dt>
                  <dd className="pn-num" dir="ltr">
                    {yen(issued.change)}
                  </dd>
                </div>
              </>
            ) : (
              <div>
                <dt>{t('panel.icLeft')}</dt>
                <dd className="pn-num" dir="ltr">
                  {yen(issued.left)}
                </dd>
              </div>
            )}
          </dl>
        )}
        <div className="pn-actions">
          {kind === 'ramen' && onTalk && (
            <button type="button" className="btn primary wide" onClick={onTalk}>
              {t('panel.ticket.talk')}
            </button>
          )}
          <button type="button" className={`btn ${kind === 'ramen' && onTalk ? 'soft' : 'primary'} wide`} onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>,
    );
  }

  return shell(
    <>
      {kind === 'ramen' ? (
        <>
          <p className="pn-lead">
            {t('panel.ticket.ramenPick')} · <span className="muted">{t('shop.taxIncluded')}</span>
          </p>
          <ul className="pn-grid rows">
            {ramen.flavors.map((m) => (
              <Tile
                key={m.id}
                id={m.option}
                tokens={labelTokens(m.name)}
                gloss={m.name[lang]}
                price={m.price}
                size="md"
                on={order.flavor === m.option}
                onSelect={() => {
                  reset();
                  setOrder((o) => ({ ...o, flavor: m.option }));
                  if (settings.autoSpeak) speak(m.name.ja);
                }}
              />
            ))}
          </ul>
          <p className="pn-lead small">{t('panel.ticket.extras')}</p>
          <ul className="pn-extras">
            {ramen.extras.map((m) => {
              const tokens = labelTokens(m.name);
              const on = order.extras.includes(m.option);
              return (
                <li key={m.id}>
                  <button type="button" className={`pn-chip${on ? ' on' : ''}`} aria-pressed={on} data-extra={m.option} onClick={() => toggleExtra(m.option)}>
                    <JaLabel tokens={tokens} size="sm" />
                    <small className="pn-num" dir="ltr">
                      {yen(m.price)}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
          {!order.flavor && <p className="pn-note">{t('panel.ticket.chooseRamen')}</p>}
        </>
      ) : (
        <>
          <p className="pn-lead">{t('panel.ticket.stationPick')}</p>
          <FareMap stops={stops} selected={place} show={pay === 'ic' ? 'ic' : 'paper'} onSelect={(p) => { reset(); setPlace(p); if (settings.autoSpeak) speak(placeLabel(p, lang).tokens.map((x) => x.s).join('')); }} />
          {stop ? (
            <div className="pn-pick">
              <div className="pn-pick-name">
                <JaLabel tokens={placeLabel(stop.place, lang).tokens} size="lg" />
                <span className="pn-gloss">{placeLabel(stop.place, lang).name}</span>
              </div>
              <SpeakButton tokens={placeLabel(stop.place, lang).tokens} label={`${t('panel.listen')}: ${placeLabel(stop.place, lang).name}`} />
              <dl className="pn-fares">
                <div className={pay === 'ic' ? 'on' : ''}>
                  <dt>{t('panel.ticket.icFare')}</dt>
                  <dd className="pn-num" dir="ltr">
                    {yen(stop.ic)}
                  </dd>
                </div>
                <div className={pay === 'coins' ? 'on' : ''}>
                  <dt>{t('panel.ticket.paperFare')}</dt>
                  <dd className="pn-num" dir="ltr">
                    {yen(stop.paper)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="pn-note">{t('panel.ticket.choose')}</p>
          )}
          {!card && <p className="pn-note">{t('panel.ticket.icTip')}</p>}
        </>
      )}

      {ready && (
        <PanelPay
          total={total}
          ready
          cash={game.wallet.cash}
          ic={game.wallet.ic}
          hasIc={canIc}
          pay={pay}
          onPay={(p) => {
            setPay(p);
            reset();
          }}
          inserted={inserted}
          onInsert={(v) => setInserted((n) => n + v)}
          onReturn={() => setInserted(0)}
          onExact={exact}
          block={block}
          other={block === 'funds' ? otherPay(PACK, game, total, pay) : null}
          busy={busy}
          buyLabel={t('panel.pay.getTicket')}
          onBuy={buy}
        />
      )}
      {failed && <p className="pn-note">{t('panel.closed')}</p>}
    </>,
  );
}
