import type { ScenarioMeta } from '@lw/game';

/**
 * Game wiring for the five P0 phone chat templates (4B-b, docs/GAME_DESIGN.md §8.7): they pay hearts, not yen (`pay: 'none'`),
 * need a phone, and speak the friend's register (`casual` flag set by the host). No `friendId`: the friend is the thread's.
 * Goal step ids are asserted against the scenarios in `content/test/chat.test.ts`.
 */
const chat = (id: string, band: 'A1' | 'A2', extra: Partial<ScenarioMeta> = {}): ScenarioMeta => ({
  id,
  kind: 'chat',
  band,
  register: 'casual',
  pay: 'none',
  gate: { k: 'own', category: 'phone' },
  ...extra,
});

export const CHAT_META: ScenarioMeta[] = [
  chat('chat_first', 'A1'),
  chat('chat_greet', 'A1'),
  // a polite refusal is a goal step (§8.7)
  chat('chat_plan', 'A2', { culture: ['cc_refuse'] }),
  chat('chat_food', 'A1'),
  chat('chat_miss', 'A1'),
];
