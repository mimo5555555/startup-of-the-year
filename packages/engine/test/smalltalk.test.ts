// Small talk a shopkeeper starts (tokyo/smalltalk.ts): with `talk_<season>` every shop in SHOP_TALK opens with its hello and the season's
// remark and question, shows the yes and no chips, understands both (and an answer in your own words), replies warmly and goes back to
// the shop's own question; the chips go once answered and the shop's own chips work again. A shop whose own opening asks about liking
// something (Daichi: 「フィギュア、好きですか？」) still takes a 「好きです」 as the answer to the small talk while it is on.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, SEASONS, SEASON_TALK, SHOP_TALK, scenarioById, type L1 } from '@lw/content';
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

describe('small talk about the season', () => {
  it('covers every shop that greets a regular, but the festival stall and the talk after the bath (they open with their own question)', () => {
    expect(Object.keys(SHOP_TALK).sort()).toEqual(
      ['aiko_tea', 'arcade_crane', 'cafe', 'denki_phone', 'fuku_clothes', 'fuku_home', 'hobby_figures', 'karaoke_desk', 'konbini', 'motors_bike', 'motors_car', 'ramen', 'sento_desk', 'station_ic'].sort(),
    );
  });

  for (const id of Object.keys(SHOP_TALK)) {
    for (const season of SEASONS) {
      it(`${id}, ${season}: the remark, the chips, a yes back to business, the shop's own chips after`, () => {
        const shop = SHOP_TALK[id]!;
        const talk = SEASON_TALK[season];
        const s = open(id, { regular: true, [`talk_${season}`]: true }, season === 'autumn' ? 'ar' : 'en');
        expect(flat(first.get(s)!.line.written)).toBe(bare(shop.hello.ja) + bare((shop.plain ? talk.plain : talk.polite).ja));
        const chips = s.suggestions().map((c) => c.written);
        expect(chips.slice(0, 2)).toEqual([bare(talk.yes.ja), bare(talk.no.ja)]);
        const yes = s.pickSuggestion(0);
        expect(yes.learner.intentId).toBe(`talk_yes_${season}`);
        expect(flat(yes.character.line.written)).toBe(`いいですね！${bare(shop.ask.ja)}`);
        expect(s.nodeId).toBe(scenarioById(id)!.start);
        const after = s.suggestions().map((c) => c.written);
        expect(after).not.toContain(bare(talk.yes.ja));
        const next = s.pickSuggestion(0);
        expect(next.learner.matched, `${id}: the shop's own first chip after the small talk`).toBe(true);
        expect(next.character.kind).not.toBe('fallback');
      });
    }
    it(`${id}: a no gets the season's kind answer, and your own words work both ways`, () => {
      const shop = SHOP_TALK[id]!;
      const no = open(id, { talk_summer: true }).pickSuggestion(1);
      expect(no.learner.intentId).toBe('talk_no_summer');
      expect(flat(no.character.line.written)).toBe(bare(SEASON_TALK.summer.noReply.ja) + bare(shop.ask.ja));
      expect(open(id, { talk_winter: true }).submit({ text: '冬は大好きです！', mode: 'typed_ja' }).learner.intentId).toBe('talk_yes_winter');
      expect(open(id, { talk_winter: true }).submit({ text: '寒いのはちょっと苦手です。', mode: 'typed_ja' }).learner.intentId).toBe('talk_no_winter');
      expect(open(id, { talk_autumn: true }).submit({ text: '夏の方が好きです。', mode: 'typed_ja' }).learner.intentId).toBe('talk_no_autumn');
    });
  }

  it('a remembered purchase comes first when both are on; the regular greeting only when neither is', () => {
    const both = open('cafe', { regular: true, remembers: true, talk_spring: true });
    expect(flat(first.get(both)!.line.written)).toContain('前回');
    const talk = open('cafe', { regular: true, talk_spring: true });
    expect(flat(first.get(talk)!.line.written)).toContain('桜');
    const regular = open('cafe', { regular: true });
    expect(flat(first.get(regular)!.line.written)).toContain('また来てくれた');
  });
});
