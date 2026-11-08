import type { SlotOption } from '../types';

/**
 * 銭湯「桜の湯」: `bath` is the entry Genzō sells at the bandai (one adult, menu sento:adult), `towel` the rental towel (sento:rent, an extra
 * slot of the same purchase), `milk` the after-bath bottle (sento:coffee / sento:fruit / sento:plain). The longest key wins, so
 * 「コーヒー牛乳」 is coffee milk, not plain 牛乳.
 */
const raw = (id: string, ja: string, en: string, ar: string, keys: { ja: string[]; en: string[]; ar: string[] }): SlotOption => ({
  id,
  ja,
  gloss: { en, ar },
  keys: { ja: [ja.replace(/\|/g, ''), ...keys.ja], en: keys.en, ar: keys.ar },
});

export const SENTO_SLOTS: Record<string, SlotOption[]> = {
  bath: [raw('adult', '大人', 'one adult', 'بالغ واحد', { ja: ['おとな', 'ひとり', '一人', '1人', '大人一人'], en: ['adult', 'one adult', 'one', 'just me'], ar: ['بالغ', 'شخص بالغ', 'واحد'] })],
  towel: [
    raw('rent', '貸しタオル', 'a rental towel', 'منشفة مستأجرة', {
      ja: ['タオル', 'かしたおる', 'かりたい', '借りたい', 'かして', '貸して'],
      en: ['towel', 'a towel', 'rent a towel', 'rental towel'],
      ar: ['منشفة', 'استئجار منشفة'],
    }),
  ],
  milk: [
    raw('coffee', 'コーヒー牛乳', 'coffee milk', 'حليب بالقهوة', { ja: ['こーひーぎゅうにゅう', 'コーヒー'], en: ['coffee milk', 'coffee'], ar: ['حليب بالقهوة', 'قهوة'] }),
    raw('fruit', 'フルーツ牛乳', 'fruit milk', 'حليب بالفواكه', { ja: ['ふるーつぎゅうにゅう', 'フルーツ'], en: ['fruit milk', 'fruit'], ar: ['حليب بالفواكه', 'فواكه'] }),
    raw('plain', '牛乳', 'milk', 'حليب', { ja: ['ぎゅうにゅう', 'ミルク'], en: ['milk', 'plain milk'], ar: ['حليب', 'حليب عادي'] }),
  ],
};
