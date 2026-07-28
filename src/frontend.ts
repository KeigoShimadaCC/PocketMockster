import { EASE, Fader, Sequence, call, creditsScroll, fade, hold, pan, tween, typeText } from './sequence';
import { drawSprite, MON_SPRITES } from './sprites';
import { formatPlaytime, text } from './ui';

// Slot 1 keeps the original key so saves made before slots existed keep working.
export const SLOT_KEYS = ['pm_save', 'pm_save_2', 'pm_save_3'];
export const INTRO_SEEN_KEY = 'pm_intro_seen';

export interface SlotInfo {
  index: number;
  key: string;
  empty: boolean;
  badges: number;
  playtime: string;
  lead: string;
  map: string;
  savedAt: number;
}

interface RawSlot {
  badges?: unknown;
  playFrames?: unknown;
  savedAt?: unknown;
  mapId?: unknown;
  party?: { species?: unknown; level?: unknown; nickname?: unknown }[];
}

function readRaw(key: string): RawSlot | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RawSlot;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function readSlots(): SlotInfo[] {
  return SLOT_KEYS.map((key, i) => {
    const raw = readRaw(key);
    const lead = raw?.party?.[0];
    return {
      index: i,
      key,
      empty: !raw,
      badges: Array.isArray(raw?.badges) ? raw.badges.length : 0,
      playtime: formatPlaytime(typeof raw?.playFrames === 'number' ? raw.playFrames : 0),
      lead: lead
        ? `${String(lead.nickname ?? lead.species ?? '?')} Lv${Number(lead.level ?? 1)}`
        : '-',
      map: typeof raw?.mapId === 'string' ? raw.mapId : '-',
      savedAt: typeof raw?.savedAt === 'number' ? raw.savedAt : 0,
    };
  });
}

export function newestSlot(): number {
  const slots = readSlots().filter((s) => !s.empty);
  if (slots.length === 0) return 0;
  return slots.reduce((best, s) => (s.savedAt > best.savedAt ? s : best), slots[0]).index;
}

export function firstEmptySlot(): number {
  const empty = readSlots().find((s) => s.empty);
  return empty ? empty.index : 0;
}

export function introSeen(): boolean {
  try {
    return !!localStorage.getItem(INTRO_SEEN_KEY);
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // private mode: replaying the movie is harmless
  }
}

interface IntroState {
  scene: number;
  caption: string;
  camera: { x: number; y: number };
  glyphs: number;
  shadow: number;
  logo: number;
  flash: number;
}

/** The boot movie: region pan, the Ledger, Team Rollback, Originon, logo smash. */
export class IntroMovie {
  private readonly seq: Sequence;
  private readonly fader = new Fader(1);
  private readonly state: IntroState = {
    scene: 0,
    caption: '',
    camera: { x: 0, y: 0 },
    glyphs: 0,
    shadow: 0,
    logo: 0,
    flash: 0,
  };

  constructor() {
    const s = this.state;
    this.seq = new Sequence([
      call(() => {
        s.scene = 0;
      }),
      fade({ frames: 45, from: 1, to: 0, onValue: (v) => (this.fader.alpha = v) }),
      pan({
        frames: 150,
        from: { x: 0, y: 0 },
        to: { x: 240, y: 30 },
        easing: EASE.easeInOut,
        onValue: (v) => (s.camera = v),
      }),
      typeText({
        text: 'The Mocca region runs on the Ledger.',
        framesPerChar: 2,
        onValue: (v) => (s.caption = v),
      }),
      hold(45),
      fade({ frames: 20, from: 0, to: 1, onValue: (v) => (this.fader.alpha = v) }),

      call(() => {
        s.scene = 1;
        s.caption = '';
      }),
      fade({ frames: 20, from: 1, to: 0, onValue: (v) => (this.fader.alpha = v) }),
      tween({ frames: 120, from: 0, to: 1, easing: EASE.easeOut, onValue: (v) => (s.glyphs = v) }),
      typeText({
        text: 'Every Mockemon ever recorded, written in stone.',
        framesPerChar: 2,
        onValue: (v) => (s.caption = v),
      }),
      hold(40),
      fade({ frames: 20, from: 0, to: 1, onValue: (v) => (this.fader.alpha = v) }),

      call(() => {
        s.scene = 2;
        s.caption = '';
      }),
      fade({ frames: 20, from: 1, to: 0, onValue: (v) => (this.fader.alpha = v) }),
      tween({ frames: 140, from: 0, to: 1, easing: EASE.easeIn, onValue: (v) => (s.shadow = v) }),
      typeText({
        text: 'Team Rollback wants the first draft back.',
        framesPerChar: 2,
        onValue: (v) => (s.caption = v),
      }),
      hold(40),
      fade({ frames: 20, from: 0, to: 1, onValue: (v) => (this.fader.alpha = v) }),

      call(() => {
        s.scene = 3;
        s.caption = '';
      }),
      fade({ frames: 24, from: 1, to: 0, onValue: (v) => (this.fader.alpha = v) }),
      hold(60),
      typeText({
        text: 'And something first of all stirs at Null Peak.',
        framesPerChar: 2,
        onValue: (v) => (s.caption = v),
      }),
      hold(50),
      fade({ frames: 24, from: 0, to: 1, onValue: (v) => (this.fader.alpha = v) }),

      call(() => {
        s.scene = 4;
        s.caption = '';
        s.flash = 1;
      }),
      fade({ frames: 10, from: 1, to: 0, onValue: (v) => (this.fader.alpha = v) }),
      tween({ frames: 30, from: 2.4, to: 1, easing: EASE.easeOut, onValue: (v) => (s.logo = v) }),
      tween({ frames: 25, from: 1, to: 0, onValue: (v) => (s.flash = v) }),
      hold(90),
    ]);
  }

