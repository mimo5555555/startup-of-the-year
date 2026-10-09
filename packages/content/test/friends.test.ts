// The friends of Release 1 (agent 4A, docs/GAME_DESIGN.md §8): the six FriendDefs, their gift tastes, profile facts, perks and Mio's heart-2
// beat. The pack must be consistent (every taste names a released, buyable thing; no item is both loved and disliked), every friend must be
// reachable (a small-talk scenario, a present to love) and every Japanese line must use words of the lexicon with EN and AR.
import { describe, expect, it } from 'vitest';
import { BALANCE, giftInfo, heartsForAp, reactionFor, validatePack, type ValidationIssue as Issue } from '../../game/src';
import { CHARACTERS, JP_PACK, LEXICON, scenarioById, tokenize } from '../src';
import { FRIENDS_BEATS } from '../src/tokyo/game/beats/beats-friends';
import { KEEPSAKES, TASTES } from '../src/tokyo/game/gifts';
import { FREE_WALK } from '../src/tokyo/game/chapters';
import { SMALLTALK_FRIENDS } from '../src/tokyo/scenarios-social';

const hasAr = (s: string) => /[؀-ۿ]/.test(s);
const ids = ['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako'];
/** §8.4: the profile facts, in heart order */
const FACTS: Record<string, string[]> = {
  mio: ['likes_anime', 'photo_sakura', 'lives_alone'],
  yuki: ['guitar', 'cat', 'dream_live'],
  tanaka: ['games_night', 'sleepy', 'dream_game'],
  sato: ['thirty_years', 'old_trains', 'grandson'],
  kenji: ['broth', 'baseball', 'daughter_hina'],
  hanako: ['teach_songs', 'calligraphy', 'letters'],
};
const friend = (id: string) => JP_PACK.friends.find((f) => f.id === id)!;
const errorsAt = (issues: Issue[], re: RegExp) => issues.filter((i) => i.severity === 'error' && re.test(i.path));

/** the gift-able things the released shops sell: catalog gifts and the giftable menu rows, by id and by the menu's bare option */
const GIFTABLE = [
  ...JP_PACK.items.filter((i) => giftInfo(JP_PACK, i.id)?.giftable).map((i) => ({ id: i.id, shop: i.shop, opens: i.gate.ch })),
  ...JP_PACK.menu.filter((m) => giftInfo(JP_PACK, m.id)?.giftable).map((m) => ({ id: m.id, shop: m.shop, opens: JP_PACK.shops.find((s) => s.id === m.shop)?.openChapter ?? 99 })),
];

describe('the friends table', () => {
  it('lists the six friends of the release, all registered characters with a small-talk scenario', () => {
    expect(JP_PACK.friends.map((f) => f.id).sort()).toEqual([...ids].sort());
    expect([...SMALLTALK_FRIENDS].sort()).toEqual([...ids].sort());
    for (const f of JP_PACK.friends) {
      expect(CHARACTERS.some((c) => c.id === f.id), f.id).toBe(true);
      expect(scenarioById(`smalltalk_${f.id}`), f.id).toBeDefined();
      expect(JP_PACK.scenarioMeta.some((m) => m.id === `smalltalk_${f.id}` && m.kind === 'talk' && m.friendId === f.id), f.id).toBe(true);
      expect(f.unlockChapter, `${f.id} is in the street before the Friends screen opens (Chapter 3)`).toBeLessThanOrEqual(3);
    }
  });

  it('speaks to the player the way §8.1 says', () => {
    expect(ids.map((id) => [id, friend(id).register, friend(id).casualAt])).toEqual([
      ['mio', 'polite', 2],
      ['yuki', 'polite', 3],
      ['tanaka', 'polite', 99],
      ['kenji', 'polite', 3],
      ['sato', 'keigo', 99],
      ['hanako', 'polite', 99],
    ]);
  });

  it('passes the pack validator without an error on any friend, taste or perk', () => {
    const issues = validatePack(JP_PACK, { level: 5 });
    expect(errorsAt(issues, /^friends/)).toEqual([]);
    // an unreleased item in a taste list would be a warning "unknown item": the lists name released ids only
    expect(issues.filter((i) => i.code === 'taste_unknown' || i.code === 'taste')).toEqual([]);
  });
});

