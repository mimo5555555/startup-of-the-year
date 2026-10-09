// The big purchases (docs/GAME_DESIGN.md §5.5, §6.3, docs/RELEASE_1.md; agent 3F-lite) through the REAL conversations at 360 px, English or Arabic (--ar):
// dev tools give cash and move the story (cash and chapters are the only shortcuts), then every purchase is made by tapping the suggestions:
//   Chapter 4: Hikari Denki, a refurbished phone (¥24,800) -> exact charge, inventory, the HUD phone icon and the Phone/Messages menu entry appear
//   Free Walk: Nakamura Motors, the visit, a bicycle (¥19,800 + the ¥600 registration) -> the bike mesh is under the player and the speed is x1.5,
//              the helmet (¥2,980) -> the wardrobe puts it on the avatar, the used kei car (drive-away price, one haggle) -> the car mesh and x2.5
// and the Wallet screen shows the balances, "what you own" with its item card, the wardrobe and the receipts with the work-hours chip.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/shops.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('shops');
const { page } = t;
const AR = t.arabic;
const DEBUG = !!process.env.DEBUG;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-12).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const owned = async (id) => (await liveGame(page)).owned[id]?.qty ?? 0;
const fmt = (n) => `¥${n.toLocaleString('en-US')}`;

/** Closes whatever is in the way: culture popups, story beats, an open sheet. */
async function settle() {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.cul-scrim').count()) {
      await page.locator('.cul-scrim .btn.primary').click();
      await t.sleep(250);
    } else if ((await screen()) === 'beat') {
      await skipBeats(page);
    } else if (await page.locator('.hud-sheet').count()) {
      await page.keyboard.press('Escape');
      await t.sleep(300);
    } else return;
  }
  throw new Error('overlays did not clear');
}

const dev = (ev) => page.evaluate((e) => window.__lw.dispatch(e), ev);

/** Walks next to a character (stepping away first: the world only reports a change of "who is near") and presses Talk. */
async function talkTo(id) {
  await settle();
  await page.evaluate(() => window.__world.teleportNear('tanaka'));
  await t.sleep(600);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 10000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
}

const charLines = () => page.locator('.msg.char').count();
async function lineAfter(n) {
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k && !document.querySelector('.bubble.typing'), n, { timeout: 30000 });
  await t.sleep(250);
}

/**
 * Plays a conversation by tapping suggestions only. `plan` is a list of patterns (RegExp over the suggestion's Japanese, spaces removed);
 * each step taps the first suggestion that matches the next pattern, then any suggestion (the first) once the plan is used up.
 */
async function drive(plan) {
  let next = 0;
  for (let step = 0; step < 40; step++) {
    await page.waitForSelector('.sg, .done-card', { timeout: 30000 });
    if (await page.locator('.done-card').count()) return;
    const texts = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
    const want = plan[next];
    const idx = want ? texts.findIndex((x) => want.test(x)) : 0;
    if (DEBUG) console.log(`   step ${step}: [${texts.join(' | ')}] want ${want} -> ${idx}`);
    assert.ok(idx >= 0, `no suggestion matches ${want} among ${texts.join(' | ')}`);
    if (want) next++;
    const n = await charLines();
    await page.locator('.sg').nth(idx).click();
    await Promise.race([lineAfter(n), page.waitForSelector('.done-card', { timeout: 30000 })]);
  }
  throw new Error('the conversation did not end');
}

/** Skips Prepare when it comes first (the soft pocket practice), plays the plan and leaves through the debrief; returns the receipt's price chip. */
async function converse(plan) {
  await page.waitForSelector('.prep, .convo', { timeout: 20000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 20000 });
  await t.sleep(500);
  await drive(plan);
  const shownPrice = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-price]')];
    return els.length ? Number(els[els.length - 1].getAttribute('data-price')) : null;
  });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 20000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  await settle();
  return shownPrice;
}

