// The first full game loop (docs/GAME_DESIGN.md §15.4 acceptance) on a fresh profile in the REAL UI, at 360 px, English or Arabic (--ar):
// opening beat (real StoryBeat, katakana-name step) -> ¥3,000 -> Greetings lesson (objective ticks) -> konbini Prepare (study + recall) ->
// buy an onigiri by conversation (wallet down by exactly its price, the loop pay credited) -> compact debrief (stars, ONE pay line, hidden-line
// echo) -> reload keeps the state -> IC card + top-up at the station -> vending panel -> ramen ticket (world.simulatePick('ramen_machine'), the
// machine prop arrives in slice 3) -> a short-of-cash branch -> Chapter 1 completes (+¥2,500) -> the closing beat opens the Dream picker ->
// Chapter 2 is current and Fuku-Fuku's shutter opens -> daily goals appear. No dev tools are needed (Chapter 1 completes the moment
// its last objective does). Screenshots at 360 px in tools/e2e/shots/game/.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/game-loop.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, savedGame, start } from './_common.mjs';

const t = await start('loop');
const { page } = t;
const AR = t.arabic;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.log('state at the failure:', JSON.stringify(await page.evaluate(() => { const g = window.__lw.getGame(); return { wallet: g.wallet, sayNew: g.stats.sayNew, said: g.words.said, ledger: g.ledger.slice(-3) }; }).catch(() => null)));
  console.error(e);
  process.exit(1);
});

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const text = (sel) => page.locator(sel).first().innerText();
const digits = (s) => Number(String(s).replace(/[^\d]/g, '') || 0);

/** Waits until the clerk has said one more line (the typing dots are gone). */
async function lineAfter(n) {
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k && !document.querySelector('.bubble.typing'), n, { timeout: 30000 });
  await t.sleep(250);
}
const charLines = () => page.locator('.msg.char').count();
const tap = async (i) => {
  const n = await charLines();
  await page.locator('.sg').nth(i).click();
  await lineAfter(n);
};
const type = async (s) => {
  const n = await charLines();
  await page.fill('#say', s);
  await page.locator('.send').click();
  await lineAfter(n);
};

/** Closes word cards, then the panel itself. */
async function closeWordCards() {
  while (await page.locator('.word-scrim .word-close').count()) {
    await page.locator('.word-scrim .word-close').last().click();
    await t.sleep(250);
  }
}

/** Leaves the finished conversation: done card -> debrief; returns what the debrief showed. */
async function finishToDebrief() {
  await page.waitForSelector('.done-card', { timeout: 30000 });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 15000 });
  await t.sleep(400);
}
async function leaveDebrief() {
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(500);
  // a beat (the closing one) may follow
}

/** Walks to a character (stepping away first: the world only reports a change of "who is near") and presses Talk. */
async function talkTo(id) {
  await page.evaluate(() => window.__world.teleportNear('tanaka'));
  await t.sleep(600);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await t.sleep(1000);
  await page.locator('.talk-btn').click();
  await t.sleep(500);
}

// ---------------------------------------------------------------------------------------------------------------------
t.step('fresh profile: onboarding -> world, opening beat plays by itself');
await onboard(page, { arabic: AR, name: 'Sam' });
await page.waitForSelector('[data-beat="b_ch1_open"]', { timeout: 30000 });
await t.sleep(500);
assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr', 'document direction');
const g0 = await liveGame(page);
assert.equal(g0.wallet.cash, 3000, 'wallet starts at ¥3,000');
assert.equal(g0.seeded, true);
assert.equal(g0.chapter.n, 1);
assert.equal(await page.evaluate(() => window.__world.isShopOpen('fukufuku')), false, "Fuku-Fuku's shutter is down in Chapter 1");
assert.ok((await text('.qst-beat-name')).includes('花子'), 'Hanako speaks the opening beat');
await assertNoHScroll(page, 'opening beat');
await t.shot('01-beat');
for (let n = 1; n < 4; n++) {
  await page.locator('.qst-beat [data-continue]').click();
  await t.sleep(250);
}
await page.locator('.qst-beat [data-continue]').click();
await page.waitForSelector('[data-step=nameKana]');
const kana = await page.locator('[data-step=nameKana] input').inputValue();
assert.match(kana, /^[゠-ヿ]+$/, `the katakana step is pre-filled with the name in katakana (${kana})`);
await assertNoHScroll(page, 'katakana step');
await t.shot('02-kana');
await page.locator('[data-step=nameKana] [data-save]').click();
await t.sleep(700);
assert.equal((await liveGame(page)).me.nameKana, kana, 'me.nameKana is stored');
assert.equal(await screen(), 'world');
await page.locator('.tip .btn').click({ timeout: 4000 }).catch(() => {});
await t.sleep(300);