describe('gift tastes', () => {
  it('has a taste table for exactly the friends of the pack, and the pack uses it', () => {
    expect(Object.keys(TASTES).sort()).toEqual([...ids].sort());
    for (const id of ids) expect({ loves: friend(id).loves, likes: friend(id).likes, dislikes: friend(id).dislikes }).toEqual(TASTES[id]);
  });

  it('never loves and dislikes the same item, and never lists an item twice', () => {
    for (const id of ids) {
      const t = TASTES[id]!;
      for (const x of t.loves) expect(t.dislikes, `${id} ${x}`).not.toContain(x);
      for (const list of [t.loves, t.likes, t.dislikes]) expect(new Set(list).size, id).toBe(list.length);
    }
  });

  it('names only things a shop of the release sells', () => {
    const known = new Set(GIFTABLE.flatMap((g) => [g.id, JP_PACK.menu.find((m) => m.id === g.id)?.option ?? g.id]));
    for (const id of ids) for (const x of [...TASTES[id]!.loves, ...TASTES[id]!.dislikes]) expect(known.has(x), `${id}: ${x}`).toBe(true);
  });

  it('gives every friend a present they love that is on sale by Free Walk', () => {
    for (const id of ids) {
      const loved = GIFTABLE.filter((g) => reactionFor(JP_PACK, id, g.id) === 'loved');
      expect(loved.length, `${id} loves nothing that is sold`).toBeGreaterThan(0);
      expect(Math.min(...loved.map((g) => g.opens)), id).toBeLessThanOrEqual(FREE_WALK);
    }
  });

  it('lets every friend be given a konbini present they like or love (Chapter 3 buys the gift there)', () => {
    const konbini = GIFTABLE.filter((g) => g.shop === 'konbini');
    for (const id of ids) {
      const r = konbini.map((g) => reactionFor(JP_PACK, id, g.id));
      expect(r.some((x) => x === 'loved' || x === 'liked'), id).toBe(true);
    }
    // Mio, the Chapter 3 friend: her loved manga is at the konbini, and the gift is worth a heart
    expect(reactionFor(JP_PACK, 'mio', 'g_manga')).toBe('loved');
    expect(reactionFor(JP_PACK, 'mio', 'konbini:cake')).toBe('loved');
    expect(reactionFor(JP_PACK, 'mio', 'cafe:cake')).toBe('loved');
  });

  it('keeps the four reactions of §8.5 reachable overall and every reaction gentle (a dislike is 0 AP, never negative)', () => {
    const seen = new Set<string>();
    for (const id of ids) for (const g of GIFTABLE) seen.add(reactionFor(JP_PACK, id, g.id));
    expect([...seen].sort()).toEqual(['disliked', 'liked', 'loved', 'neutral']);
    expect(BALANCE.ap.giftTaste.disliked).toBe(0);
  });

  it('puts the humour dislikes of §8.5 on the friends who have them: Tanaka on his shelf food, Yuki on coffee', () => {
    expect(reactionFor(JP_PACK, 'tanaka', 'konbini:onigiri')).toBe('disliked');
    expect(reactionFor(JP_PACK, 'tanaka', 'konbini:bento')).toBe('disliked');
    expect(reactionFor(JP_PACK, 'yuki', 'konbini:coffee')).toBe('disliked');
  });
});

