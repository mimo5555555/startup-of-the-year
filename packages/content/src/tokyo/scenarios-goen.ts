import type { IntentDef, Line, Scenario, SceneNode } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';
import { FREE_WISHES, GOEN_CATALOG } from './game/goen';

// shrine_wish (Goen stage 1, docs/GOEN.md "Spending: the Shrine"): the speaking moment of the wish ritual. After the coin toss and
// 二礼二拍手一礼 the learner makes the wish in Japanese, 「{wish}ますように。」, typed or spoken. The shrine's priest (kannushi, not a friend:
// a wish bought with Goen adds no hearts; Hanako's manners hints are the ritual panel's) cues it once; the chips show ONE model line, the wish of the chosen catalog item (start node `wish_<itemId>`), or two autumn wishes for a
// free wish (start node `start`). Any wish that ends in 〜ますように is a wish: an own line earns nothing extra (`pay: 'none'`, a ritual),
// but it counts toward the words said and the season's autumn words. A line that is not a wish gets a gentle fallback, never a penalty.

const CUE = L('では、|お願い|を|日本語|で|どうぞ。|最後|は|ように|です|よ。', 'Now make your wish in Japanese. It ends with "yō ni".', 'والآن تمنَّ باليابانية. تنتهي الأمنية بـ«يو ني».');
const DONE_LINE = L('いい|お願い|です|ね。|かないます|ように。', 'What a nice wish. May it come true.', 'يا لها من أمنية جميلة. أتمنى أن تتحقق.');

/** Any 〜ますように (or 〜ように) is a wish; the model line is the item's own. */
const wish = (ideal: Line): IntentDef => ({ id: 'wish', any: ['ますように', 'ように'], next: 'done', step: 'wish', ideal });
const again = (id: string): IntentDef => ({ id: 'again', any: ['もういちど', 'もう一度'], next: id });

const wishNode = (id: string, models: Line[]): SceneNode =>
  node({
    id,
    emotion: 'happy',
    say: [say(CUE)],
    suggestions: [...models.map((m) => S(m.ja, m.en, m.ar)), REPEAT_S],
    intents: [wish(models[0]!), again(id)],
  });

export const SHRINE_WISH: Scenario = {
  id: 'shrine_wish',
  locationId: 'park',
  characterId: 'kannushi',
  level: 'A1',
  title: { en: 'A wish at the shrine', ar: 'أمنية في المعبد' },
  setup: {
    en: 'You tossed the coin, bowed twice, clapped twice and bowed again. Now make your wish in Japanese: it ends with 〜ますように ("I hope…").',
    ar: 'رميت القطعة النقدية وانحنيت مرتين وصفّقت مرتين ثم انحنيت. والآن تمنَّ باليابانية: تنتهي الأمنية بـ〜ますように («أتمنى…»).',
  },
  minutes: 1,
  steps: [{ id: 'wish', text: { en: 'Make your wish in Japanese (〜ますように)', ar: 'تمنَّ باليابانية (〜ますように)' } }],
  start: 'start',
  nodes: asRecord([
    // a free wish (no item): two autumn wishes as models
    wishNode('start', FREE_WISHES),
    // one start node per catalog item, with the item's wish as the one model line
    ...GOEN_CATALOG.map((item) => wishNode(`wish_${item.id}`, [item.wish])),
    node({ id: 'done', end: true, emotion: 'happy', step: 'wish', say: [say(DONE_LINE)], intents: [] }),
  ]),
};

export const GOEN_SCENARIOS: Scenario[] = [SHRINE_WISH];

/** The start node of the wish for a catalog item (the app passes it as `startNode`). */
export const wishStartNode = (itemId: string): string => `wish_${itemId}`;
