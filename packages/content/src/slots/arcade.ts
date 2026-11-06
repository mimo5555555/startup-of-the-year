import type { SlotOption } from '../types';

/**
 * The game centre (`arcade_crane`): `crane` is what the player buys (one option, `play`, the item map's key for the menu id `arcade:play`),
 * `plays` is how many (the option ids are the shop flow's quantity words one / two / three: 一回 / 二回 / 三回).
 */
const raw = (id: string, ja: string, en: string, ar: string, keys: { ja: string[]; en: string[]; ar: string[] }): SlotOption => ({
  id,
  ja,
  gloss: { en, ar },
  keys: { ja: [ja.replace(/\|/g, ''), ...keys.ja], en: keys.en, ar: keys.ar },
});

export const ARCADE_SLOTS: Record<string, SlotOption[]> = {
  crane: [
    raw('play', 'クレーンゲーム', 'the crane game', 'لعبة الرافعة', {
      ja: ['くれーんげーむ', 'クレーン', 'くれーん', 'UFOキャッチャー', 'ゆーふぉーきゃっちゃー', 'ゲーム', 'げーむ'],
      en: ['crane game', 'the crane game', 'claw machine', 'the claw machine', 'crane', 'claw game', 'play'],
      ar: ['لعبة الرافعة', 'الرافعة', 'آلة المخلب', 'لعبة المخلب'],
    }),
  ],
  plays: [
    raw('one', '一回', 'once', 'مرة واحدة', { ja: ['いっかい', '1回', 'いちど', '一度'], en: ['once', 'one', '1', 'one go', 'one play', 'one time'], ar: ['مرة', 'مرة واحدة', 'واحدة', '1'] }),
    raw('two', '二回', 'twice', 'مرتان', { ja: ['にかい', '2回'], en: ['twice', 'two', '2', 'two goes', 'two plays', 'two times'], ar: ['مرتين', 'مرتان', '2'] }),
    raw('three', '三回', 'three times', 'ثلاث مرات', { ja: ['さんかい', '3回'], en: ['three', '3', 'three goes', 'three plays', 'three times'], ar: ['ثلاث مرات', 'ثلاثة', '3'] }),
  ],
};
