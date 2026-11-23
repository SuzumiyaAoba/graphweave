import { describe, expect, it } from "vite-plus/test";

import { toolbarTransform } from "./toolbar-position.ts";

const BOX = { x: 100, y: 50, width: 80, height: 40 };
const VIEWPORT = { x: 10, y: 20, zoom: 2 };

function transform(
  position: "top" | "bottom" | "left" | "right",
  align: "start" | "center" | "end",
): string {
  return toolbarTransform(BOX, VIEWPORT, { position, offset: 10, align });
}

describe("toolbarTransform", () => {
  it("puts the toolbar outside the chosen side, centred, in screen pixels", () => {
    expect(transform("top", "center")).toBe("translate(290px, 110px) translate(-50%, -100%)");
    expect(transform("bottom", "center")).toBe("translate(290px, 210px) translate(-50%, 0%)");
    expect(transform("right", "center")).toBe("translate(380px, 160px) translate(0%, -50%)");
    expect(transform("left", "center")).toBe("translate(200px, 160px) translate(-100%, -50%)");
  });

  it("slides along the side for start and end alignment", () => {
    expect(transform("top", "start")).toBe("translate(210px, 110px) translate(0%, -100%)");
    expect(transform("top", "end")).toBe("translate(370px, 110px) translate(-100%, -100%)");
    expect(transform("left", "end")).toBe("translate(200px, 200px) translate(-100%, -100%)");
  });
});
