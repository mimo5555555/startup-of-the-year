import type { PhraseEntry } from '../types';
import { BASE_PHRASES } from './base';
import { SHOP_PHRASES } from './shop';
import { SOCIAL_PHRASES } from './social';
import { JOBS_PHRASES } from './jobs';

export { P } from './helpers';

export const PHRASEBOOK: PhraseEntry[] = [...BASE_PHRASES, ...SHOP_PHRASES, ...SOCIAL_PHRASES, ...JOBS_PHRASES];
