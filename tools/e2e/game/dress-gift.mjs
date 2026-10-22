// Release 2 wave A end to end (docs/RELEASE_2.md): dress and gift, in the REAL UI at 360 px, English or Arabic (--ar):
//   Chapter 1: the Fuku-Fuku and Aiko shutters are down -> dev tools: yen and Chapter 2 -> both open ->
//   Fuku-Fuku through the conversation: the T-shirt in blue (price chip, exact charge; in the fitting room the avatar wears it, declined once it is
//   back to the real avatar; bought, it is worn at once), sneakers "not in stock yet" in Chapter 2 (no price, nothing charged) and bought in Chapter 3 ->
//   the Wallet's Wardrobe (Take off / Wear), a reload keeps the outfit -> Aiko's stall: the wagashi for Mio through the conversation (she
//   recommends from Mio's tastes), handed over from the Friends screen: Mio loves it, affinity within the caps ->
//   the render cost at the busiest places. After every step: no horizontal scroll, no console error, wallet = ledger.
// Dev tools are used only for yen and for advancing the chapter. Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/dress-gift.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, savedGame, start } from './_common.mjs';

const t = await start('dress-gift');
const { page } = t;
const AR = t.arabic;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-12).join('\n'));
    await shot('zz-failure').catch(() => {});
    console.error(e);
    process.exit(1);
  });
}
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
/** a screenshot once the conversation's smooth scroll has settled */
const shot = async (n) => {
  await t.sleep(900);
  await t.shot(n);
};
const BLUE = '#4f86f7';
const BLACK = '#2b2b36';

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};
const spec = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__world.player.spec)));
const shopOpen = (id) => page.evaluate((s) => window.__world.isShopOpen(s), id);
const cash = async () => (await liveGame(page)).wallet.cash;

/** After every step: no horizontal scroll, no console error, wallet = ledger (cash + ic = start + earned - spent; each pocket against its checksum). */
async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
  for (const p of ['cash', 'ic', 'points']) assert.equal(g.wallet[p], g.totals.checksum[p], `${where}: ${p} matches its checksum`);
}

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
  await page.evaluate((c) => window.__world.teleportNear(c), id === 'tanaka' ? 'hanako' : 'tanaka');
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
const lastChar = () => page.locator('.msg.char').last().innerText();

/** Walks to a character, presses Talk and (when the sheet lists rows) picks the row; ends on the first line of the conversation. */
async function openConvo(charId, optId, scenarioId) {
  await talkTo(charId);
  await page.waitForSelector(`[data-opt=${optId}], .prep, .convo`, { timeout: 15000 });
  if (await page.locator(`[data-opt=${optId}]`).count()) await page.locator(`[data-opt=${optId}]`).click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
  await t.sleep(400);
  if (scenarioId) assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId ?? null), scenarioId, `the ${scenarioId} conversation`);
}
/** The done card, the debrief and back to the world. */
async function finish() {
  await page.waitForSelector('.done-card', { timeout: 40000 });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card, .dbf-card', { timeout: 25000 });
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(900);
  await settle();
  await go('world');
  await t.sleep(600);
}
/** The clothes order up to the fitting room: the piece, its size chip, the colour, "may I try it on". */
async function clothesToFitting(ja, colourJa) {
  await say(ja);
  await tap(/サイズ/);
  await say(colourJa);
  await tap(/試着/);
  await t.sleep(900);
}

// ---- 1. a fresh profile, Chapter 1: the shutters are down -------------------------------------------------------------------
step('fresh profile, Chapter 1: Fuku-Fuku and Aiko are shuttered');
await onboard(page, { arabic: AR });
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await settle();
if (await page.locator('.tip .btn').count()) await page.locator('.tip .btn').first().click();
await t.sleep(300);
const base = await spec();
assert.equal((await liveGame(page)).chapter.n, 1);
assert.equal(await shopOpen('fukufuku'), false, 'Fuku-Fuku is shut in Chapter 1');
assert.equal(await shopOpen('aiko'), false, "Aiko's stall is shut in Chapter 1");
await page.evaluate(() => window.__world.teleportNear('rin'));
await t.sleep(1200);
await shot('1-fuku-shut');
await page.evaluate(() => window.__world.teleportNear('aiko'));
await t.sleep(1200);
await shot('1-aiko-shut');
await check('chapter 1');

