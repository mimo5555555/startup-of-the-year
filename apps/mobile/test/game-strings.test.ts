import { describe, expect, it } from 'vitest';
import { STRINGS, translate } from '../src/i18n';

// Every key of docs/GAME_DESIGN.md §7.6. 1A pastes them; later agents only add keys to their own module.
const GAME_KEYS = [
  'hud.wallet', 'hud.ic', 'hud.points', 'hud.workHours', 'hud.moreYen', 'hud.nextUp', 'hud.moreGoals', 'hud.pace', 'hud.softCap', 'hud.cantListen',
  'shop.taxIncluded', 'shop.notEnough', 'shop.closed', 'shop.opensIn', 'shop.someday', 'shop.goods', 'shop.delivery', 'shop.owned', 'shop.window',
  'receipt.subtotal', 'receipt.tax', 'receipt.total', 'receipt.paid', 'receipt.change',
  'debrief.stars', 'debrief.yenTitle', 'debrief.nudge', 'debrief.keep', 'debrief.sayIt', 'debrief.echoPaid',
  'prep.title', 'prep.skip', 'prep.ready', 'prep.mode.guided', 'prep.mode.real', 'prep.recall', 'prep.peek', 'prep.build',
  'dream.title', 'dream.pick', 'dream.later', 'dream.change', 'dream.step', 'dream.locked', 'dream.done',
  'quests.tab.dream', 'quests.tab.story', 'quests.tab.today', 'quests.tab.friends', 'quests.tab.culture',
  'quests.chapter', 'quests.chapterDone', 'quests.trio', 'quests.swap', 'quests.locked', 'quests.waitDays', 'quests.easier', 'quests.fromYesterday', 'quests.hintFriends',
  'social.hearts', 'social.next', 'social.gift', 'social.card', 'social.heartUp', 'social.notYet',
  'phone.title', 'phone.voice', 'phone.reveal', 'phone.unread',
  'jobs.start', 'jobs.helping', 'jobs.showText', 'jobs.showTrans', 'jobs.pay', 'jobs.rest',
  'home.shoesOff', 'home.slippers',
  'culture.new', 'letter.title', 'story.nameKana',
  'audio.consent', 'audio.consentKids', 'audio.parentGate', 'audio.listenOff',
];

const en = STRINGS.en as Record<string, string>;
const ar = STRINGS.ar as Record<string, string>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('game strings (§7.6)', () => {
  it('has every key, in English and Arabic', () => {
    for (const k of GAME_KEYS) {
      expect(en[k]?.trim(), `en ${k}`).toBeTruthy();
      expect(ar[k]?.trim(), `ar ${k}`).toBeTruthy();
    }
  });

  it('Arabic text contains Arabic and English text contains no Arabic', () => {
    for (const k of GAME_KEYS) {
      expect(ar[k], `ar ${k}`).toMatch(/[؀-ۿ]/);
      expect(en[k], `en ${k}`).not.toMatch(/[؀-ۿ]/);
    }
  });

  it('keeps Latin digits in both languages', () => {
    for (const k of Object.keys(en)) {
      expect(en[k], `en ${k}`).not.toMatch(/[٠-٩۰-۹]/);
      expect(ar[k], `ar ${k}`).not.toMatch(/[٠-٩۰-۹]/);
    }
  });
});

describe('every string key', () => {
  it('exists in both languages with the same {placeholders}', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    const bad: string[] = [];
    for (const k of Object.keys(en)) {
      if (!en[k].trim() || !ar[k]?.trim()) bad.push(`${k}: empty`);
      else if (placeholders(en[k]).join() !== placeholders(ar[k]).join()) bad.push(`${k}: ${placeholders(en[k])} vs ${placeholders(ar[k])}`);
    }
    expect(bad).toEqual([]);
  });

  it('fills placeholders in translate()', () => {
    expect(translate('en', 'hud.moreYen', { n: 1500 })).toBe('¥1500 to go');
    expect(translate('ar', 'hud.moreYen', { n: 1500 })).toBe('بقي ¥1500');
    expect(translate('en', 'social.next', { n: 2, what: 'a gift' })).toBe('Next at 2 hearts: a gift');
  });
});
