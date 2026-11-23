import { Position } from "@free-flow/core";
import type { HandleBound, HandleBounds, HandleType, NodeDimensionUpdate } from "@free-flow/core";

export const NODE_CLASS = "react-flow__node";
export const HANDLE_CLASS = "react-flow__handle";

const POSITION_BY_NAME: ReadonlyMap<string, Position> = new Map([
  [Position.Left, Position.Left],
  [Position.Top, Position.Top],
  [Position.Right, Position.Right],
  [Position.Bottom, Position.Bottom],
]);

function asPosition(value: string | undefined): Position {
  return (value === undefined ? undefined : POSITION_BY_NAME.get(value)) ?? Position.Left;
}

function flagsOf(
  handle: HTMLElement,
): Pick<HandleBound, "isConnectable" | "isConnectableStart" | "isConnectableEnd"> {
  const { classList } = handle;
  return {
    isConnectable: classList.contains("connectable"),
    isConnectableStart: classList.contains("connectablestart"),
    isConnectableEnd: classList.contains("connectableend"),
  };
}

// A handle is a source when it says so by its class, and a target otherwise.
function handleTypeOf(handle: HTMLElement): HandleType {
  return handle.classList.contains("source") ? "source" : "target";
}

// `offsetWidth` is rounded, so the scale it gives is only roughly the zoom: within this share of it,
// the zoom is taken as the scale.
const SCALE_TOLERANCE = 0.02;

// The scale the flow is drawn at, read as React Flow reads it: from the transform that the layer of
// nodes is drawn with. Undefined where that cannot be read (no layout, or no such layer).
function drawnScale(element: HTMLElement): number | undefined {
  const layer = element.closest(".react-flow__viewport");
  if (layer === null || typeof DOMMatrixReadOnly === "undefined") {
    return undefined;
  }
  const { transform } = globalThis.getComputedStyle(layer);
  if (transform === "" || transform === "none") {
    return undefined;
  }
  const scale = new DOMMatrixReadOnly(transform).m22;
  return Number.isFinite(scale) && scale > 0 ? scale : undefined;
}

// How much the node is scaled on screen. The store's zoom can be ahead of what has been rendered (a
// `fitView` has just run), and boxes measured then must be divided by the scale they were measured
// under, so the scale is read from the DOM: from the transform of the flow, as React Flow does, or
// from the node's own box where there is none; there the zoom is the answer when it agrees with the
// box (it is exact) or when the element has no size to compare.
function renderedScale(element: HTMLElement, box: DOMRect, zoom: number): number {
  const drawn = drawnScale(element);
  if (drawn !== undefined) {
    return drawn;
  }
  if (element.offsetWidth <= 0 || box.width <= 0) {
    return zoom;
  }
  const ratio = box.width / element.offsetWidth;
  return Math.abs(ratio - zoom) <= zoom * SCALE_TOLERANCE ? zoom : ratio;
}

// The flags are kept on the bound for the connection logic, out of sight: the handle bounds that
// React Flow hands out (`getInternalNode`, a connection's handles) do not list them.
function withHiddenFlags(bound: HandleBound, handle: HTMLElement): HandleBound {
  for (const [key, value] of Object.entries(flagsOf(handle))) {
    Object.defineProperty(bound, key, { value, enumerable: false, writable: true });
  }
  return bound;
}

function handleBoundOf(handle: HTMLElement, node: DOMRect, scale: number): HandleBound {
  const box = handle.getBoundingClientRect();
  const { dataset } = handle;
  const bound: HandleBound = {
    id: dataset["handleid"] ?? null,
    type: handleTypeOf(handle),
    nodeId: dataset["nodeid"],
    position: asPosition(dataset["handlepos"]),
    x: (box.left - node.left) / scale,
    y: (box.top - node.top) / scale,
    // The size is the handle's own, as in React Flow, and not its box under the scale.
    width: handle.offsetWidth,
    height: handle.offsetHeight,
  };
  return withHiddenFlags(bound, handle);
}

function handlesOfNode(element: HTMLElement): HTMLElement[] {
  // Handles of nodes nested inside this one belong to those nodes.
  return [...element.querySelectorAll<HTMLElement>(`.${HANDLE_CLASS}`)].filter(
    (handle) => handle.closest(`.${NODE_CLASS}`) === element,
  );
}

/**
 * The boxes of a node's handles, relative to the node and in flow units. The scale that is undone is
 * the one the node is rendered at; `zoom` only stands in when that cannot be read.
 */
export function measureHandles(element: HTMLElement, zoom: number): HandleBounds {
  const nodeBox = element.getBoundingClientRect();
  const scale = renderedScale(element, nodeBox, zoom);
  const bounds: HandleBounds = { source: [], target: [] };
  for (const handle of handlesOfNode(element)) {
    const type = handleTypeOf(handle);
    bounds[type].push(handleBoundOf(handle, nodeBox, scale));
  }
  return bounds;
}

/** Whether a handle can be connected, with the id it has on the page. */
export type HandleFlagsOnPage = ReturnType<typeof flagsOf> & { id: string | null };

/** Whether each handle of a node can be connected, by kind, in the order the handles are measured. */
export interface HandleFlagLists {
  source: HandleFlagsOnPage[];
  target: HandleFlagsOnPage[];
}

/** What the classes of a node's handles say about connecting them, read as the measuring reads them. */
export function handleFlagLists(element: HTMLElement): HandleFlagLists {
  const lists: HandleFlagLists = { source: [], target: [] };
  for (const handle of handlesOfNode(element)) {
    lists[handleTypeOf(handle)].push({
      id: handle.dataset["handleid"] ?? null,
      ...flagsOf(handle),
    });
  }
  return lists;
}

/** A node's rendered size and handle positions, ready for `updateNodeDimensions`. */
export function measureNode(element: HTMLElement, zoom: number): NodeDimensionUpdate {
  return {
    id: element.dataset["id"] ?? "",
    width: element.offsetWidth,
    height: element.offsetHeight,
    handleBounds: measureHandles(element, zoom),
  };
}