// ---- 2. Chapter 2 opens both -------------------------------------------------------------------------------------------------
step('dev tools: ¥20,000 and Chapter 2 -> both open');
await dev('cash', 20_000);
await dev('advance_chapter');
await settle();
await go('world');
assert.equal((await liveGame(page)).chapter.n, 2, 'Chapter 2 is current');
assert.equal(await shopOpen('fukufuku'), true, 'Fuku-Fuku opens in Chapter 2');
assert.equal(await shopOpen('aiko'), true, "Aiko's stall opens in Chapter 2");
await page.evaluate(() => window.__world.teleportNear('rin'));
await t.sleep(1500);
await shot('2-fuku-open');
await page.evaluate(() => window.__world.teleportNear('aiko'));
await t.sleep(1500);
await shot('2-aiko-open');
await check('chapter 2');

// ---- 3. Fuku-Fuku: try on, decline ------------------------------------------------------------------------------------------
step('Fuku-Fuku: the T-shirt in blue; in the fitting room the avatar wears it; declined, the real avatar is back');
const cash0 = await cash();
await openConvo('rin', 'rin_shop', 'fuku_clothes');
await shot('3-fuku-greet');
await clothesToFitting('Tシャツをください', '青');
assert.equal((await spec()).top, BLUE, 'in the fitting room the avatar wears the blue T-shirt');
assert.equal(await page.locator('[data-fitting]').count(), 1, 'the fitting mirror shows');
await check('fitting room');
await shot('3-fitting');
let g = await liveGame(page);
assert.equal(g.owned.tee_basic, undefined, 'nothing is bought in the fitting room');
await tap(/ちょうど/);
assert.equal((await spec()).top, BLUE, 'Rin compliments the fit with the shirt still on');
await shot('3-compliment');
await tap(/考えます/);
await page.waitForSelector('.done-card', { timeout: 40000 });
await t.sleep(700);
assert.equal((await spec()).top, base.top, 'declined: the real avatar is back');
assert.equal(await page.locator('[data-fitting]').count(), 0, 'the mirror is gone');
g = await liveGame(page);
assert.equal(g.owned.tee_basic, undefined);
assert.equal(g.wallet.cash, cash0, 'nothing was paid');
await finish();
assert.equal((await spec()).top, base.top, 'still the real avatar in the world');
await check('declined');

// ---- 4. the T-shirt bought --------------------------------------------------------------------------------------------------
step('Fuku-Fuku: the T-shirt bought, exactly ¥1,990, worn at once');
const before = await cash();
await openConvo('rin', 'rin_shop', 'fuku_clothes');
await clothesToFitting('Tシャツをください', '青');
await tap(/ちょうど/);
await tap(/これ/);
await page.waitForSelector('.dbf-price', { timeout: 10000 });
assert.ok(await page.locator('.dbf-price[data-price="1990"]').count(), 'the price chip says 1,990');
await check('price chip');
await shot('4-price-chip');
await tap(/現金/);
await page.waitForSelector('.done-card', { timeout: 40000 });
g = await liveGame(page);
assert.equal(before - g.wallet.cash, 1990, 'the T-shirt costs exactly ¥1,990');
assert.equal(g.owned.tee_basic?.qty, 1);
assert.deepEqual(g.outfit, { equipped: ['tee_basic'], colours: { tee_basic: BLUE } });
await finish();
assert.equal((await spec()).top, BLUE, 'worn at once');
await shot('4-worn');
await check('T-shirt bought');

