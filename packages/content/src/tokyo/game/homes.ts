import type { Line } from '../../types';

/**
 * Homes and hang-outs (Release 2 wave B1, docs/GAME_DESIGN.md §6.4, §8.8): the tables the app and the world read to enter a friend's home,
 * to play the genkan, to show the word cards of the props and to hand out the hang-out rewards. Pure data, exported from `@lw/content`.
 *
 *  - `HOMES`: scenario id -> the home (stage id, door pick id, host, props, keepsake). The stage is a procedural interior loaded on demand
 *    (`world.enterStage(stage)`); the door marker is active from the heart in `hearts`. Before that the tooltip is `DOOR_LOCKED`.
 *  - `PROP_WORDS`: stage prop id -> the lexicon surface of its word card (a tap on the prop is a `discover` plus that card).
 *  - `GENKAN`: the host's lines at the entrance. The genkan is not a conversation node: the app plays two buttons, shoes off first, slippers
 *    second (the step up is 0.15 m); the wrong order is answered by `wrong`; both done raise the flag `genkan_ok` and the scenario starts.
 *  - `HANGOUTS`: scenario id -> the friend, the place and the reward the first completion hands over (`ScenarioMeta.effects`).
 * The panel fallback (a stage that cannot load, or a low-end device) shows the host over a room backdrop with the same two buttons and the
 * same conversation, so nothing here depends on the 3D interiors.
 */

export interface HomeDef {
  /** the scenario id: `home_<friend>` (also the `Interaction.scenarioId` and the `visit home:<friend>` stat key suffix) */
  scenarioId: string;
  /** the stage id the world builds */
  stage: string;
  /** the door pick id on the street (active at `hearts`) */
  door: string;
  host: string;
  /** hearts needed to be invited */
  hearts: number;
  /** prop ids of the stage, in the order of the room; each has an entry in `PROP_WORDS` */
  props: string[];
  /** the keepsake the first visit hands over (`GamePack.keepsakes`) */
  keepsake: string;
  /** the `visit` stat key the reducer files: `home:<friend>` */
  visitKey: string;
}

export const HOMES: Record<string, HomeDef> = {
  home_mio: { scenarioId: 'home_mio', stage: 'mio_1r', door: 'door:mio', host: 'mio', hearts: 4, props: ['kutsu', 'tsukue', 'kamera', 'poster', 'hondana', 'mado'], keepsake: 'photo_printed', visitKey: 'home:mio' },
  home_aiko: { scenarioId: 'home_aiko', stage: 'aiko_tatami', door: 'door:aiko', host: 'aiko', hearts: 4, props: ['tatami', 'kotatsu', 'zabuton', 'shoji', 'kyusu', 'hana'], keepsake: 'tea_cup', visitKey: 'home:aiko' },
  home_kenji: { scenarioId: 'home_kenji', stage: 'kenji_flat', door: 'door:kenji', host: 'kenji', hearts: 4, props: ['chabudai', 'suihanki', 'shashin', 'yakyu', 'e', 'zabuton'], keepsake: 'hina_drawing', visitKey: 'home:kenji' },
};

/** Stage prop id (the romaji of the word) -> lexicon surface of its word card. */
export const PROP_WORDS: Record<string, string> = {
  kutsu: '靴',
  tsukue: '机',
  kamera: 'カメラ',
  poster: 'ポスター',
  hondana: '本棚',
  mado: '窓',
  tatami: '畳',
  kotatsu: 'こたつ',
  zabuton: 'ざぶとん',
  shoji: '障子',
  kyusu: '急須',
  hana: '花',
  chabudai: 'ちゃぶ台',
  suihanki: '炊飯器',
  shashin: '写真',
  yakyu: '野球',
  e: '絵',
};

/** The home behind a stage id or a door pick id (undefined for anything else). */
export const homeOfStage = (stage: string): HomeDef | undefined => Object.values(HOMES).find((h) => h.stage === stage);
export const homeOfDoor = (door: string): HomeDef | undefined => Object.values(HOMES).find((h) => h.door === door);
/** The home of a friend (undefined for a friend without one in this release). */
export const homeOfFriend = (friend: string): HomeDef | undefined => Object.values(HOMES).find((h) => h.host === friend);

const L = (ja: string, en: string, ar: string): Line => ({ ja, en, ar });

