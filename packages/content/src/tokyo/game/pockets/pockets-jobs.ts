import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines for job intro scenarios (4D): pocket line id -> line. Every line is language an intent of `job_konbini_intro` accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const JOBS_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_job_konbini_intro_1', L('はい|、|やります|。', 'Yes, I will do it.', 'نعم، سأفعل.')),
  P('p_job_konbini_intro_2', L('いらっしゃいませ|。', 'Welcome!', 'أهلًا بك!'), true),
  P('p_job_konbini_intro_3', L('ありがとうございました|。', 'Thank you very much.', 'شكرًا جزيلًا.'), true),
]);
