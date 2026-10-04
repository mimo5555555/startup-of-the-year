import * as THREE from 'three';
import { rng } from './batch';

export const FONT_STACK = `'Zen Maru Gothic','M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Hiragino Sans','Yu Gothic','Noto Sans JP','Noto Sans CJK JP','IPAGothic',Meiryo,sans-serif`;

type Redraw = () => void;
const redraws: Redraw[] = [];

/** Redraw every text texture once web fonts have arrived. */
export function watchFonts() {
  const fonts = (globalThis as any).document?.fonts;
  if (!fonts?.ready) return;
  const run = () => redraws.forEach((r) => r());
  try {
    Promise.all([fonts.load(`700 48px "Zen Maru Gothic"`), fonts.load(`500 28px "Zen Maru Gothic"`)]).finally(run);
  } catch {
    fonts.ready.then(run);
  }
  fonts.ready.then(run);
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D) => void) {
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  redraws.push(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx);
    tex.needsUpdate = true;
  });
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface SignStyle {
  bg: string;
  fg: string;
  border?: string;
  sub?: string;
  /** small line under the main text (romaji) */
  subColor?: string;
  vertical?: boolean;
  round?: number;
}

/** A shop sign: big Japanese text, optional small reading line underneath. */
export function signTexture(text: string, style: SignStyle, w = 512, h = 160) {
  const canvas = makeCanvas(w, h);
  return finish(canvas, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = style.bg;
    roundRect(ctx, 4, 4, w - 8, h - 8, style.round ?? 26);
    ctx.fill();
    if (style.border) {
      ctx.lineWidth = 8;
      ctx.strokeStyle = style.border;
      roundRect(ctx, 12, 12, w - 24, h - 24, Math.max(10, (style.round ?? 26) - 8));
      ctx.stroke();
    }
    ctx.fillStyle = style.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hasSub = !!style.sub;
    let size = hasSub ? h * 0.52 : h * 0.62;
    ctx.font = `700 ${size}px ${FONT_STACK}`;
    while (ctx.measureText(text).width > w - 60 && size > 18) {
      size -= 4;
      ctx.font = `700 ${size}px ${FONT_STACK}`;
    }
    ctx.fillText(text, w / 2, hasSub ? h * 0.42 : h / 2 + 2);
    if (hasSub) {
      ctx.fillStyle = style.subColor ?? style.fg;
      ctx.globalAlpha = 0.85;
      ctx.font = `600 ${h * 0.17}px ${FONT_STACK}`;
      ctx.fillText(style.sub!, w / 2, h * 0.8);
      ctx.globalAlpha = 1;
    }
  });
}

