// Femke hires you (jobs for Amsterdam, docs/GAME_DESIGN.md §9.1): the job intro, "a normal conversation with the boss" and the first step
// of the Shift screen. She asks with u, then offers je the Dutch way (「Zeg maar je, hoor!」), and has you say the two things you say to a
// guest: 「Hallo, welkom!」 and 「Dank u wel! Fijne dag nog!」 (staff keep u with the guests). No money moves here.
import type { IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

const YES = ['ja', 'graag', 'zeker', 'natuurlijk', 'oké', 'ok', 'prima', 'leuk', 'goed'];
/** the polite way out of the offer (any time) */
const later = (): IntentDef => ({ id: 'later', any: ['later', 'misschien', 'nee', 'geen tijd', 'niet'], next: 'leave' });
const ACCEPT = L('Ja, graag!', 'Yes, I’d like to!', 'نعم، بكل سرور!');

export const JOBINTRO_AMS_CAFE: Scenario = {
  id: 'jobintro_ams_cafe',
  locationId: 'ams_cafe',
  characterId: 'femke',
  level: 'A1',
  title: { en: 'Help out at the café', ar: 'ساعد في المقهى' },
  setup: {
    en: 'Femke needs a hand in Café De Gracht. Say yes, then say the two things you say to a guest: welcome, and thanks with a nice day.',
    ar: 'تحتاج فيمكه إلى مساعدة في مقهى «دي خراخت». قل نعم، ثم قل عبارتين تقولهما للضيف: أهلًا، وشكرًا مع أمنية بيوم سعيد.',
  },
  minutes: 2,
  steps: [
    { id: 'accept', text: { en: 'Say you will help out', ar: 'قل إنك ستساعد' } },
    { id: 'greet', text: { en: 'Welcome a guest: Hallo, welkom!', ar: 'رحّب بضيف: Hallo, welkom!' } },
    { id: 'thanks', text: { en: 'Thank a guest: Dank u wel!', ar: 'اشكر ضيفًا: Dank u wel!' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hallo! Het is zo druk vandaag. Wilt u mij helpen in het café?', 'Hi! It’s so busy today. Would you like to help me in the café?', 'أهلًا! المقهى مزدحم جدًا اليوم. هل تريد أن تساعدني فيه؟'))],
      suggestions: [S('Ja, graag!', 'Yes, I’d like to!', 'نعم، بكل سرور!'), S('Wat moet ik doen?', 'What do I have to do?', 'ماذا عليّ أن أفعل؟'), S('Misschien later.', 'Maybe later.', 'ربما لاحقًا.')],
      intents: [
        { id: 'accept', any: YES, none: ['wat', 'later', 'misschien'], next: 'accept', step: 'accept', ideal: ACCEPT },
        { id: 'ask_what', any: ['wat', 'doen', 'werk', 'hoe'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'explain',
      say: [
        say(
          L(
            'De gasten bestellen koffie en taart. U zegt de prijs en rekent af. Wilt u?',
            'The guests order coffee and cake. You say the price and take the payment. Would you like to?',
            'يطلب الضيوف القهوة والفطائر. تقول السعر وتحصّل الحساب. هل تريد؟',
          ),
        ),
      ],
      suggestions: [S('Ja, graag!', 'Yes, I’d like to!', 'نعم، بكل سرور!'), S('Misschien later.', 'Maybe later.', 'ربما لاحقًا.')],
      intents: [{ id: 'accept', any: YES, none: ['later', 'misschien'], next: 'accept', step: 'accept', ideal: ACCEPT }, later()],
    }),
    node({
      id: 'accept',
      emotion: 'happy',
      step: 'accept',
      say: [
        say(
          L(
            'Top! Zeg maar je, hoor. Ik ben Femke. Daar komt een gast. Zeg: „Hallo, welkom!“',
            'Great! Just call me je, okay? I’m Femke. Here comes a guest. Say: “Hallo, welkom!”',
            'رائع! خاطبني بـ«je»، اتفقنا؟ أنا فيمكه. ها هو ضيف قادم. قل: «Hallo, welkom!»',
          ),
        ),
      ],
      suggestions: [S('Hallo, welkom!', 'Hello, welcome!', 'أهلًا، مرحبًا بك!')],
      intents: [
        { id: 'greet', any: ['welkom', 'hallo', 'goedemorgen', 'goedemiddag', 'goedenavond', 'hoi', 'dag'], next: 'thanks', step: 'greet', ideal: L('Hallo, welkom!', 'Hello, welcome!', 'أهلًا، مرحبًا بك!') },
        later(),
      ],
    }),
    node({
      id: 'thanks',
      emotion: 'happy',
      step: 'greet',
      say: [
        say(
          L(
            'Goed zo! De gast betaalt en gaat weg. Zeg: „Dank u wel! Fijne dag nog!“',
            'Well done! The guest pays and leaves. Say: “Dank u wel! Fijne dag nog!”',
            'أحسنت! الضيف يدفع ويغادر. قل: «Dank u wel! Fijne dag nog!»',
          ),
        ),
      ],
      suggestions: [S('Dank u wel! Fijne dag nog!', 'Thank you! Have a nice day!', 'شكرًا جزيلًا! يومًا سعيدًا!')],
      intents: [
        { id: 'thanks', any: ['dank u', 'dank je', 'bedankt', 'fijne dag'], next: 'done', step: 'thanks', ideal: L('Dank u wel! Fijne dag nog!', 'Thank you! Have a nice day!', 'شكرًا جزيلًا! يومًا سعيدًا!') },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'thanks',
      say: [say(L('Heel goed! Je kunt meteen beginnen.', 'Very good! You can start right away.', 'جيد جدًا! يمكنك أن تبدأ فورًا.'))],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: [say(L('Geen probleem. Tot later!', 'No problem. See you later!', 'لا مشكلة. إلى اللقاء!'))], intents: [] }),
  ]),
};
