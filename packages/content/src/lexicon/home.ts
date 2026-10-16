import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for the player's own room (Release 2 wave B2: aiko_viewing, aiko_contract, home_own_guest, fuku_home). Keep surfaces unique across the
// whole lexicon (the content tests report clashes). Already elsewhere: 畳 玄関 隣 スリッパ 靴 脱ぐ 机 本棚 こたつ 炊飯器 窓 広い (social-friends), 部屋
// 名前 明日 (quests / social), 敷金 (culture), テレビ (shop-denki), 持ち帰り (shop), 土曜日 (quests), うち (core), お茶 どうぞ (core).
// Counters are entries of their own because the counter picks the reading (六畳 ろくじょう, 二十年前 にじゅうねんまえ), as 一曲 and 十八歳 do.

export const HOME_LEXICON: LexEntry[] = [
  // ---- the room and its rent (aiko_viewing, aiko_contract) ----
  w('茶室', 'ちゃしつ', 'tea room', 'غرفة الشاي'),
  w('小野荘', 'おのそう', 'Ono-sō (the apartment building)', 'أونو-سو (العمارة السكنية)'),
  w('空いている', 'あいている', 'vacant, free', 'شاغر، متاح'),
  w('何畳', 'なんじょう', 'how many tatami mats', 'كم حصيرة تاتامي'),
  w('六畳', 'ろくじょう', 'six tatami mats (a 6-jō room)', 'ست حصائر تاتامي'),
  w('日当たり', 'ひあたり', 'sunlight (how sunny a room is)', 'ضوء الشمس (مدى إشراق الغرفة)'),
  w('静か', 'しずか', 'quiet', 'هادئ'),
  w('広さ', 'ひろさ', 'size, spaciousness', 'المساحة'),
  w('一人', 'ひとり', 'one person, alone', 'شخص واحد'),
  w('朝', 'あさ', 'morning', 'الصباح'),
  w('明るい', 'あかるい', 'bright', 'مشرق'),
  w('いつ', '', 'when', 'متى'),
  w('いつから', '', 'since when', 'منذ متى'),
  w('二十年前', 'にじゅうねんまえ', 'twenty years ago', 'قبل عشرين سنة'),
  w('四十年前', 'よんじゅうねんまえ', 'forty years ago', 'قبل أربعين سنة'),
  w('家賃', 'やちん', 'rent', 'الإيجار'),
  w('前家賃', 'まえやちん', 'rent paid in advance', 'الإيجار المقدّم'),
  w('契約', 'けいやく', 'contract (agreement)', 'عقد (اتفاق)'),
  w('契約書', 'けいやくしょ', 'contract (the paper)', 'عقد (الورقة)'),
  w('署名', 'しょめい', 'signature', 'التوقيع'),
  w('鍵', 'かぎ', 'key', 'مفتاح'),
  w('家', 'いえ', 'house, home', 'بيت'),
  w('電気', 'でんき', 'electric light, electricity', 'الكهرباء، ضوء كهربائي'),
  w('お部屋', 'おへや', 'room (polite)', 'الغرفة (بأدب)'),
  w('今', 'いま', 'now', 'الآن'),
  w('お貸し', 'おかし', 'lending, renting out (polite)', 'إعارة، تأجير (بأدب)'),
  w('確かに', 'たしかに', 'certainly, for sure', 'بالتأكيد'),
  w('いただきました', '', 'received (humble)', 'استلمتُ (بتواضع)'),
  w('できたら', '', 'once you have it, if you can', 'عندما يتوفّر، إن استطعت'),
  w('見せて', 'みせて', 'show (te-form)', 'أَرِ (صيغة الأمر)'),
  w('くれて', '', 'doing it for me (te-form of kureru)', 'لأجلي (صيغة كوريرو)'),
  w('聞いて', 'きいて', 'ask, listen (te-form)', 'اسأل، استمع (صيغة الأمر)'),
  w('何でも', 'なんでも', 'anything', 'أي شيء'),
  w('座れます', 'すわれます', 'can sit', 'يمكنه الجلوس'),
  w('飲みに', 'のみに', 'to drink (purpose)', 'لكي يشرب'),
  w('気に入ったら', 'きにいったら', 'if you like it', 'إن أعجبتك'),
  w('声', 'こえ', 'voice (声をかける: to speak to someone)', 'صوت (声をかける: أن تكلّم أحدًا)'),
  w('考えて', 'かんがえて', 'think (te-form)', 'فكّر (صيغة الأمر)'),
  g('でしょう', 'is it not? / probably', 'أليس كذلك؟ / على الأرجح'),

  // ---- the housewarming (home_own_guest) ----
  w('やあ', '', 'hi (casual greeting)', 'مرحبًا (غير رسمي)'),
  w('入って', 'はいって', 'come in (te-form)', 'ادخل (صيغة الأمر)'),
  w('広くて', 'ひろくて', 'spacious and...', 'واسعة و...'),
  w('いえいえ', '', 'not at all', 'لا شكر على واجب'),
  w('そろそろ', '', 'soon, about time to', 'قريبًا، حان الوقت'),
  w('気を付けて', 'きをつけて', 'take care', 'اعتنِ بنفسك'),

  // ---- second-hand furniture (fuku_home) ----
  w('家具', 'かぐ', 'furniture', 'أثاث'),
  w('布団', 'ふとん', 'futon (bedding set)', 'فوتون (طقم فراش ياباني)'),
  w('勉強机', 'べんきょうづくえ', 'study desk', 'مكتب للدراسة'),
  w('観葉植物', 'かんようしょくぶつ', 'houseplant', 'نبتة زينة'),
  w('和風ランプ', 'わふうランプ', 'Japanese-style paper lamp', 'مصباح ورقي ياباني'),
  w('配送', 'はいそう', 'delivery (to your home)', 'التوصيل (إلى البيت)'),
  w('お届け', 'おとどけ', 'delivery (polite)', 'توصيل (بأدب)'),
  w('予定', 'よてい', 'plan, schedule', 'خطة، موعد مقرر'),
  w('届きます', 'とどきます', 'arrives', 'يصل'),
  w('あさって', '', 'the day after tomorrow', 'بعد غد'),
  w('お持ち帰り', 'おもちかえり', 'taking it with you (polite)', 'أخذه معك (بأدب)'),
  w('なります', '', 'becomes, will be', 'يصبح، سيكون'),
  g('でも', 'even; but', 'حتى؛ لكن'),
  g('ので', 'so, because', 'لذلك، لأن'),
];
