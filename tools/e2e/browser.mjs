// Shared helpers for driving the app in the preinstalled Chromium.
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

export function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const direct = `${root}/chromium`;
  if (existsSync(direct)) {
    // `chromium` may itself be the install dir or a launcher
    const candidates = ['chrome-linux/chrome', 'chrome', 'chrome-linux64/chrome'];
    for (const c of candidates) if (existsSync(`${direct}/${c}`)) return `${direct}/${c}`;
    return direct;
  }
  const dirs = readdirSync(root).filter((d) => d.startsWith('chromium-'));
  for (const d of dirs) for (const c of ['chrome-linux/chrome', 'chrome-linux64/chrome']) if (existsSync(`${root}/${d}/${c}`)) return `${root}/${d}/${c}`;
  throw new Error('No Chromium found');
}

export async function launch({ width = 412, height = 860, dpr = 2, mobile = true, locale = 'en-US', colorScheme = 'light' } = {}) {
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--enable-webgl'],
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: mobile,
    hasTouch: mobile,
    locale,
    colorScheme,
  });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  return { browser, context, page, logs };
}
