import { Position } from "@free-flow/core";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";

const NODE_A: Node = { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 };
const NODE_B: Node = { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 };
const NODES: Node[] = [NODE_A, NODE_B];

type Told = [code: string, message: string];

function told(onError: { mock: { calls: Told[] } }): Told[] {
  return onError.mock.calls;
}

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
    await Promise.resolve();
  });
}

describe("what onError is told, worded and numbered as React Flow does", () => {
  it("tells (009) of a marker type that does not exist, and draws nothing for it", async () => {
    const onError = vi.fn<(code: string, message: string) => void>();
    const edges: Edge[] = [
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a marker type that does not exist is the point
      { id: "e", source: "a", target: "b", markerEnd: { type: "nope" as never } },
    ];
    await show({ defaultEdges: edges, onError });
    expect(told(onError)).toContainEqual(["009", 'Marker type "nope" doesn\'t exist.']);
    expect(document.querySelectorAll(".react-flow__arrowhead")).toHaveLength(0);
  });

  it("tells (008) of an edge whose handle is not on its node", async () => {
    const onError = vi.fn<(code: string, message: string) => void>();
    // The handles are given on the nodes, since nothing is measured here.
    const nodes: Node[] = [
      {
        ...NODE_A,
        handles: [{ type: "source", position: Position.Right, x: 100, y: 20, width: 8, height: 8 }],
      },
      NODE_B,
    ];
    const edges: Edge[] = [{ id: "e", source: "a", target: "b", sourceHandle: "zzz" }];
    await show({ defaultNodes: nodes, defaultEdges: edges, onError });
    expect(told(onError)).toContainEqual([
      "008",
      'Couldn\'t create edge for source handle id: "zzz", edge id: e.',
    ]);
  });

  it("tells (003) and (011) of a node type and an edge type nobody registered", async () => {
    const onError = vi.fn<(code: string, message: string) => void>();
    const nodes: Node[] = [{ ...NODE_A, type: "nope" }, NODE_B];
    const edges: Edge[] = [{ id: "e", source: "a", target: "b", type: "nada" }];
    await show({ defaultNodes: nodes, defaultEdges: edges, onError });
    expect(told(onError)).toContainEqual([
      "003",
      'Node type "nope" not found. Using fallback type "default".',
    ]);
    expect(told(onError)).toContainEqual([
      "011",
      'Edge type "nada" not found. Using fallback type "default".',
    ]);
  });
});

function Box(): ReactElement {
  return <span>box</span>;
}

describe("the warning about nodeTypes that are made again (002), given in development", () => {
  it("is given when the nodeTypes object changes its entries between renders", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const onError = vi.fn<(code: string, message: string) => void>();
      await show({ nodeTypes: { box: Box }, onError });
      expect(told(onError).filter(([code]) => code === "002")).toHaveLength(0);
      cleanup();
      const { rerender } = render(
        <ReactFlow
          width={800}
          height={600}
          defaultNodes={NODES}
          nodeTypes={{ box: Box }}
          onError={onError}
        />,
      );
      rerender(
        <ReactFlow
          width={800}
          height={600}
          defaultNodes={NODES}
          nodeTypes={{ box: () => <span>other</span> }}
          onError={onError}
        />,
      );
      expect(told(onError).map(([code]) => code)).toContain("002");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("is not given outside development", async () => {
    const onError = vi.fn<(code: string, message: string) => void>();
    await show({ nodeTypes: { box: Box }, onError });
    expect(told(onError).filter(([code]) => code === "002")).toHaveLength(0);
  });
});
