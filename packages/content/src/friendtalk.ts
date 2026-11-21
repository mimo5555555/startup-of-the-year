// A friend's chat of the day and the hand-over of a present, in any language that talks to friends with one register (Berlin's du,
// Amsterdam's je): the shape is shared, each city brings its lines (berlin/social.ts, amsterdam/social.ts). The app drives both the way
// it drives Tokyo's (apps/mobile/src/game/friendsLogic.ts):
//   small talk  scenario `smalltalk_<friend>`, startNode `g_<topic>`, flags `rev_<factId>` (a friend's fact said after the reaction),
//               `cb_<key>` (a callback in the greeting: `cb_hobby` with {hobby}, `cb_food` with {food}, `cb_dream`), steps greet /
//               answer / react
//   gift        scenario `give_gift`, flags `gift_<reaction>`, var {gift} (the giftItem / giftFood option), intents give_item /
//               give_food / give_bare, steps give / reply
// Friends here speak plainly from the first word, so only the plain variants exist: the `casual` twins of the flags (`revc_`, `cbc_`,
// `giftc_`) are never needed.
import type { IntentDef, Line, Scenario, SceneNode, SayVariant, Suggestion } from './types';
import { asRecord, node, say } from './tokyo/dsl';

export interface FriendTopic {
  id: string;
  ask: Line;
  chips: [Suggestion, Suggestion];
  /** what the learner may say, besides the common words */
  keys: string[];
  /** the friend's reaction (a function: each friend's own line) */
  react: Line | ((friend: string) => Line);
  /** the learner's answer is kept as a fact the friend can quote later */
  remember?: IntentDef;
  /** friend-specific: only this friend raises it */
  only?: string;
}

export interface SmalltalkLines {
  /** friend id -> the place of their chat */
  home: Record<string, string>;
  hello: Line;
  /** the greeting's callbacks, by the app's keys (hobby, food, dream) */
  callbacks: Record<string, Line>;
  greetChips: Suggestion[];
  helloKeys: string[];
  /** an answer to a callback */
  cbKeys: string[];
  common: string[];
  unsure: string[];
  reactChips: Suggestion[];
  reactKeys: string[];
  close: Line;
  closeChips: Suggestion[];
  bye: string[];
  end: Line;
  endChips: Suggestion[];
  topics: FriendTopic[];
  /** friend id -> fact id -> the line (FriendDef.factLines) */
  factLines: Record<string, Record<string, Line>>;
  setup: { en: string; ar: string };
}

/** a reaction, then a second line of the friend's: one turn */
const cat = (a: Line, b: Line): Line => ({ ja: `${a.ja} ${b.ja}`, en: `${a.en} ${b.en}`, ar: `${a.ar} ${b.ar}` });

function topicNodes(c: SmalltalkLines, f: string, t: FriendTopic, others: string[]): SceneNode[] {
  const react = typeof t.react === 'function' ? t.react(f) : t.react;
  const greet: SayVariant[] = [...Object.entries(c.callbacks).map(([k, l]) => say(l, { flag: `cb_${k}` })), say(c.hello)];
  const follow: SayVariant[] = [...Object.entries(c.factLines[f] ?? {}).map(([id, l]) => say(cat(react, l), { flag: `rev_${id}` })), say(react)];
  return [
    node({
      id: `g_${t.id}`,
      emotion: 'happy',
      say: greet,
      suggestions: c.greetChips,
      intents: [
        { id: 'hello', any: c.helloKeys, next: `t_${t.id}`, step: 'greet' },
        { id: 'cb', any: c.cbKeys, next: `t_${t.id}`, step: 'greet' },
        // the picker's other topics: the host enters those nodes directly (startNode); these keys keep the graph connected and are never typed
        ...others.map((o): IntentDef => ({ id: `to_${o}`, any: [`#topic:${o}`], next: `g_${o}` })),
      ],
    }),
    node({
      id: `t_${t.id}`,
      emotion: 'neutral',
      say: [say(t.ask)],
      suggestions: [...t.chips],
      intents: [...(t.remember ? [t.remember] : []), { id: 'answer', any: [...t.keys, ...c.common], next: `f_${t.id}`, step: 'answer' }, { id: 'unsure', any: c.unsure, next: `f_${t.id}` }],
    }),
    node({
      id: `f_${t.id}`,
      emotion: 'happy',
      say: follow,
      suggestions: c.reactChips,
      intents: [{ id: 'react', any: c.reactKeys, next: 'close', step: 'react' }],
    }),
  ];
}

