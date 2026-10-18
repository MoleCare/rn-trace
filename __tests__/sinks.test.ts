import {
  combineSinks,
  consoleSink,
  createMemorySink,
  formatRecord,
  type TraceRecord,
} from '../src';

const info: TraceRecord = { tag: 'app', event: 'tap', level: 'info', at: 12.4 };
const warn: TraceRecord = {
  tag: 'app',
  event: 'js-thread-blocked',
  level: 'warn',
  at: 2600.6,
  durationMs: 2599.5,
  data: { blockedMs: 2600 },
};

function fakeConsole() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  };
}

describe('formatRecord', () => {
  it('writes one greppable line', () => {
    expect(formatRecord(info)).toBe('[app] +12ms tap');
    expect(formatRecord(warn)).toBe(
      '[app] +2601ms js-thread-blocked 2600ms (!) {"blockedMs":2600}'
    );
  });

  it('copes with data that cannot be serialised', () => {
    const data: Record<string, unknown> = {};
    data.self = data;
    expect(formatRecord({ ...info, data })).toBe(
      '[app] +12ms tap [unserialisable]'
    );
  });
});

describe('consoleSink', () => {
  describe('default method', () => {
    const g = globalThis as Record<string, unknown>;
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    afterEach(() => {
      delete g.__DEV__;
      if (original) {
        Object.defineProperty(globalThis, 'navigator', original);
      }
    });
    const runningIn = (product: string | undefined, dev?: boolean) => {
      Object.defineProperty(globalThis, 'navigator', {
        value: product === undefined ? undefined : { product },
        configurable: true,
      });
      if (dev !== undefined) {
        g.__DEV__ = dev;
      }
    };

    it('is console.error in a React Native release build', () => {
      runningIn('ReactNative', false);
      const out = fakeConsole();
      consoleSink({ console: out })(info);
      expect(out.error).toHaveBeenCalledWith('[app] +12ms tap');
    });

    it('is console.log in a React Native debug build, to avoid a red LogBox', () => {
      runningIn('ReactNative', true);
      const out = fakeConsole();
      consoleSink({ console: out })(info);
      expect(out.log).toHaveBeenCalledWith('[app] +12ms tap');
    });

    it('is console.log on the web and in Node', () => {
      runningIn('Gecko');
      const out = fakeConsole();
      consoleSink({ console: out })(info);
      runningIn(undefined);
      consoleSink({ console: out })(info);
      expect(out.log).toHaveBeenCalledTimes(2);
      expect(out.error).not.toHaveBeenCalled();
    });
  });

  it('can send warnings elsewhere', () => {
    const out = fakeConsole();
    const sink = consoleSink({
      console: out,
      method: 'log',
      warnMethod: 'warn',
    });
    sink(info);
    sink(warn);
    expect(out.log).toHaveBeenCalledTimes(1);
    expect(out.warn).toHaveBeenCalledTimes(1);
  });

  it('defaults to the global console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleSink()(info);
    expect(spy).toHaveBeenCalledWith('[app] +12ms tap');
    spy.mockRestore();
  });
});

describe('createMemorySink', () => {
  it('keeps the newest records up to the limit', () => {
    const memory = createMemorySink(2);
    memory.sink({ ...info, event: 'a' });
    memory.sink({ ...info, event: 'b' });
    memory.sink({ ...info, event: 'c' });
    expect(memory.records().map((r) => r.event)).toEqual(['b', 'c']);
    memory.clear();
    expect(memory.records()).toEqual([]);
  });

  it('keeps 500 by default', () => {
    const memory = createMemorySink();
    for (let i = 0; i < 501; i++) {
      memory.sink(info);
    }
    expect(memory.records()).toHaveLength(500);
  });
});

describe('combineSinks', () => {
  it('sends to every sink even when one fails', () => {
    const memory = createMemorySink();
    const failing = () => {
      throw new Error('down');
    };
    combineSinks(failing, memory.sink)(info);
    expect(memory.records()).toEqual([info]);
  });
});
