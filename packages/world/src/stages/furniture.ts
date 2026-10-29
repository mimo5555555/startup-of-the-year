// The player's furniture (wave B2): one low-poly toon model per catalog item (`futon_set`, `desk_study`, `bookshelf`,
// `plant_pothos`, `kotatsu`, `rice_cooker`, `paper_lamp`, `tv_small`), drawn into a slot of the player's own room
// (`StageBuildCtx.placed`: slot -> item id), plus the slot markers of the placement view.
//
// All pieces of a room are merged into two vertex-coloured meshes (solid toon + unlit glow), so a room with all eight slots
// filled costs 2 draw calls; the faint slot markers are a third mesh that only exists while the placement view is on. The
// furniture is its own group: `setPlaced` throws the two meshes away and builds them again without touching the room.
//
// Every model is written in the slot's own frame (origin at the footprint's centre on the floor, +z towards the front, x to the
// right, the back against the wall at -d/2) and is placed by the slot's `face`, so one model serves a slot on any wall.
import * as THREE from 'three';
import { Batch, rng } from '../batch';
import type { Rect } from '../layout';
import type { StageBuildCtx, StageHandle, StagePick, StageSlot } from '../stage';

/** Which catalog item goes in which slot (`ItemEffect { t: 'home' }.slot`); the stage draws exactly these eight. */
export const FURNITURE_SLOT: Readonly<Record<string, string>> = {
  futon_set: 'bed',
  desk_study: 'desk',
  bookshelf: 'shelf',
  kotatsu: 'table',
  plant_pothos: 'plant',
  rice_cooker: 'kitchen',
  paper_lamp: 'light',
  tv_small: 'tv',
};
export const FURNITURE_IDS = Object.keys(FURNITURE_SLOT);

export const slotPickId = (slot: string) => `slot:${slot}`;
/** `slot:bed` -> `bed`; null for any other id */
export const parseSlotPick = (id: string): string | null => /^slot:([a-z0-9_]+)$/.exec(id)?.[1] ?? null;

const yawOf = (face: StageSlot['face']) => (face === 'front' ? 0 : face === 'left' ? -Math.PI / 2 : Math.PI / 2);

