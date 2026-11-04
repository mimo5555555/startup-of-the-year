// Goen stage 2 (docs/GOEN.md "Stage 2"): the one server function. It sells Goen packs with Stripe Checkout and keeps no database: Stripe is
// the record. A player's account is a Stripe Customer (made by Checkout at the first payment, so nobody who never pays creates anything);
// the recovery code is that customer's id with an HMAC, so it proves the account without a lookup. Paid credits = the customer's paid
// checkouts (minus refunds and disputes); the bought Goen spent and the once-items to give back live in the customer's metadata.
//
//   GET  /api/goen                         -> { enabled, test, packs }            (the shop shows packs only when enabled)
//   POST /api/goen { a:'checkout', pack, code? } -> { url }                      (Stripe's payment page)
//   POST /api/goen { a:'claim', session }  -> { code, wallet }                     (back from a paid checkout)
//   POST /api/goen { a:'wallet', code }    -> { wallet }                           (sync, restore)
//   POST /api/goen { a:'spend', code, items } -> { wallet, accepted, rejected }    (bought Goen spent, once-items)
//
// Env: STRIPE_SECRET_KEY (sk_test_... first, then sk_live_...). GOEN_SECRET is optional (otherwise derived from the Stripe key, so a test-mode
// code never opens a live-mode account). Prices are set here, never by the client.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Pack {
  id: string;
  goen: number;
  /** of `goen`, the extra over the 120-per-0.99 rate */
  bonus: number;
  cents: number;
  currency: 'usd';
}

export const PACKS: readonly Pack[] = [
  { id: 'p120', goen: 120, bonus: 0, cents: 99, currency: 'usd' },
  { id: 'p650', goen: 650, bonus: 50, cents: 499, currency: 'usd' },
  { id: 'p1400', goen: 1400, bonus: 200, cents: 999, currency: 'usd' },
];

// ---------------------------------------------------------------------------------------------------------------
// The recovery code: Crockford base32 of the customer id (without "cus_") + 40 bits of HMAC, in groups of four
// ---------------------------------------------------------------------------------------------------------------

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function b32(bytes: Uint8Array): string {
  let out = '';
  let bits = 0;
  let acc = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

export function unb32(s: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
    acc &= (1 << bits) - 1;
  }
  if (acc !== 0) return null; // the padding bits of a real code are zero
  return Uint8Array.from(out);
}

const mac = (secret: string, customer: string): string => b32(createHmac('sha256', secret).update(`goen-code|${customer}`).digest().subarray(0, 5));

export function codeFor(customer: string, secret: string): string {
  if (!/^cus_[A-Za-z0-9]{4,60}$/.test(customer)) throw new Error('not a customer id');
  const raw = b32(Buffer.from(customer.slice(4), 'utf8')) + mac(secret, customer);
  return raw.match(/.{1,4}/g)!.join('-');
}

/** The customer id of a recovery code typed by a person (any case, spaces or dashes, O for 0, I/L for 1), or null. */
export function customerOf(code: unknown, secret: string): string | null {
  if (typeof code !== 'string' || code.length > 120) return null;
  const clean = code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length < 12) return null;
  const bytes = unb32(clean.slice(0, -8));
  if (!bytes) return null;
  const customer = `cus_${Buffer.from(bytes).toString('utf8')}`;
  if (!/^cus_[A-Za-z0-9]{4,60}$/.test(customer)) return null;
  const want = Buffer.from(mac(secret, customer));
  const got = Buffer.from(clean.slice(-8));
  return want.length === got.length && timingSafeEqual(want, got) ? customer : null;
}

