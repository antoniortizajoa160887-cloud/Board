import { sfx, type Sfx } from '../audio';
import { chipsFor, makeWorld, starsFor, step, type GameEvent, type Input, type World } from '../core/platformer';
import { LEVELS } from '../core/zipLevels';
import { tr } from '../i18n';
import { buzz } from '../platform';
import { addChips, countPlay, profile, save } from '../save';
import { coinBurst, fmt, h } from '../ui/dom';
import { back, go, type Screen } from '../ui/router';
import { dialog, topBar } from '../ui/shell';
import { drawBackground, drawEnemy, drawTiles, drawZip, pearl, preloadZip, THEMES } from './zipArt';
import { say } from '../ui/assets';
import { howToPlay } from './howto';

const LEVEL_ES = ['Playa del Atardecer', 'Cala de Coral', 'Laguna de Medusas', 'Carrera del Arrecife', 'Muelles a la Luz de la Luna', 'Arrecife de Neón'];
const levelName = (i: number) => tr(LEVELS[i].name, LEVEL_ES[i]);

export const zipHowTo = () => howToPlay(tr('How to play Zip', 'Cómo jugar a Zip'), [
  [tr('The goal', 'La meta'), tr('Run Zip the otter to the golden shell at the end of each level.', 'Lleva a Zip, la nutria, hasta la concha dorada al final de cada nivel.')],
  [tr('Move', 'Moverse'), tr('Hold ◀ or ▶ to run. On a keyboard use the arrow keys or A and D.', 'Mantén ◀ o ▶ para correr. Con teclado usa las flechas o A y D.')],
  [tr('Jump', 'Saltar'), tr('Tap JUMP. Hold it longer to jump higher; let go early for a small hop.', 'Toca SALTAR. Mantenlo más tiempo para saltar más alto; suéltalo antes para un salto corto.')],
  [tr('Jet jump', 'Salto turbo'), tr('Tap JUMP again while in the air: Zip\'s red sneakers fire a second jump. You get it back when you land.', 'Toca SALTAR otra vez en el aire: los tenis rojos de Zip dan un segundo salto. Se recarga al tocar el suelo.')],
  [tr('Crabs', 'Cangrejos'), tr('Land on a crab from above to bounce off it. Touching it from the side hurts.', 'Cae sobre un cangrejo desde arriba para rebotar. Si lo tocas de lado, te hace daño.')],
  [tr('Jellyfish and spikes', 'Medusas y púas'), tr('Never touch them. Jellyfish float up and down, so wait for a gap.', 'Nunca los toques. Las medusas suben y bajan: espera a que haya espacio.')],
  [tr('Hearts', 'Corazones'), tr('You have 3 hearts. A hit or a fall into the water costs one. Flags save your place.', 'Tienes 3 corazones. Un golpe o caer al agua te quita uno. Las banderas guardan tu lugar.')],
  [tr('Pearls and stars', 'Perlas y estrellas'), tr('Pearls give chips. ? blocks hold 3 pearls: hit them from below. Earn a star for finishing, one for every pearl and one for no hits.', 'Las perlas dan fichas. Los bloques ? guardan 3 perlas: golpéalos desde abajo. Ganas una estrella por terminar, otra por todas las perlas y otra por no recibir golpes.')],
]);

