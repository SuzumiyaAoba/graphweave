import { describe, expect, it } from "vite-plus/test";

import { measureHandles } from "./measure.ts";

// A node whose layout width is `layoutWidth`, with a bottom handle 8 wide that starts 71 px from the
// node's left edge, drawn at `scale`. The layout size does not change with the scale; the boxes the
// browser reports do.
function nodeAt(scale: number, layoutWidth = 150, drawnWidth = 150 * scale): HTMLElement {
  const node = document.createElement("div");
  node.className = "react-flow__node";
  const handle = document.createElement("div");
  handle.className = "react-flow__handle source connectable connectablestart connectableend";
  handle.dataset["handlepos"] = "bottom";
  node.append(handle);
  Object.defineProperty(node, "offsetWidth", { value: layoutWidth });
  // The handle's own size is what the layout says, whatever the scale: 8 by 8.
  Object.defineProperty(handle, "offsetWidth", { value: 8 });
  Object.defineProperty(handle, "offsetHeight", { value: 8 });
  Object.defineProperty(node, "getBoundingClientRect", {
    value: () => new DOMRect(10, 20, drawnWidth, 40 * scale),
  });
  Object.defineProperty(handle, "getBoundingClientRect", {
    value: () => new DOMRect(10 + 71 * scale, 20 + 36 * scale, 8 * scale, 8 * scale),
  });
  return node;
}

describe("measureHandles", () => {
  it("gives handle boxes in flow units when the node is drawn at the zoom that is passed", () => {
    const [handle] = measureHandles(nodeAt(2), 2).source;
    expect(handle).toMatchObject({ x: 71, y: 36, width: 8, height: 8 });
  });

  it("uses the scale the node is drawn at, not a zoom that is ahead of the rendering", () => {
    const [handle] = measureHandles(nodeAt(1), 2).source;
    expect(handle).toMatchObject({ x: 71, y: 36, width: 8, height: 8 });
  });

  it("takes the exact zoom when the drawn scale only differs by the rounding of the layout width", () => {
    // 150.4 px wide at zoom 1.5 is 225.6 px on screen, and `offsetWidth` says 150.
    const [handle] = measureHandles(nodeAt(1.5, 150, 225.6), 1.5).source;
    expect(handle).toMatchObject({ x: 71, y: 36, width: 8, height: 8 });
  });

  it("falls back to the given zoom when the node has no size to compare against", () => {
    const [handle] = measureHandles(nodeAt(1, 0), 2).source;
    expect(handle).toMatchObject({ x: 35.5, width: 8 });
  });
});
