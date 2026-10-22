// UI strings of the Letter Home screen and the closing beats' diary step (Release 2 wave C2, the app side). The content agent's
// `story-c2.ts` holds the shared ones (frame tags, the own-count, the no-audio note); these are the screen's own buttons and states.
// Every key needs an English and an Arabic string; keys keep their feature prefix ('letter.', 'quests.').

export const en = {
  'letter.frameN': 'Sentence {n} of {total}',
  'letter.typePh': 'Type in Japanese (kana, kanji or romaji)',
  'letter.speak': 'Say it',
  'letter.use': 'Use this sentence',
  'letter.change': 'Change',
  'letter.translatePh': 'Write it in English',
  'letter.translatePhAr': 'Write it in Arabic',
  'letter.translateGo': 'Translate',
  'letter.translateNone': 'No translation for that. Try a shorter sentence.',
  'letter.diaryAdd': 'Add to the Letter',
  'letter.diaryAdded': 'In the Letter',
  'letter.finish': 'Finish the Letter',
  'letter.edit': 'Edit the Letter',
  'letter.imageSaved': 'The image is saved on this device.',
  'letter.cardTitle': 'Your Letter Home',
  'letter.hanakoRow': 'Write your Letter Home',
  'letter.diaryOr': 'or type your own line',
  'letter.diaryTyped': 'Your own line',
  'quests.storyDone': 'The story is complete: all 8 chapters. Sakura-chō is yours to walk.',
  'quests.readLetter': 'Read your Letter',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'letter.frameN': 'الجملة {n} من {total}',
  'letter.typePh': 'اكتب باليابانية (كانا أو كانجي أو روماجي)',
  'letter.speak': 'قلها',
  'letter.use': 'استخدم هذه الجملة',
  'letter.change': 'غيّر',
  'letter.translatePh': 'اكتبها بالإنجليزية',
  'letter.translatePhAr': 'اكتبها بالعربية',
  'letter.translateGo': 'ترجم',
  'letter.translateNone': 'لا ترجمة لهذا. جرّب جملة أقصر.',
  'letter.diaryAdd': 'أضفها إلى الرسالة',
  'letter.diaryAdded': 'في الرسالة',
  'letter.finish': 'أنهِ الرسالة',
  'letter.edit': 'عدّل الرسالة',
  'letter.imageSaved': 'حُفظت الصورة على هذا الجهاز.',
  'letter.cardTitle': 'رسالتك إلى الأهل',
  'letter.hanakoRow': 'اكتب رسالتك إلى الأهل',
  'letter.diaryOr': 'أو اكتب سطرك',
  'letter.diaryTyped': 'سطرك أنت',
  'quests.storyDone': 'اكتملت القصة: الفصول الثمانية كلها. ساكورا-تشو لك لتتجول فيها.',
  'quests.readLetter': 'اقرأ رسالتك',
};
