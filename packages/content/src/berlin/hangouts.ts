// Hang-outs with Berlin's friends at three hearts (German step 5): Sunday cake in the WG kitchen with Lena, a flat tyre in the courtyard
// with Kofi, and a board-game night at the café with Jonas (Mensch ärgere dich nicht). Each is a little task done together in du:
// helping, handing things over, reacting. They pay hearts (kind `hangout`, one every few days), never euros.
import type { Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

const YES = ['ja', 'gern', 'gerne', 'klar', 'okay', 'natürlich', 'naturlich', 'sicher', 'super'];

export const HANG_LENA: Scenario = {
  id: 'hang_lena_backen',
  locationId: 'berlin_wg',
  characterId: 'lena',
  level: 'A1',
  title: { en: 'Sunday cake with Lena', ar: 'كعكة الأحد مع لينا' },
  setup: {
    en: 'Sunday in the WG kitchen: Lena is baking an apple cake. Help her, hand her what she asks for, and say how it tastes.',
    ar: 'الأحد في مطبخ السكن: لينا تخبز كعكة تفاح. ساعدها وناولها ما تطلبه وقل كيف طعمها.',
  },
  minutes: 4,
  steps: [
    { id: 'help', text: { en: 'Offer to help', ar: 'اعرض المساعدة' } },
    { id: 'kitchen', text: { en: 'Hand her the eggs and stir', ar: 'ناولها البيض وحرّك' } },
    { id: 'praise', text: { en: 'Say how the cake tastes', ar: 'قل كيف طعم الكعكة' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Es ist Sonntag! Ich backe einen Apfelkuchen. Hilfst du mir?', 'It’s Sunday! I’m baking an apple cake. Will you help me?', 'إنه الأحد! أخبز كعكة تفاح. هل تساعدني؟'))],
      suggestions: [S('Ja, gern! Was soll ich machen?', 'Yes, gladly! What should I do?', 'نعم، بكل سرور! ماذا أفعل؟'), S('Klar! Ich helfe dir.', 'Sure! I’ll help you.', 'طبعًا! سأساعدك.')],
      intents: [{ id: 'help', any: [...YES, 'helfe', 'hilf', 'machen'], next: 'eggs', step: 'help', ideal: L('Ja, gern! Was soll ich machen?', 'Yes, gladly! What should I do?', 'نعم، بكل سرور! ماذا أفعل؟') }],
    }),
    node({
      id: 'eggs',
      say: [say(L('Super! Kannst du mir bitte drei Eier geben?', 'Great! Can you give me three eggs, please?', 'رائع! هل تعطيني ثلاث بيضات من فضلك؟'))],
      suggestions: [S('Hier sind drei Eier.', 'Here are three eggs.', 'هذه ثلاث بيضات.'), S('Klar, hier, bitte!', 'Sure, here you go!', 'طبعًا، تفضّلي!')],
      intents: [{ id: 'eggs', any: ['eier', 'hier', 'bitte', 'klar', 'bitteschön'], next: 'stir', ideal: L('Hier sind drei Eier.', 'Here are three eggs.', 'هذه ثلاث بيضات.') }],
    }),
    node({
      id: 'stir',
      say: [say(L('Danke! Und jetzt umrühren, bitte. Nicht zu schnell!', 'Thanks! And now stir, please. Not too fast!', 'شكرًا! والآن حرّك من فضلك. ليس بسرعة!'))],
      suggestions: [S('Okay, ich rühre langsam.', 'Okay, I’ll stir slowly.', 'حسنًا، سأحرّك ببطء.'), S('So richtig?', 'Like this?', 'هكذا صحيح؟')],
      intents: [{ id: 'stir', any: ['rühre', 'ruhre', 'langsam', 'so', 'richtig', 'okay', 'mache'], next: 'oven', step: 'kitchen', ideal: L('Okay, ich rühre langsam.', 'Okay, I’ll stir slowly.', 'حسنًا، سأحرّك ببطء.') }],
    }),
    node({
      id: 'oven',
      say: [say(L('Perfekt! Jetzt vierzig Minuten in den Ofen. Willst du einen Tee?', 'Perfect! Now forty minutes in the oven. Would you like a tea?', 'ممتاز! والآن أربعون دقيقة في الفرن. هل تريد شايًا؟'))],
      suggestions: [S('Ja, gern!', 'Yes, please!', 'نعم، من فضلك!'), S('Nein, danke.', 'No, thanks.', 'لا، شكرًا.')],
      intents: [
        { id: 'tea_no', any: ['nein', 'nicht', 'kein'], next: 'taste' },
        { id: 'tea_yes', any: [...YES, 'tee', 'bitte'], none: ['nein', 'nicht'], next: 'taste' },
      ],
    }),
    node({
      id: 'taste',
      emotion: 'excited',
      say: [say(L('Der Kuchen ist fertig! Probier mal. Wie schmeckt er?', 'The cake is ready! Have a taste. How does it taste?', 'الكعكة جاهزة! تذوّق. كيف طعمها؟'))],
      suggestions: [S('Sehr lecker!', 'Very tasty!', 'لذيذة جدًا!'), S('Mmh, der ist super!', 'Mmm, it’s great!', 'ممم، إنها رائعة!')],
      intents: [{ id: 'praise', any: ['lecker', 'gut', 'super', 'toll', 'schmeckt', 'mmh', 'köstlich', 'kostlich', 'lecker'], next: 'end', step: 'praise', ideal: L('Sehr lecker!', 'Very tasty!', 'لذيذة جدًا!') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('Danke für deine Hilfe, {name}! Ein schöner Sonntag.', 'Thanks for your help, {name}! A lovely Sunday.', 'شكرًا على مساعدتك يا {name}! يوم أحد جميل.'))],
      intents: [],
    }),
  ]),
};

