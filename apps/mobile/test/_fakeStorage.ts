// Import this first in a test that needs a real `localStorage`: the app's stores pick it up when their module loads (SafeLocalStore
// probes it at construction), so a test can write a saved fixture before booting and read back what the app wrote.
const data = new Map<string, string>();
let failWrites = false;

const fake = {
  getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
  setItem: (k: string, v: string) => {
    if (failWrites) throw new Error('QuotaExceededError');
    data.set(k, String(v));
  },
  removeItem: (k: string) => void data.delete(k),
  clear: () => data.clear(),
  key: (i: number) => [...data.keys()][i] ?? null,
  get length() {
    return data.size;
  },
};

(globalThis as unknown as { localStorage: unknown }).localStorage = fake;

/** What the app has written under a key, or null. */
export const saved = (key: string): string | null => fake.getItem(key);
export const savedJson = (key: string): any => JSON.parse(fake.getItem(key) ?? 'null');
export const putSaved = (key: string, value: unknown): void => data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
export const wipeSaved = (): void => data.clear();
/** From now on every write throws, as a full or blocked storage does (reads still work). */
export const breakWrites = (on = true): void => {
  failWrites = on;
};
