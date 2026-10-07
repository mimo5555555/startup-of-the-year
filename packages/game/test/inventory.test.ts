import { describe, expect, it } from 'vitest';
import {
  ageAllowed,
  applyOutfit,
  avatarPatch,
  BALANCE,
  comfort,
  consumeItem,
  giftInfo,
  grantItem,
  hasFeature,
  HOME_SLOTS,
  ownedQty,
  ownsCategory,
  placeItem,
  rideOf,
  traitValue,
} from '@lw/game';
import type { GameState } from '@lw/game';
import { makePack, makeState } from './fixtures-1e';

const pack = makePack();
const own = (s: GameState, ...ids: string[]): GameState => ids.reduce((acc, id) => grantItem(acc, pack, id, 1, 'd1'), s);

describe('grantItem / ownedQty', () => {
  it('stocks an item with the day it was first acquired', () => {
    const s = grantItem(makeState(), pack, 'cap', 1, 'd3');
    expect(ownedQty(s, 'cap')).toBe(1);
    expect(s.owned.cap).toEqual({ qty: 1, day: 'd3' });
    expect(ownedQty(s, 'nothing')).toBe(0);
  });

  it('is pure and keeps the first day', () => {
    const base = makeState();
    const a = grantItem(base, pack, 'g_choco', 2, 'd3');
    expect(base.owned).toEqual({});
    const b = grantItem(a, pack, 'g_choco', 1, 'd9');
    expect(b.owned.g_choco).toEqual({ qty: 3, day: 'd3' });
  });

  it('a once item never goes above one', () => {
    let s = grantItem(makeState(), pack, 'phone_used', 3, 'd1');
    expect(ownedQty(s, 'phone_used')).toBe(1);
    s = grantItem(s, pack, 'phone_used', 1, 'd2');
    expect(ownedQty(s, 'phone_used')).toBe(1);
  });

  it('stocks giftable menu goods but not non-giftable consumables, and never a vending drink', () => {
    let s = grantItem(makeState(), pack, 'konbini:onigiri', 2, 'd1');
    expect(ownedQty(s, 'konbini:onigiri')).toBe(2);
    // a menu item the pack marks as not giftable is eaten on the spot
    const noGift = { ...pack, menu: pack.menu.map((m) => (m.id === 'konbini:tea' ? { ...m, giftable: false } : m)) };
    s = grantItem(s, noGift, 'konbini:tea', 1, 'd1');
    expect(ownedQty(s, 'konbini:tea')).toBe(0);
    // vending is a panel shop: even a menu row flagged giftable is not stocked
    expect(grantItem(makeState(), pack, 'vending:greenTea', 1, 'd1').owned).toEqual({});
  });

  it('ignores unknown ids and non-positive quantities', () => {
    const s = makeState();
    expect(grantItem(s, pack, 'nope', 1, 'd1')).toBe(s);
    expect(grantItem(s, pack, 'cap', 0, 'd1')).toBe(s);
    expect(grantItem(s, pack, 'cap', -2, 'd1')).toBe(s);
    expect(grantItem(s, pack, 'cap', Number.NaN, 'd1')).toBe(s);
  });

  it('applies the once-only effect of the flat: the home tier', () => {
    const s = grantItem(makeState(), pack, 'home_room_ono', 1, 'd1');
    expect(s.home.tier).toBe('ono');
    expect(grantItem(s, pack, 'home_room_ono', 1, 'd2').home.tier).toBe('ono');
  });
});

describe('consumeItem', () => {
  it('takes stock and drops the entry at zero', () => {
    const s = grantItem(makeState(), pack, 'g_choco', 2, 'd1');
    const a = consumeItem(s, 'g_choco');
    expect(a.ok).toBe(true);
    expect(ownedQty(a.state, 'g_choco')).toBe(1);
    const b = consumeItem(a.state, 'g_choco');
    expect('g_choco' in b.state.owned).toBe(false);
    expect(consumeItem(b.state, 'g_choco').ok).toBe(false);
    expect(consumeItem(s, 'g_choco', 3).ok).toBe(false);
  });
});