export const HANG_KOFI: Scenario = {
  id: 'hang_kofi_rad',
  locationId: 'berlin_hof',
  characterId: 'kofi',
  level: 'A1',
  title: { en: 'A flat tyre with Kofi', ar: 'إطار مثقوب مع كوفي' },
  setup: {
    en: 'Saturday in the courtyard: Kofi’s bike has a flat tyre. Help him, pass him the pump, hold the bike, maybe take it for a ride.',
    ar: 'السبت في الفناء: إطار درّاجة كوفي مثقوب. ساعده وناوله المنفاخ وأمسك الدرّاجة، وربما تجرّبها.',
  },
  minutes: 4,
  steps: [
    { id: 'help', text: { en: 'Offer to help', ar: 'اعرض المساعدة' } },
    { id: 'tool', text: { en: 'Pass the pump and hold the bike', ar: 'ناوله المنفاخ وأمسك الدرّاجة' } },
    { id: 'chat', text: { en: 'Answer his thanks', ar: 'أجب على شكره' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Hey {name}! Mein Rad hat einen Platten. Hilfst du mir?', 'Hey {name}! My bike has a flat tyre. Will you help me?', 'أهلًا يا {name}! إطار درّاجتي مثقوب. هل تساعدني؟'))],
      suggestions: [S('Klar! Was brauchst du?', 'Sure! What do you need?', 'طبعًا! ماذا تحتاج؟'), S('Ja, gern!', 'Yes, gladly!', 'نعم، بكل سرور!')],
      intents: [{ id: 'help', any: [...YES, 'helfe', 'brauchst'], next: 'pump', step: 'help', ideal: L('Klar! Was brauchst du?', 'Sure! What do you need?', 'طبعًا! ماذا تحتاج؟') }],
    }),
    node({
      id: 'pump',
      say: [say(L('Gib mir bitte die Pumpe. Sie liegt neben dem Werkzeug.', 'Give me the pump, please. It’s next to the tools.', 'أعطني المنفاخ من فضلك. إنه بجانب العدّة.'))],
      suggestions: [S('Hier ist die Pumpe.', 'Here’s the pump.', 'هذا هو المنفاخ.'), S('Die Pumpe? Hier, bitte.', 'The pump? Here you go.', 'المنفاخ؟ تفضّل.')],
      intents: [{ id: 'pump', any: ['pumpe', 'hier', 'bitte'], next: 'hold', ideal: L('Hier ist die Pumpe.', 'Here’s the pump.', 'هذا هو المنفاخ.') }],
    }),
    node({
      id: 'hold',
      say: [say(L('Danke! Kannst du das Rad kurz festhalten?', 'Thanks! Can you hold the bike for a moment?', 'شكرًا! هل تمسك الدرّاجة قليلًا؟'))],
      suggestions: [S('Ja, ich halte es fest.', 'Yes, I’m holding it.', 'نعم، أمسكها.'), S('So, okay?', 'Like this, okay?', 'هكذا، حسنًا؟')],
      intents: [{ id: 'hold', any: ['halte', 'fest', 'so', 'okay', 'ja', 'klar'], next: 'ride', step: 'tool', ideal: L('Ja, ich halte es fest.', 'Yes, I’m holding it.', 'نعم، أمسكها.') }],
    }),
    node({
      id: 'ride',
      emotion: 'excited',
      say: [say(L('Fertig! Willst du eine Runde fahren?', 'Done! Do you want to take it for a spin?', 'انتهينا! هل تريد أن تجرّبها جولة؟'))],
      suggestions: [S('Ja, gern!', 'Yes, I’d love to!', 'نعم، بكل سرور!'), S('Lieber nicht, danke.', 'I’d rather not, thanks.', 'أفضّل لا، شكرًا.')],
      intents: [
        { id: 'ride_no', any: ['nein', 'nicht', 'lieber'], next: 'thanks' },
        { id: 'ride_yes', any: [...YES, 'fahre', 'runde'], none: ['nein', 'nicht'], next: 'thanks' },
      ],
    }),
    node({
      id: 'thanks',
      emotion: 'happy',
      say: [say(L('Danke, {name}! Zusammen geht alles schneller.', 'Thanks, {name}! Everything goes faster together.', 'شكرًا يا {name}! كل شيء أسرع معًا.'))],
      suggestions: [S('Gern geschehen!', 'You’re welcome!', 'عفوًا!'), S('Das hat Spaß gemacht!', 'That was fun!', 'كان ذلك ممتعًا!')],
      intents: [{ id: 'thanks', any: ['gern', 'gerne', 'spaß', 'spass', 'bitte', 'kein problem', 'super', 'toll', 'immer'], next: 'end', step: 'chat', ideal: L('Gern geschehen!', 'You’re welcome!', 'عفوًا!') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('Bis bald! Und komm mit deinem Rad vorbei!', 'See you soon! And bring your bike round!', 'إلى اللقاء! وتعال بدرّاجتك!'))],
      intents: [],
    }),
  ]),
};

