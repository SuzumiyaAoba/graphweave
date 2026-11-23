import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";

const NODES: Node[] = [
  { id: "near", position: { x: 100, y: 100 }, data: {}, width: 100, height: 40 },
  { id: "far", position: { x: 5000, y: 100 }, data: {}, width: 100, height: 40 },
  { id: "held", position: { x: 5000, y: 300 }, data: {}, width: 100, height: 40, dragging: true },
];

async function shown(): Promise<string[]> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} onlyRenderVisibleElements />);
    await flowSettled();
  });
  await act(flowSettled);
  return [...document.querySelectorAll<HTMLElement>(".react-flow__node")].map(
    (node) => node.dataset["id"] ?? "",
  );
}

// As React Flow's getNodesInside, which onlyRenderVisibleElements draws the nodes of.
describe("the nodes drawn with onlyRenderVisibleElements", () => {
  it("leave out a node off the screen once it has been measured, but not one being dragged", async () => {
    await expect(shown()).resolves.toStrictEqual(["near", "held"]);
  });
});
