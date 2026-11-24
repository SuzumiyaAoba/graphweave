import { ResizeControlVariant, snapToGrid, startResize } from "@graphweave/core";
import type { ControlPosition, InternalNode, Point, ResizeWorld } from "@graphweave/core";
import { useEffect, useRef } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from "react";

import { cx } from "./class-names.ts";
import { clientToFlow } from "./coords.ts";
import { holdSelectionWhilePressed } from "./no-select.ts";
import { trackPointer } from "./pointer-track.ts";
import { resizeDragEvents } from "./resize-drag-event.ts";
import type { ResizeDragEvent } from "./resize-drag-event.ts";
import type { ReactFlowStore } from "./store-context.ts";
import { swallowClickAfterMove } from "./swallow-click.ts";
import { markDraggable } from "./touch-style.ts";
import { useNodeId } from "./use-graph-hooks.ts";
import { useStore, useStoreApi } from "./use-store.ts";

const DEFAULT_MIN_SIZE = 10;

export interface ResizeParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The size and position of a node while it is resized, and which edges the control moves. */
export interface ResizeParamsWithDirection extends ResizeParams {
  direction: [horizontal: number, vertical: number];
}

export type ShouldResize = (event: ResizeDragEvent, params: ResizeParamsWithDirection) => boolean;
export type OnResizeStart = (event: ResizeDragEvent, params: ResizeParams) => void;
export type OnResize = (event: ResizeDragEvent, params: ResizeParamsWithDirection) => void;
export type OnResizeEnd = (event: ResizeDragEvent, params: ResizeParams) => void;

export interface ResizeControlOptions {
  minWidth?: number | undefined;
  minHeight?: number | undefined;
  maxWidth?: number | undefined;
  maxHeight?: number | undefined;
  keepAspectRatio?: boolean | undefined;
  /** Restrict the resize to one axis. */
  resizeDirection?: "horizontal" | "vertical" | undefined;
  /** Counter-scale the handle so it keeps its size on screen while zooming. On by default. */
  autoScale?: boolean | undefined;
  shouldResize?: ShouldResize | undefined;
  onResizeStart?: OnResizeStart | undefined;
  onResize?: OnResize | undefined;
  onResizeEnd?: OnResizeEnd | undefined;
}

export interface NodeResizeControlProps extends ResizeControlOptions {
  nodeId?: string | undefined;
  position?: ControlPosition | undefined;
  variant?: ResizeControlVariant | undefined;
  color?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
}

function colorStyle(isLine: boolean, color: string | undefined): CSSProperties {
  if (color === undefined) {
    return {};
  }
  return isLine ? { borderColor: color } : { backgroundColor: color };
}

interface Resizing {
  store: ReactFlowStore;
  nodeId: string;
  position: ControlPosition;
  /** The current options: read at every event, so callbacks that changed mid-resize are used. */
  getOptions: () => ResizeControlOptions;
}

function boundariesOf(options: ResizeControlOptions): {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
} {
  return {
    minWidth: options.minWidth ?? DEFAULT_MIN_SIZE,
    minHeight: options.minHeight ?? DEFAULT_MIN_SIZE,
    maxWidth: options.maxWidth ?? Number.MAX_VALUE,
    maxHeight: options.maxHeight ?? Number.MAX_VALUE,
  };
}

// Where the pointer is in the flow, on the grid when the flow snaps to it, as React Flow takes it.
function pointerOf(store: ReactFlowStore, event: PointerEvent): Point {
  const point = clientToFlow(store, { x: event.clientX, y: event.clientY });
  const { snapToGrid: snapping, snapGrid } = store.getState();
  return snapping ? snapToGrid(point, snapGrid) : point;
}

// The nodes of the flow as they are now; `node` stands in for the one being resized if it is gone.
function worldOf(store: ReactFlowStore, node: InternalNode): ResizeWorld {
  const { nodeLookup, parentLookup, nodeOrigin } = store.getState();
  return { node: nodeLookup.get(node.id) ?? node, nodeLookup, parentLookup, nodeOrigin };
}

function beginResize({ store, nodeId, position, getOptions }: Resizing, down: PointerEvent): void {
  const first = getOptions();
  const state = store.getState();
  const node = state.nodeLookup.get(nodeId);
  if (node === undefined) {
    return;
  }
  const session = startResize(
    { ...worldOf(store, node), current: () => worldOf(store, node) },
    {
      controlPosition: position,
      boundaries: boundariesOf(first),
      keepAspectRatio: first.keepAspectRatio === true,
      resizeDirection: first.resizeDirection,
    },
    pointerOf(store, down),
  );
  // As d3-drag does for a mouse, no text is selected and nothing is dragged natively meanwhile.
  holdSelectionWhilePressed(down);
  const events = resizeDragEvents(down);
  const started = events.make("start", down);
  first.onResizeStart?.(started, session.start);
  events.dispatch(started);
  trackPointer(
    down,
    (event) => {
      const options = getOptions();
      const dragged = events.make("drag", event);
      const step = session.move(
        pointerOf(store, event),
        (values) => options.shouldResize?.(dragged, values) !== false,
      );
      if (step !== undefined) {
        options.onResize?.(dragged, step.values);
        store.getState().triggerNodeChanges(step.changes);
      }
      events.dispatch(dragged);
    },
    (event) => {
      const { values, change } = session.end();
      const ended = events.make("end", event);
      getOptions().onResizeEnd?.(ended, values);
      events.dispatch(ended);
      store.getState().triggerNodeChanges([change]);
      swallowClickAfterMove(down, event);
    },
  );
}

/** One control on a node's border that resizes it when dragged: a handle on a corner or a line on a side. */
export function NodeResizeControl({
  nodeId,
  position,
  variant = ResizeControlVariant.Handle,
  color,
  className,
  style,
  children,
  ...options
}: NodeResizeControlProps): ReactElement | null {
  const store = useStoreApi();
  const contextId = useNodeId();
  const id = nodeId ?? contextId;
  const zoom = useStore((state) => state.viewport.zoom);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  if (id === null) {
    return null;
  }
  const isLine = variant === ResizeControlVariant.Line;
  const place: ControlPosition = position ?? (isLine ? "right" : "bottom-right");
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button === 0) {
      event.stopPropagation();
      beginResize(
        { store, nodeId: id, position: place, getOptions: () => latest.current },
        event.nativeEvent,
      );
    }
  };
  return (
    <div
      className={cx(
        "react-flow__resize-control",
        "nodrag",
        ...place.split("-"),
        variant,
        className,
      )}
      style={{
        ...style,
        ...(options.autoScale !== false && !isLine ? { scale: `${Math.max(1 / zoom, 1)}` } : {}),
        ...colorStyle(isLine, color),
      }}
      onPointerDown={handlePointerDown}
      // As the d3-drag of React Flow's resizer marks it on a touch screen.
      ref={markDraggable}
    >
      {children}
    </div>
  );
}
