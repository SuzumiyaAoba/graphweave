import type { Viewport } from "@free-flow/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { handled } from "./handled.ts";
import { noop } from "./noop.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";
import { useOnViewportChange } from "./use-events.ts";
import { useReactFlow } from "./use-react-flow.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

type Handler<TName extends keyof ReactFlowProps> = NonNullable<ReactFlowProps[TName]>;

function Mover({ onChange }: { onChange: (viewport: Viewport) => void }): ReactElement {
  const instance = useReactFlow();
  useOnViewportChange({ onChange });
  return (
    <>
      <button
        type="button"
        data-testid="move"
        onClick={() => {
          handled(instance.setViewport({ x: 10, y: 20, zoom: 1 }), noop);
        }}
      >
        move
      </button>
      <button
        type="button"
        data-testid="glide"
        onClick={() => {
          handled(instance.setViewport({ x: 50, y: 0, zoom: 1 }, { duration: 60 }), noop);
        }}
      >
        glide
      </button>
    </>
  );
}

async function show(
  props: ReactFlowProps,
  onChange: (viewport: Viewport) => void = noop,
): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} {...props}>
        <Mover onChange={onChange} />
      </ReactFlow>,
    );
    await Promise.resolve();
  });
}

function isIncreasing(values: readonly number[]): boolean {
  return values.every((value, index) => value >= (values[index - 1] ?? value));
}

function query(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

describe("the viewport callbacks", () => {
  it("are called for a change made by a call, with no event, as React Flow does", async () => {
    const onMoveStart = vi.fn<Handler<"onMoveStart">>();
    const onMove = vi.fn<Handler<"onMove">>();
    const onMoveEnd = vi.fn<Handler<"onMoveEnd">>();
    await show({ onMoveStart, onMove, onMoveEnd });
    act(() => {
      fireEvent.click(query('[data-testid="move"]'));
    });
    await vi.waitFor(() => {
      expect(onMoveEnd).toHaveBeenCalledOnce();
    });
    expect([onMoveStart.mock.calls, onMove.mock.calls, onMoveEnd.mock.calls]).toStrictEqual([
      [[null, { x: 0, y: 0, zoom: 1 }]],
      [[null, { x: 10, y: 20, zoom: 1 }]],
      [[null, { x: 10, y: 20, zoom: 1 }]],
    ]);
  });

  it("are called for a click on the pane, which is a gesture that went nowhere", async () => {
    const onMoveStart = vi.fn<Handler<"onMoveStart">>();
    const onMove = vi.fn<Handler<"onMove">>();
    const onMoveEnd = vi.fn<Handler<"onMoveEnd">>();
    await show({ onMoveStart, onMove, onMoveEnd });
    act(() => {
      fireEvent.pointerDown(query(".react-flow__pane"), { button: 0, clientX: 5, clientY: 5 });
      fireEvent.pointerUp(WINDOW, { clientX: 5, clientY: 5 });
    });
    await vi.waitFor(() => {
      expect(onMoveEnd).toHaveBeenCalledOnce();
    });
    expect([onMoveStart.mock.calls.length, onMove.mock.calls.length]).toStrictEqual([1, 0]);
  });

  it("follow a drag of the pane move by move, once it has begun", async () => {
    const onMoveStart = vi.fn<Handler<"onMoveStart">>();
    const onMove = vi.fn<Handler<"onMove">>();
    await show({ onMoveStart, onMove });
    act(() => {
      fireEvent.pointerDown(query(".react-flow__pane"), { button: 0, clientX: 5, clientY: 5 });
      fireEvent.pointerMove(WINDOW, { clientX: 15, clientY: 5 });
      fireEvent.pointerMove(WINDOW, { clientX: 25, clientY: 5 });
      fireEvent.pointerUp(WINDOW, { clientX: 25, clientY: 5 });
    });
    expect([
      onMoveStart.mock.calls.length,
      onMove.mock.calls.map(([, view]) => view.x),
    ]).toStrictEqual([1, [10, 20]]);
  });

  it("do not make `useOnViewportChange` hear the target and the start of an animated move", async () => {
    const onChange = vi.fn<(viewport: Viewport) => void>();
    await show({}, onChange);
    act(() => {
      fireEvent.click(query('[data-testid="glide"]'));
    });
    const heardAtOnce = onChange.mock.calls.length;
    await vi.waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toStrictEqual({ x: 50, y: 0, zoom: 1 });
    });
    const heard = onChange.mock.calls.map(([viewport]) => viewport.x);
    expect([heardAtOnce, heard.includes(0), isIncreasing(heard)]).toStrictEqual([0, false, true]);
  });
});
