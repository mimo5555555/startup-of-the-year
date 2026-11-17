// The BVG counter at the U-Bahn station: Sabine sells tickets. A single ticket for Berlin AB, a day ticket or a short trip
// (Kurzstrecke, explained when asked), pay, and the reminder every newcomer needs: validate the ticket before the ride.
import type { Character, IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS, askToPay, payIntents, saleDone, shortOfMoney } from './common';

/** cents, by slot option */
export const TICKET_PRICES: Record<string, number> = { einzel: 380, tageskarte: 1060, kurzstrecke: 260 };

export const SABINE: Character = {
  id: 'sabine',
  name: { ja: 'Sabine Hoffmann', reading: 'Sabine Hoffmann', en: 'Sabine Hoffmann', ar: 'زابينه هوفمان' },
  age: 45,
  job: { en: 'Ticket clerk at the BVG counter', ar: 'موظفة تذاكر عند شبّاك هيئة النقل في برلين' },
  bio: {
    en: 'Has sold U-Bahn tickets for twenty years and explains the fare zones A, B and C to every newcomer, patiently, twice if needed.',
    ar: 'تبيع تذاكر المترو منذ عشرين عامًا وتشرح مناطق الأجرة A وB وC لكل قادم جديد، بصبر، ومرّتين إن لزم.',
  },
  personality: { en: 'Precise, patient, kind under the uniform', ar: 'دقيقة، صبورة، طيّبة تحت الزيّ الرسمي' },
  interests: ['travel', 'books'],
  speaking: { rate: 0.98, pitch: 1, voice: 'f' },
  avatar: {
    skin: '#f0cfb5',
    hair: { style: 'bob', color: '#b38b5d' },
    top: '#f2c200',
    bottom: '#2c2c34',
    shoes: '#1c1c1c',
    accent: '#f2c200',
    accessories: ['glasses'],
  },
  locationId: 'berlin_ubahn',
  scenarioId: 'berlin_ubahn',
};

const buy: IntentDef = {
  id: 'buy',
  slot: 'ticket',
  slotRequired: true,
  alsoSlots: ['qty'],
  next: 'pay',
  step: 'ticket',
  request: true,
  ideal: L('Einen Fahrschein für Berlin AB, bitte.', 'A ticket for Berlin AB, please.', 'تذكرة لمنطقة برلين AB من فضلك.'),
};

export const UBAHN: Scenario = {
  id: 'berlin_ubahn',
  locationId: 'berlin_ubahn',
  characterId: 'sabine',
  level: 'A1',
  title: { en: 'A ticket for the U-Bahn', ar: 'تذكرة للمترو' },
  setup: {
    en: 'The BVG counter at the U-Bahn station. Buy the ticket you need, pay, and listen to what Sabine tells you before you ride.',
    ar: 'شبّاك هيئة النقل في محطة المترو. اشترِ التذكرة التي تحتاجها، وادفع، واستمع إلى ما تقوله زابينه قبل الركوب.',
  },
  minutes: 3,
  steps: [
    { id: 'ticket', text: { en: 'Buy a ticket', ar: 'اشترِ تذكرة' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      say: [say(L('Guten Tag! Wie kann ich Ihnen helfen?', 'Good afternoon! How can I help you?', 'مساء الخير! كيف أستطيع مساعدتك؟'))],
      suggestions: [
        S('Einen Fahrschein für Berlin AB, bitte.', 'A ticket for Berlin AB, please.', 'تذكرة لمنطقة برلين AB من فضلك.'),
        S('Eine Tageskarte, bitte.', 'A day ticket, please.', 'تذكرة يومية من فضلك.'),
        S('Was kostet eine Kurzstrecke?', 'How much is a short-trip ticket?', 'كم سعر تذكرة المسافة القصيرة؟'),
      ],
      intents: [buy, { id: 'ask_short', all: [['kurzstrecke', 'kurz'], ['was kostet', 'wie viel', 'wieviel', 'kostet', 'was ist']], next: 'short_info' }],
    }),
    node({
      id: 'short_info',
      say: [
        say(
          L(
            'Eine Kurzstrecke kostet 2,60 €. Damit fahren Sie drei Stationen mit der U-Bahn.',
            'A short trip costs €2.60. With it you can ride three stops on the U-Bahn.',
            'تذكرة المسافة القصيرة بـ 2.60 يورو. تركب بها ثلاث محطات في المترو.',
          ),
        ),
      ],
      suggestions: [
        S('Dann eine Kurzstrecke, bitte.', 'Then a short-trip ticket, please.', 'إذن تذكرة مسافة قصيرة من فضلك.'),
        S('Lieber einen Fahrschein für Berlin AB.', 'A ticket for Berlin AB instead.', 'بل تذكرة لمنطقة برلين AB.'),
      ],
      intents: [buy],
    }),
    node({ id: 'pay', say: askToPay(), suggestions: PAY_CHIPS, intents: payIntents('bye') }),
    saleDone(
      L(
        'Bitte schön. Und vergessen Sie nicht: Den Fahrschein vor der Fahrt entwerten! Gute Fahrt!',
        "Here you go. And don't forget: validate the ticket before you ride! Have a good trip!",
        'تفضّل. ولا تنسَ: اختم التذكرة قبل الركوب! رحلة سعيدة!',
      ),
    ),
    shortOfMoney(L('Oh, das reicht leider nicht. Am Automaten geht es auch mit Karte!', "Oh, that's not enough, I'm afraid. The machine takes cards too!", 'أوه، هذا لا يكفي للأسف. الآلة تقبل البطاقة أيضًا!')),
  ]),
};
