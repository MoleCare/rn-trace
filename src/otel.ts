import type { Sink, TraceRecord } from './tracer';

/**
 * The parts of an OpenTelemetry tracer this sink uses, matched by shape, so
 * rn-trace imports nothing from OpenTelemetry. Pass the tracer you already
 * have: `trace.getTracer('my-app')` from `@opentelemetry/api`.
 */
export interface OtelTracerLike {
  startSpan: (
    name: string,
    options?: {
      startTime?: number;
      attributes?: Record<string, OtelAttributeValue>;
    }
  ) => OtelSpanLike;
}

export interface OtelSpanLike {
  end: (endTime?: number) => void;
}

/** The attribute value types OpenTelemetry accepts. */
export type OtelAttributeValue =
  string | number | boolean | string[] | number[] | boolean[];

export interface OtelSinkOptions {
  tracer: OtelTracerLike;
  /** Prefix for every attribute name. Default `rn_trace`. */
  prefix?: string;
  /** Span name for a record. Default: the event (`tap`, `js-thread-blocked`). */
  spanName?: (record: TraceRecord) => string;
  /** Wall clock in epoch milliseconds, for tests. Default `Date.now`. */
  clock?: () => number;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function toAttribute(value: unknown): OtelAttributeValue | undefined {
  // Nothing to say, or a number with no value (NaN, Infinity): left out.
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return undefined;
  }
  if (isPrimitive(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    const first = items[0];
    if (items.length === 0) {
      return [] as string[];
    }
    if (
      isPrimitive(first) &&
      items.every((item) => typeof item === typeof first && isPrimitive(item))
    ) {
      return items as string[] | number[] | boolean[];
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserialisable]';
  }
}

/**
 * Sends every record to OpenTelemetry as a span. A measured record (a span,
 * `time(...)`, `js-thread-blocked`, `responded`) gets its real start and end;
 * an instant event (`tap`, `render`) is a span of no length. The record's
 * data become attributes under the prefix, flattened to the types
 * OpenTelemetry accepts (an object becomes a JSON string).
 */
export function otelSink(options: OtelSinkOptions): Sink {
  const prefix = options.prefix ?? 'rn_trace';
  const clock = options.clock ?? (() => Date.now());
  const spanName = options.spanName ?? ((record) => record.event);

  return (record) => {
    // A record is emitted when it ends, so the wall clock now is its end.
    const end = clock();
    const start = end - (record.durationMs ?? 0);
    const attributes: Record<string, OtelAttributeValue> = {
      [`${prefix}.tag`]: record.tag,
      [`${prefix}.level`]: record.level,
      [`${prefix}.at_ms`]: Math.round(record.at),
    };
    if (record.durationMs !== undefined) {
      attributes[`${prefix}.duration_ms`] = Math.round(record.durationMs);
    }
    for (const [key, value] of Object.entries(record.data ?? {})) {
      const attribute = toAttribute(value);
      if (attribute !== undefined) {
        attributes[`${prefix}.data.${key}`] = attribute;
      }
    }
    options.tracer
      .startSpan(spanName(record), { startTime: start, attributes })
      .end(end);
  };
}
