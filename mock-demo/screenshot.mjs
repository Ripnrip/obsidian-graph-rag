import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const htmlPath = 'file://' + join(__dir, 'index.html');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 860 });

// Load page and wait for D3 to render
await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000); // let D3 sim settle + fit view

// Screenshot 1: initial state (graph settled, no highlights)
await page.screenshot({ path: join(__dir, 'screenshot-1-initial.png'), fullPage: false });
console.log('Saved screenshot-1-initial.png');

// Screenshot 2: trigger first demo query (RAG + vector search)
await page.click('#demo-query-btn');
await page.waitForTimeout(3200); // query delay + render
await page.screenshot({ path: join(__dir, 'screenshot-2-rag-query.png'), fullPage: false });
console.log('Saved screenshot-2-rag-query.png');

// Screenshot 3: second demo query (Zettelkasten)
await page.click('#demo-query-btn');
await page.waitForTimeout(2800);
await page.screenshot({ path: join(__dir, 'screenshot-3-zettelkasten.png'), fullPage: false });
console.log('Saved screenshot-3-zettelkasten.png');

// Screenshot 4: third demo query (attention mechanism)
await page.click('#demo-query-btn');
await page.waitForTimeout(3200);
await page.screenshot({ path: join(__dir, 'screenshot-4-attention.png'), fullPage: false });
console.log('Saved screenshot-4-attention.png');

// Screenshot 5: reset + hover a node for tooltip
await page.click('#reset-btn');
await page.waitForTimeout(400);
// Hover first node area
const nodeEls = await page.$$('.node circle');
if (nodeEls.length > 2) {
  await nodeEls[2].hover();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: join(__dir, 'screenshot-5-tooltip.png'), fullPage: false });
console.log('Saved screenshot-5-tooltip.png');

await browser.close();
console.log('Done!');
