// Shared by shift.mjs and chapters56.mjs (Release 2 wave C1): what the café and the station desk customers want, and how a script plays them
// through the real Shift screen (tap the widget, confirm, then say the answer). The tables know the customers by their template id; the screen
// never shows the answer. `how.answer`: 'type' (default) types the totals and the send-off, 'pick' taps "Choose from three" (credit 0.35, the
// same accuracy), so a shift can be played by tapping only.
import assert from 'node:assert/strict';
import { assertNoHScroll } from './_common.mjs';

export const CAFE = {
  c_one: { items: { latte: 1 }, flags: ['hot'] },
  c_tea: { items: { blackTea: 1 }, flags: ['hot'] },
  c_cake: { items: { cake: 2 } },
  c_juice: { items: { juice: 3 } },
  c_two: { items: { coffee: 2 }, flags: ['iced'], table: 3 },
  c_table: { items: { coffee: 3 }, flags: ['hot'], table: 2 },
  c_sweet: { items: { greenTea: 1, cake: 2 } },
  c_change: { items: { latte: 1 }, flags: ['iced'] },
  c_change2: { items: { blackTea: 1 } },
  c_split: { items: { coffee: 1, cake: 1 }, split: true },
  c_note: { items: { latte: 1 }, paid: 1000 },
};
export const CAFE_PRICE = { coffee: 450, blackTea: 420, greenTea: 400, latte: 520, juice: 480, cake: 480 };
export const STATION = {
  s_platform: { kind: 'platform', n: 3, say: '三番線です' },
  s_platform2: { kind: 'platform', n: 1, say: '一番線です' },
  s_dir: { kind: 'direction', dir: 'right', say: '右です' },
  s_dir2: { kind: 'direction', dir: 'left', say: '左です' },
  s_dir3: { kind: 'direction', dir: 'straight', say: 'まっすぐです' },
  s_time: { kind: 'time', time: '9:58', say: '九時五十八分です' },
  s_time2: { kind: 'time', time: '14:25', say: '十四時二十五分です' },
  s_fare: { kind: 'fare', fare: 'hikarigaoka:ic', say: '百七十円です' },
  s_fare2: { kind: 'fare', fare: 'shinjuku:paper', say: '二百円です' },
  s_announce: { kind: 'announce', n: 2, say: '二番線です' },
  s_announce2: { kind: 'announce', n: 4, say: '四番線です' },
};

/** Every button of the pad is at least 44 px tall and inside the 360 px screen (the small remove cross of an item is the konbini's own and exempt). */
export async function assertPadTargets(page, root, where) {
  const bad = await page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(`${sel} button:not(.sh-minus)`)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 43.5 || r.width < 43.5 || r.right > innerWidth + 1 || r.left < -1) out.push(`${el.className} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)}`);
    }
    return out;
  }, root);
  assert.deepEqual(bad, [], `${where}: pad targets under 44 px or outside the screen`);
}

export function jobHelpers(page, t) {
  /** One production step of the Shift screen: typed, or by "Choose from three". */
  async function say(how, text) {
    if (how.answer === 'pick') {
      await page.locator('[data-act=help-pick]').click();
      await page.locator('[data-choice=right]').click();
    } else {
      await page.locator('#sh-say').fill(text);
      await page.locator('[data-act=say]').click();
    }
  }

  /** Plays one customer of the café. Returns its template id. */
  async function serveCafe(how = {}) {
    await page.waitForSelector('[data-customer]');
    const id = await page.locator('[data-customer]').getAttribute('data-customer');
    const a = CAFE[id];
    assert.ok(a, `known café customer ${id}`);
    await page.waitForSelector('[data-order]');
    assert.equal(await page.locator('[data-tables]').count(), 1, 'the table picker is on the café order pad');
    for (const [item, q] of Object.entries(a.items)) for (let k = 0; k < q; k++) await page.locator(`.sh-item[data-item=${item}] .sh-item-main`).click();
    for (const f of a.flags ?? []) await page.locator(`[data-flag=${f}]`).click();
    if (a.table) await page.locator(`[data-table="${a.table}"]`).click();
    if (how.shot && !serveCafe.shot) {
      serveCafe.shot = true;
      await assertNoHScroll(page, 'café order pad');
      await assertPadTargets(page, '[data-order]', 'café order pad');
      await t.shot(how.shot);
    }
    await page.locator('[data-act=confirm-order]').click();
    const lines = Object.entries(a.items).map(([k, q]) => CAFE_PRICE[k] * q);
    const sum = lines.reduce((x, y) => x + y, 0);
    await page.waitForSelector('[data-answer$=":total"]');
    await say(how, `${a.split ? lines[0] : sum}円`);
    if (a.split) {
      await page.waitForSelector('[data-answer$=":change"]');
      if (how.shot && !serveCafe.splitShot) {
        serveCafe.splitShot = true;
        await t.shot(`${how.shot}-split`);
      }
      await say(how, `${lines.slice(1).reduce((x, y) => x + y, 0)}円`);
    }
    if (a.paid) {
      await page.waitForSelector('[data-answer$=":change"]');
      await say(how, `${a.paid - sum}`);
    }
    await page.waitForSelector('[data-answer$=":thanks"]');
    await say(how, 'お待たせしました');
    await page.waitForSelector('[data-done]');
    return id;
  }

  /** Plays one customer of the station desk: tap on the board / plan / timetable / fare table, confirm, then say the answer and the send-off. */
  async function serveStation(how = {}) {
    await page.waitForSelector('[data-customer]');
    const id = await page.locator('[data-customer]').getAttribute('data-customer');
    const a = STATION[id];
    assert.ok(a, `known station customer ${id}`);
    if (how.assist === 'text') {
      await page.locator('[data-act=show-text]').click();
      await page.waitForSelector('[data-line]');
    }
    await page.waitForSelector(`[data-desk=${a.kind}]`);
    const pick =
      a.kind === 'platform' || a.kind === 'announce' ? `[data-platform="${a.n}"]` : a.kind === 'direction' ? `[data-dir=${a.dir}]` : a.kind === 'time' ? `[data-time="${a.time}"]` : `[data-fare="${a.fare}"]`;
    assert.equal(await page.locator('[data-act=confirm-order]').isDisabled(), true, 'nothing is chosen yet: Confirm waits');
    await page.locator(pick).click();
    if (how.shots && !serveStation.shot?.[a.kind]) {
      (serveStation.shot ??= {})[a.kind] = true;
      await assertNoHScroll(page, `station ${a.kind}`);
      await assertPadTargets(page, '[data-desk]', `station ${a.kind} widget`);
      await t.shot(`${how.shots}-${a.kind}`);
    }
    await page.locator('[data-act=confirm-order]').click();
    await page.waitForSelector('[data-answer$=":total"]');
    await say(how, a.say);
    await page.waitForSelector('[data-answer$=":thanks"]');
    await say(how, 'お気をつけて');
    await page.waitForSelector('[data-done]');
    return id;
  }

  /** Plays a whole shift with `serveOne`, ends on the result card, returns the customers' ids. */
  async function playJob(serveOne, how = {}) {
    await page.locator('[data-act=start-shift]').click();
    await page.waitForSelector('[data-customer]');
    const ids = [];
    for (let n = 1; n <= 5; n++) {
      ids.push(await serveOne({ ...how, assist: how.assistAt === n ? 'text' : undefined }));
      await page.locator('[data-act=next-customer]').click();
      await t.sleep(150);
    }
    await page.waitForSelector('[data-shift-card=result]');
    return ids;
  }

  return { serveCafe, serveStation, playJob };
}
