import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={[]} {...props} />);
    await Promise.resolve();
  });
}

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

// The WheelEvent of happy-dom does not read `ctrlKey` from its init, so the key is put on the event.
function wheel(init: { deltaY: number; ctrlKey?: boolean }): void {
  const pane = document.querySelector(".react-flow__pane");
  if (pane === null) {
    throw new Error("there is no pane");
  }
  const event = new WheelEvent("wheel", { deltaY: init.deltaY, bubbles: true, cancelable: true });
  Object.defineProperty(event, "ctrlKey", { value: init.ctrlKey ?? false });
  act(() => {
    pane.dispatchEvent(event);
  });
}

describe("the wheel over a flow that does not prevent scrolling", () => {
  it("leaves the viewport alone for a plain wheel, as the page keeps its scrolling", async () => {
    await show({ preventScrolling: false });
    const before = layerTransform();
    wheel({ deltaY: -100 });
    expect(layerTransform()).toBe(before);
  });

  it("still zooms for the wheel of a pinch (Ctrl)", async () => {
    await show({ preventScrolling: false });
    const before = layerTransform();
    wheel({ deltaY: -100, ctrlKey: true });
    expect(layerTransform()).not.toBe(before);
  });

  it("zooms for a plain wheel when scrolling is prevented, which is the default", async () => {
    await show({});
    const before = layerTransform();
    wheel({ deltaY: -100 });
    expect(layerTransform()).not.toBe(before);
  });
});
