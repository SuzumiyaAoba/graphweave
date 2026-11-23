import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40, selected: true },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

const ALL_SELECTED: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40, selected: true },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40, selected: true },
];

async function flow(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
    await Promise.resolve();
  });
}

function node(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (element === null) {
    throw new Error(`no node ${id}`);
  }
  return element;
}

function selected(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".react-flow__node.selected")].map(
    (element) => element.dataset["id"] ?? "",
  );
}

// Where the pointer is pressed: away from the edge of the canvas, where a drag would scroll it.
const PRESS = { clientX: 300, clientY: 300 };

function press(id: string): void {
  act(() => {
    fireEvent.pointerDown(node(id), { button: 0, ...PRESS });
  });
}

function moveBy(distance: number): void {
  act(() => {
    fireEvent.pointerMove(WINDOW, { clientX: PRESS.clientX + distance, clientY: PRESS.clientY });
  });
}

function release(): void {
  act(() => {
    fireEvent.pointerUp(WINDOW, {});
  });
}

describe("selecting a node by dragging it", () => {
  it("does not happen at the press, which a click might still be", async () => {
    await flow({});
    press("b");
    const atPress = selected();
    release();
    expect(atPress).toStrictEqual(["a"]);
  });

  it("happens when the drag begins, and the selection is replaced", async () => {
    await flow({});
    press("b");
    moveBy(5);
    const whileDragging = selected();
    release();
    expect(whileDragging).toStrictEqual(["b"]);
  });

  it("clears the selection instead when `selectNodesOnDrag` is off", async () => {
    await flow({ selectNodesOnDrag: false });
    press("b");
    moveBy(5);
    const whileDragging = selected();
    release();
    expect(whileDragging).toStrictEqual([]);
  });

  it("drags an unselected node on its own", async () => {
    await flow({});
    press("b");
    moveBy(5);
    moveBy(15);
    const moved = [node("a").style.transform, node("b").style.transform];
    release();
    expect(moved).toStrictEqual(["translate(0px,0px)", "translate(210px,100px)"]);
  });

  it("drags the whole selection when the node is part of it", async () => {
    await flow({ defaultNodes: ALL_SELECTED });
    press("a");
    moveBy(5);
    moveBy(15);
    const moved = [node("a").style.transform, node("b").style.transform];
    release();
    expect(moved).toStrictEqual(["translate(10px,0px)", "translate(210px,100px)"]);
  });
});
