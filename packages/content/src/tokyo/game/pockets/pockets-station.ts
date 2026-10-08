import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/**
 * Phrase Pocket lines of the station scenarios (agent 2G, docs/GAME_DESIGN.md §11.1). Every line is matched by an intent of its
 * scenario (asserted in `engine/test/station.test.ts`, which plays them all).
 *
 * `STATION_POCKETS` (sato_directions, which no table gives to a pocket file) is meant to be spread into `POCKETS` by pockets/index.ts.
 * `STATION_IC_POCKETS` is the proposal for station_ic, whose pocket 2E authors in pockets-core.ts (§15.4): ScenarioMeta names
 * `p_station_ic_1..3`; register this set instead of re-authoring them, or copy the ids and lines, but never both.
 */
export const STATION_POCKETS: Record<string, PocketLine> = {
  p_sato_directions_1: { id: 'p_sato_directions_1', key: true, line: L('出口|は|どこ|です|か？', 'Where is the exit?', 'أين المخرج؟') },
  p_sato_directions_2: { id: 'p_sato_directions_2', line: L('トイレ|は|どこ|です|か？', 'Where is the toilet?', 'أين الحمام؟') },
  p_sato_directions_3: { id: 'p_sato_directions_3', line: L('右|です|ね。', 'On the right, yes?', 'على اليمين، صحيح؟') },
};

export const STATION_IC_POCKETS: Record<string, PocketLine> = {
  p_station_ic_1: { id: 'p_station_ic_1', key: true, line: L('ICカード|を|ください。', 'An IC card, please.', 'بطاقة IC من فضلك.') },
  p_station_ic_2: { id: 'p_station_ic_2', key: true, line: L('千|円|チャージ|を|お願いします。', 'Please load 1,000 yen.', 'اشحن ألف ين من فضلك.') },
  p_station_ic_3: { id: 'p_station_ic_3', line: L('いくら|です|か？', 'How much is it?', 'بكم هذا؟') },
};
