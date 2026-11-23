import { describe, expect, it, vi } from "vite-plus/test";

import { cancelConnection, endConnection } from "./connection-end.ts";
import { startConnection, updateConnection } from "./connection.ts";
import { box, connectableFlow, dragOnto, FROM_A, handle } from "./test-handles.ts";
import type { Connection, EdgeBase } from "./types.ts";
import { ConnectionMode } from "./types.ts";

describe("startConnection", () => {
  it("starts from a handle, remembering where the drag began", () => {
    const store = connectableFlow();
    expect(startConnection(store, FROM_A)).toBe(true);
    const { connection } = store.getState();
    expect(connection.inProgress).toBe(true);
    expect(connection.from).toStrictEqual({ x: 100, y: 25 });
    expect(connection.fromPosition).toBe("right");
    expect(connection.toPosition).toBe("left");
    expect(connection.to).toStrictEqual({ x: 100, y: 25 });
    expect(connection.toHandle).toBeNull();
    expect(connection.fromNode?.id).toBe("a");
  });

  it("refuses unknown handles and handles that may not start a connection", () => {
    expect(startConnection(connectableFlow(), { ...FROM_A, nodeId: "missing" })).toBe(false);
    expect(startConnection(connectableFlow(), { ...FROM_A, handleId: "nope" })).toBe(false);
    expect(startConnection(connectableFlow({}, { isConnectable: false }), FROM_A)).toBe(false);
    expect(startConnection(connectableFlow({}, { isConnectableStart: false }), FROM_A)).toBe(false);
  });

  it("leaves nodesConnectable and a node's `connectable` to the handles, as React Flow does", () => {
    expect(startConnection(connectableFlow({ nodesConnectable: false }), FROM_A)).toBe(true);
    const optedOut = connectableFlow({ nodes: [box("a", [0, 0], { connectable: false })] });
    expect(startConnection(optedOut, FROM_A)).toBe(true);
  });

  it("starts from a handle that may not start one when asked not to check", () => {
    const store = connectableFlow({}, { isConnectableStart: false });
    expect(startConnection(store, { ...FROM_A, unchecked: true })).toBe(true);
  });
});

describe("updateConnection", () => {
  it("snaps to the middle of a valid handle within the radius", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, { x: 305, y: 30 });
    const { connection } = store.getState();
    expect(connection.isValid).toBe(true);
    expect(connection.to).toStrictEqual({ x: 300, y: 25 });
    expect(connection.toNode?.id).toBe("b");
    expect(connection.toPosition).toBe("left");
  });

  it("follows the pointer freely when no handle is close enough", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, { x: 330, y: 30 });
    const { connection } = store.getState();
    expect(connection.isValid).toBeNull();
    expect(connection.toHandle).toBeNull();
    expect(connection.to).toStrictEqual({ x: 330, y: 30 });
  });

  it("picks the closest of several handles", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, { x: 300, y: 222 });
    expect(store.getState().connection.toNode?.id).toBe("c");
  });

  it("only joins a source to a target in strict mode, and any two handles in loose mode", () => {
    // The nearest handle is found whatever its kind; in strict mode it is then refused.
    const strict = connectableFlow();
    startConnection(strict, FROM_A);
    updateConnection(strict, { x: 400, y: 25 });
    expect(strict.getState().connection.toHandle?.type).toBe("source");
    expect(strict.getState().connection.isValid).toBe(false);
    expect(strict.getState().connection.to).toStrictEqual({ x: 400, y: 25 });
    expect(strict.getState().connection.toPosition).toBe("left");

    const loose = connectableFlow({ connectionMode: ConnectionMode.Loose });
    startConnection(loose, FROM_A);
    updateConnection(loose, { x: 400, y: 25 });
    expect(loose.getState().connection.isValid).toBe(true);
    expect(loose.getState().connection.toHandle?.type).toBe("source");
  });

  it("refuses to join the two handles of one node that have the same id, in loose mode", () => {
    const store = connectableFlow({ connectionMode: ConnectionMode.Loose });
    startConnection(store, FROM_A);
    // The target handle of the node the drag started on.
    updateConnection(store, { x: 2, y: 25 });
    const { connection } = store.getState();
    expect(connection.toHandle?.type).toBe("target");
    expect(connection.isValid).toBe(false);
  });

  it("marks a rejected target invalid and does not snap to it", () => {
    const store = connectableFlow({ isValidConnection: () => false });
    startConnection(store, FROM_A);
    updateConnection(store, { x: 305, y: 30 });
    const { connection } = store.getState();
    expect(connection.isValid).toBe(false);
    expect(connection.toHandle).not.toBeNull();
    expect(connection.to).toStrictEqual({ x: 305, y: 30 });
  });

  it("passes the connection to isValidConnection with the source first", () => {
    const isValidConnection = vi.fn<(connection: Connection | EdgeBase) => boolean>(() => true);
    const store = connectableFlow({ isValidConnection });
    startConnection(store, {
      nodeId: "b",
      handleId: null,
      handleType: "target",
      point: { x: 300, y: 25 },
    });
    updateConnection(store, { x: 102, y: 28 });
    expect(isValidConnection).toHaveBeenLastCalledWith({
      source: "a",
      sourceHandle: null,
      target: "b",
      targetHandle: null,
    });
  });

  it("rejects a handle that may not end a connection", () => {
    const store = connectableFlow({}, { isConnectableEnd: false });
    startConnection(store, FROM_A);
    updateConnection(store, { x: 305, y: 30 });
    expect(store.getState().connection.isValid).toBe(false);
  });

  it("does nothing when no connection is in progress", () => {
    const store = connectableFlow();
    updateConnection(store, { x: 305, y: 30 });
    expect(store.getState().connection.inProgress).toBe(false);
  });
});

