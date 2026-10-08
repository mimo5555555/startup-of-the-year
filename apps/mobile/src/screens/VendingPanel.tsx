import { useMemo, useState } from 'react';
import { LEXICON, tokenize } from '@lw/content';
import { Icon } from '../components/Icon';
import { JaLabel, PanelShell, Tile, WalletStrip } from '../components/game/PanelParts';
import { PanelPay } from '../components/game/PanelPay';
import {
  balanceFor,
  changeFor,
  commitAll,
  exactCoins,
  hasIc,
  icUsable,
  labelTokens,
  otherPay,
  panelSession,
  payBlock,
  vendingDrinks,
  vendingEvent,
  vendingQuote,
  yen,
  type PanelPay as Pay,
} from '../components/game/panelLogic';
import { dispatch } from '../game/bridge';
import { useGameState, useGameView } from '../game/hooks';
import { PACK } from '../game/pack';
import { useT } from '../hooks';
import { speakJa } from '../services';
import { useStore } from '../store';

type Temp = 'hot' | 'cold';

/** あたたかい / つめたい as tokens, in the machine's own colours (§6.3: hot is red, cold is blue). */
const TEMP_JA: Record<Temp, string> = { hot: 'あたたかい', cold: 'つめたい' };

interface Bought {
  name: { ja: string; reading?: string; en: string; ar: string };
  temp: Temp;
  total: number;
  paid: number;
  change: number;
  pay: Pay;
  left: number;
}

/**
 * The vending machine (docs/GAME_DESIGN.md §6.3, §6.5): choose a drink by its Japanese label, price and temperature, then pay with
 * coins or the IC card. Everything is tapping; the speaker reads a label aloud. A purchase is one `purchase` event with a panel session
 * id (the reducer gives the first sip of each drink a little XP and the culture card `cc_vending`; there is no yen reward here).
 * `onClose` returns to the world.
 */
