import type { Scenario } from '../types';
import { CORE_SCENARIOS } from './scenarios';
import { SHOPS_SCENARIOS } from './scenarios-shops';
import { SOCIAL_SCENARIOS } from './scenarios-social';
import { JOBS_SCENARIOS } from './scenarios-jobs';

export const SCENARIOS: Scenario[] = [...CORE_SCENARIOS, ...SHOPS_SCENARIOS, ...SOCIAL_SCENARIOS, ...JOBS_SCENARIOS];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