/** The Stripe key as pasted, cleaned of what a copy often adds: spaces, a line break, quotes, a `STRIPE_SECRET_KEY=` in front. */
export function stripeKeyOf(env: Record<string, string | undefined>): string {
  let k = (env.STRIPE_SECRET_KEY ?? '').trim();
  k = k.replace(/^STRIPE_SECRET_KEY\s*=\s*/, '').trim();
  const q = k.match(/^(['"`])(.*)\1$/s);
  if (q) k = q[2]!.trim();
  return k;
}

/** Why the shop is off, without anything of the key itself: the owner's hint when it does not switch on. */
export function keyProblem(key: string): 'missing' | 'publishable_key' | 'not_a_secret_key' | null {
  if (!key) return 'missing';
  if (/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(key)) return null;
  if (/^pk_/.test(key)) return 'publishable_key';
  return 'not_a_secret_key';
}

export function secretOf(env: Record<string, string | undefined>): string | null {
  if (env.GOEN_SECRET && env.GOEN_SECRET.trim().length >= 16) return env.GOEN_SECRET.trim();
  const key = stripeKeyOf(env);
  if (!key) return null;
  return createHmac('sha256', key).update('lw-goen-code-v1').digest('hex');
}

// ---------------------------------------------------------------------------------------------------------------
// The wallet (pure over Stripe objects, so it is tested without Stripe)
// ---------------------------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});

export interface Credit {
  id: string;
  goen: number;
  pack: string;
  at: number;
  cents: number;
  currency: string;
  refunded: boolean;
}

/** Paid Goen checkouts of the customer (list of Checkout Sessions, `payment_intent.latest_charge` expanded). */
export function creditsOf(sessions: unknown[]): Credit[] {
  const out: Credit[] = [];
  for (const raw of sessions) {
    const s = obj(raw);
    const md = obj(s.metadata);
    const goen = Number(md.goen);
    if (md.lw !== '1' || s.payment_status !== 'paid' || !Number.isInteger(goen) || goen <= 0 || typeof s.id !== 'string') continue;
    const charge = obj(obj(s.payment_intent).latest_charge);
    const refunded = charge.refunded === true || Number(charge.amount_refunded) > 0 || charge.disputed === true;
    out.push({
      id: s.id,
      goen,
      pack: typeof md.pack === 'string' ? md.pack : '',
      at: Number(s.created) * 1000 || 0,
      cents: Number(s.amount_total) || 0,
      currency: typeof s.currency === 'string' ? s.currency : 'usd',
      refunded,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

export interface Meta {
  /** bought Goen spent (all devices) */
  spent: number;
  /** once-items to give back on a restore */
  own: string[];
  /** short hashes of the spend reports already counted (idempotency) */
  seen: string[];
}

export function metaOf(customer: unknown): Meta {
  const md = obj(obj(customer).metadata);
  const list = (v: unknown, re: RegExp) => (typeof v === 'string' && v ? v.split(',').filter((x) => re.test(x)) : []);
  return {
    spent: Math.max(0, Math.trunc(Number(md.goen_spent) || 0)),
    own: list(md.goen_own, /^[a-z0-9_]{1,40}$/),
    seen: list(md.goen_seen, /^[0-9a-f]{8}$/),
  };
}

export const metaParams = (m: Meta): Record<string, string> => ({
  'metadata[lw]': '1',
  'metadata[goen_spent]': String(m.spent),
  'metadata[goen_own]': m.own.join(',').slice(0, 490),
  'metadata[goen_seen]': m.seen.slice(-50).join(','),
});

export interface Wallet {
  credits: { id: string; goen: number; pack: string; at: number; cents: number; currency: string }[];
  refunded: string[];
  spent: number;
  own: string[];
  /** bought Goen not spent yet */
  left: number;
}

export function walletOf(credits: Credit[], meta: Meta): Wallet {
  const live = credits.filter((c) => !c.refunded).reduce((n, c) => n + c.goen, 0);
  return {
    credits: credits.map(({ refunded: _r, ...c }) => c),
    refunded: credits.filter((c) => c.refunded).map((c) => c.id),
    spent: meta.spent,
    own: meta.own,
    left: Math.max(0, live - meta.spent),
  };
}

export interface SpendItem {
  id: string;
  itemId: string;
  paid: number;
  keep: boolean;
}

/** Applies spend reports once each: bought Goen beyond what is left is refused (that report is dropped, the item is not kept). */
export function applySpends(meta: Meta, credits: Credit[], items: unknown[]): { meta: Meta; accepted: string[]; rejected: string[] } {
  let m: Meta = { spent: meta.spent, own: [...meta.own], seen: [...meta.seen] };
  const accepted: string[] = [];
  const rejected: string[] = [];
  const live = credits.filter((c) => !c.refunded).reduce((n, c) => n + c.goen, 0);
  for (const raw of items.slice(0, 50)) {
    const r = obj(raw);
    const id = typeof r.id === 'string' && r.id.length <= 100 ? r.id : null;
    const itemId = typeof r.itemId === 'string' && /^[a-z0-9_]{1,40}$/.test(r.itemId) ? r.itemId : null;
    const paid = Math.trunc(Number(r.paid));
    if (!id || !itemId || !(paid >= 0)) continue;
    const h = createHash('sha256').update(id).digest('hex').slice(0, 8);
    if (m.seen.includes(h)) {
      accepted.push(id);
      continue;
    }
    if (m.spent + paid > live) {
      rejected.push(id);
      continue;
    }
    m = { spent: m.spent + paid, own: r.keep === true && !m.own.includes(itemId) ? [...m.own, itemId] : m.own, seen: [...m.seen, h].slice(-50) };
    accepted.push(id);
  }
  return { meta: m, accepted, rejected };
}

// ---------------------------------------------------------------------------------------------------------------
// Stripe (REST, form-encoded; no SDK)
// ---------------------------------------------------------------------------------------------------------------

export class StripeError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function stripeClient(key: string, fetchFn: Fetch) {
  return async (method: 'GET' | 'POST', path: string, params: Record<string, string> = {}): Promise<Obj> => {
    const q = new URLSearchParams(params).toString();
    const url = `https://api.stripe.com/v1/${path}${method === 'GET' && q ? `?${q}` : ''}`;
    const res = await fetchFn(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      ...(method === 'POST' ? { body: q } : {}),
    });
    const body = obj(await res.json().catch(() => ({})));
    if (!res.ok) throw new StripeError(res.status, String(obj(body.error).message ?? 'stripe error'));
    return body;
  };
}

type Stripe = ReturnType<typeof stripeClient>;

async function walletFor(stripe: Stripe, customer: string): Promise<{ wallet: Wallet; credits: Credit[]; meta: Meta; marked: boolean }> {
  const cust = await stripe('GET', `customers/${customer}`);
  if (cust.deleted === true) throw new StripeError(404, 'customer deleted');
  const sessions: unknown[] = [];
  let after: string | null = null;
  for (let page = 0; page < 5; page++) {
    const params: Record<string, string> = { customer, status: 'complete', limit: '100', 'expand[]': 'data.payment_intent.latest_charge' };
    if (after) params.starting_after = after;
    const list = await stripe('GET', 'checkout/sessions', params);
    const data = Array.isArray(list.data) ? list.data : [];
    sessions.push(...data);
    if (list.has_more !== true || data.length === 0) break;
    after = String(obj(data[data.length - 1]).id);
  }
  const credits = creditsOf(sessions);
  const meta = metaOf(cust);
  return { wallet: walletOf(credits, meta), credits, meta, marked: obj(cust.metadata).lw === '1' };
}

// ---------------------------------------------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------------------------------------------

export interface Reply {
  status: number;
  body: unknown;
}

/** Everything but the HTTP plumbing (tested with a fake fetch). `origin` is where Checkout sends the player back. */
export async function handle(method: string, body: unknown, env: Record<string, string | undefined>, origin: string, fetchFn: Fetch): Promise<Reply> {
  // a key pasted with spaces, a line break or quotes around it still works
  const key = stripeKeyOf(env);
  const secret = secretOf(env);
  const problem = keyProblem(key);
  const enabled = problem === null && secret !== null;
  if (method === 'GET') {
    return {
      status: 200,
      body: {
        enabled,
        test: key.includes('_test_'),
        packs: enabled ? PACKS.map(({ id, goen, bonus, cents, currency }) => ({ id, goen, bonus, cents, currency })) : [],
        ...(problem ? { problem } : {}),
      },
    };
  }
  if (method !== 'POST') return { status: 405, body: { error: 'method' } };
  if (!enabled || !secret) return { status: 503, body: { error: 'off' } };
  const b = obj(body);
  const stripe = stripeClient(key, fetchFn);
  try {
    if (b.a === 'checkout') {
      const pack = PACKS.find((p) => p.id === b.pack);
      if (!pack) return { status: 400, body: { error: 'pack' } };
      const customer = b.code === undefined || b.code === null ? null : customerOf(b.code, secret);
      if (b.code && !customer) return { status: 401, body: { error: 'code' } };
      const params: Record<string, string> = {
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': pack.currency,
        'line_items[0][price_data][unit_amount]': String(pack.cents),
        'line_items[0][price_data][product_data][name]': `${pack.goen} Goen`,
        'line_items[0][price_data][product_data][description]': 'Goen (ご縁) for Language World: journeys, seasons and looks. Never yen or lesson progress.',
        'metadata[lw]': '1',
        'metadata[goen]': String(pack.goen),
        'metadata[pack]': pack.id,
        'payment_intent_data[metadata][lw]': '1',
        'payment_intent_data[metadata][goen]': String(pack.goen),
        success_url: `${origin}/?goen_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?goen_cancel=1`,
      };
      if (customer) params.customer = customer;
      else params.customer_creation = 'always';
      const session = await stripe('POST', 'checkout/sessions', params);
      return { status: 200, body: { url: session.url } };
    }
    if (b.a === 'claim') {
      if (typeof b.session !== 'string' || !/^cs_[A-Za-z0-9_]{8,200}$/.test(b.session)) return { status: 400, body: { error: 'session' } };
      const s = await stripe('GET', `checkout/sessions/${b.session}`);
      const customer = typeof s.customer === 'string' ? s.customer : null;
      if (obj(s.metadata).lw !== '1' || s.payment_status !== 'paid' || !customer) return { status: 409, body: { error: 'unpaid' } };
      const w = await walletFor(stripe, customer);
      if (!w.marked) await stripe('POST', `customers/${customer}`, metaParams(w.meta));
      return { status: 200, body: { code: codeFor(customer, secret), wallet: w.wallet } };
    }
    const customer = customerOf(b.code, secret);
    if (!customer) return { status: 401, body: { error: 'code' } };
    if (b.a === 'wallet') return { status: 200, body: { wallet: (await walletFor(stripe, customer)).wallet } };
    if (b.a === 'spend') {
      const w = await walletFor(stripe, customer);
      const r = applySpends(w.meta, w.credits, Array.isArray(b.items) ? b.items : []);
      if (r.meta.spent !== w.meta.spent || r.meta.own.join() !== w.meta.own.join() || r.meta.seen.join() !== w.meta.seen.join())
        await stripe('POST', `customers/${customer}`, metaParams(r.meta));
      return { status: 200, body: { wallet: walletOf(w.credits, r.meta), accepted: r.accepted, rejected: r.rejected } };
    }
    return { status: 400, body: { error: 'action' } };
  } catch (e) {
    if (e instanceof StripeError) return { status: e.status === 404 ? 401 : 502, body: { error: e.status === 404 ? 'code' : 'stripe' } };
    throw e;
  }
}

function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? safeJson(req.body) : req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c: Buffer) => {
      raw += c.toString('utf8');
      if (raw.length > 20_000) req.destroy();
    });
    req.on('end', () => resolve(safeJson(raw)));
    req.on('error', () => resolve({}));
  });
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
};

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  const origin = /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? `${host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'}://${host}` : '';
  let reply: Reply;
  try {
    reply = await handle(req.method ?? 'GET', req.method === 'POST' ? await readBody(req) : null, process.env, origin, fetch as unknown as Fetch);
  } catch {
    reply = { status: 500, body: { error: 'server' } };
  }
  res.statusCode = reply.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(reply.body));
}