export function VendingPanel({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const game = useGameState();
  const view = useGameView();
  const settings = useStore((s) => s.settings);
  const drinks = useMemo(() => vendingDrinks(PACK), []);
  const card = hasIc(PACK, game);
  const canIc = icUsable(PACK, game, 'vending');
  const [selId, setSelId] = useState<string | null>(null);
  const [temp, setTemp] = useState<Temp>('cold');
  const [chosenPay, setPay] = useState<Pay>('coins');
  const [inserted, setInserted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bought, setBought] = useState<Bought | null>(null);
  const [failed, setFailed] = useState(false);

  const pay: Pay = canIc ? chosenPay : 'coins';
  const sel = drinks.find((d) => d.menu.id === selId) ?? null;
  const q = sel ? vendingQuote(PACK, game, view, sel.menu.id, pay) : null;
  // a quote the pack blocks (the machine's shop is missing) has no total: show the list price so the screen still reads
  const total = sel ? (q && !q.block ? q.total : q?.block === 'funds' ? q.total : sel.menu.price) : 0;
  const block = sel ? payBlock(game, total, pay, q?.block) : null;

  const choose = (id: string) => {
    const d = drinks.find((x) => x.menu.id === id);
    if (!d) return;
    setSelId(id);
    setTemp(d.temps[0]);
    setInserted(0);
    setFailed(false);
    if (settings.autoSpeak) speakJa(labelTokens(d.menu.name).map((x) => x.s).join(''), { rate: 0.85 });
  };

  const insert = (value: number) => setInserted((n) => n + value);
  const exact = () => setInserted(exactCoins(total).reduce((a, b) => a + b, 0));

  const buy = () => {
    if (!sel || busy) return;
    setBusy(true);
    const paid = pay === 'coins' ? inserted : total;
    const ok = commitAll([vendingEvent(panelSession('vend'), sel.menu.id, total, pay, sel.menu.name)], dispatch);
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setBought({ name: sel.menu.name, temp, total, paid, change: changeFor(total, paid), pay, left: balanceFor(game, pay) - total });
    setSelId(null);
    setInserted(0);
  };

  const again = () => {
    setBought(null);
    setFailed(false);
  };

  return (
    <PanelShell kind="vending" ja={tokenize('自動販売機', LEXICON).tokens} title={t('panel.vending.title')} onClose={onClose}>
      <WalletStrip cash={game.wallet.cash} ic={game.wallet.ic} hasIc={card} />

      {bought ? (
        <div className="pn-done" role="status">
          <div className="done-badge">
            <Icon name="check" size={34} stroke={3} />
          </div>
          <h3>{t('panel.vending.bought', { name: bought.name[lang] })}</h3>
          <div className={`pn-drink ${bought.temp}`}>
            <JaLabel tokens={[...tokenize(TEMP_JA[bought.temp], LEXICON).tokens, ...labelTokens(bought.name)]} size="lg" />
          </div>
          <dl className="pn-receipt">
            <div>
              <dt>{t('receipt.total')}</dt>
              <dd className="pn-num" dir="ltr">
                {yen(bought.total)}
              </dd>
            </div>
            {bought.pay === 'coins' ? (
              <>
                <div>
                  <dt>{t('receipt.paid')}</dt>
                  <dd className="pn-num" dir="ltr">
                    {yen(bought.paid)}
                  </dd>
                </div>
                <div>
                  <dt>{t('receipt.change')}</dt>
                  <dd className="pn-num" dir="ltr">
                    {yen(bought.change)}
                  </dd>
                </div>
              </>
            ) : (
              <div>
                <dt>{t('panel.icLeft')}</dt>
                <dd className="pn-num" dir="ltr">
                  {yen(bought.left)}
                </dd>
              </div>
            )}
          </dl>
          <div className="pn-actions">
            <button type="button" className="btn primary wide" onClick={again}>
              {t('panel.vending.another')}
            </button>
            <button type="button" className="btn soft wide" onClick={onClose}>
              {t('common.done')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="pn-lead">
            {t('panel.vending.pick')} · <span className="muted">{t('shop.taxIncluded')}</span>
          </p>
          <ul className="pn-grid">
            {drinks.map((d) => (
              <Tile
                key={d.menu.id}
                id={d.menu.option}
                tokens={labelTokens(d.menu.name)}
                gloss={d.menu.name[lang]}
                price={d.menu.price}
                temps={d.temps}
                on={d.menu.id === selId}
                onSelect={() => choose(d.menu.id)}
              />
            ))}
          </ul>

          {sel && sel.temps.length > 1 && (
            <div className="pn-temp" role="radiogroup" aria-label={t('panel.vending.temp')}>
              {sel.temps.map((tp) => (
                <button key={tp} type="button" role="radio" aria-checked={temp === tp} className={`pn-chip ${tp}${temp === tp ? ' on' : ''}`} onClick={() => setTemp(tp)}>
                  <JaLabel tokens={tokenize(TEMP_JA[tp], LEXICON).tokens} size="md" />
                  <small>{t(tp === 'hot' ? 'panel.vending.hot' : 'panel.vending.cold')}</small>
                </button>
              ))}
            </div>
          )}

          {sel ? (
            <PanelPay
              total={total}
              ready
              cash={game.wallet.cash}
              ic={game.wallet.ic}
              hasIc={canIc}
              pay={pay}
              onPay={(p) => {
                setPay(p);
                setInserted(0);
              }}
              inserted={inserted}
              onInsert={insert}
              onReturn={() => setInserted(0)}
              onExact={exact}
              block={block}
              other={block === 'funds' ? otherPay(PACK, game, total, pay) : null}
              busy={busy}
              buyLabel={t('panel.pay.buy')}
              onBuy={buy}
            />
          ) : null}
          {failed && <p className="pn-note">{t('panel.closed')}</p>}
        </>
      )}
    </PanelShell>
  );
}
