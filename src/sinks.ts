import type { Sink, TraceRecord } from './tracer';

type ConsoleMethod = 'error' | 'warn' | 'info' | 'log' | 'debug';

export interface ConsoleSinkOptions {
  /**
   * Console method for every line. Defaults to 'error' in a React Native
   * release build, where console.log is dropped on iOS but console.error still
   * reaches the device log (Console.app, idevicesyslog). Everywhere else,
   * including React Native debug builds where console.error opens a red
   * LogBox, it defaults to 'log'.
   */
  method?: ConsoleMethod;
  /** Method for warn-level records; defaults to `method`. */
  warnMethod?: ConsoleMethod;
  /** For tests, or to wrap another logger with the same shape. */
  console?: Pick<Console, ConsoleMethod>;
}

function round(ms: number): number {
  return Math.round(ms);
}

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return '[unserialisable]';
  }
}

/** `[tag] +1234ms event 56ms {"key":"value"}`, one line per record. */
export function formatRecord(record: TraceRecord): string {
  let line = `[${record.tag}] +${String(round(record.at))}ms ${record.event}`;
  if (record.durationMs !== undefined) {
    line += ` ${String(round(record.durationMs))}ms`;
  }
  if (record.level === 'warn') {
    line += ' (!)';
  }
  if (record.data !== undefined) {
    line += ` ${safeJson(record.data)}`;
  }
  return line;
}

function defaultMethod(): ConsoleMethod {
  const g = globalThis as {
    __DEV__?: unknown;
    navigator?: { product?: unknown };
  };
  const reactNative = g.navigator?.product === 'ReactNative';
  return reactNative && g.__DEV__ !== true ? 'error' : 'log';
}

export function consoleSink(options: ConsoleSinkOptions = {}): Sink {
  const out = options.console ?? globalThis.console;
  const method = options.method ?? defaultMethod();
  const warnMethod = options.warnMethod ?? method;
  return (record) => {
    const m = record.level === 'warn' ? warnMethod : method;
    out[m](formatRecord(record));
  };
}

export interface MemorySink {
  sink: Sink;
  /** The kept records, oldest first. */
  records: () => TraceRecord[];
  clear: () => void;
}

/** Keeps the last `limit` records, for tests or to attach to a bug report. */
export function createMemorySink(limit = 500): MemorySink {
  const kept: TraceRecord[] = [];
  return {
    sink: (record) => {
      kept.push(record);
      if (kept.length > limit) {
        kept.splice(0, kept.length - limit);
      }
    },
    records: () => kept.slice(),
    clear: () => {
      kept.length = 0;
    },
  };
}

/** Sends every record to each sink; one failing sink does not stop the rest. */
export function combineSinks(...sinks: Sink[]): Sink {
  return (record) => {
    for (const sink of sinks) {
      try {
        sink(record);
      } catch {
        // Keep going: the other sinks still get the record.
      }
    }
  };
}
