import type { ScenarioMeta } from '@lw/game';
import { SMALLTALK_FRIENDS } from '../../scenarios-social';

/**
 * Game wiring for give_gift and small talk (4B-a). Both pay hearts, not yen (`pay: 'none'`). Small talk is an ordinary counted talk
 * (kind 'talk', `friendId` = the friend); the gift hand-over is kind 'friend' (the friend is the conversation's character).
 * Goal step ids are asserted against the scenarios in `content/test/social.test.ts`.
 */
const PLACE: Record<(typeof SMALLTALK_FRIENDS)[number], string> = { mio: 'park', yuki: 'cafe', tanaka: 'konbini', kenji: 'ramen', sato: 'station', hanako: 'school' };

export const SOCIAL_META: ScenarioMeta[] = [
  {
    id: 'give_gift',
    kind: 'friend',
    band: 'A1',
    register: 'polite',
    pay: 'none',
    pocket: ['p_give_gift_1', 'p_give_gift_2'],
    culture: ['cc_gift'],
  },
  ...SMALLTALK_FRIENDS.map(
    (id): ScenarioMeta => ({
      id: `smalltalk_${id}`,
      kind: 'talk',
      band: 'A1',
      register: 'polite',
      pay: 'none',
      real: true,
      place: PLACE[id],
      friendId: id,
      pocket: [1, 2, 3].map((n) => `p_smalltalk_${id}_${n}`),
    }),
  ),
];
