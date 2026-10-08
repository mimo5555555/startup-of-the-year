import type { Interaction, Pred } from '@lw/game';

// The full interaction table (docs/GAME_DESIGN.md §6.1, chapter gates of §4.5 / §7.2). One NPC, several things to do: the Interaction
// sheet lists the ones that are open now, and only opens when there are two or more (else Talk starts the one option directly).
//
//  - `ch` is the chapter from which the option is listed (chapter.n >= ch); `gate` is an extra predicate (hearts, a finished scenario).
//  - ids of scenarios and jobs that later slices build are named here already: the app hides an option whose target is not
//    registered yet, and `validatePack` ignores unresolved ids below level 5 (§14.5).
//  - order matters: the first open option is the primary (what Talk does for a character with one open option).
//  - ids: `<npc>_<what>`; the trip keeps `trip_hikarigaoka` and the home visits `home_<friend>` because the objective engine finds
//    them by those names (`visit trip:hikarigaoka`, `visit home:*`), so chapter 5 / 6 `opens` list those ids.

const hearts = (friend: string, atLeast: number): Pred => ({ k: 'hearts', friend, atLeast });

const scenario = (id: string, scenarioId: string, en: string, ar: string, more: Partial<Interaction> = {}): Interaction => ({
  id,
  kind: 'scenario',
  scenarioId,
  label: { en, ar },
  ...more,
});

const gift = (who: string): Interaction => ({ id: `${who}_gift`, kind: 'gift', label: { en: 'Give a gift', ar: 'قدّم هدية' }, ch: 3 });
const talk = (who: string, more: Partial<Interaction> = {}): Interaction =>
  scenario(`${who}_talk`, `smalltalk_${who}`, 'Small talk', 'دردشة', { ch: 3, ...more });
const hang = (who: string, scenarioId: string): Interaction => scenario(`${who}_hang`, scenarioId, 'Hang out', 'اقضيا وقتًا معًا', { ch: 3, gate: hearts(who, 3) });
const home = (who: string): Interaction => ({ id: `home_${who}`, kind: 'visit', scenarioId: `home_${who}`, label: { en: 'Visit home', ar: 'زيارة البيت' }, ch: 6, gate: hearts(who, 4) });
const shift = (who: string, jobId: string, ch: number): Interaction => ({ id: `${who}_shift`, kind: 'shift', jobId, label: { en: 'Work a shift', ar: 'اعمل وردية' }, ch });
const lesson = (lessonId: string, en: string, ar: string, ch: number): Interaction => ({ id: `lesson_${lessonId}`, kind: 'lesson', lessonId, label: { en, ar }, ch });
const peek = (who: string, shopId: string): Interaction => ({ id: `${who}_window`, kind: 'window', shopId, label: { en: 'Look through the window', ar: 'انظر عبر النافذة' }, ch: 2 });

/** Pack data: characterId -> interactions: the full table (2B). */
export const INTERACTIONS: Record<string, Interaction[]> = {
  tanaka: [
    scenario('tanaka_shop', 'konbini', 'Buy something', 'اشترِ شيئًا'),
    shift('tanaka', 'job_konbini', 2),
    talk('tanaka', { gate: hearts('tanaka', 1) }),
    gift('tanaka'),
  ],
  yuki: [scenario('yuki_shop', 'cafe', 'Order a drink', 'اطلب مشروبًا'), shift('yuki', 'job_cafe', 3), talk('yuki'), gift('yuki'), hang('yuki', 'hang_yuki_jam')],
  sato: [
    scenario('sato_info', 'station', 'Ask about trains', 'اسأل عن القطارات'),
    scenario('sato_ic', 'station_ic', 'Get or top up an IC card', 'احصل على بطاقة IC أو اشحنها'),
    scenario('sato_way', 'sato_directions', 'Ask the way', 'اسأل عن الطريق', { ch: 3 }),
    { id: 'trip_hikarigaoka', kind: 'trip', scenarioId: 'trip_hikarigaoka', label: { en: 'Take the train', ar: 'اركب القطار' }, ch: 5 },
    shift('sato', 'job_station', 5),
    talk('sato'),
    gift('sato'),
  ],
  kenji: [scenario('kenji_shop', 'ramen', 'Eat ramen', 'تناول الرامن'), talk('kenji'), gift('kenji'), hang('kenji', 'hang_kenji_cook'), home('kenji')],
  hanako: [
    lesson('greetings', 'Greetings', 'التحيات', 1),
    lesson('numbers', 'Numbers and money', 'الأرقام والمال', 1),
    lesson('shopping', 'Shopping phrases', 'عبارات التسوق', 1),
    lesson('polite_casual', 'Polite and casual', 'مهذب وعادي', 3),
    lesson('directions', 'Directions', 'الاتجاهات', 3),
    lesson('home_manners', 'Manners at home', 'آداب البيت', 5),
    // "small talk after a lesson": the first lesson has to be done
    talk('hanako', { gate: { k: 'lesson', id: 'greetings' } }),
    gift('hanako'),
  ],
  mio: [scenario('mio_meet', 'park', 'Talk in the park', 'تحدّث في الحديقة'), talk('mio'), gift('mio'), hang('mio', 'hang_mio_photo'), home('mio')],
  aoi: [scenario('aoi_shop', 'denki_phone', 'Look for a phone', 'ابحث عن هاتف'), peek('aoi', 'denki')],
  rin: [
    scenario('rin_shop', 'fuku_clothes', 'Shop for clothes', 'تسوّق للملابس'),
    scenario('rin_home', 'fuku_home', 'Second-hand furniture', 'أثاث مستعمل', { ch: 5 }),
    talk('rin'),
    gift('rin'),
  ],
  aiko: [
    scenario('aiko_shop', 'aiko_tea', 'Tea house and gifts', 'بيت الشاي والهدايا'),
    scenario('aiko_viewing', 'aiko_viewing', 'See the room at Ono-sō', 'شاهد الغرفة في أونو-سو', { ch: 6 }),
    scenario('aiko_contract', 'aiko_contract', 'Sign for the room', 'وقّع على الغرفة', { ch: 6, gate: { k: 'scenario', id: 'aiko_viewing', complete: true } }),
    talk('aiko'),
    gift('aiko'),
    hang('aiko', 'hang_aiko_wagashi'),
    home('aiko'),
  ],
  nakamura: [
    // after the first visit Talk offers the bike first (§6.1): the bike is listed before the visit and opens once the visit is done
    scenario('nakamura_bike', 'motors_bike', 'Buy a bike', 'اشترِ دراجة', { ch: 5, gate: { k: 'scenario', id: 'motors_visit', complete: true } }),
    scenario('nakamura_visit', 'motors_visit', 'Look around the garage', 'تجوّل في الورشة', { ch: 5 }),
    // browsing opens in Chapter 7; buying is Free Walk (the scenario's own gate)
    scenario('nakamura_car', 'motors_car', 'Look at the cars', 'شاهد السيارات', { ch: 7 }),
    talk('nakamura'),
    gift('nakamura'),
    peek('nakamura', 'motors'),
  ],
  // trip only: no spawn in the district, the trip panel starts this scenario
  kato: [scenario('kato_trip', 'trip_hikarigaoka', 'Chat with Kato', 'تحدّث مع كاتو')],
};
