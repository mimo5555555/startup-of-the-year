// What Madrid's shop conversations share (Spanish step 1): how you pay (con tarjeta, by card, or en efectivo, cash; a cash-only stall refuses
// the card kindly), the end of a sale and the end when the money is not there. Spanish markup: spaced words, ¿ and ¡ open a question and
// an exclamation.
import type { IntentDef, Line, SceneNode } from '../types';
import { L, S, node, say } from '../tokyo/dsl';

export const PAY_CHIPS_ES = [S('Con tarjeta, por favor.', 'By card, please.', 'بالبطاقة من فضلك.'), S('En efectivo.', 'In cash.', 'نقدًا.')];

/**
 * Card or cash (the slot `payMethod`, read by the game's charge); 「Aquí tiene」 or 「Tome」 with the money in your hand is cash. With the flag
 * `cashOnly` (a market stall, the Rastro) a card is refused kindly and the conversation stays for the cash.
 */
export const payIntentsEs = (next: string): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next },
  {
    id: 'card_refused',
    when: { flag: 'cashOnly' },
    slot: 'payMethod',
    slotOptions: ['card'],
    slotRequired: true,
    stay: true,
    boost: 20,
    reply: L('Lo siento, solo aceptamos efectivo.', 'Sorry, we only take cash.', 'آسف، نقبل النقد فقط.'),
  },
  { id: 'pay_ok', any: ['aqui tiene', 'aqui tienes', 'tome', 'toma'], next },
];

/** the line that asks for the money: with the total when the game prices the sale (`priced`), without it otherwise */
export const askToPayEs = (): SceneNode['say'] => [
  say(L('Son {total}. ¿Con tarjeta o en efectivo?', 'That’s {total}. Card or cash?', 'المجموع {total}. بالبطاقة أم نقدًا؟'), { flag: 'priced' }),
  say(L('¿Con tarjeta o en efectivo?', 'Card or cash?', 'بالبطاقة أم نقدًا؟')),
];

/** the sale: the game charges on entering; short of money, `short` instead */
export const saleDoneEs = (line: Line): SceneNode =>
  node({ id: 'bye', end: true, emotion: 'happy', step: 'pay', econ: 'charge', onShort: 'short', say: [say(line)], intents: [] });

export const shortOfMoneyEs = (line = L('Vaya, no llega. ¡No pasa nada, otro día!', 'Oh, that’s not enough. No problem, another day!', 'أوه، هذا لا يكفي. لا مشكلة، في يوم آخر!')): SceneNode =>
  node({ id: 'short', end: true, say: [say(line)], intents: [] });