t.step('HUD: wallet pill ¥3,000 and the tracker on the Greetings lesson');
assert.ok((await text('.hud-wallet')).includes('¥3,000') || digits(await text('.hud-wallet')) === 3000, `wallet pill: ${await text('.hud-wallet')}`);
assert.match(await text('.hud-track .next-text strong'), AR ? /التحيات/ : /Greetings lesson/);
await assertNoHScroll(page, 'world HUD');
await t.shot('03-hud');

// ---- the Greetings lesson ticks objective 1 ------------------------------------------------------------------------
t.step("Hanako's Greetings lesson ticks objective 1");
await talkTo('hanako');
await page.waitForSelector('.lesson, [data-opt=lesson_greetings]');
if (await page.locator('[data-opt=lesson_greetings]').count()) {
  await t.shot('04-sheet');
  await assertNoHScroll(page, 'interaction sheet');
  await page.locator('[data-opt=lesson_greetings]').click();
}
await page.waitForSelector('.lesson .btn.primary');
const startH = await page.locator('.lesson .btn.primary').evaluate((el) => el.getBoundingClientRect().height);
assert.ok(startH >= 44 && startH < 90, `the Start lesson button is a normal button, not a full-height slab (${Math.round(startH)} px)`);
await t.shot('04-lesson-intro');
await page.locator('.lesson .btn.primary').click();
for (let guard = 0; guard < 40 && !(await page.locator('.lesson .done-badge').count()); guard++) {
  const option = page.locator('.lesson .option:not([disabled])').first();
  if (await option.count()) await option.click();
  const say = page.locator('.lesson input.say');
  if (await say.count()) {
    await say.fill('x');
    await page.locator('.lesson .send').click();
  }
  await page.locator('.lesson .panel-foot .btn.primary').click();
  await t.sleep(120);
}
await page.waitForSelector('.lesson .done-badge');
await page.locator('.lesson .center-col .btn.primary').click();
await t.sleep(600);
await go('quests');
await page.waitForSelector('[data-screen=quests]');
assert.equal(await page.locator('[data-obj=c1_1]').getAttribute('data-done'), '1', 'objective 1 is ticked');
await assertNoHScroll(page, 'quests');
await t.shot('05-quests-ticked');
await go('world');
await t.sleep(400);

// ---- konbini Prepare: study + recall --------------------------------------------------------------------------------
t.step('konbini: Talk opens Prepare (study the four lines, then recall them with the Japanese hidden)');
await talkTo('tanaka');
await page.waitForSelector('.prep[data-stage="study"]', { timeout: 15000 });
await assertNoHScroll(page, 'prepare study');
await t.shot('06-prepare-study');
for (let i = 0; i < 3; i++) await page.locator('.prep-foot .btn.primary').click();
await t.sleep(200);
await page.locator('.prep-foot .btn.primary').click(); // Test yourself
await page.waitForSelector('.prep[data-stage="recall"]');
assert.equal(await page.locator('.prep-say .ja').count(), 0, 'the Japanese is hidden in the recall');
await t.shot('07-prepare-recall');
const submit = async (s) => {
  await page.fill('.prep-input', s);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.prep-verdict.ok');
};
await submit('kore o kudasai');
await page.locator('.prep-foot .btn.primary').click();
await page.waitForSelector('.prep-hidden');
await submit('いくらですか');
await page.locator('.prep-foot .btn.primary').click();
await page.waitForSelector('.prep-hidden');
await submit('ふくろはいりません');
await page.locator('.prep-foot .btn.primary').click();
await page.waitForSelector('.prep-hidden');
await page.locator('.prep-say .prep-link').click();
await page.waitForSelector('.prep-tile');
for (const piece of ['カード', 'で', 'お願いします。']) await page.locator('.prep-tiles .prep-tile', { hasText: new RegExp(`^${piece}$`) }).click();
await page.waitForSelector('.prep-verdict.ok');
await page.locator('.prep-foot .btn.primary').click(); // See results
await page.waitForSelector('.prep[data-stage="done"]');
await page.waitForSelector('.prep-card[data-ready="1"]');
let g = await liveGame(page);
for (const id of ['p_konbini_1', 'p_konbini_2', 'p_konbini_3', 'p_konbini_4']) assert.equal(g.prep[id]?.s, 'ready', `${id} is ready after the recall`);
await assertNoHScroll(page, 'prepare done');
await t.shot('08-prepare-ready');

