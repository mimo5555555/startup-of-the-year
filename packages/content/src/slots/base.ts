import type { SlotOption } from '../types';
import { opt } from './helpers';

export const ITEMS: SlotOption[] = [
  opt('coffee', 'コーヒー', ['kohi', 'koohii', 'koh-hi'], ['coffee'], ['قهوة', 'القهوة', 'كوب قهوة', 'قهوه']),
  opt('blackTea', '紅茶', ['こうちゃ', 'koucha', 'kocha'], ['black tea', 'tea'], ['شاي', 'شاي أسود', 'الشاي']),
  opt('greenTea', 'お茶', ['おちゃ', 'ocha'], ['green tea', 'japanese tea'], ['شاي أخضر', 'الشاي الأخضر']),
  opt('latte', 'カフェラテ', ['ラテ', 'かふぇらて', 'latte'], ['latte', 'cafe latte', 'café latte'], ['لاتيه', 'كافيه لاتيه', 'لاتي']),
  opt('juice', 'ジュース', ['jusu'], ['juice', 'orange juice'], ['عصير', 'العصير']),
  opt('water', '水', ['みず', 'mizu'], ['water'], ['ماء', 'الماء', 'مياه', 'ميه', 'مويه']),
  opt('milk', '牛乳', ['ぎゅうにゅう', 'ミルク', 'gyunyu', 'gyuunyuu'], ['milk'], ['حليب', 'الحليب', 'لبن']),
  opt('onigiri', 'おにぎり', ['onigiri'], ['onigiri', 'rice ball', 'rice balls'], ['أونيغيري', 'اونيغيري', 'أونيجيري', 'كرة أرز', 'كرات أرز']),
  opt('sandwich', 'サンドイッチ', ['sandoicchi'], ['sandwich'], ['ساندويتش', 'ساندوتش', 'سندويتش', 'سندوتش']),
  opt('bento', 'お弁当', ['べんとう', 'bento'], ['bento', 'lunch box', 'lunchbox', 'boxed lunch'], ['بنتو', 'بينتو', 'وجبة غداء']),
  opt('cake', 'ケーキ', ['keki'], ['cake'], ['كعكة', 'كيك', 'كيكة', 'الكيك']),
];

export const PLACES: SlotOption[] = [
  opt('toilet', 'トイレ', ['といれ', 'toire', 'おてあらい'], ['toilet', 'restroom', 'bathroom', 'washroom'], ['الحمام', 'حمام', 'دورة المياه', 'المرحاض', 'تواليت']),
  opt('station', '駅', ['えき', 'eki'], ['station', 'train station'], ['المحطة', 'محطة', 'محطة القطار']),
  opt('shibuya', '渋谷', ['しぶや', 'shibuya'], ['shibuya'], ['شيبويا']),
  opt('shinjuku', '新宿', ['しんじゅく', 'shinjuku'], ['shinjuku'], ['شينجوكو', 'شنجوكو']),
  opt('asakusa', '浅草', ['あさくさ', 'asakusa'], ['asakusa'], ['أساكوسا', 'اساكوسا']),
  opt('akihabara', '秋葉原', ['あきはばら', 'akihabara'], ['akihabara'], ['أكيهابارا', 'اكيهابارا']),
  opt('ueno', '上野', ['うえの', 'ueno'], ['ueno'], ['أوينو', 'اوينو']),
  opt('tokyoStation', '東京駅', ['とうきょうえき', 'とうきょう', '東京', 'tokyo'], ['tokyo station', 'tokyo'], ['محطة طوكيو', 'طوكيو']),
  // relabelled Haneda Airport (§5.4); 「空港」 still matches
  opt('airport', '羽田空港', ['空港', 'くうこう', 'はねだ', 'kuukou', 'kuko', 'haneda'], ['haneda airport', 'haneda', 'airport'], ['مطار هانيدا', 'هانيدا', 'المطار', 'مطار']),
  // the fictional trip target (§5.4, D29)
  opt('hikarigaoka', '光が丘', ['ひかりがおか', 'hikarigaoka'], ['hikarigaoka'], ['هيكاريغاأوكا', 'هيكاريغاوكا']),
];