/** The footprint's size in the slot's own frame: `w` along the piece, `d` front to back. */
export function slotSize(slot: StageSlot) {
  const dx = slot.rect.x1 - slot.rect.x0;
  const dz = slot.rect.z1 - slot.rect.z0;
  return slot.face === 'front' ? { w: dx, d: dz } : { w: dz, d: dx };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing in a slot's frame
// ---------------------------------------------------------------------------------------------------------------

interface Tilt {
  rx?: number;
  rz?: number;
  /** extra turn about the vertical, in the piece's own frame */
  ry?: number;
}

class Pen {
  constructor(
    private readonly b: Batch,
    private readonly cx: number,
    private readonly cz: number,
    private readonly yaw: number,
    private readonly y0: number,
  ) {}

  private at(lx: number, lz: number): [number, number] {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return [this.cx + lx * c + lz * s, this.cz - lx * s + lz * c];
  }

  /** a box with its bottom `ly` above the floor, `w` across, `d` front to back */
  box(lx: number, ly: number, lz: number, w: number, h: number, d: number, color: string, o: Tilt = {}) {
    const [x, z] = this.at(lx, lz);
    this.b.boxB(x, this.y0 + ly, z, w, h, d, color, { rx: o.rx, rz: o.rz, ry: this.yaw + (o.ry ?? 0) });
  }

  cyl(lx: number, ly: number, lz: number, rTop: number, rBottom: number, h: number, color: string, seg = 8) {
    const [x, z] = this.at(lx, lz);
    this.b.cyl(x, this.y0 + ly, z, rTop, rBottom, h, color, { seg });
  }

  /** `ly` is the centre's height */
  ball(lx: number, ly: number, lz: number, r: number, color: string, o: { sx?: number; sy?: number; sz?: number; ws?: number; hs?: number } = {}) {
    const [x, z] = this.at(lx, lz);
    this.b.sphere(x, this.y0 + ly, z, r, color, { ws: 7, hs: 5, ...o, ry: this.yaw });
  }
}

interface Frame {
  /** lit (toon) and unlit (glow) pens */
  s: Pen;
  g: Pen;
  /** footprint size, and a seeded random for the small touches (the books) */
  w: number;
  d: number;
  rnd: () => number;
}

type Model = (f: Frame) => void;

const C = {
  cream: '#efe6d0',
  white: '#fbf8ef',
  wood: '#c89a62',
  woodMid: '#a97a48',
  woodDark: '#7d5238',
  ink: '#2b2b36',
  indigo: '#4f6f9a',
  terracotta: '#c46a45',
  leaf: '#4f9a55',
  leafLight: '#7dbb62',
  warm: '#ffe2a0',
};
const BOOKS = ['#d8433f', '#4f86f7', '#f4c64a', '#5f9a55', '#8a5ab0', '#e8789e', '#f08a3c', '#3b8f9a', '#efe6d0'];

/** a futon laid out for the night: mattress, a pillow at the head, an indigo duvet folded back */
const futon: Model = ({ s, w, d }) => {
  const z0 = -d / 2;
  s.box(0, 0, 0, w - 0.04, 0.08, d - 0.04, C.cream);
  s.box(0, 0.08, z0 + 0.24, w * 0.62, 0.09, 0.34, C.white);
  s.box(0, 0.17, z0 + 0.24, w * 0.5, 0.012, 0.22, '#e8dfc8');
  const dl = d * 0.72;
  const dz = z0 + d - dl / 2 - 0.02;
  s.box(0, 0.075, dz, w - 0.01, 0.105, dl, C.indigo);
  s.box(0, 0.075, dz - dl / 2 + 0.13, w - 0.01, 0.12, 0.26, '#e9eef5'); // the cuff folded back
  for (let i = 0; i < 3; i++) s.box(0, 0.18, dz - 0.12 + i * 0.33, 0.24, 0.012, 0.24, '#7a9bc6', { ry: Math.PI / 4 });
};

/** a study desk with a drawer pedestal, a chair tucked in, a pinboard of word notes on the wall and a few things on top */
const desk: Model = ({ s, g, w, d }) => {
  const zb = -d / 2;
  s.box(0, 0.68, 0, w, 0.04, d, C.wood);
  s.box(-w / 2 + 0.03, 0, 0, 0.05, 0.68, d - 0.04, C.woodMid);
  s.box(w / 2 - 0.2, 0, 0, 0.38, 0.68, d - 0.04, C.woodMid);
  for (const y of [0.1, 0.4]) {
    s.box(w / 2 - 0.2, y, d / 2 - 0.035, 0.32, 0.24, 0.02, C.wood);
    s.box(w / 2 - 0.2, y + 0.1, d / 2 - 0.02, 0.1, 0.025, 0.02, '#e8dcc4');
  }
  // the chair, pulled in
  const cz = d / 2 - 0.08;
  s.box(-0.12, 0.4, cz, 0.4, 0.045, 0.38, '#5f7fa8');
  for (const [x, z] of [[-0.28, cz - 0.15], [0.04, cz - 0.15], [-0.28, cz + 0.15], [0.04, cz + 0.15]] as const) s.box(x, 0, z, 0.04, 0.4, 0.04, C.woodDark);
  s.box(-0.12, 0.44, cz + 0.2, 0.4, 0.34, 0.04, '#5f7fa8');
  // on the desk: books, an open notebook, a mug and a small lamp
  s.box(-w / 2 + 0.2, 0.72, -0.04, 0.26, 0.05, 0.19, '#d8433f');
  s.box(-w / 2 + 0.2, 0.77, -0.04, 0.24, 0.05, 0.18, '#f4c64a');
  s.box(-w / 2 + 0.2, 0.82, -0.04, 0.22, 0.045, 0.17, '#4f86f7');
  s.box(0.02, 0.72, 0.0, 0.3, 0.012, 0.22, C.white);
  s.cyl(0.26, 0.72, 0.08, 0.035, 0.03, 0.08, '#f4f1e6', 8);
  s.cyl(w / 2 - 0.16, 0.72, -0.12, 0.07, 0.08, 0.02, C.ink, 8);
  s.box(w / 2 - 0.16, 0.74, -0.12, 0.02, 0.3, 0.02, C.ink);
  s.box(w / 2 - 0.16, 1.02, -0.1, 0.16, 0.05, 0.14, '#e8c547');
  g.ball(w / 2 - 0.16, 1.0, -0.1, 0.04, C.warm, { ws: 5, hs: 3 });
  // the pinboard: the saved-words wall
  const bx = -w / 2 + 0.34;
  s.box(bx, 1.02, zb + 0.02, 0.56, 0.42, 0.03, C.woodDark);
  s.box(bx, 1.04, zb + 0.04, 0.5, 0.38, 0.02, '#d9b27c');
  const notes: Array<[number, number, string, number]> = [[-0.17, 1.28, '#fff2a8', 0.1], [0.0, 1.32, '#ffc4d6', -0.08], [0.17, 1.27, '#bfe3ff', 0.05], [-0.1, 1.15, '#c9f0c2', -0.05], [0.1, 1.14, '#fff2a8', 0.12]];
  for (const [x, y, c, r] of notes) s.box(bx + x, y - 0.06, zb + 0.054, 0.11, 0.11, 0.008, c, { rz: r });
};

/** a bookcase against the wall: four shelves of books, a gift box and a plush on the top one */
const bookshelf: Model = ({ s, w, d, rnd }) => {
  const H = 1.65;
  const zb = -d / 2;
  s.box(0, 0, 0, w, 0.06, d, C.woodDark);
  s.box(-w / 2 + 0.02, 0, 0, 0.04, H, d, C.woodMid);
  s.box(w / 2 - 0.02, 0, 0, 0.04, H, d, C.woodMid);
  s.box(0, H - 0.03, 0, w, 0.04, d, C.woodMid);
  s.box(0, 0, zb + 0.01, w - 0.04, H, 0.02, C.woodDark);
  const levels = [0.06, 0.45, 0.84, 1.23];
  levels.forEach((y, i) => {
    if (i > 0) s.box(0, y - 0.02, 0, w - 0.04, 0.03, d - 0.02, C.wood);
    const top = i === 3;
    let x = -w / 2 + 0.06;
    const limit = top ? w * 0.04 : w / 2 - 0.06;
    while (x < limit - 0.03) {
      const bw = 0.03 + rnd() * 0.035;
      if (x + bw > limit) break;
      const bh = 0.2 + rnd() * 0.12;
      s.box(x + bw / 2, y + (i === 0 ? 0 : 0.01), 0.0, bw * 0.95, bh, d * 0.62, BOOKS[Math.floor(rnd() * BOOKS.length)]);
      x += bw;
    }
  });
  // a gift box with a ribbon and a plush on the top shelf
  s.box(w * 0.2, levels[3], 0, 0.16, 0.14, 0.14, '#e8789e');
  s.box(w * 0.2, levels[3] + 0.14, 0, 0.17, 0.02, 0.15, '#f6c7d8');
  s.ball(w * 0.38 - 0.02, levels[3] + 0.1, 0, 0.09, '#f4c64a', { sy: 0.95 });
  s.ball(w * 0.38 - 0.07, levels[3] + 0.2, 0, 0.035, '#f4c64a', { ws: 5, hs: 3 });
  s.ball(w * 0.38 + 0.03, levels[3] + 0.2, 0, 0.035, '#f4c64a', { ws: 5, hs: 3 });
};

/** a pothos on a little wooden stand, vines trailing over the edge */
const pothos: Model = ({ s, w, d }) => {
  const sw = Math.min(w, d) - 0.06;
  s.box(0, 0.26, 0, sw, 0.03, sw, C.wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(sx * (sw / 2 - 0.03), 0, sz * (sw / 2 - 0.03), 0.03, 0.26, 0.03, C.woodMid);
  s.cyl(0, 0.29, 0, 0.15, 0.11, 0.24, C.terracotta, 9);
  s.cyl(0, 0.5, 0, 0.165, 0.15, 0.04, '#d98058', 9);
  const leaves: Array<[number, number, number, number, string]> = [
    [0, 0.82, 0, 0.13, C.leafLight], [-0.1, 0.7, 0.03, 0.12, C.leaf], [0.1, 0.72, -0.02, 0.12, C.leaf], [0.02, 0.62, 0.1, 0.11, C.leafLight],
    [-0.04, 0.64, -0.1, 0.11, C.leaf], [0.14, 0.58, 0.06, 0.1, C.leafLight], [-0.15, 0.58, -0.04, 0.1, C.leafLight],
  ];
  for (const [x, y, z, r, c] of leaves) s.ball(x, y, z, r, c, { sy: 0.7, ws: 6, hs: 4 });
  // trailing vines with a few leaves each
  for (const [vx, vz, len] of [[-sw / 2 - 0.01, 0.06, 0.4], [sw / 2 + 0.01, -0.05, 0.3], [0.05, sw / 2 + 0.01, 0.34]] as const) {
    s.box(vx, 0.5 - len * 0.5, vz, 0.012, len, 0.012, '#3f7a45');
    for (let i = 0; i < 3; i++) s.ball(vx, 0.46 - i * (len / 3.4), vz, 0.05, i % 2 ? C.leaf : C.leafLight, { sy: 0.8, ws: 5, hs: 3 });
  }
};

/** a kotatsu: the quilt over a low table, a wooden top with a bowl of mikan, two zabuton tucked at the sides */
const kotatsu: Model = ({ s, w, d }) => {
  s.box(0, 0.04, 0, w, 0.3, d, '#b8566a');
  s.box(0, 0.0, 0, w + 0.03, 0.06, d + 0.03, '#8a3b4d');
  s.box(0, 0.34, 0, w * 0.76, 0.04, d * 0.76, '#c18b5a');
  s.box(0, 0.38, 0, 0.34, 0.012, 0.24, C.woodDark);
  s.cyl(-0.02, 0.392, 0, 0.1, 0.07, 0.06, '#f4f1e6', 9);
  for (const [x, z] of [[-0.05, -0.02], [0.03, 0.03], [0.0, -0.05]] as const) s.ball(x, 0.45, z, 0.045, '#f08a3c', { ws: 6, hs: 4 });
  s.box(0.21, 0.392, 0.1, 0.05, 0.02, 0.06, '#2b2b36');
  for (const [x, z, c] of [[0, d / 2 - 0.04, '#7a4a8a'], [-w / 2 + 0.04, 0, '#5f9a55']] as const) {
    s.box(x, 0, z, 0.45, 0.07, 0.45, c);
    s.box(x, 0.07, z, 0.16, 0.012, 0.16, '#f6e2a8');
  }
};

/** a small kitchen unit: cupboard doors, a sink and a hob, a rice cooker and a ladle rail */
const kitchen: Model = ({ s, g, w, d }) => {
  const zf = d / 2;
  s.box(0, 0, 0, w, 0.82, d, '#ece6d6');
  s.box(0, 0.82, 0, w + 0.02, 0.04, d + 0.02, '#c9ced6');
  for (const x of [-w / 4, w / 4]) {
    s.box(x, 0.06, zf - 0.005, w / 2 - 0.05, 0.7, 0.014, '#dcd1b8');
    s.box(x + (x < 0 ? 0.16 : -0.16), 0.5, zf + 0.005, 0.025, 0.1, 0.02, '#8a8f9a');
  }
  s.box(-w * 0.3, 0.862, 0.0, w * 0.34, 0.012, d * 0.64, '#8e98a6'); // sink basin
  s.box(-w * 0.3, 0.87, -d / 2 + 0.07, 0.03, 0.2, 0.03, '#b9bfc9');
  s.box(-w * 0.3, 1.04, -d / 2 + 0.12, 0.03, 0.03, 0.12, '#b9bfc9');
  s.cyl(w * 0.33, 0.864, 0.02, 0.07, 0.07, 0.015, C.ink, 10);
  // the rice cooker
  const rx = w * 0.06;
  s.cyl(rx, 0.864, 0.0, 0.115, 0.125, 0.19, '#f6f4ee', 10);
  s.ball(rx, 1.05, 0.0, 0.118, '#f6f4ee', { sy: 0.55, ws: 10, hs: 5 });
  s.box(rx, 0.9, zf * 0.62, 0.1, 0.05, 0.02, '#e8789e');
  g.ball(rx + 0.03, 0.935, zf * 0.62 + 0.012, 0.012, '#7ff0a0', { ws: 4, hs: 3 });
  s.box(rx, 1.1, 0.0, 0.06, 0.025, 0.05, '#c9c2b0');
  // a rail on the wall with a ladle and a pan
  s.box(0, 1.35, -d / 2 + 0.015, w * 0.8, 0.018, 0.018, '#8a8f9a');
  s.box(-0.1, 1.2, -d / 2 + 0.02, 0.018, 0.15, 0.018, '#8a8f9a');
  s.cyl(-0.1, 1.12, -d / 2 + 0.02, 0.035, 0.03, 0.04, '#8a8f9a', 7);
  s.cyl(0.18, 1.18, -d / 2 + 0.03, 0.09, 0.09, 0.02, C.ink, 9);
};

/** a paper andon lamp: a glowing paper box in a dark wooden frame on a low base */
const paperLamp: Model = ({ s, g, w, d }) => {
  const sw = Math.min(w, d) - 0.06;
  const H = 0.78;
  s.box(0, 0, 0, sw + 0.04, 0.05, sw + 0.04, C.woodDark);
  g.box(0, 0.05, 0, sw - 0.02, H - 0.1, sw - 0.02, '#ffe2a0');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(sx * (sw / 2 - 0.01), 0.05, sz * (sw / 2 - 0.01), 0.03, H - 0.08, 0.03, C.woodDark);
  for (const y of [0.05, H - 0.07, 0.36]) s.box(0, y, 0, sw + 0.02, 0.03, sw + 0.02, C.woodDark);
  s.box(0, H - 0.04, 0, sw + 0.06, 0.04, sw + 0.06, C.woodDark);
  for (const z of [-1, 1]) s.box(0, 0.15, z * (sw / 2), 0.03, 0.55, 0.012, '#e0a860'); // paper ribs
};

/** a 32-inch TV on a low cabinet; the screen is lit */
const tv: Model = ({ s, g, w, d }) => {
  const zf = d / 2;
  s.box(0, 0, 0, w, 0.36, d, '#4a3a30');
  s.box(0, 0.36, 0, w + 0.02, 0.025, d + 0.02, '#2f251f');
  s.box(-w * 0.2, 0.03, zf - 0.005, w * 0.34, 0.26, 0.014, '#5d4a3c');
  s.box(w * 0.2, 0.03, zf - 0.005, w * 0.34, 0.26, 0.014, '#5d4a3c');
  s.box(0, 0.385, 0, 0.3, 0.05, 0.16, '#1c1c24');
  const sw = Math.min(0.78, w - 0.1);
  s.box(0, 0.43, 0, sw, 0.46, 0.06, '#1c1c24');
  // the picture: sky, hills, a sun and a news bar
  const px = sw - 0.07;
  g.box(0, 0.47, 0.034, px, 0.36, 0.01, '#79c0ee');
  g.box(0, 0.47, 0.038, px, 0.12, 0.01, '#5aa564');
  g.ball(-px * 0.28, 0.78, 0.04, 0.045, '#ffd166', { ws: 6, hs: 4, sz: 0.2 });
  g.box(0, 0.445, 0.042, px, 0.03, 0.01, '#d8433f');
};

/** the dorm's own cot: a plain steel frame with a thin mattress and a pale blanket */
export const dormCot: Model = ({ s, w, d }) => {
  const z0 = -d / 2;
  s.box(0, 0.16, 0, w, 0.04, d, '#8a8f9a');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), 0.045, 0.2, 0.045, '#8a8f9a');
  s.box(0, 0.2, z0 + 0.015, w, 0.35, 0.03, '#8a8f9a');
  s.box(0, 0.2, 0, w - 0.06, 0.09, d - 0.08, '#d6dbe0');
  s.box(0, 0.29, z0 + 0.25, w * 0.6, 0.07, 0.3, C.white);
  s.box(0, 0.285, z0 + 0.8, w - 0.04, 0.05, d * 0.55, '#9bb8a0');
};

