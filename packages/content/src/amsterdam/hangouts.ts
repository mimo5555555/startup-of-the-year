// Hang-outs with Amsterdam's friends at three hearts (Dutch step 4): pancakes on Sanne's houseboat, a bike ride to the Vondelpark with
// Daan, and Noor's mother's birthday (the circle where you congratulate everyone). Each is a little thing done together in je: helping,
// handing things over, reacting. They pay hearts (kind `hangout`, one every few days), never euros.
import type { Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

const YES = ['ja', 'graag', 'leuk', 'zeker', 'oké', 'natuurlijk', 'tuurlijk', 'super', 'top', 'gezellig'];

export const HANG_SANNE: Scenario = {
  id: 'hang_sanne_pannenkoek',
  locationId: 'ams_boot',
  characterId: 'sanne',
  level: 'A1',
  title: { en: 'Pancakes on the houseboat', ar: 'فطائر على البيت العائم' },
  setup: {
    en: 'Sanne is making pancakes on her houseboat. Help her, hand her what she asks for, choose the topping and say how it tastes.',
    ar: 'سانه تحضّر الفطائر على بيتها العائم. ساعدها وناولها ما تطلبه واختر الإضافة وقل كيف طعمها.',
  },
  minutes: 4,
  steps: [
    { id: 'help', text: { en: 'Offer to help', ar: 'اعرض المساعدة' } },
    { id: 'kitchen', text: { en: 'Hand her the milk and eggs, flip the pancake', ar: 'ناولها الحليب والبيض واقلب الفطيرة' } },
    { id: 'praise', text: { en: 'Say how it tastes', ar: 'قل كيف طعمها' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hé {name}! Ik bak pannenkoeken op de boot. Eet je mee?', 'Hey {name}! I’m making pancakes on the boat. Will you join me?', 'أهلًا يا {name}! أحضّر الفطائر على القارب. هل تأكل معي؟'))],
      suggestions: [S('Ja, graag! Kan ik helpen?', 'Yes, please! Can I help?', 'نعم، بكل سرور! هل أساعد؟'), S('Lekker! Ik help je.', 'Yum! I’ll help you.', 'لذيذ! سأساعدك.')],
      intents: [{ id: 'help', any: [...YES, 'help', 'helpen', 'lekker', 'eet mee'], next: 'batter', step: 'help', ideal: L('Ja, graag! Kan ik helpen?', 'Yes, please! Can I help?', 'نعم، بكل سرور! هل أساعد؟') }],
    }),
    node({
      id: 'batter',
      say: [say(L('Top! Kun je de melk en de eieren pakken?', 'Great! Can you get the milk and the eggs?', 'رائع! هل تجلب الحليب والبيض؟'))],
      suggestions: [S('Hier zijn de melk en de eieren.', 'Here are the milk and the eggs.', 'هذا هو الحليب والبيض.'), S('Ja, hier!', 'Yes, here!', 'نعم، تفضّلي!')],
      intents: [{ id: 'batter', any: ['melk', 'eieren', 'hier', 'alsjeblieft', 'ja'], next: 'flip', ideal: L('Hier zijn de melk en de eieren.', 'Here are the milk and the eggs.', 'هذا هو الحليب والبيض.') }],
    }),
    node({
      id: 'flip',
      emotion: 'excited',
      say: [say(L('En nu omdraaien! Durf jij?', 'And now flip it! Do you dare?', 'والآن اقلبها! هل تجرؤ؟'))],
      suggestions: [S('Ja, ik draai hem om!', 'Yes, I’ll flip it!', 'نعم، سأقلبها!'), S('Oei, help je mij?', 'Oops, will you help me?', 'أوه، هل تساعدينني؟')],
      intents: [{ id: 'flip', any: ['draai', 'om', 'ja', 'help', 'oei', 'durf'], next: 'topping', step: 'kitchen', ideal: L('Ja, ik draai hem om!', 'Yes, I’ll flip it!', 'نعم، سأقلبها!') }],
    }),
    node({
      id: 'topping',
      say: [say(L('Gelukt! Wil je stroop of poedersuiker?', 'Done it! Would you like syrup or powdered sugar?', 'نجحنا! هل تريد شرابًا حلوًا أم سكرًا ناعمًا؟'))],
      suggestions: [S('Stroop, graag!', 'Syrup, please!', 'الشراب الحلو من فضلك!'), S('Poedersuiker, graag.', 'Powdered sugar, please.', 'السكر الناعم من فضلك.')],
      intents: [{ id: 'topping', any: ['stroop', 'poedersuiker', 'suiker', 'allebei', 'beide'], next: 'taste' }],
    }),
    node({
      id: 'taste',
      emotion: 'happy',
      say: [say(L('Eet smakelijk! En, lekker?', 'Enjoy! So, is it good?', 'بالهناء! هل هي لذيذة؟'))],
      suggestions: [S('Heel lekker!', 'Very tasty!', 'لذيذة جدًا!'), S('Mmm, heerlijk!', 'Mmm, delicious!', 'ممم، شهية!')],
      intents: [{ id: 'praise', any: ['lekker', 'heerlijk', 'goed', 'super', 'top', 'mmm'], next: 'end', step: 'praise', ideal: L('Heel lekker!', 'Very tasty!', 'لذيذة جدًا!') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('Gezellig, {name}! Kom gauw weer langs op de boot.', 'That was lovely, {name}! Come by the boat again soon.', 'كان ذلك جميلًا يا {name}! تعال إلى القارب مجددًا قريبًا.'))],
      intents: [],
    }),
  ]),
};

