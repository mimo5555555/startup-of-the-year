// What Berlin's shop conversations share: how you pay (card or cash; a cash-only shop refuses the card kindly), the end of a sale and the
// end when the money is not there. German markup: words separated by spaces.
import type { IntentDef, Line, SceneNode } from '../types';
import { L, S, node, say } from '../tokyo/dsl';

export const PAY_CHIPS = [S('Mit Karte, bitte.', 'By card, please.', 'بالبطاقة من فضلك.'), S('Bar, bitte.', 'Cash, please.', 'نقدًا من فضلك.')];

/**
 * Card or cash (the slot `payMethod`, read by the game's charge); 「Hier, bitte」 or 「Stimmt so」 with the money in your hand is cash. With
 * the flag `cashOnly` (many small Berlin shops) a card is refused kindly and the conversation stays for the cash.
 */
export const payIntents = (next: string): IntentDef[] => [
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
    reply: L('Tut mir leid, wir nehmen nur Bargeld.', 'Sorry, we only take cash.', 'آسف، نقبل النقد فقط.'),
  },
  { id: 'pay_ok', any: ['hier bitte', 'bitte schon', 'bitte sehr', 'stimmt so'], next },
];

/** the line that asks for the money: with the total when the game prices the sale (`priced`), without it otherwise */
export const askToPay = (before = ''): SceneNode['say'] => [
  say(L(`${before}Das macht {total}. Bar oder mit Karte?`, 'That comes to {total}. Cash or card?', 'المجموع {total}. نقدًا أم بالبطاقة؟'), { flag: 'priced' }),
  say(L(`${before}Bar oder mit Karte?`, 'Cash or card?', 'نقدًا أم بالبطاقة؟')),
];

/** the sale: the game charges on entering; short of money, `short` instead */
export const saleDone = (line: Line): SceneNode =>
  node({ id: 'bye', end: true, emotion: 'happy', step: 'pay', econ: 'charge', onShort: 'short', say: [say(line)], intents: [] });

export const shortOfMoney = (line = L('Oh, das reicht leider nicht. Kein Problem, vielleicht beim nächsten Mal!', "Oh, that's not quite enough, I'm afraid. No problem, maybe next time!", 'أوه، هذا لا يكفي للأسف. لا مشكلة، ربما في المرة القادمة!')): SceneNode =>
  node({ id: 'short', end: true, say: [say(line)], intents: [] });
