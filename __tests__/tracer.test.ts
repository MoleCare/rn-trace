import { createMemorySink, createTracer } from '../src';

function setup(enabled = true) {
  let clock = 1000;
  const memory = createMemorySink();
  const tracer = createTracer({
    tag: 't',
    sink: memory.sink,
    enabled,
    now: () => clock,
  });
  return {
    tracer,
    memory,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('createTracer', () => {
  it('records events with the time since the tracer was created', () => {
    const { tracer, memory, advance } = setup();
    advance(25);
    tracer.trace('tap', { name: 'photo' });
    tracer.warn('slow');
    expect(memory.records()).toEqual([
      {
        tag: 't',
        event: 'tap',
        level: 'info',
        at: 25,
        data: { name: 'photo' },
      },
      { tag: 't', event: 'slow', level: 'warn', at: 25 },
    ]);
  });

  it('measures a span once, however often it is ended', () => {
    const { tracer, memory, advance } = setup();
    const span = tracer.span('load');
    advance(40);
    expect(span.end({ rows: 3 })).toBe(40);
    advance(10);
    expect(span.end()).toBe(50);
    expect(memory.records()).toEqual([
      {
        tag: 't',
        event: 'load',
        level: 'info',
        at: 40,
        durationMs: 40,
        data: { rows: 3 },
      },
    ]);
  });

  it('times synchronous work, also when it throws', () => {
    const { tracer, memory, advance } = setup();
    expect(
      tracer.time('sum', () => {
        advance(5);
        return 2;
      })
    ).toBe(2);
    expect(() =>
      tracer.time('boom', () => {
        advance(3);
        throw new Error('no');
      })
    ).toThrow('no');
    expect(
      memory.records().map((r) => [r.event, r.durationMs, r.data])
    ).toEqual([
      ['sum', 5, undefined],
      ['boom', 3, { failed: true }],
    ]);
  });

  it('times promises until they settle', async () => {
    const { tracer, memory, advance } = setup();
    const ok = tracer.time('read', () => {
      advance(700);
      return Promise.resolve('photo');
    });
    await expect(ok).resolves.toBe('photo');
    const bad = tracer.time('read-fail', () =>
      Promise.reject(new Error('gone'))
    );
    await expect(bad).rejects.toThrow('gone');
    expect(
      memory.records().map((r) => [r.event, r.durationMs, r.data])
    ).toEqual([
      ['read', 700, undefined],
      ['read-fail', 0, { failed: true }],
    ]);
  });

  it('records nothing when disabled', () => {
    const { tracer, memory } = setup(false);
    tracer.trace('a');
    tracer.span('b').end();
    expect(tracer.enabled).toBe(false);
    expect(memory.records()).toEqual([]);
  });

  it('works without a sink and never lets a failing sink break the app', () => {
    expect(() => {
      createTracer().trace('a');
    }).not.toThrow();
    const tracer = createTracer({
      sink: () => {
        throw new Error('sink down');
      },
    });
    expect(() => {
      tracer.trace('a');
    }).not.toThrow();
    expect(tracer.tag).toBe('trace');
  });

  it('uses performance.now, or Date.now when there is none', () => {
    const tracer = createTracer();
    expect(tracer.now()).toBeGreaterThanOrEqual(0);

    const perf = globalThis.performance;
    Object.defineProperty(globalThis, 'performance', {
      value: undefined,
      configurable: true,
    });
    try {
      const fallback = createTracer();
      expect(fallback.now()).toBeGreaterThanOrEqual(0);
    } finally {
      Object.defineProperty(globalThis, 'performance', {
        value: perf,
        configurable: true,
      });
    }
  });
});
