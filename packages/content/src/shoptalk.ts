// A shop that knows you, in any language (German step 4, Dutch step 3): from the second visit the shopkeeper greets a regular (flag
// `regular`), and on some visits makes small talk about the season or the weekend (flag `talk_<topic>`, set by the app). You answer yes
// or no (a chip, or your own words), they reply and go back to the shop's own question. Berlin and Amsterdam bring their own lines.
import type { IntentDef, Line, Scenario, Suggestion } from './types';
import { say } from './tokyo/dsl';

export interface ShopTalk {
  /** the regular's greeting, ending with the shop's question */
  regular: Line;
  /** the shop's hello before the small talk */
  hello: Line;
  /** back to business after the small talk */
  ask: Line;
}

export interface TalkTopic {
  remark: Line;
  yes: Suggestion;
  no: Suggestion;
  yesReply: Line;
  noReply: Line;
  yesKeys: string[];
  noKeys: string[];
}

/** the reply, then the shop's own question: two lines joined into one turn */
const then = (a: Line, b: Line): Line => ({ ja: `${a.ja} ${b.ja}`, en: `${a.en} ${b.en}`, ar: `${a.ar} ${b.ar}` });

/**
 * A shop conversation with its regular's greeting and the small talk of every topic, all gated on the app's flags. `negations`: the
 * words that make a yes key a no (「nicht」, 「niet」), so 「not so much」 is never heard as 「very much」.
 */
export function withShopTalk(sc: Scenario, shops: Record<string, ShopTalk>, topics: Record<string, TalkTopic>, negations: string[]): Scenario {
  const shop = shops[sc.id];
  const start = sc.nodes[sc.start];
  if (!shop || !start) return sc;
  const talk = Object.entries(topics);
  const says = talk.map(([id, t]) => say(then(shop.hello, t.remark), { flag: `talk_${id}` }));
  const chips: Suggestion[] = talk.flatMap(([id, t]) => [
    { ...t.yes, when: { flag: `talk_${id}` } },
    { ...t.no, when: { flag: `talk_${id}` } },
  ]);
  const intents: IntentDef[] = talk.flatMap(([id, t]): IntentDef[] => [
    // the no first: 「Nicht so sehr」 has 「sehr」 in it, and the longer key wins the tie
    { id: `talk_no_${id}`, when: { flag: `talk_${id}` }, unflag: `talk_${id}`, any: t.noKeys, boost: 4, stay: true, reply: then(t.noReply, shop.ask) },
    { id: `talk_yes_${id}`, when: { flag: `talk_${id}` }, unflag: `talk_${id}`, any: t.yesKeys, none: negations, boost: 3, stay: true, reply: then(t.yesReply, shop.ask) },
  ]);
  return {
    ...sc,
    nodes: {
      ...sc.nodes,
      [sc.start]: {
        ...start,
        say: [...says, say(shop.regular, { flag: 'regular' }), ...start.say],
        suggestions: [...chips, ...(start.suggestions ?? [])],
        intents: [...start.intents, ...intents],
      },
    },
  };
}
