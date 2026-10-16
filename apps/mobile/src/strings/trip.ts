// UI strings for the Hikarigaoka trip panel (Release 2 wave C1). Every key needs an English and an Arabic string; keys are prefixed 'trip.'.

export const en = {
  'trip.scene': 'Hikarigaoka station square',
  'trip.riding': 'On the train to Hikarigaoka…',
  'trip.short': 'The round trip to Hikarigaoka costs {fare}, there and back. You have {have}.',
  'trip.paid': 'Round trip paid: {fare}',
  'trip.realTry': "Hanako's challenge: this one without hint chips. You can switch back above.",
} as const;

export const ar: Record<keyof typeof en, string> = {
  'trip.scene': 'ساحة محطة هيكاريغاؤكا',
  'trip.riding': 'في القطار إلى هيكاريغاؤكا…',
  'trip.short': 'الرحلة ذهابًا وإيابًا إلى هيكاريغاؤكا تكلّف {fare}. معك {have}.',
  'trip.paid': 'تم دفع الرحلة ذهابًا وإيابًا: {fare}',
  'trip.realTry': 'تحدّي المعلّمة هاناكو: هذه المرة بلا أزرار اقتراحات. يمكنك العودة بالأعلى.',
};
