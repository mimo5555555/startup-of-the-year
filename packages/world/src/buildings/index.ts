// The building registry: one builder per place, so a shop is a file here instead of a block in city.ts.
// Builders run inside `buildCity()` through the district's `build(ctx)`; a builder that returns without calling
// `ctx.shopFrame` (or `ctx.markBuilt`) has not built its site, and NPCs whose spawn `site` is that building are skipped.
import type { BuildCtx } from '../buildctx';
import { SOUTH_FRONTS, type DoorDef, type ShopDef } from '../layout';
import { buildAiko } from './aiko';
import { buildCafe } from './cafe';
import { buildDenki } from './denki';
import { buildDoors } from './doors';
import { buildFukufuku } from './fukufuku';
import { buildKonbini } from './konbini';
import { buildMotors } from './motors';
import { buildProps } from './props';
import { buildRamen } from './ramen';
import { buildSchool } from './school';
import { buildStation } from './station';

export type { RideKind, RideMaterials } from './rides';
export { buildRide } from './rides';

/** Builds one open-front shop diorama for its `ShopDef`. */
export type BuildingBuilder = (ctx: BuildCtx, shop: ShopDef) => void;
export type DoorsBuilder = (ctx: BuildCtx, doors: readonly DoorDef[]) => void;
export type PropsBuilder = (ctx: BuildCtx) => void;

export const SHOP_BUILDERS: Record<ShopDef['id'], BuildingBuilder> = {
  konbini: buildKonbini,
  cafe: buildCafe,
  school: buildSchool,
  ramen: buildRamen,
  station: buildStation,
  fukufuku: buildFukufuku,
  denki: buildDenki,
  motors: buildMotors,
};

/** Shops, then the door facades and street props. Shops run in `district.shops` order (the original five keep their indices). */
export function buildBuildings(ctx: BuildCtx, district: { shops: readonly ShopDef[]; doors: readonly DoorDef[] }): void {
  for (const s of district.shops) {
    const build = SHOP_BUILDERS[s.id];
    if (!build) throw new Error(`no builder registered for shop '${s.id}'`);
    build(ctx, s);
  }
  buildDoors(ctx, district.doors);
  buildProps(ctx);
}

// ---- south side: decorative fronts across the street ----

export type SouthFrontId = (typeof SOUTH_FRONTS)[number]['id'];

/** Look of each south front (width and position come from layout's SOUTH_FRONTS). */
export interface FrontStyle {
  h: number;
  wall: string;
  trim: string;
  text: string;
  bg: string;
  fg: string;
  sub: string;
  lantern?: boolean;
  flowers?: boolean;
}

export const FRONT_STYLES: Record<SouthFrontId, FrontStyle> = {
  izakaya: { h: 7, wall: '#e8d5bd', trim: '#8a5a3a', text: '居酒屋', bg: '#2b2b36', fg: '#ffd166', sub: 'izakaya', lantern: true },
  yakkyoku: { h: 6.4, wall: '#d9e7e0', trim: '#2e9e5b', text: '薬局', bg: '#2e9e5b', fg: '#ffffff', sub: 'yakkyoku' },
  hanaya: { h: 6, wall: '#f3dfe3', trim: '#e8789e', text: '花屋', bg: '#e8789e', fg: '#ffffff', sub: 'hanaya', flowers: true },
  honya: { h: 8, wall: '#dfe4f0', trim: '#3f4a86', text: '本屋', bg: '#3f4a86', fg: '#ffffff', sub: 'honya' },
  hotel: { h: 12, wall: '#f0ece4', trim: '#9a8f7c', text: 'ホテル', bg: '#6b5b95', fg: '#ffffff', sub: 'hotel' },
  game: { h: 6.6, wall: '#f6e6c7', trim: '#d8433f', text: 'ゲーム', bg: '#d8433f', fg: '#fff', sub: 'geemu' },
};

export interface FrontInfo {
  id: SouthFrontId;
  cx: number;
  w: number;
  /** front plane (z of the wall face the street sees) and depth into +z */
  zf: number;
  d: number;
  style: FrontStyle;
}

/**
 * A front's own dressing. The city draws the box, trim and windows, then asks the override; returning true means it
 * drew the sign and ornaments itself, so the default sign, lanterns and flower pots are skipped. Returning nothing
 * keeps the default dressing.
 */
export type FrontOverride = (ctx: BuildCtx, front: FrontInfo) => boolean | void;

/** Aiko's tea stall restyles the florist front (slice 3B fills `buildAiko`). */
export const FRONT_OVERRIDES: Partial<Record<SouthFrontId, FrontOverride>> = {
  hanaya: buildAiko,
};
