// Pure rules of the stamp book (docs/GAME_DESIGN.md §10): which cards are shown, a card's state, the phrase a learner says. No React.
import { LEXICON, tokenize, type Token, type Vars } from '@lw/content';
import type { AgeGroup, CultureCard, GamePack, GameState } from '@lw/game';

/**
 * Cards whose trigger belongs to content that is not in Release 1 (home visits, the flat, Aiko's viewing, the festival;
 * docs/RELEASE_1.md). They stay in the pack but the stamp book hides them until they are collected: no locked card that cannot be earned.
 */
export const DEFERRED_CARDS: readonly string[] = ['cc_shoesoff', 'cc_rent', 'cc_trash', 'cc_matsuri'];

export type CardState = 'locked' | 'seen' | 'said';

/** The cards the stamp book lists for this profile: every collectable card, plus a deferred or adult-only card once it is collected. */
export function shownCards(pack: GamePack, game: GameState, age: AgeGroup | undefined): CultureCard[] {
  return pack.culture.filter((c) => {
    if (game.culture[c.id] !== undefined) return true;
    if (DEFERRED_CARDS.includes(c.id)) return false;
    return !(c.adultOnly && age !== undefined && pack.ageProfiles[age]?.adultTopics === false);
  });
}

export function cardState(card: CultureCard, game: GameState): CardState {
  if (game.culture[card.id] === undefined) return 'locked';
  return card.say && game.stats.cultureSaid.includes(card.id) ? 'said' : 'seen';
}

/** The parts of a key phrase ("A / B" is two phrases). */
export const phraseParts = (ja: string): string[] => ja.split(/\s+[/／]\s+/).filter(Boolean);

/** What a learner says for a card: the first part of the phrase (the reducer counts any part in a conversation). */
export const sayTarget = (card: CultureCard): string => phraseParts(card.phrase.ja)[0] ?? card.phrase.ja;

/** The tokens of each part of a card's phrase; `{name}` takes the player's (katakana) name. */
export function phraseTokens(card: CultureCard, name: string): Token[][] {
  const vars: Vars = { name: { ja: name || '…', raw: true } };
  return phraseParts(card.phrase.ja).map((p) => tokenize(p, LEXICON, vars).tokens);
}

/** Collected / collectable counts for the header. */
export function bookCounts(pack: GamePack, game: GameState, age: AgeGroup | undefined): { have: number; total: number; said: number; sayable: number } {
  const cards = shownCards(pack, game, age);
  return {
    have: cards.filter((c) => game.culture[c.id] !== undefined).length,
    total: cards.length,
    said: cards.filter((c) => cardState(c, game) === 'said').length,
    sayable: cards.filter((c) => c.say).length,
  };
}

// The card the stamp book opens on (the pop-up's "Say it" button sets it; the screen reads and clears it when it mounts).
let focusId: string | null = null;
export const setCultureFocus = (id: string | null): void => {
  focusId = id;
};
export const takeCultureFocus = (): string | null => {
  const id = focusId;
  focusId = null;
  return id;
};
