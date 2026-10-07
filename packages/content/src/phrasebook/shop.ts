import type { PhraseEntry } from '../types';
import { P } from './helpers';

/**
 * Phrases for paying, prices, quantities, bags, presents and ramen extras (agent 2D). Each Japanese side is language a refitted shop
 * scenario accepts (`content/test/shop-core.test.ts` plays every one at the node it belongs to). English is written without
 * contractions; ids must be unique across modules. Plain "by card" / "cash" / "how much" / "no thanks" live in the base phrasebook.
 */
export const SHOP_PHRASES: PhraseEntry[] = [
  // ---- paying ----
  P('shop_pay_ic', 'ICカード|で|お願いします。', ['by ic card', 'ic card please', 'i will pay with my ic card', 'i will pay by ic card', 'with my ic card', 'with ic card', 'ic card', 'i will use my ic card', 'suica please', 'by suica'], ['ببطاقة ic', 'بطاقة ic من فضلك', 'سادفع ببطاقة ic', 'ببطاقة المواصلات', 'بطاقة المواصلات من فضلك', 'سأدفع ببطاقة المواصلات']),

  // ---- prices ----
  P('shop_how_much_item', '{item}|は|いくら|です|か？', ['how much is {item}', 'how much is the {item}', 'how much are the {item}', 'what is the price of {item}', 'how much does {item} cost', 'how much is a {item}'], ['بكم {item}', 'كم سعر {item}', 'بكم هو {item}', 'كم ثمن {item}', 'كم يكلف {item}'], { slot: 'item', closedSlot: true }),
  P('shop_cheaper', '安い|の|は|あります|か？', ['do you have something cheaper', 'do you have anything cheaper', 'is there a cheaper one', 'something cheaper please', 'anything cheaper', 'do you have a cheaper one', 'is there anything cheaper'], ['هل لديكم شيء ارخص', 'هل يوجد شيء ارخص', 'هل عندكم ارخص', 'اريد شيئا ارخص', 'هل يوجد ارخص']),

  // ---- quantities ----
  P('shop_qty', '{qty}|ください。', ['{qty} please', 'i would like {qty}', 'i will take {qty}', 'can i have {qty}', '{qty}', 'give me {qty}'], ['{qty} من فضلك', 'اريد {qty}', 'سآخذ {qty}', '{qty}', 'اعطني {qty}'], { slot: 'qty', closedSlot: true }),

  // ---- the bag, a present, leaving politely ----
  P('shop_no_bag', 'いいえ、|大丈夫|です。', ['i do not need a bag', 'no bag', 'no bag please', 'no bag thanks', 'i do not need one', 'i do not want a bag', 'without a bag', 'no i do not need a bag'], ['لا احتاج كيسا', 'لا اريد كيسا', 'بدون كيس', 'لا حاجة للكيس', 'لا احتاج الى كيس', 'لا شكرا بدون كيس']),
  P('shop_gift_ask', 'プレゼント|を|探しています。', ['i am looking for a present', 'i am looking for a gift', 'i would like to buy a present', 'i would like to buy a gift', 'i need a present', 'i need a gift', 'do you have presents', 'do you have gifts', 'a present please', 'a gift please'], ['ابحث عن هدية', 'أبحث عن هدية', 'اريد شراء هدية', 'اريد هدية', 'هل لديكم هدايا', 'هل عندكم هدايا', 'هدية من فضلك']),
  // one phrase per present rather than a `{giftItem}` slot: the translator lower-cases a pattern before it reads the slot name, so a
  // camelCase slot (giftItem, ramenExtra) never resolves there
  P('shop_gift_choco', 'チョコレート|を|ください。', ['chocolate please', 'i would like chocolate', 'i will take the chocolate', 'can i have chocolate', 'some chocolate please', 'chocolate'], ['شوكولاتة من فضلك', 'اريد شوكولاتة', 'سآخذ الشوكولاتة', 'شوكولاتة']),
  P('shop_gift_manga', 'マンガ|を|ください。', ['a manga please', 'manga please', 'i would like a manga', 'i will take the manga', 'can i have a manga', 'manga'], ['مانغا من فضلك', 'اريد مانغا', 'سآخذ المانغا', 'مانغا']),
  P('shop_gift_game_card', 'ゲームカード|を|ください。', ['a game card please', 'game card please', 'i would like a game card', 'i will take the game card', 'can i have a game card', 'game card'], ['بطاقة ألعاب من فضلك', 'بطاقة العاب من فضلك', 'اريد بطاقة ألعاب', 'بطاقة ألعاب']),
  P('shop_come_again', 'また|来ます。', ['i will come again', 'i will come back', 'i will come back later', 'maybe next time', 'i will come again later', 'see you next time', 'i will be back'], ['سآتي مرة اخرى', 'سأعود لاحقا', 'سآتي لاحقا', 'ربما في المرة القادمة', 'سأعود']),
  P('shop_think', '考えます。', ['i will think about it', 'let me think about it', 'i will think it over', 'let me think', 'i need to think about it', 'i will consider it'], ['سأفكر في الامر', 'دعني افكر', 'سأفكر', 'سأفكر في ذلك', 'اريد ان افكر']),

  // ---- ramen ----
  P('shop_extra_egg', '味玉|を|ください。', ['an egg please', 'a seasoned egg please', 'add an egg please', 'i would like a seasoned egg', 'with an egg', 'extra egg please', 'a seasoned egg'], ['بيضة متبلة من فضلك', 'بيضة من فضلك', 'اضف بيضة من فضلك', 'مع بيضة']),
  P('shop_extra_large', '大盛|を|ください。', ['large portion please', 'a large portion please', 'make it large', 'i would like a large portion', 'a bigger portion please', 'large please'], ['حصة كبيرة من فضلك', 'اريد حصة كبيرة', 'اجعلها كبيرة', 'حجم كبير من فضلك']),
  P('shop_extra_noodles', '替え玉|を|ください。', ['extra noodles please', 'more noodles please', 'a noodle refill please', 'i would like extra noodles', 'can i have extra noodles', 'a refill please', 'extra noodles'], ['نودلز إضافية من فضلك', 'مزيد من النودلز من فضلك', 'اريد نودلز إضافية', 'نودلز اضافية من فضلك']),
  P('shop_extra_gyoza', '餃子|を|ください。', ['gyoza please', 'some gyoza please', 'i would like gyoza', 'can i have gyoza', 'add gyoza please', 'with gyoza', 'gyoza'], ['جيوزا من فضلك', 'اريد جيوزا', 'اضف جيوزا من فضلك', 'مع جيوزا']),
  P('shop_firmness', '{firmness}|で|お願いします。', ['{firmness} please', '{firmness} noodles please', 'i would like them {firmness}', 'make it {firmness}', 'i will have them {firmness}', '{firmness}'], ['{firmness} من فضلك', 'اريدها {firmness}', 'النودلز {firmness} من فضلك', '{firmness}'], { slot: 'firmness', closedSlot: true }),
];
