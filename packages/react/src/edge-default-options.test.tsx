import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

const EDGES: Edge[] = [
  { id: "plain", source: "a", target: "b" },
  { id: "own", source: "a", target: "b", selectable: true, focusable: true },
];

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} defaultEdges={EDGES} {...props} />,
    );
    await Promise.resolve();
  });
}

function edge(id: string): Element | null {
  return document.querySelector(`.react-flow__edge[data-id="${id}"]`);
}

describe("defaultEdgeOptions that decide what an edge can do", () => {
  it("make an edge neither selectable nor focusable, unless the edge says otherwise", async () => {
    await show({ defaultEdgeOptions: { selectable: false, focusable: false } });
    const plain = edge("plain");
    const own = edge("own");
    expect([
      plain?.classList.contains("selectable"),
      plain?.hasAttribute("tabindex"),
      own?.classList.contains("selectable"),
      own?.getAttribute("tabindex"),
    ]).toStrictEqual([false, false, true, "0"]);
  });

  it("leave an edge selectable and focusable when they say nothing about it", async () => {
    await show({ defaultEdgeOptions: { animated: true } });
    const plain = edge("plain");
    expect([
      plain?.classList.contains("selectable"),
      plain?.getAttribute("tabindex"),
    ]).toStrictEqual([true, "0"]);
  });
});