/** The wallet and the ledger ids before a conversation (the conversation also pays the player for speaking, so the wallet moves by the ledger's sum). */
const snap = async () => {
  const g = await liveGame(page);
  return { cash: g.wallet.cash, ids: new Set(g.ledger.map((e) => e.id)) };
};

/** The exact spend of the last purchase: the ledger entry is the price, the wallet moved by the sum of the new cash entries, the inventory has the item. */
async function assertCharge(before, itemId, expected, what) {
  const g = await liveGame(page);
  const fresh = g.ledger.filter((x) => !before.ids.has(x.id) && x.pocket === 'cash');
  const e = fresh.find((x) => x.kind === 'purchase' && x.ref === itemId);
  assert.ok(e, `${what}: a purchase entry for ${itemId} is in the ledger`);
  assert.equal(-e.delta, expected, `${what}: charged exactly ${fmt(expected)}`);
  assert.equal(fresh.filter((x) => x.kind === 'purchase').length, 1, `${what}: exactly one purchase`);
  assert.equal(g.wallet.cash - before.cash, fresh.reduce((n, x) => n + x.delta, 0), `${what}: the wallet moved by the ledger's sum`);
  assert.ok(g.wallet.cash - before.cash < 0 && before.cash - g.wallet.cash <= expected, `${what}: it fell by the price less what the conversation paid`);
  assert.equal(g.owned[itemId]?.qty, 1, `${what}: ${itemId} is in the inventory`);
  return e;
}

/** A picture of the player in the street (the first-visit tip is dismissed, and the player stands away from the shop fronts so the camera sees the ride). */
async function streetShot(name) {
  await settle();
  await page.locator('.tip .btn').click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => window.__world.teleportNear('tanaka'));
  await t.sleep(1800);
  await t.shot(name);
}

const world = (fn, arg) => page.evaluate(fn, arg);
const rideInScene = (kind) => world((k) => !!window.__world.scene.getObjectByName(`ride-${k}`), kind);

// ---------------------------------------------------------------------------------------------------------------
t.step('fresh profile, dev tools: cash and the story to Chapter 4 (the only shortcuts)');
await onboard(page, { arabic: AR, name: 'Sam' });
await settle();
await dev({ t: 'profile_set', dev: true });
await dev({ t: 'dev', cmd: 'cash', amount: 400_000 });
for (let i = 0; i < 3; i++) {
  await dev({ t: 'dev', cmd: 'advance_chapter' });
  await t.sleep(300);
  await settle();
}
let g = await liveGame(page);
assert.equal(g.chapter.n, 4, 'Chapter 4');
assert.equal(await world(() => window.__world.isShopOpen('denki')), true, 'Hikari Denki is open in Chapter 4');
assert.equal(await world(() => window.__world.isShopOpen('motors')), false, 'Nakamura Motors is still shut in Chapter 4');
assert.equal(await page.locator('.hud-phone').count(), 0, 'no phone icon before the phone');
assert.equal(await world(() => window.__world.getRide()), null, 'no ride yet');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 1, 'normal speed');
await t.shot('01-chapter4');

// ---------------------------------------------------------------------------------------------------------------
t.step('Hikari Denki: a refurbished phone, bought by tapping (cash, black)');
let before = await snap();
await talkTo('aoi');
await converse([/スマホ.*ほしい/, /中古.*スマホ.*ください/, /黒/, /これ.*ください/, /現金/, /です。/, /はい/]);
await assertCharge(before, 'phone_used', 24_800, 'phone');
g = await liveGame(page);
assert.equal(g.stats.purchases >= 1, true, 'counted as a conversation purchase');
await settle();
await t.sleep(500);
assert.equal(await page.locator('.hud-phone').count(), 1, 'the HUD phone icon appears');
await assertNoHScroll(page, 'world with the phone icon');
await t.shot('02-phone-hud');
await page.locator('.icon-btn.glass').first().click();
await page.waitForSelector('[data-menu]');
assert.equal(await page.locator('[data-menu="phone"]').count(), 1, 'the menu lists Phone (Messages)');
await t.shot('03-menu');
await page.locator('.icon-btn.glass').first().click();
await t.sleep(300);