describe('derived flags', () => {
  it('ownsCategory reads the item tags', () => {
    const s = own(makeState(), 'bike_mamachari', 'yukata');
    expect(ownsCategory(pack, s, 'bicycle')).toBe(true);
    expect(ownsCategory(pack, s, 'yukata')).toBe(true);
    expect(ownsCategory(pack, s, 'phone')).toBe(false);
    expect(ownsCategory(pack, own(makeState(), 'phone_used'), 'phone')).toBe(true);
    expect(ownsCategory(pack, makeState(), 'car')).toBe(false);
  });

  it('hasFeature: the phone and the IC card', () => {
    const s = own(makeState(), 'ic_card');
    expect(hasFeature(pack, s, 'ic')).toBe(true);
    expect(hasFeature(pack, s, 'phone')).toBe(false);
    expect(hasFeature(pack, own(s, 'phone_used'), 'phone')).toBe(true);
  });

  it('rideOf picks the best ride: car > e-bike > bike, and none by default', () => {
    expect(rideOf(pack, makeState())).toEqual({ mesh: 'none', mul: 1 });
    expect(rideOf(pack, own(makeState(), 'bike_mamachari'))).toEqual({ mesh: 'bike', mul: 1.5 });
    expect(rideOf(pack, own(makeState(), 'bike_mamachari', 'ebike'))).toEqual({ mesh: 'ebike', mul: 1.8 });
    expect(rideOf(pack, own(makeState(), 'ebike', 'car_kei_used', 'bike_mamachari'))).toEqual({ mesh: 'car', mul: 2.5 });
  });

  it('traitValue counts furniture only while it is placed', () => {
    let s = own(makeState(), 'home_room_ono', 'kotatsu');
    expect(traitValue(pack, s, 'hangout_mult')).toBeNull();
    s = placeItem(s, pack, 'table', 'kotatsu').state;
    expect(traitValue(pack, s, 'hangout_mult')).toBe(1.5);
    expect(traitValue(pack, s, 'points_rate')).toBeNull();
  });
});

describe('age gates', () => {
  it('the flat and the cars are for 18+ (D28)', () => {
    expect(ageAllowed(pack, 'kids', 'home_room_ono')).toBe(false);
    expect(ageAllowed(pack, 'teens', 'car_kei_used')).toBe(false);
    expect(ageAllowed(pack, 'adults', 'home_room_ono')).toBe(true);
    expect(ageAllowed(pack, 'seniors', 'car_kei_used')).toBe(true);
    expect(ageAllowed(pack, 'kids', 'cap')).toBe(true);
    expect(ageAllowed(pack, 'kids', 'unknown')).toBe(true);
  });
});

