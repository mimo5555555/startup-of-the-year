// Goen stage 2 in the app (docs/GOEN.md "Stage 2"): the shop's packs (from the server, which sets every price), the trip to Stripe's
// payment page and back, the sync of what the server holds (paid checkouts, refunds, bought Goen spent on another device, once-items to give
// back), the spend reports, and the restore with a recovery code. The game rules live in @lw/game (`goen_account`, `goen_sync`,
// `goen_reported`); this file only talks to /api/goen and dispatches them. Without the server (the dev build, the shop not set up) the
// shop says "coming soon": never a dead buy button.
import { create } from 'zustand';
import { goenCode, goenOutbox, type GameState } from '@lw/game';
import { translate, type StringKey } from '../i18n';
import { useStore } from '../store';
import { dispatch } from './bridge';
import { useGame } from './gameStore';

export interface PackOffer {
  id: string;
  goen: number;
  bonus: number;
  cents: number;
  currency: string;
}

export interface WalletReply {
  credits: { id: string; goen: number; pack: string; at: number; cents: number; currency: string }[];
  refunded: string[];
  spent: number;
  own: string[];
  left: number;
}

type ShopStatus = 'loading' | 'on' | 'off';

interface PayState {
  status: ShopStatus;
  test: boolean;
  packs: PackOffer[];
  /** the last wallet the server sent (the purchases list in Settings) */
  wallet: WalletReply | null;
  busy: boolean;
  set(p: Partial<Omit<PayState, 'set'>>): void;
}

export const usePay = create<PayState>()((set) => ({ status: 'loading', test: false, packs: [], wallet: null, busy: false, set: (p) => set(p) }));

const API = '/api/goen';
const say = (key: StringKey, vars?: Record<string, string | number>, tone: 'good' | 'info' = 'info'): void => {
  const st = useStore.getState();
  st.say(translate(st.uiLang, key, vars), tone);
};
const state = (): GameState => useGame.getState();

async function post(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

/** A price as the player reads it ("$4.99", "US$4.99" in Arabic). */
export function priceText(cents: number, currency: string, lang: string): string {
  try {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** The shop's packs: once a session (the shop is off without the server or its Stripe key). */
let loaded: Promise<void> | null = null;
export function loadShop(): Promise<void> {
  loaded ??= (async () => {
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });
      const body = (await res.json()) as { enabled?: boolean; test?: boolean; packs?: PackOffer[] };
      const packs = Array.isArray(body.packs) ? body.packs : [];
      usePay.getState().set({ status: res.ok && body.enabled === true && packs.length > 0 ? 'on' : 'off', test: body.test === true, packs });
    } catch {
      usePay.getState().set({ status: 'off', packs: [] });
    }
  })();
  return loaded;
}

/** Applies a wallet from the server; returns the Goen the paid checkouts added now (0 for a replay). */
export function applyWallet(w: WalletReply): number {
  const r = dispatch({
    t: 'goen_sync',
    credits: w.credits.map((c) => ({ id: c.id, goen: c.goen })),
    refunded: w.refunded,
    spent: w.spent,
    own: w.own,
  });
  usePay.getState().set({ wallet: w });
  return r.derived.filter((d) => d.t === 'goen_changed' && d.reason === 'buy').reduce((n, d) => n + (d.t === 'goen_changed' ? d.delta : 0), 0);
}

