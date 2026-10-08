// UI strings for culture cards. Every key needs an English and an Arabic string; keys are prefixed 'culture.'.

export const en = {
  'culture.new': 'New culture card',
  'culture.empty': 'Little notes about Japanese customs will collect here as you meet them in town and in conversations.',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'culture.new': 'بطاقة ثقافية جديدة',
  'culture.empty': 'ستتجمّع هنا ملاحظات صغيرة عن العادات اليابانية كلما صادفتها في الحيّ وفي المحادثات.',
};
