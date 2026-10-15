// The stage registry (§8.8). Wave B1 builds the three friend homes; the dorm and the Ono flat (`ono_flat`) are wave B2:
// TODO(B2): register `dorm` and `ono_flat` here (4.0 x 3.6 dorm with four furniture slots, then the unfurnished tatami
// layout with eight), reading `StageBuildCtx.placed`.
import type { Stage, StageId } from '../stage';
import { AIKO_TATAMI } from './aiko_tatami';
import { KENJI_FLAT } from './kenji_flat';
import { MIO_1R } from './mio_1r';

export const STAGES: Partial<Record<StageId, Stage>> = {
  mio_1r: MIO_1R,
  aiko_tatami: AIKO_TATAMI,
  kenji_flat: KENJI_FLAT,
};

/** A tappable prop's word-card label: the JA text as the design writes it and its hiragana/katakana reading. EN and AR come from the content lexicon. */
export interface StagePropLabel {
  /** romaji of the word: the pick id is `prop:<stageId>:<id>` */
  id: string;
  ja: string;
  reading: string;
}

export const STAGE_PROPS: Partial<Record<StageId, readonly StagePropLabel[]>> = {
  mio_1r: [
    { id: 'kutsu', ja: 'くつ', reading: 'くつ' },
    { id: 'tsukue', ja: 'つくえ', reading: 'つくえ' },
    { id: 'kamera', ja: 'カメラ', reading: 'かめら' },
    { id: 'poster', ja: 'ポスター', reading: 'ぽすたー' },
    { id: 'hondana', ja: '本棚', reading: 'ほんだな' },
    { id: 'mado', ja: '窓', reading: 'まど' },
  ],
  aiko_tatami: [
    { id: 'tatami', ja: 'たたみ', reading: 'たたみ' },
    { id: 'kotatsu', ja: 'こたつ', reading: 'こたつ' },
    { id: 'zabuton', ja: 'ざぶとん', reading: 'ざぶとん' },
    { id: 'shoji', ja: 'しょうじ', reading: 'しょうじ' },
    { id: 'kyusu', ja: 'きゅうす', reading: 'きゅうす' },
    { id: 'hana', ja: '花', reading: 'はな' },
  ],
  kenji_flat: [
    { id: 'chabudai', ja: 'ちゃぶ台', reading: 'ちゃぶだい' },
    { id: 'suihanki', ja: '炊飯器', reading: 'すいはんき' },
    { id: 'shashin', ja: '写真', reading: 'しゃしん' },
    { id: 'yakyu', ja: '野球', reading: 'やきゅう' },
    { id: 'e', ja: '絵', reading: 'え' },
    { id: 'zabuton', ja: 'ざぶとん', reading: 'ざぶとん' },
  ],
};

export const propPickId = (stage: StageId, prop: string) => `prop:${stage}:${prop}`;

/** `prop:mio_1r:kamera` -> `{ stage: 'mio_1r', prop: 'kamera', label }`; null for any other id */
export function parsePropPick(id: string): { stage: StageId; prop: string; label: StagePropLabel | null } | null {
  const m = /^prop:([a-z0-9_]+):([a-z0-9_]+)$/.exec(id);
  if (!m) return null;
  const stage = m[1] as StageId;
  return { stage, prop: m[2], label: STAGE_PROPS[stage]?.find((p) => p.id === m[2]) ?? null };
}

/** The pick ids every stage has besides its props. `host:<id>` is one per person in the room (the host and Hina). */
export const STAGE_EXIT_PICK = 'stage:exit';
export const GENKAN_SHOES_PICK = 'genkan:shoes';
export const GENKAN_SLIPPERS_PICK = 'genkan:slippers';
export const hostPickId = (actor: string) => `host:${actor}`;
