// The recorded voices (VOICEVOX speakers) of the cast, the shift customers and the narrator (chips, words, model lines).
// tools/voice/generate.mjs records with these ids and copies the map into public/voice/manifest.json.
// VOICEVOX's terms ask for a credit per speaker: VOICE_CREDITS is shown in Settings.

export const NARRATOR = 'narrator';
/** the anonymous customers of a shift */
export const CUSTOMER = 'customer';

/** voice id (a character id, 'customer' or 'narrator') -> VOICEVOX style id and the speaker's credit name */
export const VOICE_SPEAKERS: Record<string, { id: number; name: string }> = {
  yuki: { id: 8, name: '春日部つむぎ' }, // 24, bright barista
  tanaka: { id: 11, name: '玄野武宏' }, // 31, friendly konbini clerk
  sato: { id: 52, name: '雀松朱司' }, // 58, calm, polite station attendant
  kenji: { id: 13, name: '青山龍星' }, // 45, gruff ramen chef
  mio: { id: 2, name: '四国めたん' }, // 19, lively student
  hanako: { id: 14, name: '冥鳴ひまり' }, // 38, calm teacher
  aiko: { id: 80, name: 'もち子さん' }, // 68, soft, unhurried landlady (のんびり)
  rin: { id: 54, name: '春歌ナナ' }, // 16, energetic teen
  nakamura: { id: 21, name: '剣崎雌雄' }, // 36, deep-voiced mechanic
  aoi: { id: 10, name: '雨晴はう' }, // 24, gentle shop clerk
  kato: { id: 51, name: '†聖騎士 紅桜†' }, // 52, hearty souvenir seller
  hina: { id: 1, name: 'ずんだもん' }, // 7, a child (あまあま)
  kannushi: { id: 53, name: '麒ヶ島宗麟' }, // 66, the old shrine priest
  fujiwara: { id: 109, name: '東北イタコ' }, // 58, refined Kyoto okami
  ishida: { id: 12, name: '白上虎太郎' }, // 34, soft-spoken temple attendant
  mori: { id: 16, name: '九州そら' }, // 41, matcha café owner
  [CUSTOMER]: { id: 107, name: '東北ずん子' },
  [NARRATOR]: { id: 29, name: 'No.7' },
};

/** "VOICEVOX:name" for every speaker used, once each */
export const VOICE_CREDITS = [...new Set(Object.values(VOICE_SPEAKERS).map((v) => `VOICEVOX:${v.name}`))].join(', ');
