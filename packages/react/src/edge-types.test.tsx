import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

async function show(edges: Edge[]): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} defaultEdges={edges} />);
    await Promise.resolve();
  });
}

function pathOf(id: string): string {
  return (
    document
      .querySelector(`.react-flow__edge[data-id="${id}"] path.react-flow__edge-path`)
      ?.getAttribute("d") ?? ""
  );
}

describe("step and smooth step edges", () => {
  it("lets a smooth step edge's stepPosition move its middle segment", async () => {
    await show([
      { id: "plain", source: "a", target: "b", type: "smoothstep" },
      {
        id: "moved",
        source: "a",
        target: "b",
        type: "smoothstep",
        pathOptions: { stepPosition: 0.2 },
      },
    ]);
    expect(pathOf("plain")).not.toBe("");
    expect(pathOf("moved")).not.toBe(pathOf("plain"));
  });

  it("gives a step edge the offset but not the step position, as React Flow does", async () => {
    await show([
      { id: "plain", source: "a", target: "b", type: "step" },
      {
        id: "moved",
        source: "a",
        target: "b",
        type: "step",
        pathOptions: { stepPosition: 0.2 },
      },
      {
        id: "offset",
        source: "a",
        target: "b",
        type: "step",
        pathOptions: { offset: 60 },
      },
    ]);
    expect(pathOf("moved")).toBe(pathOf("plain"));
    expect(pathOf("offset")).not.toBe(pathOf("plain"));
  });
});
