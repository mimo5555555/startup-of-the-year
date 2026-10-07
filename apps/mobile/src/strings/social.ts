// UI strings for friends, phone chat, gifts and visiting. Every key needs an English and an Arabic string; keys are prefixed 'social.'.

export const en = {
  'social.hearts': 'Hearts',
  'social.next': 'Next at {n} hearts: {what}',
  'social.gift': 'Give a gift',
  'social.card': 'Friend card',
  'social.heartUp': '{name} likes you more now!',
  'social.notYet': 'Not yet',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'social.hearts': 'القلوب',
  'social.next': 'عند {n} قلوب: {what}',
  'social.gift': 'قدّم هدية',
  'social.card': 'بطاقة الصديق',
  'social.heartUp': '{name} يحبك أكثر الآن!',
  'social.notYet': 'ليس بعد',
};
