import * as THREE from 'three';
import type { AvatarSpec, Character, Emotion } from '@lw/content';
import { Avatar, DEFAULT_PLAYER } from './avatar';
import { toonRamp } from './batch';
import { buildCity, type City } from './city';
import { BOUNDS, NPC_SPAWNS, PLAYER_START, WALKERS } from './layout';
import { COLORS } from './palette';
import { bubbleTexture, labelTexture, sparkleTexture, watchFonts, blobTexture } from './textures';

export type Badge = 'none' | 'new' | 'lesson' | 'done';
export type Quality = 'high' | 'low';

export type WorldEvent =
  | { type: 'nearby'; id: string | null }
  | { type: 'pick'; id: string; x: number; y: number }
  | { type: 'ready' }
  | { type: 'quality'; quality: Quality };

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  characters: Character[];
  playerSpec?: AvatarSpec;
  quality?: Quality | 'auto';
  /** label shown over each NPC, by id (falls back to the Japanese name) */
  labels?: Record<string, string>;
}

export interface WorldSnapshot {
  player: { x: number; z: number; heading: number };
  camYaw: number;
  nearby: string | null;
  npcs: Array<{ id: string; x: number; z: number }>;
  inConversation: boolean;
}

const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 4.1;
const RUN_SPEED = 6.6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const easeInOut = (x: number) => x * x * (3 - 2 * x);

interface Npc {
  id: string;
  avatar: Avatar;
  home: THREE.Vector3;
  face: number;
  radius: number;
  kind: 'scenario' | 'lesson';
  badge: THREE.Sprite;
  label: THREE.Sprite;
  badgeKind: Badge;
  facing: number;
}

interface Walker {
  avatar: Avatar;
  points: THREE.Vector3[];
  index: number;
  speed: number;
  loop: boolean;
}

