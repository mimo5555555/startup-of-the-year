// The machine panels (agent 2G, docs/GAME_DESIGN.md §6.5): vending machine, ramen ticket machine, station ticket machine, at 360 px in
// English or Arabic. The world does not open the panels yet (agent 2B), so the script drives the dev harness that vite serves at
// /__panels/ (apps/mobile/__panels, src/dev/panelsHarness.tsx; never built): it boots the app's stores and the real panels over a bare page
// and gives the script `window.__panels = { open, close, setWallet, giveCard, clearTickets }`.
// Usage: node tools/e2e/game/panels.mjs [--ar]   (BASE=http://127.0.0.1:<port>/ points at the dev server)
import assert from 'node:assert/strict';
import { BASE, assertNoConsoleErrors, assertNoHScroll, start } from './_common.mjs';

const t = await start('panels');
const { page } = t;
const lang = t.arabic ? 'ar' : 'en';
const url = (q = '') => `${BASE}__panels/?lang=${lang}${q}`;
const game = () => page.evaluate(() => window.__lw.getGame());
const wallet = async () => (await game()).wallet;

/** Loads the harness with a wallet (and the IC card when asked) and opens a panel. */
async function open(kind, { cash = 3000, ic = 0, card = false } = {}) {
  await page.goto(url(`&cash=${cash}${card ? '&card=1' : ''}${ic ? `&ic=${ic}` : ''}&open=${kind}`), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__harnessReady, null, { timeout: 60000 });
  await page.waitForSelector(`[data-panel="${kind === 'vending' ? 'vending' : `ticket-${kind}`}"]`);
  await t.sleep(300);
}
const sheetFits = async (where) => {
  const w = await page.evaluate(() => {
    const s = document.querySelector('.pn-sheet');
    return { scroll: s.scrollWidth, client: s.clientWidth };
  });
  assert.ok(w.scroll <= w.client, `${where}: the sheet scrolls sideways (${JSON.stringify(w)})`);
  await assertNoHScroll(page, where);
};
/** Taps the coins that make `amount` (a 1,000 yen note, then 500, 100, 50, 10). */
async function insert(amount) {
  let left = amount;
  for (const v of [1000, 500, 100, 50, 10]) {
    while (left >= v) {
      await page.locator(`.pn-coin:has-text("${v}")`).first().click();
      left -= v;
    }
  }
}
const buy = async () => {
  await page.locator('.pn-buy').click();
  await t.sleep(300);
};

