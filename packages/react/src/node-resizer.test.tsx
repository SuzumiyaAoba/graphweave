import type { NodeChange } from "@free-flow/core";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { OnResizeEnd } from "./node-resize-control.tsx";
import { NodeResizer } from "./node-resizer.tsx";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} {...props} />);
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

interface Spot {
  x: number;
  y: number;
}

const RESIZABLE: Node = {
  id: "r",
  type: "resizable",
  position: { x: 0, y: 0 },
  data: {},
  width: 100,
  height: 40,
};

function Resizable(): ReactElement {
  return <NodeResizer minWidth={80} minHeight={30} maxWidth={150} />;
}

function KeepsRatio(): ReactElement {
  return <NodeResizer keepAspectRatio />;
}

const refuse = (): boolean => false;

function Refuses(): ReactElement {
  return <NodeResizer shouldResize={refuse} />;
}

function Free(): ReactElement {
  return <NodeResizer />;
}

// Lets the first move of a drag through and refuses every one after it.
function allowFirst(): () => boolean {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1;
  };
}

function AcceptsOnce(): ReactElement {
  const [shouldResize] = useState(allowFirst);
  return <NodeResizer shouldResize={shouldResize} />;
}

const onEnd = vi.fn<OnResizeEnd>();

function ReportsEnd(): ReactElement {
  return <NodeResizer onResizeEnd={onEnd} />;
}

const RESIZER_TYPES = {
  resizable: Resizable,
  ratio: KeepsRatio,
  refuses: Refuses,
  free: Free,
  acceptsOnce: AcceptsOnce,
  reportsEnd: ReportsEnd,
};

function resizableOf(type: keyof typeof RESIZER_TYPES): Node {
  return { ...RESIZABLE, type };
}

// Drags the bottom right handle (which sits at the node's corner, (100, 40)) by each of `path` in
// turn, and returns the size of the last resize change the flow reported.
async function dragPath(
  path: Spot[],
  nodes: Node[] = [RESIZABLE],
): Promise<{ width: number; height: number } | undefined> {
  const seen: NodeChange[] = [];
  await show({
    defaultNodes: nodes,
    nodeTypes: RESIZER_TYPES,
    onNodesChange: (changes) => {
      seen.push(...changes);
    },
  });
  const corner = query(".react-flow__resize-control.handle.bottom.right");
  act(() => {
    fireEvent.pointerDown(corner, { button: 0, clientX: 100, clientY: 40 });
    for (const delta of path) {
      fireEvent.pointerMove(WINDOW, { clientX: 100 + delta.x, clientY: 40 + delta.y });
    }
    const last = path.at(-1) ?? { x: 0, y: 0 };
    fireEvent.pointerUp(WINDOW, { clientX: 100 + last.x, clientY: 40 + last.y });
  });
  return seen
    .flatMap((item) =>
      item.type === "dimensions" && item.resizing !== undefined && item.dimensions
        ? [item.dimensions]
        : [],
    )
    .at(-1);
}

async function dragCorner(
  delta: Spot,
  nodes: Node[] = [RESIZABLE],
): Promise<{ width: number; height: number } | undefined> {
  const size = await dragPath([delta], nodes);
  return size;
}

describe("NodeResizer", () => {
  it("grows a node up to maxWidth, and without a maximum on the other axis", async () => {
    await expect(dragCorner({ x: 500, y: 500 })).resolves.toStrictEqual({
      width: 150,
      height: 540,
    });
  });

  it("shrinks a node down to minWidth and minHeight", async () => {
    await expect(dragCorner({ x: -500, y: -500 })).resolves.toStrictEqual({
      width: 80,
      height: 30,
    });
  });

  it("resizes freely between the limits", async () => {
    await expect(dragCorner({ x: 20, y: 10 })).resolves.toStrictEqual({ width: 120, height: 50 });
  });

  it("keeps the proportions of the node with keepAspectRatio", async () => {
    await expect(dragCorner({ x: 50, y: 0 }, [resizableOf("ratio")])).resolves.toStrictEqual({
      width: 150,
      height: 60,
    });
  });

  it("leaves the node as it is when shouldResize refuses, also at the end of the drag", async () => {
    await expect(dragCorner({ x: 50, y: 50 }, [resizableOf("refuses")])).resolves.toStrictEqual({
      width: 100,
      height: 40,
    });
  });

  it("stops at the edges of the parent for a node whose extent is its parent", async () => {
    const parent: Node = {
      id: "p",
      position: { x: 0, y: 0 },
      data: {},
      width: 200,
      height: 100,
    };
    const child: Node = {
      ...resizableOf("free"),
      id: "c",
      parentId: "p",
      extent: "parent",
      position: { x: 50, y: 10 },
    };
    await expect(dragCorner({ x: 500, y: 500 }, [parent, child])).resolves.toStrictEqual({
      width: 150,
      height: 90,
    });
  });

  it("ends the drag at the last size shouldResize let through, not where the pointer went on", async () => {
    await expect(
      dragPath(
        [
          { x: 20, y: 0 },
          { x: 50, y: 0 },
        ],
        [resizableOf("acceptsOnce")],
      ),
    ).resolves.toStrictEqual({ width: 120, height: 40 });
  });

  it("tells onResizeEnd the size the node ended with", async () => {
    onEnd.mockClear();
    await dragCorner({ x: 20, y: 10 }, [resizableOf("reportsEnd")]);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ width: 120, height: 50 }),
    );
  });
});