export class TokyoWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  private city: City;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private toon: THREE.MeshToonMaterial;
  private ramp: THREE.DataTexture;
  private blobMat: THREE.MeshBasicMaterial;

  private player!: Avatar;
  private playerPos = new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z);
  private playerHeading = PLAYER_START.heading;
  private vel = new THREE.Vector3();
  private npcs: Npc[] = [];
  private walkers: Walker[] = [];
  private sparkles: Array<{ id: string; sprite: THREE.Sprite; base: number }> = [];
  private discovered = new Set<string>();
  private labelCache = new Map<string, THREE.Texture>();

  // input
  private keys = new Set<string>();
  private stick = new THREE.Vector2();
  private moveTarget: THREE.Vector3 | null = null;
  private moveTimer = 0;
  private marker: THREE.Mesh;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean }>();
  private pinch = 0;

  // camera state
  private yaw = 0;
  private pitch = 0.4;
  private dist = 7.6;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private convBlend = 0;
  private baseFov = 55;
  private conv: { npc: Npc; t: number; playerBowed: boolean } | null = null;

  private listeners = new Set<(e: WorldEvent) => void>();
  private raf = 0;
  private last = 0;
  private time = 0;
  private running = false;
  private active = true;
  private paused = false;
  private nearbyId: string | null = null;
  private quality: Quality = 'high';
  private auto: boolean;
  private frames = 0;
  private frameAcc = 0;
  private width = 1;
  private height = 1;
  private fpsCap = 60;
  private ro?: ResizeObserver;
  private readonly bound: Array<[EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions?]> = [];
  private raycaster = new THREE.Raycaster();

  constructor(private opts: WorldOptions) {
    const { canvas } = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(COLORS.fog);
    this.scene.background = new THREE.Color(COLORS.fog);
    this.scene.fog = new THREE.Fog(COLORS.fog, 58, 250);
    this.auto = opts.quality === undefined || opts.quality === 'auto';

    watchFonts();
    this.ramp = toonRamp([0.5, 0.74, 0.92, 1]);
    this.toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.ramp });
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTexture('rgba(30,20,40,0.5)', 'rgba(30,20,40,0)', 64), transparent: true, depthWrite: false });

    // lights: warm low sun plus a sky/ground fill
    this.hemi = new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 1.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(COLORS.sun, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -34;
    this.sun.shadow.camera.right = 34;
    this.sun.shadow.camera.top = 34;
    this.sun.shadow.camera.bottom = -34;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);

    this.city = buildCity();
    this.scene.add(this.city.group);

    // player
    this.player = new Avatar(opts.playerSpec ?? DEFAULT_PLAYER, this.toon, this.blobMat);
    this.scene.add(this.player.root);

    // NPCs
    const sparkleTex = sparkleTexture();
    for (const spawn of NPC_SPAWNS) {
      const ch = opts.characters.find((c) => c.id === spawn.id);
      if (!ch) continue;
      const avatar = new Avatar(ch.avatar, this.toon, this.blobMat);
      avatar.root.position.set(spawn.x, spawn.y ?? 0, spawn.z);
      avatar.root.rotation.y = spawn.face;
      this.scene.add(avatar.root);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture('talk'), transparent: true, depthWrite: false, depthTest: false, fog: false }));
      badge.renderOrder = 20;
      badge.scale.set(0.95, 0.95, 1);
      badge.position.set(spawn.x, 2.55 + (spawn.y ?? 0), spawn.z);
      this.scene.add(badge);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelFor(opts.labels?.[ch.id] ?? ch.name.ja), transparent: true, depthWrite: false, depthTest: false, fog: false }));
      label.renderOrder = 21;
      label.scale.set(1.9, 0.48, 1);
      label.position.set(spawn.x, 2.12 + (spawn.y ?? 0), spawn.z);
      this.scene.add(label);
      this.npcs.push({
        id: ch.id,
        avatar,
        home: new THREE.Vector3(spawn.x, spawn.y ?? 0, spawn.z),
        face: spawn.face,
        facing: spawn.face,
        radius: spawn.radius,
        kind: spawn.kind,
        badge,
        label,
        badgeKind: spawn.kind === 'lesson' ? 'lesson' : 'new',
      });
      (badge.material as THREE.SpriteMaterial).map = bubbleTexture(spawn.kind === 'lesson' ? 'lesson' : 'talk');
    }

    // ambient walkers share the character look-alikes
    const walkerSpecs: AvatarSpec[] = [
      { skin: '#f1c9a6', hair: { style: 'short', color: '#2a2224' }, top: '#e8c547', bottom: '#3a4058', shoes: '#f5f5f5', accent: '#ffffff', accessories: ['backpack'] },
      { skin: '#f6d3ba', hair: { style: 'long', color: '#3a2c3e' }, top: '#d9627a', bottom: '#ece6dc', shoes: '#8a5a3a', accent: '#ffffff', accessories: ['scarf'] },
      { skin: '#e9c19c', hair: { style: 'bun', color: '#d9d9de' }, top: '#8aa6c9', bottom: '#4a4a55', shoes: '#4a3f3a', accent: '#f4c542', accessories: ['glasses'] },
      { skin: '#f8dcc6', hair: { style: 'ponytail', color: '#6b3f2e' }, top: '#6bc7a6', bottom: '#2f3a57', shoes: '#ffffff', accent: '#f08fa8', accessories: ['camera'] },
      { skin: '#e8bd98', hair: { style: 'spiky', color: '#1f1b1d' }, top: '#3b3f5c', bottom: '#2a2d3e', shoes: '#d8433f', accent: '#f4f4f4', accessories: ['beanie'] },
    ];
    for (const w of WALKERS) {
      const avatar = new Avatar(walkerSpecs[w.spec % walkerSpecs.length], this.toon, this.blobMat);
      const pts = w.route.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
      avatar.root.position.copy(pts[0]);
      this.scene.add(avatar.root);
      this.walkers.push({ avatar, points: pts, index: 1, speed: w.route.speed, loop: w.route.loop });
    }

    // sparkles hint at things you can tap and learn
    for (const p of this.city.pickables) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
      sprite.scale.set(0.4, 0.4, 1);
      sprite.position.copy(p.pos).add(new THREE.Vector3(0, p.radius > 1.5 ? 0.9 : 0.55, 0));
      this.scene.add(sprite);
      this.sparkles.push({ id: p.id, sprite, base: sprite.position.y });
    }

    // tap marker
    const ring = new THREE.RingGeometry(0.28, 0.4, 28);
    ring.rotateX(-Math.PI / 2);
    this.marker = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    this.marker.visible = false;
    this.marker.position.y = 0.06;
    this.scene.add(this.marker);

    this.setQuality(opts.quality === 'low' ? 'low' : 'high', true);
    this.bindInput(canvas);
    this.resize();
    this.dist = this.camera.aspect < 1 ? 9.2 : 7.6;
    this.yaw = 0.18;
    this.snapCamera();
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
    }
  }

  // ---------------- public api ----------------

  on(fn: (e: WorldEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit(e: WorldEvent) {
    for (const l of this.listeners) l(e);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const minDt = 1000 / this.fpsCap - 1;
      if (now - this.last < minDt) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.active) return;
      this.step(dt);
      this.renderer.render(this.scene, this.camera);
      this.watchPerformance(dt);
    };
    this.raf = requestAnimationFrame(loop);
    this.emit({ type: 'ready' });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** false hides the world from the render loop entirely (full-screen panels) */
  setActive(on: boolean) {
    this.active = on;
    if (on) this.last = performance.now();
  }
  setPaused(on: boolean) {
    this.paused = on;
  }
  setFpsCap(fps: number) {
    this.fpsCap = clamp(fps, 15, 120);
  }

  setMove(x: number, y: number) {
    this.stick.set(clamp(x, -1, 1), clamp(y, -1, 1));
    if (this.stick.lengthSq() > 0.01) this.moveTarget = null;
  }

  setNpcBadge(id: string, badge: Badge) {
    const n = this.npcs.find((x) => x.id === id);
    if (!n) return;
    n.badgeKind = badge;
    const m = n.badge.material as THREE.SpriteMaterial;
    if (badge !== 'none') m.map = bubbleTexture(badge === 'done' ? 'done' : badge === 'lesson' ? 'lesson' : 'talk');
    m.needsUpdate = true;
  }

  setNpcLabels(labels: Record<string, string>) {
    for (const n of this.npcs) {
      const text = labels[n.id];
      if (!text) continue;
      const m = n.label.material as THREE.SpriteMaterial;
      m.map = this.labelFor(text);
      m.needsUpdate = true;
    }
  }

  setDiscovered(ids: Iterable<string>) {
    this.discovered = new Set(ids);
  }

  setPlayerSpec(spec: AvatarSpec) {
    const old = this.player;
    const root = this.player.root;
    const pos = root.position.clone();
    const rot = root.rotation.y;
    this.player = new Avatar(spec, this.toon, this.blobMat);
    this.player.root.position.copy(pos);
    this.player.root.rotation.y = rot;
    this.scene.add(this.player.root);
    this.scene.remove(old.root);
    old.dispose();
  }

  setQuality(q: Quality, silent = false) {
    this.quality = q;
    const high = q === 'high';
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, high ? 2 : 1.25));
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.sun.shadow.mapSize.set(high ? 2048 : 512, high ? 2048 : 512);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as unknown as { map: unknown }).map = null;
    this.player?.setBlob(!high);
    for (const n of this.npcs) n.avatar.setBlob(!high);
    for (const w of this.walkers) w.avatar.setBlob(!high);
    this.hemi.intensity = high ? 1.95 : 2.3;
    this.sun.intensity = high ? 2.2 : 1.2;
    this.renderer.setSize(this.width, this.height, false);
    if (!silent) this.emit({ type: 'quality', quality: q });
  }
  getQuality() {
    return this.quality;
  }
  /** 'auto' starts high and drops to light graphics if frames run slow */
  setQualityMode(mode: Quality | 'auto') {
    this.auto = mode === 'auto';
    this.frames = 0;
    this.frameAcc = 0;
    this.setQuality(mode === 'auto' ? 'high' : mode);
  }

  resize() {
    const c = this.opts.canvas;
    const parent = c.parentElement;
    const w = Math.max(1, Math.floor(parent?.clientWidth ?? c.clientWidth ?? 1));
    const h = Math.max(1, Math.floor(parent?.clientHeight ?? c.clientHeight ?? 1));
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    c.style.width = '100%';
    c.style.height = '100%';
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.baseFov = aspect >= 1 ? 52 : clamp(52 + (1 - aspect) * 40, 52, 80);
    this.camera.fov = this.baseFov;
    this.applyViewOffset();
  }

  /** put the player in front of someone (used by tests and the "take me there" action) */
  teleportNear(id: string) {
    const n = this.npcs.find((x) => x.id === id);
    if (!n) return;
    const fx = Math.sin(n.face);
    const fz = Math.cos(n.face);
    this.playerPos.set(n.home.x + fx * n.radius * 0.72, 0, n.home.z + fz * n.radius * 0.72);
    this.resolveBounds(this.playerPos);
    this.playerHeading = Math.atan2(n.home.x - this.playerPos.x, n.home.z - this.playerPos.z);
    this.player.root.position.copy(this.playerPos);
    this.player.root.rotation.y = this.playerHeading;
    this.yaw = this.playerHeading + Math.PI;
    this.moveTarget = null;
    this.vel.set(0, 0, 0);
    this.snapCamera();
    this.updateNearby();
  }

  /** walk to a spot automatically (tap-to-move for the UI's "take me there") */
  walkTo(x: number, z: number) {
    this.moveTarget = new THREE.Vector3(x, 0, z);
    this.moveTimer = 0;
  }

  npcPosition(id: string) {
    const n = this.npcs.find((x) => x.id === id);
    return n ? { x: n.home.x, z: n.home.z } : null;
  }

  get nearby() {
    return this.nearbyId;
  }

  enterConversation(id: string) {
    const npc = this.npcs.find((n) => n.id === id);
    if (!npc || this.conv) return;
    this.conv = { npc, t: 0, playerBowed: false };
    this.moveTarget = null;
    this.stick.set(0, 0);
    this.vel.set(0, 0, 0);
    this.player.setWalking(0);
    npc.avatar.bow();
    npc.avatar.setEmotion('happy');
  }

  exitConversation() {
    if (!this.conv) return;
    const { npc } = this.conv;
    npc.avatar.setTalking(false);
    npc.avatar.setEmotion('neutral');
    npc.avatar.bow();
    this.player.bow();
    this.conv = null;
  }

  setSpeaker(id: string, talking: boolean) {
    this.npcs.find((n) => n.id === id)?.avatar.setTalking(talking);
  }
  setEmotion(id: string, e: Emotion) {
    this.npcs.find((n) => n.id === id)?.avatar.setEmotion(e);
  }
  setPlayerTalking(on: boolean) {
    this.player.setTalking(on);
  }
  /** act as if the learner tapped a labelled object (tests and demos) */
  simulatePick(id: string) {
    this.emit({ type: 'pick', id, x: this.width / 2, y: this.height / 2 });
  }
  npcWave(id: string) {
    this.npcs.find((n) => n.id === id)?.avatar.wave();
  }

  snapshot(): WorldSnapshot {
    return {
      player: { x: this.playerPos.x, z: this.playerPos.z, heading: this.playerHeading },
      camYaw: this.yaw,
      nearby: this.nearbyId,
      npcs: this.npcs.map((n) => ({ id: n.id, x: n.home.x, z: n.home.z })),
      inConversation: !!this.conv,
    };
  }

  mapRects() {
    return this.city.mapRects;
  }

  dispose() {
    this.stop();
    this.ro?.disconnect();
    for (const [t, type, fn, o] of this.bound) t.removeEventListener(type, fn, o);
    this.city.dispose();
    this.player.dispose();
    this.npcs.forEach((n) => n.avatar.dispose());
    this.walkers.forEach((w) => w.avatar.dispose());
    this.labelCache.forEach((t) => t.dispose());
    this.toon.dispose();
    this.ramp.dispose();
    this.renderer.dispose();
  }

  // ---------------- internals ----------------

  private labelFor(text: string) {
    let t = this.labelCache.get(text);
    if (!t) {
      t = labelTexture(text);
      this.labelCache.set(text, t);
    }
    return t;
  }

  private on_(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, o?: AddEventListenerOptions) {
    target.addEventListener(type, fn, o);
    this.bound.push([target, type, fn, o]);
  }

  private bindInput(canvas: HTMLCanvasElement) {
    canvas.style.touchAction = 'none';
    this.on_(window, 'keydown', ((e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
    }) as EventListener);
    this.on_(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase());
    }) as EventListener);
    this.on_(window, 'blur', (() => this.keys.clear()) as EventListener);

    this.on_(canvas, 'pointerdown', ((e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
      if (this.pointers.size === 2) this.pinch = this.pinchDistance();
    }) as EventListener);
    this.on_(canvas, 'pointermove', ((e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) p.moved = true;
      if (this.conv) return;
      if (this.pointers.size === 2) {
        const d = this.pinchDistance();
        if (this.pinch > 0 && d > 0) this.dist = clamp(this.dist * (this.pinch / d), 4, 16);
        this.pinch = d;
        return;
      }
      if (p.moved) {
        this.yaw -= dx * 0.0058;
        this.pitch = clamp(this.pitch + dy * 0.0042, 0.12, 1.3);
      }
    }) as EventListener);
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
      if (!p || p.moved || this.conv || this.paused) return;
      if (performance.now() - p.t > 450) return;
      this.tap(e.clientX, e.clientY);
    };
    this.on_(canvas, 'pointerup', end as EventListener);
    this.on_(canvas, 'pointercancel', ((e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
    }) as EventListener);
    this.on_(canvas, 'wheel', ((e: WheelEvent) => {
      e.preventDefault();
      if (!this.conv) this.dist = clamp(this.dist + e.deltaY * 0.008, 4, 16);
    }) as EventListener, { passive: false });
  }

  private pinchDistance() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private tap(clientX: number, clientY: number) {
    const rect = this.opts.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;

    // characters first
    const bodies: THREE.Object3D[] = this.npcs.map((n) => n.avatar.root);
    const hits = this.raycaster.intersectObjects(bodies, true);
    let nearestObj = Infinity;
    let npcHit: Npc | null = null;
    if (hits.length) {
      npcHit = this.npcs.find((n) => {
        let o: THREE.Object3D | null = hits[0].object;
        while (o) {
          if (o === n.avatar.root) return true;
          o = o.parent;
        }
        return false;
      }) ?? null;
      nearestObj = hits[0].distance;
    }

    // then anything labelled in the city
    let pickHit: { id: string; d: number } | null = null;
    const v = new THREE.Vector3();
    for (const p of this.city.pickables) {
      const to = v.copy(p.pos).sub(ray.origin);
      const t = to.dot(ray.direction);
      if (t < 0 || t > 60) continue;
      const closest = ray.origin.clone().addScaledVector(ray.direction, t);
      const dist = closest.distanceTo(p.pos);
      const r = p.radius * 0.8 + t * 0.012; // a little forgiving at range, for fingers
      if (dist < r && (!pickHit || t < pickHit.d)) pickHit = { id: p.id, d: t };
    }

    if (npcHit && (!pickHit || nearestObj < pickHit.d)) {
      const dir = this.playerPos.clone().sub(npcHit.home).setY(0);
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      dir.normalize();
      const stop = npcHit.home.clone().addScaledVector(dir, npcHit.radius * 0.6);
      this.moveTarget = stop;
      this.moveTimer = 0;
      return;
    }
    if (pickHit) {
      this.emit({ type: 'pick', id: pickHit.id, x: clientX - rect.left, y: clientY - rect.top });
      return;
    }
    const t = -ray.origin.y / ray.direction.y;
    if (t > 0 && t < 120) {
      const g = ray.origin.clone().addScaledVector(ray.direction, t);
      g.y = 0;
      this.resolveBounds(g);
      this.moveTarget = g;
      this.moveTimer = 0;
    }
  }

  private inputVector(): THREE.Vector2 {
    const v = new THREE.Vector2(this.stick.x, this.stick.y);
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) v.y += 1;
    if (k.has('s') || k.has('arrowdown')) v.y -= 1;
    if (k.has('d') || k.has('arrowright')) v.x += 1;
    if (k.has('a') || k.has('arrowleft')) v.x -= 1;
    if (v.length() > 1) v.normalize();
    return v;
  }

  private step(dt: number) {
    if (!this.paused) this.time += dt;
    const t = this.time;

    if (!this.paused) {
      this.updatePlayer(dt);
      this.updateNpcs(dt, t);
      this.updateWalkers(dt);
    }
    this.updateCamera(dt);

    // keep the sun's shadow window on the player
    const snap = 2;
    const sx = Math.round(this.playerPos.x / snap) * snap;
    const sz = Math.round(this.playerPos.z / snap) * snap;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx, 0, sz).addScaledVector(this.city.sunDir, 70);
    this.sun.target.updateMatrixWorld();

    this.city.update(this.paused ? 0 : dt, t, this.playerPos);
    this.updateSparkles(t);
    this.updateMarker(dt, t);
  }

  private updatePlayer(dt: number) {
    const conv = this.conv;
    const input = this.inputVector();
    let wish = new THREE.Vector3();
    let speed = (this.keys.has('shift') ? RUN_SPEED : WALK_SPEED) * Math.min(1, input.length() * 1.15);

    if (!conv) {
      if (input.lengthSq() > 0.01) {
        this.moveTarget = null;
        const fx = -Math.sin(this.yaw);
        const fz = -Math.cos(this.yaw);
        wish.set(fx * input.y + -fz * input.x, 0, fz * input.y + fx * input.x);
      } else if (this.moveTarget) {
        const to = this.moveTarget.clone().sub(this.playerPos).setY(0);
        const d = to.length();
        if (d < 0.25) {
          this.moveTarget = null;
        } else {
          wish.copy(to).divideScalar(d);
          speed = WALK_SPEED * 1.15 * Math.min(1, d / 0.6 + 0.35);
        }
      }
    }

    const targetVel = wish.multiplyScalar(speed);
    this.vel.x = damp(this.vel.x, targetVel.x, 14, dt);
    this.vel.z = damp(this.vel.z, targetVel.z, 14, dt);
    const before = this.playerPos.clone();
    this.playerPos.x += this.vel.x * dt;
    this.playerPos.z += this.vel.z * dt;
    this.resolveCollisions(this.playerPos);
    const moved = this.playerPos.distanceTo(before) / Math.max(dt, 1e-4);

    if (this.moveTarget) {
      this.moveTimer += dt;
      if (wish.lengthSq() > 0.01 && moved < 0.4 && this.moveTimer > 0.6) this.moveTarget = null;
    }

    if (conv) {
      const dx = conv.npc.home.x - this.playerPos.x;
      const dz = conv.npc.home.z - this.playerPos.z;
      const want = Math.atan2(dx, dz);
      this.playerHeading += angleDiff(this.playerHeading, want) * (1 - Math.exp(-8 * dt));
    } else if (moved > 0.3) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      this.playerHeading += angleDiff(this.playerHeading, want) * (1 - Math.exp(-12 * dt));
    }

    this.player.root.position.copy(this.playerPos);
    this.player.root.rotation.y = this.playerHeading;
    this.player.setWalking(conv ? 0 : moved);
    this.player.update(dt, this.time);

    if (conv) {
      conv.t += dt;
      if (!conv.playerBowed && conv.t > 0.7) {
        conv.playerBowed = true;
        this.player.bow();
      }
    }
    this.updateNearby();
  }

  private updateNearby() {
    let best: Npc | null = null;
    let bd = Infinity;
    for (const n of this.npcs) {
      const d = Math.hypot(n.home.x - this.playerPos.x, n.home.z - this.playerPos.z);
      if (d < n.radius && d < bd) {
        best = n;
        bd = d;
      }
    }
    const id = this.conv ? this.conv.npc.id : best?.id ?? null;
    if (id !== this.nearbyId) {
      this.nearbyId = id;
      this.emit({ type: 'nearby', id });
    }
  }

  private updateNpcs(dt: number, t: number) {
    const eye = new THREE.Vector3(this.playerPos.x, 1.5, this.playerPos.z);
    for (const n of this.npcs) {
      const dx = this.playerPos.x - n.home.x;
      const dz = this.playerPos.z - n.home.z;
      const d = Math.hypot(dx, dz);
      const talking = this.conv?.npc === n;
      // face the learner during a conversation, otherwise drift back to the home pose
      const targetFace = talking || (d < 6 && n.kind === 'lesson') ? Math.atan2(dx, dz) : n.face;
      n.facing += angleDiff(n.facing, targetFace) * (1 - Math.exp(-5 * dt));
      n.avatar.root.rotation.y = n.facing;
      n.avatar.lookToward(d < 9 || talking ? eye : null);
      n.avatar.update(dt, t);
      const near = d < 14;
      n.label.visible = near && !this.conv;
      n.badge.visible = n.badgeKind !== 'none' && !this.conv && d < 45;
      const bob = Math.sin(t * 2.4 + n.home.x) * 0.07;
      n.badge.position.set(n.home.x, 2.62 + n.home.y + bob, n.home.z);
      n.badge.scale.setScalar(clampScale(d));
      n.label.position.set(n.home.x, 2.24 + n.home.y, n.home.z);
    }
  }

  private updateWalkers(dt: number) {
    for (const w of this.walkers) {
      const p = w.avatar.root.position;
      const target = w.points[w.index];
      const to = target.clone().sub(p);
      const d = to.length();
      if (d < 0.25) {
        w.index++;
        if (w.index >= w.points.length) {
          if (w.loop) w.index = 1;
          else {
            p.copy(w.points[0]);
            w.index = 1;
          }
        }
      } else {
        to.divideScalar(d);
        p.addScaledVector(to, w.speed * dt);
        w.avatar.root.rotation.y += angleDiff(w.avatar.root.rotation.y, Math.atan2(to.x, to.z)) * (1 - Math.exp(-6 * dt));
      }
      w.avatar.setWalking(w.speed * 1.6);
      w.avatar.update(dt, this.time);
    }
  }

  private updateSparkles(t: number) {
    for (let i = 0; i < this.sparkles.length; i++) {
      const s = this.sparkles[i];
      const d = Math.hypot(s.sprite.position.x - this.playerPos.x, s.sprite.position.z - this.playerPos.z);
      const show = !this.discovered.has(s.id) && d < 17 && !this.conv;
      s.sprite.visible = show;
      if (show) {
        const pulse = 0.38 + 0.07 * Math.sin(t * 3 + i);
        s.sprite.scale.set(pulse, pulse, 1);
        s.sprite.position.y = s.base + Math.sin(t * 2 + i) * 0.08;
      }
    }
  }

  private updateMarker(dt: number, t: number) {
    const m = this.marker;
    if (this.moveTarget && !this.conv) {
      m.visible = true;
      m.position.set(this.moveTarget.x, 0.06, this.moveTarget.z);
      const s = 1 + Math.sin(t * 7) * 0.12;
      m.scale.set(s, 1, s);
    } else {
      m.visible = false;
    }
    void dt;
  }

  // ---------------- collisions ----------------

  private resolveBounds(p: THREE.Vector3) {
    p.x = clamp(p.x, BOUNDS.x0, BOUNDS.x1);
    p.z = clamp(p.z, BOUNDS.z0, BOUNDS.z1);
  }

  private resolveCollisions(p: THREE.Vector3) {
    this.resolveBounds(p);
    for (const r of this.city.colliders) {
      const cx = clamp(p.x, r.x0, r.x1);
      const cz = clamp(p.z, r.z0, r.z1);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < PLAYER_RADIUS * PLAYER_RADIUS) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * PLAYER_RADIUS;
          p.z = cz + (dz / d) * PLAYER_RADIUS;
        } else {
          // centre is inside the box: push out along the shortest side
          const left = p.x - r.x0;
          const right = r.x1 - p.x;
          const top = p.z - r.z0;
          const bottom = r.z1 - p.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) p.x = r.x0 - PLAYER_RADIUS;
          else if (m === right) p.x = r.x1 + PLAYER_RADIUS;
          else if (m === top) p.z = r.z0 - PLAYER_RADIUS;
          else p.z = r.z1 + PLAYER_RADIUS;
        }
      }
    }
    this.resolveBounds(p);
  }

  // ---------------- camera ----------------

  private applyViewOffset() {
    const shift = this.convBlend * 0.2 * this.height;
    if (shift > 0.5) this.camera.setViewOffset(this.width, this.height, 0, shift, this.width, this.height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private followPose(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
    const target = new THREE.Vector3(this.playerPos.x, 1.35, this.playerPos.z);
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    let d = this.dist;
    // keep the camera out of buildings and trunks
    d = Math.min(d, this.clipDistance(target, dir, d));
    out.pos.copy(target).addScaledVector(dir, d);
    out.pos.y = Math.max(out.pos.y, 0.7);
    out.look.copy(target);
  }

  private clipDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxD: number) {
    let best = maxD;
    for (const r of this.city.occluders) {
      const pad = 0.35;
      const x0 = r.x0 - pad;
      const x1 = r.x1 + pad;
      const z0 = r.z0 - pad;
      const z1 = r.z1 + pad;
      let tmin = 0;
      let tmax = best;
      const slab = (o: number, dd: number, lo: number, hi: number) => {
        if (Math.abs(dd) < 1e-6) return o >= lo && o <= hi;
        let t1 = (lo - o) / dd;
        let t2 = (hi - o) / dd;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        return tmin <= tmax;
      };
      // buildings are tall; treat the ray as hitting if its horizontal footprint crosses the box below roof height
      if (slab(origin.x, dir.x, x0, x1) && slab(origin.z, dir.z, z0, z1) && tmin > 0.01) {
        const yAt = origin.y + dir.y * tmin;
        if (yAt > (r.y0 ?? 0) - 0.4 && yAt < (r.y1 ?? 9) + 0.4) best = Math.min(best, Math.max(1.8, tmin - 0.3));
      }
    }
    return best;
  }

  /** Over-the-shoulder framing: pick whichever side of the learner has a clear line of sight. */
  private convPose(out: { pos: THREE.Vector3; look: THREE.Vector3 }, npc: Npc) {
    const d = new THREE.Vector3(npc.home.x - this.playerPos.x, 0, npc.home.z - this.playerPos.z);
    const len = Math.max(0.5, d.length());
    d.divideScalar(len);
    const side = new THREE.Vector3(-d.z, 0, d.x);
    const eye = new THREE.Vector3(this.playerPos.x, 1.6, this.playerPos.z);
    let bestPos: THREE.Vector3 | null = null;
    let bestClear = -1;
    for (const sgn of [1, -1]) {
      const cand = eye.clone().addScaledVector(d, -3.3).addScaledVector(side, 1.5 * sgn);
      cand.y = 1.95;
      const dir = cand.clone().sub(eye);
      const full = dir.length();
      dir.divideScalar(full);
      const clear = this.clipDistance(eye, dir, full);
      if (clear > bestClear + 0.01 || (sgn === 1 && bestClear < 0)) {
        bestClear = clear;
        bestPos = eye.clone().addScaledVector(dir, Math.max(1.4, clear));
      }
    }
    out.pos.copy(bestPos!);
    out.look.set(this.playerPos.x, 1.35, this.playerPos.z).lerp(new THREE.Vector3(npc.home.x, 1.42 + npc.home.y, npc.home.z), 0.82);
  }

  private snapCamera() {
    const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.followPose(pose);
    this.camPos.copy(pose.pos);
    this.camLook.copy(pose.look);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private updateCamera(dt: number) {
    // follow mode drifts behind the player slowly when walking with the stick
    const follow = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.followPose(follow);
    let pos = follow.pos;
    let look = follow.look;

    const target = this.conv ? 1 : 0;
    this.convBlend = clamp(this.convBlend + (target - this.convBlend) * (1 - Math.exp(-4.2 * dt)), 0, 1);
    if (Math.abs(this.convBlend - target) < 0.002) this.convBlend = target;
    if (this.convBlend > 0.001 && (this.conv || this.convBlend > 0.01)) {
      const npc = this.conv?.npc ?? this.npcs.find((n) => n.id === this.nearbyId) ?? this.npcs[0];
      const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
      this.convPose(pose, npc);
      const k = easeInOut(this.convBlend);
      pos = follow.pos.clone().lerp(pose.pos, k);
      look = follow.look.clone().lerp(pose.look, k);
    }
    const rate = this.conv || this.convBlend > 0.01 ? 7 : 22;
    this.camPos.x = damp(this.camPos.x, pos.x, rate, dt);
    this.camPos.y = damp(this.camPos.y, pos.y, rate, dt);
    this.camPos.z = damp(this.camPos.z, pos.z, rate, dt);
    this.camLook.x = damp(this.camLook.x, look.x, rate, dt);
    this.camLook.y = damp(this.camLook.y, look.y, rate, dt);
    this.camLook.z = damp(this.camLook.z, look.z, rate, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // telephoto during conversations keeps the character large and the background calm
    const convFov = this.camera.aspect >= 1 ? 36 : 40;
    this.camera.fov = this.baseFov + (convFov - this.baseFov) * easeInOut(this.convBlend);
    this.applyViewOffset();
  }

  private watchPerformance(dt: number) {
    if (!this.auto || this.quality === 'low') return;
    this.frames++;
    this.frameAcc += dt;
    if (this.frames >= 120) {
      const avg = this.frameAcc / this.frames;
      this.frames = 0;
      this.frameAcc = 0;
      if (avg > 0.034) this.setQuality('low');
    }
  }
}

function clampScale(d: number) {
  return clamp(0.95 + d * 0.012, 0.95, 1.5);
}
