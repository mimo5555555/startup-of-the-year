// Amsterdam's Chapters 4-6 (Dutch step 4) in the REAL UI at 360 px, English or Arabic (--ar): a Dutch profile meets Sanne, then the save
// moves on chapter by chapter. Chapter 4: the chat of the day with Sanne (Small talk on the Interaction sheet; greet, answer, react), the
// drogist (「Ik heb keelpijn」, the throat sweets, by card: exactly € 3,95). Chapter 5: the brown café “’t Hoekje” (a spa rood, Proost,
// Mag ik afrekenen; cash refused kindly because Joop takes cards only, then the card: exactly € 2,80). Chapter 6: the inschrijving at the
// gemeente (appointment, papers, address, floor: the BSN by post). After every step: no horizontal scroll, no console error, the wallet =
// its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/amsterdam-chapters.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const t = await start('amsterdam-chapters');
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);

async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
}

async function settle() {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.cul-scrim').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if ((await screen()) === 'beat') await skipBeats(page);
    else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

const lastLine = async () => (await page.locator('.msg.char').last().innerText()).split('\n')[0];
async function type(text) {
  await page.waitForSelector('#say', { timeout: 40000 });
  const n = await page.locator('.msg.char').count();
  await page.fill('#say', text);
  await page.locator('.send').click();
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
  return lastLine();
}
async function talkTo(id, opt) {
  await settle();
  await page.evaluate((x) => window.__world.teleportNear(x), id);
  await page.waitForFunction((x) => window.__world.nearby === x, id, { timeout: 20000 });
  await t.sleep(900);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
  // several things to do with this character: the Interaction sheet, pick the one asked for
  if (opt) {
    await page.waitForSelector(`[data-opt="${opt}"]`, { timeout: 15000 });
    await page.locator(`[data-opt="${opt}"]`).click();
    await t.sleep(600);
  }
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
}
async function finishConvo() {
  await page.waitForSelector('.done-card', { timeout: 40000 });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(800);
}

const setChapter = async (n) => {
  await settle();
  await page.evaluate((c) => {
    const lw = window.__lw;
    const g0 = lw.getGame();
    lw.useGame.getState().setGame({ ...g0, chapter: { ...g0.chapter, n: c } });
  }, n);
  await t.sleep(1200);
};
const spent = (g0, g) => g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned);

// ---------------------------------------------------------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('lw.target', 'nl');
});
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await page.getByRole('button', { name: AR ? 'العربية' : 'English' }).first().click();
const next = () => page.locator('.onb-foot .btn.primary').click();
await next();
await page.fill('#name', 'Sam');
await next();
await next();
await next();
for (const i of [2, 4, 5]) await page.locator('.chips.wrap .chip').nth(i).click();
await next();
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await t.sleep(1500);
assert.equal((await liveGame(page)).packId, 'nl', 'the Amsterdam pack');
step('a Dutch profile');

// the first meeting with Sanne (her chat of the day opens after it)
await talkTo('sanne');
await type('Ik heet Sam.');
await type('Ik kom uit Egypte.');
await type('Ik kook graag.');
await finishConvo();
await check('after meeting Sanne');

// Chapter 4: a chat with Sanne, the drogist
await setChapter(4);
await talkTo('sanne', 'sanne_talk');
assert.ok((await lastLine()).startsWith('Hé Sam!'), 'Sanne greets by name');
const ask = await type('Hoi! Goed, dank je!');
assert.ok(ask.endsWith('?'), `Sanne asks today’s question (${ask})`);
await t.shot('chat');
await page.locator('.sg').first().click();
await page.waitForFunction(() => !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
await t.sleep(400);
await type('Echt? Leuk!');
assert.equal(await lastLine(), 'Leuk om even te kletsen! Tot morgen!');
await type('Doei, tot morgen!');
await finishConvo();
await check('after the chat');
step(`Chapter 4: a chat with Sanne (「${ask}」)`);

let g0 = await liveGame(page);
await talkTo('mirjam');
assert.equal(await lastLine(), 'Goedemiddag! Kan ik u ergens mee helpen?');
assert.equal(await type('Ik heb keelpijn.'), 'Wat vervelend. Ik raad keelpastilles aan. Wilt u die?');
assert.equal(await type('Ja, graag.'), 'Dat is dan € 3,95. Pinnen of contant?');
await t.shot('drogist');
assert.equal(await type('Pinnen, graag.'), 'Alstublieft. Beterschap!');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 395, 'exactly € 3,95 for the throat sweets');
await check('after the drogist');
step('the drogist: 「Ik heb keelpijn」, the throat sweets, € 3,95 by card');

// Chapter 5: the brown café, cards only
await setChapter(5);
g0 = await liveGame(page);
await talkTo('joop');
assert.equal(await lastLine(), 'Goedenavond! Wat mag het zijn?');
await type('Een spa rood, graag.');
await type('Nee, dank u.');
assert.equal(await lastLine(), 'Alstublieft! Proost!');
await type('Proost!');
await type('Mag ik afrekenen?');
assert.equal(await lastLine(), 'Dat is dan € 2,80. Hier kunt u alleen pinnen.');
assert.equal(await type('Contant, alstublieft.'), 'Sorry, we accepteren alleen pin.', 'cash is refused kindly: cards only');
await t.shot('kroeg');
await type('Pinnen, graag.');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 280, 'exactly € 2,80 for the spa rood');
await check('after the brown café');
step('the brown café: a spa rood, Proost, cash refused (cards only), € 2,80 by card');

// Chapter 6: the inschrijving
await setChapter(6);
await talkTo('ilse');
assert.equal(await lastLine(), 'Goedemorgen. Heeft u een afspraak?');
await type('Ja, ik heb een afspraak.');
await type('Ik wil me inschrijven.');
await type('Alstublieft.');
await type('Mijn adres is Ruysdaelkade twaalf.');
assert.equal(await type('Driehoog.'), 'Prima. U bent ingeschreven. Uw BSN krijgt u per post. Welkom in Amsterdam, Sam!');
await t.shot('gemeente');
await type('Dank u wel!');
await finishConvo();
await check('after the gemeente');
const done = (await liveGame(page)).runs?.ams_gemeente?.count ?? 0;
assert.ok(done >= 1, 'the inschrijving is counted');
step('the gemeente: the inschrijving, every step');

await t.browser.close();
console.log(`amsterdam-chapters e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
