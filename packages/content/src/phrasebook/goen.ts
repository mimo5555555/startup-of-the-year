import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases of Goen stage 1 (docs/GOEN.md): the wishes of `shrine_wish` (「〜ますように」), one per catalog item plus the two free wishes. English without contractions; ids unique across modules. */
export const GOEN_PHRASES: PhraseEntry[] = [
  P(
    'goen_wish_kyoto',
    '京都|に|行けます|ように。',
    ['i hope i can go to kyoto', 'may i go to kyoto', 'i wish i could go to kyoto', 'i wish to go to kyoto', 'i hope to go to kyoto'],
    ['أتمنى أن أذهب إلى كيوتو', 'اتمنى ان اذهب الى كيوتو', 'أتمنى الذهاب إلى كيوتو', 'اتمنى الذهاب الى كيوتو'],
  ),
  P(
    'goen_wish_leaves',
    'きれい|な|紅葉|が|見られます|ように。',
    ['i hope i can see beautiful autumn leaves', 'may i see beautiful autumn leaves', 'i wish to see beautiful autumn leaves', 'i hope i see beautiful autumn leaves'],
    ['أتمنى أن أرى أوراق الخريف الجميلة', 'اتمنى ان ارى اوراق الخريف الجميلة', 'أتمنى رؤية أوراق الخريف الجميلة'],
  ),
  P(
    'goen_wish_autumn',
    '秋|の|紅葉|が|見られます|ように。',
    ['i hope i can see the autumn leaves', 'may i see the autumn leaves', 'i wish to see the autumn leaves', 'i hope to see the autumn leaves'],
    ['أتمنى أن أرى أوراق الخريف', 'اتمنى ان ارى اوراق الخريف', 'أتمنى رؤية أوراق الخريف'],
  ),
  P(
    'goen_wish_pretty',
    'きれい|に|なれます|ように。',
    ['i hope i can look beautiful', 'i hope i become beautiful', 'may i look beautiful', 'i wish i could look beautiful', 'i hope i look nice'],
    ['أتمنى أن أبدو جميلا', 'أتمنى أن أبدو جميلًا', 'اتمنى ان ابدو جميلا', 'أتمنى أن أبدو جميلة'],
  ),
  P(
    'goen_wish_room',
    'いい|部屋|に|なります|ように。',
    ['i hope it becomes a nice room', 'i hope my room becomes nice', 'may it be a nice room', 'i hope it will be a nice room'],
    ['أتمنى أن تصبح غرفة جميلة', 'اتمنى ان تصبح غرفة جميلة', 'أتمنى أن تكون غرفتي جميلة'],
  ),
  P(
    'goen_wish_ride',
    '安全|に|走れます|ように。',
    ['i hope i can ride safely', 'may i ride safely', 'i wish to ride safely', 'i hope i ride safely'],
    ['أتمنى أن أقود بأمان', 'اتمنى ان اقود بامان', 'أتمنى القيادة بأمان'],
  ),
  P(
    'goen_wish_speak',
    '毎日|話せます|ように。',
    ['i hope i can speak every day', 'may i speak every day', 'i wish i could speak every day', 'i hope to speak every day'],
    ['أتمنى أن أتحدث كل يوم', 'اتمنى ان اتحدث كل يوم', 'أتمنى أن أتكلم كل يوم'],
  ),
  P(
    'goen_wish_japanese',
    '日本語|が|上手|に|なります|ように。',
    ['i hope my japanese gets better', 'i hope my japanese improves', 'may my japanese get better', 'i wish my japanese would get better', 'i hope i get better at japanese'],
    ['أتمنى أن تتحسن لغتي اليابانية', 'اتمنى ان تتحسن لغتي اليابانية', 'أتمنى أن يتحسن يابانيّي', 'أتمنى أن أتحسن في اليابانية'],
  ),
];
