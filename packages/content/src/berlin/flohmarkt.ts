// The Sunday flea market in Mauerpark: Greta sells lamps, records, jackets, old cameras and a second-hand bike. Ask a price, haggle (the game's haggle: a
// little off, never much), take it or think it over, and pay cash: there is no card reader at a flea market stall.
import type { Character, IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { saleDone, shortOfMoney } from './common';

/** cents, by slot option (before haggling) */
export const FLOHMARKT_PRICES: Record<string, number> = { lampe: 2000, platte: 1200, jacke: 3500, kamera: 4500, fahrrad: 6500 };

export const GRETA: Character = {
  id: 'greta',
  name: { ja: 'Greta Neumann', reading: 'Greta Neumann', en: 'Greta Neumann', ar: 'غريتا نويمان' },
  age: 67,
  job: { en: 'Flea-market seller in Mauerpark', ar: 'بائعة في سوق البرغوث في «ماورپارك»' },
  bio: {
    en: 'Has had the same stall in Mauerpark every Sunday since the Wall came down. Every lamp has a story, and every price a little room.',
    ar: 'لها الكشك نفسه في «ماورپارك» كل أحد منذ سقوط الجدار. لكل مصباح قصة، ولكل سعر مجال صغير.',
  },
  personality: { en: 'Chatty, sharp, enjoys a good haggle', ar: 'ثرثارة، ذكية، تستمتع بالمساومة' },
  interests: ['art', 'music', 'fashion'],
  speaking: { rate: 0.95, pitch: 1.08, voice: 'f' },
  avatar: {
    skin: '#f2d6c2',
    hair: { style: 'short', color: '#d9d4cc' },
    top: '#7a3b52',
    bottom: '#3e4a3a',
    shoes: '#4a3526',
    accent: '#e7b75f',
    accessories: ['scarf', 'glasses'],
  },
  locationId: 'berlin_flohmarkt',
  scenarioId: 'berlin_flohmarkt',
};

const take: IntentDef = { id: 'take', any: ['ich nehme', 'nehme ich', 'das nehme', 'nehme sie', 'nehme es', 'kaufe', 'gekauft'], next: 'pay', request: true };
const later: IntentDef = { id: 'later', any: ['uberlege', 'spater', 'nein danke', 'lieber nicht', 'zu teuer'], next: 'leave' };
const haggle: IntentDef[] = [
  { id: 'haggle', any: ['billiger', 'gunstiger', 'rabatt', 'nachlass', 'geht es auch', 'geht da was', 'letzter preis'], econ: 'haggle', next: 'deal', nextIfNo: 'no_deal', step: 'haggle', request: true, ideal: L('Geht es ein bisschen billiger?', 'Could it be a little cheaper?', 'هل يمكن أن يكون أرخص قليلًا؟') },
  { id: 'haggle_offer', all: [['euro'], ['fur', 'geht', 'machen', 'zahle', 'biete']], econ: 'haggle', next: 'deal', nextIfNo: 'no_deal', step: 'haggle', request: true, ideal: L('Geht es auch für fünfzehn Euro?', 'Would fifteen euros do?', 'هل يمكن بخمسة عشر يورو؟') },
];
/** paying at the stall: cash in your hand */
const handOver: IntentDef = { id: 'hand_over', any: ['hier', 'bitte', 'gerne', 'gern', 'super', 'danke', 'bar', 'okay', 'ok', 'ja', 'prima'], next: 'bye' };
const ITEM_CHIPS = [
  S('Was kostet die Lampe?', 'How much is the lamp?', 'كم سعر المصباح؟'),
  S('Was kostet die Schallplatte?', 'How much is the record?', 'كم سعر الأسطوانة؟'),
  S('Was kostet das Fahrrad?', 'How much is the bike?', 'كم سعر الدرّاجة؟'),
];

export const FLOHMARKT: Scenario = {
  id: 'berlin_flohmarkt',
  locationId: 'berlin_flohmarkt',
  characterId: 'greta',
  level: 'A2',
  title: { en: 'Haggling at the Mauerpark flea market', ar: 'مساومة في سوق «ماورپارك»' },
  setup: {
    en: 'Sunday at the Mauerpark flea market. Find something you like at Greta’s stall, ask the price, try to get it a little cheaper and pay in cash.',
    ar: 'الأحد في سوق «ماورپارك». اختر شيئًا يعجبك عند كشك غريتا، واسأل عن السعر، وحاول أن تحصل عليه أرخص قليلًا، وادفع نقدًا.',
  },
  minutes: 4,
  steps: [
    { id: 'ask', text: { en: 'Ask the price', ar: 'اسأل عن السعر' } },
    { id: 'haggle', text: { en: 'Haggle', ar: 'ساوم' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hallo! Schauen Sie ruhig.', 'Hello! Have a look around.', 'أهلًا! تفضّل وانظر براحتك.'))],
      suggestions: ITEM_CHIPS,
      intents: [{ id: 'ask', slot: 'floh', slotRequired: true, next: 'price', step: 'ask', ideal: L('Was kostet die Lampe?', 'How much is the lamp?', 'كم سعر المصباح؟') }],
    }),
    node({
      id: 'price',
      say: [
        say(L('Ah, {floh}! Das kostet {total}.', 'Ah, the {floh}! That is {total}.', 'آه، {floh}! السعر {total}.'), { flag: 'priced' }),
        say(L('Ah, {floh}! Ein schönes Stück!', 'Ah, the {floh}! A lovely piece!', 'آه، {floh}! قطعة جميلة!')),
      ],
      suggestions: [
        S('Geht es ein bisschen billiger?', 'Could it be a little cheaper?', 'هل يمكن أن يكون أرخص قليلًا؟'),
        S('Gut, das nehme ich.', 'Good, I’ll take it.', 'حسنًا، سآخذه.'),
        S('Ich überlege noch.', 'I’m still thinking.', 'ما زلت أفكّر.'),
      ],
      intents: [...haggle, take, later],
    }),
    node({
      id: 'deal',
      emotion: 'happy',
      say: [
        say(L('Na gut, für Sie: {total}. Aber nur bar!', 'Oh, all right, for you: {total}. But cash only!', 'طيب، من أجلك: {total}. لكن نقدًا فقط!'), { flag: 'priced' }),
        say(L('Na gut, für Sie etwas billiger. Aber nur bar!', 'Oh, all right, a little cheaper for you. But cash only!', 'طيب، أرخص قليلًا من أجلك. لكن نقدًا فقط!')),
      ],
      suggestions: [S('Super, danke! Hier, bitte.', 'Great, thanks! Here you are.', 'رائع، شكرًا! تفضّلي.'), S('Ich überlege noch.', 'I’m still thinking.', 'ما زلت أفكّر.')],
      intents: [{ ...later, boost: 5 }, { ...handOver, step: 'haggle' }],
    }),
    node({
      id: 'no_deal',
      emotion: 'neutral',
      say: [say(L('Nein, tut mir leid. Das ist schon ein guter Preis.', "No, I'm sorry. That's already a good price.", 'لا، آسفة. هذا سعر جيد أصلًا.'))],
      suggestions: [S('Gut, das nehme ich.', 'Good, I’ll take it.', 'حسنًا، سآخذه.'), S('Ich überlege noch.', 'I’m still thinking.', 'ما زلت أفكّر.')],
      intents: [take, later],
    }),
    node({
      id: 'pay',
      say: [
        say(L('Prima! Das macht {total}. Nur bar, bitte.', 'Great! That comes to {total}. Cash only, please.', 'ممتاز! المجموع {total}. نقدًا فقط من فضلك.'), { flag: 'priced' }),
        say(L('Prima! Nur bar, bitte.', 'Great! Cash only, please.', 'ممتاز! نقدًا فقط من فضلك.')),
      ],
      suggestions: [S('Hier, bitte.', 'Here you are.', 'تفضّلي.'), S('Bar, kein Problem.', 'Cash, no problem.', 'نقدًا، لا مشكلة.')],
      intents: [handOver],
    }),
    saleDone(L('Danke! Viel Spaß damit!', 'Thanks! Enjoy it!', 'شكرًا! استمتع بها!')),
    shortOfMoney(),
    node({
      id: 'leave',
      end: true,
      say: [say(L('Kein Problem. Schauen Sie gerne später noch mal vorbei!', 'No problem. Feel free to come back later!', 'لا مشكلة. مرّ لاحقًا إن أحببت!'))],
      intents: [],
    }),
  ]),
};
