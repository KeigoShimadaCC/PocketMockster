export type Easing = (t: number) => number;

const clamp01 = (v: number): number => {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
};

const normalizeFrames = (frames: number): number => {
  if (!Number.isFinite(frames)) return 0;
  if (frames <= 0) return 0;
  return Math.floor(frames);
};

const normalizedT = (frame: number, frames: number): number => {
  if (frames <= 1) return 1;
  return frame / (frames - 1);
};

export const EASE: Record<'linear' | 'easeIn' | 'easeOut' | 'easeInOut', Easing> = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => {
    if (t <= 0.5) return 2 * t * t;
    const k = 1 - t;
    return 1 - 2 * k * k;
  },
};

export interface SeqStep {
  frames: number;
  onStart?(): void;
  onFrame?(t: number, frame: number): void;
  onEnd?(): void;
}

type SeqStepInternal = SeqStep & {
  isComplete?(frame: number): boolean;
};

type RuntimeStep = {
  step: SeqStepInternal;
  frames: number;
  started: boolean;
  ended: boolean;
  frame: number;
};

const toRuntime = (step: SeqStep): RuntimeStep => ({
  step: step as SeqStepInternal,
  frames: normalizeFrames(step.frames),
  started: false,
  ended: false,
  frame: 0,
});

export class Sequence {
  private readonly steps: RuntimeStep[];
  private readonly totalFrames: number;
  private index = 0;
  private _done: boolean;
  private _progress: number;
  private _frame = 0;

  constructor(steps: SeqStep[]) {
    this.steps = steps.map(toRuntime);
    this.totalFrames = this.steps.reduce((sum, step) => sum + step.frames, 0);
    this._done = this.steps.length === 0;
    this._progress = this._done ? 1 : 0;
  }

  get done(): boolean {
    return this._done;
  }

  get progress(): number {
    return this._progress;
  }

  get frame(): number {
    return this._frame;
  }

  tick(): void {
    if (this._done) return;
    this.runZeroFrameSteps();
    if (this._done) return;

    const current = this.steps[this.index];
    this.startStep(current);

    const frameIndex = current.frame;
    const t = normalizedT(frameIndex, current.frames);
    current.step.onFrame?.(t, frameIndex);

    current.frame += 1;
    this._frame += 1;

    const completeEarly = current.step.isComplete?.(frameIndex) ?? false;
    if (completeEarly || current.frame >= current.frames) {
      this.endStep(current);
      this.index += 1;
    }

    this.runZeroFrameSteps();
    this.syncStatus();
  }

  skip(): void {
    if (this._done) return;
    for (let i = this.index; i < this.steps.length; i += 1) {
      const step = this.steps[i];
      this.startStep(step);
      this.endStep(step);
      step.frame = step.frames;
    }
    this.index = this.steps.length;
    this._frame = this.totalFrames;
    this._done = true;
    this._progress = 1;
  }

  private runZeroFrameSteps(): void {
    while (this.index < this.steps.length) {
      const step = this.steps[this.index];
      if (step.frames !== 0) break;
      this.startStep(step);
      this.endStep(step);
      this.index += 1;
    }
    this.syncStatus();
  }

  private startStep(step: RuntimeStep): void {
    if (step.started) return;
    step.started = true;
    step.step.onStart?.();
  }

  private endStep(step: RuntimeStep): void {
    if (step.ended) return;
    step.ended = true;
    step.step.onEnd?.();
  }

  private syncStatus(): void {
    if (this.index >= this.steps.length) {
      this._done = true;
    }
    if (this.totalFrames === 0) {
      this._progress = this._done ? 1 : 0;
      return;
    }
    if (this._done) {
      this._progress = 1;
      return;
    }
    this._progress = clamp01(this._frame / this.totalFrames);
  }
}

export const hold = (frames: number): SeqStep => ({
  frames: normalizeFrames(frames),
});

export const call = (fn: () => void): SeqStep => ({
  frames: 0,
  onStart: fn,
});

