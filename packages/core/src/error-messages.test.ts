import { describe, expect, it } from "vite-plus/test";

import { errorMessages } from "./error-messages.ts";

// The texts of the real React Flow 12.12.1 (`errorMessages` of @xyflow/system), for the same arguments.
describe("the messages onError is given", () => {
  it("read as React Flow's do, but for the name of the stylesheet in 013", () => {
    expect({
      error002: errorMessages.error002(),
      error003: errorMessages.error003("X"),
      error004: errorMessages.error004(),
      error005: errorMessages.error005(),
      error006: errorMessages.error006(),
      error007: errorMessages.error007("E"),
      error008: errorMessages.error008("source", { id: "E", sourceHandle: "S", targetHandle: "T" }),
      error009: errorMessages.error009("nope"),
      error010: errorMessages.error010(),
      error011: errorMessages.error011("Y"),
      error012: errorMessages.error012("N"),
      error014: errorMessages.error014(),
      error015: errorMessages.error015(),
    }).toStrictEqual({
      error002:
        "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
      error003: 'Node type "X" not found. Using fallback type "default".',
      error004: "The parent container needs a width and a height to render the graph.",
      error005: "Only child nodes can use a parent extent.",
      error006: "Can't create edge. An edge needs a source and a target.",
      error007: "The old edge with id=E does not exist.",
      error008: 'Couldn\'t create edge for source handle id: "S", edge id: E.',
      error009: 'Marker type "nope" doesn\'t exist.',
      error010: "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
      error011: 'Edge type "Y" not found. Using fallback type "default".',
      error012:
        'Node with id "N" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.',
      error014:
        "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
      error015:
        "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs.",
    });
  });

  it("tell of the target handle for an edge whose target end is the one missing", () => {
    const message = errorMessages.error008("target", {
      id: "E",
      sourceHandle: "S",
      targetHandle: "T",
    });
    expect(message).toBe('Couldn\'t create edge for target handle id: "T", edge id: E.');
  });
});
