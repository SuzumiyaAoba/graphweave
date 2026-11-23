import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Edge, Node } from "./types.ts";

const ALPHA: Node = {
  id: "a",
  position: { x: 10, y: 20 },
  data: { label: "Alpha" },
  width: 100,
  height: 40,
};
const BETA: Node = {
  id: "b",
  position: { x: 200, y: 100 },
  data: { label: "Beta" },
  width: 100,
  height: 40,
};
const NODES: Node[] = [ALPHA, BETA];

const EDGES: Edge[] = [{ id: "e1", source: "a", target: "b" }];

// Happy-dom has no layout, so the canvas size is given explicitly. Each call starts from a clean page.
async function flow(props: ReactFlowProps = {}): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} {...props} />);
    await Promise.resolve();
  });
}

function paneElement(): HTMLElement {
  const pane = document.querySelector<HTMLElement>(".react-flow__pane");
  if (pane === null) {
    throw new Error("no pane");
  }
  return pane;
}

// Pointer moves and releases are heard on the window, since a drag leaves the element it began on.
const WINDOW = globalThis.window;

function nodeElement(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (element === null) {
    throw new Error(`no node element ${id}`);
  }
  return element;
}

describe("ReactFlow: rendering", () => {
  it("renders a node per entry, with its label and position", async () => {
    await flow({ nodes: NODES, edges: EDGES });
    expect(nodeElement("a").textContent).toBe("Alpha");
    expect(nodeElement("b").textContent).toBe("Beta");
    expect(nodeElement("a").style.transform).toBe("translate(10px,20px)");
    expect(nodeElement("b").style.transform).toBe("translate(200px,100px)");
  });

  it("renders an edge between measured nodes", async () => {
    await flow({ nodes: NODES, edges: EDGES });
    expect(screen.getByTestId("rf__edge-e1")).toBeDefined();
    expect(document.querySelector(".react-flow__edge-path")).not.toBeNull();
  });

  it("skips hidden nodes", async () => {
    await flow({ nodes: [{ ...ALPHA, hidden: true }, BETA] });
    expect(document.querySelector('[data-id="a"]')).toBeNull();
    expect(nodeElement("b").textContent).toBe("Beta");
  });

  it("renders handles for the built-in node types", async () => {
    await flow({
      nodes: [
        { id: "i", type: "input", position: { x: 0, y: 0 }, data: { label: "In" } },
        { id: "o", type: "output", position: { x: 0, y: 100 }, data: { label: "Out" } },
      ],
    });
    expect(nodeElement("i").querySelectorAll(".react-flow__handle.source")).toHaveLength(1);
    expect(nodeElement("i").querySelectorAll(".react-flow__handle.target")).toHaveLength(0);
    expect(nodeElement("o").querySelectorAll(".react-flow__handle.target")).toHaveLength(1);
  });

  it("uses a custom node component for a registered type", async () => {
    await flow({
      nodes: [{ id: "c", type: "custom", position: { x: 0, y: 0 }, data: { label: "x" } }],
      nodeTypes: { custom: ({ id }) => <span>{`custom ${String(id)}`}</span> },
    });
    expect(screen.getByText("custom c")).toBeDefined();
  });

  it("applies the viewport as a transform on the viewport layer", async () => {
    await flow({ nodes: NODES, defaultViewport: { x: 30, y: 40, zoom: 2 } });
    const layer = document.querySelector<HTMLElement>(".react-flow__viewport");
    expect(layer?.style.transform).toBe("translate(30px,40px) scale(2)");
  });
});

describe("ReactFlow: interaction", () => {
  it("marks a clicked node selected and reports the click", async () => {
    const onNodeClick = vi.fn<NonNullable<ReactFlowProps["onNodeClick"]>>();
    await flow({ defaultNodes: NODES, onNodeClick });
    fireEvent.click(nodeElement("a"));
    expect(onNodeClick).toHaveBeenCalledOnce();
    expect(nodeElement("a").className).toContain("selected");
  });

  it("clears the selection when the pane is clicked", async () => {
    await flow({ defaultNodes: NODES });
    fireEvent.click(nodeElement("a"));
    fireEvent.click(paneElement());
    expect(nodeElement("a").className).not.toContain("selected");
  });

  it("moves an uncontrolled node when it is dragged", async () => {
    await flow({ defaultNodes: NODES });
    act(() => {
      // Pressed away from the edge of the canvas, where the drag would scroll it.
      fireEvent.pointerDown(nodeElement("a"), { button: 0, clientX: 300, clientY: 300 });
      // The first move gets past the drag threshold: the node is taken hold of from there, as in
      // React Flow, and does not jump to catch up.
      fireEvent.pointerMove(WINDOW, { clientX: 310, clientY: 300 });
      fireEvent.pointerMove(WINDOW, { clientX: 330, clientY: 310 });
      fireEvent.pointerUp(WINDOW, { clientX: 330, clientY: 310 });
    });
    expect(nodeElement("a").style.transform).toBe("translate(30px,30px)");
  });

  it("reports the drag of a controlled node through onNodesChange", async () => {
    const onNodesChange = vi.fn<NonNullable<ReactFlowProps["onNodesChange"]>>();
    await flow({ nodes: NODES, onNodesChange });
    act(() => {
      // Pressed away from the edge of the canvas, where the drag would scroll it.
      fireEvent.pointerDown(nodeElement("a"), { button: 0, clientX: 300, clientY: 300 });
      // The first move takes hold of the node; the next one moves it.
      fireEvent.pointerMove(WINDOW, { clientX: 305, clientY: 305 });
      fireEvent.pointerMove(WINDOW, { clientX: 315, clientY: 315 });
    });
    expect(onNodesChange).toHaveBeenCalledWith(expect.any(Array));
    const changes = onNodesChange.mock.calls.flatMap(([batch]) => batch);
    expect(changes.some((change) => change.type === "position")).toBe(true);
  });
});
