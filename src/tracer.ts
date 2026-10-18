export type TraceLevel = 'info' | 'warn';

export type TraceData = Record<string, unknown>;

/** One line of the trace: what happened, when, and for how long. */
export interface TraceRecord {
  tag: string;
  event: string;
  level: TraceLevel;
  /** Milliseconds since the tracer was created. */
  at: number;
  /** Set for spans and other measured events. */
  durationMs?: number;
  data?: TraceData;
}

export type Sink = (record: TraceRecord) => void;

export interface TracerOptions {
  /** Shown at the start of every line, so the trace is easy to grep. */
  tag?: string;
  /** Where records go. Defaults to nowhere: pass consoleSink() to see them. */
  sink?: Sink;
  /** A disabled tracer records nothing and costs almost nothing. */
  enabled?: boolean;
  /** Milliseconds clock; performance.now() when present. For tests. */
  now?: () => number;
}

export interface Span {
  /** Ends the span, records it with its duration and returns the duration. */
  end: (data?: TraceData) => number;
}

export interface Tracer {
  readonly tag: string;
  readonly enabled: boolean;
  /** Milliseconds since the tracer was created. */
  now: () => number;
  trace: (event: string, data?: TraceData) => void;
  warn: (event: string, data?: TraceData) => void;
  /** Records an event with a duration measured elsewhere. */
  measured: (
    event: string,
    durationMs: number,
    data?: TraceData,
    level?: TraceLevel
  ) => void;
  span: (event: string) => Span;
  /** Runs fn and records how long it took, also when it throws or rejects. */
  time: <T>(event: string, fn: () => T) => T;
}

function defaultClock(): () => number {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  const perfNow = perf?.now;
  if (typeof perfNow === 'function') {
    return () => perfNow.call(perf);
  }
  return () => Date.now();
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

export function createTracer(options: TracerOptions = {}): Tracer {
  const tag = options.tag ?? 'trace';
  const enabled = options.enabled ?? true;
  const sink = options.sink;
  const clock = options.now ?? defaultClock();
  const origin = clock();
  const now = () => clock() - origin;

  const emit = (record: TraceRecord) => {
    if (!enabled || !sink) {
      return;
    }
    try {
      sink(record);
    } catch {
      // A broken sink must never break the app it is tracing.
    }
  };

  const record = (
    event: string,
    level: TraceLevel,
    data?: TraceData,
    durationMs?: number
  ): TraceRecord => {
    const entry: TraceRecord = { tag, event, level, at: now() };
    if (durationMs !== undefined) {
      entry.durationMs = durationMs;
    }
    if (data !== undefined) {
      entry.data = data;
    }
    return entry;
  };

  const measured: Tracer['measured'] = (
    event,
    durationMs,
    data,
    level = 'info'
  ) => {
    emit(record(event, level, data, durationMs));
  };

  const span = (event: string): Span => {
    const start = now();
    let ended = false;
    return {
      end(data) {
        const durationMs = now() - start;
        if (!ended) {
          ended = true;
          measured(event, durationMs, data);
        }
        return durationMs;
      },
    };
  };

  return {
    tag,
    enabled,
    now,
    trace(event, data) {
      emit(record(event, 'info', data));
    },
    warn(event, data) {
      emit(record(event, 'warn', data));
    },
    measured,
    span,
    time<T>(event: string, fn: () => T): T {
      const s = span(event);
      let result: T;
      try {
        result = fn();
      } catch (error) {
        s.end({ failed: true });
        throw error;
      }
      if (isPromiseLike(result)) {
        return Promise.resolve(result).then(
          (value) => {
            s.end();
            return value;
          },
          (error: unknown) => {
            s.end({ failed: true });
            throw error;
          }
        ) as T;
      }
      s.end();
      return result;
    },
  };
}