/** the dorm's own desk and stool: pale laminate on thin steel legs */
export const dormDesk: Model = ({ s, w, d }) => {
  s.box(0, 0.7, 0, w, 0.03, d, '#e1ceab');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04), 0.035, 0.7, 0.035, '#8a8f9a');
  s.box(0, 0.45, -d / 2 + 0.03, w - 0.1, 0.03, 0.02, '#b9bfc9');
  s.cyl(-0.15, 0, d / 2 - 0.1, 0.17, 0.17, 0.42, '#c9a06a', 8);
  s.box(0.2, 0.73, -0.05, 0.22, 0.04, 0.16, '#4f86f7');
  s.box(-0.25, 0.73, 0.0, 0.2, 0.012, 0.14, C.white);
};

/** a plank on the dorm wall where a bookshelf can go: a few books and a mug */
export const dormPlank: Model = ({ s, w, d, rnd }) => {
  const y = 1.15;
  s.box(0, y, -d / 2 + 0.1, w - 0.1, 0.03, 0.2, C.woodMid);
  for (const sx of [-1, 1]) s.box(sx * (w / 2 - 0.12), y - 0.14, -d / 2 + 0.03, 0.025, 0.14, 0.05, C.woodMid);
  let x = -w / 2 + 0.2;
  for (let i = 0; i < 4; i++) {
    const bw = 0.035 + rnd() * 0.03;
    s.box(x + bw / 2, y + 0.03, -d / 2 + 0.1, bw, 0.18 + rnd() * 0.06, 0.13, BOOKS[Math.floor(rnd() * BOOKS.length)]);
    x += bw + 0.002;
  }
  s.cyl(w / 2 - 0.2, y + 0.03, -d / 2 + 0.1, 0.035, 0.03, 0.08, '#f4f1e6', 7);
};

