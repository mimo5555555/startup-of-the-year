// UI strings for homes and the genkan. Every key needs an English and an Arabic string; keys are prefixed 'home.'.

export const en = {
  'home.shoesOff': 'Take shoes off',
  'home.slippers': 'Put on slippers',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'home.shoesOff': 'اخلع الحذاء',
  'home.slippers': 'البس الخف',
};
