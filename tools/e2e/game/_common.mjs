// Shared helpers of the game e2e scripts (underscore: tools/e2e/game.mjs does not run it as a script).
// The app publishes `window.__lw = { dispatch, getGame, useGame, useStore, useUi }` for these scripts.
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launch } from '../browser.mjs';

export const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
export const GAME_KEY = 'lw.game.jp.v1';
export const LEGACY_KEY = 'lw.v1.state';
export const DAY_MS = 86_400_000;
const shots = new URL('../shots/game/', import.meta.url).pathname;

/**
 * How far the page's `Date` is moved from the real clock (ms). The festival day rule reads the local date: in Chapter 8 and Free Walk the park is
 * the festival every Saturday (docs/GAME_DESIGN.md §7.2), so a script that plays there passes `weekday: true` and a Thursday to Sunday moves on
 * to the next Monday (three days before any Saturday; `advance_day` moves play days, not the date). `E2E_NOW` (an ISO date-time) runs a script
 * as if it were then, e.g. `E2E_NOW=2026-10-24T10:00` for a Saturday.
 */
export function clockShift({ weekday = false } = {}) {
  const base = process.env.E2E_NOW ? new Date(process.env.E2E_NOW).getTime() : Date.now();
  if (!Number.isFinite(base)) throw new Error(`E2E_NOW is not a date: ${process.env.E2E_NOW}`);
  const day = new Date(base).getDay();
  const ahead = weekday && (day === 0 || day >= 4) ? (8 - day) % 7 : 0;
  return base - Date.now() + ahead * DAY_MS;
}

/** A 360 px wide phone (the narrowest the game must work on), English or Arabic. `weekday`: see `clockShift`. */
export async function start(name, { arabic = process.argv.includes('--ar'), width = 360, height = 780, weekday = false } = {}) {
  mkdirSync(shots, { recursive: true });
  const { browser, context, page, logs } = await launch({ width, height, dpr: 1, locale: arabic ? 'ar-EG' : 'en-US' });
  const shift = clockShift({ weekday });
  // only `Date` moves (timers and animation frames keep real time); `new Date(x)` with an argument is untouched
  if (shift)
    await context.addInitScript((off) => {
      const Real = Date;
      function Shifted(...a) {
        if (!new.target) return new Real(Real.now() + off).toString();
        return a.length ? new Real(...a) : new Real(Real.now() + off);
      }
      Shifted.prototype = Real.prototype;
      Shifted.now = () => Real.now() + off;
      Shifted.parse = Real.parse;
      Shifted.UTC = Real.UTC;
      globalThis.Date = Shifted;
    }, shift);
  const tag = arabic ? 'ar-' : '';
  const t = {
    browser,
    context,
    page,
    logs,
    arabic,
    /** the page's clock (ms): `Date.now()` as the page sees it */
    now: () => Date.now() + shift,
    shot: (n) => page.screenshot({ path: `${shots}${name}-${tag}${n}.png` }),
    sleep: (ms) => page.waitForTimeout(ms),
    step: (m) => console.log(`• ${m}`),
  };
  return t;
}

/** Fails the script on console errors (the same noise filter as tools/e2e/run.mjs). */
export function assertNoConsoleErrors(logs) {
  const errors = logs.filter((l) => /\[pageerror\]|\[error\]/.test(l) && !/Failed to load resource|ERR_CERT|net::|favicon|googleapis|gstatic/.test(l));
  if (errors.length) console.log(`console errors:\n${errors.join('\n')}`);
  assert.equal(errors.length, 0, 'no console errors');
}

/** No horizontal scroll at the viewport width (§15.9: every game e2e asserts it). */
export async function assertNoHScroll(page, where) {
  const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, body: document.body.scrollWidth }));
  assert.ok(w.scroll <= w.client && w.body <= w.client, `${where}: horizontal scroll (${JSON.stringify(w)})`);
}

/** Clears storage and walks the real onboarding to the world (as tools/e2e/run.mjs does). */
export async function onboard(page, { arabic = false, name = 'Sam' } = {}) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.onb');
  await page.getByRole('button', { name: arabic ? 'العربية' : 'English' }).first().click();
  const next = () => page.locator('.onb-foot .btn.primary').click();
  await next();
  await page.fill('#name', name);
  await next();
  await next();
  await next();
  await page.locator('.chips.wrap .chip').nth(2).click();
  await page.locator('.chips.wrap .chip').nth(4).click();
  await page.locator('.chips.wrap .chip').nth(5).click();
  await next();
  await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
}

/** Makes the app write both saves now (what pagehide does), then reads the game save as the app wrote it. */
export async function savedGame(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
}

export const gameState = async (page) => (await savedGame(page))?.state;

/** The state the app holds in memory (no wait for a write). */
export const liveGame = (page) => page.evaluate(() => window.__lw.getGame());

/** Plays through any story beats that are waiting (the stub and the real StoryBeat both end with the primary button; a closing beat's diary step is skipped). */
export async function skipBeats(page, { max = 12 } = {}) {
  for (let i = 0; i < max; i++) {
    const on = await page.evaluate(() => window.__lw.useStore.getState().screen === 'beat');
    if (!on) return i;
    await page.locator('.panel .btn.primary:not(:disabled), .panel [data-step=diary] [data-skip]').last().click();
    await page.waitForTimeout(250);
  }
  throw new Error('story beats did not end');
}

/** Opens Settings from the world menu. */
export async function openSettings(page) {
  await page.evaluate(() => window.__lw.useStore.getState().go('settings'));
  await page.waitForSelector('.row-switch');
}

/** Opens a same-origin page that does not run the app, so storage can be edited without the app's pagehide flush overwriting it. */
export async function openBlank(page) {
  await page.route(`${BASE}__blank.html`, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' }));
  await page.goto(`${BASE}__blank.html`, { waitUntil: 'load' });
}
