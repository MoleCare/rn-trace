# Changelog

All notable changes to this package are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

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
