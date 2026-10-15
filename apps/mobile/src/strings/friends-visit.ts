// UI strings for hang-outs and home visits (Release 2 wave B1): the door tooltips, the room names, the genkan hint and the reward toasts.
// Every key needs an English and an Arabic string; keys are prefixed 'fv.'. The host's lines (the genkan, the door) are content, in
// `GENKAN` / `DOOR_LOCKED` of `@lw/content`; these are the app's own words around them.

export const en = {
  'fv.door.enter': "Visit {name}'s home",
  'fv.door.locked': 'Not yet: you need {hearts} hearts with {name}.',
  'fv.room.mio_1r': "Mio's room",
  'fv.room.aiko_tatami': "Aiko's tatami room",
  'fv.room.kenji_flat': "Kenji's flat",
  'fv.genkan.title': 'The entrance (genkan)',
  'fv.genkan.hint': 'First take your shoes off, then put on the slippers.',
  'fv.genkan.leave': 'Leave',
  'fv.props.hint': 'Tap things in the room to learn their names.',
  'fv.props.found': '{found} of {total} words found',
  'fv.hang.title': 'Hang out',
  'fv.hang.cooldown': 'You hung out recently. Come back in {days} days.',
  'fv.hang.locked': 'Hang out with {name} from 3 hearts.',
  'fv.reward.keepsake': 'Keepsake: {name}',
  'fv.reward.item': 'You received {name}.',
  'fv.reward.visit': 'Visit complete: +{ap} friendship.',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'fv.door.enter': 'زيارة بيت {name}',
  'fv.door.locked': 'ليس بعد: تحتاج إلى {hearts} قلوب مع {name}.',
  'fv.room.mio_1r': 'غرفة ميو',
  'fv.room.aiko_tatami': 'غرفة أيكو ذات الحصير',
  'fv.room.kenji_flat': 'شقة كينجي',
  'fv.genkan.title': 'المدخل (جنكان)',
  'fv.genkan.hint': 'اخلع حذاءك أولًا، ثم البس الخفّ.',
  'fv.genkan.leave': 'مغادرة',
  'fv.props.hint': 'المس الأشياء في الغرفة لتتعلم أسماءها.',
  'fv.props.found': 'وجدت {found} من {total} كلمات',
  'fv.hang.title': 'اقضيا وقتًا معًا',
  'fv.hang.cooldown': 'قضيتما وقتًا معًا مؤخرًا. عُد بعد {days} أيام.',
  'fv.hang.locked': 'اقضِ وقتًا مع {name} عند ثلاثة قلوب.',
  'fv.reward.keepsake': 'تذكار: {name}',
  'fv.reward.item': 'حصلت على {name}.',
  'fv.reward.visit': 'اكتملت الزيارة: +{ap} صداقة.',
};
