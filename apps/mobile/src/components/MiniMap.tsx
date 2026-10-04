import { useEffect, useRef } from 'react';
import type { TokyoWorld } from '@lw/world';

const SIZE = 104;
const RANGE = 38;

/** Rotating radar-style map: up is where the camera is looking. */
export function MiniMap({ world, target }: { world: TokyoWorld; target?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = SIZE * dpr;
    c.height = SIZE * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const rects = world.mapRects();
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 110) return;
      last = t;
      const s = world.snapshot();
      const yaw = s.camYaw;
      const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      const k = SIZE / 2 / RANGE;
      const toScreen = (x: number, z: number) => {
        const dx = x - s.player.x;
        const dz = z - s.player.z;
        return { x: SIZE / 2 + (dx * right.x + dz * right.z) * k, y: SIZE / 2 - (dx * fwd.x + dz * fwd.z) * k };
      };
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(46,40,78,0.86)';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (const r of rects) {
        const pts = [toScreen(r.x0, r.z0), toScreen(r.x1, r.z0), toScreen(r.x1, r.z1), toScreen(r.x0, r.z1)];
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = r.color;
        ctx.globalAlpha = r.color === '#8f95a8' ? 0.55 : 0.85;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const n of s.npcs) {
        const p = toScreen(n.x, n.z);
        const isTarget = n.id === target;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isTarget ? 4.6 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = isTarget ? '#ffd166' : '#ffffff';
        ctx.fill();
        if (isTarget) {
          ctx.strokeStyle = 'rgba(255,209,102,0.55)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      // player arrow, relative to the camera
      const rel = s.player.heading - yaw - Math.PI; // heading 0 faces +z; screen-up is camera forward
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.rotate(-rel + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fillStyle = '#ef6f91';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [world, target]);
  return <canvas ref={ref} className="minimap" style={{ width: SIZE, height: SIZE }} aria-hidden="true" />;
}
