import { describe, expect, it } from "vite-plus/test";

import { applyEdgeChanges, applyNodeChanges } from "./changes.ts";
import type { EdgeBase, NodeBase } from "./types.ts";

function node(id: string, extra: Partial<NodeBase> = {}): NodeBase {
  return { id, position: { x: 0, y: 0 }, data: {}, ...extra };
}

function edge(id: string, extra: Partial<EdgeBase> = {}): EdgeBase {
  return { id, source: "a", target: "b", ...extra };
}

describe("applyNodeChanges", () => {
  it("keeps the identity of untouched nodes and of the array contents", () => {
    const a = node("a");
    const b = node("b");
    const result = applyNodeChanges([{ id: "a", type: "select", selected: true }], [a, b]);
    expect(result[0]).not.toBe(a);
    expect(result[0]?.selected).toBe(true);
    expect(result[1]).toBe(b);
    expect(a.selected).toBeUndefined();
  });

  it("applies position changes and the dragging flag", () => {
    const result = applyNodeChanges(
      [{ id: "a", type: "position", position: { x: 5, y: 6 }, dragging: true }],
      [node("a")],
    );
    expect(result[0]?.position).toStrictEqual({ x: 5, y: 6 });
    expect(result[0]?.dragging).toBe(true);
  });

  it("only sets the dragging flag when no position is given", () => {
    const result = applyNodeChanges(
      [{ id: "a", type: "position", dragging: false }],
      [node("a", { position: { x: 3, y: 4 } })],
    );
    expect(result[0]?.position).toStrictEqual({ x: 3, y: 4 });
    expect(result[0]?.dragging).toBe(false);
  });

  it("writes measured dimensions, and width/height only when setAttributes asks for it", () => {
    const measured = applyNodeChanges(
      [{ id: "a", type: "dimensions", dimensions: { width: 10, height: 20 } }],
      [node("a")],
    );
    expect(measured[0]?.measured).toStrictEqual({ width: 10, height: 20 });
    expect(measured[0]?.width).toBeUndefined();

    const resized = applyNodeChanges(
      [
        {
          id: "a",
          type: "dimensions",
          dimensions: { width: 10, height: 20 },
          setAttributes: true,
          resizing: true,
        },
      ],
      [node("a")],
    );
    expect(resized[0]?.width).toBe(10);
    expect(resized[0]?.height).toBe(20);
    expect(resized[0]?.resizing).toBe(true);

    const widthOnly = applyNodeChanges(
      [
        {
          id: "a",
          type: "dimensions",
          dimensions: { width: 10, height: 20 },
          setAttributes: "width",
        },
      ],
      [node("a")],
    );
    expect(widthOnly[0]?.width).toBe(10);
    expect(widthOnly[0]?.height).toBeUndefined();
  });

  it("removes a node, and later changes for it cannot bring it back", () => {
    const result = applyNodeChanges(
      [
        { id: "a", type: "remove" },
        { id: "a", type: "select", selected: true },
      ],
      [node("a"), node("b")],
    );
    expect(result.map((item) => item.id)).toStrictEqual(["b"]);
  });

  it("lets a remove discard the changes collected before it", () => {
    const result = applyNodeChanges(
      [
        { id: "a", type: "select", selected: true },
        { id: "a", type: "remove" },
      ],
      [node("a")],
    );
    expect(result).toStrictEqual([]);
  });

  it("replaces a node with a copy of the new item", () => {
    const replacement = node("a", { data: { label: "new" } });
    const result = applyNodeChanges(
      [{ id: "a", type: "replace", item: replacement }],
      [node("a"), node("b")],
    );
    expect(result[0]).toStrictEqual(replacement);
    expect(result[0]).not.toBe(replacement);
  });

  it("appends added nodes, or inserts them at the requested index", () => {
    const appended = applyNodeChanges([{ type: "add", item: node("c") }], [node("a"), node("b")]);
    expect(appended.map((item) => item.id)).toStrictEqual(["a", "b", "c"]);

    const inserted = applyNodeChanges(
      [{ type: "add", item: node("c"), index: 1 }],
      [node("a"), node("b")],
    );
    expect(inserted.map((item) => item.id)).toStrictEqual(["a", "c", "b"]);
  });

  it("applies several changes to one node in order", () => {
    const result = applyNodeChanges(
      [
        { id: "a", type: "position", position: { x: 1, y: 1 } },
        { id: "a", type: "position", position: { x: 2, y: 2 } },
        { id: "a", type: "select", selected: true },
      ],
      [node("a")],
    );
    expect(result[0]?.position).toStrictEqual({ x: 2, y: 2 });
    expect(result[0]?.selected).toBe(true);
  });

  it("ignores changes for ids that do not exist", () => {
    const a = node("a");
    const result = applyNodeChanges([{ id: "zzz", type: "select", selected: true }], [a]);
    expect(result).toStrictEqual([a]);
    expect(result[0]).toBe(a);
  });
});

describe("applyEdgeChanges", () => {
  it("selects, removes, replaces and adds edges", () => {
    const edges = [edge("e1"), edge("e2"), edge("e3")];
    const result = applyEdgeChanges(
      [
        { id: "e1", type: "select", selected: true },
        { id: "e2", type: "remove" },
        { id: "e3", type: "replace", item: edge("e3", { animated: true }) },
        { type: "add", item: edge("e4") },
      ],
      edges,
    );
    expect(result.map((item) => item.id)).toStrictEqual(["e1", "e3", "e4"]);
    expect(result[0]?.selected).toBe(true);
    expect(result[1]?.animated).toBe(true);
  });
});
