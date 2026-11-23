import { describe, expect, it } from "vite-plus/test";

import type { Rect } from "./geometry.ts";
import { directionOf, resizeRect } from "./node-resize.ts";
import type { ControlPosition } from "./node-resize.ts";
import { allClose, canonical } from "./xyflow-oracle.ts";
import fixtures from "./xyflow-resize-fixtures.json" with { type: "json" };

// What React Flow's own `getDimensionsAfterResize` returned (see `generatedWith` in the fixture
// file) for every control, a few pointer moves, size limits, aspect ratio and an area to stay in.

const CONTROLS: ReadonlyMap<string, ControlPosition> = new Map(
  (
    [
      "top-left",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left",
    ] as const
  ).map((position) => [position, position]),
);

function controlOf(name: string): ControlPosition {
  const found = CONTROLS.get(name);
  if (found === undefined) {
    throw new TypeError(`unknown control ${name}`);
  }
  return found;
}

// The area an extent describes, as a box.
function areaOf(extent: readonly (readonly number[])[] | null): Rect | undefined {
  if (extent === null) {
    return undefined;
  }
  const [[left = 0, top = 0] = [], [right = 0, bottom = 0] = []] = extent;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function differences(): string[] {
  return fixtures.cases.flatMap(({ input, output }) => {
    const [originX = 0, originY = 0] = input.nodeOrigin;
    const area = areaOf(input.extent);
    const ours = resizeRect(input.start, {
      direction: directionOf(controlOf(input.control)),
      delta: input.delta,
      nodeOrigin: [originX, originY],
      constraints: {
        ...input.boundaries,
        keepAspectRatio: input.keepAspectRatio,
        ...(area === undefined ? {} : { area }),
      },
    });
    return allClose(
      [ours.x, ours.y, ours.width, ours.height],
      [output.x, output.y, output.width, output.height],
    )
      ? []
      : [canonical({ input, ours, expected: output })];
  });
}

describe("resizing, against React Flow", () => {
  it("gives the same box for every control, limit, aspect ratio and area", () => {
    expect(differences()).toStrictEqual([]);
  });
});
