// Small talk a shopkeeper starts (tokyo/smalltalk.ts): with `talk_<topic>` (a season, the weekend, the festival, the news of the town) every
// shop in SHOP_TALK opens with its hello and the topic's remark and question, shows the yes and no chips, understands both (and an answer in your own words), replies warmly and goes back to
// the shop's own question; the chips go once answered and the shop's own chips work again. A shop whose own opening asks about liking
// something (Daichi: 「フィギュア、好きですか？」) still takes a 「好きです」 as the answer to the small talk while it is on.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, NEWS_TALK, SEASON_TALK, SHOP_TALK, TALK_TOPICS, scenarioById, topicsOf, type L1 } from '@lw/content';
import { ConversationSession, type Turn } from '../src';

const first = new WeakMap<ConversationSession, Turn>();
function open(id: string, flags: Record<string, boolean>, l1: L1 = 'en'): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), flags: { ...flags } });
  first.set(s, s.start());
  return s;
}
const bare = (ja: string) => ja.replace(/\|/g, '');
const flat = (s: string) => s.replace(/\s/g, '');

describe('small talk', () => {
  it('covers every shop that greets a regular, but the festival stall and the talk after the bath (they open with their own question)', () => {
    expect(Object.keys(SHOP_TALK).sort()).toEqual(
      ['aiko_tea', 'arcade_crane', 'cafe', 'denki_phone', 'fuku_clothes', 'fuku_home', 'hobby_figures', 'karaoke_desk', 'konbini', 'motors_bike', 'motors_car', 'ramen', 'sento_desk', 'station_ic'].sort(),
    );
  });

  it('has the seasons, the weekend, the festival and the news of the town; a place never tells its own news', () => {
    expect(Object.keys(TALK_TOPICS)).toEqual([
      'spring', 'rainy', 'summer', 'autumn', 'winter',
      'weekend_before', 'weekend_now', 'weekend_after',
      'festival_soon', 'festival_today',
      'news_sento', 'news_karaoke', 'news_arcade', 'news_hobby',
    ]);
    for (const [id, n] of Object.entries(NEWS_TALK)) {
      expect(topicsOf(n.scenario), id).not.toContain(id);
      expect(scenarioById(n.scenario), id).toBeDefined();
    }
    expect(topicsOf('cafe')).toHaveLength(Object.keys(TALK_TOPICS).length);
    // every yes chip starts with はい、 (the chips of two topics are never on together, but a shop's own chips are)
    for (const [id, t] of Object.entries(TALK_TOPICS)) expect(bare(t.yes.ja).startsWith('はい、'), id).toBe(true);
  });

  for (const id of Object.keys(SHOP_TALK)) {
    for (const topic of topicsOf(id)) {
      it(`${id}, ${topic}: the remark, the chips, a yes back to business, the shop's own chips after`, () => {
        const shop = SHOP_TALK[id]!;
        const talk = TALK_TOPICS[topic]!;
        const s = open(id, { regular: true, [`talk_${topic}`]: true }, topic === 'autumn' || topic === 'news_hobby' ? 'ar' : 'en');
        expect(flat(first.get(s)!.line.written)).toBe(bare(shop.hello.ja) + bare((shop.plain ? talk.plain : talk.polite).ja));
        const chips = s.suggestions().map((c) => c.written);
        expect(chips.slice(0, 2)).toEqual([bare(talk.yes.ja), bare(talk.no.ja)]);
        const yes = s.pickSuggestion(0);
        expect(yes.learner.intentId).toBe(`talk_yes_${topic}`);
        expect(flat(yes.character.line.written)).toBe(bare(talk.yesReply?.ja ?? 'いいですね！') + bare(shop.ask.ja));
        expect(s.nodeId).toBe(scenarioById(id)!.start);
        const after = s.suggestions().map((c) => c.written);
        expect(after).not.toContain(bare(talk.yes.ja));
        expect(after).not.toContain(bare(talk.no.ja));
        const next = s.pickSuggestion(0);
        expect(next.learner.matched, `${id}: the shop's own first chip after the small talk`).toBe(true);
        expect(next.character.kind).not.toBe('fallback');
      });

      it(`${id}, ${topic}: the no chip gets the topic's kind answer`, () => {
        const no = open(id, { [`talk_${topic}`]: true }).pickSuggestion(1);
        expect(no.learner.intentId).toBe(`talk_no_${topic}`);
        expect(flat(no.character.line.written)).toBe(bare(TALK_TOPICS[topic]!.noReply.ja) + bare(SHOP_TALK[id]!.ask.ja));
      });
    }

    it(`${id}: answers in your own words are understood, both ways`, () => {
      const said = (topic: string, text: string) => open(id, { [`talk_${topic}`]: true }).submit({ text, mode: 'typed_ja' }).learner.intentId;
      const cases: Array<[string, string, 'yes' | 'no']> = [
        ['winter', '冬は大好きです！', 'yes'],
        ['winter', '寒いのはちょっと苦手です。', 'no'],
        ['autumn', '夏の方が好きです。', 'no'],
        ['weekend_before', '友達と遊びに行きます。', 'yes'],
        ['weekend_before', '家で勉強します。', 'no'],
        ['weekend_now', '今日は休みです。', 'yes'],
        ['weekend_now', '今日は仕事です。', 'no'],
        ['weekend_after', 'とても楽しかったです。', 'yes'],
        ['weekend_after', 'ちょっと疲れました。', 'no'],
        ['festival_soon', '行きたいです！', 'yes'],
        ['festival_soon', 'まだわかりません。', 'no'],
        ['festival_today', 'さっき行きました。', 'yes'],
        ['festival_today', '後で行きます。', 'no'],
        ['news_arcade', 'もうやりました。', 'yes'],
        ['news_sento', 'まだ行っていません。', 'no'],
      ];
      for (const [topic, text, want] of cases) {
        if (!topicsOf(id).includes(topic)) continue;
        expect(said(topic, text), `${topic}: ${text}`).toBe(`talk_${want}_${topic}`);
      }
    });
  }

  it('a remembered purchase comes first when both are on; the regular greeting only when neither is', () => {
    const both = open('cafe', { regular: true, remembers: true, talk_spring: true });
    expect(flat(first.get(both)!.line.written)).toContain('前回');
    const talk = open('cafe', { regular: true, talk_spring: true });
    expect(flat(first.get(talk)!.line.written)).toContain('桜');
    const regular = open('cafe', { regular: true });
    expect(flat(first.get(regular)!.line.written)).toContain('また来てくれた');
    expect(Object.keys(SEASON_TALK)).toHaveLength(5);
  });
});

