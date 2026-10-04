// Turns the single-file Vite build into the page body the Artifact tool wraps in its own skeleton:
// a <title>, the font stylesheet, one <style>, the root element and one module script. No <html>/<head>/<body>.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../dist-artifact/', import.meta.url));
const html = readFileSync(`${dir}index.html`, 'utf8');

const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'Language World';
const fonts = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
if (!styles.length || !scripts.length) throw new Error('Expected inlined CSS and JS in dist-artifact/index.html');

const page = [
  `<title>${title}</title>`,
  ...fonts.map((href) => `<link rel="stylesheet" href="${href}">`),
  `<style>\n${styles.join('\n')}\n</style>`,
  '<div id="root"></div>',
  ...scripts.map((s) => `<script type="module">\n${s}\n</script>`),
  '',
].join('\n');

writeFileSync(`${dir}page.html`, page);
console.log(`wrote dist-artifact/page.html (${(page.length / 1024).toFixed(0)} KB)`);
