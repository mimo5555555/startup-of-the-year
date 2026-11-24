// The Späti (Spätkauf): Murat's late-night corner shop. A cold drink, the bottle deposit (Pfand) explained, and pay.
import type { Character, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS, payIntents, saleDone, shortOfMoney } from './common';

/** cents, by slot option; the price on the shelf includes the bottle's Pfand (25 cents) */
/** cents, the Pfand (25 cents a bottle) included; the cola joined for the shifts behind the till (jobs for Berlin) */
export const SPAETI_PRICES: Record<string, number> = { clubmate: 205, wasser: 125, schorle: 175, cola: 175 };

export const MURAT: Character = {
  id: 'murat',
  name: { ja: 'Murat Yılmaz', reading: 'Murat Yılmaz', en: 'Murat Yılmaz', ar: 'مراد يلماز' },
  age: 52,
  job: { en: 'Owner of the Späti on the corner', ar: 'صاحب «الشبيتي» على الناصية' },
  bio: {
    en: 'Has run the corner Späti for twenty years: drinks, snacks, stamps and the news of the street until two in the morning.',
    ar: 'يدير محلّ «الشبيتي» على الناصية منذ عشرين عامًا: مشروبات ووجبات خفيفة وطوابع وأخبار الشارع حتى الثانية صباحًا.',
  },
  personality: { en: 'Calm, dry humour, knows everyone', ar: 'هادئ، دعابة جافة، يعرف الجميع' },
  interests: ['sports', 'music'],
  speaking: { rate: 1, pitch: 0.92, voice: 'm' },
  avatar: {
    skin: '#d9a77f',
    hair: { style: 'short', color: '#4a4a4a' },
    top: '#2f4f6f',
    bottom: '#2b2b2b',
    shoes: '#1f1f1f',
    accent: '#e0b040',
    accessories: ['glasses'],
  },
  locationId: 'berlin_spaeti',
  scenarioId: 'berlin_spaeti',
};

export const SPAETI: Scenario = {
  id: 'berlin_spaeti',
  locationId: 'berlin_spaeti',
  characterId: 'murat',
  level: 'A1',
  title: { en: 'A drink at the Späti', ar: 'مشروب من «الشبيتي»' },
  setup: {
    en: 'The Späti on the corner is open late. Buy something to drink, find out what Pfand is, and pay.',
    ar: '«الشبيتي» على الناصية مفتوح حتى وقت متأخر. اشترِ شيئًا تشربه، واعرف ما هو «بفاند»، ثم ادفع.',
  },
  minutes: 3,
  steps: [
    { id: 'drink', text: { en: 'Buy a drink', ar: 'اشترِ مشروبًا' } },
    { id: 'pfand', text: { en: 'Ask what Pfand is', ar: 'اسأل ما هو «بفاند»' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hallo! Was möchten Sie?', 'Hi! What would you like?', 'أهلًا! ماذا تريد؟'))],
      suggestions: [
        S('Eine Club-Mate, bitte.', 'A Club-Mate, please.', 'كلوب ماتيه من فضلك.'),
        S('Ein Wasser, bitte.', 'A water, please.', 'ماء من فضلك.'),
        S('Zwei Apfelschorlen, bitte.', 'Two apple spritzers, please.', 'عصيرا تفاح بالصودا من فضلك.'),
      ],
      intents: [
        {
          id: 'buy',
          slot: 'spaeti',
          slotRequired: true,
          alsoSlots: ['qty'],
          next: 'pay',
          step: 'drink',
          request: true,
          ideal: L('Eine Club-Mate, bitte.', 'A Club-Mate, please.', 'كلوب ماتيه من فضلك.'),
        },
      ],
    }),
    node({
      id: 'pay',
      say: [
        say(L('Das macht {total}, mit Pfand. Bar oder mit Karte?', 'That comes to {total}, with the deposit. Cash or card?', 'المجموع {total}، مع تأمين الزجاجة. نقدًا أم بالبطاقة؟'), { flag: 'priced' }),
        say(L('Mit Pfand. Bar oder mit Karte?', 'With the deposit. Cash or card?', 'مع تأمين الزجاجة. نقدًا أم بالبطاقة؟')),
      ],
      suggestions: [S('Was ist Pfand?', 'What is Pfand?', 'ما هو «بفاند»؟'), ...PAY_CHIPS],
      intents: [
        {
          id: 'pfand',
          any: ['pfand', 'was ist das'],
          stay: true,
          step: 'pfand',
          reply: L(
            'Pfand ist Geld für die Flasche: 25 Cent. Bringen Sie die Flasche zurück, dann bekommen Sie das Geld wieder.',
            'Pfand is a deposit on the bottle: 25 cents. Bring the bottle back and you get the money again.',
            '«بفاند» مبلغ تأمين على الزجاجة: 25 سنتًا. أعد الزجاجة فتستردّ المال.',
          ),
        },
        ...payIntents('bye'),
      ],
    }),
    saleDone(L('Danke! Schönen Abend noch!', 'Thanks! Have a nice evening!', 'شكرًا! أمسية سعيدة!')),
    shortOfMoney(L('Hm, das reicht nicht ganz. Kein Problem, bis später!', "Hm, that's not quite enough. No problem, see you later!", 'همم، هذا لا يكفي تمامًا. لا مشكلة، إلى اللقاء!')),
  ]),
};
