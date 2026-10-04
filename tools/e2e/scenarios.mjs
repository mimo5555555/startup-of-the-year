// Plays every scenario to the end through the UI by tapping the first suggestion, and reports render cost.
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';

const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';

const { browser, page, logs } = await launch({ width: 412, height: 860, dpr: 1 });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(base, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await page.getByRole('button', { name: 'English' }).first().click();
const next = () => page.locator('.onb-foot .btn.primary').click();
await next();
await page.fill('#name', 'Layla');
await next();
await next();
await next();
for (const i of [0, 2, 18]) await page.locator('.chips.wrap .chip').nth(i).click();
await next();
await page.waitForFunction(() => !!window.__world, null, { timeout: 30000 });
await sleep(2500);
await page.locator('.tip .btn').click();

const info = await page.evaluate(() => {
  const r = window.__world.renderer.info.render;
  return { calls: r.calls, triangles: r.triangles, geometries: window.__world.renderer.info.memory.geometries, textures: window.__world.renderer.info.memory.textures, quality: window.__world.getQuality() };
});
console.log('render cost at the start:', JSON.stringify(info));

for (const [id, name] of [['tanaka', 'konbini'], ['sato', 'station'], ['kenji', 'ramen'], ['mio', 'park']]) {
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await sleep(900);
  await page.locator('.talk-btn').click();
  await page.waitForSelector('.msg.char', { timeout: 8000 });
  let guard = 0;
  while (!(await page.locator('.done-card').count()) && guard++ < 14) {
    await sleep(1700);
    const n = await page.locator('.sg').count();
    if (n) await page.locator('.sg').nth(0).click();
  }
  await sleep(1700);
  assert.ok(await page.locator('.done-card').count(), `${name}: finished`);
  const goals = await page.locator('.goal.done').count();
  const total = await page.locator('.goal').count();
  console.log(`✓ ${name}: ${goals}/${total} goals`);
  await page.screenshot({ path: `${out}scn-${name}.png` });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback');
  await page.locator('.panel-foot .btn.primary').click();
  await sleep(700);
}

const errors = logs.filter((l) => /\[pageerror\]|\[error\]/.test(l) && !/Failed to load resource|ERR_CERT|net::|favicon|googleapis|gstatic/.test(l));
await browser.close();
assert.equal(errors.length, 0, errors.join('\n'));
console.log('scenarios ok');