// ---------------------------------------------------------------------------------------------------------------
t.step('Free Walk: Nakamura Motors opens');
await dev({ t: 'dev', cmd: 'advance_chapter' });
await t.sleep(400);
await settle();
g = await liveGame(page);
assert.equal(g.chapter.n, 9, 'Free Walk');
assert.equal(await world(() => window.__world.isShopOpen('motors')), true, 'Nakamura Motors is open');

t.step('Nakamura Motors: the visit first (it opens the bicycle)');
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_visit], .prep, .convo', { timeout: 15000 });
if (await page.locator('[data-opt=nakamura_visit]').count()) {
  await t.shot('04-nakamura-sheet');
  await assertNoHScroll(page, 'Nakamura sheet');
  await page.locator('[data-opt=nakamura_visit]').click();
}
await converse([/こんにちは/, /いくら/, /ちょっと|難しい/]);

t.step('Nakamura Motors: the bicycle (¥19,800 + ¥600 registration), the ride appears and the speed is x1.5');
before = await snap();
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_bike]', { timeout: 15000 });
await page.locator('[data-opt=nakamura_bike]').click();
await converse([/自転車.*ほしい/, /通学|買い物|仕事|散歩|運動/, /ママチャリ.*ください/, /これ.*ください/, /です。/, /桜町/, /現金/, /はい/]);
await assertCharge(before, 'bike_mamachari', 19_800 + 600, 'bicycle (with the registration)');
await settle();
await t.sleep(600);
assert.equal(await world(() => window.__world.getRide()), 'bike', 'ride = bike');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 1.5, 'speed x1.5');
assert.equal(await rideInScene('bike'), true, 'the bicycle mesh is in the scene under the player');
await streetShot('05-on-the-bike');

t.step('Nakamura Motors: the helmet (¥2,980), no registration, then the wardrobe puts it on the avatar');
before = await snap();
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_bike]', { timeout: 15000 });
await page.locator('[data-opt=nakamura_bike]').click();
await converse([/自転車.*ほしい/, /通学|買い物|仕事|散歩|運動/, /ヘルメット.*ください/, /これ.*ください/, /です。/, /桜町/, /現金/, /はい/]);
await assertCharge(before, 'bike_helmet', 2_980, 'helmet');
const accBefore = await world(() => window.__world.player.spec.accessories);
assert.equal(accBefore.includes('helmet'), false, 'not worn until the player puts it on');

