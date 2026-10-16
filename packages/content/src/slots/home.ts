import type { SlotOption } from '../types';
import { opt } from './helpers';

/** Slot lists for the player's own room (Release 2 wave B2): the viewing questions, the room, the furniture, how it gets home and on which day. */
export const HOME_SLOTS: Record<string, SlotOption[]> = {
  // the five questions of `aiko_viewing`; the option ids are the keys of `VIEW_QUESTIONS`
  viewQ: [
    opt('size', '何畳', ['なんじょう', 'なんじょうですか', 'ひろさ', '広さ', 'ひろい', '広い', 'ろくじょう', 'おおきさ'], ['how many tatami', 'how many mats', 'how big', 'the size', 'how big is it', 'size'], ['كم حصيرة', 'كم تاتامي', 'ما المساحة', 'كم مساحتها', 'المساحة']),
    opt('sun', '日当たり', ['ひあたり', 'ひあたりはいい', 'あかるい', '明るい', 'たいよう', 'ひがあたる'], ['sunlight', 'sunny', 'sun', 'is it sunny', 'bright'], ['ضوء الشمس', 'الشمس', 'مشمس', 'مشرقة', 'اشراق']),
    opt('quiet', '静か', ['しずか', 'しずかですか', 'うるさい', 'おと', '音'], ['quiet', 'is it quiet', 'noisy', 'noise', 'the noise'], ['هادئ', 'هادئة', 'الهدوء', 'ضوضاء', 'هل هو هادئ']),
    opt('since', 'いつから', ['いつからありますか', 'いつからある', 'ふるい', '古い', 'ねんまえ', 'なんねん', '何年'], ['since when', 'how old', 'how long', 'when was it built', 'how old is it'], ['منذ متى', 'كم عمرها', 'منذ متى وهي موجودة', 'متى بنيت']),
    opt('rent', '家賃', ['やちん', 'やちんはいくら', 'いくらですか', 'ねだん', 'おかね', 'いくら'], ['rent', 'the rent', 'how much is the rent', 'how much', 'price'], ['الإيجار', 'ايجار', 'الايجار', 'كم الإيجار', 'كم الايجار', 'كم السعر']),
  ],
  // the room Aiko rents out; `ここにします` is the learner's decision (the item map of `aiko_contract` sells it)
  room: [
    opt(
      'ono',
      'ここ',
      ['ここにします', 'ここにする', 'ここでおねがい', 'ここでいい', 'ここがいい', 'このへや', 'この部屋', 'この部屋にします', 'おのそう', '小野荘', 'きめました', '決めました', 'ここに住みます', 'ここにすみます'],
      ['this one', 'this room', 'i will take it', 'i will take this one', 'i will take the room', 'i decided', 'here'],
      ['هذه', 'هذه الغرفة', 'سآخذها', 'سآخذ هذه', 'قررت', 'هنا'],
    ),
  ],
  // the seven pieces of `fuku_home`; the option ids are the keys of its item map
  furniture: [
    opt('futon', '布団', ['ふとん', 'ふとんセット', '布団セット', 'ベッド', 'ねどこ'], ['futon', 'a futon', 'the futon', 'futon set', 'bedding', 'a bed'], ['فوتون', 'الفوتون', 'فراش', 'سرير', 'طقم فوتون']),
    opt('desk', '勉強机', ['べんきょうづくえ', 'つくえ', '机', 'デスク', 'べんきょうつくえ'], ['desk', 'a desk', 'the desk', 'study desk', 'a study desk'], ['مكتب', 'المكتب', 'مكتب للدراسة', 'مكتب دراسة']),
    opt('bookshelf', '本棚', ['ほんだな', 'たな', 'しょだな', '棚'], ['bookshelf', 'a bookshelf', 'the bookshelf', 'shelf', 'bookcase'], ['رف كتب', 'رف الكتب', 'مكتبة', 'الرف']),
    opt('plant', '観葉植物', ['かんようしょくぶつ', 'しょくぶつ', '植物', 'はちうえ', 'ポトス'], ['houseplant', 'a houseplant', 'the houseplant', 'plant', 'a plant', 'pothos'], ['نبتة زينة', 'نبتة', 'نبات', 'النبتة']),
    opt('kotatsu', 'こたつ', ['コタツ', 'こたつテーブル'], ['kotatsu', 'a kotatsu', 'the kotatsu', 'heated table'], ['كوتاتسو', 'الكوتاتسو', 'طاولة تدفئة']),
    opt('riceCooker', '炊飯器', ['すいはんき', 'ごはんをたく', 'ライスクッカー'], ['rice cooker', 'a rice cooker', 'the rice cooker', 'cooker'], ['جهاز طهي الأرز', 'طباخ الأرز', 'جهاز الأرز']),
    opt('lamp', '和風ランプ', ['わふうランプ', 'ランプ', 'らんぷ', 'ライト', 'あかり', 'でんき', '電気', '和風ライト'], ['lamp', 'a lamp', 'the lamp', 'paper lamp', 'lantern', 'a paper lamp', 'japanese lamp'], ['مصباح', 'مصباح ورقي', 'المصباح', 'فانوس']),
  ],
  // how a piece gets home: carried (持ち帰り) or delivered (配送)
  delivery: [
    opt('carry', '持ち帰り', ['もちかえり', 'もちかえる', 'もちかえります', '持ち帰ります', '持ち帰る', 'もってかえ', '持って帰', 'じぶんで'], ['carry', 'carry it', 'take it with me', 'take-away', 'i will carry it', 'take it home'], ['أحملها', 'سأحملها', 'آخذها معي', 'سآخذها معي', 'حمل']),
    opt('deliver', '配送', ['はいそう', 'はいそうで', 'はいたつ', '配達', 'おくって', '送って', 'とどけて', '届けて', 'とどけ'], ['delivery', 'deliver it', 'have it delivered', 'send it', 'deliver'], ['التوصيل', 'توصيل', 'وصّلها', 'أرسلها', 'توصيلها']),
  ],
  // the day a delivery arrives
  deliveryDay: [
    opt('tomorrow', '明日', ['あした', 'あす', 'あしたに', '明日に'], ['tomorrow', 'on tomorrow'], ['غدا', 'غدًا', 'غد', 'بكرة']),
    opt('dayAfter', 'あさって', ['明後日', 'みょうごにち', 'あさってに'], ['the day after tomorrow', 'day after tomorrow', 'in two days'], ['بعد غد', 'بعد غدٍ', 'بعد يومين']),
    opt('saturday', '土曜日', ['どようび', 'どよう', '土曜', 'どようびに'], ['saturday', 'on saturday'], ['السبت', 'يوم السبت']),
  ],
};
