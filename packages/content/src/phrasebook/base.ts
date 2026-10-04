import type { PhraseEntry } from '../types';
import { P } from './helpers';

// The sample's stand-in for the on-device translation model: a hand-written phrasebook that maps
// English and Arabic sentences onto natural Japanese. Anything outside it is reported as "not covered".
// English is written in expanded form (no contractions); the matcher normalises input the same way.

export const BASE_PHRASES: PhraseEntry[] = [
  // ---- everyday ----
  P('greet', 'こんにちは。', ['hello', 'hi', 'hey', 'good afternoon', 'hello there'], ['مرحبا', 'اهلا', 'أهلا', 'السلام عليكم', 'مرحبا بك', 'اهلا وسهلا', 'هلا', 'سلام']),
  P('morning', 'おはようございます。', ['good morning', 'morning'], ['صباح الخير', 'صباح النور']),
  P('evening', 'こんばんは。', ['good evening'], ['مساء الخير', 'مساء النور']),
  P('thanks', 'ありがとうございます。', ['thank you', 'thanks', 'thank you very much', 'thanks a lot', 'many thanks'], ['شكرا', 'شكرا لك', 'شكرا جزيلا', 'شكرا لكم']),
  P('excuse', 'すみません。', ['excuse me', 'sorry', 'pardon me', 'i am sorry', 'my apologies'], ['المعذرة', 'عفوا', 'آسف', 'عذرا', 'لو سمحت', 'اسف', 'انا اسف']),
  P('please', 'お願いします。', ['please'], ['من فضلك']),
  P('yes', 'はい。', ['yes', 'yeah', 'yep', 'okay', 'ok', 'sure', 'alright', 'all right'], ['نعم', 'ايوه', 'اجل', 'حسنا', 'تمام', 'طبعا', 'اي نعم']),
  P('no', 'いいえ。', ['no', 'nope', 'not really'], ['لا', 'كلا']),
  P('no_thanks', 'いいえ、|大丈夫|です。', ['no thanks', 'no thank you', 'that is all', 'that is all thanks', 'nothing else', 'no that is all', 'no i am good', 'no i am fine', 'no thanks that is all'], ['لا شكرا', 'لا شكرا لك', 'هذا كل شيء', 'كفى', 'لا شيء اخر', 'لا اريد شيئا اخر', 'لا شكرا هذا كل شيء']),
  P('dont_understand', 'わかりません。', ['i do not understand', 'i do not get it', 'i do not know', 'i do not understand you', 'i am confused'], ['لا افهم', 'لم افهم', 'ما فهمت', 'لا افهمك', 'انا لا افهم', 'مش فاهم']),
  P('understood', 'わかりました。', ['i understand', 'i see', 'got it', 'understood', 'i got it', 'okay i understand', 'i see thank you'], ['فهمت', 'حسنا فهمت', 'لقد فهمت', 'فهمت شكرا', 'مفهوم']),
  P('repeat', 'もう一度|お願いします。', ['say that again', 'can you repeat that', 'repeat', 'one more time', 'come again', 'repeat that', 'once more', 'say it again', 'pardon'], ['اعد من فضلك', 'هل يمكنك ان تعيد', 'كرر من فضلك', 'مرة اخرى من فضلك', 'اعد ما قلت', 'كرر', 'هل يمكنك التكرار']),
  P('slower', 'ゆっくり|お願いします。', ['slower', 'speak slowly', 'speak more slowly', 'more slowly', 'can you speak more slowly', 'slowly', 'speak slower', 'talk slower'], ['ببطء', 'تكلم ببطء', 'هل يمكنك التحدث ببطء', 'ابطأ قليلا', 'تكلم ببطء من فضلك', 'ببطء اكثر']),
  P('goodbye', 'さようなら。', ['goodbye', 'bye', 'see you', 'see you later', 'bye bye', 'farewell'], ['مع السلامة', 'الى اللقاء', 'وداعا']),
  P('nice', 'いい|です|ね！', ['nice', 'that is nice', 'sounds good', 'great', 'cool', 'that is great', 'awesome', 'wonderful', 'that sounds nice', 'that sounds great'], ['جميل', 'رائع', 'هذا رائع', 'جيد', 'هذا جميل', 'ممتاز', 'هذا جيد', 'يبدو جيدا']),

  // ---- meeting people ----
  P('my_name', 'わたし|は|{name}|です。', ['my name is {name}', 'i am {name}', 'call me {name}', 'this is {name}', 'name is {name}'], ['اسمي {name}', 'انا {name}', 'اسمي هو {name}'], { slot: 'name' }),
  P('nice_meet', 'はじめまして。', ['nice to meet you', 'pleased to meet you', 'how do you do', 'nice meeting you'], ['تشرفنا', 'تشرفت بمعرفتك', 'سعيد بلقائك', 'سعدت بلقائك', 'تشرفت']),
  P('whats_your_name', 'お名前|は？', ['what is your name', 'who are you', 'may i have your name', 'your name'], ['ما اسمك', 'ما هو اسمك', 'شو اسمك', 'اسمك ايه', 'ما اسمك انت']),
  P('how_are_you', 'お元気|です|か？', ['how are you', 'how are you doing', 'how is it going'], ['كيف حالك', 'كيف الحال', 'شلونك', 'كيفك', 'كيف حالكم']),
  P('im_fine', '元気|です。', ['i am fine', 'i am good', 'fine thanks', 'i am well', 'i am doing well', 'good thanks', 'fine'], ['انا بخير', 'بخير', 'انا بخير شكرا', 'الحمد لله', 'بخير شكرا']),
  P('and_you', 'あなた|は？', ['and you', 'how about you', 'what about you'], ['وانت', 'وانتي', 'ماذا عنك', 'وماذا عنك']),
  P('from', '{country}|から|来ました。', ['i am from {country}', 'i come from {country}', 'i came from {country}', 'from {country}', 'i am coming from {country}'], ['انا من {country}', 'انا قادم من {country}', 'انا قادمة من {country}', 'من {country}', 'انا اتيت من {country}'], { slot: 'country' }),
  P('country_only', '{country}|から|来ました。', ['{country}'], ['{country}'], { slot: 'country', closedSlot: true }),
  P('hobby_only', '{hobby}|が|好き|です。', ['{hobby}'], ['{hobby}'], { slot: 'hobby', closedSlot: true }),
  P('where_from', 'どこ|から|来ました|か？', ['where are you from', 'where do you come from', 'where are you coming from'], ['من اين انت', 'من اين انتي', 'من اين اتيت', 'من اي بلد انت', 'من اين انتم']),
  P('like', '{hobby}|が|好き|です。', ['i like {hobby}', 'i love {hobby}', 'i enjoy {hobby}', 'i am into {hobby}', 'my hobby is {hobby}', 'i really like {hobby}'], ['احب {hobby}', 'انا احب {hobby}', 'يعجبني {hobby}', 'هوايتي {hobby}', 'هوايتي هي {hobby}'], { slot: 'hobby', closedSlot: true }),
  P('whats_hobby', '趣味|は|何|です|か？', ['what is your hobby', 'what are your hobbies', 'what do you like to do', 'what do you do for fun'], ['ما هي هوايتك', 'ما هواياتك', 'ما هي هواياتك', 'ما هوايتك', 'ماذا تحب ان تفعل']),

  // ---- shopping & eating ----
  P('order_item', '{item}|を|ください。', ['i would like {item}', 'can i have {item}', 'i want {item}', 'give me {item}', 'could i get {item}', 'can i get {item}', 'i will have {item}', 'i will take {item}', '{item} please', 'one {item} please', 'i would like to order {item}', 'may i have {item}', '{item}'], ['{item}', 'اريد {item}', 'اود {item}', 'هل يمكنني الحصول على {item}', '{item} من فضلك', 'اعطني {item}', 'ممكن {item}', 'بدي {item}', 'عايز {item}', 'ابغى {item}', 'اريد ان اطلب {item}', 'سآخذ {item}'], { slot: 'item', closedSlot: true }),
  P('do_you_have', '{item}|は|あります|か？', ['do you have {item}', 'is there {item}', 'do you sell {item}', 'have you got {item}', 'do you have any {item}'], ['هل لديكم {item}', 'هل يوجد {item}', 'عندكم {item}', 'هل عندكم {item}', 'هل لديك {item}'], { slot: 'item', closedSlot: true }),
  P('where_is', '{thing}|は|どこ|です|か？', ['where is {thing}', 'where can i find {thing}', 'where is the {thing}'], ['اين {thing}', 'اين يقع {thing}', 'فين {thing}', 'اين اجد {thing}'], { slot: 'thing', closedSlot: true }),
  P('how_much', 'いくら|です|か？', ['how much is it', 'how much is this', 'how much', 'what is the price', 'how much does it cost', 'what is the cost'], ['بكم هذا', 'كم السعر', 'كم الثمن', 'بكم', 'كم يكلف', 'بكم هو', 'كم سعره']),
  P('what_this', 'これ|は|何|です|か？', ['what is this', 'what is that'], ['ما هذا', 'ما هذه', 'شو هذا', 'ايش هذا']),
  P('this_please', 'これ|を|ください。', ['this one please', 'i will take this', 'i will have this', 'this please', 'i will take it', 'i want this', 'i would like this', 'this one', 'i will buy this'], ['هذا من فضلك', 'سآخذ هذا', 'اريد هذا', 'سأشتري هذا', 'هذا']),
  P('hot', 'ホット|を|ください。', ['hot please', 'hot', 'i will have it hot', 'hot one please', 'i want it hot', 'hot one', 'make it hot', 'hot coffee please'], ['ساخن', 'ساخن من فضلك', 'ساخنة', 'اريده ساخنا']),
  P('iced', 'アイス|を|お願いします。', ['iced please', 'iced', 'cold', 'cold please', 'iced one please', 'with ice', 'i want it iced', 'iced one', 'iced coffee please', 'make it iced'], ['بارد', 'بارد من فضلك', 'مثلج', 'مع ثلج', 'اريده باردا']),
  P('wifi', 'Wi-Fi|の|パスワード|を|教えてください。', ['what is the wifi password', 'what is the wi fi password', 'can i have the wifi password', 'do you have wifi', 'wifi password please', 'wifi password', 'what is the password for the wifi', 'could you tell me the wifi password', 'what is your wifi password'], ['ما هي كلمة مرور الواي فاي', 'ما كلمة سر الواي فاي', 'ما هو باسورد الواي فاي', 'كلمة سر الواي فاي', 'باسورد الواي فاي', 'ما هي كلمة سر الواي فاي', 'هل يوجد واي فاي', 'ما هي كلمة المرور']),
  P('pay_card', 'カード|で|お願いします。', ['by card', 'card please', 'i will pay by card', 'i will pay with card', 'can i pay by card', 'credit card', 'card', 'with card', 'i will pay by credit card', 'card is fine'], ['بالبطاقة', 'بالبطاقة من فضلك', 'سادفع بالبطاقة', 'بالكارت', 'ببطاقة الائتمان', 'بطاقة']),
  P('pay_cash', '現金|で|お願いします。', ['cash', 'cash please', 'i will pay in cash', 'i will pay cash', 'by cash', 'i will pay with cash', 'in cash', 'cash is fine'], ['نقدا', 'نقدا من فضلك', 'سادفع نقدا', 'كاش', 'سأدفع نقدا', 'بالنقد']),
  P('bag_yes', 'はい、|お願いします。', ['yes please', 'yes i need a bag', 'yes a bag please', 'a bag please', 'bag please', 'yes please i need one', 'yes i would like a bag'], ['نعم من فضلك', 'نعم اريد كيسا', 'كيس من فضلك', 'نعم اريد كيس', 'اريد كيسا']),
  P('yes_here', 'はい、|どうぞ。', ['here you go', 'here', 'here you are', 'here is the money', 'take it', 'here you go sir'], ['تفضل', 'هذا لك', 'تفضل المال', 'خذ', 'تفضلي']),
  P('recommend', 'おすすめ|は|何|です|か？', ['what do you recommend', 'what is good here', 'what is your recommendation', 'any recommendations', 'what would you recommend', 'what is popular', 'what is the best here'], ['ماذا تنصح', 'ما الذي تنصح به', 'ماذا توصي', 'ماذا تنصحني', 'ما هو الاكثر طلبا', 'بماذا تنصحني', 'ما هي توصيتك', 'ماذا تقترح']),

  // ---- ramen shop ----
  P('ramen_flavor', '{flavor}|ラーメン|を|ください。', ['i would like {flavor} ramen', '{flavor} ramen please', 'one {flavor} ramen please', 'can i have {flavor} ramen', 'i will have {flavor} ramen', 'i want {flavor} ramen', 'i would like the {flavor} ramen', '{flavor} ramen'], ['اريد رامن {flavor}', 'رامن {flavor} من فضلك', 'رامن {flavor}'], { slot: 'flavor', closedSlot: true }),
  P('ramen', 'ラーメン|を|ください。', ['ramen please', 'i would like ramen', 'i want ramen', 'one ramen please', 'can i have ramen', 'i will have ramen', 'i would like some ramen', 'ramen'], ['رامن من فضلك', 'اريد رامن', 'اريد طبق رامن', 'رامن']),
  P('choose_flavor', '{flavor}|を|ください。', ['{flavor} please', 'i will have {flavor}', 'i would like {flavor}', '{flavor}', 'the {flavor} one please', '{flavor} one please'], ['{flavor} من فضلك', 'اريد {flavor}', '{flavor}'], { slot: 'flavor', closedSlot: true }),
  P('not_spicy', '辛くない|の|が|いい|です。', ['not spicy please', 'i do not like spicy food', 'not too spicy', 'no spice', 'not spicy', 'i prefer not spicy', 'i do not like spicy', 'without spice'], ['غير حار', 'بدون حار', 'لا اريده حارا', 'ليس حارا', 'لا احب الحار', 'لا اريد حارا', 'بدون فلفل']),
  P('spicy_ok', 'はい、|大丈夫|です。', ['yes spicy is fine', 'i like spicy food', 'spicy is fine', 'spicy is ok', 'spicy is okay', 'i can eat spicy food', 'yes spicy is okay', 'spicy is good', 'i love spicy food'], ['نعم الحار لا بأس', 'احب الحار', 'الحار جيد', 'لا بأس بالحار', 'نعم الحار جيد', 'نعم لا بأس']),
  P('itadakimasu', 'いただきます！', ['let us eat', 'bon appetit', 'itadakimasu', 'time to eat', 'here we go', 'let us dig in'], ['بسم الله', 'بالهناء والشفاء', 'لنأكل', 'هيا نأكل']),
  P('delicious', 'おいしい|です！', ['it is delicious', 'this is delicious', 'delicious', 'yummy', 'tasty', 'so good', 'it is tasty', 'this is good', 'this is really good', 'it is really good', 'it is very good', 'it tastes great'], ['لذيذ', 'هذا لذيذ', 'انه لذيذ', 'طعمه رائع', 'لذيذ جدا', 'هذا لذيذ جدا']),
  P('bill', 'お会計|を|お願いします。', ['the bill please', 'check please', 'can i have the check', 'can i have the bill', 'the check please', 'bill please', 'may i have the bill', 'i would like to pay', 'can i pay'], ['الحساب من فضلك', 'اريد الحساب', 'الفاتورة من فضلك', 'الحساب لو سمحت', 'الحساب', 'هل يمكنني الدفع', 'اريد ان ادفع', 'الفاتورة']),
  P('gochisosama', 'ごちそうさまでした。', ['thank you for the meal', 'that was a great meal', 'that was delicious thank you', 'thanks for the meal', 'i am done eating', 'i am full thank you'], ['شكرا على الوجبة', 'كانت وجبة رائعة', 'شكرا على الطعام', 'شكرا على الطعام اللذيذ', 'تسلم ايديك']),

  // ---- station ----
  P('want_go', '{place}|へ|行きたい|です。', ['i want to go to {place}', 'i would like to go to {place}', 'how do i get to {place}', 'i need to go to {place}', 'to {place} please', 'how can i get to {place}', 'i am going to {place}', 'i would like to get to {place}', 'i want to get to {place}', 'i want to go {place}', '{place}'], ['{place}', 'اريد الذهاب الى {place}', 'اريد ان اذهب الى {place}', 'كيف اصل الى {place}', 'كيف اذهب الى {place}', 'اريد الوصول الى {place}'], { slot: 'place', closedSlot: true }),
  P('ticket_where', '切符|は|どこ|で|買います|か？', ['where can i buy a ticket', 'where do i buy tickets', 'where to buy a ticket', 'where can i buy tickets', 'where do i buy a ticket', 'where is the ticket machine'], ['اين اشتري تذكرة', 'اين يمكنني شراء تذكرة', 'اين اشتري التذاكر', 'اين يمكنني شراء التذاكر', 'من اين اشتري تذكرة']),
  P('which_platform', '何番線|です|か？', ['which platform', 'what platform is it', 'which platform is it', 'what platform', 'which platform do i take'], ['اي رصيف', 'ما رقم الرصيف', 'اي منصة', 'اي رصيف هو']),
  P('how_long', '何分|かかります|か？', ['how long does it take', 'how long is it', 'how many minutes', 'how long will it take', 'how long is the trip', 'how long is the ride', 'how many minutes does it take'], ['كم يستغرق', 'كم من الوقت يستغرق', 'كم تستغرق الرحلة', 'كم دقيقة', 'كم يستغرق ذلك', 'كم الوقت']),
];
