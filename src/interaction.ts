import type { TraceData, Tracer } from './tracer';

export interface InteractionOptions {
  /** A response slower than this is recorded as a warning. Default 300 ms. */
  slowMs?: number;
}

export interface Interaction {
  /** Call when the person taps. A tap while still waiting counts as a repeat. */
  start: (data?: TraceData) => void;
  /**
   * Call when something visible happens: a screen, a sheet, a spinner. Records
   * the time from the first tap and how many repeat taps came meanwhile.
   */
  respond: (label?: string, data?: TraceData) => void;
  /** Forget a pending tap without recording a response. */
  cancel: () => void;
  readonly pending: boolean;
}

/**
 * Measures tap-to-response for one control. When nothing visible happens for
 * a while, people tap again; the repeats are recorded as `repeat-tap` so a
 * slow response is told apart from a dead button.
 */
export function createInteraction(
  tracer: Tracer,
  name: string,
  options: InteractionOptions = {}
): Interaction {
  const slowMs = options.slowMs ?? 300;
  let startedAt: number | null = null;
  let repeats = 0;

  return {
    get pending() {
      return startedAt !== null;
    },
    start(data) {
      if (startedAt !== null) {
        repeats += 1;
        tracer.warn('repeat-tap', {
          name,
          waitingMs: Math.round(tracer.now() - startedAt),
          repeats,
          ...data,
        });
        return;
      }
      startedAt = tracer.now();
      repeats = 0;
      tracer.trace('tap', { name, ...data });
    },
    respond(label, data) {
      if (startedAt === null) {
        return;
      }
      const ms = tracer.now() - startedAt;
      startedAt = null;
      tracer.measured(
        'responded',
        ms,
        {
          name,
          ...(label !== undefined && { label }),
          repeats,
          ...(ms >= slowMs && { slow: true }),
          ...data,
        },
        ms >= slowMs ? 'warn' : 'info'
      );
    },
    cancel() {
      startedAt = null;
      repeats = 0;
    },
  };
}
