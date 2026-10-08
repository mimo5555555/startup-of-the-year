// The §3.2 copy rule end to end in the real UI (docs/GAME_DESIGN.md §15.4 row 2C): the same café order played five ways, each from a
// fresh game, and what it pays. Own words pay the most; tapping every chip pays less; translating pays least; translating and then
// TYPING the translation (a copy of shown text) pays no more than tapping. Also checks that the debrief's pay line is the ledger,
// that the clerk's price shows as a chip, and that Real mode hides the chips and pays x1.25.
// Usage: node tools/e2e/game/assist-vs-solo.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('assist-vs-solo');
const { page } = t;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

/** waits until the clerk has said one more line (the typing dots are gone) */
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
const type = async (text) => {
  const n = await charLines();
  await page.fill('#say', text);
  await page.locator('.send').click();
  await lineAfter(n);
};
/** English in the box, the Japanese preview appears, and the learner presses Send */
const translateSend = async (english) => {
  const n = await charLines();
  await page.fill('#say', english);
  await page.locator('.send').click();
  await page.waitForSelector('.assist .ja');
  await page.locator('.assist .btn.primary').click();
  await lineAfter(n);
};
/** English in the box, the preview appears, and the learner types the Japanese they just saw instead of sending it */
const translateThenCopy = async (english) => {
  await page.fill('#say', english);
  await page.locator('.send').click();
  await page.waitForSelector('.assist .ja');
  const ja = (await page.locator('.assist .ja .jp').allTextContents()).join('');
  await page.locator('.assist .link-btn').click();
  await type(ja);
};

/** a fresh game, the café conversation opened the way Prepare / a trip / the host opens it: through the request */
async function open(mode) {
  await page.evaluate(() => window.__lw.useStore.getState().resetGameProgress());
  await skipBeats(page).catch(() => {});
  await page.evaluate((m) => window.__lw.useUi.getState().startConvo({ scenarioId: 'cafe', characterId: 'yuki', mode: m }), mode);
  await page.waitForSelector('.convo');
  await lineAfter(0);
}

/** finishes the conversation, reads what the debrief says it paid and what the ledger says, and returns to the city */
async function settle(label, { shotName } = {}) {
  await page.waitForSelector('.done-card', { timeout: 30000 });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-payline');
  const line = (await page.locator('.dbf-payline strong').innerText()).trim();
  const g = await liveGame(page);
  const earned = g.totals.earned;
  assert.equal(line.replace(/[^\d]/g, '') || '0', String(earned), `${label}: the debrief's pay line (${line}) is the ledger (${earned})`);
  assert.equal(g.wallet.cash, 3000 + earned - 450, `${label}: wallet = start + pay - the coffee`);
  if (shotName) {
    await page.locator('.feedback .panel-body').evaluate((el) => (el.scrollTop = 0));
    await t.shot(`${shotName}-top`);
    await page.locator('.dbf-payline').scrollIntoViewIfNeeded();
    await t.shot(`${shotName}-pay`);
    await assertNoHScroll(page, `${label} debrief`);
  }
  const reasons = (await page.locator('.dbf-payline span').innerText()).trim();
  t.step(`${label}: pays ¥${earned} (${reasons})`);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(400);
  await skipBeats(page).catch(() => {});
  return { earned, reasons };
}

t.step('fresh profile');
await onboard(page, { arabic: t.arabic });
await t.sleep(2000);
await skipBeats(page).catch(() => {});

// ---- 1. every chip -------------------------------------------------------------------------------------------------
t.step('run 1: tap every chip (class S)');
await open('guided');
await t.shot('01-first-line');
assert.ok((await page.locator('.sg').count()) >= 2, 'Guided mode shows the chips');
await tap(0); // coffee
await tap(0); // hot
await tap(1); // the Wi-Fi password
assert.equal(await page.locator('.dbf-price').count(), 0, 'no price chip before the clerk names a price');
await tap(0); // thank you: the clerk names the total
// the clerk's total is on screen as a chip with the tax note
await page.waitForSelector('.dbf-price');
assert.match(await page.locator('.dbf-price').first().innerText(), /450/, 'the price chip shows the clerk\'s ¥450');
await t.shot('02-price-chip');
await tap(1); // cash
await assertNoHScroll(page, 'conversation with a price chip');
const tapped = await settle('tapped', { shotName: '03-tapped' });

// ---- 2. own words ---------------------------------------------------------------------------------------------------
t.step('run 2: type every line yourself (class I)');
await open('guided');
await type('コーヒーを一つお願いします');
await type('あたたかいのがいいです');
await type('ワイファイのパスワードは何ですか');
await type('ありがとう、助かります');
await type('げんきんではらいます');
const solo = await settle('typed', { shotName: '04-typed' });

// ---- 3. translate and send ------------------------------------------------------------------------------------------
t.step('run 3: say it in English, send the translation (class T)');
await open('guided');
await translateSend('a coffee please');
await translateSend('hot please');
await translateSend('what is the wifi password');
await translateSend('thank you');
await translateSend('cash please');
const translated = await settle('translated');

