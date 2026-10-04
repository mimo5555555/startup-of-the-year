export * from './kana';
export * from './storage';
export * from './srs';
export * from './progress';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
