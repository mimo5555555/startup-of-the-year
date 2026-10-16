// Review fixes for wave B2 (own room): regression tests at the game level. One describe per bug.
import { describe, expect, it } from 'vitest';
import { JP_PACK } from '../../content/src';
import { createGameState, migrate, pendingDeliveries } from '../src';

describe('a save with furniture on its way does not park a stale copy under _extra', () => {
  const withDelivery = { ...createGameState(JP_PACK, 1), deliveries: [{ id: 'purchase:a:1', item: 'futon_set', qty: 1, due: '2030-01-02' }] };
  it('migrate keeps `deliveries` as a known field, load after load', () => {
    const once = migrate(JSON.parse(JSON.stringify(withDelivery)), 1, JP_PACK);
    expect(pendingDeliveries(once)).toHaveLength(1);
    expect(once._extra).toBeUndefined();
    const twice = migrate(JSON.parse(JSON.stringify(once)), 1, JP_PACK);
    expect(pendingDeliveries(twice)).toEqual(pendingDeliveries(once));
    expect(twice._extra).toBeUndefined();
  });
  it('once the piece has arrived, nothing of the old booking is left in the save', () => {
    const arrived = { ...migrate(JSON.parse(JSON.stringify(withDelivery)), 1, JP_PACK), deliveries: [] };
    const back = migrate(JSON.parse(JSON.stringify(arrived)), 1, JP_PACK);
    expect(pendingDeliveries(back)).toEqual([]);
    expect(JSON.stringify(back._extra ?? {})).not.toContain('futon_set');
  });
});
