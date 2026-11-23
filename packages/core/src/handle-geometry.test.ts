import { describe, expect, it } from "vite-plus/test";

import { createFlowStore } from "./flow-store.ts";
import { findHandle, getHandlePosition, handlesOf, oppositePosition } from "./handle-geometry.ts";
import { box, connectableFlow, handle, internalNodeOf } from "./test-handles.ts";

describe("getHandlePosition", () => {
  const node = internalNodeOf(connectableFlow(), "a");

  it("finds the attaching point on the handle's outer edge", () => {
    expect(getHandlePosition(node, handle("source"), { fallback: "right" })).toStrictEqual({
      x: 104,
      y: 25,
    });
    expect(getHandlePosition(node, handle("target"), { fallback: "left" })).toStrictEqual({
      x: -4,
      y: 25,
    });
  });

  it("finds the middle of the handle when asked for the centre", () => {
    expect(
      getHandlePosition(node, handle("source"), { fallback: "right", center: true }),
    ).toStrictEqual({ x: 100, y: 25 });
  });

  it("uses the side the handle faces, whatever the fallback says", () => {
    const top = handle("source", { position: "top", x: 46, y: -4 });
    expect(getHandlePosition(node, top, { fallback: "left" })).toStrictEqual({ x: 50, y: -4 });
  });

  it("falls back to the node's own box when no handle was measured", () => {
    const plain = internalNodeOf(createFlowStore({ nodes: [box("a", [10, 20])] }), "a");
    expect(getHandlePosition(plain, undefined, { fallback: "right" })).toStrictEqual({
      x: 110,
      y: 45,
    });
    expect(getHandlePosition(plain, undefined, { fallback: "top" })).toStrictEqual({
      x: 60,
      y: 20,
    });
    expect(getHandlePosition(plain, undefined, { fallback: "bottom" })).toStrictEqual({
      x: 60,
      y: 70,
    });
    expect(getHandlePosition(plain, undefined, { fallback: "left" })).toStrictEqual({
      x: 10,
      y: 45,
    });
  });
});

describe("handlesOf and findHandle", () => {
  const node = internalNodeOf(connectableFlow(), "a");
  const unmeasured = internalNodeOf(createFlowStore({ nodes: [box("a", [0, 0])] }), "a");

  it("lists the handles of one side or of both", () => {
    expect(handlesOf(node)).toHaveLength(2);
    expect(handlesOf(node, "source")).toHaveLength(1);
    expect(handlesOf(unmeasured)).toStrictEqual([]);
  });

  it("finds a handle by side and id", () => {
    expect(findHandle(node, "target", null)?.position).toBe("left");
    expect(findHandle(node, "target", "nope")).toBeUndefined();
  });
});

describe("oppositePosition", () => {
  it("returns the facing side", () => {
    expect(oppositePosition("top")).toBe("bottom");
    expect(oppositePosition("left")).toBe("right");
    expect(oppositePosition("right")).toBe("left");
    expect(oppositePosition("bottom")).toBe("top");
  });
});
