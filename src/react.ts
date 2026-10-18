import { useEffect, useRef } from 'react';
import type { Tracer } from './tracer';

// Called only for values that already differ by reference.
function sameContents(a: unknown, b: unknown): boolean {
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) {
    return false;
  }
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      Object.is(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k]
      )
  );
}

/**
 * Records every committed render of a component and which props changed.
 * `sameContent` lists props that are a new object or function with the same
 * contents as before: the usual reason a memoised child or an effect runs
 * again when nothing really changed.
 */
export function useRenderTrace(
  tracer: Tracer,
  name: string,
  props: Record<string, unknown>
): void {
  const previous = useRef<Record<string, unknown> | null>(null);
  const count = useRef(0);

  useEffect(() => {
    count.current += 1;
    const before = previous.current;
    previous.current = props;
    if (!tracer.enabled) {
      return;
    }
    if (before === null) {
      tracer.trace('render', { name, count: count.current, first: true });
      return;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(props)]);
    const changed: string[] = [];
    const sameContent: string[] = [];
    for (const key of keys) {
      if (!Object.is(before[key], props[key])) {
        changed.push(key);
        if (
          typeof props[key] === 'function' ||
          sameContents(before[key], props[key])
        ) {
          sameContent.push(key);
        }
      }
    }
    tracer.trace('render', {
      name,
      count: count.current,
      changed,
      ...(sameContent.length > 0 && { sameContent }),
    });
  });
}

/** Records when a component mounts and, on unmount, how long it was shown. */
export function useMountTrace(tracer: Tracer, name: string): void {
  useEffect(() => {
    const mountedAt = tracer.now();
    tracer.trace('mount', { name });
    return () => {
      tracer.measured('unmount', tracer.now() - mountedAt, { name });
    };
    // Mount and unmount only; a new tracer instance is not a remount.
  }, []);
}
