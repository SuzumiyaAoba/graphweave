import type { Viewport } from "@graphweave/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { handled } from "./handled.ts";
import type { ReactFlowInstance } from "./instance-types.ts";
import { noop } from "./noop.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { SelectionChange } from "./selection-listener.tsx";
import type { ReactFlowStore } from "./store-context.ts";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";
import { useOnSelectionChange, useOnViewportChange } from "./use-events.ts";
import { useStoreApi } from "./use-store.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

interface Holder {
  instance: ReactFlowInstance | undefined;
  store: ReactFlowStore | undefined;
}

function Grab({ onStore }: { onStore: (store: ReactFlowStore) => void }): null {
  const store = useStoreApi();
  useEffect(() => {
    onStore(store);
  }, [store, onStore]);
  return null;
}

async function show(holder: Holder, children: ReactElement, nodes: Node[]): Promise<void> {
  cleanup();
  act(() => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={nodes}
        onInit={(instance) => {
          holder.instance = instance;
        }}
      >
        <Grab
          onStore={(store) => {
            holder.store = store;
          }}
        />
        {children}
      </ReactFlow>,
    );
  });
  // The flow is told to be there once its effects have run, which is when `act` is left.
  await act(flowSettled);
}

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

function clickOn(selector: string): void {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  fireEvent.click(element);
}

function clickNode(id: string): void {
  clickOn(`.react-flow__node[data-id="${id}"]`);
}

async function delay(milliseconds: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function instanceOf(holder: Holder): ReactFlowInstance {
  if (holder.instance === undefined) {
    throw new Error("the flow was not initialized");
  }
  return holder.instance;
}

async function fitThenTell(holder: Holder, settled: (moved: boolean) => void): Promise<void> {
  const moved = await instanceOf(holder).fitView();
  settled(moved);
}

// Asks for a fit and tells `settled` how it ended, without waiting for it.
function askFit(holder: Holder, settled: (moved: boolean) => void): void {
  handled(fitThenTell(holder, settled), noop);
}

describe("fitView on an instance whose nodes are not there yet", () => {
  it("settles when the fit that had to wait has been made", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    await show(holder, <span />, []);
    const settled = vi.fn<(moved: boolean) => void>();
    await act(async () => {
      askFit(holder, settled);
      await flowSettled();
    });
    expect([settled.mock.calls.length, holder.store?.getState().fitViewQueued]).toStrictEqual([
      0,
      true,
    ]);
    await act(async () => {
      instanceOf(holder).addNodes(NODES);
      await flowSettled();
    });
    expect(settled.mock.calls).toStrictEqual([[true]]);
    expect(layerTransform()).not.toBe("translate(0px,0px) scale(1)");
  });

  it("lets fits asked for in the meantime wait for the same fit", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    await show(holder, <span />, []);
    const settled = vi.fn<(moved: boolean) => void>();
    await act(async () => {
      askFit(holder, settled);
      askFit(holder, settled);
      await flowSettled();
    });
    await act(async () => {
      instanceOf(holder).addNodes(NODES);
      await flowSettled();
    });
    expect(settled.mock.calls).toStrictEqual([[true], [true]]);
    expect(holder.store?.getState().fitViewResolver).toBeNull();
  });

  it("lets a fit asked for later wait for the fit that is still waiting", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    await show(holder, <span />, []);
    const settled = vi.fn<(moved: boolean) => void>();
    await act(async () => {
      askFit(holder, settled);
      await flowSettled();
    });
    await act(async () => {
      await delay(50);
      askFit(holder, settled);
      await delay(50);
    });
    expect(settled.mock.calls).toStrictEqual([]);
    await act(async () => {
      instanceOf(holder).addNodes(NODES);
      await flowSettled();
    });
    expect(settled.mock.calls).toStrictEqual([[true], [true]]);
  });

  it("settles with true at once when the nodes are there, also if the viewport is already there", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    await show(holder, <span />, NODES);
    const settled = vi.fn<(moved: boolean) => void>();
    await act(async () => {
      askFit(holder, settled);
      await flowSettled();
      askFit(holder, settled);
      await flowSettled();
    });
    expect(settled.mock.calls).toStrictEqual([[true], [true]]);
    expect(holder.store?.getState().fitViewQueued).toBe(false);
  });
});

function OnSelection({ onChange }: { onChange: (selection: SelectionChange) => void }): null {
  useOnSelectionChange({ onChange });
  return null;
}

function Toggled({ onChange }: { onChange: (selection: SelectionChange) => void }): ReactElement {
  const [listening, setListening] = useState(true);
  return (
    <>
      <button
        type="button"
        className="stop"
        onClick={() => {
          setListening(false);
        }}
      >
        stop
      </button>
      {listening ? <OnSelection onChange={onChange} /> : null}
    </>
  );
}

function idsOf(call: [SelectionChange] | undefined): string[] {
  return call?.[0].nodes.map(({ id }) => id) ?? [];
}

describe("useOnSelectionChange, which sets its handler on the store", () => {
  it("is put on the store while it is mounted, and is called by the flow's listener", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    const onChange = vi.fn<(selection: SelectionChange) => void>();
    await show(holder, <OnSelection onChange={onChange} />, NODES);
    expect(holder.store?.getState().onSelectionChangeHandlers).toStrictEqual([onChange]);
    expect(idsOf(onChange.mock.calls.at(-1))).toStrictEqual([]);
    act(() => {
      clickNode("a");
    });
    expect(idsOf(onChange.mock.calls.at(-1))).toStrictEqual(["a"]);
  });

  it("is taken off the store when it is unmounted, and is not called after that", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    const onChange = vi.fn<(selection: SelectionChange) => void>();
    await show(holder, <Toggled onChange={onChange} />, NODES);
    act(() => {
      clickOn(".stop");
    });
    const callsBefore = onChange.mock.calls.length;
    act(() => {
      clickNode("b");
    });
    expect(holder.store?.getState().onSelectionChangeHandlers).toStrictEqual([]);
    expect(onChange).toHaveBeenCalledTimes(callsBefore);
  });
});

function OnViewport({
  onStart,
  onEnd,
}: {
  onStart: (viewport: Viewport) => void;
  onEnd: (viewport: Viewport) => void;
}): null {
  useOnViewportChange({ onStart, onEnd });
  return null;
}

describe("the gesture handlers of the store, which useOnViewportChange listens through", () => {
  it("tell what listens that a gesture began and ended", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    const onStart = vi.fn<(viewport: Viewport) => void>();
    const onEnd = vi.fn<(viewport: Viewport) => void>();
    await show(holder, <OnViewport onStart={onStart} onEnd={onEnd} />, NODES);
    const viewport: Viewport = { x: 1, y: 2, zoom: 3 };
    holder.store?.getState().onViewportChangeStart?.(viewport);
    holder.store?.getState().onViewportChangeEnd?.(viewport);
    expect([onStart.mock.calls, onEnd.mock.calls]).toStrictEqual([[[viewport]], [[viewport]]]);
  });

  it("are taken off the store when the flow is unmounted", async () => {
    const holder: Holder = { instance: undefined, store: undefined };
    await show(holder, <span />, NODES);
    expect(holder.store?.getState().onViewportChangeStart).toBeTypeOf("function");
    cleanup();
    expect(holder.store?.getState().onViewportChangeStart).toBeUndefined();
    expect(holder.store?.getState().onViewportChangeEnd).toBeUndefined();
  });
});