// ---- buy an onigiri ---------------------------------------------------------------------------------------------------
t.step('buy an onigiri by conversation: ¥160 leaves the wallet, the loop pay arrives');
const cashBefore = (await liveGame(page)).wallet.cash;
await page.locator('.prep-foot .btn.primary').click(); // Start
await page.waitForSelector('.convo', { timeout: 15000 });
await lineAfter(0);
await tap(0); // おにぎりはありますか
await tap(0); // これをください  -> the clerk names the total
await page.waitForSelector('.dbf-price');
const priceChip = digits(await text('.dbf-price'));
assert.equal(priceChip, 160, `the price chip shows the clerk's total (${priceChip})`);
await assertNoHScroll(page, 'conversation with a price chip');
await t.shot('09-convo-price-chip');
await tap(0); // いいえ、大丈夫です (no bag)
await tap(1); // cash
await page.waitForSelector('.done-card', { timeout: 30000 });
g = await liveGame(page);
assert.equal(g.wallet.cash, cashBefore - 160, 'the wallet fell by exactly the price');
const purchase = g.ledger.filter((e) => e.kind === 'purchase' && e.pocket === 'cash'); // (the konbini point is a separate points entry)
assert.equal(purchase.length, 1);
assert.equal(purchase[0].delta, -160);
await t.shot('10-convo-done');
await finishToDebrief();

t.step('compact debrief: stars, ONE pay line, hidden-line echo');
assert.ok(await page.locator('.dbf-stars').count(), 'stars row');
assert.equal(await page.locator('.dbf-payline').count(), 1, 'one pay line in the compact debrief');
const payLine = digits(await text('.dbf-payline strong'));
g = await liveGame(page);
const loop = g.ledger.filter((e) => e.kind === 'loop');
assert.ok(loop.length >= 1, 'a loop entry in the ledger');
assert.equal(payLine, g.totals.earned, 'the debrief pay line is the ledger');
assert.equal(g.wallet.cash, cashBefore - 160 + g.totals.earned, 'wallet = before - price + the loop pay');
assert.ok(payLine > 0, 'the loop paid something');
assert.ok((await page.locator('.prep-echo-open').count()) >= 1, 'a hidden-line echo (Say it) is offered on a prepared line');
await assertNoHScroll(page, 'debrief');
await page.locator('.dbf-payline').scrollIntoViewIfNeeded();
await t.shot('11-debrief-pay');
await page.locator('.feedback .panel-body').evaluate((el) => (el.scrollTop = 0));
await t.shot('12-debrief-top');
const echo = page.locator('.prep-echo-open').first();
await echo.scrollIntoViewIfNeeded();
await t.shot('13-debrief-echo');
const cashAfterLoop = (await liveGame(page)).wallet.cash;
await leaveDebrief();
g = await liveGame(page);
assert.equal(g.runs.konbini?.complete, true, 'the konbini run is complete');
console.log(`  wallet ¥${cashAfterLoop} (earned ¥${g.totals.earned})`);

// ---- reload keeps the state --------------------------------------------------------------------------------------------
t.step('reload: the wallet, the run and the prepared lines persisted');
const beforeReload = await liveGame(page);
await savedGame(page);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw?.useGame?.getState().hydrated, null, { timeout: 60000 });
await t.sleep(1200);
const afterReload = await liveGame(page);
assert.equal(afterReload.wallet.cash, beforeReload.wallet.cash, 'cash after reload');
assert.equal(afterReload.runs.konbini?.complete, true, 'the run after reload');
assert.equal(afterReload.prep.p_konbini_1?.s, 'ready', 'prepared lines after reload');
assert.equal(afterReload.me.nameKana, kana);
assert.equal(await screen(), 'world');
await assertNoHScroll(page, 'after reload');
await t.shot('14-after-reload');

