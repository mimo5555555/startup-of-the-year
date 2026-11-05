import type { SlotOption } from '../types';

/**
 * The figure shop ほしぞらホビー (`hobby_figures`): one slot, `figure`, whose option ids are the keys of the scenario meta's item map. The
 * learner asks for a figure by its look, as in a real shop: 「赤いのをください」 (the red one), 「小さいの」 (the small one), or by name. A
 * colour or a size alone only names a figure in the node that offers it (the cat ninjas come in colours, the robots in sizes), so the
 * options' keys never overlap: 赤 / 青 / 白 are cat ninjas, 大きい / 小さい are robots, 限定 / きつね is the fox samurai.
 */
const fig = (id: string, ja: string, en: string, ar: string, keys: { ja: string[]; en: string[]; ar: string[] }): SlotOption => ({
  id,
  ja,
  gloss: { en, ar },
  keys: { ja: [ja.replace(/\|/g, ''), ...keys.ja], en: keys.en, ar: keys.ar },
});

export const SHOP_HOBBY_SLOTS: Record<string, SlotOption[]> = {
  figure: [
    fig('nekoRed', '赤い|ねこ忍者', 'the red Cat Ninja', 'القط النينجا الأحمر', {
      ja: ['あかいねこにんじゃ', '赤いねこ', 'あかいねこ', '赤いの', 'あかいの', '赤', 'あか'],
      en: ['red', 'the red one', 'red one', 'red cat ninja', 'the red cat ninja', 'red ninja'],
      ar: ['الأحمر', 'الحمراء', 'الأحمر من فضلك', 'القط الأحمر', 'النينجا الأحمر'],
    }),
    fig('nekoBlue', '青い|ねこ忍者', 'the blue Cat Ninja', 'القط النينجا الأزرق', {
      ja: ['あおいねこにんじゃ', '青いねこ', 'あおいねこ', '青いの', 'あおいの', '青', 'あお'],
      en: ['blue', 'the blue one', 'blue one', 'blue cat ninja', 'the blue cat ninja', 'blue ninja'],
      ar: ['الأزرق', 'الزرقاء', 'الأزرق من فضلك', 'القط الأزرق', 'النينجا الأزرق'],
    }),
    fig('nekoWhite', '白い|ねこ忍者', 'the white Cat Ninja', 'القط النينجا الأبيض', {
      ja: ['しろいねこにんじゃ', '白いねこ', 'しろいねこ', '白いの', 'しろいの', '白', 'しろ'],
      en: ['white', 'the white one', 'white one', 'white cat ninja', 'the white cat ninja', 'white ninja'],
      ar: ['الأبيض', 'البيضاء', 'الأبيض من فضلك', 'القط الأبيض', 'النينجا الأبيض'],
    }),
    fig('roboBig', '大きい|ロボット', 'the big robot', 'الروبوت الكبير', {
      ja: ['おおきいろぼっと', '大きいの', 'おおきいの', '大きい方', 'おおきいほう', '大きい', 'おおきい'],
      en: ['big', 'the big one', 'big one', 'big robot', 'the big robot', 'the bigger one', 'large'],
      ar: ['الكبير', 'الكبير من فضلك', 'الروبوت الكبير', 'الأكبر'],
    }),
    fig('roboSmall', '小さい|ロボット', 'the small robot', 'الروبوت الصغير', {
      ja: ['ちいさいろぼっと', '小さいの', 'ちいさいの', '小さい方', 'ちいさいほう', '小さい', 'ちいさい'],
      en: ['small', 'the small one', 'small one', 'small robot', 'the small robot', 'the smaller one', 'little'],
      ar: ['الصغير', 'الصغير من فضلك', 'الروبوت الصغير', 'الأصغر'],
    }),
    // the display case for the room (furniture, the shelf slot): asked for by name, never by a colour or a size
    fig('figCase', 'フィギュアケース', 'the figure display case', 'خزانة عرض المجسّمات', {
      ja: ['ふぃぎゅあけーす', 'ケース', 'けーす', 'ショーケース', 'ディスプレイケース', 'たな', '棚'],
      en: ['display case', 'the display case', 'case', 'a case', 'figure case', 'the case', 'a display case', 'shelf'],
      ar: ['خزانة عرض', 'الخزانة', 'خزانة', 'خزانة العرض', 'رف'],
    }),
    fig('kitsune', 'きつね侍', 'the Fox Samurai', 'الثعلب الساموراي', {
      ja: ['きつねざむらい', 'きつね', '狐', '限定', 'げんてい', '侍', 'さむらい'],
      en: ['fox samurai', 'the fox samurai', 'fox', 'the fox', 'the limited one', 'limited', 'samurai'],
      ar: ['الثعلب الساموراي', 'الثعلب', 'المحدود', 'الإصدار المحدود', 'الساموراي'],
    }),
  ],
};
