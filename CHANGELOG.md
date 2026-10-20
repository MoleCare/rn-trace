# Changelog

All notable changes to this package are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `otelSink`: sends every record to OpenTelemetry as a span, measured records
  with their real start and end, data as `rn_trace.data.*` attributes. Takes
  the app's own tracer; rn-trace still has no runtime dependencies.

## 0.1.0 (2026-10-20)

First release.

### Documentation

- Reading the trace on iOS: `idevicesyslog` works over USB only; over Wi-Fi,
  a file sink and `devicectl device copy from` (tested on an iPhone 16e).

### Added

- `useRenderTrace` marks a render where no prop changed with `propsSame: true`.
- `createTracer` with `trace`, `warn`, `span`, `time` and `measured`; no global
  state.
- `watchJsThread`: records `js-thread-blocked` with how long the JS thread
  could not run anything.
- `createInteraction`: tap-to-response time, slow responses and `repeat-tap`.
- `useRenderTrace` and `useMountTrace` in `@molecare/rn-trace/react`, with
  `sameContent` for props that are new objects with unchanged contents.
- Sinks: `consoleSink` (uses `console.error` in React Native release builds,
  which reaches iOS device logs, and `console.log` elsewhere),
  `createMemorySink`, `combineSinks`, `formatRecord`.
