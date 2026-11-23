import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

import { Background, BackgroundVariant } from "./background.tsx";
import { Controls } from "./controls.tsx";
import { EdgeLabelRenderer } from "./edge-label-renderer.tsx";
import { MiniMap } from "./minimap.tsx";
import { NodeResizer } from "./node-resizer.tsx";
import { NodeToolbar } from "./node-toolbar.tsx";
import { Panel } from "./panel.tsx";
import { ReactFlowProvider } from "./react-flow-provider.tsx";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";
import { experimental_useOnNodesChangeMiddleware } from "./use-change-middleware.ts";
import { useNodesState } from "./use-flow-state.ts";
import { useNodes } from "./use-graph-hooks.ts";
import { ViewportPortal } from "./viewport-portal.tsx";

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "A" }, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: { label: "B" }, width: 100, height: 40 },
];

const EDGES: Edge[] = [{ id: "e1", source: "a", target: "b", type: "labeled" }];

function Labeled(): ReactElement {
  return (
    <EdgeLabelRenderer>
      <div data-testid="edge-label">label</div>
    </EdgeLabelRenderer>
  );
}

function ToolbarNode(): ReactElement {
  return (
    <>
      body
      <NodeToolbar>
        <button type="button">tool</button>
      </NodeToolbar>
    </>
  );
}

function ResizableNode(): ReactElement {
  return <NodeResizer />;
}

// Drops every node change it is shown.
function DropAll(): null {
  experimental_useOnNodesChangeMiddleware(() => []);
  return null;
}

async function flow(children: ReactNode, extra: Record<string, unknown> = {}): Promise<void> {
  cleanup();
  // Nodes are measured in a microtask, so the render is awaited inside `act`.
  await act(async () => {
    render(
      <ReactFlow
        width={800}
        height={600}
        defaultNodes={NODES}
        defaultEdges={EDGES}
        edgeTypes={{ labeled: Labeled }}
        {...extra}
      >
        {children}
      </ReactFlow>,
    );
    await Promise.resolve();
  });
}

