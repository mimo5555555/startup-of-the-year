import { LEXICON_PARTS } from '../packages/content/src/lexicon';
const mods = process.argv.slice(2);
for (const [m, es] of Object.entries(LEXICON_PARTS)) if (mods.includes(m)) console.log(m + ': ' + es.map((e) => e.s + (e.g ? '~' : '')).join(' '));
