import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists for the station, the IC card and the directions (agent 2G). Slot names must be unique across all modules.
 * `chargeAmount` (the top-up steps) is defined once in slots/shop.ts; `place` gains `hikarigaoka` and the Haneda label in slots/base.ts.
 */

/** What the learner wants at the counter. The game's `charge` hook reads it: `card` buys the IC card (and loads it), `charge` tops the card up, `refund` pays the balance back. */
const IC_SERVICE: SlotOption[] = [
  opt('card', 'ICカード', ['あいしーかーど', 'アイシーカード', 'スイカ', 'すいか', 'パスモ', 'ぱすも', 'suica', 'pasmo'], ['ic card', 'an ic card', 'a transit card', 'suica', 'pasmo'], ['بطاقة ic', 'بطاقة مواصلات', 'بطاقة المواصلات', 'سويكا', 'باسمو']),
  opt('charge', 'チャージ', ['ちゃーじ', 'にゅうきん', 'charge', 'chaaji'], ['top up', 'top-up', 'charge', 'load', 'add money'], ['شحن', 'اشحن', 'اشحنها', 'تعبئة']),
  opt('refund', '払い戻し', ['はらいもどし', 'へんきん', 'haraimodoshi'], ['refund', 'a refund', 'money back', 'get my money back'], ['استرداد', 'استرجاع', 'استرداد المبلغ']),
];

/** Places inside the station that `sato_directions` asks the way to (and how a shift customer may ask later). */
const STATION_SPOT: SlotOption[] = [
  opt('exit', '出口', ['でぐち', 'deguchi', 'exit'], ['exit', 'the exit', 'way out'], ['المخرج', 'مخرج', 'الخروج']),
  opt('toilet', 'トイレ', ['といれ', 'おてあらい', 'toire', 'toilet'], ['toilet', 'the toilet', 'restroom', 'bathroom', 'washroom'], ['الحمام', 'حمام', 'دورة المياه', 'المرحاض']),
  opt('platform', 'ホーム', ['ほーむ', 'のりば', 'platform', 'hoomu'], ['platform', 'the platform', 'train platform'], ['الرصيف', 'رصيف', 'المنصة']),
  opt('gate', '改札', ['かいさつ', 'kaisatsu', 'ticket gate'], ['ticket gate', 'the gate', 'gate', 'ticket barrier'], ['بوابة التذاكر', 'البوابة', 'بوابة']),
  opt('ticketMachine', '券売機', ['けんばいき', 'きっぷうりば', 'kenbaiki'], ['ticket machine', 'the ticket machine', 'ticket vending machine'], ['آلة التذاكر', 'ماكينة التذاكر']),
];

/** The way Sato answers and the learner says back (右, 左, まっすぐ). */
const DIRECTION: SlotOption[] = [
  opt('right', '右', ['みぎ', 'migi', 'right'], ['right', 'to the right', 'on the right', 'turn right'], ['يمين', 'اليمين', 'يمينا', 'إلى اليمين']),
  opt('left', '左', ['ひだり', 'hidari', 'left'], ['left', 'to the left', 'on the left', 'turn left'], ['يسار', 'اليسار', 'يسارا', 'إلى اليسار']),
  opt('straight', 'まっすぐ', ['まっすぐ', 'massugu', 'straight', '真っ直ぐ', '真っすぐ'], ['straight', 'straight ahead', 'go straight', 'straight on'], ['مباشرة', 'للأمام', 'إلى الأمام', 'دغري']),
];

export const STATION_SLOTS: Record<string, SlotOption[]> = {
  icService: IC_SERVICE,
  stationSpot: STATION_SPOT,
  direction: DIRECTION,
};
