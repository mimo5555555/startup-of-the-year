import type { BuildCtx } from '../buildctx';
import { FRONT_Z, SHOPS } from '../layout';
import type { PropsBuilder } from './index';

/**
 * Street props added for the game (slice 3B): the ramen ticket machine in the ramen shop's opening (pick `ramen_machine`)
 * and a station ticket/IC-charge kiosk at the station's west entrance (pick `ticket`, the same id as the machines in the
 * hall). Vending machines already exist as picks `vending`. The app routes all three to panels (`routePick`).
 */
export const PROP_MACHINES = {
  /** the ramen machine's centre x (GAME_DESIGN 6.4 says 15.6) and the id the app routes to the ramen ticket panel */
  ramen: { id: 'ramen_machine', x: 15.6 },
  /** the station kiosk's centre x: just inside the west post of the station opening (x 30..30.6) */
  station: { id: 'ticket', x: 31.3 },
  /** front-to-back extent of both machines: they stand on the line of the shop front, beyond the walkable bounds */
  z: FRONT_Z + 0.25,
  w: 0.8,
  d: 0.4,
  h: 1.5,
};

interface MachineLook {
  body: string;
  header: string;
  screen: string;
  button: string;
  slotGlow: string;
  label: string;
  sub: string;
}

const RAMEN_LOOK: MachineLook = { body: '#3d3a44', header: '#c0392b', screen: '#bfe9ff', button: '#ffe9a8', slotGlow: '#fff6dd', label: '券売機', sub: 'kenbaiki' };
const STATION_LOOK: MachineLook = { body: '#3b6fb6', header: '#2e9e5b', screen: '#bfe9ff', button: '#ffd166', slotGlow: '#8be0c5', label: '券売機', sub: 'kenbaiki' };

/** One ticket machine: body, header, screen, button grid, coin/bill slots and the ticket outlet; merged boxes plus one small sign plane. */
function ticketMachine(ctx: BuildCtx, id: string, x: number, look: MachineLook): void {
  const { solid, glow } = ctx;
  const { z, w, d, h } = PROP_MACHINES;
  const fz = z + d / 2; // front face
  solid.boxB(x, 0, z, w, h, d, look.body);
  solid.boxB(x, h, z, w + 0.06, 0.24, d + 0.06, look.header); // header box
  solid.boxB(x, 0, z, w + 0.1, 0.08, d + 0.1, '#23242b'); // plinth
  glow.boxB(x, 1.08, fz + 0.004, 0.52, 0.24, 0.008, look.screen); // touch screen
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) glow.boxB(x - 0.24 + c * 0.16, 0.72 + r * 0.1, fz + 0.004, 0.11, 0.06, 0.008, (r + c) % 3 === 0 ? '#ff9f6b' : look.button); // buttons
  }
  solid.boxB(x - 0.2, 0.46, fz + 0.002, 0.22, 0.04, 0.01, '#15161b'); // bill slot
  glow.boxB(x - 0.2, 0.465, fz + 0.008, 0.16, 0.012, 0.004, look.slotGlow);
  solid.boxB(x + 0.2, 0.44, fz + 0.002, 0.12, 0.1, 0.01, '#15161b'); // coin slot
  solid.boxB(x, 0.14, fz - 0.02, 0.4, 0.14, 0.05, '#15161b'); // ticket and change outlet
  glow.boxB(x, 0.2, fz + 0.01, 0.3, 0.02, 0.004, look.slotGlow);
  ctx.signPlane(look.label, { bg: look.header, fg: '#fff8ef', sub: look.sub, subColor: '#fff8ef', border: '#ffe2d6', round: 8 }, { x, y: h + 0.12, z: fz + 0.04, w: 0.74, h: 0.2, texW: 256 });
  ctx.pickAt(id, x, 1.0, fz + 0.1, 0.9);
}

export const buildProps: PropsBuilder = (ctx) => {
  const ramen = SHOPS.find((s) => s.id === 'ramen');
  const station = SHOPS.find((s) => s.id === 'station');
  // a machine only stands in front of a shop that exists in this district
  if (ramen) ticketMachine(ctx, PROP_MACHINES.ramen.id, PROP_MACHINES.ramen.x, RAMEN_LOOK);
  if (station) ticketMachine(ctx, PROP_MACHINES.station.id, PROP_MACHINES.station.x, STATION_LOOK);
};
