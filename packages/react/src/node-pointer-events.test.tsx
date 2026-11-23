import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";

// Nodes that nothing can select or drag: React Flow gives them the pointer only when the flow
// listens to them (`onNodeClick`, `onNodeMouseEnter`, `onNodeMouseMove`, `onNodeMouseLeave`).
const LOCKED: ReactFlowProps = {
  defaultNodes: [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }],
  width: 800,
  height: 600,
  nodesDraggable: false,
  elementsSelectable: false,
};

async function pointerEventsWith(props: ReactFlowProps): Promise<string> {
  cleanup();
  await act(async () => {
    render(<ReactFlow {...LOCKED} {...props} />);
    await Promise.resolve();
  });
  return document.querySelector<HTMLElement>(".react-flow__node")?.style.pointerEvents ?? "";
}

describe("the pointer events of a node that cannot be selected or dragged", () => {
  it("are off when nothing listens to the node", async () => {
    await expect(pointerEventsWith({})).resolves.toBe("none");
  });

  it("stay on when the flow listens to clicks on nodes", async () => {
    await expect(pointerEventsWith({ onNodeClick: vi.fn<() => void>() })).resolves.toBe("all");
  });

  it("stay on when the flow listens to the pointer entering, moving over or leaving a node", async () => {
    await expect(pointerEventsWith({ onNodeMouseEnter: vi.fn<() => void>() })).resolves.toBe("all");
    await expect(pointerEventsWith({ onNodeMouseMove: vi.fn<() => void>() })).resolves.toBe("all");
    await expect(pointerEventsWith({ onNodeMouseLeave: vi.fn<() => void>() })).resolves.toBe("all");
  });

  it("are off for the handlers React Flow does not count, double click and context menu", async () => {
    await expect(pointerEventsWith({ onNodeDoubleClick: vi.fn<() => void>() })).resolves.toBe(
      "none",
    );
    await expect(pointerEventsWith({ onNodeContextMenu: vi.fn<() => void>() })).resolves.toBe(
      "none",
    );
  });
});
