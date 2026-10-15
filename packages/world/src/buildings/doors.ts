import * as THREE from 'three';
import type { BuildCtx } from '../buildctx';
import type { DoorDef, DoorId } from '../layout';
import { FONT_STACK } from '../textures';
import type { DoorsBuilder } from './index';

// The door facades of the friends' homes (§6.4, wave B1): `door:mio` (a slim apartment block face in the alley mouth),
// `door:kenji` (the stair-up to the family flat in the gap beside the ramen shop) and `door:aiko` (the little door at the
// east end of the tea stall's wall). `door:dorm` is wave B2: TODO(B2) add its 3.6 x 3 x 4.2 box (sign 「寮」) beside the others.
//
// Each facade is merged into the city's two batches (no draw calls of its own) except for one plane: the door plate, a sign
// and a door leaf drawn on one canvas. Closed (the default) the leaf is shut with a padlock and the sign is dimmed; open the
// sign is bright and the leaf swings aside to show the warm doorway behind it. `world.setDoorOpen` calls the plate's
// `userData.setOpen`. So the three doors cost 3 draw calls in all.

interface Look {
  wall: string;
  trim: string;
  roof: string;
  /** the sign's colours */
  signBg: string;
  signFg: string;
  leaf: string;
  /** a lit window and an unlit one */
  lit: string;
  dim: string;
}

const LOOK: Record<'mio' | 'kenji' | 'aiko', Look> = {
  mio: { wall: '#efe3d3', trim: '#e8789e', roof: '#c9b9a8', signBg: '#e8789e', signFg: '#fff8ef', leaf: '#b98757', lit: '#fff0c8', dim: '#8aa6c9' },
  kenji: { wall: '#d9b48a', trim: '#8a5a3a', roof: '#6b5047', signBg: '#f4c64a', signFg: '#4a2e1e', leaf: '#a8744a', lit: '#ffe2a0', dim: '#7f93ab' },
  aiko: { wall: '#f3dfe3', trim: '#5a4030', roof: '#c9b9a8', signBg: '#5f9a55', signFg: '#fff6e6', leaf: '#8a6a4a', lit: '#ffe2a0', dim: '#8aa6c9' },
};

const PX_PER_M = 220;
const WARM = '#ffd9a0';

interface Plate {
  /** centre x, bottom y, z of the plane, and which way it faces (0: +z, PI: -z) */
  x: number;
  y0: number;
  z: number;
  ry: number;
  /** plane size in metres; the sign band is the top `signH` of it and the leaf is `leafW` wide, centred below */
  w: number;
  h: number;
  signH: number;
  leafW: number;
  text: string;
  sub: string;
  look: Look;
}

