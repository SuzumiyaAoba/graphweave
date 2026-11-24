import type { FitViewOptions } from "@graphweave/core";
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { cx } from "./class-names.ts";
import { ControlButton } from "./control-button.tsx";
import { FitViewIcon, LockIcon, MinusIcon, PlusIcon, UnlockIcon } from "./control-icons.tsx";
import { handled } from "./handled.ts";
import { createViewportInstance } from "./instance-viewport.ts";
import { Panel } from "./panel.tsx";
import { shallow } from "./shallow.ts";
import type { PanelPosition } from "./types.ts";
import { useStore, useStoreApi } from "./use-store.ts";
import { useViewProps } from "./view-props.ts";
import { changeViewportNow } from "./viewport-animation.ts";

export interface ControlProps {
  /** Buttons to zoom in and out. */
  showZoom?: boolean | undefined;
  showFitView?: boolean | undefined;
  /** The button that locks and unlocks dragging, connecting and selecting. */
  showInteractive?: boolean | undefined;
  fitViewOptions?: FitViewOptions | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
  onFitView?: (() => void) | undefined;
  onInteractiveChange?: ((interactive: boolean) => void) | undefined;
  position?: PanelPosition | undefined;
  orientation?: "horizontal" | "vertical" | undefined;
  children?: ReactNode;
  style?: CSSProperties | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
}

/** Buttons to zoom, fit the view and lock the flow, in a panel over the canvas. */
export function Controls({
  showZoom = true,
  showFitView = true,
  showInteractive = true,
  fitViewOptions,
  onZoomIn,
  onZoomOut,
  onFitView,
  onInteractiveChange,
  position = "bottom-left",
  orientation = "vertical",
  children,
  style,
  className,
  "aria-label": ariaLabel,
}: ControlProps): ReactElement {
  const store = useStoreApi();
  const labels = useViewProps((props) => props.ariaLabels);
  const interactive = useStore(
    (state) => state.nodesDraggable || state.nodesConnectable || state.elementsSelectable,
  );
  const limits = useStore(
    (state) => ({
      canZoomIn: state.viewport.zoom < state.maxZoom,
      canZoomOut: state.viewport.zoom > state.minZoom,
    }),
    shallow,
  );
  const fit = useMemo(() => createViewportInstance(store).fitView, [store]);
  const onError = useViewProps((props) => props.onError);
  const zoomIn = (): void => {
    // As the instance's call: a zoom that the limit leaves where it was is told all the same.
    changeViewportNow(store, () => store.getState().zoomIn());
    onZoomIn?.();
  };
  const zoomOut = (): void => {
    changeViewportNow(store, () => store.getState().zoomOut());
    onZoomOut?.();
  };
  const fitView = (): void => {
    // As with React Flow's `fitView`, the fit is made once the click has been dealt with.
    queueMicrotask(() => {
      handled(fit(fitViewOptions), (failure) => {
        onError?.("101", `Fitting the view failed: ${String(failure)}`);
      });
    });
    onFitView?.();
  };
  const toggleInteractive = (): void => {
    const next = !interactive;
    store.setState({ nodesDraggable: next, nodesConnectable: next, elementsSelectable: next });
    onInteractiveChange?.(next);
  };
  return (
    <Panel
      className={cx("react-flow__controls", orientation, className)}
      position={position}
      style={style}
      data-testid="rf__controls"
      aria-label={ariaLabel ?? labels["controls.ariaLabel"]}
    >
      {showZoom ? (
        <>
          <ControlButton
            onClick={zoomIn}
            className="react-flow__controls-zoomin"
            title={labels["controls.zoomIn.ariaLabel"]}
            aria-label={labels["controls.zoomIn.ariaLabel"]}
            disabled={!limits.canZoomIn}
          >
            <PlusIcon />
          </ControlButton>
          <ControlButton
            onClick={zoomOut}
            className="react-flow__controls-zoomout"
            title={labels["controls.zoomOut.ariaLabel"]}
            aria-label={labels["controls.zoomOut.ariaLabel"]}
            disabled={!limits.canZoomOut}
          >
            <MinusIcon />
          </ControlButton>
        </>
      ) : null}
      {showFitView ? (
        <ControlButton
          onClick={fitView}
          className="react-flow__controls-fitview"
          title={labels["controls.fitView.ariaLabel"]}
          aria-label={labels["controls.fitView.ariaLabel"]}
        >
          <FitViewIcon />
        </ControlButton>
      ) : null}
      {showInteractive ? (
        <ControlButton
          onClick={toggleInteractive}
          className="react-flow__controls-interactive"
          title={labels["controls.interactive.ariaLabel"]}
          aria-label={labels["controls.interactive.ariaLabel"]}
        >
          {interactive ? <UnlockIcon /> : <LockIcon />}
        </ControlButton>
      ) : null}
      {children}
    </Panel>
  );
}
