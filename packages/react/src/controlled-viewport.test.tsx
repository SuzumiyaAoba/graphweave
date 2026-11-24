import type { Viewport } from "@graphweave/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { Controls } from "./controls.tsx";
import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlowProvider } from "./react-flow-provider.tsx";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";
import { useOnViewportChange } from "./use-events.ts";
import { useViewport } from "./use-graph-hooks.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

const HELD: Viewport = { x: 0, y: 0, zoom: 1 };

async function show(props: ReactFlowProps, children?: ReactElement): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} {...props}>
        {children}
      </ReactFlow>,
    );
    await flowSettled();
  });
  await act(flowSettled);
}

function query(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

function zoomsOf(mock: { mock: { calls: [Viewport][] } }): number[] {
  return mock.mock.calls.map(([viewport]) => viewport.zoom);
}

interface Holder {
  instance: ReactFlowInstance | undefined;
}

// An owner that does what a controlled flow is meant to: it keeps the viewport it is told about.
function FollowingOwner({ onInit }: { onInit: ReactFlowProps["onInit"] }): ReactElement {
  const [viewport, setViewport] = useState<Viewport>(HELD);
  return (
    <ReactFlow
      width={800}
      height={600}
      defaultNodes={NODES}
      viewport={viewport}
      onViewportChange={setViewport}
      onInit={onInit}
    />
  );
}

// An owner that hands the flow its own viewport back, as `useViewport` reads it.
function EchoingOwner({ onRender }: { onRender: () => void }): ReactElement {
  const viewport = useViewport();
  useLayoutEffect(onRender);
  return <ReactFlow width={800} height={600} defaultNodes={NODES} viewport={viewport} />;
}

const GRID = 50;

// The WheelEvent of happy-dom does not read the pointer position from its init, so it is put on the
// event: the canvas is zoomed about the top left corner.
function wheelUpAtOrigin(): void {
  const event = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: 0 });
  Object.defineProperty(event, "clientY", { value: 0 });
  act(() => {
    query(".react-flow__pane").dispatchEvent(event);
  });
}

// An owner that keeps the viewport it is told about, rounded to a multiple of GRID.
function SnappingOwner({
  onMove,
}: {
  onMove: NonNullable<ReactFlowProps["onMove"]>;
}): ReactElement {
  const [viewport, setViewport] = useState<Viewport>({ x: 30, y: 30, zoom: 1 });
  return (
    <ReactFlow
      width={800}
      height={600}
      defaultNodes={NODES}
      viewport={viewport}
      onViewportChange={(next) => {
        setViewport({
          x: Math.round(next.x / GRID) * GRID,
          y: Math.round(next.y / GRID) * GRID,
          zoom: next.zoom,
        });
      }}
      onMove={onMove}
    />
  );
}

async function animateFit(holder: Holder): Promise<void> {
  await act(async () => {
    await holder.instance?.fitView({ duration: 60 });
  });
}

describe("a viewport the owner holds", () => {
  it("goes on from the last move when the owner has not handed the viewport back", async () => {
    const onViewportChange = vi.fn<NonNullable<ReactFlowProps["onViewportChange"]>>();
    await show({ viewport: HELD, onViewportChange });
    const pane = query(".react-flow__pane");
    act(() => {
      fireEvent.wheel(pane, { deltaY: -100 });
      fireEvent.wheel(pane, { deltaY: -100 });
    });
    const [first = 0, second = 0, ...others] = zoomsOf(onViewportChange);
    expect(others).toHaveLength(0);
    expect(second).toBeGreaterThan(first);
    expect(first).toBeGreaterThan(1);
    expect(layerTransform()).toContain("scale(1)");
  });

  it("lets useOnViewportChange hear the user's moves, which the owner has not applied", async () => {
    const onChange = vi.fn<(viewport: Viewport) => void>();
    function Watch(): null {
      useOnViewportChange({ onChange });
      return null;
    }
    await show(
      { viewport: HELD },
      <>
        <Controls />
        <Watch />
      </>,
    );
    // A change made by a call is told to the hooks together with `onMove`, in a microtask.
    await act(async () => {
      fireEvent.click(query(".react-flow__controls-zoomin"));
      await flowSettled();
    });
    expect(zoomsOf(onChange)).toStrictEqual([expect.closeTo(1.2)]);
  });

  it("ends an animated change at its target when the owner follows the viewport", async () => {
    const holder: Holder = { instance: undefined };
    cleanup();
    await act(async () => {
      render(
        <FollowingOwner
          onInit={(instance) => {
            holder.instance = instance;
          }}
        />,
      );
      await flowSettled();
    });
    await act(flowSettled);
    await animateFit(holder);
    // The two nodes fit the canvas at the largest zoom, 2.
    expect(layerTransform()).toContain("scale(2)");
  });

  it("is not told about the viewport to start from, which the owner's own replaces", async () => {
    const onViewportChange = vi.fn<NonNullable<ReactFlowProps["onViewportChange"]>>();
    await show({
      viewport: HELD,
      defaultViewport: { x: 5, y: 5, zoom: 2 },
      onViewportChange,
    });
    expect(onViewportChange).not.toHaveBeenCalled();
    expect(layerTransform()).toContain("scale(1)");
  });

  it("settles when the owner hands back the viewport that useViewport reads", async () => {
    const onRender = vi.fn<() => void>();
    cleanup();
    await act(async () => {
      render(
        <ReactFlowProvider>
          <EchoingOwner onRender={onRender} />
        </ReactFlowProvider>,
      );
      await flowSettled();
    });
    await act(flowSettled);
    // A flow that told its listeners about the same viewport again and again would render forever.
    expect(onRender.mock.calls.length).toBeLessThan(10);
  });

  it("tells nothing when the owner lets go of the viewport while a move waits for its answer", async () => {
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    const holder: Holder = { instance: undefined };
    const flow = (props: ReactFlowProps): ReactElement => (
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={NODES}
        onInit={(instance) => {
          holder.instance = instance;
        }}
        onMove={onMove}
        {...props}
      />
    );
    cleanup();
    const { rerender } = render(flow({ viewport: HELD }));
    await act(async () => {
      await holder.instance?.setViewport({ x: 20, y: 20, zoom: 1 });
    });
    const told = onMove.mock.calls.length;
    await act(async () => {
      rerender(flow({}));
      await flowSettled();
    });
    await act(flowSettled);
    // The move that waited is dropped, and the canvas did not move: there is nothing to tell.
    expect(onMove).toHaveBeenCalledTimes(told);
  });

  it("tells onMove once for the viewport the owner holds from the start", async () => {
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    await show({ viewport: { x: 30, y: 30, zoom: 1 }, onMove });
    expect(onMove).toHaveBeenCalledOnce();
  });

  it("tells onMove again when the owner puts the viewport elsewhere than the move proposed", async () => {
    const onMove = vi.fn<NonNullable<ReactFlowProps["onMove"]>>();
    cleanup();
    await act(async () => {
      render(<SnappingOwner onMove={onMove} />);
      await flowSettled();
    });
    await act(flowSettled);
    onMove.mockClear();
    wheelUpAtOrigin();
    const moves = onMove.mock.calls.map(([, viewport]) => viewport);
    expect(moves).toHaveLength(2);
    expect(moves[1]).toStrictEqual({ x: GRID, y: GRID, zoom: moves[0]?.zoom });
  });
});
