import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';
import { SMALLTALK_FRIENDS } from '../../scenarios-social';

/** Phrase Pocket lines for gifts and small talk (4B-a): pocket line id -> line. Every line is language an intent of the scenarios accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const SOCIAL_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  // give_gift: the reply to the friend's reaction (the item itself is named from the inventory, so it cannot be a fixed pocket line)
  P('p_give_gift_1', L('どういたしまして|。', "You're welcome.", 'عفوًا.'), true),
  P('p_give_gift_2', L('よかった|！', 'I am glad!', 'يسعدني ذلك!')),
  // smalltalk_<friend>: greet, react, say goodbye (a pocket line belongs to one scenario, so each friend has their own three)
  ...SMALLTALK_FRIENDS.flatMap((f) => [
    P(`p_smalltalk_${f}_1`, L('こんにちは|！', 'Hello!', 'مرحبًا!'), true),
    P(`p_smalltalk_${f}_2`, L('そう|です|ね|。', 'That is right.', 'هذا صحيح.')),
    P(`p_smalltalk_${f}_3`, L('また|明日|！', 'See you tomorrow!', 'أراك غدًا!'), true),
  ]),
]);
