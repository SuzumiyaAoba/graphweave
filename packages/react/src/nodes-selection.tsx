import { getBoundsOfRects } from "@free-flow/core";
import type { Rect } from "@free-flow/core";
import { useCallback, useEffect, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from "react";

import { cx } from "./class-names.ts";
import { beginNodeDrag } from "./drag-session.ts";
import { moveSelection } from "./node-keyboard.ts";
import { shallow } from "./shallow.ts";
import type { ReactFlowState } from "./store-context.ts";
import { markDraggable } from "./touch-style.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { useViewProps, useViewPropsStore } from "./view-props.ts";

function selectedBounds(state: ReactFlowState): Rect | undefined {
  const rects = [...state.nodeLookup.values()]
    .filter((node) => node.selected === true && node.hidden !== true)
    .map((node) => ({
      x: node.internals.positionAbsolute.x,
      y: node.internals.positionAbsolute.y,
      width: node.measured.width ?? node.width ?? 0,
      height: node.measured.height ?? node.height ?? 0,
    }));
  return rects.length === 0 ? undefined : getBoundsOfRects(rects);
}

/** A frame around the selected nodes after a box selection; dragging it moves them all. */
export function NodesSelection(): ReactElement | null {
  const store = useStoreApi();
  const view = useViewPropsStore();
  const active = useStore((state) => state.nodesSelectionActive);
  const bounds = useStore(selectedBounds, shallow);
  const viewport = useStore((state) => state.viewport);
  const noPan = useViewProps((props) => props.noPanClassName);
  const keyboardOff = useViewProps((props) => props.disableKeyboardA11y);
  const rect = useRef<HTMLDivElement>(null);
  // As the d3-drag of React Flow's selection marks the frame on a touch screen.
  const holdRect = useCallback((element: HTMLDivElement | null) => {
    rect.current = element;
    markDraggable(element);
  }, []);
  // The frame takes the focus when it appears, so that the arrow keys move the whole selection.
  useEffect(() => {
    if (!keyboardOff && active) {
      rect.current?.focus({ preventScroll: true });
    }
  }, [keyboardOff, active]);
  if (!active || bounds === undefined || bounds.width === 0 || bounds.height === 0) {
    return null;
  }
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button === 0) {
      event.stopPropagation();
      beginNodeDrag({ store, view }, event.nativeEvent);
    }
  };
  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const nodes = [...store.getState().nodeLookup.values()]
      .filter((node) => node.selected === true)
      .map((node) => node.internals.userNode);
    view.getState().onSelectionContextMenu?.(event, nodes);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    moveSelection(store, event);
  };
  return (
    <div
      className={cx("react-flow__nodesselection", "react-flow__container", noPan)}
      style={{
        transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom}) translate(${bounds.x}px,${bounds.y}px)`,
      }}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- React Flow's frame has no role either; the markup stays the same */}
      <div
        ref={holdRect}
        className="react-flow__nodesselection-rect"
        style={{ width: bounds.width, height: bounds.height }}
        tabIndex={keyboardOff ? undefined : -1}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onKeyDown={keyboardOff ? undefined : handleKeyDown}
      />
    </div>
  );
}
