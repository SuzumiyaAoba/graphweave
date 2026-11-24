import { MarkerType, errorMessages } from "@graphweave/core";
import type { EdgeMarker, EdgeMarkerType } from "@graphweave/core";
import { useEffect } from "react";
import type { ReactElement } from "react";

import type { Edge } from "./types.ts";
import { useStore } from "./use-store.ts";
import { useViewProps, useViewPropsStore } from "./view-props.ts";

const DEFAULT_MARKER_SIZE = 12.5;
const DEFAULT_STROKE_WIDTH = 1;

/** The id of the `<marker>` element that draws this marker; a string marker names its own. */
export function getMarkerId(marker: EdgeMarkerType | undefined, rfId: string): string | undefined {
  if (marker === undefined) {
    return undefined;
  }
  if (typeof marker === "string") {
    return marker;
  }
  const settings = Object.entries(marker)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return `${rfId}__${settings}`;
}

/** The `url(#id)` reference an edge's path points at. */
export function markerUrl(marker: EdgeMarkerType | undefined, rfId: string): string | undefined {
  const id = getMarkerId(marker, rfId);
  return id === undefined ? undefined : `url('#${id}')`;
}

function markersOf(edges: readonly Edge[], defaults: Partial<Edge>): EdgeMarker[] {
  const found = new Map<string, EdgeMarker>();
  for (const edge of edges) {
    for (const marker of [
      edge.markerStart ?? defaults.markerStart,
      edge.markerEnd ?? defaults.markerEnd,
    ]) {
      if (marker !== undefined && typeof marker !== "string") {
        found.set(getMarkerId(marker, "") ?? "", marker);
      }
    }
  }
  return [...found.values()];
}

function MarkerSymbol({
  marker,
  rfId,
  color,
}: {
  marker: EdgeMarker;
  rfId: string;
  color: string | null;
}): ReactElement | null {
  const view = useViewPropsStore();
  const known = marker.type === MarkerType.Arrow || marker.type === MarkerType.ArrowClosed;
  useEffect(() => {
    if (!known) {
      view.getState().onError?.("009", errorMessages.error009(marker.type));
    }
  }, [known, marker.type, view]);
  if (!known) {
    return null;
  }
  // As in React Flow, no colour (or an empty one) is the flow's default colour, and no default
  // colour leaves the arrow to the stylesheet.
  const own = marker.color ?? "";
  const stroke = own === "" ? color : own;
  const closed = marker.type === MarkerType.ArrowClosed;
  return (
    <marker
      className="react-flow__arrowhead"
      id={getMarkerId(marker, rfId)}
      markerWidth={`${marker.width ?? DEFAULT_MARKER_SIZE}`}
      markerHeight={`${marker.height ?? DEFAULT_MARKER_SIZE}`}
      viewBox="-10 -10 20 20"
      markerUnits={marker.markerUnits ?? "strokeWidth"}
      orient={marker.orient ?? "auto-start-reverse"}
      refX="0"
      refY="0"
    >
      <polyline
        className={closed ? "arrowclosed" : "arrow"}
        points={closed ? "-5,-4 0,0 -5,4 -5,-4" : "-5,-4 0,0 -5,4"}
        style={{
          strokeWidth: marker.strokeWidth ?? DEFAULT_STROKE_WIDTH,
          ...(stroke === null || stroke === ""
            ? {}
            : { stroke, ...(closed ? { fill: stroke } : {}) }),
        }}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={closed ? undefined : "none"}
      />
    </marker>
  );
}

/** The `<defs>` holding the arrowheads that the flow's edges use. Rendered once for all edges. */
export function MarkerDefinitions(): ReactElement | null {
  const rfId = useViewProps((props) => props.rfId);
  const color = useViewProps((props) => props.defaultMarkerColor);
  const defaults = useViewProps((props) => props.defaultEdgeOptions);
  const edges = useStore((state) => state.edges);
  const markers = markersOf(edges, defaults);
  if (markers.length === 0) {
    return null;
  }
  return (
    <svg className="react-flow__marker" aria-hidden="true">
      <defs>
        {markers.map((marker) => (
          <MarkerSymbol key={getMarkerId(marker, rfId)} marker={marker} rfId={rfId} color={color} />
        ))}
      </defs>
    </svg>
  );
}
