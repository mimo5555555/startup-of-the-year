// Storage port. Native builds will add a SQLite adapter behind the same interface.

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private m = new Map<string, string>();
  get(key: string) {
    return this.m.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.m.set(key, value);
  }
  remove(key: string) {
    this.m.delete(key);
  }
}

/** localStorage where available (it can throw or be empty in private/embedded contexts), memory otherwise. */
export class SafeLocalStore implements KeyValueStore {
  private fallback = new MemoryStore();
  private usable: boolean;

  constructor(private prefix = 'lw.v1.') {
    this.usable = SafeLocalStore.probe();
  }

  private static probe(): boolean {
    try {
      const k = '__lw_probe__';
      globalThis.localStorage.setItem(k, '1');
      globalThis.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  get(key: string) {
    if (!this.usable) return this.fallback.get(key);
    try {
      return globalThis.localStorage.getItem(this.prefix + key);
    } catch {
      return this.fallback.get(key);
    }
  }
  set(key: string, value: string) {
    this.fallback.set(key, value);
    if (!this.usable) return;
    try {
      globalThis.localStorage.setItem(this.prefix + key, value);
    } catch {
      /* quota or blocked: memory copy still holds */
    }
  }
  remove(key: string) {
    this.fallback.remove(key);
    if (!this.usable) return;
    try {
      globalThis.localStorage.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }
}

export function loadJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(store: KeyValueStore, key: string, value: unknown) {
  store.set(key, JSON.stringify(value));
}
