import { describe, expect, it } from "vite-plus/test";

// oxlint-disable-next-line import/no-namespace -- the test enumerates the names the module exports
import * as FreeFlow from "./index.ts";

// Every runtime (value) export of @xyflow/react 12.12.1, grouped by kind. Type-only exports are not
// listed here because they are erased at runtime; the type-level surface is covered by the
// components' own tests. Parity is reached when `PENDING` is empty.
const XYFLOW_RUNTIME_EXPORTS = [
  // Components
  "ReactFlow",
  "ReactFlowProvider",
  "Handle",
  "Panel",
  "EdgeLabelRenderer",
  "ViewportPortal",
  "EdgeText",
  "BaseEdge",
  "StraightEdge",
  "StepEdge",
  "BezierEdge",
  "SimpleBezierEdge",
  "SmoothStepEdge",
  "Background",
  "Controls",
  "ControlButton",
  "MiniMap",
  "MiniMapNode",
  "NodeResizer",
  "NodeResizeControl",
  "NodeToolbar",
  "EdgeToolbar",
  // Hooks
  "useReactFlow",
  "useUpdateNodeInternals",
  "useNodes",
  "useEdges",
  "useViewport",
  "useKeyPress",
  "useNodesState",
  "useEdgesState",
  "useStore",
  "useStoreApi",
  "useOnViewportChange",
  "useOnSelectionChange",
  "useNodesInitialized",
  "useHandleConnections",
  "useNodeConnections",
  "useNodesData",
  "useConnection",
  "useInternalNode",
  "useNodeId",
  "experimental_useOnNodesChangeMiddleware",
  "experimental_useOnEdgesChangeMiddleware",
  // Utilities
  "applyNodeChanges",
  "applyEdgeChanges",
  "isNode",
  "isEdge",
  "addEdge",
  "reconnectEdge",
  "getBezierPath",
  "getBezierEdgeCenter",
  "getSimpleBezierPath",
  "getSmoothStepPath",
  "getStraightPath",
  "getEdgeCenter",
  "getViewportForBounds",
  "getNodesBounds",
  "getIncomers",
  "getOutgoers",
  "getConnectedEdges",
  // Enum-like constants
  "Position",
  "MarkerType",
  "ConnectionMode",
  "ConnectionLineType",
  "PanOnScrollMode",
  "SelectionMode",
  "ResizeControlVariant",
  "BackgroundVariant",
] as const;

// Names that are still missing. Remove a name here in the same change that exports it.
const PENDING: readonly string[] = [];

describe("React Flow runtime export parity", () => {
  it("lists every xyflow name exactly once", () => {
    expect(new Set(XYFLOW_RUNTIME_EXPORTS).size).toBe(XYFLOW_RUNTIME_EXPORTS.length);
  });

  it("keeps the pending list exact, so it cannot go stale", () => {
    const exported = new Set(Object.keys(FreeFlow));
    const missing = XYFLOW_RUNTIME_EXPORTS.filter((name) => !exported.has(name));
    expect(missing).toStrictEqual(PENDING);
  });
});
