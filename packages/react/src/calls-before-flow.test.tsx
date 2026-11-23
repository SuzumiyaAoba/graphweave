import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { describe, expect, it } from "vite-plus/test";

import { handled } from "./handled.ts";
import type { ReactFlowInstance } from "./instance-types.ts";
import { noop } from "./noop.ts";
import { ReactFlowProvider } from "./react-flow-provider.tsx";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";
import { useReactFlow } from "./use-react-flow.ts";

const NODES: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

interface Holder {
  instance: ReactFlowInstance | undefined;
}

type Keep = (instance: ReactFlowInstance) => void;

// Keeps the instance it is handed in `holder` (made outside of the components).
function keeper(holder: Holder): Keep {
  return (instance) => {
    holder.instance = instance;
  };
}

function Grab({ onInstance }: { onInstance: Keep }): null {
  const instance = useReactFlow();
  useEffect(() => {
    onInstance(instance);
  }, [instance, onInstance]);
  return null;
}

// A provider, with its flow rendered only when `withFlow` is set.
function Page({ onInstance, withFlow }: { onInstance: Keep; withFlow: boolean }): ReactElement {
  return (
    <ReactFlowProvider>
      <Grab onInstance={onInstance} />
      {withFlow ? <ReactFlow width={800} height={600} defaultNodes={NODES} /> : null}
    </ReactFlowProvider>
  );
}

function instanceOf(holder: Holder): ReactFlowInstance {
  if (holder.instance === undefined) {
    throw new Error("the provider gave no instance");
  }
  return holder.instance;
}

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

async function fitThenTell(instance: ReactFlowInstance, told: boolean[]): Promise<void> {
  told.push(await instance.fitView());
}

// React Flow moves the viewport through the pan and zoom of the flow on the page, which a provider
// whose flow is not rendered yet does not have.
describe("viewport calls made before the flow is rendered, as React Flow's", () => {
  it("move nothing and resolve to false", async () => {
    const holder: Holder = { instance: undefined };
    const keep = keeper(holder);
    cleanup();
    await act(async () => {
      render(<Page onInstance={keep} withFlow={false} />);
      await Promise.resolve();
    });
    const instance = instanceOf(holder);
    const results = await act(async () => [
      await instance.zoomTo(1.5),
      await instance.zoomIn({ duration: 50 }),
      await instance.setViewport({ x: 10, y: 10, zoom: 1 }),
      await instance.setCenter(0, 0, { zoom: 1 }),
      await instance.fitBounds({ x: 0, y: 0, width: 100, height: 100 }),
    ]);
    expect([results, instance.getViewport()]).toStrictEqual([
      [false, false, false, false, false],
      { x: 0, y: 0, zoom: 1 },
    ]);
  });

  it("wait with a fit until the flow is there and has measured its nodes", async () => {
    const holder: Holder = { instance: undefined };
    const keep = keeper(holder);
    cleanup();
    const { rerender } = render(<Page onInstance={keep} withFlow={false} />);
    await act(flowSettled);
    const told: boolean[] = [];
    await act(async () => {
      handled(fitThenTell(instanceOf(holder), told), noop);
      await flowSettled();
    });
    const toldBefore = [...told];
    await act(async () => {
      rerender(<Page onInstance={keep} withFlow />);
      await flowSettled();
    });
    const moved = layerTransform() !== "translate(0px,0px) scale(1)";
    expect([toldBefore, told, moved]).toStrictEqual([[], [true], true]);
  });
});

describe("a fit asked for while the flow is away from its provider", () => {
  it("is made when the flow is back, though its nodes measure to the sizes they had", async () => {
    const holder: Holder = { instance: undefined };
    const keep = keeper(holder);
    cleanup();
    const { rerender } = render(<Page onInstance={keep} withFlow />);
    await act(flowSettled);
    await act(async () => {
      rerender(<Page onInstance={keep} withFlow={false} />);
      await flowSettled();
    });
    const told: boolean[] = [];
    await act(async () => {
      handled(fitThenTell(instanceOf(holder), told), noop);
      await flowSettled();
    });
    const toldWhileAway = [...told];
    await act(async () => {
      rerender(<Page onInstance={keep} withFlow />);
      await flowSettled();
    });
    expect([toldWhileAway, told]).toStrictEqual([[], [true]]);
  });
});
