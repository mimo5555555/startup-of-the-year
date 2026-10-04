// Audio check walkthrough: Settings > Microphone & speaker check, with fake media devices and mic permission granted.
// Usage: node tools/e2e/audio.mjs   (dev server must be running; BASE and SHOTS override the URL and screenshot folder)
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { chromiumPath } from './browser.mjs';

const out = (process.env.SHOTS ?? '/tmp/claude-0/-home-user-startup-of-the-year/56fcd5ff-0c95-5d74-a25c-f57776da4375/scratchpad/shots').replace(/\/?$/, '/');
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--enable-webgl', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const context = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'en-US', permissions: ['microphone'] });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const sleep = (ms) => page.waitForTimeout(ms);
const step = (m) => console.log(`• ${m}`);
const shot = (name) => page.screenshot({ path: `${out}${name}.png` });
const shotCard = async (name) => {
  await page.setViewportSize({ width: 412, height: 1500 }); // tall enough to capture the whole card
  await sleep(150);
  await page.locator('.au').screenshot({ path: `${out}${name}.png` });
  await page.setViewportSize({ width: 412, height: 860 });
};

await page.goto(base, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');

step('onboarding');
await page.getByRole('button', { name: 'English' }).first().click();
const next = () => page.locator('.onb-foot .btn.primary').click();
await next();
await page.fill('#name', 'Sam');
await next();
await next();
await next();
await page.locator('.chips.wrap .chip').nth(2).click();
await page.locator('.chips.wrap .chip').nth(4).click();
await page.locator('.chips.wrap .chip').nth(5).click();
await next();
await page.waitForFunction(() => !!window.__world, null, { timeout: 30000 });
await sleep(1500);
await page.locator('.tip .btn').click().catch(() => {});

step('open settings');
await page.locator('.icon-btn.glass').first().click();
await page.locator('.menu button').nth(2).click();
await page.waitForSelector('#audio-check .au');

const rowsText = async () => (await page.locator('.au-row').allInnerTexts()).join(' | ');
await page.waitForFunction(() => document.querySelectorAll('.au-row:not(.skel)').length === 6, null, { timeout: 5000 });
const text = await rowsText();
console.log(text.replace(/\n/g, ' '));
for (const label of ['Speaker', 'Japanese voices', 'Microphone permission', 'Speech recognition', 'Secure connection', 'Opened directly']) assert.ok(text.includes(label), `row ${label}`);
assert.equal(await page.getByRole('button', { name: 'Test speaker' }).count(), 1);
assert.equal(await page.getByRole('button', { name: 'Test microphone' }).count(), 1);
await sleep(300);
await shotCard('audio-en-initial');

step('44px targets');
for (const b of await page.locator('.au-actions .btn').all()) {
  const box = await b.boundingBox();
  assert.ok(box && box.height >= 44, `button height ${box?.height}`);
}

step('allow microphone');
await page.getByRole('button', { name: 'Allow microphone' }).click();
await page.waitForFunction(() => /Microphone allowed/.test(document.querySelector('[data-testid="au-allow"]')?.textContent ?? ''), null, { timeout: 8000 });
await page.waitForFunction(() => /Allowed/.test(document.querySelectorAll('.au-row')[2]?.textContent ?? ''), null, { timeout: 8000 });
console.log('permission row:', (await page.locator('.au-row').nth(2).innerText()).replace(/\n/g, ' '));

step('test speaker');
await page.getByRole('button', { name: 'Test speaker' }).click();
await page.waitForFunction(() => !/Playing/.test(document.querySelector('[data-testid="au-speaker"]')?.textContent ?? 'Playing'), null, { timeout: 15000 });
console.log('speaker:', (await page.locator('[data-testid="au-speaker"]').innerText()).replace(/\n/g, ' '));

step('test microphone');
await page.getByRole('button', { name: 'Test microphone' }).click();
await sleep(1200);
const micTxt = (await page.locator('[data-testid="au-mic"]').innerText()).replace(/\n/g, ' ');
console.log('mic:', micTxt);
await shotCard('audio-en-mic');
await page.locator('.au-actions .btn').nth(2).click().catch(() => {});
await sleep(2500);
console.log('mic after:', (await page.locator('[data-testid="au-mic"]').innerText()).replace(/\n/g, ' '));
await shotCard('audio-en-after');
await shot('audio-en-settings');

step('arabic');
await page.locator('#audio-check').evaluate((el) => el.closest('.panel-body').scrollTo(0, 0));
await page.getByRole('button', { name: 'العربية' }).first().click();
await sleep(600);
await page.getByRole('button', { name: 'السماح بالميكروفون' }).click();
await page.waitForFunction(() => /تم السماح/.test(document.querySelector('[data-testid="au-allow"]')?.textContent ?? ''), null, { timeout: 8000 });
await page.getByRole('button', { name: 'اختبار السماعة' }).click();
await page.waitForFunction(() => !/جارٍ التشغيل/.test(document.querySelector('[data-testid="au-speaker"]')?.textContent ?? 'جارٍ التشغيل'), null, { timeout: 15000 });
await sleep(300);
await shotCard('audio-ar');
await page.locator('.au-actions .btn').nth(2).click();
await sleep(1200);
await shotCard('audio-ar-mic');
await shot('audio-ar-settings');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 || document.querySelector('.panel-body').scrollWidth > document.querySelector('.panel-body').clientWidth + 1);
assert.equal(overflow, false, 'no horizontal overflow');

const errors = logs.filter((l) => /\[pageerror\]|\[error\]/.test(l) && !/Failed to load resource|ERR_CERT|net::|favicon|googleapis|gstatic/.test(l));
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
assert.equal(errors.length, 0, 'no page errors');
console.log('audio e2e ok');
