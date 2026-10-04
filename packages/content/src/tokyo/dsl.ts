import type { Line, SayVariant, SceneNode, Suggestion } from '../types';

// ---------- authoring helpers ----------
export const L = (ja: string, en: string, ar: string, tts?: string): Line => ({ ja, en, ar, tts });
export const S = (ja: string, en: string, ar: string): Suggestion => ({ ja, en, ar });
export const say = (line: Line, when?: SayVariant['when']): SayVariant => ({ line, when });
export const node = (n: SceneNode): SceneNode => n;
export const asRecord = (nodes: SceneNode[]) => Object.fromEntries(nodes.map((n) => [n.id, n]));

export const REPEAT_S = S('もう一度|お願いします。', 'One more time, please.', 'مرة أخرى من فضلك.');
export const PAY_ANY = ['げんきん', '現金', 'かーど', 'カード', 'どうぞ', 'はい', 'おねがい', 'くれじっと'];
