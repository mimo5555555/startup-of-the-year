import type { PhraseEntry } from '../types';
import { P } from './helpers';

/**
 * Phrases for the player's own room (Release 2 wave B2): the viewing at Ono-sō, the contract, the housewarming and the second-hand furniture.
 * English is written without contractions; ids must be unique across modules. Typed English or Arabic reaches the scenarios through these
 * lines (the Japanese is what the intents read). The rent question is here too: it is typed-only for adults (the chips never offer it).
 */
export const HOME_PHRASES: PhraseEntry[] = [
  // ---- aiko_viewing ----
  P('home_ask_size', '何畳|です|か？', ['how many tatami mats is it', 'how many tatami is it', 'how many mats is it', 'how big is the room', 'how big is it', 'what size is the room', 'how large is it'], ['كم حصيرة تاتامي مساحتها', 'كم حصيرة مساحتها', 'ما مساحة الغرفة', 'كم مساحة الغرفة', 'كم مساحتها', 'ما حجم الغرفة']),
  P('home_ask_sun', '日当たり|は|いい|です|か？', ['does it get good sunlight', 'is it sunny', 'is the room sunny', 'is there good sunlight', 'does it get sun', 'is it bright'], ['هل الشمس جيدة هنا', 'هل الغرفة مشمسة', 'هل تدخلها الشمس', 'هل هي مشمسة', 'هل الغرفة مشرقة']),
  P('home_ask_quiet', '静か|です|か？', ['is it quiet', 'is the room quiet', 'is it a quiet place', 'is it noisy'], ['هل المكان هادئ', 'هل الغرفة هادئة', 'هل هو هادئ', 'هل هي هادئة']),
  P('home_ask_since', 'いつ|から|あります|か？', ['since when has it been here', 'since when is it here', 'how old is it', 'how long has it been here', 'when was it built', 'how old is the building'], ['منذ متى وهي موجودة', 'منذ متى هي هنا', 'كم عمرها', 'كم عمر المبنى', 'متى بنيت']),
  P('home_ask_rent', '家賃|は|いくら|です|か？', ['how much is the rent', 'what is the rent', 'how much is the rent per month', 'what does it cost to rent', 'how much does it cost per month'], ['كم الإيجار', 'ما هو الإيجار', 'كم الايجار', 'كم الإيجار الشهري', 'بكم الإيجار']),
  P('home_slippers_thanks', 'スリッパ、|ありがとう|ございます。', ['thank you for the slippers', 'thanks for the slippers', 'thank you for the house slippers'], ['شكرا على الخف', 'شكرا على خف البيت', 'شكرا على الشبشب']),
  P('home_thanks_showing', '見せて|くれて、|ありがとう|ございました。', ['thank you for showing me', 'thanks for showing me', 'thank you for showing me the room', 'thank you for showing me around'], ['شكرا لانك اريتني اياها', 'شكرا لانك اريتني الغرفة', 'شكرا على اريتني', 'شكرا لانك عرضتها علي']),

  // ---- aiko_contract ----
  P('home_take_it', 'ここ|に|します。', ['i will take this one', 'i will take this room', 'i will take the room', 'i decided', 'i have decided on this room'], ['سآخذ هذه', 'سآخذها', 'سآخذ هذه الغرفة', 'قررت', 'اخترت هذه الغرفة', 'هذه الغرفة']),
  P('home_take_it_please', 'ここ|で|お願いします。', ['this room please', 'this one is fine', 'this one is good'], ['هذه الغرفة من فضلك', 'هذه مناسبة']),
  P('home_total_60000', '六|万|円|です。', ['it is sixty thousand yen in total', 'sixty thousand yen', 'the total is sixty thousand yen', 'it is sixty thousand yen', 'sixty thousand', '60000 yen', '60,000 yen', 'it is 60000 yen', 'the total is 60000 yen', 'it is 60,000 yen'], ['المجموع ستون الف ين', 'ستون الف ين', 'ستون الف', 'المجموع ستون الفا', '60000 ين', 'انه ستون الف ين']),

  // ---- home_own_guest ----
  P('home_welcome_in', 'いらっしゃい。|どうぞ、|上がって|ください。', ['welcome please come in', 'welcome please come up', 'welcome come in please', 'please come in and welcome'], ['اهلا بك تفضل بالدخول', 'اهلا تفضل بالصعود', 'مرحبا بك تفضل بالدخول']),
  P('home_come_in', 'どうぞ、|入って|ください。', ['please come in', 'come in please', 'please come inside', 'come in'], ['تفضل بالدخول', 'ادخل من فضلك', 'تفضل ادخل']),
  P('home_hello_welcome', 'こんにちは。|いらっしゃい。', ['hello welcome', 'hi welcome', 'hello and welcome'], ['مرحبا اهلا بك', 'اهلا بك مرحبا']),
  P('home_slippers_yes', 'はい。|スリッパ|を|どうぞ。', ['yes here are slippers', 'yes here are some slippers', 'yes please take the slippers', 'here are slippers', 'here are the slippers'], ['نعم تفضل هذا الخف', 'نعم تفضل الخف', 'تفضل الخف']),
  P('home_shoes_here', 'はい、|ここ|で|脱いで|ください。|スリッパ|も|どうぞ。', ['yes please take them off here and here are slippers', 'yes take them off here here are slippers too', 'please take your shoes off here and here are slippers'], ['نعم اخلعه هنا وهذا الخف', 'نعم اخلع حذاءك هنا وهذا الخف ايضا']),
  P('home_not_much', 'ありがとう。|まだ|何|も|ない|です|けど。', ['thank you i do not have much yet though', 'thanks i do not have much yet', 'thank you there is not much here yet'], ['شكرا ليس عندي الكثير بعد', 'شكرا لكن لا يوجد الكثير بعد']),
  P('home_not_at_all', 'いえいえ。', ['not at all', 'oh no not at all', 'you are too kind'], ['لا شكر على واجب', 'ابدا', 'هذا لطف منك']),
  P('home_tea_please', 'お茶|を|どうぞ。', ['please have some tea', 'here is some tea', 'have some tea', 'tea please', 'please have tea'], ['تفضل بعض الشاي', 'تفضل الشاي', 'خذ بعض الشاي']),
  P('home_tea_would', 'はい、|どうぞ。|お茶|は|いかが|です|か？', ['yes please would you like some tea', 'yes please do you want some tea', 'sure would you like tea', 'yes please would you like tea'], ['نعم تفضل هل تريد بعض الشاي', 'نعم تفضل هل تريد شايا', 'بالتاكيد هل تريد شايا']),
  P('home_sit_tea', 'どうぞ、|座って|ください。|お茶|です。', ['please sit down here is tea', 'sit down please here is tea', 'please sit here is tea'], ['تفضل بالجلوس هذا هو الشاي', 'اجلس من فضلك هذا شاي']),
  P('home_glad', 'よかった|です。', ['good', 'i am happy to hear that', 'that is good to hear'], ['سعيد بذلك']),
  P('home_come_again', 'また|来て|ください|ね。', ['please come again', 'come again please', 'please visit again', 'come again sometime'], ['تعال مجددا من فضلك', 'تعال مرة اخرى', 'زرني مجددا']),
  P('home_thank_you_too', 'こちら|こそ。|また|来て|ください|ね。', ['thank you too please come again', 'thank you too come again', 'the pleasure is mine please come again'], ['شكرا لك ايضا تعال مجددا', 'الشكر لك تعال مرة اخرى']),
  P('home_take_care', '気を付けて。', ['take care', 'be careful', 'take care on your way', 'safe trip'], ['اعتن بنفسك', 'انتبه', 'رافقتك السلامة']),
  P('home_thanks_today', '今日|は|ありがとう|ございました。', ['thank you very much for today', 'thanks for today', 'thanks for coming today'], ['شكرا جزيلا على اليوم', 'شكرا لقدومك اليوم']),

  // ---- fuku_home ----
  P('home_looking_furniture', '家具|を|探しています。', ['i am looking for furniture', 'i want some furniture', 'i would like some furniture', 'i need furniture', 'furniture please'], ['ابحث عن اثاث', 'اريد بعض الاثاث', 'احتاج اثاثا', 'اثاث من فضلك']),
  P('home_buy_furniture', '{furniture}|を|ください。', ['{furniture} please', 'i would like {furniture}', 'i will take {furniture}', 'i want {furniture}', 'give me {furniture}', '{furniture}'], ['{furniture} من فضلك', 'اريد {furniture}', 'سآخذ {furniture}', '{furniture}'], { slot: 'furniture', closedSlot: true }),
  P('home_a_little_dear', '少し|高い|です。', ['it is slightly expensive', 'that is a little pricey'], ['غال بعض الشيء', 'السعر مرتفع قليلا']),
  P('home_delivery_please', '配送|で|お願いします。', ['delivery please', 'deliver it please', 'i would like delivery', 'please deliver it', 'have it delivered please', 'by delivery please'], ['التوصيل من فضلك', 'وصلها من فضلك', 'اريد التوصيل', 'اطلب التوصيل']),
  P('home_carry_please', '持ち帰り|で|お願いします。', ['i will carry it please', 'i will carry it home', 'i will take it with me', 'take away please', 'i will carry it myself'], ['سأحملها من فضلك', 'سأحملها بنفسي', 'سآخذها معي', 'سأحملها الى البيت']),
  P('home_tomorrow', '明日|が|いい|です。', ['tomorrow please', 'tomorrow is good', 'tomorrow is fine', 'i would like tomorrow', 'tomorrow'], ['غدا من فضلك', 'غدا مناسب', 'اريد غدا', 'غدا']),
  P('home_day_after', 'あさって|で|お願いします。', ['the day after tomorrow please', 'the day after tomorrow is fine', 'the day after tomorrow', 'in two days please'], ['بعد غد من فضلك', 'بعد غد مناسب', 'بعد غد', 'بعد يومين من فضلك']),
  P('home_saturday', '土曜日|に|お願いします。', ['saturday please', 'on saturday please', 'saturday is fine', 'saturday', 'on saturday'], ['السبت من فضلك', 'يوم السبت من فضلك', 'يوم السبت مناسب', 'السبت']),
  P('home_when_arrive', 'いつ|届きます|か？', ['when will it arrive', 'when does it arrive', 'when will it be delivered', 'when can you deliver it', 'when can it arrive'], ['متى ستصل', 'متى تصل', 'متى سيتم التوصيل', 'متى يمكنكم التوصيل']),
];
