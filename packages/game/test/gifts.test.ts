import { describe, expect, it } from 'vitest';
import { applyGift, applyTalk, BALANCE, emptyFriend, friendActions, giftAp, giftCap, giftInfo, grantItem, heartsForAp, ownedQty, reactionFor } from '@lw/game';
import type { FriendState, GameState, GiftReaction } from '@lw/game';
import { ctxOf, lcg, makeFacts, makePack, makeState } from './fixtures-1e';

const pack = makePack();
const ctx = ctxOf(pack);
const TH = [0, ...BALANCE.ap.thresholds];
const GIFT_IDS = [...pack.items.filter((i) => giftInfo(pack, i.id)?.giftable).map((i) => i.id), ...pack.menu.map((m) => m.id)];

/** A state where `id` has `ap`, has been talked to today (unless `talked` is false) and the player holds one `item`. */
function setup(item: string, o: { friend?: string; ap?: number; talked?: boolean; patch?: Partial<FriendState>; stock?: number } = {}): GameState {
  const id = o.friend ?? 'mio';
  let s = makeState(10);
  s = {
    ...s,
    friends: { [id]: { ...emptyFriend(10), met: true, ap: o.ap ?? 0, ...(o.talked === false ? {} : { talkDay: 10 }), ...(o.patch ?? {}) } },
  };
  return grantItem(s, pack, item, o.stock ?? 1, 'd1');
}
const give = (s: GameState, item: string, o: { friend?: string; assisted?: boolean; bare?: boolean; session?: string } = {}) =>
  applyGift(s, { t: 'gift_given', friendId: o.friend ?? 'mio', itemId: item, sessionId: o.session ?? 'g1', assistedHandover: o.assisted ?? false, ...(o.bare ? { bare: true } : {}) }, ctx);

describe('reactionFor (§8.5 taste table)', () => {
  it('loved: an item id, or a menu item by its bare option', () => {
    expect(reactionFor(pack, 'mio', 'g_manga')).toBe('loved');
    expect(reactionFor(pack, 'mio', 'cafe:cake')).toBe('loved');
    expect(reactionFor(pack, 'tanaka', 'cafe:coffee')).toBe('loved');
    expect(reactionFor(pack, 'hanako', 'g_tea_set')).toBe('loved');
  });

  it('liked: any tag the friend likes', () => {
    expect(reactionFor(pack, 'mio', 'g_choco')).toBe('liked'); // sweet
    expect(reactionFor(pack, 'mio', 'g_plush')).toBe('liked'); // cute
    expect(reactionFor(pack, 'mio', 'g_music_cd')).toBe('liked'); // music
    expect(reactionFor(pack, 'tanaka', 'cafe:cake')).toBe('liked'); // sweet
  });

  it('disliked: an explicit dislike, by option or by id, beats a liked tag', () => {
    expect(reactionFor(pack, 'mio', 'cafe:coffee')).toBe('disliked');
    expect(reactionFor(pack, 'tanaka', 'konbini:onigiri')).toBe('disliked');
    expect(reactionFor(pack, 'tanaka', 'konbini:bento')).toBe('disliked');
    expect(reactionFor(pack, 'yuki', 'g_game_card')).toBe('disliked');
    // a dislike wins over a liked tag: mio likes `sweet`, so a chocolate she dislikes by name is still disliked
    const odd = { ...pack, friends: pack.friends.map((f) => (f.id === 'mio' ? { ...f, dislikes: ['g_choco'] } : f)) };
    expect(reactionFor(odd, 'mio', 'g_choco')).toBe('disliked');
  });

  it('neutral: anything else, unknown friends and unknown items', () => {
    expect(reactionFor(pack, 'mio', 'konbini:onigiri')).toBe('neutral');
    expect(reactionFor(pack, 'mio', 'g_tea_set')).toBe('neutral');
    expect(reactionFor(pack, 'nobody', 'g_manga')).toBe('neutral');
    expect(reactionFor(pack, 'mio', 'nope')).toBe('neutral');
  });

  it('a bare option is also accepted as an item id', () => {
    expect(reactionFor(pack, 'mio', 'coffee')).toBe('disliked');
    expect(reactionFor(pack, 'tanaka', 'coffee')).toBe('loved');
  });

  it('no item is both loved and disliked by one friend (data check on the pack)', () => {
    for (const f of pack.friends) {
      expect(f.loves.filter((l) => f.dislikes.includes(l)), f.id).toEqual([]);
      for (const id of GIFT_IDS) {
        const r = reactionFor(pack, f.id, id);
        const menu = pack.menu.find((m) => m.id === id);
        const names = (l: string[]) => l.includes(id) || (menu && l.includes(menu.option));
        if (names(f.loves)) expect(r, `${f.id} ${id}`).toBe('loved');
        if (names(f.dislikes)) expect(r, `${f.id} ${id}`).toBe('disliked');
      }
    }
  });
});

