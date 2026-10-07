// UI strings for part-time shifts. Every key needs an English and an Arabic string; keys are prefixed 'jobs.'.

export const en = {
  'jobs.start': 'Start shift',
  'jobs.helping': 'Helping out',
  'jobs.showText': 'Show Japanese text (×0.7)',
  'jobs.showTrans': 'Show translation (×0.5)',
  'jobs.pay': 'You earned ¥{n}',
  'jobs.rest': 'Enough for today. Come back tomorrow!',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'jobs.start': 'ابدأ الوردية',
  'jobs.helping': 'مساعدة',
  'jobs.showText': 'أظهر النص الياباني (×0.7)',
  'jobs.showTrans': 'أظهر الترجمة (×0.5)',
  'jobs.pay': 'ربحت ¥{n}',
  'jobs.rest': 'يكفي لهذا اليوم. عُد غدًا!',
};
