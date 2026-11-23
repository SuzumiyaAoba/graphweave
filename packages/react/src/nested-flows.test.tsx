import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { ReactFlowProvider } from "./react-flow-provider.tsx";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const INNER: Node[] = [{ id: "i", position: { x: 0, y: 0 }, data: {}, width: 50, height: 20 }];

const OUTER: Node[] = [
  { id: "o", type: "flow", position: { x: 0, y: 0 }, data: {}, width: 300, height: 200 },
];

// A node that holds a flow of its own.
function FlowNode(): ReactElement {
  return (
    <div style={{ width: 300, height: 200 }}>
      <ReactFlowProvider>
        <ReactFlow className="inner" width={300} height={200} defaultNodes={INNER} />
      </ReactFlowProvider>
    </div>
  );
}

async function flows(): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={OUTER} nodeTypes={{ flow: FlowNode }} />,
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

function views(): string[] {
  return [
    ".inner .react-flow__viewport",
    ".react-flow:not(.inner) > .react-flow__renderer > .react-flow__pane > .react-flow__viewport",
  ].map((selector) => query(selector).style.transform);
}

// As with React Flow, whose d3-zoom looks for `nopan` on every ancestor and stops the wheel it takes.
describe("a flow inside a node of another flow", () => {
  it("does not pan when its pane is dragged: the outer node, which can be dragged, is", async () => {
    await flows();
    act(() => {
      fireEvent.pointerDown(query(".inner .react-flow__pane"), {
        button: 0,
        clientX: 250,
        clientY: 150,
      });
      fireEvent.pointerMove(WINDOW, { clientX: 270, clientY: 160 });
      fireEvent.pointerMove(WINDOW, { clientX: 290, clientY: 170 });
      fireEvent.pointerUp(WINDOW, { clientX: 290, clientY: 170 });
    });
    const outerNode = query('.react-flow__node[data-id="o"]').style.transform;
    expect([views()[0], outerNode]).toStrictEqual([
      "translate(0px,0px) scale(1)",
      "translate(20px,10px)",
    ]);
  });

  it("zooms alone for a wheel over it", async () => {
    await flows();
    act(() => {
      fireEvent.wheel(query(".inner .react-flow__pane"), {
        deltaY: -100,
        clientX: 250,
        clientY: 150,
      });
    });
    const [inner, outer] = views();
    expect([inner === "translate(0px,0px) scale(1)", outer]).toStrictEqual([
      false,
      "translate(0px,0px) scale(1)",
    ]);
  });
});
