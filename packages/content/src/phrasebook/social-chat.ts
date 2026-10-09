import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases for phone chat. English is written without contractions; ids must be unique across modules. */
export const SOCIAL_CHAT_PHRASES: PhraseEntry[] = [
  // chat_first
  P('chat_bought_yes', 'はい、|買いました！', ['yes i bought one', 'yes i bought it', 'i bought one', 'i bought a phone', 'yes i did', 'i got a new phone'], ['نعم اشتريت واحدا', 'نعم اشتريته', 'اشتريت هاتفا', 'اشتريت واحدا']),
  P('chat_black_phone', '黒い|スマホ|です。', ['it is a black phone', 'a black phone', 'it is black', 'my phone is black'], ['انه هاتف اسود', 'هاتف اسود', 'هو اسود', 'هاتفي اسود']),
  P('chat_yes_black_phone', 'はい。|黒い|スマホ|です。', ['yes it is a black phone', 'yes it is black', 'yes a black one'], ['نعم انه هاتف اسود', 'نعم هو اسود']),
  P('chat_white_phone', '白い|スマホ|です。', ['it is a white phone', 'a white phone', 'it is white', 'my phone is white'], ['انه هاتف ابيض', 'هاتف ابيض', 'هو ابيض', 'هاتفي ابيض']),
  P('chat_blue_phone', '青い|スマホ|です。', ['it is a blue phone', 'a blue phone', 'it is blue', 'my phone is blue'], ['انه هاتف ازرق', 'هاتف ازرق', 'هو ازرق', 'هاتفي ازرق']),
  P('chat_same_to_you', 'こちらこそ！', ['same to you', 'the pleasure is mine', 'likewise', 'me too'], ['وانا ايضا', 'وانا كذلك', 'الشرف لي']),

  // chat_greet
  P('chat_go_school', '学校|に|行きます。', ['i will go to school', 'i am going to school', 'i go to school', 'i am going to class', 'going to school'], ['سأذهب الى المدرسة', 'ساذهب الى المدرسة', 'اذهب الى المدرسة', 'سأذهب للمدرسة']),
  P('chat_shopping', '買い物|を|します。', ['i will go shopping', 'i am going shopping', 'i will do some shopping', 'shopping'], ['سأتسوق', 'ساتسوق', 'سأذهب للتسوق', 'سأقوم بالتسوق']),
  P('chat_go_park', '公園|に|行きます。', ['i will go to the park', 'i am going to the park', 'going to the park'], ['سأذهب الى الحديقة', 'ساذهب الى الحديقة', 'سأذهب للحديقة']),
  P('chat_rest_home', 'うち|で|休みます。', ['i will rest at home', 'i am going to rest at home', 'i will stay home and rest', 'i will relax at home'], ['سأرتاح في البيت', 'سارتاح في البيت', 'سأرتاح في المنزل', 'سأبقى في البيت']),

  // chat_plan
  P('chat_sorry_today', 'すみません、|今日|は|ちょっと|難しい|です。', ['sorry today is a bit difficult', 'sorry today is a little difficult', 'sorry i cannot today', 'sorry not today', 'sorry today is not good', 'i am sorry i cannot today'], ['اسف اليوم صعب قليلا', 'آسف اليوم صعب قليلا', 'اسف لا استطيع اليوم', 'آسف لا أستطيع اليوم', 'آسفة اليوم صعب قليلا']),
  P('chat_what_time', '何時|です|か？', ['what time', 'what time is it', 'at what time', 'when', 'what time shall we meet'], ['في اي ساعة', 'في أي ساعة', 'اي ساعة', 'متى']),
  P('chat_three_yes', 'はい、|三時|です|ね。', ['yes three o clock', 'yes at three', 'yes three oclock', 'three o clock is fine', 'yes three'], ['نعم الساعة الثالثة', 'نعم في الثالثة', 'الساعة الثالثة جيد']),
  P('chat_come_three', '三時|に|行きます。', ['i will come at three', 'i will be there at three', 'i will go at three', 'i am coming at three'], ['سآتي في الثالثة', 'ساتي في الثالثة', 'سأكون هناك في الثالثة']),
  P('chat_another_time', 'また|今度|ね。', ['another time', 'next time', 'maybe another time', 'let us do it another time'], ['في مرة اخرى', 'في مرة أخرى', 'المرة القادمة', 'مرة اخرى']),

  // chat_food
  P('chat_ate_food', '{chatfood}|を|食べました。', ['i ate {chatfood}', 'i ate a {chatfood}', 'i ate an {chatfood}', 'i had a {chatfood}', 'i had an {chatfood}', 'i had {chatfood}', 'i ate some {chatfood}', 'i just ate {chatfood}', 'i eat {chatfood}', 'for lunch i had {chatfood}'], ['اكلت {chatfood}', 'أكلت {chatfood}', 'تناولت {chatfood}', 'اكلت بعض {chatfood}'], { slot: 'chatfood', closedSlot: true }),
  P('chat_food_only', '{chatfood}|を|食べました。', ['{chatfood}'], ['{chatfood}'], { slot: 'chatfood', closedSlot: true }),
  P('chat_tasty_yes', 'はい、|おいしかった|です。', ['yes it was good', 'yes it was delicious', 'yes it was tasty', 'it was good', 'it was delicious'], ['نعم كان لذيذا', 'كان لذيذا', 'نعم كان جيدا']),
  P('chat_tasty_very', 'とても|おいしかった|です！', ['it was very good', 'it was very delicious', 'it was really good', 'it was really delicious', 'very delicious'], ['كان لذيذا جدا', 'كان لذيذا للغاية']),

  // chat_miss
  P('chat_fine_and_you', '元気|です。|あなた|は？', ['i am fine and you', 'i am fine how about you', 'i am good and you', 'i am well and you'], ['انا بخير وانت', 'أنا بخير وأنت', 'بخير وانت']),
  P('chat_tired', 'ちょっと|疲れて|います。', ['i am a little tired', 'i am a bit tired', 'i am tired', 'i am slightly tired'], ['انا متعب قليلا', 'أنا متعب قليلا', 'انا متعبة قليلا', 'أنا متعبة قليلا', 'انا متعب']),
];
