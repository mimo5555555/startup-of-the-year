import type { CultureCard } from '@lw/game';

// Pack data: the 23 culture cards (docs/GAME_DESIGN.md §10; 4F). A card unlocks the first time its trigger happens (the reducer's culture
// stage); `culture_said` counts a `say:true` card once its key phrase was said. Key phrases are lexicon markup (`|` between tokens). A
// phrase with two parts ("A / B") is written with spaces around the slash; each part is one phrase on its own (reducer + stamp book).
// `{name}` in cc_name is the player's name, filled by the screen.

const c = (card: CultureCard): CultureCard => card;

export const CULTURE: CultureCard[] = [
  c({
    id: 'cc_irasshaimase',
    trigger: { on: 'shop_start' },
    phrase: { ja: 'いらっしゃいませ', en: 'Welcome (to our shop)', ar: 'أهلًا بك (في متجرنا)' },
    text: {
      en: "Staff greet every customer the moment they walk in, often in a loud, rhythmic voice. You don't have to answer with words; a small nod is perfect.",
      ar: 'يحيّي الموظفون كل زبون لحظة دخوله، وغالبًا بصوت عالٍ وإيقاعي. لا يلزمك الرد بالكلام، فإيماءة رأس صغيرة تكفي تمامًا.',
    },
  }),
  c({
    id: 'cc_bow',
    trigger: { on: 'talk_start', ids: ['hanako'] },
    phrase: { ja: 'よろしく|お願いします', en: 'Nice to meet you / please treat me well', ar: 'سُررت بلقائك / أرجو حسن التعامل' },
    text: {
      en: "A bow is a greeting, a thank-you and an apology in one. In daily life a small, quick nod is enough; deeper bows show more respect. Don't worry about the exact angle.",
      ar: 'الانحناء تحية وشكر واعتذار في آنٍ واحد. في الحياة اليومية تكفي إيماءة صغيرة سريعة، والانحناء الأعمق يدل على احترام أكبر. لا تقلق بشأن الزاوية بالضبط.',
    },
    say: true,
  }),
  c({
    id: 'cc_konbini',
    trigger: { on: 'scenario_done', ids: ['konbini'] },
    phrase: { ja: '温めます|か|？', en: 'Shall I heat it?', ar: 'هل أسخّنه؟' },
    text: {
      en: 'A konbini is open 24 hours and sells far more than snacks: hot meals, ATMs, bill payment, parcels and printing. Staff often ask if you want your food heated.',
      ar: 'الكونبيني مفتوح 24 ساعة ويبيع أكثر بكثير من الوجبات الخفيفة: وجبات ساخنة وصرّافات آلية ودفع فواتير وطرودًا وطباعة. كثيرًا ما يسألك الموظف إن كنت تريد تسخين طعامك.',
    },
  }),
  c({
    id: 'cc_notip',
    trigger: { on: 'payment', ids: ['cafe', 'ramen'] },
    phrase: { ja: 'ありがとうございました', en: 'Thank you very much (said by staff)', ar: 'شكرًا جزيلًا (يقولها الموظف)' },
    text: {
      en: 'There is no tipping in Japan. Good service is the normal standard, not something you pay extra for, and leaving money can even confuse staff. At the register, put your money on the small tray.',
      ar: 'لا توجد إكرامية في اليابان. الخدمة الجيدة هي المعيار المعتاد وليست شيئًا يُدفع عنه زيادة، وترك النقود قد يربك الموظفين. عند الصندوق ضع نقودك على الصينية الصغيرة.',
    },
  }),
  c({
    id: 'cc_itadakimasu',
    trigger: { on: 'served', ids: ['ramen'] },
    phrase: { ja: 'いただきます / ごちそうさまでした', en: 'I gratefully receive / Thank you for the meal', ar: 'أتقبّل بامتنان / شكرًا على الوجبة' },
    text: {
      en: 'Say いただきます before eating and ごちそうさまでした afterwards. Slurping noodles is normal: it cools them and shows you enjoy them.',
      ar: 'قل いただきます قبل الأكل وごちそうさまでした بعده. شفط النودلز بصوت مسموع أمر طبيعي؛ فهو يبرّدها ويدل على استمتاعك.',
    },
    say: true,
  }),
  c({
    id: 'cc_vending',
    trigger: { on: 'machine', ids: ['vending'] },
    phrase: { ja: 'あたたかい / つめたい', en: 'warm / cold', ar: 'دافئ / بارد' },
    text: {
      en: 'Millions of vending machines sell drinks, hot ones in winter. Hot cans have a red label, cold ones a blue label, and most cost about ¥130 to ¥170. Many accept IC cards.',
      ar: 'ملايين آلات البيع تبيع المشروبات، ومنها الساخنة في الشتاء. للعلب الساخنة ملصق أحمر وللباردة ملصق أزرق، ومعظمها يكلّف نحو 130 إلى 170 ينًا. كثير منها يقبل بطاقات IC.',
    },
  }),
  c({
    id: 'cc_name',
    trigger: { on: 'scenario_done', ids: ['park'] },
    phrase: { ja: '{name}|さん', en: 'Mr/Ms {name}', ar: 'السيد/السيدة {name}' },
    text: {
      en: "Add さん after other people's names, never your own. ちゃん is affectionate (friends, children), くん is for boys and juniors, and 先生 is for teachers.",
      ar: 'أضف さん بعد أسماء الآخرين وليس اسمك أبدًا. ちゃん للمودّة (الأصدقاء والأطفال)، وくん للأولاد والأصغر سنًا، و先生 للمعلّمين.',
    },
  }),
  c({
    id: 'cc_gift',
    trigger: { on: 'gift_given' },
    phrase: { ja: 'これ、|どうぞ', en: 'Here, please take it', ar: 'تفضّل، هذا لك' },
    text: {
      en: 'Give and receive gifts with both hands. Small gifts are best so nobody feels they owe you. おみやげ are souvenirs you bring back from trips for friends and colleagues.',
      ar: 'قدّم الهدايا واستلمها بكلتا اليدين. الهدايا الصغيرة أفضل كي لا يشعر أحد بأنه مدين لك. الأوميياغي هدايا تذكارية تحضرها من رحلاتك للأصدقاء وزملاء العمل.',
    },
    say: true,
  }),
  c({
    id: 'cc_hanami',
    trigger: { on: 'visit', ids: ['park'], ch: 4 },
    phrase: { ja: 'お花見', en: 'flower viewing', ar: 'مشاهدة الأزهار' },
    text: {
      en: 'Hanami means picnicking under the cherry blossoms, usually from late March to early April. The blossoms last only about a week, which is part of their charm.',
      ar: 'الهانامي هو التنزّه تحت أزهار الكرز، وعادةً من أواخر مارس إلى أوائل أبريل. تدوم الأزهار نحو أسبوع فقط، وهذا جزء من سحرها.',
    },
  }),
  c({
    id: 'cc_keigo',
    trigger: { on: 'casual_switch', ids: ['mio', 'rin'] },
    phrase: { ja: 'タメ口|で|いい|？', en: 'Is casual speech OK?', ar: 'هل يمكننا الكلام بصيغة عادية؟' },
    text: {
      en: 'Japanese has levels of politeness. です/ます is the safe polite style; friends use the plain form. Let a friend switch first, or ask 「タメ口でいい？」. With staff, elders and teachers, stay polite.',
      ar: 'للغة اليابانية مستويات من التهذيب. أسلوب です/ます هو الأسلوب المهذب الآمن، والأصدقاء يستخدمون الصيغة العادية. دع صديقك يبدأ بالتحول، أو اسأل «タメ口でいい؟». ابقَ مهذبًا مع الموظفين والكبار والمعلّمين.',
    },
    say: true,
  }),
  c({
    id: 'cc_points',
    trigger: { on: 'purchase', ids: ['konbini'], n: 3 },
    also: [{ on: 'perfect_shift', n: 3 }],
    phrase: { ja: 'ポイント|カード|は|お持ち|です|か|？', en: 'Do you have a point card?', ar: 'هل لديك بطاقة نقاط؟' },
    text: {
      en: 'Shops often ask if you have a point card. Receipts are normally handed over; if you need a formal one, ask for a 領収書 (ryōshūsho) with your name on it.',
      ar: 'تسأل المتاجر غالبًا إن كانت لديك بطاقة نقاط. يُسلَّم الإيصال عادةً؛ وإن احتجت إلى إيصال رسمي فاطلب 領収書 (ryōshūsho) باسمك.',
    },
  }),
  c({
    id: 'cc_tax',
    trigger: { on: 'payment', ids: ['denki'] },
    phrase: { ja: '税込', en: 'tax included', ar: 'شامل الضريبة' },
    text: {
      en: 'Prices are normally shown with tax included. Consumption tax is 10%, but take-away food and groceries are 8%; eating in is 10%.',
      ar: 'تُعرض الأسعار عادةً شاملة الضريبة. ضريبة الاستهلاك 10%، لكن الطعام الجاهز للأخذ والبقالة 8%، أما تناول الطعام في المكان فبنسبة 10%.',
    },
  }),
  c({
    id: 'cc_taxfree',
    trigger: { on: 'intent', ids: ['denki_phone:ask_taxfree'] },
    phrase: { ja: '免税|できます|か|？', en: 'Can I buy tax-free?', ar: 'هل يمكنني الشراء معفى من الضريبة؟' },
    text: {
      en: 'Visitors can shop tax-free with their passport above a minimum spend (the scheme is changing, so check before you travel). Residents like you pay the tax, and staff will politely say you are not eligible: 「免税の対象外です」.',
      ar: 'يمكن للزوار التسوق معفيين من الضريبة بجواز السفر فوق حدّ أدنى من الإنفاق (النظام يتغير فتحقّق قبل السفر). أما المقيمون مثلك فيدفعون الضريبة، وسيقول لك الموظف بلطف إنك غير مؤهل: «免税の対象外です».',
    },
  }),
  c({
    id: 'cc_ic',
    trigger: { on: 'scenario_done', ids: ['station_ic'] },
    phrase: { ja: 'チャージ|お願いします', en: 'Please top up my card', ar: 'اشحن البطاقة من فضلك' },
    text: {
      en: 'IC cards such as Suica and PASMO work on trains, buses, in konbini and at vending machines. Charge them with cash at a machine, then just tap. A paper ticket costs a few yen more than the IC fare.',
      ar: 'تعمل بطاقات IC مثل Suica وPASMO في القطارات والحافلات والكونبيني وآلات البيع. اشحنها بالنقود من الآلة ثم مرّرها فقط. وتكلّف التذكرة الورقية بضعة ينات أكثر من أجرة IC.',
    },
    say: true,
  }),
  c({
    id: 'cc_trainmanner',
    trigger: { on: 'ride' },
    phrase: { ja: 'すみません、|降ります', en: "Excuse me, I'm getting off", ar: 'عفوًا، سأنزل' },
    text: {
      en: 'Trains are quiet. Put your phone on silent (マナーモード), avoid phone calls, take your backpack off, and keep priority seats for those who need them.',
      ar: 'القطارات هادئة. اجعل هاتفك على الوضع الصامت (マナーモード)، وتجنّب المكالمات، وأنزل حقيبة ظهرك، واترك المقاعد المخصصة لمن يحتاجها.',
    },
    say: true,
  }),
  c({
    id: 'cc_ticketmachine',
    trigger: { on: 'machine', ids: ['ticket', 'ramen_machine'] },
    phrase: { ja: '券売機', en: 'ticket machine', ar: 'آلة التذاكر' },
    text: {
      en: 'Many ramen shops and stations use ticket machines: choose and pay first, then hand the ticket to the staff. Look for the button with a picture of the dish.',
      ar: 'تستخدم محلات رامن كثيرة والمحطات آلات التذاكر: اختر وادفع أولًا ثم سلّم التذكرة للموظف. ابحث عن الزر الذي عليه صورة الطبق.',
    },
  }),
  c({
    id: 'cc_refuse',
    trigger: { on: 'intent', ids: ['motors_visit:later', 'motors_bike:later', 'motors_car:later'] },
    phrase: { ja: 'ちょっと… / 考えます', en: "That's a bit… / I'll think about it", ar: 'هذا صعب قليلًا... / سأفكّر' },
    text: {
      en: 'A direct "no" can sound harsh. Polite ways to decline are 「ちょっと…」 and 「考えます」. Shops accept this happily, and prices are fixed: there is no haggling (定価).',
      ar: 'قد يبدو «لا» المباشرة قاسية. من طرق الرفض المهذبة «ちょっと…» و«考えます». المتاجر تتقبّل ذلك بصدر رحب، والأسعار ثابتة فلا توجد مساومة (定価).',
    },
    say: true,
  }),
  c({
    id: 'cc_bikereg',
    trigger: { on: 'purchase', ids: ['bike_mamachari', 'ebike'] },
    phrase: { ja: '防犯登録', en: 'bicycle registration', ar: 'تسجيل الدراجة' },
    text: {
      en: 'A bicycle is registered at the shop where you buy it. The sticker links the bike to you, so the police can return it if it is lost or stolen. Helmets are recommended for everyone.',
      ar: 'تُسجَّل الدراجة في المتجر الذي تشتريها منه. يربط الملصق الدراجة بك فتعيدها الشرطة إن فُقدت أو سُرقت. يُوصى بالخوذة للجميع.',
    },
  }),
  c({
    id: 'cc_shoesoff',
    trigger: { on: 'visit', ids: ['home:mio', 'home:yuki', 'home:tanaka', 'home:kenji', 'home:sato', 'home:hanako', 'home:rin', 'home:aiko'] },
    phrase: { ja: 'おじゃまします', en: 'Excuse me for intruding (said as you enter)', ar: 'عن إذنك (تُقال عند الدخول)' },
    text: {
      en: 'Take your shoes off in the genkan (entrance), step up, and put on slippers. Never wear slippers on tatami, and toilets often have their own pair.',
      ar: 'اخلع حذاءك في الجنكان (المدخل)، ثم اصعد وارتدِ الخفّ. لا ترتدِ الخفّ على حصير التاتامي أبدًا، وكثيرًا ما يكون للمرحاض خفّ خاص به.',
    },
    say: true,
  }),
  c({
    id: 'cc_rent',
    trigger: { on: 'scenario_done', ids: ['aiko_viewing'] },
    phrase: { ja: '敷金', en: 'security deposit', ar: 'وديعة التأمين' },
    text: {
      en: 'Renting often means a deposit (敷金), sometimes "key money" (礼金, a non-refundable thank-you to the landlord), an agent fee and a guarantor. Aiko keeps it simple: deposit and first month only.',
      ar: 'غالبًا ما يعني الإيجار وديعة تأمين (敷金)، وأحيانًا «مال المفتاح» (礼金، شكر لا يُسترد للمالك)، إضافةً إلى رسوم الوسيط وكفيل. أيكو تبسّط الأمر: وديعة وأول شهر فقط.',
    },
    adultOnly: true,
  }),
  c({
    id: 'cc_shaken',
    trigger: { on: 'intent', ids: ['motors_car:ask_total'] },
    phrase: { ja: '乗り出し価格', en: 'drive-away price', ar: 'السعر النهائي' },
    text: {
      en: 'Cars are quoted two ways: the body price (本体価格) and the drive-away price (乗り出し価格), which adds fees and taxes. In many areas you also need a parking certificate (車庫証明), even for a kei car, and a regular inspection called shaken (車検).',
      ar: 'تُعرض أسعار السيارات بطريقتين: سعر الهيكل (本体価格) والسعر النهائي (乗り出し価格) الذي يشمل الرسوم والضرائب. وفي مناطق كثيرة تحتاج أيضًا إلى شهادة موقف (車庫証明) حتى للسيارات الصغيرة (كي)، وإلى فحص دوري يسمى شاكن (車検).',
    },
  }),
  c({
    id: 'cc_matsuri',
    trigger: { on: 'festival' },
    phrase: { ja: 'お祭り', en: 'festival', ar: 'مهرجان' },
    text: {
      en: 'Matsuri are local festivals, often at shrines, with food stalls (屋台), yukata, portable shrines and, in summer, fireworks. Stalls usually take cash only.',
      ar: 'الماتسوري مهرجانات محلية، غالبًا عند المعابد، فيها بسطات طعام (屋台) ويوكاتا ومعابد محمولة وألعاب نارية في الصيف. وتقبل البسطات النقد غالبًا فقط.',
    },
  }),
  c({
    id: 'cc_trash',
    trigger: { on: 'visit', ids: ['flat', 'home:aiko'] },
    phrase: { ja: 'ごみの日', en: 'rubbish day', ar: 'يوم النفايات' },
    text: {
      en: 'Rubbish is sorted (burnable, plastics, cans, bottles...) and collected on fixed days. Ask your landlord for the calendar and put it out only on the right morning.',
      ar: 'تُفرز النفايات (قابلة للحرق، بلاستيك، علب، زجاجات...) وتُجمع في أيام محددة. اطلب التقويم من المالك وضعها في الصباح الصحيح فقط.',
    },
  }),
];
