// Dev harness for the machine panels (agent 2G): served by `vite` at /__panels/ and never built (vite builds index.html only).
// It boots the same stores as the app, completes a profile, and shows the panels over a bare page so tools/e2e/game/panels.mjs can
// drive them before the world opens them. The pack's shops are filled in when 3E's table does not have them yet.
//   /__panels/?lang=ar&open=vending     window.__panels = { open(kind), close(), setWallet(cash, ic), giveCard(), clearTickets() }
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CHARACTERS } from '@lw/content';
import type { ShopDef } from '@lw/game';
import { STATION_SHOPS } from '../../../../packages/content/src/tokyo/game/fares';
import '../styles.css';
import '../styles/game.css';
import { dispatch, init } from '../game/bridge';
import { getGame, useGame } from '../game/gameStore';
import { PACK } from '../game/pack';
import { initGameServices } from '../services';
import { useStore, type Profile } from '../store';
import { VendingPanel } from '../screens/VendingPanel';
import { TicketPanel } from '../screens/TicketPanel';
import { Toasts } from '../components/Toasts';
import { dirOf } from '../i18n';

type Kind = 'vending' | 'ramen' | 'station';

/** The ramen shop's row, only used while the pack's own `shops` table has no `ramen` yet. */
const RAMEN_SHOP: ShopDef = {
  id: 'ramen',
  placeId: 'ramen',
  name: { en: 'Ramen shop', ar: 'مطعم الرامن' },
  openChapter: 1,
  surface: 'world',
  register: 'polite',
  pay: ['cash', 'ic'],
  sells: PACK.menu.filter((m) => m.shop === 'ramen').map((m) => m.id),
};

function fillShops(): void {
  const have = new Set(PACK.shops.map((s) => s.id));
  for (const s of [...STATION_SHOPS, RAMEN_SHOP]) if (!have.has(s.id)) PACK.shops.push(s);
}

/** Puts the wallet at exactly these amounts and keeps the books balanced (a QA tool: the ledger is not involved). */
function setWallet(cash: number, ic: number): void {
  const g = getGame();
  const total = cash + ic;
  const start = PACK.economy.startCash;
  useGame.getState().setGame({
    ...g,
    wallet: { ...g.wallet, cash, ic },
    totals: { ...g.totals, earned: Math.max(0, total - start), spent: Math.max(0, start - total), checksum: { ...g.totals.checksum, cash, ic } },
  });
}

function giveCard(): void {
  dispatch({ t: 'purchase', sessionId: 'harness', n: 1, shopId: 'station', itemId: 'ic_card', qty: 1, total: 500, method: 'cash', lines: [] });
}

function clearTickets(): void {
  useGame.getState().setGame({ ...getGame(), tickets: {} });
}

function Harness() {
  const [open, setOpen] = useState<Kind | null>(() => (new URLSearchParams(location.search).get('open') as Kind | null) ?? null);
  const lang = useStore((s) => s.uiLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
    Object.assign(window, { __panels: { open: setOpen, close: () => setOpen(null), setWallet, giveCard, clearTickets } });
  }, [lang]);
  return (
    <div className="app" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18 }}>Machine panels (dev)</h1>
      <div className="chips">
        {(['vending', 'ramen', 'station'] as const).map((k) => (
          <button key={k} type="button" className="chip" data-open={k} onClick={() => setOpen(k)}>
            {k}
          </button>
        ))}
      </div>
      {open === 'vending' && <VendingPanel onClose={() => setOpen(null)} />}
      {(open === 'ramen' || open === 'station') && <TicketPanel kind={open} onClose={() => setOpen(null)} onTalk={() => setOpen(null)} />}
      <Toasts />
    </div>
  );
}

async function boot() {
  // giving the card at start-up fires the purchase fanfare before any tap, and Chrome logs a blocked vibrate() as an error
  try {
    Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true });
  } catch {
    /* a browser without the property */
  }
  initGameServices();
  fillShops();
  const params = new URLSearchParams(location.search);
  const l1 = params.get('lang') === 'ar' ? 'ar' : 'en';
  await init();
  // every load starts from a fresh game (the save is the browser's, and a scenario of the e2e must not inherit the last one)
  if (!params.has('keep')) useGame.getState().resetGame();
  const profile: Profile = {
    name: 'Sam',
    l1,
    level: 'A1',
    goal: 'travel',
    age: 'adults',
    topics: [],
    avatar: CHARACTERS[0].avatar,
    createdAt: new Date().toISOString(),
  };
  useStore.getState().completeOnboarding(profile);
  // the card first (it costs its deposit), then the wallet at exactly the amounts asked for
  if (params.get('card') === '1') giveCard();
  if (params.has('cash') || params.has('ic')) setWallet(Number(params.get('cash') ?? getGame().wallet.cash), Number(params.get('ic') ?? getGame().wallet.ic));
  Object.assign(window, { __harnessReady: true });
  createRoot(document.getElementById('root')!).render(<Harness />);
}

void boot();