describe("endConnection", () => {
  const made: Connection = { source: "a", sourceHandle: null, target: "b", targetHandle: null };

  it("reports a valid connection and clears the state", () => {
    const onConnect = vi.fn<(connection: Connection) => void>();
    const store = connectableFlow({ onConnect });
    dragOnto(store, { x: 305, y: 30 });
    const result = endConnection(store);
    expect(onConnect).toHaveBeenCalledExactlyOnceWith(made);
    expect(result.connection).toStrictEqual(made);
    expect(store.getState().connection.inProgress).toBe(false);
  });

  it("adds the edge itself when the flow owns its edges, and leaves it to the owner otherwise", () => {
    const owned = connectableFlow({ defaultEdges: [] });
    dragOnto(owned, { x: 305, y: 30 });
    endConnection(owned);
    expect(owned.getState().edges).toHaveLength(1);
    expect(owned.getState().edges[0]?.id).toBe("xy-edge__a-b");

    const controlled = connectableFlow({ edges: [] });
    dragOnto(controlled, { x: 305, y: 30 });
    endConnection(controlled);
    expect(controlled.getState().edges).toHaveLength(0);
  });

  it("makes nothing when released away from a handle or over an invalid one", () => {
    const onConnect = vi.fn<(connection: Connection) => void>();
    const away = connectableFlow({ onConnect });
    dragOnto(away, { x: 200, y: 100 });
    expect(endConnection(away).connection).toBeUndefined();
    const rejected = connectableFlow({ onConnect, isValidConnection: () => false });
    dragOnto(rejected, { x: 305, y: 30 });
    expect(endConnection(rejected).connection).toBeUndefined();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("returns the state the drag ended in, and nothing when there was no drag", () => {
    const store = connectableFlow();
    dragOnto(store, { x: 200, y: 100 });
    expect(endConnection(store).finalState?.to).toStrictEqual({ x: 200, y: 100 });
    expect(endConnection(store)).toStrictEqual({ connection: undefined, finalState: undefined });
  });

  it("reports the final state without `inProgress`, with a position only over a handle", () => {
    const away = connectableFlow();
    dragOnto(away, { x: 200, y: 100 });
    const awayState = endConnection(away).finalState;
    expect(awayState).not.toHaveProperty("inProgress");
    expect(awayState?.toPosition).toBeNull();
    const over = connectableFlow();
    dragOnto(over, { x: 305, y: 30 });
    expect(endConnection(over).finalState?.toPosition).toBe("left");
  });

  it("builds the connection with the source first when the drag started on a target", () => {
    const onConnect = vi.fn<(connection: Connection) => void>();
    const store = connectableFlow({ onConnect });
    startConnection(store, {
      nodeId: "b",
      handleId: null,
      handleType: "target",
      point: { x: 300, y: 25 },
    });
    updateConnection(store, { x: 102, y: 28 });
    endConnection(store);
    expect(onConnect).toHaveBeenCalledExactlyOnceWith(made);
  });

  it("can be cancelled", () => {
    const onConnect = vi.fn<(connection: Connection) => void>();
    const store = connectableFlow({ onConnect });
    dragOnto(store, { x: 305, y: 30 });
    cancelConnection(store);
    expect(store.getState().connection.inProgress).toBe(false);
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("hidden nodes", () => {
  it("are not offered as connection targets", () => {
    const store = connectableFlow({
      nodes: [box("a", [0, 0]), box("b", [300, 0], { hidden: true })],
    });
    dragOnto(store, { x: 305, y: 30 });
    expect(store.getState().connection.toHandle).toBeNull();
  });
});

describe("loose mode, with handles of the other type", () => {
  // `b` only has a source handle (on its left side), like every handle of an all-sources graph.
  const onlySourceOnB = {
    id: "b",
    width: 100,
    height: 50,
    handleBounds: { source: [handle("source", { position: "left", x: -4 })], target: [] },
  };
  const FROM_B_AS_TARGET = {
    nodeId: "b",
    handleId: null,
    handleType: "target",
    point: { x: 300, y: 25 },
  } as const;

  it("starts from a handle of the other type and keeps the end it stands for", () => {
    const onConnect = vi.fn<(connection: Connection) => void>();
    const store = connectableFlow({ connectionMode: ConnectionMode.Loose, onConnect });
    store.getState().updateNodeDimensions([onlySourceOnB]);
    expect(startConnection(store, FROM_B_AS_TARGET)).toBe(true);
    updateConnection(store, { x: 102, y: 28 });
    endConnection(store);
    expect(onConnect).toHaveBeenCalledExactlyOnceWith({
      source: "a",
      sourceHandle: null,
      target: "b",
      targetHandle: null,
    });
  });

  it("refuses it in strict mode, where a handle has to be of the type asked for", () => {
    const store = connectableFlow();
    store.getState().updateNodeDimensions([onlySourceOnB]);
    expect(startConnection(store, FROM_B_AS_TARGET)).toBe(false);
  });
});

describe("endConnection without reporting", () => {
  it("returns the connection but neither calls onConnect nor adds an edge", () => {
    const onConnect = vi.fn<(connection: Connection) => void>();
    const store = connectableFlow({ onConnect, defaultEdges: [] });
    dragOnto(store, { x: 305, y: 30 });
    const result = endConnection(store, { report: false });
    expect(result.connection).toStrictEqual({
      source: "a",
      sourceHandle: null,
      target: "b",
      targetHandle: null,
    });
    expect(onConnect).not.toHaveBeenCalled();
    expect(store.getState().edges).toHaveLength(0);
  });
});
