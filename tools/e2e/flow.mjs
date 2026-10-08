// Steps the original e2e scripts share now that the game is on: the opening beat plays after onboarding, and a character with a pocket to
// study (or several options) opens Prepare (or the Interaction sheet) before the conversation. These helpers play through both so the
// scripts keep checking what they always checked (the look of the world, the conversation, the five scenarios).
import { skipBeats } from './game/_common.mjs';

/** After the last onboarding step: waits for the world and the game, then plays the opening beat (the real StoryBeat) to its end. */
export async function afterOnboarding(page, { settleMs = 2500 } = {}) {
  await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
  await page.waitForTimeout(settleMs);
  await skipBeats(page).catch(() => {});
  await page.waitForTimeout(400);
}

/** Presses Talk and gets to the conversation: the sheet's first open option, then Prepare's Skip, whichever show up. */
export async function talkToConversation(page, { timeout = 15000 } = {}) {
  await page.locator('.talk-btn').click();
  await page.waitForSelector('.msg.char, .prep, .hud-sheet', { timeout });
  if (await page.locator('.hud-sheet').count()) {
    await page.locator('.hud-opt:not(.alt):not(.locked)').first().click();
    await page.waitForSelector('.msg.char, .prep', { timeout });
  }
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.msg.char', { timeout });
}