// ---------------------------------------------------------------------------------------------------------------
t.step('vending: the machine lists four drinks with Japanese labels, prices and speakers');
await open('vending');
if (t.arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl in Arabic');
assert.equal(await page.locator('.pn-tile').count(), 4);
for (const id of ['v_tea', 'v_coffee', 'v_water', 'v_juice']) assert.equal(await page.locator(`.pn-tile[data-id="${id}"]`).count(), 1, id);
assert.equal(await page.locator('.pn-tile .pn-speak').count(), 4, 'a speaker on every drink');
assert.ok((await page.locator('.pn-tile[data-id="v_tea"] .ja').first().innerText()).includes('お茶'));
assert.ok((await page.locator('.pn-tile[data-id="v_tea"] .pn-price strong').innerText()).includes('150'));
await sheetFits('vending list');
await t.shot('01-vending');

t.step('vending: cold water (130) paid with exactly the coins; the wallet moves by the price, no more');
await page.locator('.pn-tile[data-id="v_water"] .pn-tile-main').click();
await page.waitForSelector('.pn-coins');
await t.shot('02-vending-pay');
await page.locator('.pn-buy').isDisabled().then((d) => assert.ok(d, 'the button is off until enough is inside'));
await page.locator('.pn-tray-actions .btn').first().click();
assert.equal(await page.locator('.pn-buy').isDisabled(), false);
await buy();
let w = await wallet();
assert.equal(w.cash, 3000 - 130, 'cash fell by 130');
assert.equal(w.ic, 0);
await page.waitForSelector('.pn-done');
await sheetFits('vending bought');
await t.shot('03-vending-bought');
let g = await game();
assert.ok(g.ledger.some((e) => e.kind === 'purchase' && e.delta === -130), 'the purchase is in the ledger');
assert.equal(g.stats.purchases, 0, 'a vending drink is not a conversation purchase (§6.5)');
assert.equal(g.totals.spent, 130);

t.step('vending: hot tea (150) with 200 in coins gives 50 change');
await page.locator('.pn-done .btn.primary').click();
await page.locator('.pn-tile[data-id="v_tea"] .pn-tile-main').click();
await page.waitForSelector('.pn-temp');
await page.locator('.pn-temp .pn-chip.hot').click();
await insert(200);
await buy();
w = await wallet();
assert.equal(w.cash, 3000 - 130 - 150, 'cash fell by the price, the change came back');
assert.ok((await page.locator('.pn-receipt').innerText()).includes('50'), 'the receipt shows the 50 yen change');
assert.ok((await page.locator('.pn-drink').innerText()).includes('あたたか'), 'the hot drink shows あたたかい');
await t.shot('04-vending-hot-tea');

t.step('vending: too little cash is a gentle state with a way out, never a dead end');
await open('vending', { cash: 100 });
await page.locator('.pn-tile[data-id="v_tea"] .pn-tile-main').click();
await page.waitForSelector('.pn-short');
assert.equal(await page.locator('.pn-buy').isDisabled(), true);
assert.equal(await page.locator('.pn-coin:has-text("500")').isDisabled(), true, 'cannot put in more than the wallet holds');
await sheetFits('vending short');
await t.shot('05-vending-short');
assert.equal((await wallet()).cash, 100, 'nothing was taken');
await page.locator('.pn-head .icon-btn').last().click();
await page.waitForSelector('.pn-sheet', { state: 'detached' });

t.step('vending: with an IC card the card pays (cash untouched)');
await open('vending', { cash: 800, ic: 1000, card: true });
await page.locator('.pn-tile[data-id="v_juice"] .pn-tile-main').click();
await page.waitForSelector('.pn-pay');
assert.equal(await page.locator('.pn-seg').count(), 1, 'coins or IC');
await page.locator('.pn-seg button').nth(1).click();
await page.waitForSelector('.pn-ic');
await t.shot('06-vending-ic');
await buy();
w = await wallet();
assert.equal(w.ic, 1000 - 150);
assert.equal(w.cash, 800);
await t.shot('07-vending-ic-bought');

// ---------------------------------------------------------------------------------------------------------------
t.step('ramen ticket: a bowl and an extra, paid with coins; the ticket is stored');
await open('ramen');
assert.equal(await page.locator('.pn-tile').count(), 3, 'three bowls');
assert.equal(await page.locator('.pn-extras .pn-chip').count(), 4, 'four extras');
await sheetFits('ramen');
await t.shot('08-ramen');
await page.locator('.pn-tile[data-id="miso"] .pn-tile-main').click();
await page.locator('.pn-chip[data-extra="ajitama"]').click();
await page.waitForSelector('.pn-coins');
await t.shot('09-ramen-pay');
await insert(1100);
await buy();
g = await game();
assert.equal(g.wallet.cash, 3000 - 950 - 150, 'the bowl and the egg were charged');
assert.deepEqual(g.tickets.ramen, { flavor: 'miso' });
assert.equal(g.stats.tickets, 1);
await page.waitForSelector('.pn-ticket');
await sheetFits('ramen ticket');
await t.shot('10-ramen-ticket');
await page.locator('.pn-actions .btn').first().click();
await page.waitForSelector('.pn-sheet', { state: 'detached' });

t.step('ramen ticket: with one in hand the machine says so and charges nothing more');
await page.evaluate(() => window.__panels.open('ramen'));
await page.waitForSelector('.pn-ticket');
assert.equal(await page.locator('.pn-coins').count(), 0, 'no way to pay twice');
assert.equal((await wallet()).cash, 3000 - 1100);
await page.locator('.pn-head .icon-btn').last().click();

t.step('ramen ticket: too little cash for the bowl');
await open('ramen', { cash: 500 });
await page.locator('.pn-tile[data-id="tonkotsu"] .pn-tile-main').click();
await page.waitForSelector('.pn-short');
assert.equal(await page.locator('.pn-buy').isDisabled(), true);
await t.shot('11-ramen-short');
assert.equal((await wallet()).cash, 500);
assert.equal((await game()).tickets.ramen, undefined, 'no ticket without paying');

// ---------------------------------------------------------------------------------------------------------------
t.step('station ticket: the fare map lists every destination with its fare, a paper ticket costs ¥10 more');
await open('station');
assert.equal(await page.locator('.pn-stop').count(), 8, 'eight destinations');
// with coins the map shows the paper fares; the fare of every stop is on its button (aria-label "<name>, ¥<fare>")
const fareOf = (await page.locator('.pn-stop').evaluateAll((els) => els.map((e) => Number((e.getAttribute('aria-label') ?? '').replace(/.*¥/, '').replace(/,/g, ''))))).sort((a, b) => a - b);
assert.deepEqual(fareOf, [180, 180, 200, 220, 220, 240, 270, 530], 'paying with coins buys a paper ticket: the IC fares of §5.4 plus ¥10');
await sheetFits('station map');
await t.shot('12-station-map');
await page.locator('.pn-stop').nth(2).click(); // shinjuku
await page.waitForSelector('.pn-pick');
const fares = (await page.locator('.pn-fares dd').allInnerTexts()).map((s) => s.replace(/\D/g, ''));
assert.deepEqual(fares, ['190', '200'], 'IC fare 190, paper 200');
await t.shot('13-station-pick');
await insert(200);
await buy();
g = await game();
assert.equal(g.wallet.cash, 3000 - 200, 'the paper fare (190 + 10) was charged');
assert.deepEqual(g.tickets.station, { place: 'shinjuku' });
assert.ok(g.chapter.flags.includes('ticket_bought'), 'the paper ticket raises the ticket_bought flag');
await page.waitForSelector('.pn-ticket');
await sheetFits('station ticket');
await t.shot('14-station-ticket');
await page.locator('.pn-actions .btn').first().click();

t.step('station ticket with an IC card: tap in, the card pays the IC fare and no flag is raised');
await open('station', { cash: 1000, ic: 1000, card: true });
await page.locator('.pn-stop').nth(0).click(); // shibuya
await page.locator('.pn-seg button').nth(1).click();
await page.waitForSelector('.pn-ic');
const icFares = (await page.locator('.pn-fares dd').allInnerTexts()).map((s) => s.replace(/\D/g, ''));
assert.deepEqual(icFares, ['170', '180']);
await t.shot('15-station-ic');
await buy();
g = await game();
assert.equal(g.wallet.ic, 1000 - 170);
assert.equal(g.wallet.cash, 1000);
assert.deepEqual(g.tickets.station, { place: 'shibuya' });
assert.ok(!g.chapter.flags.includes('ticket_bought'), 'a tap-in is not a paper ticket');

t.step('station ticket: short of cash for the paper fare, the IC suggestion is offered when the card has enough');
await open('station', { cash: 150, ic: 500, card: true });
await page.locator('.pn-stop').nth(0).click();
await page.waitForSelector('.pn-short');
assert.equal(await page.locator('.pn-short .btn').count(), 1, 'the card would cover it: a button says so');
await t.shot('16-station-short');
await page.locator('.pn-short .btn').click();
await page.waitForSelector('.pn-ic');
assert.equal(await page.locator('.pn-buy').isDisabled(), false);

assertNoConsoleErrors(t.logs.filter((l) => !/404/.test(l)));
await t.browser.close();
console.log('panels e2e passed');
