import { describe, expect, it } from 'vitest';
import {
  EASE,
  Fader,
  Sequence,
  call,
  creditsScroll,
  fade,
  hold,
  pan,
  parallel,
  tween,
  typeText,
  waitUntil,
} from '../../src/sequence';

describe('Sequence', () => {
  it('completes 10 + 0 + 5 steps in exactly 15 ticks', () => {
    const events: string[] = [];
    const seq = new Sequence([
      {
        frames: 10,
        onStart: () => events.push('a:start'),
        onEnd: () => events.push('a:end'),
      },
      call(() => events.push('call')),
      {
        frames: 5,
        onStart: () => events.push('b:start'),
        onEnd: () => events.push('b:end'),
      },
    ]);

    for (let i = 0; i < 15; i += 1) seq.tick();
    expect(seq.done).toBe(true);
    expect(seq.frame).toBe(15);
    expect(events).toEqual(['a:start', 'a:end', 'call', 'b:start', 'b:end']);
  });

  it('fires onStart and onEnd once each in order', () => {
    const calls: string[] = [];
    const seq = new Sequence([
      {
        frames: 2,
        onStart: () => calls.push('start'),
        onFrame: () => calls.push('frame'),
        onEnd: () => calls.push('end'),
      },
    ]);

    seq.tick();
    seq.tick();
    seq.tick();

    expect(calls).toEqual(['start', 'frame', 'frame', 'end']);
  });

  it('passes t = 1 exactly on a step final frame', () => {
    const seen: number[] = [];
    const seq = new Sequence([
      {
        frames: 4,
        onFrame: (t: number) => seen.push(t),
      },
    ]);
    for (let i = 0; i < 4; i += 1) seq.tick();
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('keeps progress monotonic in [0, 1]', () => {
    const seq = new Sequence([hold(2), hold(3)]);
    const values = [seq.progress];
    for (let i = 0; i < 5; i += 1) {
      seq.tick();
      values.push(seq.progress);
    }
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(1);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      expect(values[i]).toBeGreaterThanOrEqual(0);
      expect(values[i]).toBeLessThanOrEqual(1);
    }
  });

  it('tick after done is a no-op', () => {
    const seq = new Sequence([hold(1)]);
    seq.tick();
    expect(seq.done).toBe(true);
    const frame = seq.frame;
    const progress = seq.progress;
    seq.tick();
    expect(seq.frame).toBe(frame);
    expect(seq.progress).toBe(progress);
    expect(seq.done).toBe(true);
  });

  it('skip finishes remaining callbacks exactly once', () => {
    const events: string[] = [];
    const seq = new Sequence([
      {
        frames: 2,
        onStart: () => events.push('a:start'),
        onEnd: () => events.push('a:end'),
      },
      {
        frames: 3,
        onStart: () => events.push('b:start'),
        onEnd: () => events.push('b:end'),
      },
      call(() => events.push('c:call')),
    ]);

    seq.tick();
    seq.skip();
    seq.skip();

    expect(seq.done).toBe(true);
    expect(seq.progress).toBe(1);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:call']);
  });
});

describe('easing and builders', () => {
  it('easing endpoints are exact and monotonic', () => {
    const names: Array<keyof typeof EASE> = ['linear', 'easeIn', 'easeOut', 'easeInOut'];
    for (const name of names) {
      const fn = EASE[name];
      expect(fn(0)).toBe(0);
      expect(fn(1)).toBe(1);
      const samples = [0, 0.1, 0.25, 0.5, 0.75, 1].map(fn);
      for (let i = 1; i < samples.length; i += 1) {
        expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
      }
    }
  });

  it('tween hits from at t=0 and to at t=1', () => {
    const values: number[] = [];
    const seq = new Sequence([
      tween({
        frames: 3,
        from: 10,
        to: 20,
        onValue: (v: number) => values.push(v),
      }),
    ]);
    seq.tick();
    seq.tick();
    seq.tick();
    expect(values).toEqual([10, 15, 20]);
  });

  it('fade clamps values to [0, 1]', () => {
    const values: number[] = [];
    const seq = new Sequence([
      fade({
        frames: 3,
        from: -1,
        to: 2,
        onValue: (v: number) => values.push(v),
      }),
    ]);
    seq.tick();
    seq.tick();
    seq.tick();
    expect(values).toEqual([0, 0.5, 1]);
  });

  it('pan interpolates both x and y', () => {
    const values: Array<{ x: number; y: number }> = [];
    const seq = new Sequence([
      pan({
        frames: 3,
        from: { x: 0, y: 10 },
        to: { x: 20, y: 40 },
        onValue: (v) => values.push(v),
      }),
    ]);
    seq.tick();
    seq.tick();
    seq.tick();
    expect(values).toEqual([
      { x: 0, y: 10 },
      { x: 10, y: 25 },
      { x: 20, y: 40 },
    ]);
  });

  it('typeText reveals substring counts and finishes full text', () => {
    const seen: Array<{ visible: string; count: number }> = [];
    const seq = new Sequence([
      typeText({
        text: 'ABCD',
        framesPerChar: 2,
        onValue: (visible, count) => seen.push({ visible, count }),
      }),
    ]);

    for (let i = 0; i < 8; i += 1) seq.tick();

    expect(seen[0]).toEqual({ visible: 'A', count: 1 });
    expect(seen[1]).toEqual({ visible: 'A', count: 1 });
    expect(seen[2]).toEqual({ visible: 'AB', count: 2 });
    expect(seen[4]).toEqual({ visible: 'ABC', count: 3 });
    expect(seen[6]).toEqual({ visible: 'ABCD', count: 4 });
    expect(seen[seen.length - 1]).toEqual({ visible: 'ABCD', count: 4 });
  });

  it('typeText with empty string completes instantly', () => {
    const seen: Array<{ visible: string; count: number }> = [];
    const seq = new Sequence([
      typeText({
        text: '',
        framesPerChar: 3,
        onValue: (visible, count) => seen.push({ visible, count }),
      }),
    ]);
    seq.tick();
    expect(seq.done).toBe(true);
    expect(seen).toEqual([{ visible: '', count: 0 }]);
  });
});

describe('parallel and waiting', () => {
  it('parallel duration is max child frames and callbacks are bounded', () => {
    const shortFrames: number[] = [];
    const longFrames: number[] = [];
    let shortStart = 0;
    let shortEnd = 0;
    let longStart = 0;
    let longEnd = 0;

    const seq = new Sequence([
      parallel(
        {
          frames: 2,
          onStart: () => {
            shortStart += 1;
          },
          onFrame: (_t, frame) => shortFrames.push(frame),
          onEnd: () => {
            shortEnd += 1;
          },
        },
        {
          frames: 4,
          onStart: () => {
            longStart += 1;
          },
          onFrame: (_t, frame) => longFrames.push(frame),
          onEnd: () => {
            longEnd += 1;
          },
        },
      ),
    ]);

    for (let i = 0; i < 4; i += 1) seq.tick();

    expect(seq.done).toBe(true);
    expect(seq.frame).toBe(4);
    expect(shortStart).toBe(1);
    expect(shortEnd).toBe(1);
    expect(longStart).toBe(1);
    expect(longEnd).toBe(1);
    expect(shortFrames).toEqual([0, 1]);
    expect(longFrames).toEqual([0, 1, 2, 3]);
  });

  it('parallel skip still starts and ends children once', () => {
    let start = 0;
    let end = 0;
    const seq = new Sequence([
      parallel({
        frames: 5,
        onStart: () => {
          start += 1;
        },
        onEnd: () => {
          end += 1;
        },
      }),
    ]);
    seq.skip();
    expect(start).toBe(1);
    expect(end).toBe(1);
    expect(seq.done).toBe(true);
  });

  it('waitUntil resolves when predicate flips true', () => {
    let ready = false;
    const seq = new Sequence([waitUntil(() => ready, 10)]);
    seq.tick();
    seq.tick();
    expect(seq.done).toBe(false);
    ready = true;
    seq.tick();
    expect(seq.done).toBe(true);
    expect(seq.frame).toBe(3);
  });

  it('waitUntil force-terminates at maxFrames', () => {
    const seq = new Sequence([waitUntil(() => false, 3)]);
    seq.tick();
    seq.tick();
    expect(seq.done).toBe(false);
    seq.tick();
    expect(seq.done).toBe(true);
    expect(seq.frame).toBe(3);
  });

  it('waitUntil default maxFrames is 600', () => {
    const seq = new Sequence([waitUntil(() => false)]);
    for (let i = 0; i < 600; i += 1) seq.tick();
    expect(seq.done).toBe(true);
    expect(seq.frame).toBe(600);
  });
});

describe('creditsScroll and fader', () => {
  it('creditsScroll reports offset progression and completion frame', () => {
    const credits = creditsScroll({
      lines: ['one', 'two'],
      viewHeight: 100,
      pixelsPerFrame: 5,
    });
    const seq = new Sequence([credits.step]);

    expect(credits.offsetOf()).toBe(100);
    seq.tick();
    expect(credits.offsetOf()).toBe(100);
    seq.tick();
    expect(credits.offsetOf()).toBe(95);

    for (let i = 0; i < 26; i += 1) seq.tick();
    expect(seq.done).toBe(true);
    expect(seq.frame).toBe(28);
    expect(credits.offsetOf()).toBe(-35);
  });

  it('Fader.draw emits expected canvas operations', () => {
    const ops: string[] = [];
    const ctx = {
      _alpha: 1,
      _fillStyle: '',
      save: () => {
        ops.push('save');
      },
      restore: () => {
        ops.push('restore');
      },
      fillRect: (x: number, y: number, w: number, h: number) => {
        ops.push(`fillRect:${x},${y},${w},${h}`);
      },
      set globalAlpha(value: number) {
        this._alpha = value;
        ops.push(`alpha:${value}`);
      },
      get globalAlpha() {
        return this._alpha;
      },
      set fillStyle(value: string) {
        this._fillStyle = value;
        ops.push(`fillStyle:${value}`);
      },
      get fillStyle() {
        return this._fillStyle;
      },
    };

    const fader = new Fader(0.4);
    fader.draw(ctx as unknown as CanvasRenderingContext2D, 320, 200, '#123');

    expect(ops).toEqual([
      'save',
      'alpha:0.4',
      'fillStyle:#123',
      'fillRect:0,0,320,200',
      'restore',
    ]);
  });

  it('Fader.draw is a no-op when alpha is zero', () => {
    const ops: string[] = [];
    const ctx = {
      save: () => {
        ops.push('save');
      },
      restore: () => {
        ops.push('restore');
      },
      fillRect: () => {
        ops.push('fillRect');
      },
    };

    const fader = new Fader(0);
    fader.draw(ctx as unknown as CanvasRenderingContext2D, 10, 10);
    expect(ops).toEqual([]);
  });
});
