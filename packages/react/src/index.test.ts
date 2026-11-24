import { rectsIntersect as fromCore } from "@graphweave/core";
import { describe, expect, it } from "vite-plus/test";

import { rectsIntersect as fromReact } from "./index.ts";

describe("@graphweave/react", () => {
  it("re-exports the core geometry API", () => {
    expect(fromReact).toBe(fromCore);
  });
});
