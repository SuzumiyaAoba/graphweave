import { describe, expect, it } from "vite-plus/test";

import { buildNodeLookups } from "./node-internals.ts";
import type { NodeBase, ZIndexMode } from "./types.ts";
import { wrongCases } from "./xyflow-oracle.ts";
import fixtures from "./xyflow-zindex-fixtures.json" with { type: "json" };

// Every expectation is the z that the real @xyflow/system `adoptUserNodes` gave a node of the same
// tree, selection, `zIndexMode` and `elevateNodesOnSelect` (see `generatedWith` in the fixtures).

function modeOf(value: string): ZIndexMode {
  return value === "auto" || value === "manual" ? value : "basic";
}

interface ZCase {
  nodes: NodeBase[];
  zIndexMode: string;
  elevateNodesOnSelect: boolean;
}

function zOf({ nodes, zIndexMode, elevateNodesOnSelect }: ZCase): Record<string, number> {
  const { nodeLookup } = buildNodeLookups(nodes, new Map(), {
    nodeOrigin: [0, 0],
    elevateNodesOnSelect,
    selectedNodeZ: 1000,
    zIndexMode: modeOf(zIndexMode),
  });
  return Object.fromEntries([...nodeLookup].map(([id, internal]) => [id, internal.internals.z]));
}

describe("zIndexMode, against React Flow", () => {
  it("gives every node the same z in all three modes", () => {
    expect(wrongCases<ZCase>(fixtures.cases, zOf)).toStrictEqual([]);
  });

  it("covers the modes, with and without lifting the selected", () => {
    const modes = new Set(fixtures.cases.map(({ input }) => input.zIndexMode));
    expect([...modes].toSorted()).toStrictEqual(["auto", "basic", "manual"]);
    expect(fixtures.cases.length).toBeGreaterThan(100);
  });
});
