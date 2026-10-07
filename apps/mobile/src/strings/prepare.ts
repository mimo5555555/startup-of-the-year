// UI strings for the Prepare (Phrase Pocket) screen. Every key needs an English and an Arabic string; keys are prefixed 'prep.'.

export const en = {
  'prep.title': 'Get ready',
  'prep.skip': 'Skip (no +10% prepared bonus)',
  'prep.ready': "You're ready",
  'prep.mode.guided': 'Guided',
  'prep.mode.real': 'Real (no chips, +25%)',
  'prep.recall': 'Say it from memory',
  'prep.peek': 'Peek (no bonus for this line)',
  'prep.build': 'Build it from the pieces',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'prep.title': 'استعدّ',
  'prep.skip': 'تخطَّ (بلا مكافأة الاستعداد 10%)',
  'prep.ready': 'كل شيء جاهز',
  'prep.mode.guided': 'موجَّه',
  'prep.mode.real': 'حقيقي (بلا اقتراحات، +25%)',
  'prep.recall': 'قلها من الذاكرة',
  'prep.peek': 'ألقِ نظرة (بلا مكافأة لهذه الجملة)',
  'prep.build': 'ابنِها من القطع',
};
