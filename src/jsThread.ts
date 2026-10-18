import type { Tracer } from './tracer';

export interface WatchJsThreadOptions {
  /** How often to check. Default 100 ms. */
  intervalMs?: number;
  /** Report when a check arrives this much later than planned. Default 250 ms. */
  thresholdMs?: number;
  /** For tests. */
  timers?: {
    setInterval: (fn: () => void, ms: number) => unknown;
    clearInterval: (handle: unknown) => void;
  };
}

/**
 * Reports when the JS thread was too busy to run anything: no taps, timers,
 * animations or renders could happen meanwhile. A tap that "does nothing" for
 * two seconds and then works is very often this, not a lost touch.
 *
 * Records `js-thread-blocked` (warn) with `blockedMs`. Returns a stop function.
 */
export function watchJsThread(
  tracer: Tracer,
  options: WatchJsThreadOptions = {}
): () => void {
  const intervalMs = options.intervalMs ?? 100;
  const thresholdMs = options.thresholdMs ?? 250;
  const timers = options.timers ?? {
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (handle: unknown) => {
      clearInterval(handle as ReturnType<typeof setInterval>);
    },
  };

  if (!tracer.enabled) {
    return () => undefined;
  }

  let last = tracer.now();
  const handle = timers.setInterval(() => {
    const current = tracer.now();
    const lateBy = current - last - intervalMs;
    last = current;
    if (lateBy >= thresholdMs) {
      tracer.measured(
        'js-thread-blocked',
        lateBy,
        { blockedMs: Math.round(lateBy) },
        'warn'
      );
    }
  }, intervalMs);

  let stopped = false;
  return () => {
    if (!stopped) {
      stopped = true;
      timers.clearInterval(handle);
    }
  };
}
