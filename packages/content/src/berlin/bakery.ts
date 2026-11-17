// Bäckerei Krüger: Jana's breakfast counter, the first German conversation (German step 1). Order rolls, a pretzel or Berlin's
// Pfannkuchen, maybe a coffee for here or to go, and pay. Jana speaks to customers with Sie. With the flag `cashOnly` (many small
// Berlin bakeries) a card is politely refused and cash is asked for. Lines are German markup: words separated by spaces.
import type { Character, IntentDef, Line, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

/** cents, by slot option */
export const BAKERY_PRICES: Record<string, number> = { broetchen: 45, brezel: 120, croissant: 150, pfannkuchen: 180, kaffee: 250, kakao: 280 };

/** what Berlin's characters say to the global intents (thanks, slow, a greeting, …) and when they did not understand */
export const DE_REACTIONS = {
  greet: L('Hallo!', 'Hello!', 'مرحبًا!'),
  thanks: L('Gern geschehen.', "You're welcome.", 'عفوًا.'),
  excuse: L('Ja, bitte?', 'Yes, please?', 'نعم، تفضّل؟'),
  how_are_you: L('Gut, danke!', 'Good, thanks!', 'بخير، شكرًا!'),
  slow: L('Gerne. Ich spreche langsamer.', 'Sure. I’ll speak more slowly.', 'بكل سرور. سأتكلّم أبطأ.'),
  goodbye: L('Auf Wiedersehen!', 'Goodbye!', 'مع السلامة!'),
  fallback: L('Wie bitte? Noch einmal, bitte.', 'Sorry? Once more, please.', 'عفوًا؟ مرة أخرى من فضلك.'),
} satisfies Record<string, Line>;

export const JANA: Character = {
  id: 'jana',
  name: { ja: 'Jana Krüger', reading: 'Jana Krüger', en: 'Jana Krüger', ar: 'يانا كروغر' },
  age: 34,
  job: { en: 'Baker at Bäckerei Krüger', ar: 'خبّازة في مخبز كروغر' },
  bio: {
    en: 'Took over her parents’ corner bakery in Kreuzberg. Opens at six, knows every regular’s order and says Schrippe, never Brötchen.',
    ar: 'تولّت مخبز والديها على الناصية في كرويتسبرغ. تفتح في السادسة، وتعرف طلب كل زبون دائم، وتقول «شريبه» لا «بروتشن».',
  },
  personality: { en: 'Brisk, warm, Berlin-direct', ar: 'سريعة، ودودة، صريحة على طريقة برلين' },
  interests: ['food', 'music'],
  speaking: { rate: 1.05, pitch: 1.05, voice: 'f' },
  avatar: {
    skin: '#f3d3bd',
    hair: { style: 'bun', color: '#8a5a2b' },
    top: '#f4efe6',
    bottom: '#3d3a36',
    shoes: '#2f2a26',
    accent: '#c8873a',
    accessories: ['apron'],
  },
  locationId: 'berlin_bakery',
  scenarioId: 'berlin_bakery',
};

const order: IntentDef = {
  id: 'order',
  slot: 'bakery',
  slotRequired: true,
  alsoSlots: ['qty'],
  next: 'more',
  step: 'order',
  request: true,
  ideal: L('Zwei Brötchen, bitte.', 'Two rolls, please.', 'خبزتان صغيرتان من فضلك.'),
};

const ORDER_CHIPS = [S('Zwei Brötchen, bitte.', 'Two rolls, please.', 'خبزتان صغيرتان من فضلك.'), S('Eine Brezel, bitte.', 'A pretzel, please.', 'بريتزل واحد من فضلك.')];

export const BAKERY: Scenario = {
  id: 'berlin_bakery',
  locationId: 'berlin_bakery',
  characterId: 'jana',
  level: 'A1',
  title: { en: 'Breakfast from the bakery', ar: 'فطور من المخبز' },
  setup: {
    en: 'Bäckerei Krüger on the corner, eight in the morning. Order something for breakfast, maybe a coffee, and pay.',
    ar: 'مخبز كروغر على الناصية، الثامنة صباحًا. اطلب شيئًا للفطور، وربما قهوة، ثم ادفع.',
  },
  minutes: 3,
  steps: [
    { id: 'order', text: { en: 'Order something to eat', ar: 'اطلب شيئًا تأكله' } },
    { id: 'drink', text: { en: 'Get a drink, for here or to go', ar: 'اطلب مشروبًا، هنا أو للأخذ' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Guten Morgen! Was darf es sein?', 'Good morning! What can I get you?', 'صباح الخير! ماذا تريد؟'))],
      suggestions: [...ORDER_CHIPS, S('Was können Sie empfehlen?', 'What can you recommend?', 'بماذا تنصحني؟')],
      intents: [order, { id: 'recommend', any: ['empfehlen', 'empfehlung', 'was ist gut', 'was ist frisch'], next: 'recommend' }],
    }),
    node({
      id: 'recommend',
      emotion: 'excited',
      say: [
        say(
          L(
            'Die Pfannkuchen sind heute ganz frisch. In Berlin sagen wir Pfannkuchen, nicht Berliner!',
            'The doughnuts are really fresh today. In Berlin we say Pfannkuchen, not Berliner!',
            'الدونات طازجة جدًا اليوم. في برلين نقول «بفانكوخن» لا «برلينر»!',
          ),
        ),
      ],
      suggestions: [S('Dann einen Pfannkuchen, bitte.', 'Then a doughnut, please.', 'إذن دونات واحدة من فضلك.'), ORDER_CHIPS[0]!],
      intents: [order],
    }),
    node({
      id: 'more',
      say: [say(L('Gerne. Sonst noch etwas?', 'Sure. Anything else?', 'بكل سرور. هل تريد شيئًا آخر؟'))],
      suggestions: [
        S('Und einen Kaffee, bitte.', 'And a coffee, please.', 'وقهوة من فضلك.'),
        S('Nein, danke. Das ist alles.', "No, thanks. That's all.", 'لا، شكرًا. هذا كل شيء.'),
        S('Was kostet das?', 'How much is that?', 'كم سعر ذلك؟'),
      ],
      intents: [
        { id: 'drink', slot: 'bakeryDrink', slotRequired: true, next: 'to_go', step: 'drink', request: true, ideal: L('Und einen Kaffee, bitte.', 'And a coffee, please.', 'وقهوة من فضلك.') },
        { id: 'no_more', any: ['nein', 'das ist alles', 'das wars', 'sonst nichts', 'nichts mehr'], next: 'pay' },
        { id: 'ask_price', any: ['was kostet', 'wie viel', 'wieviel', 'kostet', 'zahlen'], next: 'pay' },
      ],
    }),
    node({
      id: 'to_go',
      say: [say(L('Für hier oder zum Mitnehmen?', 'For here or to go?', 'هنا أم للأخذ؟'))],
      suggestions: [S('Zum Mitnehmen, bitte.', 'To go, please.', 'للأخذ من فضلك.'), S('Für hier, bitte.', 'For here, please.', 'هنا من فضلك.')],
      intents: [
        { id: 'to_go', any: ['mitnehmen', 'to go', 'mit'], next: 'pay', request: true, ideal: L('Zum Mitnehmen, bitte.', 'To go, please.', 'للأخذ من فضلك.') },
        { id: 'for_here', any: ['hier', 'hiertrinken'], next: 'pay', request: true, ideal: L('Für hier, bitte.', 'For here, please.', 'هنا من فضلك.') },
      ],
    }),
    node({
      id: 'pay',
      say: [
        say(L('Das macht {total}. Bar oder mit Karte?', 'That comes to {total}. Cash or card?', 'المجموع {total}. نقدًا أم بالبطاقة؟'), { flag: 'priced' }),
        say(L('Gerne. Bar oder mit Karte?', 'Sure. Cash or card?', 'حسنًا. نقدًا أم بالبطاقة؟')),
      ],
      suggestions: [S('Mit Karte, bitte.', 'By card, please.', 'بالبطاقة من فضلك.'), S('Bar, bitte.', 'Cash, please.', 'نقدًا من فضلك.')],
      intents: [
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next: 'bye' },
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'bye' },
        // a small Berlin bakery often takes cash only: the card is refused kindly, and the cash chip and answer stay
        {
          id: 'card_refused',
          when: { flag: 'cashOnly' },
          slot: 'payMethod',
          slotOptions: ['card'],
          slotRequired: true,
          stay: true,
          boost: 20,
          reply: L('Tut mir leid, wir nehmen nur Bargeld.', 'Sorry, we only take cash.', 'آسفة، نقبل النقد فقط.'),
        },
        { id: 'pay_ok', any: ['hier bitte', 'bitte schon', 'bitte sehr', 'stimmt so'], next: 'bye' },
      ],
    }),
    node({
      id: 'bye',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('Danke schön! Einen schönen Tag noch!', 'Thank you! Have a nice day!', 'شكرًا جزيلًا! أتمنى لك يومًا سعيدًا!'))],
      intents: [],
    }),
    node({
      id: 'short',
      end: true,
      say: [
        say(
          L(
            'Oh, das reicht leider nicht. Kein Problem, vielleicht beim nächsten Mal!',
            "Oh, that's not quite enough, I'm afraid. No problem, maybe next time!",
            'أوه، هذا لا يكفي للأسف. لا مشكلة، ربما في المرة القادمة!',
          ),
        ),
      ],
      intents: [],
    }),
  ]),
};
