import type { SlotOption } from '../types';

/**
 * The karaoke box: `hours` is what Nanami sells at the desk (option ids h1 / h2 are the item map's keys for the menu ids karaoke:h1 /
 * karaoke:h2), `karaokeDrink` is the free drink ordered from the room's phone (the drink bar comes with the room).
 */
const raw = (id: string, ja: string, en: string, ar: string, keys: { ja: string[]; en: string[]; ar: string[] }): SlotOption => ({
  id,
  ja,
  gloss: { en, ar },
  keys: { ja: [ja.replace(/\|/g, ''), ...keys.ja], en: keys.en, ar: keys.ar },
});

export const KARAOKE_SLOTS: Record<string, SlotOption[]> = {
  hours: [
    raw('h1', '一時間', 'one hour', 'ساعة واحدة', { ja: ['いちじかん', '1時間'], en: ['one hour', '1 hour', 'an hour', 'one'], ar: ['ساعة', 'ساعة واحدة', '1'] }),
    raw('h2', '二時間', 'two hours', 'ساعتان', { ja: ['にじかん', '2時間'], en: ['two hours', '2 hours', 'two'], ar: ['ساعتين', 'ساعتان', '2'] }),
  ],
  karaokeDrink: [
    raw('oolong', 'ウーロン茶', 'oolong tea', 'شاي أولونغ', { ja: ['うーろんちゃ', 'ウーロン', 'うーろん'], en: ['oolong', 'oolong tea', 'tea'], ar: ['أولونغ', 'شاي أولونغ', 'شاي'] }),
    raw('cola', 'コーラ', 'cola', 'كولا', { ja: ['こーら'], en: ['cola', 'coke', 'a cola'], ar: ['كولا', 'كوكا'] }),
    raw('melon', 'メロンソーダ', 'melon soda', 'صودا البطيخ', { ja: ['めろんそーだ', 'メロン', 'めろん'], en: ['melon soda', 'melon', 'soda'], ar: ['صودا البطيخ', 'بطيخ', 'صودا'] }),
  ],
};
