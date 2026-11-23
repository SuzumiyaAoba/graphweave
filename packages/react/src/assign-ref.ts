import type { Ref } from "react";

/**
 * Hands `element` to a ref given by the owner, whichever kind of ref it is, and tells how to let go
 * of it again: the cleanup a callback ref returned, or a call with nothing.
 */
export function assignRef<TElement>(ref: Ref<TElement> | undefined, element: TElement): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function"
      ? (): void => {
          cleanup();
        }
      : (): void => {
          ref(null);
        };
  }
  if (ref !== undefined && ref !== null) {
    ref.current = element;
    return (): void => {
      ref.current = null;
    };
  }
  return (): void => undefined;
}
