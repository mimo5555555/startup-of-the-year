import { useEffect, useRef } from 'react';
import type { TokyoWorld } from '@lw/world';
import type { MapPin } from '../game/worldSync';

const SIZE = 104;
const RANGE = 38;
/** a pin beyond the map's edge is drawn on the rim, so the map still says which way to go */
const RIM = SIZE / 2 - 7;

/**
 * Rotating radar-style map: up is where the camera is looking. `target` highlights an NPC; `pin` (a tracker goal, an objective, a
 * plan from chat) is an NPC or a point, and sits on the rim when it is out of range.
 */
export function MiniMap({ world, target, pin, plans }: { world: TokyoWorld; target?: string | null; pin?: MapPin | null; plans?: readonly string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pinRef = useRef<MapPin | null>(pin ?? null);
  pinRef.current = pin ?? null;
  // friends the player agreed to meet today (a chat plan, phoneLogic.mapPins): pink, and on the rim when out of range
  const plansRef = useRef<readonly string[]>(plans ?? []);
  plansRef.current = plans ?? [];
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
      const pinned = pinRef.current;
      const pinNpc = pinned && 'npc' in pinned ? pinned.npc : null;
      for (const n of s.npcs) {
        const p = toScreen(n.x, n.z);
        const isPlan = plansRef.current.includes(n.id);
        const isTarget = n.id === target || n.id === pinNpc;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isTarget || isPlan ? 4.6 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = isTarget ? '#ffd166' : isPlan ? '#ff8fb1' : '#ffffff';
        ctx.fill();
        if (isTarget || isPlan) {
          ctx.strokeStyle = isTarget ? 'rgba(255,209,102,0.55)' : 'rgba(255,143,177,0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      // a pin that is a point, or an NPC out of range, on the rim when it is too far for the map
      const drawPin = (at: { x: number; z: number } | undefined, isNpc: boolean, colour: string) => {
        if (!at) return;
        let p = toScreen(at.x, at.z);
        const off = Math.hypot(p.x - SIZE / 2, p.y - SIZE / 2);
        const far = off > RIM;
        if (far) p = { x: SIZE / 2 + ((p.x - SIZE / 2) / off) * RIM, y: SIZE / 2 + ((p.y - SIZE / 2) / off) * RIM };
        if (!far && isNpc) return;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5.5);
        ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 5.5);
        ctx.lineTo(p.x - 5, p.y);
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.strokeStyle = '#2e284e';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      };
      for (const id of plansRef.current) drawPin(s.npcs.find((n) => n.id === id), true, '#ff8fb1');
      if (pinned) drawPin('npc' in pinned ? s.npcs.find((n) => n.id === pinned.npc) : pinned, 'npc' in pinned, '#ffd166');
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
  return <canvas ref={ref} className="minimap" data-plans={plansRef.current.join(' ')} style={{ width: SIZE, height: SIZE }} aria-hidden="true" />;
}
