import { describe, expect, it } from "vite-plus/test";

import { connectionByClick } from "./connection-click.ts";
import { connectableFlow } from "./test-handles.ts";
import { ConnectionMode } from "./types.ts";

describe("connectionByClick", () => {
  const A_SOURCE = { nodeId: "a", type: "source", id: null } as const;
  const B_TARGET = { nodeId: "b", type: "target", id: null } as const;
  const B_SOURCE = { nodeId: "b", type: "source", id: null } as const;

  it("joins the source that was clicked first to the target clicked second", () => {
    const store = connectableFlow();
    expect(connectionByClick(store, { from: A_SOURCE, to: B_TARGET })).toStrictEqual({
      source: "a",
      sourceHandle: null,
      target: "b",
      targetHandle: null,
    });
  });

  it("builds it with the source first when the target was clicked first", () => {
    const store = connectableFlow();
    expect(connectionByClick(store, { from: B_TARGET, to: A_SOURCE })).toStrictEqual({
      source: "a",
      sourceHandle: null,
      target: "b",
      targetHandle: null,
    });
  });

  it("refuses two handles of one kind in strict mode, and allows them in loose mode", () => {
    expect(connectionByClick(connectableFlow(), { from: A_SOURCE, to: B_SOURCE })).toBeUndefined();
    const loose = connectableFlow({ connectionMode: ConnectionMode.Loose });
    expect(connectionByClick(loose, { from: A_SOURCE, to: B_SOURCE })).toBeDefined();
  });

  it("refuses the handle that was clicked first, and one that cannot end a connection", () => {
    const loose = connectableFlow({ connectionMode: ConnectionMode.Loose });
    expect(connectionByClick(loose, { from: A_SOURCE, to: A_SOURCE })).toBeUndefined();
    const noEnd = connectableFlow({}, { isConnectableEnd: false });
    expect(connectionByClick(noEnd, { from: A_SOURCE, to: B_TARGET })).toBeUndefined();
  });

  it("asks the given isValidConnection instead of the flow's", () => {
    const store = connectableFlow({ isValidConnection: () => true });
    expect(
      connectionByClick(store, { from: A_SOURCE, to: B_TARGET, isValidConnection: () => false }),
    ).toBeUndefined();
  });
});
