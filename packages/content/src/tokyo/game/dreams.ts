import type { DreamDef, DreamStep, Gloss, Pred } from '@lw/game';

// The 7 dreams and their step ladders (docs/GAME_DESIGN.md §7.3, D20, D28). Steps pay no yen: the item is the prize; the 2nd step of
// every dream pays a cosmetic sticker and a one-line beat (BALANCE.dream.milestoneStep). `gate` is the chapter in which a step becomes
// visible. Step ids are unique across the pack (`dream.steps` is keyed by step id alone). Item, friend and scenario ids that later
// slices author are named here already; `validatePack` is tolerant of them below level 3 (§14.5).

const step = (id: string, gate: number, pred: Pred, en: string, ar: string): DreamStep => ({ id, gate, pred, text: { en, ar } as Gloss });

/** Free Walk: `chapter.n = 9` (Chapter 8 completed). */
const FREE_WALK = 9;
/** D28: the flat, the fresh start and the car are for adults. */
const ADULT = 18;

export const DREAMS: DreamDef[] = [
  {
    id: 'phone_pal',
    name: { ja: '友だちとスマホ', reading: 'ともだちとスマホ', en: 'My own phone, friends in my pocket', ar: 'هاتفي الخاص وأصدقائي في جيبي' },
    horizon: 'short',
    items: ['phone_used'],
    title: 't_dream_phone_pal',
    beat: 'b_dream_phone_pal',
    sticker: 'st_phone_pal',
    keepsake: 'kp_dream_phone_pal',
    defaultFor: ['work'],
    steps: [
      step('phone_pal_1', 2, { k: 'words_known', tag: 'numbers', n: 8 }, 'Learn 8 number words', 'تعلّم 8 كلمات أرقام'),
      step('phone_pal_2', 3, { k: 'hearts', friend: 'tanaka', atLeast: 1 }, 'Get to know Tanaka, the phone-and-games fan', 'تعرّف على تاناكا'),
      step('phone_pal_3', 4, { k: 'own', category: 'phone' }, 'Buy your own phone', 'اشترِ هاتفك الخاص'),
      step('phone_pal_4', 4, { k: 'phone_chat', n: 3, friends: 2 }, 'Chat with 2 different friends', 'تحدّث مع صديقين مختلفين'),
      step('phone_pal_5', 4, { k: 'hearts_count', atLeast: 2, n: 3 }, 'Have three 2-heart friends', 'كوّن ثلاثة أصدقاء بقلبين'),
    ],
  },
  {
    id: 'bike',
    name: { ja: '自転車でたんけん', reading: 'じてんしゃでたんけん', en: 'Explore by bike', ar: 'استكشف بالدراجة' },
    horizon: 'short',
    items: ['bike_mamachari', 'bike_helmet'],
    title: 't_dream_bike',
    beat: 'b_dream_bike',
    sticker: 'st_bike',
    keepsake: 'kp_dream_bike',
    steps: [
      step('bike_1', 2, { k: 'words_known', tag: 'direction', n: 6 }, 'Learn 6 direction words', 'تعلّم 6 كلمات اتجاهات'),
      step('bike_2', 3, { k: 'scenario', id: 'sato_directions', minIndependent: 2 }, 'Ask Sato the way, in Japanese', 'اسأل ساتو عن الطريق باليابانية'),
      step('bike_3', 5, { k: 'own', category: 'bicycle' }, 'Buy and register your bike', 'اشترِ دراجتك وسجّلها'),
      step('bike_4', 5, { k: 'own', item: 'bike_helmet' }, 'Get a helmet', 'احصل على خوذة'),
      step('bike_5', 5, { k: 'all', of: [{ k: 'visit', place: 'spot:pond' }, { k: 'visit', place: 'spot:torii' }] }, 'Ride to the pond and the torii gate', 'اركب إلى البركة وبوابة توريي'),
    ],
  },
  {
    id: 'flat',
    name: { ja: '自分の部屋', reading: 'じぶんのへや', en: 'My own flat', ar: 'شقتي الخاصة' },
    horizon: 'long',
    ageMin: ADULT,
    items: ['home_room_ono'],
    furnish: 3,
    title: 't_dream_flat',
    beat: 'b_dream_flat',
    sticker: 'st_flat',
    keepsake: 'kp_dream_flat',
    defaultFor: ['relocation'],
    steps: [
      step('flat_1', 2, { k: 'words_known', tag: 'home', n: 8 }, 'Learn 8 home and room words', 'تعلّم 8 كلمات عن البيت'),
      step('flat_2', 3, { k: 'hearts', friend: 'aiko', atLeast: 1 }, 'Get to know Aiko, the landlady', 'تعرّف على أيكو'),
      step('flat_3', 6, { k: 'scenario', id: 'aiko_viewing', complete: true }, 'See the room, ask good questions', 'شاهد الغرفة واطرح أسئلة جيدة'),
      step('flat_4', 6, { k: 'own', item: 'home_room_ono' }, 'Sign and pay the move-in cost', 'وقّع وادفع تكاليف الانتقال'),
      step('flat_5', 6, { k: 'item_placed', n: 3 }, 'Furnish your room with 3 things', 'أثّث غرفتك بثلاث قطع'),
    ],
  },
  {
    id: 'festival',
    name: { ja: 'ミオとお祭り', reading: 'ミオとおまつり', en: 'Befriend Mio, go to the festival', ar: 'صداقة ميو والذهاب إلى المهرجان' },
    horizon: 'medium',
    items: ['yukata'],
    title: 't_dream_festival',
    beat: 'b_dream_festival',
    sticker: 'st_festival',
    keepsake: 'kp_dream_festival',
    defaultFor: ['casual'],
    steps: [
      step('festival_1', 2, { k: 'hearts', friend: 'mio', atLeast: 1 }, 'Say hello to Mio and learn her name', 'حيِّ ميو'),
      step('festival_2', 3, { k: 'hearts', friend: 'mio', atLeast: 2 }, 'Become friends with Mio', 'كن صديقًا لميو'),
      step('festival_3', 4, { k: 'own', item: 'yukata' }, "Buy a yukata with Rin's help", 'اشترِ يوكاتا بمساعدة رين'),
      step('festival_4', 6, { k: 'hearts', friend: 'mio', atLeast: 4 }, 'Get to 4 hearts with Mio', 'اوصل إلى 4 قلوب مع ميو'),
      step('festival_5', 7, { k: 'scenario', id: 'matsuri_stalls', minIndependent: 3 }, 'Go to the festival stalls', 'اذهب إلى بسطات المهرجان'),
    ],
  },
  {
    id: 'travel',
    name: { ja: 'ICカードでたび', reading: 'ICカードでたび', en: 'IC card and a first trip', ar: 'بطاقة IC ورحلتي الأولى' },
    horizon: 'short',
    items: ['ic_card'],
    title: 't_dream_travel',
    beat: 'b_dream_travel',
    sticker: 'st_travel',
    keepsake: 'kp_dream_travel',
    defaultFor: ['travel'],
    steps: [
      step('travel_1', 2, { k: 'words_known', tag: 'transport', n: 8 }, 'Learn 8 train words', 'تعلّم 8 كلمات عن القطار'),
      step('travel_2', 3, { k: 'own', item: 'ic_card' }, 'Buy an IC card and load it', 'اشترِ بطاقة IC واشحنها'),
      step('travel_3', 5, { k: 'visit', place: 'trip:hikarigaoka' }, 'Take your first trip', 'قم برحلتك الأولى'),
      step('travel_4', 5, { k: 'flag', id: 'ticket_bought' }, 'Buy a paper ticket at a machine', 'اشترِ تذكرة ورقية من الآلة'),
      step('travel_5', 5, { k: 'flag', id: 'souvenir_given' }, 'Bring back a souvenir (omiyage) for a friend', 'أحضر هدية تذكارية لصديق'),
    ],
  },
  {
    id: 'fresh_start',
    name: { ja: '新しい生活', reading: 'あたらしいせいかつ', en: 'Fresh start: phone + bike + flat', ar: 'بداية جديدة: هاتف ودراجة وشقة' },
    horizon: 'long',
    ageMin: ADULT,
    items: ['phone_used', 'bike_mamachari', 'home_room_ono'],
    furnish: 3,
    title: 't_dream_fresh_start',
    beat: 'b_dream_fresh_start',
    sticker: 'st_fresh_start',
    keepsake: 'kp_dream_fresh_start',
    steps: [
      step('fresh_start_1', 4, { k: 'own', category: 'phone' }, 'Buy your own phone', 'اشترِ هاتفك الخاص'),
      step('fresh_start_2', 5, { k: 'own', category: 'bicycle' }, 'Buy and register your bike', 'اشترِ دراجتك وسجّلها'),
      step('fresh_start_3', 6, { k: 'own', item: 'home_room_ono' }, 'Sign and pay the move-in cost', 'وقّع وادفع تكاليف الانتقال'),
      step('fresh_start_4', 6, { k: 'item_placed', n: 3 }, 'Furnish your room with 3 things', 'أثّث غرفتك بثلاث قطع'),
      step('fresh_start_5', 6, { k: 'hearts_count', atLeast: 3, n: 3 }, 'Have three 3-heart friends', 'كوّن ثلاثة أصدقاء بثلاثة قلوب'),
      step('fresh_start_6', 7, { k: 'flag', id: 'housewarming' }, 'Invite a friend to your flat', 'ادعُ صديقًا إلى شقتك'),
    ],
  },
  {
    id: 'car',
    name: { ja: '自分の車', reading: 'じぶんのくるま', en: 'My own (kei) car', ar: 'سيارتي الخاصة (كي-كار)' },
    horizon: 'epilogue',
    ageMin: ADULT,
    openChapter: FREE_WALK,
    items: ['car_kei_used'],
    title: 't_dream_car',
    beat: 'b_dream_car',
    sticker: 'st_car',
    keepsake: 'kp_dream_car',
    steps: [
      step('car_1', FREE_WALK, { k: 'words_known', tag: 'car', n: 8 }, 'Learn 8 car words', 'تعلّم 8 كلمات عن السيارات'),
      step('car_2', FREE_WALK, { k: 'hearts', friend: 'nakamura', atLeast: 3 }, 'Get to 3 hearts with Nakamura', 'اوصل إلى 3 قلوب مع ناكامورا'),
      // cash only: the savings jar of the Dream tab (the IC card and points never count, §4.1)
      step('car_3', FREE_WALK, { k: 'wallet', atLeast: 198000 }, 'Save ¥198,000 in cash', 'ادّخر ¥198,000 نقدًا'),
      step('car_4', FREE_WALK, { k: 'own', category: 'car' }, 'Buy your car', 'اشترِ سيارتك'),
      step('car_5', FREE_WALK, { k: 'flag', id: 'first_drive' }, 'Go for your first drive', 'قم بأول جولة بالسيارة'),
    ],
  },
];