describe('giftCap (§8.5)', () => {
  it('is 12 / 20 / 28 / 30 / 30 at hearts 0..4 and nothing at the last heart', () => {
    expect([0, 1, 2, 3, 4].map(giftCap)).toEqual([12, 20, 28, 30, 30]);
    expect(giftCap(5)).toBe(0);
    expect(giftCap(-1)).toBe(12);
  });

  it('is 40% of the gap to the next heart, at most 30', () => {
    for (let h = 0; h < 5; h++) {
      const gap = TH[h + 1]! - TH[h]!;
      expect(giftCap(h)).toBe(Math.min(BALANCE.ap.giftCapMax, Math.round(BALANCE.ap.giftCapFrac * gap)));
    }
  });
});

describe('gift AP: tier x taste, capped, then the softeners', () => {
  const ap = (item: string, o: Parameters<typeof setup>[1] = {}, g: Parameters<typeof give>[2] = {}) => give(setup(item, o), item, { friend: o.friend, ...g }).ap;

  it('tiers by price: < 500 -> 6, < 1,500 -> 10, < 3,000 -> 15, else 20', () => {
    // neutral for sato (no loves/likes among them), so AP = the tier; at 3 hearts the cap does not bite
    const tier = (item: string) => ap(item, { friend: 'tanaka', ap: TH[3] }) ;
    expect(giftInfo(pack, 'g_choco')!.price).toBeLessThan(500);
    expect(tier('g_tenugui')).toBe(10); // 1,100 neutral for tanaka
    expect(tier('g_tea_set')).toBe(15); // 1,500: not under 1,500
    expect(tier('konbini:tea')).toBe(6);
  });

  it('taste: loved x2, liked x1.5, neutral x1, disliked 0 (and the gift is still taken)', () => {
    const o = { ap: TH[3] }; // cap 30 leaves room
    expect(ap('g_manga', o)).toBe(20); // 10 x 2
    expect(ap('g_choco', o)).toBe(9); // 6 x 1.5
    expect(ap('konbini:onigiri', o)).toBe(6); // neutral
    expect(ap('cafe:coffee', o)).toBe(0); // disliked
    const r = give(setup('cafe:coffee', o), 'cafe:coffee');
    expect(r.reaction).toBe('disliked');
    expect(r.state.friends.mio!.gifts).toBe(1);
    expect(ownedQty(r.state, 'cafe:coffee')).toBe(0);
  });

  it('is capped by the heart: a loved gift at 0 hearts gives 12, at 2 hearts 28, at 3-4 hearts 30', () => {
    expect(ap('g_manga', { ap: 0 })).toBe(12);
    expect(ap('g_music_cd', { ap: TH[2] })).toBe(28); // 20 x 1.5 = 30 -> 28
    expect(ap('g_music_cd', { ap: TH[3] })).toBe(30);
    expect(ap('g_music_cd', { ap: TH[4] })).toBe(30);
  });

  it('a bare or assisted hand-over is x0.5', () => {
    expect(ap('g_manga', { ap: TH[3] }, { bare: true })).toBe(10);
    expect(ap('g_manga', { ap: TH[3] }, { assisted: true })).toBe(10);
    expect(ap('g_manga', { ap: TH[3] }, { assisted: true, bare: true })).toBe(10);
  });

  it('x0.5 more on a day with no talk with that friend', () => {
    expect(ap('g_manga', { ap: TH[3], talked: false })).toBe(10);
    expect(ap('g_manga', { ap: TH[3], talked: false }, { bare: true })).toBe(5);
    // a hang-out counts as a talk, a phone chat does not
    expect(ap('g_manga', { ap: TH[3], talked: false, patch: { hangoutDay: 10 } })).toBe(20);
    expect(ap('g_manga', { ap: TH[3], talked: false, patch: { chatDay: 10, chatApToday: 4, apDay: 10 } })).toBe(10);
  });

  it('the same item to the same friend within 7 days is x0.25', () => {
    const base = { ap: TH[3], patch: { giftHistory: [{ item: 'g_manga', day: 4 }] } };
    expect(ap('g_manga', base)).toBe(5); // 6 days later: 20 x 0.25
    expect(ap('g_manga', { ap: TH[3], patch: { giftHistory: [{ item: 'g_manga', day: 3 }] } })).toBe(20); // 7 days later: back to normal
    expect(ap('g_choco', base)).toBe(9); // another item is fine
    expect(ap('g_manga', { ap: TH[3], friend: 'tanaka' })).toBe(20); // history is per friend: tanaka has none
  });

  it('rounds once at the end and never goes below 0', () => {
    expect(ap('g_choco', { ap: 0, talked: false }, { bare: true })).toBe(Math.round(6 * 1.5 * 0.25));
    expect(ap('konbini:onigiri', { ap: 0, talked: false, patch: { giftHistory: [{ item: 'konbini:onigiri', day: 9 }] } }, { bare: true })).toBe(0);
  });

  it('the 60 a day cap still applies on top', () => {
    const r = give(setup('g_manga', { ap: TH[3], patch: { apDay: 10, apToday: 55 } }), 'g_manga');
    expect(r.ap).toBe(5);
    expect(r.state.friends.mio!.apToday).toBe(60);
  });

  it('giftAp previews exactly what applyGift pays (before the daily cap), 0 when it would be refused', () => {
    for (const hearts of [0, 1, 2, 3, 4]) {
      for (const item of GIFT_IDS) {
        for (const assisted of [false, true]) {
          const s = setup(item, { ap: TH[hearts], talked: hearts % 2 === 0 });
          expect(giftAp(pack, s, 'mio', item, assisted), `${item} ♥${hearts}`).toBe(give(s, item, { assisted }).ap);
        }
      }
    }
    expect(giftAp(pack, setup('phone_used'), 'mio', 'phone_used', false)).toBe(0);
    expect(giftAp(pack, setup('g_manga', { patch: { giftDay: 10 } }), 'mio', 'g_manga', false)).toBe(0);
    expect(giftAp(pack, setup('g_manga'), 'nobody', 'g_manga', false)).toBe(0);
  });
});

