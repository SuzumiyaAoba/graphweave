import type { InternalNode } from "@graphweave/core";

// The size a node is given inline. As in React Flow, `initialWidth` and `initialHeight` stand in for
// it until the node's handles have been measured (on the server, and for the first paint).
export function inlineSize(node: InternalNode): { width?: number; height?: number } {
  const unmeasured = node.internals.handleBounds === undefined;
  const width = node.width ?? (unmeasured ? node.initialWidth : undefined);
  const height = node.height ?? (unmeasured ? node.initialHeight : undefined);
  return {
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  };
}
