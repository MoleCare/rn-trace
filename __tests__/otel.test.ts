import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { createInteraction, createTracer, otelSink } from '../src';

// Records go through the real OpenTelemetry SDK, so the shapes rn-trace
// expects of a tracer are checked against the library apps use.

const END = 1_760_000_000_000; // epoch ms the fake wall clock returns

const toMs = ([seconds, nanos]: [number, number]): number =>
  seconds * 1000 + nanos / 1e6;

const nth = (spans: ReadableSpan[], index: number): ReadableSpan => {
  const span = spans[index];
  if (!span) {
    throw new Error(`no span ${String(index)} of ${String(spans.length)}`);
  }
  return span;
};

function setup(
  options: { prefix?: string; spanName?: (r: { event: string }) => string } = {}
) {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  let clock = 0;
  const tracer = createTracer({
    tag: 'app',
    sink: otelSink({
      tracer: provider.getTracer('test'),
      clock: () => END,
      ...options,
    }),
    now: () => clock,
  });
  return {
    tracer,
    spans: (): ReadableSpan[] => exporter.getFinishedSpans(),
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('otelSink', () => {
  it('sends an instant event as a span of no length, named after the event', () => {
    const { tracer, spans, advance } = setup();
    advance(42);
    tracer.trace('tap', { name: 'take-photo', moles: 3 });
    const span = nth(spans(), 0);
    expect(span.name).toBe('tap');
    expect(toMs(span.startTime)).toBe(END);
    expect(toMs(span.endTime)).toBe(END);
    expect(span.attributes).toEqual({
      'rn_trace.tag': 'app',
      'rn_trace.level': 'info',
      'rn_trace.at_ms': 42,
      'rn_trace.data.name': 'take-photo',
      'rn_trace.data.moles': 3,
    });
  });

  it('gives a measured record its real start and end', () => {
    const { tracer, spans } = setup();
    tracer.measured('js-thread-blocked', 2600, { blockedMs: 2600 }, 'warn');
    const span = nth(spans(), 0);
    expect(toMs(span.startTime)).toBe(END - 2600);
    expect(toMs(span.endTime)).toBe(END);
    expect(span.attributes['rn_trace.level']).toBe('warn');
    expect(span.attributes['rn_trace.duration_ms']).toBe(2600);
  });

  it('turns a tap and its slow response into spans', () => {
    const { tracer, spans, advance } = setup();
    const photo = createInteraction(tracer, 'take-photo');
    photo.start();
    advance(353);
    photo.respond('sheet');
    expect(spans().map((s) => s.name)).toEqual(['tap', 'responded']);
    const responded = nth(spans(), 1);
    expect(toMs(responded.endTime) - toMs(responded.startTime)).toBe(353);
    expect(responded.attributes['rn_trace.data.slow']).toBe(true);
  });

  it('flattens data to the attribute types OpenTelemetry accepts', () => {
    const { tracer, spans } = setup();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    tracer.trace('render', {
      changed: ['mole', 'onSelect'],
      counts: [1, 2],
      flags: [true, false],
      empty: [],
      mixed: [1, 'two'],
      nested: { a: 1 },
      objects: [{ a: 1 }],
      gone: null,
      missing: undefined,
      notANumber: Number.NaN,
      circular,
    });
    const attributes = spans()[0]?.attributes;
    expect(attributes?.['rn_trace.data.changed']).toEqual(['mole', 'onSelect']);
    expect(attributes?.['rn_trace.data.counts']).toEqual([1, 2]);
    expect(attributes?.['rn_trace.data.flags']).toEqual([true, false]);
    expect(attributes?.['rn_trace.data.empty']).toEqual([]);
    expect(attributes?.['rn_trace.data.mixed']).toBe('[1,"two"]');
    expect(attributes?.['rn_trace.data.nested']).toBe('{"a":1}');
    expect(attributes?.['rn_trace.data.objects']).toBe('[{"a":1}]');
    expect(attributes?.['rn_trace.data.circular']).toBe('[unserialisable]');
    expect(attributes).not.toHaveProperty('rn_trace.data.gone');
    expect(attributes).not.toHaveProperty('rn_trace.data.missing');
    expect(attributes).not.toHaveProperty('rn_trace.data.notANumber');
  });

  it('takes a prefix and a span name', () => {
    const { tracer, spans } = setup({
      prefix: 'molecare',
      spanName: (record) => `ui.${record.event}`,
    });
    tracer.trace('tap');
    expect(spans()[0]?.name).toBe('ui.tap');
    expect(spans()[0]?.attributes['molecare.tag']).toBe('app');
  });

  it('uses the wall clock by default', () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const now = jest.spyOn(Date, 'now').mockReturnValue(END);
    createTracer({
      sink: otelSink({ tracer: provider.getTracer('test') }),
      now: () => 0,
    }).trace('tap');
    now.mockRestore();
    expect(toMs(nth(exporter.getFinishedSpans(), 0).endTime)).toBe(END);
  });
});