// ---- station: IC card (typed lines count as your own words) and a top-up ---------------------------------------------
t.step('station: buy the IC card (typing my own words), then top it up (tapping)');
let sheetShot = false;
const openIc = async () => {
  await talkTo('sato');
  await page.waitForSelector('[data-opt=sato_ic]', { timeout: 10000 });
  assert.ok(await page.locator('.hud-sheet [data-opt=sato_info]').count(), 'Sato offers the train info as well');
  if (!sheetShot) {
    sheetShot = true;
    await t.sleep(900);
    await t.shot('15-sheet-sato');
    await assertNoHScroll(page, 'sato sheet');
  }
  await page.locator('[data-opt=sato_ic]').click();
  await page.waitForSelector('.prep, .convo', { timeout: 15000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 15000 });
  await lineAfter(0);
};
await openIc();
const cashIc0 = (await liveGame(page)).wallet.cash;
// my own words (a line copied from a chip would be class S, §3.2): these count for "say 3 new words yourself" (c1_5)
await type('ICカードがほしいです');
await type('はい、だいじょうぶです');
await page.locator('.sg').first().waitFor();
await tap(0); // 千円お願いします
await t.shot('16-ic-quote');
await type('げんきんではらいます');
await finishToDebrief();
g = await liveGame(page);
assert.equal(g.wallet.ic, 1000, 'the card holds ¥1,000');
assert.ok(g.items?.ic_card || g.flags?.ic || g.wallet.hasCard || JSON.stringify(g).includes('ic_card'), 'the IC card is owned');
const lg = (kind, pocket) => g.ledger.filter((e) => e.kind === kind && e.pocket === pocket).map((e) => e.delta);
assert.deepEqual(lg('purchase', 'cash'), [-160, -500], 'the card deposit is a ¥500 purchase');
assert.deepEqual(lg('topup', 'cash'), [-1000], 'and ¥1,000 moved from the cash onto the card');
assert.ok(g.wallet.cash > cashIc0 - 1500, `the loop pay came on top (¥${cashIc0} -> ¥${g.wallet.cash})`);
await leaveDebrief();

await openIc();
await type('チャージしたいです'); // my own words again (top-up)
await tap(1); // 二千円: the card then holds the ¥3,000 cap
await tap(0); // cash
await finishToDebrief();
g = await liveGame(page);
assert.equal(g.wallet.ic, 3000, 'the top-up loaded ¥2,000 (the card is at its ¥3,000 cap)');
assert.deepEqual(g.ledger.filter((e) => e.kind === 'topup' && e.pocket === 'cash').map((e) => e.delta), [-1000, -2000], 'the top-up came out of the cash');
await t.shot('17-ic-debrief');
await leaveDebrief();

t.step('the wallet pill opens the Wallet screen: cash and the card, not a blank page');
await go('world');
await t.sleep(300);
await page.locator('.hud-wallet').click();
await page.waitForSelector('[data-wallet]');
g = await liveGame(page);
const walletText = await text('[data-wallet]');
assert.equal(digits(walletText.split('\n').slice(0, 2).join('')), g.wallet.cash, `the screen shows the cash (${walletText})`);
assert.ok(walletText.includes('¥3,000'), 'and the card balance (¥3,000)');
await assertNoHScroll(page, 'wallet');
await t.shot('17b-wallet');
await go('world');

// ---- vending panel, ramen ticket --------------------------------------------------------------------------------------
t.step('vending machine panel: cold water paid with the IC card (the cash stays)');
await go('world');
await t.sleep(300);
const wV0 = (await liveGame(page)).wallet;
await page.evaluate(() => window.__world.simulatePick('vending'));
await page.waitForSelector('[data-panel="vending"]');
await closeWordCards();
await t.sleep(300);
await assertNoHScroll(page, 'vending');
await t.shot('18-vending');
await page.locator('.pn-tile[data-id="v_water"] .pn-tile-main').click();
await page.waitForSelector('.pn-pay');
await page.locator('.pn-seg button').nth(1).click();
await page.waitForSelector('.pn-ic');
await t.shot('19-vending-ic');
await page.locator('.pn-buy').click();
await page.waitForSelector('.pn-done');
g = await liveGame(page);
assert.equal(g.wallet.ic, wV0.ic - 130, 'the card paid ¥130');
assert.equal(g.wallet.cash, wV0.cash, 'cash untouched');
await t.shot('19b-vending-bought');
await page.locator('.pn-done .btn.primary').click();
await t.sleep(300);
if (await page.locator('[data-panel="vending"]').count()) await page.locator('.pn-head .icon-btn').last().click();
await page.waitForSelector('.pn-sheet', { state: 'detached' });

