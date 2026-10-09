import type { ScenarioMeta } from '@lw/game';

/** Game wiring for job intro scenarios (4D): pay, pocket, gate, shop, steps. Scenario ids and goal steps are asserted in `content/test/jobs.test.ts`. */
export const JOBS_META: ScenarioMeta[] = [
  {
    id: 'job_konbini_intro',
    kind: 'jobintro',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'konbini',
    pocket: ['p_job_konbini_intro_1', 'p_job_konbini_intro_2', 'p_job_konbini_intro_3'],
    culture: ['cc_irasshaimase'],
  },
];
