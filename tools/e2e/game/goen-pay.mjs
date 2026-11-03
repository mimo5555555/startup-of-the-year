// Goen stage 2 (docs/GOEN.md "Stage 2") in the REAL UI at 360 px, English or Arabic (--ar), against the REAL server code (api/goen.ts `handle`)
// with an in-memory Stripe and a stand-in for Stripe's payment page:
//   the shrine shows three packs with their price and the test-card line -> buy 650 -> Stripe's page -> pay -> back in the game: the query is
//   cleaned, +650 Goen with a thank-you, the recovery code kept -> a spend that uses bought Goen is reported to the server (bought Goen spent,
//   the once-item) -> Settings shows the code and the purchase -> a fresh device restores with the code: 400 Goen and the Kyoto Journey ->
//   a cancelled payment says nothing was charged -> a younger player first meets the grown-up check (a wrong answer stays, the right one goes on).
// After every step: no horizontal scroll, no console error, the Goen balance = its ledger, and the yen wallet never moved.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/goen-pay.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, openBlank, openSettings, start, BASE } from './_common.mjs';
import { handle } from '../../../api/goen.ts';

const t = await start('goen-pay', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const ORIGIN = new URL(BASE).origin;
const ENV = { STRIPE_SECRET_KEY: 'sk_test_e2e', GOEN_SECRET: 'e2e-secret-0123456789abcdef' };

// ---- an in-memory Stripe (only what api/goen.ts calls) ----
const stripe = { customers: new Map(), sessions: new Map(), n: 0 };
const fakeFetch = async (url, init) => {
  const u = new URL(url);
  const path = u.pathname.replace('/v1/', '');
  const form = new URLSearchParams(init.body ?? '');
  const ok = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  if (path === 'checkout/sessions' && init.method === 'POST') {
    const id = `cs_test_e2e${++stripe.n}abcdef`;
    const md = {};
    for (const [k, v] of form) if (k.startsWith('metadata[')) md[k.slice(9, -1)] = v;
    stripe.sessions.set(id, {
      id,
      metadata: md,
      payment_status: 'unpaid',
      status: 'open',
      customer: form.get('customer'),
      created: Math.floor(Date.now() / 1000),
      amount_total: Number(form.get('line_items[0][price_data][unit_amount]')),
      currency: form.get('line_items[0][price_data][currency]'),
      success_url: form.get('success_url'),
      cancel_url: form.get('cancel_url'),
      url: `https://checkout.stripe.com/c/pay/${id}`,
    });
    return ok(stripe.sessions.get(id));
  }
  if (path === 'checkout/sessions') {
    const data = [...stripe.sessions.values()].filter((s) => s.customer === u.searchParams.get('customer') && s.status === 'complete').map((s) => ({ ...s, payment_intent: { latest_charge: { refunded: false } } }));
    return ok({ data, has_more: false });
  }
  if (path.startsWith('checkout/sessions/')) {
    const s = stripe.sessions.get(path.split('/')[2]);
    return s ? ok(s) : ok({ error: { message: 'no session' } }, 404);
  }
  if (path.startsWith('customers/')) {
    const c = stripe.customers.get(path.split('/')[1]);
    if (!c) return ok({ error: { message: 'no customer' } }, 404);
    if (init.method === 'POST') for (const [k, v] of form) if (k.startsWith('metadata[')) c.metadata[k.slice(9, -1)] = v;
    return ok(c);
  }
  return ok({ error: { message: `unknown ${path}` } }, 404);
};

await page.route(`${ORIGIN}/api/goen`, async (route) => {
  const req = route.request();
  const body = req.method() === 'POST' ? JSON.parse(req.postData() ?? '{}') : null;
  const r = await handle(req.method(), body, ENV, ORIGIN, fakeFetch);
  await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
});
// Stripe's payment page: "Pay" completes the session (Checkout makes the customer at payment) and goes back; "Back" cancels
await page.route('https://checkout.stripe.com/**', async (route) => {
  const id = new URL(route.request().url()).pathname.split('/').pop();
  const s = stripe.sessions.get(id);
  await route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Stripe test</title><p>${s?.metadata.goen} Goen, ${s?.amount_total} cents</p><button id="pay">Pay</button> <button id="back">Back</button>` });
});
const payOnStripe = async (pay = true) => {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 });
  const id = new URL(page.url()).pathname.split('/').pop();
  const s = stripe.sessions.get(id);
  assert.ok(s, 'the session exists');
  if (pay) {
    if (!s.customer) {
      s.customer = `cus_E2e${stripe.customers.size + 1}Player`;
      stripe.customers.set(s.customer, { id: s.customer, metadata: {} });
    }
    Object.assign(s, { payment_status: 'paid', status: 'complete' });
  }
  await page.goto(pay ? s.success_url.replace('{CHECKOUT_SESSION_ID}', id) : s.cancel_url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw, null, { timeout: 60000 });
  return s;
};

const check = async (where) => {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.goen.balance, g.goen.totals.earned - g.goen.totals.spent, `${where}: Goen = its ledger`);
  return g;
};
const toastText = () => page.evaluate(() => window.__lw.useStore.getState().toast?.text ?? '');
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);

// ---------------------------------------------------------------------------------------------------------------
await onboard(page, { arabic: AR });
const yen0 = (await liveGame(page)).wallet;
step('fresh profile');
await go('shrine');
await page.waitForSelector('[data-goen-shop=on] [data-buy]', { timeout: 20000 });
assert.equal(await page.locator('[data-buy]').count(), 3, 'three packs');
const label = await page.locator('[data-buy=p650]').innerText();
assert.match(label, /4\.99/, 'the price comes from the server');
assert.equal(await page.locator('[data-goen-test]').count(), 1, 'the test-card line in test mode');
await page.locator('[data-goen-shop]').scrollIntoViewIfNeeded();
await t.shot('packs');
await check('shrine');
step('the shrine shows three packs, $4.99 for 650, the test-card line');

await page.locator('[data-buy=p650]').click();
const s1 = await payOnStripe(true);
await page.waitForFunction(() => (window.__lw.getGame().goen?.balance ?? 0) === 650, null, { timeout: 20000 });
assert.ok(!page.url().includes('goen_session'), 'the query is cleaned');
let g = await check('back from Stripe');
assert.ok(g.goen.paid?.code, 'the recovery code is kept');
assert.match(await toastText(), /650/, 'the thank-you toast');
assert.deepEqual(g.wallet, yen0, 'yen untouched');
const CODE = g.goen.paid.code;
step(`paid on Stripe -> +650 Goen, code ${CODE}`);

// a spend with bought Goen (the coin toss of the Kyoto Journey) is reported
await page.evaluate(() => window.__lw.dispatch({ t: 'goen_spend', itemId: 'journey_kyoto', id: 'e2e' }));
await page.waitForFunction(() => (window.__lw.getGame().goen?.paid?.outbox ?? [1]).length === 0, null, { timeout: 20000 });
const cust = stripe.customers.get(s1.customer);
assert.equal(cust.metadata.goen_spent, '250', 'the server counts the bought Goen spent');
assert.ok(cust.metadata.goen_own.includes('journey_kyoto'), 'the server keeps the once-item');
step('the Kyoto Journey bought with bought Goen: reported (250 spent, the item kept)');

await openSettings(page);
await page.waitForSelector('[data-goen-code]');
assert.equal((await page.locator('[data-goen-code]').innerText()).trim(), CODE);
await page.waitForSelector('[data-receipt]', { timeout: 10000 });
await page.locator('[data-goen-purchases]').scrollIntoViewIfNeeded();
await t.shot('settings');
await check('settings');
step('Settings: the code, 400 bought Goen left, the purchase');

// a fresh device: onboard again (storage cleared), restore with the code
await openBlank(page);
await page.evaluate(() => localStorage.clear());
await onboard(page, { arabic: AR, name: 'Ren' });
assert.equal((await liveGame(page)).goen.balance, 0, 'a fresh device starts at 0');
await openSettings(page);
await page.fill('[data-restore-input]', CODE.toLowerCase().replace(/-/g, ' '));
await page.locator('[data-restore-go]').click();
await page.waitForFunction(() => (window.__lw.getGame().goen?.balance ?? 0) === 400, null, { timeout: 20000 });
g = await check('restored');
assert.ok(g.goen.owned.journey_kyoto, 'the Journey is back');
assert.equal(g.goen.paid.code, CODE);
step('a fresh device restores: 400 Goen and the Kyoto Journey');

// a cancelled payment
await go('shrine');
await page.waitForSelector('[data-buy=p120]');
await page.locator('[data-buy=p120]').click();
await payOnStripe(false);
let cancelled = false;
for (let i = 0; i < 40 && !cancelled; i++) {
  cancelled = /charged|يُخصم/.test(await toastText());
  if (!cancelled) await t.sleep(200);
}
assert.ok(cancelled, 'the cancel toast');
assert.equal((await liveGame(page)).goen.balance, 400, 'nothing added');
step('a cancelled payment: nothing charged, nothing added');

// a younger player: the grown-up check first
await page.evaluate(() => window.__lw.useStore.setState((s) => ({ profile: { ...s.profile, age: 'kids' } })));
await go('world');
await go('shrine');
await page.waitForSelector('[data-buy=p120]');
await page.locator('[data-buy=p120]').click();
await page.waitForSelector('[data-goen-gate]');
await t.shot('gate');
const q = await page.locator('[data-goen-gate] .gp-gate-q span').innerText();
const [a, b] = q.match(/\d+/g).map(Number);
await page.fill('[data-goen-gate] input', String(a * b + 1));
await page.locator('[data-gate-ok]').click();
await page.waitForSelector('[data-goen-gate] [role=alert]');
assert.ok(!page.url().includes('stripe'), 'a wrong answer stays');
await page.fill('[data-goen-gate] input', String(a * b));
await page.locator('[data-gate-ok]').click();
await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 });
step('a younger player: the grown-up check (wrong stays, right goes on to Stripe)');

await t.browser.close();
console.log(`goen-pay e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