// ---- 4. translate, then type the translation --------------------------------------------------------------------------
t.step('run 4: translate, then copy-type the Japanese shown (a copy of a translation is still class T)');
await open('guided');
await translateThenCopy('a coffee please');
await translateThenCopy('hot please');
await translateThenCopy('what is the wifi password');
await translateThenCopy('thank you');
await translateThenCopy('cash please');
const copied = await settle('translate-then-copy');

// ---- 5. Real mode ---------------------------------------------------------------------------------------------------
t.step('run 5: Real mode hides the chips, keeps Hint, and pays x1.25');
await open('real');
assert.equal(await page.locator('.sg').count(), 0, 'Real mode shows no chips');
assert.ok(await page.locator('.tool').first().isVisible(), 'the Hint button stays');
await t.shot('05-real-mode');
await type('コーヒーを一つお願いします');
assert.equal(await page.locator('.sg').count(), 0, 'still no chips at the next node');
await type('あたたかいのがいいです');
await type('ワイファイのパスワードは何ですか');
await type('ありがとう、助かります');
await type('げんきんではらいます');
const real = await settle('real', { shotName: '06-real' });
assert.match(real.reasons, /\+25%/, 'the pay line names the Real mode bonus');

// ---- 6. speech confidence (§12.4) ---------------------------------------------------------------------------------------
t.step('run 6: spoken lines by recogniser confidence (a fake SpeechRecognition says what the test tells it)');
await page.evaluate(() => {
  window.__heard = { text: '', confidence: 1, alts: [] };
  const Fake = class {
    start() {
      setTimeout(() => this.onstart?.(), 10);
      setTimeout(() => {
        const h = window.__heard;
        const r = [{ transcript: h.text, confidence: h.confidence }, ...h.alts.map((a) => ({ transcript: a, confidence: h.confidence * 0.8 }))];
        r.isFinal = true;
        this.onresult?.({ results: [r] });
        this.onend?.();
      }, 150);
    }
    stop() {}
    abort() {}
  };
  // Chromium has a native SpeechRecognition too, and the app prefers it
  window.SpeechRecognition = window.webkitSpeechRecognition = Fake;
});
const hear = (text, confidence, alts = []) => page.evaluate((h) => (window.__heard = h), { text, confidence, alts });
const mine = () => page.locator('.msg.me').count();
await open('guided');
await page.locator('.mic-row .seg').click(); // 日本語
await page.waitForSelector('.mic:not([disabled])');

await hear('コーヒーをください', 0.2);
await page.locator('.mic').click();
await page.waitForSelector('.mic-msg');
assert.equal(await mine(), 0, 'below 0.45 no turn is used');
assert.equal(await page.locator('.tag.miss').count(), 0, 'and no fallback is counted');
assert.equal((await liveGame(page)).wallet.cash, 3000, 'nothing was bought by a mishearing');

await hear('コーヒーをください', 0.6);
await page.locator('.mic').click();
await page.waitForSelector('.dbf-heard');
assert.match(await page.locator('.dbf-heard').innerText(), /コーヒーをください/, 'the half-sure line is shown back');
assert.equal(await mine(), 0, 'no turn is consumed until it is confirmed');
await t.sleep(900); // the list scrolls the row into view
await t.shot('07-heard');
await assertNoHScroll(page, 'the "I heard" row');
await page.locator('.dbf-heard .btn.soft').first().click(); // Edit: the text moves to the keyboard
assert.equal(await page.inputValue('#say'), 'コーヒーをください');
assert.equal(await page.locator('.dbf-heard').count(), 0);
await page.fill('#say', '');

await page.locator('.mic').click();
await page.waitForSelector('.dbf-heard');
let n = await charLines();
await page.locator('.dbf-heard .btn.primary').click(); // Yes
await lineAfter(n);
assert.equal(await mine(), 1, 'Yes sends it');

await hear('ホットでお願いします', 0.9);
n = await charLines();
await page.locator('.mic').click();
await lineAfter(n);
assert.equal(await page.locator('.dbf-heard').count(), 0, 'a sure line goes straight in');
assert.equal(await mine(), 2);

await hear('えーっと', 0.3);
for (let i = 0; i < 3; i++) {
  await page.locator('.mic').click();
  await page.waitForFunction((k) => document.querySelector('.mic-msg') !== null && k >= 0, i);
  await t.sleep(400);
}
assert.equal(await page.inputValue('#say'), 'えーっと', 'after three low-confidence tries the draft waits in the keyboard');
await t.sleep(500);
await t.shot('08-type-instead');
await page.evaluate(() => window.__lw.useUi.getState().endConvo());
await t.sleep(300);

// ---- the gradient ------------------------------------------------------------------------------------------------------
t.step(`pay: own words ¥${solo.earned} > tapped ¥${tapped.earned} > translated ¥${translated.earned}; translate-then-copy ¥${copied.earned}`);
assert.ok(solo.earned > tapped.earned, 'typing your own lines pays more than tapping every chip');
assert.ok(tapped.earned > translated.earned, 'tapping pays more than translating');
assert.ok(copied.earned <= tapped.earned, 'translate-then-copy-type pays no more than all-tapped');
assert.ok(real.earned > solo.earned, 'Real mode pays more than the same lines in Guided');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('assist-vs-solo ok');
