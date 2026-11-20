// What Amsterdam's shop conversations share: how you pay (pinnen, by card, or contant, cash; a card-only place refuses cash kindly, as
// more and more Dutch shops and every tram do), the end of a sale and the end when the money is not there. Dutch markup: spaced words.
import type { IntentDef, Line, SceneNode } from '../types';
import { L, S, node, say } from '../tokyo/dsl';

export const PAY_CHIPS_NL = [S('Pinnen, graag.', 'By card, please.', 'بالبطاقة من فضلك.'), S('Contant, graag.', 'Cash, please.', 'نقدًا من فضلك.')];

const CASH_REFUSED = L('Sorry, we accepteren alleen pin.', 'Sorry, we only take cards.', 'آسف، نقبل البطاقة فقط.');

/**
 * Card or cash (the slot `payMethod`, read by the game's charge); 「Alstublieft」 with the money in your hand is cash. With the flag
 * `pinOnly` (or `alwaysPin`, the tram) cash is refused kindly and the conversation stays for the card.
 */
export const payIntentsNl = (next: string, alwaysPin = false): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  ...(alwaysPin ? [] : ([{ id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next }] as IntentDef[])),
  {
    id: 'cash_refused',
    ...(alwaysPin ? {} : { when: { flag: 'pinOnly' } }),
    slot: 'payMethod',
    slotOptions: ['cash'],
    slotRequired: true,
    stay: true,
    boost: 20,
    reply: CASH_REFUSED,
  },
  ...(alwaysPin ? [] : ([{ id: 'pay_ok', any: ['alstublieft', 'alsjeblieft', 'hier', 'klopt zo'], next }] as IntentDef[])),
];

/** the line that asks for the money: with the total when the game prices the sale (`priced`), without it otherwise */
export const askToPayNl = (): SceneNode['say'] => [
  say(L('Dat is dan {total}. Pinnen of contant?', 'That will be {total}, then. Card or cash?', 'المجموع {total}. بالبطاقة أم نقدًا؟'), { flag: 'priced' }),
  say(L('Pinnen of contant?', 'Card or cash?', 'بالبطاقة أم نقدًا؟')),
];

export const saleDoneNl = (line: Line): SceneNode =>
  node({ id: 'bye', end: true, emotion: 'happy', step: 'pay', econ: 'charge', onShort: 'short', say: [say(line)], intents: [] });

export const shortOfMoneyNl = (line = L('Oei, dat is helaas niet genoeg. Geen probleem, een andere keer!', "Oops, that's not enough, I'm afraid. No problem, another time!", 'أوه، هذا لا يكفي للأسف. لا مشكلة، مرة أخرى!')): SceneNode =>
  node({ id: 'short', end: true, say: [say(line)], intents: [] });
