import type { NameGloss } from '@lw/game';

/**
 * Pack data: gift tastes (docs/GAME_DESIGN.md §8.5) and keepsakes (4A).
 *
 * The design table lists the tastes of all nine friends over the full catalog. Release 1 (docs/RELEASE_1.md) has six friends and sells
 * only the things the shops of the release stock (Release 2 wave A adds Aiko's four presents: g_flower, g_wagashi, g_tea_set, g_tenugui,
 * so each friend loves one of them and Kenji's dislike of the bouquet is back; Fuku-Fuku's two presents, g_plush and g_guitar_pick, bring back
 * Kenji's dislike of the plush toy and Yuki's love of the guitar pick), so every list below names released ids only (an unknown id would be a validation
 * warning, and a gift nobody can buy is a taste nobody can see):
 *   - catalog gifts: g_choco, g_manga, g_game_card (konbini), g_music_cd (Hikari Denki), g_carfresh (Nakamura Motors)
 *   - the giftable menu items, written as the bare option of the menu row (`coffee` matches `konbini:coffee` and `cafe:coffee`):
 *     coffee, greenTea, cake, onigiri, bento. The other konbini and café goods (water, sandwich, juice, milk, black tea, latte)
 *     are taste-neutral unless a `likes` tag fits.
 * Item tags a `likes` entry can match: sweet, snack, drink, tea, coffee, food, meal (menu); media, anime, game, tech, music, cars (catalog).
 *
 * A design love that is not released is replaced by the nearest released one (noted per friend) so that every friend has a present they
 * love that can be bought in a shop open by Free Walk, and at least one such present at the konbini (open from Chapter 1, where the
 * Chapter 3 gift is bought). A design dislike that is not released is dropped rather than invented.
 */
export interface Taste {
  /** ItemDef ids, menu ids or bare menu options: x2 */
  loves: string[];
  /** item tags: x1.5 */
  likes: string[];
  /** same forms as `loves`: 0 AP, a gentle reaction */
  dislikes: string[];
}

export const TASTES: Record<string, Taste> = {
  // design: loves g_manga, cake, g_souvenir | likes sweet, cute, media, music | dislikes coffee
  // (Aiko's wagashi stands in for the souvenir: she loves sweets)
  mio: { loves: ['g_manga', 'cake', 'g_wagashi'], likes: ['sweet', 'cute', 'media', 'music'], dislikes: ['coffee'] },
  // design: loves g_guitar_pick, g_tea_set, cake | likes sweet, music, flower | dislikes coffee, g_game_card
  yuki: { loves: ['g_guitar_pick', 'cake', 'g_tea_set'], likes: ['sweet', 'music', 'flower'], dislikes: ['coffee', 'g_game_card'] },
  // design: loves g_game_card, coffee, g_manga | likes game, tech, sweet | dislikes onigiri, bento
  // (the wagashi is an Aiko present the sweet-toothed Tanaka loves; the design has no Aiko love for him)
  tanaka: { loves: ['g_game_card', 'coffee', 'g_manga', 'g_wagashi'], likes: ['game', 'tech', 'sweet'], dislikes: ['onigiri', 'bento'] },
  // design: loves g_tea_set, g_wagashi, g_souvenir (the souvenir is not released: green tea stands in) | likes travel, tea, tradition | dislikes g_choco, g_game_card
  sato: { loves: ['g_tea_set', 'g_wagashi', 'greenTea'], likes: ['travel', 'tea', 'tradition'], dislikes: ['g_choco', 'g_game_card'] },
  // design: loves g_tenugui, greenTea, coffee | likes sports, food, drink | dislikes g_flower, g_plush
  kenji: { loves: ['g_tenugui', 'greenTea', 'coffee'], likes: ['sports', 'food', 'drink'], dislikes: ['g_flower', 'g_plush'] },
  // design: loves g_tea_set, g_wagashi, g_flower | likes tradition, flower, craft | dislikes g_choco, g_game_card
  hanako: { loves: ['g_tea_set', 'g_wagashi', 'g_flower', 'greenTea'], likes: ['tradition', 'flower', 'craft', 'tea'], dislikes: ['g_choco', 'g_game_card'] },
  // Release 2 wave B1: Aiko is a friend. design: loves g_souvenir, cake, g_music_cd | likes craft, travel, sweet | dislikes coffee, g_game_card
  // (the souvenir is not released: her own tenugui, a craft, stands in)
  aiko: { loves: ['g_music_cd', 'cake', 'g_tenugui'], likes: ['craft', 'travel', 'sweet'], dislikes: ['coffee', 'g_game_card'] },
};

/** The keepsakes the friends' beats hand out (never sold): id -> name (the ids owned are in `GameState.keepsakes`). */
export const KEEPSAKES: Record<string, NameGloss> = {
  note_mio: { ja: 'ミオのメモ', en: "Mio's number note", ar: 'مذكرة رقم ميو' },
  // Release 2 wave B1: the keepsakes of the hang-outs (mio, yuki, kenji; Aiko's is the g_wagashi item) and of the three home visits
  photo_mio: { ja: 'ミオの写真', en: "Mio's park photo", ar: 'صورة ميو في الحديقة' },
  stamp_card: { ja: 'スタンプカード', en: 'Café stamp card', ar: 'بطاقة أختام المقهى' },
  kenji_recipe: { ja: 'けんじのレシピ', en: "Kenji's recipe note", ar: 'وصفة كينجي' },
  photo_printed: { ja: 'ミオが撮った写真', en: 'A printed photo Mio took of you', ar: 'صورة مطبوعة التقطتها ميو لك' },
  tea_cup: { ja: 'あいこの湯のみ', en: "Aiko's tea cup", ar: 'كوب شاي أيكو' },
  hina_drawing: { ja: 'ひなの絵', en: "Hina's drawing", ar: 'رسمة هينا' },
};