export const HANG_JONAS: Scenario = {
  id: 'hang_jonas_spiel',
  locationId: 'berlin_cafe',
  characterId: 'jonas',
  level: 'A1',
  title: { en: 'Game night with Jonas', ar: 'سهرة ألعاب مع يوناس' },
  setup: {
    en: 'Game night at the café: Jonas teaches you Mensch ärgere dich nicht. Pick a colour, roll the dice, cheer.',
    ar: 'سهرة ألعاب في المقهى: يوناس يعلّمك لعبة «Mensch ärgere dich nicht». اختر لونًا وارمِ النرد وشجّع.',
  },
  minutes: 4,
  steps: [
    { id: 'colour', text: { en: 'Pick a colour', ar: 'اختر لونًا' } },
    { id: 'play', text: { en: 'Roll the dice and say what you got', ar: 'ارمِ النرد وقل ماذا حصلت' } },
    { id: 'cheer', text: { en: 'Answer at the end of the game', ar: 'أجب في نهاية اللعبة' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: [say(L('Spieleabend! Kennst du Mensch ärgere dich nicht?', 'Game night! Do you know Mensch ärgere dich nicht?', 'سهرة ألعاب! هل تعرف لعبة «Mensch ärgere dich nicht»؟'))],
      suggestions: [S('Nein, wie geht das?', 'No, how does it work?', 'لا، كيف تُلعب؟'), S('Ja, das kenne ich!', 'Yes, I know it!', 'نعم، أعرفها!')],
      intents: [{ id: 'know', any: ['nein', 'ja', 'kenne', 'wie geht', 'kenn'], next: 'rules' }],
    }),
    node({
      id: 'rules',
      say: [say(L('Ganz einfach: Du würfelst und läufst mit deinen Figuren. Welche Farbe willst du?', 'Easy: you roll the dice and move your pieces. Which colour do you want?', 'بسيطة جدًا: ترمي النرد وتحرّك قطعك. أيّ لون تريد؟'))],
      suggestions: [S('Ich nehme Rot.', 'I’ll take red.', 'سآخذ الأحمر.'), S('Blau, bitte.', 'Blue, please.', 'الأزرق من فضلك.')],
      intents: [{ id: 'colour', any: ['rot', 'blau', 'grün', 'grun', 'gelb'], next: 'turn', step: 'colour', ideal: L('Ich nehme Rot.', 'I’ll take red.', 'سآخذ الأحمر.') }],
    }),
    node({
      id: 'turn',
      say: [say(L('Gute Wahl! Du bist dran. Würfel mal!', 'Good choice! It’s your turn. Roll the dice!', 'اختيار موفّق! دورك. ارمِ النرد!'))],
      suggestions: [S('Eine Sechs!', 'A six!', 'ستة!'), S('Oh, nur eine Eins.', 'Oh, only a one.', 'أوه، واحد فقط.')],
      intents: [
        { id: 'six', any: ['sechs', '6'], next: 'six', step: 'play', ideal: L('Eine Sechs!', 'A six!', 'ستة!') },
        { id: 'small', any: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'funf', 'nur', '1', '2', '3', '4', '5'], next: 'small', step: 'play' },
      ],
    }),
    node({
      id: 'six',
      emotion: 'excited',
      say: [say(L('Wow, eine Sechs! Du darfst noch mal würfeln.', 'Wow, a six! You can roll again.', 'واو، ستة! يمكنك أن ترمي مرة أخرى.'))],
      suggestions: [S('Super!', 'Great!', 'رائع!'), S('Juhu!', 'Yay!', 'يا هلا!')],
      intents: [{ id: 'cheer', any: ['super', 'juhu', 'toll', 'ja', 'cool', 'gut', 'okay'], next: 'win' }],
    }),
    node({
      id: 'small',
      say: [say(L('Schade! Jetzt bin ich dran.', 'Too bad! Now it’s my turn.', 'للأسف! الآن دوري.'))],
      suggestions: [S('Viel Glück!', 'Good luck!', 'بالتوفيق!'), S('Okay, du bist dran.', 'Okay, your turn.', 'حسنًا، دورك.')],
      intents: [{ id: 'luck', any: ['glück', 'gluck', 'okay', 'dran', 'los', 'gut', 'ja'], next: 'win' }],
    }),
    node({
      id: 'win',
      emotion: 'happy',
      say: [say(L('Und am Ende: Du hast gewonnen! Glückwunsch, {name}!', 'And in the end: you won! Congratulations, {name}!', 'وفي النهاية: لقد فزت! مبروك يا {name}!'))],
      suggestions: [S('Danke! Noch eine Runde?', 'Thanks! Another round?', 'شكرًا! جولة أخرى؟'), S('Das war lustig!', 'That was fun!', 'كان ذلك ممتعًا!')],
      intents: [{ id: 'cheer', any: ['danke', 'runde', 'lustig', 'spaß', 'spass', 'toll', 'super', 'cool', 'schön'], next: 'end', step: 'cheer', ideal: L('Danke! Noch eine Runde?', 'Thanks! Another round?', 'شكرًا! جولة أخرى؟') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('Klar! Nächste Woche wieder, okay?', 'Sure! Again next week, okay?', 'طبعًا! الأسبوع القادم من جديد، اتفقنا؟'))],
      intents: [],
    }),
  ]),
};

export const DE_HANGOUTS: Scenario[] = [HANG_LENA, HANG_KOFI, HANG_JONAS];
