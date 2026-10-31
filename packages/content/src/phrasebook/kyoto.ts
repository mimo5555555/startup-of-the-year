import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases of the Kyoto Journey (Goen stage 1): the ryokan, the temple counter and the matcha café. Paying is the shared `pay_cash` / IC rows. English without contractions; ids unique across modules. */
export const KYOTO_PHRASES: PhraseEntry[] = [
  // ---- the ryokan (Fujiwara-san) ----
  P(
    'kyoto_reservation',
    '予約|した|{name}|です。',
    ['i have a reservation my name is {name}', 'i have a reservation under {name}', 'a reservation for {name}', 'i am {name} i have a reservation', 'reservation under {name}'],
    ['لدي حجز باسم {name}', 'لديّ حجز باسم {name}', 'حجز باسم {name}', 'أنا {name} لدي حجز', 'انا {name} لدي حجز'],
    { slot: 'name' },
  ),
  P(
    'kyoto_nights',
    '{nights}|です。',
    ['{nights}', '{nights} please', 'for {nights}', 'i will stay {nights}', 'i am staying {nights}', 'we are staying {nights}'],
    ['{nights}', 'لمدة {nights}', 'سأبقى {nights}', 'سأقيم {nights}'],
    { slot: 'nights', closedSlot: true },
  ),
  P(
    'kyoto_dinner_six',
    '六時|で|お願いします。',
    ['at six please', 'six please', 'six oclock please', 'at 6 please', 'dinner at six please', 'at six', 'six oclock'],
    ['في السادسة من فضلك', 'السادسة من فضلك', 'الساعة السادسة', 'في الساعة السادسة', 'العشاء في السادسة'],
  ),
  P(
    'kyoto_dinner_seven',
    '七時|で|お願いします。',
    ['at seven please', 'seven please', 'seven oclock please', 'at 7 please', 'dinner at seven please', 'at seven', 'seven oclock'],
    ['في السابعة من فضلك', 'السابعة من فضلك', 'الساعة السابعة', 'في الساعة السابعة', 'العشاء في السابعة'],
  ),
  P(
    'kyoto_in_your_care',
    'ありがとうございます。|お世話|に|なります。',
    ['thank you i am in your care', 'thank you for looking after me', 'i am in your care', 'thank you for taking care of me'],
    ['شكرا أنا في رعايتكم', 'شكرًا أنا في رعايتكم', 'شكرا على استضافتي', 'شكرًا على استضافتي', 'أنا في رعايتكم'],
  ),
  P(
    'kyoto_where_bath',
    'お風呂|は|どこ|です|か？',
    ['where is the bath', 'where is the bath please', 'where is the bathhouse', 'where can i take a bath'],
    ['أين حمام الاستحمام', 'اين حمام الاستحمام', 'أين أستحم', 'أين حوض الاستحمام'],
  ),
  // ---- the temple (Ishida-san) ----
  P(
    'kyoto_where_garden',
    '庭|は|どこ|です|か？',
    ['where is the garden', 'where is the temple garden', 'where is the garden please', 'can i see the garden'],
    ['أين حديقة المعبد', 'اين حديقة المعبد', 'أين حديقة المعبد من فضلك'],
  ),
  P(
    'kyoto_leaves_pretty',
    '紅葉|が|きれい|です|ね。',
    ['the autumn leaves are beautiful', 'the leaves are beautiful', 'the autumn leaves are pretty', 'the red leaves are beautiful'],
    ['أوراق الخريف جميلة', 'اوراق الخريف جميلة', 'الأوراق جميلة'],
  ),
  P(
    'kyoto_omamori_please',
    'お守り|を|ください。',
    ['an omamori please', 'omamori please', 'i would like an omamori', 'a charm please', 'i would like a charm', 'can i have an omamori'],
    ['تميمة من فضلك', 'أريد تميمة', 'اريد تميمة', 'أوماموري من فضلك'],
  ),
  P(
    'kyoto_omamori_kind',
    '{omamori}|の|お守り|を|ください。',
    ['the {omamori} one please', '{omamori} please', 'one for {omamori} please', 'the one for {omamori} please', 'an omamori for {omamori} please', '{omamori}'],
    ['تميمة {omamori} من فضلك', '{omamori} من فضلك', 'تميمة ل{omamori}', '{omamori}'],
    { slot: 'omamori', closedSlot: true },
  ),
  P(
    'kyoto_goshuin_please',
    'はい、|御朱印|を|お願いします。',
    ['a goshuin please', 'goshuin please', 'yes a goshuin please', 'i would like a goshuin', 'a temple stamp please', 'yes please a goshuin'],
    ['غوشوين من فضلك', 'نعم غوشوين من فضلك', 'أريد غوشوين', 'اريد غوشوين', 'ختم المعبد من فضلك'],
  ),
  P(
    'kyoto_what_goshuin',
    '御朱印|は|何|です|か？',
    ['what is a goshuin', 'what is goshuin', 'what is the goshuin', 'what is that stamp'],
    ['ما هو الغوشوين', 'ما الغوشوين', 'ما هذا الختم'],
  ),
  // ---- the matcha café (Mori-san) ----
  P(
    'kyoto_matcha_order',
    '{matcha}|を|ください。',
    ['{matcha} please', 'i would like {matcha}', 'i will have {matcha}', 'can i have {matcha}', 'one {matcha} please', '{matcha}'],
    ['{matcha} من فضلك', 'أريد {matcha}', 'اريد {matcha}', 'سآخذ {matcha}', '{matcha}'],
    { slot: 'matcha', closedSlot: true },
  ),
  P(
    'kyoto_what_set',
    'セット|は|何|です|か？',
    ['what is the set', 'what comes with the set', 'what is in the set'],
    ['ما هو الطقم', 'ما في الطقم', 'ماذا يوجد في الطقم'],
  ),
  P(
    'kyoto_very_good',
    'とても|おいしい|です！',
    ['it is very tasty', 'this is very good', 'it is so good', 'this matcha is very good'],
    ['إنه طيب جدا', 'طيب جدا', 'هذا لذيذ للغاية', 'الماتشا لذيذة جدا'],
  ),
  P(
    'kyoto_souvenir_reco',
    'おすすめ|の|お土産|は|何|です|か？',
    ['what souvenir do you recommend', 'which souvenir do you recommend', 'what do you recommend as a souvenir', 'do you have a souvenir you recommend'],
    ['أي هدية تذكارية تنصحين بها', 'اي هدية تذكارية تنصحين بها', 'بماذا تنصحين كهدية تذكارية', 'ما الهدية التذكارية التي تنصحين بها'],
  ),
  P(
    'kyoto_yatsuhashi',
    '八ツ橋|を|ください。',
    ['yatsuhashi please', 'then yatsuhashi please', 'i will take the yatsuhashi', 'i would like yatsuhashi', 'some yatsuhashi please'],
    ['ياتسوهاشي من فضلك', 'إذن ياتسوهاشي من فضلك', 'أريد ياتسوهاشي', 'اريد ياتسوهاشي'],
  ),
  P(
    'kyoto_for_friend',
    '友達|に|八ツ橋|を|買います。',
    ['i will buy yatsuhashi for a friend', 'i will buy some yatsuhashi for my friend', 'yatsuhashi for a friend please'],
    ['سأشتري ياتسوهاشي لصديق', 'سأشتري ياتسوهاشي لصديقي', 'ياتسوهاشي لصديق من فضلك'],
  ),
];
