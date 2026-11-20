import { isNative, openExternal } from './platform';

declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

export const BUILD_ID = __BUILD_ID__;
export const APP_VERSION = __APP_VERSION__;

// The Android app updates by downloading the newest APK, which CI publishes on this release.
// GitHub only answers this check for public repositories, so it stays quiet on a private one.
export const RELEASE_PAGE = 'https://github.com/antoniortizajoa160887-cloud/Board/releases/tag/apk-latest';
const APK_RELEASE = 'https://api.github.com/repos/antoniortizajoa160887-cloud/Board/releases/tags/apk-latest';
const CHECK_EVERY_MS = 10 * 60 * 1000;

let shown = false;
let lastCheck = 0;

async function fetchLatest(): Promise<{ build: string; download: string } | null> {
  const r = await fetch(APK_RELEASE, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  const rel = (await r.json()) as { body?: string; assets?: { name: string; browser_download_url: string }[] };
  const build = /build:\s*([0-9a-f]+)/.exec(rel.body ?? '')?.[1];
  const apk = rel.assets?.find(a => a.name.endsWith('.apk'));
  return build && apk ? { build, download: apk.browser_download_url } : null;
}

function banner(download: string) {
  if (shown) return;
  shown = true;
  const el = document.createElement('div');
  el.id = 'update-bar';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span>A new version of Lucky Lagoon is ready.</span>';
  const go = document.createElement('button');
  go.textContent = 'Download';
  go.onclick = () => openExternal(download);
  const later = document.createElement('button');
  later.className = 'later';
  later.setAttribute('aria-label', 'Later');
  later.textContent = '✕';
  later.onclick = () => el.remove();
  el.append(go, later);
  document.body.append(el);
}

export async function checkForUpdate(force = false): Promise<'new' | 'same' | 'unknown'> {
  if (!force && (shown || !navigator.onLine || Date.now() - lastCheck < 30_000)) return 'unknown';
  lastCheck = Date.now();
  try {
    const latest = await fetchLatest();
    if (!latest) return 'unknown';
    if (latest.build !== BUILD_ID) { banner(latest.download); return 'new'; }
    return 'same';
  } catch {
    return 'unknown';
  }
}

export function watchForUpdates() {
  if (import.meta.env.DEV || !isNative) return;
  void checkForUpdate();
  window.setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdate(); });
}
