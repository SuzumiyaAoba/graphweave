import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { ReactFlow } from "./react-flow.tsx";
import type { ReactFlowStore } from "./store-context.ts";
import { useStoreApi } from "./use-store.ts";

const stores: ReactFlowStore[] = [];

function Grab(): null {
  const store = useStoreApi();
  useLayoutEffect(() => {
    stores.push(store);
  }, [store]);
  return null;
}

function Flow(): ReactElement {
  return (
    <ReactFlow nodes={[]} edges={[]}>
      <Grab />
    </ReactFlow>
  );
}

describe("the size of the flow at the start of a gesture", () => {
  it("is measured again when the element changed size and nothing told the store yet", () => {
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    try {
      render(<Flow />);
      const [store] = stores;
      expect(store?.getState().width).toBe(800);
      width.mockReturnValue(500);
      height.mockReturnValue(400);
      act(() => {
        fireEvent.pointerDown(screen.getByTestId("rf__wrapper"), { button: 0, pointerId: 1 });
      });
      expect([store?.getState().width, store?.getState().height]).toStrictEqual([500, 400]);
    } finally {
      width.mockRestore();
      height.mockRestore();
      cleanup();
    }
  });
});
