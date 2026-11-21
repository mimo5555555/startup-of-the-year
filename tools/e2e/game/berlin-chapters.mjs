// Berlin's Chapters 4-6 (German step 5) in the REAL UI at 360 px, English or Arabic (--ar): a German profile meets Lena, then the save
// moves on chapter by chapter. Chapter 4: the chat of the day with Lena (Small talk on the Interaction sheet; greet, answer, react), the
// Apotheke (「Ich habe Halsschmerzen」, the lozenges, by card: exactly € 6,95). Chapter 5: the Kneipe 「Zum Eck」 (a Spezi, Prost, Zahlen
// bitte; the card refused kindly because Uwe takes cash only, then cash: exactly € 3,20). Chapter 6: the Anmeldung at the Bürgeramt
// (appointment, papers, address, floor). After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/berlin-chapters.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const t = await start('berlin-chapters');
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
  localStorage.setItem('lw.target', 'de');
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
assert.equal((await liveGame(page)).packId, 'de', 'the Berlin pack');
step('a German profile');

// the first meeting with Lena (her chat of the day opens after it)
await talkTo('lena');
await type('Ich heiße Sam.');
await type('Ich komme aus Ägypten.');
await type('Ich koche gern.');
await finishConvo();
await check('after meeting Lena');

// Chapter 4: a chat with Lena, the Apotheke
await setChapter(4);
await talkTo('lena', 'lena_talk');
assert.ok((await lastLine()).startsWith('Hey Sam!'), 'Lena greets by name');
const ask = await type('Hallo! Gut, danke!');
assert.ok(ask.endsWith('?'), `Lena asks today’s question (${ask})`);
await t.shot('chat');
await page.locator('.sg').first().click();
await page.waitForFunction(() => !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
await t.sleep(400);
await type('Echt? Cool!');
assert.equal(await lastLine(), 'Danke fürs Quatschen! Bis morgen!');
await type('Tschüss, bis morgen!');
await finishConvo();
await check('after the chat');
step(`Chapter 4: a chat with Lena (「${ask}」)`);

let g0 = await liveGame(page);
await talkTo('anke');
assert.equal(await lastLine(), 'Guten Tag! Was kann ich für Sie tun?');
assert.equal(await type('Ich habe Halsschmerzen.'), 'Oh, das tut mir leid. Ich empfehle Halstabletten. Möchten Sie die?');
assert.equal(await type('Ja, bitte.'), 'Das macht 6,95 €. Bar oder mit Karte?');
await t.shot('apotheke');
assert.equal(await type('Mit Karte, bitte.'), 'Bitte schön. Gute Besserung!');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 695, 'exactly € 6,95 for the lozenges');
await check('after the Apotheke');
step('the Apotheke: 「Ich habe Halsschmerzen」, the lozenges, € 6,95 by card');

// Chapter 5: the Kneipe, cash only
await setChapter(5);
g0 = await liveGame(page);
await talkTo('uwe');
assert.equal(await lastLine(), 'Guten Abend! Was darf es sein?');
await type('Eine Spezi, bitte.');
await type('Nein, danke.');
assert.equal(await lastLine(), 'Bitte schön! Prost!');
await type('Prost!');
await type('Zahlen, bitte!');
assert.equal(await lastLine(), 'Das macht 3,20 €. Bei uns nur bar, bitte.');
assert.equal(await type('Mit Karte, bitte.'), 'Tut mir leid, wir nehmen nur Bargeld.', 'a card is refused kindly: cash only');
await t.shot('kneipe');
await type('Hier, bitte. Stimmt so!');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 320, 'exactly € 3,20 for the Spezi');
await check('after the Kneipe');
step('the Kneipe: a Spezi, Prost, the card refused (cash only), € 3,20 in cash');

// Chapter 6: the Anmeldung
await setChapter(6);
await talkTo('krause');
assert.equal(await lastLine(), 'Guten Tag. Haben Sie einen Termin?');
await type('Ja, ich habe einen Termin.');
await type('Ich möchte mich anmelden.');
await type('Hier, bitte.');
await type('Meine Adresse ist Oranienstraße zwölf.');
assert.equal(await type('Im dritten Stock.'), 'Alles klar. Hier ist Ihre Meldebescheinigung. Willkommen in Berlin, Sam!');
await t.shot('anmeldung');
await type('Vielen Dank!');
await finishConvo();
await check('after the Anmeldung');
const done = (await liveGame(page)).runs?.berlin_buergeramt?.count ?? 0;
assert.ok(done >= 1, 'the Anmeldung is counted');
step('the Bürgeramt: the Anmeldung, every step');

await t.browser.close();
console.log(`berlin-chapters e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
