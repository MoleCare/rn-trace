import {
  combineSinks,
  createInteraction,
  createTracer,
  otelSink,
  watchJsThread,
  type OtelAttributeValue,
  type OtelTracerLike,
  type Sink,
  type TraceRecord,
} from '../src';

// What the page shows: the records as they arrive, and the spans otelSink
// makes from them. A tiny store so React can subscribe to both.

export interface DemoSpan {
  name: string;
  durationMs: number;
  attributes: Record<string, OtelAttributeValue>;
}

const LIMIT = 200;
let records: TraceRecord[] = [];
let spans: DemoSpan[] = [];
let version = 0;
const listeners = new Set<() => void>();

const notify = () => {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
};

export const store = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  version: () => version,
  records: () => records,
  spans: () => spans,
  clear: () => {
    records = [];
    spans = [];
    notify();
  },
};

const pageSink: Sink = (record) => {
  records = [...records.slice(-(LIMIT - 1)), record];
  notify();
};

// Stands in for `trace.getTracer('my-app')` from @opentelemetry/api: the same
// shape, so the page shows exactly the spans a real exporter would receive.
const pageTracer: OtelTracerLike = {
  startSpan: (name, options) => {
    const start = options?.startTime ?? Date.now();
    return {
      end: (endTime) => {
        spans = [
          ...spans.slice(-(LIMIT - 1)),
          {
            name,
            durationMs: (endTime ?? start) - start,
            attributes: options?.attributes ?? {},
          },
        ];
        notify();
      },
    };
  },
};

export const tracer = createTracer({
  tag: 'demo',
  sink: combineSinks(pageSink, otelSink({ tracer: pageTracer })),
});

watchJsThread(tracer);

export const takePhoto = createInteraction(tracer, 'take-photo');

/** Keeps the JS thread busy, as reading and decoding full photos did. */
export function block(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // Busy on purpose: nothing else on the page can run meanwhile.
  }
}
