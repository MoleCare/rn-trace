# @molecare/rn-trace

Find out why a tap "did nothing".

Often the button worked. The JS thread was busy, so nothing appeared for a few seconds, and the person tapped again. Sometimes the second tap even undid the first. This package records the few facts that tell those cases apart:

- **the JS thread was blocked**, and for how long
- **the time from a tap to the first visible response**, and how many **repeat taps** came while people waited
- **why a component rendered again**: which props changed, and which only became a new object with the same contents

It is plain TypeScript with no native code. It works the same in React Native (iOS and Android) and in React on the web, and its output can be read in **release builds** on a real device.

> **Not a medical device.** This is a debugging tool for app developers. It
> measures how an app responds to taps and renders, never anything about a
> person's health, and it makes no clinical claim. It records only what the
> app passes to it: never put personal or health data in a trace.

## Install

```sh
npm install @molecare/rn-trace
```

React (18 or later) is needed only for the hooks in `@molecare/rn-trace/react`.

## Quick start

```ts
import {
  consoleSink,
  createInteraction,
  createTracer,
  watchJsThread,
} from '@molecare/rn-trace';

export const tracer = createTracer({
  tag: 'app',
  sink: consoleSink(),
  enabled: true, // switch off for production, see below
});

// Anywhere in the app's start-up:
watchJsThread(tracer);

// For one control:
const takePhoto = createInteraction(tracer, 'take-photo');

function onPress() {
  takePhoto.start();
  openSheet();
}

function onSheetShown() {
  takePhoto.respond('sheet');
}
```

In a component:

```tsx
import { useMountTrace, useRenderTrace } from '@molecare/rn-trace/react';

function MoleRow({ mole, onSelect }: Props) {
  useRenderTrace(tracer, 'MoleRow', { mole, onSelect });
  useMountTrace(tracer, 'MoleRow');
  // ...
}
```

## What the trace looks like

```text
[app] +8210ms tap {"name":"take-photo"}
[app] +9520ms repeat-tap (!) {"name":"take-photo","waitingMs":1310,"repeats":1}
[app] +10790ms js-thread-blocked 2580ms (!) {"blockedMs":2580}
[app] +10810ms responded 2600ms (!) {"name":"take-photo","label":"sheet","repeats":1,"slow":true}
[app] +10812ms render {"name":"MoleRow","count":2,"changed":["mole","onSelect"],"sameContent":["mole","onSelect"]}
```

Read top to bottom: the tap arrived, the person tapped again after 1.3 s, the JS thread had been blocked for 2.6 s, and the sheet appeared only then. The button was not dead. Something kept the thread busy. Then `MoleRow` rendered again only because its props were new objects with the same contents.

## Reading it in a release build

`consoleSink()` picks the console method for you. In a React Native release build it uses `console.error`, because on iOS `console.log` and `console.info` are dropped there and `console.error` still reaches the device log. Everywhere else it uses `console.log`. That includes React Native debug builds, where `console.error` would open a red LogBox for every line.

- **iOS over USB:** `idevicesyslog -p <AppName>` (from libimobiledevice), or Console.app. Search for your tag.
- **iOS over Wi-Fi:** `idevicesyslog` cannot see a phone that is paired only over the network, and `log collect` needs `sudo`. Console.app still works. To read the trace from a script without a cable, write it to a file too (below).
- **Android:** `adb logcat -s ReactNativeJS`.
- **Web:** the browser console.

In a React Native release build on iOS, JS `console` output goes only to the unified log (`os_log`). It does not appear in the app's stdout, so `xcrun devicectl device process launch --console` does not show it.

### Reading the trace over Wi-Fi

A sink is a plain function, so it can also append each line to a file in the app's Documents folder. This uses `react-native-fs`; any file API works.

```ts
import RNFS from 'react-native-fs';
import {
  combineSinks,
  consoleSink,
  createTracer,
  formatRecord,
} from '@molecare/rn-trace';

const file = `${RNFS.DocumentDirectoryPath}/rn-trace.log`;
let writes = RNFS.writeFile(file, '', 'utf8').catch(() => {});
const fileSink = (record) => {
  const line = `${formatRecord(record)}\n`;
  // One write after another, so lines never interleave.
  writes = writes
    .then(() => RNFS.appendFile(file, line, 'utf8'))
    .catch(() => {});
};

const tracer = createTracer({
  tag: 'app',
  sink: combineSinks(consoleSink(), fileSink),
});
```

For a development-signed build, copy it to the Mac over Wi-Fi:

```sh
xcrun devicectl device copy from --device <UDID> \
  --domain-type appDataContainer --domain-identifier <bundle id> \
  --source Documents/rn-trace.log --destination ./rn-trace.log
```

