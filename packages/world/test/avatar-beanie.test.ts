// A beanie (Rin's) must not cover her eyes: the knit's lower edge stays above the eye line (it sat on it and hid the upper half of the eyes).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../src/avatar';

const ACCENT = '#f4c542';
const SPEC = { skin: '#f4d0b4', hair: { style: 'short' as const, color: '#7a2f3a' }, top: '#ee8fa6', bottom: '#2d3142', shoes: '#ffffff', accent: ACCENT, accessories: ['beanie' as const] };

describe('avatar beanie', () => {
  it('leaves the eyes and brows clear (the front of the knit ends above the eye line)', () => {
    const a = new Avatar(SPEC, new THREE.MeshBasicMaterial({ vertexColors: true }));
    const want = new THREE.Color(ACCENT);
    let lowestFront = Infinity;
    let eyeTop = -Infinity;
    a.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry.getAttribute('color')) return;
      const pos = m.geometry.getAttribute('position');
      const col = m.geometry.getAttribute('color');
      m.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const isAccent = Math.abs(col.getX(i) - want.r) < 0.01 && Math.abs(col.getY(i) - want.g) < 0.01 && Math.abs(col.getZ(i) - want.b) < 0.01;
        if (isAccent && v.z > 0.2 && v.y > 1.0) lowestFront = Math.min(lowestFront, v.y);
      }
      if (m === (a as unknown as { eyes: THREE.Mesh }).eyes) {
        const box = new THREE.Box3().setFromObject(m);
        eyeTop = box.max.y;
      }
    });
    expect(eyeTop).toBeGreaterThan(0);
    expect(lowestFront).toBeGreaterThan(eyeTop);
  });
});
