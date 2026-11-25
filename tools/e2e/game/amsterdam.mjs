// Dutch in Amsterdam in the REAL UI at 360 px, English or Arabic (--ar):
//   onboarding: pick the UI language, then "Nederlands · Dutch in Amsterdam" -> the app restarts in Dutch (its own saves) and onboarding
//   goes on in the UI language just picked -> Femke's welcome beat on the canal -> Sanne at her houseboat, typed: Ik heet Sam, Ik kom uit
//   Egypte, Ik kook graag (she says them back) -> Femke's café, typed: Een koffie verkeerd, graag / Ja, een stuk appeltaart, graag / Nee,
//   zonder, dank u (Dat is dan € 8,30) / Pinnen, graag -> exactly €8.30 charged -> Femke again on a small-talk visit (the season or the
//   weekend; the yes chip, a reply, back to 「Zo, wat mag het zijn?」) and on a plain return (「Hé, daar bent u weer!」) -> Settings: back
//   to Japanese -> Tokyo, its save untouched, the Dutch save kept. After every step: no horizontal scroll, no console error, the wallet =
//   its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/amsterdam.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const t = await start('amsterdam');
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
assert.equal(await page.locator('[data-learn]').count(), 4, 'four languages to learn');
await page.locator('[data-learn=nl]').click();
assert.ok((await page.locator('[data-learn=nl]').innerText()).includes('Nederlands'), 'Dutch named in Dutch');
assert.ok((await page.locator('.hero-sub').innerText()).includes(AR ? 'أمستردام' : 'Amsterdam'), 'the tagline follows the pick');
await t.shot('pick');
const jaSave = await page.evaluate(() => localStorage.getItem('lw.v1.state'));
assert.ok(jaSave, 'the Japanese app has its own save');
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('.onb-foot .btn.primary').click()]);
await page.waitForSelector('.onb');
assert.equal(await page.evaluate(() => localStorage.getItem('lw.target')), 'nl');
assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr', 'the UI language carried over the restart');
assert.ok((await page.locator('.hero-sub').innerText()).includes(AR ? 'أمستردام' : 'Amsterdam'), 'the tagline is Amsterdam’s');
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
assert.equal((await liveGame(page)).wallet.cash, 3000, '€30 to start');
assert.equal(await screen(), 'beat', 'Femke’s welcome');
await t.shot('welcome');
step('onboarding in Dutch: the restart, the UI language kept, the Amsterdam pack, Femke’s welcome');

// the canal itself, before anyone is spoken to
await settle();
await t.sleep(800);
await t.shot('canal');

// Sanne at her houseboat
await talkTo('sanne');
assert.ok((await lastLine()).startsWith('Hoi! Jij bent de nieuwe buur, toch?'), 'Sanne says je');
assert.equal(await type('Ik heet Sam.'), 'Leuk je te ontmoeten, Sam! Waar kom je vandaan?');
assert.ok((await type('Ik kom uit Egypte.')).includes('Egypte wil ik ook eens zien.'), 'the country said back');
await t.shot('sanne');
assert.ok((await type('Ik kook graag.')).startsWith('Leuk! Dan koken we een keer samen.'), 'the hobby');
await finishConvo();
await check('after Sanne');
step('Sanne: name, country and hobby typed in Dutch, said back');

