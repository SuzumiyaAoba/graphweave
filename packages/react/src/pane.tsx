import { useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from "react";

import { cx } from "./class-names.ts";
import { CONTAINER_STYLE } from "./container-style.ts";
import { doubleClicked } from "./double-click-zoom.ts";
import { noop } from "./noop.ts";
import { createPaneController } from "./pane-controller.ts";
import type { PaneController } from "./pane-controller.ts";
import { inViewportPortal, listenToPortal, onRenderer } from "./pane-portal.ts";
import { panAllowedFor } from "./pane-rules.ts";
import type { PaneKeys, PaneUi } from "./pane-types.ts";
import { useKeyPress } from "./use-key-press.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { UserSelection } from "./user-selection.tsx";
import { useViewProps, useViewPropsStore } from "./view-props.ts";
import { cancelViewportAnimation } from "./viewport-animation.ts";
import { createWheelHandler } from "./wheel-controller.ts";

// Whether a press or a double click that React brings to the pane is for its pan and zoom.
function pansFrom(target: EventTarget | null, pane: Element): boolean {
  return onRenderer(target, pane) && !inViewportPortal(target, pane);
}

/**
 * The surface behind the nodes: it pans and zooms the canvas, draws the selection box and reports
 * clicks on the empty background.
 */
export function Pane({ children }: { children: ReactNode }): ReactElement {
  const store = useStoreApi();
  const view = useViewPropsStore();
  const ref = useRef<HTMLDivElement>(null);
  const controller = useRef<PaneController | null>(null);
  const [ui, setUi] = useState<PaneUi>({ dragging: false, selecting: false });
  useEffect(() => {
    store.setState({ paneDragging: ui.dragging });
  }, [store, ui.dragging]);
  const selectionKeyPressed = useKeyPress(
    useViewProps((props) => props.selectionKeyCode),
    {
      target: globalThis.window,
    },
  );
  const panActivationKeyPressed = useKeyPress(
    useViewProps((props) => props.panActivationKeyCode),
    { target: globalThis.window },
  );
  const zoomKeyPressed = useKeyPress(useViewProps((props) => props.zoomActivationKeyCode));
  const panOnDrag = useViewProps((props) => props.panOnDrag);
  const selectionOnDrag = useViewProps((props) => props.selectionOnDrag);
  const userSelectionActive = useStore((state) => state.userSelectionActive);
  const elementsSelectable = useStore((state) => state.elementsSelectable);
  // The listeners below outlive a render, so they read the keys through refs.
  const keys = useRef<PaneKeys>({ selectionKeyPressed, panActivationKeyPressed });
  const zoomKey = useRef(zoomKeyPressed);
  useEffect(() => {
    keys.current = { selectionKeyPressed, panActivationKeyPressed };
    zoomKey.current = zoomKeyPressed;
  }, [selectionKeyPressed, panActivationKeyPressed, zoomKeyPressed]);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return noop;
    }
    // The wheel is heard on the renderer, as React Flow's d3-zoom hears it: a node toolbar too.
    const renderer = element.closest<HTMLElement>(".react-flow__renderer") ?? element;
    const onWheel = createWheelHandler({
      store,
      view,
      element: renderer,
      pane: element,
      zoomKeyDown: () => zoomKey.current,
    });
    controller.current = createPaneController({
      store,
      view,
      element,
      keys: () => keys.current,
      onUi: setUi,
    });
    const forgetPortal = listenToPortal(element, {
      down: (event) => {
        controller.current?.portalDown(event);
      },
      doubleClick: (event) => {
        doubleClicked({ store, view, element }, event, keys.current.panActivationKeyPressed);
      },
    });
    // Not passive: the handler cancels the page scroll when the wheel zooms the canvas.
    renderer.addEventListener("wheel", onWheel.onWheel, { passive: false });
    return (): void => {
      forgetPortal();
      renderer.removeEventListener("wheel", onWheel.onWheel);
      onWheel.dispose();
      controller.current?.dispose();
      controller.current = null;
      cancelViewportAnimation(store);
    };
  }, [store, view]);

  // A press pans where React Flow's d3-zoom hears it: on the page inside the renderer. What ViewportPortal
  // draws is taken from the page (above), also when React brings it here. The selection box and the
  // fingers follow React, as React Flow's pane does.
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pansFrom(event.target, event.currentTarget)) {
      controller.current?.pointerDown(event);
    }
  };
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>): void => {
    controller.current?.captureDown(event);
  };
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    controller.current?.click(event);
  };
  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (Array.isArray(panOnDrag) && panOnDrag.includes(2)) {
      event.preventDefault();
    } else if (event.target === event.currentTarget) {
      view.getState().onPaneContextMenu?.(event);
    }
  };
  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    if (pansFrom(event.target, element)) {
      doubleClicked(
        { store, view, element },
        event.nativeEvent,
        keys.current.panActivationKeyPressed,
      );
    }
  };
  const forward =
    (name: "onPaneMouseMove" | "onPaneMouseEnter" | "onPaneMouseLeave") =>
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      view.getState()[name]?.(event);
    };
  // As in React Flow: while a box can be drawn, the pane's own pointer events belong to it, and a
  // click is told by the end of the box (a press that did not move), not by the click event.
  const isSelecting =
    selectionKeyPressed ||
    userSelectionActive ||
    (selectionOnDrag && !(panActivationKeyPressed || panOnDrag === true));
  const selectionEnabled = elementsSelectable && isSelecting;
  return (
    // The canvas background is a pointer affordance (pan, box-select, click to clear the selection);
    // keyboard users work with the focusable nodes and edges, which have their own key handling.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      ref={ref}
      className={cx(
        "react-flow__pane",
        panAllowedFor(0, panActivationKeyPressed || panOnDrag) && "draggable",
        ui.dragging && "dragging",
        isSelecting && "selection",
      )}
      style={CONTAINER_STYLE}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerDown={handlePointerDown}
      onClick={selectionEnabled ? undefined : handleClick}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onPointerMove={selectionEnabled ? undefined : forward("onPaneMouseMove")}
      onPointerEnter={selectionEnabled ? undefined : forward("onPaneMouseEnter")}
      onPointerLeave={forward("onPaneMouseLeave")}
    >
      {children}
      <UserSelection />
    </div>
  );
}
