import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { calcAutoPan } from "./node-drag.ts";
import { getNodesInRect } from "./selection-box.ts";
import { makeNode } from "./test-fixtures.ts";
import type { NodeBase } from "./types.ts";
import { SelectionMode } from "./types.ts";
import fixtures from "./xyflow-fixtures.json" with { type: "json" };
import { allClose, canonical } from "./xyflow-oracle.ts";

// What the real @xyflow/react 12.12.1 returned (see `generatedWith` in the fixture file) for the
// pointer interactions whose numbers are easy to get slightly wrong.

function autoPanDifferences(): string[] {
  return fixtures.autoPan.flatMap(({ input, output }) => {
    const { x, y, width, height, speed } = input;
    const ours = calcAutoPan({ x, y }, { width, height }, speed);
    return allClose([ours.x, ours.y], output) ? [] : [canonical({ input, ours, expected: output })];
  });
}

describe("auto-pan, against React Flow", () => {
  it("calcAutoPan gives the same speed everywhere along the edges of the canvas", () => {
    expect(autoPanDifferences()).toStrictEqual([]);
  });
});

interface Spec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hidden?: boolean;
  selectable?: boolean;
}

function nodeOf(spec: Spec): NodeBase {
  return makeNode(spec.id, {
    position: { x: spec.x, y: spec.y },
    width: spec.width,
    height: spec.height,
    ...(spec.hidden === undefined ? {} : { hidden: spec.hidden }),
    ...(spec.selectable === undefined ? {} : { selectable: spec.selectable }),
  });
}

// The nodes a selection box picks up, from a flow in which every node has been measured.
function picked(
  box: { x: number; y: number; width: number; height: number },
  partially: boolean,
): string[] {
  const specs: Spec[] = fixtures.nodesInside.nodes;
  const store = createFlowStore({ nodes: specs.map((spec) => nodeOf(spec)) });
  store.getState().updateNodeDimensions(
    specs.map((spec) => ({
      id: spec.id,
      width: spec.width,
      height: spec.height,
      handleBounds: { source: [], target: [] },
    })),
  );
  return getNodesInRect(store.getState().nodeLookup.values(), box, {
    mode: partially ? SelectionMode.Partial : SelectionMode.Full,
    elementsSelectable: true,
  }).toSorted();
}

function selectionDifferences(): string[] {
  return fixtures.nodesInside.cases.flatMap(({ input, output }) => {
    const ours = picked(input.box, input.partially);
    return canonical(ours) === canonical(output.toSorted())
      ? []
      : [canonical({ input, ours, expected: output })];
  });
}

describe("box selection, against React Flow", () => {
  it("picks up the same nodes, partially or fully enclosed", () => {
    expect(selectionDifferences()).toStrictEqual([]);
  });
});
