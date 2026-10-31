import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists for the Kyoto Journey (Goen stage 1, docs/GOEN.md). Slot names are one lower-case word (the translator lower-cases a phrasebook
 * pattern before it reads the slot name) and unique across modules: `nights` (the ryokan), `omamori` and `goshuin` (the temple counter's menu
 * options), `matcha` (the café's menu options); the souvenir is the shared `giftItem` option `yatsuhashi` (so the gift hand-over names it).
 */
export const KYOTO_SLOTS: Record<string, SlotOption[]> = {
  nights: [
    opt('ippaku', '一泊', ['いっぱく', '1泊', 'いちはく', 'ひとばん', '一晩'], ['one night', '1 night', 'a night', 'just one night', 'one night only'], ['ليلة واحدة', 'ليلة', 'ليلة فقط']),
    opt('nihaku', '二泊', ['にはく', '2泊', 'ふたばん', '二晩'], ['two nights', '2 nights', 'two night', '2 night'], ['ليلتان', 'ليلتين']),
    opt('sanpaku', '三泊', ['さんぱく', '3泊', 'みばん', '三晩'], ['three nights', '3 nights', 'three night', '3 night'], ['ثلاث ليال', 'ثلاث ليالٍ', '3 ليال']),
  ],
  omamori: [
    opt('kenko', '健康', ['けんこう'], ['health', 'good health', 'the health one', 'for health', 'for good health'], ['الصحة', 'للصحة', 'الصحة الجيدة', 'للصحة الجيدة']),
    opt('gakugyo', '学業', ['がくぎょう', '勉強', 'べんきょう'], ['study', 'studies', 'school', 'for study', 'the study one', 'for my studies'], ['الدراسة', 'للدراسة', 'المدرسة']),
    opt('kotsu', '交通安全', ['こうつうあんぜん', 'こうつう', '交通'], ['safe travel', 'traffic safety', 'road safety', 'for safe travel', 'the travel one', 'travel'], ['السلامة في الطريق', 'للسلامة في الطريق', 'السلامة المرورية', 'السفر']),
  ],
  goshuin: [opt('goshuin', '御朱印', ['ごしゅいん', 'しゅいん'], ['goshuin', 'a goshuin', 'the goshuin', 'a temple stamp', 'the stamp', 'a stamp'], ['غوشوين', 'ختم', 'ختم المعبد', 'الختم'])],
  matcha: [
    opt('set', '抹茶セット', ['まっちゃせっと'], ['matcha set', 'the matcha set', 'a matcha set', 'the set', 'a set'], ['طقم الماتشا', 'طقم ماتشا', 'الطقم']),
    opt('usucha', '抹茶', ['まっちゃ', 'おうす'], ['matcha', 'a matcha', 'a bowl of matcha', 'green tea'], ['ماتشا', 'الماتشا', 'كوب ماتشا']),
  ],
};
