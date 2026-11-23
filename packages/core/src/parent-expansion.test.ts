import { describe, expect, it, vi } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { makeNode } from "./test-fixtures.ts";
import type { NodeBase, NodeChange } from "./types.ts";

function sized(id: string, extra: Partial<NodeBase>): NodeBase {
  const size = { width: 100, height: 50 };
  return makeNode(id, { ...size, measured: size, ...extra });
}

// A parent at the origin, 300 wide and 200 tall, with a child that expands it, at (50, 50).
function flowWith(
  onNodesChange: (changes: NodeChange[]) => void,
): ReturnType<typeof createFlowStore> {
  return createFlowStore({
    nodes: [
      sized("p", {
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
        measured: { width: 300, height: 200 },
      }),
      sized("c", { position: { x: 50, y: 50 }, parentId: "p", expandParent: true }),
    ],
    onNodesChange,
  });
}

describe("moving a node that expands its parent", () => {
  it("holds it at the corner of the parent and makes the parent grow to the right", () => {
    const onNodesChange = vi.fn<(changes: NodeChange[]) => void>();
    const store = flowWith(onNodesChange);
    store.getState().updateNodePositions([
      {
        id: "c",
        type: "position",
        position: { x: 260, y: -30 },
        positionAbsolute: { x: 260, y: -30 },
        dragging: true,
      },
    ]);
    expect(onNodesChange).toHaveBeenCalledOnce();
    const changes = onNodesChange.mock.calls[0]?.[0];
    expect(changes?.[0]).toMatchObject({ id: "c", position: { x: 260, y: 0 } });
    expect(changes).toContainEqual({
      id: "p",
      type: "dimensions",
      setAttributes: true,
      dimensions: { width: 360, height: 230 },
    });
  });

  it("moves a node that does not expand its parent as it was told", () => {
    const onNodesChange = vi.fn<(changes: NodeChange[]) => void>();
    const store = createFlowStore({ nodes: [sized("a", {})], onNodesChange });
    store.getState().updateNodePositions([
      {
        id: "a",
        type: "position",
        position: { x: -10, y: -10 },
        positionAbsolute: { x: -10, y: -10 },
      },
    ]);
    // Told as React Flow tells it: the absolute position is only what the expansion is worked out from.
    expect(onNodesChange).toHaveBeenCalledExactlyOnceWith([
      { id: "a", type: "position", position: { x: -10, y: -10 } },
    ]);
  });
});