function query(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function node(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (element === null) {
    throw new Error(`no node ${id}`);
  }
  return element;
}

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

describe("Panel", () => {
  it("is positioned by classes derived from `position`", () => {
    render(
      <Panel position="top-right" className="mine">
        hello
      </Panel>,
    );
    const panel = document.querySelector(".react-flow__panel");
    expect(panel?.className).toContain("top");
    expect(panel?.className).toContain("right");
    expect(panel?.className).toContain("mine");
    expect(panel?.textContent).toBe("hello");
  });
});

describe("Background", () => {
  it("draws a dot pattern by default and lines or crosses on request", async () => {
    await flow(<Background />);
    expect(document.querySelectorAll("pattern circle.react-flow__background-pattern")).toHaveLength(
      1,
    );
    cleanup();
    await flow(<Background variant={BackgroundVariant.Lines} />);
    expect(document.querySelectorAll("pattern path.lines")).toHaveLength(1);
    cleanup();
    await flow(<Background variant={BackgroundVariant.Cross} />);
    expect(document.querySelectorAll("pattern path.cross")).toHaveLength(1);
  });

  it("scales the pattern with the zoom", async () => {
    await flow(<Background gap={20} />, { defaultViewport: { x: 0, y: 0, zoom: 2 } });
    expect(document.querySelector("pattern")?.getAttribute("width")).toBe("40");
  });
});

describe("Controls", () => {
  it("zooms with its buttons", async () => {
    await flow(<Controls />);
    fireEvent.click(query(".react-flow__controls-zoomin"));
    expect(layerTransform()).toContain("scale(1.2)");
    fireEvent.click(query(".react-flow__controls-zoomout"));
    expect(layerTransform()).toContain("scale(1)");
  });

  it("locks and unlocks dragging with the interactive button", async () => {
    await flow(<Controls />);
    expect(node("a").className).toContain("selectable");
    fireEvent.click(query(".react-flow__controls-interactive"));
    // As in React Flow the node goes on showing itself as draggable, which follows the props of the
    // flow: the lock is seen in what can be selected, and the drag itself asks the store.
    expect(node("a").className).not.toContain("selectable");
    expect(node("a").className).toContain("draggable");
  });

  it("leaves out the buttons it is told to", async () => {
    await flow(<Controls showZoom={false} showInteractive={false} />);
    expect(document.querySelector(".react-flow__controls-zoomin")).toBeNull();
    expect(document.querySelector(".react-flow__controls-fitview")).not.toBeNull();
  });
});

describe("MiniMap", () => {
  it("draws a rectangle for every node and the mask of the visible area", async () => {
    await flow(<MiniMap />);
    expect(document.querySelectorAll(".react-flow__minimap-node")).toHaveLength(2);
    expect(document.querySelector(".react-flow__minimap-mask")).not.toBeNull();
  });
});

describe("portals", () => {
  it("renders edge labels into the edge label layer", async () => {
    await flow(null);
    const layer = document.querySelector(".react-flow__edgelabel-renderer");
    expect(layer?.querySelector('[data-testid="edge-label"]')).not.toBeNull();
  });

  it("renders ViewportPortal content in the viewport layer", async () => {
    await flow(
      <ViewportPortal>
        <span data-testid="in-viewport">pinned</span>
      </ViewportPortal>,
    );
    const layer = document.querySelector(".react-flow__viewport-portal");
    expect(layer?.querySelector('[data-testid="in-viewport"]')).not.toBeNull();
  });
});

describe("node components", () => {
  it("shows a node toolbar only while its node is selected", async () => {
    await flow(null, {
      defaultNodes: [
        {
          id: "t",
          type: "withtoolbar",
          position: { x: 0, y: 0 },
          data: {},
          width: 100,
          height: 40,
        },
      ],
      defaultEdges: [],
      nodeTypes: { withtoolbar: ToolbarNode },
    });
    expect(document.querySelector(".react-flow__node-toolbar")).toBeNull();
    fireEvent.click(node("t"));
    expect(document.querySelector(".react-flow__node-toolbar")?.textContent).toBe("tool");
  });

  it("gives a node four lines and four handles to resize it", async () => {
    await flow(null, {
      defaultNodes: [
        { id: "r", type: "resizable", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
      ],
      defaultEdges: [],
      nodeTypes: { resizable: ResizableNode },
    });
    expect(node("r").querySelectorAll(".react-flow__resize-control.line")).toHaveLength(4);
    expect(node("r").querySelectorAll(".react-flow__resize-control.handle")).toHaveLength(4);
  });
});

// Presses node `a` and moves the pointer 20 px, then 20 px more, then lets it go: the first move
// begins the drag, the second moves the node 20 px. Away from the edge of the canvas, where it would scroll.
function dragA(): void {
  act(() => {
    fireEvent.pointerDown(node("a"), { button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(globalThis.window, { clientX: 320, clientY: 300 });
    fireEvent.pointerMove(globalThis.window, { clientX: 340, clientY: 300 });
    fireEvent.pointerUp(globalThis.window, { clientX: 340, clientY: 300 });
  });
}

describe("change middleware", () => {
  it("moves the node as usual when there is none", async () => {
    await flow(null);
    dragA();
    expect(node("a").style.transform).toBe("translate(20px,0px)");
  });

  it("lets a component drop the moves of a drag", async () => {
    await flow(<DropAll />);
    dragA();
    expect(node("a").style.transform).toBe("translate(0px,0px)");
  });

  // React Flow shows its node middleware the nodes being moved and the instance's calls only.
  it("is not shown the selection a click makes", async () => {
    await flow(<DropAll />);
    fireEvent.click(node("a"));
    expect(node("a").className).toContain("selected");
  });
});

describe("state hooks", () => {
  it("useNodesState applies the changes it hands out", () => {
    const { result } = renderHook(() => useNodesState(NODES));
    const { 2: onNodesChange } = result.current;
    act(() => {
      onNodesChange([{ id: "a", type: "select", selected: true }]);
    });
    expect(result.current[0][0]?.selected).toBe(true);
  });

  it("useNodes reads the nodes of the enclosing provider", () => {
    const { result } = renderHook(() => useNodes(), {
      wrapper: ({ children }) => (
        <ReactFlowProvider initialNodes={NODES}>{children}</ReactFlowProvider>
      ),
    });
    expect(result.current.map((item) => item.id)).toStrictEqual(["a", "b"]);
  });
});