Leave the file sink out of App Store builds: the file stays on the device and holds whatever you trace.

To choose yourself: `consoleSink({ method: 'log', warnMethod: 'warn' })`.

To attach the last records to a bug report instead, keep them in memory:

```ts
import {
  combineSinks,
  consoleSink,
  createMemorySink,
} from '@molecare/rn-trace';

const memory = createMemorySink(500);
const tracer = createTracer({ sink: combineSinks(consoleSink(), memory.sink) });
// later: memory.records()
```

## Sending traces to OpenTelemetry

`otelSink` turns every record into an OpenTelemetry span, so taps, JS-thread blocks and slow responses show up next to your other traces (Jaeger, Grafana Tempo, Honeycomb, Datadog, anything that takes OTLP). rn-trace imports nothing from OpenTelemetry: pass the tracer your app already has.

```ts
import { trace } from '@opentelemetry/api';
import {
  combineSinks,
  consoleSink,
  createTracer,
  otelSink,
} from '@molecare/rn-trace';

const tracer = createTracer({
  tag: 'app',
  sink: combineSinks(
    consoleSink(),
    otelSink({ tracer: trace.getTracer('my-app') })
  ),
});
```

- A measured record (`js-thread-blocked`, `responded`, a `span`, `time(...)`) becomes a span with its real start and end. An instant event (`tap`, `render`) becomes a span of no length.
- The span is named after the event. Attributes are `rn_trace.tag`, `rn_trace.level`, `rn_trace.at_ms`, `rn_trace.duration_ms` and the record's data as `rn_trace.data.<key>`. Strings, numbers, booleans and arrays of one of those are kept; other values become JSON strings; `null`, `undefined`, `NaN` and `Infinity` are left out.
- Options: `prefix` (default `rn_trace`), `spanName(record)`, and `clock` for tests.

Setting up the OpenTelemetry SDK and an exporter is up to the app; the sink only needs `trace.getTracer(...)` to return a working tracer. What you trace goes wherever that exporter sends it, so the same rule applies: no personal or health data in `data`.

## API

### `createTracer(options?)`

| Option    | Default             | Meaning                                                  |
| --------- | ------------------- | -------------------------------------------------------- |
| `tag`     | `'trace'`           | Shown at the start of every line.                        |
| `sink`    | none                | Where records go. Without a sink nothing is written.     |
| `enabled` | `true`              | A disabled tracer records nothing and costs very little. |
| `now`     | `performance.now()` | Milliseconds clock, for tests.                           |

The tracer has:

- `trace(event, data?)` and `warn(event, data?)`
- `span(event)`, which returns `{ end(data?) }`. `end` records the duration once and returns it.
- `time(event, fn)`, which runs `fn` and records how long it took. For a promise it waits until the promise settles. A failure is recorded with `{ failed: true }` and still thrown.
- `measured(event, durationMs, data?, level?)`, for a duration measured elsewhere
- `now()`, which returns the milliseconds since the tracer was created

There is no global tracer. Create one and pass it where it is needed.

### `watchJsThread(tracer, options?)`

This checks every `intervalMs` (100). When a check arrives at least `thresholdMs` (250) late, it records `js-thread-blocked` as a warning with `blockedMs`. It returns a function that stops it.

### `createInteraction(tracer, name, options?)`

- `start(data?)`: call it on the tap. A tap while one is still waiting is recorded as `repeat-tap`.
- `respond(label?, data?)`: call it when something visible happens. This records `responded` with the time since the first tap and the number of repeats. Responses slower than `slowMs` (300) are recorded as warnings.
- `cancel()` forgets a pending tap. `pending` tells whether one is waiting.

### `useRenderTrace(tracer, name, props)`

This records every committed render with `changed` (the props that differ by reference). It also records `sameContent`: the changed props that are functions, or arrays or objects with the same contents as before. Those usually mean a parent creates them anew on each render, so a memoised child or an effect runs again for nothing. A render with `propsSame: true` changed no prop at all: the component's own state changed, a context it reads changed, or its parent rendered again and it is not memoised.

### `useMountTrace(tracer, name)`

This records `mount`, and on unmount it records `unmount` with how long the component was shown.

### Sinks

- `consoleSink(options?)` writes one line per record.
- `createMemorySink(limit = 500)` returns `{ sink, records, clear }`.
- `combineSinks(...sinks)` sends each record to every sink.
- `formatRecord(record)` returns the line `consoleSink` writes.

A sink that throws never breaks the app.

## Turning it off

Pass `enabled: false`, for example `enabled: __DEV__ || isInternalBuild`. Every call then returns at once, and `watchJsThread` does not start a timer.

Do not put personal data in `data`. Anything you pass ends up in a device log.

## License

Apache-2.0. Made by [MoleCare](https://www.molecare.co.uk).
