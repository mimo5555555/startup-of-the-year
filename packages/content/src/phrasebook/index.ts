import type { PhraseEntry } from '../types';
import { BASE_PHRASES } from './base';
import { SHOP_PHRASES } from './shop';
import { STATION_PHRASES } from './station';
import { QUESTS_PHRASES } from './quests';
import { SHOP_DENKI_PHRASES } from './shop-denki';
import { SHOP_FUKU_PHRASES } from './shop-fuku';
import { SHOP_AIKO_PHRASES } from './shop-aiko';
import { SHOP_MOTORS_PHRASES } from './shop-motors';
import { SOCIAL_PHRASES } from './social';
import { SOCIAL_CHAT_PHRASES } from './social-chat';
import { SOCIAL_FRIENDS_PHRASES } from './social-friends';
import { SOCIAL_HEARTS_PHRASES } from './social-hearts';
import { JOBS_PHRASES } from './jobs';
import { CULTURE_PHRASES } from './culture';

export { P } from './helpers';

export const PHRASEBOOK: PhraseEntry[] = [
  ...BASE_PHRASES,
  ...SHOP_PHRASES,
  ...STATION_PHRASES,
  ...QUESTS_PHRASES,
  ...SHOP_DENKI_PHRASES,
  ...SHOP_FUKU_PHRASES,
  ...SHOP_AIKO_PHRASES,
  ...SHOP_MOTORS_PHRASES,
  ...SOCIAL_PHRASES,
  ...SOCIAL_CHAT_PHRASES,
  ...SOCIAL_FRIENDS_PHRASES,
  ...SOCIAL_HEARTS_PHRASES,
  ...JOBS_PHRASES,
  ...CULTURE_PHRASES,
];
