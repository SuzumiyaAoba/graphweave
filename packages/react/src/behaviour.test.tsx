import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { Controls } from "./controls.tsx";
import type { ReactFlowInstance } from "./instance-types.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Node } from "./types.ts";
import { useNodesData } from "./use-graph-hooks.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "A" }, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: { label: "B" }, width: 100, height: 40 },
];

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

function node(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
}

function click(id: string): void {
  const element = node(id);
  if (element === null) {
    throw new Error(`no node ${id}`);
  }
  act(() => {
    fireEvent.click(element);
  });
}

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

interface Holder {
  instance: ReactFlowInstance | undefined;
}

function rememberInstance(holder: Holder): ReactFlowProps["onInit"] {
  return (instance) => {
    holder.instance = instance;
  };
}

function Probe(): ReactElement {
  const found = useNodesData("a");
  return (
    <output data-testid="probe">{found === null ? "none" : String(found.data["label"])}</output>
  );
}

function query(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function updateData(holder: Holder, id: string, data: Record<string, unknown>): void {
  act(() => {
    holder.instance?.updateNodeData(id, data);
  });
}

function probeText(): string {
  return document.querySelector('[data-testid="probe"]')?.textContent ?? "";
}

describe("deleting with the keyboard", () => {
  it("removes the selected node and reports it", async () => {
    const onNodesDelete = vi.fn<NonNullable<ReactFlowProps["onNodesDelete"]>>();
    await show({ onNodesDelete });
    click("a");
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Backspace" });
      await flowSettled();
    });
    expect(onNodesDelete).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: "a" })]);
    expect(node("a")).toBeNull();
    expect(node("b")).not.toBeNull();
  });
});

describe("a controlled viewport", () => {
  it("reports a zoom but moves only when the owner hands the new viewport back", async () => {
    const onViewportChange = vi.fn<NonNullable<ReactFlowProps["onViewportChange"]>>();
    const tree = (zoom: number): ReactElement => (
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={NODES}
        viewport={{ x: 0, y: 0, zoom }}
        onViewportChange={onViewportChange}
      >
        <Controls />
      </ReactFlow>
    );
    cleanup();
    const view = render(tree(1));
    await act(async () => {
      await flowSettled();
    });
    act(() => {
      fireEvent.click(query(".react-flow__controls-zoomin"));
    });
    expect(onViewportChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ zoom: 1.2 }),
    );
    // Like React Flow's, a held viewport does not follow the user until the owner hands one back.
    expect(layerTransform()).toContain("scale(1)");
    act(() => {
      view.rerender(tree(2));
    });
    expect(layerTransform()).toContain("scale(2)");
    // Taking the owner's viewport in is not a change the owner needs to hear about.
    expect(onViewportChange).toHaveBeenCalledOnce();
  });
});

describe("useNodesData", () => {
  it("shows the data of a node again when it is updated", async () => {
    const holder: Holder = { instance: undefined };
    await show({ onInit: rememberInstance(holder) }, <Probe />);
    expect(probeText()).toBe("A");
    updateData(holder, "a", { label: "Z" });
    expect(probeText()).toBe("Z");
  });
});
