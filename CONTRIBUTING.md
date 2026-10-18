# Contributing to @molecare/rn-trace

Thank you for helping. This package answers one question: **why did a tap
seem to do nothing?** It records facts, such as a blocked JS thread, the time
from a tap to the first response, repeat taps and the props behind a re-render.
It never decides what the app should do about them.

## Principles

- **No native code and no dependencies at runtime.** It must work the same in
  React Native and in React on the web.
- **No global state.** Everything starts from a tracer the app creates.
- **Never break the host app.** A failing sink or bad data is swallowed, and a
  disabled tracer costs almost nothing.
- **Readable in release builds.** The default output must reach the device log.
- **Field names are an API.** People grep for event names and data keys.
  Adding one is fine; renaming or removing one is a breaking change.

## Development

```sh
npm ci
npm test            # Jest, 100 % coverage required
npm run lint
npm run typecheck
npm run format
npm run check:package
```

Tests use a fake clock and fake timers, so no simulator, device or browser is
needed. The React hooks are tested with Testing Library in jsdom.

## Pull requests

Keep each pull request to one change, with a test for the behaviour it
changes, and a line in `CHANGELOG.md` under "Unreleased". Never put personal
or health data in tests, examples or issues.

By contributing you agree that your work is released under the Apache-2.0
licence and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