export const HANG_DAAN: Scenario = {
  id: 'hang_daan_vondelpark',
  locationId: 'ams_straat',
  characterId: 'daan',
  level: 'A1',
  title: { en: 'A bike ride with Daan', ar: 'جولة بالدرّاجة مع دان' },
  setup: {
    en: 'Daan cycles with you to the Vondelpark. Signal your turn, watch out for the tram, and chat on the grass.',
    ar: 'دان يركب الدرّاجة معك إلى حديقة «فوندلبارك». أشِر بيدك عند الانعطاف، وانتبه للترام، ودردشا على العشب.',
  },
  minutes: 4,
  steps: [
    { id: 'join', text: { en: 'Say yes to the ride', ar: 'وافق على الجولة' } },
    { id: 'signal', text: { en: 'Signal your turn', ar: 'أشِر بيدك عند الانعطاف' } },
    { id: 'chat', text: { en: 'Say what you think of cycling here', ar: 'قل رأيك في ركوب الدرّاجة هنا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hé {name}! Fiets je mee naar het Vondelpark?', 'Hey {name}! Will you cycle to the Vondelpark with me?', 'أهلًا يا {name}! هل تأتي معي بالدرّاجة إلى «فوندلبارك»؟'))],
      suggestions: [S('Ja, leuk!', 'Yes, great!', 'نعم، جميل!'), S('Graag! Is het ver?', 'I’d love to! Is it far?', 'بكل سرور! هل هي بعيدة؟')],
      intents: [{ id: 'join', any: [...YES, 'ver', 'fiets'], next: 'ride', step: 'join', ideal: L('Ja, leuk!', 'Yes, great!', 'نعم، جميل!') }],
    }),
    node({
      id: 'ride',
      say: [say(L('Nee, tien minuten. Let op: hier gaan we linksaf. Steek je hand uit!', 'No, ten minutes. Careful: we turn left here. Stick your hand out!', 'لا، عشر دقائق. انتبه: هنا ننعطف يسارًا. مدّ يدك!'))],
      suggestions: [S('Oké, ik steek mijn hand uit.', 'Okay, I’m sticking my hand out.', 'حسنًا، أمدّ يدي.'), S('Linksaf, begrepen!', 'Left, got it!', 'يسارًا، فهمت!')],
      intents: [{ id: 'signal', any: ['hand', 'steek', 'links', 'linksaf', 'oké', 'begrepen', 'ja'], next: 'tram', step: 'signal', ideal: L('Oké, ik steek mijn hand uit.', 'Okay, I’m sticking my hand out.', 'حسنًا، أمدّ يدي.') }],
    }),
    node({
      id: 'tram',
      emotion: 'surprised',
      say: [say(L('Pas op, een tram! Rem maar even.', 'Watch out, a tram! Brake for a moment.', 'انتبه، ترام! اضغط على الفرامل قليلًا.'))],
      suggestions: [S('Ik rem!', 'I’m braking!', 'أضغط على الفرامل!'), S('Oei, dat was dichtbij!', 'Phew, that was close!', 'أوه، كان ذلك قريبًا!')],
      intents: [{ id: 'brake', any: ['rem', 'pas op', 'oei', 'stop', 'wacht', 'dichtbij'], next: 'park' }],
    }),
    node({
      id: 'park',
      emotion: 'happy',
      say: [say(L('We zijn er! Zullen we op het gras zitten?', 'We’re here! Shall we sit on the grass?', 'وصلنا! هل نجلس على العشب؟'))],
      suggestions: [S('Ja, gezellig!', 'Yes, lovely!', 'نعم، جميل!'), S('Goed idee!', 'Good idea!', 'فكرة جيدة!')],
      intents: [{ id: 'sit', any: [...YES, 'goed', 'idee'], next: 'chat' }],
    }),
    node({
      id: 'chat',
      say: [say(L('Wat vind jij van fietsen in Amsterdam?', 'What do you think of cycling in Amsterdam?', 'ما رأيك في ركوب الدرّاجة في أمستردام؟'))],
      suggestions: [S('Het is druk, maar leuk!', 'It’s busy, but fun!', 'إنه مزدحم، لكنه ممتع!'), S('Ik vind het super!', 'I think it’s great!', 'أراه رائعًا!')],
      intents: [{ id: 'opinion', any: ['druk', 'leuk', 'super', 'fijn', 'eng', 'spannend', 'mooi', 'goed', 'vind'], next: 'end', step: 'chat', ideal: L('Het is druk, maar leuk!', 'It’s busy, but fun!', 'إنه مزدحم، لكنه ممتع!') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('Jij bent nu een echte Amsterdammer, {name}!', 'You’re a real Amsterdammer now, {name}!', 'أنت الآن أمستردامي حقيقي يا {name}!'))],
      intents: [],
    }),
  ]),
};