// ---- 5. sneakers: not in stock in Chapter 2, said at once -----------------------------------------------------------------------
step('Fuku-Fuku: sneakers are not in stock in Chapter 2 (said at once, no price, nothing charged)');
const cashChap2 = await cash();
await openConvo('rin', 'rin_shop', 'fuku_clothes');
await say('スニーカーをください');
const refusal = await lastChar();
assert.ok(/入荷|in stock|ليس لدينا/i.test(refusal), `a polite "not in stock yet": ${refusal}`);
assert.ok(!refusal.includes('…'), `no empty price in the line: ${refusal}`);
await shot('5-sneakers-refused');
g = await liveGame(page);
assert.equal(g.owned.sneakers, undefined, 'no sneakers yet');
assert.equal(g.wallet.cash, cashChap2, 'nothing was charged');
await check('sneakers refused');
await say('またきます');
await finish();
assert.equal((await spec()).shoes, base.shoes, 'the real shoes are back');

// ---- 6. Chapter 3: the sneakers -----------------------------------------------------------------------------------------------
step('Chapter 3: sneakers bought, exactly ¥7,990, worn at once');
await dev('advance_chapter');
await settle();
await go('world');
assert.equal((await liveGame(page)).chapter.n, 3);
const before2 = await cash();
await openConvo('rin', 'rin_shop', 'fuku_clothes');
await clothesToFitting('スニーカーをください', '黒');
assert.equal((await spec()).shoes, BLACK, 'the fitting room shows black sneakers');
assert.equal((await spec()).top, BLUE, 'over the T-shirt already worn');
await tap(/ちょうど/);
await tap(/これ/);
await tap(/現金/);
await page.waitForSelector('.done-card', { timeout: 40000 });
g = await liveGame(page);
assert.equal(before2 - g.wallet.cash, 7990, 'the sneakers cost exactly ¥7,990');
assert.deepEqual(g.outfit.equipped, ['tee_basic', 'sneakers']);
await finish();
assert.equal((await spec()).shoes, BLACK, 'sneakers worn at once');
await go('world');
await shot('6-outfit-street');
await check('sneakers bought');

// ---- 7. the Wardrobe ----------------------------------------------------------------------------------------------------------
step('the Wallet wardrobe: Take off and Wear, then a reload keeps the outfit');
await go('wallet');
await page.waitForSelector('[data-wardrobe]');
await t.sleep(300);
await shot('7-wardrobe');
await check('wardrobe');
await page.locator('[data-wear=tee_basic]').first().click();
await t.sleep(400);
assert.deepEqual((await liveGame(page)).outfit.equipped, ['sneakers'], 'Take off');
assert.equal((await spec()).top, base.top, 'the T-shirt is off the avatar');
await page.locator('[data-wear=tee_basic]').first().click();
await t.sleep(400);
assert.deepEqual((await liveGame(page)).outfit.equipped.sort(), ['sneakers', 'tee_basic'], 'Wear');
assert.equal((await spec()).top, BLUE);
await savedGame(page);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1800);
g = await liveGame(page);
assert.deepEqual(g.outfit.equipped.sort(), ['sneakers', 'tee_basic']);
assert.equal((await spec()).top, BLUE, 'reload: T-shirt on');
assert.equal((await spec()).shoes, BLACK, 'reload: sneakers on');
await check('after reload');

