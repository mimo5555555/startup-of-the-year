// More ways to say each request (docs/ROADMAP.md, "better conversations"): at the key steps of the shops people use most, the natural
// alternatives a learner types (not only the chip's wording) are understood as the right thing. Each case types its way to a step with
// plain lines, then says the alternative; the intent it must reach is named. A case is one line of the table: add the phrasing that
// failed a player, then the key that makes it pass.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById } from '@lw/content';
import { ConversationSession } from '../src';

interface Case {
  id: string;
  /** typed lines that lead to the step */
  path: string[];
  say: string;
  want: string;
}

const KONBINI_REGISTER = ['おにぎりをください。'];
const KONBINI_PAY = [...KONBINI_REGISTER, '大丈夫です。'];
const CAFE_TEMP = ['コーヒーをください。'];
const CAFE_MORE = [...CAFE_TEMP, 'ホットで。'];
const RAMEN_SPICY = ['みそラーメンをください。'];
const RAMEN_BILL = [...RAMEN_SPICY, '大丈夫です。', 'おいしいです！'];

const CASES: Case[] = [
  // the konbini: asking for an item without ください, pointing at it, the bag, paying
  { id: 'konbini', path: [], say: 'おにぎりがほしいです。', want: 'buy_item' },
  { id: 'konbini', path: [], say: 'おにぎりをひとつください。', want: 'buy_item' },
  { id: 'konbini', path: [], say: 'おにぎりにします。', want: 'buy_item' },
  { id: 'konbini', path: [], say: 'おにぎりをもらえますか？', want: 'buy_item' },
  { id: 'konbini', path: [], say: 'おにぎりをお願いします。', want: 'buy_item' },
  { id: 'konbini', path: ['おにぎりはどこですか？'], say: 'じゃあ、それをください。', want: 'this_please' },
  { id: 'konbini', path: ['おにぎりはどこですか？'], say: 'これにします。', want: 'this_please' },
  { id: 'konbini', path: KONBINI_REGISTER, say: '袋はいらないです。', want: 'bag_no' },
  { id: 'konbini', path: KONBINI_REGISTER, say: '袋なしでお願いします。', want: 'bag_no' },
  { id: 'konbini', path: KONBINI_REGISTER, say: '袋は要りません。', want: 'bag_no' },
  { id: 'konbini', path: KONBINI_REGISTER, say: 'いいえ、結構です。', want: 'bag_no' },
  { id: 'konbini', path: KONBINI_REGISTER, say: 'レジ袋をお願いします。', want: 'bag_yes' },
  { id: 'konbini', path: KONBINI_REGISTER, say: '袋を一枚ください。', want: 'bag_yes' },
  { id: 'konbini', path: KONBINI_REGISTER, say: 'はい、お願いします。', want: 'bag_yes' },
  { id: 'konbini', path: KONBINI_PAY, say: 'カードで払います。', want: 'pay_card' },
  { id: 'konbini', path: KONBINI_PAY, say: 'スイカでお願いします。', want: 'pay_ic' },
  { id: 'konbini', path: KONBINI_PAY, say: '現金で払います。', want: 'pay_cash' },
  { id: 'konbini', path: KONBINI_PAY, say: 'クレジットカードでもいいですか？', want: 'pay_card' },
  // the café: ordering, hot or iced, "that is all"
  { id: 'cafe', path: [], say: 'コーヒーを一つお願いします。', want: 'order_drink' },
  { id: 'cafe', path: [], say: 'コーヒーにします。', want: 'order_drink' },
  { id: 'cafe', path: [], say: 'おすすめは何ですか？', want: 'recommend' },
  { id: 'cafe', path: CAFE_TEMP, say: 'ホットでお願いします。', want: 'hot' },
  { id: 'cafe', path: CAFE_TEMP, say: '温かいのがいいです。', want: 'hot' },
  { id: 'cafe', path: CAFE_TEMP, say: 'アイスにします。', want: 'iced' },
  { id: 'cafe', path: CAFE_TEMP, say: '冷たいのをください。', want: 'iced' },
  { id: 'cafe', path: CAFE_MORE, say: '以上です。', want: 'no_more' },
  { id: 'cafe', path: CAFE_MORE, say: 'それだけです。', want: 'no_more' },
  { id: 'cafe', path: CAFE_MORE, say: 'いいえ、結構です。', want: 'no_more' },
  { id: 'cafe', path: CAFE_MORE, say: 'これで全部です。', want: 'no_more' },
  { id: 'cafe', path: CAFE_MORE, say: 'いくらですか？', want: 'ask_price' },
  // ramen: ordering, the spice, the bill
  { id: 'ramen', path: [], say: 'みそラーメンを一つ。', want: 'order_flavor' },
  { id: 'ramen', path: [], say: 'しょうゆでお願いします。', want: 'flavor_only' },
  { id: 'ramen', path: [], say: 'おすすめは何ですか？', want: 'recommend' },
  { id: 'ramen', path: RAMEN_SPICY, say: '辛いのは苦手です。', want: 'not_spicy' },
  { id: 'ramen', path: RAMEN_SPICY, say: '辛くないのがいいです。', want: 'not_spicy' },
  { id: 'ramen', path: RAMEN_SPICY, say: '辛いのはちょっと…', want: 'not_spicy' },
  { id: 'ramen', path: RAMEN_SPICY, say: '辛いのが好きです！', want: 'spicy_ok' },
  { id: 'ramen', path: RAMEN_SPICY, say: 'はい、大丈夫です。', want: 'spicy_ok' },
  { id: 'ramen', path: RAMEN_BILL, say: 'お会計お願いします。', want: 'ask_bill' },
  { id: 'ramen', path: RAMEN_BILL, say: 'ごちそうさまでした。', want: 'gochisosama' },
  { id: 'ramen', path: RAMEN_BILL, say: 'いくらですか？', want: 'ask_bill' },
  // the station: the IC card
  { id: 'station_ic', path: [], say: 'ICカードを作りたいです。', want: 'buy_card' },
  { id: 'station_ic', path: [], say: 'スイカを買いたいです。', want: 'buy_card' },
  { id: 'station_ic', path: [], say: 'チャージしたいです。', want: 'top_up' },
  { id: 'station_ic', path: ['チャージしたいです。'], say: '千円お願いします。', want: 'pick_amount' },
  { id: 'station_ic', path: ['チャージしたいです。'], say: '二千円分チャージしてください。', want: 'pick_amount' },
  // the figure shop: picking, just looking, the gift wrapping (a "no wrapping" is never a yes)
  { id: 'hobby_figures', path: [], say: '赤いねこ忍者をください。', want: 'pick_figure' },
  { id: 'hobby_figures', path: [], say: 'おすすめはどれですか？', want: 'ask_reco' },
  { id: 'hobby_figures', path: [], say: '見ているだけです。', want: 'just_looking' },
  { id: 'hobby_figures', path: [], say: 'ちょっと見てもいいですか？', want: 'just_looking' },
  { id: 'hobby_figures', path: ['赤いねこ忍者をください。'], say: 'プレゼント用でお願いします。', want: 'wrap_yes' },
  { id: 'hobby_figures', path: ['赤いねこ忍者をください。'], say: 'ラッピングはいりません。', want: 'wrap_no' },
  { id: 'hobby_figures', path: ['赤いねこ忍者をください。'], say: '自分用です。', want: 'wrap_no' },
  // the public bath: the ticket, the towel (a "no thanks" never rents one), the manners, the milk
  { id: 'sento_desk', path: [], say: '一人です。', want: 'adult' },
  { id: 'sento_desk', path: [], say: '大人一枚お願いします。', want: 'adult' },
  { id: 'sento_desk', path: ['大人一人お願いします。'], say: 'タオルを貸してください。', want: 'rent_towel' },
  { id: 'sento_desk', path: ['大人一人お願いします。'], say: 'タオルは大丈夫です。', want: 'have_towel' },
  { id: 'sento_desk', path: ['大人一人お願いします。'], say: 'タオルはいりません。', want: 'have_towel' },
  { id: 'sento_desk', path: ['大人一人お願いします。', '持っています。'], say: '了解です。', want: 'understood' },
  { id: 'sento_after', path: ['いいお湯でした！'], say: 'コーヒー牛乳を一本ください。', want: 'milk' },
  { id: 'sento_after', path: ['いいお湯でした！'], say: 'いいえ、大丈夫です。', want: 'no_thanks' },
  // the karaoke desk: people, hours, paying
  { id: 'karaoke_desk', path: [], say: '友達と二人です。', want: 'people' },
  { id: 'karaoke_desk', path: [], say: '二人で二時間お願いします。', want: 'people_hours' },
  { id: 'karaoke_desk', path: ['二人です。'], say: 'とりあえず一時間でお願いします。', want: 'pick_hours' },
  { id: 'karaoke_desk', path: ['二人です。', '一時間お願いします。'], say: 'カードで払えますか？', want: 'pay_card' },
  // the game centre: change, the price (asking is not buying), goes, help
  { id: 'arcade_crane', path: [], say: '千円を両替してください。', want: 'ask_change' },
  { id: 'arcade_crane', path: [], say: '百円玉にしてもらえますか？', want: 'ask_change' },
  { id: 'arcade_crane', path: [], say: '一回いくらですか？', want: 'ask_price' },
  { id: 'arcade_crane', path: [], say: '三回やります。', want: 'pick_plays' },
  { id: 'arcade_crane', path: ['三回お願いします。'], say: '取りやすくしてください。', want: 'ask_assist' },
  // Aiko's stall: a present, for whom, the wrapping
  { id: 'aiko_tea', path: [], say: 'プレゼントを探しています。', want: 'want_present' },
  { id: 'aiko_tea', path: [], say: '何がおすすめですか？', want: 'want_present' },
  { id: 'aiko_tea', path: ['和菓子をください。'], say: '友達のミオさんにあげます。', want: 'name_friend' },
  { id: 'aiko_tea', path: ['和菓子をください。'], say: '自分用です。', want: 'for_me' },
  { id: 'aiko_tea', path: ['和菓子をください。', '自分用です。'], say: '包まなくていいです。', want: 'no_wrap' },
  { id: 'aiko_tea', path: ['和菓子をください。', '自分用です。'], say: 'リボンは赤でお願いします。', want: 'pick_ribbon' },
  // Hikari Denki: a phone, the cheaper one, the colour, buying, too expensive
  { id: 'denki_phone', path: [], say: 'スマホがほしいです。', want: 'want_phone' },
  { id: 'denki_phone', path: [], say: '新しい携帯を探しています。', want: 'want_phone' },
  { id: 'denki_phone', path: ['スマホがほしいです。'], say: 'どちらが安いですか？', want: 'ask_cheaper' },
  { id: 'denki_phone', path: ['スマホがほしいです。'], say: '中古のスマホはいくらですか？', want: 'ask_price_used' },
  { id: 'denki_phone', path: ['スマホがほしいです。', '中古スマホをください。'], say: '黒がいいです。', want: 'pick_colour' },
  { id: 'denki_phone', path: ['スマホがほしいです。', '中古スマホをください。', '黒でお願いします。'], say: 'これにします。', want: 'buy' },
  { id: 'denki_phone', path: ['スマホがほしいです。', '中古スマホをください。', '黒でお願いします。'], say: 'ちょっと高いですね。', want: 'too_dear' },
  // Fuku-Fuku: a piece, the size, trying it on
  { id: 'fuku_clothes', path: [], say: 'Tシャツを探しています。', want: 'choose_clothes' },
  { id: 'fuku_clothes', path: [], say: 'パーカーはありますか？', want: 'choose_clothes' },
  { id: 'fuku_clothes', path: ['Tシャツをください。'], say: 'Mサイズでお願いします。', want: 'size_pick' },
  { id: 'fuku_clothes', path: ['Tシャツをください。'], say: 'Lサイズがいいです。', want: 'size_pick' },
  { id: 'fuku_clothes', path: ['Tシャツをください。', 'Mサイズでお願いします。', 'はい、いいです。'], say: '試着してもいいですか？', want: 'ask_try' },
  // Nakamura Motors: a bicycle, what for, buying, haggling
  { id: 'motors_bike', path: [], say: '自転車がほしいです。', want: 'want_bike' },
  { id: 'motors_bike', path: [], say: '自転車を探しています。', want: 'want_bike' },
  { id: 'motors_bike', path: ['自転車がほしいです。'], say: '買い物に使います。', want: 'pick_purpose' },
  { id: 'motors_bike', path: ['自転車がほしいです。', '買い物に使います。'], say: 'ママチャリはいくらですか？', want: 'ask_price_bike' },
  { id: 'motors_bike', path: ['自転車がほしいです。', '買い物に使います。', 'ママチャリをください。'], say: 'もう少し安くなりませんか？', want: 'too_dear' },
  { id: 'motors_bike', path: ['自転車がほしいです。', '買い物に使います。', 'ママチャリをください。'], say: 'これにします。', want: 'buy' },
];

function at(id: string, path: string[]): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1: 'en', profileName: 'レイラ', topics: [], now: () => (t += 4000) });
  s.start();
  for (const line of path) {
    const r = s.submit({ text: line, mode: 'typed_ja' });
    if (!r.learner.matched) throw new Error(`${id}: the path line "${line}" was not understood at ${s.nodeId}`);
  }
  return s;
}

describe('more ways to say each request', () => {
  for (const c of CASES) {
    it(`${c.id}${c.path.length ? ` after ${c.path.join(' / ')}` : ''}: 「${c.say}」 is ${c.want}`, () => {
      const s = at(c.id, c.path);
      const node = s.nodeId;
      const r = s.submit({ text: c.say, mode: 'typed_ja' });
      expect(r.learner.matched, `not understood at ${node}`).toBe(true);
      expect(r.learner.intentId, `at ${node}`).toBe(c.want);
    });
  }
});