export const HANG_NOOR: Scenario = {
  id: 'hang_noor_verjaardag',
  locationId: 'ams_taalcafe',
  characterId: 'noor',
  level: 'A1',
  title: { en: 'A Dutch birthday with Noor', ar: 'عيد ميلاد هولندي مع نور' },
  setup: {
    en: 'Noor’s mother’s birthday: the guests sit in a circle and you congratulate everyone. Gefeliciteerd!',
    ar: 'عيد ميلاد والدة نور: يجلس الضيوف في دائرة وتهنّئ الجميع. Gefeliciteerd!',
  },
  minutes: 4,
  steps: [
    { id: 'join', text: { en: 'Say yes to the party', ar: 'وافق على الحفلة' } },
    { id: 'congrats', text: { en: 'Congratulate the family', ar: 'هنّئ العائلة' } },
    { id: 'chat', text: { en: 'Answer Noor at the end', ar: 'أجب نور في النهاية' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hoi {name}! Mijn moeder is jarig. Kom je mee naar het feestje?', 'Hi {name}! It’s my mother’s birthday. Will you come to the party?', 'مرحبًا يا {name}! اليوم عيد ميلاد أمي. هل تأتي إلى الحفلة؟'))],
      suggestions: [S('Ja, gezellig!', 'Yes, lovely!', 'نعم، جميل!'), S('Graag! Wat moet ik zeggen?', 'I’d love to! What should I say?', 'بكل سرور! ماذا يجب أن أقول؟')],
      intents: [{ id: 'join', any: [...YES, 'zeggen', 'moet'], next: 'tip', step: 'join', ideal: L('Ja, gezellig!', 'Yes, lovely!', 'نعم، جميل!') }],
    }),
    node({
      id: 'tip',
      say: [say(L('Bij ons feliciteer je iedereen. Zeg tegen mijn vader: Gefeliciteerd met je vrouw!', 'Here you congratulate everyone. Say to my father: Congratulations on your wife!', 'عندنا تهنّئ الجميع. قل لأبي: مبروك على زوجتك!'))],
      suggestions: [S('Gefeliciteerd met je vrouw!', 'Congratulations on your wife!', 'مبروك على زوجتك!'), S('Gefeliciteerd!', 'Congratulations!', 'مبروك!')],
      intents: [{ id: 'congrats', any: ['gefeliciteerd', 'proficiat'], next: 'circle', ideal: L('Gefeliciteerd met je vrouw!', 'Congratulations on your wife!', 'مبروك على زوجتك!') }],
    }),
    node({
      id: 'circle',
      emotion: 'excited',
      say: [say(L('Perfect! En daar is mijn oom Wim. Feliciteer hem ook!', 'Perfect! And there’s my uncle Wim. Congratulate him too!', 'ممتاز! وهذا عمّي فيم. هنّئه أيضًا!'))],
      suggestions: [S('Gefeliciteerd met je zus!', 'Congratulations on your sister!', 'مبروك على أختك!'), S('Gefeliciteerd, Wim!', 'Congratulations, Wim!', 'مبروك يا فيم!')],
      intents: [{ id: 'congrats_again', any: ['gefeliciteerd', 'proficiat'], next: 'cake', step: 'congrats', ideal: L('Gefeliciteerd met je zus!', 'Congratulations on your sister!', 'مبروك على أختك!') }],
    }),
    node({
      id: 'cake',
      say: [say(L('Wil je een stukje taart en een kopje koffie?', 'Would you like a slice of cake and a cup of coffee?', 'هل تريد قطعة كعك وفنجان قهوة؟'))],
      suggestions: [S('Ja, graag!', 'Yes, please!', 'نعم، من فضلك!'), S('Een kopje thee, graag.', 'A cup of tea, please.', 'فنجان شاي من فضلك.')],
      intents: [{ id: 'cake', any: [...YES, 'koffie', 'thee', 'taart', 'kopje'], next: 'well' }],
    }),
    node({
      id: 'well',
      emotion: 'happy',
      say: [say(L('Je doet het heel goed! Echt Nederlands!', 'You’re doing really well! Very Dutch!', 'أنت تبلي حسنًا جدًا! هولندي حقًا!'))],
      suggestions: [S('Dank je! Heel gezellig hier.', 'Thanks! It’s really nice here.', 'شكرًا! الجو لطيف جدًا هنا.'), S('Ik vind het een leuk feest!', 'I think it’s a lovely party!', 'أراها حفلة جميلة!')],
      intents: [{ id: 'chat', any: ['dank', 'gezellig', 'leuk', 'fijn', 'feest', 'super', 'mooi'], next: 'end', step: 'chat', ideal: L('Dank je! Heel gezellig hier.', 'Thanks! It’s really nice here.', 'شكرًا! الجو لطيف جدًا هنا.') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('Bedankt dat je er was, {name}!', 'Thanks for coming, {name}!', 'شكرًا لأنك أتيت يا {name}!'))],
      intents: [],
    }),
  ]),
};

export const NL_HANGOUTS: Scenario[] = [HANG_SANNE, HANG_DAAN, HANG_NOOR];
