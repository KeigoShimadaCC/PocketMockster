import { test, expect } from 'vitest';
import { isRetriableError, backoffMs, runTurnWithRetry } from '../../tools/agent/retry.mjs';

const ok = { text: 'GOAL_COMPLETE', usage: {}, isError: false };
const flaky = (failures: number, err: Error) => {
  let calls = 0;
  return {
    calls: () => calls,
    turn: async () => {
      if (calls++ < failures) throw err;
      return ok;
    },
  };
};
const noSleep = { sleep: async () => {}, now: () => 0 };

test('isRetriableError: the exact error that killed a completed run', () => {
  // Thrown by cursor-agent mid-run after the goal was already achieved.
  expect(isRetriableError(new Error('RetriableError: [resource_exhausted] Error'))).toBe(true);
});

test('isRetriableError: recognises common transient provider failures', () => {
  for (const msg of [
    'rate limit exceeded',
    'Rate-limited, try again',
    '429 Too Many Requests',
    'server is overloaded',
    'temporarily unavailable',
    'upstream error 503',
  ]) {
    expect(isRetriableError(new Error(msg)), msg).toBe(true);
  }
});

test('isRetriableError: does not retry real failures', () => {
  for (const msg of [
    'cursor-agent spawn failed: ENOENT',
    'not logged in',
    'unknown model "gpt-9"',
    'invalid MCP config',
  ]) {
    expect(isRetriableError(new Error(msg)), msg).toBe(false);
  }
});

test('isRetriableError: tolerates strings and nullish input', () => {
  expect(isRetriableError('resource_exhausted')).toBe(true);
  expect(isRetriableError(null)).toBe(false);
  expect(isRetriableError(undefined)).toBe(false);
});

test('runTurnWithRetry: a rate-limited turn survives and returns the result', async () => {
  const engine = flaky(2, new Error('RetriableError: [resource_exhausted] Error'));
  const retries: number[] = [];
  const res = await runTurnWithRetry(engine, 'play', { ...noSleep, onRetry: (_e, a) => void retries.push(a) });
  expect(res).toBe(ok);
  expect(engine.calls()).toBe(3);
  expect(retries).toEqual([1, 2]);
});

test('runTurnWithRetry: gives up after the attempt budget', async () => {
  const engine = flaky(99, new Error('resource_exhausted'));
  await expect(runTurnWithRetry(engine, 'play', noSleep)).rejects.toThrow(/resource_exhausted/);
  expect(engine.calls()).toBe(4);
});

test('runTurnWithRetry: a real error fails immediately', async () => {
  const engine = flaky(99, new Error('cursor-agent spawn failed: ENOENT'));
  await expect(runTurnWithRetry(engine, 'play', noSleep)).rejects.toThrow(/ENOENT/);
  expect(engine.calls()).toBe(1);
});

test('runTurnWithRetry: will not sleep past the run deadline', async () => {
  const engine = flaky(99, new Error('resource_exhausted'));
  // 5s left, first backoff is 15s, so retrying would overrun the deadline.
  await expect(
    runTurnWithRetry(engine, 'play', { ...noSleep, deadline: 5_000 }),
  ).rejects.toThrow(/resource_exhausted/);
  expect(engine.calls()).toBe(1);
});

test('backoffMs: grows then caps at two minutes', () => {
  expect(backoffMs(1)).toBe(15_000);
  expect(backoffMs(2)).toBe(30_000);
  expect(backoffMs(3)).toBe(60_000);
  expect(backoffMs(9)).toBe(120_000);
});
