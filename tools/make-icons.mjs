// Draws the launcher icons and splash screens from the game's own SVG art and writes every size.
// Run: npm run build (so dist/ exists is not needed) then `node tools/make-icons.mjs`. Needs Playwright.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const RES = 'android/app/src/main/res';
const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:5199/tools/icon.html');
await p.waitForFunction(() => window.ready);

async function shot(kind, w, hgt, path) {
  await p.setViewportSize({ width: w, height: hgt });
  await p.evaluate(([k]) => window.draw(k), [kind]);
  await p.screenshot({ path, omitBackground: kind !== 'splash' });
}

for (const dir of readdirSync(RES)) {
  for (const f of readdirSync(join(RES, dir))) {
    const path = join(RES, dir, f);
    if (!f.endsWith('.png') || !statSync(path).isFile()) continue;
    const sizeOut = (await import('node:child_process')).execFileSync('python3', ['-c', `import struct;f=open(${JSON.stringify(path)},'rb');f.read(16);print(*struct.unpack('>II',f.read(8)))`]).toString().trim().split(' ').map(Number);
    const [w, hgt] = sizeOut;
    const kind = f.startsWith('splash') ? 'splash' : f.includes('foreground') ? 'fg' : f.includes('round') ? 'round' : 'icon';
    await shot(kind, w, hgt, path);
  }
}
await shot('icon', 192, 192, 'public/icons/icon-192.png');
await shot('icon', 512, 512, 'public/icons/icon-512.png');
await b.close();
await server.close();
console.log('icons written');
