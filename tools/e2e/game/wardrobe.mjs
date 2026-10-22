// Fuku-Fuku clothes, the fitting room and the Wardrobe (Release 2 wave A) in the REAL UI at 360 px, English or Arabic (--ar):
//   Chapter 2 opens the shop -> Rin's "Shop for clothes" -> the hoodie in red: in the fitting room the avatar wears it (nothing is bought yet) ->
//   "I will think about it" puts the real avatar back -> a second visit buys it, worn at once -> the Wallet's Wardrobe (groups, Take off / Wear,
//   a colour swatch) -> a reload keeps the outfit and its colour.
// Dev tools are used only for yen and the chapter. Screenshots at 360 px in tools/e2e/shots/game/.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/wardrobe.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, savedGame, start } from './_common.mjs';

const t = await start('wardrobe');
const { page } = t;
const AR = t.arabic;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-12).join('\n'));
    await t.shot('zz-failure').catch(() => {});
    console.error(e);
    process.exit(1);
  });
}
const step = (m) => console.log(`• ${m}`);
const RED = '#d8433f';
const CASH = 20_000;
const HOODIE = 4_990;

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};

/** Closes whatever is in the way: culture pop-ups, story beats (their Continue / the dream picker), a word card, an open sheet. */
async function settle() {
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.cul-scrim .btn.primary').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if ((await screen()) === 'beat') {
      if (await page.locator('[data-ask=dream] [data-choose]').count()) await page.locator('[data-choose]').first().click();
      else if (await page.locator('[data-step=nameKana] [data-save]').count()) await page.locator('[data-step=nameKana] [data-save]').click();
      else if (await page.locator('.qst-beat [data-continue]').count()) await page.locator('.qst-beat [data-continue]').first().click();
      else if (await page.locator('[data-ask=dream] .btn').count()) await page.locator('[data-ask=dream] .btn').last().click();
      else await page.locator('.panel .btn.primary:not(:disabled), .panel [data-step=diary] [data-skip]').last().click().catch(() => {});
    } else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

async function talkTo(id) {
  await settle();
  await go('world');
  await page.evaluate((c) => window.__world.teleportNear(c), 'tanaka');
  await t.sleep(500);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 15000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
}

const charLines = () => page.locator('.msg.char').count();
async function lineAfter(n) {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
}
const chips = async () => (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
async function tap(re) {
  const n = await charLines();
  const texts = await chips();
  const idx = texts.findIndex((x) => re.test(x));
  assert.ok(idx >= 0, `no suggestion matches ${re} among ${texts.join(' | ')}`);
  await page.locator('.sg').nth(idx).click();
  await lineAfter(n);
}
async function say(text) {
  const n = await charLines();
  await page.fill('#say', text);
  await page.locator('.send').click();
  await lineAfter(n);
}
async function openShop() {
  await talkTo('rin');
  await page.waitForSelector('[data-opt=rin_shop], .prep, .convo', { timeout: 15000 });
  if (await page.locator('[data-opt=rin_shop]').count()) await page.locator('[data-opt=rin_shop]').click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
  await t.sleep(400);
}
/** the colour the player avatar's top shows, read from the live game */
const outfit = async () => (await liveGame(page)).outfit;
const check = async (where) => {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
};

step('fresh profile, ¥20,000 and Chapter 2 (Fuku-Fuku opens)');
await onboard(page, { arabic: AR });
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await dev('cash', CASH);
await dev('advance_chapter');
await settle();
assert.equal((await liveGame(page)).chapter.n >= 2, true, 'Chapter 2 is current');

const cash0 = (await liveGame(page)).wallet.cash;
step('the first visit: the hoodie in red; in the fitting room the avatar wears it, nothing is bought');
await openShop();
await say('パーカーをください');
await tap(/サイズ/);
await say('赤');
await tap(/試着/);
await t.sleep(900);
await check('fitting room');
await t.shot('fitting');
let g = await liveGame(page);
assert.equal(g.owned.hoodie, undefined, 'nothing is bought in the fitting room');
assert.deepEqual(g.outfit.equipped, [], 'nothing is worn yet');

step('"I will think about it": the real avatar is back and nothing was bought');
await tap(/ちょうど/);
await t.shot('compliment');
await tap(/考えます/);
await t.sleep(900);
await t.shot('left');
g = await liveGame(page);
assert.equal(g.owned.hoodie, undefined);
assert.equal(g.wallet.cash, cash0, 'nothing was paid');
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(600);
await settle();

step('the second visit buys it: worn at once, exactly ¥4,990 less');
const before = (await liveGame(page)).wallet.cash;
await openShop();
await say('パーカーをください');
await tap(/サイズ/);
await say('赤');
await tap(/試着/);
await tap(/ちょうど/);
await tap(/これ/);
await tap(/現金/);
await page.waitForSelector('.done-card', { timeout: 40000 });
g = await liveGame(page);
assert.equal(before - g.wallet.cash, HOODIE, 'the hoodie costs exactly its price');
assert.equal(g.owned.hoodie?.qty, 1);
assert.deepEqual(g.outfit, { equipped: ['hoodie'], colours: { hoodie: RED } });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(900);
await settle();
await go('world');
await t.sleep(800);
await t.shot('worn');
await check('worn');

step('the Wardrobe in the Wallet: groups, a colour swatch, Take off and Wear');
await go('wallet');
await page.waitForSelector('[data-wardrobe]');
await t.sleep(300);
assert.equal(await page.locator('[data-wardrobe] [data-slot=top]').count(), 1, 'the Tops group');
assert.equal(await page.locator('[data-colours=hoodie] [role=radio]').count(), 6, 'six colours');
assert.equal(await page.locator(`[data-colours=hoodie] [role=radio][aria-checked=true]`).getAttribute('data-colour'), RED);
const small = await page.locator('[data-colours=hoodie] [role=radio]').first().boundingBox();
assert.ok(small && small.width >= 44 && small.height >= 44, 'swatches are 44 px targets');
await t.shot('wardrobe');
await check('wardrobe');
await page.locator('[data-colours=hoodie] [data-colour="#2fb58b"]').click();
await t.sleep(300);
assert.equal((await outfit()).colours.hoodie, '#2fb58b', 'the picked colour is kept');
await page.locator('[data-wear=hoodie]').first().click();
await t.sleep(300);
assert.deepEqual((await outfit()).equipped, [], 'Take off');
await page.locator('[data-wear=hoodie]').first().click();
await t.sleep(300);
assert.deepEqual((await outfit()).equipped, ['hoodie'], 'Wear');
await t.shot('wardrobe-green');

step('a reload keeps the outfit and its colour');
await savedGame(page);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
assert.deepEqual((await outfit()), { equipped: ['hoodie'], colours: { hoodie: '#2fb58b' } });
await go('world');
await t.sleep(800);
await t.shot('reloaded');
await check('reloaded');

console.log('wardrobe e2e: ok');
await t.browser.close();
