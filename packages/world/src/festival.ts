// Festival night: the dusk lighting preset the world fades to on `setFestival(true)`, and the seam where slice 5B
// puts the park stalls, lanterns and fireworks. The world has no day/night cycle, so "night" is this one preset.
import * as THREE from 'three';
import { COLORS } from './palette';

/** How long the lighting takes to fade between day and dusk, in seconds. */
export const FESTIVAL_FADE_S = 1.6;

export interface LightingPreset {
  sky: { top: string; mid: string; bottom: string };
  /** fog and clear colour (kept equal so the horizon has no seam) */
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  /** multipliers on the quality-dependent hemisphere and sun intensities */
  hemiK: number;
  sunK: number;
  /** direction towards the sun (normalised by the world); lower elevation at dusk */
  sunDir: [number, number, number];
}

/** What the world looked like before the preset existed; fading back to it restores the original look exactly. */
export const DAY_LIGHTING: LightingPreset = {
  sky: COLORS.sky,
  fog: COLORS.fog,
  hemiSky: COLORS.hemiSky,
  hemiGround: COLORS.hemiGround,
  sun: COLORS.sun,
  hemiK: 1,
  sunK: 1,
  sunDir: [-0.55, 0.42, 0.72],
};

export const DUSK_LIGHTING: LightingPreset = {
  sky: { top: '#353b82', mid: '#c0749c', bottom: '#ffb07a' },
  fog: '#dca08f',
  hemiSky: '#8c93df',
  hemiGround: '#e9a58e',
  sun: '#ff9a5c',
  hemiK: 0.74,
  sunK: 0.62,
  sunDir: [-0.7, 0.2, 0.68],
};

/** A preset resolved to THREE colours, reused frame to frame so a fade allocates nothing. */
export interface Lighting {
  skyTop: THREE.Color;
  skyMid: THREE.Color;
  skyBottom: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  sun: THREE.Color;
  hemiK: number;
  sunK: number;
  sunDir: THREE.Vector3;
}

export const newLighting = (): Lighting => ({
  skyTop: new THREE.Color(),
  skyMid: new THREE.Color(),
  skyBottom: new THREE.Color(),
  fog: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  sun: new THREE.Color(),
  hemiK: 1,
  sunK: 1,
  sunDir: new THREE.Vector3(),
});

const A = new THREE.Color();
const B = new THREE.Color();
const VA = new THREE.Vector3();
const VB = new THREE.Vector3();
const mix = (out: THREE.Color, a: string, b: string, t: number) => {
  if (t <= 0) return out.set(a);
  if (t >= 1) return out.set(b);
  return out.copy(A.set(a)).lerp(B.set(b), t);
};
const mixN = (a: number, b: number, t: number) => (t <= 0 ? a : t >= 1 ? b : a + (b - a) * t);

/** out = a at t = 0, b at t = 1 (exactly: the ends are the presets' own colours, not a rounded blend). */
export function mixLighting(out: Lighting, a: LightingPreset, b: LightingPreset, t: number): Lighting {
  mix(out.skyTop, a.sky.top, b.sky.top, t);
  mix(out.skyMid, a.sky.mid, b.sky.mid, t);
  mix(out.skyBottom, a.sky.bottom, b.sky.bottom, t);
  mix(out.fog, a.fog, b.fog, t);
  mix(out.hemiSky, a.hemiSky, b.hemiSky, t);
  mix(out.hemiGround, a.hemiGround, b.hemiGround, t);
  mix(out.sun, a.sun, b.sun, t);
  out.hemiK = mixN(a.hemiK, b.hemiK, t);
  out.sunK = mixN(a.sunK, b.sunK, t);
  out.sunDir.copy(VA.set(...a.sunDir).normalize()).lerp(VB.set(...b.sunDir).normalize(), Math.min(1, Math.max(0, t))).normalize();
  return out;
}

/** The shared materials a festival builder draws with (one merged Batch each, like every other building). */
export interface FestivalMaterials {
  toon: THREE.Material;
  glow: THREE.Material;
}

export interface FestivalHandle {
  /** the park stalls, lanterns and fireworks; the world shows it while the festival is on */
  group: THREE.Group;
  update?(dt: number, t: number, player: THREE.Vector3): void;
  dispose(): void;
}

/**
 * The festival scenery (6 stalls with awnings and noren, 20 lanterns on strings, fireworks over the pond), slice 5B.
 * Built lazily on the first `setFestival(true)`, so a world that never holds a festival pays nothing for it.
 * Stub: an empty group, so the dusk preset works on its own.
 */
export function buildFestival(_materials: FestivalMaterials): FestivalHandle {
  return { group: new THREE.Group(), dispose() {} };
}