/** A line the host says in plain form when `casual` (the friend's hearts, as in the conversations) and in polite form otherwise. */
export interface GenkanLine {
  casual: Line;
  polite: Line;
}
const both = (l: Line): GenkanLine => ({ casual: l, polite: l });

export interface GenkanLines {
  /** the wrong order (slippers before the shoes are off): the host's gentle correction */
  wrong: GenkanLine;
  /** the shoes are off: the host hands over the slippers */
  shoesOff: GenkanLine;
  /** slippers on: the host invites the player up, and the conversation starts */
  ok: GenkanLine;
}

const SHOES_WRONG = L('あっ、|靴|を|脱いで|ください！', 'Oh! Please take your shoes off!', 'آه! اخلع حذاءك من فضلك!');
const SLIPPERS = L('はい、|スリッパ|を|どうぞ。', 'Here, please put on the slippers.', 'تفضّل، البس الخفّ.');

export const GENKAN: Record<string, GenkanLines> = {
  mio: {
    wrong: { casual: L('あっ、|靴|を|脱いで！', 'Oh! Take your shoes off!', 'آه! اخلع حذاءك!'), polite: SHOES_WRONG },
    shoesOff: both(SLIPPERS),
    ok: { casual: L('どうぞ、|上がって！', 'Come on up!', 'تفضّل بالدخول!'), polite: L('どうぞ、|上がって|ください。', 'Please come up.', 'تفضّل بالدخول من فضلك.') },
  },
  aiko: {
    wrong: both(L('あら、|靴|を|脱いで|ください|ね。', 'Oh dear, please take your shoes off.', 'آه، اخلع حذاءك من فضلك.')),
    shoesOff: both(SLIPPERS),
    ok: both(L('どうぞ、|上がって|ください。', 'Please come up.', 'تفضّل بالدخول من فضلك.')),
  },
  kenji: {
    wrong: { casual: L('あっ、|靴|を|脱いで|くれ！', 'Oh! Take your shoes off!', 'آه! اخلع حذاءك!'), polite: SHOES_WRONG },
    shoesOff: both(SLIPPERS),
    ok: { casual: L('よし、|上がれ！', 'Good, come on up!', 'جيد، تفضّل بالدخول!'), polite: L('どうぞ、|上がって|ください。', 'Please come up.', 'تفضّل بالدخول من فضلك.') },
  },
};

/** The tooltip of a door before the heart (`door:*` pick, docs/GAME_DESIGN.md §6.4). */
export const DOOR_LOCKED: Line = L('まだ|入れません。', 'You cannot go in yet.', 'لا يمكنك الدخول بعد.');

/** A flag the genkan raises when both buttons were pressed in the right order (the app dispatches it before the scenario starts). */
export const GENKAN_FLAG = 'genkan_ok';
/** The cosmetic flag Aiko's visit raises when she shows the room next door (`aiko_viewing` does not depend on it). */
export const AIKO_ROOM_FLAG = 'aiko_room_shown';

export interface HangoutDef {
  /** the scenario id: `hang_<friend>_<what>` */
  scenarioId: string;
  friend: string;
  /** the place of the conversation (a `PLACE_IDS` id) */
  place: string;
  /** the interaction row id in the friend's table (`<friend>_hang`) */
  interactionId: string;
  hearts: number;
  /** what the first completion hands over */
  reward: { kind: 'keepsake'; id: string } | { kind: 'item'; id: string; qty: number };
}

export const HANGOUTS: Record<string, HangoutDef> = {
  hang_mio_photo: { scenarioId: 'hang_mio_photo', friend: 'mio', place: 'park', interactionId: 'mio_hang', hearts: 3, reward: { kind: 'keepsake', id: 'photo_mio' } },
  hang_yuki_jam: { scenarioId: 'hang_yuki_jam', friend: 'yuki', place: 'cafe', interactionId: 'yuki_hang', hearts: 3, reward: { kind: 'keepsake', id: 'stamp_card' } },
  hang_kenji_cook: { scenarioId: 'hang_kenji_cook', friend: 'kenji', place: 'ramen', interactionId: 'kenji_hang', hearts: 3, reward: { kind: 'keepsake', id: 'kenji_recipe' } },
  hang_aiko_wagashi: { scenarioId: 'hang_aiko_wagashi', friend: 'aiko', place: 'ono', interactionId: 'aiko_hang', hearts: 3, reward: { kind: 'item', id: 'g_wagashi', qty: 1 } },
};
