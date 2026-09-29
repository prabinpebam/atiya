// Render the family's talking-head portraits (family.md §6) from the game itself, so they're exactly
// how each one looks on the planet (skin, hair, glasses):
//
//   npm run dev
//   npm run build:npc-portraits -- [--url http://127.0.0.1:4321/play/]
//
// For each of them: walk up, say hello (so they stop and turn to you), and render their head and
// shoulders on a transparent background (`__game.npcPortrait`: world/home/portrait.ts). Writes
// public/avatars/npc/<id>.webp.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const i = process.argv.indexOf('--url');
const url = i < 0 ? 'http://127.0.0.1:4321/play/' : process.argv[i + 1];
const FAMILY = ['prabin', 'rojina', 'laija', 'lingjel'];
const OUT = join(process.cwd(), 'public', 'avatars', 'npc');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  localStorage.setItem('game.test.welcome', '0');
  localStorage.setItem('game.test.pop', '0');
});
await page.goto(url);
await page.waitForFunction(() => window.__game?.loadStage?.().tier === 'complete', null, { timeout: 120_000 });
// midday, still air: everyone's out and about
await page.evaluate(() => {
  window.__game.setTime(11);
  window.__game.setWind(0);
});
for (const id of FAMILY) {
  await page.evaluate((who) => window.__game.nearNpc(who, 0.9, true), id);
  await page.locator('.game-region').focus();
  await page.waitForTimeout(400);
  await page.keyboard.press('e');
  // (they stop, turn to you and settle)
  await page.waitForTimeout(1800);
  const data = await page.evaluate((who) => window.__game.npcPortrait(who, 192), id);
  await page.keyboard.press('Space');
  if (!data?.startsWith('data:image/webp')) {
    console.error(`✗ ${id}: no portrait`);
    process.exitCode = 1;
    continue;
  }
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(join(OUT, `${id}.webp`), bytes);
  console.log(`${id}.webp ${(bytes.length / 1024).toFixed(1)} KB`);
}
await browser.close();
