import type { PhraseEntry } from '../types';
import { P } from './helpers';
import { FRIENDS_SCENARIOS } from '../tokyo/scenarios-friends';
import { BASE_PHRASES } from './base';
import { SHOP_PHRASES } from './shop';
import { STATION_PHRASES } from './station';
import { QUESTS_PHRASES } from './quests';
import { SHOP_DENKI_PHRASES } from './shop-denki';
import { SHOP_FUKU_PHRASES } from './shop-fuku';
import { SHOP_AIKO_PHRASES } from './shop-aiko';
import { SHOP_MOTORS_PHRASES } from './shop-motors';
import { SOCIAL_CHAT_PHRASES } from './social-chat';
import { SOCIAL_HEARTS_PHRASES } from './social-hearts';
import { JOBS_PHRASES } from './jobs';
import { CULTURE_PHRASES } from './culture';

/**
 * Phrases for hang-outs and home visits (Release 2 wave B1). English is written without contractions; ids must be unique across modules.
 *
 * Every suggestion chip of the seven scenarios is a phrase of its own (built from the scenario data, so "say it your way" can never drift
 * from the chips: a learner who types the English or Arabic of a chip is understood as the chip), plus the hand-written slot phrases below
 * and a few paraphrases of the central chips. The phrasebook never maps one sentence to two phrases (a test checks it): a sentence another module
 * already maps is left to that module's phrase (this module cannot import `social.ts`, which imports it and yields to it in turn).
 */


