import { describe, expect, it } from "vite-plus/test";

import { handleExpandParent } from "./expand-parent.ts";
import type { ExpandingChild } from "./expand-parent.ts";
import { buildNodeLookups } from "./node-internals.ts";
import type { NodeBase, NodeOrigin } from "./types.ts";
import fixtures from "./xyflow-expand-parent-fixtures.json" with { type: "json" };
import { wrongCases } from "./xyflow-oracle.ts";

// Every expectation is what the real @xyflow/system `handleExpandParent` returned for the same
// parent, children and node origin (see `generatedWith` in the fixtures).

// A node as the fixtures write it: its origin is a plain list.
interface JsonNode extends Omit<NodeBase, "origin"> {
  origin?: number[];
}

interface ExpandCase {
  nodes: JsonNode[];
  children: ExpandingChild[];
  nodeOrigin: number[];
}

function originOf(values: number[] | undefined): NodeOrigin {
  return [values?.[0] ?? 0, values?.[1] ?? 0];
}

function nodeOf({ origin, ...node }: JsonNode): NodeBase {
  return origin === undefined ? node : { ...node, origin: originOf(origin) };
}

function changesOf({ nodes, children, nodeOrigin }: ExpandCase): unknown {
  const origin = originOf(nodeOrigin);
  const lookups = buildNodeLookups(
    nodes.map((node) => nodeOf(node)),
    new Map(),
    {
      nodeOrigin: origin,
      elevateNodesOnSelect: false,
      selectedNodeZ: 1000,
    },
  );
  return handleExpandParent(children, lookups, origin);
}

describe("handleExpandParent, against React Flow", () => {
  it("gives the same changes for every parent, child and node origin", () => {
    expect(wrongCases<ExpandCase>(fixtures.cases, changesOf)).toStrictEqual([]);
  });

  it("covers changes of parents and of children", () => {
    const kinds = new Set(fixtures.cases.flatMap(({ output }) => output.map(({ type }) => type)));
    expect([...kinds].toSorted()).toStrictEqual(["dimensions", "position"]);
    expect(fixtures.cases.length).toBeGreaterThan(150);
  });
});