describe('profile facts', () => {
  it('has the three facts of §8.4 per friend, each with a sentence in Japanese, English and Arabic', () => {
    for (const id of ids) {
      const f = friend(id);
      expect(f.facts, id).toEqual(FACTS[id]);
      expect(Object.keys(f.factLines ?? {}).sort(), id).toEqual([...f.facts].sort());
      for (const k of f.facts) {
        const l = f.factLines![k]!;
        expect(l.en.trim() && hasAr(l.ar) && l.ja.trim(), `${id}.${k}`).toBeTruthy();
      }
    }
  });

  it('writes every fact sentence with words of the lexicon', () => {
    const bad: string[] = [];
    for (const f of JP_PACK.friends) {
      for (const [k, l] of Object.entries(f.factLines!)) {
        const { missing } = tokenize(l.ja, LEXICON);
        if (missing.length) bad.push(`${f.id}.${k}: ${missing.join(' ')}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('reveals the facts in the small-talk follow nodes on the flags the host sets (rev_<id>)', () => {
    for (const id of ids) {
      const sc = scenarioById(`smalltalk_${id}`)!;
      const flags = new Set(Object.values(sc.nodes).flatMap((n) => (Array.isArray(n.say) ? n.say.flatMap((v) => (v.when && 'flag' in v.when ? [v.when.flag] : [])) : [])));
      for (const k of FACTS[id]!) expect(flags.has(`rev_${k}`), `${id} ${k}`).toBe(true);
    }
  });
});

describe('perks', () => {
  it('uses unique ids, hearts 1-5 and only the shop discounts the 8% rule allows', () => {
    const all = JP_PACK.friends.flatMap((f) => f.perks.map((p) => ({ friend: f.id, ...p })));
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const p of all) {
      expect(p.heart).toBeGreaterThanOrEqual(1);
      expect(p.heart).toBeLessThanOrEqual(5);
      expect(p.text.en.trim() && hasAr(p.text.ar), p.id).toBeTruthy();
    }
    for (const f of JP_PACK.friends) {
      const pct = new Map<string, number>();
      for (const p of f.perks) if (p.fx.t === 'shop_pct') pct.set(p.fx.shopId, (pct.get(p.fx.shopId) ?? 0) + p.fx.pct);
      for (const [shop, sum] of pct) expect(sum, `${f.id} ${shop}`).toBeLessThanOrEqual(BALANCE.routineDiscountMax + 1e-9);
    }
  });

  it('gives every friend a ♥3 present that exists, and Hanako her one-time scholarship at ♥5', () => {
    for (const f of JP_PACK.friends) {
      const gift = f.perks.find((p) => p.heart === 3);
      expect(gift?.fx.t, f.id).toBe('once_item');
    }
    expect(friend('hanako').perks.find((p) => p.id === 'hanako_scholarship')).toMatchObject({ heart: 5, fx: { t: 'once_cash', amount: 3000 } });
  });
});

describe("Mio's heart-2 beat (b_mio_h2)", () => {
  const beat = FRIENDS_BEATS.b_mio_h2!;

  it('is registered in the pack and named by the heart-2 event of Mio', () => {
    expect(JP_PACK.beats.b_mio_h2).toBe(beat);
    expect(friend('mio').events).toEqual([{ heart: 2, beat: 'b_mio_h2' }]);
  });

  it('says the four lines of §7.2, in Mio\'s voice, with EN and AR and words of the lexicon', () => {
    expect(beat.lines).toHaveLength(4);
    const text = beat.lines.map((l) => tokenize(l.line.ja, LEXICON).tokens.map((t) => t.s).join(''));
    expect(text).toEqual(['電話番号を教えてください。', 'あ、まだスマホがないですか？じゃあ、これ。', 'わたしの番号です。メモを見てください。', '敬語はやめよう！タメ口でいい？']);
    const bad: string[] = [];
    beat.lines.forEach((l, i) => {
      if (l.who !== 'mio') bad.push(`${i}: speaker ${l.who}`);
      if (!l.line.en.trim() || !hasAr(l.line.ar)) bad.push(`${i}: EN/AR`);
      const { missing } = tokenize(l.line.ja, LEXICON);
      if (missing.length) bad.push(`${i}: not in the lexicon: ${missing.join(' ')}`);
    });
    expect(bad).toEqual([]);
  });

  it('sets the number-note and casual friend flags, hands over the note and unlocks the keigo card', () => {
    expect(beat.effects).toEqual([
      { t: 'friendFlag', friend: 'mio', id: 'number_note' },
      { t: 'friendFlag', friend: 'mio', id: 'casual' },
      { t: 'keepsake', id: 'note_mio' },
      { t: 'culture', id: 'cc_keigo' },
    ]);
    expect(KEEPSAKES.note_mio.en && hasAr(KEEPSAKES.note_mio.ar)).toBeTruthy();
    expect(JP_PACK.culture.some((c) => c.id === 'cc_keigo')).toBe(true);
  });
});

describe('the pace of friendship', () => {
  it('cannot reach 5 hearts before day 6 whatever the gifts: the daily cap binds every source together', () => {
    const top = BALANCE.ap.thresholds.at(-1)!;
    expect(BALANCE.ap.dailyCap * 5).toBeLessThan(top);
    expect(heartsForAp(top)).toBe(5);
    // even the richest present is under the cap, so the cap and not the taste table sets the pace
    const richest = Math.max(...BALANCE.ap.giftTiers.map((t) => t.ap), BALANCE.ap.giftTierTop) * BALANCE.ap.giftTaste.loved;
    expect(Math.min(richest, BALANCE.ap.giftCapMax)).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
  });
});