  get done(): boolean {
    return this.seq.done;
  }

  update(): void {
    this.seq.tick();
  }

  skip(): void {
    this.seq.skip();
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = this.state;
    ctx.fillStyle = '#0d0f1c';
    ctx.fillRect(0, 0, w, h);
    switch (s.scene) {
      case 0:
        this.drawRegion(ctx, w, h);
        break;
      case 1:
        this.drawLedger(ctx, w, h);
        break;
      case 2:
        this.drawRollback(ctx, w, h);
        break;
      case 3:
        this.drawOriginon(ctx, w, h);
        break;
      default:
        this.drawLogo(ctx, w, h);
    }
    if (s.caption) {
      ctx.fillStyle = 'rgba(13,15,28,0.8)';
      ctx.fillRect(0, h - 54, w, 34);
      text(ctx, s.caption, w / 2, h - 32, '#ffffff', 13, true);
    }
    this.fader.draw(ctx, w, h);
    if (s.flash > 0) {
      ctx.save();
      ctx.globalAlpha = s.flash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    text(ctx, 'X/Esc: skip', w - 96, 22, '#8fa3c0', 11);
  }

  private drawRegion(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const cam = this.state.camera;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1b2a5e');
    sky.addColorStop(1, '#6a4b8a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 3; layer++) {
      const depth = 0.25 + layer * 0.35;
      const baseY = h * 0.55 + layer * 34 - cam.y * depth * 0.3;
      ctx.fillStyle = ['#2a3a6b', '#33507d', '#3f6a7a'][layer];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = -40; x <= w + 40; x += 20) {
        const wave = Math.sin((x + cam.x * depth) / 55 + layer * 2) * (18 + layer * 8);
        ctx.lineTo(x, baseY + wave);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#f7d7b0';
    ctx.beginPath();
    ctx.arc(w - 90 + Math.sin(cam.x / 90) * 8, 62, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLedger(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#191c2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b2f47';
    ctx.fillRect(60, 40, w - 120, h - 120);
    const lit = Math.floor(this.state.glyphs * 60);
    for (let i = 0; i < 60; i++) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      ctx.fillStyle = i < lit ? '#ffd93b' : '#3c4260';
      ctx.fillRect(80 + col * 32, 60 + row * 26, 20, 14);
    }
    text(ctx, 'THE LEDGER', w / 2, h - 74, '#c0cbdc', 14, true);
  }

  private drawRollback(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#141726';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#242a44';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    const creep = this.state.shadow;
    ctx.fillStyle = '#0b0c16';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.64, w * 0.1 + creep * w * 0.55, 40 + creep * 60, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const x = w * 0.3 + i * w * 0.2;
      const scale = 0.6 + creep * 0.6;
      ctx.fillStyle = '#0b0c16';
      ctx.fillRect(x - 10, h * 0.62 - 54 * scale, 20, 54 * scale);
      ctx.beginPath();
      ctx.arc(x, h * 0.62 - 58 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.globalAlpha = 0.35 + creep * 0.4;
    text(ctx, 'reverting region to draft...', w / 2, 60, '#e63946', 12, true);
    ctx.restore();
  }

  private drawOriginon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#0b0c16';
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.6 + Math.sin(this.seq.frame / 14) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.25 + pulse * 0.25;
    ctx.fillStyle = '#7d3ac0';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 10, 90 + pulse * 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const sprite = MON_SPRITES.originon ?? MON_SPRITES.mimew;
    if (sprite) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawSprite(ctx, sprite, w / 2 - 64, h / 2 - 74, 8);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#0b0c16';
      ctx.fillRect(w / 2 - 64, h / 2 - 74, 128, 128);
      ctx.restore();
    }
  }

  private drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#29366f');
    g.addColorStop(1, '#3b5dc9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const scale = this.state.logo || 1;
    ctx.save();
    ctx.translate(w / 2, h / 2 - 20);
    ctx.scale(scale, scale);
    text(ctx, 'POCKET', 0, -20, '#ffd93b', 40, true);
    text(ctx, 'MOCKSTER', 0, 22, '#ffffff', 40, true);
    ctx.restore();
    text(ctx, 'A Mocca region tale', w / 2, h - 70, '#c0cbdc', 12, true);
  }
}

export interface CreditsStats {
  badges: number;
  seen: number;
  caught: number;
  dexTotal: number;
  playtime: string;
  party: { species: string; level: number }[];
}

/** Scrolling credits with a starfield and a parade of every sprite the player met. */
export class CreditsRoll {
  private readonly seq: Sequence;
  private readonly scroll: { step: ReturnType<typeof creditsScroll>['step']; offsetOf: () => number };
  private readonly lines: string[];
  private readonly stars: { x: number; y: number; r: number }[] = [];
  private frame = 0;

  constructor(
    stats: CreditsStats,
    private readonly parade: string[],
    viewHeight: number,
  ) {
    this.lines = [
      'POCKET MOCKSTER',
      '',
      'A Mocca region tale',
      '',
      '-- STAFF --',
      'Region design      Droid',
      'Battle engine      Droid',
      'Mockemon roster    Droid',
      'Scenario           Droid',
      'Quality gates      tsc, vitest, playwright',
      '',
      '-- CAST --',
      'Prof. Maple        mentor',
      'Juno               field assistant',
      'Kai                rival, then Champion',
      'Terra Weave Nerin  leaders 1-3',
      'Dyna Fern Pyra     leaders 4-6',
      'Aeris Mira         leaders 7-8',
      'Director Nil       Team Rollback',
      'Originon           the first entry',
      '',
      '-- YOUR RECORD --',
      `Badges             ${stats.badges}/8`,
      `MockDex seen       ${stats.seen}/${stats.dexTotal}`,
      `MockDex caught     ${stats.caught}/${stats.dexTotal}`,
      `Playtime           ${stats.playtime}`,
      ...stats.party.map((m, i) => `Party ${i + 1}            ${m.species} Lv${m.level}`),
      '',
      'Thank you for playing!',
      '',
      'THE END',
    ];
    this.scroll = creditsScroll({ lines: this.lines, viewHeight, pixelsPerFrame: 0.7 });
    this.seq = new Sequence([this.scroll.step, hold(90)]);
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * 480,
        y: Math.random() * 320,
        r: Math.random() < 0.8 ? 1 : 2,
      });
    }
  }

  get done(): boolean {
    return this.seq.done;
  }

  update(): void {
    this.frame++;
    this.seq.tick();
  }

  skip(): void {
    this.seq.skip();
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#080a14';
    ctx.fillRect(0, 0, w, h);
    for (const star of this.stars) {
      const twinkle = (Math.sin((this.frame + star.x) / 25) + 1) / 2;
      ctx.fillStyle = twinkle > 0.5 ? '#ffffff' : '#5a6688';
      ctx.fillRect(star.x, (star.y + this.frame * 0.15) % h, star.r, star.r);
    }
    const offset = this.scroll.offsetOf();
    this.lines.forEach((line, i) => {
      const y = offset + i * 16;
      if (y < -20 || y > h + 20) return;
      const heading = line.startsWith('--') || line === 'POCKET MOCKSTER' || line === 'THE END';
      text(ctx, line, w / 2, y, heading ? '#ffd93b' : '#ffffff', heading ? 14 : 12, true);
    });
    if (this.parade.length > 0) {
      const step = 74;
      const total = this.parade.length * step;
      const x0 = w - ((this.frame * 1.1) % total);
      this.parade.forEach((key, i) => {
        const sprite = MON_SPRITES[key];
        if (!sprite) return;
        const x = x0 + i * step;
        if (x < -70 || x > w + 70) return;
        drawSprite(ctx, sprite, x, h - 46, 2);
      });
    }
    text(ctx, 'X/Esc: skip', w - 96, 22, '#8fa3c0', 11);
  }
}
