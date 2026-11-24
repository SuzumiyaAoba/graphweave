import { describe, expect, it } from "vite-plus/test";

import { applyEdgeChanges, applyNodeChanges } from "./changes.ts";
import { getBezierPath, getSimpleBezierPath, getStraightPath } from "./edge-paths.ts";
import { addEdge, getConnectedEdges, getIncomers, getOutgoers, reconnectEdge } from "./graph.ts";
import type { ReconnectEdgeOptions } from "./graph.ts";
import { getNodesBounds } from "./nodes-bounds.ts";
import { getSmoothStepPath } from "./smooth-step.ts";
import type {
  Connection,
  EdgeBase,
  EdgeChange,
  NodeBase,
  NodeChange,
  NodeOrigin,
  Padding,
} from "./types.ts";
import { getViewportForBounds } from "./viewport.ts";
import fixtures from "./xyflow-fixtures.json" with { type: "json" };
import {
  allClose,
  canonical,
  endsOf,
  facingOf,
  pathDifferences,
  wrongCases,
} from "./xyflow-oracle.ts";

// Every expectation below is what the real @xyflow/react 12.12.1 returned for the same input (see
// `generatedWith` in the fixture file), so these tests say where GraphWeave differs from React Flow.

describe("edge paths, against React Flow", () => {
  it("getBezierPath gives the same path and label position", () => {
    expect(
      pathDifferences(fixtures.paths.bezier, (input) =>
        getBezierPath({ ...endsOf(input), ...facingOf(input), curvature: input.curvature }),
      ),
    ).toStrictEqual([]);
  });

  it("getSmoothStepPath gives the same path and label position", () => {
    expect(
      pathDifferences(fixtures.paths.smoothstep, (input) =>
        getSmoothStepPath({
          ...endsOf(input),
          ...facingOf(input),
          borderRadius: input.borderRadius,
          centerX: input.centerX,
          centerY: input.centerY,
          offset: input.offset,
          stepPosition: input.stepPosition,
        }),
      ),
    ).toStrictEqual([]);
  });

  it("getSimpleBezierPath gives the same path and label position", () => {
    expect(
      pathDifferences(fixtures.paths.simplebezier, (input) =>
        getSimpleBezierPath({ ...endsOf(input), ...facingOf(input) }),
      ),
    ).toStrictEqual([]);
  });

  it("getStraightPath gives the same path and label position", () => {
    expect(
      pathDifferences(fixtures.paths.straight, (input) => getStraightPath(endsOf(input))),
    ).toStrictEqual([]);
  });
});

function originOf(options: object): { nodeOrigin?: NodeOrigin } {
  return "nodeOrigin" in options ? { nodeOrigin: [0.5, 0.5] } : {};
}

// The padding in a fixture is plain JSON: a number, a string or an object of those.
function paddingOf(value: unknown): Padding {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- made from valid paddings
  return value as Padding;
}

function viewportDifferences(): string[] {
  return fixtures.viewportForBounds.flatMap(({ input, output }) => {
    const { bounds, width, height, minZoom, maxZoom, padding } = input;
    const ours = getViewportForBounds(bounds, width, height, minZoom, maxZoom, paddingOf(padding));
    return allClose([ours.x, ours.y, ours.zoom], [output.x, output.y, output.zoom])
      ? []
      : [canonical({ input, ours, expected: output })];
  });
}

interface BoundsInput {
  nodes: NodeBase[];
  options: object;
}

interface ReconnectInput {
  oldEdge: EdgeBase;
  connection: Connection;
  options: ReconnectEdgeOptions;
}

describe("geometry, against React Flow", () => {
  it("getNodesBounds gives the same rectangle", () => {
    expect(
      wrongCases<BoundsInput>(fixtures.nodesBounds, ({ nodes, options }) =>
        getNodesBounds(nodes, originOf(options)),
      ),
    ).toStrictEqual([]);
  });

  it("getViewportForBounds gives the same viewport, whatever the padding is given as", () => {
    expect(viewportDifferences()).toStrictEqual([]);
  });
});

function nodeChangesOf(value: unknown): NodeChange[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fixture was made from valid changes
  return structuredClone(value) as NodeChange[];
}

function edgeChangesOf(value: unknown): EdgeChange[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fixture was made from valid changes
  return structuredClone(value) as EdgeChange[];
}

function idsOf(list: readonly { id: string }[]): string[] {
  return list.map((item) => item.id);
}

describe("graph helpers, against React Flow", () => {
  const { graph } = fixtures;
  const nodes: NodeBase[] = graph.nodes;
  const edges: EdgeBase[] = graph.edges;

  it("getIncomers and getOutgoers name the same nodes", () => {
    const incomers = nodes.map((item) => ({
      id: item.id,
      ids: idsOf(getIncomers(item, nodes, edges)),
    }));
    const outgoers = nodes.map((item) => ({
      id: item.id,
      ids: idsOf(getOutgoers(item, nodes, edges)),
    }));
    expect(canonical(incomers)).toBe(canonical(graph.incomers));
    expect(canonical(outgoers)).toBe(canonical(graph.outgoers));
  });

  it("getConnectedEdges names the same edges", () => {
    const ours = graph.connected.map((item) => ({
      ids: item.ids,
      edges: idsOf(
        getConnectedEdges(
          nodes.filter((candidate) => item.ids.includes(candidate.id)),
          edges,
        ),
      ),
    }));
    expect(canonical(ours)).toBe(canonical(graph.connected));
  });

  it("addEdge makes the same edges, ids included", () => {
    const fromConnection = wrongCases(
      graph.addEdge.map(({ connection, output }) => ({ input: connection, output })),
      (connection) => addEdge(connection, edges),
    );
    const fromEdge = wrongCases(
      graph.addEdgeFromEdge.map(({ edge, output }) => ({ input: edge, output })),
      (edge) => addEdge(edge, edges),
    );
    expect([...fromConnection, ...fromEdge]).toStrictEqual([]);
  });

  it("reconnectEdge moves the edge the same way", () => {
    const wrong = wrongCases<ReconnectInput>(graph.reconnect, ({ oldEdge, connection, options }) =>
      reconnectEdge(oldEdge, connection, edges, options),
    );
    expect(wrong).toStrictEqual([]);
  });
});

describe("change appliers, against React Flow", () => {
  it("applyNodeChanges gives the same nodes", () => {
    const base: NodeBase[] = fixtures.nodeChanges.nodes;
    expect(
      wrongCases<unknown>(fixtures.nodeChanges.cases, (input) =>
        applyNodeChanges(nodeChangesOf(input), base),
      ),
    ).toStrictEqual([]);
  });

  it("applyEdgeChanges gives the same edges", () => {
    const base: EdgeBase[] = fixtures.edgeChanges.edges;
    expect(
      wrongCases<unknown>(fixtures.edgeChanges.cases, (input) =>
        applyEdgeChanges(edgeChangesOf(input), base),
      ),
    ).toStrictEqual([]);
  });
});
