import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Edge, Node } from "./types.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 10, y: 20 }, data: { label: "a", n: 1 }, width: 100, height: 40 },
];
const EDGES: Edge[] = [{ id: "e", source: "a", target: "a", data: { t: 1 } }];

// Renders a flow and hands back its instance once it is there.
async function flow(): Promise<ReactFlowInstance> {
  cleanup();
  const held: { instance: ReactFlowInstance | undefined } = { instance: undefined };
  const keep = (instance: ReactFlowInstance): void => {
    held.instance = instance;
  };
  render(
    <ReactFlow width={400} height={300} defaultNodes={NODES} defaultEdges={EDGES} onInit={keep} />,
  );
  await act(flowSettled);
  if (held.instance === undefined) {
    throw new Error("the flow gave no instance");
  }
  return held.instance;
}

async function settle(run: () => void): Promise<void> {
  await act(async () => {
    run();
    await flowSettled();
  });
}

// As React Flow's updateNode, updateNodeData and updateEdgeData.
describe("updating an element through the instance", () => {
  it("merges a node that is not complete even with replace, keeping its position", async () => {
    const rf = await flow();
    await settle(() => {
      rf.updateNode("a", { data: { only: true } }, { replace: true });
    });
    expect([rf.getNode("a")?.position, rf.getNode("a")?.data]).toStrictEqual([
      { x: 10, y: 20 },
      { only: true },
    ]);
  });

  it("gives an updater of data the whole node or edge", async () => {
    const rf = await flow();
    await settle(() => {
      rf.updateNodeData("a", (node) => ({ seen: node.id }));
      rf.updateEdgeData("e", (edge) => ({ from: edge.source }));
    });
    expect([rf.getNode("a")?.data, rf.getEdge("e")?.data]).toStrictEqual([
      { label: "a", n: 1, seen: "a" },
      { t: 1, from: "a" },
    ]);
  });
});
