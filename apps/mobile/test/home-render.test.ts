import './_fakeStorage';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { HOMES } from '@lw/content';
import { PropChips } from '../src/components/game/PanelFallback';
import { DoorTip } from '../src/components/game/HomeStage';
import { useStore } from '../src/store';

// The new home screens follow the reading settings: the chips of the panel fallback and the door tooltip show furigana and romaji only when
// they are on (regression: the chips were bare kanji, and the tooltip always wrote its furigana).
const setReadings = (furigana: boolean, romaji: boolean) => {
  useStore.setState({ settings: { ...useStore.getState().settings, furigana, romaji } });
  Object.assign(useStore.getInitialState(), useStore.getState()); // renderToStaticMarkup reads the initial snapshot
};
const chips = () => renderToStaticMarkup(createElement(PropChips, { home: HOMES.home_aiko!, discovered: [], onTap: () => {} }));
const tip = () => renderToStaticMarkup(createElement(DoorTip, { status: { t: 'hearts', need: 4, have: 2 }, name: 'Mio', onClose: () => {} }));

describe('home screens and the reading settings', () => {
  it('the prop chips carry the reading of a kanji word when furigana is on', () => {
    setReadings(true, false);
    const on = chips();
    expect(on).toContain('たたみ');
    expect(on).not.toContain('class="rm"');
    setReadings(false, false);
    const off = chips();
    expect(off).not.toContain('たたみ');
    expect(off).toContain('畳');
  });

  it('the prop chips show romaji only when romaji is on', () => {
    setReadings(false, true);
    expect(chips()).toContain('class="rm">tatami');
    setReadings(false, false);
    expect(chips()).not.toContain('class="rm">tatami');
  });

  it('the door tooltip writes 入れません with furigana only when it is on', () => {
    setReadings(true, false);
    expect(tip()).toContain('いれません');
    setReadings(false, false);
    const off = tip();
    expect(off).toContain('入れません');
    expect(off).not.toContain('いれません');
  });
});
