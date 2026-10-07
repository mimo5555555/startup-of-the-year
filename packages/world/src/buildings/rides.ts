import type * as THREE from 'three';

export type RideKind = 'bike' | 'ebike' | 'car';

/** The world's shared materials; a ride mesh is one merged Batch built with `toon` (and `glow` for lights). */
export interface RideMaterials {
  toon: THREE.Material;
  glow: THREE.Material;
}

/**
 * The mesh `world.setRide(kind)` mounts under the player (origin at the ground, +z forward), slice 3B.
 * Stub: null mounts nothing. The world disposes whatever geometry the mesh holds.
 */
export function buildRide(_kind: RideKind, _mats: RideMaterials): THREE.Object3D | null {
  return null;
}
