// Downloads every file listed in tools/art.json into public/art.
// Entry: "path/name.webp": { "url": "...", "w": 512, "h": 512?, "fit": "cover"|"inside"?, "q": 82? }
// Audio entries ("*.mp3") are copied as they are. A file is fetched again only when its url changes.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const list = JSON.parse(await readFile('tools/art.json', 'utf8'));
const seenPath = 'public/art/sources.json';
let seen = {};
try { seen = JSON.parse(await readFile(seenPath, 'utf8')); } catch { /* first run */ }
const sharp = (await import('sharp')).default;
let fetched = 0, failed = 0;
for (const [path, e] of Object.entries(list)) {
  if (seen[path] === JSON.stringify(e)) continue;
  try {
    const r = await fetch(e.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const out = join('public/art', path);
    await mkdir(dirname(out), { recursive: true });
    if (/\.(mp3|ogg|wav)$/.test(path)) await writeFile(out, buf);
    else {
      let img = sharp(buf, { animated: path.endsWith('.gif') });
      if (e.w || e.h) img = img.resize(e.w ?? null, e.h ?? null, { fit: e.fit ?? 'inside', withoutEnlargement: true });
      if (path.endsWith('.webp')) img = img.webp({ quality: e.q ?? 82, alphaQuality: 90 });
      else if (path.endsWith('.png')) img = img.png({ compressionLevel: 9, palette: !!e.palette });
      else if (path.endsWith('.jpg')) img = img.jpeg({ quality: e.q ?? 82, mozjpeg: true });
      await img.toFile(out);
    }
    seen[path] = JSON.stringify(e);
    fetched++;
    console.log('ok', path);
  } catch (err) {
    failed++;
    console.log('FAILED', path, String(err));
  }
}
await mkdir('public/art', { recursive: true });
await writeFile(seenPath, JSON.stringify(seen, null, 1) + '\n');
console.log(`fetched ${fetched}, failed ${failed}`);

