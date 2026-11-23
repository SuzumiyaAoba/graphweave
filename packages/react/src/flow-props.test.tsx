import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Edge, Node } from "./types.ts";

// Happy-dom has no layout, so every handle is measured at its node's origin.
const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];
const EDGES: Edge[] = [{ id: "e", source: "a", target: "b" }];

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} defaultEdges={EDGES} {...props} />,
    );
    await flowSettled();
  });
  await act(flowSettled);
}

function query(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

describe("the id of the flow", () => {
  it("is on the container and tells the handles apart", async () => {
    await show({ id: "flow-x" });
    expect(query(".react-flow").id).toBe("flow-x");
    expect(query(".react-flow__handle").dataset["id"]?.startsWith("flow-x-")).toBe(true);
  });

  it("is 1 when there is none", async () => {
    await show({});
    expect(query(".react-flow__handle").dataset["id"]?.startsWith("1-")).toBe(true);
  });
});

describe("onScroll", () => {
  it("scrolls the container back to its origin and then tells the owner", async () => {
    const onScroll = vi.fn<NonNullable<ReactFlowProps["onScroll"]>>();
    const scrollTo = vi.fn<(options: ScrollToOptions) => void>();
    await show({ onScroll });
    const wrapper = query(".react-flow");
    Object.assign(wrapper, { scrollTo });
    act(() => {
      fireEvent.scroll(wrapper);
    });
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, left: 0, behavior: "instant" });
    expect(onScroll).toHaveBeenCalledOnce();
  });
});

async function instanceOf(): Promise<ReactFlowInstance> {
  const holder: { instance?: ReactFlowInstance } = {};
  await show({
    onInit: (instance) => {
      holder.instance = instance;
    },
  });
  if (holder.instance === undefined) {
    throw new Error("no instance");
  }
  return holder.instance;
}

describe("the connections of a node", () => {
  it("are found by the id of one of its handles (handleId) or all together", async () => {
    const instance = await instanceOf();
    expect(instance.getNodeConnections({ nodeId: "a" })).toHaveLength(1);
    expect(
      instance.getNodeConnections({ nodeId: "a", type: "source", handleId: null }),
    ).toHaveLength(1);
    expect(
      instance.getNodeConnections({ nodeId: "a", type: "source", handleId: "other" }),
    ).toHaveLength(0);
  });

  it("are found for a handle with the deprecated method, by id", async () => {
    const instance = await instanceOf();
    const params = { nodeId: "b", type: "target", id: null } as const;
    // oxlint-disable-next-line typescript/no-deprecated -- the method is part of the compatible surface
    const connections = instance.getHandleConnections(params);
    expect(connections).toHaveLength(1);
  });
});

const FAR: Node = { id: "far", position: { x: 5000, y: 4000 }, data: {}, width: 100, height: 40 };

// Pretends the keyboard moved the focus, which is what `:focus-visible` says in a browser.
function focusFar(): string {
  const spy = vi
    .spyOn(Element.prototype, "matches")
    .mockImplementation((selector) => selector === ":focus-visible");
  try {
    act(() => {
      fireEvent.focus(query('.react-flow__node[data-id="far"]'));
    });
  } finally {
    spy.mockRestore();
  }
  return query(".react-flow__viewport").getAttribute("style") ?? "";
}

describe("autoPanOnNodeFocus", () => {
  it("centres the viewport on a node out of view that the keyboard focuses", async () => {
    await show({ defaultNodes: [...NODES, FAR] });
    expect(focusFar()).not.toContain("translate(0px,0px)");
  });

  it("leaves the viewport where it is when it is turned off", async () => {
    await show({ defaultNodes: [...NODES, FAR], autoPanOnNodeFocus: false });
    expect(focusFar()).toContain("translate(0px,0px)");
  });
});
