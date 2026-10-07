// Just enough browser for the world to run in node: canvases whose 2D context swallows every call (textures.ts
// draws on them but nothing reads the pixels), a stub window and a no-GL renderer. Lets the real buildCity() and
// TokyoWorld run in vitest instead of testing copies of their logic.
const gradient = { addColorStop() {} };

function makeCtx(canvas: unknown): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { canvas };
  return new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'measureText') return (s: string) => ({ width: String(s).length * 8 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => gradient;
      return () => undefined;
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function fakeCanvas(w = 64, h = 64) {
  const c: Record<string, unknown> = {
    width: w,
    height: h,
    clientWidth: 400,
    clientHeight: 800,
    style: {},
    parentElement: null,
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }),
  };
  c.getContext = () => (c.ctx2d ??= makeCtx(c));
  return c as unknown as HTMLCanvasElement;
}

/** document.createElement('canvas') and a window with event-listener stubs. Safe to call more than once. */
export function installFakeDom() {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) g.document = { createElement: () => fakeCanvas(), fonts: undefined };
  if (!g.window) g.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
  if (!g.requestAnimationFrame) {
    g.requestAnimationFrame = () => 0;
    g.cancelAnimationFrame = () => {};
  }
}

/** Stands in for THREE.WebGLRenderer (use inside `vi.mock('three', ...)`): records nothing, draws nothing. */
export class FakeRenderer {
  shadowMap = { enabled: false, type: 0 };
  info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
  setClearColor() {}
  setPixelRatio() {}
  setSize() {}
  render() {}
  dispose() {}
}