export const tween = (args: {
  frames: number;
  from: number;
  to: number;
  easing?: Easing;
  onValue: (value: number) => void;
}): SeqStep => {
  const easing = args.easing ?? EASE.linear;
  return {
    frames: normalizeFrames(args.frames),
    onFrame: (t: number) => {
      const k = easing(t);
      args.onValue(args.from + (args.to - args.from) * k);
    },
  };
};

export const fade = (args: {
  frames: number;
  from: number;
  to: number;
  easing?: Easing;
  onValue: (value: number) => void;
}): SeqStep =>
  tween({
    frames: args.frames,
    from: args.from,
    to: args.to,
    easing: args.easing,
    onValue: (value: number) => args.onValue(clamp01(value)),
  });

export const pan = (args: {
  frames: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  easing?: Easing;
  onValue: (value: { x: number; y: number }) => void;
}): SeqStep => {
  const easing = args.easing ?? EASE.linear;
  const frames = normalizeFrames(args.frames);
  return {
    frames,
    onFrame: (t: number) => {
      const k = easing(t);
      args.onValue({
        x: args.from.x + (args.to.x - args.from.x) * k,
        y: args.from.y + (args.to.y - args.from.y) * k,
      });
    },
  };
};

export const typeText = (args: {
  text: string;
  framesPerChar: number;
  onValue: (visible: string, count: number) => void;
}): SeqStep => {
  const speed = Math.max(1, Math.floor(args.framesPerChar));
  const frames = args.text.length === 0 ? 0 : args.text.length * speed;
  return {
    frames,
    onStart: () => {
      if (frames === 0) args.onValue('', 0);
    },
    onFrame: (_t: number, frame: number) => {
      const count = Math.min(args.text.length, Math.floor(frame / speed) + 1);
      args.onValue(args.text.slice(0, count), count);
    },
    onEnd: () => {
      if (args.text.length > 0) args.onValue(args.text, args.text.length);
    },
  };
};

export const parallel = (...steps: SeqStep[]): SeqStep => {
  const runtimes = steps.map(toRuntime);
  const frames = runtimes.reduce((max, step) => (step.frames > max ? step.frames : max), 0);

  return {
    frames,
    onStart: () => {
      for (const step of runtimes) {
        if (!step.started) {
          step.started = true;
          step.step.onStart?.();
        }
        if (step.frames === 0 && !step.ended) {
          step.ended = true;
          step.step.onEnd?.();
        }
      }
    },
    onFrame: (_t: number, frame: number) => {
      for (const step of runtimes) {
        if (step.frames === 0 || frame >= step.frames) continue;
        const t = normalizedT(frame, step.frames);
        step.step.onFrame?.(t, frame);
        if (frame + 1 >= step.frames && !step.ended) {
          step.ended = true;
          step.step.onEnd?.();
        }
      }
    },
    onEnd: () => {
      for (const step of runtimes) {
        if (!step.started) {
          step.started = true;
          step.step.onStart?.();
        }
        if (!step.ended) {
          step.ended = true;
          step.step.onEnd?.();
        }
      }
    },
  };
};

export const waitUntil = (predicate: () => boolean, maxFrames = 600): SeqStep => {
  const frames = normalizeFrames(maxFrames);
  let done = false;
  const step: SeqStepInternal = {
    frames,
    onFrame: () => {
      if (!done && predicate()) done = true;
    },
    isComplete: () => done,
  };
  return step;
};

export class Fader {
  alpha: number;

  constructor(alpha = 0) {
    this.alpha = clamp01(alpha);
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number, color = '#000'): void {
    const a = clamp01(this.alpha);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export const creditsScroll = (args: {
  lines: string[];
  viewHeight: number;
  pixelsPerFrame: number;
}) => {
  const lineHeight = 16;
  const speed = args.pixelsPerFrame > 0 ? args.pixelsPerFrame : 1;
  const contentHeight = args.lines.length * lineHeight;
  const travel = args.viewHeight + contentHeight;
  const finalFrame = Math.ceil(travel / speed);
  const frames = finalFrame + 1;
  let offset = args.viewHeight;

  const step: SeqStep = {
    frames,
    onFrame: (_t: number, frame: number) => {
      offset = args.viewHeight - frame * speed;
    },
  };

  return {
    step,
    offsetOf: (): number => offset,
  };
};
