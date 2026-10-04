// Spaced repetition on top of FSRS (ts-fsrs). Cards are stored as plain JSON.
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade as FsrsGrade } from 'ts-fsrs';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));

const GRADE: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toCard(c: SrsCard): Card {
  return {
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  } as Card;
}

function fromCard(c: Card): SrsCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as number,
    last_review: c.last_review ? c.last_review.toISOString() : undefined,
  };
}

export function newSrsCard(now = new Date()): SrsCard {
  return fromCard(createEmptyCard(now));
}

export function reviewCard(card: SrsCard, grade: Grade, now = new Date()): SrsCard {
  return fromCard(scheduler.next(toCard(card), now, GRADE[grade]).card);
}

export function isDue(card: SrsCard, now = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** Human label for how long until the card returns after each answer, e.g. "10m", "3d". */
export function previewIntervals(card: SrsCard, now = new Date()): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of Object.keys(GRADE) as Grade[]) {
    const next = scheduler.next(toCard(card), now, GRADE[g]).card;
    out[g] = formatInterval(next.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${Math.round(mo / 12)}y`;
}
