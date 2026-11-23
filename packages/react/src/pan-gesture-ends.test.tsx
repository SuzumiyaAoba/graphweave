import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";

const WINDOW = globalThis.window;

interface Shown {
  pane: HTMLElement;
  unmount: () => void;
  instance: () => ReactFlowInstance | undefined;
}

async function show(props: ReactFlowProps): Promise<Shown> {
  let instance: ReactFlowInstance | undefined = undefined;
  cleanup();
  const { unmount } = render(
    <ReactFlow
      width={800}
      height={600}
      defaultNodes={[{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }]}
      onInit={(given) => {
        instance = given;
      }}
      {...props}
    />,
  );
  await act(async () => {
    await flowSettled();
  });
  const pane = document.querySelector<HTMLElement>(".react-flow__pane");
  if (pane === null) {
    throw new Error("there is no pane");
  }
  return { pane, unmount, instance: () => instance };
}

function transform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

describe("a drag on the pane with Control held", () => {
  it("does not pan, as d3-zoom's filter in React Flow refuses it", async () => {
    const { pane } = await show({});
    const before = transform();
    act(() => {
      fireEvent.pointerDown(pane, { button: 0, ctrlKey: true, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { ctrlKey: true, clientX: 60, clientY: 10 });
      fireEvent.pointerUp(WINDOW, { clientX: 60, clientY: 10 });
    });
    expect(transform()).toBe(before);
  });

  it("pans when Control is the pan activation key, which is held", async () => {
    const { pane } = await show({ panOnDrag: false, panActivationKeyCode: "Control" });
    const before = transform();
    act(() => {
      fireEvent.keyDown(WINDOW, { key: "Control", code: "ControlLeft", ctrlKey: true });
    });
    act(() => {
      fireEvent.pointerDown(pane, { button: 0, ctrlKey: true, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { ctrlKey: true, clientX: 60, clientY: 10 });
      fireEvent.pointerUp(WINDOW, { clientX: 60, clientY: 10 });
    });
    expect(transform()).not.toBe(before);
  });
});

describe("a pan with the mouse that the flow is unmounted in the middle of", () => {
  it("is ended once, and follows the pointer no more", async () => {
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    const onMoveEnd = vi.fn<NonNullable<ReactFlowProps["onMoveEnd"]>>();
    const { pane, unmount } = await show({ onMove, onMoveEnd });
    act(() => {
      fireEvent.pointerDown(pane, { button: 0, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { clientX: 60, clientY: 10 });
    });
    onMove.mockClear();
    onMoveEnd.mockClear();
    act(() => {
      unmount();
    });
    act(() => {
      fireEvent.pointerMove(WINDOW, { clientX: 90, clientY: 10 });
      fireEvent.pointerUp(WINDOW, { clientX: 90, clientY: 10 });
    });
    await act(async () => {
      // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    });
    expect(onMove).not.toHaveBeenCalled();
    // As in React Flow, whose pan-zoom goes away with the pane, the end is not told.
    expect(onMoveEnd).not.toHaveBeenCalled();
  });
});

describe("a pan with the mouse during which another button is pressed and let go", () => {
  it("begins anew with the press and ends when any button is let go, as with d3-zoom", async () => {
    const onMoveStart = vi.fn<NonNullable<ReactFlowProps["onMoveStart"]>>();
    const { pane } = await show({ onMoveStart });
    act(() => {
      fireEvent.pointerDown(pane, { button: 0, buttons: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { buttons: 1, clientX: 40, clientY: 10 });
      // The middle button is pressed, then let go: both come as moves of the pointer.
      fireEvent.pointerMove(WINDOW, { buttons: 5, clientX: 40, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { buttons: 5, clientX: 70, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { buttons: 1, clientX: 70, clientY: 10 });
      fireEvent.pointerMove(WINDOW, { buttons: 1, clientX: 100, clientY: 10 });
      fireEvent.pointerUp(WINDOW, { clientX: 100, clientY: 10 });
    });
    expect(onMoveStart).toHaveBeenCalledTimes(2);
    expect(transform()).toContain("translate(60px,0px)");
  });
});

describe("a glide of the viewport that a listener of its moves interrupts", () => {
  it("leaves the viewport where the listener put it", async () => {
    const taken = { x: 7, y: 7, zoom: 1 };
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    const shown = await show({ onMove });
    onMove.mockClear();
    const calls: unknown[] = [];
    onMove.mockImplementationOnce(() => {
      calls.push(shown.instance()?.setViewport(taken));
    });
    await act(async () => {
      await shown.instance()?.fitView({ duration: 60 });
      // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });
      await Promise.all(calls);
    });
    expect(shown.instance()?.getViewport()).toStrictEqual(taken);
  });
});
