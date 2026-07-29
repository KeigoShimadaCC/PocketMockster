// Both engines surface transient capacity errors mid-run (cursor labels them
// RetriableError / resource_exhausted). A 45-minute playthrough should ride
// those out rather than throwing away a session that is already progressing.

const RETRIABLE =
  /resource[_ ]exhausted|retriable|rate.?limit|too many requests|overloaded|temporarily unavailable|\b(429|500|502|503|504)\b/i;

export function isRetriableError(err) {
  return RETRIABLE.test(String(err?.message ?? err ?? ''));
}

/** 15s, 30s, 60s, capped at 2 minutes. */
export function backoffMs(attempt) {
  return Math.min(120_000, 15_000 * 2 ** (Math.max(1, attempt) - 1));
}

/**
 * Run one agent turn, retrying transient provider failures. Never retries past
 * the run's wall-clock deadline, and never retries a real error.
 */
export async function runTurnWithRetry(engine, prompt, opts = {}) {
  const {
    deadline = Infinity,
    maxAttempts = 4,
    onRetry = () => {},
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
  } = opts;

  for (let attempt = 1; ; attempt++) {
    try {
      return await engine.turn(prompt);
    } catch (err) {
      const wait = backoffMs(attempt);
      if (attempt >= maxAttempts || !isRetriableError(err) || now() + wait > deadline) throw err;
      await onRetry(err, attempt, wait, maxAttempts);
      await sleep(wait);
    }
  }
}
