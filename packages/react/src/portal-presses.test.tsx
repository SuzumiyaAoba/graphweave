import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { NodeToolbar } from "./node-toolbar.tsx";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";
import { ViewportPortal } from "./viewport-portal.tsx";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", type: "bar", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
];

function BarNode(): ReactElement {
  return (
    <>
      a<NodeToolbar isVisible>bar</NodeToolbar>
    </>
  );
}

async function flow(): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} nodeTypes={{ bar: BarNode }}>
        <ViewportPortal>
          <div
            className="drawn"
            style={{ position: "absolute", transform: "translate(300px, 300px)" }}
          >
            drawn
          </div>
        </ViewportPortal>
      </ReactFlow>,
    );
    await Promise.resolve();
  });
}

function query(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return element;
}

function viewport(): string {
  return query(".react-flow__viewport").style.transform;
}

function node(): string {
  return query('.react-flow__node[data-id="a"]').style.transform;
}

// Presses `target` at (300, 300), moves the pointer by (40, 20) in two steps and lets it go.
function dragFrom(target: Element): void {
  act(() => {
    fireEvent.pointerDown(target, { button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(WINDOW, { clientX: 320, clientY: 310 });
    fireEvent.pointerMove(WINDOW, { clientX: 340, clientY: 320 });
    fireEvent.pointerUp(WINDOW, { clientX: 340, clientY: 320 });
  });
}

// As React Flow, whose d3-zoom listens on the page and whose node drag listens on the node's element.
describe("presses on what is drawn through a portal", () => {
  it("pan the canvas from a node's toolbar, and leave the node where it is", async () => {
    await flow();
    dragFrom(query(".react-flow__node-toolbar"));
    expect([viewport(), node()]).toStrictEqual([
      "translate(40px,20px) scale(1)",
      "translate(0px,0px)",
    ]);
  });

  it("pan the canvas from what ViewportPortal draws", async () => {
    await flow();
    dragFrom(query(".drawn"));
    expect(viewport()).toBe("translate(40px,20px) scale(1)");
  });

  it("zoom in on a double click on what ViewportPortal draws", async () => {
    await flow();
    act(() => {
      fireEvent.doubleClick(query(".drawn"), { clientX: 300, clientY: 300 });
    });
    await vi.waitFor(() => {
      expect(viewport()).toBe("translate(-300px,-300px) scale(2)");
    });
  });
});
