import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import { noop } from "./noop.ts";
import type { ReactFlowProps } from "./react-flow-props.ts";
import { ReactFlow } from "./react-flow.tsx";
import type { Node } from "./types.ts";

const WINDOW = globalThis.window;

const NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

async function show(props: ReactFlowProps): Promise<void> {
  cleanup();
  await act(async () => {
    render(<ReactFlow width={800} height={600} defaultNodes={NODES} {...props} />);
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

function layerTransform(): string {
  return document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
}

const A_SOURCE_HANDLE = '.react-flow__node[data-id="a"] .react-flow__handle.source';
const NODE_A = '.react-flow__node[data-id="a"]';

interface HeldFrames {
  run: () => void;
  /** How many frames have been asked for and not run yet. */
  pending: () => number;
}

// Animation frames wait until the test runs them, so that an auto-pan is one step at a time.
function holdFrames(): HeldFrames {
  const waiting: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => waiting.push(frame));
  vi.stubGlobal("cancelAnimationFrame", noop);
  return {
    run: () => {
      act(() => {
        for (const frame of waiting.splice(0)) {
          frame(performance.now());
        }
      });
    },
    pending: () => waiting.length,
  };
}

const NEAR_RIGHT_EDGE = { x: 795, y: 300 };

// Presses `target`, takes the pointer to the right edge of the canvas, runs one animation frame and
// returns where the canvas is then.
async function dragToEdge(target: string, props: ReactFlowProps): Promise<string> {
  await show(props);
  const frames = holdFrames();
  try {
    act(() => {
      fireEvent.pointerDown(query(target), { button: 0, clientX: 0, clientY: 0 });
      // As in React Flow, the move that begins a drag does not set the scrolling going; the next does.
      fireEvent.pointerMove(WINDOW, {
        clientX: NEAR_RIGHT_EDGE.x - 10,
        clientY: NEAR_RIGHT_EDGE.y,
      });
      fireEvent.pointerMove(WINDOW, { clientX: NEAR_RIGHT_EDGE.x, clientY: NEAR_RIGHT_EDGE.y });
    });
    frames.run();
    const transform = layerTransform();
    act(() => {
      fireEvent.pointerUp(WINDOW, { clientX: NEAR_RIGHT_EDGE.x, clientY: NEAR_RIGHT_EDGE.y });
    });
    return transform;
  } finally {
    vi.unstubAllGlobals();
  }
}

// How many frames a connection that scrolls is waiting for while it is dragged, and after it ended.
async function framesWaitedFor(): Promise<{ during: number; after: number }> {
  await show({});
  const frames = holdFrames();
  try {
    act(() => {
      fireEvent.pointerDown(query(A_SOURCE_HANDLE), { button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(WINDOW, { clientX: NEAR_RIGHT_EDGE.x, clientY: NEAR_RIGHT_EDGE.y });
    });
    frames.run();
    const during = frames.pending();
    act(() => {
      fireEvent.pointerUp(WINDOW, { clientX: NEAR_RIGHT_EDGE.x, clientY: NEAR_RIGHT_EDGE.y });
    });
    frames.run();
    return { during, after: frames.pending() };
  } finally {
    vi.unstubAllGlobals();
  }
}

interface Move {
  clientX: number;
  clientY: number;
}

// Presses the source handle of `a`, moves the pointer through `moves`, and says whether a connection
// line is drawn then. The pointer is released afterwards, so that nothing keeps following it.
async function lineDrawnAfter(moves: readonly Move[]): Promise<boolean> {
  await show({});
  act(() => {
    fireEvent.pointerDown(query(A_SOURCE_HANDLE), { button: 0, clientX: 0, clientY: 0 });
    for (const move of moves) {
      fireEvent.pointerMove(WINDOW, move);
    }
  });
  const drawn = document.querySelector(".react-flow__connection-path") !== null;
  act(() => {
    fireEvent.pointerUp(WINDOW, { clientX: 0, clientY: 0 });
  });
  return drawn;
}

describe("autoPanOnConnect", () => {
  it("starts the connection it scrolls for once the pointer has moved", async () => {
    await expect(lineDrawnAfter([{ clientX: 50, clientY: 0 }])).resolves.toBe(true);
  });

  it("starts no connection before the pointer has moved", async () => {
    await expect(lineDrawnAfter([])).resolves.toBe(false);
  });

  it("stops asking for frames once the connection is over", async () => {
    await expect(framesWaitedFor()).resolves.toStrictEqual({ during: 1, after: 0 });
  });

  it("scrolls the canvas when a connection is dragged to its edge", async () => {
    await expect(dragToEdge(A_SOURCE_HANDLE, {})).resolves.not.toContain("translate(0px,0px)");
  });

  it("leaves the canvas where it is when it is turned off", async () => {
    await expect(dragToEdge(A_SOURCE_HANDLE, { autoPanOnConnect: false })).resolves.toContain(
      "translate(0px,0px)",
    );
  });
});

describe("autoPanOnNodeDrag", () => {
  it("scrolls the canvas when a node is dragged to its edge", async () => {
    await expect(dragToEdge(NODE_A, {})).resolves.not.toContain("translate(0px,0px)");
  });

  it("leaves the canvas where it is when it is turned off", async () => {
    await expect(dragToEdge(NODE_A, { autoPanOnNodeDrag: false })).resolves.toContain(
      "translate(0px,0px)",
    );
  });
});

describe("autoPanOnSelection", () => {
  const BOX = { selectionOnDrag: true, panOnDrag: false } as const;

  it("scrolls the canvas when a selection box is drawn to its edge", async () => {
    await expect(dragToEdge(".react-flow__pane", BOX)).resolves.not.toContain("translate(0px,0px)");
  });

  it("leaves the canvas where it is when it is turned off", async () => {
    await expect(
      dragToEdge(".react-flow__pane", { ...BOX, autoPanOnSelection: false }),
    ).resolves.toContain("translate(0px,0px)");
  });
});