t.step("ramen ticket machine (world.simulatePick('ramen_machine')): a bowl paid with exact coins (the ramen shop takes cash or card)");
await page.evaluate(() => window.__world.simulatePick('ramen_machine'));
await page.waitForSelector('[data-panel="ticket-ramen"]');
await closeWordCards();
await t.sleep(300);
await page.locator('.pn-tile[data-id="shoyu"] .pn-tile-main').click();
await page.locator('.pn-chip[data-extra="ajitama"]').click(); // an egg too: ¥900 + ¥150
await page.waitForSelector('.pn-coins');
await page.locator('.pn-tray-actions .btn').first().click(); // exact amount
await t.shot('20-ramen-pay');
const wRam0 = (await liveGame(page)).wallet;
await page.locator('.pn-buy').click();
await page.waitForSelector('.pn-ticket');
g = await liveGame(page);
assert.equal(g.wallet.cash, wRam0.cash - 1050, 'the bowl and the egg cost ¥1,050');
assert.equal(g.wallet.ic, wRam0.ic, 'the card is untouched');
assert.deepEqual(g.tickets.ramen, { flavor: 'shoyu' });
await assertNoHScroll(page, 'ramen ticket');
await t.shot('21-ramen-ticket');
await page.locator('.pn-actions .btn').first().click();
await page.waitForSelector('.pn-sheet', { state: 'detached' });

