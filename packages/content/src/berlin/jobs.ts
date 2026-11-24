// Murat hires you (jobs for Berlin, docs/GAME_DESIGN.md §9.1): the job intro, "a normal conversation with the boss" and the first step of
// the Shift screen. He asks with Sie, then offers du the way a Kreuzberg Späti does (「Wir duzen uns hier, okay?」), and has you say the two
// things you say at the till: 「Hallo!」 and 「Danke schön! Schönen Abend noch!」. No money moves here.
import type { IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

const YES = ['ja', 'gern', 'gerne', 'klar', 'natürlich', 'okay', 'ok', 'mach ich', 'sehr gern'];
/** the polite way out of the offer (any time) */
const later = (): IntentDef => ({ id: 'later', any: ['später', 'vielleicht', 'nein', 'keine zeit', 'nicht'], next: 'leave' });
const ACCEPT = L('Ja, gern!', 'Yes, gladly!', 'نعم، بكل سرور!');

export const JOBINTRO_SPAETI: Scenario = {
  id: 'jobintro_spaeti',
  locationId: 'berlin_spaeti',
  characterId: 'murat',
  level: 'A1',
  title: { en: 'Help out at the Späti', ar: 'ساعد في «الشبيتي»' },
  setup: {
    en: 'Murat needs a hand at the till in the evenings. Say yes, then say the two things you say at the till: hello, and thanks with a nice evening.',
    ar: 'يحتاج مراد إلى مساعدة عند الصندوق في المساء. قل نعم، ثم قل عبارتين تقولهما عند الصندوق: مرحبًا، وشكرًا مع أمنية بأمسية سعيدة.',
  },
  minutes: 2,
  steps: [
    { id: 'accept', text: { en: 'Say you will help out', ar: 'قل إنك ستساعد' } },
    { id: 'greet', text: { en: 'Greet a customer: Hallo!', ar: 'رحّب بزبون: Hallo!' } },
    { id: 'thanks', text: { en: 'Thank a customer: Danke schön!', ar: 'اشكر زبونًا: Danke schön!' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hallo! Ich brauche abends Hilfe an der Kasse. Möchten Sie hier arbeiten?', 'Hi! I need help at the till in the evenings. Would you like to work here?', 'أهلًا! أحتاج إلى مساعدة عند الصندوق في المساء. هل تريد أن تعمل هنا؟'))],
      suggestions: [S('Ja, gern!', 'Yes, gladly!', 'نعم، بكل سرور!'), S('Was muss ich machen?', 'What do I have to do?', 'ماذا عليّ أن أفعل؟'), S('Vielleicht später.', 'Maybe later.', 'ربما لاحقًا.')],
      intents: [
        { id: 'accept', any: YES, none: ['was', 'später', 'vielleicht'], next: 'accept', step: 'accept', ideal: ACCEPT },
        { id: 'ask_what', any: ['was', 'machen', 'arbeit', 'wie'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'explain',
      say: [
        say(
          L(
            'Die Kunden kaufen Getränke. Sie sagen den Preis und kassieren. Möchten Sie?',
            'The customers buy drinks. You say the price and take the money. Would you like to?',
            'يشتري الزبائن المشروبات. تقول السعر وتأخذ المال. هل تريد؟',
          ),
        ),
      ],
      suggestions: [S('Ja, gern!', 'Yes, gladly!', 'نعم، بكل سرور!'), S('Vielleicht später.', 'Maybe later.', 'ربما لاحقًا.')],
      intents: [{ id: 'accept', any: YES, none: ['später', 'vielleicht'], next: 'accept', step: 'accept', ideal: ACCEPT }, later()],
    }),
    node({
      id: 'accept',
      emotion: 'happy',
      step: 'accept',
      say: [
        say(
          L(
            'Super! Wir duzen uns hier, okay? Ich bin Murat. Da kommt ein Kunde. Sag „Hallo!“',
            'Great! We say du to each other here, okay? I’m Murat. Here comes a customer. Say “Hallo!”',
            'رائع! نتخاطب هنا بـ«du»، اتفقنا؟ أنا مراد. ها هو زبون قادم. قل «Hallo!»',
          ),
        ),
      ],
      suggestions: [S('Hallo!', 'Hi!', 'أهلًا!')],
      intents: [{ id: 'greet', any: ['hallo', 'guten tag', 'guten abend', 'guten morgen', 'hi', 'moin', 'servus'], next: 'thanks', step: 'greet', ideal: L('Hallo!', 'Hi!', 'أهلًا!') }, later()],
    }),
    node({
      id: 'thanks',
      emotion: 'happy',
      step: 'greet',
      say: [
        say(
          L(
            'Gut! Der Kunde bezahlt und geht. Sag „Danke schön! Schönen Abend noch!“',
            'Good! The customer pays and leaves. Say “Danke schön! Schönen Abend noch!”',
            'جيد! الزبون يدفع ويغادر. قل «Danke schön! Schönen Abend noch!»',
          ),
        ),
      ],
      suggestions: [S('Danke schön! Schönen Abend noch!', 'Thank you! Have a nice evening!', 'شكرًا جزيلًا! أمسية سعيدة!')],
      intents: [
        {
          id: 'thanks',
          any: ['danke', 'vielen dank', 'schönen abend', 'schönen tag'],
          next: 'done',
          step: 'thanks',
          ideal: L('Danke schön! Schönen Abend noch!', 'Thank you! Have a nice evening!', 'شكرًا جزيلًا! أمسية سعيدة!'),
        },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'thanks',
      say: [say(L('Sehr gut! Du kannst sofort anfangen.', 'Very good! You can start right away.', 'جيد جدًا! يمكنك أن تبدأ فورًا.'))],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: [say(L('Kein Problem. Bis später!', 'No problem. See you later!', 'لا مشكلة. إلى اللقاء!'))], intents: [] }),
  ]),
};
