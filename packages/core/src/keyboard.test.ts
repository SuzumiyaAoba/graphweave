import { describe, expect, it } from "vite-plus/test";

import {
  arrowDelta,
  eventMatchesKey,
  isKeyCodePressed,
  nudgeNodes,
  parseKeyCode,
} from "./keyboard.ts";
import type { DragConfig } from "./node-drag.ts";
import { buildNodeLookups } from "./node-internals.ts";
import { makeNode } from "./test-fixtures.ts";

const PLAIN = { shift: false, snapToGrid: false, snapGrid: [15, 20] } as const;

describe("parseKeyCode", () => {
  it("splits combinations and keeps alternatives apart", () => {
    expect(parseKeyCode("Delete")).toStrictEqual([["Delete"]]);
    expect(parseKeyCode("Meta+k")).toStrictEqual([["Meta", "k"]]);
    expect(parseKeyCode(["Backspace", "Delete"])).toStrictEqual([["Backspace"], ["Delete"]]);
    expect(parseKeyCode(["Shift+Alt+q", "Control+b"])).toStrictEqual([
      ["Shift", "Alt", "q"],
      ["Control", "b"],
    ]);
  });

  it("treats a lone plus as the plus key", () => {
    expect(parseKeyCode("+")).toStrictEqual([["+"]]);
  });
});

describe("eventMatchesKey", () => {
  it("matches by code or by key, ignoring case", () => {
    expect(eventMatchesKey({ key: "a", code: "KeyA" }, "KeyA")).toBe(true);
    expect(eventMatchesKey({ key: "A", code: "KeyA" }, "a")).toBe(true);
    expect(eventMatchesKey({ key: "Backspace", code: "Backspace" }, "Backspace")).toBe(true);
    expect(eventMatchesKey({ key: "b", code: "KeyB" }, "a")).toBe(false);
  });
});

describe("isKeyCodePressed", () => {
  const combos = parseKeyCode(["Meta+k", "Escape"]);

  it("needs every key of some alternative to be down", () => {
    expect(isKeyCodePressed(combos, new Set(["Meta", "k"]))).toBe(true);
    expect(isKeyCodePressed(combos, new Set(["Escape"]))).toBe(true);
    expect(isKeyCodePressed(combos, new Set(["Meta"]))).toBe(false);
    expect(isKeyCodePressed(combos, new Set())).toBe(false);
  });

  it("compares keys without regard to case", () => {
    expect(isKeyCodePressed(combos, new Set(["meta", "K"]))).toBe(true);
  });
});

describe("arrowDelta", () => {
  it("moves five units, or twenty with shift", () => {
    expect(arrowDelta("ArrowRight", PLAIN)).toStrictEqual({ x: 5, y: 0 });
    expect(arrowDelta("ArrowUp", PLAIN)).toStrictEqual({ x: 0, y: -5 });
    expect(arrowDelta("ArrowLeft", { ...PLAIN, shift: true })).toStrictEqual({ x: -20, y: 0 });
    expect(arrowDelta("ArrowDown", { ...PLAIN, shift: true })).toStrictEqual({ x: 0, y: 20 });
  });

  it("moves one grid cell when snapping, per axis", () => {
    const snapping = { ...PLAIN, snapToGrid: true };
    expect(arrowDelta("ArrowRight", snapping)).toStrictEqual({ x: 15, y: 0 });
    expect(arrowDelta("ArrowDown", snapping)).toStrictEqual({ x: 0, y: 20 });
  });

  it("moves four grid cells with shift when snapping", () => {
    const snapping = { ...PLAIN, snapToGrid: true, shift: true };
    expect(arrowDelta("ArrowRight", snapping)).toStrictEqual({ x: 60, y: 0 });
    expect(arrowDelta("ArrowDown", snapping)).toStrictEqual({ x: 0, y: 80 });
  });

  it("ignores keys that are not arrows, including inherited property names", () => {
    expect(arrowDelta("a", PLAIN)).toBeUndefined();
    expect(arrowDelta("toString", PLAIN)).toBeUndefined();
  });
});

describe("nudgeNodes", () => {
  const config: DragConfig = {
    snapToGrid: false,
    snapGrid: [10, 10],
    nodeExtent: [
      [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
      [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    ],
    threshold: 25,
    zoom: 1,
    nodeOrigin: [0, 0],
  };
  const lookup = buildNodeLookups(
    [makeNode("a", { position: { x: 10, y: 10 } }), makeNode("b", { draggable: false })],
    new Map(),
    { nodeOrigin: [0, 0], elevateNodesOnSelect: false, selectedNodeZ: 0 },
  ).nodeLookup;

  it("moves the draggable nodes as one finished step, ignoring the drag threshold", () => {
    expect(
      nudgeNodes(lookup, ["a", "b"], { delta: { x: 5, y: 0 }, config, nodesDraggable: true }),
    ).toStrictEqual([
      {
        id: "a",
        type: "position",
        position: { x: 15, y: 10 },
        positionAbsolute: { x: 15, y: 10 },
        dragging: false,
      },
    ]);
  });

  it("moves nothing when nodes are not draggable", () => {
    expect(
      nudgeNodes(lookup, ["a"], { delta: { x: 5, y: 0 }, config, nodesDraggable: false }),
    ).toStrictEqual([]);
  });
});