/**
 * `room_momiji` (Goen stage 1): the autumn decor set, a momiji bonsai on a low stand in front of a little two-leaf gold screen with
 * maple leaves, a few fallen leaves round it. Free-standing (the dorm's plant corner has no wall behind it); sized to the footprint.
 */
const momiji: Model = ({ s, w, d, rnd }) => {
  const sw = Math.min(w, 0.62) - 0.04;
  const sd = Math.min(d, 0.62) - 0.04;
  // the byōbu: two gold leaves at a slight fold along the back, dark lacquer frames, leaves painted on
  const bz = -sd / 2 + 0.05;
  const leafW = sw / 2;
  for (const side of [-1, 1]) {
    const lx = (side * leafW) / 2;
    s.box(lx, 0, bz + 0.02 * side, leafW, 0.62, 0.02, '#e3bd5a', { ry: side * 0.22 });
    s.box(lx, 0.6, bz + 0.02 * side, leafW + 0.01, 0.025, 0.03, '#3a2422', { ry: side * 0.22 });
    s.box(lx, 0, bz + 0.02 * side, leafW + 0.01, 0.025, 0.03, '#3a2422', { ry: side * 0.22 });
    for (let i = 0; i < 3; i++) s.ball(lx + (rnd() - 0.5) * leafW * 0.6, 0.18 + rnd() * 0.36, bz + 0.02 * side + 0.014, 0.035, ['#c4472b', '#f07a2a', '#9c2a22'][i], { sz: 0.25, ws: 5, hs: 3 });
  }
  // the low stand and the shallow pot
  const st = Math.min(sw, sd) * 0.78;
  s.box(0, 0.1, 0.03, st, 0.035, st * 0.8, C.woodDark);
  for (const sx of [-1, 1]) s.box(sx * (st / 2 - 0.03), 0, 0.03, 0.04, 0.1, st * 0.8 - 0.02, C.woodDark);
  s.box(0, 0.135, 0.03, st * 0.66, 0.06, st * 0.5, '#4b5a6e');
  s.box(0, 0.19, 0.03, st * 0.6, 0.008, st * 0.44, '#6b5a44');
  // the tree: a leaning trunk with two branches, crowned with red, orange and gold
  s.cyl(0.0, 0.19, 0.03, 0.025, 0.04, 0.22, '#5a3e30', 7);
  s.box(0.04, 0.36, 0.03, 0.03, 0.16, 0.03, '#5a3e30', { rz: -0.6 });
  s.box(-0.05, 0.36, 0.03, 0.025, 0.14, 0.025, '#5a3e30', { rz: 0.7 });
  const crown: Array<[number, number, number, number, string]> = [
    [0, 0.52, 0.03, 0.11, '#c4472b'], [0.1, 0.47, 0.06, 0.085, '#e0582c'], [-0.1, 0.46, 0.0, 0.085, '#f07a2a'],
    [0.03, 0.44, -0.06, 0.08, '#9c2a22'], [-0.03, 0.47, 0.12, 0.075, '#f2a33d'], [0.12, 0.42, -0.04, 0.06, '#f2b33d'],
  ];
  for (const [x, y, z, r, c] of crown) s.ball(x, y, z, r, c, { sy: 0.75, ws: 7, hs: 5 });
  // fallen leaves on the stand and the floor
  for (let i = 0; i < 6; i++) {
    const on = i < 2;
    s.box((rnd() - 0.5) * (on ? st * 0.7 : sw), on ? 0.136 : 0.004, 0.03 + (rnd() - 0.5) * (on ? st * 0.5 : sd * 0.8), 0.04, 0.006, 0.035, ['#c4472b', '#f07a2a', '#f2b33d'][i % 3], { ry: rnd() * 3 });
  }
};

