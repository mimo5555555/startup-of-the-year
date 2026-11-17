import type { SlotOption } from '../types';

/**
 * 居酒屋「なごみ」: `izaDrink` the drinks (izakaya:oolong / orange / beer; beer only for an adult), `izaFood` the dish to share
 * (izakaya:yakitori / edamame / karaage), `billSplit` how the bill is paid (half = 割り勘: the player pays one of two shares).
 */
const raw = (id: string, ja: string, en: string, ar: string, keys: { ja: string[]; en: string[]; ar: string[] }): SlotOption => ({
  id,
  ja,
  gloss: { en, ar },
  keys: { ja: [ja.replace(/\|/g, ''), ...keys.ja], en: keys.en, ar: keys.ar },
});

export const IZAKAYA_SLOTS: Record<string, SlotOption[]> = {
  izaDrink: [
    raw('oolong', 'ウーロン茶', 'oolong tea', 'شاي أولونغ', { ja: ['うーろんちゃ', 'ウーロン', 'うーろん'], en: ['oolong', 'oolong tea', 'tea'], ar: ['أولونغ', 'شاي أولونغ', 'شاي'] }),
    raw('orange', 'オレンジジュース', 'orange juice', 'عصير البرتقال', { ja: ['おれんじじゅーす', 'オレンジ', 'おれんじ', 'ジュース', 'じゅーす'], en: ['orange juice', 'orange', 'juice'], ar: ['عصير البرتقال', 'برتقال', 'عصير'] }),
    raw('beer', '生ビール', 'draft beer', 'بيرة', { ja: ['なまびーる', 'ビール', 'びーる', 'なま'], en: ['beer', 'draft beer', 'a beer'], ar: ['بيرة', 'بيرة طازجة'] }),
  ],
  izaFood: [
    raw('yakitori', '焼き鳥', 'yakitori', 'ياكيتوري', { ja: ['やきとり'], en: ['yakitori', 'grilled chicken', 'chicken skewers'], ar: ['ياكيتوري', 'دجاج مشوي', 'أسياخ دجاج'] }),
    raw('edamame', '枝豆', 'edamame', 'إيدامامي', { ja: ['えだまめ'], en: ['edamame', 'soybeans', 'green soybeans'], ar: ['إيدامامي', 'فول الصويا'] }),
    raw('karaage', '唐揚げ', 'karaage', 'كاراغي', { ja: ['からあげ', 'から揚げ'], en: ['karaage', 'fried chicken'], ar: ['كاراغي', 'دجاج مقلي'] }),
  ],
  billSplit: [
    raw('half', '割り勘', 'splitting the bill', 'تقسيم الحساب', { ja: ['わりかん', 'べつべつ', '別々', 'はんぶん', '半分'], en: ['split', 'split the bill', 'separately', 'half'], ar: ['تقسيم', 'نقسم', 'كل واحد', 'نصف'] }),
  ],
};