/** Tall hanging sign (nobori banner or vertical shop sign). */
export function bannerTexture(text: string, bg: string, fg: string, w = 128, h = 384) {
  const canvas = makeCanvas(w, h);
  return finish(canvas, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = Array.from(text);
    const size = Math.min(w * 0.62, (h - 40) / chars.length);
    ctx.font = `800 ${size}px ${FONT_STACK}`;
    chars.forEach((c, i) => ctx.fillText(c, w / 2, 24 + size * (i + 0.5)));
    ctx.lineWidth = 6;
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

export function labelTexture(text: string, w = 384, h = 96) {
  const canvas = makeCanvas(w, h);
  return finish(canvas, (ctx) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(28,24,48,0.82)';
    roundRect(ctx, 4, 4, w - 8, h - 8, h / 2 - 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = h * 0.5;
    ctx.font = `700 ${size}px ${FONT_STACK}`;
    while (ctx.measureText(text).width > w - 40 && size > 14) {
      size -= 2;
      ctx.font = `700 ${size}px ${FONT_STACK}`;
    }
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

/** Speech-bubble icon floating above characters who have something to say. */
export function bubbleTexture(kind: 'talk' | 'lesson' | 'done') {
  const s = 128;
  const canvas = makeCanvas(s, s);
  return finish(canvas, (ctx) => {
    ctx.clearRect(0, 0, s, s);
    const fill = kind === 'done' ? '#7bd88f' : kind === 'lesson' ? '#ffc94d' : '#ffffff';
    ctx.fillStyle = 'rgba(40,30,70,0.25)';
    roundRect(ctx, 14, 20, 100, 70, 30);
    ctx.fill();
    ctx.fillStyle = fill;
    roundRect(ctx, 12, 12, 100, 70, 30);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, 78);
    ctx.lineTo(34, 104);
    ctx.lineTo(62, 80);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kind === 'done' ? '#1f6b34' : '#5b4b8a';
    if (kind === 'done') {
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f6b34';
      ctx.beginPath();
      ctx.moveTo(38, 48);
      ctx.lineTo(54, 63);
      ctx.lineTo(86, 30);
      ctx.stroke();
    } else if (kind === 'lesson') {
      ctx.font = `800 44px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('あ', 62, 48);
    } else {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(38 + i * 24, 48, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

export function sparkleTexture() {
  const s = 64;
  const canvas = makeCanvas(s, s);
  return finish(canvas, (ctx) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,248,200,1)');
    g.addColorStop(0.35, 'rgba(255,224,120,0.85)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.moveTo(32, 6);
    ctx.lineTo(37, 27);
    ctx.lineTo(58, 32);
    ctx.lineTo(37, 37);
    ctx.lineTo(32, 58);
    ctx.lineTo(27, 37);
    ctx.lineTo(6, 32);
    ctx.lineTo(27, 27);
    ctx.closePath();
    ctx.fill();
  });
}

/** Soft radial blob used for ground shadows under characters and the sun glow. */
export function blobTexture(inner: string, outer: string, size = 128) {
  const canvas = makeCanvas(size, size);
  return finish(canvas, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

function noiseTexture(base: string, specks: string[], count: number, size = 256, seed = 3, lines?: { color: string; every: number; width: number }) {
  const canvas = makeCanvas(size, size);
  const r = rng(seed);
  const tex = finish(canvas, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = specks[Math.floor(r() * specks.length)];
      const s = 1 + r() * 3;
      ctx.fillRect(r() * size, r() * size, s, s);
    }
    if (lines) {
      ctx.strokeStyle = lines.color;
      ctx.lineWidth = lines.width;
      for (let p = 0; p <= size; p += lines.every) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export const asphaltTexture = () => noiseTexture('#6a7089', ['#737a93', '#5d6480', '#7a819c'], 900, 256, 5);
export const sidewalkTexture = () => noiseTexture('#d9d2c6', ['#cfc8bb', '#e3dcd0'], 300, 256, 9, { color: 'rgba(120,108,96,0.28)', every: 64, width: 3 });
export const grassTexture = () => noiseTexture('#86c477', ['#79b86b', '#93d084', '#6fae62'], 1200, 256, 11);
export const pathTexture = () => noiseTexture('#e2cf9f', ['#d6c28f', '#ecdcb0'], 500, 256, 13);

/** Window grid for the distant towers. */
export function windowsTexture() {
  const w = 128;
  const h = 128;
  const canvas = makeCanvas(w, h);
  const r = rng(21);
  const tex = finish(canvas, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        const lit = r() > 0.72;
        ctx.fillStyle = lit ? '#ffe9a8' : r() > 0.5 ? '#a9bfd8' : '#8fa8c6';
        ctx.fillRect(6 + x * 20, 6 + y * 15, 13, 9);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function skyMaterial(top: string, mid: string, bottom: string) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `
      varying vec3 vP;
      void main() {
        vP = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 bottom;
      varying vec3 vP;
      void main() {
        float h = clamp(vP.y, -0.2, 1.0);
        vec3 c = h < 0.0 ? mix(bottom, mid, (h + 0.2) / 0.2) : mix(mid, top, pow(h, 0.55));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
