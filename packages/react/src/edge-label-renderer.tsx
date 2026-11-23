import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePortalTarget } from "./portal-targets.ts";

export interface EdgeLabelRendererProps {
  children: ReactNode;
}

/**
 * Renders HTML next to an edge instead of inside its SVG. Position the content yourself with
 * `transform: translate(-50%, -50%) translate(${x}px, ${y}px)`; add `pointerEvents: "all"` (and
 * the `nodrag nopan` classes) to make it interactive.
 */
export function EdgeLabelRenderer({ children }: EdgeLabelRendererProps): ReactElement | null {
  const target = usePortalTarget("edgeLabels");
  return target === null ? null : createPortal(children, target);
}
