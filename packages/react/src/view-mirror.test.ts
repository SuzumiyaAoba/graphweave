import { createFlowStore } from "@graphweave/core";
import { describe, expect, it } from "vite-plus/test";

import { MIRROR_KEYS } from "./view-mirror.ts";

describe("the keys of the mirror", () => {
  it("are none that the flow's own state has, since a key is written to one store only", () => {
    const ownKeys = Object.keys(createFlowStore().getState());
    const own = new Set(ownKeys);
    const shared = [...MIRROR_KEYS].filter((key) => own.has(key));
    expect(shared).toStrictEqual([]);
  });
});
