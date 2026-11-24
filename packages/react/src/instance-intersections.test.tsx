import type { InternalNode } from "@graphweave/core";
import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 100, y: 100 }, data: {}, width: 150, height: 40 },
  { id: "b", position: { x: 350, y: 100 }, data: {}, width: 120, height: 60 },
  { id: "far", position: { x: 900, y: 900 }, data: {}, width: 50, height: 50 },
];

async function instance(): Promise<ReactFlowInstance> {
  cleanup();
  const holder: { current: ReactFlowInstance | undefined } = { current: undefined };
  await act(async () => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={NODES}
        onInit={(found) => {
          holder.current = found;
        }}
      />,
    );
    await flowSettled();
  });
  await act(flowSettled);
  if (holder.current === undefined) {
    throw new Error("the flow was not initialized");
  }
  return holder.current;
}

function internalOf(flow: ReactFlowInstance, id: string): InternalNode {
  const internal = flow.getInternalNode(id);
  if (internal === undefined) {
    throw new Error(`no node ${id}`);
  }
  return internal;
}

function ids(nodes: readonly { id: string }[]): string[] {
  return nodes.map(({ id }) => id);
}

describe("the nodes that an area meets, decided as React Flow decides it", () => {
  it("counts a node that lies inside the area when the overlap need not be partial", async () => {
    const flow = await instance();
    const area = { x: 90, y: 90, width: 400, height: 100 };
    expect(ids(flow.getIntersectingNodes(area, false))).toStrictEqual(["a", "b"]);
  });

  it("counts a node that holds the whole area, but not one that only meets it", async () => {
    const flow = await instance();
    expect(
      ids(flow.getIntersectingNodes({ x: 110, y: 105, width: 20, height: 10 }, false)),
    ).toStrictEqual(["a"]);
    expect(
      ids(flow.getIntersectingNodes({ x: 200, y: 90, width: 100, height: 30 }, false)),
    ).toStrictEqual([]);
  });

  it("counts any overlap when it may be partial", async () => {
    const flow = await instance();
    expect(
      ids(flow.getIntersectingNodes({ x: 200, y: 90, width: 100, height: 30 }, true)),
    ).toStrictEqual(["a"]);
  });

  it("leaves out the node it is asked about", async () => {
    const flow = await instance();
    const a = flow.getNode("a");
    expect(a).toBeDefined();
    expect(ids(flow.getIntersectingNodes({ id: "a" }, true))).toStrictEqual([]);
  });

  it("tells whether a node meets an area by the same rule", async () => {
    const flow = await instance();
    const inside = { x: 90, y: 90, width: 400, height: 100 };
    expect([
      flow.isNodeIntersecting({ id: "a" }, inside, false),
      flow.isNodeIntersecting({ id: "far" }, inside, true),
    ]).toStrictEqual([true, false]);
  });
});

describe("the nodes that a node handed over meets", () => {
  // As React Flow's getNodeRect: the node handed to onNodeDrag is where the drag has put it, though
  // the flow (an owner who has not taken the move yet) may not have it there.
  it("takes a node handed over whole where it says it is, and `{ id }` where the flow has it", async () => {
    const flow = await instance();
    const moved = { ...NODES[0], id: "a", position: { x: 300, y: 100 }, data: {} };
    expect([
      ids(flow.getIntersectingNodes(moved, true)),
      ids(flow.getIntersectingNodes({ id: "a" }, true)),
    ]).toStrictEqual([["b"], []]);
  });

  it("gives a node handed over without a size the size the flow knows it by", async () => {
    const flow = await instance();
    const bare = { id: "a", position: { x: 300, y: 100 }, data: {} };
    expect(ids(flow.getIntersectingNodes(bare, true))).toStrictEqual(["b"]);
  });

  it("takes an internal node where its positionAbsolute says it is", async () => {
    const flow = await instance();
    const internal = internalOf(flow, "a");
    const moved = {
      ...internal,
      internals: { ...internal.internals, positionAbsolute: { x: 300, y: 100 } },
    };
    expect(ids(flow.getIntersectingNodes(moved, true))).toStrictEqual(["b"]);
  });

  it("takes nodes handed over to look among where they say they are", async () => {
    const flow = await instance();
    const near = [{ ...NODES[2], id: "far", position: { x: 120, y: 110 }, data: {} }];
    expect(ids(flow.getIntersectingNodes({ id: "a" }, true, near))).toStrictEqual(["far"]);
  });
});
