// The fitting-room mirror sits 132px down on a phone held upright; on a short (landscape) screen the conversation's card starts about 150px
// down, so the mirror must shrink and drop its caption there, or it hides the first suggestion chips.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles/wallet.css', import.meta.url), 'utf8');

describe('fitting mirror on a short screen', () => {
  it('has a max-height media rule that makes it small and hides the caption', () => {
    const m = css.match(/@media \(max-height: 520px\) \{([\s\S]*?)\n\}\n/);
    expect(m, 'a short-screen rule').toBeTruthy();
    const rule = m![1];
    expect(rule).toMatch(/\.fit-mirror \{[^}]*top: calc\(var\(--safe-top, 0px\) \+ 118px\)/);
    expect(rule).toMatch(/\.fit-figure \{[^}]*width: 28px/);
    expect(rule).toMatch(/\.fit-mirror figcaption \{[^}]*display: none/);
  });
});
