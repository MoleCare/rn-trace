/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { createMemorySink, createTracer } from '../src';
import { useMountTrace, useRenderTrace } from '../src/react';

function setup(enabled = true) {
  let clock = 0;
  const memory = createMemorySink();
  const tracer = createTracer({ sink: memory.sink, enabled, now: () => clock });
  return {
    tracer,
    memory,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('useRenderTrace', () => {
  function Row(props: {
    tracer: ReturnType<typeof createTracer>;
    mole: { id: number };
    onSelect: () => void;
    label: string;
  }) {
    useRenderTrace(props.tracer, 'MoleRow', {
      mole: props.mole,
      onSelect: props.onSelect,
      label: props.label,
    });
    return null;
  }

  it('names the props that changed and those that only got a new reference', () => {
    const { tracer, memory } = setup();
    const onSelect = () => undefined;
    const { rerender } = render(
      <Row tracer={tracer} mole={{ id: 1 }} onSelect={onSelect} label="a" />
    );
    rerender(
      <Row tracer={tracer} mole={{ id: 1 }} onSelect={onSelect} label="a" />
    );
    rerender(
      <Row
        tracer={tracer}
        mole={{ id: 1 }}
        onSelect={() => undefined}
        label="b"
      />
    );
    expect(memory.records().map((r) => r.data)).toEqual([
      { name: 'MoleRow', count: 1, first: true },
      { name: 'MoleRow', count: 2, changed: ['mole'], sameContent: ['mole'] },
      {
        name: 'MoleRow',
        count: 3,
        changed: ['mole', 'onSelect', 'label'],
        sameContent: ['mole', 'onSelect'],
      },
    ]);
  });

  function Generic(props: {
    tracer: ReturnType<typeof createTracer>;
    values: Record<string, unknown>;
  }) {
    useRenderTrace(props.tracer, 'Generic', props.values);
    return null;
  }

  it('compares arrays and objects shallowly and copes with added or removed props', () => {
    const { tracer, memory } = setup();
    const shared = { x: 1 };
    const { rerender } = render(
      <Generic
        tracer={tracer}
        values={{ list: [1, 2], obj: { a: shared }, n: null }}
      />
    );
    rerender(
      <Generic
        tracer={tracer}
        values={{ list: [1, 2], obj: { a: { x: 1 } }, n: {} }}
      />
    );
    rerender(
      <Generic
        tracer={tracer}
        values={{ list: [1, 3], obj: { a: 1, b: 2 }, extra: true }}
      />
    );
    rerender(
      <Generic
        tracer={tracer}
        values={{ list: { 0: 1, 1: 3 }, obj: { a: 1, c: 2 }, extra: true }}
      />
    );
    const data = memory.records().map((r) => r.data);
    expect(data[1]).toEqual({
      name: 'Generic',
      count: 2,
      changed: ['list', 'obj', 'n'],
      sameContent: ['list'],
    });
    expect(data[2]).toEqual({
      name: 'Generic',
      count: 3,
      changed: ['list', 'obj', 'n', 'extra'],
    });
    expect(data[3]).toEqual({
      name: 'Generic',
      count: 4,
      changed: ['list', 'obj'],
    });
  });

  it('records nothing for a disabled tracer', () => {
    const { tracer, memory } = setup(false);
    const { rerender } = render(<Generic tracer={tracer} values={{ a: 1 }} />);
    rerender(<Generic tracer={tracer} values={{ a: 2 }} />);
    expect(memory.records()).toEqual([]);
  });
});

describe('useMountTrace', () => {
  function Sheet({ tracer }: { tracer: ReturnType<typeof createTracer> }) {
    useMountTrace(tracer, 'Sheet');
    return null;
  }

  it('records mount and how long the component was shown', () => {
    const { tracer, memory, advance } = setup();
    const { unmount } = render(<Sheet tracer={tracer} />);
    advance(350);
    unmount();
    expect(
      memory.records().map((r) => [r.event, r.durationMs, r.data])
    ).toEqual([
      ['mount', undefined, { name: 'Sheet' }],
      ['unmount', 350, { name: 'Sheet' }],
    ]);
  });
});