/** Goen's decor pieces (drawn like furniture, in the slot their item names; `room_momiji` is made for the `plant` slot). */
export const DECOR_IDS = ['room_momiji'] as const;

const MODELS: Readonly<Record<string, Model>> = {
  room_momiji: momiji,
  futon_set: futon,
  desk_study: desk,
  bookshelf,
  plant_pothos: pothos,
  kotatsu,
  rice_cooker: kitchen,
  paper_lamp: paperLamp,
  tv_small: tv,
};

/** a cardboard box: what stands in a slot for an item the stage has no model for (nothing placed is ever invisible) */
const parcel: Model = ({ s, w, d }) => {
  const bw = Math.min(w, 0.6);
  const bd = Math.min(d, 0.6);
  s.box(0, 0, 0, bw, 0.4, bd, '#c9a26a');
  s.box(0, 0.4, 0, bw * 0.12, 0.004, bd, '#e8d4a8');
};

// ---------------------------------------------------------------------------------------------------------------
// The furniture group and the placement markers
// ---------------------------------------------------------------------------------------------------------------

export interface FurnitureOpts {
  slots: readonly StageSlot[];
  /** drawn while a slot is empty (the dorm's cot, desk and plank); a slot with `basic` blocks the floor either way */
  basics?: Readonly<Record<string, Model>>;
}