describe('applyGift: the hand-over', () => {
  it('takes the item, records the gift and derives the reaction and hearts', () => {
    const s = setup('g_choco', { ap: TH[1] - 5 });
    const r = give(s, 'g_choco');
    expect(r.reaction).toBe('liked');
    expect(r.ap).toBe(9);
    expect(r.hearts).toEqual({ from: 0, to: 1 });
    expect(ownedQty(r.state, 'g_choco')).toBe(0);
    expect(r.state.friends.mio).toMatchObject({ ap: TH[1] + 4, giftDay: 10, gifts: 1, giftsLiked: 1, giftsLoved: 0, giftHistory: [{ item: 'g_choco', day: 10 }], lastContactDay: 10 });
    expect(r.state.stats.gifts).toEqual({ n: 1, liked: 1, loved: 0 });
    expect(r.derived).toEqual([
      { t: 'hearts_changed', friendId: 'mio', from: 0, to: 1 },
      { t: 'gift_reacted', friendId: 'mio', itemId: 'g_choco', reaction: 'liked', ap: 9 },
    ]);
    expect(r.effects).toEqual([{ t: 'fanfare', kind: 'heart' }]);
  });

  it('counts liked-or-loved and loved separately (the `gift` predicate reads them)', () => {
    let s = setup('g_manga', { stock: 3 });
    s = give(s, 'g_manga', { session: 'a' }).state; // loved
    s = { ...s, clock: { ...s.clock, dayIndex: 11 } };
    s = give(s, 'g_manga', { session: 'b' }).state; // loved again
    s = { ...s, clock: { ...s.clock, dayIndex: 12 } };
    s = give({ ...s, owned: { ...s.owned, g_choco: { qty: 1, day: 'd1' } } }, 'g_choco', { session: 'c' }).state; // liked
    expect(s.stats.gifts).toEqual({ n: 3, liked: 3, loved: 2 });
    expect(s.friends.mio).toMatchObject({ gifts: 3, giftsLiked: 3, giftsLoved: 2 });
  });

  it('one AP gift per friend per day: the second changes nothing and keeps the item', () => {
    const s0 = setup('g_manga', { stock: 2 });
    const a = give(s0, 'g_manga', { session: 'a' });
    expect(a.ap).toBeGreaterThan(0);
    const b = give(a.state, 'g_manga', { session: 'b' });
    expect(b.state).toBe(a.state);
    expect(b.ap).toBe(0);
    expect(b.derived).toEqual([]);
    expect(ownedQty(b.state, 'g_manga')).toBe(1);
    // another friend, same day, is a separate allowance
    const c = give({ ...a.state, friends: { ...a.state.friends, tanaka: { ...emptyFriend(10), talkDay: 10 } } }, 'g_manga', { friend: 'tanaka', session: 'c' });
    expect(c.state.friends.tanaka!.gifts).toBe(1);
    // and tomorrow is open again
    const d = give({ ...a.state, clock: { ...a.state.clock, dayIndex: 11 } }, 'g_manga', { session: 'd' });
    expect(d.state.friends.mio!.gifts).toBe(2);
  });

  it('only what the player owns can be given', () => {
    const s = makeState(10);
    const r = give(s, 'g_manga');
    expect(r.state).toBe(s);
    expect(r.ap).toBe(0);
    expect(r.reaction).toBe('loved');
  });

  it('only gifts: a phone, a card, a vending drink and unknown ids are refused', () => {
    for (const item of ['phone_used', 'ic_card', 'vending:greenTea', 'nope']) {
      const s = { ...setup('g_manga'), owned: { ...setup('g_manga').owned, [item]: { qty: 1, day: 'd1' } } };
      const r = give(s, item);
      expect(r.state, item).toBe(s);
    }
  });

  it('an unknown friend changes nothing', () => {
    const s = setup('g_manga');
    expect(give(s, 'g_manga', { friend: 'nobody' }).state).toBe(s);
  });

  it('gifts are bought in conversations: a gift never needs yen and never moves any', () => {
    const s = setup('g_manga');
    const r = give(s, 'g_manga');
    expect(r.state.wallet).toEqual(s.wallet);
    expect(r.state.ledger).toEqual(s.ledger);
  });

  it('friendActions reflects the daily allowance after a gift', () => {
    const r = give(setup('g_manga'), 'g_manga');
    expect(friendActions(pack, r.state, ctx.view, 'mio').gift).toBe(false);
    expect(friendActions(pack, r.state, ctx.view, 'mio').giftNotes).toContain('daily');
  });

  it('never mutates its input', () => {
    const s = setup('g_manga');
    const before = JSON.stringify(s);
    give(s, 'g_manga');
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('property: gift caps', () => {
  it('AP <= giftCap(hearts) <= 30, softeners only lower it, a dislike is 0, hearts never fall', () => {
    const rnd = lcg(99);
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    for (let i = 0; i < 1500; i++) {
      const friend = pick(pack.friends.map((f) => f.id));
      const item = pick(GIFT_IDS);
      const hearts = Math.floor(rnd() * 6);
      const ap0 = TH[hearts]! + Math.floor(rnd() * ((TH[hearts + 1] ?? TH[5]! + 50) - TH[hearts]!));
      const day = 10 + Math.floor(rnd() * 10);
      const patch: Partial<FriendState> = {
        giftHistory: rnd() < 0.4 ? [{ item, day: day - Math.floor(rnd() * 9) }] : [],
        ...(rnd() < 0.5 ? { talkDay: day } : {}),
      };
      let s = setup(item, { friend, ap: ap0, patch });
      s = { ...s, clock: { ...s.clock, dayIndex: day } };
      const full = give(s, item, { friend }).ap;
      const soft = give(s, item, { friend, assisted: true }).ap;
      const cap = giftCap(heartsForAp(ap0));
      expect(full).toBeGreaterThanOrEqual(0);
      expect(full).toBeLessThanOrEqual(Math.min(cap, BALANCE.ap.giftCapMax));
      expect(soft).toBeLessThanOrEqual(full);
      const reaction: GiftReaction = reactionFor(pack, friend, item);
      if (reaction === 'disliked') expect(full).toBe(0);
      const r = give(s, item, { friend });
      expect(r.hearts.to).toBeGreaterThanOrEqual(r.hearts.from);
      expect(r.state.friends[friend]!.ap).toBe(ap0 + r.ap);
    }
  });
});

describe('gifts through the talk path', () => {
  it('a talk after a gift on the same day still pays (a gift is not the day\'s talk)', () => {
    const s = setup('g_manga', { talked: false });
    const g = give(s, 'g_manga');
    expect(g.ap).toBe(6); // 12 capped, x0.5 for no talk
    const t = applyTalk(g.state, 'mio', makeFacts({ ind: 3 }), 'talk', ctx);
    expect(t.ap).toBe(9);
  });
});
