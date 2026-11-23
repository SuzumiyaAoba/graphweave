import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

async function flow(props: ReactFlowProps = {}): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
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

// Drags with the middle button from `target`, by (20, 10). Tells where the viewport and the node are.
function middleDrag(target: Element): [string, string] {
  act(() => {
    const at = { pointerType: "mouse", clientX: 300, clientY: 300 };
    fireEvent.pointerDown(target, { ...at, button: 1, buttons: 4 });
    fireEvent.pointerMove(WINDOW, { ...at, buttons: 4, clientX: 320, clientY: 310 });
    fireEvent.pointerUp(WINDOW, { ...at, button: 1, buttons: 0, clientX: 320, clientY: 310 });
  });
  return [
    query(".react-flow__viewport").style.transform,
    query('.react-flow__node[data-id="a"]').style.transform,
  ];
}

// As React Flow's filter for d3-zoom, which lets such a press through before anything else.
describe("a drag with the middle button on a node", () => {
  it("pans the canvas and leaves the node where it is", async () => {
    await flow();
    expect(middleDrag(query('.react-flow__node[data-id="a"]'))).toStrictEqual([
      "translate(20px,10px) scale(1)",
      "translate(0px,0px)",
    ]);
  });

  it("pans the canvas also with panOnDrag off", async () => {
    await flow({ panOnDrag: false });
    expect(middleDrag(query('.react-flow__node[data-id="a"]'))[0]).toBe(
      "translate(20px,10px) scale(1)",
    );
  });
});
