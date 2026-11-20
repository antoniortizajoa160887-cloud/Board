import type { Card } from '../core/cards';
import { isRed, rankLabel, SUIT_GLYPH } from '../core/cards';
import type { Sym } from '../core/slots';
import { art, imgHtml, olliePath, type Pose } from './assets';

/** All game art is drawn in code as SVG, in the neon art-deco look (navy, gold, neon). */

const defs = `
<defs>
  <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f5c542"/><stop offset="1" stop-color="#a86b12"/></linearGradient>
  <linearGradient id="gPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc0ea"/><stop offset="1" stop-color="#e2338f"/></linearGradient>
  <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6fff1"/><stop offset="1" stop-color="#0fa79a"/></linearGradient>
  <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d4ff"/><stop offset="1" stop-color="#3561e0"/></linearGradient>
  <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3a8"/><stop offset="1" stop-color="#d42a2a"/></linearGradient>
  <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c4ff"/><stop offset="1" stop-color="#7a35d8"/></linearGradient>
  <radialGradient id="gPearl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e8e4ff"/><stop offset="1" stop-color="#9a8fd0"/></radialGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

const SYM_SVG: Record<Sym, string> = {
  pearl: `<circle cx="50" cy="52" r="26" fill="url(#gPearl)" stroke="#fff" stroke-opacity=".5"/><ellipse cx="41" cy="42" rx="8" ry="5" fill="#fff" opacity=".8"/>`,
  star: `<path d="M50 18 L59 40 L83 41 L64 56 L71 80 L50 66 L29 80 L36 56 L17 41 L41 40Z" fill="url(#gTeal)" stroke="#d6fff9" stroke-width="2" filter="url(#glow)"/>`,
  shell: `<path d="M50 20 C25 30 18 58 30 76 L70 76 C82 58 75 30 50 20Z" fill="url(#gPink)" stroke="#ffe0f3" stroke-width="2"/><path d="M50 22 L50 76 M50 22 L38 76 M50 22 L62 76 M50 22 L28 70 M50 22 L72 70" stroke="#a01e63" stroke-width="2.4" fill="none"/><rect x="40" y="76" width="20" height="8" rx="3" fill="#c22a79"/>`,
  bell: `<path d="M50 16 C34 16 30 32 30 48 C30 60 24 66 20 72 L80 72 C76 66 70 60 70 48 C70 32 66 16 50 16Z" fill="url(#gGold)" stroke="#fff6c8" stroke-width="2"/><circle cx="50" cy="80" r="7" fill="#a86b12"/><path d="M38 30 C36 40 36 50 36 58" stroke="#fffbe0" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
  bar: `<rect x="12" y="34" width="76" height="32" rx="6" fill="#120a2e" stroke="url(#gBlue)" stroke-width="4" filter="url(#glow)"/><text x="50" y="59" text-anchor="middle" font-family="Marcellus, Georgia, serif" font-weight="700" font-size="24" fill="url(#gBlue)" letter-spacing="3">BAR</text>`,
  seven: `<text x="50" y="80" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="74" fill="url(#gRed)" stroke="#ffd7cf" stroke-width="2" filter="url(#glow)">7</text>`,
  wild: `<circle cx="50" cy="50" r="34" fill="#0d1a3e" stroke="url(#gGold)" stroke-width="4"/>${otterFace(50, 46, 0.55)}<text x="50" y="86" text-anchor="middle" font-family="Marcellus, Georgia, serif" font-weight="700" font-size="15" fill="url(#gGold)" letter-spacing="2">WILD</text>`,
  jackpot: `<path d="M18 70 L22 32 L36 48 L50 22 L64 48 L78 32 L82 70Z" fill="url(#gGold)" stroke="#fff3b0" stroke-width="2" filter="url(#glow)"/><rect x="18" y="70" width="64" height="10" rx="3" fill="url(#gPurple)"/><circle cx="50" cy="56" r="6" fill="url(#gPink)"/><circle cx="34" cy="60" r="4" fill="url(#gTeal)"/><circle cx="66" cy="60" r="4" fill="url(#gTeal)"/>`,
};

