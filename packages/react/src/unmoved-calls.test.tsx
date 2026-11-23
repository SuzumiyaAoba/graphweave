import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";
import { useReactFlow } from "./use-react-flow.ts";

const NODES: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

type Handler<TName extends keyof ReactFlowProps> = NonNullable<ReactFlowProps[TName]>;

// Hands the instance of the flow it is rendered in to `onInstance`.
function Grab({ onInstance }: { onInstance: (instance: ReactFlowInstance) => void }): null {
  const instance = useReactFlow();
  useEffect(() => {
    onInstance(instance);
  }, [instance, onInstance]);
  return null;
}

async function instanceOf(props: ReactFlowProps = {}): Promise<ReactFlowInstance> {
  cleanup();
  const held: { instance: ReactFlowInstance | undefined } = { instance: undefined };
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} {...props}>
        <Grab
          onInstance={(instance) => {
            held.instance = instance;
          }}
        />
      </ReactFlow>,
    );
    await Promise.resolve();
  });
  if (held.instance === undefined) {
    throw new Error("the flow has no instance");
  }
  return held.instance;
}

// React Flow's calls resolve to `true` once d3-zoom has made the change, whether or not the viewport
// moved, and a change with a duration takes it all the same.
describe("viewport calls that leave the viewport where it is", () => {
  it("resolve to true, as React Flow's do", async () => {
    const instance = await instanceOf();
    const results = await act(async () => [
      await instance.zoomTo(2),
      await instance.zoomTo(2),
      await instance.zoomIn(),
      await instance.setViewport(instance.getViewport()),
    ]);
    expect(results).toStrictEqual([true, true, true, true]);
  });

  it("take their duration all the same, told as a move with no event", async () => {
    const onMoveStart = vi.fn<Handler<"onMoveStart">>();
    const onMoveEnd = vi.fn<Handler<"onMoveEnd">>();
    const instance = await instanceOf({ onMoveStart, onMoveEnd });
    const began = performance.now();
    let done = false;
    await act(async () => {
      done = await instance.zoomTo(1, { duration: 120 });
    });
    const tookItsTime = performance.now() - began >= 100;
    await vi.waitFor(() => {
      expect(onMoveEnd).toHaveBeenCalledOnce();
    });
    expect([done, tookItsTime, onMoveStart.mock.calls[0]?.[0]]).toStrictEqual([true, true, null]);
  });
});
