import { describe, expect, it } from "vite-plus/test";

import type { Viewport } from "./camera.ts";
import type { Point, Size } from "./geometry.ts";
import { allClose, canonical } from "./xyflow-oracle.ts";
import fixtures from "./xyflow-zoompath-fixtures.json" with { type: "json" };
import { zoomPath } from "./zoom-path.ts";

// Every expectation is where d3-zoom's transition (the one React Flow animates the viewport with,
// see `generatedWith`) has the viewport at that point of a move.

interface PathCase {
  start: Viewport;
  target: Viewport;
  canvas: Size;
  pivot: Point | null;
  mode: string;
  t: number;
}

function differences(): string[] {
  return fixtures.cases.flatMap(({ input, output }) => {
    const { start, target, canvas, pivot, mode, t } = input satisfies PathCase;
    const ours = zoomPath({ start, target }, canvas, {
      interpolate: mode === "linear" ? "linear" : "smooth",
      pivot: pivot ?? undefined,
    })(t);
    return allClose([ours.x, ours.y, ours.zoom], [output.x, output.y, output.zoom])
      ? []
      : [canonical({ input, ours, expected: output })];
  });
}

describe("zoomPath, against d3-zoom", () => {
  it("has the viewport where d3 has it, on the smooth path and on the straight one", () => {
    expect(differences()).toStrictEqual([]);
  });

  it("covers both ways, with and without a pivot", () => {
    const modes = new Set(fixtures.cases.map(({ input }) => input.mode));
    expect([...modes].toSorted()).toStrictEqual(["linear", "smooth"]);
    expect(fixtures.cases.some(({ input }) => input.pivot !== null)).toBe(true);
  });

  it("ends exactly on the target", () => {
    const target = { x: 12, y: -7, zoom: 1.5 };
    const start = { x: 0, y: 0, zoom: 1 };
    const path = zoomPath({ start, target }, { width: 800, height: 600 });
    expect(path(1)).toStrictEqual(target);
  });
});
