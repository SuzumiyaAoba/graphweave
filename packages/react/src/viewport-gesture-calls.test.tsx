import type { Viewport } from "@graphweave/core";
import { act, cleanup, render } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { ReactFlowStore } from "./store-context.ts";
import { flowSettled } from "./test-settle.ts";
import { useStoreApi } from "./use-store.ts";
import {
  addViewportGestureHandlers,
  beginViewportGesture,
  moveForGesture,
} from "./viewport-events.ts";

interface Held {
  instance: ReactFlowInstance | undefined;
  store: ReactFlowStore | undefined;
}

function Capture({ onStore }: { onStore: (store: ReactFlowStore) => void }): null {
  const store = useStoreApi();
  useLayoutEffect(() => {
    onStore(store);
  });
  return null;
}

async function show(props: ReactFlowProps): Promise<Held> {
  const held: Held = { instance: undefined, store: undefined };
  cleanup();
  act(() => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={[]}
        onInit={(instance) => {
          held.instance = instance;
        }}
        {...props}
      >
        <Capture
          onStore={(store) => {
            held.store = store;
          }}
        />
      </ReactFlow>,
    );
  });
  // The flow is told to be there once its effects have run, which is when `act` is left.
  await act(flowSettled);
  return held;
}

function storeOf(held: Held): ReactFlowStore {
  if (held.store === undefined) {
    throw new Error("the flow has not been shown");
  }
  return held.store;
}

describe("a viewport change that a call makes inside a gesture that is going on", () => {
  it("is one more onMove of that gesture, as a d3-zoom transform inside a gesture is", async () => {
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    const held = await show({ onMove });
    const gesture = beginViewportGesture(storeOf(held), null);
    onMove.mockClear();
    await act(async () => {
      await held.instance?.setViewport({ x: 20, y: 20, zoom: 1 });
    });
    gesture.end(null);
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0]?.[1]).toStrictEqual({ x: 20, y: 20, zoom: 1 });
  });
});

describe("a move of a pan or a pinch", () => {
  const extent: ReactFlowProps["translateExtent"] = [
    [0, 0],
    [1600, 600],
  ];

  it("is told to onViewportChange once when it moves the viewport", async () => {
    const onViewportChange = vi.fn<NonNullable<ReactFlowProps["onViewportChange"]>>();
    const held = await show({ translateExtent: extent, onViewportChange });
    act(() => {
      moveForGesture(storeOf(held), { x: -30, y: 0, zoom: 1 });
    });
    expect(onViewportChange).toHaveBeenCalledExactlyOnceWith({ x: -30, y: 0, zoom: 1 });
  });

  it("is told to onViewportChange too when a limit leaves the viewport where it was", async () => {
    const onViewportChange = vi.fn<NonNullable<ReactFlowProps["onViewportChange"]>>();
    const held = await show({ translateExtent: extent, onViewportChange });
    act(() => {
      moveForGesture(storeOf(held), { x: 50, y: 0, zoom: 1 });
    });
    expect(onViewportChange).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 0, zoom: 1 });
  });
});

describe("the hooks that listen to the viewport", () => {
  it("are told about every move of a gesture, also one that leaves the viewport where it was", async () => {
    const held = await show({});
    const onChange = vi.fn<(viewport: Viewport) => void>();
    const remove = addViewportGestureHandlers(storeOf(held), { onChange });
    const gesture = beginViewportGesture(storeOf(held), null);
    gesture.moved(null);
    gesture.moved(null);
    gesture.end(null);
    remove();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
