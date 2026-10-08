// End-to-end walk through the app in headless Chromium (mobile viewport), with screenshots.
// Usage: node tools/e2e/run.mjs [--ar]   (dev server must be running; BASE overrides the URL)
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';
import { afterOnboarding, talkToConversation } from './flow.mjs';

const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const arabic = process.argv.includes('--ar');
const tag = arabic ? 'ar-' : '';

const { browser, page, logs } = await launch({ width: 412, height: 860, dpr: 1, locale: arabic ? 'ar-EG' : 'en-US' });
const shot = (name) => page.screenshot({ path: `${out}${tag}${name}.png` });
const sleep = (ms) => page.waitForTimeout(ms);
const step = (m) => console.log(`• ${m}`);

await page.goto(base, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await sleep(400);
await shot('01-onboarding-welcome');

step('onboarding');
if (arabic) await page.getByRole('button', { name: 'العربية' }).first().click();
else await page.getByRole('button', { name: 'English' }).first().click();
await sleep(200);
await shot('02-onboarding-language');
const next = () => page.locator('.onb-foot .btn.primary').click();
await next();
await page.fill('#name', arabic ? 'Layla' : 'Sam');
await sleep(150);
await shot('03-onboarding-you');
await next();
await sleep(200);
await shot('04-onboarding-level');
await next();
await sleep(200);
await next();
await sleep(200);
await page.locator('.chips.wrap .chip').nth(2).click();
await page.locator('.chips.wrap .chip').nth(4).click();
await page.locator('.chips.wrap .chip').nth(5).click();
await sleep(150);
await shot('05-onboarding-topics');
await next();

step('world');
await afterOnboarding(page, { settleMs: 3000 });
await shot('06-world-start');
assert.equal(await page.locator('.hud').count(), 1, 'HUD is shown');
await page.locator('.tip .btn').click();
await sleep(300);

step('tap a sign');
await page.evaluate(() => window.__world.simulatePick('sakura'));
await sleep(500);
await shot('07-sign-card');
await page.locator('.word-actions .btn.primary').click();
await sleep(300);
await page.locator('.word-close').click();

step('menu');
await page.locator('.icon-btn.glass').first().click();
await sleep(300);
await shot('08-menu');
await page.locator('.icon-btn.glass').first().click();

step('walk to the café and talk');
await page.evaluate(() => window.__world.teleportNear('yuki'));
await sleep(1500);
await shot('09-near-yuki');
await talkToConversation(page);
await sleep(1800);
await shot('10-convo-start');

const sendAssist = async (text, expectJa) => {
  await page.fill('#say', text);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.assist', { timeout: 5000 });
  await sleep(450);
  const card = (await page.locator('.assist .jp').allInnerTexts()).join('');
  if (expectJa) assert.ok(card.includes(expectJa), `assist shows ${expectJa}, got ${card}`);
  return card;
};
const sendCard = async () => {
  await page.locator('.assist .btn.primary').click();
  await sleep(2400);
};

step('say it your way: coffee');
await sendAssist(arabic ? 'أريد قهوة' : "I'd like a coffee", 'コーヒーを');
await shot('11-assist-card');
await sendCard();
await shot('12-after-coffee');
assert.ok((await page.locator('.messages .jp').allInnerTexts()).join('').includes('ホット'), 'asks hot or iced');

step('hint');
await page.getByRole('button', { name: /Hint|تلميح/ }).click();
await sleep(400);
await shot('13-hint');

await sendAssist(arabic ? 'بارد من فضلك' : 'Iced please', 'アイス');
await sendCard();
await sendAssist(arabic ? 'ما هي كلمة سر الواي فاي؟' : "What's the wifi password?", 'パスワード');
await sendCard();
assert.ok((await page.locator('.messages .jp').allInnerTexts()).join('').includes('sakura1234'), 'gets the wifi password');

step('type Japanese, then finish with a suggestion');
await page.fill('#say', 'ありがとうございます');
await page.keyboard.press('Enter');
await sleep(2600);
await page.locator('.sg').nth(0).click(); // card please
await sleep(2800);
await shot('14-convo-done');
assert.ok(await page.locator('.done-card').count(), 'goal complete banner');

step('feedback');
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback');
await sleep(600);
await shot('15-feedback-top');
await page.locator('.panel-body').evaluate((el) => el.scrollTo(0, 700));
await sleep(300);
await shot('16-feedback-mid');
await page.locator('.panel-body').evaluate((el) => el.scrollTo(0, 99999));
await sleep(300);
await shot('17-feedback-bottom');
await page.locator('.panel-foot .btn.primary').click();
await sleep(800);

step('words');
await page.locator('.icon-btn.glass').first().click();
await page.locator('.menu button').nth(0).click();
await page.waitForSelector('.tabs');
await sleep(400);
await shot('18-words-review');
await page.locator('.flash .btn.primary').click();
await sleep(300);
await shot('19-review-answer');
await page.locator('.rate.good').click();
await page.getByRole('tab').nth(1).click();
await sleep(300);
await shot('20-words-list');
await page.locator('.panel-head .icon-btn').first().click();
await sleep(500);

step('progress and settings');
await page.locator('.icon-btn.glass').first().click();
await page.locator('.menu button').nth(1).click();
await page.waitForSelector('.tiles');
await sleep(400);
await shot('21-stats');
await page.locator('.panel-body').evaluate((el) => el.scrollTo(0, 99999));
await sleep(300);
await shot('22-stats-bottom');
await page.locator('.panel-head .icon-btn').first().click();
await sleep(400);
await page.locator('.icon-btn.glass').first().click();
await page.locator('.menu button').nth(2).click();
await page.waitForSelector('.row-switch');
await sleep(300);
await shot('23-settings');
await page.locator('.panel-head .icon-btn').first().click();
await sleep(400);

step('lesson');
await page.evaluate(() => window.__world.teleportNear('hanako'));
await sleep(1200);
await page.locator('.talk-btn').click();
await page.waitForSelector('.lesson');
await sleep(400);
await shot('24-lesson-intro');
await page.locator('.lesson .btn.primary').click();
await sleep(400);
await shot('25-lesson-card');

const errors = logs.filter((l) => /\[pageerror\]|\[error\]/.test(l) && !/Failed to load resource|ERR_CERT|net::|favicon|googleapis|gstatic/.test(l));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
assert.equal(errors.length, 0, 'no page errors');
console.log('e2e ok');