export const COUNTRIES: SlotOption[] = [
  ['アメリカ', ['america', 'amerika'], ['usa', 'united states', 'america', 'the us', 'us'], ['أمريكا', 'امريكا', 'الولايات المتحدة']],
  ['イギリス', ['igirisu'], ['uk', 'united kingdom', 'england', 'britain', 'great britain'], ['بريطانيا', 'انجلترا', 'إنجلترا', 'المملكة المتحدة']],
  ['カナダ', ['kanada'], ['canada'], ['كندا']],
  ['オーストラリア', ['osutorarua'], ['australia'], ['أستراليا', 'استراليا']],
  ['エジプト', ['ejiputo'], ['egypt'], ['مصر']],
  ['サウジアラビア', ['saujiarabia'], ['saudi arabia', 'saudi'], ['السعودية', 'المملكة العربية السعودية']],
  ['ヨルダン', ['yorudan'], ['jordan'], ['الأردن', 'الاردن']],
  ['レバノン', ['rebanon'], ['lebanon'], ['لبنان']],
  ['シリア', ['shiria'], ['syria'], ['سوريا', 'سورية']],
  ['パレスチナ', ['paresuchina'], ['palestine'], ['فلسطين']],
  ['イラク', ['iraku'], ['iraq'], ['العراق']],
  ['モロッコ', ['morokko'], ['morocco'], ['المغرب']],
  ['アルジェリア', ['arujeria'], ['algeria'], ['الجزائر']],
  ['チュニジア', ['chunijia'], ['tunisia'], ['تونس']],
  ['リビア', ['ribia'], ['libya'], ['ليبيا']],
  ['スーダン', ['sudan'], ['sudan'], ['السودان']],
  ['イエメン', ['iemen'], ['yemen'], ['اليمن']],
  ['クウェート', ['kuweto'], ['kuwait'], ['الكويت']],
  ['カタール', ['kataru'], ['qatar'], ['قطر']],
  ['オマーン', ['oman'], ['oman'], ['عمان', 'عُمان']],
  ['バーレーン', ['bareen'], ['bahrain'], ['البحرين']],
  ['アラブ首長国連邦', ['uae', 'arabushuchokokurenpo'], ['uae', 'united arab emirates', 'emirates', 'dubai', 'abu dhabi'], ['الإمارات', 'الامارات', 'دبي', 'أبو ظبي']],
  ['スペイン', ['supein'], ['spain'], ['إسبانيا', 'اسبانيا']],
  ['メキシコ', ['mekishiko'], ['mexico'], ['المكسيك']],
  ['ドイツ', ['doitsu'], ['germany'], ['ألمانيا', 'المانيا']],
  ['オランダ', ['oranda'], ['netherlands', 'the netherlands', 'holland'], ['هولندا']],
  ['ロシア', ['roshia'], ['russia'], ['روسيا']],
  ['フランス', ['furansu'], ['france'], ['فرنسا']],
  ['イタリア', ['itaria'], ['italy'], ['إيطاليا', 'ايطاليا']],
  ['ブラジル', ['burajiru'], ['brazil'], ['البرازيل']],
  ['インド', ['indo'], ['india'], ['الهند']],
  ['中国', ['ちゅうごく', 'chugoku'], ['china'], ['الصين']],
  ['韓国', ['かんこく', 'kankoku'], ['south korea', 'korea'], ['كوريا', 'كوريا الجنوبية']],
  ['トルコ', ['toruko'], ['turkey', 'turkiye'], ['تركيا']],
].map(([ja, jk, en, ar]) => opt(`c_${ja}`, ja as string, jk as string[], en as string[], ar as string[]));

export const HOBBIES: SlotOption[] = [
  opt('anime', 'アニメ', ['anime'], ['anime'], ['أنمي', 'الأنمي', 'انمي', 'الانمي']),
  opt('manga', '漫画', ['まんが', 'マンガ', 'manga'], ['manga', 'comics'], ['مانغا', 'مانجا', 'المانغا']),
  opt('music', '音楽', ['おんがく', 'ongaku'], ['music', 'listening to music'], ['موسيقى', 'الموسيقى', 'موسيقا']),
  opt('photo', '写真', ['しゃしん', 'shashin'], ['photography', 'photos', 'taking photos', 'photo', 'taking pictures'], ['التصوير', 'تصوير', 'الصور']),
  opt('games', 'ゲーム', ['geimu'], ['games', 'video games', 'gaming', 'game'], ['ألعاب', 'الألعاب', 'العاب', 'ألعاب الفيديو']),
  opt('sports', 'スポーツ', ['supotsu'], ['sports', 'sport'], ['الرياضة', 'رياضة']),
  opt('cooking', '料理', ['りょうり', 'ryori', 'ryouri'], ['cooking', 'food'], ['الطبخ', 'طبخ']),
  opt('movies', '映画', ['えいが', 'eiga'], ['movies', 'films', 'cinema', 'movie'], ['الأفلام', 'أفلام', 'افلام', 'السينما']),
  opt('travel', '旅行', ['りょこう', 'ryoko', 'ryokou'], ['travel', 'traveling', 'travelling'], ['السفر', 'سفر']),
  opt('books', '本', ['ほん', 'どくしょ', 'hon'], ['books', 'reading', 'book'], ['الكتب', 'كتب', 'القراءة']),
  opt('drawing', '絵', ['え', 'e'], ['drawing', 'painting', 'art'], ['الرسم', 'رسم']),
];

export const FLAVORS: SlotOption[] = [
  opt('shoyu', 'しょうゆ', ['醤油', 'shoyu', 'shouyu'], ['soy sauce', 'shoyu', 'soy'], ['صويا', 'صلصة الصويا']),
  opt('miso', 'みそ', ['味噌', 'miso'], ['miso'], ['ميسو', 'ميزو']),
  opt('tonkotsu', 'とんこつ', ['豚骨', 'tonkotsu'], ['tonkotsu', 'pork bone'], ['تونكوتسو']),
];

export const BASE_SLOTS: Record<string, SlotOption[]> = {
  item: ITEMS,
  place: PLACES,
  thing: [...ITEMS, ...PLACES],
  country: COUNTRIES,
  hobby: HOBBIES,
  flavor: FLAVORS,
};