export function symbolSvg(s: Sym): string {
  return imgHtml(`slots/${s}.webp`, `sym sym-${s}`, s);
}
/** The old drawn symbol, kept for tiny places. */
export function symbolDrawn(s: Sym): string {
  return `<svg viewBox="0 0 100 100" class="sym sym-${s}" aria-label="${s}">${defs}${SYM_SVG[s]}</svg>`;
}

/** The otter's face, used for the dealer and the wild symbol. */
function otterFace(cx: number, cy: number, s: number): string {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <circle cx="-30" cy="-28" r="11" fill="#8a5a3c"/><circle cx="30" cy="-28" r="11" fill="#8a5a3c"/>
    <circle cx="-30" cy="-28" r="5" fill="#5a3824"/><circle cx="30" cy="-28" r="5" fill="#5a3824"/>
    <ellipse cx="0" cy="0" rx="40" ry="36" fill="#9b6845"/>
    <ellipse cx="0" cy="12" rx="28" ry="22" fill="#f3dcc0"/>
    <circle cx="-15" cy="-6" r="6" fill="#1b1020"/><circle cx="15" cy="-6" r="6" fill="#1b1020"/>
    <circle cx="-13" cy="-8" r="2" fill="#fff"/><circle cx="17" cy="-8" r="2" fill="#fff"/>
    <ellipse cx="0" cy="6" rx="8" ry="6" fill="#2a1620"/>
    <path d="M-10 16 Q0 24 10 16" stroke="#2a1620" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M-22 8 L-40 4 M-22 12 L-40 14 M22 8 L40 4 M22 12 L40 14" stroke="#e9d5bd" stroke-width="1.5"/>
  </g>`;
}

/** Ollie the otter dealer: gold vest and bow tie. */
export function dealerSvg(pose: Pose = 'idle'): string {
  return imgHtml(olliePath(pose), 'dealer', 'Ollie');
}
export function dealerDrawn(): string {
  return `<svg viewBox="0 0 120 130" class="dealer" aria-label="Ollie the dealer">${defs}
    <path d="M18 130 C18 92 34 78 60 78 C86 78 102 92 102 130Z" fill="#9b6845"/>
    <path d="M30 130 C30 98 42 86 60 86 C78 86 90 98 90 130Z" fill="url(#gGold)"/>
    <path d="M60 88 L60 130" stroke="#7a4d10" stroke-width="2"/>
    <circle cx="60" cy="102" r="3" fill="#fff6c8"/><circle cx="60" cy="116" r="3" fill="#fff6c8"/>
    <path d="M44 84 L60 92 L44 100Z M76 84 L60 92 L76 100Z" fill="url(#gPink)"/><circle cx="60" cy="92" r="4" fill="#c22a79"/>
    ${otterFace(60, 48, 0.95)}
  </svg>`;
}

const COURT: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king' };

export function cardSvg(c: Card | null, faceDown = false): string {
  if (!c || faceDown) {
    return imgHtml('cards/back.webp', 'pcard back');
  }
  const col = isRed(c) ? '#d42a4a' : '#141a33';
  const r = rankLabel(c.rank);
  const g = SUIT_GLYPH[c.suit];
  return `<svg viewBox="0 0 70 98" class="pcard">${defs}<rect x="1" y="1" width="68" height="96" rx="7" fill="#fdfaf2" stroke="#d9c79a" stroke-width="2"/>
    <text x="7" y="20" font-family="Georgia, serif" font-weight="700" font-size="17" fill="${col}">${r}</text>
    <text x="8" y="36" font-size="14" fill="${col}">${g}</text>
    ${c.rank > 10 && c.rank < 14
    ? `<rect x="15" y="22" width="40" height="56" rx="4" fill="${isRed(c) ? '#fbe6ea' : '#e6ebf6'}" stroke="#d9c79a"/><text x="35" y="60" text-anchor="middle" font-size="22" fill="${col}" opacity=".35">${g}</text><image href="${art(`cards/${COURT[c.rank]}.webp`)}" x="13" y="20" width="44" height="60" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="35" y="66" text-anchor="middle" font-size="36" fill="${col}">${g}</text>`}
    <g transform="rotate(180 35 49)"><text x="7" y="20" font-family="Georgia, serif" font-weight="700" font-size="17" fill="${col}">${r}</text></g></svg>`;
}

export function chipSvg(value: number, color: string): string {
  if (CHIP_ART.includes(value)) return `<span class="chip-art">${imgHtml(`chips/c${value}.webp`, 'chip-img')}<b>${value >= 1000 ? value / 1000 + 'K' : value}</b></span>`;
  return chipDrawn(value, color);
}
const CHIP_ART = [10, 25, 50, 100, 250, 500, 1000];
function chipDrawn(value: number, color: string): string {
  return `<svg viewBox="0 0 60 60" class="chip-svg"><circle cx="30" cy="30" r="28" fill="${color}" stroke="#fff" stroke-width="2"/>
    ${[0, 60, 120, 180, 240, 300].map(a => `<rect x="27" y="2" width="6" height="10" fill="#fff" transform="rotate(${a} 30 30)"/>`).join('')}
    <circle cx="30" cy="30" r="17" fill="none" stroke="#fff" stroke-dasharray="3 3"/>
    <text x="30" y="35" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${value >= 1000 ? 11 : 14}" fill="#fff">${value >= 1000 ? value / 1000 + 'K' : value}</text></svg>`;
}