/** Opens Stripe's payment page for a pack (the grown-up check, if any, has already passed). */
export async function buyPack(packId: string): Promise<void> {
  if (usePay.getState().busy) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return say('gp.offline');
  usePay.getState().set({ busy: true });
  say('gp.opening');
  try {
    await flushSpends();
    const r = await post({ a: 'checkout', pack: packId, code: goenCode(state()) });
    const url = typeof r.body.url === 'string' ? r.body.url : null;
    if (r.status !== 200 || !url || !/^https:\/\/checkout\.stripe\.com\//.test(url)) throw new Error('checkout');
    window.location.assign(url);
  } catch {
    usePay.getState().set({ busy: false });
    say('gp.error');
  }
}

/** Sends the spends the server has not confirmed (bought Goen used, once-items to give back). */
export async function flushSpends(): Promise<void> {
  const code = goenCode(state());
  const items = goenOutbox(state());
  if (!code || items.length === 0) return;
  try {
    const r = await post({ a: 'spend', code, items });
    if (r.status !== 200) return;
    const ids = [...((r.body.accepted as string[]) ?? []), ...((r.body.rejected as string[]) ?? [])];
    if (ids.length) dispatch({ t: 'goen_reported', ids });
    if (r.body.wallet) applyWallet(r.body.wallet as WalletReply);
  } catch {
    /* offline: the outbox waits for the next sync */
  }
}

/** Fetches and applies the account's wallet (after a purchase elsewhere, a refund, or simply opening the app). */
export async function syncWallet(code = goenCode(state())): Promise<'ok' | 'bad' | 'offline'> {
  if (!code) return 'ok';
  try {
    await flushSpends();
    const r = await post({ a: 'wallet', code });
    if (r.status === 401) return 'bad';
    if (r.status !== 200 || !r.body.wallet) return 'offline';
    applyWallet(r.body.wallet as WalletReply);
    return 'ok';
  } catch {
    return 'offline';
  }
}

/** Restores the purchases of a recovery code on this device (the code is checked by the server before it is kept). */
export async function restore(code: string): Promise<'ok' | 'bad' | 'offline'> {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (clean.length < 12) return 'bad';
  const pretty = clean.match(/.{1,4}/g)!.join('-');
  try {
    const r = await post({ a: 'wallet', code: pretty });
    if (r.status === 401 || r.status === 400) return 'bad';
    if (r.status !== 200 || !r.body.wallet) return 'offline';
    dispatch({ t: 'goen_account', code: pretty });
    applyWallet(r.body.wallet as WalletReply);
    say('gp.restore.done', undefined, 'good');
    return 'ok';
  } catch {
    return 'offline';
  }
}

/** The way back from Stripe: `?goen_session=` (paid: claim the code, add the Goen) or `?goen_cancel=1`. The query is cleaned at once. */
export async function handleReturn(search: string = window.location.search): Promise<void> {
  const q = new URLSearchParams(search);
  const session = q.get('goen_session');
  const cancel = q.get('goen_cancel');
  if (session || cancel) {
    q.delete('goen_session');
    q.delete('goen_cancel');
    const rest = q.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }
  if (cancel) return say('gp.cancel');
  if (!session) {
    void syncWallet();
    return;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await post({ a: 'claim', session });
      if (r.status === 200 && typeof r.body.code === 'string' && r.body.wallet) {
        dispatch({ t: 'goen_account', code: r.body.code });
        const added = applyWallet(r.body.wallet as WalletReply);
        await flushSpends();
        if (added > 0) say('gp.thanks', { n: added }, 'good');
        return;
      }
      if (r.status !== 409) break;
    } catch {
      /* retry below */
    }
    await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
  }
  say('gp.pending');
}

/** Two one-digit-by-two-digit numbers for the grown-up check (players under 18). */
export function gateQuestion(rng: () => number = Math.random): { a: number; b: number; answer: number } {
  const a = 6 + Math.floor(rng() * 4);
  const b = 12 + Math.floor(rng() * 8);
  return { a, b, answer: a * b };
}

/** Once at start: the shop's packs, the way back from Stripe (or a quiet sync), and the spend reports sent soon after each spend. */
let started = false;
export function startPay(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void loadShop();
  void handleReturn();
  let timer: ReturnType<typeof setTimeout> | null = null;
  useGame.subscribe((s, prev) => {
    if (s.goen?.paid?.outbox === prev.goen?.paid?.outbox || !goenOutbox(s).length) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flushSpends(), 1500);
  });
  window.addEventListener('online', () => void flushSpends());
}