// coffee and apple pie at Femke's
await talkTo('femke');
assert.equal(await lastLine(), 'Goedemorgen! Wat mag het zijn?');
const g0 = await liveGame(page);
assert.ok((await type('Een koffie verkeerd, graag.')).startsWith('Komt eraan.'), 'the coffee ordered');
assert.equal(await type('Ja, een stuk appeltaart, graag.'), 'Met slagroom?');
assert.equal(await type('Nee, zonder, dank u.'), 'Dat is dan € 8,30. Pinnen of contant?');
await t.shot('pay');
await type('Pinnen, graag.');
await finishConvo();
const g = await liveGame(page);
assert.equal(g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned), 830, 'exactly €8.30: a koffie verkeerd and apple pie');
await check('after the café');
step('the café: typed Dutch, 「Dat is dan € 8,30」, exactly €8.30 charged');
const voice = await page.evaluate(() => ({ ...window.__lwVoice, missed: [...window.__lwVoice.missed] }));
const manifest = await page.evaluate(() => fetch('voice-nl/manifest.json').then((r) => (r.ok ? r.json() : { entries: {} })).catch(() => ({ entries: {} })));
if (Object.keys(manifest.entries ?? {}).length > 0) {
  assert.ok(voice.recorded > 0, `Dutch lines played from their recordings (${JSON.stringify(voice)})`);
  assert.ok(!voice.missed.some((x) => x.startsWith('Goedemorgen! Wat mag het zijn')), 'Femke’s greeting is recorded');
}
step(`voices: ${voice.recorded} lines from recordings, ${voice.fallback} by the device voice`);

// Femke knows you now (Dutch step 3): a visit with small talk (the third in turn), then a plain return (the fourth)
const setVisits = (n) =>
  page.evaluate((count) => {
    const lw = window.__lw;
    const g0 = lw.getGame();
    lw.useGame.getState().setGame({ ...g0, runs: { ...g0.runs, ams_cafe: { ...g0.runs.ams_cafe, count } } });
  }, n);
const chips = () => page.locator('.sg').evaluateAll((els) => els.map((e) => e.innerText.split('\n')[0]));
await setVisits(2);
await talkTo('femke');
const remark = await lastLine();
assert.ok(remark.startsWith('Goedemorgen! ') && remark !== 'Goedemorgen! Wat mag het zijn?' && remark.endsWith('?'), `Femke makes small talk (${remark})`);
const cs = await chips();
assert.ok(/^(Ja|Heel leuk)/.test(cs[0]), `the yes chip is on top (${cs.join(' | ')})`);
await t.shot('smalltalk');
const m = await page.locator('.msg.char').count();
await page.locator('.sg').first().click();
await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k && !document.querySelector('.bubble.typing'), m, { timeout: 40000 });
await t.sleep(250);
const talkReply = await lastLine();
assert.ok(talkReply.endsWith('Zo, wat mag het zijn?'), `a reply, then back to the café (${talkReply})`);
assert.ok(!(await chips()).includes(cs[0]), 'answered: the small talk chips are gone');
assert.ok((await type('Een thee, graag.')).startsWith('Komt eraan.'), 'the order after the small talk');
await type('Nee, dank u.');
await type('Pinnen, graag.');
await finishConvo();
await check('after the small talk');
step(`small talk: 「${remark}」 → ${cs[0]} → 「${talkReply}」; a tea bought`);
await setVisits(3);
await talkTo('femke');
assert.equal(await lastLine(), 'Hé, daar bent u weer! Goedemorgen! Wat mag het zijn?', 'a regular is greeted as one');
await type('Een thee, graag.');
await type('Nee, dank u.');
await type('Pinnen, graag.');
await finishConvo();
await check('after the return');
step('a plain return: 「Hé, daar bent u weer!」, a tea bought');

// back to Japanese: Tokyo, and the Japanese save is still there
await settle();
assert.equal(await page.evaluate(() => localStorage.getItem('lw.v1.state')), jaSave, 'the Japanese save is untouched');
assert.ok((await page.evaluate(() => localStorage.getItem('lw.nl.v1.state')))?.includes('"Sam"'), 'the Dutch profile is in the Dutch save');
await page.evaluate(() => window.__lw.useStore.getState().go('settings'));
await page.waitForSelector('[data-learn=ja]');
assert.equal(await page.locator('[data-learn]').count(), 4);
await t.shot('settings');
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('[data-learn=ja]').click()]);
assert.equal(await page.evaluate(() => localStorage.getItem('lw.target')), 'ja');
assert.ok(await page.evaluate(() => !!localStorage.getItem('lw.nl.v1.state')), 'the Dutch save stays for next time');
step('Settings: back to Japanese (the Dutch save kept, the Japanese one untouched)');

await t.browser.close();
console.log(`amsterdam e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
