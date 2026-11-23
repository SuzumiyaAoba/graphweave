import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

import { cx } from "./class-names.ts";
import { usePortalTarget } from "./portal-targets.ts";
import { useStore } from "./use-store.ts";

// How much of its own width and height the toolbar is moved back by, in percent, for each alignment.
const ALIGN_X = { left: 0, center: 50, right: 100 } as const;
const ALIGN_Y = { top: 0, center: 50, bottom: 100 } as const;

export interface EdgeToolbarProps extends HTMLAttributes<HTMLDivElement> {
  edgeId: string;
  /** Where to put the toolbar, in flow coordinates; usually the label position of the edge. */
  x: number;
  y: number;
  /** Show or hide it; by default it shows while the edge is selected. */
  isVisible?: boolean | undefined;
  alignX?: keyof typeof ALIGN_X | undefined;
  alignY?: keyof typeof ALIGN_Y | undefined;
  children?: ReactNode;
}

/** A toolbar that sits on an edge, in the layer of edge labels, and shows while the edge is selected. */
export function EdgeToolbar({
  edgeId,
  x,
  y,
  isVisible,
  alignX = "center",
  alignY = "center",
  children,
  className,
  style,
  ...rest
}: EdgeToolbarProps): ReactElement | null {
  const target = usePortalTarget("edgeLabels");
  const edge = useStore((state) => state.edgeLookup.get(edgeId));
  const zoom = useStore((state) => state.viewport.zoom);
  if (target === null || !(isVisible ?? edge?.selected === true)) {
    return null;
  }
  // The toolbar keeps its size whatever the zoom is, as React Flow's does.
  const transform = `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(${-ALIGN_X[alignX]}%, ${-ALIGN_Y[alignY]}%)`;
  return createPortal(
    <div
      {...rest}
      className={cx("react-flow__edge-toolbar", className)}
      style={{
        position: "absolute",
        transform,
        zIndex: (edge?.zIndex ?? 0) + 1,
        pointerEvents: "all",
        transformOrigin: "0 0",
        ...style,
      }}
      data-id={edge?.id ?? ""}
    >
      {children}
    </div>,
    target,
  );
}
