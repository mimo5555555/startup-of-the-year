// UI strings for story beats, the Letter Home and the katakana name step. Every key needs an English and an Arabic string; keys are prefixed 'letter. / story.'.

export const en = {
  'letter.title': 'Letter Home',
  'story.nameKana': 'Your name in katakana',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'letter.title': 'رسالة إلى الأهل',
  'story.nameKana': 'اسمك بالكاتاكانا',
};