export const CHIP_COLORS: Record<number, string> = { 10: '#3561e0', 25: '#0fa79a', 50: '#e2338f', 100: '#141a33', 250: '#7a35d8', 500: '#d42a2a', 1000: '#a86b12' };

/** Icons for the hall tiles. */
export const ICONS = {
  casino: `<svg viewBox="0 0 100 100">${defs}<circle cx="50" cy="50" r="38" fill="#0d1a3e" stroke="url(#gGold)" stroke-width="5"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="46" y="12" width="8" height="12" fill="${a % 90 ? '#e2338f' : '#f5c542'}" transform="rotate(${a} 50 50)"/>`).join('')}<text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="34" fill="url(#gGold)">7</text></svg>`,
  arcade: `<svg viewBox="0 0 100 100">${defs}<rect x="14" y="30" width="72" height="44" rx="22" fill="url(#gTeal)" stroke="#d6fff9" stroke-width="3"/><rect x="26" y="47" width="18" height="6" rx="2" fill="#0d1a3e"/><rect x="32" y="41" width="6" height="18" rx="2" fill="#0d1a3e"/><circle cx="64" cy="46" r="5" fill="url(#gPink)"/><circle cx="72" cy="56" r="5" fill="url(#gGold)"/></svg>`,
  board: `<svg viewBox="0 0 100 100">${defs}<rect x="16" y="16" width="68" height="68" rx="8" fill="#0d1a3e" stroke="url(#gGold)" stroke-width="4"/>${[0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => (i + j) % 2 ? `<rect x="${22 + i * 14}" y="${22 + j * 14}" width="14" height="14" fill="#7a35d8" opacity=".7"/>` : '').join('')).join('')}<circle cx="43" cy="43" r="8" fill="url(#gRed)"/><circle cx="64" cy="64" r="8" fill="url(#gPearl)"/></svg>`,
  slots: `<svg viewBox="0 0 100 100">${defs}<rect x="12" y="20" width="76" height="60" rx="10" fill="#0d1a3e" stroke="url(#gGold)" stroke-width="4"/><text x="30" y="62" text-anchor="middle" font-family="Georgia" font-weight="900" font-size="28" fill="url(#gRed)">7</text><text x="50" y="62" text-anchor="middle" font-family="Georgia" font-weight="900" font-size="28" fill="url(#gRed)">7</text><text x="70" y="62" text-anchor="middle" font-family="Georgia" font-weight="900" font-size="28" fill="url(#gRed)">7</text></svg>`,
  cards: `<svg viewBox="0 0 100 100">${defs}<rect x="22" y="22" width="40" height="56" rx="5" fill="#fdfaf2" transform="rotate(-12 42 50)"/><rect x="40" y="22" width="40" height="56" rx="5" fill="#fdfaf2" stroke="#d9c79a" transform="rotate(10 60 50)"/><text x="62" y="58" text-anchor="middle" font-size="24" fill="#d42a4a" transform="rotate(10 60 50)">♥</text></svg>`,
  roulette: `<svg viewBox="0 0 100 100">${defs}<circle cx="50" cy="50" r="38" fill="#0d1a3e" stroke="url(#gGold)" stroke-width="5"/>${Array.from({ length: 12 }, (_, i) => `<path d="M50 50 L${50 + 34 * Math.cos((i * 30) * Math.PI / 180)} ${50 + 34 * Math.sin((i * 30) * Math.PI / 180)} A34 34 0 0 1 ${50 + 34 * Math.cos(((i + 1) * 30) * Math.PI / 180)} ${50 + 34 * Math.sin(((i + 1) * 30) * Math.PI / 180)}Z" fill="${i % 2 ? '#d42a2a' : '#141a33'}"/>`).join('')}<circle cx="50" cy="50" r="12" fill="url(#gGold)"/><circle cx="72" cy="30" r="4" fill="#fff"/></svg>`,
  poker: `<svg viewBox="0 0 100 100">${defs}${[0, 1, 2].map(i => `<rect x="${18 + i * 18}" y="24" width="34" height="50" rx="4" fill="#fdfaf2" stroke="#d9c79a"/>`).join('')}<text x="70" y="58" text-anchor="middle" font-size="22" fill="#141a33">♠</text><text x="50" y="92" text-anchor="middle" font-family="Georgia" font-size="12" font-weight="700" fill="url(#gGold)">ACE</text></svg>`,
  bingo: `<svg viewBox="0 0 100 100">${defs}<circle cx="38" cy="44" r="22" fill="url(#gPink)"/><circle cx="38" cy="44" r="12" fill="#fff"/><text x="38" y="49" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="13" fill="#141a33">B7</text><circle cx="66" cy="62" r="20" fill="url(#gTeal)"/><circle cx="66" cy="62" r="11" fill="#fff"/><text x="66" y="67" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="12" fill="#141a33">O66</text></svg>`,
  dice: `<svg viewBox="0 0 100 100">${defs}<rect x="18" y="30" width="36" height="36" rx="7" fill="url(#gRed)" transform="rotate(-14 36 48)"/><rect x="48" y="38" width="36" height="36" rx="7" fill="#fdfaf2" transform="rotate(10 66 56)"/><circle cx="36" cy="48" r="4" fill="#fff"/><circle cx="66" cy="56" r="4" fill="#141a33"/><circle cx="58" cy="48" r="4" fill="#141a33"/><circle cx="74" cy="64" r="4" fill="#141a33"/></svg>`,
  keno: `<svg viewBox="0 0 100 100">${defs}${Array.from({ length: 16 }, (_, i) => `<circle cx="${22 + (i % 4) * 19}" cy="${22 + Math.floor(i / 4) * 19}" r="7" fill="${[1, 6, 11, 12].includes(i) ? '#f5c542' : '#1c2a5e'}"/>`).join('')}</svg>`,
  zip: `<svg viewBox="0 0 100 100">${defs}<circle cx="50" cy="50" r="38" fill="#0d1a3e" stroke="url(#gTeal)" stroke-width="4"/>${otterFace(50, 50, 0.6)}<path d="M22 72 Q50 84 78 70" stroke="#ff8a2a" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`,
  lock: `<svg viewBox="0 0 100 100">${defs}<rect x="28" y="44" width="44" height="36" rx="6" fill="url(#gGold)"/><path d="M36 44 V34 a14 14 0 0 1 28 0 V44" stroke="url(#gGold)" stroke-width="7" fill="none"/></svg>`,
};
