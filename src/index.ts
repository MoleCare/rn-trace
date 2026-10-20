export { createTracer } from './tracer';
export type {
  Sink,
  Span,
  TraceData,
  TraceLevel,
  TraceRecord,
  Tracer,
  TracerOptions,
} from './tracer';
export {
  combineSinks,
  consoleSink,
  createMemorySink,
  formatRecord,
} from './sinks';
export type { ConsoleSinkOptions, MemorySink } from './sinks';
export { watchJsThread } from './jsThread';
export type { WatchJsThreadOptions } from './jsThread';
export { createInteraction } from './interaction';
export type { Interaction, InteractionOptions } from './interaction';
export { otelSink } from './otel';
export type {
  OtelAttributeValue,
  OtelSinkOptions,
  OtelSpanLike,
  OtelTracerLike,
} from './otel';