/** `smalltalk_<friend>`: every topic the friend raises (the shared ones and their own), entered at `g_weather` unless the app picks one */
export function buildSmalltalk(c: SmalltalkLines, f: string): Scenario {
  const topics = c.topics.filter((t) => !t.only || t.only === f);
  const ids = topics.map((t) => t.id);
  const first = 'weather';
  const nodes: SceneNode[] = topics.flatMap((t) => topicNodes(c, f, t, t.id === first ? ids.filter((i) => i !== first) : []));
  nodes.push(
    node({ id: 'close', emotion: 'happy', say: [say(c.close)], suggestions: c.closeChips, intents: [{ id: 'bye', any: c.bye, next: 'end' }] }),
    node({ id: 'end', emotion: 'happy', say: [say(c.end)], end: true, suggestions: c.endChips, intents: [] }),
  );
  return {
    id: `smalltalk_${f}`,
    locationId: c.home[f]!,
    characterId: f,
    level: 'A1',
    title: { en: 'Small talk', ar: 'دردشة' },
    setup: c.setup,
    minutes: 3,
    steps: [
      { id: 'greet', text: { en: 'Greet your friend', ar: 'حيِّ صديقك' } },
      { id: 'answer', text: { en: 'Answer the question', ar: 'أجب عن السؤال' } },
      { id: 'react', text: { en: 'React to the answer', ar: 'علّق على الرد' } },
    ],
    start: `g_${first}`,
    nodes: asRecord(nodes),
  };
}

export interface GiftLines {
  locationId: string;
  /** the scenario's default character (the app plays it with whichever friend receives the present) */
  characterId: string;
  setup: { en: string; ar: string };
  start: Line;
  chips: Suggestion[];
  /** words that make a hand-over a hand-over even when no item is named */
  giveWords: string[];
  ideal: Line;
  react: Record<'loved' | 'liked' | 'neutral' | 'disliked', Line>;
  replyChips: Suggestion[];
  replyKeys: string[];
  thanks: Line;
  thanksChips: Suggestion[];
  bye: string[];
  end: Line;
  endChips: Suggestion[];
}

/** `give_gift`: name the present (giftItem / giftFood, or a bare hand-over), the friend's reaction by taste, a reply, goodbye */
export function buildGiveGift(c: GiftLines): Scenario {
  const give = (id: string, slot: string): IntentDef => ({ id, slot, slotRequired: true, next: 'react', step: 'give', ideal: c.ideal });
  return {
    id: 'give_gift',
    locationId: c.locationId,
    characterId: c.characterId,
    level: 'A1',
    title: { en: 'Give a gift', ar: 'قدّم هدية' },
    setup: c.setup,
    minutes: 1,
    steps: [
      { id: 'give', text: { en: 'Hand over the present and name it', ar: 'قدّم الهدية وسمِّها' } },
      { id: 'reply', text: { en: 'Answer the reaction', ar: 'أجب على ردّ الفعل' } },
    ],
    start: 'start',
    nodes: asRecord([
      node({
        id: 'start',
        emotion: 'neutral',
        say: [say(c.start)],
        suggestions: c.chips,
        intents: [
          give('give_item', 'giftItem'),
          give('give_food', 'giftFood'),
          // a hand-over that does not name the item still works, for half the affinity
          { id: 'give_bare', any: c.giveWords, next: 'react', step: 'give', ideal: c.ideal },
        ],
      }),
      node({
        id: 'react',
        step: 'give',
        emotion: 'happy',
        say: [...(Object.keys(c.react) as Array<keyof GiftLines['react']>).map((r) => say(c.react[r], { flag: `gift_${r}` })), say(c.react.neutral)],
        suggestions: c.replyChips,
        intents: [{ id: 'reply', any: c.replyKeys, next: 'thanks', step: 'reply' }],
      }),
      node({ id: 'thanks', emotion: 'happy', say: [say(c.thanks)], suggestions: c.thanksChips, intents: [{ id: 'bye', any: c.bye, next: 'end' }] }),
      node({ id: 'end', emotion: 'happy', say: [say(c.end)], end: true, suggestions: c.endChips, intents: [] }),
    ]),
  };
}