/** Zip standing on a glowing disc, drawn with the same code as in the game. */
function zipPortrait() {
  const cv = h<HTMLCanvasElement>('canvas.zip-hero-art', { width: 192, height: 192 });
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(96, 96, 10, 96, 96, 92);
  g.addColorStop(0, '#2ef2d055'); g.addColorStop(1, '#0d1a3e');
  c.fillStyle = g; c.beginPath(); c.arc(96, 96, 90, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#2ef2d0'; c.lineWidth = 6; c.stroke();
  const p = makeWorld(LEVELS[0]).p;
  p.onGround = true; p.vx = 0;
  drawZip(c, p, 92, 168, 120, 1);
  return cv;
}

export const zipScreen: Screen = root => {
  const stars = profile.zip.stars;
  const unlocked = (i: number) => i === 0 || (stars[i - 1] ?? 0) > 0;
  const total = stars.reduce((a, b) => a + (b ?? 0), 0);
  root.append(topBar('Zip'), h('div.scroll', {},
    h('div.zip-hero', {}, zipPortrait(),
      h('div', {}, h('div.deco-title', {}, 'ZIP'), h('div.muted', {}, tr(`A speedy otter with jet sneakers · ★ ${total} / ${LEVELS.length * 3}`, `Una nutria veloz con tenis turbo · ★ ${total} / ${LEVELS.length * 3}`)))),
    h('div.zip-levels', {}, ...LEVELS.map((d, i) => {
      const open = unlocked(i), st = stars[i] ?? 0;
      const th = THEMES[d.theme];
      return h('button.zip-level' + (open ? '' : '.locked'), {
        style: `--a:${th.sky[1]};--b:${th.sky[2]}`,
        onclick: () => { sfx('click'); if (open) go(zipLevel(i)); else dialog(levelName(i), h('p', {}, tr('Finish the level before this one to open it.', 'Termina el nivel anterior para abrir este.'))); },
      },
      h('span.zl-num', {}, String(i + 1)),
      h('span.zl-name', {}, levelName(i)),
      h('span.zl-stars', {}, open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '🔒'));
    })),
    h('div.controls', {}, h('button.btn', { onclick: zipHowTo }, tr('How to play', 'Cómo jugar')))));
};

preloadZip();
const SOUND: Partial<Record<GameEvent, Sfx>> = { jump: 'jump', jet: 'jet', pearl: 'pearl', stomp: 'stomp', hurt: 'hurt', fall: 'hurt', flag: 'win', bonus: 'chip', spring: 'spring' };

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dot' | 'pearl' | 'text'; text?: string }

function zipLevel(index: number): Screen {
  return root => {
    root.classList.add('zip-view');
    const def = LEVELS[index];
    const th = THEMES[def.theme];
    let wd: World = makeWorld(def);
    const canvas = h<HTMLCanvasElement>('canvas.zip-canvas');
    const ctx = canvas.getContext('2d')!;
    const hearts = h('span.zip-hearts');
    const pearls = h('span.zip-pearls');
    const clock = h('span.zip-time');
    const hud = h('div.zip-hud', {}, hearts, pearls, clock,
      h('button.icon-btn.zip-pause', { 'aria-label': tr('Pause', 'Pausa'), onclick: () => pause() }, 'Ⅱ'));
    const keys: Input = { left: false, right: false, jump: false, jumpPressed: false };
    const hold = (label: string, cls: string, set: (on: boolean) => void) => {
      const b = h('button.zip-btn.' + cls, { 'aria-label': label }, label);
      const on = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); set(true); };
      const off = () => { b.classList.remove('down'); set(false); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
      return b;
    };
    const pad = h('div.zip-pad', {},
      h('div.zip-dpad', {}, hold('◀', 'left', v => { keys.left = v; }), hold('▶', 'right', v => { keys.right = v; })),
      hold(tr('JUMP', 'SALTAR'), 'jump', v => { if (v && !keys.jump) keys.jumpPressed = true; keys.jump = v; }));
    root.append(topBar(levelName(index)), h('div.zip-stage', {}, canvas, hud), pad);

    const keyMap: Record<string, 'left' | 'right' | 'jump'> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
    const onKey = (e: KeyboardEvent) => {
      const k = keyMap[e.code];
      if (!k) return;
      e.preventDefault();
      const down = e.type === 'keydown';
      if (k === 'jump') { if (down && !keys.jump) keys.jumpPressed = true; keys.jump = down; } else keys[k] = down;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    let particles: Particle[] = [];
    let camX = 0, last = performance.now(), acc = 0, raf = 0, paused = false, done = false, shake = 0;
    let W = 0, H = 0, s = 40, offY = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s = Math.min(H / 12, W / 10);
      offY = H - 12 * s;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const burst = (x: number, y: number, n: number, color: string, speed = 4, size = 0.08) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 0.6, max: 0.6, color, size, kind: 'dot' });
      }
    };
    const handleEvents = () => {
      for (const ev of wd.events) {
        const snd = SOUND[ev.e];
        if (snd) sfx(snd);
        switch (ev.e) {
          case 'pearl': burst(ev.x, ev.y, 8, '#e6f6ff', 3); particles.push({ x: ev.x, y: ev.y, vx: 0, vy: -2, life: 0.7, max: 0.7, color: '#fff', size: 0.3, kind: 'text', text: '+1' }); break;
          case 'bonus':
            for (let i = 0; i < 3; i++) particles.push({ x: ev.x, y: ev.y - 0.2, vx: (i - 1) * 2, vy: -8 - i, life: 0.8, max: 0.8, color: '#fff', size: 0.2, kind: 'pearl' });
            shake = 0.15; break;
          case 'stomp': burst(ev.x, ev.y, 14, '#ff8a7f', 5); shake = 0.2; buzz(); break;
          case 'hurt': case 'fall': burst(wd.p.x + 0.35, wd.p.y + 0.5, 16, '#ff3b3b', 5); shake = 0.35; buzz(true); break;
          case 'jump': burst(ev.x + 0.35, ev.y, 6, '#ffffffaa', 2, 0.06); break;
          case 'jet': burst(ev.x, ev.y, 12, '#ff8a2a', 4, 0.07); break;
          case 'land': burst(ev.x, ev.y, 8, '#ffffff88', 2.5, 0.06); break;
          case 'spring': burst(ev.x, ev.y, 10, '#f5c542', 4); break;
          case 'flag': burst(ev.x, ev.y - 0.5, 18, '#2ef2d0', 4); break;
          case 'win': burst(ev.x, ev.y - 1, 40, '#f5c542', 7, 0.1); break;
        }
      }
      wd.events = [];
    };

    const updateHud = () => {
      hearts.textContent = '❤'.repeat(Math.max(0, wd.hearts)) + '♡'.repeat(Math.max(0, 3 - wd.hearts));
      pearls.textContent = `◉ ${wd.collected}/${wd.total}`;
      const t = Math.floor(wd.time);
      clock.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };

    const draw = (t: number) => {
      const target = wd.p.x + wd.p.w / 2 - W / s * 0.4;
      camX += (Math.max(0, Math.min(wd.w - W / s, target)) - camX) * 0.15;
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 20, (Math.random() - 0.5) * shake * 20);
      drawBackground(ctx, th, camX, s, W, H, t);
      ctx.translate(0, offY);
      drawTiles(ctx, wd, th, camX, s, W, t, (x, y) => wd.checkpoint.x === x && wd.checkpoint.y === y);
      for (const e of wd.enemies) if (e.alive || e.deadT < 0.6) drawEnemy(ctx, e, camX, s, t);
      drawZip(ctx, wd.p, (wd.p.x + wd.p.w / 2 - camX) * s, (wd.p.y + wd.p.h) * s, s, t);
      for (const p of particles) {
        const a = p.life / p.max;
        ctx.globalAlpha = a;
        const px = (p.x - camX) * s, py = p.y * s;
        if (p.kind === 'pearl') pearl(ctx, px, py, s * p.size, t);
        else if (p.kind === 'text') { ctx.fillStyle = p.color; ctx.font = `900 ${s * p.size}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.text!, px, py); }
        else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, s * p.size * a + 1, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused && !done) {
        acc += dt;
        while (acc >= 1 / 120) {
          step(wd, keys, 1 / 120);
          keys.jumpPressed = false;
          acc -= 1 / 120;
          handleEvents();
          if (wd.state !== 'play') break;
        }
        if (wd.state !== 'play') { done = true; setTimeout(finish, wd.state === 'won' ? 700 : 500); }
      }
      shake = Math.max(0, shake - dt);
      particles = particles.filter(p => (p.life -= dt) > 0);
      for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'text' ? 0 : 14) * dt; }
      updateHud();
      if (W > 0) draw(now / 1000);
    };
    raf = requestAnimationFrame(frame);

    const restart = () => { wd = makeWorld(def); particles = []; camX = 0; done = false; paused = false; acc = 0; last = performance.now(); };

    function pause() {
      if (done) return;
      paused = true;
      dialog(tr('Paused', 'En pausa'), h('p', {}, levelName(index)), [
        { label: tr('How to play', 'Cómo jugar'), onclick: () => { zipHowTo(); paused = false; last = performance.now(); } },
        { label: tr('Restart', 'Reiniciar'), onclick: restart },
        { label: tr('Resume', 'Seguir'), primary: true, onclick: () => { paused = false; last = performance.now(); } },
      ]);
    }

    function finish() {
      const won = wd.state === 'won';
      countPlay('zip', won);
      if (won) {
        const old = profile.zip.stars[index] ?? 0;
        const st = starsFor(wd);
        const chips = chipsFor(wd, old);
        profile.zip.stars[index] = Math.max(old, st);
        save();
        addChips(chips);
        sfx('bigwin');
        const starRow = h('div.zip-stars', {}, ...[0, 1, 2].map(i => h('span.zip-star' + (i < st ? '.on' : ''), { style: `animation-delay:${0.2 + i * 0.25}s` }, '★')));
        const body = h('div', {}, starRow,
          h('p', {}, tr(`Pearls ${wd.collected}/${wd.total} · Hits ${wd.hits} · Time ${clock.textContent}`, `Perlas ${wd.collected}/${wd.total} · Golpes ${wd.hits} · Tiempo ${clock.textContent}`)),
          h('p.big-win', {}, tr(`+${fmt(chips)} chips`, `+${fmt(chips)} fichas`)));
        const next = index + 1 < LEVELS.length;
        const d = dialog(tr('Level clear!', '¡Nivel superado!'), body, [
          { label: tr('Levels', 'Niveles'), onclick: () => back() },
          { label: tr('Again', 'Otra vez'), onclick: restart },
          ...(next ? [{ label: tr('Next level', 'Siguiente'), primary: true, onclick: () => { back(); go(zipLevel(index + 1)); } }] : []),
        ]);
        coinBurst(d.querySelector('.big-win')!, 30);
      } else {
        sfx('lose'); say('gameover', { interrupt: true });
        dialog(tr('Out of hearts', 'Sin corazones'), h('p', {}, tr('Zip needs a rest. Try again: the flags save your place inside the level.', 'Zip necesita descansar. Inténtalo otra vez: las banderas guardan tu lugar dentro del nivel.')), [
          { label: tr('How to play', 'Cómo jugar'), onclick: () => { zipHowTo(); restart(); } },
          { label: tr('Try again', 'Reintentar'), primary: true, onclick: restart },
        ]);
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  };
}
