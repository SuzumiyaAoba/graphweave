import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

async function zOfEdge(edge: Edge, props: ReactFlowProps): Promise<string> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={NODES}
        defaultEdges={[edge]}
        elevateEdgesOnSelect
        {...props}
      />,
    );
    await Promise.resolve();
  });
  return document.querySelector<HTMLElement>('[data-id="e"]')?.parentElement?.style.zIndex ?? "";
}

const SELECTED: Edge = { id: "e", source: "a", target: "b", zIndex: 7, selected: true };

describe("the stacking of an edge", () => {
  it("lifts a selected edge by 1000 on top of its own z-index", async () => {
    await expect(zOfEdge(SELECTED, {})).resolves.toBe("1007");
  });

  it("is only the edge's own z-index with zIndexMode manual", async () => {
    await expect(zOfEdge(SELECTED, { zIndexMode: "manual" })).resolves.toBe("7");
  });

  it("is only the edge's own z-index when it is not selected", async () => {
    await expect(zOfEdge({ ...SELECTED, selected: false }, {})).resolves.toBe("7");
  });
});
