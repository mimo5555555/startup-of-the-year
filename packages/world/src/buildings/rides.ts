import * as THREE from 'three';
import { Batch } from '../batch';
import { BIKE, KEI_SEAT_X, addBike, addKei, anchorFor, type BikeLook, type KeiLook } from './vehicles';

export type RideKind = 'bike' | 'ebike' | 'car';

/** The world's shared materials; a ride mesh is one merged Batch built with `toon` (and `glow` for lights). */
export interface RideMaterials {
  toon: THREE.Material;
  glow: THREE.Material;
}

// ---------------------------------------------------------------------------------------------------------------
// Ride meshes
// ---------------------------------------------------------------------------------------------------------------

/** What a ride is drawn with. The player's own: a blue mamachari, a teal e-bike, a mint open-top kei car. */
export const RIDE_LOOKS = {
  bike: { frame: '#3b6fb6' } satisfies BikeLook,
  ebike: { frame: '#1f9e8f', ebike: true } satisfies BikeLook,
  car: { body: '#7fd6b8', accent: '#2e9e5b', open: true } satisfies KeiLook,
};

/**
 * The mesh `world.setRide(kind)` mounts under the player (origin at the ground, +z forward, the rider's seat at the
 * origin). One toon mesh plus, when the ride has lamps, one glow mesh, both with the world's shared materials; the
 * world disposes the geometry. Returns null for a kind it cannot draw.
 */
export function buildRide(kind: RideKind, mats: RideMaterials): THREE.Object3D | null {
  const solid = new Batch();
  const glow = new Batch();
  const forward = -Math.PI / 2; // local +x becomes world +z
  if (kind === 'bike' || kind === 'ebike') {
    const a = anchorFor(BIKE.saddleX * BIKE.rideScale, forward);
    addBike(solid, glow, a.x, a.z, forward, RIDE_LOOKS[kind], { k: BIKE.rideScale });
  } else if (kind === 'car') {
    const a = anchorFor(KEI_SEAT_X, forward);
    addKei(solid, glow, a.x, a.z, forward, RIDE_LOOKS.car);
  } else {
    return null;
  }
  const root = new THREE.Group();
  root.name = `ride-${kind}`;
  const body = solid.build(mats.toon, { cast: true, receive: false, name: `ride-${kind}-body` });
  if (body) root.add(body);
  const lamps = glow.build(mats.glow, { cast: false, receive: false, name: `ride-${kind}-lamps` });
  if (lamps) root.add(lamps);
  return body ? root : null;
}
