// UI strings for the Hikarigaoka trip panel (Release 2 wave C1). Every key needs an English and an Arabic string; keys are prefixed 'trip.'.

export const en = {
  'trip.scene': 'Hikarigaoka station square',
  'trip.riding': 'On the train to Hikarigaoka…',
  'trip.short': 'The round trip to Hikarigaoka costs {fare}, there and back. You have {have}.',
  'trip.paid': 'Round trip paid: {fare}',
  'trip.shortIc': 'The trip to Hikarigaoka costs {fare} in cash or {icFare} by IC card. You have {have} in cash and {ic} on your card.',
  'trip.shortBack': 'Your ticket takes you there; the way back costs {fare}. You have {have}.',
  'trip.paidBack': 'Your ticket takes you there. Way back paid: {fare}',
  'trip.realTry': "Hanako's challenge: this one without hint chips. You can switch back above.",
} as const;

export const ar: Record<keyof typeof en, string> = {
  'trip.scene': 'ساحة محطة هيكاريغاؤكا',
  'trip.riding': 'في القطار إلى هيكاريغاؤكا…',
  'trip.short': 'الرحلة ذهابًا وإيابًا إلى هيكاريغاؤكا تكلّف {fare}. معك {have}.',
  'trip.paid': 'تم دفع الرحلة ذهابًا وإيابًا: {fare}',
  'trip.shortIc': 'الرحلة إلى هيكاريغاؤكا تكلّف {fare} نقدًا أو {icFare} ببطاقة IC. معك {have} نقدًا و{ic} في البطاقة.',
  'trip.shortBack': 'تذكرتك توصلك إلى هناك، والعودة تكلّف {fare}. معك {have}.',
  'trip.paidBack': 'تذكرتك توصلك إلى هناك. تم دفع العودة: {fare}',
  'trip.realTry': 'تحدّي المعلّمة هاناكو: هذه المرة بلا أزرار اقتراحات. يمكنك العودة بالأعلى.',
};
