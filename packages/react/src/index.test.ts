import { rectsIntersect as fromCore } from "@free-flow/core";
import { describe, expect, it } from "vite-plus/test";

import { rectsIntersect as fromReact } from "./index.ts";

describe("@free-flow/react", () => {
  it("re-exports the core geometry API", () => {
    expect(fromReact).toBe(fromCore);
  });
});