/** The dynamic part of a door: one plane whose canvas shows the closed or the open state. */
function doorPlate(ctx: BuildCtx, def: DoorDef, p: Plate): THREE.Mesh {
  const tw = Math.round(p.w * PX_PER_M);
  const th = Math.round(p.h * PX_PER_M);
  const draw = (open: boolean) => {
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const g = c.getContext('2d')!;
    const paint = () => {
      g.clearRect(0, 0, tw, th);
      const sh = Math.round(p.signH * PX_PER_M);
      // the sign band
      g.fillStyle = p.look.signBg;
      g.beginPath();
      g.roundRect(3, 3, tw - 6, sh - 6, 12);
      g.fill();
      g.strokeStyle = p.look.signFg;
      g.globalAlpha = 0.55;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(9, 9, tw - 18, sh - 18, 8);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = p.look.signFg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = sh * 0.5;
      g.font = `700 ${size}px ${FONT_STACK}`;
      while (g.measureText(p.text).width > tw - 28 && size > 14) {
        size -= 3;
        g.font = `700 ${size}px ${FONT_STACK}`;
      }
      g.fillText(p.text, tw / 2, sh * 0.42);
      g.globalAlpha = 0.85;
      g.font = `600 ${sh * 0.2}px ${FONT_STACK}`;
      g.fillText(p.sub, tw / 2, sh * 0.78);
      g.globalAlpha = 1;
      if (!open) {
        g.fillStyle = 'rgba(32,30,44,0.5)'; // a sign nobody has switched on
        g.beginPath();
        g.roundRect(3, 3, tw - 6, sh - 6, 12);
        g.fill();
      }
      // the leaf
      const lw = Math.round(p.leafW * PX_PER_M);
      const lx = Math.round((tw - lw) / 2);
      const ly = sh + 4;
      const lh = th - ly;
      if (!open) {
        g.fillStyle = p.look.trim;
        g.fillRect(lx, ly, lw, lh);
        g.fillStyle = p.look.leaf;
        g.fillRect(lx + 6, ly + 6, lw - 12, lh - 6);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(lx + 14, ly + lh * 0.52, lw - 28, lh * 0.38);
        g.fillStyle = 'rgba(255,243,207,0.8)';
        g.fillRect(lx + lw * 0.3, ly + lh * 0.12, lw * 0.4, lh * 0.22); // a frosted pane
        g.fillStyle = '#d6cbb8';
        g.beginPath();
        g.arc(lx + lw * 0.8, ly + lh * 0.55, lw * 0.045, 0, Math.PI * 2);
        g.fill();
        // a padlock: the door cannot be opened yet
        const kx = lx + lw / 2;
        const ky = ly + lh * 0.62;
        g.strokeStyle = '#3a3a46';
        g.lineWidth = Math.max(3, lw * 0.045);
        g.beginPath();
        g.arc(kx, ky - lw * 0.06, lw * 0.1, Math.PI, 0);
        g.stroke();
        g.fillStyle = '#f4c64a';
        g.beginPath();
        g.roundRect(kx - lw * 0.15, ky - lw * 0.07, lw * 0.3, lw * 0.24, 5);
        g.fill();
        g.fillStyle = '#3a3a46';
        g.beginPath();
        g.arc(kx, ky + lw * 0.03, lw * 0.035, 0, Math.PI * 2);
        g.fill();
      } else {
        // open: the leaf stands against the hinge side as a narrow slab, the doorway (the facade's own warm panel) shows
        g.fillStyle = p.look.leaf;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx + lw * 0.2, ly + lh * 0.04);
        g.lineTo(lx + lw * 0.2, th);
        g.lineTo(lx, th);
        g.closePath();
        g.fill();
        g.fillStyle = p.look.trim;
        g.fillRect(lx - 3, ly, 5, lh);
        g.fillRect(lx + lw - 2, ly, 5, lh);
        g.fillRect(lx - 3, ly - 2, lw + 8, 6);
      }
    };
    paint();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // the web fonts arrive after the first frame: draw again then
    (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document?.fonts?.ready?.then(() => {
      paint();
      tex.needsUpdate = true;
    });
    return tex;
  };

  const closed = draw(false);
  let opened: THREE.CanvasTexture | null = null; // drawn the first time the door opens
  const mat = new THREE.MeshBasicMaterial({ map: closed, transparent: true, alphaTest: 0.35, toneMapped: false });
  const geo = new THREE.PlaneGeometry(p.w, p.h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p.x, p.y0 + p.h / 2, p.z);
  mesh.rotation.y = p.ry;
  mesh.name = def.id;
  mesh.userData.doorId = def.id;
  mesh.userData.setOpen = (open: boolean) => {
    if (open && !opened) opened = draw(true);
    mat.map = open ? opened : closed;
    mat.needsUpdate = true;
  };
  ctx.group.add(mesh);
  ctx.own(closed, mat, geo, { dispose: () => opened?.dispose() });
  return mesh;
}

/** the facade box as a collider and a camera occluder (a house is not see-through) */
function body(ctx: BuildCtx, def: DoorDef) {
  const r = def.body!.rect;
  ctx.collideRect(r);
  ctx.occlude({ ...r, y0: 0, y1: def.body!.h });
}

