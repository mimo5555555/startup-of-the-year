// German in Berlin in the REAL UI at 360 px, English or Arabic (--ar):
//   onboarding: pick the UI language, then "Deutsch · German in Berlin" -> the app restarts in German (its own saves) and onboarding goes
//   on in the UI language just picked -> Murat's welcome beat on the Berlin street -> Lena at the WG door, typed: Ich heiße Sam, Ich komme
//   aus Ägypten, Ich koche gern (she says them back) -> Jana's bakery, typed: Zwei Brötchen, bitte / Und einen Kaffee, bitte / Zum
//   Mitnehmen, bitte (Das macht 3,40 €) / Mit Karte, bitte -> exactly €3.40 charged -> Settings: back to Japanese -> Tokyo, its save untouched.
//   After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/berlin.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const t = await start('berlin');
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
async function talkTo(id) {
  await settle();
  await page.evaluate((x) => window.__world.teleportNear(x), id);
  await page.waitForFunction((x) => window.__world.nearby === x, id, { timeout: 20000 });
  await t.sleep(900);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
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

// ---------------------------------------------------------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await page.getByRole('button', { name: AR ? 'العربية' : 'English' }).first().click();
await page.locator('[data-learn=de]').click();
assert.ok((await page.locator('.hero-sub').innerText()).includes(AR ? 'برلين' : 'Berlin'), 'the tagline is Berlin’s');
await t.shot('pick');
// the Japanese app's save as it is now: learning German must never touch it
const jaSave = await page.evaluate(() => localStorage.getItem('lw.v1.state'));
assert.ok(jaSave, 'the Japanese app has its own save');
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('.onb-foot .btn.primary').click()]);
await page.waitForSelector('.onb');
assert.equal(await page.evaluate(() => localStorage.getItem('lw.target')), 'de');
assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr', 'the UI language carried over the restart');
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
assert.equal((await liveGame(page)).wallet.cash, 3000, '€30 to start');
assert.equal(await screen(), 'beat', 'Murat’s welcome');
await t.shot('welcome');
step('onboarding in German: the restart, the UI language kept, the Berlin pack, Murat’s welcome');

// Lena at the WG door
await talkTo('lena');
assert.ok((await lastLine()).startsWith('Hey! Du bist bestimmt neu in der WG.'), 'Lena says du');
assert.equal(await type('Ich heiße Sam.'), 'Freut mich, Sam! Woher kommst du?');
assert.ok((await type('Ich komme aus Ägypten.')).includes('Ägypten möchte ich auch mal sehen.'), 'the country said back');
await t.shot('lena');
assert.ok((await type('Ich koche gern.')).startsWith('Super! Dann kochen wir mal zusammen.'), 'the hobby');
await finishConvo();
await check('after Lena');
step('Lena: name, country and hobby typed in German, said back');

// breakfast at Jana's
await talkTo('jana');
assert.equal(await lastLine(), 'Guten Morgen! Was darf es sein?');
const g0 = await liveGame(page);
assert.equal(await type('Zwei Brötchen, bitte.'), 'Gerne. Sonst noch etwas?');
assert.equal(await type('Und einen Kaffee, bitte.'), 'Für hier oder zum Mitnehmen?');
assert.equal(await type('Zum Mitnehmen, bitte.'), 'Das macht 3,40 €. Bar oder mit Karte?');
await t.shot('pay');
await type('Mit Karte, bitte.');
await finishConvo();
const g = await liveGame(page);
// (the conversation also pays for speaking: what was earned is added back)
assert.equal(g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned), 340, 'exactly €3.40: two rolls and a coffee');
await check('after breakfast');
step('the bakery: typed German, 「Das macht 3,40 €」, exactly €3.40 charged');
// the recorded German voices (public/voice-de): Jana's lines play from their files; a line with a price is left to the device voice
const voice = await page.evaluate(() => ({ ...window.__lwVoice, missed: [...window.__lwVoice.missed] }));
const manifest = await page.evaluate(() => fetch('voice-de/manifest.json').then((r) => r.json()));
if (Object.keys(manifest.entries).length > 0) {
  assert.ok(voice.recorded > 0, `German lines played from their recordings (${JSON.stringify(voice)})`);
  assert.ok(!voice.missed.some((x) => x.startsWith('Guten Morgen! Was darf es sein')), 'Jana’s greeting is recorded');
}
step(`voices: ${voice.recorded} lines from recordings, ${voice.fallback} by the device voice`);

// back to Japanese: Tokyo, and the Japanese save is still there
await settle();
assert.equal(await page.evaluate(() => localStorage.getItem('lw.v1.state')), jaSave, 'the Japanese save is untouched');
assert.ok((await page.evaluate(() => localStorage.getItem('lw.de.v1.state')))?.includes('"Sam"'), 'the German profile is in the German save');
await page.evaluate(() => window.__lw.useStore.getState().go('settings'));
await page.waitForSelector('[data-learn=ja]');
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('[data-learn=ja]').click()]);
assert.equal(await page.evaluate(() => localStorage.getItem('lw.target')), 'ja');
assert.ok(await page.evaluate(() => !!localStorage.getItem('lw.de.v1.state')), 'the German save stays for next time');
step('Settings: back to Japanese (the German save kept, the Japanese one untouched)');

await t.browser.close();
console.log(`berlin e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
