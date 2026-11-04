// The Goen stage-2 server (api/goen.ts) against a fake Stripe: the recovery code round-trips and refuses tampering; the shop is off without
// a key; checkout sets the price on the server; claim gives the code only for a paid checkout; the wallet counts paid, refunded and spent;
// spend reports count once and never beyond the bought Goen.
import { describe, expect, it } from 'vitest';
import { applySpends, b32, codeFor, creditsOf, customerOf, handle, metaOf, PACKS, unb32, type Fetch } from '../../../api/goen';

const SECRET = 'x'.repeat(32);
const ENV = { STRIPE_SECRET_KEY: 'sk_test_abc', GOEN_SECRET: SECRET };
const ORIGIN = 'https://game.example';

function fakeStripe() {
  const calls: { method: string; url: string; body?: string }[] = [];
  const customer: Record<string, unknown> = { id: 'cus_Abc123XYZ', metadata: {} };
  const sessions = [
    { id: 'cs_paid_one1', metadata: { lw: '1', goen: '650', pack: 'p650' }, payment_status: 'paid', created: 100, amount_total: 499, currency: 'usd', payment_intent: { latest_charge: { refunded: false } } },
    { id: 'cs_refd', metadata: { lw: '1', goen: '120', pack: 'p120' }, payment_status: 'paid', created: 200, amount_total: 99, currency: 'usd', payment_intent: { latest_charge: { refunded: true } } },
    { id: 'cs_other', metadata: {}, payment_status: 'paid', created: 300 },
  ];
  const fetchFn: Fetch = async (url, init) => {
    calls.push({ method: init.method, url, ...(init.body ? { body: init.body } : {}) });
    const path = new URL(url).pathname.replace('/v1/', '');
    const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (path === 'checkout/sessions' && init.method === 'POST') return reply({ id: 'cs_new', url: 'https://checkout.stripe.com/c/pay/cs_new' });
    if (path === 'checkout/sessions') return reply({ data: sessions, has_more: false });
    if (path === 'checkout/sessions/cs_paid_one1') return reply({ ...sessions[0], customer: 'cus_Abc123XYZ' });
    if (path === 'checkout/sessions/cs_open_unpaid1') return reply({ id: 'cs_open_unpaid1', metadata: { lw: '1' }, payment_status: 'unpaid', customer: null });
    if (path === 'customers/cus_Abc123XYZ' && init.method === 'POST') {
      const md: Record<string, string> = {};
      for (const [k, v] of new URLSearchParams(init.body)) md[k.replace(/^metadata\[|\]$/g, '')] = v;
      customer.metadata = md;
      return reply(customer);
    }
    if (path === 'customers/cus_Abc123XYZ') return reply(customer);
    return reply({ error: { message: 'no such thing' } }, 404);
  };
  return { calls, fetchFn, customer };
}

describe('the recovery code', () => {
  it('base32 round-trips; the code gives the customer back, read leniently, and refuses any change', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 255, 7]);
    expect(unb32(b32(bytes))).toEqual(bytes);
    const code = codeFor('cus_Abc123XYZ', SECRET);
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{1,4})+$/);
    expect(customerOf(code, SECRET)).toBe('cus_Abc123XYZ');
    expect(customerOf(` ${code.toLowerCase().replace(/-/g, ' ')} `, SECRET)).toBe('cus_Abc123XYZ');
    const flip = code.slice(0, -1) + (code.endsWith('0') ? '1' : '0');
    expect(customerOf(flip, SECRET)).toBeNull();
    expect(customerOf(code, 'y'.repeat(32))).toBeNull();
    expect(customerOf('hello', SECRET)).toBeNull();
  });
});