/** four small windows in two rows on a facade; `faceZ` is the wall plane, `dir` +1 when the facade faces +z */
function windows(ctx: BuildCtx, look: Look, xs: number[], ys: number[], faceZ: number, dir: 1 | -1, w = 0.9, h = 1.0, litMask = 0b1010) {
  let i = 0;
  for (const y of ys) {
    for (const x of xs) {
      const lit = (litMask >> i) & 1;
      const z = faceZ + dir * 0.02;
      ctx.solid.boxB(x, y - 0.06, faceZ + dir * 0.04, w + 0.2, 0.08, 0.1, look.trim); // sill
      ctx.solid.boxB(x, y + h, faceZ + dir * 0.04, w + 0.2, 0.08, 0.08, look.trim); // lintel
      for (const sx of [-1, 1]) ctx.solid.boxB(x + (sx * (w + 0.08)) / 2, y, faceZ + dir * 0.04, 0.08, h, 0.08, look.trim);
      (lit ? ctx.glow : ctx.solid).boxB(x, y, z, w, h, 0.02, lit ? look.lit : look.dim);
      ctx.solid.boxB(x, y, z + dir * 0.015, 0.04, h, 0.02, look.trim);
      i++;
    }
  }
}

const buildMio = (ctx: BuildCtx, def: DoorDef) => {
  const { solid, glow } = ctx;
  const L = LOOK.mio;
  const r = def.body!.rect;
  const H = def.body!.h;
  const cx = (r.x0 + r.x1) / 2;
  const zf = r.z0; // the face the street sees (it faces -z)
  const D = r.z1 - r.z0;
  const hw = 0.65; // half the doorway
  const dh = 2.1;
  const rec = 0.3; // how far the doorway is cut into the slab
  // piers, the block above the doorway, the roof lip
  for (const s of [-1, 1]) solid.boxB(cx + s * ((r.x1 - r.x0 + 2 * hw) / 4), 0, (r.z0 + r.z1) / 2, (r.x1 - r.x0 - 2 * hw) / 2, H, D, L.wall);
  solid.boxB(cx, dh, (r.z0 + r.z1) / 2, 2 * hw, H - dh, D, L.wall);
  solid.boxB(cx, 0, zf + rec + (D - rec) / 2, 2 * hw, dh, D - rec, L.wall); // the back of the doorway
  glow.boxB(cx, 0.12, zf + rec, 2 * hw - 0.04, dh - 0.12, 0.02, WARM); // the hall light behind the leaf
  solid.boxB(cx, 0, zf + rec / 2, 2 * hw, 0.12, rec, '#bdb4a6'); // the doorstep
  solid.boxB(cx, H, (r.z0 + r.z1) / 2, r.x1 - r.x0 + 0.3, 0.22, D + 0.3, L.roof);
  solid.boxB(cx, 2.85, zf - 0.04, r.x1 - r.x0 + 0.1, 0.12, 0.1, L.trim); // a pink band over the sign
  solid.boxB(cx, 0, zf - 0.02, r.x1 - r.x0, 0.14, 0.05, '#bdb4a6'); // plinth
  // windows on two floors and a balcony rail on the upper right
  const ys = [3.6, 5.0];
  windows(ctx, L, [cx - 1.15, cx + 1.15], ys, zf, -1, 0.9, 1.0, 0b0110);
  solid.boxB(cx + 1.15, ys[0] - 0.05, zf - 0.2, 1.3, 0.06, 0.34, L.trim);
  solid.boxB(cx + 1.15, ys[0] - 0.05, zf - 0.36, 1.3, 0.5, 0.025, L.trim);
  for (let i = 0; i < 6; i++) solid.boxB(cx + 0.55 + i * 0.24, ys[0] - 0.05, zf - 0.36, 0.025, 0.5, 0.025, L.trim);
  // mailboxes beside the door and a number plate
  for (let i = 0; i < 3; i++) solid.boxB(cx - 1.4, 1.0 + i * 0.22, zf - 0.04, 0.3, 0.18, 0.08, ['#d8433f', '#2e9e5b', '#4f86f7'][i]);
  solid.boxB(cx + 1.4, 1.5, zf - 0.03, 0.34, 0.2, 0.05, '#fff8ef');
  // a warm lamp over the door
  glow.sphere(cx + 0.9, 2.45, zf - 0.12, 0.09, '#ffe2a0', { ws: 6, hs: 4 });
  body(ctx, def);
  ctx.pickAt(def.id, def.pick.x, def.pick.y, def.pick.z, def.radius);
  doorPlate(ctx, def, { x: cx, y0: 0, z: zf - 0.02, ry: Math.PI, w: 1.8, h: 2.8, signH: 0.62, leafW: 2 * hw, text: def.sign.text, sub: def.sign.sub, look: L });
};

