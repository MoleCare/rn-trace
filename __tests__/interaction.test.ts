import { createInteraction, createMemorySink, createTracer } from '../src';

function setup() {
  let clock = 0;
  const memory = createMemorySink();
  const tracer = createTracer({ sink: memory.sink, now: () => clock });
  return {
    tracer,
    memory,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('createInteraction', () => {
  it('records a quick response as info', () => {
    const { tracer, memory, advance } = setup();
    const photo = createInteraction(tracer, 'take-photo');
    photo.start({ moles: 3 });
    expect(photo.pending).toBe(true);
    advance(120);
    photo.respond('sheet');
    expect(photo.pending).toBe(false);
    expect(
      memory.records().map((r) => [r.event, r.level, r.durationMs, r.data])
    ).toEqual([
      ['tap', 'info', undefined, { name: 'take-photo', moles: 3 }],
      [
        'responded',
        'info',
        120,
        { name: 'take-photo', label: 'sheet', repeats: 0 },
      ],
    ]);
  });

  it('tells a slow response with repeat taps apart from a dead button', () => {
    const { tracer, memory, advance } = setup();
    const photo = createInteraction(tracer, 'take-photo');
    photo.start();
    advance(1300);
    photo.start();
    advance(1300);
    photo.respond(undefined, { via: 'onModalShow' });
    const records = memory.records();
    expect(records[1]).toEqual(
      expect.objectContaining({
        event: 'repeat-tap',
        level: 'warn',
        data: { name: 'take-photo', waitingMs: 1300, repeats: 1 },
      })
    );
    expect(records[2]).toEqual(
      expect.objectContaining({
        event: 'responded',
        level: 'warn',
        durationMs: 2600,
        data: {
          name: 'take-photo',
          repeats: 1,
          slow: true,
          via: 'onModalShow',
        },
      })
    );
  });

  it('honours slowMs and resets repeats for the next tap', () => {
    const { tracer, memory, advance } = setup();
    const save = createInteraction(tracer, 'save', { slowMs: 50 });
    save.start();
    save.start();
    advance(60);
    save.respond();
    save.start();
    advance(10);
    save.respond();
    const responses = memory.records().filter((r) => r.event === 'responded');
    expect(responses.map((r) => [r.level, r.data])).toEqual([
      ['warn', { name: 'save', repeats: 1, slow: true }],
      ['info', { name: 'save', repeats: 0 }],
    ]);
  });

  it('ignores a response without a tap, and cancel forgets the tap', () => {
    const { tracer, memory } = setup();
    const photo = createInteraction(tracer, 'take-photo');
    photo.respond();
    photo.start();
    photo.cancel();
    photo.respond();
    expect(memory.records().map((r) => r.event)).toEqual(['tap']);
  });
});