// ---- the short-of-cash branch ---------------------------------------------------------------------------------------
t.step('short of cash: a ¥450 coffee with less than that in the wallet gets a polite "a little short", nothing is bought');
g = await liveGame(page);
const cashNow = g.wallet.cash;
const purchasesBefore = g.stats.purchases;
assert.ok(cashNow < 450, `after the card, the water and the ramen ticket the wallet is below the coffee's ¥450 (¥${cashNow})`);
await talkTo('yuki');
await page.waitForSelector('.prep, .convo, [data-opt=yuki_shop]', { timeout: 15000 });
if (await page.locator('[data-opt=yuki_shop]').count()) await page.locator('[data-opt=yuki_shop]').click();
await page.waitForSelector('.prep, .convo', { timeout: 15000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('.convo', { timeout: 15000 });
await lineAfter(0);
await tap(0); // coffee
await tap(0); // hot
await tap(0); // that is all
await tap(1); // cash -> short
assert.match(await text('.msg.char:last-of-type .bubble'), /足りません/, 'the clerk politely says it is a little short');
await t.shot('22-short');
await assertNoHScroll(page, 'short branch');
g = await liveGame(page);
assert.equal(g.wallet.cash, cashNow, 'no yen moved');
assert.equal(g.stats.purchases, purchasesBefore, 'no purchase counted');
let guard = 0;
while (!(await page.locator('.done-card').count()) && guard++ < 6) await tap(0); // また来ます
await finishToDebrief();
await t.shot('23-short-debrief');
g = await liveGame(page);
assert.equal(g.runs.cafe?.complete ?? false, false, 'a café run that never paid is not complete');
await leaveDebrief();
g = await liveGame(page);
assert.equal(g.ledger.filter((e) => e.kind === 'purchase' && String(e.ref).startsWith('cafe')).length, 0, 'no coffee in the ledger');

// ---- finish Chapter 1: signs and words by real taps; the last objective completes the chapter at once -------------------
t.step('Chapter 1: read signs and save words (real taps) until the last objective completes the chapter, +¥2,500, no dev tools');
g = await liveGame(page);
const cashBeforeCh = g.wallet.cash;
assert.equal(g.chapter.n, 1);
let fresh = 0;
for (const sign of ['sakura', 'cat', 'bench', 'post', 'pond', 'park']) {
  if (await page.locator('[data-beat]').count()) break;
  await page.evaluate((x) => window.__world.simulatePick(x), sign);
  await page.waitForSelector('.word-scrim .word-actions, [data-beat]');
  const save = page.locator('.word-actions .btn.primary');
  if (await save.count()) await save.click();
  await t.sleep(300);
  fresh++;
  await closeWordCards();
}
await page.waitForSelector('[data-beat="b_ch1_close"]', { timeout: 15000 });
assert.equal(await page.locator('.word-scrim').count(), 0, 'the word card of the last sign does not stay on top of the closing beat');
g = await liveGame(page);
console.log(`  ${fresh} signs read; objectives done: ${Object.keys(g.chapter.done).join(' ')}`);
for (const id of ['c1_1', 'c1_2', 'c1_3', 'c1_4', 'c1_5']) assert.ok(g.chapter.done[id] !== undefined, `${id} is done through the real UI`);
assert.deepEqual(g.chapter.completed, [1], 'Chapter 1 is complete');
assert.equal(g.ledger.filter((e) => e.kind === 'chapter').reduce((n, e) => n + e.delta, 0), 2500, 'Chapter 1 paid ¥2,500, once');
assert.ok(g.titles.includes('t_newcomer'), 'title 新入生');
console.log(`  wallet ¥${cashBeforeCh} -> ¥${g.wallet.cash}`);

t.step('closing beat -> Dream picker; Chapter 2 opens Fuku-Fuku');
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(300);
await t.shot('25-closing-beat');
await page.locator('.qst-beat [data-continue]').click();
await page.waitForSelector('[data-ask=dream] .qst-picker');
await assertNoHScroll(page, 'dream picker');
await t.shot('26-dream-picker');
await page.locator('[data-choose]').click();
await t.sleep(700);
g = await liveGame(page);
assert.ok(g.dream?.id, 'a dream is chosen');
assert.ok(g.beats.includes('b_ch1_close'));
await page.waitForSelector('[data-beat="b_ch2_open"]', { timeout: 15000 });
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(250);
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(700);
assert.equal(await screen(), 'world');
assert.equal((await liveGame(page)).chapter.n, 2, 'Chapter 2 is current');
assert.equal(await page.evaluate(() => window.__world.isShopOpen('fukufuku')), true, "Fuku-Fuku's shutter opens in Chapter 2");
assert.equal(await page.locator('.hud-dream').count(), 1, 'the dream chip joins the HUD');
await assertNoHScroll(page, 'hud with dream chip');
await t.shot('27-hud-ch2');

t.step('daily goals appear (a goal never starts finished, so a busy first day may offer fewer than three) and tick with play');
g = await liveGame(page);
assert.ok(g.daily.goals.length >= 2, `daily goals: ${g.daily.goals.length}`);
console.log('  goals:', g.daily.goals.map((x) => `${x.id} (${x.counter} ${x.target})`).join(', '));
await go('quests');
await page.waitForSelector('[data-screen=quests]');
await page.locator('[data-tab=today]').click();
await page.waitForSelector('[data-goal]');
assert.equal(await page.locator('[data-goal]').count(), g.daily.goals.length, 'the Today tab lists the goals');
const goalsBefore = await page.locator('[data-pane=today]').innerText().catch(() => page.locator('[data-goal]').allInnerTexts());
await assertNoHScroll(page, 'today');
await t.shot('28-today');
await go('world');
// one real café order in my own words ticks the speaking and doing counters of the day
await talkTo('yuki');
await page.waitForSelector('.prep, .convo, [data-opt=yuki_shop]', { timeout: 15000 });
if (await page.locator('[data-opt=yuki_shop]').count()) await page.locator('[data-opt=yuki_shop]').click();
await page.waitForSelector('.prep, .convo', { timeout: 15000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('.convo', { timeout: 15000 });
await lineAfter(0);
for (const line of ['コーヒーを一つお願いします', 'あたたかいのがいいです', 'ワイファイのパスワードは何ですか', 'ありがとう、助かります', 'げんきんではらいます']) await type(line);
await finishToDebrief();
await leaveDebrief();
await go('quests');
await page.waitForSelector('[data-screen=quests]');
await page.locator('[data-tab=today]').click();
await page.waitForSelector('[data-goal]');
const goalsAfter = await page.locator('[data-pane=today]').innerText().catch(() => page.locator('[data-goal]').allInnerTexts());
const counters = await page.evaluate(() => Object.values(window.__lw.getGame().daily.counters).flatMap((d) => Object.keys(d)));
assert.ok(counters.includes('purchase') && counters.includes('indep_lines'), `the day's counters ticked with the order (${counters})`);
console.log(`  Today tab changed after the order: ${JSON.stringify(goalsBefore) !== JSON.stringify(goalsAfter)}`);
await t.shot('29-today-after');
await go('world');

assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr');
assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('game-loop ok');
