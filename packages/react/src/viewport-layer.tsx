import { useCallback, useContext } from "react";
import type { ReactElement } from "react";

import { ConnectionLine } from "./connection-line.tsx";
import { EdgeRenderer } from "./edge-renderer.tsx";
import { NodeRenderer } from "./node-renderer.tsx";
import { PortalRegistryContext } from "./portal-targets.ts";
import { useStore } from "./use-store.ts";

/**
 * The layer that is panned and scaled: the edges, the connection being dragged and the nodes live
 * in it, in flow coordinates. It also holds the two places that portals render into: one for edge
 * labels, one for `ViewportPortal`.
 */
export function ViewportLayer(): ReactElement {
  const registry = useContext(PortalRegistryContext);
  const { x, y, zoom } = useStore((state) => state.viewport);
  const edgeLabels = useCallback(
    (element: HTMLDivElement | null) => {
      registry?.set("edgeLabels", element);
    },
    [registry],
  );
  const viewportPortal = useCallback(
    (element: HTMLDivElement | null) => {
      registry?.set("viewportPortal", element);
    },
    [registry],
  );
  return (
    <div
      className="react-flow__viewport xyflow__viewport react-flow__container"
      style={{ transform: `translate(${x}px,${y}px) scale(${zoom})` }}
    >
      <EdgeRenderer />
      <ConnectionLine />
      <div ref={edgeLabels} className="react-flow__edgelabel-renderer" />
      <NodeRenderer />
      <div ref={viewportPortal} className="react-flow__viewport-portal" />
    </div>
  );
}