describe('outfit and colours', () => {
  it('keeps only owned, equippable pieces', () => {
    const s = own(makeState(), 'cap', 'phone_used', 'home_room_ono');
    const r = applyOutfit(s, pack, ['cap', 'jeans', 'phone_used', 'home_room_ono', 'nope', 'cap'], {});
    expect(r.outfit.equipped).toEqual(['cap']);
  });

  it('keeps valid colours of owned colourable pieces only', () => {
    const s = own(makeState(), 'tee_basic', 'phone_case', 'cap');
    const r = applyOutfit(s, pack, ['tee_basic'], { tee_basic: '#4F86F7', phone_case: '#112233', cap: '#112233', hoodie: '#d8433f' });
    expect(r.outfit.colours).toEqual({ tee_basic: '#4f86f7', phone_case: '#112233' });
    // outside the palette, not a colour, wrong type
    const bad = applyOutfit(s, pack, ['tee_basic'], { tee_basic: '#123456', phone_case: 'red' });
    expect(bad.outfit.colours).toEqual({});
    expect(applyOutfit(s, pack, [], { tee_basic: 7 as unknown as string }).outfit.colours).toEqual({});
  });

  it('a later piece that covers a body slot replaces the earlier one (a yukata over a T-shirt)', () => {
    const s = own(makeState(), 'tee_basic', 'jeans', 'yukata', 'cap', 'glasses_round');
    const r = applyOutfit(s, pack, ['tee_basic', 'jeans', 'cap', 'yukata', 'glasses_round'], {});
    expect(r.outfit.equipped).toEqual(['cap', 'yukata', 'glasses_round']);
    // order decides: a tee after the yukata takes the top, and the yukata (which also covers bottom and shoes) goes
    expect(applyOutfit(s, pack, ['yukata', 'tee_basic'], {}).outfit.equipped).toEqual(['tee_basic']);
    // a piece in another slot is untouched: jeans and sneakers do not clash with a tee
    expect(applyOutfit(own(s, 'sneakers'), pack, ['tee_basic', 'jeans', 'sneakers'], {}).outfit.equipped).toEqual(['tee_basic', 'jeans', 'sneakers']);
  });

  it('is pure', () => {
    const s = own(makeState(), 'cap');
    const before = JSON.stringify(s);
    applyOutfit(s, pack, ['cap'], {});
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('avatarPatch (§5.5)', () => {
  it('is empty with nothing equipped', () => {
    expect(avatarPatch(pack, makeState())).toEqual({ accessories: [] });
  });

  it('maps the pieces', () => {
    let s = own(makeState(), 'tee_basic', 'jeans', 'sneakers', 'cap', 'glasses_round');
    s = applyOutfit(s, pack, ['tee_basic', 'jeans', 'sneakers', 'cap', 'glasses_round'], { tee_basic: '#d8433f', jeans: '#2f3a57' });
    expect(avatarPatch(pack, s)).toEqual({ top: '#d8433f', bottom: '#2f3a57', shoes: '#ffffff', accessories: ['cap', 'glasses'] });
  });

  it('an unpicked colour falls back to the piece colour, then the first of its palette', () => {
    let s = own(makeState(), 'tee_basic', 'jeans');
    s = applyOutfit(s, pack, ['tee_basic', 'jeans'], {});
    expect(avatarPatch(pack, s)).toMatchObject({ top: '#d8433f', bottom: '#35507a' });
  });

  it('the hoodie lightens its accent from the picked colour', () => {
    let s = own(makeState(), 'hoodie');
    s = applyOutfit(s, pack, ['hoodie'], { hoodie: '#4f86f7' });
    const p = avatarPatch(pack, s);
    expect(p.top).toBe('#4f86f7');
    // lighter than the pick on every channel
    const ch = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    ch(p.accent!).forEach((v, i) => expect(v).toBeGreaterThan(ch('#4f86f7')[i]!));
    expect(p.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('the winter jacket and the yukata set several parts; accessories do not repeat', () => {
    let s = own(makeState(), 'jacket_winter', 'cap');
    s = applyOutfit(s, pack, ['jacket_winter', 'cap', 'cap'], {});
    expect(avatarPatch(pack, s)).toEqual({ top: '#2f5ea8', accessories: ['scarf', 'cap'] });
    s = applyOutfit(own(makeState(), 'yukata'), pack, ['yukata'], {});
    expect(avatarPatch(pack, s)).toEqual({ top: '#3b4a8a', bottom: '#3b4a8a', shoes: '#8a5a3a', accent: '#f4f4f4', accessories: [] });
  });

  it('ignores a piece that is no longer owned', () => {
    let s = own(makeState(), 'cap');
    s = applyOutfit(s, pack, ['cap'], {});
    s = consumeItem(s, 'cap').state;
    expect(avatarPatch(pack, s).accessories).toEqual([]);
  });
});

describe('home slots and comfort (§8.8)', () => {
  it('the dorm has 4 slots and the flat 8', () => {
    expect(HOME_SLOTS.dorm).toHaveLength(4);
    expect(HOME_SLOTS.ono).toHaveLength(8);
    expect(HOME_SLOTS.ono).toEqual(expect.arrayContaining(['bed', 'desk', 'shelf', 'table', 'plant', 'kitchen', 'light', 'tv']));
  });

  it('places an owned piece in its slot and clears it with null', () => {
    const s = own(makeState(), 'futon_set');
    const r = placeItem(s, pack, 'bed', 'futon_set');
    expect(r.ok).toBe(true);
    expect(r.state.home.placed).toEqual({ bed: 'futon_set' });
    const c = placeItem(r.state, pack, 'bed', null);
    expect(c.ok).toBe(true);
    expect(c.state.home.placed).toEqual({});
    expect(placeItem(c.state, pack, 'bed', null).ok).toBe(true);
  });

  it('refuses what is not owned, the wrong slot, an unknown slot and a flat-only slot in the dorm', () => {
    const s = own(makeState(), 'futon_set', 'kotatsu', 'tv_small');
    expect(placeItem(makeState(), pack, 'bed', 'futon_set')).toMatchObject({ ok: false, reason: 'not_owned' });
    expect(placeItem(s, pack, 'desk', 'futon_set')).toMatchObject({ ok: false, reason: 'bad_slot' });
    expect(placeItem(s, pack, 'balcony', 'futon_set')).toMatchObject({ ok: false, reason: 'bad_slot' });
    expect(placeItem(s, pack, 'table', 'kotatsu')).toMatchObject({ ok: false, reason: 'no_flat' });
    expect(placeItem(s, pack, 'tv', 'tv_small')).toMatchObject({ ok: false, reason: 'no_flat' });
    expect(placeItem(s, pack, 'bed', 'cap')).toMatchObject({ ok: false });
    // a refusal changes nothing
    expect(placeItem(s, pack, 'table', 'kotatsu').state).toBe(s);
  });

  it('the flat opens the other four slots', () => {
    const s = own(makeState(), 'home_room_ono', 'kotatsu', 'tv_small');
    expect(placeItem(s, pack, 'table', 'kotatsu').ok).toBe(true);
    expect(placeItem(s, pack, 'tv', 'tv_small').ok).toBe(true);
  });

  it('comfort = base + placed furniture, capped', () => {
    let s = own(makeState(), 'futon_set', 'desk_study', 'plant_pothos');
    expect(comfort(pack, s)).toBe(BALANCE.comfort.base.dorm);
    for (const [slot, id] of [['bed', 'futon_set'], ['desk', 'desk_study'], ['plant', 'plant_pothos']] as const) s = placeItem(s, pack, slot, id).state;
    expect(comfort(pack, s)).toBe(BALANCE.comfort.base.dorm + 2 + 2 + 1);
    s = own(s, 'home_room_ono', 'kotatsu');
    s = placeItem(s, pack, 'table', 'kotatsu').state;
    expect(comfort(pack, s)).toBe(BALANCE.comfort.base.ono + 2 + 2 + 1 + 3);
    // a hand-edited save cannot go past the cap
    const huge = { ...s, owned: { ...s.owned, cap: { qty: 1, day: 'd1' } } };
    const bigPack = { ...pack, items: pack.items.map((i) => (i.id === 'futon_set' ? { ...i, fx: [{ t: 'home' as const, slot: 'bed', comfort: 99 }] } : i)) };
    expect(comfort(bigPack, huge)).toBe(BALANCE.comfort.max);
  });

  it('comfort ignores a piece sitting in the wrong slot or no longer owned', () => {
    let s = own(makeState(), 'futon_set');
    s = { ...s, home: { ...s.home, placed: { desk: 'futon_set', bed: 'ghost' } } };
    expect(comfort(pack, s)).toBe(BALANCE.comfort.base.dorm);
  });
});

describe('giftInfo', () => {
  it('reads tags, price and giftability of catalog gifts and menu goods', () => {
    expect(giftInfo(pack, 'g_manga')).toEqual({ tags: ['media', 'anime'], price: 680, giftable: true });
    expect(giftInfo(pack, 'konbini:onigiri')).toEqual({ tags: ['food', 'snack'], price: 160, giftable: true });
    expect(giftInfo(pack, 'cafe:coffee')).toMatchObject({ giftable: true });
  });

  it('a phone is not a gift, and a vending drink never is', () => {
    expect(giftInfo(pack, 'phone_used')?.giftable).toBe(false);
    expect(giftInfo(pack, 'ic_card')?.giftable).toBe(false);
    expect(giftInfo(pack, 'vending:greenTea')?.giftable).toBe(false);
  });

  it('unknown ids are null', () => {
    expect(giftInfo(pack, 'nope')).toBeNull();
    expect(giftInfo(pack, 'coffee')).toBeNull();
  });
});
