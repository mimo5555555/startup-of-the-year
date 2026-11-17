// The Döner stand at Kottbusser Tor: Emre's lunch counter. A Döner, a Dürüm or a Falafel, 「mit allem und scharf?」, here or to go, pay.
import type { Character, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS, askToPay, payIntents, saleDone, shortOfMoney } from './common';

/** cents, by slot option */
export const DOENER_PRICES: Record<string, number> = { doener: 650, duerum: 750, falafel: 550 };

export const EMRE: Character = {
  id: 'emre',
  name: { ja: 'Emre Aydın', reading: 'Emre Aydın', en: 'Emre Aydın', ar: 'أمره أيدن' },
  age: 29,
  job: { en: 'Cook at the Döner stand at Kottbusser Tor', ar: 'طبّاخ في كشك الدونر عند «كوتبوسر تور»' },
  bio: {
    en: 'Born in Kreuzberg, cuts the meat like his father did and asks every customer the Berlin question: mit allem und scharf?',
    ar: 'وُلد في كرويتسبرغ، يقطع اللحم كما كان يفعل أبوه، ويسأل كل زبون السؤال البرليني: مع كل شيء وحار؟',
  },
  personality: { en: 'Fast, cheerful, jokes while he works', ar: 'سريع، مرح، يمزح وهو يعمل' },
  interests: ['food', 'sports'],
  speaking: { rate: 1.1, pitch: 1, voice: 'm' },
  avatar: {
    skin: '#c99a73',
    hair: { style: 'short', color: '#1d1a18' },
    top: '#ffffff',
    bottom: '#33302c',
    shoes: '#222222',
    accent: '#d1452f',
    accessories: ['apron', 'cap'],
  },
  locationId: 'berlin_doener',
  scenarioId: 'berlin_doener',
};

export const DOENER: Scenario = {
  id: 'berlin_doener',
  locationId: 'berlin_doener',
  characterId: 'emre',
  level: 'A1',
  title: { en: 'Lunch at the Döner stand', ar: 'غداء عند كشك الدونر' },
  setup: {
    en: 'Lunchtime at Kottbusser Tor. Order a Döner, a Dürüm or a Falafel just the way you like it, and pay.',
    ar: 'وقت الغداء عند «كوتبوسر تور». اطلب دونر أو دوروم أو فلافل كما تحبّه، ثم ادفع.',
  },
  minutes: 3,
  steps: [
    { id: 'order', text: { en: 'Order', ar: 'اطلب' } },
    { id: 'extras', text: { en: 'Say how you want it', ar: 'قل كيف تريده' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hallo! Was darf es sein?', 'Hi! What can I get you?', 'أهلًا! ماذا تريد؟'))],
      suggestions: [
        S('Einen Döner, bitte.', 'A döner, please.', 'دونر واحد من فضلك.'),
        S('Einen Dürüm, bitte.', 'A dürüm wrap, please.', 'دوروم واحد من فضلك.'),
        S('Eine Falafel, bitte.', 'A falafel, please.', 'فلافل من فضلك.'),
      ],
      intents: [
        { id: 'order', slot: 'doener', slotRequired: true, alsoSlots: ['qty'], next: 'extras', step: 'order', request: true, ideal: L('Einen Döner, bitte.', 'A döner, please.', 'دونر واحد من فضلك.') },
      ],
    }),
    node({
      id: 'extras',
      say: [say(L('Mit allem? Und scharf?', 'With everything? And spicy?', 'مع كل شيء؟ وحار؟'))],
      suggestions: [
        S('Ja, mit allem und scharf, bitte.', 'Yes, with everything and spicy, please.', 'نعم، مع كل شيء وحار من فضلك.'),
        S('Mit allem, aber ohne Zwiebeln, bitte.', 'With everything, but no onions, please.', 'مع كل شيء، لكن بدون بصل من فضلك.'),
        S('Nicht scharf, bitte.', 'Not spicy, please.', 'غير حار من فضلك.'),
      ],
      intents: [
        { id: 'everything', any: ['mit allem', 'alles', 'ja', 'scharf'], next: 'to_go', step: 'extras', request: true, ideal: L('Ja, mit allem und scharf, bitte.', 'Yes, with everything and spicy, please.', 'نعم، مع كل شيء وحار من فضلك.') },
        { id: 'no_onions', any: ['ohne zwiebel', 'keine zwiebel', 'ohne die zwiebel'], next: 'to_go', step: 'extras', request: true, ideal: L('Mit allem, aber ohne Zwiebeln, bitte.', 'With everything, but no onions, please.', 'مع كل شيء، لكن بدون بصل من فضلك.') },
        { id: 'not_spicy', any: ['nicht scharf', 'ohne scharf', 'nicht so scharf', 'kein scharf'], next: 'to_go', step: 'extras', request: true, ideal: L('Nicht scharf, bitte.', 'Not spicy, please.', 'غير حار من فضلك.') },
      ],
    }),
    node({
      id: 'to_go',
      say: [say(L('Alles klar. Hier essen oder zum Mitnehmen?', 'All right. Eat here or to go?', 'تمام. تأكل هنا أم للأخذ؟'))],
      suggestions: [S('Zum Mitnehmen, bitte.', 'To go, please.', 'للأخذ من فضلك.'), S('Hier, bitte.', 'Here, please.', 'هنا من فضلك.')],
      intents: [
        { id: 'to_go', any: ['mitnehmen', 'to go', 'mit'], next: 'pay', request: true, ideal: L('Zum Mitnehmen, bitte.', 'To go, please.', 'للأخذ من فضلك.') },
        { id: 'for_here', any: ['hier'], next: 'pay', request: true, ideal: L('Hier, bitte.', 'Here, please.', 'هنا من فضلك.') },
      ],
    }),
    node({ id: 'pay', say: askToPay(), suggestions: PAY_CHIPS, intents: payIntents('bye') }),
    saleDone(L('Danke! Guten Appetit!', 'Thanks! Enjoy your meal!', 'شكرًا! بالهناء والشفاء!')),
    shortOfMoney(),
  ]),
};
