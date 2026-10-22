// Content-side UI strings of Release 2 wave C2 (Chapters 7-8): the festival card's stamp-book hint, the festival day, the capstone speech (Real
// mode and its one-time Guided fallback), the Prepare rehearsal, the diary's two taps and the Letter Home. Merged into the i18n modules
// (`i18n.ts`); keys keep their feature prefix. The Letter's frame labels, starters and suggestions are pack data (`@lw/content` letter.ts).

export const en = {
  'culture.hint.matsuri': 'Go to the festival in the park (Chapter 7).',
  // the festival day (`festivalOpen`)
  'story.festivalOn': 'The park is a festival tonight!',
  'story.festivalSoon': 'The festival is in the park from your next day of play (on a Saturday, today).',
  'story.festivalSaturday': 'It is Saturday: the festival is back in the park (it comes every Saturday).',
  'story.festivalGuests': '{n} friends came to the festival',
  // the capstone
  'story.speechReal': 'Your speech is in Real mode: no chips. Hint and “say it your way” still help, but those lines are not your own.',
  'story.speechGuidedOnce': 'With chips, one time only (chip lines count half)',
  'story.speechRehearsal': 'Speech rehearsal: your five lines',
  'story.rehearsalExample': 'Example: say your own',
  // the diary
  'story.diaryTwoTaps': 'Tap what happened, then how it felt, or type your own line.',
  'story.diaryWhat': 'What happened?',
  'story.diaryFeel': 'How was it?',
  // the Letter Home
  'story.letterPreview': 'Letter preview: in Chapter 8 you write five sentences home, in your own Japanese.',
  'letter.intro': 'Five sentences to your family. Each one starts from something you did here.',
  'letter.own': '{n} of {need} sentences in your own words',
  'letter.ownTag': 'Your own',
  'letter.assistedTag': 'With help',
  'letter.suggest': 'Show 3 ideas',
  'letter.translate': 'Translate my sentence',
  'letter.needJa': 'Write the sentence in Japanese (kana or kanji).',
  'letter.noAudio': 'Only your written Japanese is kept. No audio is ever recorded.',
  'letter.save': 'Save the Letter',
  'letter.saveImage': 'Save as an image',
  'letter.readBack': 'Hanako reads it to you',
  'letter.diary': 'From my diary',
  'letter.done': 'Your Letter is written!',
  'letter.needMore': 'Write at least {need} sentences in your own words (typed or spoken) to finish the Letter.',
} as const;

export const ar = {
  'culture.hint.matsuri': 'اذهب إلى المهرجان في الحديقة (الفصل 7).',
  'story.festivalOn': 'الحديقة مهرجان الليلة!',
  'story.festivalSoon': 'المهرجان في الحديقة من يوم لعبك التالي (ويوم السبت من اليوم).',
  'story.festivalSaturday': 'اليوم السبت: عاد المهرجان إلى الحديقة (يأتي كل يوم سبت).',
  'story.festivalGuests': 'جاء {n} أصدقاء إلى المهرجان',
  'story.speechReal': 'كلمتك في الوضع الحقيقي: بلا اقتراحات. التلميح و«قلها بطريقتك» يساعدان، لكن تلك الجمل ليست من عندك.',
  'story.speechGuidedOnce': 'مع الاقتراحات، مرة واحدة فقط (جمل الاقتراحات تُحتسب بالنصف)',
  'story.speechRehearsal': 'بروفة الكلمة: جملك الخمس',
  'story.rehearsalExample': 'مثال: قل ما يخصك',
  'story.diaryTwoTaps': 'اضغط على ما حدث ثم على شعورك، أو اكتب سطرك.',
  'story.diaryWhat': 'ماذا حدث؟',
  'story.diaryFeel': 'كيف كان؟',
  'story.letterPreview': 'لمحة عن الرسالة: في الفصل 8 تكتب خمس جمل إلى أهلك بلغتك اليابانية أنت.',
  'letter.intro': 'خمس جمل إلى أسرتك. تبدأ كل جملة بشيء فعلته هنا.',
  'letter.own': '{n} من {need} جمل بكلماتك',
  'letter.ownTag': 'من عندك',
  'letter.assistedTag': 'بمساعدة',
  'letter.suggest': 'اعرض 3 أفكار',
  'letter.translate': 'ترجم جملتي',
  'letter.needJa': 'اكتب الجملة باليابانية (كانا أو كانجي).',
  'letter.noAudio': 'يُحفظ ما كتبته باليابانية فقط. لا يُسجَّل أي صوت أبدًا.',
  'letter.save': 'احفظ الرسالة',
  'letter.saveImage': 'احفظها كصورة',
  'letter.readBack': 'تقرؤها لك هاناكو',
  'letter.diary': 'من يومياتي',
  'letter.done': 'كُتبت رسالتك!',
  'letter.needMore': 'اكتب {need} جمل على الأقل بكلماتك (كتابةً أو نطقًا) لتنهي الرسالة.',
} as const;
