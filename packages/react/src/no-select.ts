import { noop } from "./noop.ts";
import { trackPointer } from "./pointer-track.ts";

// A listener that cancels what it hears; each call makes another one.
function preventer(): (event: Event) => void {
  return (event) => {
    event.preventDefault();
  };
}

/**
 * As d3's `nodrag` does while d3-zoom pans: the page starts no text selection and no native drag
 * until the press is over. Returns what lets go of that.
 */
export function holdSelection(view: Window = globalThis.window): () => void {
  const options = { capture: true, passive: false };
  // Listeners of this press alone: one press may begin before the last one has let go of its own.
  const prevent = preventer();
  const cancelUp = preventer();
  view.addEventListener("selectstart", prevent, options);
  view.addEventListener("dragstart", prevent, options);
  // As d3-zoom, the mouseup that ends the press is cancelled too (in Firefox the click then leaves
  // the place the keyboard focus moves on from where it was).
  view.addEventListener("mouseup", cancelUp, options);
  return (): void => {
    view.removeEventListener("selectstart", prevent, options);
    view.removeEventListener("dragstart", prevent, options);
    // The press ends with the pointerup, before its mouseup: that one is still to be cancelled.
    setTimeout(() => {
      view.removeEventListener("mouseup", cancelUp, options);
    }, 0);
  };
}

/**
 * Holds the selection of text while a mouse or pen presses (`down`), as d3-drag and d3-zoom do, and
 * lets go of it once the pointer is released. A finger is left alone.
 */
export function holdSelectionWhilePressed(
  down: Pick<PointerEvent, "pointerId" | "pointerType">,
): void {
  if (down.pointerType === "touch") {
    return;
  }
  // Released through the pointer first, so a press that fails right after cannot keep it.
  let release = noop;
  trackPointer(down, noop, () => {
    release();
  });
  release = holdSelection();
}