const frameOf = (slot: StageSlot, solid: Batch, glow: Batch, rnd: () => number): Frame => {
  const { w, d } = slotSize(slot);
  const cx = (slot.rect.x0 + slot.rect.x1) / 2;
  const cz = (slot.rect.z0 + slot.rect.z1) / 2;
  const yaw = yawOf(slot.face);
  return { s: new Pen(solid, cx, cz, yaw, slot.y0), g: new Pen(glow, cx, cz, yaw, slot.y0), w, d, rnd };
};

/** The footprints that block the player: the filled slots and the dorm's plain pieces. */
export function furnitureColliders(slots: readonly StageSlot[], placed: Readonly<Record<string, string>>): Rect[] {
  return slots.filter((s) => placed[s.name] || s.basic).map((s) => ({ ...s.rect }));
}

/** the placement markers: a ring round every slot (and a pad on the empty ones); `focus` is the slot about to be filled */
function markerBatch(slots: readonly StageSlot[], placed: Readonly<Record<string, string>>, focus: string | null): Batch {
  const b = new Batch();
  const plane = new THREE.PlaneGeometry(1, 1);
  const flat = (x: number, y: number, z: number, w: number, d: number, color: string) => b.raw(plane, x, y, z, w, d, 1, color, { rx: -Math.PI / 2 });
  for (const s of slots) {
    const r = s.rect;
    const hot = s.name === focus;
    const pad = 0.05;
    const x0 = r.x0 - pad;
    const x1 = r.x1 + pad;
    const z0 = r.z0 - pad;
    const z1 = r.z1 + pad;
    const t = hot ? 0.09 : 0.055;
    const y = s.y0 + 0.012;
    const ring = hot ? '#ff3d8b' : '#16a596';
    flat((x0 + x1) / 2, y, z0 + t / 2, x1 - x0, t, ring);
    flat((x0 + x1) / 2, y, z1 - t / 2, x1 - x0, t, ring);
    flat(x0 + t / 2, y, (z0 + z1) / 2, t, z1 - z0 - 2 * t, ring);
    flat(x1 - t / 2, y, (z0 + z1) / 2, t, z1 - z0 - 2 * t, ring);
    if (!placed[s.name]) flat((x0 + x1) / 2, y - 0.002, (z0 + z1) / 2, x1 - x0 - 2 * t, z1 - z0 - 2 * t, hot ? '#ff9cc4' : '#5fd6c8');
  }
  plane.dispose();
  return b;
}