const buildKenji = (ctx: BuildCtx, def: DoorDef) => {
  const { solid, glow } = ctx;
  const L = LOOK.kenji;
  const r = def.body!.rect;
  const H = def.body!.h;
  const cx = (r.x0 + r.x1) / 2;
  const zf = r.z1; // the face the street sees (it faces +z)
  const D = r.z1 - r.z0;
  const hw = 0.62;
  const dh = 2.3;
  const rec = 1.0; // the stairwell is cut a metre into the box
  // the stairwell stands in the right part of the box: the ramen shop's nobori banner (x 27.3, in front of the box's middle)
  // and the lamp post (x 28) would hide a door at the centre line
  const dx = r.x1 - 0.9;
  const lw = dx - hw - r.x0; // the left pier
  const rw = r.x1 - (dx + hw); // the right pier
  solid.boxB(r.x0 + lw / 2, 0, (r.z0 + r.z1) / 2, lw, H, D, L.wall);
  solid.boxB(r.x1 - rw / 2, 0, (r.z0 + r.z1) / 2, rw, H, D, L.wall);
  solid.boxB(dx, dh, (r.z0 + r.z1) / 2, 2 * hw, H - dh, D, L.wall);
  solid.boxB(dx, 0, r.z0 + (D - rec) / 2, 2 * hw, dh, D - rec, '#6b5047'); // the back of the stairwell
  glow.boxB(dx, 0.12, zf - rec, 2 * hw - 0.04, dh - 0.12, 0.02, WARM);
  // the stairs inside: four steps rising towards the back, so an open door shows a way up
  for (let i = 0; i < 4; i++) solid.boxB(dx, 0, zf - 0.2 - i * 0.2, 2 * hw - 0.06, 0.18 + i * 0.2, 0.2, i % 2 ? '#a7845f' : '#b99468');
  // two outer steps in front of the door
  solid.boxB(dx, 0, zf + 0.09, 2 * hw + 0.3, 0.1, 0.18, '#c2b8a8');
  solid.boxB(dx, 0, zf + 0.0, 2 * hw + 0.1, 0.2, 0.04, '#b0a696');
  solid.boxB(cx, H, (r.z0 + r.z1) / 2, r.x1 - r.x0 + 0.3, 0.24, D + 0.3, L.roof);
  solid.boxB(cx, 2.62, zf + 0.04, r.x1 - r.x0 + 0.1, 0.14, 0.1, L.trim);
  solid.boxB(cx, 0, zf + 0.02, r.x1 - r.x0, 0.14, 0.05, '#a69a8a');
  // the flat above: a lit window, a dark one, the washing pole with towels and the air conditioner
  windows(ctx, L, [cx - 1.0, cx + 1.0], [3.5, 5.0], zf, 1, 0.85, 1.0, 0b1001);
  solid.boxB(cx, 4.6, zf + 0.34, 3.0, 0.04, 0.04, '#6d6f7a');
  for (const [dx, c] of [[-0.9, '#e8789e'], [-0.2, '#ffffff'], [0.5, '#4f86f7'], [1.0, '#f4c64a']] as const) solid.boxB(cx + dx, 4.05, zf + 0.34, 0.34, 0.55, 0.03, c);
  solid.boxB(cx + 1.0, 2.9, zf + 0.12, 0.7, 0.3, 0.22, '#e3e6ea');
  glow.sphere(dx - 0.85, 2.45, zf + 0.14, 0.09, '#ffe2a0', { ws: 6, hs: 4 });
  body(ctx, def);
  ctx.pickAt(def.id, def.pick.x, def.pick.y, def.pick.z, def.radius);
  doorPlate(ctx, def, { x: dx, y0: 0, z: zf + 0.02, ry: 0, w: 1.7, h: 2.95, signH: 0.62, leafW: 2 * hw, text: def.sign.text, sub: def.sign.sub, look: L });
};

