import type { CCard, CColor } from '../core/colors';

/** Crazy Colors card faces: art-deco frame, a round medallion and the symbol, in four neon colors. */
export const CC_HEX: Record<CColor, [string, string]> = {
  coral: ['#ff8a96', '#e23a52'],
  teal: ['#6ff5e2', '#0e9f90'],
  gold: ['#ffe28a', '#e0a01c'],
  violet: ['#c6a8ff', '#7446e0'],
};

function symbol(v: CCard['value'], fill: string): string {
  switch (v) {
    case 'freeze':
      return `<g stroke="${fill}" stroke-width="4" stroke-linecap="round">${[0, 60, 120].map(a => `<path d="M35 31 L35 67" transform="rotate(${a} 35 49)"/><path d="M29 37 L35 43 L41 37" fill="none" transform="rotate(${a} 35 49)"/><path d="M29 61 L35 55 L41 61" fill="none" transform="rotate(${a} 35 49)"/>`).join('')}</g>`;
    case 'flip':
      return `<g fill="none" stroke="${fill}" stroke-width="4.5" stroke-linecap="round"><path d="M22 44 A13 13 0 0 1 46 40"/><path d="M48 54 A13 13 0 0 1 24 58"/></g><path d="M46 31 L50 42 L39 42Z M24 67 L20 56 L31 56Z" fill="${fill}"/>`;
    case 'plus2':
      return `<text x="35" y="60" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="28" fill="${fill}">+2</text>`;
    case 'wild4':
      return `${rainbow(35, 46, 13)}<text x="35" y="75" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="15" fill="#fff">+4</text>`;
    case 'wild':
      return rainbow(35, 49, 16);
    default:
      return `<text x="35" y="62" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="36" fill="${fill}">${v}</text>`;
  }
}

function rainbow(cx: number, cy: number, r: number) {
  const cols: CColor[] = ['coral', 'gold', 'teal', 'violet'];
  return cols.map((c, i) => {
    const a0 = (i * Math.PI) / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2;
    return `<path d="M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}Z" fill="${CC_HEX[c][1]}"/>`;
  }).join('') + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2"/>`;
}

const corner = (v: CCard['value']) => ({ freeze: '❄', flip: '⇄', plus2: '+2', wild: '★', wild4: '+4' }[v as string] ?? v);

export function ccCardSvg(c: CCard | null, faceDown = false, shownColor?: CColor): string {
  if (!c || faceDown) {
    return `<svg viewBox="0 0 70 98" class="cc-card back"><defs><linearGradient id="ccb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2560"/><stop offset="1" stop-color="#0b1030"/></linearGradient></defs>
      <rect x="1" y="1" width="68" height="96" rx="8" fill="url(#ccb)" stroke="#f5c542" stroke-width="2"/>
      ${rainbow(35, 49, 18)}<rect x="6" y="6" width="58" height="86" rx="5" fill="none" stroke="#f5c54288"/>
      <text x="35" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="6.4" letter-spacing=".6" fill="#f5c542">CRAZY COLORS</text></svg>`;
  }
  const [light, dark] = c.color ? CC_HEX[c.color] : ['#2a2f5a', '#0b1030'];
  const gid = `cc${c.id}`;
  const ring = shownColor && !c.color ? `<rect x="2" y="2" width="66" height="94" rx="7" fill="none" stroke="${CC_HEX[shownColor][1]}" stroke-width="5"/>` : '';
  const ink = c.color ? dark : '#fff';
  return `<svg viewBox="0 0 70 98" class="cc-card"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
    <rect x="1" y="1" width="68" height="96" rx="8" fill="url(#${gid})" stroke="#fff8" stroke-width="2"/>
    <path d="M35 8 L62 22 L62 76 L35 90 L8 76 L8 22Z" fill="none" stroke="#ffffff55" stroke-width="1.5"/>
    <circle cx="35" cy="49" r="22" fill="${c.color ? '#fffdf6' : '#141a3a'}" stroke="#fff" stroke-width="2"/>
    ${symbol(c.value, ink)}
    <text x="7" y="17" font-family="Georgia, serif" font-weight="900" font-size="13" fill="#fff">${corner(c.value)}</text>
    <g transform="rotate(180 35 49)"><text x="7" y="17" font-family="Georgia, serif" font-weight="900" font-size="13" fill="#fff">${corner(c.value)}</text></g>
    ${ring}</svg>`;
}

/** Simple round avatars for the computer players (original characters). */
export const BOTS = [
  { name: 'Pip', color: '#2ef2d0', face: '🐧' },
  { name: 'Coral', color: '#ff6b81', face: '🦀' },
  { name: 'Moe', color: '#b07bff', face: '🦭' },
];
