import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases of Release 2 wave C2 (paying cash is the shared `pay_cash`): the festival stalls (`matsuri_stalls`, Kenji) and the speech (`matsuri_speech`). English without contractions; ids unique across modules. */
export const MATSURI_PHRASES: PhraseEntry[] = [
  // ---- the stalls ----
  P(
    'matsuri_order',
    '{yatai}|を|ください。',
    ['{yatai} please', 'one {yatai} please', 'i would like {yatai}', 'i will have {yatai}', 'can i have {yatai}', 'i want {yatai}', 'some {yatai} please', '{yatai}'],
    ['{yatai} من فضلك', 'اريد {yatai}', 'أريد {yatai}', 'سآخذ {yatai}', 'ممكن {yatai}', '{yatai}'],
    { slot: 'yatai', closedSlot: true },
  ),
  P(
    'matsuri_fun',
    'はい、|とても|楽しい|です。',
    ['yes it is a lot of fun', 'yes it is fun', 'it is a lot of fun', 'yes i am enjoying it', 'i am enjoying it', 'yes very much', 'it is great'],
    ['نعم ممتع جدا', 'نعم ممتع جدًا', 'ممتع جدا', 'ممتع', 'نعم أستمتع', 'نعم استمتع', 'أنا أستمتع', 'انا استمتع'],
  ),
  P(
    'matsuri_looks_good',
    'おいしそう|です！',
    ['it looks delicious', 'that looks delicious', 'looks delicious', 'it looks good', 'that looks good', 'looks tasty'],
    ['تبدو لذيذة', 'يبدو لذيذا', 'يبدو لذيذًا', 'شكلها لذيذ', 'شكله لذيذ'],
  ),
  // ---- the speech ----
  P(
    'speech_came_from',
    '{country}|から|来ました。',
    ['i came here from {country}', 'i have come from {country}'],
    ['جئت من {country}', 'أتيت من {country}', 'اتيت من {country}', 'انا جئت من {country}', 'أنا جئت من {country}'],
    { slot: 'country' },
  ),
  P(
    'speech_town',
    '桜町|は|とても|いい|町|です。',
    ['sakura cho is a very nice town', 'sakuracho is a very nice town', 'sakura cho is a very good town', 'sakura cho is a nice town', 'this is a very nice town', 'it is a very nice town', 'i like sakura cho', 'i love sakura cho'],
    ['ساكورا تشو مدينة جميلة جدا', 'ساكورا تشو مدينة جميلة جدًا', 'ساكورا تشو مدينة جميلة', 'ساكوراتشو مدينة جميلة', 'أحب ساكورا تشو', 'احب ساكورا تشو', 'مدينة جميلة جدا'],
  ),
  P(
    'speech_thanks_all',
    '皆さん、|ありがとうございました。',
    ['thank you everyone', 'thank you all', 'thanks everyone', 'thank you very much everyone', 'thank you all very much'],
    ['شكرا لكم جميعا', 'شكرًا لكم جميعًا', 'شكرا للجميع', 'شكرًا للجميع', 'شكرا جميعا'],
  ),
];
