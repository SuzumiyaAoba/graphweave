import { describe, expect, it } from "vite-plus/test";

import { startConnection, updateConnection } from "./connection.ts";
import { connectableFlow, FROM_A } from "./test-handles.ts";

const B_TARGET = { nodeId: "b", type: "target", id: null } as const;
const B_SOURCE = { nodeId: "b", type: "source", id: null } as const;
const FAR = { x: 700, y: 700 };

describe("updateConnection with a handle under the pointer", () => {
  it("takes that handle even where the connection radius reaches no handle", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, FAR, B_TARGET);
    const { connection } = store.getState();
    expect(connection.toNode?.id).toBe("b");
    expect(connection.isValid).toBe(true);
    expect(connection.to).toStrictEqual({ x: 300, y: 25 });
  });

  it("takes it before the nearest handle", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    // The pointer is nearest to the target handle of `c`.
    updateConnection(store, { x: 300, y: 222 }, B_TARGET);
    expect(store.getState().connection.toNode?.id).toBe("b");
  });

  it("shows no refusal for a refused handle when no handle is also within the radius", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, FAR, B_SOURCE);
    const { connection } = store.getState();
    expect(connection.toHandle?.type).toBe("source");
    expect(connection.isValid).toBeNull();
    expect(connection.to).toStrictEqual(FAR);
  });

  it("shows the refusal when a handle is also within the radius", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, { x: 400, y: 25 }, B_SOURCE);
    expect(store.getState().connection.isValid).toBe(false);
  });

  it("ignores a handle that does not exist", () => {
    const store = connectableFlow();
    startConnection(store, FROM_A);
    updateConnection(store, FAR, { nodeId: "nope", type: "target", id: null });
    expect(store.getState().connection.toHandle).toBeNull();
  });
});
