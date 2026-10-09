import type { PhraseEntry } from '../types';
import { P } from './helpers';
import { SOCIAL_SCENARIOS } from '../tokyo/scenarios-social';
import { BASE_PHRASES } from './base';
import { SHOP_PHRASES } from './shop';
import { STATION_PHRASES } from './station';
import { QUESTS_PHRASES } from './quests';
import { SHOP_DENKI_PHRASES } from './shop-denki';
import { SHOP_FUKU_PHRASES } from './shop-fuku';
import { SHOP_AIKO_PHRASES } from './shop-aiko';
import { SHOP_MOTORS_PHRASES } from './shop-motors';
import { SOCIAL_CHAT_PHRASES } from './social-chat';
import { SOCIAL_FRIENDS_PHRASES } from './social-friends';
import { SOCIAL_HEARTS_PHRASES } from './social-hearts';
import { JOBS_PHRASES } from './jobs';
import { CULTURE_PHRASES } from './culture';

/** The English and Arabic a phrase pattern is matched against (the same folding as the engine's normaliser, which this package cannot import). */
const foldEn = (s: string): string => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/'/g, ' ').replace(/[^a-z0-9\s{}]/g, ' ').replace(/\b(a|an|the|some)\b/g, ' ').replace(/\s+/g, ' ').trim();
const foldAr = (s: string): string =>
  s
    .replace(/[\u064B-\u0670\u065F\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^ء-يa-z0-9\s{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Phrases for gifts and small talk. Every learner chip of the social scenarios that has no variable is also a phrase, so that typing its
 * English or Arabic gives the same Japanese (derived from the scenarios so the two cannot drift apart); the hand-over words are written out.
 * English is written without contractions; ids must be unique across modules.
 */
const OTHERS: PhraseEntry[] = [
  ...BASE_PHRASES, ...SHOP_PHRASES, ...STATION_PHRASES, ...QUESTS_PHRASES, ...SHOP_DENKI_PHRASES, ...SHOP_FUKU_PHRASES, ...SHOP_AIKO_PHRASES, ...SHOP_MOTORS_PHRASES,
  ...SOCIAL_CHAT_PHRASES, ...SOCIAL_FRIENDS_PHRASES, ...SOCIAL_HEARTS_PHRASES, ...JOBS_PHRASES, ...CULTURE_PHRASES,
];
/** a sentence another module already maps (the phrasebook never maps one sentence to two phrases): that module's phrase wins */
const taken = new Set(OTHERS.flatMap((p) => [...p.en.map((e) => `en:${foldEn(e)}`), ...p.ar.map((a) => `ar:${foldAr(a)}`)]));
const takenJa = new Set(OTHERS.map((p) => p.ja));
const chips = new Map<string, { en: string; ar: string }>();
for (const sc of SOCIAL_SCENARIOS) {
  for (const n of Object.values(sc.nodes)) {
    for (const s of n.suggestions ?? []) if (!s.ja.includes('{') && !chips.has(s.ja)) chips.set(s.ja, { en: s.en, ar: s.ar });
  }
}

const MANUAL: PhraseEntry[] = [
  P('soc_it_is_a_present', 'プレゼント|です。', ['it is a present', 'it is a gift', 'a present for you', 'this is a present'], ['انها هدية', 'هذه هدية', 'هدية لك']),
];
for (const p of MANUAL) {
  for (const e of p.en) taken.add(`en:${foldEn(e)}`);
  for (const a of p.ar) taken.add(`ar:${foldAr(a)}`);
}
const fromChips: PhraseEntry[] = [];
for (const [ja, { en, ar }] of chips) {
  const ke = `en:${foldEn(en)}`;
  const ka = `ar:${foldAr(ar)}`;
  if (takenJa.has(ja) || taken.has(ke) || taken.has(ka)) continue;
  taken.add(ke);
  taken.add(ka);
  fromChips.push(P(`soc_chip_${fromChips.length + 1}`, ja, [foldEn(en)], [foldAr(ar)]));
}

export const SOCIAL_PHRASES: PhraseEntry[] = [...MANUAL, ...fromChips];