describe('your name', () => {
  for (const id of Object.keys(SHOP_TALK)) {
    it(`${id}: asks once, takes the chip as the answer, says the name back and returns to the shop`, () => {
      const shop = SHOP_TALK[id]!;
      const s = open(id, { regular: true, ask_name: true });
      const opening = flat(first.get(s)!.line.written);
      expect(opening.startsWith(bare(shop.hello.ja))).toBe(true);
      expect(opening.endsWith(shop.plain ? '名前は？' : 'お名前は？')).toBe(true);
      const chips = s.suggestions().map((c) => c.written);
      expect(chips.slice(0, 2)).toEqual(['レイラです。', 'レイラと申します。']);
      const told = s.pickSuggestion(0);
      expect(told.learner.intentId).toBe('tell_name');
      const reply = flat(told.character.line.written);
      expect(reply.startsWith(shop.plain ? 'レイラさんだね。' : 'レイラさんですね。')).toBe(true);
      expect(reply.endsWith(bare(shop.ask.ja))).toBe(true);
      expect(s.nodeId).toBe(scenarioById(id)!.start);
      const after = s.suggestions().map((c) => c.written);
      expect(after).not.toContain('レイラです。');
      const next = s.pickSuggestion(0);
      expect(next.learner.matched, `${id}: the shop's own first chip after the name`).toBe(true);
      expect(next.learner.intentId).not.toBe('tell_name');
    });

    it(`${id}: a real order is still an order while the name is asked; a name is only heard when asked`, () => {
      const asked = open(id, { regular: true, ask_name: true });
      const own = asked.pickSuggestion(2); // the shop's own first chip (after the two name chips)
      expect(own.learner.matched).toBe(true);
      expect(own.learner.intentId, `${id}: ${own.learner.line.written}`).not.toBe('tell_name');
      const notAsked = open(id, { regular: true }).submit({ text: 'サムです。', mode: 'typed_ja' });
      expect(notAsked.learner.intentId).not.toBe('tell_name');
    });

    it(`${id}: greets a known customer by name`, () => {
      const s = open(id, { regular: true, named: true });
      const opening = flat(first.get(s)!.line.written);
      expect(opening.startsWith('レイラさん！')).toBe(true);
      expect(opening.length).toBeGreaterThan('レイラさん！'.length + 4);
    });
  }

  it('takes any way of giving a name, with the name said back; 「二人です」 at the karaoke desk is still two people', () => {
    for (const [text, name] of [['サムです。', 'サム'], ['はい、サムと申します。', 'サム'], ['私はマリアです。', 'マリア'], ['アリといいます。', 'アリ']] as const) {
      const r = open('cafe', { regular: true, ask_name: true }).submit({ text, mode: 'typed_ja' });
      expect(r.learner.intentId, text).toBe('tell_name');
      expect(flat(r.character.line.written).startsWith(`${name}さんですね。`), text).toBe(true);
    }
    const karaoke = open('karaoke_desk', { regular: true, ask_name: true }).submit({ text: '二人です。', mode: 'typed_ja' });
    expect(karaoke.learner.intentId).toBe('people');
    // a bare yes is not a name
    const yes = open('cafe', { regular: true, ask_name: true }).submit({ text: 'はい。', mode: 'typed_ja' });
    expect(yes.learner.intentId).not.toBe('tell_name');
  });
});
