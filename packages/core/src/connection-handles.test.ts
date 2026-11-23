import { describe, expect, it } from "vite-plus/test";

import { startConnection, updateConnection } from "./connection.ts";
import { box, connectableFlow, FROM_A } from "./test-handles.ts";

// As in React Flow, the handles of a connection know their node, and the one it may end on is given
// where it is in the flow (its middle) rather than relative to its node.
describe("the handles of a connection in progress", () => {
  it("name their node, the one it started from included", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    expect(store.getState().connection.fromHandle?.nodeId).toBe("a");
  });

  it("give the handle it may end on with its node and its middle in the flow", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, { x: 305, y: 30 });
    const { toHandle } = store.getState().connection;
    expect([toHandle?.nodeId, toHandle?.x, toHandle?.y]).toStrictEqual(["b", 300, 25]);
  });

  it("keep the handle it started from relative to its node", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, { x: 305, y: 30 });
    const { fromHandle } = store.getState().connection;
    expect([fromHandle?.x, fromHandle?.y]).toStrictEqual([96, 21]);
  });
});

// As in React Flow, the line starts where the handle is at every move, also when its node has been
// moved since the drag began; the node the connection holds stays the one it began at.
describe("the start of a connection whose node moves while it is dragged", () => {
  it("follows the handle at the next move of the pointer", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    // The middle of the source handle of `a` (100 x 50 at the origin) is at (100, 25).
    expect(store.getState().connection.from).toStrictEqual({ x: 100, y: 25 });
    // The owner holds the nodes: it moves `a` by handing them over again.
    store.getState().setNodes([box("a", [40, 10]), box("b", [300, 0]), box("c", [300, 200])]);
    updateConnection(store, { x: 500, y: 500 });
    expect(store.getState().connection.from).toStrictEqual({ x: 140, y: 35 });
  });
});
