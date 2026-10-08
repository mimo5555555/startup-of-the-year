/**
 * Pack data: tag -> surfaces (docs/GAME_DESIGN.md §7.1, D33). `words_known tag:X n:N` counts the reviewed vocabulary cards whose surface
 * is listed here, so a tag lists 8-14 words (more than any step asks for) that the player can actually meet and save.
 * `home` and `car` name words that the shop-aiko / shop-motors lexicon modules (slice 3) define; `quests-pack.test.ts` lists the
 * surfaces that are still unresolved until those modules land.
 */
export const WORD_TAGS: Record<string, string[]> = {
  numbers: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '円'],
  direction: ['右', '左', 'まっすぐ', '曲がる', '曲がってください', '近い', '遠い', '出口', '入口', 'あちら', 'あそこ', 'どこ'],
  transport: ['駅', '電車', '切符', '券売機', '改札', '乗り換え', '次の電車', '時刻表', 'ホーム', '運賃', 'ICカード', '空港'],
  home: ['うち', '部屋', '玄関', '畳', '日当たり', '家賃', '敷金', '前家賃', '鍵', '契約', '隣', 'スリッパ', '靴', '脱ぐ'],
  car: ['車', 'ドライブ', '軽自動車', '本体価格', '乗り出し価格', '走行距離', '年式', '車検', '車庫証明'],
  cafe: ['カフェ', 'コーヒー', '紅茶', 'お茶', 'カフェラテ', 'ジュース', '水', '牛乳', 'ケーキ', 'サンドイッチ', 'ホット', 'アイス'],
};
