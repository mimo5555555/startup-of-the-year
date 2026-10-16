import './_fakeStorage';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { JP_PACK } from '@lw/content';
import { createGameState, placeItem } from '@lw/game';
import { DoorTip } from '../src/components/game/HomeStage';
import { SlotGrid } from '../src/components/game/HomeSlots';

// The list of places of the own room (the 360-px twin of the 3D markers) and the tooltips of the two own doors, as markup.
const base = () => {
  const s = createGameState(JP_PACK, Date.UTC(2030, 0, 15));
  return { ...s, owned: { futon_set: { qty: 1, day: 'd0' }, plant_pothos: { qty: 1, day: 'd0' } } };
};

describe('the places list', () => {
  it('shows the four places of the dorm, empty, with the picked piece\'s place marked as the target', () => {
    const html = renderToStaticMarkup(createElement(SlotGrid, { state: base(), pick: 'futon_set', onSlot: () => {} }));
    for (const slot of ['bed', 'desk', 'shelf', 'plant']) expect(html).toContain(`data-slot="${slot}"`);
    expect(html).not.toContain('data-slot="kitchen"');
    expect(html.match(/class="own-slot target"/g)).toHaveLength(1);
    expect(html).toMatch(/data-slot="bed"[^>]*data-target="true"/);
  });
  it('shows what stands in a place, and the flat has eight places', () => {
    const r = placeItem(base(), JP_PACK, 'plant', 'plant_pothos');
    const html = renderToStaticMarkup(createElement(SlotGrid, { state: r.state, pick: null, onSlot: () => {} }));
    expect(html).toContain('data-slot-piece="plant_pothos"');
    expect(html).toContain('own-slot filled');
    const flat = renderToStaticMarkup(createElement(SlotGrid, { state: { ...base(), home: { tier: 'ono', placed: {} } }, pick: null, onSlot: () => {} }));
    expect(flat.match(/data-slot="/g)).toHaveLength(8);
  });
});

describe('the tooltips of the own doors', () => {
  const tip = (status: Parameters<typeof DoorTip>[0]['status']) => renderToStaticMarkup(createElement(DoorTip, { status, name: '', onClose: () => {} }));
  it('the flat before it is rented is Aiko\'s building', () => {
    const html = tip({ t: 'flat_closed' });
    expect(html).toContain('data-door-status="flat_closed"');
    expect(html).toContain("Aiko&#x27;s building");
  });
  it('the dorm after moving says so, in Japanese too', () => {
    const html = tip({ t: 'dorm_moved' });
    expect(html).toContain('data-door-status="dorm_moved"');
    expect(html).toContain('moved out');
    expect(html).toContain('入れません');
  });
});
