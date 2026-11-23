import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { EMPTY_STATS, PlaygroundController } from "./controller.ts";
import type { PlaygroundStats } from "./controller.ts";
import { DEFAULT_SEED } from "./scene.ts";
import type { IndexKind } from "./scene.ts";

export interface FlowPlaygroundProps {
  /** How many nodes the scene holds. */
  readonly nodeCount: number;
  /** Which spatial index answers the visibility and hit-test queries. */
  readonly index: IndexKind;
  /** Grid cell edge length in flow units (grid index only). */
  readonly cellSize: number;
  /** Draws the grid cells over the scene (grid index only). */
  readonly showGrid: boolean;
}

const rootStyle: CSSProperties = { position: "relative", width: "100%", height: "100vh" };
const hostStyle: CSSProperties = { position: "absolute", inset: 0 };
const panelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  margin: 0,
  padding: "10px 12px",
  borderRadius: 6,
  background: "rgba(0, 0, 0, 0.7)",
  color: "#e8eaed",
  font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
  pointerEvents: "none",
  whiteSpace: "pre",
};

function indexLabel(index: IndexKind, cellSize: number): string {
  if (index === "grid") {
    return `UniformGridIndex (cell ${String(cellSize)})`;
  }
  return "BruteForceIndex";
}

/** The grid overlay draws the index's cells, so it has nothing to show for the linear-scan index. */
function gridNote(props: FlowPlaygroundProps): string[] {
  if (props.showGrid && props.index !== "grid") {
    return ["grid     (the overlay needs the grid index)"];
  }
  return [];
}

function describeStats(props: FlowPlaygroundProps, stats: PlaygroundStats): string {
  return [
    `index    ${indexLabel(props.index, props.cellSize)}`,
    `nodes    ${stats.total.toLocaleString("en-US")}`,
    `visible  ${stats.visible.toLocaleString("en-US")}`,
    `query    ${stats.queryMs.toFixed(2)} ms  (visibility query only)`,
    `draw     ${stats.drawMs.toFixed(2)} ms`,
    `zoom     ${stats.zoom.toFixed(2)}x`,
    ...gridNote(props),
    "",
    "drag background: pan   wheel: zoom   drag a node: move it",
    "timings vary by machine and build: compare stories, do not treat them as benchmarks",
  ].join("\n");
}

/**
 * Canvas playground for `@free-flow/core`: a `NodeStore` and a spatial index drive what is drawn,
 * which nodes a click hits, and how dragging keeps the index up to date.
 */
export function FlowPlayground(props: FlowPlaygroundProps): ReactElement {
  const { nodeCount, index, cellSize, showGrid } = props;
  const [stats, setStats] = useState<PlaygroundStats>(EMPTY_STATS);
  const controllerRef = useRef<PlaygroundController | null>(null);
  const showGridRef = useRef(showGrid);

  // A ref callback may return its own cleanup (React 19). The scene is rebuilt when the node count,
  // the index or its cell size change; the grid overlay is a drawing flag and must not reset the view.
  const attach = useCallback(
    (host: HTMLDivElement): (() => void) => {
      const canvas = document.createElement("canvas");
      host.append(canvas);
      const controller = new PlaygroundController(
        canvas,
        { nodeCount, index, cellSize, showGrid: showGridRef.current, seed: DEFAULT_SEED },
        setStats,
      );
      controllerRef.current = controller;
      const observer = new ResizeObserver(() => {
        controller.resize(
          { width: host.clientWidth, height: host.clientHeight },
          window.devicePixelRatio,
        );
      });
      observer.observe(host);
      return () => {
        observer.disconnect();
        controller.destroy();
        canvas.remove();
        controllerRef.current = null;
      };
    },
    [nodeCount, index, cellSize],
  );

  useEffect(() => {
    showGridRef.current = showGrid;
    if (controllerRef.current) {
      controllerRef.current.setShowGrid(showGrid);
    }
  }, [showGrid]);

  return (
    <div style={rootStyle}>
      <div ref={attach} style={hostStyle} />
      <pre style={panelStyle}>{describeStats(props, stats)}</pre>
    </div>
  );
}
