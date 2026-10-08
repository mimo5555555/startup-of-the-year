// Movement, collision and tap-to-move checks, plus a few overview screenshots of the city.
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';
import { afterOnboarding, talkToConversation } from './flow.mjs';

const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const { browser, page, logs } = await launch({ width: 412, height: 860, dpr: 1 });
const sleep = (ms) => page.waitForTimeout(ms);
const snap = () => page.evaluate(() => window.__world.snapshot());

await page.goto(base, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await page.getByRole('button', { name: 'English' }).first().click();
const next = () => page.locator('.onb-foot .btn.primary').click();
await next();
await page.fill('#name', 'Sam');
await next();
await next();
await next();
for (const i of [0, 1, 2]) await page.locator('.chips.wrap .chip').nth(i).click();
await next();
await afterOnboarding(page, { settleMs: 2000 });
await page.locator('.tip .btn').click();

const a = await snap();
await page.keyboard.down('d');
await sleep(1500);
await page.keyboard.up('d');
const b = await snap();
console.log('walked right:', a.player.x.toFixed(2), '->', b.player.x.toFixed(2));
assert.notEqual(Math.round(a.player.x), Math.round(b.player.x), 'WASD moves the player');

// walk north into the shop front: bounds keep the player on the sidewalk
await page.evaluate(() => window.__world.teleportNear('hanako'));
await sleep(500);
await page.keyboard.down('w');
await sleep(2500);
await page.keyboard.up('w');
const c = await snap();
console.log('pushed against the school front, z =', c.player.z.toFixed(2));
assert.ok(c.player.z >= -8.31, 'cannot walk into the building');

// walk south across the road into the park hedge: collision stops at the hedge, not inside it
await page.evaluate(() => window.__world.walkTo(-20, 8.4));
await sleep(5000);
await page.keyboard.down('s');
await sleep(3500);
await page.keyboard.up('s');
const d = await snap();
console.log('pushed against the park hedge at x =', d.player.x.toFixed(1), 'z =', d.player.z.toFixed(2));
assert.ok(d.player.z < 9.1, 'the hedge blocks the way');

// tap the ground: the character walks there
await page.evaluate(() => window.__world.teleportNear('yuki'));
await sleep(500);
const e = await snap();
await page.mouse.click(206, 700); // ground in front of the camera
await sleep(2500);
const f = await snap();
console.log('tap-to-move:', JSON.stringify([e.player.x.toFixed(1), e.player.z.toFixed(1)]), '->', JSON.stringify([f.player.x.toFixed(1), f.player.z.toFixed(1)]));
assert.ok(Math.hypot(f.player.x - e.player.x, f.player.z - e.player.z) > 1, 'tap moves the player');

// the nearby prompt follows the player
await page.evaluate(() => window.__world.teleportNear('kenji'));
await sleep(600);
assert.ok(await page.locator('.talk-btn').count(), 'talk button near Kenji');
await page.screenshot({ path: `${out}tour-ramen.png` });
await page.evaluate(() => window.__world.teleportNear('sato'));
await sleep(1200);
await page.screenshot({ path: `${out}tour-station.png` });
await page.evaluate(() => window.__world.teleportNear('mio'));
await sleep(1200);
await page.screenshot({ path: `${out}tour-park.png` });
await page.evaluate(() => window.__world.teleportNear('tanaka'));
await sleep(1200);
await page.screenshot({ path: `${out}tour-konbini.png` });

const errors = logs.filter((l) => /\[pageerror\]|\[error\]/.test(l) && !/Failed to load resource|ERR_CERT|net::|favicon|googleapis|gstatic/.test(l));
await browser.close();
assert.equal(errors.length, 0, errors.join('\n'));
console.log('movement ok');