/**
 * Adds the furniture to a room's handle: the two furniture meshes (rebuilt by `setPlaced`), the `slot:<name>` picks (tappable
 * only while `showSlots` is on), the marker mesh of the placement view, and the live colliders.
 */
export function withFurniture(base: StageHandle, ctx: StageBuildCtx, opts: FurnitureOpts): StageHandle {
  const { slots } = opts;
  const furn = new THREE.Group();
  furn.name = 'stage-furniture';
  base.group.add(furn);
  const markGroup = new THREE.Group();
  markGroup.name = 'stage-slot-markers';
  base.group.add(markGroup);

  let placed: Record<string, string> = { ...ctx.placed };
  const view = { show: false, focus: null as string | null };
  let colliders = furnitureColliders(slots, placed);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, fog: false });

  const picks: StagePick[] = slots.map((s) => {
    const { w, d } = slotSize(s);
    const r = s.rect;
    return { id: slotPickId(s.name), pos: new THREE.Vector3((r.x0 + r.x1) / 2, s.y0 + 0.45, (r.z0 + r.z1) / 2), radius: Math.max(0.5, Math.max(w, d) * 0.55), off: true };
  });
  base.pickables.push(...picks);

  const clear = (g: THREE.Group) => {
    for (const m of [...g.children]) {
      g.remove(m);
      (m as THREE.Mesh).geometry?.dispose();
    }
  };

  const rebuildFurniture = () => {
    clear(furn);
    const solid = new Batch();
    const glow = new Batch();
    for (const slot of slots) {
      const id = placed[slot.name];
      const model = id ? (MODELS[id] ?? parcel) : opts.basics?.[slot.name];
      if (!model) continue;
      model(frameOf(slot, solid, glow, rng(0x5107 + slot.name.length * 131 + slot.name.charCodeAt(0))));
    }
    const a = solid.build(ctx.toon, { cast: false, receive: false, name: 'stage-furniture-solid' });
    const b = glow.build(ctx.glow, { cast: false, receive: false, name: 'stage-furniture-glow' });
    if (a) furn.add(a);
    if (b) furn.add(b);
  };

  const rebuildMarkers = () => {
    clear(markGroup);
    if (!view.show) return;
    const m = markerBatch(slots, placed, view.focus).build(mat, { cast: false, receive: false, name: 'stage-slot-markers' });
    if (m) {
      m.renderOrder = 2;
      markGroup.add(m);
    }
  };

  rebuildFurniture();

  return {
    group: base.group,
    pickables: base.pickables,
    get colliders() {
      return colliders;
    },
    update(dt, t) {
      base.update?.(dt, t);
      if (view.show) mat.opacity = 0.5 + 0.2 * Math.sin(t * 3.2);
    },
    setState(s) {
      base.setState?.(s);
      const show = !!s.showSlots;
      const focus = s.slotFocus ?? null;
      if (show !== view.show || focus !== view.focus) {
        view.show = show;
        view.focus = focus;
        for (const p of picks) p.off = !show;
        rebuildMarkers();
      }
    },
    setPlaced(next) {
      placed = { ...next };
      colliders = furnitureColliders(slots, placed);
      rebuildFurniture();
      rebuildMarkers();
    },
    dispose() {
      clear(furn);
      clear(markGroup);
      mat.dispose();
      base.dispose();
    },
  };
}

export type { Model as FurnitureModel, Frame as FurnitureFrame };
