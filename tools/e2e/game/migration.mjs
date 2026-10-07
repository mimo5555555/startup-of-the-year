// Migration (docs/GAME_DESIGN.md §14.7): a profile that only has the legacy save `lw.v1.state` (no game save) is seeded once from
// its `completed` map: no retroactive yen, wallet at the pack's start cash, `seeded = true`; a reload keeps it and does not seed again.
// Usage: node tools/e2e/game/migration.mjs [--ar]   (BASE overrides the URL)
import assert from 'node:assert/strict';
import { BASE, GAME_KEY, LEGACY_KEY, assertNoConsoleErrors, assertNoHScroll, gameState, liveGame, openBlank, skipBeats, start } from './_common.mjs';

const t = await start('migration');
const { page } = t;

// a v1-only profile: someone who played the sample before the game existed
const legacy = {
  profile: {
    name: 'Old Player',
    l1: t.arabic ? 'ar' : 'en',
    level: 'A1',
    goal: 'travel',
    age: 'adults',
    topics: ['food', 'music', 'anime'],
    avatar: { skin: '#f3cdb0', hair: { style: 'short', color: '#3a2b2a' }, top: '#4f86f7', bottom: '#343b55', shoes: '#f5f5f5', accent: '#ffd166', accessories: ['backpack'] },
    createdAt: '2026-09-01T09:00:00.000Z',
  },
  vocab: [],
  xp: 340,
  streak: { days: 3, freezes: 1, lastActive: null },
  days: {},
  loops: [],
  completed: { cafe: { count: 2, best: 100 }, konbini: { count: 1, best: 60 } },
  lessonsDone: ['greetings'],
  discovered: ['vending'],
  errors: {},
  settings: { furigana: true, romaji: false, autoSpeak: false, autoTranslate: false, graphics: 'low', seenTutorial: true },
  uiLang: t.arabic ? 'ar' : 'en',
};

t.step('load a v1-only profile (no game save yet)');
// seed the storage from a same-origin page that does not run the app: a running app flushes its (empty) state on pagehide and would overwrite the fixture
await openBlank(page);
await page.evaluate(([k, v]) => localStorage.clear() || localStorage.setItem(k, v), [LEGACY_KEY, JSON.stringify(legacy)]);
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw?.useGame?.getState().hydrated, null, { timeout: 60000 });
await skipBeats(page).catch(() => {});
await t.sleep(600);
await t.shot('01-seeded-world');

t.step('the game store seeded once from the legacy progress');
const g1 = await gameState(page);
assert.ok(g1, 'a game save was written');
assert.equal(g1.v, 1);
assert.equal(g1.packId, 'jp');
assert.equal(g1.seeded, true, 'seeded');
assert.equal(g1.wallet.cash, 3000, 'wallet at the start cash, no retroactive yen');
assert.equal(g1.totals.earned, 0);
// the cafe run is ★2 (best >= 100); where it lives depends on whether the pack knows the scenario yet (runs) or not (_extra)
const cafe = g1.runs.cafe?.stars ?? g1._extra?.fields?.legacyCompleted?.cafe;
assert.ok(cafe, 'the cafe progress was carried over');
if (g1.runs.cafe) assert.equal(g1.runs.cafe.stars, 2);
// the legacy save is untouched (vocabulary, XP, settings stay there)
const v1 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), LEGACY_KEY);
assert.equal(v1.xp, 340);
assert.deepEqual(v1.completed, legacy.completed);
await assertNoHScroll(page, 'seeded world');

t.step('reload: the seed is kept and does not run again');
// legacy progress made meanwhile must not be seeded (it already counts in the game through play); edit it while the app is not running
await openBlank(page);
await page.evaluate((k) => {
  const s = JSON.parse(localStorage.getItem(k));
  s.completed.ramen = { count: 3, best: 100 };
  localStorage.setItem(k, JSON.stringify(s));
}, LEGACY_KEY);
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw?.useGame?.getState().hydrated, null, { timeout: 60000 });
await skipBeats(page).catch(() => {});
await t.sleep(600);
const g2 = await liveGame(page);
assert.equal(g2.seeded, true);
assert.equal(g2.runs.ramen, undefined, 'ramen was not seeded the second time');
assert.equal(g2._extra?.fields?.legacyCompleted?.ramen, undefined, 'nor parked');
assert.equal(g2.wallet.cash, 3000);
assert.equal(JSON.stringify(g2.runs), JSON.stringify(g1.runs), 'runs unchanged');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('migration ok');
