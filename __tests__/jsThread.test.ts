import { createMemorySink, createTracer, watchJsThread } from '../src';

function setup(enabled = true) {
  let clock = 0;
  let tick: (() => void) | null = null;
  const clearInterval = jest.fn();
  const memory = createMemorySink();
  const tracer = createTracer({ sink: memory.sink, enabled, now: () => clock });
  const timers = {
    setInterval: (fn: () => void) => {
      tick = fn;
      return 7;
    },
    clearInterval,
  };
  return {
    tracer,
    memory,
    timers,
    clearInterval,
    // The interval fires `ms` after the previous check.
    fireAfter: (ms: number) => {
      clock += ms;
      tick?.();
    },
  };
}

describe('watchJsThread', () => {
  it('stays quiet while checks arrive on time', () => {
    const { tracer, memory, timers, fireAfter } = setup();
    watchJsThread(tracer, { timers });
    fireAfter(100);
    fireAfter(130);
    expect(memory.records()).toEqual([]);
  });

  it('reports how long the thread was blocked', () => {
    const { tracer, memory, timers, fireAfter } = setup();
    watchJsThread(tracer, { timers });
    fireAfter(2700);
    expect(memory.records()).toEqual([
      expect.objectContaining({
        event: 'js-thread-blocked',
        level: 'warn',
        durationMs: 2600,
        data: { blockedMs: 2600 },
      }),
    ]);
  });

  it('honours the interval and threshold', () => {
    const { tracer, memory, timers, fireAfter } = setup();
    watchJsThread(tracer, { timers, intervalMs: 50, thresholdMs: 100 });
    fireAfter(140);
    fireAfter(160);
    expect(memory.records().map((r) => r.data)).toEqual([{ blockedMs: 110 }]);
  });

  it('stops once', () => {
    const { tracer, timers, clearInterval } = setup();
    const stop = watchJsThread(tracer, { timers });
    stop();
    stop();
    expect(clearInterval).toHaveBeenCalledTimes(1);
    expect(clearInterval).toHaveBeenCalledWith(7);
  });

  it('does not start a timer for a disabled tracer', () => {
    const { tracer } = setup(false);
    const timers = { setInterval: jest.fn(), clearInterval: jest.fn() };
    watchJsThread(tracer, { timers })();
    expect(timers.setInterval).not.toHaveBeenCalled();
  });

  it('uses the real timers by default', () => {
    jest.useFakeTimers();
    const memory = createMemorySink();
    let clock = 0;
    const tracer = createTracer({ sink: memory.sink, now: () => clock });
    const stop = watchJsThread(tracer);
    clock = 600;
    jest.advanceTimersByTime(100);
    stop();
    jest.useRealTimers();
    expect(memory.records().map((r) => r.data)).toEqual([{ blockedMs: 500 }]);
  });
});
