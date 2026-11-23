import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePortalTarget } from "./portal-targets.ts";

export interface ViewportPortalProps {
  children: ReactNode;
}

/** Renders its children in the viewport layer, in flow coordinates: they pan and zoom with the nodes. */
export function ViewportPortal({ children }: ViewportPortalProps): ReactElement | null {
  const target = usePortalTarget("viewportPortal");
  return target === null ? null : createPortal(children, target);
}