/**
 * Aiko's door has no box of its own: the flat above her stall has its entrance on a small balcony in the wall above the
 * awning, east of the sign (the stall below, shutter or not, covers the ground floor of that wall). The layout's pick
 * (38.2, 1.2, 9.55) stays as the low tap target; the balcony door is the second pick of the same id.
 */
const buildAiko = (ctx: BuildCtx, def: DoorDef) => {
  const { solid, glow } = ctx;
  const L = LOOK.aiko;
  const wallZ = 9.7; // the face of the florist front (SOUTH_FRONT.z0)
  const x = 38.42;
  const hw = 0.28;
  const y0 = 3.6; // the balcony floor: above the awning's back edge (3.15)
  const dh = 1.8;
  // balcony: slab, a front rail and two side rails
  solid.boxB(x, y0 - 0.12, wallZ - 0.3, 0.9, 0.12, 0.6, '#8a6a4a');
  solid.boxB(x, y0 + 0.5, wallZ - 0.58, 0.9, 0.05, 0.04, L.trim);
  for (const s of [-1, 1]) {
    solid.boxB(x + s * 0.43, y0 + 0.5, wallZ - 0.3, 0.04, 0.05, 0.6, L.trim);
    solid.boxB(x + s * 0.43, y0, wallZ - 0.58, 0.04, 0.5, 0.04, L.trim);
  }
  for (let i = 0; i < 5; i++) solid.boxB(x - 0.34 + i * 0.17, y0, wallZ - 0.58, 0.025, 0.5, 0.025, L.trim);
  // the door frame, the stairwell light behind the leaf, a lamp
  for (const s of [-1, 1]) solid.boxB(x + s * (hw + 0.04), y0, wallZ - 0.05, 0.08, dh + 0.06, 0.1, L.trim);
  solid.boxB(x, y0 + dh, wallZ - 0.05, 2 * hw + 0.16, 0.08, 0.1, L.trim);
  glow.boxB(x, y0 + 0.02, wallZ - 0.02, 2 * hw, dh - 0.02, 0.02, WARM);
  glow.sphere(x - 0.46, y0 + 1.7, wallZ - 0.16, 0.07, '#ffe2a0', { ws: 6, hs: 4 });
  ctx.pickAt(def.id, def.pick.x, def.pick.y, def.pick.z, def.radius);
  ctx.pickAt(def.id, x, y0 + 1.0, wallZ - 0.3, 0.9);
  doorPlate(ctx, def, { x, y0, z: wallZ - 0.075, ry: Math.PI, w: 0.74, h: dh + 0.4, signH: 0.4, leafW: 2 * hw, text: def.sign.text, sub: def.sign.sub, look: L });
};

const BUILDERS: Partial<Record<DoorId, (ctx: BuildCtx, def: DoorDef) => void>> = {
  'door:mio': buildMio,
  'door:kenji': buildKenji,
  'door:aiko': buildAiko,
};

export const buildDoors: DoorsBuilder = (ctx, doors) => {
  for (const d of doors) BUILDERS[d.id]?.(ctx, d);
};