describe('the server', () => {
  it('is off without a Stripe key (no packs, purchases refused)', async () => {
    const off = await handle('GET', null, {}, ORIGIN, fakeStripe().fetchFn);
    expect(off.body).toEqual({ enabled: false, test: false, packs: [], problem: 'missing' });
    const get = async (k: string) => (await handle('GET', null, { STRIPE_SECRET_KEY: k }, ORIGIN, fakeStripe().fetchFn)).body as Record<string, unknown>;
    expect(await get('pk_test_abc')).toMatchObject({ enabled: false, problem: 'publishable_key' });
    expect(await get('sk_test_ key')).toMatchObject({ enabled: false, problem: 'not_a_secret_key' });
    expect(await get('"sk_test_abc"')).toMatchObject({ enabled: true });
    expect(await get('STRIPE_SECRET_KEY=sk_test_abc')).toMatchObject({ enabled: true });
    expect(JSON.stringify(await get('sk_live_ zzqx'))).not.toContain('zzqx');
    expect((await handle('POST', { a: 'checkout', pack: 'p120' }, {}, ORIGIN, fakeStripe().fetchFn)).status).toBe(503);
    const spaced = await handle('GET', null, { STRIPE_SECRET_KEY: ' sk_test_abc \n' }, ORIGIN, fakeStripe().fetchFn);
    expect(spaced.body).toMatchObject({ enabled: true, test: true });
    const on = await handle('GET', null, ENV, ORIGIN, fakeStripe().fetchFn);
    expect(on.body).toMatchObject({ enabled: true, test: true });
    expect((on.body as { packs: unknown[] }).packs).toHaveLength(3);
  });

  it('checkout: the server sets the price and the Goen; a new player gets the customer made at payment; a bad code is refused', async () => {
    const st = fakeStripe();
    const r = await handle('POST', { a: 'checkout', pack: 'p650', cents: 1 }, ENV, ORIGIN, st.fetchFn);
    expect(r.body).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_new' });
    const sent = new URLSearchParams(st.calls[0]!.body);
    expect(sent.get('line_items[0][price_data][unit_amount]')).toBe('499');
    expect(sent.get('metadata[goen]')).toBe('650');
    expect(sent.get('customer_creation')).toBe('always');
    expect(sent.get('success_url')).toBe(`${ORIGIN}/?goen_session={CHECKOUT_SESSION_ID}`);
    const again = await handle('POST', { a: 'checkout', pack: 'p120', code: codeFor('cus_Abc123XYZ', SECRET) }, ENV, ORIGIN, st.fetchFn);
    expect(again.status).toBe(200);
    expect(new URLSearchParams(st.calls[1]!.body).get('customer')).toBe('cus_Abc123XYZ');
    expect((await handle('POST', { a: 'checkout', pack: 'p999' }, ENV, ORIGIN, st.fetchFn)).status).toBe(400);
    expect((await handle('POST', { a: 'checkout', pack: 'p120', code: 'AAAA-BBBB-CCCC' }, ENV, ORIGIN, st.fetchFn)).status).toBe(401);
  });

  it('claim: the code only for a paid checkout; the wallet counts paid, not refunded or foreign checkouts', async () => {
    const st = fakeStripe();
    expect((await handle('POST', { a: 'claim', session: 'cs_open_unpaid1' }, ENV, ORIGIN, st.fetchFn)).status).toBe(409);
    const r = await handle('POST', { a: 'claim', session: 'cs_paid_one1' }, ENV, ORIGIN, st.fetchFn);
    expect(r.status).toBe(200);
    const body = r.body as { code: string; wallet: { credits: { id: string }[]; refunded: string[]; left: number } };
    expect(customerOf(body.code, SECRET)).toBe('cus_Abc123XYZ');
    expect(body.wallet.credits.map((c) => c.id)).toEqual(['cs_paid_one1', 'cs_refd']);
    expect(body.wallet.refunded).toEqual(['cs_refd']);
    expect(body.wallet.left).toBe(650);
    expect(metaOf(st.customer).spent).toBe(0);
  });

  it('spend: each report once, the once-items kept, never more bought Goen than was paid', async () => {
    const st = fakeStripe();
    const code = codeFor('cus_Abc123XYZ', SECRET);
    const items = [
      { id: 'goen:spend:journey_kyoto', itemId: 'journey_kyoto', paid: 250, keep: true },
      { id: 'goen:spend:omamori_streak:c1', itemId: 'omamori_streak', paid: 30, keep: false },
    ];
    const r = await handle('POST', { a: 'spend', code, items }, ENV, ORIGIN, st.fetchFn);
    expect(r.body).toMatchObject({ accepted: items.map((i) => i.id), rejected: [], wallet: { spent: 280, own: ['journey_kyoto'], left: 370 } });
    const replay = await handle('POST', { a: 'spend', code, items }, ENV, ORIGIN, st.fetchFn);
    expect(replay.body).toMatchObject({ wallet: { spent: 280 } });
    const greedy = await handle('POST', { a: 'spend', code, items: [{ id: 'big', itemId: 'kimono_momiji', paid: 400, keep: true }] }, ENV, ORIGIN, st.fetchFn);
    expect(greedy.body).toMatchObject({ rejected: ['big'], wallet: { spent: 280, own: ['journey_kyoto'] } });
    expect((await handle('POST', { a: 'wallet', code }, ENV, ORIGIN, st.fetchFn)).body).toMatchObject({ wallet: { spent: 280, left: 370 } });
  });

  it('pure helpers: packs are priced in cents with their bonus; refunds and disputes are not credits', () => {
    expect(PACKS.map((p) => [p.goen, p.cents, p.bonus])).toEqual([
      [120, 99, 0],
      [650, 499, 50],
      [1400, 999, 200],
    ]);
    const c = creditsOf([{ id: 'cs_d', metadata: { lw: '1', goen: '120' }, payment_status: 'paid', payment_intent: { latest_charge: { disputed: true } } }]);
    expect(c[0]!.refunded).toBe(true);
    expect(applySpends({ spent: 0, own: [], seen: [] }, c, [{ id: 'a', itemId: 'x', paid: 1, keep: true }]).rejected).toEqual(['a']);
  });
});
