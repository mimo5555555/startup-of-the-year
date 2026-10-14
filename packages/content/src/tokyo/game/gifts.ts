import type { NameGloss } from '@lw/game';

/**
 * Pack data: gift tastes (docs/GAME_DESIGN.md §8.5) and keepsakes (4A).
 *
 * The design table lists the tastes of all nine friends over the full catalog. Release 1 (docs/RELEASE_1.md) has six friends and sells
 * only the things the shops of the release stock (Release 2 wave A adds Aiko's four presents: g_flower, g_wagashi, g_tea_set, g_tenugui,
 * so each friend loves one of them and Kenji's dislike of the bouquet is back), so every list below names released ids only (an unknown id would be a validation
 * warning, and a gift nobody can buy is a taste nobody can see):
 *   - catalog gifts: g_choco, g_manga, g_game_card (konbini), g_music_cd (Hikari Denki), g_carfresh (Nakamura Motors)
 *   - the giftable menu items, written as the bare option of the menu row (`coffee` matches `konbini:coffee` and `cafe:coffee`):
 *     coffee, greenTea, cake, onigiri, bento. The other konbini and café goods (water, sandwich, juice, milk, black tea, latte)
 *     are taste-neutral unless a `likes` tag fits.
 * Item tags a `likes` entry can match: sweet, snack, drink, tea, coffee, food, meal (menu); media, anime, game, tech, music, cars (catalog).
 *
 * A design love that is not released is replaced by the nearest released one (noted per friend) so that every friend has a present they
 * love that can be bought in a shop open by Free Walk, and at least one such present at the konbini (open from Chapter 1, where the
 * Chapter 3 gift is bought). A design dislike that is not released is dropped (Kenji's g_flower and g_plush) rather than invented.
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
  yuki: { loves: ['cake', 'g_tea_set'], likes: ['sweet', 'music', 'flower'], dislikes: ['coffee', 'g_game_card'] },
  // design: loves g_game_card, coffee, g_manga | likes game, tech, sweet | dislikes onigiri, bento
  // (the wagashi is an Aiko present the sweet-toothed Tanaka loves; the design has no Aiko love for him)
  tanaka: { loves: ['g_game_card', 'coffee', 'g_manga', 'g_wagashi'], likes: ['game', 'tech', 'sweet'], dislikes: ['onigiri', 'bento'] },
  // design: loves g_tea_set, g_wagashi, g_souvenir (the souvenir is not released: green tea stands in) | likes travel, tea, tradition | dislikes g_choco, g_game_card
  sato: { loves: ['g_tea_set', 'g_wagashi', 'greenTea'], likes: ['travel', 'tea', 'tradition'], dislikes: ['g_choco', 'g_game_card'] },
  // design: loves g_tenugui, greenTea, coffee | likes sports, food, drink | dislikes g_flower, g_plush (g_plush is a Fuku-Fuku present, not an Aiko one)
  kenji: { loves: ['g_tenugui', 'greenTea', 'coffee'], likes: ['sports', 'food', 'drink'], dislikes: ['g_flower'] },
  // design: loves g_tea_set, g_wagashi, g_flower | likes tradition, flower, craft | dislikes g_choco, g_game_card
  hanako: { loves: ['g_tea_set', 'g_wagashi', 'g_flower', 'greenTea'], likes: ['tradition', 'flower', 'craft', 'tea'], dislikes: ['g_choco', 'g_game_card'] },
};

/** The keepsakes the friends' beats hand out (never sold): id -> name (the ids owned are in `GameState.keepsakes`). */
export const KEEPSAKES: Record<string, NameGloss> = {
  note_mio: { ja: 'ミオのメモ', en: "Mio's number note", ar: 'مذكرة رقم ميو' },
};