// ---------------------------------------------------------------------------------------------------------------
t.step('Wallet screen: balances, what you own, the item card and the wardrobe');
await page.locator('.hud-wallet').click();
await page.waitForSelector('[data-screen="wallet"]');
await t.sleep(400);
g = await liveGame(page);
const cashText = await page.locator('[data-pocket="cash"] strong').innerText();
assert.equal(Number(cashText.replace(/[^\d]/g, '')), g.wallet.cash, 'the cash on the screen is the wallet');
for (const id of ['phone_used', 'bike_mamachari', 'bike_helmet']) assert.equal(await page.locator(`[data-owned="${id}"]`).count(), 1, `${id} is in "what you own"`);
assert.equal(await page.locator('[data-wardrobe]').count(), 1, 'the wardrobe exists because a helmet is owned');
await assertNoHScroll(page, 'wallet: my things');
await t.shot('06-wallet-things');
await page.locator('[data-owned="bike_mamachari"]').click();
await page.waitForSelector('.wlt-card');
assert.ok((await page.locator('.wlt-card').innerText()).includes('1.5'), 'the bicycle card says speed x1.5');
await assertNoHScroll(page, 'item card');
await t.sleep(500);
await t.shot('07-item-card');
await page.keyboard.press('Escape');
await t.sleep(300);
await page.locator('[data-wear="bike_helmet"]').first().click();
await t.sleep(700);
g = await liveGame(page);
assert.deepEqual(g.outfit.equipped, ['bike_helmet'], 'the helmet is equipped in the game state');
assert.equal(await page.locator('.wlt-wear.on').count(), 1, 'the switch shows it is on');
await t.shot('08-wardrobe-on');
await page.locator('[data-tab="receipts"]').click();
await page.waitForSelector('[data-pane="receipts"]');
if (await page.locator('.wlt-receipts > .btn').count()) await page.locator('.wlt-receipts > .btn').click();
assert.ok((await page.locator('[data-receipt]').count()) >= 3, 'the three purchases are receipts');
assert.ok((await page.locator('.wlt-hours').count()) >= 1, 'the work-hours chip shows on the big purchases');
await page.locator('[data-receipt]').first().click();
await page.waitForSelector('[data-slip]');
await assertNoHScroll(page, 'wallet: receipts');
await t.shot('09-wallet-receipts');
await page.locator('.panel-head .icon-btn').click();
await page.waitForFunction(() => window.__lw.useStore.getState().screen === 'world');
await t.sleep(900);
assert.equal(await world(() => window.__world.player.spec.accessories.includes('helmet')), true, 'the avatar wears the helmet in the world');
await streetShot('10-helmet-in-world');

// ---------------------------------------------------------------------------------------------------------------
t.step('Nakamura Motors: the used kei car (drive-away price, one haggle), the car mesh and x2.5');
before = await snap();
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_car]', { timeout: 15000 });
await page.locator('[data-opt=nakamura_car]').click();
const said = await converse([/軽自動車.*見たい/, /中古.*軽自動車.*見たい/, /いくら/, /乗り出し価格/, /安く/, /これ.*ください|ありがとう/, /です。/, /です。/, /現金/]);
g = await liveGame(page);
const car = [...g.ledger].reverse().find((x) => x.kind === 'purchase' && x.ref === 'car_kei_used');
assert.ok(car, 'the car purchase is in the ledger');
assert.equal(-car.delta <= 198_000 && -car.delta >= 198_000 - 20_000, true, `the car cost the drive-away price or a bounded haggle below it (${fmt(-car.delta)})`);
if (said) assert.equal(-car.delta, said, 'the price shown under the clerk is the price charged');
assert.equal(g.wallet.cash - before.cash, g.ledger.filter((x) => !before.ids.has(x.id) && x.pocket === 'cash').reduce((n, x) => n + x.delta, 0), "the wallet moved by the ledger's sum");
assert.equal(g.owned.car_kei_used?.qty, 1, 'the car is in the inventory');
await t.sleep(700);
assert.equal(await world(() => window.__world.getRide()), 'car', 'ride = car (the best ride wins)');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 2.5, 'speed x2.5');
assert.equal(await rideInScene('car'), true, 'the car mesh is in the scene');
assert.equal(await rideInScene('bike'), false, 'the bicycle mesh is gone');
await streetShot('11-in-the-car');

t.step('the game remembers: reload keeps the things, the ride and the speed');
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw?.useGame?.getState().hydrated, null, { timeout: 60000 });
await t.sleep(1500);
await settle();
assert.equal(await world(() => window.__world.getRide()), 'car');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 2.5);
assert.equal(await world(() => window.__world.player.spec.accessories.includes('helmet')), true, 'the helmet is still on after the reload');
await assertNoHScroll(page, 'world after reload');
await page.locator('.hud-wallet').click();
await page.waitForSelector('[data-screen="wallet"]');
assert.equal(await page.locator('[data-owned="car_kei_used"]').count(), 1);
await t.shot('12-wallet-final');

assertNoConsoleErrors(t.logs);
console.log(`shops e2e ok${AR ? ' (Arabic)' : ''}`);
await t.browser.close();