// ---- 8. Aiko's stall ----------------------------------------------------------------------------------------------------------
step("Aiko's stall: the hint of c3_3 names her, then the wagashi for Mio through the conversation");
await go('quests');
await page.waitForSelector('[data-obj=c3_3]');
const hint = await page.locator('[data-obj=c3_3]').innerText();
assert.ok(AR ? /أيكو/.test(hint) : /Aiko/.test(hint), `the c3_3 hint names Aiko: ${hint}`);
await go('world');
const before3 = await cash();
await openConvo('aiko', 'aiko_shop', 'aiko_tea');
await shot('8-aiko-greet');
await say('和菓子をください');
await say('ミオさんにあげます');
const rec = await lastChar();
assert.ok(/和菓子|wagashi|الواغاشي/i.test(rec), `the recommendation is the wagashi: ${rec}`);
await shot('8-aiko-recommends');
await tap(/これで/);
await say('赤をお願いします');
await page.waitForSelector('.dbf-price[data-price="1280"]', { timeout: 10000 });
await check('aiko quote');
await shot('8-aiko-quote');
await tap(/現金/);
await page.waitForSelector('.done-card', { timeout: 40000 });
g = await liveGame(page);
assert.equal(before3 - g.wallet.cash, 1280, 'the wagashi cost exactly ¥1,280');
assert.equal(g.owned.g_wagashi?.qty, 1);
await finish();
await check('wagashi bought');

step('Friends: hand the wagashi to Mio, she loves it (affinity within the caps)');
await go('world');
await t.sleep(400);
await page.locator('.icon-btn.glass[aria-expanded]').first().click();
await page.locator('[data-menu=friends]').click();
await page.waitForSelector('[data-screen=friends]');
if (!(await page.locator('[data-card=mio]').count())) await page.locator('[data-friend=mio] .frd-head').click();
await page.locator('[data-friend=mio] [data-act=gift]').click();
await page.waitForSelector('[data-gift-sheet] [data-item=g_wagashi]');
await page.locator('[data-item=g_wagashi]').click();
await t.sleep(500);
await assertNoHScroll(page, 'gift sheet');
await shot('9-gift-sheet');
const ap0 = (await liveGame(page)).friends.mio?.ap ?? 0;
await page.locator('[data-act=hand-over]').click();
await page.waitForSelector('.convo', { timeout: 30000 });
await page.waitForSelector('.sg', { timeout: 30000 });
assert.ok(/和菓子/.test((await chips())[0]), 'the hand-over chips name the wagashi');
for (let k = 0; k < 40 && !(await page.locator('.done-card').count()); k++) {
  if (await page.locator('.sg').count()) await tap(/./).catch(() => {});
  else await t.sleep(400);
}
await page.waitForSelector('.done-card', { timeout: 30000 });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('[data-gift-reaction=loved]', { timeout: 25000 });
await page.locator('[data-gift-reaction]').scrollIntoViewIfNeeded();
await shot('9-gift-reaction');
await assertNoHScroll(page, 'gift reaction');
g = await liveGame(page);
const gained = g.friends.mio.ap - ap0;
assert.equal(g.owned.g_wagashi, undefined, 'the wagashi is used up');
assert.equal(g.stats.gifts.loved, 1, 'Mio loved it');
assert.ok(gained > 0 && gained <= 30, `affinity within the gift caps: +${gained}`);
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(700);
await settle();
await check('gift handed over');

// ---- 10. render cost ----------------------------------------------------------------------------------------------------------
step('render cost at the busiest places');
await go('world');
let worst = { calls: 0, triangles: 0, at: '' };
for (const id of ['kenji', 'tanaka', 'mio', 'rin', 'aiko', 'sato', 'aoi', 'nakamura', 'yuki', 'hanako']) {
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await t.sleep(1500);
  const c = await page.evaluate(() => {
    const r = window.__world.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  });
  console.log(`  render at ${id}: ${c.calls} calls / ${c.triangles} triangles`);
  if (c.triangles > worst.triangles) worst = { ...worst, triangles: c.triangles, at: id };
  if (c.calls > worst.calls) worst = { ...worst, calls: c.calls };
}
console.log(`WORST FRAME: ${worst.calls} calls / ${worst.triangles} triangles (at ${worst.at})`);
assertNoConsoleErrors(t.logs);

console.log(`dress-gift e2e${AR ? ' (ar)' : ''}: ok`);
await t.browser.close();
