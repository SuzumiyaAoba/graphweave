import { describe, expect, it } from "vite-plus/test";

import { buildNodeLookups } from "./node-internals.ts";
import { calculateNodePosition } from "./node-position.ts";
import type { CoordinateExtent, NodeBase, NodeOrigin } from "./types.ts";
import fixtures from "./xyflow-node-position-fixtures.json" with { type: "json" };
import { wrongCases } from "./xyflow-oracle.ts";

// Every expectation is what the real @xyflow/system `calculateNodePosition` returned for the same
// node, parents, extents and node origin (see `generatedWith` in the fixtures).

// A node as the fixtures write it: its origin and extent are plain lists.
interface JsonNode extends Omit<NodeBase, "origin" | "extent"> {
  origin?: number[];
  extent?: string | number[][];
}

interface PositionCase {
  nodes: JsonNode[];
  nodeOrigin: number[];
  nodeExtent: number[][];
  next: number[];
}

function originOf(values: number[] | undefined): NodeOrigin {
  return [values?.[0] ?? 0, values?.[1] ?? 0];
}

function extentOf(rows: number[][]): CoordinateExtent {
  const [low, high] = rows;
  return [
    [low?.[0] ?? 0, low?.[1] ?? 0],
    [high?.[0] ?? 0, high?.[1] ?? 0],
  ];
}

function nodeOf({ origin, extent, ...node }: JsonNode): NodeBase {
  return {
    ...node,
    ...(origin === undefined ? {} : { origin: originOf(origin) }),
    ...(extent === undefined
      ? {}
      : { extent: typeof extent === "string" ? "parent" : extentOf(extent) }),
  };
}

function positionOf({ nodes, nodeOrigin, nodeExtent, next }: PositionCase): unknown {
  const origin = originOf(nodeOrigin);
  const { nodeLookup } = buildNodeLookups(
    nodes.map((node) => nodeOf(node)),
    new Map(),
    { nodeOrigin: origin, elevateNodesOnSelect: false, selectedNodeZ: 1000 },
  );
  const node = nodeLookup.get("c");
  if (node === undefined) {
    throw new Error("no node c");
  }
  return calculateNodePosition({
    node,
    nodeLookup,
    nextPosition: { x: next[0] ?? 0, y: next[1] ?? 0 },
    nodeOrigin: origin,
    nodeExtent: extentOf(nodeExtent),
  });
}

describe("calculateNodePosition, against React Flow", () => {
  it("gives the same position for every kind of extent, parent and origin", () => {
    expect(wrongCases<PositionCase>(fixtures.cases, positionOf)).toStrictEqual([]);
  });

  it("covers every kind", () => {
    const kinds = new Set(fixtures.cases.map(({ input }) => input.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(10);
  });
});
