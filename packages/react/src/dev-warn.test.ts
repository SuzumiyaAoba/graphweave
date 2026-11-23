import { describe, expect, it, vi } from "vite-plus/test";

import { warnInDevelopment } from "./dev-warn.ts";
import { noop } from "./noop.ts";
import { viewPropsFrom } from "./view-props.ts";

describe("the default onError", () => {
  it("is there when no onError is given, and a given one wins", () => {
    const given = vi.fn<(id: string, message: string) => void>();
    expect(viewPropsFrom({}).onError).toBe(warnInDevelopment);
    expect(viewPropsFrom({ onError: given }).onError).toBe(given);
  });

  it("warns only in a development build", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(noop);
    try {
      vi.stubEnv("NODE_ENV", "production");
      warnInDevelopment("004", "no size");
      expect(warn).not.toHaveBeenCalled();
      vi.stubEnv("NODE_ENV", "development");
      warnInDevelopment("004", "no size");
      expect(warn).toHaveBeenCalledWith("[Free-Flow]: no size (error 004)");
    } finally {
      vi.unstubAllEnvs();
      warn.mockRestore();
    }
  });
});
