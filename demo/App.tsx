import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { formatRecord } from '../src';
import { useRenderTrace } from '../src/react';
import { block, store, takePhoto, tracer } from './trace';

interface Mole {
  id: number;
  name: string;
  area: string;
}

const MOLES: Mole[] = [
  { id: 1, name: 'Mole one', area: 'Upper back' },
  { id: 2, name: 'Mole two', area: 'Left forearm' },
  { id: 3, name: 'Mole three', area: 'Right calf' },
];

function MoleRow(props: { mole: Mole; onSelect: (mole: Mole) => void }) {
  useRenderTrace(tracer, 'MoleRow', {
    mole: props.mole,
    onSelect: props.onSelect,
  });
  return (
    <li>
      <button
        type="button"
        className="row"
        onClick={() => {
          props.onSelect(props.mole);
        }}
      >
        <span className="thumb" aria-hidden="true" />
        <span>
          <strong>{props.mole.name}</strong>
          <small>{props.mole.area}</small>
        </span>
      </button>
    </li>
  );
}

function Sheet(props: {
  newObjects: boolean;
  slowRows: boolean;
  onClose: () => void;
}) {
  const [refreshes, setRefreshes] = useState(0);
  const stableMoles = useMemo(() => MOLES, []);
  const stableSelect = useCallback(() => {
    tracer.trace('selected');
  }, []);

  useEffect(() => {
    // The sheet is on screen: that is the response the tap was waiting for.
    const frame = requestAnimationFrame(() => {
      takePhoto.respond('sheet');
      if (props.slowRows) {
        // Each row reads a full photo after the sheet shows (2.4.18).
        for (let i = 0; i < MOLES.length; i++) {
          block(450);
        }
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
    // Once per opening.
  }, []);

  return (
    <div className="sheet" role="dialog" aria-label="Choose a mole">
      <header>
        <h2>Choose a mole</h2>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </header>
      <ul>
        {stableMoles.map((mole, i) => (
          <MoleRow
            key={mole.id}
            mole={props.newObjects ? { ...mole } : (stableMoles[i] ?? mole)}
            onSelect={
              props.newObjects
                ? () => {
                    tracer.trace('selected');
                  }
                : stableSelect
            }
          />
        ))}
      </ul>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setRefreshes(refreshes + 1);
        }}
      >
        Render the list again ({refreshes})
      </button>
    </div>
  );
}

function TracePanel() {
  useSyncExternalStore(store.subscribe, store.version);
  const [tab, setTab] = useState<'trace' | 'otel'>('trace');
  const records = store.records();
  const spans = store.spans();
  return (
    <section className="panel" aria-label="Trace">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'trace'}
          onClick={() => {
            setTab('trace');
          }}
        >
          Trace lines
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'otel'}
          onClick={() => {
            setTab('otel');
          }}
        >
          OpenTelemetry spans
        </button>
        <button type="button" className="secondary" onClick={store.clear}>
          Clear
        </button>
      </div>
      {tab === 'trace' ? (
        <ol className="lines">
          {records.length === 0 && (
            <li className="empty">Tap Take photo to start.</li>
          )}
          {[...records].reverse().map((record, i) => (
            <li
              key={records.length - i}
              className={record.level === 'warn' ? 'warn' : undefined}
            >
              {formatRecord(record)}
            </li>
          ))}
        </ol>
      ) : (
        <table className="spans">
          <thead>
            <tr>
              <th>Span</th>
              <th>Duration</th>
              <th>Attributes</th>
            </tr>
          </thead>
          <tbody>
            {[...spans].reverse().map((span, i) => (
              <tr key={spans.length - i}>
                <td>{span.name}</td>
                <td>{Math.round(span.durationMs)} ms</td>
                <td>
                  <code>{JSON.stringify(span.attributes)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function App() {
  const [open, setOpen] = useState(false);
  // A ref, not state: a second tap queued behind a busy thread must see that
  // the sheet is already opening.
  const opening = useRef(false);
  const [slowTap, setSlowTap] = useState(true);
  const [slowRows, setSlowRows] = useState(false);
  const [newObjects, setNewObjects] = useState(false);

  return (
    <main>
      <h1>rn-trace</h1>
      <p className="lead">
        Find out why a tap did nothing. Tap the button below and watch what
        rn-trace records: the tap, how long the response took, JS-thread blocks,
        repeat taps and why each row rendered again.
      </p>

      <section className="controls" aria-label="What to simulate">
        <label>
          <input
            type="checkbox"
            checked={slowTap}
            onChange={(e) => {
              setSlowTap(e.target.checked);
            }}
          />
          Slow tap: read every photo before the sheet opens (MoleCare 2.4.17,
          2.6 s)
        </label>
        <label>
          <input
            type="checkbox"
            checked={slowRows}
            onChange={(e) => {
              setSlowRows(e.target.checked);
            }}
          />
          Slow rows: read full photos after the sheet opens (2.4.18)
        </label>
        <label>
          <input
            type="checkbox"
            checked={newObjects}
            onChange={(e) => {
              setNewObjects(e.target.checked);
            }}
          />
          Pass new objects with the same contents to each row
        </label>
      </section>

      <button
        type="button"
        className="primary"
        onClick={() => {
          if (opening.current) {
            // Tapped again while still waiting: a repeat tap. Once the sheet
            // is open, the button has nothing more to do.
            if (takePhoto.pending) {
              takePhoto.start({ moles: MOLES.length });
            }
            return;
          }
          takePhoto.start({ moles: MOLES.length });
          opening.current = true;
          if (slowTap) {
            block(2600);
          }
          setOpen(true);
        }}
      >
        Take photo
      </button>
      <p className="hint">
        Tip: with Slow tap on, tap twice quickly to see a repeat tap.
      </p>

      {open && (
        <Sheet
          newObjects={newObjects}
          slowRows={slowRows}
          onClose={() => {
            opening.current = false;
            setOpen(false);
          }}
        />
      )}

      <TracePanel />

      <footer>
        <a href="https://github.com/MoleCare/rn-trace">GitHub</a> ·{' '}
        <a href="https://www.npmjs.com/package/@molecare/rn-trace">npm</a> ·
        Made by <a href="https://www.molecare.co.uk">MoleCare</a>. The demo runs
        in your browser and sends nothing anywhere.
      </footer>
    </main>
  );
}
