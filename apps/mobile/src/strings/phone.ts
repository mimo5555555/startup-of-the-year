// UI strings for the phone: Messages. Every key needs an English and an Arabic string; keys are prefixed 'phone.'.

export const en = {
  'phone.title': 'Messages',
  'phone.voice': 'Voice message (tap to listen)',
  'phone.reveal': 'Show text',
  'phone.unread': '{n} new',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'phone.title': 'الرسائل',
  'phone.voice': 'رسالة صوتية (اضغط للاستماع)',
  'phone.reveal': 'أظهر النص',
  'phone.unread': '{n} جديدة',
};