/** The English and Arabic a phrase pattern is matched against (the same folding as the engine's normaliser, which this package cannot import). */
const foldEn = (s: string): string => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/'/g, ' ').replace(/[^a-z0-9\s{}]/g, ' ').replace(/\b(a|an|the|some)\b/g, ' ').replace(/\s+/g, ' ').trim();
const foldAr = (s: string): string =>
  s
    .replace(/[\u064B-\u0670\u065F\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^ء-يa-z0-9\s{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const OTHERS: PhraseEntry[] = [
  ...BASE_PHRASES, ...SHOP_PHRASES, ...STATION_PHRASES, ...QUESTS_PHRASES, ...SHOP_DENKI_PHRASES, ...SHOP_FUKU_PHRASES, ...SHOP_AIKO_PHRASES, ...SHOP_MOTORS_PHRASES,
  ...SOCIAL_CHAT_PHRASES, ...SOCIAL_HEARTS_PHRASES, ...JOBS_PHRASES, ...CULTURE_PHRASES,
];
const taken = new Set(OTHERS.flatMap((p) => [...p.en.map((e) => `en:${foldEn(e)}`), ...p.ar.map((a) => `ar:${foldAr(a)}`)]));
/** keeps the sentences nobody maps yet (and claims them); the first phrase to say a sentence wins */
const free = (en: string[], ar: string[]): [string[], string[]] => {
  const keep = (list: string[], lang: 'en' | 'ar'): string[] => {
    const fold = lang === 'en' ? foldEn : foldAr;
    const out: string[] = [];
    for (const x of list) {
      const k = `${lang}:${fold(x)}`;
      if (taken.has(k)) continue;
      taken.add(k);
      out.push(x);
    }
    return out;
  };
  return [keep(en, 'en'), keep(ar, 'ar')];
};

/** Paraphrases of chips, by the Japanese of the chip: [English, Arabic]. */
const MORE: Record<string, [string[], string[]]> = {
  'はい、|ポーズ|します。': [['yes', 'ok', 'okay', 'sure', 'i am ready', 'i will pose for you', 'i will strike a pose'], ['نعم', 'حسنا', 'جاهز', 'سأقف لك بوضعية']],
  'ピース！': [['peace', 'v sign', 'a peace sign', 'victory sign'], ['سلام', 'علامة السلام']],
  'いただきます。': [['bon appetit', 'thanks for the food', 'let us eat'], ['بالهناء', 'بالعافية']],
  'ごちそうさまでした。': [['thank you for the meal', 'thanks for the meal', 'that was a good meal'], ['شكرا على الوجبة', 'شكرا على الطعام']],
  'おじゃまします。': [['excuse me for coming in', 'may i come in', 'excuse me', 'pardon the intrusion'], ['عن اذنك', 'هل يمكنني الدخول', 'استاذن بالدخول']],
  'おじゃましました。|ありがとう|ございました。': [['thank you for having me', 'excuse me for having intruded', 'thanks for having me', 'goodbye and thank you'], ['شكرا على الاستضافة', 'شكرا على استقبالي', 'عن اذنك شكرا']],
  'いい|部屋|です|ね。': [['you have a nice room', 'what a nice room', 'nice room', 'this is a nice room', 'i like your room', 'it is a nice flat', 'what a lovely room'], ['لديك غرفة جميلة', 'غرفة جميلة', 'ما اجمل غرفتك', 'اعجبتني غرفتك']],
  'あれ|は|何|です|か？': [['what is this', 'what is that over there', 'what is that thing', 'what is this thing', 'what is it'], ['ما هذا', 'ما ذاك', 'ما هذا الشيء']],
  'もう|少し|塩|が|いい|です。': [['more salt please', 'a little more salt', 'it needs more salt', 'it needs a bit more salt', 'a little more salt please', 'add a little salt'], ['المزيد من الملح', 'قليل من الملح', 'يحتاج ملح', 'يحتاج الى مزيد من الملح']],
  '上手|です|ね！': [['you are good', 'you are good at it', 'you play very well', 'you are so good', 'you play well'], ['انت بارعة', 'تعزفين جيدا', 'تعزفين ببراعة']],
  'もう|一|曲|お願いします。': [['one more please', 'play another song please', 'another song please', 'one more song', 'play one more'], ['اغنية اخرى', 'واحدة اخرى من فضلك', 'اعزفي اغنية اخرى']],
  'ありがとう|ございます。': [['thank you so much', 'thanks a lot', 'many thanks'], ['شكرا جزيلا', 'الف شكر']],
  '今日|は|楽しかった|です。': [['i had a good time today', 'today was fun', 'i enjoyed today', 'i had fun'], ['قضيت وقتا ممتعا اليوم', 'كان اليوم ممتعا', 'استمتعت']],
  'きれい|です|ね！': [['it is beautiful', 'so pretty', 'how pretty', 'it is so pretty', 'beautiful'], ['جميلة جدا', 'ما اجملها', 'انها جميلة']],
  'おいしい|です！': [['it is tasty', 'it is very good', 'it is yummy', 'yummy', 'delicious', 'it tastes good', 'tasty'], ['لذيذ', 'انه لذيذ جدا', 'طعمه جيد', 'لذيذة']],
  'こっち|が|いい|です。': [['i like this one', 'this one please', 'i prefer this one', 'this one', 'the first one', 'i choose this one'], ['افضل هذه', 'هذه من فضلك', 'اخترت هذه', 'هذه']],
  'あっち|が|いい|です。': [['i like that one', 'that one please', 'i prefer that one', 'that one', 'the second one', 'i choose that one'], ['افضل تلك', 'تلك من فضلك', 'اخترت تلك', 'تلك']],
  'どっち|も|いい|です。': [['i like both', 'they are both good', 'both of them', 'both please', 'both'], ['كلتاهما', 'احب كلتيهما', 'كلاهما جيد']],
  'スリッパ|を|脱ぎます。': [['i take off my slippers', 'i will take off my slippers'], ['سأخلع الخف']],
  'はい、|脱ぎます。': [['yes i take them off', 'ok i will take them off', 'yes of course', 'yes i will take off my slippers'], ['نعم سأخلعهما', 'حسنا سأخلعهما']],
  'こたつ|は|あたたかい|です|ね。': [['the kotatsu is warm', 'the kotatsu is cozy', 'it is warm under the kotatsu', 'it is so warm'], ['الكوتاتسو دافئ', 'دافئ تحت الكوتاتسو', 'انه دافئ جدا']],
  'はい、|見たい|です。': [['yes please', 'yes i want to see it', 'i would love to see it', 'i would like to see it'], ['نعم من فضلك', 'نعم اريد ان اراها', 'احب ان اراها']],
  '広い|です|ね！': [['it is big', 'it is so spacious', 'it is roomy', 'what a big room'], ['واسعة جدا', 'ما اوسعها', 'انها كبيرة']],
};

/** Hand-written phrases with a slot or a number: the slot lists are in `slots/social-friends.ts`. */
const FIXED_RAW: PhraseEntry[] = [
  P('fv_see', '{seeThing}|が|見えます。', ['i see {seeThing}', 'i can see {seeThing}', 'there is {seeThing}', 'i see {seeThing} over there', '{seeThing}'], ['أرى {seeThing}', 'استطيع ان ارى {seeThing}', 'يوجد {seeThing}', '{seeThing}'], { slot: 'seeThing', closedSlot: true }),
  P('fv_genre', '{jamGenre}|が|いい|です。', ['{jamGenre} please', 'i would like {jamGenre}', 'i like {jamGenre}', 'play {jamGenre}', '{jamGenre}'], ['{jamGenre} من فضلك', 'اريد {jamGenre}', 'احب {jamGenre}', '{jamGenre}'], { slot: 'jamGenre', closedSlot: true }),
  P('fv_ingredient', '{ingredient}|です。', ['it is {ingredient}', 'it is the {ingredient}', 'there is {ingredient}', 'we need {ingredient}', '{ingredient}'], ['انه {ingredient}', 'نحتاج {ingredient}', '{ingredient}'], { slot: 'ingredient', closedSlot: true }),
  P('fv_count', '{sweetCount}|作りましょう。', ['let us make {sweetCount}', 'i will make {sweetCount}', 'make {sweetCount} please', '{sweetCount} please', '{sweetCount}'], ['لنصنع {sweetCount}', 'سأصنع {sweetCount}', '{sweetCount} من فضلك', '{sweetCount}'], { slot: 'sweetCount', closedSlot: true }),
  P('fv_shape', '{wagashiShape}|が|いい|です。', ['{wagashiShape} please', 'i would like {wagashiShape}', 'i like {wagashiShape}', 'make it {wagashiShape}', '{wagashiShape}'], ['{wagashiShape} من فضلك', 'اريد {wagashiShape}', 'احب {wagashiShape}', '{wagashiShape}'], { slot: 'wagashiShape', closedSlot: true }),
  P('fv_colour', '{wrapColour}|が|いい|です。', ['{wrapColour} please', 'i would like {wrapColour}', 'i like {wrapColour}', 'make it {wrapColour}', '{wrapColour}'], ['{wrapColour} من فضلك', 'اريد {wrapColour}', 'احب {wrapColour}', '{wrapColour}'], { slot: 'wrapColour', closedSlot: true }),
  P('fv_like_food', '{chatfood}|が|好き|です。', ['i like {chatfood}', 'my favourite food is {chatfood}', 'i love {chatfood}', 'i really like {chatfood}', '{chatfood}'], ['احب {chatfood}', 'طعامي المفضل هو {chatfood}', 'احب {chatfood} كثيرا', '{chatfood}'], { slot: 'chatfood', closedSlot: true }),
  P('fv_age_25', '二|十|五|歳|です。', ['i am 25', 'i am 25 years old', 'i am twenty five', 'i am twenty five years old', '25 years old', '25'], ['عمري 25', 'عمري خمسة وعشرون عاما', 'عمري 25 سنة', 'عمري خمس وعشرين سنة']),
  P('fv_age_30', '三十|歳|です。', ['i am 30', 'i am 30 years old', 'i am thirty', 'i am thirty years old', '30 years old', '30'], ['عمري 30', 'عمري ثلاثون عاما', 'عمري 30 سنة', 'عمري ثلاثين سنة']),
  P('fv_age_18', '十|八|歳|です。', ['i am 18', 'i am 18 years old', 'i am eighteen', 'i am eighteen years old', '18 years old', '18'], ['عمري 18', 'عمري ثمانية عشر عاما', 'عمري 18 سنة', 'عمري ثماني عشرة سنة']),
];

const FIXED: PhraseEntry[] = FIXED_RAW.map((p) => {
  const [en, ar] = free(p.en, p.ar);
  return { ...p, en, ar };
}).filter((p) => p.en.length + p.ar.length > 0);

/** One phrase per distinct chip (the Japanese of the chip is the key), with the English and Arabic of every chip that says it. */
function fromChips(): PhraseEntry[] {
  const byJa = new Map<string, { en: Set<string>; ar: Set<string> }>();
  for (const sc of FRIENDS_SCENARIOS) {
    for (const n of Object.values(sc.nodes)) {
      for (const s of [...(n.suggestions ?? []), ...Object.values(n.suggestionsByL1 ?? {}).flat()]) {
        if (/\{\w+\}/.test(s.ja)) continue;
        const e = byJa.get(s.ja) ?? { en: new Set<string>(), ar: new Set<string>() };
        e.en.add(s.en);
        e.ar.add(s.ar);
        byJa.set(s.ja, e);
      }
    }
  }
  return [...byJa.entries()]
    .map(([ja, e], i) => {
      const more = MORE[ja];
      const [en, ar] = free([...new Set([...e.en, ...(more?.[0] ?? [])])], [...new Set([...e.ar, ...(more?.[1] ?? [])])]);
      return P(`fv_chip_${i + 1}`, ja, en, ar);
    })
    .filter((p) => p.en.length + p.ar.length > 0);
}

export const SOCIAL_FRIENDS_PHRASES: PhraseEntry[] = [...fromChips(), ...FIXED];
