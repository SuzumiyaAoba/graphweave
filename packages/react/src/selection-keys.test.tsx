import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";

const NODES = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 0 }, data: {}, width: 100, height: 40 },
];
const EDGES = [{ id: "ab", source: "a", target: "b" }];

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(
      <ReactFlow width={800} height={600} defaultNodes={NODES} defaultEdges={EDGES} {...props} />,
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

const NODE = '.react-flow__node[data-id="a"]';
const EDGE = '.react-flow__edge[data-id="ab"]';

function press(selector: string, key: string): void {
  const element = query(selector);
  element.focus();
  act(() => {
    fireEvent.keyDown(element, { key });
  });
}

async function nextFrame(): Promise<void> {
  await act(async () => {
    // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  });
}

describe("Enter, Space and Escape on a focused node, as React Flow's handleNodeClick", () => {
  it("select a node that is not selected, Escape included", async () => {
    await show({});
    press(NODE, "Escape");
    expect(query(NODE).classList.contains("selected")).toBe(true);
  });

  it("take a selected node out of the selection for Escape, and the node lets go of the focus", async () => {
    await show({});
    press(NODE, "Enter");
    press(NODE, "Escape");
    expect(query(NODE).classList.contains("selected")).toBe(false);
    await nextFrame();
    expect(document.activeElement).not.toBe(query(NODE));
  });

  it("leave a selected node selected for Enter or Space, and keep the focus", async () => {
    await show({});
    press(NODE, "Enter");
    press(NODE, " ");
    await nextFrame();
    expect(query(NODE).classList.contains("selected")).toBe(true);
    expect(document.activeElement).toBe(query(NODE));
  });

  it("do nothing for a node that cannot be selected, Escape included", async () => {
    await show({ elementsSelectable: false });
    press(NODE, "Escape");
    await nextFrame();
    expect(query(NODE).classList.contains("selected")).toBe(false);
    expect(document.activeElement).toBe(query(NODE));
  });
});

describe("Enter, Space and Escape on a focused edge", () => {
  it("do nothing for an edge that cannot be selected, Escape included", async () => {
    await show({ elementsSelectable: false });
    press(EDGE, "Escape");
    expect(document.activeElement).toBe(query(EDGE));
  });

  it("select the edge for Enter and take it out again for Escape, letting go of the focus", async () => {
    await show({});
    press(EDGE, "Enter");
    expect(query(EDGE).classList.contains("selected")).toBe(true);
    press(EDGE, "Escape");
    expect(query(EDGE).classList.contains("selected")).toBe(false);
    expect(document.activeElement).not.toBe(query(EDGE));
  });
});
