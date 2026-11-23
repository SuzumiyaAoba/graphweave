import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import { panAllowedFor } from "./pane-rules.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";

const WINDOW = globalThis.window;

async function flow(props: ReactFlowProps): Promise<HTMLElement> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={[]} {...props} />);
    await Promise.resolve();
  });
  const pane = document.querySelector<HTMLElement>(".react-flow__pane");
  if (pane === null) {
    throw new Error("there is no pane");
  }
  return pane;
}

function layer(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

function rightClick(pane: HTMLElement): void {
  act(() => {
    fireEvent.pointerDown(pane, { button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(WINDOW, { button: 2, clientX: 10, clientY: 10 });
  });
}

function rightDrag(pane: HTMLElement): void {
  act(() => {
    fireEvent.pointerDown(pane, { button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(WINDOW, { clientX: 70, clientY: 40 });
    fireEvent.pointerUp(WINDOW, { button: 2, clientX: 70, clientY: 40 });
  });
}

describe("which buttons pan", () => {
  it("are the left and the middle one for panOnDrag true, as in React Flow", () => {
    expect(panAllowedFor(0, true)).toBe(true);
    expect(panAllowedFor(1, true)).toBe(true);
    expect(panAllowedFor(2, true)).toBe(false);
  });

  it("are the listed ones for panOnDrag given as buttons", () => {
    expect(panAllowedFor(2, [2])).toBe(true);
    expect(panAllowedFor(0, [2])).toBe(false);
    expect(panAllowedFor(0, false)).toBe(false);
  });
});

describe("a drag with the right button", () => {
  it("does not pan the canvas by default", async () => {
    const pane = await flow({});
    const before = layer();
    rightDrag(pane);
    expect(layer()).toBe(before);
  });

  it("pans it when panOnDrag lists the right button", async () => {
    const pane = await flow({ panOnDrag: [2] });
    const before = layer();
    rightDrag(pane);
    expect(layer()).not.toBe(before);
  });
});

describe("onPaneContextMenu with the right button listed in panOnDrag", () => {
  it("is called for a right press that ends without the pointer having moved", async () => {
    const onPaneContextMenu = vi.fn<NonNullable<ReactFlowProps["onPaneContextMenu"]>>();
    const pane = await flow({ panOnDrag: [2], onPaneContextMenu });
    rightClick(pane);
    expect(onPaneContextMenu).toHaveBeenCalledOnce();
  });

  it("is not called when the right press panned the canvas", async () => {
    const onPaneContextMenu = vi.fn<NonNullable<ReactFlowProps["onPaneContextMenu"]>>();
    const pane = await flow({ panOnDrag: [2], onPaneContextMenu });
    rightDrag(pane);
    expect(onPaneContextMenu).not.toHaveBeenCalled();
  });
});
