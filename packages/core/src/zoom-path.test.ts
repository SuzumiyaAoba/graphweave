import { describe, expect, it } from "vite-plus/test";

import { zoomPath } from "./zoom-path.ts";

describe("zoomPath for a glide that goes nowhere", () => {
  it("stays exactly where it is, also on a canvas that has no size yet", () => {
    const view = { x: -360, y: -436, zoom: 2 };
    const along = zoomPath({ start: view, target: { ...view } }, { width: 0, height: 0 });
    expect([along(0), along(0.5), along(1)]).toStrictEqual([view, view, view]);
  });
});
