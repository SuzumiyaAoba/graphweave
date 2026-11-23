import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { EdgeToolbar } from "./edge-toolbar.tsx";
import type { ReactFlowInstance } from "./instance-types.ts";
import { noop } from "./noop.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import { flowSettled } from "./test-settle.ts";
import type { Edge, Node } from "./types.ts";
import { useNodesInitialized } from "./use-graph-hooks.ts";
import { useHandleConnections, useNodeConnections } from "./use-node-connections.ts";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
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

function query(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function count(selector: string): number {
  return document.querySelectorAll(selector).length;
}

const TOOLED: Edge = { id: "e", source: "a", target: "b", type: "tooled" };

function WhenSelected({ id }: { id: string }): ReactElement {
  return (
    <EdgeToolbar edgeId={id} x={10} y={20}>
      <button type="button">edit</button>
    </EdgeToolbar>
  );
}

function Always({ id }: { id: string }): ReactElement {
  return (
    <EdgeToolbar edgeId={id} x={10} y={20} isVisible>
      <button type="button">edit</button>
    </EdgeToolbar>
  );
}

const TOOLBAR = ".react-flow__edgelabel-renderer .react-flow__edge-toolbar";

describe("EdgeToolbar", () => {
  it("shows in the label layer only while its edge is selected", async () => {
    await show({ defaultEdges: [TOOLED], edgeTypes: { tooled: WhenSelected } });
    expect(count(TOOLBAR)).toBe(0);
    act(() => {
      fireEvent.click(query('.react-flow__edge[data-id="e"]'));
    });
    expect(count(TOOLBAR)).toBe(1);
    expect(query(TOOLBAR).textContent).toBe("edit");
  });

  it("is placed at the given flow position, aligned on its centre", async () => {
    await show({ defaultEdges: [TOOLED], edgeTypes: { tooled: Always } });
    expect(query(TOOLBAR).getAttribute("style")).toContain("translate(10px, 20px)");
  });

  it("shows without a selection when `isVisible` says so", async () => {
    await show({ defaultEdges: [TOOLED], edgeTypes: { tooled: Always } });
    expect(count(TOOLBAR)).toBe(1);
  });
});

interface Holder {
  instance: ReactFlowInstance | undefined;
}

function Counts(): ReactElement {
  const onTarget = useNodeConnections({ id: "b", handleType: "target" });
  const onSource = useNodeConnections({ id: "a", handleType: "source" });
  // oxlint-disable-next-line typescript/no-deprecated -- the deprecated alias is still part of the API
  const legacy = useHandleConnections({ type: "target", nodeId: "b" });
  return (
    <>
      <output data-testid="target">{onTarget.length}</output>
      <output data-testid="source">{onSource.length}</output>
      <output data-testid="legacy">{legacy.length}</output>
    </>
  );
}

function Initialised(): ReactElement {
  return <output data-testid="ready">{String(useNodesInitialized())}</output>;
}

function text(testId: string): string {
  return document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
}

async function change(
  holder: Holder,
  edit: (instance: ReactFlowInstance) => unknown,
): Promise<void> {
  await act(async () => {
    if (holder.instance !== undefined) {
      await edit(holder.instance);
    }
  });
}

describe("useNodeConnections and useHandleConnections", () => {
  it("follows the edges that come and go", async () => {
    const holder: Holder = { instance: undefined };
    await show(
      {
        defaultEdges: [],
        onInit: (instance) => {
          holder.instance = instance;
        },
      },
      <Counts />,
    );
    expect(text("target")).toBe("0");
    await change(holder, (instance) => {
      instance.addEdges({ id: "e", source: "a", target: "b" });
    });
    expect(text("target")).toBe("1");
    expect(text("source")).toBe("1");
    expect(text("legacy")).toBe("1");
    await change(holder, async (instance) => {
      await instance.deleteElements({ edges: [{ id: "e" }] });
    });
    expect(text("target")).toBe("0");
    expect(text("source")).toBe("0");
    expect(text("legacy")).toBe("0");
  });
});

describe("useNodesInitialized", () => {
  it("is false for nodes that were only given a size: they have to be measured, as in React Flow", async () => {
    await show({}, <Initialised />);
    expect(text("ready")).toBe("false");
  });

  it("is false while a node has no size at all", async () => {
    await show(
      { defaultNodes: [{ id: "n", position: { x: 0, y: 0 }, data: {} }] },
      <Initialised />,
    );
    expect(text("ready")).toBe("false");
  });
});

async function clickWith(props: ReactFlowProps): Promise<void> {
  await show(props);
  act(() => {
    fireEvent.click(query('.react-flow__node[data-id="a"]'));
  });
}

describe("the debug option", () => {
  it("writes the changes a click makes to the console", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(noop);
    await clickWith({ debug: true });
    expect(log).toHaveBeenCalledWith("Free-Flow: trigger node changes", expect.any(Array));
    log.mockRestore();
  });

  it("is quiet by default", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(noop);
    await clickWith({});
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
