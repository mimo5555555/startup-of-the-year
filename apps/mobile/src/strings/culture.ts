// UI strings for culture cards. Every key needs an English and an Arabic string; keys are prefixed 'culture.'.

export const en = {
  'culture.new': 'New culture card',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'culture.new': 'بطاقة ثقافية جديدة',
};
