// 居酒屋「なごみ」: the izakaya restyles the south row's west end (the 'izakaya' front). The override takes over the dressing, marks the
// izakaya site built (Misaki spawns), adds exactly one collider (the menu board, flush against the wall, no slot narrower than the player),
// registers the picks that teach 居酒屋, のれん and 提灯, and keeps the doorway clear for Misaki.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { SIGNS } from '@lw/content';
import { createBuildCtx } from '../src/buildctx';
import { FRONT_OVERRIDES, FRONT_STYLES, type FrontInfo } from '../src/buildings';
import { buildIzakaya } from '../src/buildings/izakaya';
import { DOORS, IZAKAYA, LAMPS, NPC_SPAWNS, POLES, SOUTH_FRONT, SOUTH_FRONTS, boxRect, layoutColliders, type Rect } from '../src/layout';

beforeAll(installFakeDom);

const PLAYER_W = 0.84;
const sf = SOUTH_FRONTS.find((f) => f.id === IZAKAYA.front)!;
const front: FrontInfo = { id: 'izakaya', cx: sf.cx, w: sf.w, zf: SOUTH_FRONT.z0, d: SOUTH_FRONT.d, style: FRONT_STYLES.izakaya };
const build = () => {
  const { ctx, out } = createBuildCtx();
  const handled = buildIzakaya(ctx, front);
  return { out, handled };
};
const gap = (a: Rect, b: Rect) => Math.max(Math.max(a.x0 - b.x1, b.x0 - a.x1), Math.max(a.z0 - b.z1, b.z0 - a.z1));
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('buildIzakaya', () => {
  it('is the izakaya front override (the south row\'s first), takes over the dressing and marks the site built', () => {
    expect(FRONT_OVERRIDES.izakaya).toBe(buildIzakaya);
    expect(SOUTH_FRONTS[0].id).toBe('izakaya');
    const { out, handled } = build();
    expect(handled).toBe(true);
    expect(out.built.has('izakaya')).toBe(true);
  });

  it('adds exactly the menu board as a collider, flush against the wall and in front of the izakaya', () => {
    const { out } = build();
    expect(out.colliders).toEqual([IZAKAYA.board]);
    expect(IZAKAYA.board.z1).toBeCloseTo(SOUTH_FRONT.z0, 9);
    expect(IZAKAYA.board.x0 >= sf.rect.x0 && IZAKAYA.board.x1 <= sf.rect.x1).toBe(true);
  });

  it('leaves no gap narrower than the player between the board and anything else on the sidewalk', () => {
    const others = [
      ...layoutColliders().filter((c) => !c.id.startsWith('front:') && c.id !== 'izakaya:board'),
      ...LAMPS.southX.map((x) => ({ id: `lamp:${x}`, rect: boxRect(x, LAMPS.southZ, LAMPS.size, LAMPS.size) })),
      ...POLES.x.map((x) => ({ id: `pole:${x}`, rect: boxRect(x, POLES.z, POLES.size, POLES.size) })),
    ];
    for (const o of others) {
      const g = gap(IZAKAYA.board, o.rect);
      expect(g <= 0 || g >= PLAYER_W, `${o.id}: gap ${g}`).toBe(true);
      expect(overlap(IZAKAYA.board, o.rect), o.id).toBe(false);
    }
  });

  it('keeps the doorway clear for Misaki, who stands in it facing the street; Mio\'s door next door is untouched', () => {
    const m = NPC_SPAWNS.find((s) => s.id === 'misaki')!;
    expect(m.site).toBe('izakaya');
    expect(m.face).toBeCloseTo(Math.PI, 9);
    expect(Math.abs(m.x - sf.cx)).toBeLessThan(0.5);
    expect(gap(boxRect(m.x, m.z, 0.6, 0.6), IZAKAYA.board)).toBeGreaterThanOrEqual(PLAYER_W);
    const mio = DOORS.find((d) => d.id === 'door:mio')!;
    expect(gap(boxRect(m.x, m.z, 0.6, 0.6), mio.body!.rect)).toBeGreaterThanOrEqual(PLAYER_W);
  });

  it('registers the picks that teach a word (居酒屋, のれん, 提灯), every one in the SIGNS table', () => {
    const { out } = build();
    const ids = new Set(out.pickables.map((p) => p.id));
    for (const id of ['izakaya', 'noren', 'lantern']) {
      expect(ids.has(id), id).toBe(true);
      expect(SIGNS.some((s) => s.id === id), id).toBe(true);
    }
  });
});
